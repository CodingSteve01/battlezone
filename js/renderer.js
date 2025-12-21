// ===== CANVAS RENDERING =====

import { CONFIG, TERRAIN, UNIT_CLASSES } from './config.js';
import { state, getHex, getCurrentUnit } from './state.js';
import { hexToPixel } from './hexMath.js';
import { getReachableHexes } from './pathfinding.js';
import { getAttackableUnits } from './units.js';
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
    return Math.max(30, Math.min(65, hexSize));
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
 * Draw enhanced terrain pattern on a hex
 */
function drawTerrainDetails(cx, cy, size, type) {
    const s = size * 0.4;
    ctx.save();

    switch (type) {
        case 'grass':
            // Random seed based on position for consistent decoration
            const seed = Math.abs((cx * 7 + cy * 13) % 100);

            if (seed < 30) {
                // Small bush
                ctx.fillStyle = '#2d5a3d';
                ctx.beginPath();
                ctx.arc(cx, cy, s * 0.25, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1e4d2e';
                ctx.beginPath();
                ctx.arc(cx - s * 0.1, cy - s * 0.05, s * 0.15, 0, Math.PI * 2);
                ctx.fill();
            } else if (seed < 45) {
                // Grass tufts
                ctx.strokeStyle = '#3d6b4d';
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.moveTo(cx + (i - 1) * s * 0.2, cy + s * 0.15);
                    ctx.quadraticCurveTo(
                        cx + (i - 1) * s * 0.25,
                        cy - s * 0.1,
                        cx + (i - 1) * s * 0.15 + (i - 1) * s * 0.1,
                        cy - s * 0.25
                    );
                    ctx.stroke();
                }
            } else if (seed < 55) {
                // Small flowers
                const flowerColors = ['#ff6b9d', '#ffeb3b', '#fff'];
                ctx.fillStyle = flowerColors[seed % 3];
                ctx.beginPath();
                ctx.arc(cx - s * 0.2, cy, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx + s * 0.15, cy + s * 0.1, 1.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (seed < 65) {
                // Small stones
                ctx.fillStyle = '#6a6a7a';
                ctx.beginPath();
                ctx.ellipse(cx, cy, s * 0.15, s * 0.1, 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
            break;

        case 'forest':
            // Multiple detailed trees
            drawTree(cx - s * 0.5, cy - s * 0.3, s * 0.8);
            drawTree(cx + s * 0.4, cy + s * 0.1, s * 0.6);
            drawTree(cx - s * 0.1, cy + s * 0.4, s * 0.5);
            break;

        case 'rock':
            // 3D rock formation
            ctx.fillStyle = '#7a7a8a';
            ctx.beginPath();
            ctx.ellipse(cx, cy + s * 0.1, s * 0.9, s * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#8a8a9a';
            ctx.beginPath();
            ctx.ellipse(cx - s * 0.2, cy - s * 0.15, s * 0.5, s * 0.35, -0.2, 0, Math.PI * 2);
            ctx.fill();

            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.ellipse(cx - s * 0.3, cy - s * 0.25, s * 0.2, s * 0.15, -0.3, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'water':
            // Animated-looking waves
            ctx.strokeStyle = 'rgba(150, 210, 255, 0.5)';
            ctx.lineWidth = 2;

            for (let i = 0; i < 3; i++) {
                const yOff = (i - 1) * s * 0.35;
                ctx.beginPath();
                ctx.moveTo(cx - s * 0.7, cy + yOff);
                ctx.quadraticCurveTo(cx - s * 0.35, cy + yOff - s * 0.15, cx, cy + yOff);
                ctx.quadraticCurveTo(cx + s * 0.35, cy + yOff + s * 0.15, cx + s * 0.7, cy + yOff);
                ctx.stroke();
            }

            // Light sparkles
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(cx - s * 0.3, cy - s * 0.2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + s * 0.4, cy + s * 0.1, 1.5, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'sand':
            // Sand dune patterns
            ctx.strokeStyle = 'rgba(180, 150, 100, 0.3)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.moveTo(cx - s * 0.8, cy + i * s * 0.4 - s * 0.2);
                ctx.bezierCurveTo(
                    cx - s * 0.3, cy + i * s * 0.4 - s * 0.4,
                    cx + s * 0.3, cy + i * s * 0.4,
                    cx + s * 0.8, cy + i * s * 0.4 - s * 0.2
                );
                ctx.stroke();
            }

            // Scattered pebbles
            ctx.fillStyle = 'rgba(120, 100, 70, 0.5)';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(
                    cx + (Math.sin(i * 2.5) * s * 0.5),
                    cy + (Math.cos(i * 2.5) * s * 0.4),
                    1.5, 0, Math.PI * 2
                );
                ctx.fill();
            }
            break;

        case 'swamp':
            // Murky puddles
            ctx.fillStyle = 'rgba(30, 50, 30, 0.5)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + s * 0.15, s * 0.6, s * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();

            // Bubbles
            ctx.fillStyle = 'rgba(60, 80, 60, 0.6)';
            ctx.beginPath();
            ctx.arc(cx - s * 0.2, cy, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + s * 0.3, cy + s * 0.1, 2, 0, Math.PI * 2);
            ctx.fill();

            // Dead vegetation
            ctx.strokeStyle = 'rgba(80, 60, 40, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx + s * 0.4, cy + s * 0.3);
            ctx.lineTo(cx + s * 0.35, cy - s * 0.2);
            ctx.stroke();
            break;
    }

    ctx.restore();
}

/**
 * Draw a simple tree
 */
function drawTree(x, y, size) {
    // Trunk
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(x - size * 0.1, y + size * 0.2, size * 0.2, size * 0.4);

    // Foliage layers
    const colors = ['#1a4d2e', '#0d3320', '#0a2618'];
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.5 + i * size * 0.2);
        ctx.lineTo(x - size * 0.4 + i * 0.05, y + size * 0.1 + i * size * 0.15);
        ctx.lineTo(x + size * 0.4 - i * 0.05, y + size * 0.1 + i * size * 0.15);
        ctx.closePath();
        ctx.fill();
    }
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

        // Check if hex is reachable and get its cost
        const hexKey = `${hex.q},${hex.r}`;
        const reachableData = reachableHexes.get(hexKey);
        const isReachable = !!reachableData;

        // Determine if this hex is within move range
        let isWithinRange = false;
        let pathCost = 0;
        if (isReachable) {
            pathCost = reachableData.cost;
            isWithinRange = pathCost <= maxMoveCost;
        }

        // Color reachable hexes
        if (isReachable && fogLevel === 'visible') {
            if (isWithinRange) {
                fillColor = '#2d6a4f'; // Green - can reach
            } else {
                fillColor = '#6a4f2d'; // Orange - beyond AP range
            }
        }

        // Draw hex with texture and 3D effect
        const strokeColor = fogLevel === 'visible' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)';
        const terrainData = fogLevel === 'visible' && !isReachable ? terrain : null;
        drawHex(sx, sy, state.hexSize * 0.95, fillColor, strokeColor, 1, texture, terrainData);

        // Draw terrain details (only if visible)
        if (fogLevel === 'visible' && !isReachable) {
            drawTerrainDetails(sx, sy, state.hexSize, hex.type);
        }

        // Movement overlay and cost display
        if (isReachable && fogLevel === 'visible') {
            // Overlay color based on reachability
            const overlayColor = isWithinRange
                ? 'rgba(34, 197, 94, 0.3)'  // Green
                : 'rgba(234, 179, 8, 0.25)'; // Yellow/orange for out of range

            drawHex(sx, sy, state.hexSize * 0.95, overlayColor);

            // Move indicator with cost
            const dotColor = isWithinRange ? 'rgba(34, 197, 94, 0.9)' : 'rgba(234, 179, 8, 0.9)';
            ctx.fillStyle = dotColor;
            ctx.beginPath();
            ctx.arc(sx, sy, 12, 0, Math.PI * 2);
            ctx.fill();

            // Cost number
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pathCost, sx, sy);
        }

        // Cover indicator (forest)
        if (hex.cover && !hex.unit && fogLevel === 'visible' && !isReachable) {
            ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
            drawHex(sx, sy, state.hexSize * 0.95, 'rgba(139, 92, 246, 0.15)');

            // Shield icon for cover
            ctx.fillStyle = 'rgba(139, 92, 246, 0.6)';
            ctx.font = `${Math.round(state.hexSize * 0.35)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🛡', sx, sy);
        }

        // Draw power-up if present
        if (fogLevel === 'visible') {
            const powerup = getPowerupAt(hex.q, hex.r);
            if (powerup) {
                drawPowerup(sx, sy, powerup, state.hexSize);
            }
        }
    });

    // Draw path preview - show full path with color coding (yellow=reachable, red=too far)
    if (state.currentPath && state.selectedAction === 'move' && currentUnit) {
        const maxCost = Math.min(currentUnit.ap, currentUnit.move);

        // Calculate cumulative costs along path
        let cumulativeCost = 0;
        const pathWithCosts = state.currentPath.map((point, index) => {
            if (index > 0) {
                const hex = getHex(point.q, point.r);
                if (hex) {
                    cumulativeCost += TERRAIN[hex.type].moveCost;
                }
            }
            return { ...point, totalCost: cumulativeCost, reachable: cumulativeCost <= maxCost };
        });

        // Find where the path exceeds AP
        let lastReachableIndex = 0;
        for (let i = 1; i < pathWithCosts.length; i++) {
            if (pathWithCosts[i].totalCost <= maxCost) {
                lastReachableIndex = i;
            }
        }

        // Draw the UNREACHABLE portion first (red, dashed)
        if (pathWithCosts.length > lastReachableIndex + 1) {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.lineWidth = 4;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();

            // Start from last reachable point
            const startPoint = pathWithCosts[Math.max(0, lastReachableIndex)];
            const startPos = hexToPixel(startPoint.q, startPoint.r, state.hexSize);
            ctx.moveTo(state.offsetX + startPos.x, state.offsetY + startPos.y);

            for (let i = lastReachableIndex + 1; i < pathWithCosts.length; i++) {
                const point = pathWithCosts[i];
                const pos = hexToPixel(point.q, point.r, state.hexSize);
                ctx.lineTo(state.offsetX + pos.x, state.offsetY + pos.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw red dots for unreachable hexes with cost
            for (let i = lastReachableIndex + 1; i < pathWithCosts.length; i++) {
                const point = pathWithCosts[i];
                const pos = hexToPixel(point.q, point.r, state.hexSize);
                const sx = state.offsetX + pos.x;
                const sy = state.offsetY + pos.y;

                // Red circle with cost
                ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
                ctx.beginPath();
                ctx.arc(sx, sy, 14, 0, Math.PI * 2);
                ctx.fill();

                // Cost number in red circle
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.totalCost, sx, sy);
            }

            // X mark at final unreachable destination
            const finalPoint = pathWithCosts[pathWithCosts.length - 1];
            const finalPos = hexToPixel(finalPoint.q, finalPoint.r, state.hexSize);
            const finalSx = state.offsetX + finalPos.x;
            const finalSy = state.offsetY + finalPos.y;

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(finalSx - 5, finalSy - 24);
            ctx.lineTo(finalSx + 5, finalSy - 14);
            ctx.moveTo(finalSx + 5, finalSy - 24);
            ctx.lineTo(finalSx - 5, finalSy - 14);
            ctx.stroke();
        }

        // Draw the REACHABLE portion (yellow, solid)
        if (lastReachableIndex > 0) {
            // Draw the path line (yellow)
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
            ctx.lineWidth = 5;
            ctx.setLineDash([]);
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

            // Draw dots at each step with cost
            for (let i = 1; i <= lastReachableIndex; i++) {
                const point = pathWithCosts[i];
                const pos = hexToPixel(point.q, point.r, state.hexSize);
                const sx = state.offsetX + pos.x;
                const sy = state.offsetY + pos.y;

                // Yellow/green circle
                ctx.fillStyle = i === lastReachableIndex ? '#22c55e' : 'rgba(250, 204, 21, 0.95)';
                ctx.beginPath();
                ctx.arc(sx, sy, 14, 0, Math.PI * 2);
                ctx.fill();

                // Cost number
                ctx.fillStyle = i === lastReachableIndex ? '#ffffff' : '#000000';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.totalCost, sx, sy);
            }

            // Draw endpoint marker at the last reachable position
            const endPoint = pathWithCosts[lastReachableIndex];
            const endPos = hexToPixel(endPoint.q, endPoint.r, state.hexSize);
            const endSx = state.offsetX + endPos.x;
            const endSy = state.offsetY + endPos.y;

            // Flag icon above destination
            ctx.font = '16px sans-serif';
            ctx.fillText('🚩', endSx, endSy - 22);

            // Show remaining AP after move
            const remainingAP = currentUnit.ap - pathWithCosts[lastReachableIndex].totalCost;

            // AP remaining badge
            ctx.fillStyle = remainingAP > 0 ? 'rgba(34, 197, 94, 0.9)' : 'rgba(107, 114, 128, 0.9)';
            ctx.beginPath();
            ctx.roundRect(endSx + 16, endSy - 10, 38, 20, 5);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${remainingAP}⚡`, endSx + 35, endSy);
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
        const rangeRadius = currentUnit.range * state.hexSize * 1.75;

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
