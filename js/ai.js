// ===== AI OPPONENT =====
// Advanced tactical AI with memory, planning, and unit coordination

import { state, getHex, getPlayerUnits, spendSharedAP, isHexInZone } from './state.js';
import { hexDistance } from './hexMath.js';
import { getReachableHexes, findPath } from './pathfinding.js';
import { moveUnitInstant, getAttackableUnits } from './units.js';
import { executeAttack, useSpecialAbility } from './combat.js';
import { updateVisibility, updateVisibilityForPlayer, isUnitVisible, isUnitVisibleToViewer } from './fogOfWar.js';
import { updateUI } from './ui.js';
import { render } from './renderer.js';
import { endTurn } from './turns.js';
import { TERRAIN } from './config.js';
import { scrollToUnit } from './input.js';

// ===== AI MEMORY SYSTEM =====
// Stores information about enemy positions, even when not visible

const aiMemory = {
    lastKnownPositions: new Map(),  // unitId -> { q, r, round, confidence }
    searchedAreas: new Set(),        // "q,r" keys of recently searched hexes
    threatAssessment: new Map(),     // unitId -> threat level
    huntMode: false,                 // True when actively hunting remaining enemies
    lastContactRound: 0,             // Last round we saw an enemy
    playerCenterEstimate: null,      // Estimated center of player forces
    searchPattern: 'expand',         // 'expand', 'sweep', 'pincer'
    assignedTargets: new Map(),      // unitId -> targetUnitId (for focus fire)
};

/**
 * Reset AI memory for new game
 */
export function resetAIMemory() {
    aiMemory.lastKnownPositions.clear();
    aiMemory.searchedAreas.clear();
    aiMemory.threatAssessment.clear();
    aiMemory.huntMode = false;
    aiMemory.lastContactRound = 0;
    aiMemory.playerCenterEstimate = null;
    aiMemory.searchPattern = 'expand';
    aiMemory.assignedTargets.clear();
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
 */
function showAIThinking() {
    const existing = document.querySelector('.ai-thinking');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ai-thinking';
    overlay.innerHTML = `
        <div class="ai-icon">🤖</div>
        <div class="ai-text">KI plant Strategie...</div>
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
 * Analyze the battlefield and create a strategic plan
 */
function analyzeAndPlan() {
    const aiUnits = getPlayerUnits(state.currentPlayer);
    const visibleEnemies = findAllVisibleEnemies();

    // Update AI memory with visible enemies
    updateMemoryWithVisibleEnemies(visibleEnemies);

    // Calculate threat assessment
    updateThreatAssessment(visibleEnemies);

    // Estimate player position if no enemies visible
    if (visibleEnemies.length === 0) {
        estimatePlayerPosition();
    } else {
        aiMemory.lastContactRound = state.round;
        aiMemory.huntMode = false;
    }

    // Enter hunt mode if we haven't seen enemies for a while
    if (state.round - aiMemory.lastContactRound >= 2) {
        aiMemory.huntMode = true;
    }

    // Decide search pattern based on situation
    decideSearchPattern(aiUnits, visibleEnemies);

    // Assign targets for focus fire
    assignTargets(aiUnits, visibleEnemies);

    return {
        aiUnits,
        visibleEnemies,
        knownEnemyPositions: Array.from(aiMemory.lastKnownPositions.values()),
        inHuntMode: aiMemory.huntMode,
        searchPattern: aiMemory.searchPattern
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
 * Calculate threat level for each enemy
 */
function updateThreatAssessment(enemies) {
    aiMemory.threatAssessment.clear();

    for (const enemy of enemies) {
        let threat = 0;

        // Base threat by class
        const classThreat = {
            sniper: 90,   // High damage at range
            commando: 85,    // High damage, stealth
            assault: 70,  // High damage, tanky
            medic: 80,    // Force multiplier - healing
            scout: 50     // Lower threat but mobile
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
        // No information - estimate based on spawn area (opposite side of map)
        const aiUnits = getPlayerUnits(state.currentPlayer);
        if (aiUnits.length > 0) {
            const avgQ = aiUnits.reduce((sum, u) => sum + u.q, 0) / aiUnits.length;
            const avgR = aiUnits.reduce((sum, u) => sum + u.r, 0) / aiUnits.length;
            // Player is likely on opposite side
            aiMemory.playerCenterEstimate = { q: -avgQ * 0.8, r: -avgR * 0.8 };
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

/**
 * Perform all AI actions for current turn
 */
async function performAIActions() {
    // In single-player, ensure human player's visibility is set for rendering
    if (state.settings.singlePlayer) {
        updateVisibilityForPlayer(0);
        render();
    }

    // Strategic analysis and planning
    const plan = analyzeAndPlan();

    // Sort units by role priority for this turn
    const sortedUnits = sortUnitsForExecution(plan);

    for (const unit of sortedUnits) {
        if (!unit.alive) continue;

        await performUnitAI(unit, plan);
        await delay(400);
    }

    hideAIThinking();

    setTimeout(() => {
        endTurn();
    }, 500);
}

/**
 * Sort units based on strategic role
 */
function sortUnitsForExecution(plan) {
    const units = [...plan.aiUnits];

    return units.sort((a, b) => {
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
 * Perform AI for a single unit with strategic awareness
 */
async function performUnitAI(unit, plan) {
    const isSinglePlayer = state.settings.singlePlayer;

    const renderIfVisible = () => {
        if (!isSinglePlayer || isUnitVisibleToViewer(unit)) {
            render();
        }
    };

    // Check current situation
    const attackable = getAttackableUnits(unit);
    const assignedTargetId = aiMemory.assignedTargets.get(unit.id);
    const enemies = plan.visibleEnemies;

    // Tactical decision tree

    // 1. Should we retreat? (Low HP, enemies nearby)
    if (shouldRetreat(unit, enemies)) {
        await executeRetreat(unit, enemies);
        return;
    }

    // 2. Attack assigned target if possible (focus fire)
    if (assignedTargetId && attackable.some(t => t.id === assignedTargetId)) {
        const target = attackable.find(t => t.id === assignedTargetId);
        await executeAttackSequence(unit, target, renderIfVisible, isSinglePlayer);
    } else if (attackable.length > 0 && state.sharedAP >= 1) {
        // 3. Attack best available target
        const target = selectBestTarget(unit, attackable);
        if (target) {
            await executeAttackSequence(unit, target, renderIfVisible, isSinglePlayer);
        }
    }

    // 4. Use special ability if beneficial
    if (state.sharedAP >= 2 && !unit.usedSpecial && shouldUseSpecial(unit, enemies, plan)) {
        useSpecialAbility(unit);
        if (!isSinglePlayer || isUnitVisibleToViewer(unit)) {
            updateUI();
            render();
        }
        await delay(isUnitVisibleToViewer(unit) ? 400 : 100);
    }

    // 5. Move strategically
    if (state.sharedAP >= 1) {
        const moveTarget = selectStrategicMoveTarget(unit, plan);
        if (moveTarget) {
            await executeAIMove(unit, moveTarget);
        }
    }

    // 6. Attack again after moving
    const attackableAfterMove = getAttackableUnits(unit);
    if (attackableAfterMove.length > 0 && state.sharedAP >= 1) {
        const target = selectBestTarget(unit, attackableAfterMove);
        if (target) {
            await executeAttackSequence(unit, target, renderIfVisible, isSinglePlayer);
        }
    }
}

/**
 * Execute attack with proper rendering
 * In single-player, scroll to the attacked friendly unit so the player can see the action
 */
async function executeAttackSequence(unit, target, renderIfVisible, isSinglePlayer) {
    // In single-player, scroll to the target (friendly unit being attacked) before attack
    if (isSinglePlayer && target.player === 0) {
        // Scroll to the friendly unit being attacked
        scrollToUnit(target, 400);
        await delay(450);
    } else if (isSinglePlayer && isUnitVisibleToViewer(unit)) {
        // If attacking another enemy but AI is visible, scroll to the action
        scrollToUnit(unit, 300);
        await delay(350);
    }

    state.targetedUnit = target;
    renderIfVisible();
    await delay(isUnitVisibleToViewer(unit) ? 300 : 100);
    executeAttack(unit, target);
    state.targetedUnit = null;

    // Update memory if enemy killed
    if (!target.alive) {
        aiMemory.lastKnownPositions.delete(target.id);
        aiMemory.assignedTargets.forEach((tid, uid) => {
            if (tid === target.id) aiMemory.assignedTargets.delete(uid);
        });
    }

    if (!isSinglePlayer || isUnitVisibleToViewer(unit)) {
        updateUI();
        render();
    }
    await delay(isUnitVisibleToViewer(unit) ? 500 : 100);
}

// ===== TACTICAL DECISIONS =====

/**
 * Check if unit should retreat
 */
function shouldRetreat(unit, enemies) {
    if (enemies.length === 0) return false;

    const hpPercent = unit.currentHp / unit.maxHp;

    // Medics should retreat earlier (they're valuable)
    if (unit.class === 'medic' && hpPercent < 0.5) return true;

    // Snipers shouldn't be in close combat
    if (unit.class === 'sniper') {
        const closestEnemy = enemies.reduce((min, e) => {
            const d = hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r });
            return d < min ? d : min;
        }, Infinity);
        if (closestEnemy <= 2 && hpPercent < 0.6) return true;
    }

    // General retreat threshold
    if (hpPercent < 0.3) return true;

    // Surrounded by multiple enemies
    const nearbyEnemies = enemies.filter(e =>
        hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= 3
    );
    if (nearbyEnemies.length >= 3 && hpPercent < 0.5) return true;

    return false;
}

/**
 * Execute retreat - move away from enemies
 */
async function executeRetreat(unit, enemies) {
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

        // Move towards allies (for protection/healing)
        const allies = getPlayerUnits(unit.player).filter(u => u.id !== unit.id);
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
        await executeAIMove(unit, bestHex);
    }
}

/**
 * Find all enemies visible to any AI unit
 */
function findAllVisibleEnemies() {
    return state.units.filter(u =>
        u.alive &&
        u.player !== state.currentPlayer &&
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
            const allies = getPlayerUnits(unit.player);
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
function scoreCombatPosition(unit, q, r, enemies, _plan) {
    let score = 0;
    const hex = getHex(q, r);

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

    // Flanking bonus - attack from different angle than allies
    const allies = getPlayerUnits(unit.player).filter(u => u.id !== unit.id);
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
 */
function scoreSearchPosition(unit, q, r, plan) {
    let score = 0;
    const hexKey = `${q},${r}`;

    // Exploration bonuses
    const aiExplored = state.playerExploredHexes[state.currentPlayer];
    if (!aiExplored || !aiExplored.has(hexKey)) {
        score += 40;  // Big bonus for unexplored territory
    }

    // Recently searched penalty
    if (aiMemory.searchedAreas.has(hexKey)) {
        score -= 30;
    }

    // Search pattern specific scoring
    switch (plan.searchPattern) {
        case 'expand': {
            // Move outward from current position toward map edges
            const distFromStart = Math.sqrt(q * q + r * r);
            const currentDist = Math.sqrt(unit.q * unit.q + unit.r * unit.r);
            if (distFromStart > currentDist) {
                score += 15;
            }
            break;
        }

        case 'sweep': {
            // Move in coordinated line
            const allies = getPlayerUnits(unit.player);
            const avgAllyR = allies.reduce((sum, u) => sum + u.r, 0) / allies.length;
            // Stay roughly aligned with allies
            score -= Math.abs(r - avgAllyR) * 5;
            // But push forward
            score += q * 2;
            break;
        }

        case 'pincer': {
            // Move to flank estimated enemy position
            if (aiMemory.playerCenterEstimate) {
                const estPos = aiMemory.playerCenterEstimate;
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
            break;
        }
    }

    // Move towards map center (higher chance of finding enemies)
    const distToCenter = Math.sqrt(q * q + r * r);
    score -= distToCenter * 2;

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

// ===== MOVEMENT EXECUTION =====

/**
 * Execute AI movement with step-by-step animation
 * In single-player, animate visible movements so player can follow
 */
async function executeAIMove(unit, target) {
    const targetHex = getHex(target.q, target.r);
    if (!targetHex) return;

    const isSinglePlayer = state.settings.singlePlayer;
    const wasVisible = isUnitVisibleToViewer(unit);

    // Get the path from unit's current position to target
    const pathResult = findPath(unit.q, unit.r, target.q, target.r, target.cost + 2);

    if (!pathResult || !pathResult.path || pathResult.path.length < 2) {
        // No valid path found - fall back to instant teleport
        const oldHex = getHex(unit.q, unit.r);
        if (oldHex) oldHex.unit = null;

        unit.q = target.q;
        unit.r = target.r;
        targetHex.unit = unit;

        spendSharedAP(target.cost);
        updateVisibility();
        if (isSinglePlayer) {
            updateVisibilityForPlayer(0);
        }
        render();
        updateUI();
        return;
    }

    const path = pathResult.path;
    const stepDelay = 120; // ms per step (faster than player animation)

    // If unit starts visible, scroll to it first
    if (isSinglePlayer && wasVisible) {
        scrollToUnit(unit, 200);
        await delay(250);
    }

    // Animate step by step
    let unitBecameVisible = false;
    for (let i = 1; i < path.length; i++) {
        const nextPos = path[i];
        const nextHex = getHex(nextPos.q, nextPos.r);

        if (!nextHex) continue;

        // Move unit one step
        moveUnitInstant(unit, nextHex);

        // Update visibility after each step
        updateVisibility();
        if (isSinglePlayer) {
            updateVisibilityForPlayer(0);
        }

        const isNowVisible = isUnitVisibleToViewer(unit);

        // Check if unit just became visible
        if (isSinglePlayer && isNowVisible && !unitBecameVisible) {
            unitBecameVisible = true;
            // Scroll to show the newly visible enemy
            scrollToUnit(unit, 300);
            await delay(350);
        }

        // Only render if unit is visible (or in multiplayer)
        if (!isSinglePlayer || isNowVisible) {
            render();
            await delay(stepDelay);
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
    if (!isSinglePlayer || wasVisible || unitBecameVisible) {
        updateUI();
        render();
    }
}

/**
 * Utility: delay helper
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
