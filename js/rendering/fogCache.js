// ===== FOG LEVEL CACHE =====
// Caches fog levels per frame to avoid repeated Set lookups.
// Fog only changes on turn/visibility updates, so within a single frame
// every hex always has the same fog level.

import { getFogLevel } from '../fogOfWar.js';
import { getNeighbors } from '../hexMath.js';
import { getHex } from '../state.js';

/** @type {Map<string, string>} hex key -> fog level */
const fogLevelCache = new Map();

/** @type {Map<string, string>} hex key -> darkest neighbor fog level */
const neighborFogCache = new Map();

/** Cache generation counter to detect stale caches */
let cacheGeneration = 0;
let currentGeneration = -1;

/**
 * Invalidate the fog cache. Call when visibility changes
 * (turn switch, unit movement, ability use).
 */
export function invalidateFogCache() {
    cacheGeneration++;
}

/**
 * Build fog cache for all hexes in a single pass.
 * Call once at the start of each render frame.
 * @param {Array} hexes - All hex tiles from state
 */
export function buildFogCache(hexes) {
    if (currentGeneration === cacheGeneration) return;
    currentGeneration = cacheGeneration;

    fogLevelCache.clear();
    neighborFogCache.clear();

    // Pass 1: cache fog level per hex
    for (const hex of hexes) {
        const key = `${hex.q},${hex.r}`;
        fogLevelCache.set(key, getFogLevel(hex.q, hex.r));
    }

    // Pass 2: cache darkest neighbor fog level per hex
    for (const hex of hexes) {
        const key = `${hex.q},${hex.r}`;
        const centerFog = fogLevelCache.get(key);

        if (centerFog === 'hidden') {
            neighborFogCache.set(key, 'hidden');
            continue;
        }

        let darkest = centerFog;
        const neighbors = getNeighbors(hex.q, hex.r);

        for (const neighbor of neighbors) {
            const neighborHex = getHex(neighbor.q, neighbor.r);
            if (!neighborHex) continue;

            const nKey = `${neighbor.q},${neighbor.r}`;
            const neighborFog = fogLevelCache.get(nKey) || getFogLevel(neighbor.q, neighbor.r);

            if (neighborFog === 'hidden') {
                if (centerFog === 'visible') {
                    darkest = 'explored';
                } else {
                    darkest = 'hidden';
                    break;
                }
            }
            if (neighborFog === 'explored' && darkest === 'visible') {
                darkest = 'explored';
            }
        }

        neighborFogCache.set(key, darkest);
    }
}

/**
 * Get cached fog level for a hex.
 * @param {number} q
 * @param {number} r
 * @returns {string} 'visible' | 'explored' | 'hidden'
 */
export function getCachedFogLevel(q, r) {
    const key = `${q},${r}`;
    const cached = fogLevelCache.get(key);
    if (cached !== undefined) return cached;
    // Fallback for hexes not in cache (edge case)
    return getFogLevel(q, r);
}

/**
 * Get cached darkest neighbor fog level for a hex.
 * @param {number} q
 * @param {number} r
 * @returns {string} 'visible' | 'explored' | 'hidden'
 */
export function getCachedNeighborFogLevel(q, r) {
    const key = `${q},${r}`;
    const cached = neighborFogCache.get(key);
    if (cached !== undefined) return cached;
    // Fallback
    return getCachedFogLevel(q, r);
}
