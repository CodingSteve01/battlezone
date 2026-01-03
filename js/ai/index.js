// ===== AI MODULE - MAIN ENTRY POINT =====
// Enhanced tactical AI with threat awareness and prediction
// This is the new modular AI system

// Re-export everything from submodules
export * from './thoughts.js';
export * from './memory.js';
export * from './threats.js';
export * from './prediction.js';
export * from './positioning.js';

// Import for internal use
import { state, getPlayerUnits, arePlayersAllied, getPlayerName, isHexInZone } from '../state.js';
import { hexDistance } from '../hexMath.js';
import {
    isSpectatorMode, addAIThought, addMultiPartThought,
    variedPhrase, clearAIThoughts, setIsAIPlayerFn, CLASS_NAMES_DE
} from './thoughts.js';
import {
    getAIMemory, setAIMemory, resetAIMemory as resetMemory,
    initializeTeamMemory, recordEnemyPosition, cleanupOldMemory
} from './memory.js';
import {
    calculateThreatMap, calculateInfluenceMap, updateThreatAssessment,
    getMostThreateningEnemy
} from './threats.js';
import {
    predictEnemyMovement, simulateEnemyTurn, identifyUnitsAtRisk,
    findBaitPositions
} from './prediction.js';
import { getAllAlliedAIUnits } from './positioning.js';
import { isUnitVisibleToPlayer } from '../fogOfWar.js';

/**
 * Check if a player is AI controlled
 */
export function isAIPlayer(playerIndex = state.currentPlayer) {
    if (state.settings.aiPlayers && state.settings.aiPlayers.length > 0) {
        return state.settings.aiPlayers.includes(playerIndex);
    }
    return state.settings.singlePlayer && playerIndex > 0;
}

// Set the isAIPlayer reference in thoughts module
setIsAIPlayerFn(isAIPlayer);

/**
 * Check if there are any human players
 */
export function hasHumanPlayer() {
    for (let p = 0; p < state.settings.players; p++) {
        if (!isAIPlayer(p)) return true;
    }
    return false;
}

/**
 * Reset AI memory for new game
 */
export function resetAIMemory() {
    resetMemory();
}

/**
 * ENHANCED: Analyze situation and create strategic plan
 * Now includes threat maps and predictions
 */
export function analyzeAndPlan() {
    const memory = getAIMemory();
    const aiUnits = getPlayerUnits(state.currentPlayer).filter(u => u.alive);
    const allAlliedUnits = getAllAlliedAIUnits();
    const visibleEnemies = findAllVisibleEnemies();

    // Check for allied AI coordination
    const alliedAIPlayers = [];
    for (let p = 0; p < state.settings.players; p++) {
        if (p !== state.currentPlayer && isAIPlayer(p) && arePlayersAllied(state.currentPlayer, p)) {
            alliedAIPlayers.push(p);
        }
    }

    // Announce allied coordination
    if (alliedAIPlayers.length > 0 && visibleEnemies.length > 0) {
        const allyNames = alliedAIPlayers.map(p => getPlayerName(p)).join(' & ');
        addAIThought(`Koordination mit ${allyNames}! ${allAlliedUnits.length} Einheiten arbeiten zusammen.`, 'strategy');
    }

    // === NEW: CALCULATE THREAT AND INFLUENCE MAPS ===
    calculateThreatMap(visibleEnemies, aiUnits);
    calculateInfluenceMap(visibleEnemies, aiUnits);

    // Update memory with visible enemies
    for (const enemy of visibleEnemies) {
        recordEnemyPosition(enemy, 1.0);
    }

    // Update threat assessment
    updateThreatAssessment(visibleEnemies, aiUnits);

    // === NEW: PREDICT ENEMY MOVEMENTS ===
    const enemyPredictions = [];
    for (const enemy of visibleEnemies) {
        const predictions = predictEnemyMovement(enemy, aiUnits);
        if (predictions.length > 0) {
            enemyPredictions.push({
                enemy,
                predictions: predictions.slice(0, 3) // Top 3 predictions
            });
        }
    }

    // === NEW: IDENTIFY UNITS AT RISK ===
    const unitsAtRisk = identifyUnitsAtRisk(aiUnits, visibleEnemies);

    // Generate strategic thoughts
    if (visibleEnemies.length === 0) {
        memory.lastContactRound = memory.lastContactRound || state.round - 2;

        addAIThought(variedPhrase([
            'Keine Feinde in Sicht. Wir schwärmen aus zur Aufklärung.',
            'Der Feind versteckt sich. Systematische Suche eingeleitet.',
            'Kein Sichtkontakt. Alle Einheiten: Gebiet sichern.'
        ]), 'strategy');
    } else {
        memory.lastContactRound = state.round;
        memory.huntMode = false;

        const enemyClasses = visibleEnemies.map(e => CLASS_NAMES_DE[e.class] || e.class);
        const uniqueClasses = [...new Set(enemyClasses)];
        const woundedEnemies = visibleEnemies.filter(e => e.currentHp < e.maxHp);

        // More detailed enemy analysis
        if (visibleEnemies.length === 1) {
            const hpInfo = woundedEnemies.length > 0 ? ' Der Gegner ist verwundet.' : '';
            addAIThought(`Feindkontakt! Ein ${uniqueClasses[0]} wurde entdeckt.${hpInfo}`, 'strategy');
        } else if (visibleEnemies.length <= 3) {
            const woundedInfo = woundedEnemies.length > 0 ? ` Davon ${woundedEnemies.length} verwundet.` : '';
            addAIThought(`${visibleEnemies.length} Gegner gesichtet: ${uniqueClasses.join(', ')}.${woundedInfo}`, 'strategy');
        } else {
            addAIThought(`Starke Feindpräsenz! ${visibleEnemies.length} Gegner in Sichtweite. Taktische Vorsicht!`, 'strategy');
        }

        // === NEW: WARN ABOUT AT-RISK UNITS ===
        const criticalUnits = unitsAtRisk.filter(r => r.inMortalDanger);
        if (criticalUnits.length > 0) {
            const unitNames = criticalUnits.map(r => CLASS_NAMES_DE[r.unit.class]).join(', ');
            addAIThought(`Achtung! ${unitNames} in Lebensgefahr. Schutzmaßnahmen eingeleitet.`, 'strategy');
        }

        // === NEW: ANNOUNCE PREDICTIONS ===
        if (enemyPredictions.length > 0 && Math.random() < 0.3) {
            const pred = enemyPredictions[0];
            if (pred.predictions[0].probability > 0.4) {
                addAIThought(`Vorhersage: ${CLASS_NAMES_DE[pred.enemy.class]} wird wahrscheinlich vorrücken. Wir bereiten uns vor.`, 'strategy');
            }
        }
    }

    // Count total enemies for endgame detection
    const totalEnemiesOnMap = state.units.filter(u =>
        u.alive && !arePlayersAllied(state.currentPlayer, u.player)
    ).length;

    const isEndgame = totalEnemiesOnMap <= 2 && totalEnemiesOnMap > 0;
    memory.isEndgame = isEndgame;

    // Hunt mode
    if (state.round - memory.lastContactRound >= 1) {
        memory.huntMode = true;
        if (isEndgame) {
            addAIThought(variedPhrase([
                `Nur noch ${totalEnemiesOnMap} Feind${totalEnemiesOnMap > 1 ? 'e' : ''} übrig! Alle Einheiten: Aufspüren!`,
                'Endspiel! Der letzte Widerstand muss gebrochen werden.',
                'Fast geschafft! Wir jagen die letzten Überlebenden.'
            ]), 'strategy');
        } else {
            addAIThought(variedPhrase([
                'Kein Sichtkontakt. Jagdmodus aktiviert.',
                'Der Feind versteckt sich. Alle Einheiten: Aktiv suchen!',
                'Zeit zu jagen. Koordinierte Suchmuster aktiviert.'
            ]), 'strategy');
        }
    }

    // Decide search pattern
    decideSearchPattern(allAlliedUnits, visibleEnemies);

    // Assign targets
    assignTargets(allAlliedUnits, visibleEnemies);

    // === NEW: CONSIDER BAIT STRATEGY ===
    let baitStrategy = null;
    if (visibleEnemies.length > 0 && aiUnits.length >= 3) {
        // Find potential bait positions for tank units
        const tankUnit = aiUnits.find(u => u.class === 'assault' && u.currentHp > u.maxHp * 0.6);
        if (tankUnit) {
            const baitPositions = findBaitPositions(tankUnit, visibleEnemies, aiUnits);
            if (baitPositions.length > 0 && baitPositions[0].baitScore > 50) {
                baitStrategy = {
                    baitUnit: tankUnit.id,
                    position: baitPositions[0],
                    supportUnits: aiUnits.filter(u => u.id !== tankUnit.id).map(u => u.id)
                };
                addAIThought('Köder-Taktik vorbereitet. Der Assault zieht Feinde an, andere Einheiten sichern.', 'strategy');
            }
        }
    }

    // Cleanup old memory
    cleanupOldMemory();

    return {
        aiUnits,
        visibleEnemies,
        allAlliedUnits,
        knownEnemyPositions: Array.from(memory.lastKnownPositions.values()),
        inHuntMode: memory.huntMode,
        searchPattern: memory.searchPattern,
        isEndgame,
        // NEW: Enhanced planning data
        threatMap: memory.threatMap,
        influenceMap: memory.influenceMap,
        enemyPredictions,
        unitsAtRisk,
        baitStrategy
    };
}

/**
 * Find all enemies visible to current player and allies
 */
function findAllVisibleEnemies() {
    const enemies = [];
    const seen = new Set();

    for (const unit of state.units) {
        if (!unit.alive) continue;
        if (arePlayersAllied(state.currentPlayer, unit.player)) continue;
        if (seen.has(unit.id)) continue;

        // Check visibility for current player and allies
        let visible = false;
        for (let p = 0; p < state.settings.players; p++) {
            if (arePlayersAllied(state.currentPlayer, p)) {
                if (isUnitVisibleToPlayer(unit, p)) {
                    visible = true;
                    break;
                }
            }
        }

        if (visible) {
            enemies.push(unit);
            seen.add(unit.id);
        }
    }

    return enemies;
}

/**
 * Decide search pattern based on situation
 */
function decideSearchPattern(aiUnits, enemies) {
    const memory = getAIMemory();

    if (enemies.length > 0) {
        memory.searchPattern = 'engage';
    } else if (memory.playerCenterEstimate && memory.huntMode) {
        memory.searchPattern = Math.random() < 0.5 ? 'pincer' : 'sweep';
    } else {
        memory.searchPattern = 'expand';
    }
}

/**
 * Assign targets for coordinated attacks
 */
function assignTargets(aiUnits, enemies) {
    const memory = getAIMemory();
    memory.assignedTargets.clear();

    if (enemies.length === 0) return;

    // Sort enemies by threat
    const sortedEnemies = [...enemies].sort((a, b) => {
        const aThreat = memory.threatAssessment.get(a.id) || 50;
        const bThreat = memory.threatAssessment.get(b.id) || 50;
        return bThreat - aThreat;
    });

    // Assign units to targets
    const targetCounts = new Map();

    for (const unit of aiUnits) {
        if (!unit.alive) continue;

        let bestTarget = null;
        let bestScore = -Infinity;

        for (const enemy of sortedEnemies) {
            const dist = hexDistance({ q: unit.q, r: unit.r }, { q: enemy.q, r: enemy.r });
            const canReach = dist <= unit.range + unit.move;
            if (!canReach) continue;

            let score = memory.threatAssessment.get(enemy.id) || 50;

            // Kill potential bonus
            if (enemy.currentHp <= unit.damage) {
                score += 100;
            }

            // Focus fire bonus
            const currentCount = targetCounts.get(enemy.id) || 0;
            if (currentCount > 0 && enemy.currentHp > unit.damage) {
                score += 30; // Encourage focus fire
            }

            // Too much focus penalty
            if (currentCount >= 3) {
                score -= 50;
            }

            // Distance penalty
            score -= dist * 3;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = enemy;
            }
        }

        if (bestTarget) {
            memory.assignedTargets.set(unit.id, bestTarget.id);
            targetCounts.set(bestTarget.id, (targetCounts.get(bestTarget.id) || 0) + 1);
        }
    }
}

// Re-export CLASS_NAMES_DE for backward compatibility
export { CLASS_NAMES_DE };
