// ===== GAME STATE =====

import { CONFIG } from './config.js';

// Central game state object
export const state = {
    screen: 'menu',
    settings: {
        players: 2,
        size: 'medium',
        singlePlayer: false,
        renderQuality: 'auto'  // 'low', 'medium', 'high', 'auto'
    },

    // Performance tracking for auto-quality
    frameCount: 0,
    lastFrameTime: 0,
    currentFps: 60,
    lowPerfFrames: 0,
    effectiveQuality: 'high',  // Actual quality being used

    // Map data
    hexes: [],          // Array of hex objects
    hexMap: new Map(),  // Fast lookup by "q,r" key

    // Units
    units: [],

    // Current turn state
    currentPlayer: 0,
    viewingPlayer: 0,  // Player whose perspective is used for rendering (always human in single-player)
    selectedUnit: null,
    selectedAction: 'move',
    hoveredHex: null,
    targetedUnit: null,
    currentPath: null,  // A* path for visualization
    pendingMoveDestination: null,  // Hex for tap-to-confirm movement
    pendingHealTarget: null,  // For context-sensitive healing action

    // Shared AP Pool - all units share one pool per turn
    sharedAP: 0,              // Current AP in the pool
    maxSharedAP: 0,           // Maximum AP for this turn (for UI display)
    unitMovedThisTurn: {},    // Track how much each unit has moved: unitId -> distance moved

    // Game progress
    round: 1,
    gameOver: false,
    animating: false,

    // Movement animation
    movementAnimation: null,  // { unit, path, currentStep, startTime }

    // Fog of War (per player)
    visibleHexes: new Set(),  // Set of "q,r" keys for currently visible hexes (current player)
    exploredHexes: new Set(), // Current player's explored hexes
    playerExploredHexes: [],  // Array of Sets, one per player - stores explored hexes per player
    playerVisibleHexes: [],   // Array of Sets, one per player - stores currently visible hexes per player

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

    // Zoom
    zoomLevel: 1.0,
    minZoom: 0.5,
    maxZoom: 2.0,

    // Queued path for multi-turn movement
    queuedPaths: {},  // unitId -> { path: [{q, r}, ...], targetQ, targetR }

    // Previously visible enemies (for detection alerts)
    previouslyVisibleEnemies: new Set(),

    // Enemy tracking for compass feature
    lastEnemyContactRound: 0,       // Last round when any enemy was spotted
    roundsWithoutContact: 0,        // Consecutive rounds without seeing enemies

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
    state.viewingPlayer = 0;
    state.selectedUnit = null;
    state.selectedAction = 'move';
    state.hoveredHex = null;
    state.targetedUnit = null;
    state.currentPath = null;
    state.pendingMoveDestination = null;
    state.pendingHealTarget = null;
    state.round = 1;
    state.gameOver = false;
    state.animating = false;
    state.visibleHexes.clear();
    state.exploredHexes.clear();
    state.ghostIndicators = [];
    state.cameraX = 0;
    state.cameraY = 0;
    state.zoomLevel = 1.0;
    state.queuedPaths = {};
    state.previouslyVisibleEnemies = new Set();
    state.lastEnemyContactRound = 0;
    state.roundsWithoutContact = 0;
    state.sharedAP = 0;
    state.maxSharedAP = 0;
    state.unitMovedThisTurn = {};

    // Initialize per-player explored hexes and visible hexes
    state.playerExploredHexes = [];
    state.playerVisibleHexes = [];
    for (let i = 0; i < state.settings.players; i++) {
        state.playerExploredHexes.push(new Set());
        state.playerVisibleHexes.push(new Set());
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
 * Initialize the shared AP pool for a player's turn
 * Pool = sum of all living units' AP_PER_TURN
 */
export function initSharedAPPool(player) {
    const units = getPlayerUnits(player);
    const poolSize = units.length * CONFIG.AP_PER_TURN;
    state.sharedAP = poolSize;
    state.maxSharedAP = poolSize;
    state.unitMovedThisTurn = {};  // Reset movement tracking
}

/**
 * Spend AP from the shared pool
 * Returns true if successful, false if not enough AP
 */
export function spendSharedAP(amount) {
    if (state.sharedAP >= amount) {
        state.sharedAP -= amount;
        return true;
    }
    return false;
}

/**
 * Get remaining movement capacity for a unit this turn
 * Based on unit.move stat minus distance already moved
 */
export function getRemainingMoveCapacity(unit) {
    const movedSoFar = state.unitMovedThisTurn[unit.id] || 0;
    return Math.max(0, unit.move - movedSoFar);
}

/**
 * Track movement for a unit
 */
export function trackUnitMovement(unit, distance) {
    const current = state.unitMovedThisTurn[unit.id] || 0;
    state.unitMovedThisTurn[unit.id] = current + distance;
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
 * Check if a hex is visible to a specific player
 */
export function isHexVisibleToPlayer(q, r, player) {
    const playerVisible = state.playerVisibleHexes[player];
    if (!playerVisible) return false;
    return playerVisible.has(`${q},${r}`);
}

/**
 * Check if a hex is visible to the viewing player (for rendering)
 */
export function isHexVisibleToViewer(q, r) {
    return isHexVisibleToPlayer(q, r, state.viewingPlayer);
}

/**
 * Check if a hex was explored (seen before)
 */
export function isHexExplored(q, r) {
    return state.exploredHexes.has(`${q},${r}`);
}

/**
 * Set queued path for a unit
 */
export function setQueuedPath(unitId, path, targetQ, targetR) {
    state.queuedPaths[unitId] = { path, targetQ, targetR };
}

/**
 * Get queued path for a unit
 */
export function getQueuedPath(unitId) {
    return state.queuedPaths[unitId] || null;
}

/**
 * Clear queued path for a unit
 */
export function clearQueuedPath(unitId) {
    delete state.queuedPaths[unitId];
}

/**
 * Update the set of previously visible enemies
 */
export function updatePreviouslyVisibleEnemies(visibleEnemyIds) {
    state.previouslyVisibleEnemies = new Set(visibleEnemyIds);
}

/**
 * Get the set of previously visible enemies
 */
export function getPreviouslyVisibleEnemies() {
    return state.previouslyVisibleEnemies;
}

/**
 * Mark that an enemy was spotted this round
 */
export function markEnemyContact() {
    state.lastEnemyContactRound = state.round;
    state.roundsWithoutContact = 0;
}

/**
 * Update contact tracking at end of round
 */
export function updateContactTracking(enemiesVisible) {
    if (enemiesVisible) {
        state.lastEnemyContactRound = state.round;
        state.roundsWithoutContact = 0;
    } else {
        state.roundsWithoutContact = state.round - state.lastEnemyContactRound;
    }
}

/**
 * Get direction to nearest enemy (for compass feature)
 * Returns { direction: 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW', distance: number } or null
 */
export function getEnemyDirection() {
    // Only show compass after 3 rounds without contact
    if (state.roundsWithoutContact < 3) return null;

    const myUnits = getPlayerUnits(state.currentPlayer);
    if (myUnits.length === 0) return null;

    // Calculate center of my units
    const myCenter = myUnits.reduce((acc, u) => ({
        q: acc.q + u.q / myUnits.length,
        r: acc.r + u.r / myUnits.length
    }), { q: 0, r: 0 });

    // Find all enemy units (even hidden ones - this is the "compass magic")
    const enemies = state.units.filter(u =>
        u.alive && u.player !== state.currentPlayer
    );

    if (enemies.length === 0) return null;

    // Find nearest enemy
    let nearestDist = Infinity;
    let nearestEnemy = null;

    for (const enemy of enemies) {
        const dq = enemy.q - myCenter.q;
        const dr = enemy.r - myCenter.r;
        const dist = Math.sqrt(dq * dq + dr * dr);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestEnemy = enemy;
        }
    }

    if (!nearestEnemy) return null;

    // Calculate direction
    const dq = nearestEnemy.q - myCenter.q;
    const dr = nearestEnemy.r - myCenter.r;
    const angle = Math.atan2(dr, dq) * 180 / Math.PI;

    // Convert angle to compass direction (8 directions)
    const directions = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    const index = Math.round((angle + 180) / 45) % 8;
    const direction = directions[index];

    // German direction names
    const directionNames = {
        'N': 'Norden',
        'NE': 'Nordosten',
        'E': 'Osten',
        'SE': 'Südosten',
        'S': 'Süden',
        'SW': 'Südwesten',
        'W': 'Westen',
        'NW': 'Nordwesten'
    };

    return {
        direction,
        directionName: directionNames[direction],
        distance: Math.round(nearestDist),
        roundsSearching: state.roundsWithoutContact
    };
}
