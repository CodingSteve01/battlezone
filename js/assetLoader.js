/**
 * Asset Loader Module for Shadow Squad
 *
 * Unified interface for loading game assets using the Sprite Sheet System.
 *
 * Loading priority:
 * 1. Sprite Sheet System (JSON-defined, pre-extracted PNGs)
 * 2. Runtime Canvas Generation (fallback for particles, overlays, missing sprites)
 *
 * The sprite sheet system uses JSON definitions to describe sprites,
 * making it easy to add new graphics without code changes.
 */

import { initTextures, getTexture as getRuntimeTexture, drawHumanSprite, drawAPIndicator } from './assets.js';
import { CONFIG } from './config.js';
import * as SpriteSheet from './spriteSheetLoader.js';

// Loading state
let assetsLoaded = false;
let loadingPromise = null;

/**
 * Initialize the asset loader
 */
export async function initAssetLoader() {
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        console.log('[AssetLoader] Initializing...');

        // Initialize sprite sheet system
        try {
            await SpriteSheet.initSpriteSheets();
            console.log('[AssetLoader] Sprite sheet system ready');
        } catch (err) {
            console.warn('[AssetLoader] Sprite sheet system error:', err.message);
        }

        // Initialize runtime generation as fallback for particles/overlays
        initTextures();

        assetsLoaded = true;
        console.log('[AssetLoader] Ready');
    })();

    return loadingPromise;
}

/**
 * Get a terrain texture
 * Uses sprite sheet system, falls back to runtime generation
 */
export function getTexture(type, q = 0, r = 0) {
    // Try sprite sheet system first
    const sprite = SpriteSheet.getTerrainSprite(type, q, r);
    if (sprite) return sprite;

    // Fallback to runtime generation
    return getRuntimeTexture(type);
}

/**
 * Get an animated terrain texture frame
 * Currently uses runtime generation (sprite sheet animation not yet implemented)
 */
export function getAnimatedTexture(type, frameIndex) {
    // TODO: Implement animated sprite sheet support
    return null;
}

/**
 * Check if a terrain type has animated frames
 */
export function hasAnimatedTexture(type) {
    // TODO: Implement animated sprite sheet support
    return false;
}

/**
 * Check if we're using static assets (always true with sprite sheet system)
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
 * Uses sprite sheet system, returns null if not found (caller uses runtime drawing)
 */
export function getUnitSprite(classType, playerIndex, status = 'normal') {
    return SpriteSheet.getUnitSprite(classType, playerIndex, status);
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
    // Try combined key first (e.g., "tree_0_0")
    const sprite = SpriteSheet.getDetailSprite('tree', treeType);
    if (sprite) return sprite;

    // Try with subvariant
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
 * Useful for procedural placement of terrain details
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
 * Draw a unit (using sprite if available, otherwise runtime drawing)
 */
export function drawUnit(ctx, cx, cy, size, playerColor, classType, status, isSelected, playerIndex) {
    const sprite = getUnitSprite(classType, playerIndex, status);

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
        // Fallback to runtime drawing
        drawHumanSprite(ctx, cx, cy, size, playerColor, classType, isSelected, status);
    }
}

// ============================================
// SPRITE INFORMATION API
// ============================================

/**
 * Get available terrain types from sprite sheet system
 */
export function getAvailableTerrainTypes() {
    return SpriteSheet.getAvailableTerrainTypes();
}

/**
 * Get number of variants for a terrain type
 */
export function getTerrainVariantCount(type) {
    return SpriteSheet.getTerrainVariantCount(type);
}

/**
 * Get available unit classes from sprite sheet system
 */
export function getAvailableUnitClasses() {
    return SpriteSheet.getAvailableUnitClasses();
}

/**
 * Get available states for a unit class
 */
export function getUnitStates(unitClass) {
    return SpriteSheet.getUnitStates(unitClass);
}

/**
 * Get available detail types from sprite sheet system
 */
export function getAvailableDetailTypes() {
    return SpriteSheet.getAvailableDetailTypes();
}

/**
 * Get number of variants for a detail type
 */
export function getDetailVariantCount(type) {
    return SpriteSheet.getDetailVariantCount(type);
}

// Re-export runtime drawing functions for particles/overlays
export { drawHumanSprite, drawAPIndicator };
