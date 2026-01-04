// ===== VISIBILITY STATE MANAGEMENT =====
// Functions for fog of war and hex visibility
// Extracted from state.js for better modularity

/**
 * Switch fog of war to current player's view
 * @param {object} state - The game state object
 */
export function switchPlayerFog(state) {
    // Save current player's explored hexes before switching
    const prevPlayer = (state.currentPlayer - 1 + state.settings.players) % state.settings.players;
    if (state.playerExploredHexes[prevPlayer]) {
        // Already saved in updateVisibility
    }

    // Load current player's explored hexes
    if (state.playerExploredHexes[state.currentPlayer]) {
        state.exploredHexes = state.playerExploredHexes[state.currentPlayer];
    } else {
        state.exploredHexes = new Set();
        state.playerExploredHexes[state.currentPlayer] = state.exploredHexes;
    }
}

/**
 * Check if a hex is visible to current player
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @returns {boolean} True if hex is visible
 */
export function isHexVisible(state, q, r) {
    return state.visibleHexes.has(`${q},${r}`);
}

/**
 * Check if a hex is visible to a specific player
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @param {number} player - Player index
 * @returns {boolean} True if hex is visible to player
 */
export function isHexVisibleToPlayer(state, q, r, player) {
    const playerVisible = state.playerVisibleHexes[player];
    if (!playerVisible) return false;
    return playerVisible.has(`${q},${r}`);
}

/**
 * Check if a hex is visible to the viewing player (for rendering)
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @returns {boolean} True if hex is visible to viewer
 */
export function isHexVisibleToViewer(state, q, r) {
    return isHexVisibleToPlayer(state, q, r, state.viewingPlayer);
}

/**
 * Check if a hex was explored (seen before)
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @returns {boolean} True if hex was explored
 */
export function isHexExplored(state, q, r) {
    return state.exploredHexes.has(`${q},${r}`);
}
