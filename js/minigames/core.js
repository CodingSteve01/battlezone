// ===== MINIGAMES CORE =====
// Shared state, constants, and utilities

import { state } from '../state.js';

// Result levels for minigame outcomes
export const RESULT_LEVELS = {
    PERFECT: 'perfect',
    GOOD: 'good',
    OK: 'ok',
    MISS: 'miss'
};

// Damage multipliers for each result level
export const RESULT_MULTIPLIERS = {
    [RESULT_LEVELS.PERFECT]: 1.5,
    [RESULT_LEVELS.GOOD]: 1.2,
    [RESULT_LEVELS.OK]: 1.0,
    [RESULT_LEVELS.MISS]: 0.5
};

// Healing multipliers
export const HEALING_RESULT_MULTIPLIERS = {
    [RESULT_LEVELS.PERFECT]: 1.5,
    [RESULT_LEVELS.GOOD]: 1.2,
    [RESULT_LEVELS.OK]: 1.0,
    [RESULT_LEVELS.MISS]: 0.6
};

// Active minigame state
let activeMinigame = null;
let minigameOverlay = null;
let minigameCanvas = null;
let minigameCtx = null;
let animationFrameId = null;

// Anti-cheat tap cooldown
let lastTapTime = 0;
const TAP_COOLDOWN = 100; // ms

/**
 * Check if minigames are enabled in settings
 */
export function areMinigamesEnabled() {
    return state.settings?.minigames !== false;
}

/**
 * Check if a tap is valid (not too fast)
 */
export function isValidTap() {
    const now = Date.now();
    if (now - lastTapTime < TAP_COOLDOWN) {
        return false;
    }
    lastTapTime = now;
    return true;
}

/**
 * Get minigame canvas context
 */
export function getMinigameContext() {
    return { canvas: minigameCanvas, ctx: minigameCtx };
}

/**
 * Set minigame canvas elements
 */
export function setMinigameElements(overlay, canvas, ctx) {
    minigameOverlay = overlay;
    minigameCanvas = canvas;
    minigameCtx = ctx;
}

/**
 * Get active minigame
 */
export function getActiveMinigame() {
    return activeMinigame;
}

/**
 * Set active minigame
 */
export function setActiveMinigame(minigame) {
    activeMinigame = minigame;
}

/**
 * Clear active minigame
 */
export function clearActiveMinigame() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    activeMinigame = null;
}

/**
 * Set animation frame ID
 */
export function setAnimationFrame(id) {
    animationFrameId = id;
}

/**
 * Cancel animation frame
 */
export function cancelMinigameAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

/**
 * Get minigame overlay element
 */
export function getMinigameOverlay() {
    return minigameOverlay;
}

/**
 * Get result text for display
 */
export function getResultText(resultLevel) {
    switch (resultLevel) {
        case RESULT_LEVELS.PERFECT: return 'PERFEKT!';
        case RESULT_LEVELS.GOOD: return 'GUT!';
        case RESULT_LEVELS.OK: return 'OK';
        case RESULT_LEVELS.MISS: return 'VERFEHLT';
        default: return 'OK';
    }
}

/**
 * Get result color for display
 */
export function getResultColor(resultLevel) {
    switch (resultLevel) {
        case RESULT_LEVELS.PERFECT: return '#FFD700';
        case RESULT_LEVELS.GOOD: return '#4CAF50';
        case RESULT_LEVELS.OK: return '#2196F3';
        case RESULT_LEVELS.MISS: return '#F44336';
        default: return '#2196F3';
    }
}
