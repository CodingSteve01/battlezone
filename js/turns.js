// ===== TURN MANAGEMENT =====

import { state, getPlayerUnits, getQueuedPath, updatePreviouslyVisibleEnemies } from './state.js';
import { CONFIG } from './config.js';
import { resetUnitsForTurn, resetSpecialAbilities } from './units.js';
import { updateVisibility, getVisibleEnemies } from './fogOfWar.js';
import { checkGameOver } from './combat.js';
import { showScreen, updateUI, showToast, showEventBanner } from './ui.js';
import { render } from './renderer.js';
import { centerOnCurrentUnit } from './input.js';
import { updatePowerupBuffs, spawnNewPowerups } from './powerups.js';
import { rollRoundEvent, clearRoundEvent } from './events.js';
import { isAIPlayer, executeAITurn } from './ai.js';
import { playRoundStart, playTurnEnd, playVictory, playDefeat, playEvent, stopAmbient } from './audio.js';

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
    state.pendingMoveDestination = null;

    // Update fog of war
    updateVisibility();

    // Initialize enemy tracking for this player's turn
    const visibleEnemies = getVisibleEnemies();
    updatePreviouslyVisibleEnemies(visibleEnemies.map(e => e.id));

    // Check if selected unit has a queued path
    const currentUnit = units[0];
    if (currentUnit) {
        const queuedPath = getQueuedPath(currentUnit.id);
        if (queuedPath && queuedPath.path) {
            // Show notification about queued path
            setTimeout(() => {
                showToast('📍 Gespeicherter Wegpunkt vorhanden', 'info');
            }, 500);
        }
    }

    // Check if this is an AI player
    if (isAIPlayer()) {
        // Skip turn screen for AI, go directly to game
        showScreen(null);
        updateUI();
        render();

        // Execute AI turn after short delay
        setTimeout(() => {
            executeAITurn();
        }, 500);
        return;
    }

    // Play round start sound
    playRoundStart();

    // Show turn screen for human players
    const turnBadge = document.getElementById('turn-badge');
    if (turnBadge) {
        turnBadge.style.backgroundColor = CONFIG.PLAYER_COLORS[state.currentPlayer];
        turnBadge.textContent = state.currentPlayer + 1;
    }

    const turnNum = document.getElementById('turn-num');
    if (turnNum) {
        turnNum.textContent = state.currentPlayer + 1;
    }

    // In single player, skip the turn screen for player 1 after first turn
    if (state.settings.singlePlayer && state.round > 1) {
        showScreen(null);
        updateUI();
        render();
        requestAnimationFrame(() => {
            centerOnCurrentUnit();
        });
        return;
    }

    showScreen('turn-screen');
}

/**
 * End current turn
 */
export function endTurn() {
    playTurnEnd();
    nextPlayer();
}

/**
 * Move to next player
 */
export function nextPlayer() {
    // Update power-up buffs for ending player
    updatePowerupBuffs(state.currentPlayer);

    state.currentPlayer = (state.currentPlayer + 1) % state.settings.players;

    // New round
    if (state.currentPlayer === 0) {
        state.round++;
        resetSpecialAbilities();

        // Clear previous round's event
        clearRoundEvent();

        // Roll for new round event
        const event = rollRoundEvent();
        if (event) {
            setTimeout(() => {
                playEvent();
                showEventBanner(event);
            }, 500);
        }

        // Spawn new power-ups periodically
        spawnNewPowerups();

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

    // Center camera on first unit
    requestAnimationFrame(() => {
        centerOnCurrentUnit();
    });
}

/**
 * End the game
 */
export function endGame(winner) {
    state.gameOver = true;

    // Stop ambient sounds
    stopAmbient();

    // Play victory or defeat sound
    if (winner !== null) {
        // In single player, check if human won
        if (state.settings.singlePlayer) {
            if (winner === 0) {
                playVictory();
            } else {
                playDefeat();
            }
        } else {
            playVictory();
        }
    } else {
        playDefeat();  // Draw
    }

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
        // Show announcement toast before game over screen
        if (result.winner !== null) {
            showToast(`🏆 SPIELER ${result.winner + 1} GEWINNT!`, 'levelup');
        } else {
            showToast('⚖️ UNENTSCHIEDEN!', 'special');
        }
        setTimeout(() => endGame(result.winner), 1500);
        return true;
    }
    return false;
}
