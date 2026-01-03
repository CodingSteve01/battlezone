// ===== MINIGAMES MODULE INDEX =====
// Re-exports all minigame functionality

// Constants
export {
    RESULT_LEVELS,
    RESULT_MULTIPLIERS,
    HEALING_RESULT_MULTIPLIERS,
    MINIGAME_DESCRIPTIONS,
    HEALING_MINIGAME_DESC,
    TAP_COOLDOWN_MS
} from './constants.js';

// Difficulty calculation
export { calculateDifficultyModifiers } from './difficulty.js';

// Main functions (from original file for now)
// These will be imported by the main minigames.js
