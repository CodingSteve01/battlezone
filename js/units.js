// ===== UNIT SYSTEM =====

import { CONFIG, UNIT_CLASSES } from './config.js';
import { state, getHex, getPlayerUnits } from './state.js';
import { getSpawnPositions } from './map.js';

/**
 * Create all units for all players
 */
export function createUnits() {
    state.units = [];
    const classes = ['scout', 'assault', 'medic'];
    const spawns = getSpawnPositions();

    for (let p = 0; p < state.settings.players; p++) {
        for (let u = 0; u < CONFIG.UNITS_PER_PLAYER; u++) {
            const classType = classes[u];
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
                usedSpecial: false
            };

            const hex = getHex(spawn.q, spawn.r);
            if (hex) hex.unit = unit;
            state.units.push(unit);
        }
    }
}

/**
 * Get attackable enemies for a unit
 */
export function getAttackableUnits(unit) {
    if (unit.ap < 1) return [];

    return state.units.filter(target => {
        if (!target.alive || target.player === unit.player) return false;

        const dx = Math.abs(target.q - unit.q);
        const dy = Math.abs(target.r - unit.r);
        const dz = Math.abs((-target.q - target.r) - (-unit.q - unit.r));
        const dist = Math.max(dx, dy, dz);

        return dist <= unit.range;
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
 * Move a unit to a new hex with cost deduction
 */
export function moveUnit(unit, targetHex, cost) {
    moveUnitInstant(unit, targetHex);
    // Deduct AP
    unit.ap -= cost;
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
            unit.ap -= totalCost;
            if (onComplete) onComplete();
            return;
        }

        const nextPos = path[currentStep];
        const nextHex = getHex(nextPos.q, nextPos.r);

        if (nextHex) {
            moveUnitInstant(unit, nextHex);
            state.movementAnimation.currentStep = currentStep;
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

        // Reset special ability modifiers
        if (unit.class === 'assault') {
            unit.damage = UNIT_CLASSES.assault.damage;
        }
        if (unit.class === 'scout') {
            unit.move = UNIT_CLASSES.scout.move;
        }
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
 * Get unit at position
 */
export function getUnitAt(q, r) {
    return state.units.find(u => u.alive && u.q === q && u.r === r);
}
