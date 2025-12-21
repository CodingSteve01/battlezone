// ===== GAME STATE =====

import { CONFIG } from './config.js';

// Central game state object
export const state = {
    screen: 'menu',
    settings: {
        players: 2,
        size: 'medium',
        singlePlayer: false
    },

    // Map data
    hexes: [],          // Array of hex objects
    hexMap: new Map(),  // Fast lookup by "q,r" key

    // Units
    units: [],

    // Current turn state
    currentPlayer: 0,
    selectedUnit: null,
    selectedAction: 'move',
    hoveredHex: null,
    targetedUnit: null,
    currentPath: null,  // A* path for visualization

    // Game progress
    round: 1,
    gameOver: false,
    animating: false,

    // Movement animation
    movementAnimation: null,  // { unit, path, currentStep, startTime }

    // Fog of War (per player)
    visibleHexes: new Set(),  // Set of "q,r" keys for currently visible hexes
    exploredHexes: new Set(), // Current player's explored hexes
    playerExploredHexes: [],  // Array of Sets, one per player - stores explored hexes per player

    // Ghost indicators for cloaked enemy attacks (per player)
    // Format: { unitId, q, r, player, class, timestamp }
    ghostIndicators: [],      // Array of ghost indicator objects

    // Team selection
    teamSelections: [],       // Array of arrays - each player's selected unit classes

    // Rendering
    hexSize: CONFIG.BASE_HEX_SIZE,
    offsetX: 0,
    offsetY: 0,

    // Camera/Pan
    cameraX: 0,
    cameraY: 0,

    // Canvas dimensions
    canvasWidth: 0,
    canvasHeight: 0
};

/**
 * Get hex at coordinates
 */
export function getHex(q, r) {
    return state.hexMap.get(`${q},${r}`);
}

/**
 * Set hex at coordinates
 */
export function setHex(hex) {
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
 * Reset game state for new game
 */
export function resetState() {
    state.hexes = [];
    state.hexMap.clear();
    state.units = [];
    state.currentPlayer = 0;
    state.selectedUnit = null;
    state.selectedAction = 'move';
    state.hoveredHex = null;
    state.targetedUnit = null;
    state.currentPath = null;
    state.round = 1;
    state.gameOver = false;
    state.animating = false;
    state.visibleHexes.clear();
    state.exploredHexes.clear();
    state.ghostIndicators = [];
    state.cameraX = 0;
    state.cameraY = 0;

    // Initialize per-player explored hexes
    state.playerExploredHexes = [];
    for (let i = 0; i < state.settings.players; i++) {
        state.playerExploredHexes.push(new Set());
    }
}

/**
 * Add a ghost indicator when a cloaked unit attacks
 */
export function addGhostIndicator(unit) {
    // Remove any existing ghost for this unit
    state.ghostIndicators = state.ghostIndicators.filter(g => g.unitId !== unit.id);

    // Add new ghost indicator
    state.ghostIndicators.push({
        unitId: unit.id,
        q: unit.q,
        r: unit.r,
        player: unit.player,
        unitClass: unit.class,
        timestamp: Date.now(),
        fadeStart: Date.now() + 3000  // Start fading after 3 seconds
    });
}

/**
 * Clear ghost indicator for a unit (when they attack again or die)
 */
export function clearGhostIndicator(unitId) {
    state.ghostIndicators = state.ghostIndicators.filter(g => g.unitId !== unitId);
}

/**
 * Get ghost indicators visible to current player
 */
export function getVisibleGhosts() {
    const now = Date.now();
    const maxAge = 8000;  // Ghosts disappear after 8 seconds

    return state.ghostIndicators.filter(ghost => {
        // Only show ghosts of enemy units
        if (ghost.player === state.currentPlayer) return false;
        // Remove old ghosts
        if (now - ghost.timestamp > maxAge) return false;
        return true;
    });
}

/**
 * Switch fog of war to current player's view
 */
export function switchPlayerFog() {
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
 * Get units for a specific player
 */
export function getPlayerUnits(player) {
    return state.units.filter(u => u.player === player && u.alive);
}

/**
 * Get the currently selected unit
 */
export function getCurrentUnit() {
    if (state.selectedUnit === null) return null;
    const units = getPlayerUnits(state.currentPlayer);
    return units[state.selectedUnit] || null;
}

/**
 * Check if a hex is visible to current player
 */
export function isHexVisible(q, r) {
    return state.visibleHexes.has(`${q},${r}`);
}

/**
 * Check if a hex was explored (seen before)
 */
export function isHexExplored(q, r) {
    return state.exploredHexes.has(`${q},${r}`);
}
