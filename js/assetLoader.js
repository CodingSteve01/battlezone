/**
 * Asset Loader Module for Shadow Squad
 *
 * Loads game assets from the Sprite Sheet System.
 * If sprites are not available, simple colored placeholders are rendered.
 * No runtime canvas generation - sprites only.
 */

import { CONFIG } from './config.js';
import * as SpriteSheet from './spriteSheetLoader.js';

// Loading state
let assetsLoaded = false;
let loadingPromise = null;

// Placeholder colors for missing assets
const PLACEHOLDER_COLORS = {
    grass: '#6a9a58',
    forest: '#3d6a4a',
    hills: '#7a8c5a',
    rock: '#7a7878',
    water: '#4a7a95',
    sand: '#d4b888',
    swamp: '#5a6a45',
    road: '#9a8a70',
    path: '#8a7860',
    river: '#4a7c9a',
    default: '#808080'
};

/**
 * Initialize the asset loader
 */
export async function initAssetLoader() {
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        console.log('[AssetLoader] Initializing sprite sheet system...');

        try {
            await SpriteSheet.initSpriteSheets();
            console.log('[AssetLoader] Sprite sheet system ready');
        } catch (err) {
            console.warn('[AssetLoader] Sprite sheet system error:', err.message);
            console.warn('[AssetLoader] Game will use placeholder graphics');
        }

        assetsLoaded = true;
        console.log('[AssetLoader] Ready');
    })();

    return loadingPromise;
}

/**
 * Get a terrain texture
 * Returns sprite or null (renderer will use placeholder)
 */
export function getTexture(type, q = 0, r = 0) {
    return SpriteSheet.getTerrainSprite(type, q, r);
}

/**
 * Get placeholder color for a terrain type
 */
export function getPlaceholderColor(type) {
    return PLACEHOLDER_COLORS[type] || PLACEHOLDER_COLORS.default;
}

/**
 * Get an animated terrain texture frame
 * Not yet implemented for sprite sheets
 */
export function getAnimatedTexture(type, frameIndex) {
    // TODO: Implement animated sprite sheet support
    return null;
}

/**
 * Check if a terrain type has animated frames
 */
export function hasAnimatedTexture(type) {
    return false;
}

/**
 * Check if we're using static assets
 */
export function isUsingStaticAssets() {
    return SpriteSheet.isSpriteSheetLoaded();
}

/**
 * Check if sprite sheet system is active
 */
export function isUsingSpriteSheets() {
    return SpriteSheet.isSpriteSheetLoaded();
}

/**
 * Get isometric terrain tile info (dimensions, earth layer height)
 * Returns null if using non-isometric (flat) tiles
 */
export function getTerrainTileInfo() {
    return SpriteSheet.getTerrainTileInfo();
}

/**
 * Check if terrain tiles are isometric (have earth layer)
 */
export function hasIsometricTiles() {
    return SpriteSheet.hasIsometricTiles();
}

/**
 * Get a unit sprite image
 * Returns sprite or null (renderer will use placeholder)
 * For players 4-7, automatically colorizes base sprites (0-3) with player colors
 * @param {string} classType - Unit class (scout, assault, etc.)
 * @param {number} playerIndex - Player index (0-7)
 * @param {string} status - Unit state (normal, cover, attack, dead)
 * @param {string} facing - Facing direction ('left' or 'right')
 */
export function getUnitSprite(classType, playerIndex, status = 'normal', facing = null) {
    return SpriteSheet.getUnitSprite(classType, playerIndex, status, facing);
}

/**
 * Get a detail element image (tree, bush, grass, rock)
 */
export function getDetailElement(type, variant = 0) {
    return SpriteSheet.getDetailSprite(type, variant);
}

/**
 * Get a tree sprite
 */
export function getTreeSprite(treeType, variant = 0) {
    const sprite = SpriteSheet.getDetailSprite('tree', treeType);
    if (sprite) return sprite;
    return SpriteSheet.getDetailSprite(`tree_${treeType}`, variant);
}

/**
 * Get a bush sprite
 */
export function getBushSprite(variant = 0) {
    return SpriteSheet.getDetailSprite('bush', variant);
}

/**
 * Get a rock sprite
 */
export function getRockSprite(variant = 0) {
    return SpriteSheet.getDetailSprite('rock', variant);
}

/**
 * Get a grass detail sprite
 */
export function getGrassSprite(variant = 0) {
    return SpriteSheet.getDetailSprite('grass', variant);
}

/**
 * Get a random detail sprite of a given type
 */
export function getRandomDetailSprite(detailType, seed = Math.random()) {
    return SpriteSheet.getRandomDetailSprite(detailType, seed);
}

/**
 * Get a random detail sprite with its anchor point and content scale
 * @param {string} detailType - Type of detail (tree, bush, grass, rock)
 * @param {number} seed - Random seed for consistent selection
 * @returns {Object|null} { sprite: ImageBitmap, anchor: { x, y }, contentScale: { scaleX, scaleY } } or null
 */
export function getRandomDetailSpriteWithAnchor(detailType, seed = Math.random()) {
    return SpriteSheet.getRandomDetailSpriteWithAnchor(detailType, seed);
}

/**
 * Get shoreline overlay sprite for a specific edge direction
 * @param {string} detailType - e.g. shore_water_0
 * @param {number} variant - Variant index
 */
export function getShorelineSprite(detailType, variant = 0) {
    return SpriteSheet.getOverlaySprite(detailType, variant);
}

export function getShorelineVariantCount(detailType) {
    return SpriteSheet.getOverlayVariantCount(detailType);
}

/**
 * Get content scale for a unit sprite (for cropping compensation)
 */
export function getUnitContentScale(unitClass, playerIndex, state = 'normal') {
    return SpriteSheet.getUnitContentScale(unitClass, playerIndex, state);
}

/**
 * Check if assets have been loaded
 */
export function areAssetsLoaded() {
    return assetsLoaded;
}

/**
 * Draw a unit sprite or placeholder
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {number} size - Unit size
 * @param {string} playerColor - Player color for placeholder
 * @param {string} classType - Unit class
 * @param {string} status - Unit state
 * @param {boolean} isSelected - Whether unit is selected
 * @param {number} playerIndex - Player index
 * @param {string} facing - Facing direction ('left' or 'right')
 */
export function drawUnit(ctx, cx, cy, size, playerColor, classType, status, isSelected, playerIndex, facing = null) {
    const sprite = getUnitSprite(classType, playerIndex, status, facing);

    // Draw the unit with subtle glow if selected
    if (isSelected) {
        ctx.save();
        ctx.shadowColor = playerColor;
        ctx.shadowBlur = 12;
    }

    // Draw the unit
    if (sprite) {
        // Get anchor point for positioning (typically center-bottom)
        const anchor = SpriteSheet.getUnitAnchor(classType, playerIndex, status) || { x: 0.5, y: 1.0 };

        // Base sprite size - reduced from 1.7x to 1.36x (20% smaller for better proportions)
        // Note: All units use the same base size regardless of sprite cropping
        // to ensure consistent sizing across all players
        const baseSize = size * 1.36;

        // Calculate sprite dimensions maintaining aspect ratio
        const spriteWidth = baseSize * (sprite.width / sprite.height);
        const spriteHeight = baseSize;

        // Position using anchor point (typically center-bottom)
        const drawX = cx - spriteWidth * anchor.x;
        const drawY = cy - spriteHeight * anchor.y;

        ctx.drawImage(sprite, drawX, drawY, spriteWidth, spriteHeight);
    } else {
        drawUnitPlaceholder(ctx, cx, cy, size, playerColor, classType, isSelected);
    }

    if (isSelected) {
        ctx.restore();
    }
}

/**
 * Draw a simple unit placeholder (colored silhouette)
 * No letter shown - just a minimal indicator when sprites are loading
 */
function drawUnitPlaceholder(ctx, cx, cy, size, playerColor, classType, isSelected) {
    const radius = size * 0.4;

    // Simple silhouette shape (head + body)
    ctx.fillStyle = playerColor;

    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - radius * 0.5, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Body (oval)
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.2, radius * 0.4, radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

/**
 * Draw AP indicator dots
 */
export function drawAPIndicator(ctx, cx, cy, currentAP, maxAP, size) {
    const dotRadius = 3;
    const spacing = 8;
    const startX = cx - ((maxAP - 1) * spacing) / 2;
    const y = cy + size * 0.8;

    for (let i = 0; i < maxAP; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * spacing, y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = i < currentAP ? '#22c55e' : '#333333';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

/**
 * Calculate facing direction based on target position
 * @param {number} fromX - Source X position
 * @param {number} toX - Target X position
 * @returns {string} 'left' or 'right'
 */
export function getFacingDirection(fromX, toX) {
    return toX < fromX ? 'left' : 'right';
}

/**
 * Calculate facing direction from hex coordinates
 * @param {number} fromQ - Source hex Q coordinate
 * @param {number} toQ - Target hex Q coordinate
 * @returns {string} 'left' or 'right'
 */
export function getFacingFromHex(fromQ, toQ) {
    return toQ < fromQ ? 'left' : 'right';
}

// ============================================
// SPRITE INFORMATION API
// ============================================

export function getAvailableTerrainTypes() {
    return SpriteSheet.getAvailableTerrainTypes();
}

export function getTerrainVariantCount(type) {
    return SpriteSheet.getTerrainVariantCount(type);
}

export function getAvailableUnitClasses() {
    return SpriteSheet.getAvailableUnitClasses();
}

export function getUnitStates(unitClass) {
    return SpriteSheet.getUnitStates(unitClass);
}

export function getAvailableDetailTypes() {
    return SpriteSheet.getAvailableDetailTypes();
}

export function getDetailVariantCount(type) {
    return SpriteSheet.getDetailVariantCount(type);
}

// ============================================
// ANCHOR POINT API
// ============================================

/**
 * Get anchor point for a detail sprite (tree, bush, grass, etc.)
 * Returns normalized coordinates (0-1) where (0.5, 1.0) is center-bottom
 * Use this to position sprites correctly on tiles based on their ground contact point
 * @param {string} detailType - Detail type
 * @param {number} variant - Variant index
 * @returns {Object} { x: 0-1, y: 0-1 }
 */
export function getDetailAnchor(detailType, variant = 0) {
    return SpriteSheet.getDetailAnchor(detailType, variant);
}

/**
 * Get anchor point for a unit sprite
 * @param {string} unitClass - Unit class
 * @param {number} playerIndex - Player index
 * @param {string} state - Unit state
 * @returns {Object} { x: 0-1, y: 0-1 }
 */
export function getUnitAnchor(unitClass, playerIndex, state = 'normal') {
    return SpriteSheet.getUnitAnchor(unitClass, playerIndex, state);
}

/**
 * Check if anchor points are available (V2.0 format sprites)
 * @returns {boolean}
 */
export function hasAnchorPoints() {
    return SpriteSheet.hasAnchorPoints();
}

/**
 * Draw a detail sprite using anchor-based positioning
 * Positions the sprite so the anchor point (typically center-bottom) is at (x, y)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} detailType - Detail type (tree, bush, etc.)
 * @param {number} variant - Variant index
 * @param {number} x - X position for anchor point
 * @param {number} y - Y position for anchor point
 * @param {number} scale - Scale factor (1.0 = original size)
 */
export function drawDetailSprite(ctx, detailType, variant, x, y, scale = 1.0) {
    const sprite = SpriteSheet.getDetailSprite(detailType, variant);
    if (!sprite) return false;

    const anchor = SpriteSheet.getDetailAnchor(detailType, variant);
    const width = sprite.width * scale;
    const height = sprite.height * scale;

    // Position so anchor point is at (x, y)
    const drawX = x - width * anchor.x;
    const drawY = y - height * anchor.y;

    ctx.drawImage(sprite, drawX, drawY, width, height);
    return true;
}
