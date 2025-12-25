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
 * Get a unit sprite image
 * Returns sprite or null (renderer will use placeholder)
 * @param {string} classType - Unit class (scout, assault, etc.)
 * @param {number} playerIndex - Player index (0-3)
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

    if (sprite) {
        // Draw sprite from sprite sheet
        const spriteSize = size * 2;
        ctx.drawImage(
            sprite,
            cx - spriteSize / 2,
            cy - spriteSize / 2,
            spriteSize,
            spriteSize
        );
    } else {
        // Draw simple placeholder
        drawUnitPlaceholder(ctx, cx, cy, size, playerColor, classType, isSelected);
    }
}

/**
 * Draw a simple unit placeholder (colored circle with class icon)
 */
function drawUnitPlaceholder(ctx, cx, cy, size, playerColor, classType, isSelected) {
    const radius = size * 0.6;

    // Selection ring
    if (isSelected) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Unit circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = playerColor;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Class initial
    const initials = {
        scout: 'S',
        assault: 'A',
        medic: 'M',
        sniper: 'N',
        ninja: 'C'
    };

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials[classType] || '?', cx, cy);
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
