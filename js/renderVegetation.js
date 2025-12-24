// ===== VEGETATION RENDERING =====
// Tree, bush, fern, and flower drawing functions

import { getBushSprite, getTreeSprite } from './assetLoader.js';
import { seededRandom } from './renderUtils.js';
import { drawLSystemTree, getTreeTypes } from './lsystem.js';

// Configuration for L-System trees (can be toggled for performance)
// Enabled by default for more realistic tree rendering
let useLSystemTrees = true;

/**
 * Enable or disable L-System procedural trees
 * L-System trees are more realistic but more CPU-intensive
 */
export function setLSystemTreesEnabled(enabled) {
    useLSystemTrees = enabled;
}

/**
 * Check if L-System trees are enabled
 */
export function isLSystemTreesEnabled() {
    return useLSystemTrees;
}

// Canvas context - set by renderer.js
let ctx = null;

const DETAIL_SPRITE_SIZE = 128;
const TREE_BASE_RATIO = 0.84875;
const BUSH_BASE_RATIO = 0.64;
const TREE_REFERENCE_SIZE = DETAIL_SPRITE_SIZE * 0.35;
const BUSH_REFERENCE_SIZE = DETAIL_SPRITE_SIZE * 0.4;

function drawDetailSprite(sprite, x, y, size, baseRatio, baseOffset, referenceSize) {
    const scale = size / referenceSize;
    const spriteSize = DETAIL_SPRITE_SIZE * scale;
    const baseY = y + baseOffset;
    const drawX = x - spriteSize / 2;
    const drawY = baseY - spriteSize * baseRatio;

    ctx.drawImage(sprite, drawX, drawY, spriteSize, spriteSize);
}

/**
 * Initialize the vegetation renderer with canvas context
 * @param {CanvasRenderingContext2D} context - The canvas 2D context
 */
export function initVegetationRenderer(context) {
    ctx = context;
}

/**
 * Map tree type index to L-System tree type name
 */
const TREE_TYPE_MAP = ['pine', 'deciduous', 'birch', 'willow', 'deciduous'];

/**
 * Draw a realistic tree with 2.5D depth effect
 * Supports multiple tree types: pine, deciduous, birch, willow, oak
 * Can use L-System procedural generation for more realistic trees
 */
export function drawTree2D5(x, y, size, treeType, seed) {
    // Try pre-rendered sprite first
    const variant = Math.floor(seededRandom(seed + 17) * 3);
    const sprite = getTreeSprite(treeType, variant);
    if (sprite) {
        drawDetailSprite(sprite, x, y, size, TREE_BASE_RATIO, size * 0.55, TREE_REFERENCE_SIZE);
        return;
    }

    // Use L-System trees if enabled (more realistic but slower)
    if (useLSystemTrees && ctx) {
        const lsystemType = TREE_TYPE_MAP[treeType] || 'deciduous';
        drawLSystemTree(ctx, x, y + size * 0.45, size * 1.2, lsystemType, seed);
        return;
    }

    ctx.save();

    // Enhanced ground shadow with soft edges
    const shadowGradient = ctx.createRadialGradient(x + 3, y + size * 0.55, 0, x + 3, y + size * 0.55, size * 0.6);
    shadowGradient.addColorStop(0, 'rgba(0, 15, 5, 0.55)');
    shadowGradient.addColorStop(0.6, 'rgba(0, 20, 10, 0.3)');
    shadowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = shadowGradient;
    ctx.beginPath();
    ctx.ellipse(x + 3, y + size * 0.55, size * 0.6, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk with realistic bark texture
    const trunkWidth = size * 0.18;
    const trunkHeight = size * 0.55;

    // Trunk gradient for 3D effect
    const trunkGradient = ctx.createLinearGradient(x - trunkWidth, y, x + trunkWidth, y);
    trunkGradient.addColorStop(0, '#2a1a0f');
    trunkGradient.addColorStop(0.3, '#4a3520');
    trunkGradient.addColorStop(0.5, '#5a4030');
    trunkGradient.addColorStop(0.7, '#4a3520');
    trunkGradient.addColorStop(1, '#2a1a0f');
    ctx.fillStyle = trunkGradient;

    // Draw trunk as rounded rectangle
    ctx.beginPath();
    ctx.moveTo(x - trunkWidth * 0.4, y + trunkHeight);
    ctx.lineTo(x - trunkWidth * 0.55, y + trunkHeight * 0.1);
    ctx.quadraticCurveTo(x - trunkWidth * 0.5, y, x, y);
    ctx.quadraticCurveTo(x + trunkWidth * 0.5, y, x + trunkWidth * 0.55, y + trunkHeight * 0.1);
    ctx.lineTo(x + trunkWidth * 0.4, y + trunkHeight);
    ctx.closePath();
    ctx.fill();

    // Detailed bark texture
    ctx.strokeStyle = 'rgba(30, 15, 5, 0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
        const barkY = y + trunkHeight * (0.1 + i * 0.1) + seededRandom(seed + i * 10) * 5;
        const barkStartX = x - trunkWidth * 0.4 * (1 - i * 0.05);
        const barkEndX = x + trunkWidth * 0.35 * (1 - i * 0.03);
        ctx.beginPath();
        ctx.moveTo(barkStartX, barkY);
        ctx.quadraticCurveTo(x + seededRandom(seed + i * 11) * 4, barkY + 3, barkEndX, barkY + seededRandom(seed + i * 12) * 4);
        ctx.stroke();
    }

    // Bark highlights
    ctx.strokeStyle = 'rgba(100, 70, 40, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const hY = y + trunkHeight * (0.15 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(x - trunkWidth * 0.2, hY);
        ctx.lineTo(x - trunkWidth * 0.1, hY + 8);
        ctx.stroke();
    }

    if (treeType === 0) {
        // Realistic Pine tree with detailed needles
        const layers = 6;
        for (let i = layers - 1; i >= 0; i--) {
            const layerY = y - size * 0.08 - i * size * 0.16;
            const layerWidth = size * (0.6 - i * 0.07);

            // Shadow layer
            ctx.fillStyle = `rgb(${8 + i * 4}, ${30 + i * 6}, ${15 + i * 3})`;
            ctx.beginPath();
            ctx.moveTo(x, layerY - size * 0.22);
            ctx.lineTo(x - layerWidth * 1.05, layerY + size * 0.12);
            ctx.lineTo(x + layerWidth * 1.05, layerY + size * 0.12);
            ctx.closePath();
            ctx.fill();

            // Main foliage layer
            ctx.fillStyle = `rgb(${15 + i * 6}, ${45 + i * 10}, ${25 + i * 5})`;
            ctx.beginPath();
            ctx.moveTo(x, layerY - size * 0.25);
            ctx.lineTo(x - layerWidth, layerY + size * 0.1);
            ctx.lineTo(x + layerWidth, layerY + size * 0.1);
            ctx.closePath();
            ctx.fill();

            // Needle details
            ctx.strokeStyle = `rgba(${25 + i * 8}, ${55 + i * 12}, ${35 + i * 6}, 0.5)`;
            ctx.lineWidth = 1;
            for (let n = 0; n < 6; n++) {
                const nx = x + (seededRandom(seed + i * 100 + n) - 0.5) * layerWidth * 1.5;
                const ny = layerY + seededRandom(seed + i * 100 + n + 1) * size * 0.08;
                ctx.beginPath();
                ctx.moveTo(nx, ny);
                ctx.lineTo(nx + (seededRandom(seed + i * 100 + n + 2) - 0.5) * 6, ny - 4);
                ctx.stroke();
            }
        }

        // Snow on tips (subtle)
        if (seededRandom(seed + 500) > 0.7) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.beginPath();
            ctx.arc(x, y - size * 0.85, size * 0.08, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (treeType === 1) {
        // Realistic deciduous tree with leaf clusters
        const foliageBaseColors = [
            { r: 25, g: 75, b: 40 },
            { r: 30, g: 85, b: 45 },
            { r: 35, g: 95, b: 50 },
            { r: 40, g: 105, b: 55 }
        ];

        // Draw overlapping leaf clusters for depth
        for (let layer = 0; layer < 3; layer++) {
            const clusterCount = 5 + layer * 2;
            for (let i = 0; i < clusterCount; i++) {
                const fx = x + (seededRandom(seed + layer * 100 + i * 5) - 0.5) * size * (0.5 + layer * 0.1);
                const fy = y - size * (0.25 + layer * 0.08) + (seededRandom(seed + layer * 100 + i * 5 + 1) - 0.5) * size * 0.3;
                const fSize = size * (0.2 + seededRandom(seed + layer * 100 + i * 5 + 2) * 0.15 - layer * 0.02);

                const colorIdx = Math.floor(seededRandom(seed + layer * 100 + i * 5 + 3) * foliageBaseColors.length);
                const color = foliageBaseColors[colorIdx];
                const shade = 0.7 + layer * 0.15;

                // Soft gradient for each cluster
                const clusterGrad = ctx.createRadialGradient(fx - fSize * 0.3, fy - fSize * 0.3, 0, fx, fy, fSize);
                clusterGrad.addColorStop(0, `rgb(${Math.floor(color.r * shade * 1.2)}, ${Math.floor(color.g * shade * 1.2)}, ${Math.floor(color.b * shade * 1.2)})`);
                clusterGrad.addColorStop(0.7, `rgb(${Math.floor(color.r * shade)}, ${Math.floor(color.g * shade)}, ${Math.floor(color.b * shade)})`);
                clusterGrad.addColorStop(1, `rgb(${Math.floor(color.r * shade * 0.7)}, ${Math.floor(color.g * shade * 0.7)}, ${Math.floor(color.b * shade * 0.7)})`);

                ctx.fillStyle = clusterGrad;
                ctx.beginPath();
                ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
                ctx.fill();

                // Individual leaf hints
                ctx.fillStyle = `rgba(${color.r + 30}, ${color.g + 40}, ${color.b + 20}, 0.3)`;
                for (let l = 0; l < 4; l++) {
                    const lx = fx + (seededRandom(seed + i * 50 + l * 7) - 0.5) * fSize;
                    const ly = fy + (seededRandom(seed + i * 50 + l * 7 + 1) - 0.5) * fSize;
                    ctx.beginPath();
                    ctx.ellipse(lx, ly, fSize * 0.15, fSize * 0.1, seededRandom(seed + i * 50 + l * 7 + 2) * Math.PI, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    } else if (treeType === 2) {
        // Realistic Birch tree
        // White trunk with characteristic bark
        const birchTrunkGrad = ctx.createLinearGradient(x - trunkWidth, y, x + trunkWidth, y);
        birchTrunkGrad.addColorStop(0, '#c8c4bc');
        birchTrunkGrad.addColorStop(0.3, '#f0ece4');
        birchTrunkGrad.addColorStop(0.5, '#f8f6f0');
        birchTrunkGrad.addColorStop(0.7, '#f0ece4');
        birchTrunkGrad.addColorStop(1, '#c8c4bc');
        ctx.fillStyle = birchTrunkGrad;
        ctx.fillRect(x - trunkWidth / 2, y, trunkWidth, trunkHeight);

        // Characteristic horizontal dark markings
        for (let m = 0; m < 6; m++) {
            const markY = y + trunkHeight * (0.08 + m * 0.15);
            const markWidth = trunkWidth * (0.3 + seededRandom(seed + m * 3) * 0.5);
            const markHeight = 1.5 + seededRandom(seed + m * 3 + 1) * 2;

            ctx.fillStyle = `rgba(40, 35, 30, ${0.5 + seededRandom(seed + m * 3 + 2) * 0.3})`;
            ctx.beginPath();
            ctx.ellipse(x + (seededRandom(seed + m * 4) - 0.5) * trunkWidth * 0.3, markY, markWidth / 2, markHeight, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Delicate birch foliage with many small leaves
        const birchColors = [
            { r: 60, g: 120, b: 70 },
            { r: 70, g: 140, b: 80 },
            { r: 80, g: 155, b: 95 },
            { r: 100, g: 170, b: 110 }
        ];

        for (let layer = 0; layer < 3; layer++) {
            for (let i = 0; i < 8; i++) {
                const fx = x + (seededRandom(seed + layer * 50 + i * 7) - 0.5) * size * 0.6;
                const fy = y - size * 0.3 - layer * size * 0.1 + (seededRandom(seed + layer * 50 + i * 7 + 1) - 0.5) * size * 0.3;
                const fSize = size * (0.15 + seededRandom(seed + layer * 50 + i * 7 + 2) * 0.1);

                const color = birchColors[i % birchColors.length];
                ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
                ctx.beginPath();
                ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (treeType === 3) {
        // Realistic Willow with graceful drooping branches
        ctx.fillStyle = '#4a3520';
        ctx.beginPath();
        ctx.moveTo(x - trunkWidth * 0.5, y + trunkHeight);
        ctx.lineTo(x - trunkWidth * 0.6, y);
        ctx.quadraticCurveTo(x, y - trunkHeight * 0.1, x + trunkWidth * 0.6, y);
        ctx.lineTo(x + trunkWidth * 0.5, y + trunkHeight);
        ctx.closePath();
        ctx.fill();

        // Many drooping branches with leaves
        for (let b = 0; b < 12; b++) {
            const branchStartX = x + (seededRandom(seed + b * 5) - 0.5) * size * 0.8;
            const branchStartY = y - size * 0.15;
            const branchMidX = branchStartX + (seededRandom(seed + b * 5 + 1) - 0.5) * size * 0.3;
            const branchEndX = branchMidX + (seededRandom(seed + b * 5 + 2) - 0.5) * size * 0.2;
            const branchEndY = y + size * (0.3 + seededRandom(seed + b * 5 + 3) * 0.2);

            // Branch gradient for depth
            const branchColor = `rgb(${40 + seededRandom(seed + b) * 20}, ${80 + seededRandom(seed + b + 1) * 30}, ${50 + seededRandom(seed + b + 2) * 15})`;
            ctx.strokeStyle = branchColor;
            ctx.lineWidth = 2.5 - b * 0.1;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(branchStartX, branchStartY);
            ctx.bezierCurveTo(
                branchStartX + (branchMidX - branchStartX) * 0.3, branchStartY + size * 0.2,
                branchMidX, branchEndY - size * 0.15,
                branchEndX, branchEndY
            );
            ctx.stroke();

            // Leaves along branch
            ctx.fillStyle = `rgba(${50 + seededRandom(seed + b * 10) * 20}, ${100 + seededRandom(seed + b * 10 + 1) * 30}, ${60 + seededRandom(seed + b * 10 + 2) * 15}, 0.8)`;
            for (let l = 0; l < 8; l++) {
                const t = 0.15 + l * 0.1;
                const tt = t * t;
                const lx = branchStartX + (branchEndX - branchStartX) * t + (branchMidX - branchStartX) * t * (1 - t) * 2;
                const ly = branchStartY + (branchEndY - branchStartY) * tt;
                ctx.beginPath();
                ctx.ellipse(lx, ly, size * 0.04, size * 0.015, Math.PI / 3 + seededRandom(seed + b * 10 + l) * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else {
        // Realistic Oak tree with massive canopy
        // Draw large overlapping foliage masses
        const oakColors = [
            { r: 20, g: 60, b: 35 },
            { r: 25, g: 75, b: 40 },
            { r: 30, g: 85, b: 45 },
            { r: 35, g: 95, b: 50 }
        ];

        // Background mass
        ctx.fillStyle = `rgb(${oakColors[0].r}, ${oakColors[0].g}, ${oakColors[0].b})`;
        ctx.beginPath();
        ctx.ellipse(x, y - size * 0.2, size * 0.65, size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Overlapping foliage clusters
        for (let layer = 0; layer < 4; layer++) {
            for (let i = 0; i < 5 - layer; i++) {
                const fx = x + (seededRandom(seed + layer * 30 + i * 6) - 0.5) * size * (0.7 - layer * 0.1);
                const fy = y - size * (0.2 + layer * 0.12) + (seededRandom(seed + layer * 30 + i * 6 + 1) - 0.5) * size * 0.25;
                const fSize = size * (0.35 - layer * 0.05 + seededRandom(seed + layer * 30 + i * 6 + 2) * 0.1);

                const color = oakColors[Math.min(layer, oakColors.length - 1)];
                const oakGrad = ctx.createRadialGradient(fx - fSize * 0.3, fy - fSize * 0.3, 0, fx, fy, fSize);
                oakGrad.addColorStop(0, `rgb(${color.r + 20}, ${color.g + 30}, ${color.b + 15})`);
                oakGrad.addColorStop(0.7, `rgb(${color.r}, ${color.g}, ${color.b})`);
                oakGrad.addColorStop(1, `rgb(${color.r - 10}, ${color.g - 15}, ${color.b - 8})`);

                ctx.fillStyle = oakGrad;
                ctx.beginPath();
                ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Light highlights on foliage (sunlight effect)
    ctx.fillStyle = 'rgba(180, 220, 140, 0.15)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.2, y - size * 0.45, size * 0.2, size * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(200, 240, 160, 0.1)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.15, y - size * 0.55, size * 0.12, size * 0.08, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/**
 * Draw a realistic bush with 2.5D depth effect
 */
export function drawBush2D5(x, y, size, seed) {
    const variant = Math.floor(seededRandom(seed + 9) * 4);
    const sprite = getBushSprite(variant);
    if (sprite) {
        drawDetailSprite(sprite, x, y, size, BUSH_BASE_RATIO, size * 0.35, BUSH_REFERENCE_SIZE);
        return;
    }

    ctx.save();

    // Enhanced shadow with soft edges
    const shadowGrad = ctx.createRadialGradient(x + 2, y + size * 0.35, 0, x + 2, y + size * 0.35, size * 0.7);
    shadowGrad.addColorStop(0, 'rgba(0, 20, 8, 0.45)');
    shadowGrad.addColorStop(0.6, 'rgba(0, 25, 10, 0.25)');
    shadowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(x + 2, y + size * 0.35, size * 0.7, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bush colors with natural variation
    const bushColors = [
        { r: 25, g: 60, b: 30 },
        { r: 30, g: 70, b: 35 },
        { r: 35, g: 80, b: 40 },
        { r: 40, g: 90, b: 45 },
        { r: 50, g: 100, b: 55 }
    ];

    // Draw base mass first (darker, larger)
    const baseGrad = ctx.createRadialGradient(x, y + size * 0.1, 0, x, y + size * 0.1, size * 0.6);
    baseGrad.addColorStop(0, `rgb(${bushColors[1].r}, ${bushColors[1].g}, ${bushColors[1].b})`);
    baseGrad.addColorStop(1, `rgb(${bushColors[0].r}, ${bushColors[0].g}, ${bushColors[0].b})`);
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.1, size * 0.55, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Multiple overlapping leaf clusters for realistic appearance
    for (let layer = 0; layer < 4; layer++) {
        const clusterCount = 5 + layer;
        for (let i = 0; i < clusterCount; i++) {
            const angle = (i / clusterCount) * Math.PI * 2 + seededRandom(seed + layer * 100 + i) * 0.8;
            const dist = size * (0.15 + layer * 0.1) * (0.6 + seededRandom(seed + layer * 100 + i + 1) * 0.4);
            const cx = x + Math.cos(angle) * dist;
            const cy = y - layer * size * 0.08 + Math.sin(angle) * dist * 0.6;
            const clusterSize = size * (0.2 + seededRandom(seed + layer * 100 + i + 2) * 0.15 - layer * 0.02);

            const colorIdx = Math.min(layer + 1, bushColors.length - 1);
            const color = bushColors[colorIdx];

            // Gradient for each cluster
            const clusterGrad = ctx.createRadialGradient(cx - clusterSize * 0.3, cy - clusterSize * 0.3, 0, cx, cy, clusterSize);
            clusterGrad.addColorStop(0, `rgb(${color.r + 15}, ${color.g + 20}, ${color.b + 10})`);
            clusterGrad.addColorStop(0.6, `rgb(${color.r}, ${color.g}, ${color.b})`);
            clusterGrad.addColorStop(1, `rgb(${color.r - 10}, ${color.g - 15}, ${color.b - 8})`);

            ctx.fillStyle = clusterGrad;
            ctx.beginPath();
            ctx.ellipse(cx, cy, clusterSize, clusterSize * 0.75, seededRandom(seed + layer * 100 + i + 3) * Math.PI * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Add small leaf details on the surface
    ctx.fillStyle = 'rgba(60, 110, 55, 0.4)';
    for (let i = 0; i < 12; i++) {
        const lAngle = seededRandom(seed + i * 20) * Math.PI * 2;
        const lDist = size * (0.1 + seededRandom(seed + i * 20 + 1) * 0.35);
        const lx = x + Math.cos(lAngle) * lDist;
        const ly = y - size * 0.1 + Math.sin(lAngle) * lDist * 0.5;
        const lSize = size * 0.06 + seededRandom(seed + i * 20 + 2) * size * 0.04;

        ctx.beginPath();
        ctx.ellipse(lx, ly, lSize, lSize * 0.5, lAngle, 0, Math.PI * 2);
        ctx.fill();
    }

    // Light highlight (sunlight)
    const highlightGrad = ctx.createRadialGradient(x - size * 0.2, y - size * 0.15, 0, x - size * 0.2, y - size * 0.15, size * 0.3);
    highlightGrad.addColorStop(0, 'rgba(140, 200, 100, 0.25)');
    highlightGrad.addColorStop(0.5, 'rgba(120, 180, 90, 0.12)');
    highlightGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = highlightGrad;
    ctx.beginPath();
    ctx.ellipse(x - size * 0.15, y - size * 0.12, size * 0.35, size * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Occasional berries or flowers
    if (seededRandom(seed + 200) > 0.5) {
        const berryColor = seededRandom(seed + 201) > 0.5 ? '#a83232' : '#c85090';
        ctx.fillStyle = berryColor;
        for (let b = 0; b < 4; b++) {
            const bAngle = seededRandom(seed + b * 30 + 300) * Math.PI * 2;
            const bDist = size * (0.15 + seededRandom(seed + b * 30 + 301) * 0.25);
            const bx = x + Math.cos(bAngle) * bDist;
            const by = y - size * 0.05 + Math.sin(bAngle) * bDist * 0.5;

            ctx.beginPath();
            ctx.arc(bx, by, size * 0.03, 0, Math.PI * 2);
            ctx.fill();

            // Berry highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(bx - size * 0.01, by - size * 0.01, size * 0.012, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = berryColor;
        }
    }

    ctx.restore();
}

/**
 * Draw a small shrub/undergrowth - lower vegetation for forest floors
 */
export function drawSmallShrub(x, y, size, seed) {
    ctx.save();

    // Small shadow
    ctx.fillStyle = 'rgba(0, 30, 10, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.15, size * 0.4, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Multiple small leaf clusters
    const colors = ['#2a5a35', '#345f3a', '#3d6b42', '#467348'];
    const clusterCount = 3 + Math.floor(seededRandom(seed) * 3);

    for (let i = 0; i < clusterCount; i++) {
        const cx = x + (seededRandom(seed + i * 5) - 0.5) * size * 0.6;
        const cy = y + (seededRandom(seed + i * 5 + 1) - 0.5) * size * 0.4;
        const cSize = size * (0.2 + seededRandom(seed + i * 5 + 2) * 0.15);

        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.ellipse(cx, cy, cSize, cSize * 0.7, seededRandom(seed + i * 5 + 3) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Small berries or flowers occasionally
    if (seededRandom(seed + 50) > 0.6) {
        const berryColor = seededRandom(seed + 51) > 0.5 ? '#8b3a3a' : '#a04080';
        ctx.fillStyle = berryColor;
        for (let b = 0; b < 3; b++) {
            const bx = x + (seededRandom(seed + b * 7 + 60) - 0.5) * size * 0.5;
            const by = y + (seededRandom(seed + b * 7 + 61) - 0.5) * size * 0.3;
            ctx.beginPath();
            ctx.arc(bx, by, size * 0.04, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

/**
 * Draw a decorative bush (simpler version)
 */
export function drawBush(x, y, size, seed) {
    // Shadow
    ctx.fillStyle = 'rgba(0, 30, 10, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.4, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bush layers
    const layers = 3;
    for (let i = layers - 1; i >= 0; i--) {
        const layerSize = size * (0.6 + i * 0.2);
        const yOff = -i * size * 0.12;
        const shade = 0.6 + i * 0.15;
        ctx.fillStyle = `rgb(${Math.floor(35 * shade)}, ${Math.floor(75 * shade)}, ${Math.floor(40 * shade)})`;
        ctx.beginPath();
        ctx.ellipse(x, y + yOff, layerSize, layerSize * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Highlight
    ctx.fillStyle = 'rgba(100, 160, 80, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.15, y - size * 0.2, size * 0.25, size * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw a small fern
 */
export function drawFern(x, y, size, seed) {
    ctx.strokeStyle = '#2d5a35';
    ctx.lineWidth = 1;

    const fronds = 5;
    for (let i = 0; i < fronds; i++) {
        const angle = -Math.PI / 2 + (i - fronds / 2) * 0.3;
        const length = size * (0.8 + seededRandom(seed + i) * 0.4);

        ctx.beginPath();
        ctx.moveTo(x, y);
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Leaflets
        for (let j = 1; j < 4; j++) {
            const t = j / 4;
            const lx = x + (endX - x) * t;
            const ly = y + (endY - y) * t;
            const leafSize = size * 0.15 * (1 - t * 0.5);

            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + leafSize, ly - leafSize * 0.5);
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - leafSize, ly - leafSize * 0.5);
            ctx.stroke();
        }
    }
}

/**
 * Draw a tree with type variation (simpler version)
 */
export function drawTree(x, y, size, treeType, seed) {
    // Shadow
    ctx.fillStyle = 'rgba(0, 20, 10, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.5, size * 0.4, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#3d2817';
    const trunkWidth = size * 0.12;
    ctx.fillRect(x - trunkWidth / 2, y, trunkWidth, size * 0.45);

    // Trunk detail
    ctx.strokeStyle = '#2a1a0f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - trunkWidth * 0.3, y + size * 0.1);
    ctx.lineTo(x - trunkWidth * 0.2, y + size * 0.35);
    ctx.stroke();

    if (treeType === 0) {
        // Pine tree
        const layers = 4;
        for (let i = layers - 1; i >= 0; i--) {
            const layerY = y - size * 0.1 - i * size * 0.18;
            const layerWidth = size * (0.5 - i * 0.08);

            ctx.fillStyle = `rgb(${15 + i * 8}, ${50 + i * 12}, ${25 + i * 6})`;
            ctx.beginPath();
            ctx.moveTo(x, layerY - size * 0.25);
            ctx.lineTo(x - layerWidth, layerY + size * 0.1);
            ctx.lineTo(x + layerWidth, layerY + size * 0.1);
            ctx.closePath();
            ctx.fill();
        }
    } else if (treeType === 1) {
        // Round tree
        const foliageColors = ['#1a4d2e', '#165a32', '#1e6b3a'];
        for (let i = 0; i < 3; i++) {
            const fx = x + (seededRandom(seed + i * 5) - 0.5) * size * 0.3;
            const fy = y - size * 0.25 + (seededRandom(seed + i * 5 + 1) - 0.5) * size * 0.2;
            const fSize = size * (0.35 + seededRandom(seed + i * 5 + 2) * 0.15);

            ctx.fillStyle = foliageColors[i % foliageColors.length];
            ctx.beginPath();
            ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        // Oak-style tree
        ctx.fillStyle = '#1a4d2e';
        ctx.beginPath();
        ctx.ellipse(x, y - size * 0.2, size * 0.45, size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#165a32';
        ctx.beginPath();
        ctx.ellipse(x - size * 0.15, y - size * 0.3, size * 0.3, size * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e6b3a';
        ctx.beginPath();
        ctx.ellipse(x + size * 0.1, y - size * 0.35, size * 0.25, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Highlight
    ctx.fillStyle = 'rgba(150, 200, 120, 0.15)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.15, y - size * 0.35, size * 0.15, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw flower cluster
 */
export function drawFlowerCluster(cx, cy, s, seed) {
    const flowerColors = ['#ff6b9d', '#ffeb3b', '#ffffff', '#ff9f43', '#a29bfe', '#fd79a8'];
    const flowerCount = 4 + (seed % 4);

    for (let i = 0; i < flowerCount; i++) {
        const fx = cx + (seededRandom(seed + i * 11) - 0.5) * s * 1.3;
        const fy = cy + (seededRandom(seed + i * 11 + 1) - 0.5) * s * 1.1;
        const fSize = 2 + seededRandom(seed + i * 11 + 2) * 2;
        const colorIdx = Math.floor(seededRandom(seed + i * 11 + 3) * flowerColors.length);

        // Stem
        ctx.strokeStyle = '#3d6b3d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, fy + fSize);
        ctx.lineTo(fx, fy + fSize + 4);
        ctx.stroke();

        // Petals
        ctx.fillStyle = flowerColors[colorIdx];
        const petalCount = 5;
        for (let p = 0; p < petalCount; p++) {
            const angle = (p / petalCount) * Math.PI * 2;
            ctx.beginPath();
            ctx.ellipse(
                fx + Math.cos(angle) * fSize * 0.5,
                fy + Math.sin(angle) * fSize * 0.5,
                fSize * 0.4, fSize * 0.25,
                angle, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // Center
        ctx.fillStyle = '#ffd32a';
        ctx.beginPath();
        ctx.arc(fx, fy, fSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw tall grass patch
 */
export function drawTallGrass(cx, cy, s, seed) {
    const bladeCount = 8 + (seed % 5);
    for (let i = 0; i < bladeCount; i++) {
        const bx = cx + (seededRandom(seed + i * 9) - 0.5) * s * 1.2;
        const by = cy + (seededRandom(seed + i * 9 + 1) - 0.5) * s * 0.8;
        const height = s * (0.35 + seededRandom(seed + i * 9 + 2) * 0.25);
        const lean = (seededRandom(seed + i * 9 + 3) - 0.5) * s * 0.25;

        const shade = 0.6 + seededRandom(seed + i * 9 + 4) * 0.4;
        ctx.strokeStyle = `rgba(${Math.floor(50 * shade)}, ${Math.floor(110 * shade)}, ${Math.floor(55 * shade)}, 0.9)`;
        ctx.lineWidth = 1.5 + seededRandom(seed + i * 9 + 5) * 1;
        ctx.beginPath();
        ctx.moveTo(bx, by + s * 0.1);
        ctx.bezierCurveTo(
            bx + lean * 0.3, by - height * 0.3,
            bx + lean * 0.7, by - height * 0.7,
            bx + lean, by - height
        );
        ctx.stroke();
    }
}

/**
 * Draw forest undergrowth
 */
export function drawUndergrowth(cx, cy, s, seed) {
    // Dark undergrowth patches
    for (let i = 0; i < 3; i++) {
        const ux = cx + (seededRandom(seed + i * 17) - 0.5) * s * 1.5;
        const uy = cy + (seededRandom(seed + i * 17 + 1) - 0.5) * s * 1.2;
        ctx.fillStyle = `rgba(20, 40, 25, ${0.2 + seededRandom(seed + i * 17 + 2) * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(ux, uy, s * 0.4, s * 0.25, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Small ferns
    for (let i = 0; i < 2; i++) {
        const fx = cx + (seededRandom(seed + i * 19 + 50) - 0.5) * s * 1.2;
        const fy = cy + (seededRandom(seed + i * 19 + 51) - 0.5) * s;
        drawFern(fx, fy, s * 0.3, seed + i * 100);
    }
}

/**
 * Draw stones with moss
 */
export function drawStones(cx, cy, s, seed) {
    const stoneCount = 2 + (seed % 3);
    for (let i = 0; i < stoneCount; i++) {
        const sx = cx + (seededRandom(seed + i * 13) - 0.5) * s * 0.8;
        const sy = cy + (seededRandom(seed + i * 13 + 1) - 0.5) * s * 0.6;
        const sSize = s * (0.15 + seededRandom(seed + i * 13 + 2) * 0.15);

        // Stone shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(sx + 2, sy + 2, sSize, sSize * 0.6, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Stone
        const grayVal = 90 + seededRandom(seed + i * 13 + 3) * 40;
        ctx.fillStyle = `rgb(${grayVal}, ${grayVal - 5}, ${grayVal + 10})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sSize, sSize * 0.6, seededRandom(seed + i) * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Moss on stone
        if (seededRandom(seed + i * 13 + 4) > 0.4) {
            ctx.fillStyle = 'rgba(60, 100, 50, 0.6)';
            ctx.beginPath();
            ctx.ellipse(sx - sSize * 0.3, sy - sSize * 0.2, sSize * 0.3, sSize * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
