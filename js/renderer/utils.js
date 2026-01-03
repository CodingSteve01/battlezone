// ===== RENDERER UTILITY FUNCTIONS =====
// Safe gradient helpers and color utilities

/**
 * Check if all values are finite numbers
 */
export function areValuesFinite(...values) {
    return values.every(v => Number.isFinite(v));
}

/**
 * Create a radial gradient safely
 */
export function safeRadialGradient(ctx, x0, y0, r0, x1, y1, r1, fallbackColor = 'transparent') {
    if (!areValuesFinite(x0, y0, r0, x1, y1, r1) || r0 < 0 || r1 < 0) {
        return fallbackColor;
    }
    return ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
}

/**
 * Create a linear gradient safely
 */
export function safeLinearGradient(ctx, x0, y0, x1, y1, fallbackColor = 'transparent') {
    if (!areValuesFinite(x0, y0, x1, y1)) {
        return fallbackColor;
    }
    return ctx.createLinearGradient(x0, y0, x1, y1);
}

/**
 * Get luminance of a hex color
 */
export function getHexColorLuminance(color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Get appropriate outline color based on terrain
 */
export function getUnitOutlineColor(terrainColor) {
    const lum = getHexColorLuminance(terrainColor);
    return lum > 0.5 ? '#222' : '#eee';
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Desaturate and darken a color
 */
export function desaturateAndDarken(color, saturation, brightness) {
    const num = parseInt(color.replace('#', ''), 16);
    let r = (num >> 16) & 0xFF;
    let g = (num >> 8) & 0xFF;
    let b = num & 0xFF;

    // Desaturate
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = Math.round(r + (gray - r) * (1 - saturation));
    g = Math.round(g + (gray - g) * (1 - saturation));
    b = Math.round(b + (gray - b) * (1 - saturation));

    // Darken
    r = Math.round(r * brightness);
    g = Math.round(g * brightness);
    b = Math.round(b * brightness);

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Blend color with red (for damage/danger indication)
 */
export function blendWithRed(color, amount) {
    const num = parseInt(color.replace('#', ''), 16);
    let r = (num >> 16) & 0xFF;
    let g = (num >> 8) & 0xFF;
    let b = num & 0xFF;

    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g * (1 - amount * 0.5));
    b = Math.round(b * (1 - amount * 0.5));

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Adjust color based on height level
 */
export function adjustColorForHeight(color, height, maxHeight = 3) {
    if (height <= 0) return color;

    const heightFactor = height / maxHeight;
    const brightnessBoost = heightFactor * 15;

    return lightenColor(color, brightnessBoost);
}

/**
 * Seeded random number generator for consistent decoration
 */
export function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/**
 * Get fog brightness multiplier
 */
export function getFogBrightness(fogLevel) {
    switch (fogLevel) {
        case 'hidden': return 0;
        case 'explored': return 0.35;
        case 'visible': return 1.0;
        default: return 1.0;
    }
}

/**
 * Get CSS filter for fog level
 */
export function getFogFilter(fogLevel) {
    switch (fogLevel) {
        case 'hidden': return 'brightness(0)';
        case 'explored': return 'brightness(0.35) saturate(0.3)';
        case 'visible': return 'none';
        default: return 'none';
    }
}
