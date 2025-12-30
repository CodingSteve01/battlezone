// ===== GAME STATE =====

import { CONFIG } from './config.js';
import { hexToPixel } from './hexMath.js';

export const ZOOM_REFERENCE = 0.45;

export function zoomLevelToScale(zoomLevel) {
    const safeZoom = Number.isFinite(zoomLevel) ? zoomLevel : ZOOM_REFERENCE;
    return safeZoom / ZOOM_REFERENCE;
}

export function scaleToZoomLevel(scale) {
    const safeScale = Number.isFinite(scale) ? scale : 1;
    return safeScale * ZOOM_REFERENCE;
}

export function getWorldScale() {
    const baseSize = CONFIG.BASE_HEX_SIZE * CONFIG.HEX_SIZE_SCALE;
    const scale = baseSize > 0 ? state.hexSize / baseSize : 1;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function getTileScale() {
    const scale = Number.isFinite(CONFIG.TILE_SCALE) && CONFIG.TILE_SCALE > 0 ? CONFIG.TILE_SCALE : 1;
    return scale;
}

export function getTileSize() {
    return state.hexSize * getTileScale();
}

export function getTileSizeForHexSize(hexSize) {
    const baseSize = Number.isFinite(hexSize) && hexSize > 0 ? hexSize : CONFIG.BASE_HEX_SIZE;
    return baseSize * getTileScale();
}

export function getTileZOffset(height, hexSize = getTileSize()) {
    const level = Math.max(0, height ?? 0);
    return level * hexSize * 0.18;
}

export function getTileScreenPosition(q, r, height, hexSize = getTileSize()) {
    const pos = hexToPixel(q, r, hexSize);
    const zOffset = getTileZOffset(height, hexSize);
    return { x: pos.x, y: pos.y - zOffset, zOffset };
}

const DEFAULT_MIN_ZOOM = scaleToZoomLevel(0.1);
const DEFAULT_MAX_ZOOM = scaleToZoomLevel(1.2);

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

/**
 * Get hex at coordinates
 */
export function getHex(q, r) {
    return state.hexMap.get(`${q},${r}`);
}

/**
 * Get player name (uses custom name or falls back to default)
 */
export function getPlayerName(playerIndex) {
    if (state.settings.playerNames && state.settings.playerNames[playerIndex]) {
        return state.settings.playerNames[playerIndex];
    }
    return `Spieler ${playerIndex + 1}`;
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

// === KOORDINIERTE ANGRIFFE HELPER ===

/**
 * Starte den Koordinations-Modus für einen Angriff
 */
export function startCoordinatedAttack(targetUnit) {
    state.coordinatedAttack.active = true;
    state.coordinatedAttack.targetUnit = targetUnit;
    state.coordinatedAttack.attackers = [];
}

/**
 * Füge einen Angreifer zur koordinierten Attacke hinzu
 */
export function addCoordinatedAttacker(unit) {
    if (!state.coordinatedAttack.attackers.includes(unit.id)) {
        state.coordinatedAttack.attackers.push(unit.id);
    }
}

/**
 * Entferne einen Angreifer aus der koordinierten Attacke
 */
export function removeCoordinatedAttacker(unitId) {
    state.coordinatedAttack.attackers = state.coordinatedAttack.attackers.filter(id => id !== unitId);
}

/**
 * Beende den Koordinations-Modus
 */
export function cancelCoordinatedAttack() {
    state.coordinatedAttack.active = false;
    state.coordinatedAttack.targetUnit = null;
    state.coordinatedAttack.attackers = [];
}

/**
 * Berechne den Schadensbonus für koordinierte Angriffe
 */
export function getCoordinatedAttackBonus() {
    const attackerCount = state.coordinatedAttack.attackers.length;
    if (attackerCount <= 1) return 0;
    return (attackerCount - 1) * state.coordinatedAttack.bonusPerAttacker;
}

// === HINTERHALT HELPER ===

/**
 * Füge einen Hinterhalt zur Warteschlange hinzu
 */
export function queueAmbush(ambusher, target) {
    state.ambushQueue.push({
        ambusherId: ambusher.id,
        targetId: target.id,
        timestamp: Date.now()
    });
}

/**
 * Hole den nächsten Hinterhalt aus der Warteschlange
 */
export function getNextAmbush() {
    return state.ambushQueue.shift() || null;
}

/**
 * Prüfe ob Hinterhalte ausstehen
 */
export function hasQueuedAmbushes() {
    return state.ambushQueue.length > 0;
}

/**
 * Leere die Hinterhalt-Warteschlange
 */
export function clearAmbushQueue() {
    state.ambushQueue = [];
}

// === UNTERDRÜCKUNGSFEUER (SUPPRESSION) HELPER ===

/**
 * Füge ein unterdrücktes Hex hinzu
 */
export function addSuppressedHex(q, r, suppressorId, duration = 1) {
    // Entferne existierende Unterdrückung auf diesem Hex
    state.suppressedHexes = state.suppressedHexes.filter(s => !(s.q === q && s.r === r));

    state.suppressedHexes.push({
        q, r,
        suppressorId,
        expiresRound: state.round + duration
    });
}

/**
 * Prüfe ob ein Hex unterdrückt ist
 */
export function isHexSuppressed(q, r) {
    return state.suppressedHexes.some(s =>
        s.q === q && s.r === r && s.expiresRound > state.round
    );
}

/**
 * Hole Unterdrückungs-Info für ein Hex
 */
export function getSuppressionInfo(q, r) {
    return state.suppressedHexes.find(s =>
        s.q === q && s.r === r && s.expiresRound > state.round
    ) || null;
}

/**
 * Entferne abgelaufene Unterdrückungen
 */
export function cleanupSuppression() {
    state.suppressedHexes = state.suppressedHexes.filter(s => s.expiresRound > state.round);
}

/**
 * Prüfe ob ein Hex für eine bestimmte Einheit unterdrückt ist
 * WICHTIG: Unterdrückung betrifft nur Feinde, nicht Verbündete!
 * @param {number} q - Hex-Koordinate Q
 * @param {number} r - Hex-Koordinate R
 * @param {Object} unit - Die zu prüfende Einheit
 * @returns {boolean} True wenn das Hex für diese Einheit unterdrückt ist
 */
export function isHexSuppressedForUnit(q, r, unit) {
    if (!unit) return isHexSuppressed(q, r);

    const suppression = getSuppressionInfo(q, r);
    if (!suppression) return false;

    // Finde den Unterdrücker
    const suppressor = state.units.find(u => u.id === suppression.suppressorId);
    if (!suppressor) return false;

    // Unterdrückung betrifft nur Feinde des Unterdrückers!
    if (suppressor.player === unit.player) return false;
    if (areUnitsAllied(suppressor, unit)) return false;

    return true;
}

// === OVERWATCH (DECKUNGSFEUER) HELPER ===

/**
 * Setze eine Einheit in Overwatch-Modus
 */
export function setOverwatch(unitId) {
    if (!state.overwatchUnits.includes(unitId)) {
        state.overwatchUnits.push(unitId);
    }
}

/**
 * Entferne Overwatch von einer Einheit
 */
export function removeOverwatch(unitId) {
    state.overwatchUnits = state.overwatchUnits.filter(id => id !== unitId);
}

/**
 * Prüfe ob Einheit im Overwatch ist
 */
export function isUnitOnOverwatch(unitId) {
    return state.overwatchUnits.includes(unitId);
}

/**
 * Lösche alle Overwatch für einen Spieler (am Zugstart)
 */
export function clearPlayerOverwatch(player) {
    const playerUnitIds = state.units
        .filter(u => u.player === player && u.alive)
        .map(u => u.id);
    state.overwatchUnits = state.overwatchUnits.filter(id => !playerUnitIds.includes(id));
}

/**
 * Füge Overwatch-Trigger zur Queue hinzu
 */
export function queueOverwatchTrigger(watcherId, targetId) {
    state.overwatchQueue.push({
        watcherId,
        targetId,
        timestamp: Date.now()
    });
}

/**
 * Hole nächsten Overwatch-Trigger
 */
export function getNextOverwatchTrigger() {
    return state.overwatchQueue.shift() || null;
}

/**
 * Prüfe ob Overwatch-Trigger ausstehen
 */
export function hasQueuedOverwatch() {
    return state.overwatchQueue.length > 0;
}

// === STELLUNG HALTEN HELPER ===

/**
 * Aktualisiere Position-Halten Status für eine Einheit
 */
export function updateHoldPosition(unit) {
    const current = state.holdingPosition[unit.id];

    if (current && current.q === unit.q && current.r === unit.r) {
        // Einheit ist auf derselben Position geblieben
        current.rounds++;
    } else {
        // Einheit hat sich bewegt oder neue Position
        state.holdingPosition[unit.id] = {
            q: unit.q,
            r: unit.r,
            rounds: 1
        };
    }
}

/**
 * Hole die Anzahl Runden die eine Einheit Position gehalten hat
 */
export function getHoldPositionRounds(unitId) {
    const holding = state.holdingPosition[unitId];
    return holding ? holding.rounds : 0;
}

/**
 * Berechne den Verteidigungsbonus für Stellung-Halten
 * 5% pro Runde, max 20%
 */
export function getHoldPositionBonus(unitId) {
    const rounds = getHoldPositionRounds(unitId);
    if (rounds <= 1) return 0;
    return Math.min(0.20, (rounds - 1) * 0.05); // Max 20% nach 5 Runden
}

/**
 * Entferne Hold-Position Status wenn Einheit sich bewegt
 */
export function clearHoldPosition(unitId) {
    delete state.holdingPosition[unitId];
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
