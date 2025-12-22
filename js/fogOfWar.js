// ===== FOG OF WAR SYSTEM =====

import { hexDistance, getHexesInRange } from './hexMath.js';
import { state, getHex, getPlayerUnits, isHexVisible } from './state.js';
import { CONFIG, UNIT_CLASSES } from './config.js';
import { getFogEventModifier } from './events.js';
import { hasLineOfSight } from './combat.js';

/**
 * Calculate visible hexes for a single unit
 * Uses line-of-sight with terrain blocking
 */
function getUnitVisibleHexes(unit) {
    const visible = new Set();
    // Apply event modifier to vision range
    const eventModifier = getFogEventModifier();
    const visionRange = Math.max(1, (unit.vision || CONFIG.VISION_RANGE) + eventModifier);

    // Get all hexes in vision range
    const hexesInRange = getHexesInRange(unit.q, unit.r, visionRange);

    for (const pos of hexesInRange) {
        const hex = getHex(pos.q, pos.r);
        if (!hex) continue;

        const distance = hexDistance({ q: unit.q, r: unit.r }, pos);
        if (distance > visionRange) continue;

        // Check line of sight using shared combat.js function
        const los = hasLineOfSight(unit.q, unit.r, pos.q, pos.r);
        if (los.clear) {
            visible.add(`${pos.q},${pos.r}`);
        }
    }

    return visible;
}

/**
 * Update visible hexes for current player
 * Should be called at start of turn and after movement
 */
export function updateVisibility() {
    state.visibleHexes.clear();

    // Ensure playerExploredHexes array exists
    if (!state.playerExploredHexes[state.currentPlayer]) {
        state.playerExploredHexes[state.currentPlayer] = new Set();
    }

    // Set current player's explored set as active
    state.exploredHexes = state.playerExploredHexes[state.currentPlayer];

    const playerUnits = getPlayerUnits(state.currentPlayer);

    for (const unit of playerUnits) {
        const unitVisible = getUnitVisibleHexes(unit);
        unitVisible.forEach(key => {
            state.visibleHexes.add(key);
            state.exploredHexes.add(key); // Mark as explored for THIS player only
        });
    }
}

/**
 * Check if an enemy unit is visible to current player
 * Considers line of sight - can't see enemies behind rocks/dense forests
 */
export function isUnitVisible(unit) {
    // Own units are always visible
    if (unit.player === state.currentPlayer) {
        return true;
    }

    // Cloaked units are invisible
    if (unit.cloaked) {
        return false;
    }

    // Enemy units only visible if in visible hex
    if (!isHexVisible(unit.q, unit.r)) {
        return false;
    }

    // Check if at least one friendly unit has line of sight to this enemy
    const playerUnits = getPlayerUnits(state.currentPlayer);
    const hasAnyLOS = playerUnits.some(friendlyUnit => {
        const los = hasLineOfSight(friendlyUnit.q, friendlyUnit.r, unit.q, unit.r);
        return los.clear;
    });

    if (!hasAnyLOS) {
        return false;
    }

    // Units hiding in cover are harder to detect (need to be within 2 hexes with LOS)
    if (unit.hiding) {
        const hidingDetectionRange = 2; // Can only detect hiding units within 2 hexes

        const detected = playerUnits.some(friendlyUnit => {
            const dist = hexDistance(
                { q: friendlyUnit.q, r: friendlyUnit.r },
                { q: unit.q, r: unit.r }
            );
            if (dist > hidingDetectionRange) return false;

            // Also need clear LOS
            const los = hasLineOfSight(friendlyUnit.q, friendlyUnit.r, unit.q, unit.r);
            return los.clear;
        });

        return detected;
    }

    // Sniper/Ninja stealth: harder to detect at range
    if ((unit.class === 'sniper' || unit.class === 'ninja') && unit.stealthActive !== false) {
        const classData = UNIT_CLASSES[unit.class];
        const detectionRange = classData.stealthDetectionRange || 2;

        // Check if any friendly unit is close enough to detect with LOS
        const detected = playerUnits.some(friendlyUnit => {
            const dist = hexDistance(
                { q: friendlyUnit.q, r: friendlyUnit.r },
                { q: unit.q, r: unit.r }
            );
            if (dist > detectionRange) return false;

            // Also need clear LOS
            const los = hasLineOfSight(friendlyUnit.q, friendlyUnit.r, unit.q, unit.r);
            return los.clear;
        });

        return detected;
    }

    return true;
}

/**
 * Get all visible enemy units
 */
export function getVisibleEnemies() {
    return state.units.filter(unit => {
        if (!unit.alive) return false;
        if (unit.player === state.currentPlayer) return false;
        return isUnitVisible(unit);
    });
}

/**
 * Get fog level for a hex (for rendering)
 * Returns: 'visible', 'explored', 'hidden'
 */
export function getFogLevel(q, r) {
    const key = `${q},${r}`;

    if (state.visibleHexes.has(key)) {
        return 'visible';
    }

    if (state.exploredHexes.has(key)) {
        return 'explored';
    }

    return 'hidden';
}
