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

// ===== COLOR MANIPULATION =====

/**
 * Lighten a hex color
 * @param {string} color - Hex color string (e.g., '#ff0000')
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} RGB color string
 */
export function lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `rgb(${R},${G},${B})`;
}

/**
 * Darken a hex color
 * @param {string} color - Hex color string (e.g., '#ff0000')
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} RGB color string
 */
export function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `rgb(${R},${G},${B})`;
}

/**
 * Desaturate and darken a color for shadow effect
 * @param {string} color - Hex color string
 * @param {number} saturation - 0 = grayscale, 1 = full saturation
 * @param {number} brightness - 0 = black, 1 = original brightness
 * @returns {string} RGB color string
 */
export function desaturateAndDarken(color, saturation, brightness) {
    const num = parseInt(color.replace('#', ''), 16);
    let R = (num >> 16) & 0xFF;
    let G = (num >> 8) & 0xFF;
    let B = num & 0xFF;

    // Calculate grayscale value (luminance-based)
    const gray = Math.round(0.299 * R + 0.587 * G + 0.114 * B);

    // Blend between grayscale and original color
    R = Math.round(gray + (R - gray) * saturation);
    G = Math.round(gray + (G - gray) * saturation);
    B = Math.round(gray + (B - gray) * saturation);

    // Apply brightness
    R = Math.round(R * brightness);
    G = Math.round(G * brightness);
    B = Math.round(B * brightness);

    return `rgb(${R},${G},${B})`;
}

/**
 * Blend a color with red for danger zone indication
 * @param {string} color - Hex or rgb color string
 * @param {number} amount - 0 = original, 1 = full red
 * @returns {string} RGB color string
 */
export function blendWithRed(color, amount) {
    let R, G, B;

    if (color.startsWith('#')) {
        const num = parseInt(color.replace('#', ''), 16);
        R = (num >> 16) & 0xFF;
        G = (num >> 8) & 0xFF;
        B = num & 0xFF;
    } else if (color.startsWith('rgb')) {
        const match = color.match(/\d+/g);
        if (match) {
            R = parseInt(match[0]);
            G = parseInt(match[1]);
            B = parseInt(match[2]);
        } else {
            return color;
        }
    } else {
        return color;
    }

    // Blend toward red (239, 68, 68)
    R = Math.round(R + (239 - R) * amount);
    G = Math.round(G + (68 - G) * amount * 0.7);
    B = Math.round(B + (68 - B) * amount * 0.7);

    return `rgb(${R},${G},${B})`;
}

/**
 * Adjust color brightness based on height for minimap visualization
 * @param {string} color - Hex color string
 * @param {number} height - Height value (0-3)
 * @param {number} maxHeight - Maximum height (default 3)
 * @returns {string} Hex color string
 */
export function adjustColorForHeight(color, height, maxHeight = 3) {
    const num = parseInt(color.replace('#', ''), 16);
    let R = (num >> 16) & 0xFF;
    let G = (num >> 8) & 0xFF;
    let B = num & 0xFF;

    // Map height to brightness factor: 0.7 (low) to 1.2 (high)
    const brightnessFactor = 0.7 + (height / maxHeight) * 0.5;

    R = Math.min(255, Math.round(R * brightnessFactor));
    G = Math.min(255, Math.round(G * brightnessFactor));
    B = Math.min(255, Math.round(B * brightnessFactor));

    return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
}
