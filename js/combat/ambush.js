// ===== AMBUSH & OVERWATCH =====
// Reactive fire mechanics

import { state, getHex, getPlayerUnits, arePlayersAllied } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { showToast } from '../ui.js';
import { render } from '../renderer.js';
import { isUnitVisible } from '../fogOfWar.js';

/**
 * Check if unit can prepare an ambush
 */
export function canPrepareAmbush(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.isAmbushing) return false;
    if (state.sharedAP < 1) return false;

    // Must have weapon with range
    return unit.range >= 1;
}

/**
 * Prepare unit for ambush
 */
export function prepareAmbush(unit) {
    if (!canPrepareAmbush(unit)) return false;

    unit.isAmbushing = true;
    unit.ambushDirection = null; // All directions
    state.sharedAP -= 1;

    showToast(`${unit.name || unit.class} bereitet Hinterhalt vor`, 'info');
    render();

    return true;
}

/**
 * Check for ambush triggers when enemy moves
 */
export function checkAmbushTriggers(movingUnit) {
    const triggers = [];

    for (const unit of state.units) {
        if (!unit.alive || !unit.isAmbushing) continue;
        if (arePlayersAllied(unit.player, movingUnit.player)) continue;

        // Check if moving unit is in range
        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: movingUnit.q, r: movingUnit.r }
        );

        if (dist <= unit.range) {
            // Check line of sight
            if (isUnitVisible(movingUnit)) {
                triggers.push({
                    ambusher: unit,
                    target: movingUnit,
                    distance: dist
                });
            }
        }
    }

    return triggers;
}

/**
 * Execute ambush attack
 */
export async function executeAmbushAttack(ambusher, target) {
    if (!ambusher.alive || !target.alive) return null;

    // Import executeAttack dynamically to avoid circular deps
    const { executeAttack } = await import('./index.js');

    // Ambush attack with bonus
    const originalDamage = ambusher.damage;
    ambusher.damage = Math.floor(originalDamage * 1.25); // 25% bonus damage

    showToast(`${ambusher.name || ambusher.class} führt Hinterhalt aus!`, 'warning');

    const result = await executeAttack(ambusher, target, { isAmbush: true });

    // Restore damage and clear ambush state
    ambusher.damage = originalDamage;
    ambusher.isAmbushing = false;

    return result;
}

/**
 * Reset ambush status for all units
 */
export function resetAmbushStatus(playerIndex) {
    for (const unit of state.units) {
        if (unit.player === playerIndex) {
            unit.isAmbushing = false;
        }
    }
}

/**
 * Check if unit can use overwatch
 */
export function canUseOverwatch(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.isOverwatching) return false;
    if (state.sharedAP < 2) return false;

    return unit.range >= 2;
}

/**
 * Activate overwatch for unit
 */
export function activateOverwatch(unit) {
    if (!canUseOverwatch(unit)) return false;

    unit.isOverwatching = true;
    unit.overwatchShots = 2; // Can fire twice
    state.sharedAP -= 2;

    showToast(`${unit.name || unit.class} aktiviert Überdeckung`, 'info');
    render();

    return true;
}

/**
 * Check for overwatch triggers
 */
export function checkOverwatchTriggers(movingUnit) {
    const triggers = [];

    for (const unit of state.units) {
        if (!unit.alive || !unit.isOverwatching) continue;
        if (unit.overwatchShots <= 0) continue;
        if (arePlayersAllied(unit.player, movingUnit.player)) continue;

        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: movingUnit.q, r: movingUnit.r }
        );

        // Overwatch has slightly reduced range
        if (dist <= unit.range - 1) {
            if (isUnitVisible(movingUnit)) {
                triggers.push({
                    overwatcher: unit,
                    target: movingUnit,
                    distance: dist
                });
            }
        }
    }

    return triggers;
}

/**
 * Execute overwatch attack
 */
export async function executeOverwatchAttack(overwatcher, target) {
    if (!overwatcher.alive || !target.alive) return null;
    if (overwatcher.overwatchShots <= 0) return null;

    const { executeAttack } = await import('./index.js');

    // Overwatch has reduced accuracy
    const originalDamage = overwatcher.damage;
    overwatcher.damage = Math.floor(originalDamage * 0.8); // 20% less damage

    overwatcher.overwatchShots--;

    showToast(`${overwatcher.name || overwatcher.class} feuert Überdeckung!`, 'warning');

    const result = await executeAttack(overwatcher, target, { isOverwatch: true });

    overwatcher.damage = originalDamage;

    // Clear overwatch if no shots left
    if (overwatcher.overwatchShots <= 0) {
        overwatcher.isOverwatching = false;
    }

    return result;
}

/**
 * Reset overwatch at start of turn
 */
export function resetOverwatchStatus(playerIndex) {
    for (const unit of state.units) {
        if (unit.player === playerIndex) {
            unit.isOverwatching = false;
            unit.overwatchShots = 0;
        }
    }
}

/**
 * Get eligible units for coordinated attack
 */
export function getEligibleCoordinators(targetUnit) {
    const currentUnit = state.units[state.selectedUnit];
    if (!currentUnit) return [];

    const eligible = [];

    for (const unit of state.units) {
        if (!unit.alive) continue;
        if (unit.id === currentUnit.id) continue;
        if (!arePlayersAllied(unit.player, currentUnit.player)) continue;

        // Check if can attack target
        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: targetUnit.q, r: targetUnit.r }
        );

        if (dist <= unit.range && state.sharedAP >= 1) {
            eligible.push(unit);
        }
    }

    return eligible;
}

/**
 * Execute coordinated attack from multiple units
 */
export async function executeCoordinatedAttack(targetUnit, attackers) {
    if (!targetUnit || !attackers || attackers.length === 0) return [];

    const { executeAttack } = await import('./index.js');
    const results = [];

    showToast(`Koordinierter Angriff mit ${attackers.length} Einheiten!`, 'info');

    for (const attacker of attackers) {
        if (!attacker.alive || !targetUnit.alive) break;

        const result = await executeAttack(attacker, targetUnit, { isCoordinated: true });
        results.push(result);

        // Small delay between attacks for visual feedback
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    return results;
}
