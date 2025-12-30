// ===== INTERACTIVE TUTORIAL SYSTEM =====
// Mit geführtem Schritt-für-Schritt Tutorial für Erstspielende

import { state, getCurrentUnit } from './state.js';
import { getAttackableUnits } from './units.js';
import { showToast } from './ui.js';

// Tutorial state
const tutorialState = {
    active: false,
    step: 0,
    shownHints: new Set(),
    dismissedForGame: false,
    firstGamePlayed: false,
    // Guided tutorial state
    guidedMode: false,
    guidedStep: 0,
    guidedCompleted: false,
    waitingForAction: null // 'select', 'move', 'attack', 'endTurn'
};

// ===== GUIDED TUTORIAL STEPS =====
// Defines the step-by-step guided tutorial for first-time players

const GUIDED_TUTORIAL_STEPS = [
    {
        id: 'intro',
        title: '🎮 Willkommen bei Shadow Squad!',
        message: 'Dieses Tutorial führt dich durch deinen ersten Zug. Du lernst, wie du Einheiten bewegst und angreifst.',
        action: 'continue', // Just click to continue
        position: 'center',
        showProgress: true
    },
    {
        id: 'explain_goal',
        title: '🎯 Spielziel',
        message: 'Ziel ist es, <b>alle gegnerischen Einheiten zu eliminieren</b>. Du und dein Gegner ziehen abwechselnd.',
        action: 'continue',
        position: 'center',
        showProgress: true
    },
    {
        id: 'explain_ap',
        title: '⚡ Aktionspunkte (AP)',
        message: 'Dein Team teilt sich einen <b>AP-Pool</b>. Bewegung und Angriffe kosten AP. Nutze sie klug!',
        action: 'continue',
        position: 'top',
        showProgress: true,
        highlightElement: '#ap-display'
    },
    {
        id: 'select_unit',
        title: '👆 Einheit auswählen',
        message: 'Tippe auf eine <b>deiner Einheiten</b> (grün umrandet), um sie auszuwählen.',
        action: 'select',
        position: 'bottom',
        showProgress: true,
        waitFor: 'unitSelected'
    },
    {
        id: 'explain_movement',
        title: '🚶 Bewegung',
        message: 'Die <b>farbigen Felder</b> zeigen, wohin du gehen kannst:<br>🟢 Grün = Nah (1-2 AP)<br>🟡 Gelb = Mittel (3-4 AP)<br>🔴 Rot = Weit (5+ AP)',
        action: 'continue',
        position: 'center',
        showProgress: true
    },
    {
        id: 'move_unit',
        title: '➡️ Jetzt bewegen!',
        message: 'Tippe auf ein <b>grün oder gelb markiertes Feld</b>, um deine Einheit dorthin zu bewegen.',
        action: 'move',
        position: 'bottom',
        showProgress: true,
        waitFor: 'unitMoved'
    },
    {
        id: 'explain_attack',
        title: '⚔️ Angreifen',
        message: 'Wenn Feinde in Reichweite sind, werden sie <b>rot markiert</b>. Tippe auf einen Feind, um anzugreifen!',
        action: 'continue',
        position: 'center',
        showProgress: true
    },
    {
        id: 'explain_minigame',
        title: '🎯 Kampf-Minigames',
        message: 'Jeder Angriff startet ein <b>kurzes Minigame</b>. Je besser du abschneidest, desto mehr Schaden richtest du an!',
        action: 'continue',
        position: 'center',
        showProgress: true
    },
    {
        id: 'explain_special',
        title: '⚡ Spezialfähigkeiten',
        message: 'Jede Einheitsklasse hat eine <b>einzigartige Fähigkeit</b>. Drücke den ⚡-Button oder tippe auf das Einheits-Symbol.',
        action: 'continue',
        position: 'bottom',
        showProgress: true
    },
    {
        id: 'explain_terrain',
        title: '🌲 Gelände nutzen',
        message: '<b>Wälder</b> bieten Deckung (-25% Trefferchance)<br><b>Hügel</b> geben +1 Reichweite und Verteidigung<br><b>Sümpfe</b> verlangsamen Bewegung',
        action: 'continue',
        position: 'center',
        showProgress: true
    },
    {
        id: 'complete',
        title: '🎉 Tutorial abgeschlossen!',
        message: 'Du kennst jetzt die Grundlagen! <b>Experimentiere</b> mit verschiedenen Einheiten und Taktiken. Viel Erfolg!',
        action: 'finish',
        position: 'center',
        showProgress: true
    }
];

// Team selection tutorial hints - shown during unit selection
const TEAM_SELECT_HINTS = {
    teamIntro: {
        id: 'teamIntro',
        title: '🎖️ Stelle dein Team zusammen!',
        message: 'Du hast <b>350 Budget</b> um dein Team zusammenzustellen. Wähle zwischen 2-5 Einheiten - günstige Einheiten für Überzahl oder teure Elite-Soldaten für Qualität!',
        position: 'top'
    },
    budgetTip: {
        id: 'budgetTip',
        title: '💰 Das Budget-System',
        message: '<b>Günstig (70-80):</b> Scout, Medic - mehr Einheiten möglich<br><b>Mittel (90-110):</b> Assault, Commando, Sniper - solide Wahl<br><b>Elite (150):</b> Kommando-Soldat - teuer aber mächtig!',
        position: 'center'
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
        message: '<b>Kosten:</b> 90 💰<br><b>Stärken:</b> Brutaler Nahkampf (50+20 Bonus!), Schleichen, schnell<br><b>Taktik:</b> Aus dem Hinterhalt angreifen. Perfekt für Flanken und Hinterhalte!',
        position: 'bottom',
        forClass: 'commando'
    },
    elitesoldatTip: {
        id: 'elitesoldatTip',
        title: '🎖️ Kommando-Soldat - Die Elite',
        message: '<b>Kosten:</b> 150 💰 (TEUER!)<br><b>Stärken:</b> Vielseitig! Kann sowohl Nahkampf (+30 Bonus) als auch Fernkampf (Reichweite 3)<br><b>Taktik:</b> Ein Elite-Soldat kann 2 normale Einheiten ersetzen. Perfekt für kleine, starke Teams!',
        position: 'bottom',
        forClass: 'elitesoldat'
    },
    synergy_balanced: {
        id: 'synergy_balanced',
        title: '⚖️ Tipp: Ausgewogenes Team (250 💰)',
        message: '<b>Scout + Assault + Medic</b> = Klassiker!<br>Scout findet Feinde → Assault greift an → Medic heilt. <b>100 Budget übrig</b> für eine weitere Einheit!',
        position: 'center'
    },
    synergy_stealth: {
        id: 'synergy_stealth',
        title: '🌙 Tipp: Schattentaktik (270 💰)',
        message: '<b>Scout + Sniper + Commando</b> = Hinterhalt!<br>Scout späht aus → Sniper dezimiert → Commando erledigt den Rest. <b>80 Budget übrig</b>!',
        position: 'center'
    },
    synergy_defensive: {
        id: 'synergy_defensive',
        title: '🛡️ Tipp: Defensive Formation (290 💰)',
        message: '<b>Assault + Medic + Sniper</b> = Festung!<br>Assault hält die Linie → Medic heilt → Sniper kontrolliert das Feld. <b>60 Budget übrig</b>!',
        position: 'center'
    },
    synergy_elite: {
        id: 'synergy_elite',
        title: '🎖️ Tipp: Elite-Trupp (230-300 💰)',
        message: '<b>Kommando-Soldat + Medic</b> = Qualität über Quantität!<br>Nur 2 Einheiten, aber der Elite-Soldat kann kämpfen wie zwei. <b>Riskant aber mächtig!</b>',
        position: 'center'
    },
    synergy_swarm: {
        id: 'synergy_swarm',
        title: '🐜 Tipp: Schwarm-Taktik (300 💰)',
        message: '<b>4x günstige Einheiten</b> = Überzahl!<br>Scout + Scout + Medic + Medic oder ähnlich. <b>Mehr Einheiten = mehr Aktionspunkte!</b>',
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
if (typeof window !== 'undefined') {
    window.dismissTutorialHint = function () {
        hideTutorialOverlay();

        // After a short delay, check for the next hint
        setTimeout(() => {
            checkTutorialHint();
        }, 500);
    };
}

/**
 * Dismiss tutorial entirely (global function for onclick)
 */
if (typeof window !== 'undefined') {
    window.dismissTutorial = function () {
        dismissTutorial();
    };
}

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
if (typeof window !== 'undefined') {
    window.dismissTeamSelectHint = function() {
        hideTeamSelectTutorial();
    };
}

/**
 * Show next team tip (cycles through synergies and tactics)
 */
if (typeof window !== 'undefined') {
    window.showNextTeamTip = function() {
        const allTips = [
            'budgetTip', 'synergy_balanced', 'synergy_stealth', 'synergy_defensive',
            'synergy_elite', 'synergy_swarm',
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
}

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

// ===== GUIDED TUTORIAL SYSTEM =====

/**
 * Start the guided tutorial for first-time players
 */
export function startGuidedTutorial() {
    tutorialState.guidedMode = true;
    tutorialState.guidedStep = 0;
    tutorialState.guidedCompleted = false;
    tutorialState.waitingForAction = null;

    // Create guided tutorial overlay if not exists
    createGuidedTutorialOverlay();

    // Show first step
    showGuidedStep(0);
}

/**
 * Create the guided tutorial overlay
 */
function createGuidedTutorialOverlay() {
    let overlay = document.getElementById('guided-tutorial-overlay');
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'guided-tutorial-overlay';
    overlay.className = 'guided-tutorial-overlay';
    document.body.appendChild(overlay);

    // Add CSS for guided tutorial
    addGuidedTutorialStyles();
}

/**
 * Add CSS styles for guided tutorial
 */
function addGuidedTutorialStyles() {
    if (document.getElementById('guided-tutorial-styles')) return;

    const style = document.createElement('style');
    style.id = 'guided-tutorial-styles';
    style.textContent = `
        .guided-tutorial-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            padding: 20px;
        }

        .guided-tutorial-overlay.active {
            display: flex;
        }

        .guided-tutorial-overlay.position-top {
            align-items: flex-start;
            padding-top: 80px;
        }

        .guided-tutorial-overlay.position-bottom {
            align-items: flex-end;
            padding-bottom: 120px;
        }

        .guided-tutorial-card {
            background: linear-gradient(145deg, #1a1a2e, #16213e);
            border: 2px solid #3b82f6;
            border-radius: 16px;
            padding: 24px;
            max-width: 380px;
            width: 100%;
            animation: tutorial-card-appear 0.4s ease;
            box-shadow: 0 10px 40px rgba(59, 130, 246, 0.3);
        }

        @keyframes tutorial-card-appear {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .guided-tutorial-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }

        .guided-tutorial-title {
            font-size: 20px;
            font-weight: bold;
            color: #fff;
            flex: 1;
        }

        .guided-tutorial-close {
            background: none;
            border: none;
            color: #6b7280;
            font-size: 20px;
            cursor: pointer;
            padding: 4px;
            line-height: 1;
        }

        .guided-tutorial-close:hover {
            color: #ef4444;
        }

        .guided-tutorial-message {
            color: #e2e8f0;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 20px;
        }

        .guided-tutorial-message b {
            color: #fbbf24;
        }

        .guided-tutorial-progress {
            display: flex;
            gap: 6px;
            margin-bottom: 20px;
        }

        .guided-tutorial-progress-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #374151;
            transition: background 0.3s, transform 0.3s;
        }

        .guided-tutorial-progress-dot.completed {
            background: #22c55e;
        }

        .guided-tutorial-progress-dot.current {
            background: #3b82f6;
            transform: scale(1.3);
        }

        .guided-tutorial-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }

        .guided-tutorial-btn {
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
        }

        .guided-tutorial-btn-skip {
            background: transparent;
            border: 1px solid #4b5563;
            color: #9ca3af;
        }

        .guided-tutorial-btn-skip:hover {
            background: #374151;
            color: #fff;
        }

        .guided-tutorial-btn-continue {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #fff;
        }

        .guided-tutorial-btn-continue:hover {
            background: linear-gradient(135deg, #60a5fa, #3b82f6);
            transform: translateY(-2px);
        }

        .guided-tutorial-btn-finish {
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: #fff;
        }

        .guided-tutorial-waiting {
            text-align: center;
            color: #fbbf24;
            font-size: 14px;
            margin-top: 12px;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .tutorial-highlight {
            position: relative;
            z-index: 2001;
            animation: tutorial-highlight-pulse 1.5s infinite;
        }

        @keyframes tutorial-highlight-pulse {
            0%, 100% {
                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
            }
            50% {
                box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3);
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show a specific guided tutorial step
 */
function showGuidedStep(stepIndex) {
    const step = GUIDED_TUTORIAL_STEPS[stepIndex];
    if (!step) {
        finishGuidedTutorial();
        return;
    }

    tutorialState.guidedStep = stepIndex;

    const overlay = document.getElementById('guided-tutorial-overlay');
    if (!overlay) return;

    // Set position
    overlay.className = 'guided-tutorial-overlay active';
    if (step.position === 'top') {
        overlay.classList.add('position-top');
    } else if (step.position === 'bottom') {
        overlay.classList.add('position-bottom');
    }

    // Generate progress dots
    const progressHTML = step.showProgress ? `
        <div class="guided-tutorial-progress">
            ${GUIDED_TUTORIAL_STEPS.map((s, i) => `
                <div class="guided-tutorial-progress-dot ${i < stepIndex ? 'completed' : ''} ${i === stepIndex ? 'current' : ''}"></div>
            `).join('')}
        </div>
    ` : '';

    // Generate action buttons based on step type
    let actionsHTML = '';
    let waitingHTML = '';

    if (step.action === 'continue') {
        actionsHTML = `
            <button class="guided-tutorial-btn guided-tutorial-btn-skip" onclick="window.skipGuidedTutorial()">Überspringen</button>
            <button class="guided-tutorial-btn guided-tutorial-btn-continue" onclick="window.nextGuidedStep()">Weiter</button>
        `;
    } else if (step.action === 'finish') {
        actionsHTML = `
            <button class="guided-tutorial-btn guided-tutorial-btn-finish" onclick="window.finishGuidedTutorial()">Los geht's!</button>
        `;
    } else if (step.action === 'select' || step.action === 'move' || step.action === 'attack') {
        tutorialState.waitingForAction = step.waitFor;
        // Hide overlay to allow interaction
        overlay.classList.remove('active');
        // Show a small floating hint instead
        showFloatingTutorialHint(step);
        return;
    }

    overlay.innerHTML = `
        <div class="guided-tutorial-card">
            <div class="guided-tutorial-header">
                <span class="guided-tutorial-title">${step.title}</span>
                <button class="guided-tutorial-close" onclick="window.skipGuidedTutorial()">✕</button>
            </div>
            ${progressHTML}
            <div class="guided-tutorial-message">${step.message}</div>
            ${waitingHTML}
            <div class="guided-tutorial-actions">
                ${actionsHTML}
            </div>
        </div>
    `;

    // Handle element highlighting
    if (step.highlightElement) {
        const el = document.querySelector(step.highlightElement);
        if (el) {
            el.classList.add('tutorial-highlight');
        }
    }
}

/**
 * Show a floating hint during interactive steps
 */
function showFloatingTutorialHint(step) {
    let hint = document.getElementById('floating-tutorial-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'floating-tutorial-hint';
        hint.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(145deg, #1a1a2e, #16213e);
            border: 2px solid #fbbf24;
            border-radius: 12px;
            padding: 16px 24px;
            color: #fff;
            font-size: 15px;
            z-index: 1500;
            text-align: center;
            max-width: 320px;
            box-shadow: 0 4px 20px rgba(251, 191, 36, 0.3);
            animation: float-hint 2s infinite ease-in-out;
        `;
        document.body.appendChild(hint);

        // Add float animation
        const floatStyle = document.createElement('style');
        floatStyle.textContent = `
            @keyframes float-hint {
                0%, 100% { transform: translateX(-50%) translateY(0); }
                50% { transform: translateX(-50%) translateY(-5px); }
            }
        `;
        document.head.appendChild(floatStyle);
    }

    hint.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">${step.title}</div>
        <div>${step.message}</div>
        <button onclick="window.skipGuidedTutorial()" style="
            margin-top: 12px;
            background: transparent;
            border: 1px solid #4b5563;
            color: #9ca3af;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
        ">Tutorial beenden</button>
    `;
    hint.style.display = 'block';
}

/**
 * Hide the floating tutorial hint
 */
function hideFloatingTutorialHint() {
    const hint = document.getElementById('floating-tutorial-hint');
    if (hint) {
        hint.style.display = 'none';
    }
}

/**
 * Advance to next guided tutorial step
 */
if (typeof window !== 'undefined') {
    window.nextGuidedStep = function() {
        // Remove any highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });

        showGuidedStep(tutorialState.guidedStep + 1);
    };
}

/**
 * Skip the guided tutorial
 */
if (typeof window !== 'undefined') {
    window.skipGuidedTutorial = function() {
        finishGuidedTutorial();
        showToast('💡 Tutorial übersprungen - Du kannst es in den Optionen neu starten', 'info');
    };
}

/**
 * Finish the guided tutorial
 */
if (typeof window !== 'undefined') {
    window.finishGuidedTutorial = function() {
        finishGuidedTutorial();
    };
}

/**
 * Complete the guided tutorial
 */
function finishGuidedTutorial() {
    tutorialState.guidedMode = false;
    tutorialState.guidedCompleted = true;
    tutorialState.waitingForAction = null;

    // Hide overlays
    const overlay = document.getElementById('guided-tutorial-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    hideFloatingTutorialHint();

    // Remove any highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
    });

    // Mark first game as played
    tutorialState.firstGamePlayed = true;
    saveTutorialProgress();
}

/**
 * Notify guided tutorial of a game action
 * Called from input.js when the player performs actions
 */
export function notifyTutorialAction(actionType) {
    if (!tutorialState.guidedMode || !tutorialState.waitingForAction) return;

    if (tutorialState.waitingForAction === actionType) {
        tutorialState.waitingForAction = null;
        hideFloatingTutorialHint();

        // Short delay then show next step
        setTimeout(() => {
            window.nextGuidedStep();
        }, 500);
    }
}

/**
 * Check if guided tutorial is active
 */
export function isGuidedTutorialActive() {
    return tutorialState.guidedMode;
}

/**
 * Check if should start guided tutorial (for first-time players)
 */
export function shouldStartGuidedTutorial() {
    // Don't show if setting is disabled
    if (state.settings && state.settings.showTutorial === false) return false;

    // Don't show if already completed this session
    if (tutorialState.guidedCompleted) return false;

    // Don't show if dismissed
    if (tutorialState.dismissedForGame) return false;

    // Show for first game ever
    if (!tutorialState.firstGamePlayed) return true;

    return false;
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
    tutorialState.guidedMode = false;
    tutorialState.guidedStep = 0;
    tutorialState.guidedCompleted = false;
    tutorialState.waitingForAction = null;
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
    hideFloatingTutorialHint();

    // Notify user
    showToast('💡 Tutorial wird im nächsten Spiel angezeigt', 'info');
}

/**
 * Check if tutorial is currently active
 */
export function isTutorialActive() {
    return tutorialState.active || tutorialState.guidedMode;
}

// Initialize on module load
initTutorial();
