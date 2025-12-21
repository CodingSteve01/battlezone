// ===== MAIN ENTRY POINT =====

import { state, resetState } from './state.js';
import { CONFIG, UNIT_CLASSES } from './config.js';
import { generateMap } from './map.js';
import { createUnits } from './units.js';
import { startTurn } from './turns.js';
import { initRenderer, resizeCanvas, render } from './renderer.js';
import { updateUI, showScreen } from './ui.js';
import { initInput, centerOnCurrentUnit } from './input.js';
import { updateVisibility } from './fogOfWar.js';
import { generatePowerups } from './powerups.js';
import { initUnitProgression } from './progression.js';

// Team selection state
let currentTeamSelectPlayer = 0;
let currentPlayerSelection = [];

/**
 * Start team selection process
 */
function startTeamSelection() {
    // Initialize team selections array
    state.teamSelections = [];
    for (let i = 0; i < state.settings.players; i++) {
        state.teamSelections.push([]);
    }

    currentTeamSelectPlayer = 0;
    showTeamSelectForPlayer(0);
}

/**
 * Show team selection screen for a specific player
 */
function showTeamSelectForPlayer(playerIndex) {
    currentTeamSelectPlayer = playerIndex;
    currentPlayerSelection = [];

    // Update header
    const badge = document.getElementById('team-select-badge');
    const playerNum = document.getElementById('team-select-player');

    if (badge) {
        badge.style.backgroundColor = CONFIG.PLAYER_COLORS[playerIndex];
        badge.textContent = playerIndex + 1;
    }
    if (playerNum) {
        playerNum.textContent = playerIndex + 1;
    }

    // Generate unit cards
    generateUnitCards();

    // Reset preview
    updateTeamPreview();

    // Disable confirm button
    const confirmBtn = document.getElementById('team-confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }

    showScreen('team-select');
}

/**
 * Generate unit selection cards
 */
function generateUnitCards() {
    const grid = document.getElementById('team-select-grid');
    if (!grid) return;

    grid.innerHTML = '';

    Object.entries(UNIT_CLASSES).forEach(([classKey, classData]) => {
        const card = document.createElement('div');
        card.className = 'unit-card';
        card.dataset.class = classKey;

        card.innerHTML = `
            <div class="unit-icon">${classData.icon}</div>
            <div class="unit-name">${classData.name}</div>
            <div class="unit-stats">
                ❤️ ${classData.hp} HP • ⚔️ ${classData.damage} DMG<br>
                📍 ${classData.move} Felder • 🎯 ${classData.range} Reichweite
            </div>
            <div class="unit-special">✨ ${classData.special}: ${classData.specialDesc}</div>
        `;

        card.onclick = () => toggleUnitSelection(classKey, card);
        grid.appendChild(card);
    });
}

/**
 * Toggle unit selection
 */
function toggleUnitSelection(classKey, card) {
    const index = currentPlayerSelection.indexOf(classKey);

    if (index >= 0) {
        // Remove from selection
        currentPlayerSelection.splice(index, 1);
        updateCardSelectionState();
    } else if (currentPlayerSelection.length < CONFIG.UNITS_PER_PLAYER) {
        // Add to selection
        currentPlayerSelection.push(classKey);
        updateCardSelectionState();
    }

    updateTeamPreview();

    // Enable/disable confirm button
    const confirmBtn = document.getElementById('team-confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = currentPlayerSelection.length !== CONFIG.UNITS_PER_PLAYER;
    }
}

/**
 * Update visual selection state of cards
 */
function updateCardSelectionState() {
    const cards = document.querySelectorAll('.unit-card');
    cards.forEach(card => {
        const classKey = card.dataset.class;
        const count = currentPlayerSelection.filter(c => c === classKey).length;

        card.classList.toggle('selected', count > 0);

        // Update or remove count badge
        let countBadge = card.querySelector('.select-count');
        if (count > 0) {
            if (!countBadge) {
                countBadge = document.createElement('div');
                countBadge.className = 'select-count';
                card.appendChild(countBadge);
            }
            countBadge.textContent = count;
        } else if (countBadge) {
            countBadge.remove();
        }
    });
}

/**
 * Update team preview slots
 */
function updateTeamPreview() {
    const previewContainer = document.getElementById('team-preview-units');
    if (!previewContainer) return;

    const slots = previewContainer.querySelectorAll('.team-slot');
    slots.forEach((slot, index) => {
        if (currentPlayerSelection[index]) {
            const classData = UNIT_CLASSES[currentPlayerSelection[index]];
            slot.textContent = classData.icon;
            slot.classList.add('filled');
            slot.classList.remove('empty');
        } else {
            slot.textContent = '?';
            slot.classList.remove('filled');
            slot.classList.add('empty');
        }
    });
}

/**
 * Confirm team selection for current player
 */
function confirmTeamSelection() {
    if (currentPlayerSelection.length !== CONFIG.UNITS_PER_PLAYER) return;

    // Save selection
    state.teamSelections[currentTeamSelectPlayer] = [...currentPlayerSelection];

    // Move to next player or start game
    if (currentTeamSelectPlayer < state.settings.players - 1) {
        showTeamSelectForPlayer(currentTeamSelectPlayer + 1);
    } else {
        // All players selected, start game
        startGameWithTeams();
    }
}

/**
 * Start a new game with selected teams
 */
function startGameWithTeams() {
    // Reset state (but keep teamSelections)
    const savedSelections = [...state.teamSelections];
    resetState();
    state.teamSelections = savedSelections;

    // Reset camera position
    state.cameraX = 0;
    state.cameraY = 0;

    // Generate map and units
    generateMap();
    createUnits(); // Now uses state.teamSelections

    // Initialize progression for all units
    state.units.forEach(unit => initUnitProgression(unit));

    // Generate power-ups on the map
    generatePowerups();

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
 * Start a new game (legacy - now goes through team selection)
 */
export function startGame() {
    startTeamSelection();
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

    // Setup team confirm button
    const teamConfirmBtn = document.getElementById('team-confirm-btn');
    if (teamConfirmBtn) {
        teamConfirmBtn.onclick = confirmTeamSelection;
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
