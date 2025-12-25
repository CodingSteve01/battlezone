// ===== COMBAT SYSTEM =====

import { state, getHex, getPlayerUnits, addGhostIndicator, spendSharedAP, trackUnitAttack, getRemainingAttacks } from './state.js';
import { UNIT_CLASSES, TERRAIN } from './config.js';
import { hexDistance, hexToPixel, hexLine, getNeighbors } from './hexMath.js';
import { killUnit } from './units.js';
import { showToast, showFloatingDamage } from './ui.js';
import { calculateCritical, getEffectiveDamage, trackDamage, awardKillXP, XP_REWARDS, awardXP } from './progression.js';
import { checkEventMiss } from './events.js';
import {
    playWeaponSound, playHit, playCriticalHit, playMiss, playDeath, playShieldBlock,
    playHeal, playSprint, playPowershot, playCloak, playCover
} from './audio.js';
import { particles } from './particles.js';

/**
 * Check if a unit can take cover on their current hex
 */
export function canTakeCover(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.hiding) return false; // Already hiding
    if (state.sharedAP < 1) return false; // Needs 1 AP from shared pool

    const hex = getHex(unit.q, unit.r);
    if (!hex) return false;

    const terrain = TERRAIN[hex.type];
    return terrain && terrain.canHide;
}

/**
 * Make a unit take cover (hide) on their current hex
 * Returns true if successful
 */
export function takeCover(unit) {
    if (!canTakeCover(unit)) return false;

    unit.hiding = true;
    spendSharedAP(1);  // Spend from shared pool
    playCover();
    showToast('🌲 Deckung genommen!', 'special');
    return true;
}

/**
 * Remove cover/hiding status from a unit
 * Called when moving or attacking
 */
export function revealFromCover(unit) {
    if (unit.hiding) {
        unit.hiding = false;
        showToast('👁️ Aus Deckung aufgetaucht', 'info');
    }
}

/**
 * Check if there is a clear line of sight between two hex positions
 * Returns { clear: boolean, blockedBy: string|null, blockingHex: {q,r}|null }
 * Rocks completely block LOS, multiple forests heavily obstruct
 */
export function hasLineOfSight(fromQ, fromR, toQ, toR) {
    const line = hexLine(
        { q: fromQ, r: fromR },
        { q: toQ, r: toR }
    );

    let forestCount = 0;

    // Check hexes between start and end (excluding start and end)
    for (let i = 1; i < line.length - 1; i++) {
        const hex = getHex(line[i].q, line[i].r);
        if (hex) {
            // Rocks completely block line of sight
            if (hex.type === 'rock') {
                return {
                    clear: false,
                    blockedBy: 'rock',
                    blockingHex: { q: line[i].q, r: line[i].r }
                };
            }
            // Multiple forests block line of sight (simulates dense vegetation)
            if (hex.type === 'forest') {
                forestCount++;
                if (forestCount >= 2) {
                    return {
                        clear: false,
                        blockedBy: 'forest',
                        blockingHex: { q: line[i].q, r: line[i].r }
                    };
                }
            }
        }
    }

    return { clear: true, blockedBy: null, blockingHex: null };
}

/**
 * Calculate how much cover is on the line of sight between attacker and defender
 * Returns an object with cover information
 */
function calculateLineOfSightCover(attacker, defender) {
    const line = hexLine(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    let coverCount = 0;
    const blockingTerrain = [];

    // Check hexes between attacker and defender (excluding start and end)
    for (let i = 1; i < line.length - 1; i++) {
        const hex = getHex(line[i].q, line[i].r);
        if (hex) {
            const terrain = TERRAIN[hex.type];
            if (terrain) {
                // Rocks and forest provide cover on the line of sight
                if (hex.type === 'rock') {
                    coverCount += 2; // Rocks provide more cover
                    blockingTerrain.push('rock');
                } else if (hex.type === 'forest') {
                    coverCount += 1;
                    blockingTerrain.push('forest');
                }
            }
        }
    }

    return {
        coverCount,
        blockingTerrain,
        hasObstruction: coverCount > 0
    };
}

/**
 * Check if defender's cover (hiding position) is effective against this attacker
 * Cover is effective when the defender is positioned so that terrain is between them and the attacker
 */
function isCoverEffectiveAgainstAttacker(attacker, defender) {
    if (!defender.hiding) return false;

    const defHex = getHex(defender.q, defender.r);
    if (!defHex) return false;

    const terrain = TERRAIN[defHex.type];
    if (!terrain || !terrain.canHide) return false;

    const distance = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    // At melee range (distance 1), cover is less effective - enemy is too close
    if (distance <= 1) {
        return false;
    }

    // Check if there's blocking terrain on the line of sight
    // If attacker shoots through forest/obstacles, the defender's cover is effective
    const losInfo = calculateLineOfSightCover(attacker, defender);

    // Cover is effective if:
    // 1. There's terrain blocking the line of sight, OR
    // 2. The defender is in forest and the attack comes from distance >= 2
    //    (simulating the defender using trees as cover in their hex)

    if (losInfo.hasObstruction) {
        return true;
    }

    // If defender is in forest and at range, they can use the local trees as cover
    // But this is less effective than having obstacles between them
    if (defHex.type === 'forest' && distance >= 2) {
        // Check if the attacker's angle allows the defender to hide behind trees
        // We simulate this by checking if the defender's hex has "effective" tree positions
        // For simplicity: at range 2+, forest cover is 70% effective based on direction
        return Math.random() < 0.7;
    }

    return false;
}

/**
 * Calculate the cover direction penalty
 * Returns 0-100% effectiveness based on attacker angle relative to defender
 */
function calculateCoverEffectiveness(attacker, defender) {
    if (!defender.hiding) return 0;

    // Check basic cover effectiveness
    if (!isCoverEffectiveAgainstAttacker(attacker, defender)) {
        return 0; // Cover is not effective from this angle
    }

    // Calculate LOS obstruction
    const losInfo = calculateLineOfSightCover(attacker, defender);

    let effectiveness = 0.5; // Base 50% if cover is effective

    // Add bonus for each obstruction
    effectiveness += losInfo.coverCount * 0.25;

    // Cap at 100%
    return Math.min(1.0, effectiveness);
}

/**
 * Calculate hit chance for an attack
 */
export function calculateHitChance(attacker, defender) {
    let chance = 70; // Base hit chance

    // Get terrain info for both units
    const attHex = getHex(attacker.q, attacker.r);
    const defHex = getHex(defender.q, defender.r);

    // Calculate line of sight cover
    const losInfo = calculateLineOfSightCover(attacker, defender);

    // Penalty for shooting through obstacles
    if (losInfo.hasObstruction) {
        chance -= losInfo.coverCount * 10; // -10% per obstacle
    }

    // Defender in cover terrain (forest) - base cover bonus
    if (defHex && defHex.cover) {
        chance -= 15; // Reduced from 25 - this is passive terrain cover
    }

    // Defender is actively hiding - bonus depends on direction
    if (defender.hiding) {
        const coverEffectiveness = calculateCoverEffectiveness(attacker, defender);
        if (coverEffectiveness > 0) {
            // Cover is effective - apply full hiding bonus scaled by effectiveness
            const hidingPenalty = Math.round(25 * coverEffectiveness);
            chance -= hidingPenalty;
        }
        // If coverEffectiveness is 0, the attacker has a clear shot (flanked)
    }

    // Attacker on hills - better accuracy (high ground)
    if (attHex && attHex.type === 'hills') {
        chance += 15;
    }

    // Defender on hills - harder to hit (defensive position)
    if (defHex && defHex.type === 'hills') {
        chance -= 10;
    }

    // Scout accuracy bonus
    if (attacker.class === 'scout') {
        chance += 15;
    }

    // Distance calculation
    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    // Close-range bonus: harder to miss when up close
    if (dist === 1) {
        chance += 20;
    } else if (dist === 2) {
        chance += 10;
    } else if (dist === 3) {
        chance += 5;
    }

    // Sniper: accuracy bonus, especially at range
    if (attacker.class === 'sniper') {
        chance += 20; // Base accuracy bonus
        // Sniper gets BETTER at range, not worse
        if (dist >= 4) {
            chance += 10; // Optimal range bonus
        }
    } else {
        // Normal units: distance penalty
        chance -= (dist - 1) * 5;
    }

    // Clamp to reasonable bounds
    const clampedChance = Math.min(95, Math.max(25, chance));

    // Commandos at melee range should not miss
    if (attacker.class === 'commando' && dist === 1) {
        return 100;
    }

    return clampedChance;
}

/**
 * Get cover info for UI display
 */
export function getCoverInfo(attacker, defender) {
    const losInfo = calculateLineOfSightCover(attacker, defender);
    const coverEffectiveness = calculateCoverEffectiveness(attacker, defender);
    const distance = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    return {
        hasLineOfSightCover: losInfo.hasObstruction,
        blockingTerrain: losInfo.blockingTerrain,
        isHidingEffective: coverEffectiveness > 0,
        coverEffectiveness: Math.round(coverEffectiveness * 100),
        distance,
        isFlanked: defender.hiding && coverEffectiveness === 0
    };
}

/**
 * Execute an attack
 */
export function executeAttack(attacker, defender) {
    // Track ghost indicator for stealth units before revealing
    // This shows enemy where the attack came from
    const wasStealthed = attacker.cloaked || attacker.hiding ||
        ((attacker.class === 'sniper' || attacker.class === 'commando') && attacker.stealthActive !== false);

    if (wasStealthed && attacker.player !== defender.player) {
        // Add ghost indicator at attack position
        addGhostIndicator(attacker);
    }

    // Remove cloak when attacking, but stay partially visible until end of turn
    if (attacker.cloaked) {
        attacker.cloaked = false;
        attacker.revealedUntilEndOfTurn = true;  // Stay semi-visible until turn ends
        showToast('🔫 Tarnung aufgehoben!', 'special');
    }

    // Remove cover/hiding when attacking
    if (attacker.hiding) {
        attacker.hiding = false;
    }

    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );
    const hitChance = calculateHitChance(attacker, defender);
    const roll = Math.random() * 100;
    let hit = roll < hitChance;

    // Play weapon sound
    playWeaponSound(attacker.class);

    // Calculate positions for particle effects
    const attackerPos = hexToPixel(attacker.q, attacker.r, state.hexSize);
    const defenderPos = hexToPixel(defender.q, defender.r, state.hexSize);

    // Calculate direction from attacker to defender
    const dx = defenderPos.x - attackerPos.x;
    const dy = defenderPos.y - attackerPos.y;
    const attackDirection = Math.atan2(dy, dx);

    // Muzzle flash at attacker position
    particles.muzzleFlash(attackerPos.x, attackerPos.y - 10, attackDirection);

    // Check for event-based miss (storm)
    if (hit && checkEventMiss(dist)) {
        hit = false;
        playMiss();
        showToast('⛈️ Sturm! Schuss verfehlt!', 'miss');
        spendSharedAP(1);  // Spend from shared pool
        trackUnitAttack(attacker);  // Still counts as an attack
        return { hit: false, damage: 0, killed: false, eventMiss: true };
    }

    // Consume AP from shared pool
    spendSharedAP(1);

    // Track this attack for the unit
    trackUnitAttack(attacker);

    // Show remaining attacks if limited
    const remaining = getRemainingAttacks(attacker);
    if (remaining === 0) {
        setTimeout(() => {
            showToast(`⚔️ ${UNIT_CLASSES[attacker.class].name}: Keine Angriffe mehr möglich`, 'info');
        }, 500);
    }

    if (hit) {
        // Check for shield (from power-up)
        if (defender.shield) {
            defender.shield = false;
            playShieldBlock();
            showToast('🛡️ Schild blockiert Angriff!', 'special');
            return { hit: true, damage: 0, killed: false, blocked: true };
        }

        // Calculate base damage with all bonuses
        let damage = getEffectiveDamage(attacker);

        // Assault has damage variance
        if (attacker.class === 'assault') {
            damage += Math.floor(Math.random() * 15);
        }

        // Ninja melee bonus (at range 1)
        if (attacker.class === 'commando') {
            if (dist === 1) {
                damage += UNIT_CLASSES.commando.meleeBonus || 15;
            }
        }

        // Calculate critical hit
        const crit = calculateCritical(attacker, defender);
        if (crit.isCrit) {
            damage = Math.floor(damage * crit.multiplier);
        }

        // Apply damage
        defender.currentHp -= damage;

        // Track damage for XP and assists
        trackDamage(attacker, defender, damage);

        // Calculate screen position for floating damage
        const defenderPos = hexToPixel(defender.q, defender.r, state.hexSize);
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const screenX = rect.left + state.offsetX + defenderPos.x;
            const screenY = rect.top + state.offsetY + defenderPos.y - 20;
            showFloatingDamage(screenX, screenY, damage, crit.isCrit);
        }

        // Play hit sound and show message
        if (crit.isCrit) {
            playCriticalHit();
            showToast(`⚡ KRITISCH! ${damage} Schaden!`, 'crit');
        } else {
            playHit();
            showToast(`💥 Treffer! ${damage} Schaden`, 'hit');
        }

        // Hit particle effects at defender position
        // Direction is from attacker to defender (impact direction)
        particles.hitEffect(defenderPos.x, defenderPos.y - 10, crit.isCrit, attackDirection);

        // Check for kill
        if (defender.currentHp <= 0) {
            killUnit(defender);
            playDeath();

            // Award XP for kill and assists
            const levelUps = awardKillXP(attacker, defender);

            setTimeout(() => {
                showToast(`☠️ ${UNIT_CLASSES[defender.class].name} eliminiert!`, 'hit');
            }, 800);

            // Show level up notifications
            levelUps.forEach((levelUp, i) => {
                setTimeout(() => {
                    import('./audio.js').then(audio => audio.playLevelUp());
                    showToast(`⭐ ${UNIT_CLASSES[levelUp.unit.class].name} → ${levelUp.rank}!`, 'levelup');
                }, 1600 + i * 800);
            });

            return { hit: true, damage, killed: true, crit: crit.isCrit, levelUps };
        }

        return { hit: true, damage, killed: false, crit: crit.isCrit };
    } else {
        playMiss();
        showToast('💨 Verfehlt!', 'miss');
        return { hit: false, damage: 0, killed: false };
    }
}

/**
 * Use special ability
 */
export function useSpecialAbility(unit) {
    if (state.sharedAP < 2 || unit.usedSpecial) return false;

    spendSharedAP(2);  // Spend from shared pool
    unit.usedSpecial = true;

    switch (unit.class) {
        case 'medic':
            return useMedicSpecial(unit);
        case 'scout':
            return useScoutSpecial(unit);
        case 'assault':
            return useAssaultSpecial(unit);
        case 'sniper':
            return useSniperSpecial(unit);
        case 'commando':
            return useNinjaSpecial(unit);
        default:
            return false;
    }
}

/**
 * Medic healing ability
 */
function useMedicSpecial(unit) {
    const allies = getPlayerUnits(unit.player);
    let totalHealed = 0;

    playHeal();

    // Healing aura at medic position
    const medicPos = hexToPixel(unit.q, unit.r, state.hexSize);
    particles.healEffect(medicPos.x, medicPos.y - 10);

    allies.forEach(ally => {
        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: ally.q, r: ally.r }
        );

        if (dist <= 3) {
            const healAmount = Math.min(30, ally.maxHp - ally.currentHp);
            if (healAmount > 0) {
                ally.currentHp += healAmount;
                totalHealed += healAmount;

                // Healing particles at ally position
                const allyPos = hexToPixel(ally.q, ally.r, state.hexSize);
                particles.burst('heal', allyPos.x, allyPos.y - 10, 8);

                // Show floating heal number
                const canvas = document.getElementById('game-canvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const screenX = rect.left + state.offsetX + allyPos.x;
                    const screenY = rect.top + state.offsetY + allyPos.y - 20;
                    showFloatingDamage(screenX, screenY, healAmount, false, true);
                }
            }
        }
    });

    // Award XP for healing
    if (totalHealed > 0) {
        awardXP(unit, XP_REWARDS.HEAL, 'heal');
    }

    showToast(`💚 ${totalHealed} HP geheilt!`, 'special');
    return true;
}

/**
 * Scout sprint ability
 */
function useScoutSpecial(unit) {
    unit.move += 3;
    playSprint();

    // Sprint dust cloud effect
    const unitPos = hexToPixel(unit.q, unit.r, state.hexSize);
    particles.sprintEffect(unitPos.x, unitPos.y);

    showToast('🎯 Sprint aktiviert!', 'special');
    return true;
}

/**
 * Assault powershot ability
 */
function useAssaultSpecial(unit) {
    unit.damage += 20;
    playPowershot();

    // Powershot charging effect
    const unitPos = hexToPixel(unit.q, unit.r, state.hexSize);
    particles.powershotEffect(unitPos.x, unitPos.y - 10, 0); // Direction 0 = right, will spread

    showToast('💥 Powershot bereit!', 'special');
    return true;
}

/**
 * Sniper cloak ability
 */
function useSniperSpecial(unit) {
    unit.cloaked = true;
    playCloak();

    // Cloak shimmer effect
    const unitPos = hexToPixel(unit.q, unit.r, state.hexSize);
    particles.cloakEffect(unitPos.x, unitPos.y - 10);

    showToast('🔫 Getarnt!', 'special');
    return true;
}

/**
 * Ninja stealth + movement ability
 */
function useNinjaSpecial(unit) {
    unit.cloaked = true;
    unit.move += 2;  // Bonus movement
    playCloak();

    // Cloak + sprint effect for commando
    const unitPos = hexToPixel(unit.q, unit.r, state.hexSize);
    particles.cloakEffect(unitPos.x, unitPos.y - 10);
    particles.sprintEffect(unitPos.x, unitPos.y);

    showToast('🥷 Schleichen aktiviert!', 'special');
    return true;
}

/**
 * Check if the game is over
 */
export function checkGameOver() {
    const alivePlayers = [];

    for (let p = 0; p < state.settings.players; p++) {
        if (getPlayerUnits(p).length > 0) {
            alivePlayers.push(p);
        }
    }

    if (alivePlayers.length <= 1) {
        return {
            gameOver: true,
            winner: alivePlayers[0] ?? null
        };
    }

    return { gameOver: false, winner: null };
}
