// ===== UNIT SYSTEM =====

import { CONFIG, UNIT_CLASSES, TERRAIN, getUnitWithVariant } from './config.js';
import { state, getHex, getPlayerUnits, spendSharedAP, canUnitAttack, getRemainingAttacks, areUnitsAllied, recordMovement } from './state.js';
import { getSpawnPositions } from './map.js';
import { hasLineOfSight } from './combat.js';
import { updateVisibility } from './fogOfWar.js';

/**
 * Create all units for all players
 */
export function createUnits() {
    state.units = [];
    const defaultClasses = ['scout', 'assault', 'medic'];
    const spawns = getSpawnPositions();

    for (let p = 0; p < state.settings.players; p++) {
        // Use team selection if available and valid, otherwise default
        const hasValidSelection = state.teamSelections &&
            state.teamSelections[p] &&
            state.teamSelections[p].length >= CONFIG.MIN_UNITS &&
            state.teamSelections[p].length <= CONFIG.MAX_UNITS;

        const playerClasses = hasValidSelection
            ? state.teamSelections[p]
            : defaultClasses;

        // Iterate over actual team size (variable 2-5 units)
        const playerSpawns = spawns[p] || [];
        console.log(`[Units] Player ${p}: Creating ${playerClasses.length} units, ${playerSpawns.length} spawn positions available`);

        for (let u = 0; u < playerClasses.length; u++) {
            const unitKey = playerClasses[u];

            // Parse unitKey format (classKey:variantKey or just classKey for legacy)
            let classKey, variantKey;
            if (unitKey && unitKey.includes(':')) {
                [classKey, variantKey] = unitKey.split(':');
            } else {
                classKey = unitKey;
                variantKey = 'standard';
            }

            // Get unit data with variant stats applied
            const unitData = getUnitWithVariant(classKey, variantKey);
            const baseClassData = UNIT_CLASSES[classKey];

            // Safety check: ensure spawn position exists
            if (!playerSpawns[u]) {
                console.error(`[Units] No spawn position for player ${p}, unit ${u}! Skipping unit.`);
                continue;
            }
            const spawn = playerSpawns[u];

            // Safety check: ensure class data exists
            if (!unitData || !baseClassData) {
                console.error(`[Units] Unknown unit class "${unitKey}" for player ${p}! Skipping unit.`);
                continue;
            }

            const unit = {
                id: `${p}-${u}`,
                player: p,
                class: classKey,  // Store base class for sprite lookups
                variant: variantKey,  // Store variant for reference
                name: unitData.name,
                icon: baseClassData.icon,
                maxHp: unitData.hp,
                currentHp: unitData.hp,
                damage: unitData.damage,
                range: unitData.range,
                move: unitData.move,
                vision: unitData.vision,
                special: baseClassData.special,
                specialDesc: baseClassData.specialDesc,
                q: spawn.q,
                r: spawn.r,
                alive: true,
                usedSpecial: false,
                cloaked: false,           // Sniper stealth (active cloak ability)
                stealthActive: classKey === 'sniper' || classKey === 'commando', // Only sniper/commando have passive stealth
                hiding: false             // Taking cover in forest/rocks
            };

            const hex = getHex(spawn.q, spawn.r);
            if (hex) hex.unit = unit;
            state.units.push(unit);
        }
    }

    // Summary log for debugging
    const unitCounts = {};
    for (let p = 0; p < state.settings.players; p++) {
        unitCounts[`Player ${p + 1}`] = state.units.filter(u => u.player === p).length;
    }
    console.log(`[Units] Total units created: ${state.units.length}`, unitCounts);
}

/**
 * Get effective range for a unit (including terrain bonuses)
 */
export function getEffectiveRange(unit) {
    let range = unit.range;

    // Hills give +1 range (high ground advantage)
    const unitHex = getHex(unit.q, unit.r);
    if (unitHex && unitHex.type === 'hills') {
        const terrain = TERRAIN[unitHex.type];
        if (terrain && terrain.rangeBonus) {
            range += terrain.rangeBonus;
        }
    }

    return range;
}

/**
 * Get attackable enemies for a unit
 * Considers range, line of sight, and attack limit per turn
 */
export function getAttackableUnits(unit) {
    if (state.sharedAP < 1) return [];  // Need AP in shared pool
    if (!canUnitAttack(unit)) return [];  // Unit has reached attack limit for this turn

    const effectiveRange = getEffectiveRange(unit);

    return state.units.filter(target => {
        // Schließe tote Einheiten, eigene Einheiten UND VERBÜNDETE aus!
        if (!target.alive || areUnitsAllied(unit, target)) return false;

        const dx = Math.abs(target.q - unit.q);
        const dy = Math.abs(target.r - unit.r);
        const dz = Math.abs((-target.q - target.r) - (-unit.q - unit.r));
        const dist = Math.max(dx, dy, dz);

        if (dist > effectiveRange) return false;

        // Check line of sight - can't attack through rocks or dense forests
        const los = hasLineOfSight(unit.q, unit.r, target.q, target.r);
        return los.clear;
    });
}

/**
 * Get enemies in range but with blocked line of sight
 * Used for UI feedback
 */
export function getBlockedTargets(unit) {
    if (state.sharedAP < 1) return [];  // Need AP in shared pool
    if (!canUnitAttack(unit)) return [];  // Unit has reached attack limit for this turn

    const effectiveRange = getEffectiveRange(unit);

    return state.units.filter(target => {
        if (!target.alive || target.player === unit.player) return false;

        const dx = Math.abs(target.q - unit.q);
        const dy = Math.abs(target.r - unit.r);
        const dz = Math.abs((-target.q - target.r) - (-unit.q - unit.r));
        const dist = Math.max(dx, dy, dz);

        if (dist > effectiveRange) return false;

        // Return only those with blocked LOS
        const los = hasLineOfSight(unit.q, unit.r, target.q, target.r);
        return !los.clear;
    }).map(target => {
        const los = hasLineOfSight(unit.q, unit.r, target.q, target.r);
        return {
            unit: target,
            blockedBy: los.blockedBy,
            blockingHex: los.blockingHex
        };
    });
}

/**
 * Move a unit to a new hex (instant, used internally)
 */
export function moveUnitInstant(unit, targetHex) {
    // Clear old position
    const oldHex = getHex(unit.q, unit.r);
    if (oldHex) oldHex.unit = null;

    // Update unit position
    unit.q = targetHex.q;
    unit.r = targetHex.r;
    targetHex.unit = unit;
}

/**
 * Move a unit to a new hex with cost deduction from shared pool
 */
export function moveUnit(unit, targetHex, cost) {
    moveUnitInstant(unit, targetHex);
    // Deduct AP from shared pool
    spendSharedAP(cost);
}

/**
 * Animate unit movement along a path
 * @param {Object} unit - The unit to move
 * @param {Array} path - Array of {q, r} positions
 * @param {number} totalCost - Total AP cost
 * @param {Function} onComplete - Callback when animation finishes
 * @param {Function} render - Render function to call each frame
 */
export async function animateUnitMovement(unit, path, totalCost, onComplete, render, onStep = null) {
    if (!path || path.length < 2) {
        if (onComplete) onComplete();
        return;
    }

    state.animating = true;
    state.movementAnimation = {
        unit,
        path,
        currentStep: 0,
        totalCost
    };

    const stepDelay = 150; // ms per step
    let completedSteps = 0;

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        for (let step = 1; step < path.length; step++) {
            await delay(stepDelay);

            if (!unit.alive) {
                break;
            }

            const nextPos = path[step];
            const nextHex = getHex(nextPos.q, nextPos.r);

            if (nextHex) {
                moveUnitInstant(unit, nextHex);
                state.movementAnimation.currentStep = step;
                completedSteps = step;
                // Update visibility after each step so fog of war is dynamically updated
                updateVisibility();
                render();
            }

            if (onStep) {
                const shouldContinue = await onStep({ unit, step, nextHex });
                if (shouldContinue === false) {
                    break;
                }
            }
        }
    } catch (error) {
        // Ensure animation state is cleaned up even if an error occurs
        console.error('[Animation] Error during movement animation:', error);
    }

    state.animating = false;
    state.movementAnimation = null;

    // Deduct cost from shared pool
    spendSharedAP(totalCost);
    // Statistik: Bewegung tracken (completed steps = Anzahl der Schritte)
    recordMovement(unit.player, completedSteps);

    if (onComplete) onComplete();
}

/**
 * Reset units for new turn
 */
export function resetUnitsForTurn(player) {
    const units = getPlayerUnits(player);

    units.forEach(unit => {
        // Reset revealed state - unit that attacked while cloaked is no longer marked
        // This happens at start of their turn, so enemies had a chance to see them
        unit.revealedUntilEndOfTurn = false;

        // Reset special ability modifiers
        if (unit.class === 'assault') {
            unit.damage = UNIT_CLASSES.assault.damage;
        }
        if (unit.class === 'scout') {
            unit.move = UNIT_CLASSES.scout.move;
        }
        if (unit.class === 'sniper') {
            unit.damage = UNIT_CLASSES.sniper.damage;
            // Cloak expires at end of round (handled in resetSpecialAbilities)
        }
        if (unit.class === 'commando') {
            unit.move = UNIT_CLASSES.commando.move;  // Reset stealth movement bonus
        }
    });
}

/**
 * Reset cloak for all units (at round start)
 */
export function resetCloaks() {
    state.units.forEach(unit => {
        unit.cloaked = false;
    });
}

/**
 * Reset special ability usage for all units (at round start)
 */
export function resetSpecialAbilities() {
    state.units.forEach(unit => {
        unit.usedSpecial = false;
    });
}

/**
 * Kill a unit
 */
export function killUnit(unit) {
    unit.alive = false;
    unit.currentHp = 0;

    const hex = getHex(unit.q, unit.r);
    if (hex) hex.unit = null;
}

/**
 * Check if unit can automatically take cover at current position
 */
export function canAutoTakeCover(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.hiding) return false;

    const hex = getHex(unit.q, unit.r);
    if (!hex) return false;

    const terrain = TERRAIN[hex.type];
    return terrain && terrain.canHide;
}

/**
 * Automatically take cover if standing on a valid terrain
 * Returns true if cover was taken
 */
export function autoTakeCover(unit) {
    if (!canAutoTakeCover(unit)) return false;

    unit.hiding = true;
    return true;
}

/**
 * Get unit at position
 */
export function getUnitAt(q, r) {
    return state.units.find(u => u.alive && u.q === q && u.r === r);
}
