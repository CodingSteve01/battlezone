// ===== SAFE GRADIENT HELPERS =====
// Prevents "non-finite value" errors when coordinates are NaN/Infinity

/**
 * Check if all values are finite numbers
 */
export function areValuesFinite(...values) {
    return values.every(v => Number.isFinite(v));
}

/**
 * Create a radial gradient safely, returning a fallback color if values are invalid
 */
export function safeRadialGradient(ctx, x0, y0, r0, x1, y1, r1, fallbackColor = 'transparent') {
    if (!areValuesFinite(x0, y0, r0, x1, y1, r1) || r1 <= 0) {
        return fallbackColor;
    }
    return ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
}

/**
 * Create a linear gradient safely, returning a fallback color if values are invalid
 */
export function safeLinearGradient(ctx, x0, y0, x1, y1, fallbackColor = 'transparent') {
    if (!areValuesFinite(x0, y0, x1, y1)) {
        return fallbackColor;
    }
    // Prevent zero-length gradients
    if (x0 === x1 && y0 === y1) {
        return fallbackColor;
    }
    return ctx.createLinearGradient(x0, y0, x1, y1);
}
