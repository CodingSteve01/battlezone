// ===== MINIGAME UI =====
// Overlay creation, styling, and shared UI components

import {
    getMinigameOverlay,
    setMinigameElements,
    RESULT_LEVELS,
    getResultText,
    getResultColor,
    clearActiveMinigame
} from './core.js';
import { playClick } from '../audio.js';

// Minigame descriptions for each class
export const MINIGAME_DESCRIPTIONS = {
    scout: {
        title: 'Schneller Reflex',
        description: 'Tippe auf das Ziel, wenn es erscheint!',
        instructions: 'Je schneller und genauer, desto mehr Schaden.'
    },
    assault: {
        title: 'Powerschuss',
        description: 'Stoppe die Leiste in der grünen Zone!',
        instructions: 'Perfekte Mitte = maximaler Schaden.'
    },
    sniper: {
        title: 'Präzisionsschuss',
        description: 'Halte das Fadenkreuz ruhig und feuere im richtigen Moment!',
        instructions: 'Warte auf den stabilen Moment.'
    },
    commando: {
        title: 'Nahkampf',
        description: 'Wische in die angezeigte Richtung!',
        instructions: 'Schnelle Reaktion für Bonusschaden.'
    },
    medic: {
        title: 'Heilungsrhythmus',
        description: 'Tippe im Rhythmus des Herzschlags!',
        instructions: 'Timing ist alles für maximale Heilung.'
    },
    elitesoldat: {
        title: 'Eliteschuss',
        description: 'Kombiniere Präzision und Kraft!',
        instructions: 'Elite-Soldaten haben verbesserte Genauigkeit.'
    }
};

/**
 * Create and show minigame overlay
 */
export function createMinigameOverlay() {
    // Remove existing overlay
    const existing = document.getElementById('minigame-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'minigame-overlay';
    overlay.className = 'minigame-overlay';

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'minigame-canvas';
    canvas.width = 300;
    canvas.height = 300;
    overlay.appendChild(canvas);

    // Create info container
    const info = document.createElement('div');
    info.className = 'minigame-info';
    overlay.appendChild(info);

    document.body.appendChild(overlay);

    const ctx = canvas.getContext('2d');
    setMinigameElements(overlay, canvas, ctx);

    // Add styles
    addMinigameStyles();

    return { overlay, canvas, ctx, info };
}

/**
 * Add minigame CSS styles
 */
export function addMinigameStyles() {
    if (document.getElementById('minigame-styles')) return;

    const style = document.createElement('style');
    style.id = 'minigame-styles';
    style.textContent = `
        .minigame-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        #minigame-canvas {
            border-radius: 12px;
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.1);
        }

        .minigame-info {
            color: white;
            text-align: center;
            margin-top: 20px;
            font-family: sans-serif;
        }

        .minigame-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .minigame-description {
            font-size: 16px;
            opacity: 0.8;
            margin-bottom: 5px;
        }

        .minigame-instructions {
            font-size: 14px;
            opacity: 0.6;
        }

        .minigame-countdown {
            font-size: 72px;
            font-weight: bold;
            color: #FFD700;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }

        .minigame-result {
            font-size: 36px;
            font-weight: bold;
            animation: pulse 0.5s ease-out;
        }

        @keyframes pulse {
            0% { transform: scale(1.5); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
        }

        .minigame-start-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 20px;
            transition: transform 0.1s;
        }

        .minigame-start-btn:hover {
            transform: scale(1.05);
        }

        .minigame-start-btn:active {
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show explanation and wait for player to start
 */
export function showExplanationAndWaitForStart(unitClass) {
    return new Promise(resolve => {
        const { overlay, info } = createMinigameOverlay();
        const desc = MINIGAME_DESCRIPTIONS[unitClass] || MINIGAME_DESCRIPTIONS.assault;

        info.innerHTML = `
            <div class="minigame-title">${desc.title}</div>
            <div class="minigame-description">${desc.description}</div>
            <div class="minigame-instructions">${desc.instructions}</div>
            <button class="minigame-start-btn">START</button>
        `;

        const btn = info.querySelector('.minigame-start-btn');
        btn.addEventListener('click', () => {
            playClick();
            resolve();
        });

        // Also allow tap on overlay to start
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                playClick();
                resolve();
            }
        });
    });
}

/**
 * Show countdown before minigame starts
 */
export function showCountdown(seconds = 3) {
    return new Promise(resolve => {
        const overlay = getMinigameOverlay();
        if (!overlay) {
            resolve();
            return;
        }

        const info = overlay.querySelector('.minigame-info');
        let count = seconds;

        function tick() {
            if (count > 0) {
                info.innerHTML = `<div class="minigame-countdown">${count}</div>`;
                count--;
                setTimeout(tick, 1000);
            } else {
                info.innerHTML = `<div class="minigame-countdown">LOS!</div>`;
                setTimeout(resolve, 500);
            }
        }

        tick();
    });
}

/**
 * Show result and finish minigame
 */
export function finishMinigame(resultLevel, resolve) {
    const overlay = getMinigameOverlay();
    if (!overlay) {
        resolve(resultLevel);
        return;
    }

    const info = overlay.querySelector('.minigame-info');
    const text = getResultText(resultLevel);
    const color = getResultColor(resultLevel);

    info.innerHTML = `<div class="minigame-result" style="color: ${color}">${text}</div>`;

    // Play sound based on result
    playClick();

    setTimeout(() => {
        overlay.remove();
        clearActiveMinigame();
        resolve(resultLevel);
    }, 1000);
}

/**
 * Close minigame overlay
 */
export function closeMinigameOverlay() {
    const overlay = getMinigameOverlay();
    if (overlay) {
        overlay.remove();
    }
    clearActiveMinigame();
}
