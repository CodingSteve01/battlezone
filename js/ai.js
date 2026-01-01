// ===== AI OPPONENT =====
// Advanced tactical AI with memory, planning, and unit coordination

import { state, getHex, getPlayerUnits, spendSharedAP, isHexInZone, canUnitAttack, arePlayersAllied, getPlayerName } from './state.js';
import { hexDistance } from './hexMath.js';
import { getReachableHexes, findPath } from './pathfinding.js';
import { moveUnitInstant, getAttackableUnits } from './units.js';
import {
    executeAttack, useSpecialAbility, canUseSpecialAbility, getSpecialAbilityCost,
    canUseSuppression, useSuppression, canUseOverwatch, activateOverwatch,
    checkAmbushTriggers, executeAmbushAttack,
    checkOverwatchTriggers, executeOverwatchAttack
} from './combat.js';
import { updateVisibility, updateVisibilityForPlayer, isUnitVisible, isUnitVisibleToViewer } from './fogOfWar.js';
import { updateUI, showPowerupPickup } from './ui.js';
import { render } from './renderer.js';
import { endTurn } from './turns.js';
import { TERRAIN, CONFIG } from './config.js';
import { scrollToUnitWithZoom, getRelevantUnitsForZoom, followUnitInstant } from './input.js';
import { logAI, logError } from './errorLog.js';
import { checkPowerupPickup, getPowerupAt } from './powerups.js';
import { getSpawnPositions } from './map.js';

// ===== AI THOUGHT SYSTEM (for Spectator Mode) =====
// Stores and displays AI decision explanations

const aiThoughts = {
    current: null,          // Current thought being displayed
    queue: [],              // Queue of thoughts to display
    enabled: false,         // Only enabled in spectator mode (all AI players)
    displayTime: 2000,      // How long each thought is displayed (ms)
};

/**
 * Check if spectator mode is active
 * Active when:
 * 1. All players were AI from the start, OR
 * 2. All human players have been eliminated (no units left)
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
 * Add an AI thought to be displayed
 */
function addAIThought(thought, category = 'general') {
    if (!isSpectatorMode()) return;

    const thoughtObj = {
        text: thought,
        category: category,  // 'strategy', 'attack', 'move', 'special', 'retreat'
        timestamp: Date.now()
    };

    aiThoughts.queue.push(thoughtObj);
    showNextThought();
}

/**
 * Show the next thought in queue
 */
function showNextThought() {
    if (aiThoughts.current || aiThoughts.queue.length === 0) return;

    aiThoughts.current = aiThoughts.queue.shift();
    displayThought(aiThoughts.current);

    setTimeout(() => {
        aiThoughts.current = null;
        showNextThought();
    }, aiThoughts.displayTime);
}

/**
 * Display a thought in the UI
 */
function displayThought(thought) {
    const existing = document.querySelector('.ai-thought-bubble');
    if (existing) existing.remove();

    const categoryIcons = {
        strategy: '🎯',
        attack: '⚔️',
        move: '🚶',
        special: '✨',
        retreat: '🛡️',
        general: '💭'
    };

    const bubble = document.createElement('div');
    bubble.className = 'ai-thought-bubble';
    bubble.innerHTML = `
        <span class="thought-icon">${categoryIcons[thought.category] || '💭'}</span>
        <span class="thought-text">${thought.text}</span>
    `;
    document.body.appendChild(bubble);

    // Animate in
    requestAnimationFrame(() => {
        bubble.classList.add('visible');
    });

    // Animate out before removal
    setTimeout(() => {
        bubble.classList.remove('visible');
        setTimeout(() => bubble.remove(), 300);
    }, aiThoughts.displayTime - 300);
}

/**
 * Clear all pending thoughts
 */
function clearAIThoughts() {
    aiThoughts.queue = [];
    aiThoughts.current = null;
    const existing = document.querySelector('.ai-thought-bubble');
    if (existing) existing.remove();
}

// ===== AI MEMORY SYSTEM =====
// Team-based memory shared between allied AIs for coordinated strategy
// Allied AIs share intel and target assignments to work as one team

/**
 * Create a fresh memory object for a team
 */
function createTeamMemory() {
    return {
        lastKnownPositions: new Map(),  // unitId -> { q, r, round, confidence }
        searchedAreas: new Set(),        // "q,r" keys of recently searched hexes
        threatAssessment: new Map(),     // unitId -> threat level
        huntMode: false,                 // True when actively hunting remaining enemies
        lastContactRound: 0,             // Last round we saw an enemy
        playerCenterEstimate: null,      // Estimated center of enemy forces
        searchPattern: 'expand',         // 'expand', 'sweep', 'pincer'
        assignedTargets: new Map(),      // unitId -> targetUnitId (for focus fire)
        // Decoy/Bait strategy
        decoyUnit: null,                 // Unit acting as bait
        ambushUnits: [],                 // Units waiting to ambush
        decoyActive: false,              // Is decoy strategy currently active
        // Team coordination
        lastUpdateRound: 0,              // Last round this memory was updated
        teamPlayers: new Set(),          // Players that share this memory
    };
}

// Team-based memory storage: teamId -> memory
// Team ID is determined by alliance - allied players share the same memory
const teamMemories = new Map();

/**
 * Get the team memory for the current AI player
 * Allied AIs share the same memory for coordinated strategy
 */
function getTeamMemory() {
    // Find the team ID - use the lowest player index in the alliance
    let teamId = state.currentPlayer;
    for (let p = 0; p < state.settings.players; p++) {
        if (p !== state.currentPlayer && arePlayersAllied(state.currentPlayer, p)) {
            teamId = Math.min(teamId, p);
        }
    }

    // Get or create team memory
    if (!teamMemories.has(teamId)) {
        const memory = createTeamMemory();
        memory.teamPlayers.add(state.currentPlayer);
        teamMemories.set(teamId, memory);
    }

    const memory = teamMemories.get(teamId);
    memory.teamPlayers.add(state.currentPlayer);
    return memory;
}

// Reference to current team's memory (set at start of AI turn)
let aiMemory = createTeamMemory();

function getEnemySpawnCenters() {
    const spawns = getSpawnPositions();
    if (!spawns || spawns.length === 0) return [];

    return spawns
        .map((playerSpawns, playerIndex) => ({
            playerIndex,
            center: playerSpawns[0]
        }))
        .filter(({ playerIndex }) => playerIndex < state.settings.players)
        .filter(({ playerIndex }) => !arePlayersAllied(state.currentPlayer, playerIndex))
        .map(({ center }) => center)
        .filter(Boolean);
}

/**
 * Reset AI memory for new game - clears all team memories
 */
export function resetAIMemory() {
    // Clear all team memories
    teamMemories.clear();
    // Reset the local reference
    aiMemory = createTeamMemory();
}

/**
 * Initialize AI memory for the current player's turn
 * Sets aiMemory to the shared team memory so allies coordinate
 */
function initializeTeamMemory() {
    aiMemory = getTeamMemory();
    aiMemory.lastUpdateRound = state.round;
}

// ===== DECOY/BAIT STRATEGY =====

/**
 * Check if decoy strategy should be used
 * Conditions:
 * - Have 3+ units alive
 * - Have a tanky unit (Assault) or fast unit (Scout) to act as bait
 * - Have units that can deal high damage from ambush (Sniper, Commando)
 * - Enemies are visible but not too close
 */
function shouldUseDecoyStrategy(aiUnits, enemies) {
    // Need at least 3 units for effective decoy
    if (aiUnits.length < 3) return false;

    // Need visible enemies
    if (enemies.length === 0) return false;

    // Check if enemies are at mid-range (not too close, not too far)
    const avgEnemyDist = enemies.reduce((sum, e) => {
        const closestUnit = aiUnits.reduce((minDist, u) => {
            const dist = hexDistance({ q: u.q, r: u.r }, { q: e.q, r: e.r });
            return dist < minDist ? dist : minDist;
        }, Infinity);
        return sum + closestUnit;
    }, 0) / enemies.length;

    // Decoy works best at 4-8 hex distance
    if (avgEnemyDist < 4 || avgEnemyDist > 10) return false;

    // Check for suitable decoy candidates
    const decoyCandidate = findDecoyCandidate(aiUnits);
    if (!decoyCandidate) return false;

    // Check for ambush units
    const ambushCandidates = aiUnits.filter(u =>
        u.id !== decoyCandidate.id &&
        (u.class === 'sniper' || u.class === 'commando' || u.class === 'assault')
    );

    return ambushCandidates.length >= 1;
}

/**
 * Find the best unit to act as decoy/bait
 * Prefer: Assault (tanky), Scout (fast escape)
 */
function findDecoyCandidate(aiUnits) {
    // Priority order for decoy
    const decoyPriority = ['assault', 'scout', 'medic'];

    for (const className of decoyPriority) {
        const candidate = aiUnits.find(u =>
            u.class === className &&
            u.currentHp > u.maxHp * 0.5 && // Needs decent HP
            u.alive
        );
        if (candidate) return candidate;
    }
    return null;
}

/**
 * Plan decoy strategy - set up units for ambush
 */
function planDecoyStrategy(aiUnits, _enemies) {
    // Find decoy
    const decoy = findDecoyCandidate(aiUnits);
    if (!decoy) return false;

    // Find ambush units (high damage dealers)
    const ambushers = aiUnits.filter(u =>
        u.id !== decoy.id &&
        u.alive &&
        (u.class === 'sniper' || u.class === 'commando' || u.class === 'assault')
    );

    if (ambushers.length === 0) return false;

    // Activate decoy strategy
    aiMemory.decoyUnit = decoy.id;
    aiMemory.ambushUnits = ambushers.map(u => u.id);
    aiMemory.decoyActive = true;

    addAIThought(`🎯 Köder-Strategie: ${CLASS_NAMES_DE[decoy.class]} lockt Feinde an!`, 'strategy');

    return true;
}

/**
 * Check if a unit is the current decoy
 */
function isDecoyUnit(unit) {
    return aiMemory.decoyActive && aiMemory.decoyUnit === unit.id;
}

/**
 * Check if a unit is an ambush unit
 */
function isAmbushUnit(unit) {
    return aiMemory.decoyActive && aiMemory.ambushUnits.includes(unit.id);
}

/**
 * Score position for decoy unit - move toward enemies to lure them
 * Decoy should be tempting target but have escape route
 */
function scoreDecoyPosition(unit, q, r, enemies) {
    let score = 0;
    const hex = getHex(q, r);

    if (!hex) return -1000;

    // Find closest enemy
    let closestEnemy = null;
    let closestDist = Infinity;
    for (const enemy of enemies) {
        const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
        if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = enemy;
        }
    }

    if (closestEnemy) {
        // Decoy wants to be visible and in enemy attack range to lure them
        // Ideal distance: just outside enemy range or just inside (to be attacked)
        const enemyRange = closestEnemy.range || 3;

        if (closestDist === enemyRange || closestDist === enemyRange + 1) {
            // Perfect bait position - enemy can almost reach
            score += 100;
        } else if (closestDist < enemyRange) {
            // In enemy range - dangerous but effective bait
            score += 60;
        } else if (closestDist <= enemyRange + 2) {
            // Close enough to lure
            score += 40;
        } else {
            // Too far to be effective bait
            score -= closestDist * 5;
        }
    }

    // Check retreat path to allies (ambush units)
    const ambushUnits = getPlayerUnits(unit.player).filter(u => isAmbushUnit(u));
    if (ambushUnits.length > 0) {
        const avgAmbushDist = ambushUnits.reduce((sum, a) =>
            sum + hexDistance({ q, r }, { q: a.q, r: a.r }), 0
        ) / ambushUnits.length;

        // Decoy should be between enemies and ambush units (but closer to enemies)
        if (avgAmbushDist >= 3 && avgAmbushDist <= 6) {
            score += 30; // Good retreat distance
        } else if (avgAmbushDist > 6) {
            score -= 20; // Too far from backup
        }
    }

    // Decoy prefers light cover but stays visible
    if (hex.cover) score += 15; // Some protection is good
    if (hex.type === 'hills') score += 10; // Visible position

    // Penalty for positions that block ambush units' line of fire
    // (decoy shouldn't stand between ambush and enemy)

    // Zone awareness
    if (!isHexInZone(q, r)) {
        score -= 200; // Don't lure outside safe zone
    }

    return score;
}

/**
 * Score position for ambush unit - stay hidden, ready to strike
 * Ambush units should be in cover, at flanking angles
 */
function scoreAmbushPosition(unit, q, r, enemies) {
    let score = 0;
    const hex = getHex(q, r);

    if (!hex) return -1000;

    // Find closest enemy
    let closestEnemy = null;
    let closestDist = Infinity;
    for (const enemy of enemies) {
        const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
        if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = enemy;
        }
    }

    // Ambush units want to be in attack range but from cover
    if (closestEnemy) {
        // Ideal distance: just at unit's attack range
        if (closestDist <= unit.range) {
            score += 80; // Can attack from here
        } else if (closestDist <= unit.range + 2) {
            score += 40; // Close to attack range
        } else {
            score -= (closestDist - unit.range) * 10;
        }
    }

    // Cover is essential for ambush
    if (hex.cover) {
        score += 60; // Ambush from cover
    } else {
        score -= 30; // Exposed position is bad for ambush
    }

    // Hills provide attack bonus for snipers
    if (hex.type === 'hills' && unit.class === 'sniper') {
        score += 50;
    }

    // Flanking position bonus
    // Check position relative to decoy unit
    const decoyUnit = getPlayerUnits(unit.player).find(u => isDecoyUnit(u));
    if (decoyUnit && closestEnemy) {
        // Ambush should be at different angle from decoy
        const decoyAngle = Math.atan2(decoyUnit.r - closestEnemy.r, decoyUnit.q - closestEnemy.q);
        const myAngle = Math.atan2(r - closestEnemy.r, q - closestEnemy.q);
        const angleDiff = Math.abs(myAngle - decoyAngle);

        // Reward flanking position (90+ degrees from decoy)
        if (angleDiff > Math.PI / 2) {
            score += 40; // Good flank
        } else if (angleDiff > Math.PI / 4) {
            score += 20; // Acceptable angle
        }
    }

    // Avoid clustering with other ambush units
    const otherAmbush = getPlayerUnits(unit.player).filter(u =>
        isAmbushUnit(u) && u.id !== unit.id
    );
    for (const other of otherAmbush) {
        const dist = hexDistance({ q, r }, { q: other.q, r: other.r });
        if (dist <= 1) score -= 25;
        else if (dist <= 2) score -= 10;
    }

    // Zone awareness
    if (!isHexInZone(q, r)) {
        score -= 200;
    }

    return score;
}

/**
 * Check if a player is AI controlled
 * Supports both legacy singlePlayer mode and new aiPlayers array
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
 * Check if there are any human players in the game
 */
export function hasHumanPlayer() {
    for (let p = 0; p < state.settings.players; p++) {
        if (!isAIPlayer(p)) return true;
    }
    return false;
}

/**
 * Execute AI turn
 */
export function executeAITurn() {
    if (!isAIPlayer()) return;

    showAIThinking();

    // Small delay to show thinking indicator
    setTimeout(() => {
        performAIActions();
    }, 800);
}

/**
 * Show AI thinking overlay
 * Positioned at bottom of screen so player can still see the game
 */
function showAIThinking() {
    const existing = document.querySelector('.ai-thinking');
    if (existing) existing.remove();

    const playerName = getPlayerName(state.currentPlayer);
    const spectator = isSpectatorMode();

    const overlay = document.createElement('div');
    overlay.className = 'ai-thinking' + (spectator ? ' spectator-mode' : '');
    overlay.innerHTML = spectator ? `
        <span class="ai-icon">🎬</span>
        <span class="ai-text">${playerName} (KI) analysiert...</span>
        <span class="ai-subtext">Beobachter-Modus</span>
    ` : `
        <span class="ai-icon">🤖</span>
        <span class="ai-text">${playerName} (KI) am Zug...</span>
    `;
    document.body.appendChild(overlay);
}

/**
 * Hide AI thinking overlay
 */
function hideAIThinking() {
    const overlay = document.querySelector('.ai-thinking');
    if (overlay) overlay.remove();
}

// ===== STRATEGIC PLANNING =====

/**
 * Calculate AP budget per unit to ensure all units can act
 * This prevents one unit from consuming all AP
 */
function calculateAPBudgets(aiUnits, totalAP, visibleEnemies) {
    const apBudgets = new Map();
    const aliveUnits = aiUnits.filter(u => u.alive);
    const unitCount = aliveUnits.length;

    if (unitCount === 0) return apBudgets;

    // Base AP per unit (ensure everyone gets something)
    const baseAPPerUnit = Math.floor(totalAP / unitCount);
    let remainingAP = totalAP;

    // Priority scoring for AP allocation
    const priorities = [];

    for (const unit of aliveUnits) {
        let priority = 1.0;

        // Check if unit can attack any visible enemy
        const canAttack = visibleEnemies.some(e =>
            hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.range
        );

        // Check if unit can reach attack range with movement
        const canReachAndAttack = visibleEnemies.some(e => {
            const dist = hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r });
            return dist <= unit.range + unit.move;
        });

        // Higher priority for units that can attack now
        if (canAttack) {
            priority += 1.5;
            // Even higher for kill shots
            const killable = visibleEnemies.find(e =>
                hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.range &&
                e.currentHp <= unit.damage
            );
            if (killable) priority += 1.0;
        } else if (canReachAndAttack) {
            priority += 0.8;
        }

        // Medics get priority if allies are wounded
        if (unit.class === 'medic') {
            const woundedAllies = aliveUnits.filter(a =>
                a.currentHp < a.maxHp * 0.6
            );
            if (woundedAllies.length > 0) priority += 0.5;
        }

        // Lower priority for units that should retreat
        if (shouldRetreat(unit, visibleEnemies)) {
            priority -= 0.3;
        }

        // Assigned target bonus
        if (aiMemory.assignedTargets.has(unit.id)) {
            priority += 0.4;
        }

        priorities.push({ unit, priority, canAttack, canReachAndAttack });
    }

    // Sort by priority
    priorities.sort((a, b) => b.priority - a.priority);

    // Allocate AP based on priority
    for (const { unit, priority: _priority, canAttack, canReachAndAttack } of priorities) {
        // Calculate unit's AP budget
        let unitBudget;

        if (canAttack) {
            // Unit can attack - give enough AP for attack + possible second action
            unitBudget = Math.min(remainingAP, Math.max(2, baseAPPerUnit + 1));
        } else if (canReachAndAttack) {
            // Unit can reach and attack - give enough for move + attack
            unitBudget = Math.min(remainingAP, Math.max(3, baseAPPerUnit + 1));
        } else {
            // Unit needs to explore/position - give base allocation
            unitBudget = Math.min(remainingAP, Math.max(1, baseAPPerUnit));
        }

        // Ensure minimum 1 AP for each unit (for at least moving)
        unitBudget = Math.max(1, unitBudget);

        // Don't exceed remaining AP
        unitBudget = Math.min(unitBudget, remainingAP);

        apBudgets.set(unit.id, unitBudget);
        remainingAP -= unitBudget;

        // If we're out of AP, remaining units get 0
        if (remainingAP <= 0) break;
    }

    // Give remaining units at least 0 budget
    for (const unit of aliveUnits) {
        if (!apBudgets.has(unit.id)) {
            apBudgets.set(unit.id, 0);
        }
    }

    return apBudgets;
}

/**
 * Check if a position is exposed to enemy attacks
 * Returns exposure score (higher = more dangerous)
 */
function calculatePositionExposure(q, r, enemies, unit) {
    let exposure = 0;

    for (const enemy of enemies) {
        const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
        const enemyRange = enemy.range || 3;

        // Position is in enemy attack range - very exposed
        if (dist <= enemyRange) {
            // Weight by enemy damage
            exposure += enemy.damage * 1.5;

            // Extra exposure if enemy is close (melee threat)
            if (dist <= 2) {
                exposure += enemy.damage * 0.5;
            }

            // High-damage enemies are more threatening
            if (enemy.class === 'sniper' || enemy.class === 'assault') {
                exposure += 20;
            }
        } else if (dist <= enemyRange + enemy.move) {
            // Enemy could reach and attack next turn
            exposure += enemy.damage * 0.4;
        }
    }

    // Check terrain for cover reduction
    const hex = getHex(q, r);
    if (hex && hex.cover) {
        exposure *= 0.6; // Cover reduces exposure by 40%
    }
    if (hex && hex.type === 'hills') {
        exposure *= 0.85; // Hills provide some defense
    }

    // Adjust for unit class - some units can handle exposure better
    if (unit) {
        if (unit.class === 'assault') {
            exposure *= 0.7; // Assault is tanky
        } else if (unit.class === 'sniper' || unit.class === 'medic') {
            exposure *= 1.3; // These are fragile
        }
    }

    return exposure;
}

/**
 * Get all units from allied AI players (for team coordination)
 * This includes the current player and all allied AI players
 */
function getAllAlliedAIUnits() {
    const alliedUnits = [];
    for (let p = 0; p < state.settings.players; p++) {
        // Include current player and all allied AI players
        if (p === state.currentPlayer || (isAIPlayer(p) && arePlayersAllied(state.currentPlayer, p))) {
            const units = getPlayerUnits(p).filter(u => u.alive);
            alliedUnits.push(...units);
        }
    }
    return alliedUnits;
}

/**
 * Analyze the battlefield and create a strategic plan
 * Uses team-wide coordination for allied AIs
 */
function analyzeAndPlan() {
    const aiUnits = getPlayerUnits(state.currentPlayer);
    const allAlliedUnits = getAllAlliedAIUnits();  // All units from allied AIs
    const visibleEnemies = findAllVisibleEnemies();

    // Update AI memory with visible enemies
    updateMemoryWithVisibleEnemies(visibleEnemies);

    // Learn from ghost indicators (where cloaked enemies attacked from)
    learnFromGhostIndicators();

    // Calculate threat assessment
    updateThreatAssessment(visibleEnemies);

    // Estimate player position if no enemies visible
    if (visibleEnemies.length === 0) {
        estimatePlayerPosition();
        addAIThought('Keine Feinde in Sicht. Suche nach Zielen...', 'strategy');
    } else {
        aiMemory.lastContactRound = state.round;
        aiMemory.huntMode = false;
        const threatLevel = visibleEnemies.length > 2 ? 'hohe' : 'moderate';
        addAIThought(`${visibleEnemies.length} Feinde erkannt! Bewerte ${threatLevel} Bedrohung.`, 'strategy');
    }

    // Enter hunt mode if we haven't seen enemies for a while
    if (state.round - aiMemory.lastContactRound >= 2) {
        aiMemory.huntMode = true;
        addAIThought('Aktiviere Jagdmodus - Feinde werden gesucht!', 'strategy');
    }

    // Decide search pattern based on situation (using all allied units)
    decideSearchPattern(allAlliedUnits, visibleEnemies);

    // Generate thought based on search pattern
    const patternNames = {
        'engage': 'Angriff - Feinde im Visier',
        'expand': 'Expansion - Gebiet erkunden',
        'sweep': 'Durchkämmen - Koordinierter Vormarsch',
        'pincer': 'Zangenbewegung - Einkreisung'
    };
    if (aiMemory.searchPattern && patternNames[aiMemory.searchPattern]) {
        addAIThought(`Strategie: ${patternNames[aiMemory.searchPattern]}`, 'strategy');
    }

    // Assign targets using ALL allied units for coordinated focus fire
    // This ensures allied AIs don't duplicate target assignments
    assignTargets(allAlliedUnits, visibleEnemies);

    // Check if decoy strategy should be used
    if (!aiMemory.decoyActive && shouldUseDecoyStrategy(aiUnits, visibleEnemies)) {
        planDecoyStrategy(aiUnits, visibleEnemies);
    }

    // Deactivate decoy strategy if decoy unit is dead or too damaged
    if (aiMemory.decoyActive) {
        const decoy = aiUnits.find(u => u.id === aiMemory.decoyUnit);
        if (!decoy || !decoy.alive || decoy.currentHp < decoy.maxHp * 0.3) {
            aiMemory.decoyActive = false;
            aiMemory.decoyUnit = null;
            aiMemory.ambushUnits = [];
            addAIThought('Köder-Strategie abgebrochen - neu bewerten...', 'strategy');
        }
    }

    // Calculate AP budgets for each unit
    const apBudgets = calculateAPBudgets(aiUnits, state.sharedAP, visibleEnemies);

    // Log AP allocation
    const budgetInfo = aiUnits.filter(u => u.alive).map(u =>
        `${CLASS_NAMES_DE[u.class] || u.class}: ${apBudgets.get(u.id) || 0} AP`
    ).join(', ');
    addAIThought(`AP-Verteilung: ${budgetInfo}`, 'strategy');

    return {
        aiUnits,
        visibleEnemies,
        knownEnemyPositions: Array.from(aiMemory.lastKnownPositions.values()),
        inHuntMode: aiMemory.huntMode,
        searchPattern: aiMemory.searchPattern,
        decoyActive: aiMemory.decoyActive,
        apBudgets
    };
}

/**
 * Update memory with currently visible enemies
 */
function updateMemoryWithVisibleEnemies(enemies) {
    for (const enemy of enemies) {
        aiMemory.lastKnownPositions.set(enemy.id, {
            q: enemy.q,
            r: enemy.r,
            round: state.round,
            confidence: 1.0,  // 100% confidence for visible enemies
            unitClass: enemy.class,
            hp: enemy.currentHp,
            maxHp: enemy.maxHp
        });
    }

    // Decay confidence for old positions
    aiMemory.lastKnownPositions.forEach((pos, id) => {
        if (pos.round < state.round) {
            pos.confidence *= 0.7;  // Reduce confidence each round
            if (pos.confidence < 0.1) {
                aiMemory.lastKnownPositions.delete(id);
            }
        }
    });
}

/**
 * Learn from ghost indicators - positions where cloaked enemies attacked from
 * This allows AI to deduce enemy positions even when they can't directly see them
 */
function learnFromGhostIndicators() {
    // Get ghost indicators that are visible to the AI player (enemy attacks)
    const ghosts = state.ghostIndicators.filter(ghost => {
        // Only learn from ghosts of enemy units (nicht von Verbündeten!)
        return !arePlayersAllied(state.currentPlayer, ghost.player);
    });

    for (const ghost of ghosts) {
        // Check if this ghost position gives us new/better information
        const existingInfo = aiMemory.lastKnownPositions.get(ghost.unitId);

        // Ghost indicators have medium confidence (0.6) - they show where the enemy WAS
        const ghostConfidence = 0.6;

        if (!existingInfo || existingInfo.confidence < ghostConfidence) {
            // Store or update the last known position from ghost
            aiMemory.lastKnownPositions.set(ghost.unitId, {
                q: ghost.q,
                r: ghost.r,
                round: state.round,
                confidence: ghostConfidence,
                unitClass: ghost.class,
                fromGhost: true  // Mark this as ghost-derived information
            });

            // Log AI thought about detection
            addAIThought(`Feindliche Position erkannt! ${ghost.class} griff von Position an.`, 'strategy');
        }
    }
}

/**
 * Calculate threat level for each enemy
 */
function updateThreatAssessment(enemies) {
    aiMemory.threatAssessment.clear();

    for (const enemy of enemies) {
        let threat = 0;

        // Base threat by class
        const classThreat = {
            sniper: 90,      // High damage at range
            elitesoldat: 88, // Versatile elite - high priority target
            commando: 85,    // High damage, stealth
            medic: 80,       // Force multiplier - healing
            assault: 70,     // High damage, tanky
            scout: 50        // Lower threat but mobile
        };
        threat += classThreat[enemy.class] || 50;

        // HP factor - low HP enemies are less threatening but good targets
        const hpPercent = enemy.currentHp / enemy.maxHp;
        threat *= hpPercent;

        // Position factor - enemies near our units are more threatening
        const aiUnits = getPlayerUnits(state.currentPlayer);
        const minDist = Math.min(...aiUnits.map(u =>
            hexDistance({ q: u.q, r: u.r }, { q: enemy.q, r: enemy.r })
        ));
        if (minDist <= 2) threat *= 1.5;
        else if (minDist <= 4) threat *= 1.2;

        aiMemory.threatAssessment.set(enemy.id, threat);
    }
}

/**
 * Estimate where player forces might be based on last known positions
 */
function estimatePlayerPosition() {
    const positions = Array.from(aiMemory.lastKnownPositions.values());

    if (positions.length === 0) {
        const enemySpawnCenters = getEnemySpawnCenters();
        if (enemySpawnCenters.length > 0) {
            const avgQ = enemySpawnCenters.reduce((sum, pos) => sum + pos.q, 0) / enemySpawnCenters.length;
            const avgR = enemySpawnCenters.reduce((sum, pos) => sum + pos.r, 0) / enemySpawnCenters.length;
            const driftTowardCenter = Math.min(0.6, 0.2 + state.round * 0.05);
            aiMemory.playerCenterEstimate = {
                q: avgQ * (1 - driftTowardCenter),
                r: avgR * (1 - driftTowardCenter)
            };
            return;
        }

        // No information - estimate based on spawn area (opposite side of map)
        const aiUnits = getPlayerUnits(state.currentPlayer);
        if (aiUnits.length > 0) {
            const avgQ = aiUnits.reduce((sum, u) => sum + u.q, 0) / aiUnits.length;
            const avgR = aiUnits.reduce((sum, u) => sum + u.r, 0) / aiUnits.length;
            // Player is likely on opposite side
            const driftTowardCenter = Math.min(0.6, 0.2 + state.round * 0.05);
            aiMemory.playerCenterEstimate = {
                q: -avgQ * 0.8 * (1 - driftTowardCenter),
                r: -avgR * 0.8 * (1 - driftTowardCenter)
            };
        }
        return;
    }

    // Weight positions by confidence
    let totalWeight = 0;
    let weightedQ = 0;
    let weightedR = 0;

    for (const pos of positions) {
        totalWeight += pos.confidence;
        weightedQ += pos.q * pos.confidence;
        weightedR += pos.r * pos.confidence;
    }

    if (totalWeight > 0) {
        aiMemory.playerCenterEstimate = {
            q: weightedQ / totalWeight,
            r: weightedR / totalWeight
        };
    }
}

/**
 * Decide the best search pattern
 */
function decideSearchPattern(aiUnits, visibleEnemies) {
    if (visibleEnemies.length > 0) {
        aiMemory.searchPattern = 'engage';
        return;
    }

    // Calculate AI force spread
    if (aiUnits.length < 2) {
        aiMemory.searchPattern = 'expand';
        return;
    }

    const avgQ = aiUnits.reduce((sum, u) => sum + u.q, 0) / aiUnits.length;
    const avgR = aiUnits.reduce((sum, u) => sum + u.r, 0) / aiUnits.length;
    const spread = aiUnits.reduce((sum, u) =>
        sum + hexDistance({ q: u.q, r: u.r }, { q: avgQ, r: avgR }), 0
    ) / aiUnits.length;

    if (spread > 4) {
        // Units are spread out - use sweep pattern
        aiMemory.searchPattern = 'sweep';
    } else if (aiMemory.huntMode && spread < 3) {
        // Units grouped and hunting - use pincer
        aiMemory.searchPattern = 'pincer';
    } else {
        aiMemory.searchPattern = 'expand';
    }
}

/**
 * Assign targets to units for coordinated attacks (focus fire)
 */
function assignTargets(aiUnits, enemies) {
    aiMemory.assignedTargets.clear();

    if (enemies.length === 0) return;

    // Sort enemies by threat (highest first)
    const sortedEnemies = [...enemies].sort((a, b) =>
        (aiMemory.threatAssessment.get(b.id) || 0) - (aiMemory.threatAssessment.get(a.id) || 0)
    );

    // Calculate how many units needed to kill each enemy
    for (const enemy of sortedEnemies) {
        let remainingHp = enemy.currentHp;

        // Find units that can attack this enemy
        for (const unit of aiUnits) {
            if (aiMemory.assignedTargets.has(unit.id)) continue;

            const dist = hexDistance({ q: unit.q, r: unit.r }, { q: enemy.q, r: enemy.r });

            // Check if unit can reach and attack
            if (dist <= unit.range || dist <= unit.range + unit.move) {
                aiMemory.assignedTargets.set(unit.id, enemy.id);
                remainingHp -= unit.damage;

                // Stop assigning to this enemy once we can kill it
                if (remainingHp <= 0) break;
            }
        }
    }
}

// ===== MAIN AI EXECUTION =====

// Track AI turn progress to detect freezes
let aiTurnStartTime = 0;
let aiTurnTimeoutId = null;
const AI_TURN_MAX_DURATION = 30000; // 30 seconds max per turn

/**
 * Perform all AI actions for current turn
 */
async function performAIActions() {
    // Track turn start time for timeout detection
    aiTurnStartTime = Date.now();

    // Set up global turn timeout FIRST - CRITICAL for preventing infinite loops
    // This ensures the turn ALWAYS ends, even if AI logic gets stuck or safety checks bail out
    if (aiTurnTimeoutId) clearTimeout(aiTurnTimeoutId);
    aiTurnTimeoutId = setTimeout(() => {
        console.warn(`AI turn timeout after ${AI_TURN_MAX_DURATION}ms - forcing end turn`);
        hideAIThinking();
        clearAIThoughts();
        endTurn();
    }, AI_TURN_MAX_DURATION);

    // SAFETY CHECK: Double-verify this is an AI player's turn
    // This prevents any race conditions or bugs from allowing AI to control human units
    if (!isAIPlayer()) {
        console.warn('AI tried to execute actions for human player - forcing end turn!');
        hideAIThinking();
        // Clear timeout since we're ending turn now
        if (aiTurnTimeoutId) {
            clearTimeout(aiTurnTimeoutId);
            aiTurnTimeoutId = null;
        }
        // CRITICAL: Must call endTurn() to not leave game hanging
        endTurn();
        return;
    }

    const aiPlayerIndex = state.currentPlayer; // Store for validation during execution

    // Check if we're in spectator mode (human watching AI vs AI)
    const spectatorMode = isSpectatorMode();

    logAI('KI-Zug startet', `Spieler ${aiPlayerIndex + 1}, Spectator: ${spectatorMode}`);

    // Initialize team memory - allied AIs share the same memory for coordination
    initializeTeamMemory();

    // Spectator mode: slow down AI to human-like speed so viewer can follow
    const unitDelay = spectatorMode ? 800 : 400;

    // Wrap entire AI execution in try/catch to ensure endTurn is ALWAYS called
    // This prevents the game from hanging if any async operation fails
    try {
        // When AI is playing, ensure correct visibility for rendering
        if (spectatorMode) {
            // In spectator mode, view from current AI's perspective
            logAI('Spectator-Modus: Aktualisiere Sichtbarkeit für AI');
            updateVisibilityForPlayer(state.currentPlayer);
            render();
        } else {
            // Normal mode: human viewer's visibility
            const hasHumanViewer = !isAIPlayer(state.viewingPlayer);
            if (hasHumanViewer && state.viewingPlayer !== state.currentPlayer) {
                logAI('Human-Viewer-Modus: Aktualisiere Sichtbarkeit');
                updateVisibilityForPlayer(state.viewingPlayer);
                render();
            }
        }

        // Strategic analysis and planning
        const plan = analyzeAndPlan();

        // Sort units by role priority for this turn
        const sortedUnits = sortUnitsForExecution(plan);

        // In spectator mode, hide the thinking overlay once AI starts executing
        // so the viewer can watch the action without obstruction
        if (spectatorMode) {
            hideAIThinking();
        }

        // Track units processed for debugging
        let unitsProcessed = 0;

        for (const unit of sortedUnits) {
            // Check global timeout hasn't triggered
            if (Date.now() - aiTurnStartTime > AI_TURN_MAX_DURATION - 2000) {
                console.warn('AI turn approaching timeout - stopping early');
                break;
            }

            if (!unit.alive) continue;

            // SAFETY: Verify turn hasn't changed and unit belongs to AI
            if (state.currentPlayer !== aiPlayerIndex || unit.player !== aiPlayerIndex) {
                console.warn('Turn changed or unit mismatch during AI execution - stopping!');
                break;
            }

            // In spectator mode, scroll to follow the action with situational zoom
            if (spectatorMode) {
                // Get relevant units for dynamic zoom based on situation
                const relevantUnits = getRelevantUnitsForZoom(unit, state.viewingPlayer);
                await safeAwait(scrollToUnitWithZoom(unit, 500, null, relevantUnits), 2000);
                await delay(300);
            }

            await safeAwait(performUnitAI(unit, plan, spectatorMode), 10000);
            unitsProcessed++;
            await delay(unitDelay);
        }

        // Log turn completion stats for debugging
        const turnDuration = Date.now() - aiTurnStartTime;
        console.log(`AI turn completed: ${unitsProcessed} units processed in ${turnDuration}ms`);
    } catch (error) {
        logError('KI-Ausführungsfehler', error);
        // Continue to endTurn despite errors
    } finally {
        // Clear the timeout since we're ending normally
        if (aiTurnTimeoutId) {
            clearTimeout(aiTurnTimeoutId);
            aiTurnTimeoutId = null;
        }

        // ALWAYS clean up and end turn, even if errors occurred
        hideAIThinking();
        clearAIThoughts();

        setTimeout(() => {
            endTurn();
        }, spectatorMode ? 800 : 500);
    }
}

/**
 * Safely await a promise with timeout protection
 * Prevents the AI from hanging indefinitely if a promise never resolves
 */
function safeAwait(promise, timeoutMs = 5000) {
    return Promise.race([
        promise,
        new Promise((resolve) => setTimeout(resolve, timeoutMs))
    ]);
}

/**
 * Sort units based on strategic role
 */
function sortUnitsForExecution(plan) {
    const units = [...plan.aiUnits];

    return units.sort((a, b) => {
        // === DECOY STRATEGY ORDER ===
        // Decoy moves FIRST to set up the lure position
        // Then ambush units position/attack
        // Then other units support
        if (plan.decoyActive) {
            const aIsDecoy = isDecoyUnit(a);
            const bIsDecoy = isDecoyUnit(b);
            const aIsAmbush = isAmbushUnit(a);
            const bIsAmbush = isAmbushUnit(b);

            // Decoy goes first
            if (aIsDecoy && !bIsDecoy) return -1;
            if (bIsDecoy && !aIsDecoy) return 1;

            // Ambush units go second
            if (aIsAmbush && !bIsAmbush) return -1;
            if (bIsAmbush && !aIsAmbush) return 1;
        }

        // If enemies visible, prioritize attackers
        if (plan.visibleEnemies.length > 0) {
            // Units with assigned targets go first
            const aHasTarget = aiMemory.assignedTargets.has(a.id);
            const bHasTarget = aiMemory.assignedTargets.has(b.id);
            if (aHasTarget && !bHasTarget) return -1;
            if (bHasTarget && !aHasTarget) return 1;

            // Then by damage potential
            return b.damage - a.damage;
        }

        // In exploration mode, scouts and snipers first (vision)
        const explorePriority = { scout: 0, sniper: 1, commando: 2, medic: 4, assault: 3 };
        return (explorePriority[a.class] ?? 5) - (explorePriority[b.class] ?? 5);
    });
}

/**
 * Perform AI for a single unit with strategic awareness and AP budget
 * @param {Object} unit - The unit to control
 * @param {Object} plan - Strategic plan from analyzeAndPlan
 * @param {boolean} spectatorMode - Whether in spectator mode (slower pacing)
 */
async function performUnitAI(unit, plan, spectatorMode = false) {
    // CRITICAL SAFETY: Never control units that don't belong to AI
    if (!isAIPlayer(unit.player)) {
        console.error(`AI attempted to control human player ${unit.player}'s unit! Blocking action.`);
        return;
    }

    // Get this unit's AP budget
    const unitBudget = plan.apBudgets ? (plan.apBudgets.get(unit.id) || 0) : state.sharedAP;
    let apSpentByUnit = 0;

    // Helper to check if unit can spend more AP
    const canSpendAP = (cost) => {
        return (apSpentByUnit + cost <= unitBudget) && (state.sharedAP >= cost);
    };

    // Helper to track AP spent by this unit
    const trackAPSpent = (cost) => {
        apSpentByUnit += cost;
    };

    try {
        // In spectator mode, always render as if human is watching
        const hasHumanViewer = spectatorMode || !isAIPlayer(state.viewingPlayer);

        // Delay multiplier for spectator mode - makes AI human-speed watchable
        const actionDelayBase = spectatorMode ? 600 : 300;
        const shortDelay = spectatorMode ? 400 : 100;

        const renderIfVisible = () => {
            // In spectator mode, always render (human is watching)
            if (spectatorMode || !hasHumanViewer || isUnitVisibleToViewer(unit)) {
                render();
            }
        };

        // Check current situation
        const attackable = getAttackableUnits(unit);
        const assignedTargetId = aiMemory.assignedTargets.get(unit.id);
        const enemies = plan.visibleEnemies;

        // === DECOY STRATEGY EXECUTION ===
        if (plan.decoyActive && isDecoyUnit(unit)) {
            await executeDecoyBehavior(unit, plan, renderIfVisible, hasHumanViewer, spectatorMode);
            return;
        }

        if (plan.decoyActive && isAmbushUnit(unit)) {
            await executeAmbushBehavior(unit, plan, renderIfVisible, hasHumanViewer, spectatorMode);
            return;
        }

        // === NORMAL TACTICAL DECISION TREE ===
        const unitName = CLASS_NAMES_DE[unit.class] || unit.class;

        // Get spotted awareness for tactical decisions
        const spottedInfo = getSpottedAwareness(unit, enemies);

        // Generate spotted-awareness thought
        if (spectatorMode && enemies.length > 0) {
            if (spottedInfo.isSpotted) {
                if (spottedInfo.urgency === 'critical') {
                    addAIThought(`⚠️ ${unitName}: Entdeckt & verwundet - kritische Lage!`, 'strategy');
                } else if (spottedInfo.shouldSeekCover) {
                    addAIThought(`👁️ ${unitName}: Vom Feind entdeckt - suche Deckung`, 'strategy');
                }
            } else if (spottedInfo.canSurpriseAttack) {
                addAIThought(`🎯 ${unitName}: Unentdeckt - Überraschungsangriff möglich!`, 'strategy');
            }
        }

        // 1. Should we retreat? (Low HP, enemies nearby, or spotted and vulnerable)
        if (shouldRetreat(unit, enemies) && canSpendAP(1)) {
            // Enhanced retreat thought with reason
            const hpPercent = Math.round(unit.currentHp / unit.maxHp * 100);
            let retreatReason = `${hpPercent}% HP`;
            if (spottedInfo.isSpotted && spottedInfo.closestEnemyDist <= 3) {
                retreatReason += ', Feind zu nah';
            }
            addAIThought(`🛡️ ${unitName}: Rückzug (${retreatReason})`, 'retreat');
            await executeRetreatWithBudget(unit, enemies, spectatorMode, unitBudget - apSpentByUnit);
            return;
        }

        // 2. Attack assigned target if possible (focus fire)
        // WICHTIG: canUnitAttack prüft MAX_ATTACKS_PER_UNIT (gleiche Regel wie für Menschen)
        if (assignedTargetId && attackable.some(t => t.id === assignedTargetId) && canSpendAP(1) && canUnitAttack(unit)) {
            const target = attackable.find(t => t.id === assignedTargetId);
            // Enhanced attack thought with evaluation
            const targetName = CLASS_NAMES_DE[target.class] || target.class;
            const canKill = target.currentHp <= unit.damage;
            if (canKill) {
                addAIThought(`💀 ${unitName}: Todesstoß auf ${targetName}!`, 'attack');
            } else {
                const damagePercent = Math.round((unit.damage / target.currentHp) * 100);
                addAIThought(`⚔️ ${unitName}: Fokusfeuer auf ${targetName} (~${damagePercent}% Schaden)`, 'attack');
            }
            await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
            trackAPSpent(1);
        } else if (attackable.length > 0 && canSpendAP(1) && canUnitAttack(unit)) {
            // 3. Attack best available target
            const target = selectBestTarget(unit, attackable);
            if (target) {
                const targetName = CLASS_NAMES_DE[target.class] || target.class;
                const canKill = target.currentHp <= unit.damage;
                if (canKill) {
                    addAIThought(`💀 ${unitName}: Kann ${targetName} eliminieren!`, 'attack');
                } else {
                    const targetHpPercent = Math.round((target.currentHp / target.maxHp) * 100);
                    addAIThought(`⚔️ ${unitName} → ${targetName} (${targetHpPercent}% HP)`, 'attack');
                }
                await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
                trackAPSpent(1);
            }
        }

        // 4. Use special ability if beneficial AND within budget
        const specialCost = getSpecialAbilityCost(unit.class);
        if (canSpendAP(specialCost) && canUseSpecialAbility(unit) && shouldUseSpecial(unit, enemies, plan)) {
            // Generate special ability thought with reason
            const specialReasons = {
                scout: spottedInfo.isSpotted ? 'Sprint für Flucht!' : 'Sprint für Flanke!',
                assault: 'Powershot für max. Schaden!',
                medic: 'Team braucht Heilung!',
                sniper: spottedInfo.isSpotted ? 'Tarnung nach Entdeckung!' : 'Tarnung für Hinterhalt!',
                commando: 'Stealth für Infiltration!',
                elitesoldat: 'Taktischer Vorteil!'
            };
            addAIThought(`✨ ${unitName}: ${specialReasons[unit.class] || 'Spezialfähigkeit!'}`, 'special');

            useSpecialAbility(unit);
            trackAPSpent(specialCost);
            if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                updateUI();
                render();
            }
            await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
        }

        // 5. Move strategically (within budget)
        if (canSpendAP(1)) {
            const remainingBudget = unitBudget - apSpentByUnit;
            const moveTarget = selectStrategicMoveTargetWithBudget(unit, plan, remainingBudget);
            if (moveTarget) {
                // Generate move thought based on situation
                if (spectatorMode && !moveTarget.foresight?.explanation) {
                    // Generate a thought about why we're moving
                    if (enemies.length === 0) {
                        addAIThought(`🔍 ${unitName}: Erkundet Gebiet`, 'move');
                    } else if (spottedInfo.isSpotted && spottedInfo.shouldSeekCover) {
                        addAIThought(`🏃 ${unitName}: Repositioniert in Deckung`, 'move');
                    } else {
                        const closestEnemy = enemies[0];
                        const distAfter = hexDistance({ q: moveTarget.q, r: moveTarget.r }, { q: closestEnemy.q, r: closestEnemy.r });
                        if (distAfter <= unit.range) {
                            addAIThought(`🎯 ${unitName}: Bewegt sich in Angriffsreichweite`, 'move');
                        } else {
                            addAIThought(`📍 ${unitName}: Taktische Neupositionierung`, 'move');
                        }
                    }
                }
                await executeAIMove(unit, moveTarget, spectatorMode);
                trackAPSpent(moveTarget.cost);
            }
        }

        // 6. Attack again after moving (if budget allows)
        // Erneuter Angriff nur möglich wenn vorheriger Angriff VERFEHLT hat (canUnitAttack)
        const attackableAfterMove = getAttackableUnits(unit);
        if (attackableAfterMove.length > 0 && canSpendAP(1) && canUnitAttack(unit)) {
            const target = selectBestTarget(unit, attackableAfterMove);
            if (target) {
                const targetName = CLASS_NAMES_DE[target.class] || target.class;
                addAIThought(`⚔️ ${unitName}: Folgeangriff auf ${targetName}!`, 'attack');
                await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
                trackAPSpent(1);
            }
        }

        // 7. Consider tactical abilities if we have AP left
        await considerTacticalAbilities(unit, enemies, plan, {
            canSpendAP,
            trackAPSpent,
            hasHumanViewer,
            spectatorMode,
            renderIfVisible,
            actionDelayBase,
            shortDelay
        });
    } catch (error) {
        logError(`KI-Fehler für Einheit ${unit.id} (${unit.class})`, error);
        // Continue to next unit - don't let one unit's error stop the entire turn
    }
}

/**
 * Execute retreat with AP budget constraint
 * Note: AI thought is generated by caller before this function
 */
async function executeRetreatWithBudget(unit, enemies, spectatorMode, maxAP) {
    const reachable = getReachableHexes(unit);
    if (reachable.size === 0) return;

    // Limit movement by budget
    const maxCost = Math.min(maxAP, state.sharedAP);
    let bestHex = null;
    let bestScore = -Infinity;

    reachable.forEach((data, key) => {
        if (data.cost > maxCost) return;

        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || hex.unit) return;

        let score = 0;

        // Maximize distance from enemies
        for (const enemy of enemies) {
            score += hexDistance({ q, r }, { q: enemy.q, r: enemy.r }) * 10;
        }

        // === EXPOSURE PENALTY - Don't retreat into enemy range ===
        const exposure = calculatePositionExposure(q, r, enemies, unit);
        score -= exposure * 2;

        // Prefer cover
        if (hex.cover) score += 30;

        // Move towards allies (for protection/healing) - includes ALL allied players
        const allies = getAllAlliedAIUnits().filter(u => u.id !== unit.id);
        if (allies.length > 0) {
            const closestAlly = Math.min(...allies.map(a =>
                hexDistance({ q, r }, { q: a.q, r: a.r })
            ));
            score += (10 - closestAlly) * 5;
        }

        // Zone awareness
        const targetInZone = isHexInZone(q, r);
        if (!targetInZone) {
            score -= 200;
        }

        if (score > bestScore) {
            bestScore = score;
            bestHex = { q, r, cost: data.cost };
        }
    });

    if (bestHex) {
        await executeAIMove(unit, bestHex, spectatorMode);
    }
}

/**
 * Select strategic move target with AP budget constraint
 * Now includes FORESHADOWING - evaluates what happens AFTER the move
 */
function selectStrategicMoveTargetWithBudget(unit, plan, maxAP) {
    const reachable = getReachableHexes(unit);
    if (reachable.size === 0) return null;

    // Limit by budget AND remaining shared AP
    const maxCost = Math.min(maxAP, state.sharedAP);
    const candidates = [];
    const enemies = plan.visibleEnemies;

    // Get spotted awareness for this unit
    const spottedInfo = getSpottedAwareness(unit, enemies);

    reachable.forEach((data, key) => {
        if (data.cost > maxCost) return;

        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || hex.unit) return;

        let score = 0;

        if (enemies.length > 0) {
            // Combat mode - position for attack
            score = scoreCombatPositionSafe(unit, q, r, enemies, plan);

            // === FORESHADOWING: What happens after this move? ===
            const foresight = evaluateMoveWithForeshadowing(unit, q, r, data.cost, enemies, maxAP);
            score += foresight.scoreAdjustment;

            // === SPOTTED AWARENESS ===
            if (spottedInfo.isSpotted) {
                // We're spotted - prioritize cover and defensive positions
                if (hex.cover) score += 40; // Extra cover bonus when spotted
                if (spottedInfo.shouldSeekCover && !hex.cover) {
                    score -= 60; // Penalty for exposed positions when we should seek cover
                }
            } else {
                // Not spotted - can be more aggressive, flanking bonus
                if (spottedInfo.canSurpriseAttack && foresight.canAttackAfter) {
                    score += 50; // Surprise attack opportunity!
                }
            }
        } else if (plan.knownEnemyPositions.length > 0) {
            // Hunt mode - move towards last known positions
            score = scoreHuntPosition(unit, q, r, plan);
        } else {
            // Search mode - systematic exploration
            score = scoreSearchPosition(unit, q, r, plan);
        }

        // Universal terrain preferences
        const terrainData = TERRAIN[hex.type];
        if (hex.cover) score += 15;
        score -= terrainData.moveCost * 3;

        // === POWERUP BONUS ===
        // Prioritize positions with powerups
        const powerup = getPowerupAt(q, r);
        if (powerup) {
            // High bonus for powerups, scaled by unit health
            const healthPercent = unit.currentHp / unit.maxHp;
            if (powerup.type === 'health' && healthPercent < 0.7) {
                score += 80;  // Extra bonus for health when damaged
            } else if (powerup.type === 'ap') {
                score += 70;  // AP powerups are valuable
            } else {
                score += 50;  // Other powerups still valuable
            }
        }

        // === ZONE AWARENESS ===
        const unitInZone = isHexInZone(unit.q, unit.r);
        const targetInZone = isHexInZone(q, r);

        if (!unitInZone) {
            if (targetInZone) {
                score += 500;
            } else {
                const currentDistFromCenter = Math.max(Math.abs(unit.q), Math.abs(unit.r), Math.abs(-unit.q - unit.r));
                const targetDistFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
                if (targetDistFromCenter < currentDistFromCenter) {
                    score += 100;
                }
            }
        } else {
            if (!targetInZone) {
                score -= 300;
            } else {
                const distFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
                const distFromEdge = state.zoneRadius - distFromCenter;
                if (distFromEdge <= 2) {
                    score -= 20;
                }
            }
        }

        candidates.push({ q, r, score, cost: data.cost, foresight: enemies.length > 0 ? evaluateMoveWithForeshadowing(unit, q, r, data.cost, enemies, maxAP) : null });
    });

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);

    // Generate AI thought about the chosen move
    const bestMove = candidates[0];
    if (bestMove.foresight && bestMove.foresight.explanation && isSpectatorMode()) {
        const unitName = CLASS_NAMES_DE[unit.class] || unit.class;
        addAIThought(`${unitName}: ${bestMove.foresight.explanation}`, 'move');
    }

    return bestMove;
}

/**
 * Score combat position with STRONG exposure penalty
 * This prevents AI from walking directly in front of enemies
 */
function scoreCombatPositionSafe(unit, q, r, enemies, plan) {
    let score = 0;
    const hex = getHex(q, r);

    // === DECOY STRATEGY POSITIONING ===
    if (plan.decoyActive) {
        if (isDecoyUnit(unit)) {
            return scoreDecoyPosition(unit, q, r, enemies);
        } else if (isAmbushUnit(unit)) {
            return scoreAmbushPosition(unit, q, r, enemies);
        }
    }

    // Get assigned target or closest enemy
    const assignedId = aiMemory.assignedTargets.get(unit.id);
    const primaryTarget = assignedId
        ? enemies.find(e => e.id === assignedId)
        : enemies[0];

    if (primaryTarget) {
        const distToTarget = hexDistance({ q, r }, { q: primaryTarget.q, r: primaryTarget.r });

        // === KLASSENSPEZIFISCHE IDEALE DISTANZ ===
        let idealDist = unit.range;
        let minSafeDist = 1;

        switch (unit.class) {
            case 'sniper':
                idealDist = unit.range;
                minSafeDist = 4;
                break;
            case 'commando':
                idealDist = 1;
                minSafeDist = 1;
                break;
            case 'assault':
                idealDist = 2;
                minSafeDist = 1;
                break;
            case 'scout':
                idealDist = 3;
                minSafeDist = 2;
                break;
            case 'medic':
                idealDist = 4;
                minSafeDist = 3;
                break;
        }

        // Score based on distance to ideal range
        const distDiff = Math.abs(distToTarget - idealDist);
        score -= distDiff * 15;

        // Bonus for being in attack range
        if (distToTarget <= unit.range) {
            score += 60;
            if (distToTarget === idealDist) score += 30;
        }

        // Penalty for being too close (except commando)
        if (distToTarget < minSafeDist) {
            score -= (minSafeDist - distToTarget) * 30;
        }
    }

    // === CRITICAL: EXPOSURE PENALTY ===
    // This is the key fix - heavily penalize exposed positions
    const exposure = calculatePositionExposure(q, r, enemies, unit);

    // Scale penalty based on unit's HP - wounded units are more careful
    const hpRatio = unit.currentHp / unit.maxHp;
    const exposurePenalty = exposure * (hpRatio < 0.5 ? 2.5 : 1.5);

    // Only penalize exposure if we're not in a strong position
    // Assault units can tolerate more exposure
    if (unit.class !== 'assault' && unit.class !== 'commando') {
        score -= exposurePenalty;
    } else {
        score -= exposurePenalty * 0.5;
    }

    // === PREFER POSITIONS WITH COVER ===
    if (hex) {
        if (hex.cover) {
            score += 50; // Increased cover bonus
        }
        if (hex.type === 'hills') {
            score += 30;
        }
    }

    // === PREFER ATTACK POSITIONS WITH ESCAPE ROUTES ===
    // Check if there are safe hexes nearby to retreat to
    const neighbors = getNeighborCoords(q, r);
    let escapeRoutes = 0;
    for (const [nq, nr] of neighbors) {
        const neighborHex = getHex(nq, nr);
        if (neighborHex && !neighborHex.unit && neighborHex.walkable) {
            const neighborExposure = calculatePositionExposure(nq, nr, enemies, unit);
            if (neighborExposure < exposure * 0.7) {
                escapeRoutes++;
            }
        }
    }
    score += escapeRoutes * 10;

    // === MEDIC-SPEZIAL: Nähe zu Verbündeten ===
    // Get ALL allied units (from all allied players) for team coordination
    const allies = getAllAlliedAIUnits().filter(u => u.id !== unit.id);
    if (unit.class === 'medic') {
        for (const ally of allies) {
            const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
            if (distToAlly <= 4) {
                score += 15;
                if (ally.currentHp < ally.maxHp * 0.7) {
                    score += 20;
                }
            }
        }
    }

    // Avoid clustering with allies (spread out) - includes ALL allied players' units
    for (const ally of allies) {
        const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
        if (distToAlly <= 1) score -= 25;  // Stronger penalty for clustering
        else if (distToAlly <= 2) score -= 12;
    }

    // Flanking bonus
    if (primaryTarget && allies.length > 0) {
        const avgAllyAngle = allies.reduce((sum, a) => {
            return sum + Math.atan2(a.r - primaryTarget.r, a.q - primaryTarget.q);
        }, 0) / allies.length;

        const myAngle = Math.atan2(r - primaryTarget.r, q - primaryTarget.q);
        const angleDiff = Math.abs(myAngle - avgAllyAngle);

        const flankBonus = unit.class === 'commando' ? 40 : 25;
        if (angleDiff > Math.PI / 3) score += flankBonus;
    }

    return score;
}

/**
 * Get neighbor coordinates for a hex
 */
function getNeighborCoords(q, r) {
    const directions = [
        [1, 0], [1, -1], [0, -1],
        [-1, 0], [-1, 1], [0, 1]
    ];
    return directions.map(([dq, dr]) => [q + dq, r + dr]);
}

/**
 * Execute decoy unit behavior - lure enemies while staying alive
 */
async function executeDecoyBehavior(unit, plan, renderIfVisible, hasHumanViewer, spectatorMode = false) {
    const enemies = plan.visibleEnemies;
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class;
    const actionDelay = spectatorMode ? 500 : 300;

    // Decoy prioritizes survival - retreat if too damaged
    if (unit.currentHp < unit.maxHp * 0.4) {
        addAIThought(`${unitName} (Köder): Rückzug - zu viel Schaden!`, 'retreat');
        await executeRetreat(unit, enemies, spectatorMode);
        return;
    }

    // 1. Move to lure position FIRST (most important for decoy)
    if (state.sharedAP >= 1) {
        addAIThought(`${unitName} lockt Feinde an...`, 'move');
        const moveTarget = selectStrategicMoveTarget(unit, plan);
        if (moveTarget) {
            await executeAIMove(unit, moveTarget, spectatorMode);
        }
    }

    // 2. Only attack if it's safe (kill shot or enemy is almost dead)
    // WICHTIG: canUnitAttack wird über getAttackableUnits geprüft (MAX_ATTACKS_PER_UNIT: 1)
    const attackable = getAttackableUnits(unit);
    if (attackable.length > 0 && state.sharedAP >= 1 && canUnitAttack(unit)) {
        // Only attack if we can kill or target is nearly dead
        const killableTarget = attackable.find(t => t.currentHp <= unit.damage);
        if (killableTarget) {
            addAIThought(`${unitName}: Gelegenheitsziel!`, 'attack');
            await executeAttackSequence(unit, killableTarget, renderIfVisible, hasHumanViewer, spectatorMode);
        }
    }

    // 3. Use special only defensively (sprint for escape, etc.)
    if (canUseSpecialAbility(unit)) {
        // Scout: Sprint if enemies are close (escape option)
        // Assault: Don't powershot (save HP as bait)
        if (unit.class === 'scout') {
            const closestEnemy = enemies.reduce((min, e) => {
                const d = hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r });
                return d < min ? d : min;
            }, Infinity);
            if (closestEnemy <= 3) {
                addAIThought(`${unitName}: Sprint vorbereitet für Flucht!`, 'special');
                useSpecialAbility(unit);
                renderIfVisible();
                await delay(actionDelay);
            }
        }
    }
}

/**
 * Execute ambush unit behavior - wait in cover, strike hard when enemies engage
 */
async function executeAmbushBehavior(unit, plan, renderIfVisible, hasHumanViewer, spectatorMode = false) {
    const enemies = plan.visibleEnemies;
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class;
    const attackable = getAttackableUnits(unit);
    const actionDelay = spectatorMode ? 500 : 300;

    // 1. Use stealth abilities if available (sniper cloak, commando stealth)
    if (canUseSpecialAbility(unit)) {
        if ((unit.class === 'sniper' || unit.class === 'commando') && !unit.cloaked) {
            addAIThought(`${unitName}: Tarnung für Hinterhalt!`, 'special');
            useSpecialAbility(unit);
            renderIfVisible();
            await delay(actionDelay);
        }
    }

    // 2. Position for ambush if not in attack range
    if (attackable.length === 0 && state.sharedAP >= 1) {
        addAIThought(`${unitName} positioniert sich für Hinterhalt...`, 'move');
        const moveTarget = selectStrategicMoveTarget(unit, plan);
        if (moveTarget) {
            await executeAIMove(unit, moveTarget, spectatorMode);
        }
    }

    // 3. Attack aggressively when in range!
    // WICHTIG: Defensive Prüfung - Einheit darf nur 1x pro Zug treffen (Fehlschüsse zählen nicht)
    const attackableNow = getAttackableUnits(unit);
    if (attackableNow.length > 0 && state.sharedAP >= 1 && canUnitAttack(unit)) {
        // Prioritize enemies that attacked/engaged the decoy
        const target = selectBestTarget(unit, attackableNow);
        if (target) {
            addAIThought(`${unitName}: Hinterhalt! Angriff auf ${CLASS_NAMES_DE[target.class]}!`, 'attack');
            await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
        }
    }

    // 4. Use powershot if assault and in range (uses canUseSpecialAbility which checks for attacks)
    if (canUseSpecialAbility(unit) && unit.class === 'assault') {
        const inRange = enemies.filter(e =>
            hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.range
        );
        if (inRange.length > 0) {
            addAIThought(`${unitName}: Powershot! 💥`, 'special');
            useSpecialAbility(unit);
            renderIfVisible();
            await delay(actionDelay);

            // Attack with powershot bonus
            const targetAfterPowershot = getAttackableUnits(unit);
            if (targetAfterPowershot.length > 0 && state.sharedAP >= 1 && canUnitAttack(unit)) {
                const target = selectBestTarget(unit, targetAfterPowershot);
                if (target) {
                    await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
                }
            }
        }
    }

    // 5. Erneuter Angriff NUR nach Fehlschuss (gleiche Regel wie für Menschen)
    // canUnitAttack() gibt false zurück nach einem erfolgreichen Treffer
    const finalAttackable = getAttackableUnits(unit);
    if (finalAttackable.length > 0 && state.sharedAP >= 1 && canUnitAttack(unit)) {
        const target = selectBestTarget(unit, finalAttackable);
        if (target) {
            await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
        }
    }
}

// German class names for display
const CLASS_NAMES_DE = {
    scout: 'Späher',
    assault: 'Sturmsoldat',
    medic: 'Sanitäter',
    sniper: 'Scharfschütze',
    commando: 'Kommando',
    elitesoldat: 'Kommando-Soldat'
};

/**
 * Execute attack with proper rendering
 * When a human is viewing, scroll to show the attack action
 */
async function executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode = false) {
    // === SICHERHEITSPRÜFUNG: Niemals Verbündete angreifen! ===
    if (arePlayersAllied(unit.player, target.player)) {
        console.error('[AI] BLOCKED: Attempted to attack allied unit!', {
            attacker: unit.id, attackerPlayer: unit.player,
            target: target.id, targetPlayer: target.player
        });
        return; // Angriff abbrechen
    }

    // Generate attack thought for spectator mode
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class;
    const targetName = CLASS_NAMES_DE[target.class] || target.class;
    const canKill = target.currentHp <= unit.damage;

    // Delay multipliers for spectator mode
    const scrollDelay = spectatorMode ? 600 : 400;
    const targetingDelay = spectatorMode ? 500 : 300;
    const afterAttackDelay = spectatorMode ? 700 : 500;
    const shortDelay = spectatorMode ? 250 : 100;

    if (canKill) {
        addAIThought(`${unitName} führt Todesstoß gegen ${targetName} aus!`, 'attack');
    } else {
        const hpPercent = Math.round(target.currentHp / target.maxHp * 100);
        addAIThought(`${unitName} greift ${targetName} an (${hpPercent}% HP)`, 'attack');
    }

    // In spectator mode, scroll to show the attack action with situational zoom
    if (spectatorMode) {
        // Include attacker and nearby units for situational zoom
        const relevantUnits = [unit, ...getRelevantUnitsForZoom(target, state.viewingPlayer)];
        await scrollToUnitWithZoom(target, scrollDelay, null, relevantUnits);
        await delay(200);
    }
    // NOTE: No scrolling in single-player AI turn to prevent revealing enemy positions

    state.targetedUnit = target;
    renderIfVisible();
    await delay(isUnitVisibleToViewer(unit) ? targetingDelay : shortDelay);
    executeAttack(unit, target);
    state.targetedUnit = null;

    // Update memory if enemy killed
    if (!target.alive) {
        addAIThought(`${targetName} eliminiert! ✓`, 'attack');
        aiMemory.lastKnownPositions.delete(target.id);
        aiMemory.assignedTargets.forEach((tid, uid) => {
            if (tid === target.id) aiMemory.assignedTargets.delete(uid);
        });
    }

    if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
        updateUI();
        render();
    }
    await delay(isUnitVisibleToViewer(unit) ? afterAttackDelay : shortDelay);
}

// ===== TACTICAL DECISIONS =====

/**
 * Check if unit is spotted by enemies and should react
 * Returns an object with spotted status and recommended action
 */
function getSpottedAwareness(unit, enemies) {
    const isSpotted = unit.spotted === true;
    const hpPercent = unit.currentHp / unit.maxHp;
    const isStealth = unit.class === 'sniper' || unit.class === 'commando';

    // Find closest enemy
    let closestEnemyDist = Infinity;
    let closestEnemy = null;
    for (const enemy of enemies) {
        const dist = hexDistance({ q: unit.q, r: unit.r }, { q: enemy.q, r: enemy.r });
        if (dist < closestEnemyDist) {
            closestEnemyDist = dist;
            closestEnemy = enemy;
        }
    }

    const result = {
        isSpotted,
        closestEnemyDist,
        closestEnemy,
        shouldSeekCover: false,
        shouldCloak: false,
        canSurpriseAttack: false,
        urgency: 'normal' // 'low', 'normal', 'high', 'critical'
    };

    if (isSpotted) {
        // SPOTTED: React defensively
        if (isStealth && hpPercent < 0.7) {
            result.shouldSeekCover = true;
            result.shouldCloak = true;
            result.urgency = 'high';
        } else if (hpPercent < 0.5) {
            result.shouldSeekCover = true;
            result.urgency = 'critical';
        } else if (closestEnemyDist <= 3 && !unit.cloaked) {
            result.shouldSeekCover = true;
            result.urgency = 'normal';
        }
    } else {
        // NOT SPOTTED: Can be aggressive
        if (isStealth && closestEnemyDist <= unit.range + 2) {
            result.canSurpriseAttack = true;
            result.urgency = 'low'; // No rush, we're hidden
        }
    }

    return result;
}

/**
 * Evaluate a move with foreshadowing - check what happens AFTER moving
 * Returns score adjustment and explanation for AI thoughts
 */
function evaluateMoveWithForeshadowing(unit, targetQ, targetR, moveCost, enemies, remainingAP) {
    const apAfterMove = remainingAP - moveCost;
    const evaluation = {
        canAttackAfter: false,
        canRetreatAfter: false,
        exposedWithoutOptions: false,
        killableTargets: [],
        threatsInRange: [],
        scoreAdjustment: 0,
        explanation: ''
    };

    // Check which enemies we can attack from the new position
    for (const enemy of enemies) {
        const distToEnemy = hexDistance({ q: targetQ, r: targetR }, { q: enemy.q, r: enemy.r });

        // Can we attack this enemy?
        if (distToEnemy <= unit.range) {
            evaluation.canAttackAfter = true;
            if (enemy.currentHp <= unit.damage) {
                evaluation.killableTargets.push(enemy);
            }
        }

        // Can this enemy attack us?
        const enemyRange = enemy.range || 3;
        if (distToEnemy <= enemyRange) {
            evaluation.threatsInRange.push(enemy);
        }
    }

    // CRITICAL: Moving into danger without AP to attack is DUMB
    if (evaluation.threatsInRange.length > 0 && apAfterMove < 1) {
        evaluation.exposedWithoutOptions = true;
        evaluation.scoreAdjustment -= 200; // Heavy penalty!
        evaluation.explanation = `WARNUNG: Keine AP für Gegenangriff nach Bewegung!`;
    }

    // Bonus for kill opportunities
    if (evaluation.killableTargets.length > 0 && apAfterMove >= 1) {
        evaluation.scoreAdjustment += 50 * evaluation.killableTargets.length;
        const targetName = CLASS_NAMES_DE[evaluation.killableTargets[0].class] || evaluation.killableTargets[0].class;
        evaluation.explanation = `Todesstoß möglich gegen ${targetName}!`;
    }

    // Penalty for exposure without attack opportunity
    if (evaluation.threatsInRange.length > 0 && !evaluation.canAttackAfter) {
        evaluation.scoreAdjustment -= 100;
        evaluation.explanation = `Exponiert ohne Angriffsmöglichkeit`;
    }

    // Good: Can attack AND have AP left for emergency
    if (evaluation.canAttackAfter && apAfterMove >= 2) {
        evaluation.scoreAdjustment += 30;
    }

    return evaluation;
}

/**
 * Check if unit should retreat
 * Now includes spotted-awareness
 */
function shouldRetreat(unit, enemies) {
    if (enemies.length === 0) return false;

    const hpPercent = unit.currentHp / unit.maxHp;
    const spottedInfo = getSpottedAwareness(unit, enemies);

    // Medics should retreat earlier (they're valuable)
    if (unit.class === 'medic' && hpPercent < 0.5) return true;

    // Snipers/Commandos: retreat if spotted and damaged
    if ((unit.class === 'sniper' || unit.class === 'commando') && spottedInfo.isSpotted) {
        if (hpPercent < 0.6) return true;
        if (spottedInfo.closestEnemyDist <= 2) return true; // Too close!
    }

    // Snipers shouldn't be in close combat
    if (unit.class === 'sniper') {
        if (spottedInfo.closestEnemyDist <= 2 && hpPercent < 0.6) return true;
    }

    // General retreat threshold
    if (hpPercent < 0.3) return true;

    // Surrounded by multiple enemies
    const nearbyEnemies = enemies.filter(e =>
        hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= 3
    );
    if (nearbyEnemies.length >= 3 && hpPercent < 0.5) return true;

    // NEW: Spotted and wounded = retreat
    if (spottedInfo.isSpotted && spottedInfo.urgency === 'critical') return true;

    return false;
}

/**
 * Execute retreat - move away from enemies
 */
async function executeRetreat(unit, enemies, spectatorMode = false) {
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class;
    const hpPercent = Math.round(unit.currentHp / unit.maxHp * 100);
    addAIThought(`${unitName} zieht sich zurück (${hpPercent}% HP)`, 'retreat');

    const reachable = getReachableHexes(unit);
    if (reachable.size === 0) return;

    // Movement limited by remaining move capacity and shared AP pool
    const maxCost = state.sharedAP;
    let bestHex = null;
    let bestScore = -Infinity;

    reachable.forEach((data, key) => {
        if (data.cost > maxCost) return;

        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || hex.unit) return;

        let score = 0;

        // Maximize distance from enemies
        for (const enemy of enemies) {
            score += hexDistance({ q, r }, { q: enemy.q, r: enemy.r }) * 10;
        }

        // Prefer cover
        if (hex.cover) score += 30;

        // Move towards allies (for protection/healing) - includes ALL allied players
        const allies = getAllAlliedAIUnits().filter(u => u.id !== unit.id);
        if (allies.length > 0) {
            const closestAlly = Math.min(...allies.map(a =>
                hexDistance({ q, r }, { q: a.q, r: a.r })
            ));
            score += (10 - closestAlly) * 5;
        }

        // Zone awareness - don't retreat outside the safe zone!
        const targetInZone = isHexInZone(q, r);
        if (!targetInZone) {
            score -= 200;  // Heavy penalty for retreating outside zone
        }

        if (score > bestScore) {
            bestScore = score;
            bestHex = { q, r, cost: data.cost };
        }
    });

    if (bestHex) {
        await executeAIMove(unit, bestHex, spectatorMode);
    }
}

/**
 * Find all enemies visible to any AI unit
 * Schließt Verbündete aus (nur echte Feinde werden zurückgegeben)
 */
function findAllVisibleEnemies() {
    return state.units.filter(u =>
        u.alive &&
        !arePlayersAllied(state.currentPlayer, u.player) &&
        isUnitVisible(u)
    );
}

/**
 * Select best target considering focus fire assignments
 */
function selectBestTarget(attacker, targets) {
    if (targets.length === 0) return null;

    return targets.sort((a, b) => {
        // Priority 1: Kill shots (finish off low HP)
        const aCanKill = a.currentHp <= attacker.damage;
        const bCanKill = b.currentHp <= attacker.damage;
        if (aCanKill && !bCanKill) return -1;
        if (bCanKill && !aCanKill) return 1;

        // Priority 2: Assigned target
        const assignedId = aiMemory.assignedTargets.get(attacker.id);
        if (a.id === assignedId) return -1;
        if (b.id === assignedId) return 1;

        // Priority 3: Threat level
        const aThreat = aiMemory.threatAssessment.get(a.id) || 50;
        const bThreat = aiMemory.threatAssessment.get(b.id) || 50;
        if (aThreat !== bThreat) return bThreat - aThreat;

        // Priority 4: High value targets (medics)
        if (a.class === 'medic' && b.class !== 'medic') return -1;
        if (b.class === 'medic' && a.class !== 'medic') return 1;

        // Priority 5: Dangerous units (snipers, commandos)
        const dangerClasses = ['sniper', 'commando'];
        const aIsDanger = dangerClasses.includes(a.class);
        const bIsDanger = dangerClasses.includes(b.class);
        if (aIsDanger && !bIsDanger) return -1;
        if (bIsDanger && !aIsDanger) return 1;

        // Priority 6: Lower HP first
        return a.currentHp - b.currentHp;
    })[0];
}

/**
 * Decide if special ability should be used
 * VERBESSERTE KI: Intelligentere Entscheidungen basierend auf Situation
 */
function shouldUseSpecial(unit, enemies, plan) {
    switch (unit.class) {
        case 'medic': {
            // Get ALL allied units (including from allied players) for team healing
            const allies = getAllAlliedAIUnits();
            // Verbesserte Heilreichweite aus config
            const healRange = 4;
            const woundedNearby = allies.filter(a =>
                a.currentHp < a.maxHp * 0.7 &&
                hexDistance({ q: unit.q, r: unit.r }, { q: a.q, r: a.r }) <= healRange
            );
            // Heal if multiple wounded or anyone critically wounded or if self wounded
            const selfWounded = unit.currentHp < unit.maxHp * 0.6;
            return woundedNearby.length >= 2 ||
                   woundedNearby.some(a => a.currentHp < a.maxHp * 0.4) ||
                   (selfWounded && woundedNearby.length >= 1);
        }

        case 'scout':
            // Sprint to close distance, escape, or explore faster
            if (enemies.length > 0) {
                const closestEnemy = Math.min(...enemies.map(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
                ));
                // Sprint zum Angriff wenn Feind in erreichbarer Nähe
                if (closestEnemy > unit.range && closestEnemy <= unit.range + unit.move + 3) {
                    return true;
                }
                // Sprint zur Flucht wenn schwer verletzt
                if (unit.currentHp < unit.maxHp * 0.4 && closestEnemy <= 4) {
                    return true;
                }
            }
            // Sprint während Hunt-Modus für schnellere Aufklärung
            return plan.inHuntMode;

        case 'assault':
            // Powershot auf wichtige Ziele oder wenn Feind in Reichweite
            if (enemies.length > 0) {
                const inRange = enemies.filter(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.range
                );
                // Powershot auf hochwertige Ziele (Medic, Sniper)
                if (inRange.some(e => e.class === 'medic' || e.class === 'sniper')) {
                    return true;
                }
                // Powershot wenn Feind schwach und in Reichweite
                if (inRange.some(e => e.currentHp <= unit.damage + 25)) {
                    return true; // Kann mit Powershot töten
                }
            }
            return false;

        case 'sniper':
            // Cloak nur wenn taktisch sinnvoll
            if (unit.cloaked) return false;
            if (enemies.length > 0) {
                const closestEnemy = Math.min(...enemies.map(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
                ));
                // Tarnung wenn in Gefahr
                if (closestEnemy <= 3) {
                    return true;
                }
                // Tarnung wenn verletzt und Feinde in der Nähe
                if (unit.currentHp < unit.maxHp * 0.5 && closestEnemy <= 5) {
                    return true;
                }
            }
            // Seltener tarnen im Hunt-Modus
            return plan.inHuntMode && Math.random() < 0.2;

        case 'commando':
            // Stealth für Hinterhalt
            if (unit.cloaked) return false;
            if (enemies.length > 0) {
                const closestEnemy = Math.min(...enemies.map(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
                ));
                // Stealth wenn Feind in Angriffsreichweite (kann danach anschleichen)
                if (closestEnemy <= unit.move + 2 && closestEnemy > 1) {
                    return true;
                }
            }
            // Im Hunt-Modus öfter Stealth für Überraschungsangriffe
            return plan.inHuntMode && Math.random() < 0.4;

        case 'elitesoldat':
            // Taktischer Modus wenn Feind in erreichbarer Nähe für Angriff
            if (unit.tacticalMode) return false; // Already activated
            if (enemies.length > 0) {
                const closestEnemy = Math.min(...enemies.map(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
                ));
                // Aktiviere wenn Feind in Reichweite nach Bewegung
                if (closestEnemy <= unit.range + unit.move + 2) {
                    return true;
                }
                // Aktiviere wenn hochwertige Ziele in Nähe (Medic, Sniper)
                const valuableTargets = enemies.filter(e =>
                    (e.class === 'medic' || e.class === 'sniper') &&
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.range + unit.move + 2
                );
                if (valuableTargets.length > 0) {
                    return true;
                }
            }
            return false;

        default:
            return false;
    }
}

/**
 * Select strategic move target based on plan
 */
function selectStrategicMoveTarget(unit, plan) {
    const reachable = getReachableHexes(unit);
    if (reachable.size === 0) return null;

    // Movement limited by remaining move capacity and shared AP pool
    const maxCost = state.sharedAP;
    const candidates = [];
    const enemies = plan.visibleEnemies;

    reachable.forEach((data, key) => {
        if (data.cost > maxCost) return;

        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || hex.unit) return;

        let score = 0;

        if (enemies.length > 0) {
            // Combat mode - position for attack
            score = scoreCombatPosition(unit, q, r, enemies, plan);
        } else if (plan.knownEnemyPositions.length > 0) {
            // Hunt mode - move towards last known positions
            score = scoreHuntPosition(unit, q, r, plan);
        } else {
            // Search mode - systematic exploration
            score = scoreSearchPosition(unit, q, r, plan);
        }

        // Universal terrain preferences
        const terrainData = TERRAIN[hex.type];
        if (hex.cover) score += 15;
        score -= terrainData.moveCost * 3;

        // === POWERUP BONUS ===
        // Prioritize positions with powerups
        const powerup = getPowerupAt(q, r);
        if (powerup) {
            // High bonus for powerups, scaled by unit health
            const healthPercent = unit.currentHp / unit.maxHp;
            if (powerup.type === 'health' && healthPercent < 0.7) {
                score += 80;  // Extra bonus for health when damaged
            } else if (powerup.type === 'ap') {
                score += 70;  // AP powerups are valuable
            } else {
                score += 50;  // Other powerups still valuable
            }
        }

        // === ZONE AWARENESS ===
        const unitInZone = isHexInZone(unit.q, unit.r);
        const targetInZone = isHexInZone(q, r);

        if (!unitInZone) {
            // Unit is OUTSIDE zone - high priority to get back in!
            if (targetInZone) {
                score += 500;  // Massive bonus for getting into safe zone
            } else {
                // At least move toward center
                const currentDistFromCenter = Math.max(Math.abs(unit.q), Math.abs(unit.r), Math.abs(-unit.q - unit.r));
                const targetDistFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
                if (targetDistFromCenter < currentDistFromCenter) {
                    score += 100;  // Bonus for moving toward center
                }
            }
        } else {
            // Unit is inside zone - avoid moving outside
            if (!targetInZone) {
                score -= 300;  // Heavy penalty for leaving safe zone
            } else {
                // Stay away from zone edge if zone is shrinking
                const distFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
                const distFromEdge = state.zoneRadius - distFromCenter;
                if (distFromEdge <= 2) {
                    score -= 20;  // Small penalty for being near edge
                }
            }
        }

        candidates.push({ q, r, score, cost: data.cost });
    });

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
}

/**
 * Score position for combat situations
 * VERBESSERTE KI: Klassenspezifische Positionierung
 */
function scoreCombatPosition(unit, q, r, enemies, plan) {
    let score = 0;
    const hex = getHex(q, r);

    // === DECOY STRATEGY POSITIONING ===
    if (plan.decoyActive) {
        if (isDecoyUnit(unit)) {
            // Decoy moves TOWARD enemies to lure them
            return scoreDecoyPosition(unit, q, r, enemies);
        } else if (isAmbushUnit(unit)) {
            // Ambush units stay in cover, flank position
            return scoreAmbushPosition(unit, q, r, enemies);
        }
    }

    // Get assigned target or closest enemy
    const assignedId = aiMemory.assignedTargets.get(unit.id);
    const primaryTarget = assignedId
        ? enemies.find(e => e.id === assignedId)
        : enemies[0];

    if (primaryTarget) {
        const distToTarget = hexDistance({ q, r }, { q: primaryTarget.q, r: primaryTarget.r });

        // === KLASSENSPEZIFISCHE IDEALE DISTANZ ===
        let idealDist = unit.range;
        let minDist = 1;
        let maxDist = unit.range;

        switch (unit.class) {
            case 'sniper':
                // Sniper will auf maximaler Distanz bleiben
                idealDist = unit.range;
                minDist = 4; // Nicht zu nah
                maxDist = unit.range;
                break;
            case 'commando':
                // Commando will in Nahkampfreichweite
                idealDist = 1;
                minDist = 1;
                maxDist = 2;
                break;
            case 'assault':
                // Assault als Tank in mittlerer Distanz
                idealDist = 2;
                minDist = 1;
                maxDist = unit.range;
                break;
            case 'scout':
                // Scout flexibel, bevorzugt aber etwas Abstand
                idealDist = 3;
                minDist = 2;
                maxDist = unit.range;
                break;
            case 'medic':
                // Medic hält sich zurück, aber in Heilreichweite zu Verbündeten
                idealDist = 4;
                minDist = 3;
                maxDist = 5;
                break;
        }

        // Score based on distance to ideal range
        const distDiff = Math.abs(distToTarget - idealDist);
        score -= distDiff * 15;

        // Penalty für zu nah (außer Commando)
        if (distToTarget < minDist) {
            score -= (minDist - distToTarget) * 30;
        }

        // Penalty für zu weit
        if (distToTarget > maxDist) {
            score -= (distToTarget - maxDist) * 20;
        }

        // Bonus for being in attack range
        if (distToTarget <= unit.range) {
            score += 60;

            // Extra bonus for optimal range
            if (distToTarget === idealDist) score += 30;
        }
    }

    // === KLASSENSPEZIFISCHE TERRAIN-PRÄFERENZEN ===
    if (hex) {
        switch (unit.class) {
            case 'sniper':
                // Sniper bevorzugt Hügel (Sichtbonus) und Deckung
                if (hex.type === 'hills') score += 50;
                if (hex.cover) score += 30;
                break;
            case 'commando':
                // Commando bevorzugt Deckung für Hinterhalte
                if (hex.cover) score += 40;
                // Aber auch freie Sicht zum Ziel
                break;
            case 'assault':
                // Assault ist robust, bevorzugt aber leichte Deckung
                if (hex.cover) score += 15;
                break;
            case 'scout':
                // Scout bevorzugt Hügel für Aufklärung
                if (hex.type === 'hills') score += 30;
                break;
            case 'medic':
                // Medic bevorzugt sichere Positionen
                if (hex.cover) score += 40;
                if (hex.type === 'hills') score += 20;
                break;
        }
    }

    // Flanking bonus - attack from different angle than allies (includes ALL allied players)
    const allies = getAllAlliedAIUnits().filter(u => u.id !== unit.id);
    if (primaryTarget && allies.length > 0) {
        const avgAllyAngle = allies.reduce((sum, a) => {
            return sum + Math.atan2(a.r - primaryTarget.r, a.q - primaryTarget.q);
        }, 0) / allies.length;

        const myAngle = Math.atan2(r - primaryTarget.r, q - primaryTarget.q);
        const angleDiff = Math.abs(myAngle - avgAllyAngle);

        // Commando bekommt größeren Flanking-Bonus
        const flankBonus = unit.class === 'commando' ? 40 : 25;
        if (angleDiff > Math.PI / 3) score += flankBonus;
    }

    // === MEDIC-SPEZIAL: Nähe zu Verbündeten ===
    if (unit.class === 'medic') {
        for (const ally of allies) {
            const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
            // Medic will in Heilreichweite sein
            if (distToAlly <= 4) {
                score += 15;
                // Bonus wenn Verbündeter verletzt
                if (ally.currentHp < ally.maxHp * 0.7) {
                    score += 20;
                }
            }
        }
    }

    // Avoid clustering with allies (spread out)
    for (const ally of allies) {
        const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
        if (distToAlly <= 1) score -= 20;
        else if (distToAlly <= 2) score -= 10;
    }

    return score;
}

/**
 * Score position for hunting known enemy positions
 */
function scoreHuntPosition(unit, q, r, plan) {
    let score = 0;

    // Move towards highest confidence last known position
    const positions = plan.knownEnemyPositions
        .sort((a, b) => b.confidence - a.confidence);

    if (positions.length > 0) {
        const target = positions[0];
        const dist = hexDistance({ q, r }, { q: target.q, r: target.r });

        // Closer is better, but not too close (might be ambush)
        if (dist <= 3) {
            score += (10 - dist) * 20;
        } else {
            score -= dist * 5;
        }
    }

    // Also consider estimated player center
    if (aiMemory.playerCenterEstimate) {
        const distToCenter = hexDistance({ q, r }, aiMemory.playerCenterEstimate);
        score -= distToCenter * 3;
    }

    // Prefer high ground for vision
    const hex = getHex(q, r);
    if (hex && hex.type === 'hills') {
        score += 30;
    }

    return score;
}

/**
 * Score position for systematic search
 * IMPROVED: Zone-aware - don't search outside shrinking zone or towards edges
 */
function scoreSearchPosition(unit, q, r, plan) {
    let score = 0;
    const hexKey = `${q},${r}`;

    // === CRITICAL: ZONE AWARENESS FOR SEARCH ===
    // Don't waste time searching areas outside the zone or near the edge
    const targetInZone = isHexInZone(q, r);
    if (!targetInZone) {
        // Position is outside zone - enemies can't be there (they'd take damage)
        score -= 500; // Heavy penalty - searching here is pointless
        return score; // Early return - no point calculating more
    }

    // Calculate distance from zone center (0,0) and zone edge
    const distFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
    const distFromZoneEdge = state.zoneRadius - distFromCenter;

    // Penalty for being near zone edge - enemies are unlikely to be there
    if (distFromZoneEdge <= 2) {
        score -= 40; // Edge of zone - enemies probably moved inward
    } else if (distFromZoneEdge <= 4) {
        score -= 15; // Near edge
    }

    // Exploration bonuses
    const aiExplored = state.playerExploredHexes[state.currentPlayer];
    if (!aiExplored || !aiExplored.has(hexKey)) {
        score += 40;  // Big bonus for unexplored territory
    }

    // Recently searched penalty
    if (aiMemory.searchedAreas.has(hexKey)) {
        score -= 30;
    }

    // Enemy spawn centers - but ONLY if they're still in the zone!
    const enemySpawnCenters = getEnemySpawnCenters();
    if (enemySpawnCenters.length > 0) {
        // Filter spawn centers to only those still in the zone
        const validSpawnCenters = enemySpawnCenters.filter(pos => isHexInZone(pos.q, pos.r));

        if (validSpawnCenters.length > 0) {
            const radius = CONFIG.MAP_SIZES[state.settings.size];
            const minSpawnDist = Math.min(...validSpawnCenters.map(pos =>
                hexDistance({ q, r }, pos)
            ));
            const spawnWeight = Math.max(0, radius - minSpawnDist);
            score += spawnWeight * (plan.inHuntMode ? 3 : 2);
        }
    }

    // Search pattern specific scoring - ZONE-AWARE
    switch (plan.searchPattern) {
        case 'expand': {
            // CHANGED: Don't expand toward edges - expand toward unexplored areas WITHIN zone
            // Move toward center of zone if zone is shrinking, otherwise explore
            if (state.zoneRadius < CONFIG.MAP_SIZES[state.settings.size]) {
                // Zone is shrinking - move toward center, not edges
                const currentDistFromCenter = Math.max(Math.abs(unit.q), Math.abs(unit.r), Math.abs(-unit.q - unit.r));
                if (distFromCenter < currentDistFromCenter) {
                    score += 20; // Moving toward center is good
                }
            } else {
                // Zone not shrinking yet - can explore outward but stay in zone
                const distFromStart = Math.sqrt(q * q + r * r);
                const currentDist = Math.sqrt(unit.q * unit.q + unit.r * unit.r);
                if (distFromStart > currentDist && distFromZoneEdge > 3) {
                    score += 15;
                }
            }
            break;
        }

        case 'sweep': {
            // Move in coordinated line (with ALL allied units) - but toward zone center
            const allies = getAllAlliedAIUnits();
            const avgAllyR = allies.reduce((sum, u) => sum + u.r, 0) / allies.length;
            // Stay roughly aligned with allies
            score -= Math.abs(r - avgAllyR) * 5;
            // Push toward center, not just "forward"
            score -= distFromCenter * 2;
            break;
        }

        case 'pincer': {
            // Move to flank estimated enemy position
            if (aiMemory.playerCenterEstimate) {
                const estPos = aiMemory.playerCenterEstimate;
                // Only consider estimate if it's in the zone
                if (isHexInZone(Math.round(estPos.q), Math.round(estPos.r))) {
                    const distToEst = hexDistance({ q, r }, estPos);
                    // Get closer but approach from sides
                    if (distToEst > 2) {
                        score -= distToEst * 3;
                    }
                    // Bonus for being at angles
                    const angle = Math.atan2(r - estPos.r, q - estPos.q);
                    const unitIndex = getPlayerUnits(unit.player).indexOf(unit);
                    const targetAngle = (unitIndex / getPlayerUnits(unit.player).length) * 2 * Math.PI;
                    const angleDiff = Math.abs(angle - targetAngle);
                    score += (Math.PI - angleDiff) * 10;
                }
            }
            break;
        }
    }

    // Move towards map center (higher chance of finding enemies)
    // IMPROVED: Weight this more heavily when zone is shrinking
    const zoneShrinkFactor = state.zoneRadius < CONFIG.MAP_SIZES[state.settings.size] ? 2 : 1;
    score -= distFromCenter * (plan.inHuntMode ? 3 : 2) * zoneShrinkFactor;

    // Hills for vision
    const hex = getHex(q, r);
    if (hex && hex.type === 'hills') {
        // Extra value for scouts and snipers
        const visionBonus = (unit.class === 'scout' || unit.class === 'sniper') ? 40 : 20;
        score += visionBonus;
    }

    // Small random factor
    score += Math.random() * 8;

    return score;
}

function handleAIPowerupPickup(unit, hasHumanViewer) {
    const pickup = checkPowerupPickup(unit);
    if (pickup && hasHumanViewer) {
        showPowerupPickup(pickup.powerup, pickup.result);
    }
    return pickup;
}

// ===== MOVEMENT EXECUTION =====

/**
 * Execute AI movement with step-by-step animation
 * When a human is viewing, animate visible movements so they can follow
 * @param {Object} unit - The unit to move
 * @param {Object} target - Target hex with q, r, cost
 * @param {boolean} spectatorMode - Whether in spectator mode (slower pacing)
 */
async function executeAIMove(unit, target, spectatorMode = false) {
    const targetHex = getHex(target.q, target.r);
    if (!targetHex) return;

    const hasHumanViewer = spectatorMode || !isAIPlayer(state.viewingPlayer);
    const wasVisible = isUnitVisibleToViewer(unit);

    const processReactiveFire = async () => {
        if (!unit.alive) return false;

        const ambushTriggers = checkAmbushTriggers(unit);
        for (const trigger of ambushTriggers) {
            if (!unit.alive) break;
            await executeAmbushAttack(trigger.ambusher, unit);
            render();
            if (!unit.alive) {
                return false;
            }
        }

        const overwatchTriggers = checkOverwatchTriggers(unit);
        for (const trigger of overwatchTriggers) {
            if (!unit.alive) break;
            await executeOverwatchAttack(trigger.watcher, unit);
            render();
            if (!unit.alive) {
                return false;
            }
        }

        return unit.alive;
    };

    // Get the path from unit's current position to target
    const pathResult = findPath(unit.q, unit.r, target.q, target.r, target.cost + 2);

    if (!pathResult || !pathResult.path || pathResult.path.length < 2) {
        // No valid path found - fall back to instant teleport
        const oldHex = getHex(unit.q, unit.r);
        if (oldHex) oldHex.unit = null;

        unit.q = target.q;
        unit.r = target.r;
        targetHex.unit = unit;

        handleAIPowerupPickup(unit, hasHumanViewer);
        spendSharedAP(target.cost);
        updateVisibility();
        if (hasHumanViewer) {
            updateVisibilityForPlayer(state.viewingPlayer);
        }
        render();
        updateUI();
        return;
    }

    const path = pathResult.path;
    // Spectator mode: slower step delay so viewer can follow the movement
    const stepDelay = spectatorMode ? 200 : 120;
    const scrollDuration = spectatorMode ? 400 : 200;

    // If in spectator mode, scroll to unit first
    if (spectatorMode) {
        // Situational zoom based on unit and nearby enemies/allies
        const relevantUnits = getRelevantUnitsForZoom(unit, state.viewingPlayer);
        await scrollToUnitWithZoom(unit, scrollDuration, null, relevantUnits);
    }
    // NOTE: No scrolling in single-player AI turn to prevent revealing enemy positions

    // Animate step by step
    let unitBecameVisible = false;
    for (let i = 1; i < path.length; i++) {
        const nextPos = path[i];
        const nextHex = getHex(nextPos.q, nextPos.r);

        if (!nextHex) continue;

        // Move unit one step
        moveUnitInstant(unit, nextHex);

        handleAIPowerupPickup(unit, hasHumanViewer);

        // Update visibility after each step
        updateVisibility();
        if (hasHumanViewer) {
            updateVisibilityForPlayer(state.viewingPlayer);
        }

        const isNowVisible = isUnitVisibleToViewer(unit);

        // Check if unit just became visible
        if (hasHumanViewer && isNowVisible && !unitBecameVisible) {
            unitBecameVisible = true;
            // In spectator mode, scroll to show the newly visible enemy
            if (spectatorMode) {
                const relevantUnits = getRelevantUnitsForZoom(unit, state.viewingPlayer);
                await scrollToUnitWithZoom(unit, 400, null, relevantUnits);
            }
            // NOTE: No scrolling in single-player AI turn to prevent revealing enemy positions
        }

        // Only follow unit in spectator mode to prevent revealing enemy positions
        if (spectatorMode) {
            followUnitInstant(unit);
        }

        // In spectator mode or when unit is visible, render each step
        if (spectatorMode || !hasHumanViewer || isNowVisible) {
            render();
            await delay(stepDelay);
        }

        const shouldContinue = await processReactiveFire();
        if (!shouldContinue) {
            break;
        }
    }

    // Spend from shared pool after animation completes
    spendSharedAP(target.cost);

    // Mark this area as searched
    aiMemory.searchedAreas.add(`${target.q},${target.r}`);

    // Clear old searched areas (keep last 20)
    if (aiMemory.searchedAreas.size > 20) {
        const first = aiMemory.searchedAreas.values().next().value;
        aiMemory.searchedAreas.delete(first);
    }

    // Final update
    if (spectatorMode || !hasHumanViewer || wasVisible || unitBecameVisible) {
        updateUI();
        render();
    }
}

/**
 * Consider using tactical abilities (Suppression, Overwatch)
 * Called after main actions when unit has AP remaining
 */
async function considerTacticalAbilities(unit, enemies, plan, context) {
    const { canSpendAP, trackAPSpent, hasHumanViewer, spectatorMode, actionDelayBase, shortDelay } = context;

    // === UNTERDRÜCKUNGSFEUER (SUPPRESSION) ===
    // Best used by Assault/Sniper when enemies are in predictable positions
    if (canSpendAP(2) && canUseSuppression(unit)) {
        const suppressTarget = selectSuppressionTarget(unit, enemies, plan);
        if (suppressTarget) {
            const unitName = CLASS_NAMES_DE[unit.class] || unit.class;
            addAIThought(`${unitName}: Unterdrückungsfeuer auf strategische Position! 🔥`, 'strategy');

            useSuppression(unit, suppressTarget.q, suppressTarget.r);
            trackAPSpent(2);

            if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                updateUI();
                render();
            }
            await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
            return; // Don't also use overwatch in same turn
        }
    }

    // === OVERWATCH (DECKUNGSFEUER) ===
    // Best used when in defensive position and expecting enemy movement
    if (canSpendAP(2) && canUseOverwatch(unit)) {
        const shouldUseOverwatch = evaluateOverwatchValue(unit, enemies, plan);
        if (shouldUseOverwatch) {
            const unitName = CLASS_NAMES_DE[unit.class] || unit.class;
            addAIThought(`${unitName}: Overwatch aktiviert - bereit für Feindkontakt! 👁️`, 'strategy');

            activateOverwatch(unit);
            trackAPSpent(2);

            if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                updateUI();
                render();
            }
            await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
        }
    }
}

/**
 * Select best target hex for suppression
 * Looks for strategic positions enemies might move through
 */
function selectSuppressionTarget(unit, enemies, plan) {
    if (enemies.length === 0) return null;

    let bestTarget = null;
    let bestScore = 0;

    // Check hexes within range for good suppression targets
    for (const enemy of enemies) {
        const distToEnemy = hexDistance(
            { q: unit.q, r: unit.r },
            { q: enemy.q, r: enemy.r }
        );

        // Focus on hexes the enemy might move through
        const targetHexes = getNeighborHexes(enemy.q, enemy.r);
        targetHexes.push({ q: enemy.q, r: enemy.r }); // Also consider enemy's current position

        for (const targetHex of targetHexes) {
            const dist = hexDistance(
                { q: unit.q, r: unit.r },
                { q: targetHex.q, r: targetHex.r }
            );

            // Must be within attack range
            if (dist > unit.range || dist === 0) continue;

            const hex = getHex(targetHex.q, targetHex.r);
            if (!hex || !hex.walkable) continue;

            let score = 0;

            // Higher score for enemy's current position
            if (targetHex.q === enemy.q && targetHex.r === enemy.r) {
                score += 50;
                // Even higher if enemy is dangerous
                if (['sniper', 'assault'].includes(enemy.class)) {
                    score += 30;
                }
            }

            // Score based on how many enemies are near this hex
            for (const e of enemies) {
                const eDist = hexDistance(
                    { q: e.q, r: e.r },
                    { q: targetHex.q, r: targetHex.r }
                );
                if (eDist <= 2) score += 20;
            }

            // Chokepoints and cover hexes are better suppression targets
            if (hex.cover) score += 15;

            // High-traffic areas (between enemies and our units)
            const allies = getPlayerUnits(unit.player).filter(u => u.alive && u.id !== unit.id);
            for (const ally of allies) {
                const distToAlly = hexDistance(
                    { q: ally.q, r: ally.r },
                    { q: targetHex.q, r: targetHex.r }
                );
                // If hex is between enemy and ally, it's a good chokepoint
                if (distToAlly < distToEnemy) {
                    score += 10;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestTarget = targetHex;
            }
        }
    }

    // Only use suppression if we found a good target
    return bestScore >= 30 ? bestTarget : null;
}

/**
 * Get neighboring hexes for a position
 */
function getNeighborHexes(q, r) {
    const directions = [
        { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
        { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    return directions.map(d => ({ q: q + d.q, r: r + d.r }));
}

/**
 * Evaluate if overwatch is a good use of AP
 * Returns true if unit should activate overwatch
 */
function evaluateOverwatchValue(unit, enemies, plan) {
    // Don't use overwatch if no enemies visible and not in defensive mode
    if (enemies.length === 0 && !plan.inHuntMode) return false;

    let value = 0;

    // Good defensive position (cover) increases overwatch value
    const hex = getHex(unit.q, unit.r);
    if (hex && hex.cover) value += 20;
    if (hex && hex.type === 'hills') value += 15;

    // More enemies nearby = higher value
    for (const enemy of enemies) {
        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: enemy.q, r: enemy.r }
        );

        // Enemies in attack range are good overwatch targets
        if (dist <= unit.range) {
            value += 25;
        } else if (dist <= unit.range + 3) {
            // Enemies might move into range
            value += 15;
        }
    }

    // Snipers benefit more from overwatch (long range)
    if (unit.class === 'sniper') value += 20;

    // Less value if unit is low on HP (might be attacked)
    if (unit.currentHp < unit.maxHp * 0.4) {
        value -= 30;
    }

    // In hunt mode, overwatch is useful for ambushes
    if (plan.inHuntMode) {
        value += 10;
    }

    // Use overwatch if value is high enough
    return value >= 35;
}

/**
 * Utility: delay helper
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
