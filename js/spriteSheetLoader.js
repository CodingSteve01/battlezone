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
    details: new Map(),    // detailType_variant -> ImageBitmap
    overlays: new Map()    // overlayType_variant -> ImageBitmap
};

// Anchor point registry - stores normalized anchor points for sprites
// Key: sprite id, Value: { x: 0-1, y: 0-1 } where (0.5, 1.0) means center-bottom
const anchorRegistry = new Map();

// Content scale registry - stores the scale factor for cropped sprites
// Key: sprite id, Value: { scaleX, scaleY } where 1.0 means no cropping
// Used to draw sprites at correct size relative to originalSize
const contentScaleRegistry = new Map();

// Tile info registry - stores isometric tile dimensions
// Key: type (e.g., 'terrain'), Value: { spriteWidth, totalHeight, hexHeight, earthLayerHeight }
let terrainTileInfo = null;

// Cache for mirrored (horizontally flipped) sprites
const mirroredSpriteCache = new Map();

// Base facing direction from sprite sheet (from JSON definition)
let baseFacingDirection = 'right';

// Metadata registries - stores info about available variants
const variantRegistry = {
    units: {},      // unitClass -> { states: [], playerCount: 4 }
    terrain: {},    // terrainType -> { variants: [] }
    details: {},    // detailType -> { variants: [] }
    overlays: {}    // overlayType -> { variants: [] }
};

// JSON definitions cache
const definitions = {
    units: null,
    terrain: null,
    details: null,
    trees: null,
    overlays: null
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
            loadDefinition('trees', 'trees.json'),
            loadDefinition('overlays', 'shorelines.json'),
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

        // Read tile info for isometric terrain tiles
        if (type === 'terrain' && definitions[type].tileInfo) {
            terrainTileInfo = definitions[type].tileInfo;
            console.log(`[SpriteSheetLoader] Isometric terrain tiles: hexHeight=${terrainTileInfo.hexHeight}, earthLayer=${terrainTileInfo.earthLayerHeight}`);
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
 * Since we now use sprite sheets directly, this always returns false
 */
async function checkExtractedAssets() {
    // We always use sprite sheet extraction now
    return false;
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
 * Get the sprite sheet PNG filename for a definition type
 * Uses the source field if present, otherwise infers from type name
 */
function getSheetFilename(type, def) {
    if (def?.source) return def.source;

    // Infer PNG filename from type
    const typeToFile = {
        units: 'unit-sprites.png',
        terrain: 'terrain-hexes.png',
        details: 'environment-details.png',
        trees: 'trees.png',
        overlays: 'shorelines.png'
    };
    return typeToFile[type] || `${type}.png`;
}

/**
 * Load sprite sheets and extract at runtime
 */
async function loadAndExtractSpriteSheets() {
    console.log('[SpriteSheetLoader] Loading sprite sheets...');

    // Load main sprite sheets
    for (const [type, def] of Object.entries(definitions)) {
        if (!def?.sprites || type === 'additionalUnits') continue;

        const filename = getSheetFilename(type, def);
        try {
            const sheetImg = await loadImage(`${SPRITESHEETS_PATH}/${filename}`);
            await extractSpritesFromSheet(type, sheetImg, def);
            console.log(`[SpriteSheetLoader] Extracted ${def.sprites.length} sprites from ${filename}`);
        } catch (err) {
            console.warn(`[SpriteSheetLoader] Could not load sprite sheet ${filename}:`, err.message);
        }
    }

    // Load additional unit sprite sheets (e.g., sniper)
    if (definitions.additionalUnits) {
        for (const additionalDef of definitions.additionalUnits) {
            const filename = additionalDef?.source || 'sniper-sprites.png';

            try {
                const sheetImg = await loadImage(`${SPRITESHEETS_PATH}/${filename}`);
                await extractSpritesFromSheet('units', sheetImg, additionalDef);
                console.log(`[SpriteSheetLoader] Extracted from ${filename}`);
            } catch (err) {
                console.warn(`[SpriteSheetLoader] Could not load additional sprite sheet ${filename}:`, err.message);
            }
        }
    }
}

/**
 * Extract sprites from a loaded sprite sheet image
 * Supports both v1.0 (bounds only) and v2.0 (contentBounds + anchor) formats
 */
async function extractSpritesFromSheet(type, sheetImg, definition) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const isV2 = definition.version === '2.0' || definition.features?.includes('cropped');

    // Check if this is isometric terrain with earth layer - need full bounds for two-pass rendering
    const hasEarthLayer = definition.features?.includes('earthLayer') && type === 'terrain';

    for (const sprite of definition.sprites || []) {
        if (!sprite.bounds) continue;

        // V2.0 format: use contentBounds if available (actual sprite content)
        // V1.0 format: use bounds directly
        // EXCEPTION: For terrain with earthLayer, always use full bounds to include cliff faces
        const sourceBounds = (hasEarthLayer || !sprite.contentBounds) ? sprite.bounds : sprite.contentBounds;
        const { x, y, width, height } = sourceBounds;
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

        // Store anchor point if available (V2.0 format)
        if (sprite.anchor) {
            anchorRegistry.set(sprite.id, {
                x: sprite.anchor.x,
                y: sprite.anchor.y
            });
        }

        // Store content scale if we have both contentBounds and originalSize
        // This tells us how much of the original cell the content occupies
        const originalSize = sprite.metadata?.originalSize || sprite.bounds;
        if (sprite.contentBounds && originalSize) {
            const scaleX = sprite.contentBounds.width / originalSize.width;
            const scaleY = sprite.contentBounds.height / originalSize.height;
            contentScaleRegistry.set(sprite.id, { scaleX, scaleY });
        }

        // Handle different sprite types
        if (type === 'units') {
            const unitClass = sprite.metadata?.unitClass;
            const state = sprite.metadata?.state || 'normal';
            const player = sprite.metadata?.player;

            if (unitClass && player !== undefined) {
                // New format: sprites already have player index
                const key = `${unitClass}_${state}_${player}`;
                spriteRegistry.units.set(key, bitmap);
                // Also store anchor and content scale for unit key
                if (sprite.anchor) {
                    anchorRegistry.set(key, sprite.anchor);
                }
                if (contentScaleRegistry.has(sprite.id)) {
                    contentScaleRegistry.set(key, contentScaleRegistry.get(sprite.id));
                }
            } else if (definition.colorize?.enabled) {
                // Old format: colorize to generate player variants
                const colors = definition.colorize.targetColors || CONFIG.PLAYER_COLORS;
                for (let p = 0; p < colors.length; p++) {
                    const colored = colorizeCanvas(canvas, colors[p]);
                    const coloredBitmap = await createImageBitmap(colored);
                    const key = `${unitClass}_${state}_${p}`;
                    spriteRegistry.units.set(key, coloredBitmap);
                    if (sprite.anchor) {
                        anchorRegistry.set(key, sprite.anchor);
                    }
                }
            } else {
                // Fallback: just store by id
                spriteRegistry.units.set(sprite.id, bitmap);
            }
        } else if (type === 'trees') {
            // Trees go into the details registry with tree_ prefix
            const treeType = sprite.metadata?.type;
            if (treeType) {
                spriteRegistry.details.set(sprite.id, bitmap);
            }
        } else if (type === 'overlays') {
            spriteRegistry.overlays.set(sprite.id, bitmap);
        } else {
            // Terrain and details: store by id
            spriteRegistry[type].set(sprite.id, bitmap);
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
            // Support both 'type' and 'terrainType' for flexibility
            const type = sprite.metadata?.terrainType || sprite.metadata?.type;
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
            // Support both 'type' and 'detailType', with optional subtype
            let detailType = sprite.metadata?.detailType || sprite.metadata?.type;
            if (!detailType) continue;

            // If there's a subtype, combine them (e.g., bush_round, grass_tall)
            const subtype = sprite.metadata?.subtype;
            if (subtype) {
                detailType = `${detailType}_${subtype}`;
            }

            if (!variantRegistry.details[detailType]) {
                variantRegistry.details[detailType] = { variants: [], ids: [] };
            }
            variantRegistry.details[detailType].variants.push(sprite.metadata?.variant || 0);
            variantRegistry.details[detailType].ids.push(sprite.id);
        }
    }

    // Build overlay variant registry (shorelines, etc.)
    if (definitions.overlays?.sprites) {
        for (const sprite of definitions.overlays.sprites) {
            const detailType = sprite.metadata?.detailType || sprite.metadata?.type;
            if (!detailType) continue;

            if (!variantRegistry.overlays[detailType]) {
                variantRegistry.overlays[detailType] = { variants: [], ids: [] };
            }
            variantRegistry.overlays[detailType].variants.push(sprite.metadata?.variant || 0);
            variantRegistry.overlays[detailType].ids.push(sprite.id);
        }
    }

    // Build tree variant registry (trees are stored in a separate definition)
    if (definitions.trees?.sprites) {
        // Also register all trees under generic 'tree' type for random selection
        if (!variantRegistry.details['tree']) {
            variantRegistry.details['tree'] = { variants: [], ids: [] };
        }

        for (const sprite of definitions.trees.sprites) {
            const treeType = sprite.metadata?.type;
            if (!treeType) continue;

            // Register under specific type (tree_oak, tree_pine, etc.)
            const detailType = `tree_${treeType}`;
            if (!variantRegistry.details[detailType]) {
                variantRegistry.details[detailType] = { variants: [], ids: [] };
            }
            variantRegistry.details[detailType].variants.push(sprite.metadata?.variant || 0);
            variantRegistry.details[detailType].ids.push(sprite.id);

            // Also register under generic 'tree' type
            variantRegistry.details['tree'].variants.push(sprite.metadata?.variant || 0);
            variantRegistry.details['tree'].ids.push(sprite.id);
        }
    }

    // Create generic aliases for bush and grass detail types
    // This allows getRandomDetailSprite('bush') to return any bush variant
    const genericAliases = {
        'bush': ['bush_round', 'bush_wild', 'bush_flowering', 'bush_berry', 'bush_fern'],
        'grass': ['grass_short', 'grass_tall', 'grass_wheat', 'grass_reed']
    };

    for (const [genericType, subtypes] of Object.entries(genericAliases)) {
        if (!variantRegistry.details[genericType]) {
            variantRegistry.details[genericType] = { variants: [], ids: [] };
        }
        for (const subtype of subtypes) {
            const info = variantRegistry.details[subtype];
            if (info) {
                variantRegistry.details[genericType].variants.push(...info.variants);
                variantRegistry.details[genericType].ids.push(...info.ids);
            }
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
 * Get isometric terrain tile info (dimensions, earth layer height)
 * Returns null if using non-isometric (flat) tiles
 */
export function getTerrainTileInfo() {
    return terrainTileInfo;
}

/**
 * Check if terrain tiles are isometric (have earth layer)
 */
export function hasIsometricTiles() {
    return terrainTileInfo !== null && terrainTileInfo.earthLayerHeight > 0;
}

// Fallback mappings for unit classes without dedicated sprites
// Maps missing classes to similar-looking alternatives
const UNIT_FALLBACKS = {
    elitesoldat: 'assault',  // Elite soldier uses assault sprite as fallback
    commando: 'scout',       // Commando uses scout as fallback if missing
};

// Cache for colorized player sprites (players 4-7)
const colorizedSpriteCache = new Map();

/**
 * Get a unit sprite with optional facing direction
 * For players 4-7 (without dedicated sprites), colorizes player 0-3 sprites
 * @param {string} unitClass - The unit class (scout, assault, etc.)
 * @param {number} playerIndex - Player index (0-7)
 * @param {string} state - Unit state (normal, cover, attack, dead)
 * @param {string} facing - Facing direction ('left' or 'right'), defaults to base direction
 * @returns {ImageBitmap|HTMLCanvasElement|null} The sprite image or null if not found
 */
export function getUnitSprite(unitClass, playerIndex, state = 'normal', facing = null) {
    const key = `${unitClass}_${state}_${playerIndex}`;
    let sprite = spriteRegistry.units.get(key) || null;

    // If sprite not found, try fallback unit class
    if (!sprite && UNIT_FALLBACKS[unitClass]) {
        const fallbackClass = UNIT_FALLBACKS[unitClass];
        const fallbackKey = `${fallbackClass}_${state}_${playerIndex}`;
        sprite = spriteRegistry.units.get(fallbackKey) || null;
        if (sprite) {
            console.log(`[SpriteSheetLoader] Using fallback sprite: ${fallbackClass} for ${unitClass}`);
        }
    }

    // === FALLBACK FOR PLAYERS 4-7: Use colorized version of player 0-3 sprites ===
    if (!sprite && playerIndex >= 4) {
        // Map player 4-7 to base player 0-3
        const basePlayer = playerIndex % 4;
        const baseKey = `${unitClass}_${state}_${basePlayer}`;
        const baseSprite = spriteRegistry.units.get(baseKey);

        // Try fallback class if needed
        let sourceSpriteKey = baseKey;
        let sourceSprite = baseSprite;
        if (!sourceSprite && UNIT_FALLBACKS[unitClass]) {
            const fallbackClass = UNIT_FALLBACKS[unitClass];
            sourceSpriteKey = `${fallbackClass}_${state}_${basePlayer}`;
            sourceSprite = spriteRegistry.units.get(sourceSpriteKey);
        }

        if (sourceSprite) {
            // Check cache first
            const colorizedKey = `${key}_colorized`;
            if (colorizedSpriteCache.has(colorizedKey)) {
                sprite = colorizedSpriteCache.get(colorizedKey);
            } else {
                // Create colorized version for this player
                const playerColor = CONFIG.PLAYER_COLORS[playerIndex];
                sprite = colorizeSprite(sourceSprite, playerColor);
                colorizedSpriteCache.set(colorizedKey, sprite);
                console.log(`[SpriteSheetLoader] Colorized sprite for player ${playerIndex}: ${unitClass}_${state}`);
            }
        }
    }

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
 * Colorize a sprite with a player color
 * Supports two modes:
 * 1. Template mode: Replaces magenta (#FF00FF) pixels with player color (precise)
 * 2. Tint mode: Applies overall color tint (fallback for non-template sprites)
 *
 * @param {ImageBitmap|HTMLCanvasElement} sourceSprite - Source sprite to colorize
 * @param {string} targetColor - Target player color (hex)
 * @param {boolean} useTemplateMode - If true, replace magenta pixels; if false, tint entire sprite
 * @returns {HTMLCanvasElement} Colorized sprite
 */
function colorizeSprite(sourceSprite, targetColor, useTemplateMode = true) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceSprite.width;
    canvas.height = sourceSprite.height;
    const ctx = canvas.getContext('2d');

    // Draw original sprite
    ctx.drawImage(sourceSprite, 0, 0);

    if (useTemplateMode) {
        // === TEMPLATE MODE: Replace magenta pixels with player color ===
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Parse target color
        const targetRGB = hexToRgb(targetColor);
        if (!targetRGB) {
            console.warn('[colorizeSprite] Invalid target color:', targetColor);
            return canvas;
        }

        // Template colors to replace (magenta tones)
        const templateColors = [
            { r: 255, g: 0, b: 255 },    // Primary: #FF00FF
            { r: 204, g: 0, b: 204 },    // Secondary: #CC00CC (darker)
            { r: 255, g: 102, b: 255 },  // Highlight: #FF66FF (lighter)
        ];

        // Calculate variants of target color (similar brightness ratios)
        const targetVariants = [
            targetRGB,                                           // Primary
            { r: Math.floor(targetRGB.r * 0.8), g: Math.floor(targetRGB.g * 0.8), b: Math.floor(targetRGB.b * 0.8) }, // Secondary (darker)
            { r: Math.min(255, Math.floor(targetRGB.r * 1.3)), g: Math.min(255, Math.floor(targetRGB.g * 1.3)), b: Math.min(255, Math.floor(targetRGB.b * 1.3)) }  // Highlight (lighter)
        ];

        let pixelsReplaced = 0;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue; // Skip transparent pixels

            // Check if this pixel matches any template color (with tolerance)
            for (let t = 0; t < templateColors.length; t++) {
                const template = templateColors[t];
                const tolerance = 30; // Allow some variation

                if (Math.abs(r - template.r) <= tolerance &&
                    Math.abs(g - template.g) <= tolerance &&
                    Math.abs(b - template.b) <= tolerance) {
                    // Replace with corresponding target variant
                    const target = targetVariants[t];
                    data[i] = target.r;
                    data[i + 1] = target.g;
                    data[i + 2] = target.b;
                    pixelsReplaced++;
                    break;
                }
            }
        }

        // Only apply if we actually found template pixels; otherwise fall back to tint mode
        if (pixelsReplaced > 0) {
            ctx.putImageData(imageData, 0, 0);
            return canvas;
        }
        // Fall through to tint mode if no template pixels found
    }

    // === TINT MODE: Apply overall color tint (fallback) ===
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = targetColor;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return canvas;
}

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
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
 * Get an overlay sprite (shoreline, etc.)
 */
export function getOverlaySprite(detailType, variant = 0) {
    const info = variantRegistry.overlays[detailType];
    if (!info || info.ids.length === 0) return null;

    const spriteId = info.ids.find((id, i) => info.variants[i] === variant) || info.ids[0];
    return spriteRegistry.overlays.get(spriteId) || null;
}

export function getOverlayVariantCount(detailType) {
    return variantRegistry.overlays[detailType]?.ids.length || 0;
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
 * Get a random detail sprite with its anchor point and content scale
 * @param {string} detailType - Type of detail (tree, bush, grass, rock)
 * @param {number} seed - Random seed for consistent selection
 * @returns {Object|null} { sprite: ImageBitmap, anchor: { x, y }, contentScale: { scaleX, scaleY } } or null
 */
export function getRandomDetailSpriteWithAnchor(detailType, seed = Math.random()) {
    const info = variantRegistry.details[detailType];
    if (!info || info.ids.length === 0) return null;

    const index = Math.floor(seed * info.ids.length) % info.ids.length;
    const spriteId = info.ids[index];
    const sprite = spriteRegistry.details.get(spriteId);

    if (!sprite) return null;

    // Get anchor for this specific sprite, default to center-bottom
    const anchor = anchorRegistry.get(spriteId) || { x: 0.5, y: 1.0 };

    // Get content scale for this specific sprite, default to no scaling
    const contentScale = contentScaleRegistry.get(spriteId) || { scaleX: 1, scaleY: 1 };

    return { sprite, anchor, contentScale };
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

// ============================================
// ANCHOR POINT API
// ============================================

/**
 * Get anchor point for a sprite by ID
 * Returns normalized coordinates (0-1) where (0.5, 1.0) is center-bottom
 * @param {string} spriteId - The sprite ID
 * @returns {Object|null} { x: 0-1, y: 0-1 } or null if no anchor defined
 */
export function getAnchorPoint(spriteId) {
    return anchorRegistry.get(spriteId) || null;
}

/**
 * Get anchor point for a detail sprite
 * @param {string} detailType - Detail type (tree, bush, grass, etc.)
 * @param {number} variant - Variant index
 * @returns {Object|null} { x: 0-1, y: 0-1 } or default center-bottom
 */
export function getDetailAnchor(detailType, variant = 0) {
    const info = variantRegistry.details[detailType];
    if (!info || info.ids.length === 0) return { x: 0.5, y: 1.0 };

    const spriteId = info.ids.find((id, i) => info.variants[i] === variant) || info.ids[0];
    return anchorRegistry.get(spriteId) || { x: 0.5, y: 1.0 };
}

/**
 * Get anchor point for a unit sprite
 * @param {string} unitClass - Unit class
 * @param {number} playerIndex - Player index
 * @param {string} state - Unit state
 * @returns {Object} { x: 0-1, y: 0-1 } or default center-bottom
 */
export function getUnitAnchor(unitClass, playerIndex, state = 'normal') {
    const key = `${unitClass}_${state}_${playerIndex}`;
    return anchorRegistry.get(key) || { x: 0.5, y: 1.0 };
}

/**
 * Get content scale for a unit sprite
 * Returns how much of the original cell the cropped content occupies
 * @param {string} unitClass - Unit class
 * @param {number} playerIndex - Player index
 * @param {string} state - Unit state
 * @returns {Object} { scaleX: 0-1, scaleY: 0-1 } or { scaleX: 1, scaleY: 1 } if not cropped
 */
export function getUnitContentScale(unitClass, playerIndex, state = 'normal') {
    const key = `${unitClass}_${state}_${playerIndex}`;
    return contentScaleRegistry.get(key) || { scaleX: 1, scaleY: 1 };
}

/**
 * Get content scale for a detail sprite
 * @param {string} detailType - Detail type (tree, bush, grass, etc.)
 * @param {number} variant - Variant index
 * @returns {Object} { scaleX: 0-1, scaleY: 0-1 } or { scaleX: 1, scaleY: 1 } if not cropped
 */
export function getDetailContentScale(detailType, variant = 0) {
    const info = variantRegistry.details[detailType];
    if (!info || info.ids.length === 0) return { scaleX: 1, scaleY: 1 };

    const spriteId = info.ids.find((id, i) => info.variants[i] === variant) || info.ids[0];
    return contentScaleRegistry.get(spriteId) || { scaleX: 1, scaleY: 1 };
}

/**
 * Check if anchor points are available (V2.0 format sprites)
 * @returns {boolean}
 */
export function hasAnchorPoints() {
    return anchorRegistry.size > 0;
}
