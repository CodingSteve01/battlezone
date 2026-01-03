// ===== COMBAT SYSTEM =====
// Main combat entry point - coordinates modules

import {
    state, getHex, getPlayerUnits, addGhostIndicator, spendSharedAP,
    trackUnitAttack, getRemainingAttacks, markCombat, triggerScreenShake,
    areUnitsAllied, hasAlliances, getTileScreenPosition,
    recordKill, recordDamageDealt, recordDamageTaken, recordShot, recordUnitLost
} from './state.js';
import { CONFIG, UNIT_CLASSES, TERRAIN } from './config.js';
import { hexDistance } from './hexMath.js';
import { killUnit } from './units.js';
import { showToast, showFloatingDamage } from './ui.js';
import { calculateCritical, getEffectiveDamage, trackDamage, awardKillXP, XP_REWARDS, awardXP } from './progression.js';
import { checkEventMiss } from './events.js';
import {
    playWeaponSound, playHit, playCriticalHit, playMiss, playDeath, playShieldBlock,
    playCover
} from './audio.js';
import { particles } from './particles.js';
import { startMinigame, RESULT_LEVELS, RESULT_MULTIPLIERS, areMinigamesEnabled } from './minigames.js';

// Import from modules
import {
    hasLineOfSight,
    calculateLineOfSightCover,
    calculateHitChance,
    calculateCoverDamageReduction
} from './combat/calculations.js';

import { setExecuteAttack } from './combat/tactical.js';

// Re-export everything from modules
export * from './combat/calculations.js';
export * from './combat/abilities.js';
export * from './combat/tactical.js';

// ===== CORE COMBAT FUNCTIONS =====

/**
 * Prüfe ob ein Angriff auf ein Ziel erlaubt ist
 */
export function canAttackTarget(attacker, target) {
    if (!attacker || !target) return false;
    if (!attacker.alive || !target.alive) return false;

    if (areUnitsAllied(attacker, target)) {
        return false;
    }

    return true;
}

/**
 * Check if a unit can take cover on their current hex
 */
export function canTakeCover(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.hiding) return false;
    if (state.sharedAP < 1) return false;

    const hex = getHex(unit.q, unit.r);
    if (!hex) return false;

    const terrain = TERRAIN[hex.type];
    return terrain && terrain.canHide;
}

/**
 * Make a unit take cover
 */
export function takeCover(unit) {
    if (!canTakeCover(unit)) return false;

    unit.hiding = true;
    spendSharedAP(1);
    playCover();
    showToast('🌲 Deckung genommen!', 'special');
    return true;
}

/**
 * Remove cover/hiding status from a unit
 */
export function revealFromCover(unit) {
    if (unit.hiding) {
        unit.hiding = false;
        showToast('👁️ Aus Deckung aufgetaucht', 'info');
    }
}

// ===== MINIGAME CONTEXT =====

/**
 * Build context for adaptive minigame
 */
function buildMinigameContext(attacker, defender) {
    const attackerHex = getHex(attacker.q, attacker.r);
    const defenderHex = getHex(defender.q, defender.r);

    const distance = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

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

// ===== ATTACK EXECUTION =====

/**
 * Execute an attack with optional minigame
 */
export async function executeAttackWithMinigame(attacker, defender) {
    if (!canAttackTarget(attacker, defender)) {
        showToast('❌ Verbündete können nicht angegriffen werden!', 'error');
        return { hit: false, damage: 0, killed: false, blocked: true, allyProtected: true };
    }

    if (areMinigamesEnabled()) {
        const context = buildMinigameContext(attacker, defender);
        const minigameResult = await startMinigame(attacker.class, context);

        if (minigameResult.cancelled) {
            return { hit: false, damage: 0, killed: false, cancelled: true };
        }

        return executeAttack(attacker, defender, minigameResult);
    } else {
        return executeAttack(attacker, defender, {
            level: RESULT_LEVELS.GOOD,
            multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD]
        });
    }
}

/**
 * Execute an attack
 */
export function executeAttack(attacker, defender, minigameResult = null) {
    if (!canAttackTarget(attacker, defender)) {
        showToast('❌ Verbündete können nicht angegriffen werden!', 'error');
        return { hit: false, damage: 0, killed: false, blocked: true, allyProtected: true };
    }

    if (!minigameResult) {
        minigameResult = { level: RESULT_LEVELS.GOOD, multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD] };
    }

    // Track stealth for ghost indicator
    const wasStealthed = attacker.cloaked || attacker.hiding ||
        ((attacker.class === 'sniper' || attacker.class === 'commando') && attacker.stealthActive !== false);

    if (wasStealthed && attacker.player !== defender.player) {
        addGhostIndicator(attacker);
    }

    // Remove cloak when attacking
    if (attacker.cloaked) {
        attacker.cloaked = false;
        attacker.revealedUntilEndOfTurn = true;
        showToast('🔫 Tarnung aufgehoben!', 'special');
    }

    if (attacker.hiding) {
        attacker.hiding = false;
    }

    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    // Calculate hit chance with minigame bonus
    let hitChance = calculateHitChance(attacker, defender);
    const hitBonus = minigameResult.multiplier.hitBonus || 0;

    if (hitBonus === 1.0) {
        hitChance = 100;
    } else if (hitBonus > 0) {
        hitChance = Math.min(100, hitChance + hitBonus * 100);
    } else if (hitBonus < 0) {
        hitChance = Math.max(50, hitChance + hitBonus * 100);
    }

    const roll = Math.random() * 100;
    let hit = roll < hitChance;

    playWeaponSound(attacker.class);

    // Calculate positions for particles
    const attackerHex = getHex(attacker.q, attacker.r);
    const defenderHex = getHex(defender.q, defender.r);
    const attackerPos = getTileScreenPosition(attacker.q, attacker.r, attackerHex?.height ?? 0);
    const defenderPos = getTileScreenPosition(defender.q, defender.r, defenderHex?.height ?? 0);

    const dx = defenderPos.x - attackerPos.x;
    const dy = defenderPos.y - attackerPos.y;
    const attackDirection = Math.atan2(dy, dx);

    particles.enhancedMuzzleFlash(attackerPos.x, attackerPos.y - 10, attackDirection, attacker.class);
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
        trackUnitAttack(attacker);
        return { hit: false, damage: 0, killed: false, eventMiss: true, apRefunded: true };
    }

    // Miss handling
    if (!hit) {
        playMiss();
        recordShot(attacker.player, false);

        if (state.sharedAP >= 1) {
            showToast('💨 Verfehlt! Erneuter Versuch möglich', 'miss');
        } else {
            showToast('💨 Verfehlt!', 'miss');
        }
        return { hit: false, damage: 0, killed: false, apRefunded: true };
    }

    // Hit - spend AP
    spendSharedAP(1);
    trackUnitAttack(attacker);
    markCombat();

    const remaining = getRemainingAttacks(attacker);
    if (remaining === 0) {
        setTimeout(() => {
            showToast(`⚔️ ${UNIT_CLASSES[attacker.class].name}: Keine Angriffe mehr möglich`, 'info');
        }, 500);
    }

    // Shield check
    if (defender.shield) {
        defender.shield = false;
        playShieldBlock();
        showToast('🛡️ Schild blockiert Angriff!', 'special');
        return { hit: true, damage: 0, killed: false, blocked: true };
    }

    // Calculate damage
    let damage = getEffectiveDamage(attacker);
    const damageMultiplier = minigameResult.multiplier.damage;
    damage = Math.floor(damage * damageMultiplier);

    // Minigame feedback
    if (minigameResult.level === RESULT_LEVELS.PERFECT) {
        showToast(`🎯 ${minigameResult.multiplier.label}`, 'special');
    } else if (minigameResult.level === RESULT_LEVELS.MISS) {
        showToast(`💨 ${minigameResult.multiplier.label} - Nur Streifschuss!`, 'miss');
    }

    // Assault variance
    if (attacker.class === 'assault') {
        damage += Math.floor(Math.random() * 15);
    }

    // General melee bonus
    if (dist === 1 && !['commando', 'elitesoldat'].includes(attacker.class)) {
        damage += 15;
        setTimeout(() => showToast('⚔️ Nahkampf-Bonus!', 'info'), 100);
    }

    // Commando melee bonus
    if (attacker.class === 'commando' && dist === 1) {
        damage += UNIT_CLASSES.commando.meleeBonus || 20;
        if (wasStealthed) {
            damage += UNIT_CLASSES.commando.ambushBonus || 15;
            setTimeout(() => showToast('🗡️ Hinterhalt! Bonus-Schaden!', 'special'), 200);
        }
    }

    // Elite soldier bonus
    if (attacker.class === 'elitesoldat' && dist === 1) {
        damage += UNIT_CLASSES.elitesoldat.meleeBonus || 30;
        setTimeout(() => showToast('⚔️ Nahkampf! Bonus-Schaden!', 'special'), 200);
    }

    // Sniper precision bonus
    if (attacker.class === 'sniper') {
        const attHex = getHex(attacker.q, attacker.r);
        const defHex = getHex(defender.q, defender.r);
        const losInfo = calculateLineOfSightCover(attacker, defender);

        const isOptimalRange = dist >= 2 && dist <= 4;
        const hasClearLOS = !losInfo.hasObstruction;
        const hasElevation = attHex && attHex.type === 'hills';
        const targetInOpen = defHex && !defHex.cover && !defender.hiding;

        let optimalConditions = 0;
        if (isOptimalRange) optimalConditions++;
        if (hasClearLOS) optimalConditions++;
        if (hasElevation) optimalConditions++;
        if (targetInOpen) optimalConditions++;

        if (optimalConditions >= 3) {
            const precisionBonus = optimalConditions === 4 ? 20 : 12;
            damage += precisionBonus;
            setTimeout(() => showToast('🎯 Präzisionsschuss! Optimale Bedingungen!', 'special'), 150);
        } else if (optimalConditions === 2) {
            damage += 8;
        }
    }

    // Cover damage reduction
    const coverReduction = calculateCoverDamageReduction(attacker, defender);
    if (coverReduction > 0) {
        const reducedAmount = Math.floor(damage * coverReduction);
        damage -= reducedAmount;
        if (reducedAmount > 5) {
            setTimeout(() => showToast(`🌲 Deckung absorbiert ${reducedAmount} Schaden`, 'info'), 300);
        }
    }

    // Critical hit
    const crit = calculateCritical(attacker, defender);
    const critBonus = minigameResult.multiplier.critBonus || 0;
    const critRoll = Math.random();
    const hasCrit = crit.isCrit || (critBonus > 0 && critRoll < critBonus);
    if (hasCrit) {
        damage = Math.floor(damage * crit.multiplier);
    }

    damage = Math.max(5, damage);
    defender.currentHp -= damage;

    // Stats tracking
    recordShot(attacker.player, true, hasCrit);
    recordDamageDealt(attacker.player, damage);
    recordDamageTaken(defender.player, damage);
    trackDamage(attacker, defender, damage);

    // Floating damage
    const defenderPosScreen = getTileScreenPosition(defender.q, defender.r, defenderHex?.height ?? 0);
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const screenX = rect.left + state.offsetX + defenderPosScreen.x;
        const screenY = rect.top + state.offsetY + defenderPosScreen.y - 20;
        showFloatingDamage(screenX, screenY, damage, hasCrit);
    }

    // Hit effects
    if (hasCrit) {
        playCriticalHit();
        showToast(`⚡ KRITISCH! ${damage} Schaden!`, 'crit');
        triggerScreenShake(12, 300);
    } else {
        playHit();
        showToast(`💥 Treffer! ${damage} Schaden`, 'hit');
        triggerScreenShake(6, 150);
    }

    particles.enhancedHitEffect(defenderPos.x, defenderPos.y - 10, hasCrit, attackDirection, attacker.class);

    // Kill check
    if (defender.currentHp <= 0) {
        killUnit(defender);
        playDeath();
        recordKill(attacker.player, dist);
        recordUnitLost(defender.player);

        const levelUps = awardKillXP(attacker, defender);

        setTimeout(() => {
            showToast(`☠️ ${UNIT_CLASSES[defender.class].name} eliminiert!`, 'hit');
        }, 800);

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

// ===== GAME STATE =====

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

    if (!hasAlliances()) {
        if (alivePlayers.length <= 1) {
            return {
                gameOver: true,
                winner: alivePlayers[0] ?? null,
                winningTeam: null
            };
        }
        return { gameOver: false, winner: null, winningTeam: null };
    }

    const aliveTeams = new Set();
    for (const player of alivePlayers) {
        const team = state.settings.alliances[player];
        if (team !== undefined) {
            aliveTeams.add(team);
        }
    }

    if (aliveTeams.size <= 1) {
        const winningTeam = aliveTeams.size === 1 ? [...aliveTeams][0] : null;
        const winner = winningTeam !== null
            ? alivePlayers.find(p => state.settings.alliances[p] === winningTeam) ?? null
            : null;

        return {
            gameOver: true,
            winner: winner,
            winningTeam: winningTeam,
            isTeamVictory: true
        };
    }

    return { gameOver: false, winner: null, winningTeam: null };
}

// Wire up the tactical module with executeAttack
setExecuteAttack(executeAttack);
