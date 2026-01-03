// ===== AI POSITIONING SYSTEM =====
// Improved position scoring using threat maps and predictions
// This integrates tactical awareness into movement decisions

import { state, getHex, getPlayerUnits, isHexInZone, arePlayersAllied } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { getReachableHexes } from '../pathfinding.js';
import { getAIMemory } from './memory.js';
import { getThreatAt, getInfluenceAt, isInDangerZone, findAttackOpportunities } from './threats.js';
import { calculatePostAttackSafety, identifyUnitsAtRisk } from './prediction.js';
import { CONFIG } from '../config.js';

/**
 * Get all allied AI units (including from allied players)
 */
export function getAllAlliedAIUnits() {
    const alliedUnits = [];
    for (let p = 0; p < state.settings.players; p++) {
        if (arePlayersAllied(state.currentPlayer, p)) {
            alliedUnits.push(...getPlayerUnits(p).filter(u => u.alive));
        }
    }
    return alliedUnits;
}

/**
 * IMPROVED: Score combat position with threat awareness
 * Now considers: threat maps, post-attack safety, predictions
 */
export function scoreCombatPosition(unit, q, r, enemies, plan) {
    let score = 0;
    const hex = getHex(q, r);
    const memory = getAIMemory();

    if (!hex) return -1000;

    // === THREAT MAP INTEGRATION ===
    const threat = getThreatAt(q, r);
    const influence = getInfluenceAt(q, r);

    // Penalize dangerous positions more heavily
    score -= threat * 0.8;

    // Bonus for positions we control
    if (influence.control > 0) {
        score += influence.control * 5;
    }

    // Get assigned target or closest enemy
    const assignedId = memory.assignedTargets.get(unit.id);
    const primaryTarget = assignedId
        ? enemies.find(e => e.id === assignedId)
        : enemies[0];

    if (primaryTarget) {
        const distToTarget = hexDistance({ q, r }, { q: primaryTarget.q, r: primaryTarget.r });

        // === CLASS-SPECIFIC IDEAL DISTANCE ===
        let idealDist, minDist, maxDist;

        switch (unit.class) {
            case 'sniper':
                idealDist = unit.range;
                minDist = 4;
                maxDist = unit.range;
                break;
            case 'commando':
                idealDist = 1;
                minDist = 1;
                maxDist = 2;
                break;
            case 'assault':
                idealDist = 2;
                minDist = 1;
                maxDist = unit.range;
                break;
            case 'scout':
                idealDist = 3;
                minDist = 2;
                maxDist = unit.range;
                break;
            case 'medic':
                idealDist = 4;
                minDist = 3;
                maxDist = 5;
                break;
            default:
                idealDist = unit.range;
                minDist = 1;
                maxDist = unit.range;
        }

        // Distance scoring
        const distDiff = Math.abs(distToTarget - idealDist);
        score -= distDiff * 15;

        if (distToTarget < minDist) {
            score -= (minDist - distToTarget) * 30;
        }
        if (distToTarget > maxDist) {
            score -= (distToTarget - maxDist) * 20;
        }

        // In attack range bonus
        if (distToTarget <= unit.range) {
            score += 60;

            // === NEW: POST-ATTACK SAFETY CHECK ===
            const safety = calculatePostAttackSafety(
                unit, primaryTarget, q, r, enemies,
                getAllAlliedAIUnits()
            );

            if (safety.isDangerous) {
                score -= 80; // Penalize overextension
            } else if (safety.isSafe) {
                score += 30; // Bonus for safe attack positions
            }

            // Kill shot bonus (still worth taking some risk)
            if (primaryTarget.currentHp <= unit.damage) {
                score += 50;
            }

            if (distToTarget === idealDist) score += 30;
        }
    }

    // === TERRAIN PREFERENCES BY CLASS ===
    if (hex.cover) {
        const coverBonus = {
            sniper: 40, medic: 40, commando: 35, scout: 20, assault: 15
        };
        score += coverBonus[unit.class] || 20;
    }

    if (hex.type === 'hills') {
        const hillBonus = {
            sniper: 50, scout: 40, medic: 20, assault: 10, commando: 10
        };
        score += hillBonus[unit.class] || 15;
    }

    // === FLANKING BONUS ===
    const allies = getAllAlliedAIUnits().filter(u => u.id !== unit.id);
    if (primaryTarget && allies.length > 0) {
        const avgAllyAngle = allies.reduce((sum, a) => {
            return sum + Math.atan2(a.r - primaryTarget.r, a.q - primaryTarget.q);
        }, 0) / allies.length;

        const myAngle = Math.atan2(r - primaryTarget.r, q - primaryTarget.q);
        const angleDiff = Math.abs(myAngle - avgAllyAngle);

        const flankBonus = unit.class === 'commando' ? 40 : 25;
        if (angleDiff > Math.PI / 3) score += flankBonus;
    }

    // === MEDIC: STAY NEAR WOUNDED ALLIES ===
    if (unit.class === 'medic') {
        for (const ally of allies) {
            const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
            if (distToAlly <= 4) {
                score += 15;
                if (ally.currentHp < ally.maxHp * 0.7) {
                    score += 25;
                }
            }
        }
    }

    // === AVOID CLUSTERING ===
    for (const ally of allies) {
        const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
        if (distToAlly <= 1) score -= 25;
        else if (distToAlly === 2) score -= 10;
    }

    // === NEW: PROTECT VULNERABLE ALLIES ===
    const unitsAtRisk = identifyUnitsAtRisk(allies, enemies);
    for (const risk of unitsAtRisk) {
        if (risk.inMortalDanger && unit.class === 'assault') {
            // Assault should position to protect endangered allies
            const distToEndangered = hexDistance({ q, r }, { q: risk.unit.q, r: risk.unit.r });
            if (distToEndangered <= 2) {
                score += 20; // Bonus for protecting teammates
            }
        }
    }

    return score;
}

/**
 * IMPROVED: Score hunt position with prediction awareness
 */
export function scoreHuntPosition(unit, q, r, plan) {
    let score = 0;
    const hex = getHex(q, r);
    const memory = getAIMemory();

    // Zone check
    if (!isHexInZone(q, r)) {
        return -500;
    }

    // Endgame aggression
    if (memory.isEndgame) {
        score += 40;
    }

    // === USE PREDICTED POSITIONS ===
    const predictions = Array.from(memory.predictedPositions.values());
    if (predictions.length > 0) {
        // Move toward highest confidence prediction
        const bestPrediction = predictions.sort((a, b) => b.confidence - a.confidence)[0];
        const distToPredicted = hexDistance({ q, r }, { q: bestPrediction.q, r: bestPrediction.r });

        score += (15 - distToPredicted) * 20;

        if (distToPredicted <= unit.range) {
            score += 60; // In range of predicted position!
        }
    }

    // Last known positions (lower confidence)
    const positions = plan.knownEnemyPositions?.sort((a, b) => b.confidence - a.confidence) || [];
    if (positions.length > 0) {
        const target = positions[0];
        const dist = hexDistance({ q, r }, { q: target.q, r: target.r });
        score += (15 - dist) * 15;

        if (dist <= unit.range) {
            score += 50;
        }
    }

    // Player center estimate
    if (memory.playerCenterEstimate) {
        const distToCenter = hexDistance({ q, r }, memory.playerCenterEstimate);
        score -= distToCenter * 6;
    }

    // === SPREAD OUT DURING HUNT ===
    const allies = getAllAlliedAIUnits().filter(u => u.id !== unit.id);
    for (const ally of allies) {
        const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
        if (distToAlly <= 2) {
            score -= 50;
        } else if (distToAlly >= 3 && distToAlly <= 6) {
            score += 25;
        }
    }

    // Movement bonus
    const moveDist = hexDistance({ q, r }, { q: unit.q, r: unit.r });
    if (moveDist >= 2) {
        score += moveDist * 15;
    }

    // Terrain bonuses
    if (hex?.type === 'hills') {
        score += 50;
    }
    if (hex?.cover) {
        score += 15;
    }

    return score;
}

/**
 * IMPROVED: Score search position with better exploration
 */
export function scoreSearchPosition(unit, q, r, plan) {
    let score = 0;
    const hexKey = `${q},${r}`;
    const memory = getAIMemory();

    // Zone check
    if (!isHexInZone(q, r)) {
        return -500;
    }

    const distFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
    const distFromZoneEdge = state.zoneRadius - distFromCenter;

    if (distFromZoneEdge <= 2) {
        score -= 25;
    }

    // Endgame: rush center
    if (memory.isEndgame) {
        score -= distFromCenter * 10;
        score += 50;
    }

    // Exploration bonus
    const aiExplored = state.playerExploredHexes?.[state.currentPlayer];
    if (!aiExplored || !aiExplored.has(hexKey)) {
        score += 90;
    }

    // Recently searched penalty
    if (memory.searchedAreas.has(hexKey)) {
        score -= 40;
    }

    // === SPREAD OUT ===
    const allies = getAllAlliedAIUnits().filter(u => u.id !== unit.id);
    for (const ally of allies) {
        const distToAlly = hexDistance({ q, r }, { q: ally.q, r: ally.r });
        if (distToAlly <= 2) {
            score -= 60;
        } else if (distToAlly >= 4 && distToAlly <= 7) {
            score += 35;
        }
    }

    // Movement bonus
    const currentDist = hexDistance({ q, r }, { q: unit.q, r: unit.r });
    if (currentDist >= 2) {
        score += currentDist * 15;
    }

    // Enemy spawn areas
    const mapRadius = CONFIG.MAP_SIZES[state.settings.size];

    // Search pattern specific
    switch (plan.searchPattern) {
        case 'expand':
            if (distFromZoneEdge > 3) {
                const distFromStart = Math.sqrt(q * q + r * r);
                const currentStartDist = Math.sqrt(unit.q * unit.q + unit.r * unit.r);
                if (distFromStart > currentStartDist) {
                    score += 30;
                }
            }
            break;

        case 'sweep':
            const avgAllyR = allies.reduce((sum, u) => sum + u.r, 0) / (allies.length || 1);
            score -= Math.abs(r - avgAllyR) * 3;
            score += currentDist * 10;
            break;

        case 'pincer':
            if (memory.playerCenterEstimate) {
                const estPos = memory.playerCenterEstimate;
                if (isHexInZone(Math.round(estPos.q), Math.round(estPos.r))) {
                    const distToEst = hexDistance({ q, r }, estPos);
                    if (distToEst > 2) {
                        score -= distToEst * 6;
                    }
                }
            }
            break;
    }

    // Zone shrinking factor
    const zoneShrinkFactor = state.zoneRadius < mapRadius ? 2 : 1;
    score -= distFromCenter * (plan.inHuntMode ? 3 : 2) * zoneShrinkFactor;

    // Terrain
    const hex = getHex(q, r);
    if (hex?.type === 'hills') {
        const visionBonus = (unit.class === 'scout' || unit.class === 'sniper') ? 45 : 25;
        score += visionBonus;
    }

    // Small random factor
    score += Math.random() * 10;

    return score;
}

/**
 * NEW: Select best strategic move considering all factors
 */
export function selectStrategicMoveTarget(unit, plan, maxAP = state.sharedAP) {
    const reachable = getReachableHexes(unit);
    if (reachable.size === 0) return null;

    const enemies = plan.visibleEnemies;
    const candidates = [];

    reachable.forEach((data, key) => {
        if (data.cost > maxAP) return;

        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || hex.unit) return;

        let score = 0;

        if (enemies.length > 0) {
            score = scoreCombatPosition(unit, q, r, enemies, plan);
        } else if (plan.knownEnemyPositions?.length > 0) {
            score = scoreHuntPosition(unit, q, r, plan);
        } else {
            score = scoreSearchPosition(unit, q, r, plan);
        }

        // Movement cost penalty
        score -= data.cost * 5;

        candidates.push({ q, r, cost: data.cost, score });
    });

    if (candidates.length === 0) return null;

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);

    return candidates[0];
}

/**
 * NEW: Find optimal attack position (move + attack combo)
 */
export function findOptimalAttackPosition(unit, enemies, maxAP = state.sharedAP) {
    const opportunities = findAttackOpportunities(unit, enemies);

    if (opportunities.length === 0) return null;

    // Filter by AP budget (need 1 AP for attack)
    const affordable = opportunities.filter(o => o.cost + 1 <= maxAP);

    if (affordable.length === 0) return null;

    // Return best opportunity
    return affordable[0];
}
