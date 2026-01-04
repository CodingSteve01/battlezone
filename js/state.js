// ===== GAME STATE =====

import { CONFIG } from './config.js';

// Re-export camera functions from core module (for backward compatibility)
export {
    ZOOM_REFERENCE,
    zoomLevelToScale,
    scaleToZoomLevel,
    getTileScale,
    getTileSizeForHexSize,
    DEFAULT_MIN_ZOOM,
    DEFAULT_MAX_ZOOM
} from './core/cameraState.js';

// Import for local use in state object initialization
import {
    ZOOM_REFERENCE,
    DEFAULT_MIN_ZOOM,
    DEFAULT_MAX_ZOOM,
    getTileZOffset as _getTileZOffset,
    getTileScreenPosition as _getTileScreenPosition,
    getWorldScale as _getWorldScale,
    getTileSize as _getTileSize
} from './core/cameraState.js';

// Import hex state functions
import {
    getHex as _getHex,
    setHex as _setHex,
    getPlayerName as _getPlayerName
} from './core/hexState.js';

// Import unit state functions
import {
    getPlayerUnits as _getPlayerUnits,
    initSharedAPPool as _initSharedAPPool,
    setOnAPDepletedCallback,
    spendSharedAP as _spendSharedAP,
    trackUnitAttack as _trackUnitAttack,
    getRemainingAttacks as _getRemainingAttacks,
    canUnitAttack as _canUnitAttack,
    getCurrentUnit as _getCurrentUnit
} from './core/unitState.js';

// Re-export setOnAPDepletedCallback directly (no state needed)
export { setOnAPDepletedCallback } from './core/unitState.js';

// Import visibility state functions
import {
    switchPlayerFog as _switchPlayerFog,
    isHexVisible as _isHexVisible,
    isHexVisibleToPlayer as _isHexVisibleToPlayer,
    isHexVisibleToViewer as _isHexVisibleToViewer,
    isHexExplored as _isHexExplored
} from './core/visibilityState.js';

// Import zone state functions
import {
    initZone as _initZone,
    isHexInZone as _isHexInZone,
    markCombat as _markCombat
} from './core/zoneState.js';

// Import combat system functions
import {
    queueAmbush as _queueAmbush,
    getNextAmbush as _getNextAmbush,
    hasQueuedAmbushes as _hasQueuedAmbushes,
    clearAmbushQueue as _clearAmbushQueue
} from './combat/ambushSystem.js';

import {
    setOverwatch as _setOverwatch,
    removeOverwatch as _removeOverwatch,
    isUnitOnOverwatch as _isUnitOnOverwatch,
    clearPlayerOverwatch as _clearPlayerOverwatch,
    queueOverwatchTrigger as _queueOverwatchTrigger,
    getNextOverwatchTrigger as _getNextOverwatchTrigger,
    hasQueuedOverwatch as _hasQueuedOverwatch
} from './combat/overwatchSystem.js';

import {
    addSuppressedHex as _addSuppressedHex,
    isHexSuppressed as _isHexSuppressed,
    getSuppressionInfo as _getSuppressionInfo,
    cleanupSuppression as _cleanupSuppression,
    isHexSuppressedForUnit as _isHexSuppressedForUnit
} from './combat/suppressionSystem.js';

import {
    startCoordinatedAttack as _startCoordinatedAttack,
    addCoordinatedAttacker as _addCoordinatedAttacker,
    removeCoordinatedAttacker as _removeCoordinatedAttacker,
    cancelCoordinatedAttack as _cancelCoordinatedAttack,
    getCoordinatedAttackBonus as _getCoordinatedAttackBonus
} from './combat/coordinatedAttack.js';

import {
    updateHoldPosition as _updateHoldPosition,
    getHoldPositionRounds as _getHoldPositionRounds,
    getHoldPositionBonus as _getHoldPositionBonus,
    clearHoldPosition as _clearHoldPosition
} from './combat/holdPosition.js';

// Wrapper functions that pass state automatically (backward compatibility)
export function getWorldScale() {
    return _getWorldScale(state);
}

export function getTileSize() {
    return _getTileSize(state);
}

export function getTileZOffset(height, hexSize = getTileSize()) {
    return _getTileZOffset(height, hexSize);
}

export function getTileScreenPosition(q, r, height, hexSize = getTileSize()) {
    return _getTileScreenPosition(q, r, height, hexSize);
}

// Central game state object
export const state = {
    screen: 'menu',
    settings: {
        players: 2,
        size: 'medium',
        landscape: 'random',    // 'random', 'temperate', 'desert', 'tundra', 'tropical', 'highland', 'wetland'
        singlePlayer: false,    // Legacy: true = all non-0 players are AI
        aiPlayers: [],          // Array of player indices controlled by AI (e.g., [1, 3] for players 2 and 4)
        playerNames: [],        // Array of player names (optional, defaults to "Spieler 1", "Spieler 2", etc.)
        renderQuality: 'auto',  // 'low', 'medium', 'high', 'auto'
        gore: false,            // Blut-Effekte (standardmäßig aus, kinderfreundlich)
        particleQuality: 'high', // 'low', 'medium', 'high' - Partikelanzahl
        notificationLevel: 'normal', // 'minimal', 'normal', 'verbose' - Hinweis-Ausführlichkeit
        showTutorial: true,     // Tutorial-Hinweise anzeigen
        // === TEAM-ALLIANZEN ===
        // Spieler im gleichen Team können sich nicht angreifen
        // Format: Array von Team-IDs, Index = Spieler-Index
        // z.B. [0, 0, 1, 1] = Spieler 0+1 sind Team 0, Spieler 2+3 sind Team 1
        alliances: []           // Leer = keine Allianzen (jeder gegen jeden)
    },

    // Current active biome (resolved from 'random' or selected)
    activeBiome: 'temperate',

    // Map seed for reproducible map generation
    // Set when preview is generated, used for actual game
    mapSeed: 0,

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
    minigameInProgress: false,  // Prevents triggering actions during minigame

    // Shared AP Pool - all units share one pool per turn
    sharedAP: 0,              // Current AP in the pool
    maxSharedAP: 0,           // Maximum AP for this turn (for UI display)
    unitAttacksThisTurn: {},  // Track attacks per unit per turn: unitId -> attack count

    // Cached spawn positions for the current map
    spawnPositions: null,

    // Game progress
    round: 1,
    gameOver: false,
    animating: false,
    introShown: false,  // Whether the game intro flyover has been shown
    turnTransitionInProgress: false,  // Prevents race conditions during turn changes

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
    zoomLevel: ZOOM_REFERENCE,
    minZoom: DEFAULT_MIN_ZOOM,
    maxZoom: DEFAULT_MAX_ZOOM,

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

    // === ROUND EVENTS (für Runden-Zusammenfassung) ===
    roundEvents: [],                // Array von {type, attacker, target, damage, killed, etc.}
    lastRoundSummary: null,         // Zusammenfassung der letzten Runde für Round-Start-Screen

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
    },

    // === KOORDINIERTE ANGRIFFE ===
    coordinatedAttack: {
        active: false,              // Koordinations-Modus aktiv
        targetUnit: null,           // Ziel-Einheit
        attackers: [],              // Array von Unit-IDs die angreifen
        bonusPerAttacker: 0.15      // 15% Schadensbonus pro zusätzlichem Angreifer
    },

    // === HINTERHALT-SYSTEM ===
    ambushQueue: [],                // Warteschlange für ausstehende Hinterhalte
    ambushProcessing: false,        // Wird gerade ein Hinterhalt verarbeitet?

    // === UNTERDRÜCKUNGSFEUER (SUPPRESSION) ===
    suppressedHexes: [],            // Array von {q, r, suppressorId, expiresRound}

    // === OVERWATCH (DECKUNGSFEUER) ===
    overwatchUnits: [],             // Array von Unit-IDs im Overwatch-Modus
    overwatchQueue: [],             // Warteschlange für Overwatch-Trigger

    // === STELLUNG HALTEN (HOLD POSITION) ===
    holdingPosition: {},            // unitId -> {rounds: number, q, r} - Wie lange auf Position gehalten

    // === SPIELER-STATISTIKEN (für Siegerehrung) ===
    playerStats: [],                // Array von Statistik-Objekten pro Spieler

    // Debug/Overlay flags
    debug: {
        showHeightOverlay: false
    }
};

// Hex state wrapper functions (backward compatibility)
export function getHex(q, r) {
    return _getHex(state, q, r);
}

export function getPlayerName(playerIndex) {
    return _getPlayerName(state, playerIndex);
}

export function setHex(hex) {
    return _setHex(state, hex);
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
    state.minigameInProgress = false;
    state.round = 1;
    state.gameOver = false;
    state.animating = false;
    state.turnTransitionInProgress = false;
    state.visibleHexes.clear();
    state.exploredHexes.clear();
    state.ghostIndicators = [];
    state.cameraX = 0;
    state.cameraY = 0;
    state.zoomLevel = ZOOM_REFERENCE;
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
    state.spawnPositions = null;

    // Shrinking Zone zurücksetzen
    state.zoneRadius = 0;
    state.maxZoneRadius = 0;
    state.zoneShrinkWarning = false;
    state.lastCombatRound = 0;
    state.zonePhase = 0;
    state.revealCooldown = 0;

    // Round Events zurücksetzen
    state.roundEvents = [];
    state.lastRoundSummary = null;

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
    state.debug.showHeightOverlay = false;

    // Koordinierte Angriffe zurücksetzen
    state.coordinatedAttack = {
        active: false,
        targetUnit: null,
        attackers: [],
        bonusPerAttacker: 0.15
    };

    // Hinterhalt-System zurücksetzen
    state.ambushQueue = [];
    state.ambushProcessing = false;

    // Neue taktische Systeme zurücksetzen
    state.suppressedHexes = [];
    state.overwatchUnits = [];
    state.overwatchQueue = [];
    state.holdingPosition = {};

    // Spieler-Statistiken initialisieren
    state.playerStats = [];
    for (let i = 0; i < state.settings.players; i++) {
        state.playerStats.push(createEmptyPlayerStats(i));
    }
}

/**
 * Create empty player statistics object
 */
function createEmptyPlayerStats(playerIndex) {
    return {
        player: playerIndex,
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        damageTaken: 0,
        healing: 0,
        hexesMoved: 0,
        shotsHit: 0,
        shotsMissed: 0,
        criticalHits: 0,
        specialsUsed: 0,
        longestKillDistance: 0,
        unitsLost: 0,
        survivalRounds: 0
    };
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

// Visibility state wrapper functions (backward compatibility)
export function switchPlayerFog() {
    return _switchPlayerFog(state);
}

// Unit state wrapper functions (backward compatibility)
export function getPlayerUnits(player) {
    return _getPlayerUnits(state, player);
}

export function initSharedAPPool(player) {
    return _initSharedAPPool(state, player);
}

export function spendSharedAP(amount) {
    return _spendSharedAP(state, amount);
}

export function trackUnitAttack(unit) {
    return _trackUnitAttack(state, unit);
}

export function getRemainingAttacks(unit) {
    return _getRemainingAttacks(state, unit);
}

export function canUnitAttack(unit) {
    return _canUnitAttack(state, unit);
}

export function getCurrentUnit() {
    return _getCurrentUnit(state, getPlayerUnits);
}

// Visibility state wrapper functions (continued)
export function isHexVisible(q, r) {
    return _isHexVisible(state, q, r);
}

export function isHexVisibleToPlayer(q, r, player) {
    return _isHexVisibleToPlayer(state, q, r, player);
}

export function isHexVisibleToViewer(q, r) {
    return _isHexVisibleToViewer(state, q, r);
}

export function isHexExplored(q, r) {
    return _isHexExplored(state, q, r);
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

// Zone state wrapper functions (backward compatibility)
export function initZone(mapRadius) {
    return _initZone(state, mapRadius);
}

export function isHexInZone(q, r) {
    return _isHexInZone(state, q, r);
}

export function markCombat() {
    return _markCombat(state);
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

// Coordinated attack wrapper functions (backward compatibility)
export function startCoordinatedAttack(targetUnit) {
    return _startCoordinatedAttack(state, targetUnit);
}

export function addCoordinatedAttacker(unit) {
    return _addCoordinatedAttacker(state, unit);
}

export function removeCoordinatedAttacker(unitId) {
    return _removeCoordinatedAttacker(state, unitId);
}

export function cancelCoordinatedAttack() {
    return _cancelCoordinatedAttack(state);
}

export function getCoordinatedAttackBonus() {
    return _getCoordinatedAttackBonus(state);
}

// Ambush system wrapper functions (backward compatibility)
export function queueAmbush(ambusher, target) {
    return _queueAmbush(state, ambusher, target);
}

export function getNextAmbush() {
    return _getNextAmbush(state);
}

export function hasQueuedAmbushes() {
    return _hasQueuedAmbushes(state);
}

export function clearAmbushQueue() {
    return _clearAmbushQueue(state);
}

// Suppression system wrapper functions (backward compatibility)
export function addSuppressedHex(q, r, suppressorId, duration = 1) {
    return _addSuppressedHex(state, q, r, suppressorId, duration);
}

export function isHexSuppressed(q, r) {
    return _isHexSuppressed(state, q, r);
}

export function getSuppressionInfo(q, r) {
    return _getSuppressionInfo(state, q, r);
}

export function cleanupSuppression() {
    return _cleanupSuppression(state);
}

export function isHexSuppressedForUnit(q, r, unit) {
    return _isHexSuppressedForUnit(state, q, r, unit, areUnitsAllied);
}

// Overwatch system wrapper functions (backward compatibility)
export function setOverwatch(unitId) {
    return _setOverwatch(state, unitId);
}

export function removeOverwatch(unitId) {
    return _removeOverwatch(state, unitId);
}

export function isUnitOnOverwatch(unitId) {
    return _isUnitOnOverwatch(state, unitId);
}

export function clearPlayerOverwatch(player) {
    return _clearPlayerOverwatch(state, player);
}

export function queueOverwatchTrigger(watcherId, targetId) {
    return _queueOverwatchTrigger(state, watcherId, targetId);
}

export function getNextOverwatchTrigger() {
    return _getNextOverwatchTrigger(state);
}

export function hasQueuedOverwatch() {
    return _hasQueuedOverwatch(state);
}

// Hold position system wrapper functions (backward compatibility)
export function updateHoldPosition(unit) {
    return _updateHoldPosition(state, unit);
}

export function getHoldPositionRounds(unitId) {
    return _getHoldPositionRounds(state, unitId);
}

export function getHoldPositionBonus(unitId) {
    return _getHoldPositionBonus(state, unitId);
}

export function clearHoldPosition(unitId) {
    return _clearHoldPosition(state, unitId);
}

// === TEAM-ALLIANZEN HELPER ===

/**
 * Prüfe ob zwei Spieler verbündet sind (im gleichen Team)
 * @param {number} player1 - Erster Spieler-Index
 * @param {number} player2 - Zweiter Spieler-Index
 * @returns {boolean} True wenn verbündet
 */
export function arePlayersAllied(player1, player2) {
    // Gleicher Spieler = immer "verbündet" (kann sich nicht selbst angreifen)
    if (player1 === player2) return true;

    // Keine Allianzen konfiguriert = jeder gegen jeden
    const alliances = state.settings.alliances;
    if (!alliances || alliances.length === 0) return false;

    // Prüfe ob beide Spieler im gleichen Team sind
    const team1 = alliances[player1];
    const team2 = alliances[player2];

    // Wenn einer keinem Team zugeordnet ist, sind sie nicht verbündet
    if (team1 === undefined || team2 === undefined) return false;

    return team1 === team2;
}

/**
 * Prüfe ob zwei Einheiten verbündet sind
 * @param {Object} unit1 - Erste Einheit
 * @param {Object} unit2 - Zweite Einheit
 * @returns {boolean} True wenn verbündet
 */
export function areUnitsAllied(unit1, unit2) {
    if (!unit1 || !unit2) return false;
    return arePlayersAllied(unit1.player, unit2.player);
}

/**
 * Hole alle verbündeten Spieler eines Spielers
 * @param {number} player - Spieler-Index
 * @returns {number[]} Array von verbündeten Spieler-Indizes (inkl. sich selbst)
 */
export function getAlliedPlayers(player) {
    const alliances = state.settings.alliances;
    if (!alliances || alliances.length === 0) return [player];

    const myTeam = alliances[player];
    if (myTeam === undefined) return [player];

    const allies = [];
    for (let i = 0; i < state.settings.players; i++) {
        if (alliances[i] === myTeam) {
            allies.push(i);
        }
    }
    return allies;
}

/**
 * Hole alle feindlichen Spieler eines Spielers
 * @param {number} player - Spieler-Index
 * @returns {number[]} Array von feindlichen Spieler-Indizes
 */
export function getEnemyPlayers(player) {
    const enemies = [];
    for (let i = 0; i < state.settings.players; i++) {
        if (!arePlayersAllied(player, i)) {
            enemies.push(i);
        }
    }
    return enemies;
}

/**
 * Hole alle feindlichen Einheiten für einen Spieler
 * @param {number} player - Spieler-Index
 * @returns {Object[]} Array von feindlichen Einheiten
 */
export function getEnemyUnits(player) {
    return state.units.filter(u =>
        u.alive && !arePlayersAllied(u.player, player)
    );
}

/**
 * Hole alle verbündeten Einheiten für einen Spieler (inkl. eigene)
 * @param {number} player - Spieler-Index
 * @returns {Object[]} Array von verbündeten Einheiten
 */
export function getAlliedUnits(player) {
    return state.units.filter(u =>
        u.alive && arePlayersAllied(u.player, player)
    );
}

/**
 * Prüfe ob Allianzen aktiv sind
 * @returns {boolean} True wenn Allianzen konfiguriert
 */
export function hasAlliances() {
    const alliances = state.settings.alliances;
    return alliances && alliances.length > 0;
}

/**
 * Hole die Anzahl der verschiedenen Teams
 * @returns {number} Anzahl der Teams
 */
export function getTeamCount() {
    const alliances = state.settings.alliances;
    if (!alliances || alliances.length === 0) {
        return state.settings.players; // Jeder Spieler ist ein eigenes "Team"
    }
    return new Set(alliances).size;
}

/**
 * Hole alle Spieler in einem bestimmten Team
 * @param {number} teamId - Team-ID
 * @returns {number[]} Array von Spieler-Indizes
 */
export function getPlayersInTeam(teamId) {
    const alliances = state.settings.alliances;
    if (!alliances || alliances.length === 0) return [];

    const players = [];
    for (let i = 0; i < alliances.length; i++) {
        if (alliances[i] === teamId) {
            players.push(i);
        }
    }
    return players;
}

// === SPIELER-STATISTIKEN HELPER ===

/**
 * Get stats for a specific player
 */
export function getPlayerStats(player) {
    if (!state.playerStats[player]) {
        state.playerStats[player] = {
            player,
            kills: 0,
            deaths: 0,
            damageDealt: 0,
            damageTaken: 0,
            healing: 0,
            hexesMoved: 0,
            shotsHit: 0,
            shotsMissed: 0,
            criticalHits: 0,
            specialsUsed: 0,
            longestKillDistance: 0,
            unitsLost: 0,
            survivalRounds: 0
        };
    }
    return state.playerStats[player];
}

/**
 * Record a kill for a player
 */
export function recordKill(player, distance = 0) {
    const stats = getPlayerStats(player);
    stats.kills++;
    if (distance > stats.longestKillDistance) {
        stats.longestKillDistance = distance;
    }
}

/**
 * Record damage dealt by a player
 */
export function recordDamageDealt(player, amount) {
    const stats = getPlayerStats(player);
    stats.damageDealt += amount;
}

/**
 * Record damage taken by a player
 */
export function recordDamageTaken(player, amount) {
    const stats = getPlayerStats(player);
    stats.damageTaken += amount;
}

/**
 * Record a shot hit or miss
 */
export function recordShot(player, hit, isCritical = false) {
    const stats = getPlayerStats(player);
    if (hit) {
        stats.shotsHit++;
        if (isCritical) {
            stats.criticalHits++;
        }
    } else {
        stats.shotsMissed++;
    }
}

/**
 * Record healing done by a player
 */
export function recordHealing(player, amount) {
    const stats = getPlayerStats(player);
    stats.healing += amount;
}

/**
 * Record movement (hexes moved)
 */
export function recordMovement(player, hexes) {
    const stats = getPlayerStats(player);
    stats.hexesMoved += hexes;
}

/**
 * Record special ability used
 */
export function recordSpecialUsed(player) {
    const stats = getPlayerStats(player);
    stats.specialsUsed++;
}

/**
 * Record a unit death for a player
 */
export function recordUnitLost(player) {
    const stats = getPlayerStats(player);
    stats.unitsLost++;
}

/**
 * Update survival rounds for all alive players
 */
export function updateSurvivalRounds() {
    for (let p = 0; p < state.settings.players; p++) {
        const units = state.units.filter(u => u.player === p && u.alive);
        if (units.length > 0) {
            const stats = getPlayerStats(p);
            stats.survivalRounds = state.round;
        }
    }
}

/**
 * Calculate total score for a player based on their stats
 * Points breakdown:
 * - Kills: 100 points each
 * - Damage dealt: 1 point per damage
 * - Healing: 2 points per HP healed
 * - Survival: 10 points per round survived
 * - Critical hits: 25 points each
 * - Specials used: 15 points each
 * - Accuracy bonus: up to 50 points for 80%+ accuracy
 */
export function calculatePlayerScore(player) {
    const stats = getPlayerStats(player);

    let score = 0;

    // Combat points
    score += stats.kills * 100;
    score += stats.damageDealt;
    score += stats.criticalHits * 25;

    // Support points
    score += stats.healing * 2;
    score += stats.specialsUsed * 15;

    // Survival points
    score += stats.survivalRounds * 10;

    // Accuracy bonus (if at least 3 shots fired)
    const totalShots = stats.shotsHit + stats.shotsMissed;
    if (totalShots >= 3) {
        const accuracy = stats.shotsHit / totalShots;
        if (accuracy >= 0.8) {
            score += 50;
        } else if (accuracy >= 0.6) {
            score += 25;
        }
    }

    return Math.round(score);
}

/**
 * Get all player scores sorted by score (descending)
 * Returns array of { player, score, stats }
 */
export function getPlayerRankings() {
    const rankings = [];

    for (let p = 0; p < state.settings.players; p++) {
        const stats = getPlayerStats(p);
        const score = calculatePlayerScore(p);
        rankings.push({ player: p, score, stats });
    }

    // Sort by score descending
    rankings.sort((a, b) => b.score - a.score);

    return rankings;
}

// === ROUND EVENTS SYSTEM ===
// Tracks combat events during a round for the summary screen

/**
 * Log a combat event (attack, kill, heal, etc.)
 * @param {string} type - Event type: 'attack', 'kill', 'heal', 'special'
 * @param {Object} data - Event data
 */
export function logRoundEvent(type, data) {
    state.roundEvents.push({
        type,
        round: state.round,
        timestamp: Date.now(),
        ...data
    });
}

/**
 * Generate round summary from collected events
 * Called at the end of each round before starting a new one
 */
export function generateRoundSummary() {
    const events = state.roundEvents;

    // Count events per player
    const playerActions = {};
    for (let p = 0; p < state.settings.players; p++) {
        playerActions[p] = {
            attacks: 0,
            kills: 0,
            damageDealt: 0,
            damageTaken: 0,
            heals: 0,
            healingDone: 0
        };
    }

    // Process events
    const highlights = [];
    let totalKills = 0;
    let totalDamage = 0;

    for (const event of events) {
        if (event.type === 'attack') {
            if (playerActions[event.attackerPlayer] !== undefined) {
                playerActions[event.attackerPlayer].attacks++;
                playerActions[event.attackerPlayer].damageDealt += event.damage || 0;
            }
            if (playerActions[event.targetPlayer] !== undefined) {
                playerActions[event.targetPlayer].damageTaken += event.damage || 0;
            }
            totalDamage += event.damage || 0;

            // Track kills as highlights
            if (event.killed) {
                totalKills++;
                if (playerActions[event.attackerPlayer] !== undefined) {
                    playerActions[event.attackerPlayer].kills++;
                }
                highlights.push({
                    type: 'kill',
                    attackerPlayer: event.attackerPlayer,
                    targetPlayer: event.targetPlayer,
                    attackerClass: event.attackerClass,
                    targetClass: event.targetClass
                });
            }
        } else if (event.type === 'heal') {
            if (playerActions[event.healerPlayer] !== undefined) {
                playerActions[event.healerPlayer].heals++;
                playerActions[event.healerPlayer].healingDone += event.amount || 0;
            }
        }
    }

    // Find the player who dealt the most damage
    let mostAggressivePlayer = -1;
    let maxDamage = 0;
    for (let p = 0; p < state.settings.players; p++) {
        if (playerActions[p].damageDealt > maxDamage) {
            maxDamage = playerActions[p].damageDealt;
            mostAggressivePlayer = p;
        }
    }

    // Find the player who took the most damage
    let mostDamagedPlayer = -1;
    let maxDamageTaken = 0;
    for (let p = 0; p < state.settings.players; p++) {
        if (playerActions[p].damageTaken > maxDamageTaken) {
            maxDamageTaken = playerActions[p].damageTaken;
            mostDamagedPlayer = p;
        }
    }

    // Determine who is in the lead (based on units alive and total HP)
    const playerStrength = [];
    for (let p = 0; p < state.settings.players; p++) {
        const units = state.units.filter(u => u.player === p && u.alive);
        const totalHP = units.reduce((sum, u) => sum + u.currentHp, 0);
        playerStrength.push({ player: p, units: units.length, totalHP });
    }
    playerStrength.sort((a, b) => {
        if (a.units !== b.units) return b.units - a.units;
        return b.totalHP - a.totalHP;
    });

    const leadingPlayer = playerStrength.length > 0 ? playerStrength[0].player : -1;
    const trailingPlayer = playerStrength.length > 1 ? playerStrength[playerStrength.length - 1].player : -1;

    // Check if it's close (units equal or similar HP)
    const isClose = playerStrength.length >= 2 &&
        playerStrength[0].units === playerStrength[1].units &&
        Math.abs(playerStrength[0].totalHP - playerStrength[1].totalHP) < 50;

    state.lastRoundSummary = {
        round: state.round,
        totalEvents: events.length,
        totalKills,
        totalDamage,
        playerActions,
        highlights,
        mostAggressivePlayer,
        mostDamagedPlayer,
        leadingPlayer,
        trailingPlayer,
        isClose,
        playerStrength,
        wasQuiet: events.length === 0
    };

    return state.lastRoundSummary;
}

/**
 * Clear round events (called at the start of a new round)
 */
export function clearRoundEvents() {
    state.roundEvents = [];
}

/**
 * Get the last round's summary
 */
export function getLastRoundSummary() {
    return state.lastRoundSummary;
}
