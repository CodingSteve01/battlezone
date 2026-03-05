// ===== TERRAIN RENDERER =====
// Handles terrain-related rendering: background, hex data collection, overlays

import { state, getTileScreenPosition } from '../state.js';
import { TERRAIN } from '../config.js';
import { getCachedFogLevel } from './fogCache.js';
import { getTerrainTileInfo } from '../assetLoader.js';
import { safeRadialGradient, safeLinearGradient } from './renderUtils.js';
import { drawHexPath } from './effectsRenderer.js';

// ===== BACKGROUND RENDERING =====

/**
 * Render the canvas background with gradient
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 */
export function renderBackground(ctx, w, h) {
    if (state.effectiveQuality === 'low') {
        ctx.fillStyle = '#12122b';
        ctx.fillRect(0, 0, w, h);
    } else {
        // Background with modern gradient
        const bgGradient = safeRadialGradient(ctx, w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8, '#12122b');
        if (typeof bgGradient !== 'string') {
            bgGradient.addColorStop(0, '#1a1a3e');
            bgGradient.addColorStop(0.5, '#12122b');
            bgGradient.addColorStop(1, '#0c0c1d');
        }
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, w, h);

        // Subtle ambient glow - only on high quality
        if (state.effectiveQuality === 'high') {
            ctx.save();
            ctx.globalAlpha = 0.1;
            const ambientGlow = safeRadialGradient(ctx, w * 0.3, h * 0.3, 0, w * 0.3, h * 0.3, w * 0.5, 'transparent');
            if (typeof ambientGlow !== 'string') {
                ambientGlow.addColorStop(0, '#10b981');
                ambientGlow.addColorStop(1, 'transparent');
            }
            ctx.fillStyle = ambientGlow;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }
    }
}

// ===== HEX DATA COLLECTION =====

/**
 * Collect visible hex data for rendering with culling
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {number} tileSize - Current tile size
 * @returns {Array} Array of visible hex data objects
 */
export function collectVisibleHexData(w, h, tileSize) {
    // Get earth layer height for proper viewport culling
    const tileInfo = getTerrainTileInfo();
    const hexSurfaceHeight = tileSize * Math.sqrt(3);
    const earthLayerScaled = tileInfo && tileInfo.earthLayerHeight > 0
        ? tileInfo.earthLayerHeight * (hexSurfaceHeight / tileInfo.hexHeight)
        : 0;

    const visibleHexData = [];

    for (const hex of state.hexes) {
        const pos = getTileScreenPosition(hex.q, hex.r, hex.height, tileSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;
        // Calculate base Y position (without height offset) for 3D system
        const baseY = sy + pos.zOffset;
        const cullMargin = tileSize * 2 + pos.zOffset + earthLayerScaled;

        // Skip if off screen (with margin)
        if (sx < -cullMargin || sx > w + cullMargin ||
            sy < -cullMargin || sy > h + cullMargin) {
            continue;
        }

        const fogLevel = getCachedFogLevel(hex.q, hex.r);
        const terrain = TERRAIN[hex.type];

        visibleHexData.push({
            hex,
            sx,
            sy,
            baseY,
            fogLevel,
            terrain,
            zOffset: pos.zOffset
        });
    }

    return visibleHexData;
}

// ===== ZONE RENDERING =====

/**
 * Draw shrinking zone danger overlay on a hex
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} sx - Screen X position
 * @param {number} sy - Screen Y position
 * @param {number} tileSize - Tile size
 */
export function drawZoneDangerOverlay(ctx, sx, sy, tileSize) {
    ctx.save();
    ctx.beginPath();
    drawHexPath(sx, sy, tileSize);
    const zoneGradient = safeRadialGradient(ctx, sx, sy, 0, sx, sy, tileSize, 'rgba(220, 38, 38, 0.25)');
    if (typeof zoneGradient !== 'string') {
        zoneGradient.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
        zoneGradient.addColorStop(0.6, 'rgba(220, 38, 38, 0.25)');
        zoneGradient.addColorStop(1, 'rgba(185, 28, 28, 0.35)');
    }
    ctx.fillStyle = zoneGradient;
    ctx.fill();

    // Pulsing red border for danger zone edge
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

/**
 * Draw zone warning border on a hex
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} sx - Screen X position
 * @param {number} sy - Screen Y position
 * @param {number} tileSize - Tile size
 */
export function drawZoneWarningBorder(ctx, sx, sy, tileSize) {
    ctx.save();
    ctx.beginPath();
    drawHexPath(sx, sy, tileSize);
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
}

// ===== MOVEMENT RANGE HIGHLIGHTING =====

/**
 * Get color for movement range highlight based on AP cost
 * @param {number} totalPathCost - Total AP cost to reach the hex
 * @param {boolean} offersCover - Whether the hex provides cover
 * @returns {Object} { fillColor, strokeColor }
 */
export function getMovementRangeColors(totalPathCost, offersCover) {
    if (totalPathCost <= 2) {
        // Green - close/cheap to reach
        return {
            fillColor: offersCover ? 'rgba(16, 185, 129, 0.4)' : 'rgba(34, 197, 94, 0.3)',
            strokeColor: offersCover ? 'rgba(16, 185, 129, 0.85)' : 'rgba(34, 197, 94, 0.7)'
        };
    } else if (totalPathCost <= 4) {
        // Yellow/Orange - medium distance
        return {
            fillColor: offersCover ? 'rgba(234, 179, 8, 0.45)' : 'rgba(251, 191, 36, 0.35)',
            strokeColor: offersCover ? 'rgba(234, 179, 8, 0.9)' : 'rgba(251, 191, 36, 0.75)'
        };
    } else {
        // Red - far/expensive (5+ AP)
        return {
            fillColor: offersCover ? 'rgba(239, 68, 68, 0.45)' : 'rgba(248, 113, 113, 0.35)',
            strokeColor: offersCover ? 'rgba(239, 68, 68, 0.9)' : 'rgba(248, 113, 113, 0.75)'
        };
    }
}

/**
 * Draw movement range highlight on a hex
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} sx - Screen X position
 * @param {number} sy - Screen Y position
 * @param {number} tileSize - Tile size
 * @param {number} totalPathCost - Total AP cost
 * @param {boolean} offersCover - Whether hex provides cover
 */
export function drawMovementRangeHighlight(ctx, sx, sy, tileSize, totalPathCost, offersCover) {
    const { fillColor, strokeColor } = getMovementRangeColors(totalPathCost, offersCover);

    ctx.beginPath();
    drawHexPath(sx, sy, tileSize * 0.88);
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = offersCover ? 3 : 2.5;
    ctx.stroke();
}

// ===== ATTACK LINE RENDERING =====

/**
 * Draw attack targeting line between two positions
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} fromX - Start X
 * @param {number} fromY - Start Y
 * @param {number} toX - End X
 * @param {number} toY - End Y
 */
export function drawAttackLine(ctx, fromX, fromY, toX, toY) {
    const gradient = safeLinearGradient(ctx, fromX, fromY, toX, toY, 'rgba(239, 68, 68, 0.6)');
    if (typeof gradient !== 'string') {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
        gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.8)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
    }

    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

/**
 * Draw attack range indicator circle
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} sx - Center X
 * @param {number} sy - Center Y
 * @param {number} rangeRadius - Radius of the range circle
 */
export function drawAttackRangeIndicator(ctx, sx, sy, rangeRadius) {
    // Fill area for better visibility
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.beginPath();
    ctx.arc(sx, sy, rangeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Gradient range circle - more visible
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 8]);
    ctx.beginPath();
    ctx.arc(sx, sy, rangeRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner glow - stronger
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(sx, sy, rangeRadius - 5, 0, Math.PI * 2);
    ctx.stroke();
}

// ===== COVER ICON RENDERING =====

/**
 * Draw cover shield icon at position
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} sx - Center X
 * @param {number} sy - Center Y
 * @param {number} assetSize - Asset size for scaling
 */
export function drawCoverIcon(ctx, sx, sy, assetSize) {
    const iconSize = assetSize * 0.22;
    const iconY = sy - assetSize * 0.3;

    ctx.save();

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    // Shield shape path
    ctx.beginPath();
    ctx.moveTo(sx, iconY - iconSize);
    ctx.lineTo(sx + iconSize * 0.85, iconY - iconSize * 0.6);
    ctx.lineTo(sx + iconSize * 0.85, iconY + iconSize * 0.2);
    ctx.quadraticCurveTo(sx + iconSize * 0.4, iconY + iconSize * 0.8, sx, iconY + iconSize);
    ctx.quadraticCurveTo(sx - iconSize * 0.4, iconY + iconSize * 0.8, sx - iconSize * 0.85, iconY + iconSize * 0.2);
    ctx.lineTo(sx - iconSize * 0.85, iconY - iconSize * 0.6);
    ctx.closePath();

    // Fill with gradient
    const gradient = ctx.createLinearGradient(sx - iconSize, iconY - iconSize, sx + iconSize, iconY + iconSize);
    gradient.addColorStop(0, '#4ade80');
    gradient.addColorStop(1, '#16a34a');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Border
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
}

// ===== AP COST OVERLAY =====

/**
 * Draw AP cost overlay on a hex
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} sx - Center X
 * @param {number} sy - Center Y
 * @param {number} tileSize - Tile size
 * @param {number} cost - AP cost
 * @param {boolean} offersCover - Whether hex provides cover
 */
export function drawAPCostOverlay(ctx, sx, sy, tileSize, cost, offersCover) {
    // Background pill for cost
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(sx - tileSize * 0.2, sy + tileSize * 0.35, tileSize * 0.4, tileSize * 0.26, 5);
    ctx.fill();

    // Cost number
    ctx.fillStyle = offersCover ? '#10b981' : '#22c55e';
    ctx.font = `bold ${Math.round(tileSize * 0.22)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${cost}`, sx, sy + tileSize * 0.48);
}
