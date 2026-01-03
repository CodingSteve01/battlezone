// ===== AI THREAT ANALYSIS SYSTEM =====
// Calculates threat maps, danger zones, and influence for strategic decisions
// This is the KEY to making AI "think ahead" like humans do

import { state, getHex, getPlayerUnits, arePlayersAllied, isHexInZone } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { getReachableHexes } from '../pathfinding.js';
import { getAIMemory } from './memory.js';
import { CONFIG } from '../config.js';

/**
 * Calculate complete threat map for current game state
 * A threat map shows how dangerous each hex is based on enemy positions and capabilities
 */
export function calculateThreatMap(enemies, aiUnits) {
    const memory = getAIMemory();
    memory.threatMap.clear();
    memory.dangerZones.clear();
    memory.safeZones.clear();

    const mapRadius = CONFIG.MAP_SIZES[state.settings.size] || 12;

    // For each hex on the map
    for (let q = -mapRadius; q <= mapRadius; q++) {
        for (let r = -mapRadius; r <= mapRadius; r++) {
            if (Math.abs(q + r) > mapRadius) continue;

            const hex = getHex(q, r);
            if (!hex || !hex.walkable) continue;

            const key = `${q},${r}`;
            let threatLevel = 0;

            // Calculate threat from each enemy
            for (const enemy of enemies) {
                const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });

                // Direct attack threat
                if (dist <= enemy.range) {
                    // In attack range - HIGH threat
                    threatLevel += enemy.damage * 1.5;
                } else if (dist <= enemy.range + enemy.move) {
                    // Can reach and attack this turn - MEDIUM threat
                    const movesNeeded = dist - enemy.range;
                    threatLevel += enemy.damage * (1 - movesNeeded * 0.15);
                } else if (dist <= enemy.range + enemy.move + 2) {
                    // Can reach next turn - LOW threat
                    threatLevel += enemy.damage * 0.3;
                }

                // Class-specific threat adjustments
                if (enemy.class === 'sniper' && dist <= enemy.range) {
                    threatLevel += 20; // Snipers are extra dangerous at range
                }
                if (enemy.class === 'commando' && dist <= 3) {
                    threatLevel += 25; // Commandos are deadly up close
                }
                if (enemy.class === 'assault' && dist <= enemy.range) {
                    threatLevel += 15; // Assault has high damage
                }
            }

            // Terrain modifiers
            if (hex.cover) {
                threatLevel *= 0.7; // Cover reduces effective threat
            }
            if (hex.type === 'hills') {
                threatLevel *= 0.85; // Hills give defensive bonus
            }

            // Zone edge penalty
            if (!isHexInZone(q, r)) {
                threatLevel += 200; // Outside zone is deadly
            } else {
                const distFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
                const distFromEdge = state.zoneRadius - distFromCenter;
                if (distFromEdge <= 1) {
                    threatLevel += 50; // Near zone edge is risky
                }
            }

            memory.threatMap.set(key, threatLevel);

            // Classify zones
            if (threatLevel > 80) {
                memory.dangerZones.add(key);
            } else if (threatLevel < 20) {
                memory.safeZones.add(key);
            }
        }
    }

    return memory.threatMap;
}

/**
 * Calculate influence map showing control of territory
 */
export function calculateInfluenceMap(enemies, aiUnits) {
    const memory = getAIMemory();
    memory.influenceMap.clear();

    const mapRadius = CONFIG.MAP_SIZES[state.settings.size] || 12;

    for (let q = -mapRadius; q <= mapRadius; q++) {
        for (let r = -mapRadius; r <= mapRadius; r++) {
            if (Math.abs(q + r) > mapRadius) continue;

            const hex = getHex(q, r);
            if (!hex || !hex.walkable) continue;

            const key = `${q},${r}`;
            let friendlyInfluence = 0;
            let enemyInfluence = 0;

            // Calculate friendly influence
            for (const unit of aiUnits) {
                if (!unit.alive) continue;
                const dist = hexDistance({ q, r }, { q: unit.q, r: unit.r });

                // Units project influence based on their capabilities
                const influenceRange = unit.range + unit.move;
                if (dist <= influenceRange) {
                    const strength = (influenceRange - dist + 1) * (unit.currentHp / unit.maxHp);
                    friendlyInfluence += strength * (unit.damage / 30); // Normalize by average damage
                }
            }

            // Calculate enemy influence
            for (const enemy of enemies) {
                const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
                const influenceRange = enemy.range + enemy.move;

                if (dist <= influenceRange) {
                    const strength = (influenceRange - dist + 1) * (enemy.currentHp / enemy.maxHp);
                    enemyInfluence += strength * (enemy.damage / 30);
                }
            }

            memory.influenceMap.set(key, {
                friendly: friendlyInfluence,
                enemy: enemyInfluence,
                control: friendlyInfluence - enemyInfluence
            });
        }
    }

    return memory.influenceMap;
}

/**
 * Get threat level at a specific hex
 */
export function getThreatAt(q, r) {
    const memory = getAIMemory();
    return memory.threatMap.get(`${q},${r}`) || 0;
}

/**
 * Get influence at a specific hex
 */
export function getInfluenceAt(q, r) {
    const memory = getAIMemory();
    return memory.influenceMap.get(`${q},${r}`) || { friendly: 0, enemy: 0, control: 0 };
}

/**
 * Check if hex is in danger zone
 */
export function isInDangerZone(q, r) {
    const memory = getAIMemory();
    return memory.dangerZones.has(`${q},${r}`);
}

/**
 * Check if hex is in safe zone
 */
export function isInSafeZone(q, r) {
    const memory = getAIMemory();
    return memory.safeZones.has(`${q},${r}`);
}

/**
 * Find the safest hex within reach
 */
export function findSafestReachableHex(unit, enemies) {
    const reachable = getReachableHexes(unit);
    let safestHex = null;
    let lowestThreat = Infinity;

    reachable.forEach((data, key) => {
        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || hex.unit) return;

        const threat = getThreatAt(q, r);

        // Prefer hexes with cover
        let adjustedThreat = threat;
        if (hex.cover) adjustedThreat *= 0.7;
        if (hex.type === 'hills') adjustedThreat *= 0.85;

        if (adjustedThreat < lowestThreat) {
            lowestThreat = adjustedThreat;
            safestHex = { q, r, cost: data.cost, threat: adjustedThreat };
        }
    });

    return safestHex;
}

/**
 * Calculate "attack opportunity" - positions where we can attack while staying safe
 */
export function findAttackOpportunities(unit, enemies) {
    const reachable = getReachableHexes(unit);
    const opportunities = [];

    reachable.forEach((data, key) => {
        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || hex.unit) return;

        const threat = getThreatAt(q, r);
        const targetsInRange = [];

        // Find enemies we can attack from this position
        for (const enemy of enemies) {
            const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
            if (dist <= unit.range) {
                targetsInRange.push({
                    enemy,
                    distance: dist,
                    canKill: enemy.currentHp <= unit.damage
                });
            }
        }

        if (targetsInRange.length > 0) {
            opportunities.push({
                q, r,
                cost: data.cost,
                threat,
                targets: targetsInRange,
                score: calculateOpportunityScore(unit, q, r, threat, targetsInRange, hex)
            });
        }
    });

    // Sort by score (best opportunities first)
    return opportunities.sort((a, b) => b.score - a.score);
}

/**
 * Score an attack opportunity
 */
function calculateOpportunityScore(unit, q, r, threat, targets, hex) {
    let score = 0;

    // Base score from potential damage
    for (const t of targets) {
        score += unit.damage;
        if (t.canKill) score += 50; // Bonus for kill potential
        if (t.enemy.class === 'medic') score += 30; // Priority target
        if (t.enemy.class === 'sniper') score += 25;
    }

    // Penalty for threat
    score -= threat * 0.5;

    // Bonus for cover
    if (hex.cover) score += 20;
    if (hex.type === 'hills' && unit.class === 'sniper') score += 30;

    // Penalty for movement cost (prefer efficient moves)
    // Note: cost is handled elsewhere

    return score;
}

/**
 * Evaluate how exposed a position is to multiple enemies
 */
export function calculateExposure(q, r, enemies) {
    let exposure = 0;
    let enemiesInRange = 0;
    let totalPotentialDamage = 0;

    for (const enemy of enemies) {
        const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });

        if (dist <= enemy.range) {
            enemiesInRange++;
            totalPotentialDamage += enemy.damage;
            exposure += enemy.damage * (1 + (enemy.range - dist) * 0.1);
        } else if (dist <= enemy.range + enemy.move) {
            // Can reach next move
            exposure += enemy.damage * 0.4;
        }
    }

    return {
        exposure,
        enemiesInRange,
        totalPotentialDamage,
        isCritical: enemiesInRange >= 2 || totalPotentialDamage > 60
    };
}

/**
 * Find positions that would create crossfire on enemy
 */
export function findCrossfirePositions(target, aiUnits, enemies) {
    const positions = [];

    for (const unit of aiUnits) {
        if (!unit.alive) continue;

        const reachable = getReachableHexes(unit);

        reachable.forEach((data, key) => {
            const [q, r] = key.split(',').map(Number);
            const hex = getHex(q, r);
            if (!hex || hex.unit) return;

            const distToTarget = hexDistance({ q, r }, { q: target.q, r: target.r });
            if (distToTarget > unit.range) return;

            // Calculate angle to target
            const angle = Math.atan2(r - target.r, q - target.q);

            // Check if other allies are at different angles
            const otherAllies = aiUnits.filter(u => u.id !== unit.id && u.alive);
            for (const ally of otherAllies) {
                const allyDist = hexDistance({ q: ally.q, r: ally.r }, { q: target.q, r: target.r });
                if (allyDist > ally.range) continue;

                const allyAngle = Math.atan2(ally.r - target.r, ally.q - target.q);
                const angleDiff = Math.abs(angle - allyAngle);

                // Good crossfire angle (90+ degrees apart)
                if (angleDiff > Math.PI / 2) {
                    positions.push({
                        unit,
                        q, r,
                        cost: data.cost,
                        crossfirePartner: ally,
                        angleDiff,
                        threat: getThreatAt(q, r)
                    });
                }
            }
        });
    }

    return positions;
}

/**
 * Update threat assessment for each enemy
 */
export function updateThreatAssessment(enemies, aiUnits) {
    const memory = getAIMemory();

    for (const enemy of enemies) {
        let threatLevel = 50; // Base threat

        // Damage potential
        threatLevel += enemy.damage;

        // HP remaining (wounded enemies are less threatening)
        threatLevel *= (enemy.currentHp / enemy.maxHp);

        // Range (longer range = more threatening)
        threatLevel += enemy.range * 5;

        // Class-specific threats
        if (enemy.class === 'medic') {
            threatLevel += 40; // Medics extend enemy team's staying power
        }
        if (enemy.class === 'sniper') {
            threatLevel += 30; // Can pick off units from safety
        }
        if (enemy.class === 'commando') {
            threatLevel += 25; // High burst damage
        }

        // Position-based threat
        const closestAlly = aiUnits.reduce((closest, ally) => {
            if (!ally.alive) return closest;
            const dist = hexDistance({ q: enemy.q, r: enemy.r }, { q: ally.q, r: ally.r });
            return dist < closest ? dist : closest;
        }, Infinity);

        if (closestAlly <= enemy.range) {
            threatLevel += 30; // Immediate threat
        } else if (closestAlly <= enemy.range + enemy.move) {
            threatLevel += 15; // Can engage this turn
        }

        memory.threatAssessment.set(enemy.id, threatLevel);
    }
}

/**
 * Get most threatening enemy
 */
export function getMostThreateningEnemy(enemies) {
    const memory = getAIMemory();
    let mostThreatening = null;
    let highestThreat = 0;

    for (const enemy of enemies) {
        const threat = memory.threatAssessment.get(enemy.id) || 50;
        if (threat > highestThreat) {
            highestThreat = threat;
            mostThreatening = enemy;
        }
    }

    return mostThreatening;
}
