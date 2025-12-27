// ===== COMBAT SYSTEM =====

import { state, getHex, getPlayerUnits, addGhostIndicator, spendSharedAP, trackUnitAttack, getRemainingAttacks, canUnitAttack, markCombat, triggerScreenShake } from './state.js';
import { UNIT_CLASSES, TERRAIN } from './config.js';
import { hexDistance, hexToPixel, hexLine } from './hexMath.js';
import { killUnit } from './units.js';
import { showToast, showFloatingDamage } from './ui.js';
import { calculateCritical, getEffectiveDamage, trackDamage, awardKillXP, XP_REWARDS, awardXP } from './progression.js';
import { checkEventMiss } from './events.js';
import {
    playWeaponSound, playHit, playCriticalHit, playMiss, playDeath, playShieldBlock,
    playHeal, playSprint, playPowershot, playCloak, playCover
} from './audio.js';
import { particles } from './particles.js';
import { startMinigame, RESULT_LEVELS, RESULT_MULTIPLIERS, areMinigamesEnabled, initMinigames } from './minigames.js';

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
 * NEUES SYSTEM: Nahkampf trifft IMMER, Nahschüsse fast immer,
 * nur am Rand der Reichweite gibt es Fehlschuss-Chance
 */
export function calculateHitChance(attacker, defender) {
    // Distance calculation
    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    const unitRange = attacker.range;

    // === NAHKAMPF (Commando) TRIFFT IMMER ===
    if (attacker.class === 'commando') {
        return 100; // Nahkampf-Attacken verfehlen nie
    }

    // === NAHSCHÜSSE TREFFEN FAST IMMER ===
    // Distanz 1: 100% Trefferchance (Punkt-blank)
    // Distanz 2: 98% Trefferchance
    if (dist === 1) {
        return 100; // Niemand verfehlt aus nächster Nähe
    }
    if (dist === 2) {
        return 98; // Fast unmöglich zu verfehlen
    }

    // === DISTANZBASIERTE TREFFERCHANCE ===
    // Basis: 95% bei mittlerer Reichweite
    // Nur am absoluten Rand der Reichweite sinkt die Chance
    let chance = 95;

    // Berechne wie nah wir am Reichweiten-Limit sind (0 = perfekt, 1 = am Limit)
    const rangeRatio = dist / unitRange;

    // Nur bei mehr als 70% der maximalen Reichweite beginnt Abzug
    if (rangeRatio > 0.7) {
        // Am äußersten Rand (100% Reichweite): bis zu -20% Chance
        const distancePenalty = Math.round((rangeRatio - 0.7) * 67); // Max ~20% bei voller Reichweite
        chance -= distancePenalty;
    }

    // === SNIPER SPEZIAL ===
    // Sniper haben höhere Reichweite, aber am absoluten Rand (5-6 Felder) wird es schwieriger
    if (attacker.class === 'sniper') {
        if (dist >= 5) {
            // Schwieriger Schuss auf maximale Distanz
            chance -= (dist - 4) * 8; // -8% pro Feld über 4
        } else {
            // Sniper sind in mittlerer Reichweite sehr präzise
            chance += 5;
        }
    }

    // === TERRAIN-MODIFIKATOREN ===
    const attHex = getHex(attacker.q, attacker.r);
    const defHex = getHex(defender.q, defender.r);

    // Attacker auf Hügel: +5% (nicht mehr)
    if (attHex && attHex.type === 'hills') {
        chance += 5;
    }

    // Verteidiger auf Hügel: -5% (leicht schwerer zu treffen)
    if (defHex && defHex.type === 'hills') {
        chance -= 5;
    }

    // === SICHTLINIEN-HINDERNISSE ===
    // Nur bei weiter Entfernung relevant
    if (dist >= 4) {
        const losInfo = calculateLineOfSightCover(attacker, defender);
        if (losInfo.hasObstruction) {
            chance -= losInfo.coverCount * 5; // Reduziert von 10%
        }
    }

    // === DECKUNG (WALD) ===
    // Wald reduziert NICHT mehr stark die Trefferchance!
    // Stattdessen reduziert Wald den Schaden (siehe executeAttack)
    // Nur minimaler Malus für aktives Verstecken auf große Distanz
    if (defender.hiding && dist >= 4) {
        const coverEffectiveness = calculateCoverEffectiveness(attacker, defender);
        if (coverEffectiveness > 0) {
            // Max -10% statt -25%
            chance -= Math.round(10 * coverEffectiveness);
        }
    }

    // Scout hat leichten Präzisionsbonus
    if (attacker.class === 'scout') {
        chance += 5;
    }

    // Minimum 75% Chance (außer für sehr schwierige Schüsse)
    // Maximum 100%
    return Math.min(100, Math.max(75, chance));
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
 * Calculate cover damage reduction (NEUES SYSTEM)
 * Wald/Deckung reduziert den Schaden, nicht die Trefferchance
 */
function calculateCoverDamageReduction(attacker, defender) {
    const defHex = getHex(defender.q, defender.r);
    if (!defHex) return 0;

    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    let reduction = 0;

    // Wald/Deckung reduziert Schaden
    if (defHex.cover) {
        // Basis-Schadensreduktion durch Terrain: 15%
        reduction += 0.15;

        // Aktives Verstecken erhöht die Reduktion
        if (defender.hiding) {
            const coverEffectiveness = calculateCoverEffectiveness(attacker, defender);
            // Bis zu +20% extra Reduktion bei guter Deckung
            reduction += 0.20 * coverEffectiveness;
        }
    }

    // Distanz-basierte Schadensreduktion für Fernkämpfer (nicht Sniper)
    // Simuliert Energieverlust des Projektils
    if (dist >= 4 && attacker.class !== 'sniper') {
        reduction += (dist - 3) * 0.05; // 5% pro Feld über 3
    }

    // Hügel-Verteidigung
    if (defHex.type === 'hills') {
        reduction += 0.10; // 10% Schadensreduktion
    }

    // Sichtlinien-Hindernisse reduzieren auch Schaden
    if (dist >= 3) {
        const losInfo = calculateLineOfSightCover(attacker, defender);
        if (losInfo.hasObstruction) {
            reduction += losInfo.coverCount * 0.08; // 8% pro Hindernis
        }
    }

    // === ASSAULT ARMOR PIERCING ===
    // Assault ignoriert einen Teil der Deckungsreduktion
    if (attacker.class === 'assault') {
        const armorPiercing = UNIT_CLASSES.assault.armorPiercing || 0.5;
        reduction *= (1 - armorPiercing); // 50% weniger effektive Deckung gegen Assault
    }

    // Maximum 50% Schadensreduktion
    return Math.min(0.50, reduction);
}

/**
 * Baue den Kontext für das adaptive Minigame
 * Sammelt alle relevanten Kampf-Informationen
 */
function buildMinigameContext(attacker, defender) {
    const attackerHex = getHex(attacker.q, attacker.r);
    const defenderHex = getHex(defender.q, defender.r);

    // Berechne Distanz
    const distance = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    // Zähle Verbündete und Feinde in der Nähe (2 Hex Radius)
    const allUnits = state.units.filter(u => u.alive);
    let alliesInRange = 0;
    let enemiesInRange = 0;

    for (const unit of allUnits) {
        if (unit.id === attacker.id) continue;

        const dist = hexDistance(
            { q: attacker.q, r: attacker.r },
            { q: unit.q, r: unit.r }
        );

        if (dist <= 2) {
            if (unit.player === attacker.player) {
                alliesInRange++;
            } else {
                enemiesInRange++;
            }
        }
    }

    // Prüfe ob aus Tarnung/Hinterhalt
    const isAmbush = attacker.cloaked || attacker.hiding || attacker.ambushReady;

    return {
        distance,
        maxRange: attacker.range || UNIT_CLASSES[attacker.class]?.range || 4,
        attackerTerrain: attackerHex?.type || 'grass',
        targetTerrain: defenderHex?.type || 'grass',
        alliesInRange,
        enemiesInRange,
        isAmbush,
        targetHiding: defender.hiding || false,
        attackerHP: attacker.currentHp / attacker.maxHp,
        targetHP: defender.currentHp / defender.maxHp
    };
}

/**
 * Execute an attack with optional minigame
 * This is the main entry point for attacks - starts minigame first if enabled
 * Returns a Promise with the attack result
 */
export async function executeAttackWithMinigame(attacker, defender) {
    // Check if minigames are enabled
    if (areMinigamesEnabled()) {
        // Baue Kontext für adaptives Minigame
        const context = buildMinigameContext(attacker, defender);

        // Start the minigame for this unit class with context
        const minigameResult = await startMinigame(attacker.class, context);
        // Execute the attack with the minigame result
        return executeAttack(attacker, defender, minigameResult);
    } else {
        // No minigame - execute attack directly with default "good" result
        return executeAttack(attacker, defender, { level: RESULT_LEVELS.GOOD, multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD] });
    }
}

/**
 * Execute an attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} defender - The defending unit
 * @param {Object} minigameResult - Result from the attack minigame (optional)
 */
export function executeAttack(attacker, defender, minigameResult = null) {
    // Default to GOOD result if no minigame result provided (for AI attacks, etc.)
    if (!minigameResult) {
        minigameResult = { level: RESULT_LEVELS.GOOD, multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD] };
    }
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

    // Calculate hit chance with minigame bonus
    let hitChance = calculateHitChance(attacker, defender);

    // Apply minigame hit bonus
    const hitBonus = minigameResult.multiplier.hitBonus || 0;
    if (hitBonus === 1.0) {
        // PERFECT result = guaranteed hit (hitBonus of 1.0 means 100% guaranteed)
        hitChance = 100;
    } else if (hitBonus > 0) {
        // Good result = bonus to hit chance
        hitChance = Math.min(100, hitChance + hitBonus * 100);
    } else if (hitBonus < 0) {
        // Poor minigame result = penalty to hit chance
        hitChance = Math.max(50, hitChance + hitBonus * 100);
    }

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

    // Enhanced muzzle flash at attacker position
    particles.enhancedMuzzleFlash(attackerPos.x, attackerPos.y - 10, attackDirection, attacker.class);

    // Trigger projectile animation (visual tracer from attacker to defender)
    particles.projectileAttack(
        attackerPos.x, attackerPos.y - 10,
        defenderPos.x, defenderPos.y - 10,
        attacker.class, false, null
    );

    // Check for event-based miss (storm)
    if (hit && checkEventMiss(dist)) {
        hit = false;
        playMiss();
        showToast('⛈️ Sturm! Schuss verfehlt!', 'miss');
        // KEIN AP-Verbrauch bei Sturm-Fehlschuss - Spieler kann erneut versuchen
        // Aber zählt als Angriff für diesen Zug
        trackUnitAttack(attacker);
        return { hit: false, damage: 0, killed: false, eventMiss: true, apRefunded: true };
    }

    // === FEHLSCHUSS-BEHANDLUNG ===
    if (!hit) {
        playMiss();
        // NEUES SYSTEM: Fehlschuss kostet KEINE AP!
        // Spieler darf erneut versuchen (zählt aber als Angriff für diese Einheit)
        trackUnitAttack(attacker);

        // Zeige Info dass erneuter Versuch möglich ist (wenn noch AP vorhanden)
        if (state.sharedAP >= 1) {
            showToast('💨 Verfehlt! Erneuter Versuch möglich', 'miss');
        } else {
            showToast('💨 Verfehlt!', 'miss');
        }
        return { hit: false, damage: 0, killed: false, apRefunded: true };
    }

    // === TREFFER - AP wird verbraucht ===
    spendSharedAP(1);

    // Track this attack for the unit
    trackUnitAttack(attacker);

    // Markiere dass Kampf stattgefunden hat (für Shrinking Zone)
    markCombat();

    // Show remaining attacks if limited
    const remaining = getRemainingAttacks(attacker);
    if (remaining === 0) {
        setTimeout(() => {
            showToast(`⚔️ ${UNIT_CLASSES[attacker.class].name}: Keine Angriffe mehr möglich`, 'info');
        }, 500);
    }

    // Check for shield (from power-up)
    if (defender.shield) {
        defender.shield = false;
        playShieldBlock();
        showToast('🛡️ Schild blockiert Angriff!', 'special');
        return { hit: true, damage: 0, killed: false, blocked: true };
    }

    // Calculate base damage with all bonuses
    let damage = getEffectiveDamage(attacker);

    // === MINIGAME DAMAGE MODIFIER ===
    // Apply damage multiplier based on minigame performance
    const damageMultiplier = minigameResult.multiplier.damage;
    damage = Math.floor(damage * damageMultiplier);

    // Show minigame result feedback
    if (minigameResult.level === RESULT_LEVELS.PERFECT) {
        showToast(`🎯 ${minigameResult.multiplier.label}`, 'special');
    } else if (minigameResult.level === RESULT_LEVELS.MISS) {
        showToast(`💨 ${minigameResult.multiplier.label} - Nur Streifschuss!`, 'miss');
    }

    // Assault has damage variance
    if (attacker.class === 'assault') {
        damage += Math.floor(Math.random() * 15);
    }

    // Commando melee bonus (at range 1)
    if (attacker.class === 'commando') {
        if (dist === 1) {
            damage += UNIT_CLASSES.commando.meleeBonus || 20;

            // Ambush-Bonus: Extra Schaden wenn aus Tarnung/Versteck angreifend
            if (wasStealthed) {
                const ambushBonus = UNIT_CLASSES.commando.ambushBonus || 15;
                damage += ambushBonus;
                setTimeout(() => {
                    showToast('🗡️ Hinterhalt! Bonus-Schaden!', 'special');
                }, 200);
            }
        }
    }

    // === NEUES SYSTEM: Deckung reduziert Schaden ===
    const coverReduction = calculateCoverDamageReduction(attacker, defender);
    if (coverReduction > 0) {
        const reducedAmount = Math.floor(damage * coverReduction);
        damage -= reducedAmount;
        if (reducedAmount > 5) {
            setTimeout(() => {
                showToast(`🌲 Deckung absorbiert ${reducedAmount} Schaden`, 'info');
            }, 300);
        }
    }

    // Calculate critical hit (with minigame bonus)
    const crit = calculateCritical(attacker, defender);
    // Perfect minigame gives extra crit chance
    const critBonus = minigameResult.multiplier.critBonus || 0;
    const critRoll = Math.random();
    const hasCrit = crit.isCrit || (critBonus > 0 && critRoll < critBonus);
    if (hasCrit) {
        damage = Math.floor(damage * crit.multiplier);
    }

    // Minimum damage is 5 (can't be completely negated by cover)
    damage = Math.max(5, damage);

    // Apply damage
    defender.currentHp -= damage;

    // Track damage for XP and assists
    trackDamage(attacker, defender, damage);

    // Calculate screen position for floating damage
    const defenderPosScreen = hexToPixel(defender.q, defender.r, state.hexSize);
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const screenX = rect.left + state.offsetX + defenderPosScreen.x;
        const screenY = rect.top + state.offsetY + defenderPosScreen.y - 20;
        showFloatingDamage(screenX, screenY, damage, hasCrit);
    }

    // Play hit sound and show message
    if (hasCrit) {
        playCriticalHit();
        showToast(`⚡ KRITISCH! ${damage} Schaden!`, 'crit');
        // Strong screen shake for critical hits
        triggerScreenShake(12, 300);
    } else {
        playHit();
        showToast(`💥 Treffer! ${damage} Schaden`, 'hit');
        // Normal screen shake for hits
        triggerScreenShake(6, 150);
    }

    // Enhanced hit particle effects at defender position
    // Direction is from attacker to defender (impact direction)
    particles.enhancedHitEffect(defenderPos.x, defenderPos.y - 10, hasCrit, attackDirection, attacker.class);

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

        return { hit: true, damage, killed: true, crit: hasCrit, levelUps, minigameLevel: minigameResult.level };
    }

    return { hit: true, damage, killed: false, crit: hasCrit, minigameLevel: minigameResult.level };
}

/**
 * Get the AP cost for a special ability
 * Different abilities have different costs
 */
export function getSpecialAbilityCost(unitClass) {
    switch (unitClass) {
        case 'scout':
            return 1; // Sprint kostet nur 1 AP - ermöglicht sofortige Bewegung
        case 'assault':
            return 1; // PowerShot kostet nur 1 AP - muss aber mit Angriff kombiniert werden
        case 'medic':
            return 2; // Heilung kostet 2 AP (starker Effekt)
        case 'sniper':
            return 2; // Tarnung kostet 2 AP (strategischer Vorteil)
        case 'commando':
            return 2; // Stealth + Bewegung kostet 2 AP
        default:
            return 2;
    }
}

/**
 * Check if a unit can use its special ability
 */
export function canUseSpecialAbility(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.usedSpecial) return false;

    const cost = getSpecialAbilityCost(unit.class);
    if (state.sharedAP < cost) return false;

    // Spezielle Prüfungen pro Klasse
    switch (unit.class) {
        case 'assault':
            // PowerShot nur sinnvoll wenn Angriff möglich ist
            if (!canUnitAttack(unit)) {
                return false;
            }
            break;
        case 'sniper':
            // Tarnung nur wenn nicht bereits getarnt
            if (unit.cloaked) return false;
            break;
        case 'commando':
            // Stealth nur wenn nicht bereits getarnt
            if (unit.cloaked) return false;
            break;
    }

    return true;
}

/**
 * Use special ability
 */
export function useSpecialAbility(unit) {
    if (!canUseSpecialAbility(unit)) return false;

    const cost = getSpecialAbilityCost(unit.class);
    spendSharedAP(cost);
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
 * Medic healing ability (VERBESSERT)
 */
function useMedicSpecial(unit) {
    const allies = getPlayerUnits(unit.player);
    let totalHealed = 0;

    playHeal();

    // Healing aura at medic position
    const medicPos = hexToPixel(unit.q, unit.r, state.hexSize);
    particles.healEffect(medicPos.x, medicPos.y - 10);

    // Verwende verbesserte Werte aus config
    const healAmount = UNIT_CLASSES.medic.healAmount || 40;
    const healRange = UNIT_CLASSES.medic.healRange || 4;

    allies.forEach(ally => {
        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: ally.q, r: ally.r }
        );

        if (dist <= healRange) {
            const actualHeal = Math.min(healAmount, ally.maxHp - ally.currentHp);
            if (actualHeal > 0) {
                ally.currentHp += actualHeal;
                totalHealed += actualHeal;

                // Healing particles at ally position
                const allyPos = hexToPixel(ally.q, ally.r, state.hexSize);
                particles.burst('heal', allyPos.x, allyPos.y - 10, 8);

                // Show floating heal number
                const canvas = document.getElementById('game-canvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const screenX = rect.left + state.offsetX + allyPos.x;
                    const screenY = rect.top + state.offsetY + allyPos.y - 20;
                    showFloatingDamage(screenX, screenY, actualHeal, false, true);
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
 * Assault powershot ability (VERBESSERT)
 */
function useAssaultSpecial(unit) {
    unit.damage += 25; // Erhöht von 20
    playPowershot();

    // Powershot charging effect
    const unitPos = hexToPixel(unit.q, unit.r, state.hexSize);
    particles.powershotEffect(unitPos.x, unitPos.y - 10, 0); // Direction 0 = right, will spread

    showToast('💥 Powershot bereit! (+25 Schaden)', 'special');
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

// ===== HINTERHALT-SYSTEM =====

/**
 * Prüfe ob eine Einheit einen Hinterhalt vorbereiten kann
 */
export function canPrepareAmbush(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.ambushReady) return false;  // Bereits vorbereitet
    if (state.sharedAP < 1) return false; // Kostet 1 AP

    // Nur aus Tarnung oder Deckung möglich
    return unit.cloaked || unit.hiding;
}

/**
 * Bereite einen Hinterhalt vor
 * Einheit wird automatisch angreifen wenn Feind in Reichweite kommt
 */
export function prepareAmbush(unit) {
    if (!canPrepareAmbush(unit)) return false;

    unit.ambushReady = true;
    unit.ambushTriggerRange = unit.range;
    spendSharedAP(1);

    showToast('🎯 Hinterhalt vorbereitet!', 'special');

    // Visueller Effekt
    const unitPos = hexToPixel(unit.q, unit.r, state.hexSize);
    particles.burst('warning', unitPos.x, unitPos.y - 10, 5);

    return true;
}

/**
 * Prüfe ob Hinterhalte durch Bewegung ausgelöst werden
 * Wird nach jedem Bewegungsschritt aufgerufen
 * @returns {Array} Liste von Hinterhalt-Events
 */
export function checkAmbushTriggers(movedUnit) {
    if (!movedUnit || !movedUnit.alive) return [];

    const triggers = [];

    // Finde alle feindlichen Einheiten mit vorbereitetem Hinterhalt
    const ambushers = state.units.filter(u =>
        u.alive &&
        u.player !== movedUnit.player &&
        u.ambushReady &&
        !u.ambushUsedThisTurn
    );

    for (const ambusher of ambushers) {
        const distance = hexDistance(
            { q: ambusher.q, r: ambusher.r },
            { q: movedUnit.q, r: movedUnit.r }
        );

        // Ist das Ziel in Reichweite?
        if (distance <= ambusher.ambushTriggerRange) {
            // Prüfe Sichtlinie
            const los = hasLineOfSight(ambusher.q, ambusher.r, movedUnit.q, movedUnit.r);
            if (los.clear) {
                triggers.push({
                    ambusher,
                    target: movedUnit
                });
            }
        }
    }

    return triggers;
}

/**
 * Führe einen Hinterhalt-Angriff aus
 * Automatischer Angriff mit Bonus, aber ohne Minigame
 */
export async function executeAmbushAttack(ambusher, target) {
    // Markiere Hinterhalt als verwendet
    ambusher.ambushUsedThisTurn = true;
    ambusher.ambushReady = false;

    // Hinterhalt bricht Tarnung
    const wasHidden = ambusher.cloaked || ambusher.hiding;
    if (ambusher.cloaked) {
        ambusher.cloaked = false;
    }
    if (ambusher.hiding) {
        ambusher.hiding = false;
    }

    // Ghost-Indikator für Hinterhalt-Position
    if (wasHidden) {
        addGhostIndicator(ambusher);
    }

    // Berechne Hinterhalt-Bonus
    const ambushBonus = UNIT_CLASSES[ambusher.class]?.ambushBonus || 20;

    // Temporär Schaden erhöhen
    const originalDamage = ambusher.damage;
    ambusher.damage += ambushBonus;

    // Führe Angriff aus mit automatisch gutem Ergebnis (kein Minigame)
    const result = executeAttack(ambusher, target, {
        level: RESULT_LEVELS.GOOD,
        multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD]
    });

    // Schaden zurücksetzen
    ambusher.damage = originalDamage;

    return result;
}

/**
 * Setze Hinterhalt-Status für alle Einheiten eines Spielers zurück
 * Wird am Anfang jedes Zuges aufgerufen
 */
export function resetAmbushStatus(player) {
    const units = getPlayerUnits(player);
    for (const unit of units) {
        unit.ambushUsedThisTurn = false;
        // ambushReady bleibt aktiv bis ausgelöst
    }
}

// ===== KOORDINIERTE ANGRIFFE =====

/**
 * Prüfe welche Einheiten ein Ziel koordiniert angreifen können
 */
export function getEligibleCoordinators(targetUnit) {
    const eligible = [];
    const playerUnits = getPlayerUnits(state.currentPlayer);

    for (const unit of playerUnits) {
        if (!unit.alive) continue;
        if (!canUnitAttack(unit)) continue;

        // Prüfe ob Einheit das Ziel angreifen kann
        const distance = hexDistance(
            { q: unit.q, r: unit.r },
            { q: targetUnit.q, r: targetUnit.r }
        );

        if (distance <= unit.range) {
            // Prüfe Sichtlinie
            const los = hasLineOfSight(unit.q, unit.r, targetUnit.q, targetUnit.r);
            if (los.clear) {
                eligible.push(unit);
            }
        }
    }

    return eligible;
}

/**
 * Führe einen koordinierten Angriff aus
 * Alle markierten Einheiten greifen gleichzeitig an
 */
export async function executeCoordinatedAttack(attackers, target) {
    if (attackers.length === 0) return [];

    const results = [];
    const bonus = (attackers.length - 1) * state.coordinatedAttack.bonusPerAttacker;

    showToast(`🎯 Koordinierter Angriff! +${Math.round(bonus * 100)}% Bonus`, 'special');

    // Sequentiell für jede Einheit Minigame + Angriff
    for (const attacker of attackers) {
        // Baue Kontext mit Koordinations-Info
        const context = buildMinigameContext(attacker, target);
        context.coordinatedBonus = bonus;

        // Für koordinierte Angriffe: Kürzeres Minigame (Sequenz wäre zu lang)
        // Verwende vereinfachte Variante oder skip für 2.+ Angreifer
        let minigameResult;
        if (attackers.indexOf(attacker) === 0) {
            // Erster Angreifer macht normales Minigame
            minigameResult = await startMinigame(attacker.class, context);
        } else {
            // Weitere Angreifer: Automatisch GOOD (Minigame wäre zu ermüdend)
            minigameResult = { level: RESULT_LEVELS.GOOD, multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD] };
        }

        // Temporär Bonus-Schaden
        const originalDamage = attacker.damage;
        attacker.damage = Math.round(attacker.damage * (1 + bonus));

        const result = executeAttack(attacker, target, minigameResult);
        results.push(result);

        // Schaden zurücksetzen
        attacker.damage = originalDamage;

        // Prüfe ob Ziel noch lebt
        if (!target.alive) break;

        // Kurze Pause zwischen Angriffen
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    return results;
}
