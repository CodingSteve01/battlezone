/**
 * Shadow Tactics - Main Entry Point
 * A turn-based tactical stealth shooter
 */

import { initPixi } from './game.js';
import { setupEventListeners } from './input.js';
import { showScreen } from './ui.js';

async function init() {
    try {
        await initPixi();
        setupEventListeners();
        showScreen('menu-screen');
        console.log('Shadow Tactics initialized successfully');
    } catch (error) {
        console.error('Failed to initialize game:', error);
        document.getElementById('loading').innerHTML = `
            <p style="color: #ff4444;">Fehler beim Laden des Spiels</p>
            <p style="color: #888; font-size: 0.9rem;">${error.message}</p>
        `;
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
