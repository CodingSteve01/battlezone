// ===== HOLD POSITION SYSTEM =====
// Functions for defensive position bonuses
// Extracted from state.js for better modularity

/**
 * Update hold position status for a unit
 * @param {object} state - The game state object
 * @param {object} unit - The unit to update
 */
export function updateHoldPosition(state, unit) {
    const current = state.holdingPosition[unit.id];

    if (current && current.q === unit.q && current.r === unit.r) {
        // Unit stayed at same position
        current.rounds++;
    } else {
        // Unit moved or new position
        state.holdingPosition[unit.id] = {
            q: unit.q,
            r: unit.r,
            rounds: 1
        };
    }
}

/**
 * Get the number of rounds a unit has held position
 * @param {object} state - The game state object
 * @param {string} unitId - The unit ID
 * @returns {number} Number of rounds held
 */
export function getHoldPositionRounds(state, unitId) {
    const holding = state.holdingPosition[unitId];
    return holding ? holding.rounds : 0;
}

/**
 * Calculate the defense bonus for holding position
 * 5% per round, max 20%
 * @param {object} state - The game state object
 * @param {string} unitId - The unit ID
 * @returns {number} Defense bonus (0-0.20)
 */
export function getHoldPositionBonus(state, unitId) {
    const rounds = getHoldPositionRounds(state, unitId);
    if (rounds <= 1) return 0;
    return Math.min(0.20, (rounds - 1) * 0.05); // Max 20% after 5 rounds
}

/**
 * Clear hold position for a unit
 * @param {object} state - The game state object
 * @param {string} unitId - The unit ID
 */
export function clearHoldPosition(state, unitId) {
    delete state.holdingPosition[unitId];
}
