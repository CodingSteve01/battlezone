// ===== FOG OF WAR SYSTEM =====

import { hexDistance, getHexesInRange } from './hexMath.js';
import { state, getHex, getPlayerUnits, isHexVisible, isHexVisibleToPlayer, markEnemyContact, getAlliedPlayers, arePlayersAllied } from './state.js';
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
 * Update visible hexes for a specific player
 * Includes visibility from allied players (team members share vision)
 */
export function updateVisibilityForPlayer(player) {
    // Ensure arrays exist
    if (!state.playerVisibleHexes[player]) {
        state.playerVisibleHexes[player] = new Set();
    }
    if (!state.playerExploredHexes[player]) {
        state.playerExploredHexes[player] = new Set();
    }

    // Clear and recalculate visible hexes for this player
    state.playerVisibleHexes[player].clear();

    // Get all allied players (including self) for shared vision
    const alliedPlayers = getAlliedPlayers(player);

    // Collect visibility from all allied players' units
    for (const allyPlayer of alliedPlayers) {
        const allyUnits = getPlayerUnits(allyPlayer);

        for (const unit of allyUnits) {
            const unitVisible = getUnitVisibleHexes(unit);
            unitVisible.forEach(key => {
                state.playerVisibleHexes[player].add(key);
                state.playerExploredHexes[player].add(key);
            });
        }
    }
}

/**
 * Update visible hexes for current player
 * Should be called at start of turn and after movement
 * Includes shared vision from allied players (team members)
 */
export function updateVisibility() {
    state.visibleHexes.clear();

    // Ensure playerExploredHexes array exists
    if (!state.playerExploredHexes[state.currentPlayer]) {
        state.playerExploredHexes[state.currentPlayer] = new Set();
    }
    if (!state.playerVisibleHexes[state.currentPlayer]) {
        state.playerVisibleHexes[state.currentPlayer] = new Set();
    }

    // Clear visible hexes before recalculating (like updateVisibilityForPlayer does)
    state.playerVisibleHexes[state.currentPlayer].clear();

    // Set current player's explored set as active
    state.exploredHexes = state.playerExploredHexes[state.currentPlayer];

    // Get all allied players (including self) for shared vision
    const alliedPlayers = getAlliedPlayers(state.currentPlayer);

    // Collect visibility from all allied players' units
    for (const allyPlayer of alliedPlayers) {
        const allyUnits = getPlayerUnits(allyPlayer);

        for (const unit of allyUnits) {
            const unitVisible = getUnitVisibleHexes(unit);
            unitVisible.forEach(key => {
                state.visibleHexes.add(key);
                state.exploredHexes.add(key); // Mark as explored for THIS player only
                state.playerVisibleHexes[state.currentPlayer].add(key); // Also store in per-player array
            });
        }
    }

    // Update spotted status for current player's units
    updateSpottedStatus();
}

/**
 * Check if a unit is visible to a specific player
 * Used for rendering from a specific player's perspective
 * Allied units are always visible (team members share vision)
 */
export function isUnitVisibleToPlayer(unit, viewerPlayer) {
    // Own units are always visible to their owner
    if (unit.player === viewerPlayer) {
        return true;
    }

    // Allied units are always visible (team members share vision)
    if (arePlayersAllied(unit.player, viewerPlayer)) {
        return true;
    }

    // Units revealed after attacking are visible until end of their turn
    if (unit.revealedUntilEndOfTurn) {
        // Still need to be in visible hex with LOS
        if (!isHexVisibleToPlayer(unit.q, unit.r, viewerPlayer)) {
            return false;
        }
        const viewerUnits = getPlayerUnits(viewerPlayer);
        const hasAnyLOS = viewerUnits.some(friendlyUnit => {
            const los = hasLineOfSight(friendlyUnit.q, friendlyUnit.r, unit.q, unit.r);
            return los.clear;
        });
        return hasAnyLOS;
    }

    // Cloaked units can be detected if very close (proximity detection)
    if (unit.cloaked) {
        // Flare event reveals all cloaked units
        if (unit.flareRevealed) {
            // Continue to normal visibility checks - flare reveals them
        } else {
            const viewerUnits = getPlayerUnits(viewerPlayer);
            const classData = UNIT_CLASSES[unit.class];
            // Base detection range is 1 for commando, 2 for others
            const baseDetectionRange = classData.stealthDetectionRange || 2;

            // Check if any viewer unit is close enough to detect
            const detected = viewerUnits.some(friendlyUnit => {
                const dist = hexDistance(
                    { q: friendlyUnit.q, r: friendlyUnit.r },
                    { q: unit.q, r: unit.r }
                );
                // Must be within detection range AND have line of sight
                if (dist > baseDetectionRange) return false;
                const los = hasLineOfSight(friendlyUnit.q, friendlyUnit.r, unit.q, unit.r);
                return los.clear;
            });

            // If not detected by proximity, cloaked unit is invisible
            if (!detected) {
                return false;
            }
            // If detected, continue to check visibility normally
        }
    }

    // Enemy units only visible if in viewer's visible hex
    if (!isHexVisibleToPlayer(unit.q, unit.r, viewerPlayer)) {
        return false;
    }

    // Check if at least one of viewer's units has line of sight to this enemy
    const viewerUnits = getPlayerUnits(viewerPlayer);
    const hasAnyLOS = viewerUnits.some(friendlyUnit => {
        const los = hasLineOfSight(friendlyUnit.q, friendlyUnit.r, unit.q, unit.r);
        return los.clear;
    });

    if (!hasAnyLOS) {
        return false;
    }

    // Only Sniper and Commando can truly hide - other units in cover are still visible
    // (they only get defensive bonus, not stealth)
    if (unit.hiding && (unit.class === 'sniper' || unit.class === 'commando')) {
        const hidingDetectionRange = 2;

        const detected = viewerUnits.some(friendlyUnit => {
            const dist = hexDistance(
                { q: friendlyUnit.q, r: friendlyUnit.r },
                { q: unit.q, r: unit.r }
            );
            if (dist > hidingDetectionRange) return false;

            const los = hasLineOfSight(friendlyUnit.q, friendlyUnit.r, unit.q, unit.r);
            return los.clear;
        });

        return detected;
    }

    // Sniper/Commando stealth: harder to detect at range
    if ((unit.class === 'sniper' || unit.class === 'commando') && unit.stealthActive === true) {
        const classData = UNIT_CLASSES[unit.class];
        const detectionRange = classData.stealthDetectionRange || 2;

        const detected = viewerUnits.some(friendlyUnit => {
            const dist = hexDistance(
                { q: friendlyUnit.q, r: friendlyUnit.r },
                { q: unit.q, r: unit.r }
            );
            if (dist > detectionRange) return false;

            const los = hasLineOfSight(friendlyUnit.q, friendlyUnit.r, unit.q, unit.r);
            return los.clear;
        });

        return detected;
    }

    return true;
}

/**
 * Check if an enemy unit is visible to current player
 * Considers line of sight - can't see enemies behind rocks/dense forests
 */
export function isUnitVisible(unit) {
    return isUnitVisibleToPlayer(unit, state.currentPlayer);
}

/**
 * Check if a unit is visible to the viewing player (for rendering)
 * In single-player, this checks from human player's perspective even during AI turn
 */
export function isUnitVisibleToViewer(unit) {
    return isUnitVisibleToPlayer(unit, state.viewingPlayer);
}

/**
 * Get all visible enemy units
 */
export function getVisibleEnemies() {
    const visible = state.units.filter(unit => {
        if (!unit.alive) return false;
        if (unit.player === state.currentPlayer) return false;
        return isUnitVisible(unit);
    });

    // Track enemy contact for compass feature
    if (visible.length > 0) {
        markEnemyContact();
    }

    return visible;
}

/**
 * Get fog level for a hex (for rendering)
 * Uses viewing player's perspective in single-player mode
 * Returns: 'visible', 'explored', 'hidden'
 */
export function getFogLevel(q, r) {
    const key = `${q},${r}`;
    const viewPlayer = state.viewingPlayer;

    // Use viewing player's visibility for rendering
    const visibleHexes = state.playerVisibleHexes[viewPlayer];
    const exploredHexes = state.playerExploredHexes[viewPlayer];

    if (visibleHexes && visibleHexes.has(key)) {
        return 'visible';
    }

    if (exploredHexes && exploredHexes.has(key)) {
        return 'explored';
    }

    // DEFENSIVE: If both visibility arrays are empty/undefined for the viewing player,
    // this could indicate a bug where visibility wasn't updated before rendering.
    // In spectator mode (AI vs AI), fall back to checking if ANY player can see the hex.
    // This prevents the dreaded "black screen" issue.
    if ((!visibleHexes || visibleHexes.size === 0) && (!exploredHexes || exploredHexes.size === 0)) {
        // Check if any player has visibility data
        for (let p = 0; p < state.settings.players; p++) {
            const playerVisible = state.playerVisibleHexes[p];
            const playerExplored = state.playerExploredHexes[p];

            if (playerVisible && playerVisible.has(key)) {
                // Log this fallback scenario for debugging
                if (!state._visibilityWarningLogged) {
                    console.warn(`[FogOfWar] Using fallback visibility for player ${viewPlayer} - visibility arrays empty. Check updateVisibility() call order.`);
                    state._visibilityWarningLogged = true;
                }
                return 'visible';
            }
            if (playerExplored && playerExplored.has(key)) {
                return 'explored';
            }
        }
    }

    return 'hidden';
}

/**
 * Check if a unit would be visible to enemy players
 * Used to show "spotted" indicator on own units
 */
export function checkUnitSpotted(unit) {
    if (!unit || !unit.alive) return false;

    // Cloaked units can't be spotted
    if (unit.cloaked) return false;

    // Check if any enemy unit has line of sight to this unit
    const enemyPlayers = [];
    for (let p = 0; p < state.settings.players; p++) {
        if (p !== unit.player) {
            enemyPlayers.push(p);
        }
    }

    for (const enemyPlayer of enemyPlayers) {
        const enemyUnits = getPlayerUnits(enemyPlayer);
        for (const enemy of enemyUnits) {
            const visionRange = enemy.vision || CONFIG.VISION_RANGE;
            const distance = hexDistance({ q: enemy.q, r: enemy.r }, { q: unit.q, r: unit.r });

            if (distance <= visionRange) {
                const los = hasLineOfSight(enemy.q, enemy.r, unit.q, unit.r);
                if (los.clear) {
                    // Hiding units are harder to detect
                    if (unit.hiding) {
                        if (distance <= 2) {
                            return true; // Close enough to detect
                        }
                    } else {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

/**
 * Update spotted status for all units of current player
 */
export function updateSpottedStatus() {
    const currentUnits = getPlayerUnits(state.currentPlayer);

    for (const unit of currentUnits) {
        unit.spotted = checkUnitSpotted(unit);
    }
}

/**
 * Reveal all stealthed/cloaked enemy units temporarily
 * Used by the shrinking zone mechanic
 */
export function revealAllEnemies() {
    let revealed = 0;

    state.units.forEach(unit => {
        if (!unit.alive) return;

        // Remove stealth from all units
        if (unit.cloaked) {
            unit.cloaked = false;
            unit.revealedByZone = true;
            revealed++;
        }
        if (unit.hiding) {
            unit.hiding = false;
            unit.revealedByZone = true;
            revealed++;
        }
        if (unit.stealthActive) {
            unit.stealthActive = false;
            unit.revealedByZone = true;
        }
    });

    return revealed;
}

/**
 * Calculate visibility alpha for a cloaked enemy unit based on distance to viewer's units.
 * Closer units are more visible (higher alpha).
 * @param {Object} cloakedUnit - The cloaked enemy unit
 * @param {number} viewerPlayer - The player viewing the unit
 * @returns {number} Alpha value between 0.15 (barely visible) and 0.7 (quite visible)
 */
export function getEnemyCloakedVisibilityAlpha(cloakedUnit, viewerPlayer) {
    const viewerUnits = getPlayerUnits(viewerPlayer);
    const classData = UNIT_CLASSES[cloakedUnit.class];
    const detectionRange = classData.stealthDetectionRange || 2;

    // Find the nearest viewer unit with LOS
    let minDistance = Infinity;
    for (const unit of viewerUnits) {
        const distance = hexDistance(
            { q: cloakedUnit.q, r: cloakedUnit.r },
            { q: unit.q, r: unit.r }
        );
        if (distance <= detectionRange) {
            const los = hasLineOfSight(unit.q, unit.r, cloakedUnit.q, cloakedUnit.r);
            if (los.clear) {
                minDistance = Math.min(minDistance, distance);
            }
        }
    }

    // If no unit in range with LOS, return 0 (shouldn't happen if called correctly)
    if (minDistance === Infinity) {
        return 0;
    }

    // Distance 0 (same hex, shouldn't happen) = 0.7 alpha
    // Distance 1 = 0.55 alpha
    // Distance 2 = 0.35 alpha
    // Higher distances (for extended detection) = lower alpha
    const maxAlpha = 0.7;
    const minAlpha = 0.2;
    const alphaRange = maxAlpha - minAlpha;

    // Linear interpolation based on distance
    const alpha = maxAlpha - (minDistance / detectionRange) * alphaRange;
    return Math.max(minAlpha, Math.min(maxAlpha, alpha));
}
