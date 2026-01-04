// ===== HEX STATE MANAGEMENT =====
// Functions for accessing and modifying hex data
// Extracted from state.js for better modularity

/**
 * Get hex at coordinates
 * @param {object} state - The game state object
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @returns {object|undefined} The hex object or undefined if not found
 */
export function getHex(state, q, r) {
    return state.hexMap.get(`${q},${r}`);
}

/**
 * Set hex at coordinates
 * @param {object} state - The game state object
 * @param {object} hex - The hex object to set
 */
export function setHex(state, hex) {
    const key = `${hex.q},${hex.r}`;
    state.hexMap.set(key, hex);

    const idx = state.hexes.findIndex(h => h.q === hex.q && h.r === hex.r);
    if (idx >= 0) {
        state.hexes[idx] = hex;
    } else {
        state.hexes.push(hex);
    }
}

/**
 * Get player name (uses custom name or falls back to default)
 * @param {object} state - The game state object
 * @param {number} playerIndex - Index of the player
 * @returns {string} The player's name
 */
export function getPlayerName(state, playerIndex) {
    if (state.settings.playerNames && state.settings.playerNames[playerIndex]) {
        return state.settings.playerNames[playerIndex];
    }
    return `Spieler ${playerIndex + 1}`;
}

/**
 * Get all hexes in the game
 * @param {object} state - The game state object
 * @returns {object[]} Array of hex objects
 */
export function getAllHexes(state) {
    return state.hexes;
}

/**
 * Get the hex map for fast coordinate lookup
 * @param {object} state - The game state object
 * @returns {Map} The hex map
 */
export function getHexMap(state) {
    return state.hexMap;
}

/**
 * Clear all hex data
 * @param {object} state - The game state object
 */
export function clearHexes(state) {
    state.hexes = [];
    state.hexMap = new Map();
}
