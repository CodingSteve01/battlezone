// ===== AMBUSH SYSTEM =====
// Functions for ambush queue management
// Extracted from state.js for better modularity

/**
 * Add an ambush to the queue
 * @param {object} state - The game state object
 * @param {object} ambusher - The ambushing unit
 * @param {object} target - The target unit
 */
export function queueAmbush(state, ambusher, target) {
    state.ambushQueue.push({
        ambusherId: ambusher.id,
        targetId: target.id,
        timestamp: Date.now()
    });
}

/**
 * Get the next ambush from the queue
 * @param {object} state - The game state object
 * @returns {object|null} The next ambush or null
 */
export function getNextAmbush(state) {
    return state.ambushQueue.shift() || null;
}

/**
 * Check if there are pending ambushes
 * @param {object} state - The game state object
 * @returns {boolean} True if ambushes are queued
 */
export function hasQueuedAmbushes(state) {
    return state.ambushQueue.length > 0;
}

/**
 * Clear the ambush queue
 * @param {object} state - The game state object
 */
export function clearAmbushQueue(state) {
    state.ambushQueue = [];
}
