// ===== GAME MODE UTILITIES =====
// Shared functions for determining AI/human player status
// Extracted to break circular dependency between ai.js and renderer.js

import { state, getPlayerUnits } from '../state.js';

/**
 * Check if a player is controlled by AI
 * @param {number} playerIndex - Player index to check (defaults to current player)
 * @returns {boolean} True if player is AI-controlled
 */
export function isAIPlayer(playerIndex = state.currentPlayer) {
    // New mode: check aiPlayers array
    if (state.settings.aiPlayers && state.settings.aiPlayers.length > 0) {
        return state.settings.aiPlayers.includes(playerIndex);
    }
    // Legacy mode: singlePlayer means all non-0 players are AI
    return state.settings.singlePlayer && playerIndex > 0;
}

/**
 * Check if spectator mode is active
 * Active when:
 * 1. All players were AI from the start, OR
 * 2. All human players have been eliminated (no units left)
 * @returns {boolean} True if in spectator mode
 */
export function isSpectatorMode() {
    if (state.settings.players <= 0) return false;

    // Check each player
    for (let p = 0; p < state.settings.players; p++) {
        if (!isAIPlayer(p)) {
            // This is a human player - check if they still have units
            const humanUnits = getPlayerUnits(p).filter(u => u.alive);
            if (humanUnits.length > 0) {
                // At least one human player still has units - not spectator mode
                return false;
            }
        }
    }

    // Either all players are AI, or all human players have been eliminated
    return true;
}

/**
 * Check if there are any human players in the game
 * @returns {boolean} True if at least one human player exists
 */
export function hasHumanPlayer() {
    for (let p = 0; p < state.settings.players; p++) {
        if (!isAIPlayer(p)) return true;
    }
    return false;
}

/**
 * Check if it's currently a human player's turn
 * @returns {boolean} True if current player is human
 */
export function isHumanTurn() {
    return !isAIPlayer(state.currentPlayer);
}

/**
 * Get list of all human player indices
 * @returns {number[]} Array of human player indices
 */
export function getHumanPlayers() {
    const humans = [];
    for (let i = 0; i < state.settings.players; i++) {
        if (!isAIPlayer(i)) humans.push(i);
    }
    return humans;
}

/**
 * Get list of all AI player indices
 * @returns {number[]} Array of AI player indices
 */
export function getAIPlayers() {
    const aiPlayers = [];
    for (let i = 0; i < state.settings.players; i++) {
        if (isAIPlayer(i)) aiPlayers.push(i);
    }
    return aiPlayers;
}
