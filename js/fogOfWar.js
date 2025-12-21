// ===== FOG OF WAR SYSTEM =====

import { hexDistance, getHexesInRange, hexLine } from './hexMath.js';
import { state, getHex, getPlayerUnits, isHexVisible } from './state.js';
import { CONFIG } from './config.js';

/**
 * Calculate visible hexes for a single unit
 * Uses line-of-sight with terrain blocking
 */
function getUnitVisibleHexes(unit) {
    const visible = new Set();
    const visionRange = unit.vision || CONFIG.VISION_RANGE;

    // Get all hexes in vision range
    const hexesInRange = getHexesInRange(unit.q, unit.r, visionRange);

    for (const pos of hexesInRange) {
        const hex = getHex(pos.q, pos.r);
        if (!hex) continue;

        const distance = hexDistance({ q: unit.q, r: unit.r }, pos);
        if (distance > visionRange) continue;

        // Check line of sight
        if (hasLineOfSight(unit.q, unit.r, pos.q, pos.r)) {
            visible.add(`${pos.q},${pos.r}`);
        }
    }

    return visible;
}

/**
 * Check if there's line of sight between two hexes
 * Blocked by rocks and reduced through forests
 */
export function hasLineOfSight(fromQ, fromR, toQ, toR) {
    const line = hexLine({ q: fromQ, r: fromR }, { q: toQ, r: toR });

    let forestCount = 0;
    const maxForests = 2; // Can see through up to 2 forest hexes

    // Skip first (starting position) and check each hex in line
    for (let i = 1; i < line.length - 1; i++) {
        const pos = line[i];
        const hex = getHex(pos.q, pos.r);

        if (!hex) return false;

        // Rocks block line of sight completely
        if (hex.type === 'rock') {
            return false;
        }

        // Forests reduce visibility
        if (hex.type === 'forest') {
            forestCount++;
            if (forestCount > maxForests) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Update visible hexes for current player
 * Should be called at start of turn and after movement
 */
export function updateVisibility() {
    state.visibleHexes.clear();

    const playerUnits = getPlayerUnits(state.currentPlayer);

    for (const unit of playerUnits) {
        const unitVisible = getUnitVisibleHexes(unit);
        unitVisible.forEach(key => {
            state.visibleHexes.add(key);
            state.exploredHexes.add(key); // Mark as explored
        });
    }
}

/**
 * Check if an enemy unit is visible to current player
 */
export function isUnitVisible(unit) {
    // Own units are always visible
    if (unit.player === state.currentPlayer) {
        return true;
    }

    // Enemy units only visible if in visible hex
    return isHexVisible(unit.q, unit.r);
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
