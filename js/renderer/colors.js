// ===== COLOR UTILITIES =====
// Color manipulation functions for rendering

/**
 * Lighten a hex color
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
 * @param color - Hex color string
 * @param saturation - 0 = grayscale, 1 = full saturation
 * @param brightness - 0 = black, 1 = original brightness
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
 * @param color - Hex or rgb color string
 * @param amount - 0 = original, 1 = full red
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
    G = Math.round(G + (68 - G) * amount * 0.7); // Less green reduction
    B = Math.round(B + (68 - B) * amount * 0.7); // Less blue reduction

    return `rgb(${R},${G},${B})`;
}

/**
 * Adjust color brightness based on height for minimap visualization
 * Height 0 = darkest, Height 3 = brightest
 * @param color - Hex color string
 * @param height - Height value (0-3)
 * @param maxHeight - Maximum height (default 3)
 * @returns Hex color string
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

    // Return hex format for compatibility with other color functions
    return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

/**
 * Get luminance of a hex color
 */
export function getHexColorLuminance(color) {
    if (!color || color[0] !== '#' || color.length < 7) return 0.5;
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Get appropriate outline color based on terrain luminance
 */
export function getUnitOutlineColor(terrainColor) {
    const luminance = getHexColorLuminance(terrainColor);
    return luminance > 0.5 ? 'rgba(20, 25, 30, 0.8)' : 'rgba(240, 245, 250, 0.85)';
}
