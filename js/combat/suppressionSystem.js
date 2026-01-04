// ===== SUPPRESSION SYSTEM =====
// Functions for suppression fire mechanics
// Extracted from state.js for better modularity

/**
 * Add a suppressed hex
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @param {string} suppressorId - The suppressing unit ID
 * @param {number} duration - Duration in rounds (default 1)
 */
export function addSuppressedHex(state, q, r, suppressorId, duration = 1) {
    // Remove existing suppression on this hex
    state.suppressedHexes = state.suppressedHexes.filter(s => !(s.q === q && s.r === r));

    state.suppressedHexes.push({
        q, r,
        suppressorId,
        expiresRound: state.round + duration
    });
}

/**
 * Check if a hex is suppressed
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @returns {boolean} True if hex is suppressed
 */
export function isHexSuppressed(state, q, r) {
    return state.suppressedHexes.some(s =>
        s.q === q && s.r === r && s.expiresRound > state.round
    );
}

/**
 * Get suppression info for a hex
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @returns {object|null} Suppression info or null
 */
export function getSuppressionInfo(state, q, r) {
    return state.suppressedHexes.find(s =>
        s.q === q && s.r === r && s.expiresRound > state.round
    ) || null;
}

/**
 * Remove expired suppressions
 * @param {object} state - The game state object
 */
export function cleanupSuppression(state) {
    state.suppressedHexes = state.suppressedHexes.filter(s => s.expiresRound > state.round);
}

/**
 * Check if a hex is suppressed for a specific unit
 * IMPORTANT: Suppression only affects enemies, not allies!
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @param {object} unit - The unit to check
 * @param {Function} areUnitsAlliedFn - Function to check unit alliance
 * @returns {boolean} True if hex is suppressed for this unit
 */
export function isHexSuppressedForUnit(state, q, r, unit, areUnitsAlliedFn) {
    if (!unit) return isHexSuppressed(state, q, r);

    const suppression = getSuppressionInfo(state, q, r);
    if (!suppression) return false;

    // Find the suppressor
    const suppressor = state.units.find(u => u.id === suppression.suppressorId);
    if (!suppressor) return false;

    // Suppression only affects enemies of the suppressor!
    if (suppressor.player === unit.player) return false;
    if (areUnitsAlliedFn(suppressor, unit)) return false;

    return true;
}
