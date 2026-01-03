// ===== COMBAT MODULE INDEX =====
// Re-exports all combat functionality

export * from './damage.js';
export * from './abilities.js';
export * from './ambush.js';
export * from './suppression.js';

// Main attack execution will be imported from the original combat.js
// to avoid breaking existing imports during migration
