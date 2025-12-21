/**
 * Turn Management System
 */

import { CONFIG } from './config.js';
import { gameState } from './state.js';
import { resetPlayerTurn } from './player.js';
import { showTurnScreen, showGameOverScreen } from './ui.js';

export function startTurn() {
    const player = gameState.getCurrentPlayer();

    if (!player.alive) {
        nextPlayer();
        return;
    }

    resetPlayerTurn(player);
    gameState.selectedAction = 'move';

    showTurnScreen(player);
}

export function endTurn() {
    nextPlayer();
}

export function nextPlayer() {
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

    if (gameState.currentPlayer === 0) {
        gameState.round++;
        // Clear overwatchers at round end
        gameState.overwatchers = [];
        gameState.players.forEach(p => p.overwatch = false);

        if (gameState.round > CONFIG.MAX_ROUNDS) {
            endGame(null);
            return;
        }
    }

    const alive = gameState.getAlivePlayers();
    if (alive.length <= 1) {
        checkWin();
        return;
    }

    if (!gameState.getCurrentPlayer().alive) {
        nextPlayer();
        return;
    }

    startTurn();
}

export function checkWin() {
    const alive = gameState.getAlivePlayers();
    if (alive.length === 1) {
        endGame(alive[0]);
    } else if (alive.length === 0) {
        endGame(null);
    }
}

export function endGame(winner) {
    gameState.gameOver = true;
    showGameOverScreen(winner);
}
