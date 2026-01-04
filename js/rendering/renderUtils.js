// ===== RENDERING UTILITIES =====
// Shared utility functions for rendering modules
// Extracted from renderer.js for better modularity

// ===== SEEDED RANDOM =====

/**
 * Generate a deterministic random number from a seed
 * Used for consistent terrain details across renders
 * @param {number} seed - The seed value
 * @returns {number} A pseudo-random number between 0 and 1
 */
export function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

// ===== SAFE GRADIENT HELPERS =====
// Prevents "non-finite value" errors when coordinates are NaN/Infinity

/**
 * Check if all values are finite numbers
 * @param {...number} values - Values to check
 * @returns {boolean}
 */
export function areValuesFinite(...values) {
    return values.every(v => Number.isFinite(v));
}

/**
 * Create a radial gradient safely, returning a fallback color if values are invalid
 * @param {CanvasRenderingContext2D} context - Canvas context
 * @param {number} x0 - Start circle x
 * @param {number} y0 - Start circle y
 * @param {number} r0 - Start circle radius
 * @param {number} x1 - End circle x
 * @param {number} y1 - End circle y
 * @param {number} r1 - End circle radius
 * @param {string} fallbackColor - Color to return if gradient creation fails
 * @returns {CanvasGradient|string}
 */
export function safeRadialGradient(context, x0, y0, r0, x1, y1, r1, fallbackColor = 'transparent') {
    if (!areValuesFinite(x0, y0, r0, x1, y1, r1) || r1 <= 0) {
        return fallbackColor;
    }
    return context.createRadialGradient(x0, y0, r0, x1, y1, r1);
}

/**
 * Create a linear gradient safely, returning a fallback color if values are invalid
 * @param {CanvasRenderingContext2D} context - Canvas context
 * @param {number} x0 - Start x
 * @param {number} y0 - Start y
 * @param {number} x1 - End x
 * @param {number} y1 - End y
 * @param {string} fallbackColor - Color to return if gradient creation fails
 * @returns {CanvasGradient|string}
 */
export function safeLinearGradient(context, x0, y0, x1, y1, fallbackColor = 'transparent') {
    if (!areValuesFinite(x0, y0, x1, y1)) {
        return fallbackColor;
    }
    // Prevent zero-length gradients
    if (x0 === x1 && y0 === y1) {
        return fallbackColor;
    }
    return context.createLinearGradient(x0, y0, x1, y1);
}

// ===== SPRITE HELPERS =====

/**
 * Get clamped content scale for sprite rendering
 * @param {{scaleX: number, scaleY: number}} contentScale - Scale factors
 * @returns {number} Average clamped scale
 */
export function getClampedContentScale(contentScale) {
    const safeScaleX = contentScale.scaleX > 0 ? contentScale.scaleX : 1;
    const safeScaleY = contentScale.scaleY > 0 ? contentScale.scaleY : 1;
    const clampedScaleX = Math.min(safeScaleX, 1);
    const clampedScaleY = Math.min(safeScaleY, 1);
    return (clampedScaleX + clampedScaleY) / 2;
}

/**
 * Calculate sprite dimensions based on content scale and base height
 * @param {HTMLImageElement|HTMLCanvasElement} sprite - The sprite image
 * @param {{scaleX: number, scaleY: number}} contentScale - Content scale factors
 * @param {number} baseHeight - Target base height
 * @returns {{spriteWidth: number, spriteHeight: number}}
 */
export function getSpriteDimensions(sprite, contentScale, baseHeight) {
    const avgScale = getClampedContentScale(contentScale);
    const spriteHeight = baseHeight * avgScale;
    const spriteWidth = spriteHeight * (sprite.width / sprite.height);
    return { spriteWidth, spriteHeight };
}

// ===== COLOR HELPERS =====

/**
 * Get luminance value from a hex color
 * @param {string} color - Hex color string (e.g., '#ff0000')
 * @returns {number} Luminance value between 0 and 1
 */
export function getHexColorLuminance(color) {
    if (!color || color[0] !== '#' || color.length < 7) return 0.5;
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Get appropriate outline color based on terrain brightness
 * @param {string} terrainColor - Hex color of terrain
 * @returns {string} RGBA color string for outline
 */
export function getUnitOutlineColor(terrainColor) {
    const luminance = getHexColorLuminance(terrainColor);
    return luminance > 0.5 ? 'rgba(20, 25, 30, 0.8)' : 'rgba(240, 245, 250, 0.85)';
}

// ===== TERRAIN TYPE HELPERS =====

/**
 * Set of water terrain types
 */
export const WATER_TYPES = new Set(['water', 'river', 'deepwater']);

/**
 * Set of swamp terrain types
 */
export const SWAMP_TYPES = new Set(['swamp']);

/**
 * Check if terrain type is land (for water shorelines)
 * @param {string|null} type - Terrain type
 * @returns {boolean}
 */
export function isLandForWater(type) {
    if (!type) return false;
    return !WATER_TYPES.has(type) && !SWAMP_TYPES.has(type);
}

/**
 * Check if terrain type is land (for swamp shorelines)
 * @param {string|null} type - Terrain type
 * @returns {boolean}
 */
export function isLandForSwamp(type) {
    if (!type) return false;
    return !SWAMP_TYPES.has(type) && !WATER_TYPES.has(type);
}
