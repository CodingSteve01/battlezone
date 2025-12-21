// ===== CANVAS RENDERING =====

import { CONFIG, TERRAIN, UNIT_CLASSES } from './config.js';
import { state, getHex, getCurrentUnit } from './state.js';
import { hexToPixel } from './hexMath.js';
import { getReachableHexes } from './pathfinding.js';
import { getAttackableUnits } from './units.js';
import { getFogLevel, isUnitVisible } from './fogOfWar.js';

let canvas, ctx;

/**
 * Initialize renderer
 */
export function initRenderer() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
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
 * Draw a hexagon
 */
function drawHex(cx, cy, size, fillColor, strokeColor = null, lineWidth = 1) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

/**
 * Draw terrain pattern on a hex
 */
function drawTerrainPattern(cx, cy, size, type) {
    const s = size * 0.4;
    ctx.save();

    switch (type) {
        case 'forest':
            // Multiple trees
            ctx.fillStyle = '#0d3320';
            // Tree 1
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.3, cy - s * 0.6);
            ctx.lineTo(cx - s * 0.6, cy + s * 0.2);
            ctx.lineTo(cx, cy + s * 0.2);
            ctx.closePath();
            ctx.fill();
            // Tree 2
            ctx.beginPath();
            ctx.moveTo(cx + s * 0.3, cy - s * 0.4);
            ctx.lineTo(cx, cy + s * 0.4);
            ctx.lineTo(cx + s * 0.6, cy + s * 0.4);
            ctx.closePath();
            ctx.fill();
            break;

        case 'rock':
            ctx.fillStyle = '#6b6b7a';
            ctx.beginPath();
            ctx.ellipse(cx, cy, s * 0.8, s * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#8a8a9a';
            ctx.beginPath();
            ctx.ellipse(cx - s * 0.2, cy - s * 0.15, s * 0.35, s * 0.25, -0.3, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'water':
            ctx.strokeStyle = 'rgba(100, 180, 255, 0.5)';
            ctx.lineWidth = 2;
            // Wave 1
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.6, cy - s * 0.1);
            ctx.quadraticCurveTo(cx - s * 0.3, cy - s * 0.3, cx, cy - s * 0.1);
            ctx.quadraticCurveTo(cx + s * 0.3, cy + s * 0.1, cx + s * 0.6, cy - s * 0.1);
            ctx.stroke();
            // Wave 2
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.5, cy + s * 0.25);
            ctx.quadraticCurveTo(cx, cy + s * 0.05, cx + s * 0.5, cy + s * 0.25);
            ctx.stroke();
            break;

        case 'sand':
            ctx.fillStyle = 'rgba(160, 140, 100, 0.4)';
            for (let i = 0; i < 6; i++) {
                const dx = (Math.random() - 0.5) * s * 1.2;
                const dy = (Math.random() - 0.5) * s * 1.2;
                ctx.beginPath();
                ctx.arc(cx + dx, cy + dy, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            break;

        case 'swamp':
            ctx.fillStyle = 'rgba(60, 80, 50, 0.5)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + s * 0.2, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(80, 100, 60, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
    }

    ctx.restore();
}

/**
 * Draw a unit
 */
function drawUnit(unit, cx, cy, isSelected, isTargeted, isAttackable) {
    const size = state.hexSize * 0.55;
    const playerColor = CONFIG.PLAYER_COLORS[unit.player];

    ctx.save();

    // Selection glow
    if (isSelected) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 25;
    }

    // Unit base circle
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);

    // Gradient fill
    const gradient = ctx.createRadialGradient(cx - size * 0.3, cy - size * 0.3, 0, cx, cy, size);
    gradient.addColorStop(0, lightenColor(playerColor, 40));
    gradient.addColorStop(0.7, playerColor);
    gradient.addColorStop(1, darkenColor(playerColor, 20));
    ctx.fillStyle = gradient;
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = isSelected ? 4 : 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Player number badge
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(cx + size * 0.6, cy - size * 0.6, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unit.player + 1, cx + size * 0.6, cy - size * 0.6);

    // Class icon
    ctx.font = `${Math.round(size * 1.0)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unit.icon, cx, cy + size * 0.05);

    // HP bar
    const hpPct = unit.currentHp / unit.maxHp;
    const barWidth = size * 2;
    const barHeight = 6;
    const barY = cy + size + 10;

    // Bar background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(cx - barWidth / 2, barY, barWidth, barHeight, 3);
    ctx.fill();

    // Bar fill
    let barColor = '#22c55e';
    if (hpPct <= 0.5) barColor = '#eab308';
    if (hpPct <= 0.25) barColor = '#ef4444';

    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(cx - barWidth / 2, barY, barWidth * hpPct, barHeight, 3);
    ctx.fill();

    // Attackable indicator
    if (isAttackable && !isSelected) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, size + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Targeted crosshair
    if (isTargeted) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        const crossSize = size + 20;

        // Animated crosshair lines
        ctx.beginPath();
        ctx.moveTo(cx - crossSize, cy);
        ctx.lineTo(cx - size - 8, cy);
        ctx.moveTo(cx + size + 8, cy);
        ctx.lineTo(cx + crossSize, cy);
        ctx.moveTo(cx, cy - crossSize);
        ctx.lineTo(cx, cy - size - 8);
        ctx.moveTo(cx, cy + size + 8);
        ctx.lineTo(cx, cy + crossSize);
        ctx.stroke();

        // Outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, crossSize, 0, Math.PI * 2);
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

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, h);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);

    const currentUnit = getCurrentUnit();
    const reachableHexes = currentUnit && state.selectedAction === 'move'
        ? getReachableHexes(currentUnit)
        : new Map();
    const attackableUnits = currentUnit && state.selectedAction === 'attack'
        ? getAttackableUnits(currentUnit)
        : [];

    // Draw hexes
    state.hexes.forEach(hex => {
        const pos = hexToPixel(hex.q, hex.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;

        const fogLevel = getFogLevel(hex.q, hex.r);
        const terrain = TERRAIN[hex.type];
        let fillColor = terrain.color;

        // Fog of war overlay
        if (fogLevel === 'hidden') {
            fillColor = '#0a0a12';
        } else if (fogLevel === 'explored') {
            fillColor = darkenColor(terrain.color, 50);
        }

        // Highlight reachable hexes
        const hexKey = `${hex.q},${hex.r}`;
        const isReachable = reachableHexes.has(hexKey);

        if (isReachable && fogLevel === 'visible') {
            fillColor = '#2d6a4f';
        }

        // Draw hex
        const strokeColor = fogLevel === 'visible' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
        drawHex(sx, sy, state.hexSize * 0.95, fillColor, strokeColor, 1);

        // Draw terrain pattern (only if visible)
        if (fogLevel === 'visible' && !isReachable) {
            drawTerrainPattern(sx, sy, state.hexSize, hex.type);
        }

        // Movement overlay and cost
        if (isReachable && fogLevel === 'visible') {
            const data = reachableHexes.get(hexKey);

            // Green overlay
            drawHex(sx, sy, state.hexSize * 0.95, 'rgba(34, 197, 94, 0.25)');

            // Move indicator dot
            ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
            ctx.beginPath();
            ctx.arc(sx, sy, 8, 0, Math.PI * 2);
            ctx.fill();

            // Cost number
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(data.cost, sx, sy);
        }

        // Cover indicator (forest)
        if (hex.cover && !hex.unit && fogLevel === 'visible') {
            ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
            drawHex(sx, sy, state.hexSize * 0.95, 'rgba(139, 92, 246, 0.15)');
        }
    });

    // Draw path preview
    if (state.currentPath && state.selectedAction === 'move') {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();

        state.currentPath.forEach((point, index) => {
            const pos = hexToPixel(point.q, point.r, state.hexSize);
            const sx = state.offsetX + pos.x;
            const sy = state.offsetY + pos.y;

            if (index === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });

        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw attack line
    if (currentUnit && state.targetedUnit && state.selectedAction === 'attack') {
        const fromPos = hexToPixel(currentUnit.q, currentUnit.r, state.hexSize);
        const toPos = hexToPixel(state.targetedUnit.q, state.targetedUnit.r, state.hexSize);

        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 6]);
        ctx.beginPath();
        ctx.moveTo(state.offsetX + fromPos.x, state.offsetY + fromPos.y);
        ctx.lineTo(state.offsetX + toPos.x, state.offsetY + toPos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // Draw units
    state.units.forEach(unit => {
        if (!unit.alive) return;

        // Only draw visible units
        if (!isUnitVisible(unit)) return;

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

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.arc(sx, sy, rangeRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}
