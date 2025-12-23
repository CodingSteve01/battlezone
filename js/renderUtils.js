// ===== RENDERING UTILITIES =====
// Shared utility functions for rendering modules

/**
 * Seeded random number generator for consistent decorations
 * @param {number} seed - The seed value
 * @returns {number} A pseudo-random number between 0 and 1
 */
export function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}
