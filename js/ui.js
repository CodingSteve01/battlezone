/**
 * UI Management
 */

import { CONFIG } from './config.js';
import { gameState } from './state.js';

export function updateUI() {
    const player = gameState.getCurrentPlayer();
    if (!player) return;

    // Player badge
    document.getElementById('player-color').style.backgroundColor = player.color;
    document.getElementById('player-name').textContent = `Spieler ${player.id + 1}`;

    // Round
    document.getElementById('round-num').textContent = gameState.round;
    document.getElementById('max-rounds').textContent = CONFIG.MAX_ROUNDS;

    // AP
    const apDisplay = document.getElementById('ap-display');
    apDisplay.innerHTML = '';
    for (let i = 0; i < player.maxAp; i++) {
        const pip = document.createElement('div');
        pip.className = `ap-pip ${i >= player.ap ? 'used' : ''}`;
        apDisplay.appendChild(pip);
    }

    // Stats
    document.getElementById('health-val').textContent = player.health;
    document.getElementById('health-bar').style.width = `${player.health}%`;
    document.getElementById('ammo-val').textContent = `${player.ammo}/${CONFIG.MAX_AMMO}`;
    document.getElementById('grenade-val').textContent = player.grenades;

    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.classList.remove('selected', 'disabled');
        const action = btn.dataset.action;

        if (action === gameState.selectedAction) btn.classList.add('selected');
        if (action === 'sneak' && player.sneaking) btn.classList.add('selected');

        // Disable checks
        if (action === 'move' && player.ap < 1) btn.classList.add('disabled');
        if (action === 'shoot' && (player.ap < 1 || player.ammo < 1)) btn.classList.add('disabled');
        if (action === 'grenade' && (player.ap < 2 || player.grenades < 1)) btn.classList.add('disabled');
        if (action === 'overwatch' && (player.ap < 2 || player.ammo < 1 || player.overwatch)) btn.classList.add('disabled');
        if (action === 'reload' && (player.ap < 1 || player.ammo >= CONFIG.MAX_AMMO)) btn.classList.add('disabled');
    });

    // Mode indicator
    document.getElementById('mode-indicator').textContent =
        gameState.settings.mode === 'tactical' ? 'Taktisch' : '';
}

export function showScreen(id) {
    document.querySelectorAll('.screen-overlay').forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
}

export function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
}

export function showTurnScreen(player) {
    document.getElementById('turn-player').textContent = player.id + 1;
    const indicator = document.getElementById('turn-indicator');
    indicator.textContent = player.id + 1;
    indicator.style.backgroundColor = player.color;
    indicator.style.color = '#000';
    showScreen('turn-screen');
}

export function showGameOverScreen(winner) {
    if (winner) {
        document.getElementById('winner-text').textContent = `Spieler ${winner.id + 1} gewinnt!`;
        document.getElementById('winner-text').style.color = winner.color;
    } else {
        document.getElementById('winner-text').textContent = 'Unentschieden!';
        document.getElementById('winner-text').style.color = '#fff';
    }

    document.getElementById('final-rounds').textContent = gameState.round;
    const kills = gameState.players.reduce((sum, p) => sum + p.kills, 0);
    document.getElementById('final-kills').textContent = kills;

    showScreen('gameover-screen');
}
