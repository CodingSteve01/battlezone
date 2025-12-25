/**
 * Sprite Sheet Loader Module for Shadow Squad
 *
 * Loads and processes sprite sheets based on JSON definitions.
 * Supports both:
 * - Pre-extracted individual PNG files (production)
 * - Runtime extraction from sprite sheets (development)
 *
 * The system is dynamic: adding new variants in the JSON or new PNG files
 * will automatically make them available in the game.
 */

import { CONFIG } from './config.js';

// Sprite registries - dynamically populated from definitions
const spriteRegistry = {
    units: new Map(),      // unitClass_state_player -> ImageBitmap
    terrain: new Map(),    // terrainType_variant -> ImageBitmap
    details: new Map()     // detailType_variant -> ImageBitmap
};

// Cache for mirrored (horizontally flipped) sprites
const mirroredSpriteCache = new Map();

// Base facing direction from sprite sheet (from JSON definition)
let baseFacingDirection = 'right';

// Metadata registries - stores info about available variants
const variantRegistry = {
    units: {},      // unitClass -> { states: [], playerCount: 4 }
    terrain: {},    // terrainType -> { variants: [] }
    details: {}     // detailType -> { variants: [] }
};

// JSON definitions cache
let definitions = {
    units: null,
    terrain: null,
    details: null
};

// Loading state
let loadingPromise = null;
let isLoaded = false;

// Asset paths
const SPRITESHEETS_PATH = 'assets/spritesheets';
const EXTRACTED_PATH = 'assets';

/**
 * Initialize the sprite sheet system
 * Attempts to load pre-extracted assets first, falls back to runtime extraction
 */
export async function initSpriteSheets() {
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        console.log('[SpriteSheetLoader] Initializing...');

        // Load all JSON definitions
        // Units can have multiple source files (main units + sniper)
        await Promise.all([
            loadDefinition('units', 'unit-sprites.json'),
            loadDefinition('terrain', 'terrain-hexes.json'),
            loadDefinition('details', 'environment-details.json'),
            loadAdditionalUnitDefinition('sniper-sprites.json')
        ]);

        // Try to load pre-extracted sprites first
        const hasExtracted = await checkExtractedAssets();

        if (hasExtracted) {
            console.log('[SpriteSheetLoader] Loading pre-extracted assets...');
            await loadExtractedAssets();
        } else {
            console.log('[SpriteSheetLoader] No pre-extracted assets, loading sprite sheets...');
            await loadAndExtractSpriteSheets();
        }

        // Build variant registries
        buildVariantRegistries();

        isLoaded = true;
        console.log('[SpriteSheetLoader] Ready:', getSpriteStats());
    })();

    return loadingPromise;
}

/**
 * Load a JSON definition file
 */
async function loadDefinition(type, filename) {
    try {
        const response = await fetch(`${SPRITESHEETS_PATH}/${filename}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        definitions[type] = await response.json();
        console.log(`[SpriteSheetLoader] Loaded ${type} definition: ${definitions[type].sprites?.length || 0} sprites`);

        // Read mirroring settings from units definition
        if (type === 'units' && definitions[type].mirroring) {
            baseFacingDirection = definitions[type].mirroring.baseDirection || 'right';
            console.log(`[SpriteSheetLoader] Base facing direction: ${baseFacingDirection}`);
        }
    } catch (err) {
        console.warn(`[SpriteSheetLoader] Could not load ${filename}:`, err.message);
        definitions[type] = { sprites: [] };
    }
}

/**
 * Load an additional unit definition file and merge it
 * This allows units to come from multiple sprite sheets (e.g., sniper in 2x2 grid)
 */
async function loadAdditionalUnitDefinition(filename) {
    try {
        const response = await fetch(`${SPRITESHEETS_PATH}/${filename}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const additionalDef = await response.json();

        // Store as separate definition for sprite sheet loading
        if (!definitions.additionalUnits) {
            definitions.additionalUnits = [];
        }
        definitions.additionalUnits.push(additionalDef);

        // Merge sprites into main units definition
        if (definitions.units && additionalDef.sprites) {
            definitions.units.sprites = definitions.units.sprites || [];
            definitions.units.sprites.push(...additionalDef.sprites);
        }

        console.log(`[SpriteSheetLoader] Loaded additional units: ${filename} (${additionalDef.sprites?.length || 0} sprites)`);
    } catch (err) {
        // Optional file - not an error if missing
        console.log(`[SpriteSheetLoader] No additional unit file: ${filename}`);
    }
}

/**
 * Check if pre-extracted assets exist
 */
async function checkExtractedAssets() {
    try {
        const response = await fetch(`${EXTRACTED_PATH}/terrain/grass.png`, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Load pre-extracted PNG assets
 */
async function loadExtractedAssets() {
    const loadPromises = [];

    // Load terrain sprites
    if (definitions.terrain?.sprites) {
        for (const sprite of definitions.terrain.sprites) {
            loadPromises.push(loadExtractedSprite('terrain', sprite));
        }
    }

    // Load unit sprites (with player variants)
    if (definitions.units?.sprites) {
        const playerCount = CONFIG.PLAYER_COLORS?.length || 4;
        for (const sprite of definitions.units.sprites) {
            for (let p = 0; p < playerCount; p++) {
                loadPromises.push(loadExtractedUnitSprite(sprite, p));
            }
        }
    }

    // Load detail sprites
    if (definitions.details?.sprites) {
        for (const sprite of definitions.details.sprites) {
            loadPromises.push(loadExtractedSprite('details', sprite));
        }
    }

    await Promise.allSettled(loadPromises);
}

/**
 * Load a single extracted sprite
 */
async function loadExtractedSprite(type, spritedef) {
    try {
        const folder = type === 'details' ? 'details' : type;
        const img = await loadImage(`${EXTRACTED_PATH}/${folder}/${spritedef.id}.png`);
        spriteRegistry[type].set(spritedef.id, img);
    } catch (err) {
        // Try variant naming
        try {
            const baseName = spritedef.metadata?.terrainType || spritedef.metadata?.detailType || spritedef.id;
            const variant = spritedef.metadata?.variant || 0;
            const img = await loadImage(`${EXTRACTED_PATH}/${type}/${baseName}_v${variant}.png`);
            spriteRegistry[type].set(spritedef.id, img);
        } catch {
            // Sprite not found - will use fallback
        }
    }
}

/**
 * Load a unit sprite with player variant
 */
async function loadExtractedUnitSprite(spritedef, playerIndex) {
    const unitClass = spritedef.metadata?.unitClass;
    const state = spritedef.metadata?.state || 'normal';

    if (!unitClass) return;

    // Try multiple naming conventions
    const namesToTry = [
        `${unitClass}_p${playerIndex}_${state}`,
        `${unitClass}_${state}_p${playerIndex}`,
        `${spritedef.id}_p${playerIndex}`
    ];

    for (const name of namesToTry) {
        try {
            const img = await loadImage(`${EXTRACTED_PATH}/units/${name}.png`);
            const key = `${unitClass}_${state}_${playerIndex}`;
            spriteRegistry.units.set(key, img);
            return;
        } catch {
            // Try next name
        }
    }
}

/**
 * Load sprite sheets and extract at runtime
 */
async function loadAndExtractSpriteSheets() {
    // This is a fallback - in production, sprites should be pre-extracted
    console.warn('[SpriteSheetLoader] Runtime extraction - loading from sprite sheets');

    // Load main sprite sheets
    for (const [type, def] of Object.entries(definitions)) {
        if (!def?.source || type === 'additionalUnits') continue;

        try {
            const sheetImg = await loadImage(`${SPRITESHEETS_PATH}/${def.source}`);
            await extractSpritesFromSheet(type, sheetImg, def);
        } catch (err) {
            console.warn(`[SpriteSheetLoader] Could not load sprite sheet ${def.source}:`, err.message);
        }
    }

    // Load additional unit sprite sheets (e.g., sniper)
    if (definitions.additionalUnits) {
        for (const additionalDef of definitions.additionalUnits) {
            if (!additionalDef?.source) continue;

            try {
                const sheetImg = await loadImage(`${SPRITESHEETS_PATH}/${additionalDef.source}`);
                await extractSpritesFromSheet('units', sheetImg, additionalDef);
                console.log(`[SpriteSheetLoader] Extracted from ${additionalDef.source}`);
            } catch (err) {
                console.warn(`[SpriteSheetLoader] Could not load additional sprite sheet ${additionalDef.source}:`, err.message);
            }
        }
    }
}

/**
 * Extract sprites from a loaded sprite sheet image
 */
async function extractSpritesFromSheet(type, sheetImg, definition) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    for (const sprite of definition.sprites || []) {
        if (!sprite.bounds) continue;

        const { x, y, width, height } = sprite.bounds;
        const outputSize = sprite.outputSize || definition.globalSettings?.outputSize || { width, height };

        canvas.width = outputSize.width;
        canvas.height = outputSize.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sheetImg, x, y, width, height, 0, 0, outputSize.width, outputSize.height);

        // Apply background removal if configured
        const bgSettings = sprite.backgroundRemoval || definition.globalSettings?.backgroundRemoval;
        if (bgSettings?.enabled) {
            removeBackground(ctx, canvas.width, canvas.height, bgSettings);
        }

        // Create ImageBitmap for better performance
        const bitmap = await createImageBitmap(canvas);
        spriteRegistry[type].set(sprite.id, bitmap);

        // For units, generate player color variants
        if (type === 'units' && definition.colorize?.enabled) {
            const colors = definition.colorize.targetColors || CONFIG.PLAYER_COLORS;
            for (let p = 0; p < colors.length; p++) {
                const colored = colorizeCanvas(canvas, colors[p]);
                const coloredBitmap = await createImageBitmap(colored);
                const unitClass = sprite.metadata?.unitClass;
                const state = sprite.metadata?.state || 'normal';
                spriteRegistry.units.set(`${unitClass}_${state}_${p}`, coloredBitmap);
            }
        }
    }
}

/**
 * Remove background color from canvas
 */
function removeBackground(ctx, width, height, settings) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const tolerance = settings?.tolerance || 15;

    // Detect background from corners
    let bgR, bgG, bgB;
    if (settings?.color === 'auto' || !settings?.color) {
        const samples = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
        let sumR = 0, sumG = 0, sumB = 0;
        for (const [sx, sy] of samples) {
            const i = (sy * width + sx) * 4;
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
        }
        bgR = Math.round(sumR / 4);
        bgG = Math.round(sumG / 4);
        bgB = Math.round(sumB / 4);
    } else {
        const hex = settings.color.replace('#', '');
        bgR = parseInt(hex.substr(0, 2), 16);
        bgG = parseInt(hex.substr(2, 2), 16);
        bgB = parseInt(hex.substr(4, 2), 16);
    }

    const antiAlias = settings?.antiAlias !== false; // Default to true

    for (let i = 0; i < data.length; i += 4) {
        const diffR = Math.abs(data[i] - bgR);
        const diffG = Math.abs(data[i + 1] - bgG);
        const diffB = Math.abs(data[i + 2] - bgB);
        const maxDiff = Math.max(diffR, diffG, diffB);

        if (maxDiff <= tolerance) {
            if (antiAlias && maxDiff > tolerance * 0.5) {
                // Semi-transparent for edge pixels (anti-aliasing)
                const alpha = Math.round((maxDiff / tolerance) * 255);
                data[i + 3] = Math.min(data[i + 3], alpha);
            } else {
                // Fully transparent for pixels clearly matching background
                data[i + 3] = 0;
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply color tinting to a canvas
 */
function colorizeCanvas(sourceCanvas, color) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return canvas;
}

/**
 * Build registries of available variants
 */
function buildVariantRegistries() {
    // Build terrain variant registry
    if (definitions.terrain?.sprites) {
        for (const sprite of definitions.terrain.sprites) {
            const type = sprite.metadata?.terrainType;
            if (!type) continue;

            if (!variantRegistry.terrain[type]) {
                variantRegistry.terrain[type] = { variants: [], ids: [] };
            }
            variantRegistry.terrain[type].variants.push(sprite.metadata?.variant || 0);
            variantRegistry.terrain[type].ids.push(sprite.id);
        }
    }

    // Build unit variant registry
    if (definitions.units?.sprites) {
        for (const sprite of definitions.units.sprites) {
            const unitClass = sprite.metadata?.unitClass;
            if (!unitClass) continue;

            if (!variantRegistry.units[unitClass]) {
                variantRegistry.units[unitClass] = { states: new Set(), ids: [] };
            }
            variantRegistry.units[unitClass].states.add(sprite.metadata?.state || 'normal');
            variantRegistry.units[unitClass].ids.push(sprite.id);
        }
        // Convert sets to arrays
        for (const info of Object.values(variantRegistry.units)) {
            info.states = Array.from(info.states);
        }
    }

    // Build detail variant registry
    if (definitions.details?.sprites) {
        for (const sprite of definitions.details.sprites) {
            const detailType = sprite.metadata?.detailType;
            if (!detailType) continue;

            if (!variantRegistry.details[detailType]) {
                variantRegistry.details[detailType] = { variants: [], ids: [] };
            }
            variantRegistry.details[detailType].variants.push(sprite.metadata?.variant || 0);
            variantRegistry.details[detailType].ids.push(sprite.id);
        }
    }
}

/**
 * Load an image
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
 * Get sprite loading statistics
 */
function getSpriteStats() {
    return {
        units: spriteRegistry.units.size,
        terrain: spriteRegistry.terrain.size,
        details: spriteRegistry.details.size,
        terrainTypes: Object.keys(variantRegistry.terrain).length,
        detailTypes: Object.keys(variantRegistry.details).length,
        unitClasses: Object.keys(variantRegistry.units).length
    };
}

// ============================================
// PUBLIC API - These are the main access points
// ============================================

/**
 * Get a terrain texture by type
 * Automatically selects a variant based on position for visual variety
 */
export function getTerrainSprite(terrainType, q = 0, r = 0) {
    const info = variantRegistry.terrain[terrainType];
    if (!info || info.ids.length === 0) return null;

    // Deterministic variant selection based on hex position
    const hash = Math.abs(((q * 73856093) ^ (r * 19349663)) % info.ids.length);
    const spriteId = info.ids[hash];

    return spriteRegistry.terrain.get(spriteId) || null;
}

/**
 * Get number of variants for a terrain type
 */
export function getTerrainVariantCount(terrainType) {
    return variantRegistry.terrain[terrainType]?.ids.length || 0;
}

/**
 * Get all terrain types that have sprites loaded
 */
export function getAvailableTerrainTypes() {
    return Object.keys(variantRegistry.terrain);
}

/**
 * Get a unit sprite with optional facing direction
 * @param {string} unitClass - The unit class (scout, assault, etc.)
 * @param {number} playerIndex - Player index (0-3)
 * @param {string} state - Unit state (normal, cover, attack, dead)
 * @param {string} facing - Facing direction ('left' or 'right'), defaults to base direction
 * @returns {ImageBitmap|HTMLCanvasElement|null} The sprite image or null if not found
 */
export function getUnitSprite(unitClass, playerIndex, state = 'normal', facing = null) {
    const key = `${unitClass}_${state}_${playerIndex}`;
    const sprite = spriteRegistry.units.get(key) || null;

    if (!sprite) return null;

    // If no facing specified or matches base direction, return original
    if (!facing || facing === baseFacingDirection) {
        return sprite;
    }

    // Need to mirror the sprite for opposite direction
    const mirrorKey = `${key}_mirrored`;
    if (mirroredSpriteCache.has(mirrorKey)) {
        return mirroredSpriteCache.get(mirrorKey);
    }

    // Create mirrored version
    const mirrored = createMirroredSprite(sprite);
    mirroredSpriteCache.set(mirrorKey, mirrored);
    return mirrored;
}

/**
 * Create a horizontally flipped version of a sprite
 * @param {ImageBitmap|HTMLImageElement|HTMLCanvasElement} sprite - Source sprite
 * @returns {HTMLCanvasElement} Mirrored sprite canvas
 */
function createMirroredSprite(sprite) {
    const canvas = document.createElement('canvas');
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const ctx = canvas.getContext('2d');

    // Flip horizontally
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0);

    return canvas;
}

/**
 * Get available states for a unit class
 */
export function getUnitStates(unitClass) {
    return variantRegistry.units[unitClass]?.states || ['normal'];
}

/**
 * Get all unit classes that have sprites loaded
 */
export function getAvailableUnitClasses() {
    return Object.keys(variantRegistry.units);
}

/**
 * Get a detail sprite (tree, bush, grass, rock)
 */
export function getDetailSprite(detailType, variant = 0) {
    const info = variantRegistry.details[detailType];
    if (!info || info.ids.length === 0) return null;

    // Find the sprite with matching variant, or use first available
    const spriteId = info.ids.find((id, i) => info.variants[i] === variant) || info.ids[0];
    return spriteRegistry.details.get(spriteId) || null;
}

/**
 * Get a random detail sprite of a given type
 */
export function getRandomDetailSprite(detailType, seed = Math.random()) {
    const info = variantRegistry.details[detailType];
    if (!info || info.ids.length === 0) return null;

    const index = Math.floor(seed * info.ids.length) % info.ids.length;
    return spriteRegistry.details.get(info.ids[index]) || null;
}

/**
 * Get number of variants for a detail type
 */
export function getDetailVariantCount(detailType) {
    return variantRegistry.details[detailType]?.ids.length || 0;
}

/**
 * Get all detail types that have sprites loaded
 */
export function getAvailableDetailTypes() {
    return Object.keys(variantRegistry.details);
}

/**
 * Check if the sprite sheet system is fully loaded
 */
export function isSpriteSheetLoaded() {
    return isLoaded;
}

/**
 * Get the full variant registry (for debugging/tools)
 */
export function getVariantRegistry() {
    return { ...variantRegistry };
}

/**
 * Get the JSON definitions (for debugging/tools)
 */
export function getDefinitions() {
    return { ...definitions };
}
