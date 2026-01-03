// ===== AI MINIMAX LOOK-AHEAD =====
// Simulates future game states to make better decisions
// This is the "think ahead" capability that makes AI challenging

import { state, getHex, getPlayerUnits, arePlayersAllied, isHexInZone } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { getReachableHexes } from '../pathfinding.js';
import { UNIT_CLASSES } from '../config.js';
import { getAIMemory } from './memory.js';
import { getThreatAt } from './threats.js';

// Constants for evaluation
const WEIGHTS = {
    UNIT_HP: 1.0,
    UNIT_ALIVE: 100,
    POSITION_SAFETY: 0.5,
    ATTACK_OPPORTUNITY: 2.0,
    KILL_POTENTIAL: 50,
    MEDIC_VALUE: 30,
    SNIPER_VALUE: 25,
    COVER_BONUS: 10,
    ZONE_PENALTY: -200
};

// Depth limit for simulation
const MAX_DEPTH = 2; // Look 2 moves ahead
const MAX_MOVES_PER_UNIT = 5; // Limit branching factor

/**
 * Simplified game state for simulation
 */
function createSimState(realState) {
    return {
        units: realState.units.map(u => ({
            id: u.id,
            player: u.player,
            class: u.class,
            q: u.q,
            r: u.r,
            currentHp: u.currentHp,
            maxHp: u.maxHp,
            damage: u.damage,
            range: u.range,
            move: u.move,
            alive: u.alive,
            cloaked: u.cloaked
        })),
        currentPlayer: realState.currentPlayer,
        zoneRadius: realState.zoneRadius
    };
}

/**
 * Clone simulation state
 */
function cloneSimState(simState) {
    return {
        units: simState.units.map(u => ({ ...u })),
        currentPlayer: simState.currentPlayer,
        zoneRadius: simState.zoneRadius
    };
}

/**
 * Evaluate a game state from AI's perspective
 * Positive = good for AI, Negative = bad for AI
 */
function evaluateState(simState, aiPlayer) {
    let score = 0;

    for (const unit of simState.units) {
        const isAlly = arePlayersAllied(aiPlayer, unit.player);
        const multiplier = isAlly ? 1 : -1;

        if (!unit.alive) {
            score += multiplier * WEIGHTS.UNIT_ALIVE * -1;
            continue;
        }

        // HP value
        const hpPercent = unit.currentHp / unit.maxHp;
        score += multiplier * WEIGHTS.UNIT_HP * unit.currentHp;

        // Class value bonuses
        if (unit.class === 'medic') {
            score += multiplier * WEIGHTS.MEDIC_VALUE;
        }
        if (unit.class === 'sniper') {
            score += multiplier * WEIGHTS.SNIPER_VALUE;
        }

        // Position safety (using threat map if available)
        const threat = getThreatAt(unit.q, unit.r);
        score += multiplier * WEIGHTS.POSITION_SAFETY * (100 - threat);

        // Zone awareness
        const inZone = isHexInZone(unit.q, unit.r);
        if (!inZone) {
            score += multiplier * WEIGHTS.ZONE_PENALTY;
        }

        // Cover bonus
        const hex = getHex(unit.q, unit.r);
        if (hex?.cover) {
            score += multiplier * WEIGHTS.COVER_BONUS;
        }
    }

    return score;
}

/**
 * Generate possible moves for a unit
 */
function generateMoves(unit, simState) {
    const moves = [];
    const enemies = simState.units.filter(u =>
        u.alive && !arePlayersAllied(unit.player, u.player)
    );

    // Option 1: Stay and attack if enemy in range
    for (const enemy of enemies) {
        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: enemy.q, r: enemy.r }
        );
        if (dist <= unit.range) {
            moves.push({
                type: 'attack',
                targetId: enemy.id,
                fromQ: unit.q,
                fromR: unit.r
            });
        }
    }

    // Option 2: Move to different positions
    // Simplified: just check a few strategic positions
    const positions = getStrategicPositions(unit, simState, enemies);

    for (const pos of positions.slice(0, MAX_MOVES_PER_UNIT)) {
        // Move only
        moves.push({
            type: 'move',
            toQ: pos.q,
            toR: pos.r
        });

        // Move and attack if enemy in range from new position
        for (const enemy of enemies) {
            const dist = hexDistance(
                { q: pos.q, r: pos.r },
                { q: enemy.q, r: enemy.r }
            );
            if (dist <= unit.range) {
                moves.push({
                    type: 'moveAttack',
                    toQ: pos.q,
                    toR: pos.r,
                    targetId: enemy.id
                });
            }
        }
    }

    // Option 3: Do nothing (pass)
    moves.push({ type: 'pass' });

    return moves;
}

/**
 * Get strategic positions for a unit
 */
function getStrategicPositions(unit, simState, enemies) {
    const positions = [];
    const classInfo = UNIT_CLASSES[unit.class];
    const moveRange = classInfo?.move || 3;

    // Check hexes in move range
    for (let dq = -moveRange; dq <= moveRange; dq++) {
        for (let dr = -moveRange; dr <= moveRange; dr++) {
            if (Math.abs(dq + dr) > moveRange) continue;

            const q = unit.q + dq;
            const r = unit.r + dr;
            const hex = getHex(q, r);

            if (!hex || !hex.walkable) continue;
            if (simState.units.some(u => u.alive && u.q === q && u.r === r && u.id !== unit.id)) continue;

            // Score position
            let score = 0;

            // Distance to nearest enemy
            const nearestEnemyDist = Math.min(...enemies.map(e =>
                hexDistance({ q, r }, { q: e.q, r: e.r })
            ));

            // Prefer being in attack range but not too close
            if (nearestEnemyDist <= unit.range && nearestEnemyDist >= 2) {
                score += 30;
            }

            // Cover bonus
            if (hex.cover) score += 20;

            // Zone check
            if (!isHexInZone(q, r)) score -= 100;

            // Threat penalty
            score -= getThreatAt(q, r) * 0.3;

            positions.push({ q, r, score });
        }
    }

    // Sort by score
    return positions.sort((a, b) => b.score - a.score);
}

/**
 * Apply a move to simulation state
 */
function applyMove(simState, unit, move) {
    const newState = cloneSimState(simState);
    const simUnit = newState.units.find(u => u.id === unit.id);

    if (!simUnit || !simUnit.alive) return newState;

    switch (move.type) {
        case 'move':
            simUnit.q = move.toQ;
            simUnit.r = move.toR;
            break;

        case 'attack': {
            const target = newState.units.find(u => u.id === move.targetId);
            if (target && target.alive) {
                // Simplified damage calculation
                const damage = simUnit.damage;
                target.currentHp -= damage;
                if (target.currentHp <= 0) {
                    target.alive = false;
                }
            }
            break;
        }

        case 'moveAttack': {
            simUnit.q = move.toQ;
            simUnit.r = move.toR;
            const target = newState.units.find(u => u.id === move.targetId);
            if (target && target.alive) {
                const damage = simUnit.damage;
                target.currentHp -= damage;
                if (target.currentHp <= 0) {
                    target.alive = false;
                }
            }
            break;
        }

        case 'pass':
        default:
            break;
    }

    return newState;
}

/**
 * Minimax algorithm with alpha-beta pruning
 */
function minimax(simState, depth, alpha, beta, isMaximizing, aiPlayer) {
    // Terminal conditions
    if (depth === 0) {
        return { score: evaluateState(simState, aiPlayer), move: null };
    }

    const aiUnits = simState.units.filter(u =>
        u.alive && arePlayersAllied(aiPlayer, u.player)
    );
    const enemyUnits = simState.units.filter(u =>
        u.alive && !arePlayersAllied(aiPlayer, u.player)
    );

    // Check for game over
    if (aiUnits.length === 0) {
        return { score: -10000, move: null };
    }
    if (enemyUnits.length === 0) {
        return { score: 10000, move: null };
    }

    if (isMaximizing) {
        // AI's turn - maximize score
        let bestScore = -Infinity;
        let bestMove = null;

        for (const unit of aiUnits) {
            const moves = generateMoves(unit, simState);

            for (const move of moves.slice(0, MAX_MOVES_PER_UNIT)) {
                const newState = applyMove(simState, unit, move);
                const result = minimax(newState, depth - 1, alpha, beta, false, aiPlayer);

                if (result.score > bestScore) {
                    bestScore = result.score;
                    bestMove = { unit, move };
                }

                alpha = Math.max(alpha, bestScore);
                if (beta <= alpha) break; // Prune
            }
        }

        return { score: bestScore, move: bestMove };
    } else {
        // Enemy's turn - minimize score (assume optimal play)
        let bestScore = Infinity;
        let bestMove = null;

        for (const unit of enemyUnits) {
            const moves = generateMoves(unit, simState);

            for (const move of moves.slice(0, MAX_MOVES_PER_UNIT)) {
                const newState = applyMove(simState, unit, move);
                const result = minimax(newState, depth - 1, alpha, beta, true, aiPlayer);

                if (result.score < bestScore) {
                    bestScore = result.score;
                    bestMove = { unit, move };
                }

                beta = Math.min(beta, bestScore);
                if (beta <= alpha) break; // Prune
            }
        }

        return { score: bestScore, move: bestMove };
    }
}

/**
 * Find the best move for a unit using minimax
 */
export function findBestMoveForUnit(unit, enemies, allies) {
    const simState = createSimState(state);

    // Generate moves for this unit
    const moves = generateMoves(unit, simState);
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
        const newState = applyMove(simState, unit, move);

        // Evaluate with minimax lookahead
        const result = minimax(newState, MAX_DEPTH - 1, -Infinity, Infinity, false, state.currentPlayer);

        if (result.score > bestScore) {
            bestScore = result.score;
            bestMove = move;
        }
    }

    return { move: bestMove, score: bestScore };
}

/**
 * Evaluate if a specific move is good using minimax
 */
export function evaluateMove(unit, targetQ, targetR, targetUnit = null) {
    const simState = createSimState(state);

    let move;
    if (targetUnit) {
        move = {
            type: 'moveAttack',
            toQ: targetQ,
            toR: targetR,
            targetId: targetUnit.id
        };
    } else {
        move = {
            type: 'move',
            toQ: targetQ,
            toR: targetR
        };
    }

    const newState = applyMove(simState, unit, move);
    const result = minimax(newState, MAX_DEPTH - 1, -Infinity, Infinity, false, state.currentPlayer);

    return result.score;
}

/**
 * Get strategic recommendation for the current situation
 */
export function getStrategicRecommendation(aiUnits, enemies) {
    if (enemies.length === 0) {
        return { strategy: 'search', confidence: 1.0 };
    }

    // Evaluate current position
    const simState = createSimState(state);
    const currentScore = evaluateState(simState, state.currentPlayer);

    // Count advantageous positions
    let attackOpportunities = 0;
    let unitsAtRisk = 0;

    for (const unit of aiUnits) {
        if (!unit.alive) continue;

        const threat = getThreatAt(unit.q, unit.r);
        if (threat > unit.currentHp * 0.5) {
            unitsAtRisk++;
        }

        for (const enemy of enemies) {
            const dist = hexDistance(
                { q: unit.q, r: unit.r },
                { q: enemy.q, r: enemy.r }
            );
            if (dist <= unit.range) {
                attackOpportunities++;
            }
        }
    }

    // Determine strategy
    if (unitsAtRisk > aiUnits.filter(u => u.alive).length / 2) {
        return { strategy: 'defensive', confidence: 0.8 };
    }

    if (attackOpportunities >= enemies.length) {
        return { strategy: 'aggressive', confidence: 0.9 };
    }

    if (currentScore > 0) {
        return { strategy: 'balanced', confidence: 0.7 };
    }

    return { strategy: 'cautious', confidence: 0.6 };
}

/**
 * Quick evaluation without full minimax (for time-sensitive decisions)
 */
export function quickEvaluatePosition(unit, q, r, enemies) {
    let score = 0;

    // Threat from enemies
    for (const enemy of enemies) {
        const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });

        if (dist <= enemy.range) {
            score -= enemy.damage * 0.8;
        } else if (dist <= enemy.range + enemy.move) {
            score -= enemy.damage * 0.3;
        }
    }

    // Attack opportunities
    for (const enemy of enemies) {
        const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
        if (dist <= unit.range) {
            score += unit.damage * 0.5;

            // Kill potential bonus
            if (enemy.currentHp <= unit.damage) {
                score += 50;
            }
        }
    }

    // Cover bonus
    const hex = getHex(q, r);
    if (hex?.cover) score += 15;

    // Zone check
    if (!isHexInZone(q, r)) score -= 200;

    return score;
}
