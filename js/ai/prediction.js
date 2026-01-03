// ===== AI PREDICTION SYSTEM =====
// Predicts player movements and attacks based on behavior patterns
// This enables the AI to "think ahead" and anticipate player actions

import { state, getHex, getPlayerUnits, arePlayersAllied, isHexInZone } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { getReachableHexes } from '../pathfinding.js';
import { getAIMemory, getLastKnownPosition } from './memory.js';
import { getThreatAt, getInfluenceAt } from './threats.js';
import { CONFIG } from '../config.js';

/**
 * Predict where an enemy unit is likely to move next turn
 * Based on: movement history, tendencies, tactical situation
 */
export function predictEnemyMovement(enemy, aiUnits) {
    const memory = getAIMemory();
    const predictions = [];

    // Get movement history
    const movementHistory = memory.movementHistory.get(enemy.id) || [];

    // Calculate possible destinations
    const reachable = getReachableHexes(enemy);

    reachable.forEach((data, key) => {
        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || (hex.unit && hex.unit.id !== enemy.id)) return;

        let probability = 0.1; // Base probability

        // Factor 1: Continuation of movement direction
        if (movementHistory.length > 0) {
            const lastMove = movementHistory[movementHistory.length - 1];
            const prevDirection = {
                dq: lastMove.toQ - lastMove.fromQ,
                dr: lastMove.toR - lastMove.fromR
            };
            const newDirection = {
                dq: q - enemy.q,
                dr: r - enemy.r
            };

            // Check if continuing in same general direction
            const directionMatch =
                (prevDirection.dq * newDirection.dq >= 0) &&
                (prevDirection.dr * newDirection.dr >= 0);

            if (directionMatch) {
                probability += 0.15;
            }
        }

        // Factor 2: Attack opportunity (aggressive players)
        const tendencies = memory.playerTendencies;
        let hasAttackOpportunity = false;

        for (const ally of aiUnits) {
            if (!ally.alive) continue;
            const dist = hexDistance({ q, r }, { q: ally.q, r: ally.r });
            if (dist <= enemy.range) {
                hasAttackOpportunity = true;
                probability += 0.2 * tendencies.aggressive;

                // Extra probability for wounded targets
                if (ally.currentHp < ally.maxHp * 0.5) {
                    probability += 0.15 * tendencies.focusFire;
                }
            }
        }

        // Factor 3: Cover seeking (defensive players)
        if (hex.cover) {
            probability += 0.1 * (1 - tendencies.aggressive);
        }

        // Factor 4: High ground preference
        if (hex.type === 'hills') {
            if (enemy.class === 'sniper') {
                probability += 0.2;
            } else {
                probability += 0.05;
            }
        }

        // Factor 5: Zone awareness
        if (!isHexInZone(q, r)) {
            probability = 0; // Player won't move outside zone
        } else {
            const distFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
            const distFromEdge = state.zoneRadius - distFromCenter;
            if (distFromEdge <= 2) {
                probability -= 0.1; // Less likely to be near edge
            }
        }

        // Factor 6: Class-specific behavior
        switch (enemy.class) {
            case 'sniper':
                // Snipers prefer distance
                const avgDistToUs = aiUnits.reduce((sum, u) =>
                    sum + hexDistance({ q, r }, { q: u.q, r: u.r }), 0) / Math.max(1, aiUnits.length);
                if (avgDistToUs >= 5) probability += 0.15;
                if (avgDistToUs <= 3) probability -= 0.2;
                break;

            case 'commando':
                // Commandos seek close range
                const closestDist = Math.min(...aiUnits.map(u =>
                    hexDistance({ q, r }, { q: u.q, r: u.r })));
                if (closestDist <= 2) probability += 0.2;
                break;

            case 'medic':
                // Medics stay near allies
                const playerAllies = state.units.filter(u =>
                    u.alive && u.id !== enemy.id && arePlayersAllied(enemy.player, u.player));
                const nearAlly = playerAllies.some(a =>
                    hexDistance({ q, r }, { q: a.q, r: a.r }) <= 4);
                if (nearAlly) probability += 0.15;
                break;

            case 'assault':
                // Assault pushes forward
                if (hasAttackOpportunity) probability += 0.1;
                break;
        }

        // Factor 7: Retreat behavior when low HP
        if (enemy.currentHp < enemy.maxHp * tendencies.retreatThreshold) {
            // Likely to retreat
            const currentThreat = getThreatAt(enemy.q, enemy.r);
            const newThreat = getThreatAt(q, r);
            if (newThreat < currentThreat * 0.7) {
                probability += 0.25; // Likely to move to safer position
            }
        }

        if (probability > 0) {
            predictions.push({
                q, r,
                probability: Math.min(1, probability),
                hasAttackOpportunity,
                cost: data.cost
            });
        }
    });

    // Normalize probabilities
    const totalProb = predictions.reduce((sum, p) => sum + p.probability, 0);
    if (totalProb > 0) {
        predictions.forEach(p => p.probability /= totalProb);
    }

    // Sort by probability
    predictions.sort((a, b) => b.probability - a.probability);

    // Store top prediction in memory
    if (predictions.length > 0) {
        memory.predictedPositions.set(enemy.id, {
            q: predictions[0].q,
            r: predictions[0].r,
            confidence: predictions[0].probability
        });
    }

    return predictions;
}

/**
 * Predict which of our units the enemy is likely to attack
 */
export function predictAttackTargets(enemy, aiUnits) {
    const memory = getAIMemory();
    const tendencies = memory.playerTendencies;
    const targets = [];

    for (const ally of aiUnits) {
        if (!ally.alive) continue;

        const dist = hexDistance({ q: enemy.q, r: enemy.r }, { q: ally.q, r: ally.r });

        // Can only attack if in range (now or after moving)
        if (dist > enemy.range + enemy.move) continue;

        let targetProbability = 0.1;

        // Factor 1: Already in range (high probability)
        if (dist <= enemy.range) {
            targetProbability += 0.3;
        }

        // Factor 2: Low HP targets (focus fire tendency)
        const hpPercent = ally.currentHp / ally.maxHp;
        if (hpPercent < 0.3) {
            targetProbability += 0.35 * tendencies.focusFire;
        } else if (hpPercent < 0.5) {
            targetProbability += 0.2 * tendencies.focusFire;
        }

        // Factor 3: Can kill this target
        if (ally.currentHp <= enemy.damage) {
            targetProbability += 0.25;
        }

        // Factor 4: Target class priority
        if (ally.class === 'medic') {
            targetProbability += 0.15; // Players often target medics
        }
        if (ally.class === 'sniper') {
            targetProbability += 0.1; // Snipers are annoying
        }

        // Factor 5: Historical attack patterns
        const attackHistory = memory.attackHistory.get(ally.id) || [];
        const recentAttacks = attackHistory.filter(a => state.round - a.round <= 3);
        if (recentAttacks.length > 0) {
            targetProbability += 0.1; // Already being focused
        }

        // Factor 6: Exposed position
        const allyHex = getHex(ally.q, ally.r);
        if (!allyHex?.cover) {
            targetProbability += 0.1;
        }

        targets.push({
            unit: ally,
            probability: Math.min(1, targetProbability),
            inRange: dist <= enemy.range,
            distance: dist,
            hpPercent
        });
    }

    // Normalize
    const total = targets.reduce((sum, t) => sum + t.probability, 0);
    if (total > 0) {
        targets.forEach(t => t.probability /= total);
    }

    return targets.sort((a, b) => b.probability - a.probability);
}

/**
 * Simulate one turn of enemy actions and predict outcomes
 * This is a simplified "look-ahead" - what could happen next turn
 */
export function simulateEnemyTurn(enemies, aiUnits) {
    const outcomes = [];

    for (const enemy of enemies) {
        // Get movement predictions
        const movePredictions = predictEnemyMovement(enemy, aiUnits);
        const attackTargets = predictAttackTargets(enemy, aiUnits);

        if (movePredictions.length === 0) continue;

        // Most likely scenario
        const likelyMove = movePredictions[0];
        const likelyTarget = attackTargets[0];

        outcomes.push({
            enemy,
            predictedPosition: { q: likelyMove.q, r: likelyMove.r },
            moveProbability: likelyMove.probability,
            predictedTarget: likelyTarget?.unit || null,
            attackProbability: likelyTarget?.probability || 0,
            potentialDamage: likelyTarget ? enemy.damage : 0,
            couldKill: likelyTarget ? likelyTarget.unit.currentHp <= enemy.damage : false
        });
    }

    return outcomes;
}

/**
 * Identify which of our units are in danger next turn
 */
export function identifyUnitsAtRisk(aiUnits, enemies) {
    const atRisk = [];

    for (const unit of aiUnits) {
        if (!unit.alive) continue;

        let totalThreat = 0;
        let potentialDamage = 0;
        const threateningEnemies = [];

        for (const enemy of enemies) {
            const dist = hexDistance({ q: unit.q, r: unit.r }, { q: enemy.q, r: enemy.r });

            // Can this enemy attack us?
            if (dist <= enemy.range + enemy.move) {
                const attackTargets = predictAttackTargets(enemy, [unit]);
                if (attackTargets.length > 0) {
                    const targetProb = attackTargets[0].probability;
                    potentialDamage += enemy.damage * targetProb;
                    totalThreat += targetProb;
                    threateningEnemies.push({ enemy, probability: targetProb });
                }
            }
        }

        if (totalThreat > 0) {
            atRisk.push({
                unit,
                potentialDamage,
                survivalChance: Math.max(0, (unit.currentHp - potentialDamage) / unit.currentHp),
                threateningEnemies,
                needsProtection: potentialDamage >= unit.currentHp * 0.5,
                inMortalDanger: potentialDamage >= unit.currentHp
            });
        }
    }

    return atRisk.sort((a, b) => b.potentialDamage - a.potentialDamage);
}

/**
 * Find positions where we can "bait" the player
 * These are positions that look vulnerable but are actually traps
 */
export function findBaitPositions(unit, enemies, aiUnits) {
    const memory = getAIMemory();
    const tendencies = memory.playerTendencies;
    const baitPositions = [];

    const reachable = getReachableHexes(unit);

    reachable.forEach((data, key) => {
        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || (hex.unit && hex.unit.id !== unit.id)) return;

        let baitScore = 0;

        // How "tempting" is this position for enemies?
        let enemiesWhoCouldAttack = 0;
        let averageEnemyDist = 0;

        for (const enemy of enemies) {
            const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
            if (dist <= enemy.range + enemy.move) {
                enemiesWhoCouldAttack++;
                averageEnemyDist += dist;

                // Position is more tempting if just barely in reach
                if (dist === enemy.range || dist === enemy.range + 1) {
                    baitScore += 20;
                }
            }
        }

        if (enemiesWhoCouldAttack === 0) return; // Not useful as bait

        averageEnemyDist /= enemiesWhoCouldAttack;

        // Make position look "weak"
        if (!hex.cover) {
            baitScore += 10; // Looks exposed
        }

        // But ensure we have backup nearby!
        let nearbyAllies = 0;
        let allyDamageSupport = 0;

        for (const ally of aiUnits) {
            if (ally.id === unit.id || !ally.alive) continue;

            const allyDist = hexDistance({ q, r }, { q: ally.q, r: ally.r });

            // Allies who can support if enemies attack
            if (allyDist <= ally.range + 2) {
                nearbyAllies++;
                allyDamageSupport += ally.damage;
            }
        }

        // Good bait position: looks weak, but has backup
        if (nearbyAllies >= 1 && allyDamageSupport >= 30) {
            baitScore += 30;
        } else {
            baitScore -= 50; // Too risky without backup
        }

        // Player aggression factor
        baitScore *= (0.5 + tendencies.aggressive);

        // Penalty for actually dangerous positions
        const threat = getThreatAt(q, r);
        if (threat > unit.currentHp * 0.7) {
            baitScore -= 40; // Too dangerous even as bait
        }

        if (baitScore > 20) {
            baitPositions.push({
                q, r,
                cost: data.cost,
                baitScore,
                enemiesWhoCouldAttack,
                nearbyAllies,
                allyDamageSupport,
                threat
            });
        }
    });

    return baitPositions.sort((a, b) => b.baitScore - a.baitScore);
}

/**
 * Calculate "post-attack safety" - how safe will we be after attacking?
 * This helps avoid over-extending
 */
export function calculatePostAttackSafety(unit, targetEnemy, moveToQ, moveToR, enemies, aiUnits) {
    // Simulate: we move to (moveToQ, moveToR) and attack targetEnemy
    // How many enemies can then attack us?

    let counterAttackDamage = 0;
    let counterAttackers = 0;

    for (const enemy of enemies) {
        if (enemy.id === targetEnemy.id && targetEnemy.currentHp <= unit.damage) {
            continue; // This enemy will be dead
        }

        const enemyDist = hexDistance({ q: moveToQ, r: moveToR }, { q: enemy.q, r: enemy.r });

        // Can enemy reach and attack us next turn?
        if (enemyDist <= enemy.range) {
            counterAttackers++;
            counterAttackDamage += enemy.damage;
        } else if (enemyDist <= enemy.range + enemy.move) {
            counterAttackers++;
            counterAttackDamage += enemy.damage * 0.7; // May use AP moving
        }
    }

    // How much support do we have?
    let allySupport = 0;
    for (const ally of aiUnits) {
        if (ally.id === unit.id || !ally.alive) continue;
        const allyDist = hexDistance({ q: moveToQ, r: moveToR }, { q: ally.q, r: ally.r });
        if (allyDist <= 3) {
            allySupport += ally.damage * 0.3;
        }
    }

    const hex = getHex(moveToQ, moveToR);
    const coverBonus = hex?.cover ? 0.75 : 1.0;

    const effectiveDamage = counterAttackDamage * coverBonus;
    const survivalHP = unit.currentHp - effectiveDamage;

    return {
        counterAttackers,
        counterAttackDamage: effectiveDamage,
        allySupport,
        survivalHP,
        isSafe: survivalHP > unit.maxHp * 0.3,
        isDangerous: survivalHP <= 0 || counterAttackers >= 3
    };
}
