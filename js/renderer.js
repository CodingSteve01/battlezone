// ===== CANVAS RENDERING =====

import { CONFIG, TERRAIN, UNIT_CLASSES } from './config.js';
import { state, getHex, getCurrentUnit, getVisibleGhosts, getQueuedPath } from './state.js';
import { hexToPixel } from './hexMath.js';
import { getReachableHexes } from './pathfinding.js';
import { getAttackableUnits, getEffectiveRange } from './units.js';
import { getFogLevel, isUnitVisible } from './fogOfWar.js';
import { initTextures, getTexture, drawHumanSprite, drawAPIndicator } from './assets.js';
import { getPowerupAt, POWERUP_TYPES } from './powerups.js';
import { getCurrentEvent } from './events.js';
import { getRankName } from './progression.js';

let canvas, ctx;
let texturesInitialized = false;

/**
 * Initialize renderer
 */
export function initRenderer() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // Initialize textures once
    if (!texturesInitialized) {
        initTextures();
        texturesInitialized = true;
    }

    resizeCanvas();
}

/**
 * Calculate appropriate hex size for screen
 */
function calculateHexSize() {
    const container = canvas.parentElement;
    if (!container) return CONFIG.BASE_HEX_SIZE;

    const rect = container.getBoundingClientRect();
    const radius = CONFIG.MAP_SIZES[state.settings.size] || 8;

    // Calculate grid dimensions
    const gridWidth = (2 * radius + 1) * 1.8;
    const gridHeight = (2 * radius + 1) * 1.6;

    const padding = 40;
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;

    // Calculate hex size to fit
    let hexSize = Math.min(availableWidth / gridWidth, availableHeight / gridHeight);

    // Clamp to reasonable range - larger minimum for better visuals
    const baseSize = Math.max(30, Math.min(65, hexSize));

    // Apply zoom level
    return baseSize * state.zoomLevel;
}

/**
 * Resize canvas to container
 */
export function resizeCanvas() {
    const container = canvas?.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        setTimeout(resizeCanvas, 50);
        return;
    }

    // Store canvas dimensions
    state.canvasWidth = rect.width;
    state.canvasHeight = rect.height;

    // Set canvas resolution
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Update hex size and center offset
    state.hexSize = calculateHexSize();
    state.offsetX = rect.width / 2 + state.cameraX;
    state.offsetY = rect.height / 2 + state.cameraY;

    render();
}

/**
 * Draw a hexagon with optional texture and 3D effect
 */
/**
 * Draw just the hex path (for stroking)
 */
function drawHexPath(cx, cy, size) {
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function drawHex(cx, cy, size, fillColor, strokeColor = null, lineWidth = 1, texture = null, terrain = null) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Fill with gradient for 3D effect
    if (terrain && terrain.colorLight && terrain.colorDark) {
        const gradient = ctx.createLinearGradient(cx - size * 0.7, cy - size * 0.7, cx + size * 0.7, cy + size * 0.7);
        gradient.addColorStop(0, terrain.colorLight);
        gradient.addColorStop(0.5, terrain.color);
        gradient.addColorStop(1, terrain.colorDark);
        ctx.fillStyle = gradient;
        ctx.fill();
    } else if (texture) {
        ctx.save();
        ctx.clip();
        const pattern = ctx.createPattern(texture, 'repeat');
        // Anchor pattern to world coordinates so it doesn't slide when scrolling
        pattern.setTransform(new DOMMatrix().translate(state.offsetX, state.offsetY));
        ctx.fillStyle = pattern;
        ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
        ctx.restore();

        // Draw hex shape again for stroke
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = cx + size * Math.cos(angle);
            const py = cy + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    } else {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }

    // Inner highlight for depth - hexagon shape
    if (terrain) {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = cx + size * 0.85 * Math.cos(angle);
            const py = cy + size * 0.85 * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

/**
 * Seeded random number generator for consistent decorations
 */
function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

/**
 * Draw enhanced terrain pattern on a hex - optimized for performance
 */
function drawTerrainDetails(cx, cy, size, type, hexQ = 0, hexR = 0) {
    const s = size * 0.45;
    ctx.save();

    // Create consistent seed for this hex
    const baseSeed = hexQ * 127 + hexR * 311 + hexQ * hexR * 7;

    switch (type) {
        case 'grass':
            // Simplified grass - just a few blades and occasional decoration
            drawGrassBlades(cx, cy, s, baseSeed);

            // Only 30% of grass hexes get extra decoration
            const grassType = Math.abs(baseSeed) % 100;
            if (grassType < 15) {
                drawBush(cx, cy, s * 0.4, baseSeed);
            } else if (grassType < 30) {
                drawFlowerCluster(cx, cy, s, baseSeed);
            }
            break;

        case 'forest':
            // Simplified forest - fewer trees
            const treeCount = 1 + Math.abs(baseSeed % 2);
            for (let i = 0; i < treeCount; i++) {
                const tx = cx + (seededRandom(baseSeed + i * 10) - 0.5) * s * 0.8;
                const ty = cy + (seededRandom(baseSeed + i * 10 + 5) - 0.5) * s * 0.6;
                const treeSize = s * (0.7 + seededRandom(baseSeed + i * 10 + 2) * 0.4);
                drawTree(tx, ty, treeSize, 0, baseSeed + i);
            }
            break;

        case 'rock':
            drawRockFormation(cx, cy, s, baseSeed);
            break;

        case 'water':
            drawWaterDetails(cx, cy, s, baseSeed);
            break;

        case 'sand':
            drawSandDetails(cx, cy, s, baseSeed);
            break;

        case 'swamp':
            drawSwampDetails(cx, cy, s, baseSeed);
            break;

        case 'hills':
            drawHillsDetails(cx, cy, s, baseSeed);
            break;
    }

    ctx.restore();
}

/**
 * Draw hills terrain details
 */
function drawHillsDetails(cx, cy, s, seed) {
    // Draw rolling hill contours
    ctx.strokeStyle = 'rgba(80, 100, 70, 0.4)';
    ctx.lineWidth = 2;

    // Multiple contour lines to show elevation
    for (let i = 0; i < 3; i++) {
        const yOffset = (i - 1) * s * 0.35;
        const xWobble = (seededRandom(seed + i * 17) - 0.5) * s * 0.3;

        ctx.beginPath();
        ctx.moveTo(cx - s * 0.8, cy + yOffset + s * 0.1);
        ctx.bezierCurveTo(
            cx - s * 0.3 + xWobble, cy + yOffset - s * 0.15,
            cx + s * 0.3 - xWobble, cy + yOffset - s * 0.1,
            cx + s * 0.8, cy + yOffset + s * 0.05
        );
        ctx.stroke();
    }

    // Add some rocks on the hills
    const rockCount = 1 + (seed % 2);
    for (let i = 0; i < rockCount; i++) {
        const rx = cx + (seededRandom(seed + i * 23) - 0.5) * s * 1.2;
        const ry = cy + (seededRandom(seed + i * 23 + 1) - 0.5) * s * 0.8;
        const rSize = s * (0.12 + seededRandom(seed + i * 23 + 2) * 0.1);

        // Rock shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(rx + 1, ry + 1, rSize, rSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rock
        const grayVal = 100 + seededRandom(seed + i * 23 + 3) * 30;
        ctx.fillStyle = `rgb(${grayVal}, ${grayVal - 5}, ${grayVal - 10})`;
        ctx.beginPath();
        ctx.ellipse(rx, ry, rSize, rSize * 0.6, seededRandom(seed + i) * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Sparse grass on hills
    for (let i = 0; i < 3; i++) {
        const gx = cx + (seededRandom(seed + i * 31) - 0.5) * s * 1.4;
        const gy = cy + (seededRandom(seed + i * 31 + 1) - 0.5) * s * 1.1;
        const height = s * (0.12 + seededRandom(seed + i * 31 + 2) * 0.08);

        ctx.strokeStyle = 'rgba(70, 100, 60, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + (seededRandom(seed + i * 31 + 3) - 0.5) * s * 0.08, gy - height);
        ctx.stroke();
    }

    // Height indicator icon (small mountain symbol)
    ctx.fillStyle = 'rgba(90, 110, 80, 0.5)';
    ctx.font = `${Math.round(s * 0.35)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛰', cx, cy);
}

/**
 * Draw full grass texture coverage - creates the base meadow look
 */
function drawGrassTexture(cx, cy, size, seed) {
    const radius = size * 0.8;

    // Multiple overlapping grass patches for natural coverage
    for (let ring = 0; ring < 3; ring++) {
        const ringRadius = radius * (0.3 + ring * 0.3);
        const patchCount = 4 + ring * 2;

        for (let i = 0; i < patchCount; i++) {
            const angle = (i / patchCount) * Math.PI * 2 + seededRandom(seed + ring * 100 + i) * 0.5;
            const dist = ringRadius * (0.5 + seededRandom(seed + ring * 100 + i + 50) * 0.5);
            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;

            // Grass patch - organic shape
            const patchSize = size * (0.15 + seededRandom(seed + ring * 100 + i + 10) * 0.12);
            const shade = 0.7 + seededRandom(seed + ring * 100 + i + 20) * 0.3;

            ctx.fillStyle = `rgba(${Math.floor(55 * shade)}, ${Math.floor(115 * shade)}, ${Math.floor(60 * shade)}, 0.4)`;
            ctx.beginPath();
            ctx.ellipse(px, py, patchSize, patchSize * 0.7,
                seededRandom(seed + ring * 100 + i + 30) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Central grass tufts
    for (let i = 0; i < 5; i++) {
        const tx = cx + (seededRandom(seed + i * 23) - 0.5) * radius * 0.6;
        const ty = cy + (seededRandom(seed + i * 23 + 1) - 0.5) * radius * 0.5;
        const shade = 0.8 + seededRandom(seed + i * 23 + 2) * 0.2;

        ctx.fillStyle = `rgba(${Math.floor(60 * shade)}, ${Math.floor(120 * shade)}, ${Math.floor(65 * shade)}, 0.35)`;
        ctx.beginPath();
        ctx.ellipse(tx, ty, size * 0.1, size * 0.06, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw wild meadow with mixed vegetation
 */
function drawWildMeadow(cx, cy, s, seed) {
    // Scattered wild grass clumps
    const clumpCount = 4 + (seed % 3);
    for (let i = 0; i < clumpCount; i++) {
        const clumpX = cx + (seededRandom(seed + i * 31) - 0.5) * s * 1.4;
        const clumpY = cy + (seededRandom(seed + i * 31 + 1) - 0.5) * s * 1.1;

        // Draw 3-5 grass blades per clump
        const bladeCount = 3 + (Math.floor(seededRandom(seed + i * 31 + 2) * 3));
        for (let j = 0; j < bladeCount; j++) {
            const bx = clumpX + (seededRandom(seed + i * 31 + j * 5) - 0.5) * s * 0.15;
            const by = clumpY;
            const height = s * (0.2 + seededRandom(seed + i * 31 + j * 5 + 1) * 0.2);
            const lean = (seededRandom(seed + i * 31 + j * 5 + 2) - 0.5) * s * 0.12;

            const shade = 0.7 + seededRandom(seed + i * 31 + j * 5 + 3) * 0.3;
            ctx.strokeStyle = `rgba(${Math.floor(50 * shade)}, ${Math.floor(105 * shade)}, ${Math.floor(55 * shade)}, 0.85)`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + lean * 0.5, by - height * 0.6, bx + lean, by - height);
            ctx.stroke();
        }
    }

    // Occasional small wildflowers
    if (seededRandom(seed + 500) > 0.4) {
        const flowerCount = 2 + Math.floor(seededRandom(seed + 501) * 3);
        const flowerColors = ['#ffeb99', '#ffd4e5', '#d4f0ff', '#e5d4ff'];
        for (let i = 0; i < flowerCount; i++) {
            const fx = cx + (seededRandom(seed + 600 + i) - 0.5) * s * 1.2;
            const fy = cy + (seededRandom(seed + 601 + i) - 0.5) * s;
            const fSize = 2 + seededRandom(seed + 602 + i) * 1.5;

            ctx.fillStyle = flowerColors[Math.floor(seededRandom(seed + 603 + i) * flowerColors.length)];
            ctx.beginPath();
            ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/**
 * Draw grass blades for texture - optimized
 */
function drawGrassBlades(cx, cy, s, seed) {
    const bladeCount = 5 + (seed % 3);  // Reduced for performance
    for (let i = 0; i < bladeCount; i++) {
        const bx = cx + (seededRandom(seed + i * 7) - 0.5) * s * 1.4;
        const by = cy + (seededRandom(seed + i * 7 + 3) - 0.5) * s * 1.2;
        const height = s * (0.15 + seededRandom(seed + i * 7 + 1) * 0.2);
        const lean = (seededRandom(seed + i * 7 + 2) - 0.5) * s * 0.15;

        const shade = 0.7 + seededRandom(seed + i * 7 + 4) * 0.3;
        ctx.strokeStyle = `rgba(${Math.floor(45 * shade)}, ${Math.floor(95 * shade)}, ${Math.floor(50 * shade)}, 0.8)`;
        ctx.lineWidth = 1 + seededRandom(seed + i * 7 + 5) * 0.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + lean * 0.5, by - height * 0.6, bx + lean, by - height);
        ctx.stroke();
    }
}

/**
 * Draw a decorative bush
 */
function drawBush(x, y, size, seed) {
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
 * Draw flower cluster
 */
function drawFlowerCluster(cx, cy, s, seed) {
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
 * Draw stones with moss
 */
function drawStones(cx, cy, s, seed) {
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

/**
 * Draw tall grass patch
 */
function drawTallGrass(cx, cy, s, seed) {
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
function drawUndergrowth(cx, cy, s, seed) {
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
 * Draw a small fern
 */
function drawFern(x, y, size, seed) {
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
 * Draw forest floor details
 */
function drawForestFloor(cx, cy, s, seed) {
    // Fallen leaves
    const leafColors = ['#5a4030', '#4a3525', '#6a5040', '#3d2a1a'];
    for (let i = 0; i < 6; i++) {
        const lx = cx + (seededRandom(seed + i * 23) - 0.5) * s * 1.8;
        const ly = cy + (seededRandom(seed + i * 23 + 1) - 0.5) * s * 1.5;
        const colorIdx = Math.floor(seededRandom(seed + i * 23 + 2) * leafColors.length);

        ctx.fillStyle = leafColors[colorIdx];
        ctx.beginPath();
        ctx.ellipse(lx, ly, 3 + seededRandom(seed + i) * 2, 2 + seededRandom(seed + i + 1) * 1.5,
            seededRandom(seed + i * 23 + 3) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Mushroom (rare)
    if (seededRandom(seed + 999) > 0.7) {
        const mx = cx + (seededRandom(seed + 1000) - 0.5) * s * 0.8;
        const my = cy + (seededRandom(seed + 1001) - 0.5) * s * 0.6;

        // Stem
        ctx.fillStyle = '#e8e0d5';
        ctx.fillRect(mx - 2, my, 4, 6);

        // Cap
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.ellipse(mx, my, 5, 3, 0, Math.PI, 2 * Math.PI);
        ctx.fill();

        // White spots
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(mx - 2, my - 1, 1, 0, Math.PI * 2);
        ctx.arc(mx + 1, my - 2, 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw a tree with type variation
 */
function drawTree(x, y, size, treeType, seed) {
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
 * Draw rock formation with detail
 */
function drawRockFormation(cx, cy, s, seed) {
    // Main rock shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy + s * 0.15, s * 0.85, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main rock
    ctx.fillStyle = '#6a6a7a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.05, s * 0.85, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Secondary rocks
    ctx.fillStyle = '#7a7a8a';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.25, cy - s * 0.15, s * 0.45, s * 0.3, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#858595';
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.3, cy - s * 0.05, s * 0.35, s * 0.25, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Cracks
    ctx.strokeStyle = 'rgba(40, 40, 50, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy);
    ctx.lineTo(cx - s * 0.1, cy + s * 0.15);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.1);
    ctx.stroke();

    // Highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.35, cy - s * 0.2, s * 0.15, s * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Moss patches
    if (seededRandom(seed) > 0.5) {
        ctx.fillStyle = 'rgba(60, 100, 50, 0.5)';
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.2, cy - s * 0.25, s * 0.15, s * 0.1, 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw water details
 */
function drawWaterDetails(cx, cy, s, seed) {
    // Wave patterns
    ctx.strokeStyle = 'rgba(150, 210, 255, 0.4)';
    ctx.lineWidth = 2;

    for (let i = 0; i < 4; i++) {
        const yOff = (i - 1.5) * s * 0.3;
        const phase = seededRandom(seed + i) * Math.PI * 2;

        ctx.beginPath();
        ctx.moveTo(cx - s * 0.8, cy + yOff);
        for (let x = -0.8; x <= 0.8; x += 0.2) {
            const waveY = cy + yOff + Math.sin(x * 3 + phase) * s * 0.08;
            ctx.lineTo(cx + x * s, waveY);
        }
        ctx.stroke();
    }

    // Light reflections/sparkles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 5; i++) {
        const rx = cx + (seededRandom(seed + i * 31) - 0.5) * s * 1.4;
        const ry = cy + (seededRandom(seed + i * 31 + 1) - 0.5) * s * 1.1;
        const rSize = 1 + seededRandom(seed + i * 31 + 2) * 2;

        ctx.beginPath();
        ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // Lily pad (rare)
    if (seededRandom(seed + 500) > 0.7) {
        const lx = cx + (seededRandom(seed + 501) - 0.5) * s * 0.6;
        const ly = cy + (seededRandom(seed + 502) - 0.5) * s * 0.5;

        ctx.fillStyle = '#2d7a4a';
        ctx.beginPath();
        ctx.ellipse(lx, ly, s * 0.18, s * 0.12, 0, 0.1, Math.PI * 1.9);
        ctx.fill();

        // Flower on lily pad
        if (seededRandom(seed + 503) > 0.5) {
            ctx.fillStyle = '#ff9ff3';
            ctx.beginPath();
            ctx.arc(lx, ly - 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/**
 * Draw sand details
 */
function drawSandDetails(cx, cy, s, seed) {
    // Sand ripples
    ctx.strokeStyle = 'rgba(180, 150, 100, 0.25)';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < 3; i++) {
        const yOff = (i - 1) * s * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.9, cy + yOff);
        ctx.bezierCurveTo(
            cx - s * 0.3, cy + yOff - s * 0.15,
            cx + s * 0.3, cy + yOff + s * 0.1,
            cx + s * 0.9, cy + yOff - s * 0.05
        );
        ctx.stroke();
    }

    // Pebbles and shells
    for (let i = 0; i < 6; i++) {
        const px = cx + (seededRandom(seed + i * 37) - 0.5) * s * 1.5;
        const py = cy + (seededRandom(seed + i * 37 + 1) - 0.5) * s * 1.2;
        const pSize = 1.5 + seededRandom(seed + i * 37 + 2) * 2;

        if (seededRandom(seed + i * 37 + 3) > 0.7) {
            // Shell
            ctx.fillStyle = '#f5e6d3';
            ctx.beginPath();
            ctx.ellipse(px, py, pSize * 1.2, pSize * 0.8, seededRandom(seed + i) * Math.PI, 0, Math.PI);
            ctx.fill();
        } else {
            // Pebble
            const grayVal = 100 + seededRandom(seed + i * 37 + 4) * 50;
            ctx.fillStyle = `rgb(${grayVal}, ${grayVal - 10}, ${grayVal - 20})`;
            ctx.beginPath();
            ctx.ellipse(px, py, pSize, pSize * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Sparse grass tuft
    if (seededRandom(seed + 600) > 0.7) {
        const gx = cx + (seededRandom(seed + 601) - 0.5) * s * 0.8;
        const gy = cy + (seededRandom(seed + 602) - 0.5) * s * 0.6;

        ctx.strokeStyle = '#7a9a60';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(gx + (i - 1) * 3, gy);
            ctx.lineTo(gx + (i - 1) * 4, gy - 8 - seededRandom(seed + 603 + i) * 4);
            ctx.stroke();
        }
    }
}

/**
 * Draw swamp details
 */
function drawSwampDetails(cx, cy, s, seed) {
    // Murky water puddles
    ctx.fillStyle = 'rgba(25, 45, 30, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.1, s * 0.65, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Algae on water
    ctx.fillStyle = 'rgba(50, 80, 40, 0.4)';
    for (let i = 0; i < 3; i++) {
        const ax = cx + (seededRandom(seed + i * 41) - 0.5) * s * 0.8;
        const ay = cy + (seededRandom(seed + i * 41 + 1) - 0.5) * s * 0.5;
        ctx.beginPath();
        ctx.ellipse(ax, ay, s * 0.15, s * 0.1, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Bubbles
    ctx.fillStyle = 'rgba(60, 85, 55, 0.7)';
    for (let i = 0; i < 4; i++) {
        const bx = cx + (seededRandom(seed + i * 43) - 0.5) * s * 0.9;
        const by = cy + (seededRandom(seed + i * 43 + 1) - 0.5) * s * 0.7;
        const bSize = 2 + seededRandom(seed + i * 43 + 2) * 2;
        ctx.beginPath();
        ctx.arc(bx, by, bSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // Dead reeds
    ctx.strokeStyle = 'rgba(90, 70, 50, 0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        const rx = cx + (seededRandom(seed + i * 47) - 0.5) * s * 1.2;
        const ry = cy + (seededRandom(seed + i * 47 + 1) - 0.5) * s * 0.8;
        const height = s * (0.3 + seededRandom(seed + i * 47 + 2) * 0.3);
        const lean = (seededRandom(seed + i * 47 + 3) - 0.5) * s * 0.15;

        ctx.beginPath();
        ctx.moveTo(rx, ry + s * 0.2);
        ctx.lineTo(rx + lean, ry - height);
        ctx.stroke();

        // Reed tip
        ctx.fillStyle = 'rgba(70, 50, 35, 0.8)';
        ctx.beginPath();
        ctx.ellipse(rx + lean, ry - height - 3, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Moss on edges
    ctx.fillStyle = 'rgba(45, 70, 35, 0.5)';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.5, cy - s * 0.2, s * 0.2, s * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw a ghost indicator showing where a cloaked unit last attacked from
 */
function drawGhostIndicator(cx, cy, ghost) {
    const size = state.hexSize * 0.65;
    const now = Date.now();
    const age = now - ghost.timestamp;
    const fadeStart = ghost.fadeStart || (ghost.timestamp + 3000);

    // Calculate opacity - full for 3 seconds, then fade out over 5 seconds
    let alpha = 1;
    if (now > fadeStart) {
        const fadeProgress = (now - fadeStart) / 5000;
        alpha = Math.max(0, 1 - fadeProgress);
    }

    // Pulse effect
    const pulse = 0.8 + Math.sin(now / 200) * 0.2;

    ctx.save();
    ctx.globalAlpha = alpha * 0.6 * pulse;

    // Ghost silhouette - ethereal glow effect
    const playerColor = CONFIG.PLAYER_COLORS[ghost.player];

    // Outer glow ring - pulsing warning
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.8})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, size + 15 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner danger zone
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size + 10);
    gradient.addColorStop(0, `rgba(239, 68, 68, ${alpha * 0.3})`);
    gradient.addColorStop(0.7, `rgba(239, 68, 68, ${alpha * 0.15})`);
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size + 10, 0, Math.PI * 2);
    ctx.fill();

    // Ghost silhouette shape
    ctx.globalAlpha = alpha * 0.4 * pulse;
    ctx.fillStyle = playerColor;

    // Draw ghostly human shape
    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.5, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.3, cy - size * 0.2);
    ctx.lineTo(cx + size * 0.3, cy - size * 0.2);
    ctx.lineTo(cx + size * 0.25, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.25, cy + size * 0.3);
    ctx.closePath();
    ctx.fill();

    // Arms
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = playerColor;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.3, cy - size * 0.1);
    ctx.lineTo(cx - size * 0.5, cy + size * 0.1);
    ctx.moveTo(cx + size * 0.3, cy - size * 0.1);
    ctx.lineTo(cx + size * 0.5, cy + size * 0.1);
    ctx.stroke();

    // Warning icon
    ctx.globalAlpha = alpha * 0.9;
    ctx.font = `bold ${Math.round(size * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('👻', cx, cy - size - 15);
    ctx.shadowBlur = 0;

    // "Letzter Angriff" text
    ctx.globalAlpha = alpha * 0.7;
    ctx.font = `bold ${Math.round(size * 0.22)}px sans-serif`;
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('LETZTER ANGRIFF', cx, cy + size + 20);

    ctx.restore();
}

/**
 * Draw a human unit with equipment
 */
function drawUnit(unit, cx, cy, isSelected, isTargeted, isAttackable) {
    const size = state.hexSize * 0.65;
    const playerColor = CONFIG.PLAYER_COLORS[unit.player];

    ctx.save();

    // Cloaked units appear semi-transparent to their owner
    if (unit.cloaked && unit.player === state.currentPlayer) {
        ctx.globalAlpha = 0.5;
    }

    // Selection glow effect
    if (isSelected) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;

        // Pulsing selection ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, size + 8, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.7, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Draw the human sprite
    drawHumanSprite(ctx, cx, cy - size * 0.15, size * 1.3, playerColor, unit.class, isSelected);

    // Player number badge
    ctx.fillStyle = playerColor;
    ctx.beginPath();
    ctx.arc(cx + size * 0.5, cy - size * 0.6, size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.32)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unit.player + 1, cx + size * 0.5, cy - size * 0.6);

    // Level badge (left side)
    const level = unit.level || 1;
    if (level > 1) {
        const levelColors = ['#9ca3af', '#22c55e', '#3b82f6', '#a855f7', '#eab308'];
        const levelColor = levelColors[Math.min(level - 1, levelColors.length - 1)];

        ctx.fillStyle = levelColor;
        ctx.beginPath();
        ctx.arc(cx - size * 0.5, cy - size * 0.6, size * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(size * 0.24)}px sans-serif`;
        ctx.fillText(level, cx - size * 0.5, cy - size * 0.6);
    }

    // Shield indicator (if unit has shield from power-up)
    if (unit.shield) {
        ctx.globalAlpha = 1;  // Reset for indicators
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.font = `${Math.round(size * 0.5)}px sans-serif`;
        ctx.fillText('🛡️', cx, cy - size - 5);
        ctx.shadowBlur = 0;
    }

    // Cloak indicator (visible to owner)
    if (unit.cloaked && unit.player === state.currentPlayer) {
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 15;
        ctx.font = `${Math.round(size * 0.45)}px sans-serif`;
        ctx.fillText('👁️‍🗨️', cx, cy - size - 5);
        ctx.shadowBlur = 0;
    }

    // Damage boost indicator
    if (unit.damageBoost && unit.damageBoost > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = `${Math.round(size * 0.35)}px sans-serif`;
        ctx.fillText('⚔️', cx + size * 0.6, cy - size * 0.3);
    }

    // HP bar with gradient
    const hpPct = unit.currentHp / unit.maxHp;
    const barWidth = size * 1.6;
    const barHeight = 8;
    const barY = cy + size * 0.65;

    // Bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(cx - barWidth / 2 - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
    ctx.fill();

    // HP bar fill with gradient
    let barGradient = ctx.createLinearGradient(cx - barWidth / 2, barY, cx - barWidth / 2 + barWidth * hpPct, barY);
    if (hpPct > 0.5) {
        barGradient.addColorStop(0, '#22c55e');
        barGradient.addColorStop(1, '#16a34a');
    } else if (hpPct > 0.25) {
        barGradient.addColorStop(0, '#eab308');
        barGradient.addColorStop(1, '#ca8a04');
    } else {
        barGradient.addColorStop(0, '#ef4444');
        barGradient.addColorStop(1, '#dc2626');
    }

    ctx.fillStyle = barGradient;
    ctx.beginPath();
    ctx.roundRect(cx - barWidth / 2, barY, barWidth * hpPct, barHeight, 3);
    ctx.fill();

    // HP text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(barHeight * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${unit.currentHp}/${unit.maxHp}`, cx, barY + barHeight / 2);

    // AP indicators below HP bar
    if (isSelected) {
        drawAPIndicator(ctx, cx, barY + barHeight + 16, unit.ap, CONFIG.AP_PER_TURN, 14);
    }

    // Attackable indicator
    if (isAttackable && !isSelected) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, size + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // "Target" icon
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy - size - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('!', cx, cy - size - 10);
    }

    // Targeted crosshair animation
    if (isTargeted) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        const crossSize = size + 25;

        // Crosshair lines
        ctx.beginPath();
        ctx.moveTo(cx - crossSize, cy);
        ctx.lineTo(cx - size - 10, cy);
        ctx.moveTo(cx + size + 10, cy);
        ctx.lineTo(cx + crossSize, cy);
        ctx.moveTo(cx, cy - crossSize);
        ctx.lineTo(cx, cy - size - 10);
        ctx.moveTo(cx, cy + size + 10);
        ctx.lineTo(cx, cy + crossSize);
        ctx.stroke();

        // Outer targeting ring
        ctx.beginPath();
        ctx.arc(cx, cy, crossSize, 0, Math.PI * 2);
        ctx.stroke();

        // Inner pulsing ring
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, size + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Lighten a hex color
 */
function lightenColor(color, percent) {
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
function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `rgb(${R},${G},${B})`;
}

/**
 * Main render function
 */
export function render() {
    if (!canvas || !ctx) return;

    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    // Background with modern gradient
    const bgGradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8);
    bgGradient.addColorStop(0, '#1a1a3e');
    bgGradient.addColorStop(0.5, '#12122b');
    bgGradient.addColorStop(1, '#0c0c1d');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);

    // Subtle ambient glow
    ctx.save();
    ctx.globalAlpha = 0.1;
    const ambientGlow = ctx.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.3, h * 0.3, w * 0.5);
    ambientGlow.addColorStop(0, '#10b981');
    ambientGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = ambientGlow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const currentUnit = getCurrentUnit();
    const reachableHexes = currentUnit && state.selectedAction === 'move'
        ? getReachableHexes(currentUnit)
        : new Map();
    const attackableUnits = currentUnit && state.selectedAction === 'attack'
        ? getAttackableUnits(currentUnit)
        : [];

    // Get max move cost for path visualization
    const maxMoveCost = currentUnit ? Math.min(currentUnit.ap, currentUnit.move) : 0;

    // Draw hexes
    state.hexes.forEach(hex => {
        const pos = hexToPixel(hex.q, hex.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;

        // Skip if off screen (with margin)
        if (sx < -state.hexSize * 2 || sx > w + state.hexSize * 2 ||
            sy < -state.hexSize * 2 || sy > h + state.hexSize * 2) {
            return;
        }

        const fogLevel = getFogLevel(hex.q, hex.r);
        const terrain = TERRAIN[hex.type];
        let fillColor = terrain.color;
        const texture = fogLevel === 'visible' ? getTexture(hex.type) : null;

        // Fog of war overlay
        if (fogLevel === 'hidden') {
            fillColor = '#0a0a12';
        } else if (fogLevel === 'explored') {
            fillColor = darkenColor(terrain.color, 50);
        }

        // Draw hex with texture and 3D effect - always keep natural terrain colors
        const strokeColor = fogLevel === 'visible' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)';
        const terrainData = fogLevel === 'visible' ? terrain : null;
        drawHex(sx, sy, state.hexSize * 0.95, fillColor, strokeColor, 1, texture, terrainData);

        // Draw terrain details (always when visible - landscape decorations)
        if (fogLevel === 'visible') {
            drawTerrainDetails(sx, sy, state.hexSize, hex.type, hex.q, hex.r);
        }


        // Draw power-up if present
        if (fogLevel === 'visible') {
            const powerup = getPowerupAt(hex.q, hex.r);
            if (powerup) {
                drawPowerup(sx, sy, powerup, state.hexSize);
            }
        }

        // Highlight reachable hexes for movement - simple green overlay
        if (state.selectedAction === 'move' && reachableHexes.size > 0) {
            const hexKey = `${hex.q},${hex.r}`;
            const pathData = reachableHexes.get(hexKey);
            if (pathData && fogLevel === 'visible' && !hex.unit) {
                // Draw simple movement range highlight (green)
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize * 0.85);
                ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
                ctx.fill();

                // Subtle border
                ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    });

    // Draw path preview - clean simple path line with destination marker
    if (state.currentPath && state.currentPath.length >= 2 && state.selectedAction === 'move' && currentUnit) {
        const maxCost = currentUnit.ap;

        // Calculate cumulative costs along path
        let cumulativeCost = 0;
        const pathWithCosts = state.currentPath.map((point, index) => {
            if (index > 0) {
                const hex = getHex(point.q, point.r);
                if (hex && TERRAIN[hex.type]) {
                    cumulativeCost += TERRAIN[hex.type].moveCost;
                }
            }
            return { ...point, totalCost: cumulativeCost, reachable: cumulativeCost <= maxCost };
        });

        // Find last reachable point this turn
        let lastReachableIndex = 0;
        for (let i = 1; i < pathWithCosts.length; i++) {
            const pathHex = getHex(pathWithCosts[i].q, pathWithCosts[i].r);
            if (pathHex && pathHex.unit && pathHex.unit.id !== currentUnit.id) break;
            if (pathWithCosts[i].totalCost <= maxCost) {
                lastReachableIndex = i;
            }
        }

        // Check if this is a multi-turn path
        const isMultiTurnPath = lastReachableIndex < pathWithCosts.length - 1;

        // Draw the future path (orange, dashed) - for multi-turn movement
        if (isMultiTurnPath && lastReachableIndex >= 1) {
            ctx.save();
            ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([8, 6]);
            ctx.beginPath();

            // Start from where reachable path ends
            const startPoint = pathWithCosts[lastReachableIndex];
            const startPos = hexToPixel(startPoint.q, startPoint.r, state.hexSize);
            ctx.moveTo(state.offsetX + startPos.x, state.offsetY + startPos.y);

            // Draw to final destination
            for (let i = lastReachableIndex + 1; i < pathWithCosts.length; i++) {
                const pathHex = getHex(pathWithCosts[i].q, pathWithCosts[i].r);
                if (pathHex && pathHex.unit && pathHex.unit.id !== currentUnit.id) break;
                const point = pathWithCosts[i];
                const pos = hexToPixel(point.q, point.r, state.hexSize);
                ctx.lineTo(state.offsetX + pos.x, state.offsetY + pos.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Draw final destination marker (orange)
            const finalPoint = pathWithCosts[pathWithCosts.length - 1];
            const finalPos = hexToPixel(finalPoint.q, finalPoint.r, state.hexSize);
            const finalSx = state.offsetX + finalPos.x;
            const finalSy = state.offsetY + finalPos.y;

            ctx.save();
            ctx.fillStyle = 'rgba(251, 146, 60, 0.3)';
            ctx.beginPath();
            ctx.arc(finalSx, finalSy, state.hexSize * 0.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(251, 146, 60, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(finalSx, finalSy, state.hexSize * 0.4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Flag icon for future destination
            ctx.font = `${Math.round(state.hexSize * 0.35)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚩', finalSx, finalSy);
            ctx.restore();
        }

        // Draw the reachable path line (green, solid)
        if (lastReachableIndex >= 1) {
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 3;
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            for (let i = 0; i <= lastReachableIndex; i++) {
                const point = pathWithCosts[i];
                const pos = hexToPixel(point.q, point.r, state.hexSize);
                const sx = state.offsetX + pos.x;
                const sy = state.offsetY + pos.y;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
            ctx.restore();

            // Destination marker for this turn
            const endPoint = pathWithCosts[lastReachableIndex];
            const endPos = hexToPixel(endPoint.q, endPoint.r, state.hexSize);
            const endSx = state.offsetX + endPos.x;
            const endSy = state.offsetY + endPos.y;

            // Check if pending confirmation
            const isPending = state.pendingMoveDestination &&
                state.pendingMoveDestination.q === endPoint.q &&
                state.pendingMoveDestination.r === endPoint.r;

            if (isPending) {
                // Pulsing confirmation marker
                const pulse = 0.7 + Math.sin(Date.now() / 150) * 0.3;

                ctx.fillStyle = `rgba(34, 197, 94, ${0.2 * pulse})`;
                ctx.beginPath();
                ctx.arc(endSx, endSy, state.hexSize * 0.6 * pulse, 0, Math.PI * 2);
                ctx.fill();

                // Confirm button
                const btnSize = state.hexSize * 0.45;
                ctx.fillStyle = `rgba(22, 163, 74, ${0.85 + 0.15 * pulse})`;
                ctx.beginPath();
                ctx.arc(endSx, endSy, btnSize, 0, Math.PI * 2);
                ctx.fill();

                // Checkmark
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                const s = btnSize * 0.4;
                ctx.moveTo(endSx - s * 0.5, endSy);
                ctx.lineTo(endSx - s * 0.1, endSy + s * 0.4);
                ctx.lineTo(endSx + s * 0.5, endSy - s * 0.4);
                ctx.stroke();

                // Cost badge
                const cost = pathWithCosts[lastReachableIndex].totalCost;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.beginPath();
                ctx.roundRect(endSx - 18, endSy + btnSize + 8, 36, 18, 4);
                ctx.fill();
                ctx.fillStyle = '#22c55e';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`-${cost}⚡`, endSx, endSy + btnSize + 17);

                // Show multi-turn indicator if applicable
                if (isMultiTurnPath) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.beginPath();
                    ctx.roundRect(endSx - 30, endSy - btnSize - 26, 60, 18, 4);
                    ctx.fill();
                    ctx.fillStyle = '#fb923c';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.fillText('📍 Mehr...', endSx, endSy - btnSize - 17);
                }
            } else {
                // Simple destination dot
                ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
                ctx.beginPath();
                ctx.arc(endSx, endSy, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }

    // Draw queued path indicator for selected unit
    if (currentUnit && state.selectedAction === 'move') {
        const queuedPath = getQueuedPath(currentUnit.id);
        if (queuedPath && queuedPath.path && !state.currentPath) {
            // Draw indicator showing there's a queued destination
            const targetPos = hexToPixel(queuedPath.targetQ, queuedPath.targetR, state.hexSize);
            const targetSx = state.offsetX + targetPos.x;
            const targetSy = state.offsetY + targetPos.y;

            ctx.save();
            const pulse = 0.6 + Math.sin(Date.now() / 300) * 0.4;
            ctx.fillStyle = `rgba(251, 146, 60, ${0.2 * pulse})`;
            ctx.beginPath();
            ctx.arc(targetSx, targetSy, state.hexSize * 0.5 * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.arc(targetSx, targetSy, state.hexSize * 0.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = `${Math.round(state.hexSize * 0.4)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚩', targetSx, targetSy);
            ctx.restore();
        }
    }

    // Draw attack line
    if (currentUnit && state.targetedUnit && state.selectedAction === 'attack') {
        const fromPos = hexToPixel(currentUnit.q, currentUnit.r, state.hexSize);
        const toPos = hexToPixel(state.targetedUnit.q, state.targetedUnit.r, state.hexSize);

        // Gradient attack line
        const gradient = ctx.createLinearGradient(
            state.offsetX + fromPos.x, state.offsetY + fromPos.y,
            state.offsetX + toPos.x, state.offsetY + toPos.y
        );
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
        gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.8)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');

        ctx.save();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 6]);
        ctx.beginPath();
        ctx.moveTo(state.offsetX + fromPos.x, state.offsetY + fromPos.y);
        ctx.lineTo(state.offsetX + toPos.x, state.offsetY + toPos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // Draw ghost indicators for cloaked enemy attacks
    const ghosts = getVisibleGhosts();
    ghosts.forEach(ghost => {
        const pos = hexToPixel(ghost.q, ghost.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;
        drawGhostIndicator(sx, sy, ghost);
    });

    // Draw units (sorted by y position for proper layering)
    const visibleUnits = state.units
        .filter(unit => unit.alive && isUnitVisible(unit))
        .sort((a, b) => a.r - b.r);

    visibleUnits.forEach(unit => {
        const pos = hexToPixel(unit.q, unit.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;

        const isSelected = currentUnit && unit.id === currentUnit.id;
        const isTargeted = state.targetedUnit && unit.id === state.targetedUnit.id;
        const isAttackable = attackableUnits.some(u => u.id === unit.id);

        drawUnit(unit, sx, sy, isSelected, isTargeted, isAttackable);
    });

    // Draw attack range indicator
    if (currentUnit && state.selectedAction === 'attack') {
        const pos = hexToPixel(currentUnit.q, currentUnit.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;
        const rangeRadius = getEffectiveRange(currentUnit) * state.hexSize * 1.75;

        // Gradient range circle
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 3;
        ctx.setLineDash([15, 8]);
        ctx.beginPath();
        ctx.arc(sx, sy, rangeRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Inner glow
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(sx, sy, rangeRadius - 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw scroll hint if map is larger than viewport
    drawScrollHint(w, h);

    // Draw event indicator
    drawEventIndicator(w, h);

    // Draw zoom indicator
    drawZoomIndicator(w, h);
}

/**
 * Draw scroll hint arrows if map extends beyond viewport
 */
function drawScrollHint(w, h) {
    if (!state.hexes.length) return;

    // Check if map extends beyond viewport
    const radius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    const mapPixelRadius = radius * state.hexSize * 1.8;

    const leftEdge = state.offsetX - mapPixelRadius;
    const rightEdge = state.offsetX + mapPixelRadius;
    const topEdge = state.offsetY - mapPixelRadius;
    const bottomEdge = state.offsetY + mapPixelRadius;

    ctx.save();
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Arrow indicators with fade effect
    const arrowAlpha = 0.5;

    if (leftEdge < 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${arrowAlpha})`;
        ctx.fillText('◀', 20, h / 2);
    }
    if (rightEdge > w) {
        ctx.fillStyle = `rgba(255, 255, 255, ${arrowAlpha})`;
        ctx.fillText('▶', w - 20, h / 2);
    }
    if (topEdge < 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${arrowAlpha})`;
        ctx.fillText('▲', w / 2, 20);
    }
    if (bottomEdge > h) {
        ctx.fillStyle = `rgba(255, 255, 255, ${arrowAlpha})`;
        ctx.fillText('▼', w / 2, h - 20);
    }

    ctx.restore();
}

/**
 * Draw a power-up on the map
 */
function drawPowerup(cx, cy, powerup, size) {
    const powerupType = POWERUP_TYPES[powerup.type];
    if (!powerupType) return;

    ctx.save();

    // Floating animation offset
    const floatOffset = Math.sin(Date.now() / 400 + powerup.q + powerup.r) * 3;

    // Glow effect
    ctx.shadowColor = powerupType.color;
    ctx.shadowBlur = 15;

    // Background circle
    ctx.fillStyle = powerupType.color + '40';
    ctx.beginPath();
    ctx.arc(cx, cy + floatOffset, size * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = powerupType.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Icon
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(size * 0.45)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerupType.icon, cx, cy + floatOffset);

    ctx.restore();
}

/**
 * Draw active event indicator
 */
function drawEventIndicator(w, h) {
    const event = getCurrentEvent();
    if (!event) return;

    ctx.save();

    // Small indicator in corner
    ctx.fillStyle = event.color + 'cc';
    ctx.beginPath();
    ctx.roundRect(w - 100, 10, 90, 30, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${event.icon} Aktiv`, w - 55, 25);

    ctx.restore();
}

/**
 * Draw zoom indicator
 */
function drawZoomIndicator(w, h) {
    // Only show if zoom is not at default
    if (Math.abs(state.zoomLevel - 1.0) < 0.05) return;

    ctx.save();

    // Position in bottom-left corner
    const x = 15;
    const y = h - 45;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x, y, 70, 30, 6);
    ctx.fill();

    // Zoom level text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const zoomPercent = Math.round(state.zoomLevel * 100);
    ctx.fillText(`🔍 ${zoomPercent}%`, x + 35, y + 15);

    ctx.restore();
}
