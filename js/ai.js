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
import { updateVisibility, updateVisibilityForPlayer, isUnitVisible, isUnitVisibleToViewer, isUnitVisibleToPlayer } from './fogOfWar.js';
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
    displayTime: 3500,      // How long each thought is displayed (ms) - länger für bessere Lesbarkeit
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
 * Display a thought in the UI (clean subtitle style, no icons)
 */
function displayThought(thought) {
    const existing = document.querySelector('.ai-thought-bubble');
    if (existing) existing.remove();

    const bubble = document.createElement('div');
    bubble.className = 'ai-thought-bubble';
    bubble.innerHTML = `<span class="thought-text">${thought.text}</span>`;
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
 * Add a multi-part thought (splits long text into readable segments)
 * Each segment is shown sequentially with proper timing
 */
function addMultiPartThought(parts, category = 'general') {
    if (!isSpectatorMode()) return;

    // Filter out empty parts and add each as a separate thought
    const validParts = parts.filter(p => p && p.trim());
    validParts.forEach(part => {
        addAIThought(part.trim(), category);
    });
}

/**
 * Generate varied phrasing for common situations
 * Returns a randomly selected phrase from the options
 */
function variedPhrase(options) {
    return options[Math.floor(Math.random() * options.length)];
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
        lastKnownPositions: new Map(),  // unitId -> { q, r, round, confidence, direction, hp }
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
        // === ERWEITERTES ERINNERUNGSSYSTEM ===
        attackHistory: new Map(),        // unitId -> [{ fromQ, fromR, round, attackerClass }] - Woher kamen Angriffe
        movementHistory: new Map(),      // unitId -> [{ fromQ, fromR, toQ, toR, round }] - Letzte Bewegungen
        predictedPositions: new Map(),   // unitId -> { q, r, confidence } - Vorhergesagte nächste Position
        flankingTargets: new Map(),      // unitId -> { targetId, flankDirection } - Einkreisungs-Zuweisung
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
 * SICHERHEIT ZUERST: Nur Units mit hoher HP und Überlebensfähigkeit
 * Prefer: Assault (tanky, 100 HP), Scout (nur mit Sprint verfügbar)
 */
function findDecoyCandidate(aiUnits) {
    // Assault ist die erste Wahl wegen hoher HP (100)
    const assault = aiUnits.find(u =>
        u.class === 'assault' &&
        u.currentHp > u.maxHp * 0.7 && // Braucht mindestens 70% HP für Sicherheit
        u.alive
    );
    if (assault) return assault;

    // Scout nur wenn Sprint noch verfügbar ist (für Fluchtmöglichkeit)
    const scout = aiUnits.find(u =>
        u.class === 'scout' &&
        u.currentHp > u.maxHp * 0.7 &&
        u.alive &&
        !u.usedSpecial // Sprint muss noch verfügbar sein!
    );
    if (scout) return scout;

    // Kein geeigneter Köder gefunden - Sicherheit geht vor
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

    addMultiPartThought([
        `Wir starten eine sichere Köder-Taktik.`,
        `Der ${CLASS_NAMES_DE[decoy.class]} lockt Feinde an, bleibt aber außerhalb der Angriffsreichweite.`,
        `Die Hinterhalts-Einheiten warten auf den perfekten Moment zum Zuschlagen.`
    ], 'strategy');

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
 * Score position for decoy unit - lure enemies while STAYING SAFE
 * SICHERHEIT ZUERST: Köder soll überleben, nicht geopfert werden!
 * Ideal: AUSSERHALB der Feindreichweite, aber sichtbar und verlockend
 */
function scoreDecoyPosition(unit, q, r, enemies) {
    let score = 0;
    const hex = getHex(q, r);

    if (!hex) return -1000;

    // Find closest enemy and calculate threat
    let closestEnemy = null;
    let closestDist = Infinity;
    let totalThreat = 0;

    for (const enemy of enemies) {
        const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
        if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = enemy;
        }
        // Berechne Bedrohung: Feinde die uns erreichen können
        const enemyRange = enemy.range || 3;
        if (dist <= enemyRange) {
            totalThreat += enemy.damage;
        }
    }

    // === SICHERHEITS-BEWERTUNG (HÖCHSTE PRIORITÄT) ===
    // VERMEIDE Positionen wo wir von mehreren Feinden angegriffen werden können
    if (totalThreat > unit.currentHp * 0.5) {
        score -= 300; // Zu gefährlich! Mehrere Feinde könnten uns erledigen
    } else if (totalThreat > 0) {
        score -= totalThreat * 2; // Leichte Strafe für jede Bedrohung
    }

    if (closestEnemy) {
        const enemyRange = closestEnemy.range || 3;

        // === SICHERE KÖDER-POSITION ===
        // Ideal: KNAPP AUSSERHALB der Feindreichweite (sie müssen sich bewegen um anzugreifen)
        if (closestDist === enemyRange + 1) {
            // PERFEKT: Knapp außerhalb - Feind muss sich bewegen, wir sind sicher
            score += 120;
        } else if (closestDist === enemyRange + 2) {
            // Gut: Etwas weiter weg, aber immer noch verlockend
            score += 80;
        } else if (closestDist === enemyRange) {
            // GEFÄHRLICH: Gerade noch in Reichweite - nur wenn Deckung vorhanden
            if (hex.cover) {
                score += 40; // Mit Deckung akzeptabel
            } else {
                score -= 50; // Ohne Deckung zu riskant
            }
        } else if (closestDist < enemyRange) {
            // ZU NAH: Stark bestraft - der Köder soll überleben!
            score -= 150;
        } else if (closestDist > enemyRange + 3) {
            // Zu weit - nicht effektiv als Köder
            score -= closestDist * 3;
        }
    }

    // === FLUCHTWEG-BEWERTUNG ===
    // Köder MUSS einen sicheren Rückzugsweg zu Verbündeten haben
    const ambushUnits = getPlayerUnits(unit.player).filter(u => isAmbushUnit(u));
    if (ambushUnits.length > 0) {
        const avgAmbushDist = ambushUnits.reduce((sum, a) =>
            sum + hexDistance({ q, r }, { q: a.q, r: a.r }), 0
        ) / ambushUnits.length;

        // Köder sollte 3-5 Felder von Verstärkung entfernt sein
        if (avgAmbushDist >= 3 && avgAmbushDist <= 5) {
            score += 50; // Ideale Fluchtdistanz - nah genug für Unterstützung
        } else if (avgAmbushDist <= 2) {
            score += 30; // Sehr nah - gut für Sicherheit
        } else if (avgAmbushDist > 6) {
            score -= 60; // ZU WEIT von Verstärkung - gefährlich!
        }
    } else {
        // Ohne Hinterhalts-Einheiten ist die Position sehr riskant
        score -= 100;
    }

    // === DECKUNG IST WICHTIG ===
    if (hex.cover) {
        score += 40; // Deckung ist jetzt viel wichtiger
    }
    if (hex.type === 'hills') {
        score += 20; // Hügel geben Überblick und defensive Vorteile
    }

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

    // Check for allied AI coordination
    const alliedAIPlayers = [];
    for (let p = 0; p < state.settings.players; p++) {
        if (p !== state.currentPlayer && isAIPlayer(p) && arePlayersAllied(state.currentPlayer, p)) {
            alliedAIPlayers.push(p);
        }
    }

    // Announce allied coordination at start of turn
    if (alliedAIPlayers.length > 0 && visibleEnemies.length > 0) {
        const allyNames = alliedAIPlayers.map(p => getPlayerName(p)).join(' & ');
        const totalAlliedUnits = allAlliedUnits.length;
        addAIThought(`🤝 Koordination mit ${allyNames}! ${totalAlliedUnits} Einheiten arbeiten zusammen.`, 'strategy');

        // Check which enemies are only visible through ally shared vision
        const enemiesFromAllies = visibleEnemies.filter(e => {
            // Not visible to current player but visible to an ally
            if (isUnitVisibleToPlayer(e, state.currentPlayer)) return false;
            for (const allyPlayer of alliedAIPlayers) {
                if (isUnitVisibleToPlayer(e, allyPlayer)) return true;
            }
            return false;
        });

        if (enemiesFromAllies.length > 0) {
            const enemyNames = enemiesFromAllies.map(e => CLASS_NAMES_DE[e.class] || e.class || 'Feind');
            const uniqueNames = [...new Set(enemyNames)].join(', ');
            addAIThought(`📡 Verbündete melden Feindkontakt: ${uniqueNames}! Position wird geteilt.`, 'strategy');
        }
    }

    // Update AI memory with visible enemies
    updateMemoryWithVisibleEnemies(visibleEnemies);

    // Learn from ghost indicators (where cloaked enemies attacked from)
    learnFromGhostIndicators();

    // Calculate threat assessment
    updateThreatAssessment(visibleEnemies);

    // Estimate player position if no enemies visible
    if (visibleEnemies.length === 0) {
        estimatePlayerPosition();
        addAIThought(variedPhrase([
            'Keine Feinde in Sicht. Wir schwärmen aus, um das Gelände aufzuklären.',
            'Der Feind versteckt sich. Zeit, systematisch zu suchen.',
            'Kein Sichtkontakt. Wir verteilen uns zur Aufklärung.'
        ]), 'strategy');
    } else {
        aiMemory.lastContactRound = state.round;
        aiMemory.huntMode = false;
        // Detailliertere Feindanalyse
        const enemyClasses = visibleEnemies.map(e => CLASS_NAMES_DE[e.class] || e.class || 'Unbekannt');
        const uniqueClasses = [...new Set(enemyClasses)];
        const woundedEnemies = visibleEnemies.filter(e => e.currentHp < e.maxHp);

        if (visibleEnemies.length === 1) {
            const hpInfo = woundedEnemies.length > 0 ? ` Der Gegner ist verwundet.` : '';
            addAIThought(`Feindkontakt! Ein ${uniqueClasses[0]} wurde entdeckt.${hpInfo}`, 'strategy');
        } else if (visibleEnemies.length <= 3) {
            const woundedInfo = woundedEnemies.length > 0 ? ` Davon ${woundedEnemies.length} verwundet.` : '';
            addAIThought(`${visibleEnemies.length} Gegner gesichtet: ${uniqueClasses.join(', ')}.${woundedInfo}`, 'strategy');
        } else {
            addAIThought(`Starke Feindpräsenz! ${visibleEnemies.length} Gegner in Sichtweite. Vorsicht geboten.`, 'strategy');
        }
    }

    // Enter hunt mode faster - after just 1 round without contact
    // Also count total remaining enemies for endgame aggression
    const totalEnemiesOnMap = state.units.filter(u =>
        u.alive && !arePlayersAllied(state.currentPlayer, u.player)
    ).length;

    // Endgame mode: Very few enemies left - be extremely aggressive
    const isEndgame = totalEnemiesOnMap <= 2 && totalEnemiesOnMap > 0;

    if (state.round - aiMemory.lastContactRound >= 1) {
        aiMemory.huntMode = true;
        if (isEndgame) {
            addAIThought(variedPhrase([
                `Nur noch ${totalEnemiesOnMap} Feind${totalEnemiesOnMap > 1 ? 'e' : ''} übrig! Alle Einheiten: Aufspüren und eliminieren!`,
                `Endspiel! Der letzte Widerstand muss gebrochen werden. Voller Angriff!`,
                `Fast geschafft! Wir jagen die letzten Überlebenden.`
            ]), 'strategy');
        } else {
            addAIThought(variedPhrase([
                'Kein Sichtkontakt. Jagdmodus aktiviert - wir schwärmen aus.',
                'Der Feind versteckt sich. Alle Einheiten: Aktiv suchen!',
                'Zeit zu jagen. Wir verteilen uns und finden sie.'
            ]), 'strategy');
        }
    }

    // Store endgame status for use in movement scoring
    aiMemory.isEndgame = isEndgame;

    // Decide search pattern based on situation (using all allied units)
    decideSearchPattern(allAlliedUnits, visibleEnemies);

    // Generate thought based on search pattern - nur bei Änderung oder wichtigen Situationen
    const patternExplanations = {
        'engage': 'Der Feind ist in Reichweite. Alle Einheiten greifen direkt an.',
        'expand': 'Wir breiten uns aus, um mehr Gebiet unter Kontrolle zu bringen.',
        'sweep': 'Koordiniertes Durchkämmen des Geländes von einer Seite zur anderen.',
        'pincer': 'Zangenbewegung eingeleitet. Wir umzingeln den Feind von zwei Seiten.'
    };
    if (aiMemory.searchPattern && patternExplanations[aiMemory.searchPattern] && visibleEnemies.length > 0) {
        addAIThought(patternExplanations[aiMemory.searchPattern], 'strategy');
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
            addAIThought('Der Köder ist zu stark beschädigt. Wir brechen die Taktik ab und bewerten die Lage neu.', 'strategy');
        }
    }

    // Calculate AP budgets for each unit
    const apBudgets = calculateAPBudgets(aiUnits, state.sharedAP, visibleEnemies);

    // Summarize team readiness (nur bei genügend AP zeigen)
    const totalAP = state.sharedAP;
    const aliveUnits = aiUnits.filter(u => u.alive).length;
    if (totalAP >= aliveUnits * 2 && visibleEnemies.length > 0) {
        addAIThought(`${aliveUnits} Einheiten einsatzbereit mit ${totalAP} Aktionspunkten. Genug Ressourcen für einen koordinierten Angriff.`, 'strategy');
    } else if (totalAP < aliveUnits && visibleEnemies.length > 0) {
        addAIThought('Aktionspunkte knapp. Wir konzentrieren uns auf die wichtigsten Aktionen.', 'strategy');
    }

    // === STRATEGISCHE MEDIC-KOORDINATION ===
    // Prüfe ob verbündete Spieler verletzte Einheiten haben, die wir heilen können
    const medicCoordination = planMedicCoordination(aiUnits, allAlliedUnits, alliedAIPlayers);
    if (medicCoordination) {
        return {
            aiUnits,
            visibleEnemies,
            knownEnemyPositions: Array.from(aiMemory.lastKnownPositions.values()),
            inHuntMode: aiMemory.huntMode,
            searchPattern: aiMemory.searchPattern,
            decoyActive: aiMemory.decoyActive,
            apBudgets,
            medicCoordination  // Include medic assignments
        };
    }

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
 * Plan strategic medic coordination across allied players
 * Assigns medics to heal wounded allied units from other players
 */
function planMedicCoordination(ourUnits, allAlliedUnits, alliedPlayers) {
    if (alliedPlayers.length === 0) return null;

    const ourMedics = ourUnits.filter(u => u.alive && u.class === 'medic');
    if (ourMedics.length === 0) return null;

    const healRange = 4;
    const assignments = new Map();  // medicId -> { target, player, priority }

    // Find all wounded allied units from OTHER players
    const woundedAllies = allAlliedUnits.filter(u =>
        u.alive &&
        u.player !== state.currentPlayer &&  // From allied player, not our team
        u.currentHp < u.maxHp * 0.7
    );

    if (woundedAllies.length === 0) return null;

    // Sort by urgency (lowest HP first)
    woundedAllies.sort((a, b) =>
        (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp)
    );

    // Assign medics to wounded allies
    for (const medic of ourMedics) {
        // Find the closest critically wounded ally
        let bestTarget = null;
        let bestScore = -Infinity;

        for (const ally of woundedAllies) {
            // Skip if already assigned to another medic
            const alreadyAssigned = Array.from(assignments.values())
                .some(a => a.target.id === ally.id);
            if (alreadyAssigned) continue;

            const dist = hexDistance({ q: medic.q, r: medic.r }, { q: ally.q, r: ally.r });
            const hpPercent = ally.currentHp / ally.maxHp;
            const isReachable = dist <= medic.move + healRange;

            // Score based on urgency and reachability
            let score = 0;
            if (dist <= healRange) {
                score += 100;  // Can heal immediately
            } else if (isReachable) {
                score += 50;   // Can reach this turn
            } else {
                score += 10;   // Will take multiple turns
            }

            // Urgency bonus
            score += (1 - hpPercent) * 50;

            // Critical HP bonus
            if (hpPercent < 0.4) score += 30;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = ally;
            }
        }

        if (bestTarget) {
            const dist = hexDistance({ q: medic.q, r: medic.r }, { q: bestTarget.q, r: bestTarget.r });
            assignments.set(medic.id, {
                target: bestTarget,
                player: bestTarget.player,
                priority: bestScore,
                canHealNow: dist <= healRange
            });
        }
    }

    if (assignments.size === 0) return null;

    // Announce strategic medic coordination
    const criticalAllies = woundedAllies.filter(a => a.currentHp / a.maxHp < 0.4);
    if (criticalAllies.length > 0) {
        const playerNames = [...new Set(criticalAllies.map(a => getPlayerName(a.player)))].join(' & ');
        addAIThought(`🏥 Verbündete von ${playerNames} sind kritisch verletzt! Medics werden zur Unterstützung geschickt.`, 'strategy');
    } else if (assignments.size > 0) {
        const targetPlayers = [...new Set(Array.from(assignments.values()).map(a => getPlayerName(a.player)))].join(' & ');
        addAIThought(`🏥 Medic-Unterstützung für ${targetPlayers} geplant.`, 'strategy');
    }

    return {
        assignments,
        woundedAllies
    };
}

/**
 * Update memory with currently visible enemies
 * Erweitert: Speichert auch Bewegungshistorie für Positionsvorhersage
 */
function updateMemoryWithVisibleEnemies(enemies) {
    for (const enemy of enemies) {
        const previousPos = aiMemory.lastKnownPositions.get(enemy.id);

        // === BEWEGUNGSHISTORIE AKTUALISIEREN ===
        if (previousPos && (previousPos.q !== enemy.q || previousPos.r !== enemy.r)) {
            // Feind hat sich bewegt - speichere die Bewegung
            if (!aiMemory.movementHistory.has(enemy.id)) {
                aiMemory.movementHistory.set(enemy.id, []);
            }
            const history = aiMemory.movementHistory.get(enemy.id);
            history.push({
                fromQ: previousPos.q,
                fromR: previousPos.r,
                toQ: enemy.q,
                toR: enemy.r,
                round: state.round
            });
            // Nur die letzten 5 Bewegungen speichern
            if (history.length > 5) history.shift();

            // Vorhersage der nächsten Position basierend auf Bewegungsrichtung
            predictEnemyNextPosition(enemy.id, previousPos, enemy);
        }

        // Aktuelle Position speichern
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
                aiMemory.movementHistory.delete(id);
                aiMemory.predictedPositions.delete(id);
            }
        }
    });
}

/**
 * Vorhersage der nächsten feindlichen Position basierend auf Bewegungsmuster
 */
function predictEnemyNextPosition(enemyId, previousPos, currentPos) {
    // Berechne Bewegungsvektor
    const dq = currentPos.q - previousPos.q;
    const dr = currentPos.r - previousPos.r;

    // Vorhersage: Feind bewegt sich wahrscheinlich weiter in diese Richtung
    const predictedQ = currentPos.q + dq;
    const predictedR = currentPos.r + dr;

    // Prüfe ob vorhergesagte Position gültig ist
    const predictedHex = getHex(predictedQ, predictedR);
    if (predictedHex && predictedHex.walkable && !predictedHex.unit) {
        aiMemory.predictedPositions.set(enemyId, {
            q: predictedQ,
            r: predictedR,
            confidence: 0.6,  // 60% Konfidenz für Vorhersage
            basedOnRound: state.round
        });
    } else {
        // Keine gültige Vorhersage möglich
        aiMemory.predictedPositions.delete(enemyId);
    }
}

/**
 * Registriere einen empfangenen Angriff für die Erinnerung
 * Wird aufgerufen wenn eine unserer Einheiten angegriffen wird
 */
function recordIncomingAttack(targetUnit, attackerUnit) {
    if (!aiMemory.attackHistory.has(targetUnit.id)) {
        aiMemory.attackHistory.set(targetUnit.id, []);
    }
    const history = aiMemory.attackHistory.get(targetUnit.id);
    history.push({
        fromQ: attackerUnit.q,
        fromR: attackerUnit.r,
        round: state.round,
        attackerClass: attackerUnit.class,
        attackerId: attackerUnit.id
    });
    // Nur die letzten 5 Angriffe speichern
    if (history.length > 5) history.shift();
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
            const className = CLASS_NAMES_DE[ghost.class] || ghost.class || 'Einheit';
            addAIThought(`Ein getarnter ${className} hat von dort angegriffen. Wir kennen jetzt seine ungefähre Position.`, 'strategy');
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
 * Prioritizes enemies that can be killed with combined firepower
 */
function assignTargets(aiUnits, enemies) {
    aiMemory.assignedTargets.clear();
    aiMemory.flankingTargets.clear();

    if (enemies.length === 0) return;

    // Calculate potential damage each unit can deal to each enemy
    const attackOptions = new Map(); // enemyId -> [{ unit, damage, dist, canReach }]

    for (const enemy of enemies) {
        const options = [];
        for (const unit of aiUnits) {
            const dist = hexDistance({ q: unit.q, r: unit.r }, { q: enemy.q, r: enemy.r });
            const canAttackNow = dist <= unit.range;
            const canReachAndAttack = dist <= unit.range + unit.move;

            if (canAttackNow || canReachAndAttack) {
                options.push({
                    unit,
                    damage: unit.damage,
                    dist,
                    canAttackNow,
                    canReachAndAttack
                });
            }
        }
        attackOptions.set(enemy.id, options);
    }

    // Calculate "killability" score for each enemy
    // Higher score = easier to kill with combined attacks
    const killScores = enemies.map(enemy => {
        const options = attackOptions.get(enemy.id) || [];
        const totalDamage = options.reduce((sum, o) => sum + o.damage, 0);
        const canKill = totalDamage >= enemy.currentHp;
        const overkill = canKill ? (totalDamage - enemy.currentHp) : 0;
        const threat = aiMemory.threatAssessment.get(enemy.id) || 50;

        // Prioritize:
        // 1. Enemies we can definitely kill (combined firepower)
        // 2. High threat enemies
        // 3. Lower HP enemies (finishing blows)
        // 4. Minimize overkill (efficient use of units)
        let score = 0;
        if (canKill) {
            score += 1000; // Big bonus for guaranteed kills
            score -= overkill * 2; // Prefer efficient kills
        }
        score += threat;
        score += (1 - enemy.currentHp / enemy.maxHp) * 100; // Lower HP = higher priority

        return { enemy, score, options, canKill, totalDamage };
    }).sort((a, b) => b.score - a.score);

    // Assign units to enemies, prioritizing killable targets
    for (const { enemy, canKill, options } of killScores) {
        let remainingHp = enemy.currentHp;

        // Sort options: prefer units that can attack now, then by damage
        const sortedOptions = options
            .filter(o => !aiMemory.assignedTargets.has(o.unit.id))
            .sort((a, b) => {
                if (a.canAttackNow !== b.canAttackNow) return a.canAttackNow ? -1 : 1;
                return b.damage - a.damage;
            });

        for (const option of sortedOptions) {
            aiMemory.assignedTargets.set(option.unit.id, enemy.id);
            remainingHp -= option.damage;

            // Stop assigning once we can kill (or if we've assigned enough)
            if (remainingHp <= 0) break;
        }
    }

    // Check for coordinated attacks from multiple allied players
    const coordinatedTargets = new Map(); // enemyId -> { players, units, totalDamage, canKill }
    for (const [unitId, enemyId] of aiMemory.assignedTargets) {
        const unit = aiUnits.find(u => u.id === unitId);
        if (!unit) continue;

        if (!coordinatedTargets.has(enemyId)) {
            coordinatedTargets.set(enemyId, {
                players: new Set(),
                units: [],
                totalDamage: 0
            });
        }

        const info = coordinatedTargets.get(enemyId);
        info.players.add(unit.player);
        info.units.push(unit);
        info.totalDamage += unit.damage;
    }

    // Announce coordinated attacks
    for (const [enemyId, info] of coordinatedTargets) {
        const enemy = enemies.find(e => e.id === enemyId);
        if (!enemy) continue;

        const targetName = CLASS_NAMES_DE[enemy.class] || enemy.class || 'Feind';
        const canKill = info.totalDamage >= enemy.currentHp;

        if (info.players.size >= 2) {
            // Multiple allied players coordinating
            const playerNames = Array.from(info.players).map(p => getPlayerName(p)).join(' & ');
            if (canKill) {
                addAIThought(`🎯 ${playerNames} koordinieren Angriff auf ${targetName} - Eliminierung möglich!`, 'strategy');
            } else {
                addAIThought(`📍 ${playerNames} konzentrieren Feuer auf den ${targetName}!`, 'strategy');
            }
        } else if (info.units.length >= 2 && canKill) {
            // Multiple units from same player can kill together
            addAIThought(`🎯 ${info.units.length} Einheiten greifen gemeinsam an - ${targetName} kann eliminiert werden!`, 'strategy');
        }
    }

    // === TAKTISCHES EINKESSELN ===
    // Weise Flankenmanöver zu wenn mehrere Einheiten denselben Feind angreifen
    planEncirclementManeuvers(aiUnits, enemies);
}

/**
 * Plane Einkesselungs-Manöver für koordinierte Angriffe
 * Weist Einheiten verschiedene Flankenrichtungen zu
 */
function planEncirclementManeuvers(aiUnits, enemies) {
    if (enemies.length === 0 || aiUnits.length < 2) return;

    // Finde den Hauptfeind (höchste Bedrohung)
    const primaryTarget = enemies.reduce((max, e) => {
        const threat = aiMemory.threatAssessment.get(e.id) || 0;
        const maxThreat = max ? (aiMemory.threatAssessment.get(max.id) || 0) : 0;
        return threat > maxThreat ? e : max;
    }, null);

    if (!primaryTarget) return;

    // Finde Einheiten die diesem Feind zugewiesen sind
    const assignedUnits = aiUnits.filter(u =>
        aiMemory.assignedTargets.get(u.id) === primaryTarget.id
    );

    if (assignedUnits.length < 2) return;

    // Berechne ideale Flankenrichtungen (6 Hex-Richtungen)
    const directions = [
        { dq: 1, dr: 0 },   // Ost
        { dq: 1, dr: -1 },  // Nord-Ost
        { dq: 0, dr: -1 },  // Nord-West
        { dq: -1, dr: 0 },  // West
        { dq: -1, dr: 1 },  // Süd-West
        { dq: 0, dr: 1 }    // Süd-Ost
    ];

    // Bestimme welche Richtungen bereits besetzt sind
    const occupiedDirections = new Set();
    for (const unit of assignedUnits) {
        const dq = unit.q - primaryTarget.q;
        const dr = unit.r - primaryTarget.r;
        const angle = Math.atan2(dr, dq);
        const dirIndex = Math.round((angle + Math.PI) / (Math.PI / 3)) % 6;
        occupiedDirections.add(dirIndex);
    }

    // Weise unbesetzten Einheiten Flankenrichtungen zu
    let dirIndex = 0;
    for (const unit of assignedUnits) {
        // Finde eine freie Richtung die nicht bereits zugewiesen ist
        while (occupiedDirections.has(dirIndex) && dirIndex < 6) {
            dirIndex++;
        }

        if (dirIndex < 6) {
            const dir = directions[dirIndex];
            aiMemory.flankingTargets.set(unit.id, {
                targetId: primaryTarget.id,
                flankDirection: dir,
                directionIndex: dirIndex
            });
            occupiedDirections.add(dirIndex);
            dirIndex++;
        }
    }

    // Generiere AI Thought wenn Einkesselung geplant wird
    if (aiMemory.flankingTargets.size >= 2) {
        const targetName = CLASS_NAMES_DE[primaryTarget.class] || primaryTarget.class || 'Feind';
        const numFlankers = aiMemory.flankingTargets.size;
        addAIThought(`${numFlankers} Einheiten umzingeln den ${targetName}. Er hat keinen Fluchtweg.`, 'strategy');
    }
}

/**
 * Berechne ob eine Position gut für Flankenangriff ist
 * Gibt Score-Bonus zurück wenn Position für zugewiesene Flanke günstig ist
 */
function getFlankingBonus(unit, targetQ, targetR, enemies) {
    const flankInfo = aiMemory.flankingTargets.get(unit.id);
    if (!flankInfo) return 0;

    const target = enemies.find(e => e.id === flankInfo.targetId);
    if (!target) return 0;

    // Berechne ideale Flankenposition
    const idealQ = target.q + flankInfo.flankDirection.dq * 2;
    const idealR = target.r + flankInfo.flankDirection.dr * 2;

    // Bonus basierend auf Nähe zur idealen Flankenposition
    const distToIdeal = hexDistance({ q: targetQ, r: targetR }, { q: idealQ, r: idealR });

    if (distToIdeal === 0) return 80;  // Perfekte Flankenposition
    if (distToIdeal === 1) return 50;  // Sehr nah
    if (distToIdeal === 2) return 25;  // Akzeptabel

    return 0;
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

        // === INTELLIGENT TACTICAL DECISION TREE ===
        // Neu: Klassenspezifische Entscheidungslogik mit Vorausplanung
        const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';

        // Get spotted awareness for tactical decisions
        const spottedInfo = getSpottedAwareness(unit, enemies);

        // Generate spotted-awareness thought
        if (spectatorMode && enemies.length > 0) {
            if (spottedInfo.isSpotted) {
                if (spottedInfo.urgency === 'critical') {
                    addAIThought(`${unitName} ist entdeckt und verwundet. Kritische Situation – muss schnell handeln.`, 'strategy');
                } else if (spottedInfo.shouldSeekCover) {
                    addAIThought(`${unitName} wurde vom Feind gesichtet. Deckung suchen wäre klug.`, 'strategy');
                }
            } else if (spottedInfo.canSurpriseAttack) {
                addAIThought(`${unitName} ist noch unentdeckt. Gute Chance für einen Überraschungsangriff.`, 'strategy');
            }
        }

        // === KLASSENSPEZIFISCHE PRIORITÄTEN ===
        // Jede Klasse hat eine optimierte Entscheidungsreihenfolge

        // ========== MEDIC: Heilung hat HÖCHSTE Priorität ==========
        if (unit.class === 'medic') {
            const medicResult = await executeMedicAI(unit, plan, {
                canSpendAP, trackAPSpent, hasHumanViewer, spectatorMode,
                renderIfVisible, actionDelayBase, shortDelay, spottedInfo, unitBudget, apSpentByUnit
            });
            if (medicResult.handled) return;
        }

        // ========== SNIPER/COMMANDO: Tarnung VOR Bewegung wenn entdeckt ==========
        if ((unit.class === 'sniper' || unit.class === 'commando') && spottedInfo.isSpotted) {
            const stealthResult = await executeSpottedStealthReaction(unit, enemies, plan, {
                canSpendAP, trackAPSpent, hasHumanViewer, spectatorMode,
                renderIfVisible, actionDelayBase, shortDelay
            });
            if (stealthResult.retreated) return;
        }

        // 1. Should we retreat? (Low HP, enemies nearby, or spotted and vulnerable)
        if (shouldRetreat(unit, enemies) && canSpendAP(1)) {
            // Enhanced retreat thought with reason
            const hpPercent = Math.round(unit.currentHp / unit.maxHp * 100);
            let retreatReason = '';
            if (hpPercent <= 30) {
                retreatReason = `Nur noch ${hpPercent}% Gesundheit – zu riskant weiterzukämpfen.`;
            } else if (spottedInfo.isSpotted && spottedInfo.closestEnemyDist <= 3) {
                retreatReason = `Der Feind ist zu nah. ${unitName} zieht sich zurück, um nicht umzingelt zu werden.`;
            } else {
                retreatReason = `${unitName} ist angeschlagen und sucht eine sicherere Position.`;
            }
            addAIThought(retreatReason, 'retreat');
            await executeRetreatWithBudget(unit, enemies, spectatorMode, unitBudget - apSpentByUnit);
            return;
        }

        // ========== PRE-MOVE ABILITIES: Aktiviere VOR Bewegung für taktischen Vorteil ==========
        const preMoveAbilityUsed = await usePreMoveAbility(unit, enemies, plan, {
            canSpendAP, trackAPSpent, hasHumanViewer, spectatorMode,
            renderIfVisible, actionDelayBase, shortDelay, spottedInfo
        });

        // 2. Attack assigned target if possible (focus fire)
        // WICHTIG: canUnitAttack prüft MAX_ATTACKS_PER_UNIT (gleiche Regel wie für Menschen)
        if (assignedTargetId && attackable.some(t => t.id === assignedTargetId) && canSpendAP(1) && canUnitAttack(unit)) {
            const target = attackable.find(t => t.id === assignedTargetId);
            // Enhanced attack thought with evaluation
            const targetName = CLASS_NAMES_DE[target.class] || target.class || 'Feind';
            const canKill = target.currentHp <= unit.damage;
            if (canKill) {
                addAIThought(`${unitName} kann den ${targetName} mit diesem Schuss erledigen. Das ist die Priorität.`, 'attack');
            } else {
                const targetHp = Math.round(target.currentHp);
                addAIThought(`${unitName} konzentriert Feuer auf den ${targetName}. Noch ${targetHp} HP übrig.`, 'attack');
            }
            await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
            trackAPSpent(1);
        } else if (attackable.length > 0 && canSpendAP(1) && canUnitAttack(unit)) {
            // 3. Attack best available target
            const target = selectBestTarget(unit, attackable);
            if (target) {
                const targetName = CLASS_NAMES_DE[target.class] || target.class || 'Feind';
                const canKill = target.currentHp <= unit.damage;
                if (canKill) {
                    addAIThought(`${targetName} ist verwundbar. ${unitName} kann ihn jetzt ausschalten.`, 'attack');
                } else {
                    const targetHpPercent = Math.round((target.currentHp / target.maxHp) * 100);
                    addAIThought(`${unitName} greift den ${targetName} an, der noch ${targetHpPercent}% HP hat.`, 'attack');
                }
                await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
                trackAPSpent(1);
            }
        }

        // 4. Use special ability if beneficial AND within budget (wenn noch nicht verwendet)
        const specialCost = getSpecialAbilityCost(unit.class);
        if (!preMoveAbilityUsed && canSpendAP(specialCost) && canUseSpecialAbility(unit) && shouldUseSpecial(unit, enemies, plan)) {
            // Generate special ability thought with context-aware reason
            const specialReasons = {
                scout: spottedInfo.isSpotted
                    ? `${unitName} aktiviert Sprint, um der Gefahr zu entkommen.`
                    : `${unitName} sprintet, um eine bessere Angriffsposition zu erreichen.`,
                assault: `${unitName} lädt einen Powershot – der nächste Angriff wird verheerend.`,
                medic: `Das Team braucht medizinische Versorgung. ${unitName} bereitet die Heilung vor.`,
                sniper: spottedInfo.isSpotted
                    ? `${unitName} tarnt sich, um der Entdeckung zu entkommen.`
                    : `${unitName} geht in Tarnung für einen überraschenden Schuss.`,
                commando: `${unitName} verschwindet in den Schatten, um unbemerkt zuzuschlagen.`,
                elitesoldat: `${unitName} aktiviert den taktischen Modus für präzisere Angriffe.`
            };
            addAIThought(specialReasons[unit.class] || `${unitName} setzt die Spezialfähigkeit ein.`, 'special');

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
                        addAIThought(variedPhrase([
                            `${unitName} erkundet unbekanntes Terrain.`,
                            `Keine Feinde in Sicht. ${unitName} rückt vor.`,
                            `${unitName} sucht nach feindlichen Positionen.`
                        ]), 'move');
                    } else if (spottedInfo.isSpotted && spottedInfo.shouldSeekCover) {
                        addAIThought(`${unitName} wurde gesehen und sucht jetzt Deckung.`, 'move');
                    } else {
                        const closestEnemy = enemies[0];
                        const distAfter = hexDistance({ q: moveTarget.q, r: moveTarget.r }, { q: closestEnemy.q, r: closestEnemy.r });
                        const closestEnemyName = CLASS_NAMES_DE[closestEnemy.class] || closestEnemy.class || 'Feind';
                        if (distAfter <= unit.range) {
                            addAIThought(`${unitName} bewegt sich in Schussreichweite zum ${closestEnemyName}.`, 'move');
                        } else {
                            addAIThought(`${unitName} nähert sich dem Kampfgebiet.`, 'move');
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
                const targetName = CLASS_NAMES_DE[target.class] || target.class || 'Feind';
                addAIThought(`Nach der Bewegung hat ${unitName} jetzt Sicht auf den ${targetName}. Angriff!`, 'attack');
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
        const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';
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

    // === VERBESSERTER FLANKING-BONUS mit Koordination ===
    // Nutze das Einkesselungs-System wenn verfügbar
    const coordFlankBonus = getFlankingBonus(unit, q, r, enemies);
    if (coordFlankBonus > 0) {
        score += coordFlankBonus;
    } else if (primaryTarget && allies.length > 0) {
        // Fallback: Standard-Flanking basierend auf Winkel zu Verbündeten
        const avgAllyAngle = allies.reduce((sum, a) => {
            return sum + Math.atan2(a.r - primaryTarget.r, a.q - primaryTarget.q);
        }, 0) / allies.length;

        const myAngle = Math.atan2(r - primaryTarget.r, q - primaryTarget.q);
        const angleDiff = Math.abs(myAngle - avgAllyAngle);

        const flankBonus = unit.class === 'commando' ? 40 : 25;
        if (angleDiff > Math.PI / 3) score += flankBonus;
    }

    // === NUTZE VORHERGESAGTE FEINDPOSITIONEN ===
    // Bonus für Positionen die vorhergesagte Bewegungen abfangen
    for (const [enemyId, prediction] of aiMemory.predictedPositions) {
        const distToPrediction = hexDistance({ q, r }, { q: prediction.q, r: prediction.r });
        if (distToPrediction <= unit.range && prediction.confidence > 0.4) {
            // Position kann vorhergesagte Feindposition angreifen
            score += 25 * prediction.confidence;
        }
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
 * Execute decoy unit behavior - lure enemies while STAYING ALIVE
 * SICHERHEIT ZUERST: Der Köder soll überleben, nicht geopfert werden!
 */
async function executeDecoyBehavior(unit, plan, renderIfVisible, hasHumanViewer, spectatorMode = false) {
    const enemies = plan.visibleEnemies;
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';
    const actionDelay = spectatorMode ? 500 : 300;

    // === SICHERHEITS-CHECK: Frühzeitiger Rückzug bei 60% HP ===
    // Der Köder soll überleben, nicht sterben!
    if (unit.currentHp < unit.maxHp * 0.6) {
        addAIThought(`${unitName} hat seine Köder-Aufgabe erfüllt. Sicherer Rückzug bei ${Math.round(unit.currentHp / unit.maxHp * 100)}% HP.`, 'retreat');
        await executeRetreat(unit, enemies, spectatorMode);
        return;
    }

    // === BEDROHUNGS-ANALYSE ===
    const closestEnemyDist = enemies.length > 0
        ? Math.min(...enemies.map(e => hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })))
        : Infinity;

    // Zähle wie viele Feinde uns angreifen könnten
    const threateningEnemies = enemies.filter(e => {
        const dist = hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r });
        return dist <= (e.range || 3);
    });

    // Bei zu hoher Bedrohung: Sofortiger Rückzug
    if (threateningEnemies.length >= 2) {
        addAIThought(`Zu viele Feinde in Reichweite! ${unitName} zieht sich zurück, um nicht umzingelt zu werden.`, 'retreat');
        await executeRetreat(unit, enemies, spectatorMode);
        return;
    }

    // === SCOUT: Sprint ZUERST aktivieren für Sicherheit ===
    if (unit.class === 'scout' && canUseSpecialAbility(unit) && closestEnemyDist <= 5) {
        addAIThought(`${unitName} aktiviert Sprint VOR der Köder-Bewegung - für garantierte Fluchtmöglichkeit.`, 'special');
        useSpecialAbility(unit);
        renderIfVisible();
        await delay(actionDelay);
    }

    // === SICHERE POSITIONIERUNG ===
    // Bewege in eine Position die lockt, aber SICHER ist
    if (state.sharedAP >= 1) {
        addAIThought(`${unitName} positioniert sich verlockend, aber außerhalb der direkten Feindreichweite.`, 'move');
        const moveTarget = selectStrategicMoveTarget(unit, plan);
        if (moveTarget) {
            await executeAIMove(unit, moveTarget, spectatorMode);
        }
    }

    // === NUR SICHERE ANGRIFFE ===
    // Nur angreifen wenn wir sicher eliminieren können
    const attackable = getAttackableUnits(unit);
    if (attackable.length > 0 && state.sharedAP >= 1 && canUnitAttack(unit)) {
        const killableTarget = attackable.find(t => t.currentHp <= unit.damage);
        if (killableTarget) {
            const targetName = CLASS_NAMES_DE[killableTarget.class] || killableTarget.class || 'Feind';
            addAIThought(`${targetName} ist verwundbar. ${unitName} nutzt die sichere Gelegenheit zum Eliminieren.`, 'attack');
            await executeAttackSequence(unit, killableTarget, renderIfVisible, hasHumanViewer, spectatorMode);
        }
        // KEIN Angriff auf volle HP Ziele - zu riskant, provoziert Gegenschlag
    }

    // === ASSAULT: Defensive Haltung ===
    // Assault-Köder greift NICHT mit Powershot an - spart Ressourcen für Verteidigung
}

/**
 * Execute ambush unit behavior - wait in cover, strike hard when enemies engage
 */
async function executeAmbushBehavior(unit, plan, renderIfVisible, hasHumanViewer, spectatorMode = false) {
    const enemies = plan.visibleEnemies;
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';
    const attackable = getAttackableUnits(unit);
    const actionDelay = spectatorMode ? 500 : 300;

    // 1. Use stealth abilities if available (sniper cloak, commando stealth)
    if (canUseSpecialAbility(unit)) {
        if ((unit.class === 'sniper' || unit.class === 'commando') && !unit.cloaked) {
            addAIThought(`${unitName} tarnt sich und wartet auf den perfekten Moment zum Zuschlagen.`, 'special');
            useSpecialAbility(unit);
            renderIfVisible();
            await delay(actionDelay);
        }
    }

    // 2. Position for ambush if not in attack range
    if (attackable.length === 0 && state.sharedAP >= 1) {
        addAIThought(`${unitName} bezieht eine versteckte Position für den Hinterhalt.`, 'move');
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
            const targetName = CLASS_NAMES_DE[target.class] || target.class || 'Feind';
            addAIThought(`Der Feind ist in die Falle getappt! ${unitName} greift den ${targetName} aus dem Hinterhalt an.`, 'attack');
            await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
        }
    }

    // 4. Use powershot if assault and in range (uses canUseSpecialAbility which checks for attacks)
    if (canUseSpecialAbility(unit) && unit.class === 'assault') {
        const inRange = enemies.filter(e =>
            hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.range
        );
        if (inRange.length > 0) {
            addAIThought(`${unitName} lädt einen verstärkten Schuss aus dem Hinterhalt. Der nächste Treffer wird vernichtend.`, 'special');
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

// ===== NEUE INTELLIGENTE KI-FUNKTIONEN =====

/**
 * MEDIC AI - Heilung hat HÖCHSTE Priorität
 * Medic heilt ZUERST verletzte Verbündete, DANN greift er an
 * @returns {Object} { handled: boolean } - true wenn Medic-Logik die Runde abgeschlossen hat
 */
async function executeMedicAI(unit, plan, context) {
    const { canSpendAP, trackAPSpent, hasHumanViewer, spectatorMode,
            renderIfVisible, actionDelayBase, shortDelay, unitBudget, apSpentByUnit } = context;
    const _enemies = plan.visibleEnemies; // Für zukünftige Nutzung bei Feind-Meidung
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';

    // Hole ALLE verbündeten Einheiten (inkl. von verbündeten Spielern)
    const allies = getAllAlliedAIUnits();
    const healRange = 4; // Aus config

    // Check if this medic has a strategic assignment from coordination planning
    const medicAssignment = plan.medicCoordination?.assignments?.get(unit.id);
    if (medicAssignment) {
        const assignedTarget = medicAssignment.target;
        const assignedPlayerName = getPlayerName(medicAssignment.player);
        const targetName = CLASS_NAMES_DE[assignedTarget.class] || assignedTarget.class || 'Verbündeter';
        const dist = hexDistance({ q: unit.q, r: unit.r }, { q: assignedTarget.q, r: assignedTarget.r });

        // If assigned target is in range, prioritize healing them
        if (dist <= healRange && canSpendAP(getSpecialAbilityCost('medic')) && canUseSpecialAbility(unit)) {
            addAIThought(`🏥 ${unitName} führt geplante Heilung an ${assignedPlayerName}'s ${targetName} durch!`, 'special');
            useSpecialAbility(unit);
            trackAPSpent(getSpecialAbilityCost('medic'));
            if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                updateUI();
                render();
            }
            await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
            return { handled: true };
        }

        // If assigned target is reachable, move towards them first
        if (!medicAssignment.canHealNow && dist > healRange && canSpendAP(1)) {
            const moveTarget = selectMedicMoveTarget(unit, [assignedTarget], plan, unitBudget - apSpentByUnit);
            if (moveTarget) {
                addAIThought(`🏥 ${unitName} bewegt sich zu ${assignedPlayerName}'s ${targetName} - koordinierte Unterstützung!`, 'move');
                await executeAIMove(unit, moveTarget, spectatorMode);
                trackAPSpent(moveTarget.cost);

                // Check if we can now heal after moving
                const newDist = hexDistance({ q: unit.q, r: unit.r }, { q: assignedTarget.q, r: assignedTarget.r });
                if (newDist <= healRange && canSpendAP(getSpecialAbilityCost('medic')) && canUseSpecialAbility(unit)) {
                    addAIThought(`🏥 ${unitName} ist jetzt in Reichweite - Heilung startet!`, 'special');
                    useSpecialAbility(unit);
                    trackAPSpent(getSpecialAbilityCost('medic'));
                    if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                        updateUI();
                        render();
                    }
                    await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
                }
                return { handled: true };
            }
        }
    }

    // Finde verletzte Verbündete in Heilreichweite
    const woundedInRange = allies.filter(a =>
        a.id !== unit.id &&
        a.currentHp < a.maxHp * 0.8 &&
        hexDistance({ q: unit.q, r: unit.r }, { q: a.q, r: a.r }) <= healRange
    );

    // Kritisch verletzte Verbündete (unter 40% HP)
    const criticallyWounded = woundedInRange.filter(a => a.currentHp < a.maxHp * 0.4);

    // Verletzte außerhalb der Reichweite
    const woundedOutOfRange = allies.filter(a =>
        a.id !== unit.id &&
        a.currentHp < a.maxHp * 0.6 &&
        hexDistance({ q: unit.q, r: unit.r }, { q: a.q, r: a.r }) > healRange
    );

    // Ist der Medic selbst verletzt?
    const selfWounded = unit.currentHp < unit.maxHp * 0.7;

    const specialCost = getSpecialAbilityCost('medic');

    // === ENTSCHEIDUNGSLOGIK FÜR HEILUNG ===
    // Priorität 1: Kritisch verletzte Verbündete in Reichweite heilen
    // Priorität 2: Mehrere verletzte Verbündete heilen
    // Priorität 3: Selbst heilen wenn verletzt
    // Priorität 4: Zu verletzten Verbündeten bewegen wenn keine in Reichweite

    const shouldHealNow =
        (criticallyWounded.length > 0) ||
        (woundedInRange.length >= 2) ||
        (selfWounded && woundedInRange.length >= 1) ||
        (woundedInRange.some(a => a.currentHp < a.maxHp * 0.5));

    if (shouldHealNow && canSpendAP(specialCost) && canUseSpecialAbility(unit)) {
        // Heile JETZT!
        const totalWounded = woundedInRange.length + (selfWounded ? 1 : 0);
        const mostCritical = criticallyWounded[0] || woundedInRange[0];

        // Check if healing cross-player allies
        const crossPlayerAllies = woundedInRange.filter(a => a.player !== unit.player);
        const hasCrossPlayerHealing = crossPlayerAllies.length > 0;

        if (criticallyWounded.length > 0) {
            const criticalName = CLASS_NAMES_DE[mostCritical.class] || mostCritical.class || 'Verbündeter';
            const criticalHpPercent = Math.round(mostCritical.currentHp / mostCritical.maxHp * 100);
            if (mostCritical.player !== unit.player) {
                const allyPlayerName = getPlayerName(mostCritical.player);
                addAIThought(`🏥 Notfall! ${allyPlayerName}'s ${criticalName} hat nur noch ${criticalHpPercent}% HP. Verbündete Heilung!`, 'special');
            } else {
                addAIThought(`Notfall! Der ${criticalName} hat nur noch ${criticalHpPercent}% HP. ${unitName} muss jetzt heilen.`, 'special');
            }
        } else if (totalWounded >= 2) {
            if (hasCrossPlayerHealing) {
                addAIThought(`🏥 ${totalWounded} Teammitglieder verschiedener Verbündeter verletzt. Koordinierte Heilung!`, 'special');
            } else {
                addAIThought(`${totalWounded} Teammitglieder sind verletzt. ${unitName} startet eine Massenheilung.`, 'special');
            }
        } else {
            const targetName = CLASS_NAMES_DE[woundedInRange[0].class] || woundedInRange[0].class || 'Verbündeter';
            if (woundedInRange[0].player !== unit.player) {
                const allyPlayerName = getPlayerName(woundedInRange[0].player);
                addAIThought(`🏥 ${unitName} heilt ${allyPlayerName}'s ${targetName} - Teamwork!`, 'special');
            } else {
                addAIThought(`Der ${targetName} braucht medizinische Versorgung. ${unitName} heilt.`, 'special');
            }
        }

        useSpecialAbility(unit);
        trackAPSpent(specialCost);

        if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
            updateUI();
            render();
        }
        await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
    }

    // === BEWEGUNG ZU VERLETZTEN VERBÜNDETEN ===
    // Wenn verletzte Verbündete außerhalb der Reichweite sind, bewege dich zu ihnen
    if (woundedOutOfRange.length > 0 && canSpendAP(1)) {
        const remainingBudget = unitBudget - apSpentByUnit;

        // Finde beste Position in Nähe verletzter Verbündeter
        const moveTarget = selectMedicMoveTarget(unit, woundedOutOfRange, plan, remainingBudget);
        if (moveTarget) {
            const targetAlly = woundedOutOfRange[0];
            const targetName = CLASS_NAMES_DE[targetAlly.class] || targetAlly.class || 'Verbündeter';
            const hpPercent = Math.round(targetAlly.currentHp / targetAlly.maxHp * 100);
            addAIThought(`Der ${targetName} ist verletzt und außer Reichweite. ${unitName} eilt zu ihm.`, 'move');

            await executeAIMove(unit, moveTarget, spectatorMode);
            trackAPSpent(moveTarget.cost);

            // Nach Bewegung: Prüfe ob jetzt heilen möglich ist
            const newWoundedInRange = allies.filter(a =>
                a.id !== unit.id &&
                a.currentHp < a.maxHp * 0.8 &&
                hexDistance({ q: unit.q, r: unit.r }, { q: a.q, r: a.r }) <= healRange
            );

            if (newWoundedInRange.length > 0 && canSpendAP(specialCost) && canUseSpecialAbility(unit)) {
                addAIThought(`Jetzt ist ${unitName} nah genug. Die Heilung beginnt.`, 'special');
                useSpecialAbility(unit);
                trackAPSpent(specialCost);

                if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                    updateUI();
                    render();
                }
                await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
            }
        }
    }

    // === MEDIC KANN AUCH ANGREIFEN (aber niedrige Priorität) ===
    // Medic greift nur an, wenn:
    // 1. Keine Heilung nötig ist
    // 2. Feind in Reichweite und angreifbar
    // 3. Oder wenn ein Kill-Shot möglich ist
    const attackable = getAttackableUnits(unit);
    if (attackable.length > 0 && canSpendAP(1) && canUnitAttack(unit)) {
        const killableTarget = attackable.find(t => t.currentHp <= unit.damage);
        const noHealingNeeded = woundedInRange.length === 0 && !selfWounded;

        if (killableTarget || noHealingNeeded) {
            const target = killableTarget || selectBestTarget(unit, attackable);
            if (target) {
                const targetName = CLASS_NAMES_DE[target.class] || target.class || 'Feind';
                if (killableTarget) {
                    addAIThought(`${targetName} ist fast erledigt. Auch der ${unitName} kann zuschlagen.`, 'attack');
                } else {
                    addAIThought(`Das Team ist gesund. ${unitName} unterstützt mit Feuerunterstützung.`, 'attack');
                }
                await executeAttackSequence(unit, target, renderIfVisible, hasHumanViewer, spectatorMode);
                trackAPSpent(1);
            }
        }
    }

    // Medic-spezifische Logik ist vollständig, aber andere Einheiten sollen nicht abgebrochen werden
    return { handled: false };
}

/**
 * Finde beste Bewegungsposition für Medic in Richtung verletzter Verbündeter
 */
function selectMedicMoveTarget(unit, woundedAllies, plan, maxAP) {
    const reachable = getReachableHexes(unit);
    if (reachable.size === 0) return null;

    const maxCost = Math.min(maxAP, state.sharedAP);
    let bestHex = null;
    let bestScore = -Infinity;

    reachable.forEach((data, key) => {
        if (data.cost > maxCost) return;

        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || hex.unit) return;

        let score = 0;

        // Nähe zu verletzten Verbündeten ist wichtigster Faktor
        const healRange = 4;
        for (const ally of woundedAllies) {
            const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });

            // Massive Bonus für Positionen in Heilreichweite
            if (distToAlly <= healRange) {
                score += 200;
                // Extra Bonus für kritisch Verletzte
                if (ally.currentHp < ally.maxHp * 0.4) {
                    score += 100;
                }
            } else {
                // Je näher, desto besser
                score -= distToAlly * 10;
            }
        }

        // Deckung bevorzugen (Medic-Überleben ist wichtig!)
        if (hex.cover) score += 50;
        if (hex.type === 'hills') score += 20;

        // Zone-Awareness
        if (!isHexInZone(q, r)) score -= 300;

        // Feinde meiden
        const enemies = plan.visibleEnemies;
        for (const enemy of enemies) {
            const distToEnemy = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
            if (distToEnemy <= enemy.range) {
                score -= 80; // Nicht in feindliche Reichweite laufen
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestHex = { q, r, cost: data.cost };
        }
    });

    return bestHex;
}

/**
 * SPOTTED STEALTH REACTION - Sniper/Commando reagieren auf Entdeckung
 * Wenn entdeckt: Tarnung aktivieren oder zurückziehen
 * @returns {Object} { retreated: boolean, cloaked: boolean }
 */
async function executeSpottedStealthReaction(unit, enemies, _plan, context) {
    const { canSpendAP, trackAPSpent, hasHumanViewer, spectatorMode,
            actionDelayBase, shortDelay } = context;
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';

    const result = { retreated: false, cloaked: false };

    // Finde nächsten Feind
    let closestEnemyDist = Infinity;
    for (const enemy of enemies) {
        const dist = hexDistance({ q: unit.q, r: unit.r }, { q: enemy.q, r: enemy.r });
        if (dist < closestEnemyDist) {
            closestEnemyDist = dist;
        }
    }

    const specialCost = getSpecialAbilityCost(unit.class);
    const hpPercent = unit.currentHp / unit.maxHp;

    // === ENTSCHEIDUNGSLOGIK BEI ENTDECKUNG ===
    // Sniper: Tarnung bevorzugt wenn möglich, sonst Rückzug
    // Commando: Kann offensiver bleiben, aber Tarnung hilft bei Flucht

    const shouldCloak =
        !unit.cloaked &&
        canSpendAP(specialCost) &&
        canUseSpecialAbility(unit) &&
        (
            (closestEnemyDist <= 4) ||  // Feind nah
            (hpPercent < 0.6) ||         // Verletzt
            (unit.class === 'sniper' && closestEnemyDist <= 3)  // Sniper in Nahkampfgefahr
        );

    if (shouldCloak) {
        if (unit.class === 'sniper') {
            addAIThought(`${unitName} wurde entdeckt! Aktiviere Tarnung, um den Feind abzuschütteln.`, 'special');
        } else {
            addAIThought(`Der Feind hat ${unitName} gesehen. Schnell in die Schatten verschwinden!`, 'special');
        }

        useSpecialAbility(unit);
        trackAPSpent(specialCost);
        result.cloaked = true;

        if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
            updateUI();
            render();
        }
        await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);

        // Nach Tarnung: Rückzug wenn verletzt oder Sniper in Nahkampfgefahr
        if ((hpPercent < 0.5) || (unit.class === 'sniper' && closestEnemyDist <= 2)) {
            addAIThought(`Getarnt nutzt ${unitName} die Chance zum Rückzug.`, 'retreat');
            await executeRetreat(unit, enemies, spectatorMode);
            result.retreated = true;
        }
    } else if (hpPercent < 0.4 && closestEnemyDist <= 3) {
        // Kritisch verletzt und Feind nah - Rückzug ohne Tarnung
        const hpPercentDisplay = Math.round(hpPercent * 100);
        addAIThought(`Kritische Lage! ${unitName} hat nur noch ${hpPercentDisplay}% HP. Sofortiger Rückzug!`, 'retreat');
        await executeRetreat(unit, enemies, spectatorMode);
        result.retreated = true;
    }

    return result;
}

/**
 * PRE-MOVE ABILITIES - Aktiviere Fähigkeiten VOR Bewegung für taktischen Vorteil
 * Scout: Sprint für längere Bewegung
 * Commando: Stealth für unsichtbares Anschleichen
 * Elite: Taktischer Modus für Bonus-Bewegung
 * @returns {boolean} true wenn eine Fähigkeit aktiviert wurde
 */
async function usePreMoveAbility(unit, enemies, _plan, context) {
    const { canSpendAP, trackAPSpent, hasHumanViewer,
            actionDelayBase, shortDelay, spottedInfo } = context;
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';

    const specialCost = getSpecialAbilityCost(unit.class);
    if (!canSpendAP(specialCost) || !canUseSpecialAbility(unit)) {
        return false;
    }

    // === SCOUT: Sprint VOR Bewegung für Reichweite ===
    if (unit.class === 'scout' && enemies.length > 0) {
        const closestEnemyDist = Math.min(...enemies.map(e =>
            hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
        ));

        // Sprint wenn Feind außerhalb normaler Reichweite aber mit Sprint erreichbar
        const normalMoveRange = unit.move;
        const sprintMoveRange = unit.move + 3;

        const needsSprintToReach = closestEnemyDist > unit.range + normalMoveRange &&
                                    closestEnemyDist <= unit.range + sprintMoveRange;

        // Oder Sprint zur Flucht wenn entdeckt und in Gefahr
        const needsSprintToEscape = spottedInfo.isSpotted &&
                                     spottedInfo.closestEnemyDist <= 3 &&
                                     unit.currentHp < unit.maxHp * 0.5;

        if (needsSprintToReach || needsSprintToEscape) {
            if (needsSprintToEscape) {
                addAIThought(`${unitName} ist in Gefahr. Sprint aktiviert, um Abstand zu gewinnen.`, 'special');
            } else {
                addAIThought(`Der Feind ist zu weit weg. ${unitName} sprintet, um die Lücke zu schließen.`, 'special');
            }
            useSpecialAbility(unit);
            trackAPSpent(specialCost);

            if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                updateUI();
                render();
            }
            await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
            return true;
        }
    }

    // === COMMANDO: Stealth VOR Anschleichen ===
    if (unit.class === 'commando' && !unit.cloaked && enemies.length > 0) {
        const closestEnemyDist = Math.min(...enemies.map(e =>
            hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
        ));

        // Stealth wenn Feind in Angriffs-Distanz nach Bewegung
        const canReachEnemy = closestEnemyDist <= unit.move + 2;
        const notTooClose = closestEnemyDist > 1; // Nicht bereits in Nahkampf

        if (canReachEnemy && notTooClose && !spottedInfo.isSpotted) {
            addAIThought(`${unitName} aktiviert Stealth. Unbemerkt nähern, dann zuschlagen.`, 'special');
            useSpecialAbility(unit);
            trackAPSpent(specialCost);

            if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                updateUI();
                render();
            }
            await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
            return true;
        }
    }

    // === ELITE SOLDIER: Taktischer Modus vor Angriff ===
    if (unit.class === 'elitesoldat' && !unit.tacticalMode && enemies.length > 0) {
        const closestEnemyDist = Math.min(...enemies.map(e =>
            hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
        ));

        // Taktischer Modus wenn Feind bald erreichbar
        const canEngageWithTactical = closestEnemyDist <= unit.move + 2 + unit.range;

        // Oder wenn hochwertige Ziele in der Nähe
        const valuableTargetsNearby = enemies.some(e =>
            (e.class === 'medic' || e.class === 'sniper') &&
            hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.move + 2 + unit.range
        );

        if (canEngageWithTactical || valuableTargetsNearby) {
            addAIThought(`${unitName} aktiviert den taktischen Modus für höhere Präzision und Beweglichkeit.`, 'special');
            useSpecialAbility(unit);
            trackAPSpent(specialCost);

            if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                updateUI();
                render();
            }
            await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
            return true;
        }
    }

    // === ASSAULT: Powershot VOR Angriff wenn Kill möglich ===
    if (unit.class === 'assault' && enemies.length > 0) {
        const attackable = getAttackableUnits(unit);

        // Powershot wenn ein wichtiges Ziel getötet werden kann
        const canKillWithPowershot = attackable.some(e =>
            e.currentHp <= unit.damage + 25 && // Mit Powershot tötbar
            e.currentHp > unit.damage // Ohne Powershot NICHT tötbar
        );

        // Oder wenn Medic/Sniper in Reichweite
        const valuableTargetInRange = attackable.some(e =>
            e.class === 'medic' || e.class === 'sniper'
        );

        if (canKillWithPowershot || valuableTargetInRange) {
            const target = attackable.find(e =>
                (e.currentHp <= unit.damage + 25 && e.currentHp > unit.damage) ||
                e.class === 'medic' || e.class === 'sniper'
            );
            const targetName = target ? (CLASS_NAMES_DE[target.class] || target.class || 'Feind') : 'Ziel';

            if (canKillWithPowershot) {
                addAIThought(`Der ${targetName} kann mit einem verstärkten Schuss erledigt werden. ${unitName} lädt Powershot.`, 'special');
            } else {
                addAIThought(`Ein hochwertiges Ziel: ${targetName}. ${unitName} bereitet einen Powershot vor.`, 'special');
            }
            useSpecialAbility(unit);
            trackAPSpent(specialCost);

            if (!hasHumanViewer || isUnitVisibleToViewer(unit)) {
                updateUI();
                render();
            }
            await delay(isUnitVisibleToViewer(unit) ? actionDelayBase : shortDelay);
            return true;
        }
    }

    return false;
}

// German class names for display
// Note: These should match UNIT_CLASSES[key].name from config.js
const CLASS_NAMES_DE = {
    scout: 'Späher',
    assault: 'Sturmsoldat',
    medic: 'Sanitäter',
    sniper: 'Scharfschütze',
    commando: 'Kommando',
    elitesoldat: 'Elitesoldat'
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
    const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';
    const targetName = CLASS_NAMES_DE[target.class] || target.class || 'Feind';
    const canKill = target.currentHp <= unit.damage;

    // Delay multipliers for spectator mode
    const scrollDelay = spectatorMode ? 600 : 400;
    const targetingDelay = spectatorMode ? 500 : 300;
    const afterAttackDelay = spectatorMode ? 700 : 500;
    const shortDelay = spectatorMode ? 250 : 100;

    // Note: Attack thoughts are generated by the caller, not here, to avoid duplicates

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
        addAIThought(variedPhrase([
            `${targetName} wurde ausgeschaltet. Ein Feind weniger.`,
            `Der ${targetName} ist gefallen. Weiter zum nächsten Ziel.`,
            `${targetName} eliminiert. Das schwächt den Feind erheblich.`
        ]), 'attack');
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
        closeRangeThreats: [],  // Feinde die besonders nah sind
        scoreAdjustment: 0,
        explanation: ''
    };

    // === ANALYSIERE ALLE FEINDPOSITIONEN ===
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
            // Besonders gefährlich wenn in Nahkampfreichweite
            if (distToEnemy <= 2) {
                evaluation.closeRangeThreats.push(enemy);
            }
        }
    }

    // === KRITISCH: INTELLIGENTES AP-MANAGEMENT ===
    // Die KI darf NIEMALS in Gefahr laufen ohne die Möglichkeit zurückzuschlagen

    // Szenario 1: In Angriffsreichweite mehrerer Feinde ohne AP für Gegenangriff
    if (evaluation.threatsInRange.length > 0 && apAfterMove < 1) {
        evaluation.exposedWithoutOptions = true;
        // STARK erhöhter Penalty - skaliert mit Anzahl der Bedrohungen
        const basePenalty = 300;
        const threatMultiplier = evaluation.threatsInRange.length;
        const closeRangePenalty = evaluation.closeRangeThreats.length * 100;
        evaluation.scoreAdjustment -= basePenalty * threatMultiplier + closeRangePenalty;
        evaluation.explanation = `⚠️ GEFAHR: ${evaluation.threatsInRange.length} Feinde in Reichweite, keine AP übrig!`;
    }

    // Szenario 2: Nahkampf-Situation ohne Fluchtmöglichkeit
    if (evaluation.closeRangeThreats.length > 0 && apAfterMove < 2) {
        // Wenn in Nahkampf ohne AP für Angriff+Rückzug
        evaluation.scoreAdjustment -= 150;
        if (!evaluation.explanation) {
            evaluation.explanation = `Nahkampfgefahr ohne Ausweichmöglichkeit`;
        }
    }

    // Szenario 3: Bewegung zu weit - keine AP für Angriff obwohl Feind erreichbar wäre
    if (evaluation.canAttackAfter && apAfterMove < 1) {
        // Kann angreifen aber hat keine AP dafür - VÖLLIG SINNLOSER ZUG
        evaluation.scoreAdjustment -= 400;
        evaluation.explanation = `❌ Feind erreichbar, aber keine AP zum Angriff!`;
    }

    // === POSITIVE BEWERTUNGEN ===

    // Bonus für Kill-Möglichkeiten (nur wenn AP vorhanden)
    if (evaluation.killableTargets.length > 0 && apAfterMove >= 1) {
        evaluation.scoreAdjustment += 80 * evaluation.killableTargets.length;
        const targetName = CLASS_NAMES_DE[evaluation.killableTargets[0].class] || evaluation.killableTargets[0].class;
        evaluation.explanation = `💀 Todesstoß möglich gegen ${targetName}!`;
    }

    // Gute Position: Kann angreifen UND hat AP für Notfall/Zweiten Angriff
    if (evaluation.canAttackAfter && apAfterMove >= 2) {
        evaluation.scoreAdjustment += 50;
        if (!evaluation.explanation) {
            evaluation.explanation = `Gute taktische Position - Angriff + Reserve`;
        }
    }

    // Ideale Position: In Angriffsreichweite, genug AP, und hat noch Fluchtoptionen
    if (evaluation.canAttackAfter && apAfterMove >= 1 && evaluation.threatsInRange.length <= 1) {
        evaluation.scoreAdjustment += 30;
    }

    // Penalty für Exposition ohne Angriffsmöglichkeit
    if (evaluation.threatsInRange.length > 0 && !evaluation.canAttackAfter) {
        evaluation.scoreAdjustment -= 120;
        if (!evaluation.explanation) {
            evaluation.explanation = `Exponiert ohne Angriffsmöglichkeit`;
        }
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
    // Note: Retreat thoughts are typically generated by the caller with more context

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
 * Check if a unit is visible to any player in the allied team
 * This enables shared vision between allied AIs
 */
function isUnitVisibleToAlliedTeam(unit) {
    // Check if current player can see the unit
    if (isUnitVisibleToPlayer(unit, state.currentPlayer)) {
        return true;
    }

    // Check if any allied player can see the unit (shared vision)
    for (let p = 0; p < state.settings.players; p++) {
        if (p !== state.currentPlayer && arePlayersAllied(state.currentPlayer, p)) {
            if (isUnitVisibleToPlayer(unit, p)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Find all enemies visible to the allied team
 * Allied AIs share vision - if ANY ally can see an enemy, all can target it
 * Also includes enemies from shared memory (intel sharing)
 * Schließt Verbündete aus (nur echte Feinde werden zurückgegeben)
 */
function findAllVisibleEnemies() {
    const visibleEnemies = state.units.filter(u =>
        u.alive &&
        !arePlayersAllied(state.currentPlayer, u.player) &&
        isUnitVisibleToAlliedTeam(u)  // Use shared vision
    );

    // Also check for known enemy positions from memory (intel sharing)
    const knownEnemies = [];
    for (const [unitId, posInfo] of aiMemory.lastKnownPositions) {
        // Skip if enemy is already in visible list
        if (visibleEnemies.some(e => e.id === unitId)) continue;

        // Check if the info is recent enough (within last 2 rounds)
        if (state.round - posInfo.round <= 2 && posInfo.confidence > 0.5) {
            const enemy = state.units.find(u => u.id === unitId && u.alive);
            if (enemy && !arePlayersAllied(state.currentPlayer, enemy.player)) {
                // This enemy was recently spotted by an ally - include them
                knownEnemies.push(enemy);
            }
        }
    }

    // Combine visible and known enemies (unique)
    const allEnemies = [...visibleEnemies];
    for (const known of knownEnemies) {
        if (!allEnemies.some(e => e.id === known.id)) {
            allEnemies.push(known);
        }
    }

    return allEnemies;
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
 * KOMPLETT ÜBERARBEITETE KI: Fallback-Logik für nicht-genutzte Fähigkeiten
 * Die meisten Fähigkeiten werden jetzt über usePreMoveAbility gehandhabt
 */
function shouldUseSpecial(unit, enemies, plan) {
    switch (unit.class) {
        case 'medic': {
            // === MEDIC: Heile IMMER wenn Verbündete verletzt sind ===
            const allies = getAllAlliedAIUnits();
            const healRange = 4;

            // Finde alle verletzten Verbündeten in Reichweite (inkl. selbst)
            const woundedNearby = allies.filter(a =>
                a.currentHp < a.maxHp * 0.8 &&
                hexDistance({ q: unit.q, r: unit.r }, { q: a.q, r: a.r }) <= healRange
            );

            const selfWounded = unit.currentHp < unit.maxHp * 0.7;
            const criticallyWounded = woundedNearby.some(a => a.currentHp < a.maxHp * 0.4);
            const moderatelyWounded = woundedNearby.some(a => a.currentHp < a.maxHp * 0.6);

            // SEHR AGGRESSIVE HEILUNG:
            // - Sofort heilen wenn IRGENDWER kritisch verletzt ist
            // - Heilen wenn 2+ Verbündete verletzt sind
            // - Heilen wenn 1 Verbündeter moderat verletzt UND Medic selbst verletzt
            // - Heilen wenn nur 1 Verbündeter unter 50% HP ist
            return criticallyWounded ||
                   woundedNearby.length >= 2 ||
                   (selfWounded && woundedNearby.length >= 1) ||
                   moderatelyWounded;
        }

        case 'scout': {
            // === SCOUT: Sprint aggressiver nutzen ===
            // Die Pre-Move Logik hat das meiste abgedeckt, aber Fallbacks:
            if (enemies.length > 0) {
                const closestEnemy = Math.min(...enemies.map(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
                ));

                // Sprint wenn Feind knapp außer Reichweite
                if (closestEnemy > unit.range && closestEnemy <= unit.range + unit.move + 3) {
                    return true;
                }

                // Sprint für taktische Repositionierung wenn verletzt
                if (unit.currentHp < unit.maxHp * 0.5) {
                    return true;
                }

                // Sprint um Flanke anzugreifen
                if (closestEnemy <= unit.range + 2 && closestEnemy > unit.range) {
                    return true;
                }
            }

            // Sprint in Hunt-Modus für schnellere Aufklärung
            if (plan.inHuntMode) {
                return true;
            }

            // Sprint auch zum Erkunden nutzen wenn keine Feinde sichtbar
            return enemies.length === 0 && Math.random() < 0.3;
        }

        case 'assault': {
            // === ASSAULT: Powershot aggressiver nutzen ===
            if (enemies.length > 0) {
                const attackableUnits = getAttackableUnits(unit);
                const inRange = attackableUnits.length > 0 ? attackableUnits : enemies.filter(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.range
                );

                if (inRange.length === 0) return false;

                // Powershot auf JEDEN Feind in Reichweite - Assault ist zum Kämpfen da!
                // Priorität: Medic > Sniper > Commando > Schwache Feinde > Alle anderen
                const highPriorityTarget = inRange.some(e =>
                    e.class === 'medic' || e.class === 'sniper' || e.class === 'commando'
                );

                const canKillWithPowershot = inRange.some(e =>
                    e.currentHp <= unit.damage + 25
                );

                const anyTargetInRange = inRange.length > 0;

                // Powershot wenn: Hochwertiges Ziel ODER Kill möglich ODER mindestens 1 Feind
                return highPriorityTarget || canKillWithPowershot || (anyTargetInRange && Math.random() < 0.7);
            }
            return false;
        }

        case 'sniper': {
            // === SNIPER: Tarnung strategischer nutzen ===
            if (unit.cloaked) return false;

            if (enemies.length > 0) {
                const closestEnemy = Math.min(...enemies.map(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
                ));

                // SOFORTIGE Tarnung wenn in Nahkampfgefahr
                if (closestEnemy <= 3) {
                    return true;
                }

                // Tarnung wenn verletzt (Überlebenspriorität)
                if (unit.currentHp < unit.maxHp * 0.6 && closestEnemy <= 5) {
                    return true;
                }

                // Tarnung wenn spotted und Feinde in der Nähe
                if (unit.spotted && closestEnemy <= unit.range) {
                    return true;
                }

                // Proaktive Tarnung für bessere Positionierung
                if (closestEnemy > unit.range && closestEnemy <= unit.range + 3) {
                    // Tarnung um sicher in Position zu kommen
                    return Math.random() < 0.5;
                }
            }

            // Im Hunt-Modus: Gelegentlich tarnen für Hinterhalte
            return plan.inHuntMode && Math.random() < 0.3;
        }

        case 'commando': {
            // === COMMANDO: Stealth für Überraschungsangriffe ===
            if (unit.cloaked) return false;

            if (enemies.length > 0) {
                const closestEnemy = Math.min(...enemies.map(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
                ));

                // Stealth wenn Feind erreichbar aber noch nicht in Nahkampf
                if (closestEnemy <= unit.move + 2 && closestEnemy > 1) {
                    return true;
                }

                // Stealth zur Flucht wenn verletzt
                if (unit.currentHp < unit.maxHp * 0.4) {
                    return true;
                }

                // Stealth wenn spotted
                if (unit.spotted && closestEnemy <= 4) {
                    return true;
                }
            }

            // Im Hunt-Modus: Öfter Stealth für Überraschungsangriffe
            return plan.inHuntMode && Math.random() < 0.5;
        }

        case 'elitesoldat': {
            // === ELITE: Taktischer Modus für maximalen Schaden ===
            if (unit.tacticalMode) return false;

            if (enemies.length > 0) {
                const closestEnemy = Math.min(...enemies.map(e =>
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r })
                ));

                // Taktischer Modus wenn Feind in Angriffsreichweite
                if (closestEnemy <= unit.range + unit.move + 2) {
                    return true;
                }

                // Taktischer Modus für hochwertige Ziele
                const valuableTargets = enemies.filter(e =>
                    (e.class === 'medic' || e.class === 'sniper') &&
                    hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.range + unit.move + 2
                );
                if (valuableTargets.length > 0) {
                    return true;
                }
            }
            return false;
        }

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
 * IMPROVED: More aggressive pursuit - close distance quickly
 */
function scoreHuntPosition(unit, q, r, plan) {
    let score = 0;
    const hex = getHex(q, r);

    // === ENDGAME AGGRESSION ===
    if (aiMemory.isEndgame) {
        score += 30; // Base aggression bonus in endgame
    }

    // === ZONE AWARENESS ===
    if (!isHexInZone(q, r)) {
        return -500;
    }

    // Move towards highest confidence last known position
    const positions = plan.knownEnemyPositions
        .sort((a, b) => b.confidence - a.confidence);

    if (positions.length > 0) {
        const target = positions[0];
        const dist = hexDistance({ q, r }, { q: target.q, r: target.r });

        // AGGRESSIVE: Get as close as possible
        // The closer, the better - we want to find and engage!
        score += (15 - dist) * 25; // Strong pull toward target

        // Bonus for being in attack range of last known position
        if (dist <= unit.range) {
            score += 80;
        }
    }

    // Also consider estimated player center - pursue aggressively
    if (aiMemory.playerCenterEstimate) {
        const distToCenter = hexDistance({ q, r }, aiMemory.playerCenterEstimate);
        score -= distToCenter * 5; // INCREASED pursuit weight
    }

    // === SPREAD OUT FROM ALLIES DURING HUNT ===
    const allies = getAllAlliedAIUnits().filter(u => u.id !== unit.id);
    for (const ally of allies) {
        const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
        if (distToAlly <= 2) {
            score -= 40; // Penalty for clustering
        } else if (distToAlly >= 3 && distToAlly <= 6) {
            score += 20; // Bonus for good spread
        }
    }

    // === REWARD ACTUAL MOVEMENT ===
    const moveDist = hexDistance({ q, r }, { q: unit.q, r: unit.r });
    if (moveDist >= 2) {
        score += moveDist * 12; // Bonus for covering ground
    }

    // Prefer high ground for vision
    if (hex && hex.type === 'hills') {
        score += 50;
    }

    // Prefer cover positions (but not at cost of speed)
    if (hex && hex.cover) {
        score += 15;
    }

    return score;
}

/**
 * Score position for systematic search
 * IMPROVED: More aggressive search - spread out, cover ground, hunt actively
 */
function scoreSearchPosition(unit, q, r, plan) {
    let score = 0;
    const hexKey = `${q},${r}`;

    // === CRITICAL: ZONE AWARENESS FOR SEARCH ===
    const targetInZone = isHexInZone(q, r);
    if (!targetInZone) {
        score -= 500;
        return score;
    }

    // Calculate distance from zone center and edge
    const distFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
    const distFromZoneEdge = state.zoneRadius - distFromCenter;

    // Light penalty for being near zone edge
    if (distFromZoneEdge <= 2) {
        score -= 20;
    }

    // === ENDGAME AGGRESSION: Move toward map center aggressively ===
    if (aiMemory.isEndgame) {
        // In endgame, enemies are likely hiding near center - rush there!
        score -= distFromCenter * 8; // Strong bonus for central positions
        score += 50; // Base aggression bonus
    }

    // === STRONG EXPLORATION BONUS - PRIORITIZE UNEXPLORED AREAS ===
    const aiExplored = state.playerExploredHexes[state.currentPlayer];
    if (!aiExplored || !aiExplored.has(hexKey)) {
        score += 80;  // INCREASED: Big bonus for unexplored territory
    }

    // Recently searched penalty
    if (aiMemory.searchedAreas.has(hexKey)) {
        score -= 40;
    }

    // === SPREAD OUT FROM ALLIES - DON'T CLUSTER ===
    const allies = getAllAlliedAIUnits().filter(u => u.id !== unit.id);
    for (const ally of allies) {
        const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
        if (distToAlly <= 2) {
            score -= 60; // Strong penalty for clustering during search
        } else if (distToAlly >= 4 && distToAlly <= 7) {
            score += 30; // Bonus for good spread (not too close, not too far)
        }
    }

    // === MOVEMENT BONUS - REWARD ACTUAL MOVEMENT ===
    const currentDist = hexDistance({ q, r }, { q: unit.q, r: unit.r });
    if (currentDist >= 2) {
        score += currentDist * 15; // Bonus for covering ground
    }

    // Enemy spawn centers - move toward them in hunt mode
    const enemySpawnCenters = getEnemySpawnCenters();
    if (enemySpawnCenters.length > 0) {
        const validSpawnCenters = enemySpawnCenters.filter(pos => isHexInZone(pos.q, pos.r));

        if (validSpawnCenters.length > 0) {
            const radius = CONFIG.MAP_SIZES[state.settings.size];
            const minSpawnDist = Math.min(...validSpawnCenters.map(pos =>
                hexDistance({ q, r }, pos)
            ));
            // INCREASED weight for hunt mode
            const spawnWeight = Math.max(0, radius - minSpawnDist);
            score += spawnWeight * (plan.inHuntMode ? 5 : 3);
        }
    }

    // === HIGH GROUND BONUS - Get vision advantage ===
    const hex = getHex(q, r);
    if (hex && hex.type === 'hills') {
        score += 40; // Hills give vision advantage during search
    }

    // Search pattern specific scoring
    switch (plan.searchPattern) {
        case 'expand': {
            // Spread out to cover maximum ground
            if (state.zoneRadius < CONFIG.MAP_SIZES[state.settings.size]) {
                // Zone shrinking - still move, but toward center
                const currentDistFromCenter = Math.max(Math.abs(unit.q), Math.abs(unit.r), Math.abs(-unit.q - unit.r));
                if (distFromCenter < currentDistFromCenter) {
                    score += 30;
                }
            } else {
                // Full zone - spread out to unexplored areas
                const distFromStart = Math.sqrt(q * q + r * r);
                const currentStartDist = Math.sqrt(unit.q * unit.q + unit.r * unit.r);
                if (distFromStart > currentStartDist && distFromZoneEdge > 3) {
                    score += 25;
                }
            }
            break;
        }

        case 'sweep': {
            // Coordinated sweep - but keep moving!
            const avgAllyR = allies.reduce((sum, u) => sum + u.r, 0) / (allies.length || 1);
            score -= Math.abs(r - avgAllyR) * 3; // Lighter alignment penalty
            score -= distFromCenter * 2;
            score += currentDist * 10; // Reward movement
            break;
        }

        case 'pincer': {
            // Move to flank estimated enemy position
            if (aiMemory.playerCenterEstimate) {
                const estPos = aiMemory.playerCenterEstimate;
                if (isHexInZone(Math.round(estPos.q), Math.round(estPos.r))) {
                    const distToEst = hexDistance({ q, r }, estPos);
                    // Get closer aggressively
                    if (distToEst > 2) {
                        score -= distToEst * 5; // INCREASED pursuit weight
                    }
                    // Flanking angle bonus
                    const angle = Math.atan2(r - estPos.r, q - estPos.q);
                    const unitIndex = getPlayerUnits(unit.player).indexOf(unit);
                    const targetAngle = (unitIndex / Math.max(1, getPlayerUnits(unit.player).length)) * 2 * Math.PI;
                    const angleDiff = Math.abs(angle - targetAngle);
                    score += (Math.PI - angleDiff) * 12;
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
            const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';
            addAIThought(`${unitName} legt Unterdrückungsfeuer auf eine strategische Position. Der Feind wird dort gebremst.`, 'strategy');

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
            const unitName = CLASS_NAMES_DE[unit.class] || unit.class || 'Einheit';
            addAIThought(`${unitName} geht in Overwatch-Position. Jeder Feind, der sich bewegt, wird beschossen.`, 'strategy');

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
