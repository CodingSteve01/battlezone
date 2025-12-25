// ===== ASSET MANAGEMENT & TEXTURES =====

import {
    seamlessFBM,
    seamlessTurbulence,
    seamlessRidged,
    seamlessVoronoi,
    seamlessWarpedNoise,
    seedNoise
} from './seamlessNoise.js';

// Pre-rendered texture canvases for performance
const textureCache = new Map();
// Increased from 128 to 256 for much higher detail and more realistic textures
const TEXTURE_SIZE = 256;

// Initialize noise with consistent seed
seedNoise(42);

/**
 * Seamless fractal noise wrapper - normalized coordinates (0-1)
 * This replaces the old fractalNoise and produces tileable textures
 */
function fractalNoise(x, y, octaves = 4, seed = 0) {
    // Convert pixel coordinates to 0-1 range for seamless tiling
    const nx = x / TEXTURE_SIZE;
    const ny = y / TEXTURE_SIZE;
    // Use seamless FBM - returns -1 to 1, normalize to 0-1
    return (seamlessFBM(nx, ny, octaves, 0.5, 4, seed) + 1) * 0.5;
}

/**
 * Legacy noise functions for backward compatibility
 * Now using seamless noise internally
 */
function noise2D(x, y, seed = 0) {
    const nx = x / TEXTURE_SIZE;
    const ny = y / TEXTURE_SIZE;
    return (seamlessFBM(nx, ny, 1, 0.5, 8, seed) + 1) * 0.5;
}

function smoothNoise(x, y, seed = 0) {
    return noise2D(x, y, seed);
}

/**
 * Warped noise for organic patterns (terrain details)
 */
function warpedNoise(x, y, seed = 0) {
    const nx = x / TEXTURE_SIZE;
    const ny = y / TEXTURE_SIZE;
    return (seamlessWarpedNoise(nx, ny, 4, 0.3, seed) + 1) * 0.5;
}

/**
 * Turbulence noise for dramatic patterns
 */
function turbulenceNoise(x, y, octaves = 4, seed = 0) {
    const nx = x / TEXTURE_SIZE;
    const ny = y / TEXTURE_SIZE;
    return seamlessTurbulence(nx, ny, octaves, 0.5, 4, seed);
}

/**
 * Voronoi for cellular patterns (rocks, cracks)
 */
function voronoiNoise(x, y, scale = 4, seed = 0) {
    const nx = x / TEXTURE_SIZE;
    const ny = y / TEXTURE_SIZE;
    return seamlessVoronoi(nx, ny, scale, seed);
}

/**
 * Initialize all textures
 */
export function initTextures() {
    createGrassTexture();
    createForestTexture();
    createRockTexture();
    createWaterTexture();
    createSandTexture();
    createSwampTexture();
    // New terrain textures
    createSnowTexture();
    createIceTexture();
    createDeepwaterTexture();
    createFlowersTexture();
    createWheatTexture();
    createMudTexture();
    createGravelTexture();
    createRuinsTexture();
    createHeatherTexture();
    createMossTexture();
}

/**
 * Get a cached texture pattern
 */
export function getTexture(type) {
    return textureCache.get(type);
}

/**
 * Create ultra-realistic grass texture with painterly style
 * Inspired by high-quality strategy games with natural, warm color palette
 */
function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // === BASE LAYER: Rich, lush meadow greens ===
    // Inspired by reference image - deep greens with moss-like texture
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            // Multiple noise layers for organic variation
            const n1 = fractalNoise(x / 50, y / 50, 6, 1);
            const n2 = fractalNoise(x / 20, y / 20, 4, 50);
            const n3 = fractalNoise(x / 80, y / 80, 3, 100);
            const n4 = warpedNoise(x / 35, y / 35, 150);
            const combined = n1 * 0.35 + n2 * 0.3 + n3 * 0.2 + n4 * 0.15;

            // Richer, more saturated greens (like reference image's lush meadows)
            const r = Math.floor(55 + combined * 35 + n3 * 20);
            const g = Math.floor(120 + combined * 45 + n2 * 25);
            const b = Math.floor(50 + combined * 20 + n3 * 10);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // === MOSS-LIKE TEXTURE OVERLAY ===
    // Creates the dense, mossy appearance from the reference
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 3 + Math.random() * 8;
        const mossType = Math.random();

        let color;
        if (mossType < 0.3) {
            color = `rgba(45, 95, 40, ${0.4 + Math.random() * 0.3})`;
        } else if (mossType < 0.6) {
            color = `rgba(70, 120, 55, ${0.35 + Math.random() * 0.25})`;
        } else {
            color = `rgba(85, 135, 65, ${0.3 + Math.random() * 0.2})`;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        // Irregular mossy blob shape
        ctx.ellipse(x, y, size, size * (0.5 + Math.random() * 0.5),
                   Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 2: Large color patches for natural variation ===
    // Creates the "patchwork" look of real meadows
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 25 + Math.random() * 50;
        const patchType = Math.random();

        let color1, color2;
        if (patchType < 0.35) {
            // Darker green patch (shadows/different grass species)
            color1 = 'rgba(55, 90, 40, 0.35)';
            color2 = 'rgba(55, 90, 40, 0)';
        } else if (patchType < 0.65) {
            // Lighter yellow-green patch (sunlit areas)
            color1 = 'rgba(130, 155, 60, 0.3)';
            color2 = 'rgba(130, 155, 60, 0)';
        } else if (patchType < 0.85) {
            // Warm olive patch
            color1 = 'rgba(95, 115, 50, 0.28)';
            color2 = 'rgba(95, 115, 50, 0)';
        } else {
            // Subtle brown/dry patch
            color1 = 'rgba(120, 110, 70, 0.22)';
            color2 = 'rgba(120, 110, 70, 0)';
        }

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(0.6, color1.replace(/[\d.]+\)$/, '0.12)'));
        gradient.addColorStop(1, color2);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * (0.6 + Math.random() * 0.4), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 3: Natural dirt/earth patches ===
    for (let i = 0; i < 12; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 8 + Math.random() * 20;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(110, 90, 60, 0.45)');
        gradient.addColorStop(0.5, 'rgba(100, 85, 55, 0.25)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 4: Dense grass blade rendering (multiple layers for depth) ===
    // This creates the realistic grass blade appearance
    for (let layer = 0; layer < 5; layer++) {
        const bladeCount = 400 + layer * 150; // Much denser grass
        const baseHeight = 6 + layer * 4;
        const alpha = 0.5 + layer * 0.1;

        for (let i = 0; i < bladeCount; i++) {
            const x = Math.random() * TEXTURE_SIZE;
            const y = Math.random() * TEXTURE_SIZE;
            const height = baseHeight + Math.random() * 10;
            const lean = (Math.random() - 0.5) * 8;
            const shade = 0.6 + Math.random() * 0.4;

            // Natural grass color palette (warmer tones)
            const colorVariation = Math.random();
            let grassR, grassG, grassB;
            if (colorVariation < 0.2) {
                // Dark forest green
                grassR = Math.floor(40 * shade);
                grassG = Math.floor(75 * shade);
                grassB = Math.floor(35 * shade);
            } else if (colorVariation < 0.45) {
                // Standard meadow green
                grassR = Math.floor(65 * shade);
                grassG = Math.floor(110 * shade);
                grassB = Math.floor(45 * shade);
            } else if (colorVariation < 0.7) {
                // Yellow-green (sunlit)
                grassR = Math.floor(95 * shade);
                grassG = Math.floor(130 * shade);
                grassB = Math.floor(50 * shade);
            } else if (colorVariation < 0.88) {
                // Olive green
                grassR = Math.floor(80 * shade);
                grassG = Math.floor(100 * shade);
                grassB = Math.floor(40 * shade);
            } else {
                // Dry/golden blade
                grassR = Math.floor(140 * shade);
                grassG = Math.floor(135 * shade);
                grassB = Math.floor(70 * shade);
            }

            ctx.strokeStyle = `rgba(${grassR}, ${grassG}, ${grassB}, ${alpha})`;
            ctx.lineWidth = 0.6 + Math.random() * 1.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            // More natural curve for grass blades
            const cp1x = x + lean * 0.3;
            const cp1y = y - height * 0.4;
            const cp2x = x + lean * 0.7;
            const cp2y = y - height * 0.7;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x + lean, y - height);
            ctx.stroke();
        }
    }

    // === LAYER 5: Grass clumps (tufts) for added realism ===
    for (let i = 0; i < 80; i++) {
        const cx = Math.random() * TEXTURE_SIZE;
        const cy = Math.random() * TEXTURE_SIZE;
        const tuftSize = 8 + Math.random() * 12;
        const blades = 6 + Math.floor(Math.random() * 8);

        for (let b = 0; b < blades; b++) {
            const angle = (b / blades) * Math.PI - Math.PI / 2 + (Math.random() - 0.5) * 0.8;
            const height = tuftSize * (0.6 + Math.random() * 0.4);
            const shade = 0.65 + Math.random() * 0.35;

            const grassR = Math.floor((60 + Math.random() * 50) * shade);
            const grassG = Math.floor((100 + Math.random() * 40) * shade);
            const grassB = Math.floor((40 + Math.random() * 20) * shade);

            ctx.strokeStyle = `rgba(${grassR}, ${grassG}, ${grassB}, 0.75)`;
            ctx.lineWidth = 0.8 + Math.random() * 0.8;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const endX = cx + Math.cos(angle + Math.PI / 2) * height * 0.4 + (Math.random() - 0.5) * 3;
            const endY = cy - height;
            ctx.quadraticCurveTo(cx + Math.cos(angle + Math.PI / 2) * height * 0.2, cy - height * 0.5, endX, endY);
            ctx.stroke();
        }
    }

    // === LAYER 6: Small scattered vegetation ===
    // Clovers
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 2 + Math.random() * 3;
        const shade = 0.7 + Math.random() * 0.3;

        // Clover leaves
        ctx.fillStyle = `rgba(${Math.floor(55 * shade)}, ${Math.floor(95 * shade)}, ${Math.floor(50 * shade)}, 0.8)`;
        for (let l = 0; l < 3; l++) {
            const angle = (l / 3) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.arc(x + Math.cos(angle) * size * 0.4, y + Math.sin(angle) * size * 0.4, size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Small wildflowers
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const flowerType = Math.random();

        if (flowerType < 0.35) {
            // White daisy
            ctx.fillStyle = 'rgba(255, 255, 245, 0.85)';
            ctx.beginPath();
            ctx.arc(x, y, 2 + Math.random() * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(240, 200, 60, 0.9)';
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        } else if (flowerType < 0.6) {
            // Yellow buttercup
            ctx.fillStyle = 'rgba(255, 220, 50, 0.85)';
            ctx.beginPath();
            ctx.arc(x, y, 1.5 + Math.random(), 0, Math.PI * 2);
            ctx.fill();
        } else if (flowerType < 0.8) {
            // Purple clover flower
            ctx.fillStyle = 'rgba(180, 120, 180, 0.75)';
            ctx.beginPath();
            ctx.arc(x, y, 2 + Math.random(), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // === LAYER 7: Ambient lighting effects ===
    // Sunlight dappling
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 15 + Math.random() * 30;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(200, 220, 120, 0.15)');
        gradient.addColorStop(0.5, 'rgba(180, 200, 100, 0.08)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Subtle shadow areas
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 20 + Math.random() * 40;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(30, 50, 25, 0.12)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === ROCKY/STONE PATCHES (visible in reference image) ===
    // Small stones peeking through the grass
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const stoneSize = 3 + Math.random() * 6;
        const shade = 0.5 + Math.random() * 0.4;

        // Stone base with shadow
        ctx.fillStyle = `rgba(60, 55, 50, 0.4)`;
        ctx.beginPath();
        ctx.ellipse(x + 1.5, y + 1.5, stoneSize, stoneSize * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();

        // Stone surface
        const gray = Math.floor(100 + Math.random() * 50);
        ctx.fillStyle = `rgba(${gray}, ${gray - 5}, ${gray - 10}, ${0.7 + Math.random() * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(x, y, stoneSize, stoneSize * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();

        // Stone highlight
        ctx.fillStyle = `rgba(180, 175, 170, 0.25)`;
        ctx.beginPath();
        ctx.ellipse(x - stoneSize * 0.2, y - stoneSize * 0.15, stoneSize * 0.4, stoneSize * 0.25, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Larger rock clusters (like in reference top-right grass tile)
    for (let i = 0; i < 3; i++) {
        if (Math.random() > 0.4) continue;
        const cx = Math.random() * TEXTURE_SIZE;
        const cy = Math.random() * TEXTURE_SIZE;

        // Draw 3-5 grouped stones
        const stoneCount = 3 + Math.floor(Math.random() * 3);
        for (let s = 0; s < stoneCount; s++) {
            const sx = cx + (Math.random() - 0.5) * 20;
            const sy = cy + (Math.random() - 0.5) * 15;
            const size = 4 + Math.random() * 8;
            const shade = 0.6 + Math.random() * 0.3;

            // Shadow
            ctx.fillStyle = `rgba(40, 35, 30, 0.45)`;
            ctx.beginPath();
            ctx.ellipse(sx + 2, sy + 2, size, size * 0.55, Math.random() * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Rock
            const gray = Math.floor((90 + Math.random() * 45) * shade);
            ctx.fillStyle = `rgb(${gray + 10}, ${gray + 5}, ${gray})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy, size, size * 0.55, Math.random() * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Moss on rock
            if (Math.random() > 0.5) {
                ctx.fillStyle = `rgba(55, 90, 45, 0.5)`;
                ctx.beginPath();
                ctx.ellipse(sx - size * 0.2, sy - size * 0.1, size * 0.4, size * 0.25, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    textureCache.set('grass', canvas);
}

/**
 * Create ultra-realistic forest floor texture with autumn colors
 * Inspired by high-quality strategy games with rich organic detail
 */
function createForestTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // === BASE LAYER: Rich forest floor with organic variation ===
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            // Multiple noise layers for complex organic patterns
            const n1 = fractalNoise(x / 40, y / 40, 5, 2);
            const n2 = fractalNoise(x / 15, y / 15, 4, 30);
            const n3 = fractalNoise(x / 60, y / 60, 3, 80);
            const n4 = warpedNoise(x / 25, y / 25, 120);
            const combined = n1 * 0.35 + n2 * 0.3 + n3 * 0.2 + n4 * 0.15;

            // Warmer, more natural forest floor colors
            // Mix of greens, browns, and earth tones
            const r = Math.floor(50 + combined * 35 + n3 * 20 + n4 * 15);
            const g = Math.floor(65 + combined * 40 + n2 * 20);
            const b = Math.floor(35 + combined * 20 + n3 * 8);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // === LAYER 2: Natural variation patches ===
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 20 + Math.random() * 45;
        const patchType = Math.random();

        let color1, color2;
        if (patchType < 0.3) {
            // Darker shaded area
            color1 = 'rgba(35, 50, 30, 0.4)';
            color2 = 'rgba(35, 50, 30, 0)';
        } else if (patchType < 0.5) {
            // Moss-green patch
            color1 = 'rgba(55, 85, 45, 0.35)';
            color2 = 'rgba(55, 85, 45, 0)';
        } else if (patchType < 0.7) {
            // Brown earth patch
            color1 = 'rgba(90, 70, 45, 0.3)';
            color2 = 'rgba(90, 70, 45, 0)';
        } else {
            // Warm brown-green
            color1 = 'rgba(70, 75, 40, 0.28)';
            color2 = 'rgba(70, 75, 40, 0)';
        }

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(0.6, color1.replace(/[\d.]+\)$/, '0.15)'));
        gradient.addColorStop(1, color2);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * (0.5 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 3: Rich moss patches ===
    for (let i = 0; i < 18; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 12 + Math.random() * 30;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        const mossType = Math.random();

        if (mossType < 0.5) {
            // Deep green moss
            gradient.addColorStop(0, 'rgba(45, 80, 40, 0.55)');
            gradient.addColorStop(0.4, 'rgba(40, 70, 35, 0.35)');
            gradient.addColorStop(1, 'transparent');
        } else {
            // Yellow-green moss (lichen)
            gradient.addColorStop(0, 'rgba(80, 95, 50, 0.45)');
            gradient.addColorStop(0.4, 'rgba(70, 85, 45, 0.25)');
            gradient.addColorStop(1, 'transparent');
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 4: Autumn fallen leaves (key feature from reference) ===
    const autumnLeafColors = [
        { r: 180, g: 120, b: 40 },   // Golden orange
        { r: 200, g: 90, b: 35 },    // Burnt orange
        { r: 160, g: 70, b: 30 },    // Rust red
        { r: 140, g: 100, b: 45 },   // Light brown
        { r: 100, g: 75, b: 40 },    // Dark brown
        { r: 85, g: 60, b: 35 },     // Very dark brown
        { r: 170, g: 140, b: 50 },   // Yellow-brown
        { r: 50, g: 70, b: 35 },     // Fresh green (few)
        { r: 130, g: 45, b: 30 },    // Deep red
    ];

    // Multiple leaf layers for depth
    for (let layer = 0; layer < 5; layer++) {
        const leafCount = 80 + layer * 40;
        const alpha = 0.45 + layer * 0.1;
        const sizeMultiplier = 0.7 + layer * 0.15;

        for (let i = 0; i < leafCount; i++) {
            const x = Math.random() * TEXTURE_SIZE;
            const y = Math.random() * TEXTURE_SIZE;
            const size = (3 + Math.random() * 8) * sizeMultiplier;
            const color = autumnLeafColors[Math.floor(Math.random() * autumnLeafColors.length)];
            const shade = 0.6 + Math.random() * 0.4;

            // Draw leaf shape (pointed ellipse)
            ctx.fillStyle = `rgba(${Math.floor(color.r * shade)}, ${Math.floor(color.g * shade)}, ${Math.floor(color.b * shade)}, ${alpha})`;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.random() * Math.PI * 2);

            // Leaf shape
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.quadraticCurveTo(size * 0.6, -size * 0.3, size * 0.5, size * 0.3);
            ctx.quadraticCurveTo(0, size * 0.5, -size * 0.5, size * 0.3);
            ctx.quadraticCurveTo(-size * 0.6, -size * 0.3, 0, -size);
            ctx.fill();

            // Leaf vein (subtle)
            if (size > 5 && Math.random() > 0.6) {
                ctx.strokeStyle = `rgba(${Math.floor(color.r * shade * 0.7)}, ${Math.floor(color.g * shade * 0.7)}, ${Math.floor(color.b * shade * 0.7)}, 0.4)`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(0, -size * 0.8);
                ctx.lineTo(0, size * 0.3);
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    // === LAYER 5: Twigs and small branches ===
    for (let i = 0; i < 50; i++) {
        const shade = 0.4 + Math.random() * 0.5;
        const r = Math.floor((60 + Math.random() * 30) * shade);
        const g = Math.floor((45 + Math.random() * 20) * shade);
        const b = Math.floor((30 + Math.random() * 15) * shade);

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + Math.random() * 0.35})`;
        ctx.lineWidth = 0.8 + Math.random() * 2;
        ctx.lineCap = 'round';

        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const length = 12 + Math.random() * 35;
        const angle = Math.random() * Math.PI * 2;

        ctx.beginPath();
        ctx.moveTo(x, y);
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Side branches
        if (Math.random() > 0.4) {
            ctx.lineWidth *= 0.5;
            const branchCount = 1 + Math.floor(Math.random() * 3);
            for (let b = 0; b < branchCount; b++) {
                const t = 0.3 + Math.random() * 0.5;
                const midX = x + (endX - x) * t;
                const midY = y + (endY - y) * t;
                const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.6);
                const branchLen = length * 0.3 * (0.5 + Math.random() * 0.5);

                ctx.beginPath();
                ctx.moveTo(midX, midY);
                ctx.lineTo(midX + Math.cos(branchAngle) * branchLen, midY + Math.sin(branchAngle) * branchLen);
                ctx.stroke();
            }
        }
    }

    // === LAYER 6: Pine needle clusters ===
    for (let i = 0; i < 25; i++) {
        const cx = Math.random() * TEXTURE_SIZE;
        const cy = Math.random() * TEXTURE_SIZE;
        const clusterSize = 5 + Math.random() * 8;

        for (let j = 0; j < 12; j++) {
            const angle = Math.random() * Math.PI * 2;
            const len = clusterSize * (0.5 + Math.random() * 0.5);
            const shade = 0.5 + Math.random() * 0.4;

            ctx.strokeStyle = `rgba(${Math.floor(40 * shade)}, ${Math.floor(60 * shade)}, ${Math.floor(35 * shade)}, 0.6)`;
            ctx.lineWidth = 0.6 + Math.random() * 0.4;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
            ctx.stroke();
        }
    }

    // === LAYER 7: Mushrooms and fungi ===
    for (let i = 0; i < 8; i++) {
        if (Math.random() > 0.3) {
            const x = Math.random() * TEXTURE_SIZE;
            const y = Math.random() * TEXTURE_SIZE;
            const size = 3 + Math.random() * 4;

            // Stem
            ctx.fillStyle = 'rgba(210, 200, 180, 0.8)';
            ctx.beginPath();
            ctx.ellipse(x, y + size * 0.3, size * 0.3, size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Cap
            const mushroomType = Math.random();
            if (mushroomType < 0.4) {
                // Red cap
                ctx.fillStyle = 'rgba(180, 55, 40, 0.85)';
            } else if (mushroomType < 0.7) {
                // Brown cap
                ctx.fillStyle = 'rgba(130, 100, 70, 0.85)';
            } else {
                // White/cream cap
                ctx.fillStyle = 'rgba(220, 210, 190, 0.85)';
            }
            ctx.beginPath();
            ctx.ellipse(x, y - size * 0.2, size * 0.7, size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Cap highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.ellipse(x - size * 0.2, y - size * 0.35, size * 0.25, size * 0.15, -0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // === LAYER 8: Dappled light filtering through canopy ===
    for (let i = 0; i < 12; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 15 + Math.random() * 35;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(160, 190, 100, 0.15)');
        gradient.addColorStop(0.4, 'rgba(140, 170, 80, 0.08)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 9: Tree shadows ===
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 25 + Math.random() * 40;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(15, 25, 15, 0.35)');
        gradient.addColorStop(0.5, 'rgba(10, 20, 10, 0.2)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('forest', canvas);
}

/**
 * Create ultra-realistic rock/stone texture with depth and weathering
 */
function createRockTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // === BASE LAYER: Complex stone base with natural color variation ===
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            // Multiple noise layers for realistic stone pattern
            const n1 = fractalNoise(x / 50, y / 50, 5, 3);
            const n2 = fractalNoise(x / 20, y / 20, 4, 40);
            const n3 = fractalNoise(x / 80, y / 80, 3, 90);
            const n4 = voronoiNoise(x / 15, y / 15, 6, 150);
            const combined = n1 * 0.3 + n2 * 0.3 + n3 * 0.2 + n4 * 0.2;

            // Natural stone colors with slight warm/cool variation
            const warmth = n3 * 0.1;
            const base = 85 + combined * 50;
            const r = Math.floor(base + warmth * 20);
            const g = Math.floor(base * 0.95 + warmth * 10);
            const b = Math.floor(base * 0.92);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // === LAYER 2: Large stone formations ===
    for (let i = 0; i < 6; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 35 + Math.random() * 60;
        const shade = 0.85 + Math.random() * 0.15;

        const gradient = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, 0, x, y, size);
        gradient.addColorStop(0, `rgba(${Math.floor(130 * shade)}, ${Math.floor(125 * shade)}, ${Math.floor(120 * shade)}, 0.4)`);
        gradient.addColorStop(0.5, `rgba(${Math.floor(100 * shade)}, ${Math.floor(95 * shade)}, ${Math.floor(90 * shade)}, 0.25)`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * (0.6 + Math.random() * 0.4), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 3: Surface texture variation ===
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 10 + Math.random() * 25;
        const type = Math.random();

        let color1;
        if (type < 0.4) {
            // Lighter patch
            color1 = `rgba(140, 135, 130, ${0.2 + Math.random() * 0.15})`;
        } else if (type < 0.7) {
            // Darker patch
            color1 = `rgba(70, 68, 65, ${0.2 + Math.random() * 0.15})`;
        } else {
            // Slight color tint (lichen/weathering)
            const tint = Math.random();
            if (tint < 0.5) {
                color1 = `rgba(90, 100, 85, ${0.15 + Math.random() * 0.1})`; // Green tint
            } else {
                color1 = `rgba(100, 90, 80, ${0.15 + Math.random() * 0.1})`; // Warm tint
            }
        }

        ctx.fillStyle = color1;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * (0.5 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 4: Detailed crack network ===
    // Main cracks
    for (let i = 0; i < 12; i++) {
        const startX = Math.random() * TEXTURE_SIZE;
        const startY = Math.random() * TEXTURE_SIZE;
        const shade = 0.3 + Math.random() * 0.3;

        ctx.strokeStyle = `rgba(${Math.floor(45 * shade)}, ${Math.floor(42 * shade)}, ${Math.floor(40 * shade)}, ${0.5 + Math.random() * 0.3})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        let x = startX;
        let y = startY;
        ctx.moveTo(x, y);

        const segments = 4 + Math.floor(Math.random() * 6);
        for (let j = 0; j < segments; j++) {
            const dx = (Math.random() - 0.5) * 40;
            const dy = (Math.random() - 0.5) * 40;
            x += dx;
            y += dy;
            ctx.lineTo(x, y);

            // Branch off occasionally
            if (Math.random() > 0.6) {
                const branchX = x + (Math.random() - 0.5) * 25;
                const branchY = y + (Math.random() - 0.5) * 25;
                ctx.moveTo(x, y);
                ctx.lineTo(branchX, branchY);
                ctx.moveTo(x, y);
            }
        }
        ctx.stroke();
    }

    // Fine hairline cracks
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 20; i++) {
        ctx.strokeStyle = `rgba(60, 55, 50, ${0.3 + Math.random() * 0.2})`;
        ctx.beginPath();
        let x = Math.random() * TEXTURE_SIZE;
        let y = Math.random() * TEXTURE_SIZE;
        ctx.moveTo(x, y);

        for (let j = 0; j < 3; j++) {
            x += (Math.random() - 0.5) * 20;
            y += (Math.random() - 0.5) * 20;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // === LAYER 5: Surface highlights (weathered edges) ===
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 2 + Math.random() * 6;

        ctx.fillStyle = `rgba(180, 175, 170, ${0.15 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 6: Dark mineral inclusions ===
    for (let i = 0; i < 35; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 2 + Math.random() * 8;

        ctx.fillStyle = `rgba(50, 48, 45, ${0.2 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * (0.5 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 7: Lichen/moss patches (subtle) ===
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 8 + Math.random() * 18;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);

        const lichenType = Math.random();
        if (lichenType < 0.5) {
            // Green lichen
            gradient.addColorStop(0, 'rgba(70, 90, 60, 0.25)');
            gradient.addColorStop(0.6, 'rgba(60, 80, 50, 0.12)');
        } else {
            // Orange/yellow lichen
            gradient.addColorStop(0, 'rgba(150, 130, 70, 0.2)');
            gradient.addColorStop(0.6, 'rgba(140, 120, 60, 0.08)');
        }
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === LAYER 8: Specular highlights ===
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 5 + Math.random() * 15;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(200, 195, 190, 0.2)');
        gradient.addColorStop(0.5, 'rgba(180, 175, 170, 0.08)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.5, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('rock', canvas);
}

/**
 * Create highly realistic water texture with depth and movement
 */
function createWaterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // === UNDERWATER SANDY BOTTOM (visible through clear water) ===
    // First draw the sandy/rocky bottom that shows through
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n1 = fractalNoise(x / 25, y / 25, 4, 3);
            const n2 = fractalNoise(x / 12, y / 12, 3, 20);
            const combined = n1 * 0.6 + n2 * 0.4;

            // Sandy underwater bottom
            const r = Math.floor(130 + combined * 35);
            const g = Math.floor(115 + combined * 30);
            const b = Math.floor(85 + combined * 25);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // === UNDERWATER ROCKS AND STONES ===
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 3 + Math.random() * 8;
        const shade = 0.5 + Math.random() * 0.4;

        // Stone shadow
        ctx.fillStyle = `rgba(60, 50, 40, 0.35)`;
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 2, size, size * 0.6, Math.random() * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Stone
        const gray = Math.floor((85 + Math.random() * 40) * shade);
        ctx.fillStyle = `rgba(${gray + 15}, ${gray + 10}, ${gray}, 0.8)`;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, Math.random() * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // === WATER OVERLAY (semi-transparent blue) ===
    // This creates the "looking through water" effect
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n1 = fractalNoise(x / 40, y / 40, 3, 8);
            const n2 = fractalNoise(x / 20, y / 20, 2, 40);
            const combined = n1 * 0.6 + n2 * 0.4;

            // Semi-transparent water tint with depth variation
            const depth = 0.45 + combined * 0.25; // Water transparency
            const r = Math.floor(30 + combined * 20);
            const g = Math.floor(90 + combined * 40);
            const b = Math.floor(140 + combined * 50);
            ctx.fillStyle = `rgba(${r},${g},${b},${depth})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // === DEEPER AREAS (darker patches) ===
    for (let i = 0; i < 6; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 20 + Math.random() * 35;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(15, 50, 80, 0.4)');
        gradient.addColorStop(0.6, 'rgba(20, 60, 90, 0.2)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === WATER SURFACE RIPPLES ===
    for (let layer = 0; layer < 3; layer++) {
        const alpha = 0.18 - layer * 0.04;
        const ySpacing = 18 + layer * 6;

        ctx.strokeStyle = `rgba(150, 200, 230, ${alpha})`;
        ctx.lineWidth = 1.5 - layer * 0.3;

        for (let i = 0; i < 6; i++) {
            const yBase = (i * ySpacing + layer * 7) % TEXTURE_SIZE;
            const waveAmplitude = 2.5 + layer;
            const frequency = 0.05 - layer * 0.008;

            ctx.beginPath();
            ctx.moveTo(0, yBase);
            for (let px = 0; px <= TEXTURE_SIZE; px += 3) {
                const waveY = yBase + Math.sin(px * frequency + layer * 0.6 + i * 0.9) * waveAmplitude;
                ctx.lineTo(px, waveY);
            }
            ctx.stroke();
        }
    }

    // === LIGHT CAUSTICS (sun reflections on bottom) ===
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 4 + Math.random() * 10;
        const brightness = 0.12 + Math.random() * 0.18;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, `rgba(200, 240, 255, ${brightness})`);
        gradient.addColorStop(0.4, `rgba(180, 225, 250, ${brightness * 0.6})`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        // Wobbly caustic shape
        ctx.ellipse(x, y, size, size * (0.4 + Math.random() * 0.3), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === SURFACE HIGHLIGHTS (bright reflection spots) ===
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 2 + Math.random() * 4;

        ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.4, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // === SHALLOW EDGE AREAS (lighter, sandier) ===
    for (let i = 0; i < 4; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 25 + Math.random() * 40;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(120, 180, 160, 0.2)');
        gradient.addColorStop(0.5, 'rgba(100, 160, 150, 0.1)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('water', canvas);
}

/**
 * Create realistic sand/dried earth texture
 * Inspired by reference image - cracked dry earth with stones
 */
function createSandTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // === BASE: Warm sandy/earth tones with noise ===
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n1 = fractalNoise(x / 30, y / 30, 4, 6);
            const n2 = fractalNoise(x / 15, y / 15, 3, 30);
            const n3 = fractalNoise(x / 60, y / 60, 2, 80);
            const combined = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

            // Warmer earth tones
            const r = Math.floor(165 + combined * 45 + n3 * 20);
            const g = Math.floor(140 + combined * 40 + n2 * 15);
            const b = Math.floor(95 + combined * 30 + n3 * 10);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // === DRIED MUD CRACKS (key feature from reference) ===
    // Create a network of cracks like dried earth
    ctx.strokeStyle = 'rgba(90, 75, 55, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    // Major crack lines
    const crackPoints = [];
    for (let i = 0; i < 8; i++) {
        crackPoints.push({
            x: Math.random() * TEXTURE_SIZE,
            y: Math.random() * TEXTURE_SIZE
        });
    }

    // Draw crack network
    for (let i = 0; i < crackPoints.length; i++) {
        const start = crackPoints[i];

        // Connect to 2-3 nearby points
        const connections = 2 + Math.floor(Math.random() * 2);
        for (let c = 0; c < connections; c++) {
            const targetIdx = (i + 1 + c) % crackPoints.length;
            const end = crackPoints[targetIdx];

            // Draw jagged crack line
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);

            let cx = start.x;
            let cy = start.y;
            const segments = 4 + Math.floor(Math.random() * 4);

            for (let s = 1; s <= segments; s++) {
                const t = s / segments;
                const targetX = start.x + (end.x - start.x) * t;
                const targetY = start.y + (end.y - start.y) * t;

                // Add jitter for natural crack appearance
                cx = targetX + (Math.random() - 0.5) * 15;
                cy = targetY + (Math.random() - 0.5) * 15;

                ctx.lineTo(cx, cy);
            }
            ctx.stroke();

            // Add branch cracks
            if (Math.random() > 0.4) {
                const branchX = start.x + (end.x - start.x) * (0.3 + Math.random() * 0.4);
                const branchY = start.y + (end.y - start.y) * (0.3 + Math.random() * 0.4);
                const branchLen = 15 + Math.random() * 25;
                const branchAngle = Math.random() * Math.PI * 2;

                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(branchX, branchY);
                ctx.lineTo(
                    branchX + Math.cos(branchAngle) * branchLen + (Math.random() - 0.5) * 8,
                    branchY + Math.sin(branchAngle) * branchLen + (Math.random() - 0.5) * 8
                );
                ctx.stroke();
                ctx.lineWidth = 1.5;
            }
        }
    }

    // Finer crack details
    ctx.strokeStyle = 'rgba(100, 85, 65, 0.35)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const len = 8 + Math.random() * 20;
        const angle = Math.random() * Math.PI * 2;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
            x + Math.cos(angle) * len + (Math.random() - 0.5) * 5,
            y + Math.sin(angle) * len + (Math.random() - 0.5) * 5
        );
        ctx.stroke();
    }

    // === SAND GRAINS AND TEXTURE ===
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const shade = 0.6 + Math.random() * 0.4;
        const size = 0.3 + Math.random() * 1.2;

        ctx.fillStyle = `rgba(${Math.floor(190 * shade)}, ${Math.floor(165 * shade)}, ${Math.floor(120 * shade)}, 0.5)`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // === STONES AND PEBBLES (prominent in reference) ===
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 2 + Math.random() * 5;
        const shade = 0.5 + Math.random() * 0.4;

        // Stone shadow
        ctx.fillStyle = `rgba(80, 65, 50, 0.4)`;
        ctx.beginPath();
        ctx.ellipse(x + 1.5, y + 1.5, size, size * 0.6, Math.random() * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Stone body
        const gray = Math.floor((110 + Math.random() * 50) * shade);
        ctx.fillStyle = `rgb(${gray + 15}, ${gray + 10}, ${gray})`;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, Math.random() * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Stone highlight
        ctx.fillStyle = `rgba(200, 190, 175, 0.3)`;
        ctx.beginPath();
        ctx.ellipse(x - size * 0.25, y - size * 0.15, size * 0.35, size * 0.2, -0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Larger rocks (sparse)
    for (let i = 0; i < 5; i++) {
        if (Math.random() > 0.6) continue;

        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 6 + Math.random() * 10;
        const shade = 0.55 + Math.random() * 0.35;

        // Shadow
        ctx.fillStyle = `rgba(60, 50, 40, 0.5)`;
        ctx.beginPath();
        ctx.ellipse(x + 3, y + 3, size, size * 0.55, Math.random() * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Rock
        const gray = Math.floor((100 + Math.random() * 40) * shade);
        ctx.fillStyle = `rgb(${gray + 20}, ${gray + 15}, ${gray + 5})`;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.55, Math.random() * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = `rgba(190, 180, 165, 0.35)`;
        ctx.beginPath();
        ctx.ellipse(x - size * 0.3, y - size * 0.2, size * 0.4, size * 0.25, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // === SUBTLE COLOR VARIATIONS ===
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 20 + Math.random() * 35;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);

        if (Math.random() > 0.5) {
            // Darker patch
            gradient.addColorStop(0, 'rgba(130, 110, 80, 0.2)');
        } else {
            // Lighter patch
            gradient.addColorStop(0, 'rgba(200, 180, 140, 0.15)');
        }
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('sand', canvas);
}

/**
 * Create realistic swamp texture
 */
function createSwampTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Murky base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 18, y / 18, 4, 7);
            const r = Math.floor(55 + n * 30);
            const g = Math.floor(70 + n * 35);
            const b = Math.floor(45 + n * 25);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Murky water puddles
    for (let i = 0; i < 5; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15 + Math.random() * 15);
        gradient.addColorStop(0, 'rgba(35, 50, 40, 0.6)');
        gradient.addColorStop(1, 'rgba(55, 70, 50, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, 20 + Math.random() * 15, 12 + Math.random() * 10, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Mud patches
    for (let i = 0; i < 8; i++) {
        ctx.fillStyle = `rgba(60, 50, 35, ${0.3 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(
            Math.random() * TEXTURE_SIZE,
            Math.random() * TEXTURE_SIZE,
            8 + Math.random() * 12,
            5 + Math.random() * 8,
            Math.random() * Math.PI,
            0, Math.PI * 2
        );
        ctx.fill();
    }

    // Bubbles
    for (let i = 0; i < 15; i++) {
        ctx.fillStyle = `rgba(70, 85, 60, ${0.4 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 1 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Dead reeds
    for (let i = 0; i < 10; i++) {
        ctx.strokeStyle = `rgba(90, 75, 50, ${0.4 + Math.random() * 0.3})`;
        ctx.lineWidth = 1 + Math.random();
        ctx.beginPath();
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 8, y - 10 - Math.random() * 15);
        ctx.stroke();
    }

    textureCache.set('swamp', canvas);
}

/**
 * Create highly realistic snow texture with depth and detail
 */
function createSnowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Multi-layer snow base with blue shadows and warm highlights
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n1 = fractalNoise(x / 25, y / 25, 4, 20);
            const n2 = fractalNoise(x / 12, y / 12, 3, 45);
            const n3 = fractalNoise(x / 50, y / 50, 2, 80);
            const combined = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

            // Snow colors - white with subtle blue in shadows
            const r = Math.floor(225 + combined * 30 - n3 * 10);
            const g = Math.floor(230 + combined * 25 - n3 * 5);
            const b = Math.floor(245 + combined * 10);
            ctx.fillStyle = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Snow drifts/undulations
    for (let i = 0; i < 6; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 15 + Math.random() * 25;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.5, 'rgba(240, 245, 255, 0.15)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Blue shadow patches (depressions in snow)
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 8 + Math.random() * 15;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(180, 200, 230, 0.25)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Snow crystals and sparkles
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const sparkleSize = 0.5 + Math.random() * 1.5;
        const brightness = 0.4 + Math.random() * 0.6;

        // Sparkle with glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, sparkleSize * 2);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${brightness})`);
        gradient.addColorStop(0.5, `rgba(200, 220, 255, ${brightness * 0.3})`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, sparkleSize * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Footprint-like impressions
    for (let i = 0; i < 3; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        ctx.fillStyle = 'rgba(200, 210, 230, 0.15)';
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Subtle wind-blown texture lines
    ctx.strokeStyle = 'rgba(220, 230, 245, 0.2)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 10; i++) {
        const y = Math.random() * TEXTURE_SIZE;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= TEXTURE_SIZE; x += 8) {
            ctx.lineTo(x, y + Math.sin(x / 15 + i) * 2);
        }
        ctx.stroke();
    }

    textureCache.set('snow', canvas);
}

/**
 * Create highly realistic ice texture with cracks, bubbles and depth
 */
function createIceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Multi-layer ice base with depth variation
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n1 = fractalNoise(x / 30, y / 30, 4, 25);
            const n2 = fractalNoise(x / 15, y / 15, 3, 50);
            const n3 = fractalNoise(x / 60, y / 60, 2, 90);
            const combined = n1 * 0.4 + n2 * 0.35 + n3 * 0.25;

            // Ice colors - translucent blues and cyans
            const r = Math.floor(140 + combined * 60 + n3 * 30);
            const g = Math.floor(200 + combined * 40 + n2 * 20);
            const b = Math.floor(230 + combined * 25);
            ctx.fillStyle = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Deep ice patches (darker areas showing depth)
    for (let i = 0; i < 5; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 20 + Math.random() * 30;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(60, 120, 160, 0.3)');
        gradient.addColorStop(0.6, 'rgba(80, 150, 190, 0.15)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Frozen bubbles trapped in ice
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 2 + Math.random() * 6;

        // Bubble with refraction effect
        const gradient = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(0.3, 'rgba(200, 230, 255, 0.3)');
        gradient.addColorStop(0.7, 'rgba(150, 200, 230, 0.15)');
        gradient.addColorStop(1, 'rgba(100, 170, 210, 0.1)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        // Bubble highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Ice crack network
    function drawCrack(startX, startY, depth = 0) {
        if (depth > 3) return;

        let x = startX;
        let y = startY;
        const length = 15 + Math.random() * 25;
        const angle = Math.random() * Math.PI * 2;

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 - depth * 0.1})`;
        ctx.lineWidth = 2 - depth * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, y);

        for (let i = 0; i < 5; i++) {
            const dx = Math.cos(angle + (Math.random() - 0.5) * 0.5) * (length / 5);
            const dy = Math.sin(angle + (Math.random() - 0.5) * 0.5) * (length / 5);
            x += dx;
            y += dy;
            ctx.lineTo(x, y);

            // Branch off
            if (Math.random() > 0.6 && depth < 2) {
                drawCrack(x, y, depth + 1);
            }
        }
        ctx.stroke();

        // Dark line under crack for depth
        ctx.strokeStyle = `rgba(60, 100, 140, ${0.3 - depth * 0.08})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    for (let i = 0; i < 6; i++) {
        drawCrack(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE);
    }

    // Surface frost patterns
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 15; i++) {
        const cx = Math.random() * TEXTURE_SIZE;
        const cy = Math.random() * TEXTURE_SIZE;
        for (let j = 0; j < 6; j++) {
            const angle = (j / 6) * Math.PI * 2;
            const len = 5 + Math.random() * 10;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
            ctx.stroke();
        }
    }

    // Specular highlights
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 10 + Math.random() * 20;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        gradient.addColorStop(0.5, 'rgba(220, 240, 255, 0.1)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.4, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('ice', canvas);
}

/**
 * Create highly realistic deep water texture with abyss feel
 */
function createDeepwaterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Multi-layer deep ocean base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n1 = fractalNoise(x / 40, y / 40, 4, 10);
            const n2 = fractalNoise(x / 20, y / 20, 3, 35);
            const n3 = fractalNoise(x / 70, y / 70, 2, 70);
            const combined = n1 * 0.4 + n2 * 0.35 + n3 * 0.25;

            // Deep ocean colors - very dark blues with hints of green
            const r = Math.floor(5 + combined * 20 + n3 * 10);
            const g = Math.floor(20 + combined * 35 + n2 * 15);
            const b = Math.floor(45 + combined * 40 + n1 * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Abyssal depth variations
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 25 + Math.random() * 40;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(0, 5, 15, 0.5)');
        gradient.addColorStop(0.5, 'rgba(0, 10, 25, 0.3)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Underwater currents (subtle flowing lines)
    for (let layer = 0; layer < 3; layer++) {
        ctx.strokeStyle = `rgba(30, 70, 110, ${0.15 - layer * 0.04})`;
        ctx.lineWidth = 2 - layer * 0.5;

        for (let i = 0; i < 5; i++) {
            const yBase = (i * 30 + layer * 10) % TEXTURE_SIZE;
            ctx.beginPath();
            ctx.moveTo(0, yBase);
            for (let x = 0; x <= TEXTURE_SIZE; x += 6) {
                const waveY = yBase + Math.sin(x * 0.04 + layer * 0.8 + i * 0.5) * (8 + layer * 3);
                ctx.lineTo(x, waveY);
            }
            ctx.stroke();
        }
    }

    // Bioluminescent particles (rare glowing organisms)
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 1 + Math.random() * 3;
        const hue = 180 + Math.random() * 60; // Cyan to blue

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
        gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.6)`);
        gradient.addColorStop(0.3, `hsla(${hue}, 70%, 50%, 0.3)`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Faint light rays from above
    for (let i = 0; i < 4; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const width = 15 + Math.random() * 20;
        const gradient = ctx.createLinearGradient(x, 0, x, TEXTURE_SIZE);
        gradient.addColorStop(0, 'rgba(40, 80, 120, 0.08)');
        gradient.addColorStop(0.5, 'rgba(30, 60, 100, 0.04)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x - width / 2, 0);
        ctx.lineTo(x + width / 2, 0);
        ctx.lineTo(x + width, TEXTURE_SIZE);
        ctx.lineTo(x - width, TEXTURE_SIZE);
        ctx.closePath();
        ctx.fill();
    }

    // Floating particles/sediment
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        ctx.fillStyle = `rgba(60, 90, 120, ${0.1 + Math.random() * 0.15})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.5 + Math.random() * 1, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('deepwater', canvas);
}

/**
 * Create flowers texture
 */
function createFlowersTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Green grass base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 20, y / 20, 4, 15);
            const r = Math.floor(50 + n * 30);
            const g = Math.floor(120 + n * 40);
            const b = Math.floor(60 + n * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Small colorful flowers
    const colors = ['#ff6b6b', '#ffd93d', '#ffffff', '#ff9ecd', '#b19cd9'];
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('flowers', canvas);
}

/**
 * Create wheat texture
 */
function createWheatTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Golden wheat base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 15, y / 15, 4, 25);
            const r = Math.floor(180 + n * 40);
            const g = Math.floor(150 + n * 35);
            const b = Math.floor(70 + n * 25);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Wheat stalks
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const height = 8 + Math.random() * 10;

        ctx.strokeStyle = `rgba(${200 + Math.random() * 40}, ${170 + Math.random() * 30}, ${80 + Math.random() * 20}, 0.7)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 3, y - height);
        ctx.stroke();
    }

    textureCache.set('wheat', canvas);
}

/**
 * Create mud texture
 */
function createMudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Brown mud base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 18, y / 18, 4, 30);
            const r = Math.floor(85 + n * 30);
            const g = Math.floor(70 + n * 25);
            const b = Math.floor(45 + n * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Wet patches
    for (let i = 0; i < 6; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
        gradient.addColorStop(0, 'rgba(60, 45, 30, 0.5)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    }

    textureCache.set('mud', canvas);
}

/**
 * Create gravel texture
 */
function createGravelTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Gray gravel base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 12, y / 12, 4, 35);
            const shade = 120 + n * 50;
            ctx.fillStyle = `rgb(${shade},${shade * 0.95},${shade * 0.9})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Pebbles
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const shade = 0.5 + Math.random() * 0.5;
        ctx.fillStyle = `rgb(${Math.floor(130 * shade)}, ${Math.floor(125 * shade)}, ${Math.floor(115 * shade)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 2 + Math.random() * 3, 1.5 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('gravel', canvas);
}

/**
 * Create ruins texture
 */
function createRuinsTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Stone floor base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 20, y / 20, 4, 40);
            const shade = 100 + n * 40;
            ctx.fillStyle = `rgb(${shade},${shade * 0.95},${shade * 0.9})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Stone blocks pattern
    ctx.strokeStyle = 'rgba(60, 55, 50, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        ctx.strokeRect(x, y, 20 + Math.random() * 20, 15 + Math.random() * 15);
    }

    // Moss patches
    for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(60, 100, 50, 0.3)';
        ctx.beginPath();
        ctx.ellipse(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('ruins', canvas);
}

/**
 * Create heather texture
 */
function createHeatherTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Purple-brown heather base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 20, y / 20, 4, 45);
            const r = Math.floor(100 + n * 40);
            const g = Math.floor(70 + n * 30);
            const b = Math.floor(100 + n * 40);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Small purple flowers
    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgb(${140 + Math.random() * 50}, ${80 + Math.random() * 40}, ${140 + Math.random() * 50})`;
        ctx.beginPath();
        ctx.arc(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 1 + Math.random(), 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('heather', canvas);
}

/**
 * Create moss texture
 */
function createMossTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Dark green moss base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 15, y / 15, 5, 50);
            const r = Math.floor(40 + n * 25);
            const g = Math.floor(80 + n * 35);
            const b = Math.floor(40 + n * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Moss clumps
    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(${50 + Math.random() * 30}, ${90 + Math.random() * 30}, ${50 + Math.random() * 20}, 0.6)`;
        ctx.beginPath();
        ctx.ellipse(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 5 + Math.random() * 8, 3 + Math.random() * 5, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('moss', canvas);
}

// ===== ENHANCED CHARACTER RENDERING =====

/**
 * Quick noise for inline texture generation
 */
function quickNoise(x, y, seed = 0) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.12) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1; // -1 to 1
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Draw textured rectangle with noise-based material effect
 */
function drawTexturedRect(ctx, x, y, w, h, baseColor, options = {}) {
    const {
        noise = 0.15,
        highlight = 0.2,
        shadow = 0.3,
        metallic = false,
        worn = false,
        seed = 0
    } = options;

    const rgb = typeof baseColor === 'string' ? hexToRgb(baseColor) : baseColor;

    // Base fill with gradient
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    const lightR = Math.min(255, rgb.r + 30);
    const lightG = Math.min(255, rgb.g + 30);
    const lightB = Math.min(255, rgb.b + 30);
    const darkR = Math.max(0, rgb.r - 25);
    const darkG = Math.max(0, rgb.g - 25);
    const darkB = Math.max(0, rgb.b - 25);

    grad.addColorStop(0, `rgb(${lightR},${lightG},${lightB})`);
    grad.addColorStop(0.5, `rgb(${rgb.r},${rgb.g},${rgb.b})`);
    grad.addColorStop(1, `rgb(${darkR},${darkG},${darkB})`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Noise texture overlay
    for (let py = 0; py < h; py += 2) {
        for (let px = 0; px < w; px += 2) {
            const n = quickNoise(px + seed, py + seed, seed) * noise;
            const brightness = metallic ? n * 1.5 : n;
            if (brightness > 0) {
                ctx.fillStyle = `rgba(255,255,255,${Math.abs(brightness)})`;
            } else {
                ctx.fillStyle = `rgba(0,0,0,${Math.abs(brightness)})`;
            }
            ctx.fillRect(x + px, y + py, 2, 2);
        }
    }

    // Worn/scratched effect
    if (worn) {
        for (let i = 0; i < 3; i++) {
            const sx = x + quickNoise(i, seed, 1) * w * 0.4 + w * 0.3;
            const sy = y + quickNoise(i, seed, 2) * h * 0.4 + h * 0.3;
            const sw = 2 + Math.abs(quickNoise(i, seed, 3)) * 4;
            ctx.fillStyle = `rgba(${lightR + 40},${lightG + 40},${lightB + 40},0.3)`;
            ctx.fillRect(sx, sy, sw, 1);
        }
    }

    // Top highlight
    ctx.fillStyle = `rgba(255,255,255,${highlight})`;
    ctx.fillRect(x + 1, y + 1, w - 2, 2);

    // Bottom shadow
    ctx.fillStyle = `rgba(0,0,0,${shadow})`;
    ctx.fillRect(x + 1, y + h - 2, w - 2, 2);

    // Metallic specular
    if (metallic) {
        const specGrad = ctx.createLinearGradient(x, y, x + w * 0.3, y + h * 0.3);
        specGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
        specGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
        specGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = specGrad;
        ctx.fillRect(x, y, w * 0.5, h * 0.5);
    }
}

/**
 * Draw textured circle/ellipse with material effect
 */
function drawTexturedCircle(ctx, cx, cy, rx, ry, baseColor, options = {}) {
    const {
        noise = 0.12,
        metallic = false,
        seed = 0
    } = options;

    const rgb = typeof baseColor === 'string' ? hexToRgb(baseColor) : baseColor;

    // Radial gradient for 3D effect
    const grad = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.3, 0, cx, cy, Math.max(rx, ry));
    const lightR = Math.min(255, rgb.r + 45);
    const lightG = Math.min(255, rgb.g + 45);
    const lightB = Math.min(255, rgb.b + 45);
    const darkR = Math.max(0, rgb.r - 30);
    const darkG = Math.max(0, rgb.g - 30);
    const darkB = Math.max(0, rgb.b - 30);

    grad.addColorStop(0, `rgb(${lightR},${lightG},${lightB})`);
    grad.addColorStop(0.6, `rgb(${rgb.r},${rgb.g},${rgb.b})`);
    grad.addColorStop(1, `rgb(${darkR},${darkG},${darkB})`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Noise texture
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();

    for (let py = -ry; py < ry; py += 2) {
        for (let px = -rx; px < rx; px += 2) {
            if (px * px / (rx * rx) + py * py / (ry * ry) <= 1) {
                const n = quickNoise(px + seed, py + seed, seed) * noise;
                if (n > 0) {
                    ctx.fillStyle = `rgba(255,255,255,${n})`;
                } else {
                    ctx.fillStyle = `rgba(0,0,0,${-n})`;
                }
                ctx.fillRect(cx + px, cy + py, 2, 2);
            }
        }
    }
    ctx.restore();

    // Metallic highlight
    if (metallic) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.ellipse(cx - rx * 0.25, cy - ry * 0.35, rx * 0.4, ry * 0.25, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Edge definition
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
}

/**
 * Draw fabric/cloth texture
 */
function drawFabricRect(ctx, x, y, w, h, baseColor, seed = 0) {
    const rgb = typeof baseColor === 'string' ? hexToRgb(baseColor) : baseColor;

    // Base color
    ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    ctx.fillRect(x, y, w, h);

    // Fabric weave pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    for (let py = 0; py < h; py += 3) {
        ctx.beginPath();
        ctx.moveTo(x, y + py);
        ctx.lineTo(x + w, y + py);
        ctx.stroke();
    }

    // Subtle noise for fabric texture
    for (let py = 0; py < h; py += 2) {
        for (let px = 0; px < w; px += 2) {
            const n = quickNoise(px + seed, py + seed, seed) * 0.1;
            ctx.fillStyle = n > 0 ? `rgba(255,255,255,${n})` : `rgba(0,0,0,${-n})`;
            ctx.fillRect(x + px, y + py, 2, 2);
        }
    }

    // Fold shadows
    const foldGrad = ctx.createLinearGradient(x, y, x, y + h);
    foldGrad.addColorStop(0, 'rgba(0,0,0,0.1)');
    foldGrad.addColorStop(0.3, 'transparent');
    foldGrad.addColorStop(0.7, 'transparent');
    foldGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = foldGrad;
    ctx.fillRect(x, y, w, h);
}

/**
 * Draw a human character sprite with enhanced details and procedural animation
 */
export function drawHumanSprite(ctx, cx, cy, size, playerColor, classType, isSelected, status = 'normal', direction = 0) {
    ctx.save();
    ctx.translate(cx, cy);

    const scale = size / 45;

    // Generate consistent seed from position for unique character variation
    const seed = Math.abs(cx * 100 + cy) % 1000;

    // Procedural animation based on time and seed
    const time = performance.now() / 1000;
    const animPhase = (time + seed * 0.1) % (Math.PI * 2);

    // Breathing animation - subtle vertical oscillation
    const breathAmount = status === 'wounded' ? 2.0 : 0.8;
    const breathOffset = Math.sin(animPhase * 1.5) * breathAmount;

    // Idle sway - very subtle side-to-side motion
    const swayAmount = status === 'alert' ? 0 : (status === 'stealth' ? 0.3 : 0.5);
    const swayOffset = Math.sin(animPhase * 0.7) * swayAmount;

    // Apply base scale with breathing effect (chest expansion)
    const breathScale = 1 + Math.sin(animPhase * 1.5) * 0.015;
    ctx.scale(scale * breathScale, scale);

    // Apply subtle rotation for more natural stance
    const idleRotation = Math.sin(animPhase * 0.5) * 0.02 * (status === 'cover' ? 0 : 1);
    ctx.rotate(idleRotation);

    // Translate for breathing motion
    ctx.translate(swayOffset, breathOffset * 0.3);

    // Enhanced shadow with blur effect
    const shadowGrad = ctx.createRadialGradient(0, 32, 0, 0, 32, 20);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    shadowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 32, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Selection glow with pulsing effect
    if (isSelected) {
        ctx.shadowColor = playerColor;
        ctx.shadowBlur = 25;
        // Outer glow ring
        ctx.strokeStyle = playerColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 28, 35, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Class-specific color palettes with more depth
    let bodyColor, armorColor, helmetColor, accentColor, skinTone;
    switch (classType) {
        case 'scout':
            bodyColor = { r: 42, g: 42, b: 58 };
            armorColor = { r: 58, g: 58, b: 74 };
            helmetColor = { r: 74, g: 74, b: 90 };
            accentColor = { r: 100, g: 150, b: 200 };
            skinTone = { r: 201, g: 160, b: 122 };
            break;
        case 'assault':
            bodyColor = { r: 58, g: 42, b: 42 };
            armorColor = { r: 80, g: 55, b: 55 };
            helmetColor = { r: 100, g: 70, b: 70 };
            accentColor = { r: 200, g: 100, b: 80 };
            skinTone = { r: 180, g: 140, b: 110 };
            break;
        case 'medic':
            bodyColor = { r: 42, g: 58, b: 42 };
            armorColor = { r: 58, g: 80, b: 58 };
            helmetColor = { r: 74, g: 100, b: 74 };
            accentColor = { r: 220, g: 60, b: 60 };
            skinTone = { r: 210, g: 170, b: 140 };
            break;
        case 'sniper':
            bodyColor = { r: 42, g: 50, b: 64 };
            armorColor = { r: 50, g: 60, b: 85 };
            helmetColor = { r: 60, g: 70, b: 100 };
            accentColor = { r: 100, g: 140, b: 255 };
            skinTone = { r: 190, g: 150, b: 120 };
            break;
        case 'ninja':
            bodyColor = { r: 20, g: 20, b: 25 };
            armorColor = { r: 30, g: 30, b: 35 };
            helmetColor = { r: 40, g: 40, b: 45 };
            accentColor = { r: 255, g: 50, b: 50 };
            skinTone = { r: 60, g: 60, b: 65 }; // Masked
            break;
        default:
            bodyColor = { r: 42, g: 42, b: 58 };
            armorColor = { r: 58, g: 58, b: 74 };
            helmetColor = { r: 74, g: 74, b: 90 };
            accentColor = { r: 100, g: 150, b: 200 };
            skinTone = { r: 201, g: 160, b: 122 };
    }

    // === LEGS ===
    // Left leg with fabric texture
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-12, 8, 10, 22, 3);
    ctx.clip();
    drawFabricRect(ctx, -12, 8, 10, 22, bodyColor, seed);
    ctx.restore();

    // Right leg
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(2, 8, 10, 22, 3);
    ctx.clip();
    drawFabricRect(ctx, 2, 8, 10, 22, bodyColor, seed + 1);
    ctx.restore();

    // Knee pads
    drawTexturedCircle(ctx, -7, 16, 4, 3, armorColor, { metallic: true, seed: seed + 2 });
    drawTexturedCircle(ctx, 7, 16, 4, 3, armorColor, { metallic: true, seed: seed + 3 });

    // === BOOTS ===
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-13, 26, 12, 7, 2);
    ctx.clip();
    drawTexturedRect(ctx, -13, 26, 12, 7, { r: 30, g: 28, b: 25 }, { metallic: false, worn: true, seed: seed + 4 });
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(1, 26, 12, 7, 2);
    ctx.clip();
    drawTexturedRect(ctx, 1, 26, 12, 7, { r: 30, g: 28, b: 25 }, { metallic: false, worn: true, seed: seed + 5 });
    ctx.restore();

    // Boot soles
    ctx.fillStyle = '#1a1815';
    ctx.fillRect(-12, 31, 10, 2);
    ctx.fillRect(2, 31, 10, 2);

    // === TORSO/ARMOR ===
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-16, -14, 32, 26, 5);
    ctx.clip();
    drawTexturedRect(ctx, -16, -14, 32, 26, armorColor, { metallic: true, worn: true, noise: 0.12, seed: seed + 6 });

    // Armor panel lines
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -14);
    ctx.lineTo(-8, 12);
    ctx.moveTo(8, -14);
    ctx.lineTo(8, 12);
    ctx.moveTo(-16, -2);
    ctx.lineTo(16, -2);
    ctx.stroke();

    ctx.restore();

    // Player color stripe/insignia with glow
    const playerRgb = hexToRgb(playerColor);
    ctx.shadowColor = playerColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = playerColor;
    ctx.beginPath();
    ctx.roundRect(-14, -10, 5, 16, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(9, -10, 5, 16, 1);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Stripe highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-13, -9, 3, 2);
    ctx.fillRect(10, -9, 3, 2);

    // Chest plate center detail
    const chestGrad = ctx.createLinearGradient(-6, -10, 6, 6);
    chestGrad.addColorStop(0, `rgba(${armorColor.r + 30},${armorColor.g + 30},${armorColor.b + 30},0.8)`);
    chestGrad.addColorStop(0.5, `rgba(${armorColor.r},${armorColor.g},${armorColor.b},0.6)`);
    chestGrad.addColorStop(1, `rgba(${armorColor.r - 20},${armorColor.g - 20},${armorColor.b - 20},0.8)`);
    ctx.fillStyle = chestGrad;
    ctx.beginPath();
    ctx.roundRect(-6, -10, 12, 16, 2);
    ctx.fill();

    // Chest emblem (class icon area)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${accentColor.r},${accentColor.g},${accentColor.b},0.6)`;
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.fill();

    // === ARMS with procedural animation ===
    // Arm swing animation - opposite to breathing
    const armSwing = Math.sin(animPhase * 1.2) * 0.08;
    const armLift = Math.sin(animPhase * 1.5) * 1.5;

    // Left arm with subtle animation
    ctx.save();
    ctx.translate(-19, -2);
    ctx.rotate(-armSwing); // Subtle rotation
    ctx.translate(19, 2);
    ctx.beginPath();
    ctx.roundRect(-24, -12 + armLift * 0.5, 10, 20, 3);
    ctx.clip();
    drawFabricRect(ctx, -24, -12 + armLift * 0.5, 10, 20, bodyColor, seed + 7);
    ctx.restore();

    // Right arm with opposite animation
    ctx.save();
    ctx.translate(19, -2);
    ctx.rotate(armSwing); // Opposite rotation
    ctx.translate(-19, 2);
    ctx.beginPath();
    ctx.roundRect(14, -12 - armLift * 0.3, 10, 20, 3);
    ctx.clip();
    drawFabricRect(ctx, 14, -12 - armLift * 0.3, 10, 20, bodyColor, seed + 8);
    ctx.restore();

    // Arm armor plates
    drawTexturedRect(ctx, -23, -10 + armLift * 0.5, 8, 6, armorColor, { metallic: true, seed: seed + 9 });
    drawTexturedRect(ctx, 15, -10 - armLift * 0.3, 8, 6, armorColor, { metallic: true, seed: seed + 10 });

    // === GLOVES with animation ===
    drawTexturedCircle(ctx, -19, 10 + armLift * 0.8, 6, 5, { r: 35, g: 32, b: 30 }, { noise: 0.15, seed: seed + 11 });
    drawTexturedCircle(ctx, 19, 10 - armLift * 0.5, 6, 5, { r: 35, g: 32, b: 30 }, { noise: 0.15, seed: seed + 12 });

    // Glove knuckle details
    ctx.fillStyle = 'rgba(60,55,50,0.8)';
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-21 + i * 2.5, 8, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(17 + i * 2.5, 8, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // === NECK (adjusted for smaller helmet) ===
    if (classType !== 'ninja') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(-4, -17, 8, 5, 2);
        ctx.clip();
        // Skin with subtle texture
        const skinGrad = ctx.createLinearGradient(-4, -17, 4, -12);
        skinGrad.addColorStop(0, `rgb(${skinTone.r + 15},${skinTone.g + 10},${skinTone.b + 5})`);
        skinGrad.addColorStop(1, `rgb(${skinTone.r - 20},${skinTone.g - 15},${skinTone.b - 10})`);
        ctx.fillStyle = skinGrad;
        ctx.fillRect(-4, -17, 8, 5);
        ctx.restore();

        // Neck shadow from helmet
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(0, -14, 4, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // === HELMET (proportionally smaller - realistic tactical helmet) ===
    // Head size reduced from 14 to 10 for better proportions
    const headY = -24;
    const headRadius = 10;

    // Helmet base
    drawTexturedCircle(ctx, 0, headY, headRadius, headRadius, helmetColor, { metallic: true, noise: 0.1, seed: seed + 13 });

    // Helmet top with slight elongation
    ctx.fillStyle = `rgb(${helmetColor.r - 10},${helmetColor.g - 10},${helmetColor.b - 10})`;
    ctx.beginPath();
    ctx.ellipse(0, headY - 4, headRadius * 0.9, headRadius * 0.6, 0, Math.PI, 0);
    ctx.fill();

    // Helmet ridge/crest (smaller, more tactical)
    ctx.fillStyle = `rgb(${helmetColor.r - 20},${helmetColor.g - 20},${helmetColor.b - 20})`;
    ctx.beginPath();
    ctx.ellipse(0, headY - 8, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Side rails (tactical mount points)
    ctx.fillStyle = `rgb(${helmetColor.r - 25},${helmetColor.g - 25},${helmetColor.b - 25})`;
    ctx.fillRect(-headRadius - 1, headY - 2, 3, 6);
    ctx.fillRect(headRadius - 2, headY - 2, 3, 6);

    // Helmet vents (smaller, repositioned)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-5, headY - 7, 1.5, 3);
    ctx.fillRect(3.5, headY - 7, 1.5, 3);

    // Front plate detail
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-headRadius * 0.6, headY - 6);
    ctx.lineTo(-headRadius * 0.6, headY + 2);
    ctx.moveTo(headRadius * 0.6, headY - 6);
    ctx.lineTo(headRadius * 0.6, headY + 2);
    ctx.stroke();

    // === VISOR (proportionally smaller) ===
    const visorGradient = ctx.createLinearGradient(-8, headY - 2, 8, headY + 4);
    visorGradient.addColorStop(0, `rgba(${accentColor.r},${accentColor.g},${accentColor.b},0.9)`);
    visorGradient.addColorStop(0.3, `rgba(${accentColor.r + 50},${accentColor.g + 50},${accentColor.b + 50},0.7)`);
    visorGradient.addColorStop(0.7, `rgba(${accentColor.r - 30},${accentColor.g - 30},${accentColor.b},0.8)`);
    visorGradient.addColorStop(1, `rgba(${accentColor.r - 50},${accentColor.g - 50},${accentColor.b - 20},0.9)`);
    ctx.fillStyle = visorGradient;
    ctx.beginPath();
    ctx.ellipse(0, headY, headRadius * 0.85, headRadius * 0.5, 0, 0, Math.PI);
    ctx.fill();

    // Visor reflection (sharper, more realistic)
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-3, headY - 1, 2.5, 1.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(2, headY + 1, 1.5, 0.8, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Visor edge
    ctx.strokeStyle = `rgba(${helmetColor.r + 30},${helmetColor.g + 30},${helmetColor.b + 30},0.9)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, headY, headRadius * 0.85, headRadius * 0.5, 0, 0, Math.PI);
    ctx.stroke();

    // Chin guard detail
    ctx.fillStyle = `rgba(${helmetColor.r - 15},${helmetColor.g - 15},${helmetColor.b - 15},0.8)`;
    ctx.beginPath();
    ctx.moveTo(-5, headY + headRadius * 0.6);
    ctx.quadraticCurveTo(0, headY + headRadius * 0.9, 5, headY + headRadius * 0.6);
    ctx.stroke();

    // === CLASS-SPECIFIC EQUIPMENT ===
    ctx.shadowBlur = 0;
    switch (classType) {
        case 'scout':
            drawScoutEquipment(ctx, armorColor, accentColor, seed);
            break;
        case 'assault':
            drawAssaultEquipment(ctx, armorColor, accentColor, seed);
            break;
        case 'medic':
            drawMedicEquipment(ctx, armorColor, accentColor, seed);
            break;
        case 'sniper':
            drawSniperEquipment(ctx, armorColor, accentColor, seed);
            break;
        case 'ninja':
            drawNinjaEquipment(ctx, armorColor, accentColor, seed);
            break;
    }

    // === STATUS-SPECIFIC VISUAL EFFECTS ===
    drawStatusEffects(ctx, status, accentColor, playerColor);

    ctx.restore();
}

/**
 * Draw status-specific visual effects
 */
function drawStatusEffects(ctx, status, accentColor, playerColor) {
    switch (status) {
        case 'attack':
            drawAttackEffect(ctx);
            break;
        case 'cover':
        case 'crouch':
            drawCrouchEffect(ctx);
            break;
        case 'move':
            drawMoveEffect(ctx);
            break;
        case 'alert':
            drawAlertEffect(ctx, accentColor);
            break;
        case 'wounded':
            drawWoundedEffect(ctx);
            break;
        case 'stealth':
            drawStealthEffect(ctx);
            break;
    }
}

/**
 * Attack pose - muzzle flash and action lines
 */
function drawAttackEffect(ctx) {
    ctx.save();

    // Muzzle flash
    const gradient = ctx.createRadialGradient(32, -4, 0, 32, -4, 12);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.9)');
    gradient.addColorStop(0.6, 'rgba(255, 150, 50, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, -4, 12, 0, Math.PI * 2);
    ctx.fill();

    // Flash spikes
    ctx.strokeStyle = 'rgba(255, 255, 150, 0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI - Math.PI / 2;
        const len = 8 + Math.random() * 6;
        ctx.beginPath();
        ctx.moveTo(32, -4);
        ctx.lineTo(32 + Math.cos(angle) * len, -4 + Math.sin(angle) * len);
        ctx.stroke();
    }

    // Action lines
    ctx.strokeStyle = 'rgba(255, 220, 160, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(24, -12);
    ctx.lineTo(40, -20);
    ctx.moveTo(24, 4);
    ctx.lineTo(40, 10);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

/**
 * Crouch/cover pose - lowered stance indicator
 */
function drawCrouchEffect(ctx) {
    ctx.save();

    // Cover indicator bar
    ctx.fillStyle = 'rgba(70, 100, 60, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-24, 20, 48, 10, 3);
    ctx.fill();

    // Shield icon
    ctx.fillStyle = 'rgba(100, 140, 80, 0.9)';
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(-8, 25);
    ctx.lineTo(-8, 28);
    ctx.lineTo(0, 30);
    ctx.lineTo(8, 28);
    ctx.lineTo(8, 25);
    ctx.closePath();
    ctx.fill();

    // Cover text lines
    ctx.strokeStyle = 'rgba(50, 70, 45, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-20, 24);
    ctx.lineTo(-12, 24);
    ctx.moveTo(12, 24);
    ctx.lineTo(20, 24);
    ctx.stroke();

    ctx.restore();
}

/**
 * Move pose - motion blur lines
 */
function drawMoveEffect(ctx) {
    ctx.save();

    // Motion blur lines behind character
    ctx.strokeStyle = 'rgba(150, 180, 200, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const y = -25 + i * 18;
        const length = 15 + i * 3;
        ctx.beginPath();
        ctx.moveTo(-28, y);
        ctx.lineTo(-28 - length, y + 2);
        ctx.stroke();
    }

    // Dust particles
    ctx.fillStyle = 'rgba(180, 160, 140, 0.5)';
    for (let i = 0; i < 5; i++) {
        const x = -20 - Math.random() * 15;
        const y = 25 + Math.random() * 10;
        const size = 2 + Math.random() * 3;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Alert pose - glowing visor and exclamation
 */
function drawAlertEffect(ctx, accentColor) {
    ctx.save();

    // Visor glow pulse
    const glowGrad = ctx.createRadialGradient(0, -28, 5, 0, -28, 20);
    glowGrad.addColorStop(0, `rgba(${accentColor.r}, ${accentColor.g}, ${accentColor.b}, 0.6)`);
    glowGrad.addColorStop(0.5, `rgba(${accentColor.r}, ${accentColor.g}, ${accentColor.b}, 0.2)`);
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, -28, 20, 0, Math.PI * 2);
    ctx.fill();

    // Exclamation mark
    ctx.fillStyle = 'rgba(255, 200, 50, 0.95)';
    ctx.beginPath();
    ctx.roundRect(-3, -55, 6, 14, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -38, 3, 0, Math.PI * 2);
    ctx.fill();

    // Alert rays
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
        const angle = -Math.PI / 2 + (i - 1.5) * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 8, -48 + Math.sin(angle) * 8);
        ctx.lineTo(Math.cos(angle) * 16, -48 + Math.sin(angle) * 16);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Wounded pose - damage indicators
 */
function drawWoundedEffect(ctx) {
    ctx.save();

    // Damage cracks on armor
    ctx.strokeStyle = 'rgba(60, 40, 40, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(-12, -2);
    ctx.lineTo(-10, 4);
    ctx.moveTo(6, -5);
    ctx.lineTo(10, 2);
    ctx.stroke();

    // Blood drips (subtle)
    ctx.fillStyle = 'rgba(150, 50, 50, 0.6)';
    for (let i = 0; i < 3; i++) {
        const x = -5 + i * 5;
        const y = 8 + i * 4;
        ctx.beginPath();
        ctx.ellipse(x, y, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Low HP indicator
    ctx.fillStyle = 'rgba(200, 60, 60, 0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(-6, -58);
    ctx.lineTo(-4, -58);
    ctx.lineTo(-4, -64);
    ctx.lineTo(4, -64);
    ctx.lineTo(4, -58);
    ctx.lineTo(6, -58);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

/**
 * Stealth pose - shimmer/camo effect
 */
function drawStealthEffect(ctx) {
    ctx.save();

    // Reduced opacity for stealth
    ctx.globalAlpha = 0.6;

    // Camo pattern overlay
    ctx.fillStyle = 'rgba(60, 80, 60, 0.3)';
    for (let i = 0; i < 12; i++) {
        const x = -20 + (i % 4) * 12;
        const y = -35 + Math.floor(i / 4) * 22;
        const w = 8 + Math.random() * 6;
        const h = 6 + Math.random() * 4;
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Shimmer lines
    ctx.strokeStyle = 'rgba(100, 150, 180, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const y = -40 + i * 14;
        ctx.beginPath();
        ctx.moveTo(-18, y);
        for (let j = 0; j <= 8; j++) {
            const x = -18 + j * 4.5;
            const wave = Math.sin(j * 0.8 + i * 0.5) * 2;
            ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Scout equipment - light rifle, binoculars
 */
function drawScoutEquipment(ctx, armorColor, accentColor, seed) {
    // Compact rifle on back
    ctx.save();
    ctx.rotate(-0.25);

    // Rifle body with texture
    const rifleGrad = ctx.createLinearGradient(-28, -38, -23, -38);
    rifleGrad.addColorStop(0, '#2a2a2a');
    rifleGrad.addColorStop(0.5, '#404040');
    rifleGrad.addColorStop(1, '#252525');
    ctx.fillStyle = rifleGrad;
    ctx.beginPath();
    ctx.roundRect(-28, -38, 5, 45, 1);
    ctx.fill();

    // Rifle details
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-27, -35, 3, 8);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-27, -20, 3, 5);

    ctx.restore();

    // Scope
    drawTexturedCircle(ctx, -24, -35, 4, 4, { r: 40, g: 40, b: 50 }, { metallic: true, seed });
    ctx.fillStyle = `rgba(${accentColor.r},${accentColor.g},${accentColor.b},0.8)`;
    ctx.beginPath();
    ctx.arc(-24, -35, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Binoculars on belt
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(12, 2, 8, 6, 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${accentColor.r},${accentColor.g},${accentColor.b},0.6)`;
    ctx.beginPath();
    ctx.arc(14, 5, 2, 0, Math.PI * 2);
    ctx.arc(18, 5, 2, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Assault equipment - heavy weapon, shoulder pads
 */
function drawAssaultEquipment(ctx, armorColor, accentColor, seed) {
    // Heavy shoulder pads
    drawTexturedCircle(ctx, -20, -10, 9, 6, armorColor, { metallic: true, seed });
    drawTexturedCircle(ctx, 20, -10, 9, 6, armorColor, { metallic: true, seed: seed + 1 });

    // Shoulder pad spikes/ridges
    ctx.fillStyle = `rgb(${armorColor.r - 20},${armorColor.g - 20},${armorColor.b - 20})`;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-24 + i * 4, -14);
        ctx.lineTo(-22 + i * 4, -18);
        ctx.lineTo(-20 + i * 4, -14);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(16 + i * 4, -14);
        ctx.lineTo(18 + i * 4, -18);
        ctx.lineTo(20 + i * 4, -14);
        ctx.fill();
    }

    // Heavy weapon
    const weaponGrad = ctx.createLinearGradient(16, -6, 46, -6);
    weaponGrad.addColorStop(0, '#3a3a3a');
    weaponGrad.addColorStop(0.3, '#4a4a4a');
    weaponGrad.addColorStop(0.7, '#353535');
    weaponGrad.addColorStop(1, '#252525');
    ctx.fillStyle = weaponGrad;
    ctx.beginPath();
    ctx.roundRect(16, -6, 26, 10, 2);
    ctx.fill();

    // Barrel
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(38, -4, 12, 6, 1);
    ctx.fill();

    // Muzzle glow
    ctx.fillStyle = `rgba(${accentColor.r},${accentColor.g},${accentColor.b},0.4)`;
    ctx.beginPath();
    ctx.arc(50, -1, 3, 0, Math.PI * 2);
    ctx.fill();

    // Ammo drum
    drawTexturedCircle(ctx, 26, 2, 6, 6, { r: 50, g: 45, b: 40 }, { metallic: true, seed: seed + 2 });

    // Grenades on belt
    for (let i = 0; i < 2; i++) {
        drawTexturedCircle(ctx, -16 + i * 8, 8, 3, 4, { r: 60, g: 80, b: 60 }, { seed: seed + 3 + i });
    }
}

/**
 * Medic equipment - medical backpack, heal tool
 */
function drawMedicEquipment(ctx, armorColor, accentColor, seed) {
    // Medical backpack
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-24, -16, 14, 26, 4);
    ctx.clip();
    drawTexturedRect(ctx, -24, -16, 14, 26, { r: 50, g: 70, b: 50 }, { worn: true, seed });
    ctx.restore();

    // Backpack straps
    ctx.fillStyle = '#3a4a3a';
    ctx.fillRect(-22, -14, 2, 20);
    ctx.fillRect(-14, -14, 2, 20);

    // Red cross with glow
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#dd2222';
    ctx.fillRect(-20, -8, 8, 2);
    ctx.fillRect(-17, -11, 2, 8);
    ctx.shadowBlur = 0;

    // Cross highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-19, -7, 6, 1);

    // Medical scanner/tool
    const toolGrad = ctx.createLinearGradient(16, -4, 32, -4);
    toolGrad.addColorStop(0, '#888888');
    toolGrad.addColorStop(0.5, '#aaaaaa');
    toolGrad.addColorStop(1, '#777777');
    ctx.fillStyle = toolGrad;
    ctx.beginPath();
    ctx.roundRect(16, -4, 16, 6, 2);
    ctx.fill();

    // Scanner screen
    ctx.fillStyle = `rgba(${accentColor.r},${accentColor.g},${accentColor.b},0.8)`;
    ctx.fillRect(18, -2, 6, 2);

    // Heartbeat line on screen
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(19, -1);
    ctx.lineTo(20, -1);
    ctx.lineTo(21, -3);
    ctx.lineTo(22, 0);
    ctx.lineTo(23, -1);
    ctx.stroke();

    // Med pouches on belt
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#4a5a4a';
        ctx.beginPath();
        ctx.roundRect(-8 + i * 7, 6, 5, 6, 1);
        ctx.fill();
    }
}

/**
 * Sniper equipment - long rifle, ghillie elements
 */
function drawSniperEquipment(ctx, armorColor, accentColor, seed) {
    // Long sniper rifle
    ctx.save();
    ctx.rotate(-0.2);

    // Rifle body
    const rifleGrad = ctx.createLinearGradient(-30, -45, -26, -45);
    rifleGrad.addColorStop(0, '#1a1a1a');
    rifleGrad.addColorStop(0.5, '#2a2a2a');
    rifleGrad.addColorStop(1, '#151515');
    ctx.fillStyle = rifleGrad;
    ctx.beginPath();
    ctx.roundRect(-30, -45, 4, 65, 1);
    ctx.fill();

    // Rifle stock
    ctx.fillStyle = '#3a3020';
    ctx.beginPath();
    ctx.roundRect(-31, 10, 6, 12, 2);
    ctx.fill();

    ctx.restore();

    // Large scope
    drawTexturedCircle(ctx, -26, -40, 6, 6, { r: 50, g: 50, b: 70 }, { metallic: true, seed });

    // Scope lens with glow
    ctx.shadowColor = `rgb(${accentColor.r},${accentColor.g},${accentColor.b})`;
    ctx.shadowBlur = 8;
    ctx.fillStyle = `rgba(${accentColor.r},${accentColor.g},${accentColor.b},0.9)`;
    ctx.beginPath();
    ctx.arc(-26, -40, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Lens reflection
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(-27, -41, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Ghillie hood strips
    ctx.fillStyle = '#3a4a3a';
    for (let i = 0; i < 5; i++) {
        const angle = -0.4 + i * 0.2;
        ctx.save();
        ctx.rotate(angle);
        ctx.fillRect(-2, -42, 2, 8 + Math.random() * 4);
        ctx.restore();
    }

    // Camo stripes on armor
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(-7, -8, 3, 10);
    ctx.fillRect(4, -6, 3, 8);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-3, -10, 2, 12);
}

/**
 * Ninja equipment - katana, shuriken, mask details
 */
function drawNinjaEquipment(ctx, armorColor, accentColor, seed) {
    // Katana on back
    ctx.save();
    ctx.rotate(0.3);

    // Blade with metallic effect
    const bladeGrad = ctx.createLinearGradient(7, -50, 12, -50);
    bladeGrad.addColorStop(0, '#c0c0c0');
    bladeGrad.addColorStop(0.3, '#ffffff');
    bladeGrad.addColorStop(0.5, '#e0e0e0');
    bladeGrad.addColorStop(1, '#909090');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(8, -50);
    ctx.lineTo(11, -50);
    ctx.lineTo(12, -5);
    ctx.lineTo(7, -5);
    ctx.closePath();
    ctx.fill();

    // Blade edge highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(8, -48);
    ctx.lineTo(8, -8);
    ctx.stroke();

    // Handle wrap
    ctx.fillStyle = '#2a1515';
    ctx.fillRect(7, -5, 5, 14);
    // Handle wrap pattern
    ctx.strokeStyle = '#4a2525';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(7, -3 + i * 3);
        ctx.lineTo(12, -3 + i * 3);
        ctx.stroke();
    }

    ctx.restore();

    // Tsuba (guard)
    ctx.fillStyle = '#c0a040';
    ctx.beginPath();
    ctx.ellipse(15, -2, 5, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a08030';
    ctx.beginPath();
    ctx.ellipse(15, -2, 3, 2, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Shuriken on belt
    const shurikenGrad = ctx.createRadialGradient(-18, 4, 0, -18, 4, 6);
    shurikenGrad.addColorStop(0, '#808080');
    shurikenGrad.addColorStop(0.5, '#606060');
    shurikenGrad.addColorStop(1, '#404040');
    ctx.fillStyle = shurikenGrad;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i - Math.PI / 4;
        ctx.lineTo(-18 + Math.cos(angle) * 6, 4 + Math.sin(angle) * 6);
        ctx.lineTo(-18 + Math.cos(angle + Math.PI / 4) * 2, 4 + Math.sin(angle + Math.PI / 4) * 2);
    }
    ctx.closePath();
    ctx.fill();

    // Shuriken highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(-19, 3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Face mask with texture
    ctx.fillStyle = '#101010';
    ctx.beginPath();
    ctx.arc(0, -24, 11, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.fill();

    // Mask fabric lines
    ctx.strokeStyle = 'rgba(40,40,40,0.5)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, -24, 8 - i * 1.5, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
    }

    // Glowing eyes
    ctx.shadowColor = `rgb(${accentColor.r},${accentColor.g},${accentColor.b})`;
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgb(${accentColor.r},${accentColor.g},${accentColor.b})`;
    ctx.beginPath();
    ctx.ellipse(-5, -30, 3, 2, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, -30, 3, 2, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eye pupils/slits
    ctx.fillStyle = '#200000';
    ctx.beginPath();
    ctx.ellipse(-5, -30, 1.5, 1, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, -30, 1.5, 1, 0.1, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw action point indicators
 */
export function drawAPIndicator(ctx, x, y, current, max, size = 16) {
    const spacing = size + 3;
    const startX = x - ((max - 1) * spacing) / 2;

    for (let i = 0; i < max; i++) {
        const px = startX + i * spacing;
        const isActive = i < current;

        ctx.save();
        ctx.translate(px, y);

        if (isActive) {
            ctx.shadowColor = '#eab308';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#eab308';
        } else {
            ctx.fillStyle = 'rgba(80, 80, 80, 0.5)';
        }

        // Lightning bolt
        const s = size / 16;
        ctx.beginPath();
        ctx.moveTo(3 * s, -8 * s);
        ctx.lineTo(-1 * s, 0);
        ctx.lineTo(2 * s, 0);
        ctx.lineTo(-3 * s, 8 * s);
        ctx.lineTo(1 * s, 1 * s);
        ctx.lineTo(-2 * s, 1 * s);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}
