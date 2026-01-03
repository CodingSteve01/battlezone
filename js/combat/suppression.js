// ===== SUPPRESSION FIRE =====
// Suppression mechanics - reduce enemy accuracy and movement

import { state, getHex, arePlayersAllied } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { showToast } from '../ui.js';
import { render } from '../renderer.js';

/**
 * Check if unit can use suppression
 */
export function canUseSuppression(unit) {
    if (!unit || !unit.alive) return false;
    if (state.sharedAP < 2) return false;

    // Only certain classes can suppress
    const suppressClasses = ['assault', 'scout', 'elitesoldat'];
    if (!suppressClasses.includes(unit.class)) return false;

    return unit.range >= 2;
}

/**
 * Apply suppression to target area
 */
export function useSuppression(unit, targetQ, targetR) {
    if (!canUseSuppression(unit)) return false;

    const dist = hexDistance(
        { q: unit.q, r: unit.r },
        { q: targetQ, r: targetR }
    );

    if (dist > unit.range) {
        showToast('Ziel außer Reichweite', 'error');
        return false;
    }

    // Suppress all enemies in 2-hex radius
    const suppressRadius = 2;
    let suppressedCount = 0;

    for (const enemy of state.units) {
        if (!enemy.alive) continue;
        if (arePlayersAllied(unit.player, enemy.player)) continue;

        const enemyDist = hexDistance(
            { q: targetQ, r: targetR },
            { q: enemy.q, r: enemy.r }
        );

        if (enemyDist <= suppressRadius) {
            applySuppression(enemy, unit);
            suppressedCount++;
        }
    }

    state.sharedAP -= 2;

    if (suppressedCount > 0) {
        showToast(`${unit.name || unit.class} unterdrückt ${suppressedCount} Feinde!`, 'success');
    } else {
        showToast('Keine Feinde im Unterdrückungsbereich', 'warning');
    }

    render();
    return suppressedCount > 0;
}

/**
 * Apply suppression effect to a unit
 */
function applySuppression(unit, suppressor) {
    unit.suppressed = true;
    unit.suppressedBy = suppressor.id;
    unit.suppressionTurns = 2;

    // Track suppression info for display
    if (!unit.suppressionInfo) {
        unit.suppressionInfo = {
            accuracyPenalty: 20,
            movementPenalty: 1
        };
    }
}

/**
 * Get suppression penalty for accuracy
 */
export function getSuppressionPenalty(unit) {
    if (!unit.suppressed) return 0;
    return unit.suppressionInfo?.accuracyPenalty || 20;
}

/**
 * Get suppression movement cost increase
 */
export function getSuppressionMoveCost(unit) {
    if (!unit.suppressed) return 0;
    return unit.suppressionInfo?.movementPenalty || 1;
}

/**
 * Update suppression at start of turn
 */
export function updateSuppression(playerIndex) {
    for (const unit of state.units) {
        if (unit.player !== playerIndex) continue;
        if (!unit.suppressed) continue;

        unit.suppressionTurns--;

        if (unit.suppressionTurns <= 0) {
            clearSuppression(unit);
        }
    }
}

/**
 * Clear suppression from unit
 */
export function clearSuppression(unit) {
    unit.suppressed = false;
    unit.suppressedBy = null;
    unit.suppressionTurns = 0;
    unit.suppressionInfo = null;
}

/**
 * Check if unit is suppressed
 */
export function isSuppressed(unit) {
    return unit.suppressed === true;
}

/**
 * Get all suppressed units for a player
 */
export function getSuppressedUnits(playerIndex) {
    return state.units.filter(u =>
        u.player === playerIndex &&
        u.alive &&
        u.suppressed
    );
}
