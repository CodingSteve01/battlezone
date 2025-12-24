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
const textureCache = new Map(); // terrain type -> array of Image variants
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
const UNIT_STATES = ['', '_selected', '_attack', '_cover'];
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
    const maxVariants = CONFIG.TERRAIN_VARIANTS || 0;

    const loadPromises = TERRAIN_TYPES.map(async (type) => {
        const variants = [];

        // Base texture
        try {
            const base = await loadImage(`${TERRAIN_PATH}/${type}.png`);
            variants.push(base);
        } catch {
            console.warn(`Static terrain texture not found: ${type}`);
        }

        // Optional variant textures: type_v1.png, type_v2.png, ...
        for (let i = 1; i <= maxVariants; i++) {
            try {
                const variant = await loadImage(`${TERRAIN_PATH}/${type}_v${i}.png`);
                variants.push(variant);
            } catch {
                // Stop attempting more variants once one is missing to reduce noise
                break;
            }
        }

        if (variants.length > 0) {
            textureCache.set(type, variants);
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
            for (const suffix of UNIT_STATES) {
                const key = `${classType}_p${playerIdx}${suffix}`;
                loadPromises.push(
                    loadImage(`${UNITS_PATH}/${key}.png`)
                        .then(img => spriteCache.set(key, img))
                        .catch(() => console.warn(`Static sprite not found: ${key}`))
                );
            }
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
export function getTexture(type, q = 0, r = 0) {
    // Try static asset first
    if (textureCache.has(type)) {
        const variants = textureCache.get(type);
        if (Array.isArray(variants) && variants.length > 0) {
            if (variants.length === 1) return variants[0];
            // Deterministic variant selection per hex
            const hash = Math.abs(((q * 73856093) ^ (r * 19349663)) % variants.length);
            return variants[hash];
        }
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
export function getUnitSprite(classType, playerIndex, status = 'normal') {
    let suffix = '';
    if (status === 'selected') suffix = '_selected';
    if (status === 'attack') suffix = '_attack';
    if (status === 'cover') suffix = '_cover';
    const key = `${classType}_p${playerIndex}${suffix}`;

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
export function drawUnit(ctx, cx, cy, size, playerColor, classType, status, isSelected, playerIndex) {
    const sprite = getUnitSprite(classType, playerIndex, status);

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
        drawHumanSprite(ctx, cx, cy, size, playerColor, classType, isSelected, status);
    }
}

// Re-export runtime drawing functions for compatibility
export { drawHumanSprite, drawAPIndicator };
