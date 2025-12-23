/**
 * Asset Loader Module for Shadow Squad
 *
 * Provides a unified interface for loading game assets.
 * Attempts to load pre-generated static PNG files first,
 * with automatic fallback to runtime canvas generation.
 *
 * Benefits of static assets:
 * - Faster initial load (no runtime generation)
 * - Ability to create more detailed/hand-crafted graphics
 * - Reduced CPU usage during gameplay
 * - Consistent visuals across devices
 */

import { initTextures, getTexture as getRuntimeTexture, drawHumanSprite, drawAPIndicator } from './assets.js';
import { CONFIG } from './config.js';

// Asset caches
const textureCache = new Map();
const spriteCache = new Map();
const detailCache = new Map();

// Loading state
let assetsLoaded = false;
let useStaticAssets = false;
let loadingPromise = null;

// Asset paths
const ASSETS_BASE = 'assets';
const TERRAIN_PATH = `${ASSETS_BASE}/terrain`;
const UNITS_PATH = `${ASSETS_BASE}/units`;
const DETAILS_PATH = `${ASSETS_BASE}/details`;

// Unit classes and player colors for sprite loading
const UNIT_CLASSES = ['scout', 'assault', 'medic', 'sniper', 'ninja'];
const PLAYER_COLORS = CONFIG.PLAYER_COLORS;

// Terrain types
const TERRAIN_TYPES = ['grass', 'forest', 'rock', 'water', 'sand', 'swamp', 'hills', 'road', 'path', 'river'];

/**
 * Load an image from URL with promise
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${url}`));
        img.src = url;
    });
}

/**
 * Check if static assets are available
 */
async function checkStaticAssets() {
    try {
        // Try to load one terrain texture as a test
        await loadImage(`${TERRAIN_PATH}/grass.png`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Load all terrain textures
 */
async function loadTerrainTextures() {
    const loadPromises = TERRAIN_TYPES.map(async (type) => {
        try {
            const img = await loadImage(`${TERRAIN_PATH}/${type}.png`);
            textureCache.set(type, img);
        } catch {
            // Will fallback to runtime generation
            console.warn(`Static terrain texture not found: ${type}`);
        }
    });

    await Promise.all(loadPromises);
}

/**
 * Load all unit sprites
 */
async function loadUnitSprites() {
    const loadPromises = [];

    for (const classType of UNIT_CLASSES) {
        for (let playerIdx = 0; playerIdx < PLAYER_COLORS.length; playerIdx++) {
            // Normal sprite
            const normalKey = `${classType}_p${playerIdx}`;
            loadPromises.push(
                loadImage(`${UNITS_PATH}/${normalKey}.png`)
                    .then(img => spriteCache.set(normalKey, img))
                    .catch(() => console.warn(`Static sprite not found: ${normalKey}`))
            );

            // Selected sprite
            const selectedKey = `${classType}_p${playerIdx}_selected`;
            loadPromises.push(
                loadImage(`${UNITS_PATH}/${selectedKey}.png`)
                    .then(img => spriteCache.set(selectedKey, img))
                    .catch(() => console.warn(`Static sprite not found: ${selectedKey}`))
            );
        }
    }

    await Promise.all(loadPromises);
}

/**
 * Load all terrain detail elements
 */
async function loadDetailElements() {
    const loadPromises = [];

    // Trees (5 types x 3 variants)
    for (let type = 0; type < 5; type++) {
        for (let variant = 0; variant < 3; variant++) {
            const key = `tree_${type}_${variant}`;
            loadPromises.push(
                loadImage(`${DETAILS_PATH}/${key}.png`)
                    .then(img => detailCache.set(key, img))
                    .catch(() => {})
            );
        }
    }

    // Bushes (4 variants)
    for (let variant = 0; variant < 4; variant++) {
        const key = `bush_${variant}`;
        loadPromises.push(
            loadImage(`${DETAILS_PATH}/${key}.png`)
                .then(img => detailCache.set(key, img))
                .catch(() => {})
        );
    }

    // Rocks (4 variants)
    for (let variant = 0; variant < 4; variant++) {
        const key = `rock_${variant}`;
        loadPromises.push(
            loadImage(`${DETAILS_PATH}/${key}.png`)
                .then(img => detailCache.set(key, img))
                .catch(() => {})
        );
    }

    await Promise.all(loadPromises);
}

/**
 * Initialize the asset loader
 * Attempts to load static assets, falls back to runtime generation
 */
export async function initAssetLoader() {
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        console.log('[AssetLoader] Checking for static assets...');

        // Check if static assets are available
        useStaticAssets = await checkStaticAssets();

        if (useStaticAssets) {
            console.log('[AssetLoader] Static assets found, loading...');

            // Load all static assets in parallel
            await Promise.all([
                loadTerrainTextures(),
                loadUnitSprites(),
                loadDetailElements()
            ]);

            const textureCount = textureCache.size;
            const spriteCount = spriteCache.size;
            const detailCount = detailCache.size;

            console.log(`[AssetLoader] Loaded: ${textureCount} textures, ${spriteCount} sprites, ${detailCount} details`);
        } else {
            console.log('[AssetLoader] Static assets not found, using runtime generation');
            // Initialize runtime texture generation
            initTextures();
        }

        assetsLoaded = true;
    })();

    return loadingPromise;
}

/**
 * Get a terrain texture
 * Returns static image if available, otherwise runtime-generated canvas
 */
export function getTexture(type) {
    // Try static asset first
    if (textureCache.has(type)) {
        return textureCache.get(type);
    }

    // Fallback to runtime generation
    return getRuntimeTexture(type);
}

/**
 * Check if we're using static assets
 */
export function isUsingStaticAssets() {
    return useStaticAssets;
}

/**
 * Get a unit sprite image (if available)
 * Returns null if not loaded (caller should use runtime drawing)
 */
export function getUnitSprite(classType, playerIndex, isSelected = false) {
    const key = isSelected
        ? `${classType}_p${playerIndex}_selected`
        : `${classType}_p${playerIndex}`;

    return spriteCache.get(key) || null;
}

/**
 * Get a detail element image (if available)
 * Returns null if not loaded (caller should use runtime drawing)
 */
export function getDetailElement(type, variant = 0) {
    const key = `${type}_${variant}`;
    return detailCache.get(key) || null;
}

/**
 * Get a tree sprite
 */
export function getTreeSprite(treeType, variant = 0) {
    const key = `tree_${treeType}_${variant}`;
    return detailCache.get(key) || null;
}

/**
 * Get a bush sprite
 */
export function getBushSprite(variant = 0) {
    return detailCache.get(`bush_${variant}`) || null;
}

/**
 * Get a rock sprite
 */
export function getRockSprite(variant = 0) {
    return detailCache.get(`rock_${variant}`) || null;
}

/**
 * Check if assets have been loaded
 */
export function areAssetsLoaded() {
    return assetsLoaded;
}

/**
 * Draw a unit (using static sprite if available, otherwise runtime)
 */
export function drawUnit(ctx, cx, cy, size, playerColor, classType, isSelected, playerIndex) {
    const sprite = getUnitSprite(classType, playerIndex, isSelected);

    if (sprite) {
        // Draw static sprite
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
        drawHumanSprite(ctx, cx, cy, size, playerColor, classType, isSelected);
    }
}

// Re-export runtime drawing functions for compatibility
export { drawHumanSprite, drawAPIndicator };
