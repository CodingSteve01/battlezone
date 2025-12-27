// ===== GAME STATE =====

import { CONFIG } from './config.js';

// Central game state object
export const state = {
    screen: 'menu',
    settings: {
        players: 2,
        size: 'medium',
        landscape: 'random',    // 'random', 'temperate', 'desert', 'tundra', 'tropical', 'highland', 'wetland'
        singlePlayer: false,    // Legacy: true = all non-0 players are AI
        aiPlayers: [],          // Array of player indices controlled by AI (e.g., [1, 3] for players 2 and 4)
        renderQuality: 'auto',  // 'low', 'medium', 'high', 'auto'
        gore: false,            // Blut-Effekte (standardmäßig aus, kinderfreundlich)
        particleQuality: 'high', // 'low', 'medium', 'high' - Partikelanzahl
        notificationLevel: 'normal', // 'minimal', 'normal', 'verbose' - Hinweis-Ausführlichkeit
        showTutorial: true      // Tutorial-Hinweise anzeigen
    },

    // Current active biome (resolved from 'random' or selected)
    activeBiome: 'temperate',

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
    unitAttacksThisTurn: {},  // Track attacks per unit per turn: unitId -> attack count

    // Game progress
    round: 1,
    gameOver: false,
    animating: false,
    introShown: false,  // Whether the game intro flyover has been shown

    // Movement animation
    movementAnimation: null,  // { unit, path, currentStep, startTime }

    // Terrain animation state
    terrainAnimationFrame: 0,     // Current frame index (0 to FRAME_COUNT-1)
    terrainAnimationTime: 0,      // Last frame change timestamp

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

    // Previously visible enemies (for detection alerts) - PER PLAYER
    previouslyVisibleEnemies: [],   // Array of Sets, one per player

    // Enemy tracking for compass feature - PER PLAYER
    lastEnemyContactRound: [],      // Array: Last round when enemy was spotted per player
    roundsWithoutContact: [],       // Array: Consecutive rounds without seeing enemies per player

    // === SHRINKING ZONE (Battle Royale Mechanik) ===
    zoneRadius: 0,                  // Aktueller spielbarer Radius (schrumpft)
    maxZoneRadius: 0,               // Ursprünglicher Kartenradius
    zoneShrinkWarning: false,       // True wenn Zone bald schrumpft
    lastCombatRound: 0,             // Letzte Runde mit Kampf (für beide Spieler)
    zonePhase: 0,                   // Aktuelle Zone-Schrumpf-Phase (0 = keine Schrumpfung)
    revealCooldown: 0,              // Cooldown für nächste Enthüllung versteckter Einheiten

    // Canvas dimensions
    canvasWidth: 0,
    canvasHeight: 0,

    // Screen shake effect
    screenShake: {
        active: false,
        intensity: 0,
        duration: 0,
        startTime: 0,
        offsetX: 0,
        offsetY: 0
    }
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

    // Initialize per-player tracking arrays
    state.previouslyVisibleEnemies = [];
    state.lastEnemyContactRound = [];
    state.roundsWithoutContact = [];
    for (let i = 0; i < state.settings.players; i++) {
        state.previouslyVisibleEnemies.push(new Set());
        state.lastEnemyContactRound.push(0);
        state.roundsWithoutContact.push(0);
    }
    state.sharedAP = 0;
    state.maxSharedAP = 0;
    state.unitAttacksThisTurn = {};

    // Shrinking Zone zurücksetzen
    state.zoneRadius = 0;
    state.maxZoneRadius = 0;
    state.zoneShrinkWarning = false;
    state.lastCombatRound = 0;
    state.zonePhase = 0;
    state.revealCooldown = 0;

    // Screen shake zurücksetzen
    state.screenShake = {
        active: false,
        intensity: 0,
        duration: 0,
        startTime: 0,
        offsetX: 0,
        offsetY: 0
    };

    // Initialize per-player explored hexes and visible hexes
    state.playerExploredHexes = [];
    state.playerVisibleHexes = [];
    for (let i = 0; i < state.settings.players; i++) {
        state.playerExploredHexes.push(new Set());
        state.playerVisibleHexes.push(new Set());
    }

    // Reset debug flags
    state._visibilityWarningLogged = false;
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

    // Use viewingPlayer for rendering (important for AI vs AI spectator mode)
    const viewPlayer = state.viewingPlayer;

    return state.ghostIndicators.filter(ghost => {
        // Only show ghosts of enemy units (from the viewer's perspective)
        if (ghost.player === viewPlayer) return false;
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
 * Pool is constant (UNITS_PER_PLAYER × AP_PER_TURN) regardless of surviving units
 * This prevents the losing player from being at a severe disadvantage
 */
export function initSharedAPPool(_player) {
    // Constant pool: always based on starting unit count, not current
    const poolSize = CONFIG.UNITS_PER_PLAYER * CONFIG.AP_PER_TURN;
    state.sharedAP = poolSize;
    state.maxSharedAP = poolSize;
    state.unitAttacksThisTurn = {};  // Reset attack tracking
}

// Callback for when AP is depleted (set by turns.js to avoid circular deps)
let onAPDepleted = null;
export function setOnAPDepletedCallback(callback) {
    onAPDepleted = callback;
}

/**
 * Spend AP from the shared pool
 * Returns true if successful, false if not enough AP
 * Triggers auto-end turn callback when AP reaches 0
 */
export function spendSharedAP(amount) {
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
 */
export function trackUnitAttack(unit) {
    const current = state.unitAttacksThisTurn[unit.id] || 0;
    state.unitAttacksThisTurn[unit.id] = current + 1;
}

/**
 * Get remaining attacks for a unit this turn
 */
export function getRemainingAttacks(unit) {
    const attacksSoFar = state.unitAttacksThisTurn[unit.id] || 0;
    return Math.max(0, CONFIG.MAX_ATTACKS_PER_UNIT - attacksSoFar);
}

/**
 * Check if unit can still attack this turn
 */
export function canUnitAttack(unit) {
    return getRemainingAttacks(unit) > 0;
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
 * Update the set of previously visible enemies for a player
 * @param {Array} visibleEnemyIds - Array of enemy unit IDs
 * @param {number} player - Player index (defaults to currentPlayer)
 */
export function updatePreviouslyVisibleEnemies(visibleEnemyIds, player = state.currentPlayer) {
    // Ensure array exists for this player
    if (!state.previouslyVisibleEnemies[player]) {
        state.previouslyVisibleEnemies[player] = new Set();
    }
    state.previouslyVisibleEnemies[player] = new Set(visibleEnemyIds);
}

/**
 * Get the set of previously visible enemies for a player
 * @param {number} player - Player index (defaults to currentPlayer)
 */
export function getPreviouslyVisibleEnemies(player = state.currentPlayer) {
    return state.previouslyVisibleEnemies[player] || new Set();
}

/**
 * Mark that an enemy was spotted this round for a player
 * @param {number} player - Player index (defaults to currentPlayer)
 */
export function markEnemyContact(player = state.currentPlayer) {
    // Ensure arrays exist for this player
    if (state.lastEnemyContactRound[player] === undefined) {
        state.lastEnemyContactRound[player] = 0;
    }
    if (state.roundsWithoutContact[player] === undefined) {
        state.roundsWithoutContact[player] = 0;
    }
    state.lastEnemyContactRound[player] = state.round;
    state.roundsWithoutContact[player] = 0;
}

/**
 * Update contact tracking at end of round for a player
 * @param {boolean} enemiesVisible - Whether enemies are visible
 * @param {number} player - Player index (defaults to currentPlayer)
 */
export function updateContactTracking(enemiesVisible, player = state.currentPlayer) {
    // Ensure arrays exist for this player
    if (state.lastEnemyContactRound[player] === undefined) {
        state.lastEnemyContactRound[player] = 0;
    }
    if (state.roundsWithoutContact[player] === undefined) {
        state.roundsWithoutContact[player] = 0;
    }

    if (enemiesVisible) {
        state.lastEnemyContactRound[player] = state.round;
        state.roundsWithoutContact[player] = 0;
    } else {
        state.roundsWithoutContact[player] = state.round - state.lastEnemyContactRound[player];
    }
}

/**
 * Initialize the shrinking zone with map radius
 */
export function initZone(mapRadius) {
    state.maxZoneRadius = mapRadius;
    state.zoneRadius = mapRadius;
    state.zonePhase = 0;
    state.lastCombatRound = 1;
    state.zoneShrinkWarning = false;
    state.revealCooldown = 0;
}

/**
 * Check if a hex is within the safe zone
 */
export function isHexInZone(q, r) {
    const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
    return dist <= state.zoneRadius;
}

/**
 * Mark that combat happened this round
 */
export function markCombat() {
    state.lastCombatRound = state.round;
}

/**
 * Trigger screen shake effect
 * @param {number} intensity - Shake intensity in pixels (default 8)
 * @param {number} duration - Duration in milliseconds (default 200)
 */
export function triggerScreenShake(intensity = 8, duration = 200) {
    state.screenShake = {
        active: true,
        intensity,
        duration,
        startTime: performance.now(),
        offsetX: 0,
        offsetY: 0
    };
}

/**
 * Update screen shake effect (call each frame)
 * Returns current shake offset
 */
export function updateScreenShake() {
    if (!state.screenShake.active) {
        return { x: 0, y: 0 };
    }

    const elapsed = performance.now() - state.screenShake.startTime;

    if (elapsed >= state.screenShake.duration) {
        // Shake finished
        state.screenShake.active = false;
        state.screenShake.offsetX = 0;
        state.screenShake.offsetY = 0;
        return { x: 0, y: 0 };
    }

    // Calculate decay (shake gets weaker over time)
    const progress = elapsed / state.screenShake.duration;
    const decay = 1 - progress;
    const currentIntensity = state.screenShake.intensity * decay;

    // Random shake offset with decay
    state.screenShake.offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
    state.screenShake.offsetY = (Math.random() - 0.5) * 2 * currentIntensity;

    return {
        x: state.screenShake.offsetX,
        y: state.screenShake.offsetY
    };
}

/**
 * Get direction to nearest enemy (for compass feature)
 * Returns { direction: 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW', distance: number } or null
 */
export function getEnemyDirection() {
    // Only show compass after 3 rounds without contact (use currentPlayer's data)
    const playerRoundsWithoutContact = state.roundsWithoutContact[state.currentPlayer] || 0;
    if (playerRoundsWithoutContact < 3) return null;

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
        roundsSearching: playerRoundsWithoutContact
    };
}
