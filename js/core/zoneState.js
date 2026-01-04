// ===== ZONE STATE MANAGEMENT =====
// Functions for battle zone boundaries
// Extracted from state.js for better modularity

/**
 * Initialize the battle zone
 * @param {object} state - The game state object
 * @param {number} mapRadius - The initial zone radius
 */
export function initZone(state, mapRadius) {
    state.maxZoneRadius = mapRadius;
    state.zoneRadius = mapRadius;
    state.zonePhase = 0;
    state.lastCombatRound = 1;
    state.zoneShrinkWarning = false;
    state.revealCooldown = 0;
}

/**
 * Check if a hex is within the safe zone
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @returns {boolean} True if hex is in zone
 */
export function isHexInZone(state, q, r) {
    const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
    return dist <= state.zoneRadius;
}

/**
 * Mark that combat happened this round
 * @param {object} state - The game state object
 */
export function markCombat(state) {
    state.lastCombatRound = state.round;
}
