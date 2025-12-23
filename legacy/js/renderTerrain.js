// ===== TERRAIN RENDERING =====
// Terrain detail and ground texture functions

import { seededRandom } from './renderUtils.js';

// Canvas context - set by renderer.js
let ctx = null;

/**
 * Initialize the terrain renderer with canvas context
 * @param {CanvasRenderingContext2D} context - The canvas 2D context
 */
export function initTerrainRenderer(context) {
    ctx = context;
}

/**
 * Draw a rock formation with 2.5D depth effect - large enough to provide cover
 */
export function drawRockFormation2D5(cx, cy, s, seed) {
    ctx.save();

    // Large main rock shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy + s * 0.35, s * 0.75, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main large boulder - tall enough to hide behind
    ctx.fillStyle = '#4a4a5a';
    ctx.beginPath();
    // Draw as a tall irregular polygon for more rock-like appearance
    ctx.moveTo(cx - s * 0.5, cy + s * 0.25);
    ctx.lineTo(cx - s * 0.55, cy - s * 0.1);
    ctx.lineTo(cx - s * 0.35, cy - s * 0.45);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.55);
    ctx.lineTo(cx + s * 0.45, cy - s * 0.35);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.3);
    ctx.closePath();
    ctx.fill();

    // Add 3D shading to the rock
    const rockGradient = ctx.createLinearGradient(cx - s * 0.5, cy - s * 0.5, cx + s * 0.5, cy + s * 0.3);
    rockGradient.addColorStop(0, 'rgba(100, 100, 120, 0.6)');
    rockGradient.addColorStop(0.5, 'rgba(70, 70, 85, 0.3)');
    rockGradient.addColorStop(1, 'rgba(30, 30, 40, 0.5)');
    ctx.fillStyle = rockGradient;
    ctx.fill();

    // Secondary rock pillar
    ctx.fillStyle = '#5a5a6a';
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.2, cy + s * 0.25);
    ctx.lineTo(cx + s * 0.15, cy - s * 0.2);
    ctx.lineTo(cx + s * 0.35, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.25);
    ctx.lineTo(cx + s * 0.6, cy + s * 0.15);
    ctx.closePath();
    ctx.fill();

    // Small rock in front
    ctx.fillStyle = '#656575';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.25, cy + s * 0.2, s * 0.25, s * 0.15, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Rock face details - cracks
    ctx.strokeStyle = 'rgba(30, 30, 40, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.2, cy - s * 0.4);
    ctx.lineTo(cx - s * 0.15, cy - s * 0.1);
    ctx.lineTo(cx - s * 0.05, cy + s * 0.15);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + s * 0.2, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.25, cy + s * 0.05);
    ctx.stroke();

    // Edge highlights (top-left lit)
    ctx.strokeStyle = 'rgba(150, 150, 170, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.35, cy - s * 0.45);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.55);
    ctx.lineTo(cx + s * 0.45, cy - s * 0.35);
    ctx.stroke();

    // Moss patches for natural look
    if (seededRandom(seed) > 0.3) {
        ctx.fillStyle = 'rgba(50, 90, 45, 0.7)';
        ctx.beginPath();
        ctx.ellipse(cx - s * 0.3, cy - s * 0.15, s * 0.12, s * 0.08, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.35, cy - s * 0.1, s * 0.1, s * 0.06, -0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Cover indicator icon (shield symbol)
    ctx.fillStyle = 'rgba(100, 100, 120, 0.6)';
    ctx.font = `${Math.round(s * 0.25)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1FAA8}', cx, cy - s * 0.65);

    ctx.restore();
}

/**
 * Draw hills terrain details
 */
export function drawHillsDetails(cx, cy, s, seed) {
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
    ctx.fillText('\u26F0', cx, cy);
}

/**
 * Draw road terrain details
 */
export function drawRoadDetails(cx, cy, s, seed) {
    // Cobblestone pattern
    ctx.strokeStyle = 'rgba(80, 70, 60, 0.4)';
    ctx.lineWidth = 1;

    // Draw cobblestone grid
    for (let i = 0; i < 5; i++) {
        const rx = cx + (seededRandom(seed + i * 7) - 0.5) * s * 1.2;
        const ry = cy + (seededRandom(seed + i * 7 + 1) - 0.5) * s * 0.9;
        const rSize = s * (0.15 + seededRandom(seed + i * 7 + 2) * 0.1);

        ctx.beginPath();
        ctx.roundRect(
            rx - rSize / 2,
            ry - rSize / 2,
            rSize,
            rSize * 0.7,
            rSize * 0.1
        );
        ctx.stroke();
    }

    // Road edge markings
    ctx.strokeStyle = 'rgba(90, 80, 70, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.7, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.7, cy - s * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.7, cy + s * 0.4);
    ctx.lineTo(cx + s * 0.7, cy + s * 0.4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Speed indicator
    ctx.fillStyle = 'rgba(100, 90, 80, 0.4)';
    ctx.font = `${Math.round(s * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F6E4}\uFE0F', cx, cy);
}

/**
 * Draw path terrain details
 */
export function drawPathDetails(cx, cy, s, seed) {
    // Dirt path with footprints
    ctx.strokeStyle = 'rgba(70, 60, 50, 0.4)';
    ctx.lineWidth = 1;

    // Worn path marks
    for (let i = 0; i < 6; i++) {
        const px = cx + (seededRandom(seed + i * 11) - 0.5) * s * 1.0;
        const py = cy + (seededRandom(seed + i * 11 + 1) - 0.5) * s * 0.8;
        const pSize = s * (0.08 + seededRandom(seed + i * 11 + 2) * 0.06);

        ctx.fillStyle = `rgba(${70 + seededRandom(seed + i) * 20}, ${60 + seededRandom(seed + i + 1) * 20}, ${50 + seededRandom(seed + i + 2) * 15}, 0.3)`;
        ctx.beginPath();
        ctx.ellipse(px, py, pSize, pSize * 0.5, seededRandom(seed + i * 11 + 3) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Small pebbles
    for (let i = 0; i < 3; i++) {
        const px = cx + (seededRandom(seed + i * 19) - 0.5) * s * 0.8;
        const py = cy + (seededRandom(seed + i * 19 + 1) - 0.5) * s * 0.6;
        const pSize = s * 0.05;

        ctx.fillStyle = 'rgba(80, 75, 65, 0.5)';
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw river terrain details
 */
export function drawRiverDetails(cx, cy, s, seed) {
    // Flowing water ripples
    ctx.strokeStyle = 'rgba(60, 120, 160, 0.4)';
    ctx.lineWidth = 1.5;

    // Wave patterns
    for (let i = 0; i < 3; i++) {
        const yOffset = (i - 1) * s * 0.35;
        ctx.beginPath();
        for (let x = -s * 0.8; x <= s * 0.8; x += s * 0.2) {
            const wobble = Math.sin(x * 0.3 + seed * 0.1 + i) * s * 0.1;
            if (x === -s * 0.8) {
                ctx.moveTo(cx + x, cy + yOffset + wobble);
            } else {
                ctx.lineTo(cx + x, cy + yOffset + wobble);
            }
        }
        ctx.stroke();
    }

    // Sparkle effects on water
    ctx.fillStyle = 'rgba(180, 220, 255, 0.5)';
    for (let i = 0; i < 2; i++) {
        const sx = cx + (seededRandom(seed + i * 13) - 0.5) * s * 1.0;
        const sy = cy + (seededRandom(seed + i * 13 + 1) - 0.5) * s * 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
    }

    // River flow indicator
    ctx.fillStyle = 'rgba(70, 130, 170, 0.4)';
    ctx.font = `${Math.round(s * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F30A}', cx, cy);
}

/**
 * Draw full grass texture coverage - creates the base meadow look
 */
export function drawGrassTexture(cx, cy, size, seed) {
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
export function drawWildMeadow(cx, cy, s, seed) {
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
 * Draw forest floor - leaves, fallen branches, small plants
 */
export function drawForestFloor(cx, cy, s, seed) {
    // Fallen leaves scattered on ground
    const leafCount = 4 + (seed % 4);
    for (let i = 0; i < leafCount; i++) {
        const lx = cx + (seededRandom(seed + i * 11) - 0.5) * s * 1.6;
        const ly = cy + (seededRandom(seed + i * 11 + 1) - 0.5) * s * 1.2;
        const leafSize = s * (0.08 + seededRandom(seed + i * 11 + 2) * 0.06);
        const rotation = seededRandom(seed + i * 11 + 3) * Math.PI * 2;

        const shade = 0.4 + seededRandom(seed + i * 11 + 4) * 0.3;
        ctx.fillStyle = `rgba(${Math.floor(80 * shade)}, ${Math.floor(60 * shade)}, ${Math.floor(30 * shade)}, 0.6)`;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, leafSize, leafSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Small ferns/plants
    const fernCount = 2 + (seed % 2);
    for (let i = 0; i < fernCount; i++) {
        const fx = cx + (seededRandom(seed + i * 17) - 0.5) * s * 1.2;
        const fy = cy + (seededRandom(seed + i * 17 + 1) - 0.5) * s * 0.8;
        const fernSize = s * (0.15 + seededRandom(seed + i * 17 + 2) * 0.1);

        ctx.strokeStyle = 'rgba(35, 80, 45, 0.7)';
        ctx.lineWidth = 1.5;

        // Draw small fern fronds
        for (let j = 0; j < 3; j++) {
            const angle = -Math.PI / 2 + (j - 1) * 0.4;
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx + Math.cos(angle) * fernSize, fy + Math.sin(angle) * fernSize);
            ctx.stroke();
        }
    }

    // Darker ground patches (shade from trees)
    ctx.fillStyle = 'rgba(0, 20, 10, 0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.5, s * 0.3, seededRandom(seed + 50) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw grass blades for texture - optimized
 */
export function drawGrassBlades(cx, cy, s, seed) {
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
