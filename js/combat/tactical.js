// ===== TACTICAL COMBAT SYSTEMS =====
// Ambush, Overwatch, Suppression, Coordinated Attacks, Hold Position

import {
    state, getHex, getPlayerUnits, spendSharedAP, addGhostIndicator,
    trackUnitAttack, canUnitAttack, setOverwatch, removeOverwatch,
    isUnitOnOverwatch, addSuppressedHex, isHexSuppressed, isHexSuppressedForUnit,
    getHoldPositionBonus, clearHoldPosition, updateHoldPosition,
    areUnitsAllied, getTileScreenPosition
} from '../state.js';
import { UNIT_CLASSES } from '../config.js';
import { hexDistance } from '../hexMath.js';
import { showToast } from '../ui.js';
import { particles } from '../particles.js';
import { playWeaponSound } from '../audio.js';
import { hasLineOfSight } from './calculations.js';
import { RESULT_LEVELS, RESULT_MULTIPLIERS, startMinigame } from '../minigames.js';

// Forward declaration for executeAttack
let executeAttackFn = null;

/**
 * Set executeAttack reference (called from main combat.js)
 */
export function setExecuteAttack(fn) {
    executeAttackFn = fn;
}

// ===== HINTERHALT-SYSTEM =====

/**
 * Prüfe ob eine Einheit einen Hinterhalt vorbereiten kann
 */
export function canPrepareAmbush(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.ambushReady) return false;
    if (state.sharedAP < 1) return false;

    return unit.cloaked || unit.hiding;
}

/**
 * Bereite einen Hinterhalt vor
 */
export function prepareAmbush(unit) {
    if (!canPrepareAmbush(unit)) return false;

    unit.ambushReady = true;
    unit.ambushTriggerRange = unit.range;
    spendSharedAP(1);

    showToast('🎯 Hinterhalt vorbereitet!', 'special');

    const unitHex = getHex(unit.q, unit.r);
    const unitPos = getTileScreenPosition(unit.q, unit.r, unitHex?.height ?? 0);
    particles.burst('warning', unitPos.x, unitPos.y - 10, 5);

    return true;
}

/**
 * Prüfe ob Hinterhalte durch Bewegung ausgelöst werden
 */
export function checkAmbushTriggers(movedUnit) {
    if (!movedUnit || !movedUnit.alive) return [];

    const triggers = [];
    const ambushers = state.units.filter(u =>
        u.alive &&
        u.player !== movedUnit.player &&
        !areUnitsAllied(u, movedUnit) &&
        u.ambushReady &&
        !u.ambushUsedThisTurn
    );

    for (const ambusher of ambushers) {
        const distance = hexDistance(
            { q: ambusher.q, r: ambusher.r },
            { q: movedUnit.q, r: movedUnit.r }
        );

        if (distance <= ambusher.ambushTriggerRange) {
            const los = hasLineOfSight(ambusher.q, ambusher.r, movedUnit.q, movedUnit.r);
            if (los.clear) {
                triggers.push({ ambusher, target: movedUnit });
            }
        }
    }

    return triggers;
}

/**
 * Führe einen Hinterhalt-Angriff aus
 */
export async function executeAmbushAttack(ambusher, target) {
    if (!executeAttackFn) {
        console.error('executeAttack not set');
        return null;
    }

    ambusher.ambushUsedThisTurn = true;
    ambusher.ambushReady = false;

    const wasHidden = ambusher.cloaked || ambusher.hiding;
    if (ambusher.cloaked) ambusher.cloaked = false;
    if (ambusher.hiding) ambusher.hiding = false;

    if (wasHidden) addGhostIndicator(ambusher);

    const ambushBonus = UNIT_CLASSES[ambusher.class]?.ambushBonus || 20;
    const originalDamage = ambusher.damage;
    ambusher.damage += ambushBonus;

    const result = executeAttackFn(ambusher, target, {
        level: RESULT_LEVELS.GOOD,
        multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD]
    });

    ambusher.damage = originalDamage;
    return result;
}

/**
 * Setze Hinterhalt-Status zurück
 */
export function resetAmbushStatus(player) {
    const units = getPlayerUnits(player);
    for (const unit of units) {
        unit.ambushUsedThisTurn = false;
    }
}

// ===== OVERWATCH =====

/**
 * Prüfe ob eine Einheit Overwatch aktivieren kann
 */
export function canUseOverwatch(unit) {
    if (!unit || !unit.alive) return false;
    if (isUnitOnOverwatch(unit.id)) return false;
    if (state.sharedAP < 2) return false;
    if (!canUnitAttack(unit)) return false;

    return true;
}

/**
 * Aktiviere Overwatch für eine Einheit
 */
export function activateOverwatch(unit) {
    if (!canUseOverwatch(unit)) return false;

    spendSharedAP(2);
    setOverwatch(unit.id);

    const unitHex = getHex(unit.q, unit.r);
    const unitPos = getTileScreenPosition(unit.q, unit.r, unitHex?.height ?? 0);
    particles.burst('shield', unitPos.x, unitPos.y - 10, 8);

    showToast('👁️ Overwatch aktiviert! Feinde werden beim Bewegen angegriffen.', 'special');
    return true;
}

/**
 * Prüfe Overwatch-Trigger
 */
export function checkOverwatchTriggers(movedUnit) {
    if (!movedUnit || !movedUnit.alive) return [];

    const triggers = [];
    const watchers = state.units.filter(u =>
        u.alive &&
        u.player !== movedUnit.player &&
        !areUnitsAllied(u, movedUnit) &&
        isUnitOnOverwatch(u.id)
    );

    for (const watcher of watchers) {
        const distance = hexDistance(
            { q: watcher.q, r: watcher.r },
            { q: movedUnit.q, r: movedUnit.r }
        );

        if (distance <= watcher.range) {
            const los = hasLineOfSight(watcher.q, watcher.r, movedUnit.q, movedUnit.r);
            if (los.clear) {
                triggers.push({ watcher, target: movedUnit });
            }
        }
    }

    return triggers;
}

/**
 * Führe Overwatch-Angriff aus
 */
export async function executeOverwatchAttack(watcher, target) {
    if (!executeAttackFn) {
        console.error('executeAttack not set');
        return null;
    }

    removeOverwatch(watcher.id);
    showToast(`⚡ ${UNIT_CLASSES[watcher.class].name} feuert aus Overwatch!`, 'special');

    await new Promise(resolve => setTimeout(resolve, 200));

    const originalDamage = watcher.damage;
    watcher.damage = Math.round(watcher.damage * 0.7);

    const result = executeAttackFn(watcher, target, {
        level: RESULT_LEVELS.GOOD,
        multiplier: { ...RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD], damage: 0.85 }
    });

    watcher.damage = originalDamage;
    return result;
}

// ===== SUPPRESSION =====

/**
 * Prüfe ob eine Einheit Unterdrückungsfeuer legen kann
 */
export function canUseSuppression(unit) {
    if (!unit || !unit.alive) return false;
    if (!['assault', 'sniper'].includes(unit.class)) return false;
    if (state.sharedAP < 2) return false;
    if (!canUnitAttack(unit)) return false;

    return true;
}

/**
 * Lege Unterdrückungsfeuer auf ein Ziel-Hex
 */
export function useSuppression(unit, targetQ, targetR) {
    if (!canUseSuppression(unit)) return false;

    const distance = hexDistance(
        { q: unit.q, r: unit.r },
        { q: targetQ, r: targetR }
    );

    if (distance > unit.range) {
        showToast('❌ Ziel außer Reichweite!', 'error');
        return false;
    }

    const los = hasLineOfSight(unit.q, unit.r, targetQ, targetR);
    if (!los.clear) {
        showToast('❌ Keine Sichtlinie!', 'error');
        return false;
    }

    spendSharedAP(2);
    trackUnitAttack(unit);
    addSuppressedHex(targetQ, targetR, unit.id, 2);

    const targetHex = getHex(targetQ, targetR);
    const targetPos = getTileScreenPosition(targetQ, targetR, targetHex?.height ?? 0);
    particles.burst('warning', targetPos.x, targetPos.y - 10, 12);

    playWeaponSound(unit.class);
    showToast('🔥 Unterdrückungsfeuer! Feinde sind festgenagelt.', 'special');

    return true;
}

/**
 * Berechne Unterdrückungs-Malus
 */
export function getSuppressionPenalty(unit) {
    if (isHexSuppressedForUnit(unit.q, unit.r, unit)) {
        return -30;
    }
    return 0;
}

/**
 * Berechne zusätzliche Bewegungskosten durch Unterdrückung
 */
export function getSuppressionMoveCost(q, r, unit = null) {
    if (unit) {
        if (isHexSuppressedForUnit(q, r, unit)) {
            return 1;
        }
    } else {
        if (isHexSuppressed(q, r)) {
            return 1;
        }
    }
    return 0;
}

// ===== COORDINATED ATTACKS =====

/**
 * Prüfe welche Einheiten ein Ziel koordiniert angreifen können
 */
export function getEligibleCoordinators(targetUnit) {
    const eligible = [];
    const playerUnits = getPlayerUnits(state.currentPlayer);

    for (const unit of playerUnits) {
        if (!unit.alive) continue;
        if (!canUnitAttack(unit)) continue;

        const distance = hexDistance(
            { q: unit.q, r: unit.r },
            { q: targetUnit.q, r: targetUnit.r }
        );

        if (distance <= unit.range) {
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
 */
export async function executeCoordinatedAttack(attackers, target) {
    if (attackers.length === 0 || !executeAttackFn) return [];

    const results = [];
    const bonus = (attackers.length - 1) * state.coordinatedAttack.bonusPerAttacker;

    showToast(`🎯 Koordinierter Angriff! +${Math.round(bonus * 100)}% Bonus`, 'special');

    for (const attacker of attackers) {
        const context = buildMinigameContext(attacker, target);
        context.coordinatedBonus = bonus;

        let minigameResult;
        if (attackers.indexOf(attacker) === 0) {
            minigameResult = await startMinigame(attacker.class, context);
        } else {
            minigameResult = { level: RESULT_LEVELS.GOOD, multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD] };
        }

        const originalDamage = attacker.damage;
        attacker.damage = Math.round(attacker.damage * (1 + bonus));

        const result = executeAttackFn(attacker, target, minigameResult);
        results.push(result);

        attacker.damage = originalDamage;

        if (!target.alive) break;
    }

    return results;
}

// Helper for minigame context
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

// ===== HOLD POSITION =====

/**
 * Berechne Verteidigungsbonus durch Stellung halten
 */
export function calculateHoldPositionDefense(defender) {
    const bonus = getHoldPositionBonus(defender.id);
    return bonus;
}

/**
 * Wird aufgerufen wenn eine Einheit sich bewegt
 */
export function onUnitMoved(unit) {
    clearHoldPosition(unit.id);
}

/**
 * Aktualisiert Stellung-Halten-Status für alle Einheiten
 */
export function updateAllHoldPositions() {
    for (const unit of state.units) {
        if (unit.alive) {
            updateHoldPosition(unit);
        }
    }
}
