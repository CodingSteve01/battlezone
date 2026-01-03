// ===== AI MEMORY SYSTEM =====
// Team-based memory shared between allied AIs for coordinated strategy

import { state, arePlayersAllied } from '../state.js';

/**
 * Create a fresh memory object for a team
 */
export function createTeamMemory() {
    return {
        // Position tracking
        lastKnownPositions: new Map(),   // unitId -> { q, r, round, confidence, direction, hp }
        searchedAreas: new Set(),         // "q,r" keys of recently searched hexes

        // Threat analysis
        threatAssessment: new Map(),      // unitId -> threat level

        // Hunt mode
        huntMode: false,
        lastContactRound: 0,
        playerCenterEstimate: null,
        searchPattern: 'expand',          // 'expand', 'sweep', 'pincer', 'engage'
        isEndgame: false,

        // Target coordination
        assignedTargets: new Map(),       // unitId -> targetUnitId

        // Decoy strategy
        decoyUnit: null,
        ambushUnits: [],
        decoyActive: false,

        // Team coordination
        lastUpdateRound: 0,
        teamPlayers: new Set(),

        // === ENHANCED MEMORY SYSTEM ===
        attackHistory: new Map(),         // unitId -> [{ fromQ, fromR, round, attackerClass }]
        movementHistory: new Map(),       // unitId -> [{ fromQ, fromR, toQ, toR, round }]
        predictedPositions: new Map(),    // unitId -> { q, r, confidence }
        flankingTargets: new Map(),       // unitId -> { targetId, flankDirection }

        // === NEW: THREAT MAPS ===
        threatMap: new Map(),             // "q,r" -> threat level (how dangerous is this hex)
        influenceMap: new Map(),          // "q,r" -> { friendly, enemy } influence
        safeZones: new Set(),             // "q,r" keys of relatively safe hexes
        dangerZones: new Set(),           // "q,r" keys of dangerous hexes

        // === NEW: PLAYER BEHAVIOR ===
        playerTendencies: {
            aggressive: 0.5,              // 0-1 how aggressive player plays
            flanking: 0.5,                // 0-1 how often player flanks
            focusFire: 0.5,               // 0-1 how often player focus fires
            usesAbilities: 0.5,           // 0-1 how often player uses specials
            retreatThreshold: 0.3,        // HP% at which player usually retreats
        },
        playerAttackPatterns: [],         // Recent attack directions/targets
    };
}

// Team-based memory storage
const teamMemories = new Map();

// Reference to current team's memory
let aiMemory = createTeamMemory();

/**
 * Get the team memory for the current AI player
 */
export function getTeamMemory() {
    let teamId = state.currentPlayer;
    for (let p = 0; p < state.settings.players; p++) {
        if (p !== state.currentPlayer && arePlayersAllied(state.currentPlayer, p)) {
            teamId = Math.min(teamId, p);
        }
    }

    if (!teamMemories.has(teamId)) {
        const memory = createTeamMemory();
        memory.teamPlayers.add(state.currentPlayer);
        teamMemories.set(teamId, memory);
    }

    const memory = teamMemories.get(teamId);
    memory.teamPlayers.add(state.currentPlayer);
    return memory;
}

/**
 * Get the current AI memory reference
 */
export function getAIMemory() {
    return aiMemory;
}

/**
 * Set the current AI memory reference
 */
export function setAIMemory(memory) {
    aiMemory = memory;
}

/**
 * Reset AI memory for new game
 */
export function resetAIMemory() {
    teamMemories.clear();
    aiMemory = createTeamMemory();
}

/**
 * Initialize AI memory for current turn
 */
export function initializeTeamMemory() {
    aiMemory = getTeamMemory();
    aiMemory.lastUpdateRound = state.round;
}

/**
 * Record enemy position in memory
 */
export function recordEnemyPosition(unit, confidence = 1.0) {
    const memory = getAIMemory();
    const existing = memory.lastKnownPositions.get(unit.id);

    let direction = null;
    if (existing && (existing.q !== unit.q || existing.r !== unit.r)) {
        direction = {
            dq: unit.q - existing.q,
            dr: unit.r - existing.r
        };

        // Record movement history
        if (!memory.movementHistory.has(unit.id)) {
            memory.movementHistory.set(unit.id, []);
        }
        const history = memory.movementHistory.get(unit.id);
        history.push({
            fromQ: existing.q,
            fromR: existing.r,
            toQ: unit.q,
            toR: unit.r,
            round: state.round
        });
        // Keep last 5 movements
        if (history.length > 5) history.shift();
    }

    memory.lastKnownPositions.set(unit.id, {
        q: unit.q,
        r: unit.r,
        round: state.round,
        confidence,
        direction,
        hp: unit.currentHp,
        class: unit.class
    });
}

/**
 * Record incoming attack for pattern learning
 */
export function recordIncomingAttack(targetUnit, attackerUnit) {
    const memory = getAIMemory();

    if (!memory.attackHistory.has(targetUnit.id)) {
        memory.attackHistory.set(targetUnit.id, []);
    }

    const history = memory.attackHistory.get(targetUnit.id);
    history.push({
        fromQ: attackerUnit.q,
        fromR: attackerUnit.r,
        round: state.round,
        attackerClass: attackerUnit.class,
        attackerId: attackerUnit.id
    });

    // Keep last 10 attacks
    if (history.length > 10) history.shift();

    // Update player tendencies
    updatePlayerTendencies(attackerUnit, targetUnit);
}

/**
 * Update player behavior tendencies based on observed actions
 */
function updatePlayerTendencies(attacker, target) {
    const memory = getAIMemory();
    const tendencies = memory.playerTendencies;

    // Update aggression based on attack distance
    const attackDist = Math.max(Math.abs(attacker.q - target.q), Math.abs(attacker.r - target.r));
    if (attackDist <= 2) {
        tendencies.aggressive = Math.min(1, tendencies.aggressive + 0.05);
    }

    // Track if player targets wounded units
    if (target.currentHp < target.maxHp * 0.5) {
        tendencies.focusFire = Math.min(1, tendencies.focusFire + 0.03);
    }

    // Record attack pattern
    memory.playerAttackPatterns.push({
        direction: Math.atan2(target.r - attacker.r, target.q - attacker.q),
        targetClass: target.class,
        targetHpPercent: target.currentHp / target.maxHp,
        round: state.round
    });

    // Keep last 20 patterns
    if (memory.playerAttackPatterns.length > 20) {
        memory.playerAttackPatterns.shift();
    }
}

/**
 * Get confidence-weighted last known position
 */
export function getLastKnownPosition(unitId) {
    const memory = getAIMemory();
    const pos = memory.lastKnownPositions.get(unitId);
    if (!pos) return null;

    // Decay confidence based on rounds passed
    const roundsAgo = state.round - pos.round;
    const decayedConfidence = pos.confidence * Math.pow(0.7, roundsAgo);

    return {
        ...pos,
        confidence: decayedConfidence
    };
}

/**
 * Clean up old memory entries
 */
export function cleanupOldMemory() {
    const memory = getAIMemory();
    const currentRound = state.round;

    // Remove positions older than 5 rounds with low confidence
    for (const [unitId, pos] of memory.lastKnownPositions) {
        const roundsAgo = currentRound - pos.round;
        if (roundsAgo > 5 && pos.confidence < 0.3) {
            memory.lastKnownPositions.delete(unitId);
        }
    }

    // Clear old searched areas
    if (currentRound % 3 === 0) {
        memory.searchedAreas.clear();
    }
}
