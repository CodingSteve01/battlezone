// ===== POST-PROCESSING EFFECTS =====
// Color grading, filters, and visual polish for consistent art style

/**
 * Available color grading presets
 */
export const COLOR_PRESETS = {
    // Natural - subtle enhancement
    natural: {
        name: 'Natürlich',
        brightness: 1.0,
        contrast: 1.05,
        saturation: 1.1,
        hue: 0,
        sepia: 0,
        vignette: 0.15,
        colorMatrix: null
    },
    // Military/tactical - desaturated, gritty
    tactical: {
        name: 'Taktisch',
        brightness: 0.95,
        contrast: 1.15,
        saturation: 0.75,
        hue: 0,
        sepia: 0.1,
        vignette: 0.25,
        colorMatrix: [
            0.9, 0.1, 0, 0, 0,
            0.05, 0.85, 0.1, 0, 0,
            0.05, 0.1, 0.85, 0, 0,
            0, 0, 0, 1, 0
        ]
    },
    // Dawn/dusk - warm golden hour
    golden: {
        name: 'Goldene Stunde',
        brightness: 1.05,
        contrast: 1.1,
        saturation: 1.15,
        hue: 15,
        sepia: 0.15,
        vignette: 0.2,
        tint: { r: 255, g: 220, b: 180, a: 0.08 }
    },
    // Night vision - green tint
    nightVision: {
        name: 'Nachtsicht',
        brightness: 1.2,
        contrast: 1.3,
        saturation: 0.3,
        hue: 90,
        sepia: 0,
        vignette: 0.4,
        tint: { r: 50, g: 255, b: 100, a: 0.15 },
        scanlines: true
    },
    // Cinematic - high contrast, slightly blue shadows
    cinematic: {
        name: 'Filmisch',
        brightness: 0.98,
        contrast: 1.2,
        saturation: 0.9,
        hue: -5,
        sepia: 0.05,
        vignette: 0.3,
        tint: { r: 180, g: 200, b: 255, a: 0.05 },
        letterbox: true
    },
    // Autumn - warm orange/red tones
    autumn: {
        name: 'Herbst',
        brightness: 1.0,
        contrast: 1.1,
        saturation: 1.2,
        hue: 20,
        sepia: 0.2,
        vignette: 0.2,
        tint: { r: 255, g: 180, b: 120, a: 0.1 }
    },
    // Winter - cool blue tones
    winter: {
        name: 'Winter',
        brightness: 1.1,
        contrast: 1.05,
        saturation: 0.85,
        hue: -15,
        sepia: 0,
        vignette: 0.15,
        tint: { r: 180, g: 210, b: 255, a: 0.1 }
    },
    // None - no post-processing
    none: {
        name: 'Aus',
        brightness: 1.0,
        contrast: 1.0,
        saturation: 1.0,
        hue: 0,
        sepia: 0,
        vignette: 0,
        colorMatrix: null
    }
};

// Current active preset
let currentPreset = 'natural';
let customSettings = null;

/**
 * Set the active color grading preset
 */
export function setColorPreset(presetName) {
    if (COLOR_PRESETS[presetName]) {
        currentPreset = presetName;
        customSettings = null;
    }
}

/**
 * Get the current preset name
 */
export function getCurrentPreset() {
    return currentPreset;
}

/**
 * Set custom post-processing settings
 */
export function setCustomSettings(settings) {
    customSettings = { ...COLOR_PRESETS.natural, ...settings };
}

/**
 * Apply post-processing effects to the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas logical width (CSS pixels)
 * @param {number} height - Canvas logical height (CSS pixels)
 */
export function applyPostProcessing(ctx, width, height) {
    const settings = customSettings || COLOR_PRESETS[currentPreset];
    if (!settings || currentPreset === 'none') return;

    ctx.save();

    // Apply CSS filter-based effects (brightness, contrast, saturation)
    const filters = [];

    if (settings.brightness !== 1.0) {
        filters.push(`brightness(${settings.brightness})`);
    }
    if (settings.contrast !== 1.0) {
        filters.push(`contrast(${settings.contrast})`);
    }
    if (settings.saturation !== 1.0) {
        filters.push(`saturate(${settings.saturation})`);
    }
    if (settings.hue !== 0) {
        filters.push(`hue-rotate(${settings.hue}deg)`);
    }
    if (settings.sepia > 0) {
        filters.push(`sepia(${settings.sepia})`);
    }

    if (filters.length > 0) {
        // Get the actual canvas pixel dimensions (accounting for devicePixelRatio)
        const dpr = window.devicePixelRatio || 1;
        const actualWidth = ctx.canvas.width;
        const actualHeight = ctx.canvas.height;

        // Create a temporary canvas at full resolution to avoid scaling issues
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = actualWidth;
        tempCanvas.height = actualHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Apply filters and draw the source canvas at full resolution
        tempCtx.filter = filters.join(' ');
        tempCtx.drawImage(ctx.canvas, 0, 0);

        // Reset the context transform before drawing the filtered result
        // The main canvas has ctx.scale(dpr, dpr) applied, so we need to
        // temporarily reset it to draw at 1:1 pixel scale
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tempCanvas, 0, 0);

        // Restore the devicePixelRatio scale transform for subsequent drawing
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Apply color tint overlay
    if (settings.tint) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = `rgba(${settings.tint.r}, ${settings.tint.g}, ${settings.tint.b}, ${settings.tint.a})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
    }

    // Apply vignette effect
    if (settings.vignette > 0) {
        drawVignette(ctx, width, height, settings.vignette);
    }

    // Apply scanlines for night vision effect
    if (settings.scanlines) {
        drawScanlines(ctx, width, height);
    }

    // Apply letterbox for cinematic effect
    if (settings.letterbox) {
        drawLetterbox(ctx, width, height);
    }

    ctx.restore();
}

/**
 * Draw vignette (darkened edges) effect
 */
function drawVignette(ctx, width, height, intensity) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(width, height) * 0.7;

    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.8, `rgba(0, 0, 0, ${intensity * 0.3})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity * 0.7})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Draw CRT-style scanlines
 */
function drawScanlines(ctx, width, height) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 2);
    }
}

/**
 * Draw cinematic letterbox bars
 */
function drawLetterbox(ctx, width, height) {
    const barHeight = height * 0.08;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, width, barHeight);
    ctx.fillRect(0, height - barHeight, width, barHeight);
}

/**
 * Apply color matrix transformation (advanced color grading)
 * Matrix format: [r, g, b, a, offset] for each color channel
 */
export function applyColorMatrix(ctx, width, height, matrix) {
    if (!matrix) return;

    // Use the actual canvas pixel dimensions, not logical dimensions
    const actualWidth = ctx.canvas.width;
    const actualHeight = ctx.canvas.height;

    const imageData = ctx.getImageData(0, 0, actualWidth, actualHeight);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Apply matrix transformation
        data[i] = Math.min(255, Math.max(0,
            r * matrix[0] + g * matrix[1] + b * matrix[2] + matrix[4] * 255));
        data[i + 1] = Math.min(255, Math.max(0,
            r * matrix[5] + g * matrix[6] + b * matrix[7] + matrix[9] * 255));
        data[i + 2] = Math.min(255, Math.max(0,
            r * matrix[10] + g * matrix[11] + b * matrix[12] + matrix[14] * 255));
    }

    ctx.putImageData(imageData, 0, 0);
}

/**
 * Ambient lighting based on time of day
 * @param {number} hour - Hour (0-24)
 */
export function getAmbientPresetForTime(hour) {
    if (hour >= 5 && hour < 7) return 'golden';      // Dawn
    if (hour >= 7 && hour < 17) return 'natural';     // Day
    if (hour >= 17 && hour < 19) return 'golden';    // Dusk
    if (hour >= 19 && hour < 21) return 'cinematic'; // Evening
    return 'tactical';                                // Night
}

/**
 * Apply weather-based color modifications
 */
export function applyWeatherEffect(ctx, width, height, weather) {
    ctx.save();

    switch (weather) {
        case 'rain':
            // Desaturate and add blue tint
            ctx.fillStyle = 'rgba(100, 120, 150, 0.1)';
            ctx.fillRect(0, 0, width, height);
            break;

        case 'fog':
            // White overlay for fog
            const fogGrad = ctx.createRadialGradient(
                width / 2, height / 2, 0,
                width / 2, height / 2, Math.max(width, height) * 0.6
            );
            fogGrad.addColorStop(0, 'rgba(200, 210, 220, 0.15)');
            fogGrad.addColorStop(1, 'rgba(180, 190, 200, 0.25)');
            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, width, height);
            break;

        case 'storm':
            // Dark overlay with occasional flash
            ctx.fillStyle = 'rgba(30, 35, 50, 0.15)';
            ctx.fillRect(0, 0, width, height);
            break;

        case 'sandstorm':
            // Orange/brown overlay
            ctx.fillStyle = 'rgba(180, 140, 80, 0.2)';
            ctx.fillRect(0, 0, width, height);
            break;
    }

    ctx.restore();
}

/**
 * Get list of available presets for UI
 */
export function getPresetList() {
    return Object.entries(COLOR_PRESETS).map(([key, value]) => ({
        id: key,
        name: value.name
    }));
}
