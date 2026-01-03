// ===== MINIGAMES MODULE INDEX =====
// Main entry point for minigame system

export * from './core.js';
export * from './context.js';
export * from './ui.js';

import { areMinigamesEnabled, RESULT_LEVELS, setActiveMinigame } from './core.js';
import { calculateDifficultyModifiers } from './context.js';
import { showExplanationAndWaitForStart, showCountdown, createMinigameOverlay } from './ui.js';

// Individual minigame imports will be added as they're created
// For now, provide a placeholder that returns OK result

/**
 * Start a minigame for the given unit class
 * @param {string} unitClass - Class of the acting unit
 * @param {Object} context - Game context for difficulty
 * @returns {Promise<string>} Result level
 */
export async function startMinigame(unitClass, context = {}) {
    // Check if minigames are enabled
    if (!areMinigamesEnabled()) {
        return RESULT_LEVELS.GOOD; // Return decent result if disabled
    }

    // Calculate difficulty modifiers
    const mods = calculateDifficultyModifiers(unitClass, context);

    // Show explanation and wait for start
    await showExplanationAndWaitForStart(unitClass);

    // Show countdown
    await showCountdown(3);

    // Create overlay for the game
    const { canvas, ctx } = createMinigameOverlay();

    // Start the appropriate minigame
    return new Promise(resolve => {
        // For now, return a random result until individual games are implemented
        // This allows the game to work while we migrate
        setTimeout(() => {
            const results = [RESULT_LEVELS.PERFECT, RESULT_LEVELS.GOOD, RESULT_LEVELS.OK];
            const randomResult = results[Math.floor(Math.random() * results.length)];

            import('./ui.js').then(ui => {
                ui.finishMinigame(randomResult, resolve);
            });
        }, 2000);
    });
}

/**
 * Start healing minigame specifically
 */
export async function startHealingMinigame(context = {}) {
    return startMinigame('medic', { ...context, isHealing: true });
}
