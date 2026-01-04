// ===== OVERWATCH SYSTEM =====
// Functions for overwatch (covering fire) mechanics
// Extracted from state.js for better modularity

/**
 * Set a unit in overwatch mode
 * @param {object} state - The game state object
 * @param {string} unitId - The unit ID
 */
export function setOverwatch(state, unitId) {
    if (!state.overwatchUnits.includes(unitId)) {
        state.overwatchUnits.push(unitId);
    }
}

/**
 * Remove overwatch from a unit
 * @param {object} state - The game state object
 * @param {string} unitId - The unit ID
 */
export function removeOverwatch(state, unitId) {
    state.overwatchUnits = state.overwatchUnits.filter(id => id !== unitId);
}

/**
 * Check if unit is on overwatch
 * @param {object} state - The game state object
 * @param {string} unitId - The unit ID
 * @returns {boolean} True if unit is on overwatch
 */
export function isUnitOnOverwatch(state, unitId) {
    return state.overwatchUnits.includes(unitId);
}

/**
 * Clear all overwatch for a player (at turn start)
 * @param {object} state - The game state object
 * @param {number} player - Player index
 */
export function clearPlayerOverwatch(state, player) {
    const playerUnitIds = state.units
        .filter(u => u.player === player && u.alive)
        .map(u => u.id);
    state.overwatchUnits = state.overwatchUnits.filter(id => !playerUnitIds.includes(id));
}

/**
 * Add an overwatch trigger to the queue
 * @param {object} state - The game state object
 * @param {string} watcherId - The watching unit ID
 * @param {string} targetId - The target unit ID
 */
export function queueOverwatchTrigger(state, watcherId, targetId) {
    state.overwatchQueue.push({
        watcherId,
        targetId,
        timestamp: Date.now()
    });
}

/**
 * Get the next overwatch trigger
 * @param {object} state - The game state object
 * @returns {object|null} The next trigger or null
 */
export function getNextOverwatchTrigger(state) {
    return state.overwatchQueue.shift() || null;
}

/**
 * Check if there are pending overwatch triggers
 * @param {object} state - The game state object
 * @returns {boolean} True if triggers are queued
 */
export function hasQueuedOverwatch(state) {
    return state.overwatchQueue.length > 0;
}
