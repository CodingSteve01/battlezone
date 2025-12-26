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
