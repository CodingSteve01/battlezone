// ===== AI THOUGHT SYSTEM =====
// Displays AI decision explanations in Spectator Mode

import { state, getPlayerUnits } from '../state.js';

// Thought queue and display state
const aiThoughts = {
    current: null,
    queue: [],
    displayTime: 3500,
};

// Cache for isAIPlayer check (set from main AI module)
let isAIPlayerFn = () => false;

/**
 * Set the isAIPlayer function reference
 */
export function setIsAIPlayerFn(fn) {
    isAIPlayerFn = fn;
}

/**
 * Check if spectator mode is active
 * Active when all players are AI or all humans eliminated
 */
export function isSpectatorMode() {
    if (state.settings.players <= 0) return false;

    for (let p = 0; p < state.settings.players; p++) {
        if (!isAIPlayerFn(p)) {
            const humanUnits = getPlayerUnits(p).filter(u => u.alive);
            if (humanUnits.length > 0) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Add an AI thought to be displayed
 */
export function addAIThought(thought, category = 'general') {
    if (!isSpectatorMode()) return;

    const thoughtObj = {
        text: thought,
        category,
        timestamp: Date.now()
    };

    aiThoughts.queue.push(thoughtObj);
    showNextThought();
}

/**
 * Show the next thought in queue
 */
function showNextThought() {
    if (aiThoughts.current || aiThoughts.queue.length === 0) return;

    aiThoughts.current = aiThoughts.queue.shift();
    displayThought(aiThoughts.current);

    setTimeout(() => {
        aiThoughts.current = null;
        showNextThought();
    }, aiThoughts.displayTime);
}

/**
 * Display a thought in the UI
 */
function displayThought(thought) {
    const existing = document.querySelector('.ai-thought-bubble');
    if (existing) existing.remove();

    const bubble = document.createElement('div');
    bubble.className = 'ai-thought-bubble';
    bubble.innerHTML = `<span class="thought-text">${thought.text}</span>`;
    document.body.appendChild(bubble);

    requestAnimationFrame(() => {
        bubble.classList.add('visible');
    });

    setTimeout(() => {
        bubble.classList.remove('visible');
        setTimeout(() => bubble.remove(), 300);
    }, aiThoughts.displayTime - 300);
}

/**
 * Add multi-part thought (splits into segments)
 */
export function addMultiPartThought(parts, category = 'general') {
    if (!isSpectatorMode()) return;

    const validParts = parts.filter(p => p && p.trim());
    validParts.forEach(part => {
        addAIThought(part.trim(), category);
    });
}

/**
 * Generate varied phrasing
 */
export function variedPhrase(options) {
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Clear all pending thoughts
 */
export function clearAIThoughts() {
    aiThoughts.queue = [];
    aiThoughts.current = null;
    const existing = document.querySelector('.ai-thought-bubble');
    if (existing) existing.remove();
}

// German class names for thoughts
export const CLASS_NAMES_DE = {
    scout: 'Späher',
    assault: 'Sturmsoldatin',
    medic: 'Sanitäter',
    sniper: 'Scharfschützin',
    commando: 'Kommando',
    elitesoldat: 'Elitesoldat'
};
