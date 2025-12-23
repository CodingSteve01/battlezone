// ===== UNIT SYSTEM =====

import { CONFIG, UNIT_CLASSES, TERRAIN } from './config.js';
import { state, getHex, getPlayerUnits, spendSharedAP, trackUnitMovement } from './state.js';
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
        // Use team selection if available, otherwise default
        const playerClasses = (state.teamSelections && state.teamSelections[p] && state.teamSelections[p].length === CONFIG.UNITS_PER_PLAYER)
            ? state.teamSelections[p]
            : defaultClasses;

        for (let u = 0; u < CONFIG.UNITS_PER_PLAYER; u++) {
            const classType = playerClasses[u];
            const classData = UNIT_CLASSES[classType];
            const spawn = spawns[p][u];

            const unit = {
                id: `${p}-${u}`,
                player: p,
                class: classType,
                name: classData.name,
                icon: classData.icon,
                maxHp: classData.hp,
                currentHp: classData.hp,
                damage: classData.damage,
                range: classData.range,
                move: classData.move,
                vision: classData.vision,
                special: classData.special,
                specialDesc: classData.specialDesc,
                q: spawn.q,
                r: spawn.r,
                ap: CONFIG.AP_PER_TURN,
                alive: true,
                usedSpecial: false,
                cloaked: false,           // Sniper stealth (active cloak ability)
                stealthActive: classType === 'sniper' || classType === 'ninja', // Only sniper/ninja have passive stealth
                hiding: false             // Taking cover in forest/rocks
            };

            const hex = getHex(spawn.q, spawn.r);
            if (hex) hex.unit = unit;
            state.units.push(unit);
        }
    }
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
 * Considers range and line of sight (rocks block completely, 2+ forests block)
 */
export function getAttackableUnits(unit) {
    if (state.sharedAP < 1) return [];  // Need AP in shared pool

    const effectiveRange = getEffectiveRange(unit);

    return state.units.filter(target => {
        if (!target.alive || target.player === unit.player) return false;

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
    // Deduct AP from shared pool and track movement
    spendSharedAP(cost);
    trackUnitMovement(unit, cost);
}

/**
 * Animate unit movement along a path
 * @param {Object} unit - The unit to move
 * @param {Array} path - Array of {q, r} positions
 * @param {number} totalCost - Total AP cost
 * @param {Function} onComplete - Callback when animation finishes
 * @param {Function} render - Render function to call each frame
 */
export function animateUnitMovement(unit, path, totalCost, onComplete, render) {
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
    let currentStep = 0;

    function nextStep() {
        currentStep++;

        if (currentStep >= path.length) {
            // Animation complete
            state.animating = false;
            state.movementAnimation = null;
            // Deduct cost from shared pool and track movement
            spendSharedAP(totalCost);
            trackUnitMovement(unit, totalCost);
            if (onComplete) onComplete();
            return;
        }

        const nextPos = path[currentStep];
        const nextHex = getHex(nextPos.q, nextPos.r);

        if (nextHex) {
            moveUnitInstant(unit, nextHex);
            state.movementAnimation.currentStep = currentStep;
            // Update visibility after each step so fog of war is dynamically updated
            updateVisibility();
            render();
        }

        setTimeout(nextStep, stepDelay);
    }

    // Start animation
    setTimeout(nextStep, stepDelay);
}

/**
 * Reset units for new turn
 */
export function resetUnitsForTurn(player) {
    const units = getPlayerUnits(player);

    units.forEach(unit => {
        unit.ap = CONFIG.AP_PER_TURN;

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
        if (unit.class === 'ninja') {
            unit.move = UNIT_CLASSES.ninja.move;  // Reset stealth movement bonus
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
