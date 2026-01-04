// ===== HEX TILE CACHE RENDERER =====
// Handles hex tile caching, terrain texture rendering, and cache management

import { state } from '../state.js';
import { CONFIG, TERRAIN } from '../config.js';
import {
    getTexture,
    hasAnimatedTexture,
    getAnimatedTexture,
    getTerrainTileInfo
} from '../assetLoader.js';
import { safeLinearGradient } from './renderUtils.js';

// ===== CACHE CONFIGURATION =====

/**
 * Base hex size for caching - tiles are cached at this size and scaled when drawn
 * This prevents cache invalidation during zoom operations
 */
export const CACHE_BASE_HEX_SIZE = 60;

/**
 * Detail scaling for larger base tiles
 */
export const DETAIL_DENSITY_SCALE = Math.min(1, CACHE_BASE_HEX_SIZE / CONFIG.BASE_HEX_SIZE);

/**
 * Maximum number of cached tiles to prevent memory issues
 * A large map with full visibility needs ~500 tiles, plus 3 fog levels = 1500
 * Increased to accommodate separate earth/surface caches for two-pass rendering
 */
export const MAX_CACHE_SIZE = 3000;

// ===== CACHE STORAGE =====

/**
 * Cache for pre-rendered hex tiles
 * Key format: "${q},${r}_${fogLevel}_${quality}_${renderPass}"
 */
export const hexTileCache = new Map();

/**
 * Cache for pre-rendered foreground elements (trees, rocks, bushes)
 * Key format: "${q},${r}"
 */
export const foregroundCache = new Map();

/**
 * Track the current quality level for cache invalidation
 */
let cachedQualityLevel = null;

/**
 * Get the current cached quality level
 */
export function getCachedQualityLevel() {
    return cachedQualityLevel;
}

/**
 * Set the cached quality level
 */
export function setCachedQualityLevel(level) {
    cachedQualityLevel = level;
}

/**
 * Clear all render caches (call when map regenerates or quality changes)
 */
export function clearRenderCaches() {
    hexTileCache.clear();
    foregroundCache.clear();
    cachedQualityLevel = null;
}

// ===== TERRAIN TEXTURE =====

/**
 * Get the appropriate terrain texture, supporting animation
 * @param {string} terrainType - The terrain type
 * @param {number} q - Hex Q coordinate
 * @param {number} r - Hex R coordinate
 * @returns {HTMLImageElement|HTMLCanvasElement|null} The texture
 */
export function getTerrainTexture(terrainType, q, r) {
    // Check if this terrain type has animated frames loaded
    if (hasAnimatedTexture(terrainType)) {
        const animFrame = getAnimatedTexture(terrainType, state.terrainAnimationFrame);
        if (animFrame) {
            return animFrame;
        }
    }

    // Fall back to static texture
    return getTexture(terrainType, q, r);
}

/**
 * Check if a terrain type should skip caching (animated terrain)
 * @param {string} hexType - The hex terrain type
 * @returns {boolean} True if caching should be skipped
 */
export function shouldSkipCache(hexType) {
    return hasAnimatedTexture(hexType);
}

// ===== HEX TILE CACHING =====

/**
 * Get or create a cached hex tile with terrain details
 * @param {Object} hex - The hex object
 * @param {string} fogLevel - 'visible', 'explored', or 'hidden'
 * @param {string} renderPass - 'full' (default), 'earth', or 'surface'
 * @returns {Object|null} { canvas, baseSize } or null if caching disabled
 */
export function getCachedHexTile(hex, fogLevel, renderPass = 'full') {
    // Only cache on medium/high quality
    if (state.effectiveQuality === 'low') {
        return null;
    }

    // Skip caching for animated terrain types
    if (fogLevel === 'visible' && shouldSkipCache(hex.type)) {
        return null;
    }

    // Invalidate cache if quality changed
    if (cachedQualityLevel !== state.effectiveQuality) {
        hexTileCache.clear();
        foregroundCache.clear();
        cachedQualityLevel = state.effectiveQuality;
    }

    // Cache key includes renderPass for separate earth/surface caches
    const cacheKey = `${hex.q},${hex.r}_${fogLevel}_${state.effectiveQuality}_${renderPass}`;

    if (hexTileCache.has(cacheKey)) {
        return hexTileCache.get(cacheKey);
    }

    // Enforce cache size limit using LRU-style eviction
    if (hexTileCache.size >= MAX_CACHE_SIZE) {
        const keysToRemove = Array.from(hexTileCache.keys()).slice(0, MAX_CACHE_SIZE / 5);
        keysToRemove.forEach(key => hexTileCache.delete(key));
    }

    // Create new cached tile
    const tileCanvas = createHexTileCanvas(hex, fogLevel, CACHE_BASE_HEX_SIZE, renderPass);
    const cacheEntry = { canvas: tileCanvas, baseSize: CACHE_BASE_HEX_SIZE };
    hexTileCache.set(cacheKey, cacheEntry);

    return cacheEntry;
}

/**
 * Create a canvas with the pre-rendered hex tile
 * @param {Object} hex - The hex object
 * @param {string} fogLevel - 'visible', 'explored', or 'hidden'
 * @param {number} hexSize - Hex size for rendering
 * @param {string} renderPass - 'full', 'earth', or 'surface'
 * @returns {HTMLCanvasElement} Canvas with rendered hex
 */
export function createHexTileCanvas(hex, fogLevel, hexSize, renderPass = 'full') {
    void fogLevel; // Not currently used but kept for future fog-based rendering

    const margin = hexSize * 0.2;
    const canvasSize = hexSize * 2 + margin * 2;

    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = canvasSize;
    tileCanvas.height = canvasSize;
    const tileCtx = tileCanvas.getContext('2d');

    const cx = canvasSize / 2;
    const cy = canvasSize / 2;

    const terrain = TERRAIN[hex.type];
    const fillColor = terrain.color;
    const texture = getTerrainTexture(hex.type, hex.q, hex.r);

    // Draw hex with texture - NO grid lines in cached tiles
    drawHexToContext(tileCtx, cx, cy, hexSize, fillColor, null, 1, texture, terrain, hex.q, hex.r, renderPass);

    return tileCanvas;
}

// ===== HEX DRAWING =====

/**
 * Draw hex path to a specific context
 * @param {CanvasRenderingContext2D} context - The canvas context
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size
 */
export function drawHexPathToContext(context, cx, cy, size) {
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
    }
    context.closePath();
}

/**
 * Draw hex with texture to a specific context
 * Supports two-pass rendering for isometric tiles with earth layers
 * @param {CanvasRenderingContext2D} context - The canvas context
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size
 * @param {string} fillColor - Fallback fill color
 * @param {string|null} strokeColor - Border color (null for no border)
 * @param {number} lineWidth - Border width
 * @param {HTMLImageElement|null} texture - Texture sprite
 * @param {Object} terrain - Terrain config object
 * @param {number} hexQ - Hex Q coordinate
 * @param {number} hexR - Hex R coordinate
 * @param {string} renderPass - 'full', 'earth', or 'surface'
 */
export function drawHexToContext(context, cx, cy, size, fillColor, strokeColor, lineWidth, texture, terrain, hexQ, hexR, renderPass = 'full') {
    // Suppress unused parameter warnings
    void hexQ;
    void hexR;

    context.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
    }
    context.closePath();

    if (texture) {
        const tileInfo = getTerrainTileInfo();

        if (tileInfo && tileInfo.earthLayerHeight > 0) {
            // Isometric tiles with earth layer
            const buffer = Math.max(6, size * 0.06);
            const spriteWidth = size * 2 + buffer;
            const hexTopOffset = tileInfo.hexTopOffset || 0;
            const sourceContentHeight = tileInfo.hexHeight - hexTopOffset;
            const hexSurfaceHeight = size * Math.sqrt(3) + buffer;
            const scaleRatio = hexSurfaceHeight / sourceContentHeight;
            const totalSpriteHeight = tileInfo.totalHeight * scaleRatio;

            const drawX = cx - spriteWidth / 2;
            const drawY = cy - hexSurfaceHeight / 2;

            if (renderPass === 'earth') {
                // Draw only the earth layer (cliff face)
                const sourceEarthY = Math.floor(tileInfo.hexHeight / 2);
                const sourceEarthHeight = tileInfo.totalHeight - sourceEarthY;
                const earthPortionScaled = sourceEarthHeight * scaleRatio;
                const destY = cy;

                context.drawImage(
                    texture,
                    0, sourceEarthY,
                    texture.width, sourceEarthHeight,
                    drawX, destY,
                    spriteWidth, earthPortionScaled
                );
            } else if (renderPass === 'surface') {
                // Draw only the hex surface
                context.drawImage(
                    texture,
                    0, hexTopOffset,
                    texture.width, sourceContentHeight,
                    drawX, drawY,
                    spriteWidth, hexSurfaceHeight
                );
            } else {
                // Full render - draw entire sprite
                context.drawImage(texture, drawX, drawY, spriteWidth, totalSpriteHeight);
            }
        } else {
            // Non-isometric tiles: clip to hex shape
            if (renderPass !== 'earth') {
                context.save();
                context.clip();
                const buffer = Math.max(12, size * 0.12);
                const spriteWidth = size * 2 + buffer;
                const spriteHeight = size * Math.sqrt(3) + buffer;
                context.drawImage(texture, cx - spriteWidth / 2, cy - spriteHeight / 2, spriteWidth, spriteHeight);
                context.restore();
            }
        }

        // Restore hex path for border drawing
        if (renderPass !== 'earth') {
            context.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 3 * i;
                const px = cx + size * Math.cos(angle);
                const py = cy + size * Math.sin(angle);
                if (i === 0) context.moveTo(px, py);
                else context.lineTo(px, py);
            }
            context.closePath();
        }
    } else if (renderPass !== 'earth' && terrain && terrain.colorLight && terrain.colorDark) {
        // Gradient fill fallback
        const gradient = safeLinearGradient(context, cx - size * 0.7, cy - size * 0.7, cx + size * 0.7, cy + size * 0.7, terrain.color);
        if (typeof gradient !== 'string') {
            gradient.addColorStop(0, terrain.colorLight);
            gradient.addColorStop(0.5, terrain.color);
            gradient.addColorStop(1, terrain.colorDark);
        }
        context.fillStyle = gradient;
        context.fill();
    } else if (renderPass !== 'earth') {
        // Solid color fallback
        context.fillStyle = fillColor;
        context.fill();
    }

    if (strokeColor && renderPass !== 'earth') {
        context.strokeStyle = strokeColor;
        context.lineWidth = lineWidth;
        context.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = cx + size * Math.cos(angle);
            const py = cy + size * Math.sin(angle);
            if (i === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
        }
        context.closePath();
        context.stroke();
    }
}
