/**
 * Input Handling
 */

import { gameState } from './state.js';
import { tryMove, tryShoot, tryGrenade, tryOverwatch, tryReload, toggleSneak } from './actions.js';
import { updateUI, showScreen } from './ui.js';
import { startTurn, endTurn } from './turns.js';
import { renderPlayers } from './renderer.js';
import { startGame } from './game.js';

export function handleTileClick(x, y) {
    if (gameState.gameOver) return;

    const player = gameState.getCurrentPlayer();
    if (!player || !player.alive) return;

    switch (gameState.selectedAction) {
        case 'move':
            tryMove(player, x, y);
            break;
        case 'shoot':
            tryShoot(player, x, y);
            break;
        case 'grenade':
            tryGrenade(player, x, y);
            break;
        case 'overwatch':
            tryOverwatch(player);
            break;
        case 'reload':
            tryReload(player);
            break;
    }
}

export function setupEventListeners() {
    // Menu - Player count
    document.querySelectorAll('.player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            gameState.settings.players = parseInt(btn.dataset.players);
        });
    });

    // Menu - Game mode
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            gameState.settings.mode = btn.dataset.mode;
        });
    });

    // Menu - Map size slider
    const slider = document.getElementById('map-size-slider');
    slider.addEventListener('input', () => {
        gameState.settings.mapSize = parseInt(slider.value);
        const labels = { 8: 'Klein', 10: 'Mittel', 12: 'Groß', 14: 'Sehr groß', 16: 'Riesig' };
        const label = labels[gameState.settings.mapSize] || 'Mittel';
        document.getElementById('map-size-label').textContent = `${label} (${gameState.settings.mapSize}x${gameState.settings.mapSize})`;
    });

    // Start game button
    document.getElementById('start-btn').addEventListener('click', () => {
        showScreen(null);
        startGame();
    });

    // Ready button (turn transition)
    document.getElementById('ready-btn').addEventListener('click', () => {
        showScreen(null);
        updateUI();
        renderPlayers();
    });

    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const player = gameState.getCurrentPlayer();

            if (action === 'sneak') {
                toggleSneak(player);
            } else if (action === 'reload') {
                tryReload(player);
            } else if (action === 'overwatch') {
                tryOverwatch(player);
            } else {
                gameState.selectedAction = action;
                updateUI();
            }
        });
    });

    // End turn button
    document.getElementById('end-turn').addEventListener('click', endTurn);

    // Game over - Rematch
    document.getElementById('rematch-btn').addEventListener('click', () => {
        showScreen(null);
        startGame();
    });

    // Game over - Return to menu
    document.getElementById('menu-return-btn').addEventListener('click', () => {
        showScreen('menu-screen');
    });

    // Rules modal
    document.getElementById('rules-btn').addEventListener('click', () => {
        document.getElementById('rules-modal').classList.add('active');
    });

    document.getElementById('close-rules').addEventListener('click', () => {
        document.getElementById('rules-modal').classList.remove('active');
    });
}
