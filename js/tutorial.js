// ===== INTERACTIVE TUTORIAL SYSTEM =====

import { state, getCurrentUnit } from './state.js';
import { getAttackableUnits } from './units.js';
import { showToast } from './ui.js';

// Tutorial state
const tutorialState = {
    active: false,
    step: 0,
    shownHints: new Set(),
    dismissedForGame: false,
    firstGamePlayed: false
};

// Team selection tutorial hints - shown during unit selection
const TEAM_SELECT_HINTS = {
    teamIntro: {
        id: 'teamIntro',
        title: '🎖️ Stelle dein Team zusammen!',
        message: 'Wähle 3 Einheiten für dein Team. Jede Klasse hat einzigartige Stärken - eine gute Mischung ist der Schlüssel zum Sieg!',
        position: 'top'
    },
    scoutTip: {
        id: 'scoutTip',
        title: '🧭 Scout - Der Aufklärer',
        message: '<b>Stärken:</b> Beste Sichtweite (8 Felder), schnell (5 Bewegung), Sprint-Fähigkeit<br><b>Taktik:</b> Ideal zum Aufdecken von Feinden und Flankenangriffe. Findet versteckte Einheiten!',
        position: 'bottom',
        forClass: 'scout'
    },
    assaultTip: {
        id: 'assaultTip',
        title: '🪖 Assault - Der Panzer',
        message: '<b>Stärken:</b> Höchste HP (120), hoher Schaden (40), Powershot (+25 DMG)<br><b>Taktik:</b> Frontlinie halten, Deckung durchbrechen. Ignoriert 50% der feindlichen Deckung!',
        position: 'bottom',
        forClass: 'assault'
    },
    medicTip: {
        id: 'medicTip',
        title: '⛑️ Medic - Der Sanitäter',
        message: '<b>Stärken:</b> Heilt Team (+40 HP), gute Reichweite (3 Felder)<br><b>Taktik:</b> Hinter der Front bleiben. UNVERZICHTBAR für längere Gefechte!',
        position: 'bottom',
        forClass: 'medic'
    },
    sniperTip: {
        id: 'sniperTip',
        title: '🎯 Sniper - Der Scharfschütze',
        message: '<b>Stärken:</b> Höchster Schaden (65!), größte Reichweite (6), Tarnung<br><b>Taktik:</b> Auf Hügeln positionieren. Kann Feinde mit einem Schuss eliminieren!',
        position: 'bottom',
        forClass: 'sniper'
    },
    commandoTip: {
        id: 'commandoTip',
        title: '⚔️ Commando - Der Assassine',
        message: '<b>Stärken:</b> Brutaler Nahkampf (50+20 Bonus!), Schleichen, schnell<br><b>Taktik:</b> Aus dem Hinterhalt angreifen. Perfekt für Flanken und Hinterhalte!',
        position: 'bottom',
        forClass: 'commando'
    },
    synergy_balanced: {
        id: 'synergy_balanced',
        title: '⚖️ Tipp: Ausgewogenes Team',
        message: '<b>Scout + Assault + Medic</b> = Klassiker!<br>Scout findet Feinde → Assault greift an → Medic heilt. Solide Basis für Anfänger.',
        position: 'center'
    },
    synergy_stealth: {
        id: 'synergy_stealth',
        title: '🌙 Tipp: Schattentaktik',
        message: '<b>Scout + Sniper + Commando</b> = Hinterhalt!<br>Scout späht aus → Sniper dezimiert → Commando erledigt den Rest. Für aggressive Spieler.',
        position: 'center'
    },
    synergy_defensive: {
        id: 'synergy_defensive',
        title: '🛡️ Tipp: Defensive Formation',
        message: '<b>Assault + Medic + Sniper</b> = Festung!<br>Assault hält die Linie → Medic heilt → Sniper kontrolliert das Feld. Für geduldige Spieler.',
        position: 'center'
    },
    tactical_ambush: {
        id: 'tactical_ambush',
        title: '🎯 Taktik: Hinterhalt',
        message: 'Versteckte Einheiten (Wald/Tarnung) können <b>Hinterhalte</b> legen! Feinde die in Reichweite kommen werden automatisch mit Bonus-Schaden angegriffen.',
        position: 'center'
    },
    tactical_coordinated: {
        id: 'tactical_coordinated',
        title: '👥 Taktik: Koordinierter Angriff',
        message: 'Mehrere Einheiten können gemeinsam angreifen! <b>+15% Schaden pro zusätzlichem Angreifer.</b> Den 👥-Button nutzen wenn verfügbar.',
        position: 'center'
    },
    tactical_flanking: {
        id: 'tactical_flanking',
        title: '📐 Taktik: Flankieren',
        message: 'Greife Feinde von der Seite oder hinten an! <b>Flankenangriffe</b> umgehen Deckung und erhöhen die Trefferchance.',
        position: 'center'
    },
    tactical_cover: {
        id: 'tactical_cover',
        title: '🌲 Taktik: Deckung nutzen',
        message: '<b>Wälder:</b> -25% Trefferchance für Feinde<br><b>Hügel:</b> +1 Reichweite, +10% Verteidigung<br>Positionierung ist entscheidend!',
        position: 'center'
    }
};

// Tutorial hint definitions
const TUTORIAL_HINTS = {
    welcome: {
        id: 'welcome',
        title: 'Willkommen bei Shadow Squad!',
        message: 'Dies ist ein rundenbasiertes Taktikspiel. Ziel ist es, alle gegnerischen Einheiten zu eliminieren.',
        position: 'center',
        showOnce: true
    },
    selectUnit: {
        id: 'selectUnit',
        title: 'Einheit auswählen',
        message: 'Tippe auf eine deiner Einheiten (grün markiert), um sie auszuwählen.',
        position: 'bottom',
        condition: () => !getCurrentUnit()
    },
    moveUnit: {
        id: 'moveUnit',
        title: 'Einheit bewegen',
        message: 'Tippe auf ein grün markiertes Feld, um dorthin zu gehen. Grün = nah (1-2 AP), Gelb = mittel (3-4 AP), Rot = weit (5+ AP).',
        position: 'bottom',
        condition: () => {
            const unit = getCurrentUnit();
            return unit && state.selectedAction === 'move';
        }
    },
    attackEnemy: {
        id: 'attackEnemy',
        title: 'Gegner angreifen',
        message: 'Rot markierte Gegner sind in Reichweite. Tippe auf sie, um anzugreifen!',
        position: 'top',
        condition: () => {
            const unit = getCurrentUnit();
            if (!unit) return false;
            const attackable = getAttackableUnits(unit);
            return attackable.length > 0;
        }
    },
    useSpecial: {
        id: 'useSpecial',
        title: 'Spezialfähigkeit',
        message: 'Jede Einheit hat eine Spezialfähigkeit. Drücke den ⚡-Button oder tippe auf das Einheiten-Symbol.',
        position: 'bottom',
        condition: () => {
            const unit = getCurrentUnit();
            return unit && !unit.specialUsed && state.sharedAP >= 2;
        }
    },
    endTurn: {
        id: 'endTurn',
        title: 'Zug beenden',
        message: 'Wenn du fertig bist, drücke "Zug beenden" oder warte bis deine AP aufgebraucht sind.',
        position: 'bottom',
        condition: () => state.sharedAP <= 2
    },
    cover: {
        id: 'cover',
        title: 'Deckung nutzen',
        message: 'Wälder (🌲) bieten Deckung und reduzieren die Trefferchance des Gegners um 25%.',
        position: 'top',
        showOnce: true
    },
    terrain: {
        id: 'terrain',
        title: 'Gelände beachten',
        message: 'Verschiedene Geländetypen kosten unterschiedlich viele Bewegungspunkte. Wälder und Hügel kosten 2 AP.',
        position: 'bottom',
        showOnce: true
    },
    ambush: {
        id: 'ambush',
        title: 'Hinterhalt legen',
        message: 'Versteckte Einheiten (🛡️) können einen Hinterhalt vorbereiten. Feinde die in Reichweite kommen werden automatisch angegriffen! Kostet 1 AP.',
        position: 'bottom',
        showOnce: true
    },
    coordinated: {
        id: 'coordinated',
        title: 'Koordinierter Angriff',
        message: 'Wenn mehrere Einheiten ein Ziel angreifen können, erscheint der 👥-Button. Koordinierte Angriffe geben +15% Schaden pro zusätzlichem Angreifer!',
        position: 'top',
        showOnce: true
    },
    minigame: {
        id: 'minigame',
        title: 'Kampf-Minigames',
        message: 'Jeder Angriff startet ein Minigame! Je besser du abschneidest, desto mehr Schaden richtest du an. Die Schwierigkeit passt sich der Situation an.',
        position: 'center',
        showOnce: true
    },
    duel: {
        id: 'duel',
        title: 'Nahkampf-Duell',
        message: 'Commando-Angriffe sind echte Duelle: ⚔️ schlägt 💨, 🛡️ schlägt ⚔️, 💨 schlägt 🛡️. Gewinne 2 von 3 Runden!',
        position: 'center',
        showOnce: true
    }
};

// Track which hints have been shown globally (persisted in localStorage)
let globalShownHints = new Set();

/**
 * Initialize tutorial system
 */
export function initTutorial() {
    // Load shown hints from localStorage
    try {
        const saved = localStorage.getItem('shadowSquad_tutorialHints');
        if (saved) {
            globalShownHints = new Set(JSON.parse(saved));
        }

        const firstGame = localStorage.getItem('shadowSquad_firstGame');
        tutorialState.firstGamePlayed = firstGame === 'true';
    } catch {
        // localStorage not available, use defaults
    }
}

/**
 * Save tutorial progress to localStorage
 */
function saveTutorialProgress() {
    try {
        localStorage.setItem('shadowSquad_tutorialHints', JSON.stringify([...globalShownHints]));
        localStorage.setItem('shadowSquad_firstGame', 'true');
    } catch {
        // localStorage not available
    }
}

/**
 * Check if tutorial should start
 */
export function shouldStartTutorial() {
    // Don't show tutorial if setting is disabled
    if (state.settings && state.settings.showTutorial === false) return false;

    // Don't show tutorial if player has dismissed it or already played
    if (tutorialState.dismissedForGame) return false;

    // Show tutorial for first game ever
    if (!tutorialState.firstGamePlayed) return true;

    return false;
}

/**
 * Start the tutorial
 */
export function startTutorial() {
    tutorialState.active = true;
    tutorialState.step = 0;
    tutorialState.shownHints.clear();

    // Show welcome hint
    showTutorialHint('welcome');
}

/**
 * Stop the tutorial
 */
export function stopTutorial() {
    tutorialState.active = false;
    hideTutorialOverlay();
    saveTutorialProgress();
}

/**
 * Dismiss tutorial for this game session
 */
export function dismissTutorial() {
    tutorialState.dismissedForGame = true;
    stopTutorial();
}

/**
 * Check and show appropriate hint based on game state
 * Called after each action to provide contextual hints
 */
export function checkTutorialHint() {
    if (!tutorialState.active && !shouldStartTutorial()) return;

    // Activate tutorial if needed
    if (!tutorialState.active && shouldStartTutorial()) {
        startTutorial();
        return;
    }

    // Check conditions for hints in priority order
    const hintPriority = ['attackEnemy', 'moveUnit', 'selectUnit', 'useSpecial', 'endTurn'];

    for (const hintId of hintPriority) {
        const hint = TUTORIAL_HINTS[hintId];
        if (!hint) continue;

        // Skip if already shown this session
        if (tutorialState.shownHints.has(hintId)) continue;

        // Skip if showOnce and already shown globally
        if (hint.showOnce && globalShownHints.has(hintId)) continue;

        // Check condition
        if (hint.condition && !hint.condition()) continue;

        // Show this hint
        showTutorialHint(hintId);
        break;
    }
}

/**
 * Show a specific tutorial hint
 */
export function showTutorialHint(hintId) {
    const hint = TUTORIAL_HINTS[hintId];
    if (!hint) return;

    // Mark as shown
    tutorialState.shownHints.add(hintId);
    globalShownHints.add(hintId);

    // Create or update hint overlay
    let overlay = document.getElementById('tutorial-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.className = 'tutorial-overlay';
        document.body.appendChild(overlay);
    }

    // Position classes
    overlay.className = `tutorial-overlay tutorial-${hint.position || 'bottom'}`;

    overlay.innerHTML = `
        <div class="tutorial-hint">
            <div class="tutorial-hint-header">
                <span class="tutorial-hint-icon">💡</span>
                <span class="tutorial-hint-title">${hint.title}</span>
                <button class="tutorial-close-btn" onclick="window.dismissTutorialHint()">✕</button>
            </div>
            <div class="tutorial-hint-message">${hint.message}</div>
            <div class="tutorial-hint-actions">
                <button class="tutorial-btn tutorial-btn-dismiss" onclick="window.dismissTutorial()">Tutorial beenden</button>
                <button class="tutorial-btn tutorial-btn-ok" onclick="window.dismissTutorialHint()">OK, verstanden!</button>
            </div>
        </div>
    `;

    overlay.style.display = 'flex';

    // Save progress
    saveTutorialProgress();
}

/**
 * Hide the tutorial overlay
 */
export function hideTutorialOverlay() {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Dismiss current hint (global function for onclick)
 */
window.dismissTutorialHint = function () {
    hideTutorialOverlay();

    // After a short delay, check for the next hint
    setTimeout(() => {
        checkTutorialHint();
    }, 500);
};

/**
 * Dismiss tutorial entirely (global function for onclick)
 */
window.dismissTutorial = function () {
    dismissTutorial();
};

/**
 * Show hint for a specific action (can be called externally)
 */
export function showActionHint(actionType) {
    if (!tutorialState.active) return;

    const actionHints = {
        'moved': 'cover',
        'attacked': 'terrain',
        'special': null
    };

    const hintId = actionHints[actionType];
    if (hintId && !tutorialState.shownHints.has(hintId)) {
        setTimeout(() => {
            showTutorialHint(hintId);
        }, 800);
    }
}

// ===== TEAM SELECTION TUTORIAL =====

// Track shown team selection hints
let teamSelectHintsShown = new Set();
let currentTeamHintIndex = 0;
const TEAM_HINT_SEQUENCE = ['teamIntro', 'synergy_balanced', 'tactical_ambush', 'tactical_coordinated'];

/**
 * Start team selection tutorial
 * Called when entering the team selection screen
 */
export function startTeamSelectTutorial() {
    // Check if tutorial is enabled
    if (state.settings && state.settings.showTutorial === false) return;

    // Load shown hints from localStorage
    try {
        const saved = localStorage.getItem('shadowSquad_teamSelectHints');
        if (saved) {
            teamSelectHintsShown = new Set(JSON.parse(saved));
        }
    } catch { /* ignore */ }

    // Show intro hint if not shown before
    if (!teamSelectHintsShown.has('teamIntro')) {
        showTeamSelectHint('teamIntro');
    }
}

/**
 * Show a team selection hint
 */
export function showTeamSelectHint(hintId) {
    const hint = TEAM_SELECT_HINTS[hintId];
    if (!hint) return;

    // Mark as shown
    teamSelectHintsShown.add(hintId);

    // Save to localStorage
    try {
        localStorage.setItem('shadowSquad_teamSelectHints', JSON.stringify([...teamSelectHintsShown]));
    } catch { /* ignore */ }

    // Create or update hint overlay
    let overlay = document.getElementById('team-tutorial-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'team-tutorial-overlay';
        overlay.className = 'tutorial-overlay';
        document.body.appendChild(overlay);
    }

    // Position classes
    overlay.className = `tutorial-overlay tutorial-${hint.position || 'center'}`;

    overlay.innerHTML = `
        <div class="tutorial-hint team-select-hint">
            <div class="tutorial-hint-header">
                <span class="tutorial-hint-title">${hint.title}</span>
                <button class="tutorial-close-btn" onclick="window.dismissTeamSelectHint()">✕</button>
            </div>
            <div class="tutorial-hint-message">${hint.message}</div>
            <div class="tutorial-hint-actions">
                <button class="tutorial-btn tutorial-btn-more" onclick="window.showNextTeamTip()">💡 Mehr Tipps</button>
                <button class="tutorial-btn tutorial-btn-ok" onclick="window.dismissTeamSelectHint()">Verstanden!</button>
            </div>
        </div>
    `;

    overlay.style.display = 'flex';
}

/**
 * Show hint for a specific unit class when hovered/selected
 */
export function showUnitClassHint(classKey) {
    const hintId = classKey + 'Tip';
    const hint = TEAM_SELECT_HINTS[hintId];
    if (!hint) return;

    // Don't show if recently shown
    if (teamSelectHintsShown.has(hintId)) return;

    showTeamSelectHint(hintId);
}

/**
 * Hide team selection tutorial overlay
 */
export function hideTeamSelectTutorial() {
    const overlay = document.getElementById('team-tutorial-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Dismiss current team select hint (global function)
 */
window.dismissTeamSelectHint = function() {
    hideTeamSelectTutorial();
};

/**
 * Show next team tip (cycles through synergies and tactics)
 */
window.showNextTeamTip = function() {
    const allTips = [
        'synergy_balanced', 'synergy_stealth', 'synergy_defensive',
        'tactical_ambush', 'tactical_coordinated', 'tactical_flanking', 'tactical_cover'
    ];

    // Find next unshown tip
    let nextTip = null;
    for (const tip of allTips) {
        if (!teamSelectHintsShown.has(tip)) {
            nextTip = tip;
            break;
        }
    }

    // If all shown, cycle through
    if (!nextTip) {
        currentTeamHintIndex = (currentTeamHintIndex + 1) % allTips.length;
        nextTip = allTips[currentTeamHintIndex];
    }

    showTeamSelectHint(nextTip);
};

/**
 * Reset team selection tutorial hints
 */
export function resetTeamSelectTutorial() {
    teamSelectHintsShown.clear();
    currentTeamHintIndex = 0;
    try {
        localStorage.removeItem('shadowSquad_teamSelectHints');
    } catch { /* ignore */ }
}

/**
 * Reset tutorial (for testing or user request)
 */
export function resetTutorial() {
    tutorialState.active = false;
    tutorialState.step = 0;
    tutorialState.shownHints.clear();
    tutorialState.dismissedForGame = false;
    tutorialState.firstGamePlayed = false;
    globalShownHints.clear();

    // Also reset team selection hints
    resetTeamSelectTutorial();

    try {
        localStorage.removeItem('shadowSquad_tutorialHints');
        localStorage.removeItem('shadowSquad_firstGame');
    } catch {
        // localStorage not available
    }

    hideTutorialOverlay();

    // Notify user
    showToast('💡 Tutorial wird im nächsten Spiel angezeigt', 'info');
}

/**
 * Check if tutorial is currently active
 */
export function isTutorialActive() {
    return tutorialState.active;
}

// Initialize on module load
initTutorial();
