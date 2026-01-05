// ===== AI COMMENTARY SYSTEM =====
// Generates human-like situational commentary for AI vs AI spectator mode
// Provides context about game state, recent events, and strategic intentions

import { state, getPlayerUnits, getPlayerName } from './state.js';
import { CONFIG } from './config.js';

// German class names for natural language
const CLASS_NAMES_DE = {
    scout: 'Späher',
    assault: 'Sturmsoldat',
    medic: 'Sanitäter',
    sniper: 'Scharfschütze',
    commando: 'Kommando',
    ninja: 'Ninja',
    elitesoldat: 'Elitesoldat'
};

// Track game history for contextual commentary
const gameHistory = {
    lastRoundKills: new Map(),      // playerIndex -> kills last round
    lastRoundLosses: new Map(),     // playerIndex -> losses last round
    dominantPlayer: null,           // Player who's been winning
    comebackPlayer: null,           // Player making a comeback
    stalemateTurns: 0,              // Turns without combat
    lastCommentaryType: null,       // Avoid repeating same type
};

/**
 * Reset history at game start
 */
export function resetCommentaryHistory() {
    gameHistory.lastRoundKills.clear();
    gameHistory.lastRoundLosses.clear();
    gameHistory.dominantPlayer = null;
    gameHistory.comebackPlayer = null;
    gameHistory.stalemateTurns = 0;
    gameHistory.lastCommentaryType = null;
}

/**
 * Update history after a round (call at round end)
 */
export function updateRoundHistory(roundSummary) {
    if (!roundSummary) return;

    // Track kills and losses per player
    for (let p = 0; p < state.settings.players; p++) {
        const kills = roundSummary.killsByPlayer?.[p] || 0;
        const losses = roundSummary.lossesByPlayer?.[p] || 0;
        gameHistory.lastRoundKills.set(p, kills);
        gameHistory.lastRoundLosses.set(p, losses);
    }

    // Detect dominant player
    if (roundSummary.leadingPlayer !== null) {
        gameHistory.dominantPlayer = roundSummary.leadingPlayer;
    }

    // Track stalemate
    const totalCombat = Array.from(gameHistory.lastRoundKills.values())
        .reduce((a, b) => a + b, 0);
    if (totalCombat === 0) {
        gameHistory.stalemateTurns++;
    } else {
        gameHistory.stalemateTurns = 0;
    }
}

/**
 * Generate human-like turn commentary based on game situation
 * Returns an object with message and recommended pause duration
 */
export function generateTurnCommentary(plan, playerIndex) {
    const playerName = getPlayerName(playerIndex);
    const myUnits = getPlayerUnits(playerIndex).filter(u => u.alive);
    const enemies = plan?.visibleEnemies || [];
    const allEnemyUnits = getAllEnemyUnits(playerIndex);

    // Analyze situation
    const situation = analyzeSituation(playerIndex, myUnits, allEnemyUnits, enemies);

    // Pick commentary type based on situation (avoid repetition)
    const commentary = selectCommentary(situation, playerName, myUnits, enemies);

    return {
        message: commentary.text,
        pauseDuration: commentary.pause || 2500
    };
}

/**
 * Get all enemy units (alive) for a player
 */
function getAllEnemyUnits(playerIndex) {
    return state.units.filter(u =>
        u.alive && u.player !== playerIndex
    );
}

/**
 * Analyze the current game situation
 */
function analyzeSituation(playerIndex, myUnits, allEnemies, visibleEnemies) {
    const myStrength = calculateTeamStrength(myUnits);
    const enemyStrength = calculateTeamStrength(allEnemies);
    const strengthRatio = enemyStrength > 0 ? myStrength / enemyStrength : 2;

    const myWounded = myUnits.filter(u => u.currentHp < u.maxHp * 0.5).length;
    const visibleWounded = visibleEnemies.filter(e => e.currentHp < e.maxHp * 0.5).length;

    const lastRoundKills = gameHistory.lastRoundKills.get(playerIndex) || 0;
    const lastRoundLosses = gameHistory.lastRoundLosses.get(playerIndex) || 0;

    return {
        // Force comparison
        isWinning: strengthRatio > 1.3,
        isLosing: strengthRatio < 0.7,
        isEven: strengthRatio >= 0.7 && strengthRatio <= 1.3,

        // Visibility
        noContact: visibleEnemies.length === 0,
        hasContact: visibleEnemies.length > 0,
        outnumberedVisible: visibleEnemies.length > myUnits.length,

        // Health
        hasWoundedUnits: myWounded > 0,
        enemyWounded: visibleWounded > 0,
        criticalHealth: myUnits.some(u => u.currentHp < u.maxHp * 0.3),

        // Momentum
        hadGoodRound: lastRoundKills > lastRoundLosses,
        hadBadRound: lastRoundLosses > lastRoundKills,
        stalemate: gameHistory.stalemateTurns >= 2,

        // Game phase
        isEarlyGame: state.round <= 3,
        isMidGame: state.round > 3 && state.round <= 8,
        isLateGame: state.round > 8,
        isEndGame: allEnemies.length <= 2 || myUnits.length <= 2,

        // Counts
        myUnitCount: myUnits.length,
        enemyCount: allEnemies.length,
        visibleCount: visibleEnemies.length,
        woundedCount: myWounded,
        round: state.round
    };
}

/**
 * Calculate team strength (HP-weighted)
 */
function calculateTeamStrength(units) {
    return units.reduce((sum, u) => sum + u.currentHp + (u.damage * 2), 0);
}

/**
 * Select appropriate commentary based on situation
 */
function selectCommentary(sit, playerName, myUnits, enemies) {
    // Prioritized situation checks - pick the most relevant
    const options = [];

    // === ENDGAME SITUATIONS ===
    if (sit.isEndGame && sit.isWinning) {
        options.push({
            type: 'endgame_winning',
            text: buildEndgameWinningMessage(playerName, sit, enemies),
            pause: 3000
        });
    }

    if (sit.isEndGame && sit.isLosing) {
        options.push({
            type: 'endgame_desperate',
            text: buildEndgameDesperateMessage(playerName, sit, myUnits),
            pause: 3000
        });
    }

    // === MOMENTUM SITUATIONS ===
    if (sit.hadGoodRound && sit.hasContact) {
        options.push({
            type: 'momentum_good',
            text: buildMomentumMessage(playerName, sit, true),
            pause: 2800
        });
    }

    if (sit.hadBadRound) {
        options.push({
            type: 'momentum_bad',
            text: buildMomentumMessage(playerName, sit, false),
            pause: 2800
        });
    }

    // === TACTICAL SITUATIONS ===
    if (sit.noContact && sit.stalemate) {
        options.push({
            type: 'stalemate',
            text: buildStalemateMessage(playerName, sit),
            pause: 3000
        });
    }

    if (sit.noContact && !sit.stalemate) {
        options.push({
            type: 'searching',
            text: buildSearchingMessage(playerName, sit),
            pause: 2500
        });
    }

    if (sit.enemyWounded && sit.hasContact) {
        options.push({
            type: 'opportunity',
            text: buildOpportunityMessage(playerName, sit, enemies),
            pause: 2800
        });
    }

    if (sit.criticalHealth) {
        options.push({
            type: 'critical',
            text: buildCriticalMessage(playerName, sit, myUnits),
            pause: 2800
        });
    }

    if (sit.outnumberedVisible) {
        options.push({
            type: 'outnumbered',
            text: buildOutnumberedMessage(playerName, sit),
            pause: 2800
        });
    }

    // === DEFAULT CONTACT SITUATION ===
    if (sit.hasContact && options.length === 0) {
        options.push({
            type: 'contact',
            text: buildContactMessage(playerName, sit, enemies),
            pause: 2500
        });
    }

    // Filter out recently used type and pick best option
    const filtered = options.filter(o => o.type !== gameHistory.lastCommentaryType);
    const selected = filtered.length > 0 ? filtered[0] : options[0];

    if (selected) {
        gameHistory.lastCommentaryType = selected.type;
        return selected;
    }

    // Fallback
    return {
        type: 'default',
        text: `${playerName} analysiert die Lage. ${sit.myUnitCount} Einheiten bereit.`,
        pause: 2000
    };
}

// === MESSAGE BUILDERS ===

function buildEndgameWinningMessage(playerName, sit, enemies) {
    const templates = [
        `Die Entscheidung naht. ${playerName} hat nur noch ${sit.visibleCount} Gegner vor sich. ` +
        `Mit ${sit.myUnitCount} Einheiten sollte das machbar sein. Zeit, das hier zu beenden.`,

        `${playerName} wittert den Sieg. Der Feind ist dezimiert, nur ${sit.enemyCount} ` +
        `Einheiten sind noch übrig. Jetzt gilt: Keine Fehler mehr machen.`,

        `Das Endspiel läuft. ${playerName} hat die Oberhand mit ${sit.myUnitCount} gegen ` +
        `${sit.enemyCount}. Ein koordinierter Angriff sollte den Sack zumachen.`
    ];
    return pickRandom(templates);
}

function buildEndgameDesperateMessage(playerName, sit, myUnits) {
    const unitNames = myUnits.slice(0, 2).map(u => CLASS_NAMES_DE[u.class]).join(' und ');
    const templates = [
        `Es steht ${sit.myUnitCount} gegen ${sit.enemyCount}. ${playerName} ist in der Defensive. ` +
        `${unitNames} müssen jetzt alles geben. Ein Fehler und es ist vorbei.`,

        `Die Lage ist kritisch. ${playerName} hat nur noch ${sit.myUnitCount} Einheiten. ` +
        `Jetzt zählt jede Aktion. Vielleicht gelingt noch eine Wende.`,

        `${playerName} kämpft ums Überleben. Zahlenmäßig unterlegen, aber noch nicht geschlagen. ` +
        `Die nächsten Züge entscheiden alles.`
    ];
    return pickRandom(templates);
}

function buildMomentumMessage(playerName, sit, isGood) {
    if (isGood) {
        const templates = [
            `Gute letzte Runde für ${playerName}. Das Momentum liegt auf seiner Seite. ` +
            `Jetzt nachlegen und den Druck aufrecht erhalten.`,

            `${playerName} hat Blut geleckt. Nach dem Erfolg der letzten Runde ` +
            `will er direkt nachsetzen. ${sit.visibleCount} Feinde im Visier.`,

            `Die Initiative liegt bei ${playerName}. Der Feind wurde getroffen ` +
            `und muss sich neu formieren. Zeit, das auszunutzen.`
        ];
        return pickRandom(templates);
    } else {
        const templates = [
            `Schwere letzte Runde für ${playerName}. Verluste wurden eingefahren. ` +
            `Jetzt heißt es: Ruhe bewahren und die Strategie anpassen.`,

            `${playerName} leckt die Wunden. Die letzte Runde lief nicht gut. ` +
            `Zeit für einen Taktikwechsel. ${sit.hasWoundedUnits ? 'Erstmal die Verwundeten versorgen.' : ''}`,

            `Rückschlag für ${playerName}. Aber aufgeben ist keine Option. ` +
            `Mit ${sit.myUnitCount} Einheiten ist noch alles drin.`
        ];
        return pickRandom(templates);
    }
}

function buildStalemateMessage(playerName, sit) {
    const templates = [
        `Runde ${sit.round} und immer noch kein Kontakt. ${playerName} wird ungeduldig. ` +
        `Irgendwo muss der Feind sein. Zeit für aggressiveres Aufklären.`,

        `Das Versteckspiel dauert an. ${playerName} hat seit ${gameHistory.stalemateTurns} Runden ` +
        `keinen Feind gesehen. Die Spannung steigt.`,

        `Wo ist der Gegner? ${playerName} sucht systematisch das Gelände ab. ` +
        `${sit.myUnitCount} Einheiten auf der Jagd nach Hinweisen.`
    ];
    return pickRandom(templates);
}

function buildSearchingMessage(playerName, sit) {
    if (sit.isEarlyGame) {
        const templates = [
            `Frühe Phase. ${playerName} lässt seine ${sit.myUnitCount} Einheiten ausschwärmen. ` +
            `Erst aufklären, dann angreifen.`,

            `${playerName} beginnt die Erkundung. Noch ist unklar, wo der Feind steht. ` +
            `Vorsichtig vorrücken und Deckung nutzen.`,

            `Die Partie beginnt. ${playerName} positioniert seine Truppen. ` +
            `Bald wird sich zeigen, wo es zum Kontakt kommt.`
        ];
        return pickRandom(templates);
    } else {
        const templates = [
            `Kein Sichtkontakt. ${playerName} vermutet den Feind im ${pickRandom(['Norden', 'Osten', 'Süden', 'Westen'])}. ` +
            `Die Späher werden vorgeschickt.`,

            `Der Feind hat sich zurückgezogen. ${playerName} rückt nach. ` +
            `Irgendwo muss er sein.`,

            `Funkstille an der Front. ${playerName} nutzt die Ruhe zur Neupositionierung. ` +
            `Aber die Augen bleiben offen.`
        ];
        return pickRandom(templates);
    }
}

function buildOpportunityMessage(playerName, sit, enemies) {
    const woundedEnemy = enemies.find(e => e.currentHp < e.maxHp * 0.5);
    const enemyClass = woundedEnemy ? CLASS_NAMES_DE[woundedEnemy.class] : 'Gegner';
    const enemyHp = woundedEnemy ? Math.round((woundedEnemy.currentHp / woundedEnemy.maxHp) * 100) : 50;

    const templates = [
        `Chance erkannt! Ein ${enemyClass} ist auf ${enemyHp}% HP. ${playerName} ` +
        `konzentriert das Feuer. Das könnte ein schneller Kill werden.`,

        `${playerName} sieht Blut. Der verwundete ${enemyClass} ist das primäre Ziel. ` +
        `Erst ihn ausschalten, dann die anderen.`,

        `Der ${enemyClass} wankt. ${playerName} wittert die Gelegenheit. ` +
        `Alle verfügbaren Einheiten sollen den Angriff unterstützen.`
    ];
    return pickRandom(templates);
}

function buildCriticalMessage(playerName, sit, myUnits) {
    const criticalUnit = myUnits.find(u => u.currentHp < u.maxHp * 0.3);
    const unitClass = criticalUnit ? CLASS_NAMES_DE[criticalUnit.class] : 'Einheit';
    const unitHp = criticalUnit ? Math.round((criticalUnit.currentHp / criticalUnit.maxHp) * 100) : 30;

    const templates = [
        `Alarm! Der ${unitClass} hat nur noch ${unitHp}% HP. ${playerName} ` +
        `muss ihn schützen oder riskiert einen wichtigen Verlust.`,

        `${playerName} hat ein Problem. Der ${unitClass} ist schwer angeschlagen. ` +
        `Rückzug in Deckung oder durchhalten und hoffen?`,

        `Kritische Lage für den ${unitClass}. ${playerName} wägt ab: ` +
        `Heilen, verstecken oder als Köder nutzen?`
    ];
    return pickRandom(templates);
}

function buildOutnumberedMessage(playerName, sit) {
    const templates = [
        `${sit.visibleCount} Feinde gegen ${sit.myUnitCount} eigene Einheiten. ${playerName} ` +
        `ist hier lokal unterlegen. Geschicktes Manövrieren ist gefragt.`,

        `Achtung, Überzahl! ${playerName} sieht sich ${sit.visibleCount} Gegnern gegenüber. ` +
        `Einzeln abarbeiten oder taktischer Rückzug?`,

        `Die Situation ist brenzlig. ${playerName} hat weniger Einheiten vor Ort. ` +
        `Vielleicht besser, auf Verstärkung zu warten.`
    ];
    return pickRandom(templates);
}

function buildContactMessage(playerName, sit, enemies) {
    const enemyClasses = [...new Set(enemies.map(e => CLASS_NAMES_DE[e.class]))].join(', ');

    const templates = [
        `Feindkontakt! ${playerName} sieht ${sit.visibleCount} Gegner: ${enemyClasses}. ` +
        `Die Lage wird analysiert, dann wird angegriffen.`,

        `${sit.visibleCount} Feinde in Sichtweite. ${playerName} plant den nächsten Zug. ` +
        `${sit.isWinning ? 'Die Überlegenheit sollte ausgespielt werden.' : 'Vorsicht ist geboten.'}`,

        `${playerName} hat den Feind lokalisiert. ${enemyClasses} im Zielgebiet. ` +
        `Zeit für taktische Entscheidungen.`
    ];
    return pickRandom(templates);
}

/**
 * Pick random element from array
 */
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
