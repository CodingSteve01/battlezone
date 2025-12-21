// ===== TURN MANAGEMENT =====

import { state, getPlayerUnits } from './state.js';
import { CONFIG } from './config.js';
import { resetUnitsForTurn, resetSpecialAbilities } from './units.js';
import { updateVisibility } from './fogOfWar.js';
import { checkGameOver } from './combat.js';
import { showScreen, updateUI } from './ui.js';
import { render } from './renderer.js';

/**
 * Start a player's turn
 */
export function startTurn() {
    const units = getPlayerUnits(state.currentPlayer);

    // Skip players with no units
    if (units.length === 0) {
        nextPlayer();
        return;
    }

    // Reset units for turn
    resetUnitsForTurn(state.currentPlayer);

    // Set initial selection
    state.selectedUnit = 0;
    state.selectedAction = 'move';
    state.targetedUnit = null;
    state.currentPath = null;

    // Update fog of war
    updateVisibility();

    // Show turn screen
    const turnBadge = document.getElementById('turn-badge');
    if (turnBadge) {
        turnBadge.style.backgroundColor = CONFIG.PLAYER_COLORS[state.currentPlayer];
        turnBadge.textContent = state.currentPlayer + 1;
    }

    const turnNum = document.getElementById('turn-num');
    if (turnNum) {
        turnNum.textContent = state.currentPlayer + 1;
    }

    showScreen('turn-screen');
}

/**
 * End current turn
 */
export function endTurn() {
    nextPlayer();
}

/**
 * Move to next player
 */
export function nextPlayer() {
    state.currentPlayer = (state.currentPlayer + 1) % state.settings.players;

    // New round
    if (state.currentPlayer === 0) {
        state.round++;
        resetSpecialAbilities();

        // Check max rounds
        if (state.round > CONFIG.MAX_ROUNDS) {
            endGame(null);
            return;
        }
    }

    // Skip eliminated players
    const units = getPlayerUnits(state.currentPlayer);
    if (units.length === 0) {
        // Check if game is over
        const result = checkGameOver();
        if (result.gameOver) {
            endGame(result.winner);
            return;
        }

        // Skip to next player
        nextPlayer();
        return;
    }

    startTurn();
}

/**
 * Handle ready button (after turn screen)
 */
export function handleReady() {
    showScreen(null);
    updateVisibility();
    updateUI();
    render();
}

/**
 * End the game
 */
export function endGame(winner) {
    state.gameOver = true;

    const winnerText = document.getElementById('winner-text');
    if (winnerText) {
        if (winner !== null) {
            winnerText.textContent = `Spieler ${winner + 1} gewinnt!`;
            winnerText.style.color = CONFIG.PLAYER_COLORS[winner];
        } else {
            winnerText.textContent = 'Unentschieden!';
            winnerText.style.color = '#e2e8f0';
        }
    }

    showScreen('gameover');
}

/**
 * Check and handle win condition
 */
export function checkWinCondition() {
    const result = checkGameOver();
    if (result.gameOver) {
        setTimeout(() => endGame(result.winner), 1200);
        return true;
    }
    return false;
}
