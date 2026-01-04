// ===== COORDINATED ATTACK SYSTEM =====
// Functions for multi-unit coordinated attacks
// Extracted from state.js for better modularity

/**
 * Start a coordinated attack on a target
 * @param {object} state - The game state object
 * @param {object} targetUnit - The target unit
 */
export function startCoordinatedAttack(state, targetUnit) {
    state.coordinatedAttack.active = true;
    state.coordinatedAttack.targetUnit = targetUnit;
    state.coordinatedAttack.attackers = [];
}

/**
 * Add an attacker to the coordinated attack
 * @param {object} state - The game state object
 * @param {object} unit - The attacking unit
 */
export function addCoordinatedAttacker(state, unit) {
    if (!state.coordinatedAttack.attackers.includes(unit.id)) {
        state.coordinatedAttack.attackers.push(unit.id);
    }
}

/**
 * Remove an attacker from the coordinated attack
 * @param {object} state - The game state object
 * @param {string} unitId - The unit ID to remove
 */
export function removeCoordinatedAttacker(state, unitId) {
    state.coordinatedAttack.attackers = state.coordinatedAttack.attackers.filter(id => id !== unitId);
}

/**
 * Cancel the coordination mode
 * @param {object} state - The game state object
 */
export function cancelCoordinatedAttack(state) {
    state.coordinatedAttack.active = false;
    state.coordinatedAttack.targetUnit = null;
    state.coordinatedAttack.attackers = [];
}

/**
 * Calculate the damage bonus for coordinated attacks
 * @param {object} state - The game state object
 * @returns {number} Damage bonus multiplier
 */
export function getCoordinatedAttackBonus(state) {
    const attackerCount = state.coordinatedAttack.attackers.length;
    if (attackerCount <= 1) return 0;
    return (attackerCount - 1) * state.coordinatedAttack.bonusPerAttacker;
}
