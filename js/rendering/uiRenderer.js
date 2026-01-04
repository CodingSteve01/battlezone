// ===== UI OVERLAY RENDERER =====
// UI overlay elements for the game canvas
// Extracted from renderer.js for better modularity

import { state, getTileSize, getTileZOffset, zoomLevelToScale } from '../state.js';
import { CONFIG } from '../config.js';
import { POWERUP_TYPES } from '../powerups.js';
import { getCurrentEvent } from '../events.js';

// ===== MODULE STATE =====

let ctx = null;

/**
 * Initialize the UI renderer with canvas context
 * @param {CanvasRenderingContext2D} context - Canvas 2D context
 */
export function initUiRenderer(context) {
    ctx = context;
}

// ===== SCROLL HINT =====

/**
 * Draw scroll hint arrows at canvas edges when map extends beyond viewport
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 */
export function drawScrollHint(w, h) {
    if (!state.hexes.length) return;

    // Check if map extends beyond viewport
    const radius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    const tileSize = getTileSize();
    const mapPixelRadius = radius * tileSize * 1.8 + getTileZOffset(CONFIG.HEIGHT.MAX, tileSize);

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

// ===== POWERUP RENDERING =====

/**
 * Draw a power-up on the map
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {Object} powerup - Powerup object with type, q, r
 * @param {number} size - Tile size
 */
export function drawPowerup(cx, cy, powerup, size) {
    const powerupType = POWERUP_TYPES[powerup.type];
    if (!powerupType) return;

    ctx.save();
    const powerupSize = size * 0.5;

    // Floating animation offset
    const floatOffset = Math.sin(Date.now() / 400 + powerup.q + powerup.r) * 3;

    // Glow effect
    ctx.shadowColor = powerupType.color;
    ctx.shadowBlur = 15;

    // Background circle
    ctx.fillStyle = powerupType.color + '40';
    ctx.beginPath();
    ctx.arc(cx, cy + floatOffset, powerupSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = powerupType.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Icon
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(powerupSize * 0.45)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerupType.icon, cx, cy + floatOffset);

    ctx.restore();
}

// ===== EVENT INDICATOR =====

/**
 * Draw active event indicator in corner
 * @param {number} w - Canvas width
 * @param {number} _h - Canvas height (unused)
 */
export function drawEventIndicator(w, _h) {
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

// ===== ZOOM INDICATOR =====

/**
 * Draw zoom level indicator in bottom-left corner
 * @param {number} _w - Canvas width (unused)
 * @param {number} h - Canvas height
 */
export function drawZoomIndicator(_w, h) {
    const zoomScale = zoomLevelToScale(state.zoomLevel);
    // Only show if zoom is not at default
    if (Math.abs(zoomScale - 1.0) < 0.05) return;

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
    const zoomPercent = Math.round(zoomScale * 100);
    ctx.fillText(`🔍 ${zoomPercent}%`, x + 35, y + 15);

    ctx.restore();
}
