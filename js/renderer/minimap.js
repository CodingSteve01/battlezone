// ===== MINIMAP MODULE =====
// Strategic minimap showing terrain, units, and zone

import { CONFIG, TERRAIN } from '../config.js';
import { state, isHexInZone, getTileSize } from '../state.js';
import { isAIPlayer } from '../ai.js';
import { getFogLevel, isUnitVisibleToViewer } from '../fogOfWar.js';
import { adjustColorForHeight, blendWithRed } from './colors.js';

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

// Track if minimap is being interacted with
let minimapActive = false;
let minimapExpanded = false;  // Track expanded/fullscreen state

export function setMinimapActive(active) { minimapActive = active; }
export function isMinimapExpanded() { return minimapExpanded; }
export function setMinimapExpanded(expanded) {
    minimapExpanded = expanded;
    // Hide/show bottom UI panel in tactical briefing mode
    const unitPanel = document.querySelector('.unit-panel');
    if (unitPanel) {
        unitPanel.style.display = expanded ? 'none' : '';
    }
}

// Store last drawn minimap bounds for click detection
let lastMinimapBounds = { x: 0, y: 0, size: 0, centerX: 0, centerY: 0, hexSize: 0, hidden: false, expanded: false };
export function getMinimapBounds() { return lastMinimapBounds; }

// Store toggle button bounds for click detection
let toggleButtonBounds = { x: 0, y: 0, size: 24 };
export function getToggleButtonBounds() { return toggleButtonBounds; }

// Store height overlay toggle bounds for click detection
let heightOverlayButtonBounds = { x: 0, y: 0, size: 0, hidden: true };
export function getHeightOverlayButtonBounds() { return heightOverlayButtonBounds; }

// Store close button bounds for expanded minimap
let closeButtonBounds = { x: 0, y: 0, size: 32 };
export function getCloseButtonBounds() { return closeButtonBounds; }

/**
 * Draw minimap expand button (to open expanded view)
 */
function drawMinimapExpandButton(ctx, mapX, mapY, mapSize) {
    const btnSize = 24;
    const btnX = mapX + mapSize - btnSize - 4;
    const btnY = mapY + 4;

    // Store bounds for click detection
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

    // Expand icon (⤢ or similar)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const padding = 6;
    // Draw expand arrows (top-right and bottom-left corners)
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
function drawMinimapCloseButton(ctx, mapX, mapY, mapSize) {
    const btnSize = 32;
    const btnX = mapX + mapSize - btnSize - 8;
    const btnY = mapY + 8;

    // Store bounds for click detection
    closeButtonBounds = { x: btnX, y: btnY, size: btnSize };

    ctx.save();

    // Button background - dark with red tint
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
 * Draw height overlay toggle button (debug overlay)
 */
export function drawHeightOverlayToggle(ctx) {
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

/**
 * Draw legend for expanded minimap showing terrain types, units, and height
 */
function drawMinimapLegend(ctx, legendX, legendY, availableWidth) {
    // Only draw legend if there's enough space
    if (availableWidth < 80) return;

    const lineHeight = 18;
    const dotSize = 6;
    let currentY = legendY;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('LEGENDE', legendX, currentY);
    currentY += lineHeight + 4;

    // Terrain types
    ctx.font = '10px sans-serif';
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
        // Color dot
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX + dotSize, currentY, dotSize, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(item.name, legendX + dotSize * 2 + 6, currentY);
        currentY += lineHeight;
    });

    currentY += 8;

    // Units section
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('EINHEITEN', legendX, currentY);
    currentY += lineHeight;

    ctx.font = '10px sans-serif';

    // Own units
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(legendX + dotSize, currentY, dotSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Eigene', legendX + dotSize * 2 + 6, currentY);
    currentY += lineHeight;

    // Enemy units
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(legendX + dotSize, currentY, dotSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Feinde', legendX + dotSize * 2 + 6, currentY);
    currentY += lineHeight + 8;

    // Height gradient
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('HÖHE', legendX, currentY);
    currentY += lineHeight;

    // Draw height gradient bar
    const gradientWidth = Math.min(60, availableWidth - 10);
    const gradientHeight = 10;

    // Create gradient from dark to light
    const gradient = ctx.createLinearGradient(legendX, currentY, legendX + gradientWidth, currentY);
    gradient.addColorStop(0, adjustColorForHeight('#4a7c4e', 0, 3));
    gradient.addColorStop(0.5, adjustColorForHeight('#4a7c4e', 1.5, 3));
    gradient.addColorStop(1, adjustColorForHeight('#4a7c4e', 3, 3));

    ctx.fillStyle = gradient;
    ctx.fillRect(legendX, currentY - gradientHeight / 2, gradientWidth, gradientHeight);

    // Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Tief', legendX, currentY + gradientHeight);
    ctx.textAlign = 'right';
    ctx.fillText('Hoch', legendX + gradientWidth, currentY + gradientHeight);

    ctx.restore();
}

/**
 * Draw horizontal legend for portrait mode (below the minimap)
 * Compact layout using icon groups
 */
function drawMinimapLegendHorizontal(ctx, legendX, legendY, availableWidth) {
    if (availableWidth < 200) return;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '10px sans-serif';

    const dotSize = 5;
    const itemSpacing = 50;
    let currentX = legendX;
    const currentY = legendY;

    // Key terrain types in a row
    const terrainItems = [
        { name: 'Gras', color: TERRAIN.grass.color },
        { name: 'Wald', color: TERRAIN.forest.color },
        { name: 'Hügel', color: TERRAIN.hills.color },
        { name: 'Wasser', color: TERRAIN.water.color },
        { name: 'Fels', color: TERRAIN.rock.color }
    ];

    terrainItems.forEach(item => {
        if (currentX + itemSpacing > legendX + availableWidth) return;

        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(currentX + dotSize, currentY, dotSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(item.name, currentX + dotSize * 2 + 4, currentY);
        currentX += itemSpacing;
    });

    // Unit indicators in second row
    const unitY = legendY + 20;
    currentX = legendX;

    // Own units
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(currentX + dotSize, unitY, dotSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Eigene', currentX + dotSize * 2 + 4, unitY);
    currentX += itemSpacing;

    // Enemy units
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(currentX + dotSize, unitY, dotSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Feinde', currentX + dotSize * 2 + 4, unitY);

    ctx.restore();
}

/**
 * Draw strategic minimap showing terrain, units, and zone
 * Supports both compact (corner) and expanded (center) modes
 * - Shows all terrain
 * - Shows own units (including eliminated ones marked with X)
 * - Shows enemies only when visible
 * - Shows shrinking zone boundary
 * - Shows viewport rectangle with correct zoom level
 */
export function drawMinimap(ctx, w, h) {
    if (state.hexes.length === 0) return;

    // Hide minimap during AI turn in single-player to prevent revealing enemy positions
    const isAiTurn = isAIPlayer() && state.currentPlayer !== state.viewingPlayer;
    if (isAiTurn) {
        // Update bounds to indicate minimap is hidden
        lastMinimapBounds = { x: 0, y: 0, size: 0, centerX: 0, centerY: 0, hexSize: 0, hidden: true, expanded: false };
        return;
    }

    const config = MINIMAP_CONFIG;
    const isExpanded = minimapExpanded;

    // Determine size and position based on mode
    let size, x, y;
    let legendWidth = 0;  // Space reserved for legend
    if (isExpanded) {
        // Expanded mode: use available space between top bar and bottom UI
        const padding = 8;  // Minimal padding from edges
        const topOffset = 55;  // Space for top bar (player info, round, AP)
        const isLandscape = w > h;
        // Portrait needs more space below for hint text + horizontal legend (2 rows)
        const bottomOffset = isLandscape ? 60 : 100;

        // Reserve space for legend - on right side for landscape, below for portrait
        legendWidth = isLandscape ? 110 : 0;

        const availableWidth = Math.max(0, w - padding * 2 - legendWidth);
        const availableHeight = Math.max(0, h - topOffset - bottomOffset);
        // Use available space - take the smaller of width/height to maintain square aspect
        size = Math.min(availableWidth, availableHeight);
        if (size <= 0) return;

        // Position map: left-aligned with legend on right for landscape, centered for portrait
        if (isLandscape) {
            x = (w - size - legendWidth) / 2;
        } else {
            x = (w - size) / 2;
        }
        y = topOffset + (availableHeight - size) / 2;
    } else {
        // Compact mode: top-left corner
        size = config.SIZE;
        x = config.PADDING;
        y = config.PADDING + 55; // Offset for top bar
    }

    // Store bounds for interaction
    lastMinimapBounds = {
        x, y, size,
        centerX: x + size / 2,
        centerY: y + size / 2,
        hexSize: 0,
        hidden: false, // Compact minimap is always visible
        expanded: isExpanded
    };

    ctx.save();

    // In expanded mode, draw dark backdrop
    if (isExpanded) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);
    }

    // Use higher opacity for expanded mode or when interacting
    ctx.globalAlpha = isExpanded ? 1.0 : (minimapActive ? config.OPACITY_ACTIVE : config.OPACITY);

    // Background with rounded corners - solid for expanded mode
    ctx.fillStyle = isExpanded ? 'rgba(15, 15, 25, 1.0)' : 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, size + 6, size + 6, isExpanded ? 12 : 6);
    ctx.fill();

    // Border - highlight when expanded or active
    ctx.strokeStyle = isExpanded ? 'rgba(16, 185, 129, 0.9)' : (minimapActive ? 'rgba(16, 185, 129, 0.8)' : 'rgba(255, 255, 255, 0.25)');
    ctx.lineWidth = isExpanded ? 3 : (minimapActive ? 2 : 1);
    ctx.stroke();

    // Calculate scale to fit map in minimap
    const mapRadius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    const hexSize = isExpanded
        ? Math.min(size / 2 / (mapRadius * 1.8), 8)  // Larger hexes for expanded view
        : Math.min(config.HEX_SIZE, (size / 2) / (mapRadius * 1.8));

    // Center of minimap
    const centerX = x + size / 2;
    const centerY = y + size / 2;

    // Clip to minimap area
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, size + 6, size + 6, isExpanded ? 12 : 6);
    ctx.clip();

    // Update bounds with hexSize for click detection
    lastMinimapBounds.hexSize = hexSize;

    // Draw all hexes - render terrain with visibility-based darkening
    state.hexes.forEach(hex => {
        const terrain = TERRAIN[hex.type];
        if (!terrain) return;

        // Convert hex coords to minimap pixel position
        const px = centerX + hex.q * hexSize * 1.5;
        const py = centerY + (hex.r + hex.q * 0.5) * hexSize * Math.sqrt(3);

        // Check if hex is outside the safe zone
        const outsideZone = state.zoneRadius > 0 && state.zoneRadius < state.maxZoneRadius && !isHexInZone(hex.q, hex.r);

        // Apply height-based brightness adjustment to terrain color
        const heightAdjustedColor = adjustColorForHeight(terrain.color, hex.height || 0, CONFIG.HEIGHT.MAX);

        // Apply zone coloring if outside
        let baseColor = outsideZone ? blendWithRed(heightAdjustedColor, 0.3) : heightAdjustedColor;

        // Darken based on fog level (scale RGB toward black - shadow effect)
        // Minimap uses HALF the darkness of the main view for better readability
        const fogLevel = getFogLevel(hex.q, hex.r);
        let brightness = 1.0;
        if (fogLevel === 'hidden') {
            brightness = 0.5;  // Half as dark as main view (0.12 → 0.5)
        } else if (fogLevel === 'explored') {
            brightness = 0.6;  // Half as dark as main view (0.25 → 0.6)
        }

        // Apply brightness directly to color
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

        // Add red border for hexes outside zone (only if visible enough)
        if (outsideZone && fogLevel !== 'hidden') {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
            ctx.lineWidth = isExpanded ? 1.5 : 1;
            ctx.stroke();
        }
    });

    // Draw shrinking zone boundary (if active)
    if (state.zoneRadius > 0 && state.zoneRadius < state.maxZoneRadius) {
        // Draw zone circle
        const zoneRadiusPx = state.zoneRadius * hexSize * 1.8;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = isExpanded ? 3 : 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, zoneRadiusPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw units
    const currentPlayer = state.viewingPlayer;
    const unitDotSize = isExpanded ? hexSize * 2 : hexSize * 1.5;

    // First, draw eliminated friendly units (grayed out with X)
    state.units.forEach(unit => {
        if (unit.player !== currentPlayer) return;
        if (unit.alive) return; // Skip alive units for now

        const px = centerX + unit.q * hexSize * 1.5;
        const py = centerY + (unit.r + unit.q * 0.5) * hexSize * Math.sqrt(3);

        // Draw eliminated unit marker
        ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
        ctx.beginPath();
        ctx.arc(px, py, hexSize * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Draw X over eliminated unit
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

    // Draw alive friendly units
    state.units.forEach(unit => {
        if (unit.player !== currentPlayer || !unit.alive) return;

        const px = centerX + unit.q * hexSize * 1.5;
        const py = centerY + (unit.r + unit.q * 0.5) * hexSize * Math.sqrt(3);

        // Draw unit dot with player color
        ctx.fillStyle = CONFIG.PLAYER_COLORS[unit.player];
        ctx.beginPath();
        ctx.arc(px, py, unitDotSize, 0, Math.PI * 2);
        ctx.fill();

        // White outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isExpanded ? 2 : 1;
        ctx.stroke();
    });

    // Draw visible enemy units
    state.units.forEach(unit => {
        if (unit.player === currentPlayer || !unit.alive) return;

        // Check if enemy is visible
        if (!isUnitVisibleToViewer(unit)) return;

        const px = centerX + unit.q * hexSize * 1.5;
        const py = centerY + (unit.r + unit.q * 0.5) * hexSize * Math.sqrt(3);

        // Draw enemy unit dot
        ctx.fillStyle = CONFIG.PLAYER_COLORS[unit.player];
        ctx.beginPath();
        ctx.arc(px, py, unitDotSize, 0, Math.PI * 2);
        ctx.fill();

        // Red hostile outline
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = isExpanded ? 2.5 : 1.5;
        ctx.stroke();
    });

    // Draw current viewport indicator
    // Scale factor from main view to minimap coordinates
    const scale = hexSize / getTileSize();

    // Viewport center position on minimap
    const viewX = centerX - state.cameraX * scale;
    const viewY = centerY - state.cameraY * scale;

    // Viewport size on minimap (canvas dimensions scaled to minimap)
    const viewportW = state.canvasWidth * scale;
    const viewportH = state.canvasHeight * scale;

    // Viewport rectangle - more visible in expanded mode
    ctx.strokeStyle = isExpanded ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = isExpanded ? 2 : 1;
    ctx.strokeRect(
        viewX - viewportW / 2,
        viewY - viewportH / 2,
        viewportW,
        viewportH
    );

    // Semi-transparent fill for viewport area in expanded mode
    if (isExpanded) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(
            viewX - viewportW / 2,
            viewY - viewportH / 2,
            viewportW,
            viewportH
        );
    }

    ctx.restore();

    // Draw label and close button outside the clip region
    ctx.save();
    if (isExpanded) {
        const isLandscape = w > h;

        // Title for expanded view
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('KARTE', x + size / 2, y - 15);

        // Hint text
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText('Tippe um den Viewport zu verschieben', x + size / 2, y + size + 20);

        // Draw legend - position depends on orientation
        if (isLandscape) {
            // Landscape: legend on the right side of the map
            drawMinimapLegend(ctx, x + size + 15, y, legendWidth - 15);
        } else {
            // Portrait: legend below the map (compact horizontal layout)
            drawMinimapLegendHorizontal(ctx, x, y + size + 40, size);
        }

        // Draw close button
        drawMinimapCloseButton(ctx, x, y, size);
    } else {
        // Label for compact view
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('KARTE', x + size / 2, y - 8);

        // Draw expand button for compact view
        drawMinimapExpandButton(ctx, x, y, size);
    }
    ctx.restore();
}
