// ===== PATH QUEUE MANAGEMENT =====
// Handles multi-turn path queuing, continuation, and execution

import { state, getHex, getPlayerUnits, setQueuedPath, getQueuedPath, clearQueuedPath } from '../state.js';
import { findPath, getMoveCost } from '../pathfinding.js';
import { animateUnitMovement, canAutoTakeCover, autoTakeCover } from '../units.js';
import { onUnitMoved } from '../combat.js';
import { updateVisibility, getVisibleEnemies } from '../fogOfWar.js';
import { showToast } from '../ui.js';
import { playMoveStart, playMoveEnd } from '../audio.js';
import { checkPowerupPickup } from '../powerups.js';
import { render } from '../renderer.js';
import { updateUI, showPowerupPickup } from '../ui.js';
import { UNIT_CLASSES } from '../config.js';

/**
 * Continue queued path for a unit if it exists
 * @param {Object} unit - The unit to continue path for
 * @returns {boolean} Whether the path was continued
 */
export function continueQueuedPath(unit) {
    const queuedPath = getQueuedPath(unit.id);
    if (!queuedPath || !queuedPath.path || queuedPath.path.length < 2) {
        return false;
    }

    // Recalculate path from current position to target
    const maxMoveCost = state.sharedAP;
    const pathResult = findPath(unit.q, unit.r, queuedPath.targetQ, queuedPath.targetR, unit.move * 10);

    if (!pathResult || !pathResult.path || pathResult.path.length < 2) {
        // Path is no longer valid
        clearQueuedPath(unit.id);
        showToast('❌ Gespeicherter Pfad nicht mehr gültig', 'warning');
        return false;
    }

    // Calculate reachable portion
    let cumulativeCost = 0;
    const reachablePath = [pathResult.path[0]];
    let totalCost = 0;
    let lastReachableIndex = 0;

    for (let i = 1; i < pathResult.path.length; i++) {
        const point = pathResult.path[i];
        const pointHex = getHex(point.q, point.r);
        if (!pointHex) break;
        const prevPoint = pathResult.path[i - 1];
        const prevHex = getHex(prevPoint.q, prevPoint.r);
        cumulativeCost += getMoveCost(prevHex, pointHex);

        if (cumulativeCost <= maxMoveCost && !pointHex.unit) {
            reachablePath.push(point);
            totalCost = cumulativeCost;
            lastReachableIndex = i;
        } else if (pointHex.unit && pointHex.unit.id !== unit.id) {
            break;
        }
    }

    if (reachablePath.length < 2 || totalCost === 0) {
        clearQueuedPath(unit.id);
        return false;
    }

    // Check if we reached the destination
    const isComplete = lastReachableIndex >= pathResult.path.length - 1;

    // Update queued path with remaining
    if (!isComplete) {
        const remainingPath = pathResult.path.slice(lastReachableIndex);
        setQueuedPath(unit.id, remainingPath, queuedPath.targetQ, queuedPath.targetR);
    } else {
        clearQueuedPath(unit.id);
    }

    // Show the path and confirm indicator
    state.currentPath = pathResult.path;
    state.pendingMoveDestination = {
        q: reachablePath[reachablePath.length - 1].q,
        r: reachablePath[reachablePath.length - 1].r
    };

    showToast('📍 Gespeicherter Pfad wird fortgesetzt...', 'info');
    render();

    return true;
}

/**
 * Execute all queued paths for the current player automatically at turn start
 * @returns {Promise<void>}
 */
export async function executeQueuedPathsForPlayer() {
    const playerUnits = getPlayerUnits(state.currentPlayer);
    const unitsWithPaths = playerUnits.filter(unit => {
        const queuedPath = getQueuedPath(unit.id);
        return queuedPath && queuedPath.path && queuedPath.path.length >= 1;
    });

    if (unitsWithPaths.length === 0) return;

    showToast(`📍 ${unitsWithPaths.length} Wegpunkt${unitsWithPaths.length > 1 ? 'e werden' : ' wird'} ausgeführt...`, 'info');

    for (const unit of unitsWithPaths) {
        if (!unit.alive) continue;
        if (state.sharedAP <= 0) break;

        const success = await executeQueuedPathForUnit(unit);
        if (!success) continue;

        // Small delay between units
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    render();
    updateUI();
}

/**
 * Execute a single queued path for a unit
 * @param {Object} unit - The unit to execute path for
 * @param {Function} processReactiveFire - Callback for processing reactive fire
 * @param {Function} scrollToUnit - Callback to scroll to unit
 * @returns {Promise<boolean>} Whether movement was successful
 */
export async function executeQueuedPathForUnit(unit, processReactiveFire = null, scrollToUnit = null) {
    const queuedPath = getQueuedPath(unit.id);
    if (!queuedPath || !queuedPath.path) return false;

    // Recalculate path from current position to target
    const pathResult = findPath(unit.q, unit.r, queuedPath.targetQ, queuedPath.targetR, unit.move * 10);

    if (!pathResult || !pathResult.path || pathResult.path.length < 2) {
        // Path is blocked or invalid
        clearQueuedPath(unit.id);
        const blockedUnitName = UNIT_CLASSES[unit.class]?.name || unit.class;
        showToast(`❌ Pfad für ${blockedUnitName} blockiert`, 'warning');
        return false;
    }

    // Calculate reachable portion with current AP
    const maxMoveCost = state.sharedAP;
    let cumulativeCost = 0;
    const reachablePath = [pathResult.path[0]];
    let totalCost = 0;
    let lastReachableIndex = 0;

    for (let i = 1; i < pathResult.path.length; i++) {
        const point = pathResult.path[i];
        const pointHex = getHex(point.q, point.r);
        if (!pointHex) break;
        const prevPoint = pathResult.path[i - 1];
        const prevHex = getHex(prevPoint.q, prevPoint.r);
        cumulativeCost += getMoveCost(prevHex, pointHex);

        if (cumulativeCost <= maxMoveCost && !pointHex.unit) {
            reachablePath.push(point);
            totalCost = cumulativeCost;
            lastReachableIndex = i;
        } else if (pointHex.unit && pointHex.unit.id !== unit.id) {
            // Path blocked by another unit
            break;
        }
    }

    if (reachablePath.length < 2 || totalCost === 0) {
        // Can't move this turn, keep the path for next turn
        return false;
    }

    // Check if we reached the destination
    const isComplete = lastReachableIndex >= pathResult.path.length - 1;

    // Update or clear queued path
    if (!isComplete) {
        const remainingPath = pathResult.path.slice(lastReachableIndex);
        setQueuedPath(unit.id, remainingPath, queuedPath.targetQ, queuedPath.targetR);
    } else {
        clearQueuedPath(unit.id);
    }

    // Scroll to unit before moving
    if (scrollToUnit) {
        scrollToUnit(unit, 300);
        await new Promise(resolve => setTimeout(resolve, 350));
    }

    // Execute the movement
    playMoveStart();

    // Reveal from cover when moving
    if (unit.hiding) {
        unit.hiding = false;
    }

    await animateUnitMovement(unit, reachablePath, totalCost, null, render, processReactiveFire);

    playMoveEnd();

    // Movement ends hold-position bonus
    onUnitMoved(unit);

    // Check for power-up pickup
    const pickup = checkPowerupPickup(unit);
    if (pickup) {
        showPowerupPickup(pickup.powerup, pickup.result);
    }

    updateVisibility();

    // Auto-take cover if on valid terrain
    if (unit.alive && canAutoTakeCover(unit)) {
        autoTakeCover(unit);
    }

    render();
    updateUI();
    return true;
}

/**
 * Cancel all queued paths for the current player
 * @returns {number} Number of cancelled paths
 */
export function cancelAllQueuedPaths() {
    const playerUnits = getPlayerUnits(state.currentPlayer);
    let cancelled = 0;

    playerUnits.forEach(unit => {
        if (getQueuedPath(unit.id)) {
            clearQueuedPath(unit.id);
            cancelled++;
        }
    });

    if (cancelled > 0) {
        showToast(`🚫 ${cancelled} Wegpunkt${cancelled > 1 ? 'e' : ''} abgebrochen`, 'info');
        render();
    }

    return cancelled;
}

/**
 * Get count of units with queued paths for current player
 * @returns {number}
 */
export function getQueuedPathCount() {
    const playerUnits = getPlayerUnits(state.currentPlayer);
    return playerUnits.filter(unit => {
        const queuedPath = getQueuedPath(unit.id);
        return queuedPath && queuedPath.path && queuedPath.path.length >= 1;
    }).length;
}

/**
 * Update the waypoint cancel button UI based on queued path count
 */
export function updateWaypointUI() {
    const cancelBtn = document.getElementById('cancel-waypoints-btn');
    const waypointCount = document.getElementById('waypoint-count');

    if (!cancelBtn) return;

    const count = getQueuedPathCount();

    if (count > 0) {
        cancelBtn.style.display = 'flex';
        if (waypointCount) {
            waypointCount.textContent = count;
        }
    } else {
        cancelBtn.style.display = 'none';
    }
}
