// ===== MAIN ENTRY POINT =====

import { state, resetState } from './state.js';
import { generateMap } from './map.js';
import { createUnits } from './units.js';
import { startTurn } from './turns.js';
import { initRenderer, resizeCanvas, render } from './renderer.js';
import { updateUI, showScreen } from './ui.js';
import { initInput } from './input.js';
import { updateVisibility } from './fogOfWar.js';

/**
 * Start a new game
 */
export function startGame() {
    // Reset state
    resetState();

    // Generate map and units
    generateMap();
    createUnits();

    // Initialize visibility
    updateVisibility();

    // Show game area
    showScreen(null);

    // Initialize canvas
    resizeCanvas();

    // Start first turn
    startTurn();
}

/**
 * Initialize the application
 */
function init() {
    // Setup start button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.onclick = startGame;
    }

    // Setup rematch button
    const rematchBtn = document.getElementById('rematch-btn');
    if (rematchBtn) {
        rematchBtn.onclick = startGame;
    }

    // Initialize renderer
    initRenderer();

    // Initialize input handlers
    initInput();

    // Show menu
    showScreen('menu');

    console.log('Shadow Squad initialized');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
