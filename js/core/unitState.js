// ===== UNIT STATE MANAGEMENT =====
// Functions for unit queries and action point management
// Extracted from state.js for better modularity

import { CONFIG } from '../config.js';

/**
 * Get units for a specific player
 * @param {object} state - The game state object
 * @param {number} player - Player index
 * @returns {object[]} Array of alive units for the player
 */
export function getPlayerUnits(state, player) {
    return state.units.filter(u => u.player === player && u.alive);
}

/**
 * Initialize the shared AP pool for a player's turn
 * Pool is constant (UNITS_PER_PLAYER × AP_PER_TURN) regardless of surviving units
 * This prevents the losing player from being at a severe disadvantage
 * @param {object} state - The game state object
 * @param {number} _player - Player index (unused, kept for API compatibility)
 */
export function initSharedAPPool(state, _player) {
    // Constant pool: always based on starting unit count, not current
    const poolSize = CONFIG.UNITS_PER_PLAYER * CONFIG.AP_PER_TURN;
    // Add any bonus from round events (e.g., Kampfgeist)
    const eventBonus = state.eventAPBonus || 0;
    state.sharedAP = poolSize + eventBonus;
    state.maxSharedAP = poolSize + eventBonus;
    state.unitAttacksThisTurn = {};  // Reset attack tracking
}

// Callback for when AP is depleted (set by turns.js to avoid circular deps)
let onAPDepleted = null;

/**
 * Set callback for when AP is depleted
 * @param {Function} callback - Callback to invoke when AP reaches 0
 */
export function setOnAPDepletedCallback(callback) {
    onAPDepleted = callback;
}

/**
 * Spend AP from the shared pool
 * Returns true if successful, false if not enough AP
 * Triggers auto-end turn callback when AP reaches 0
 * @param {object} state - The game state object
 * @param {number} amount - Amount of AP to spend
 * @returns {boolean} True if successful
 */
export function spendSharedAP(state, amount) {
    if (state.sharedAP >= amount) {
        state.sharedAP -= amount;

        // Check for auto-end turn when AP depleted (only for human players)
        // Check both legacy singlePlayer mode and new aiPlayers array
        const isHumanPlayer = state.settings.aiPlayers && state.settings.aiPlayers.length > 0
            ? !state.settings.aiPlayers.includes(state.currentPlayer)
            : (!state.settings.singlePlayer || state.currentPlayer === 0);

        if (state.sharedAP <= 0 && onAPDepleted && isHumanPlayer) {
            // Delay to let current action complete
            setTimeout(() => {
                if (state.sharedAP <= 0 && onAPDepleted) {
                    onAPDepleted();
                }
            }, 800);
        }

        return true;
    }
    return false;
}

/**
 * Track an attack for a unit
 * @param {object} state - The game state object
 * @param {object} unit - The unit that attacked
 */
export function trackUnitAttack(state, unit) {
    const current = state.unitAttacksThisTurn[unit.id] || 0;
    state.unitAttacksThisTurn[unit.id] = current + 1;
}

/**
 * Get remaining attacks for a unit this turn
 * @param {object} state - The game state object
 * @param {object} unit - The unit to check
 * @returns {number} Remaining attacks
 */
export function getRemainingAttacks(state, unit) {
    const attacksSoFar = state.unitAttacksThisTurn[unit.id] || 0;
    return Math.max(0, CONFIG.MAX_ATTACKS_PER_UNIT - attacksSoFar);
}

/**
 * Check if unit can still attack this turn
 * @param {object} state - The game state object
 * @param {object} unit - The unit to check
 * @returns {boolean} True if unit can attack
 */
export function canUnitAttack(state, unit) {
    return getRemainingAttacks(state, unit) > 0;
}

/**
 * Get the currently selected unit
 * @param {object} state - The game state object
 * @param {Function} getPlayerUnitsFn - Function to get player units
 * @returns {object|null} The selected unit or null
 */
export function getCurrentUnit(state, getPlayerUnitsFn) {
    if (state.selectedUnit === null) return null;
    const units = getPlayerUnitsFn(state.currentPlayer);
    return units[state.selectedUnit] || null;
}
