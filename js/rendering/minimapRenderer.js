// ===== MINIMAP RENDERER =====
// Extracted from renderer.js for better modularity
// Handles all minimap drawing and interaction bounds

import { CONFIG, TERRAIN } from '../config.js';
import { state, isHexInZone, getTileSize } from '../state.js';
import { getFogLevel, isUnitVisibleToViewer } from '../fogOfWar.js';
import { isAIPlayer } from '../shared/gameMode.js';

// Canvas context - initialized via initMinimapRenderer()
let ctx = null;

/**
 * Initialize the minimap renderer with canvas context
 * @param {CanvasRenderingContext2D} context - The canvas 2D context
 */
export function initMinimapRenderer(context) {
    ctx = context;
}

// ===== CONFIGURATION =====

/**
 * Minimap configuration - exported for interaction handling
 */
export const MINIMAP_CONFIG = {
    SIZE: 90,            // Minimap size in pixels (compact for mobile)
    PADDING: 8,          // Padding from screen edge
    HEX_SIZE: 3,         // Size of each hex on minimap
    OPACITY: 0.5,        // Base opacity (more transparent)
    OPACITY_ACTIVE: 0.95, // Opacity when touched/hovered
    POSITION: 'top-left' // Position on screen
};

// ===== STATE =====

// Track if minimap is being interacted with
let minimapActive = false;
let minimapExpanded = false;

// Store last drawn minimap bounds for click detection
let lastMinimapBounds = {
    x: 0, y: 0, size: 0,
    centerX: 0, centerY: 0,
    hexSize: 0, hidden: false, expanded: false
};

// Store toggle button bounds for click detection
let toggleButtonBounds = { x: 0, y: 0, size: 24 };

// Store height overlay toggle bounds for click detection
let heightOverlayButtonBounds = { x: 0, y: 0, size: 0, hidden: true };

// Store close button bounds for expanded minimap
let closeButtonBounds = { x: 0, y: 0, size: 32 };

// ===== STATE ACCESSORS =====

export function setMinimapActive(active) {
    minimapActive = active;
}

export function isMinimapExpanded() {
    return minimapExpanded;
}

export function setMinimapExpanded(expanded) {
    minimapExpanded = expanded;
    // Hide/show bottom UI panel in tactical briefing mode
    const unitPanel = document.querySelector('.unit-panel');
    if (unitPanel) {
        unitPanel.style.display = expanded ? 'none' : '';
    }
}

export function getMinimapBounds() {
    return lastMinimapBounds;
}

export function getToggleButtonBounds() {
    return toggleButtonBounds;
}

export function getHeightOverlayButtonBounds() {
    return heightOverlayButtonBounds;
}

export function getCloseButtonBounds() {
    return closeButtonBounds;
}

// ===== COLOR HELPERS =====

/**
 * Blend a color with red for danger zone indication
 * @param {string} color - Hex or rgb color string
 * @param {number} amount - 0 = original, 1 = full red
 * @returns {string} RGB color string
 */
function blendWithRed(color, amount) {
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
    G = Math.round(G + (68 - G) * amount * 0.7);
    B = Math.round(B + (68 - B) * amount * 0.7);

    return `rgb(${R},${G},${B})`;
}

/**
 * Adjust color brightness based on height for minimap visualization
 * Height 0 = darkest, Height 3 = brightest
 * @param {string} color - Hex color string
 * @param {number} height - Height value (0-3)
 * @param {number} maxHeight - Maximum height (default 3)
 * @returns {string} Hex color string
 */
function adjustColorForHeight(color, height, maxHeight = 3) {
    const num = parseInt(color.replace('#', ''), 16);
    let R = (num >> 16) & 0xFF;
    let G = (num >> 8) & 0xFF;
    let B = num & 0xFF;

    // Map height to brightness factor: 0.7 (low) to 1.2 (high)
    const brightnessFactor = 0.7 + (height / maxHeight) * 0.5;

    R = Math.min(255, Math.round(R * brightnessFactor));
    G = Math.min(255, Math.round(G * brightnessFactor));
    B = Math.min(255, Math.round(B * brightnessFactor));

    return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

// ===== BUTTON DRAWING =====

/**
 * Draw minimap expand button (to open expanded view)
 */
function drawMinimapExpandButton(mapX, mapY, mapSize) {
    const btnSize = 24;
    const btnX = mapX + mapSize - btnSize - 4;
    const btnY = mapY + 4;

    toggleButtonBounds = { x: btnX, y: btnY, size: btnSize };

    ctx.save();
    ctx.globalAlpha = 0.8;

    // Button background
    ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnSize, btnSize, 4);
    ctx.fill();

    // Button border
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Expand icon
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const padding = 6;

    ctx.beginPath();
    // Top-right corner arrow
    ctx.moveTo(btnX + btnSize - padding - 4, btnY + padding);
    ctx.lineTo(btnX + btnSize - padding, btnY + padding);
    ctx.lineTo(btnX + btnSize - padding, btnY + padding + 4);
    // Bottom-left corner arrow
    ctx.moveTo(btnX + padding + 4, btnY + btnSize - padding);
    ctx.lineTo(btnX + padding, btnY + btnSize - padding);
    ctx.lineTo(btnX + padding, btnY + btnSize - padding - 4);
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw close button for expanded minimap
 */
function drawMinimapCloseButton(mapX, mapY, mapSize) {
    const btnSize = 32;
    const btnX = mapX + mapSize - btnSize - 8;
    const btnY = mapY + 8;

    closeButtonBounds = { x: btnX, y: btnY, size: btnSize };

    ctx.save();

    // Button background
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnSize, btnSize, 6);
    ctx.fill();

    // Button border
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // X icon
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const padding = 10;

    ctx.beginPath();
    ctx.moveTo(btnX + padding, btnY + padding);
    ctx.lineTo(btnX + btnSize - padding, btnY + btnSize - padding);
    ctx.moveTo(btnX + btnSize - padding, btnY + padding);
    ctx.lineTo(btnX + padding, btnY + btnSize - padding);
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw height overlay toggle button
 */
export function drawHeightOverlayToggle() {
    if (minimapExpanded) {
        heightOverlayButtonBounds = { x: 0, y: 0, size: 0, hidden: true };
        return;
    }

    const btnSize = 24;
    const padding = 6;
    const mapBounds = lastMinimapBounds;
    const btnX = mapBounds.x;
    const btnY = mapBounds.y + mapBounds.size + padding;

    heightOverlayButtonBounds = { x: btnX, y: btnY, size: btnSize, hidden: false };

    ctx.save();
    const active = state.debug.showHeightOverlay;
    ctx.globalAlpha = 0.85;

    ctx.fillStyle = active ? 'rgba(59, 130, 246, 0.35)' : 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnSize, btnSize, 5);
    ctx.fill();

    ctx.strokeStyle = active ? 'rgba(59, 130, 246, 0.9)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = active ? '#bfdbfe' : '#e5e7eb';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛰', btnX + btnSize / 2, btnY + btnSize / 2 + 1);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('HÖHE', btnX + btnSize / 2, btnY + btnSize + 2);

    ctx.restore();
}

// ===== LEGEND DRAWING =====

/**
 * Draw legend for expanded minimap (vertical layout for landscape)
 */
function drawMinimapLegend(legendCtx, legendX, legendY, availableWidth) {
    if (availableWidth < 80) return;

    const lineHeight = 18;
    const dotSize = 6;
    let currentY = legendY;

    legendCtx.save();
    legendCtx.textAlign = 'left';
    legendCtx.textBaseline = 'middle';

    // Title
    legendCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    legendCtx.font = 'bold 11px sans-serif';
    legendCtx.fillText('LEGENDE', legendX, currentY);
    currentY += lineHeight + 4;

    // Terrain types
    legendCtx.font = '10px sans-serif';
    const terrainItems = [
        { name: 'Gras', color: TERRAIN.grass.color },
        { name: 'Wald', color: TERRAIN.forest.color },
        { name: 'Hügel', color: TERRAIN.hills.color },
        { name: 'Wasser', color: TERRAIN.water.color },
        { name: 'Fels', color: TERRAIN.rock.color },
        { name: 'Sand', color: TERRAIN.sand.color },
        { name: 'Sumpf', color: TERRAIN.swamp.color }
    ];

    terrainItems.forEach(item => {
        legendCtx.fillStyle = item.color;
        legendCtx.beginPath();
        legendCtx.arc(legendX + dotSize, currentY, dotSize, 0, Math.PI * 2);
        legendCtx.fill();

        legendCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        legendCtx.fillText(item.name, legendX + dotSize * 2 + 6, currentY);
        currentY += lineHeight;
    });

    currentY += 8;

    // Units section
    legendCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    legendCtx.font = 'bold 11px sans-serif';
    legendCtx.fillText('EINHEITEN', legendX, currentY);
    currentY += lineHeight;

    legendCtx.font = '10px sans-serif';

    // Own units
    legendCtx.fillStyle = '#10b981';
    legendCtx.beginPath();
    legendCtx.arc(legendX + dotSize, currentY, dotSize, 0, Math.PI * 2);
    legendCtx.fill();
    legendCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    legendCtx.fillText('Eigene', legendX + dotSize * 2 + 6, currentY);
    currentY += lineHeight;

    // Enemy units
    legendCtx.fillStyle = '#ff4444';
    legendCtx.beginPath();
    legendCtx.arc(legendX + dotSize, currentY, dotSize, 0, Math.PI * 2);
    legendCtx.fill();
    legendCtx.strokeStyle = '#ff0000';
    legendCtx.lineWidth = 1.5;
    legendCtx.stroke();
    legendCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    legendCtx.fillText('Feinde', legendX + dotSize * 2 + 6, currentY);
    currentY += lineHeight + 8;

    // Height gradient
    legendCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    legendCtx.font = 'bold 11px sans-serif';
    legendCtx.fillText('HÖHE', legendX, currentY);
    currentY += lineHeight;

    const gradientWidth = Math.min(60, availableWidth - 10);
    const gradientHeight = 10;

    const gradient = legendCtx.createLinearGradient(
        legendX, currentY, legendX + gradientWidth, currentY
    );
    gradient.addColorStop(0, adjustColorForHeight('#4a7c4e', 0, 3));
    gradient.addColorStop(0.5, adjustColorForHeight('#4a7c4e', 1.5, 3));
    gradient.addColorStop(1, adjustColorForHeight('#4a7c4e', 3, 3));

    legendCtx.fillStyle = gradient;
    legendCtx.fillRect(legendX, currentY - gradientHeight / 2, gradientWidth, gradientHeight);

    legendCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    legendCtx.font = '9px sans-serif';
    legendCtx.textAlign = 'left';
    legendCtx.fillText('Tief', legendX, currentY + gradientHeight);
    legendCtx.textAlign = 'right';
    legendCtx.fillText('Hoch', legendX + gradientWidth, currentY + gradientHeight);

    legendCtx.restore();
}

/**
 * Draw horizontal legend for portrait mode (below the minimap)
 */
function drawMinimapLegendHorizontal(legendCtx, legendX, legendY, availableWidth) {
    if (availableWidth < 200) return;

    legendCtx.save();
    legendCtx.textAlign = 'left';
    legendCtx.textBaseline = 'middle';
    legendCtx.font = '10px sans-serif';

    const dotSize = 5;
    const itemSpacing = 50;
    let currentX = legendX;
    const currentY = legendY;

    const terrainItems = [
        { name: 'Gras', color: TERRAIN.grass.color },
        { name: 'Wald', color: TERRAIN.forest.color },
        { name: 'Hügel', color: TERRAIN.hills.color },
        { name: 'Wasser', color: TERRAIN.water.color },
        { name: 'Fels', color: TERRAIN.rock.color }
    ];

    terrainItems.forEach(item => {
        if (currentX + itemSpacing > legendX + availableWidth) return;

        legendCtx.fillStyle = item.color;
        legendCtx.beginPath();
        legendCtx.arc(currentX + dotSize, currentY, dotSize, 0, Math.PI * 2);
        legendCtx.fill();

        legendCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        legendCtx.fillText(item.name, currentX + dotSize * 2 + 4, currentY);
        currentX += itemSpacing;
    });

    // Unit indicators in second row
    const unitY = legendY + 20;
    currentX = legendX;

    legendCtx.fillStyle = '#10b981';
    legendCtx.beginPath();
    legendCtx.arc(currentX + dotSize, unitY, dotSize, 0, Math.PI * 2);
    legendCtx.fill();
    legendCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    legendCtx.fillText('Eigene', currentX + dotSize * 2 + 4, unitY);
    currentX += itemSpacing;

    legendCtx.fillStyle = '#ff4444';
    legendCtx.beginPath();
    legendCtx.arc(currentX + dotSize, unitY, dotSize, 0, Math.PI * 2);
    legendCtx.fill();
    legendCtx.strokeStyle = '#ff0000';
    legendCtx.lineWidth = 1.5;
    legendCtx.stroke();
    legendCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    legendCtx.fillText('Feinde', currentX + dotSize * 2 + 4, unitY);

    legendCtx.restore();
}

// ===== MAIN DRAWING =====

/**
 * Draw strategic minimap showing terrain, units, and zone
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 */
export function drawMinimap(w, h) {
    if (!ctx) return;
    if (state.hexes.length === 0) return;

    // Hide minimap during AI turn to prevent revealing enemy positions
    const isAiTurn = isAIPlayer() && state.currentPlayer !== state.viewingPlayer;
    if (isAiTurn) {
        lastMinimapBounds = {
            x: 0, y: 0, size: 0,
            centerX: 0, centerY: 0,
            hexSize: 0, hidden: true, expanded: false
        };
        return;
    }

    const config = MINIMAP_CONFIG;
    const isExpanded = minimapExpanded;

    // Calculate size and position
    let size, x, y;
    let legendWidth = 0;

    if (isExpanded) {
        const padding = 8;
        const topOffset = 55;
        const isLandscape = w > h;
        const bottomOffset = isLandscape ? 60 : 100;

        legendWidth = isLandscape ? 110 : 0;

        const availableWidth = Math.max(0, w - padding * 2 - legendWidth);
        const availableHeight = Math.max(0, h - topOffset - bottomOffset);
        size = Math.min(availableWidth, availableHeight);
        if (size <= 0) return;

        if (isLandscape) {
            x = (w - size - legendWidth) / 2;
        } else {
            x = (w - size) / 2;
        }
        y = topOffset + (availableHeight - size) / 2;
    } else {
        size = config.SIZE;
        x = config.PADDING;
        y = config.PADDING + 55;
    }

    // Store bounds for interaction
    lastMinimapBounds = {
        x, y, size,
        centerX: x + size / 2,
        centerY: y + size / 2,
        hexSize: 0,
        hidden: false,
        expanded: isExpanded
    };

    ctx.save();

    // Expanded mode backdrop
    if (isExpanded) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);
    }

    ctx.globalAlpha = isExpanded ? 1.0 : (minimapActive ? config.OPACITY_ACTIVE : config.OPACITY);

    // Background
    ctx.fillStyle = isExpanded ? 'rgba(15, 15, 25, 1.0)' : 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, size + 6, size + 6, isExpanded ? 12 : 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = isExpanded
        ? 'rgba(16, 185, 129, 0.9)'
        : (minimapActive ? 'rgba(16, 185, 129, 0.8)' : 'rgba(255, 255, 255, 0.25)');
    ctx.lineWidth = isExpanded ? 3 : (minimapActive ? 2 : 1);
    ctx.stroke();

    // Calculate hex scale
    const mapRadius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    const hexSize = isExpanded
        ? Math.min(size / 2 / (mapRadius * 1.8), 8)
        : Math.min(config.HEX_SIZE, (size / 2) / (mapRadius * 1.8));

    const centerX = x + size / 2;
    const centerY = y + size / 2;

    // Clip to minimap area
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, size + 6, size + 6, isExpanded ? 12 : 6);
    ctx.clip();

    lastMinimapBounds.hexSize = hexSize;

    // Draw terrain hexes
    drawMinimapTerrain(centerX, centerY, hexSize, isExpanded);

    // Draw zone boundary
    drawMinimapZone(centerX, centerY, hexSize, isExpanded);

    // Draw units
    drawMinimapUnits(centerX, centerY, hexSize, isExpanded);

    // Draw viewport indicator
    drawMinimapViewport(centerX, centerY, hexSize, isExpanded);

    ctx.restore();

    // Draw UI elements outside clip region
    drawMinimapUI(x, y, size, w, h, legendWidth, isExpanded);
}

/**
 * Draw terrain hexes on minimap
 */
function drawMinimapTerrain(centerX, centerY, hexSize, isExpanded) {
    state.hexes.forEach(hex => {
        const terrain = TERRAIN[hex.type];
        if (!terrain) return;

        const px = centerX + hex.q * hexSize * 1.5;
        const py = centerY + (hex.r + hex.q * 0.5) * hexSize * Math.sqrt(3);

        const outsideZone = state.zoneRadius > 0 &&
            state.zoneRadius < state.maxZoneRadius &&
            !isHexInZone(hex.q, hex.r);

        const heightAdjustedColor = adjustColorForHeight(
            terrain.color, hex.height || 0, CONFIG.HEIGHT.MAX
        );

        const baseColor = outsideZone
            ? blendWithRed(heightAdjustedColor, 0.3)
            : heightAdjustedColor;

        // Apply fog darkness (minimap uses half the main view darkness)
        const fogLevel = getFogLevel(hex.q, hex.r);
        let brightness = 1.0;
        if (fogLevel === 'hidden') {
            brightness = 0.5;
        } else if (fogLevel === 'explored') {
            brightness = 0.6;
        }

        const num = parseInt(baseColor.replace('#', ''), 16);
        const R = Math.round(((num >> 16) & 0xFF) * brightness);
        const G = Math.round(((num >> 8) & 0xFF) * brightness);
        const B = Math.round((num & 0xFF) * brightness);
        const finalColor = `rgb(${R},${G},${B})`;

        const dotRadius = hexSize * (isExpanded ? 0.9 : 0.8);

        ctx.beginPath();
        ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = finalColor;
        ctx.fill();

        if (outsideZone && fogLevel !== 'hidden') {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
            ctx.lineWidth = isExpanded ? 1.5 : 1;
            ctx.stroke();
        }
    });
}

/**
 * Draw zone boundary on minimap
 */
function drawMinimapZone(centerX, centerY, hexSize, isExpanded) {
    if (state.zoneRadius > 0 && state.zoneRadius < state.maxZoneRadius) {
        const zoneRadiusPx = state.zoneRadius * hexSize * 1.8;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = isExpanded ? 3 : 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, zoneRadiusPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

/**
 * Draw units on minimap
 */
function drawMinimapUnits(centerX, centerY, hexSize, isExpanded) {
    const currentPlayer = state.viewingPlayer;
    const unitDotSize = isExpanded ? hexSize * 2 : hexSize * 1.5;

    // Eliminated friendly units
    state.units.forEach(unit => {
        if (unit.player !== currentPlayer || unit.alive) return;

        const px = centerX + unit.q * hexSize * 1.5;
        const py = centerY + (unit.r + unit.q * 0.5) * hexSize * Math.sqrt(3);

        ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
        ctx.beginPath();
        ctx.arc(px, py, hexSize * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // X marker
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = isExpanded ? 2 : 1.5;
        const xSize = hexSize * 0.8;
        ctx.beginPath();
        ctx.moveTo(px - xSize, py - xSize);
        ctx.lineTo(px + xSize, py + xSize);
        ctx.moveTo(px + xSize, py - xSize);
        ctx.lineTo(px - xSize, py + xSize);
        ctx.stroke();
    });

    // Alive friendly units
    state.units.forEach(unit => {
        if (unit.player !== currentPlayer || !unit.alive) return;

        const px = centerX + unit.q * hexSize * 1.5;
        const py = centerY + (unit.r + unit.q * 0.5) * hexSize * Math.sqrt(3);

        ctx.fillStyle = CONFIG.PLAYER_COLORS[unit.player];
        ctx.beginPath();
        ctx.arc(px, py, unitDotSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isExpanded ? 2 : 1;
        ctx.stroke();
    });

    // Visible enemy units
    state.units.forEach(unit => {
        if (unit.player === currentPlayer || !unit.alive) return;
        if (!isUnitVisibleToViewer(unit)) return;

        const px = centerX + unit.q * hexSize * 1.5;
        const py = centerY + (unit.r + unit.q * 0.5) * hexSize * Math.sqrt(3);

        ctx.fillStyle = CONFIG.PLAYER_COLORS[unit.player];
        ctx.beginPath();
        ctx.arc(px, py, unitDotSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = isExpanded ? 2.5 : 1.5;
        ctx.stroke();
    });
}

/**
 * Draw viewport indicator on minimap
 */
function drawMinimapViewport(centerX, centerY, hexSize, isExpanded) {
    const scale = hexSize / getTileSize();
    const viewX = centerX - state.cameraX * scale;
    const viewY = centerY - state.cameraY * scale;
    const viewportW = state.canvasWidth * scale;
    const viewportH = state.canvasHeight * scale;

    ctx.strokeStyle = isExpanded ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = isExpanded ? 2 : 1;
    ctx.strokeRect(viewX - viewportW / 2, viewY - viewportH / 2, viewportW, viewportH);

    if (isExpanded) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(viewX - viewportW / 2, viewY - viewportH / 2, viewportW, viewportH);
    }
}

/**
 * Draw minimap UI elements (labels, buttons, legend)
 */
function drawMinimapUI(x, y, size, w, h, legendWidth, isExpanded) {
    ctx.save();

    if (isExpanded) {
        const isLandscape = w > h;

        // Title
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('KARTE', x + size / 2, y - 15);

        // Hint text
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText('Tippe um den Viewport zu verschieben', x + size / 2, y + size + 20);

        // Legend
        if (isLandscape) {
            drawMinimapLegend(ctx, x + size + 15, y, legendWidth - 15);
        } else {
            drawMinimapLegendHorizontal(ctx, x, y + size + 40, size);
        }

        drawMinimapCloseButton(x, y, size);
    } else {
        // Compact view label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('KARTE', x + size / 2, y - 8);

        drawMinimapExpandButton(x, y, size);
    }

    ctx.restore();
}
