// ===== CANVAS RENDERING =====

import { CONFIG, TERRAIN, UNIT_CLASSES } from './config.js';
import { state, getHex, getCurrentUnit, getVisibleGhosts, getQueuedPath, getPlayerUnits, isHexInZone, updateScreenShake } from './state.js';
import { hexToPixel, hexDistance, getNeighbors } from './hexMath.js';
import { getReachableHexes } from './pathfinding.js';
import { getAttackableUnits, getEffectiveRange, getBlockedTargets } from './units.js';
import { getFogLevel, isUnitVisible, isUnitVisibleToViewer, getEnemyCloakedVisibilityAlpha, updateVisibilityForPlayer } from './fogOfWar.js';
import { isSpectatorMode } from './ai.js';
import { getTexture, drawUnit as drawUnitSprite, getRandomDetailSprite, hasAnimatedTexture, getAnimatedTexture } from './assetLoader.js';
import { getPowerupAt, POWERUP_TYPES } from './powerups.js';
import { getCurrentEvent } from './events.js';
import { getRankName } from './progression.js';
import { particles, updateParticles, drawParticles } from './particles.js';
import { isAIPlayer } from './ai.js';
import { logRender, logError } from './errorLog.js';

// ===== STUB FUNCTIONS FOR REMOVED MODULES =====
// These replace the old procedural rendering with simple alternatives

function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

function animationTick() { /* no-op */ }

/**
 * Get terrain types of neighboring hexes
 * Returns array of 6 terrain types (or null if no neighbor exists), indexed by direction
 * Direction 0 = right (1,0), then clockwise
 */
function getNeighborTerrains(hexMap, q, r) {
    const neighbors = getNeighbors(q, r);
    return neighbors.map(n => {
        const key = `${n.q},${n.r}`;
        const hex = hexMap.get(key);
        return hex ? hex.type : null;
    });
}

/**
 * Draw terrain transition blend overlays
 * Creates smooth transitions between different terrain types
 */
function drawTerrainBlend(ctx, cx, cy, size, terrainType, neighborTerrains) {
    if (!neighborTerrains || neighborTerrains.length !== 6) return;

    const currentTerrain = TERRAIN[terrainType];
    if (!currentTerrain) return;

    // Hex edge angles (starting from right, going clockwise)
    const edgeAngles = [0, 60, 120, 180, 240, 300].map(a => a * Math.PI / 180);

    ctx.save();

    // For each neighbor, check if terrain differs and draw blend
    for (let i = 0; i < 6; i++) {
        const neighborType = neighborTerrains[i];
        if (!neighborType || neighborType === terrainType) continue;

        const neighborTerrain = TERRAIN[neighborType];
        if (!neighborTerrain) continue;

        // Determine blend priority - some terrains should blend "over" others
        // Water > rock > forest > grass (lower priority terrains blend onto higher)
        const priority = { water: 5, deepwater: 5, rock: 4, cliff: 4, forest: 3, pine: 3, swamp: 2, mud: 2 };
        const currentPriority = priority[terrainType] || 1;
        const neighborPriority = priority[neighborType] || 1;

        // Only draw blend if neighbor has higher priority (it would blend onto us)
        if (neighborPriority <= currentPriority) continue;

        // Calculate edge center point
        const angle1 = edgeAngles[i];
        const angle2 = edgeAngles[(i + 1) % 6];
        const edgeMidAngle = (angle1 + angle2) / 2;

        // Create gradient from edge center toward hex center
        const edgeDist = size * 0.95;
        const gradientStart = {
            x: cx + Math.cos(edgeMidAngle) * edgeDist,
            y: cy + Math.sin(edgeMidAngle) * edgeDist
        };
        const gradientEnd = {
            x: cx + Math.cos(edgeMidAngle) * size * 0.3,
            y: cy + Math.sin(edgeMidAngle) * size * 0.3
        };

        // Draw triangular blend zone at this edge
        const corner1 = {
            x: cx + Math.cos(angle1) * size,
            y: cy + Math.sin(angle1) * size
        };
        const corner2 = {
            x: cx + Math.cos(angle2) * size,
            y: cy + Math.sin(angle2) * size
        };

        // Create gradient with neighbor's color fading in
        const gradient = ctx.createLinearGradient(
            gradientStart.x, gradientStart.y,
            gradientEnd.x, gradientEnd.y
        );

        // Use neighbor's color at edge, fading to transparent
        const blendColor = neighborTerrain.colorDark || neighborTerrain.color;
        gradient.addColorStop(0, blendColor + 'aa');  // Semi-transparent at edge
        gradient.addColorStop(0.4, blendColor + '55');
        gradient.addColorStop(0.7, blendColor + '22');
        gradient.addColorStop(1, 'transparent');

        // Draw blend triangle
        ctx.beginPath();
        ctx.moveTo(corner1.x, corner1.y);
        ctx.lineTo(corner2.x, corner2.y);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    ctx.restore();
}

function initVegetationRenderer() { /* no-op */ }
function initTerrainRenderer() { /* no-op */ }

// Terrain detail stubs - draw nothing (use sprites instead)
function drawAnimatedGrass() { }
function drawAnimatedWater() { }
function drawShallowWater() { }
function drawWheatField() { }
function drawReeds() { }
function drawSnowfall() { }
function drawSnowDetails() { }
function drawIceReflections() { }
function drawFlowers() { }
function drawHeather() { }
function drawRuins() { }
function drawGravel() { }
function drawFarmland() { }
function drawMud() { }
function drawForestFloor() { }
function drawHillsDetails() { }
function drawRoadDetails() { }
function drawPathDetails() { }
function drawRiverDetails() { }

// Vegetation functions - draw sprites from sprite sheet with variation
function drawTree2D5(x, y, size, treeType, seed) {
    const sprite = getRandomDetailSprite('tree', seed * 0.001);
    if (sprite) {
        // Size variation: 0.7x to 1.3x base size
        const sizeVariation = 0.7 + seededRandom(seed * 1.1) * 0.6;
        const spriteHeight = size * 2.8 * sizeVariation;
        const spriteWidth = spriteHeight * (sprite.width / sprite.height);

        // Random horizontal mirror (50% chance)
        const shouldMirror = seededRandom(seed * 2.2) > 0.5;

        ctx.save();
        if (shouldMirror) {
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -spriteWidth / 2, -spriteHeight, spriteWidth, spriteHeight);
        } else {
            ctx.drawImage(sprite, x - spriteWidth / 2, y - spriteHeight, spriteWidth, spriteHeight);
        }
        ctx.restore();
    }
}

function drawBush2D5(x, y, size, seed) {
    const sprite = getRandomDetailSprite('bush', seed * 0.001);
    if (sprite) {
        // Size variation: 0.6x to 1.4x
        const sizeVariation = 0.6 + seededRandom(seed * 1.3) * 0.8;
        const spriteSize = size * 1.6 * sizeVariation;

        // Random horizontal mirror
        const shouldMirror = seededRandom(seed * 2.4) > 0.5;

        ctx.save();
        if (shouldMirror) {
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -spriteSize / 2, -spriteSize * 0.8, spriteSize, spriteSize);
        } else {
            ctx.drawImage(sprite, x - spriteSize / 2, y - spriteSize * 0.8, spriteSize, spriteSize);
        }
        ctx.restore();
    }
}

function drawSmallShrub(x, y, size, seed) {
    const sprite = getRandomDetailSprite('grass', seed * 0.001);
    if (sprite) {
        const sizeVariation = 0.7 + seededRandom(seed * 1.5) * 0.6;
        const spriteSize = size * 1.3 * sizeVariation;
        const shouldMirror = seededRandom(seed * 2.6) > 0.5;

        ctx.save();
        if (shouldMirror) {
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -spriteSize / 2, -spriteSize * 0.6, spriteSize, spriteSize);
        } else {
            ctx.drawImage(sprite, x - spriteSize / 2, y - spriteSize * 0.6, spriteSize, spriteSize);
        }
        ctx.restore();
    }
}

function drawFlowerCluster(x, y, size, seed) {
    const sprite = getRandomDetailSprite('grass', seed * 0.001);
    if (sprite) {
        const sizeVariation = 0.5 + seededRandom(seed * 1.7) * 0.5;
        const spriteSize = size * 0.9 * sizeVariation;
        ctx.drawImage(sprite, x - spriteSize / 2, y - spriteSize * 0.5, spriteSize, spriteSize);
    }
}

function drawRockFormation2D5(x, y, size, seed) {
    // Draw procedural rock since we don't have rock sprites yet
    const sizeVariation = 0.5 + seededRandom(seed) * 0.8;
    const rockSize = size * 0.6 * sizeVariation;

    ctx.save();
    ctx.translate(x, y);

    // Rock base color with variation
    const grayValue = 80 + seededRandom(seed * 3) * 40;
    ctx.fillStyle = `rgb(${grayValue}, ${grayValue - 5}, ${grayValue - 10})`;

    // Draw irregular rock shape
    ctx.beginPath();
    const points = 6 + Math.floor(seededRandom(seed * 4) * 3);
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const dist = rockSize * (0.6 + seededRandom(seed + i) * 0.4);
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist * 0.6 - rockSize * 0.3; // Flatten and raise
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.ellipse(-rockSize * 0.2, -rockSize * 0.4, rockSize * 0.25, rockSize * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(rockSize * 0.1, rockSize * 0.1, rockSize * 0.4, rockSize * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Post-processing stubs
function applyPostProcessing(ctx) { /* no-op */ }
function applyWeatherEffect() { /* no-op */ }
export function setColorPreset() { }
export function getCurrentPreset() { return 'default'; }
export function getPresetList() { return ['default']; }

let canvas, ctx;
let texturesInitialized = false;

// ===== HEX TILE CACHING SYSTEM =====
// Pre-renders hex tiles with terrain details for improved performance

/**
 * Cache for pre-rendered hex tiles.
 * Key format: "${q},${r}_${fogLevel}_${quality}"
 * Value: OffscreenCanvas or regular Canvas with the pre-rendered hex
 */
const hexTileCache = new Map();

/**
 * Cache for pre-rendered foreground elements (trees, rocks, bushes).
 * Key format: "${q},${r}"
 * Value: { canvas, elements } where elements contains position data for sorting
 */
const foregroundCache = new Map();

/**
 * Track the current quality level for cache invalidation
 */
let cachedQualityLevel = null;

/**
 * Base hex size for caching - tiles are cached at this size and scaled when drawn
 * This prevents cache invalidation during zoom operations
 */
const CACHE_BASE_HEX_SIZE = 60;

/**
 * Maximum number of cached tiles to prevent memory issues
 */
// Increased cache size to prevent eviction during scrolling/zoom
// A large map with full visibility needs ~500 tiles, plus 3 fog levels = 1500
const MAX_CACHE_SIZE = 2000;

/**
 * Clear all caches (call when map regenerates or quality changes significantly)
 */
export function clearRenderCaches() {
    hexTileCache.clear();
    foregroundCache.clear();
    cachedQualityLevel = null;
}

/**
 * Get or create cached foreground elements (trees, rocks, bushes) for a hex.
 * These are deterministic based on hex position, so they can be cached.
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @param {number} cx - Screen X center position
 * @param {number} cy - Screen Y center position
 * @param {number} size - Current hex size
 * @param {string} type - Terrain type
 * @returns {Array} Array of foreground element objects with draw functions
 */
function getCachedForegroundElements(q, r, cx, cy, size, type) {
    const cacheKey = `${q},${r}`;

    // Check if we have cached element definitions for this hex
    if (!foregroundCache.has(cacheKey)) {
        // Cache the element DEFINITIONS (positions, types, seeds) not draw functions
        // This is cached at normalized values and scaled at draw time
        const elements = collectForegroundElementDefinitions(size, type, q, r);
        foregroundCache.set(cacheKey, elements);

        // Limit foreground cache size
        if (foregroundCache.size > MAX_CACHE_SIZE) {
            const keysToRemove = Array.from(foregroundCache.keys()).slice(0, MAX_CACHE_SIZE / 5);
            keysToRemove.forEach(key => foregroundCache.delete(key));
        }
    }

    const cachedDefinitions = foregroundCache.get(cacheKey);

    // Convert cached definitions to drawable objects with current screen coordinates
    return cachedDefinitions.map(def => {
        const actualX = cx + def.offsetX * size;
        const actualY = cy + def.offsetY * size;
        const actualSortY = cy + def.sortOffsetY * size;
        const actualSize = def.sizeMultiplier * size;

        return {
            type: def.type,
            x: actualX,
            y: actualY,
            sortY: actualSortY,
            draw: () => def.drawFn(actualX, actualY, actualSize, def.extraParams)
        };
    });
}

/**
 * Collect foreground element DEFINITIONS for caching.
 * Returns normalized positions/offsets that can be scaled for any hex size.
 */
function collectForegroundElementDefinitions(size, type, hexQ, hexR) {
    const elements = [];
    const s = 0.45; // Normalized size multiplier
    const baseSeed = hexQ * 127 + hexR * 311 + hexQ * hexR * 7;

    // Consistent sort offsets (normalized)
    const TREE_SORT_OFFSET = 0.4;
    const BG_TREE_SORT_OFFSET = 0.25;
    const SHRUB_SORT_OFFSET = 0.35;
    const BUSH_SORT_OFFSET = 0.38;
    const TREE_Y_OFFSET = 0.25;

    if (type === 'forest' || type === 'pine') {
        const baseTreeCount = 4 + Math.abs(baseSeed % 3);
        const hexRadius = s * 1.1;

        for (let i = 0; i < baseTreeCount; i++) {
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            const angle = i * goldenAngle + seededRandom(baseSeed + i) * 0.8;
            const radius = hexRadius * (0.2 + seededRandom(baseSeed + i * 7) * 0.8);

            const offsetX = Math.cos(angle) * radius * 0.85;
            const offsetY = Math.sin(angle) * radius * 0.7 + TREE_Y_OFFSET;

            const baseSizeVar = 0.5 + seededRandom(baseSeed + i * 10 + 2) * 1.3;
            const sizeMultiplier = s * baseSizeVar * 1.4;

            const treeType = type === 'pine' ? 0 : Math.floor(seededRandom(baseSeed + i * 10 + 3) * 6);

            elements.push({
                type: 'tree',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + TREE_SORT_OFFSET,
                sizeMultiplier,
                extraParams: { treeType, seed: baseSeed + i },
                drawFn: (x, y, sz, params) => drawTree2D5(x, y, sz, params.treeType, params.seed)
            });
        }

        // Edge trees
        const edgeTreeCount = 2 + Math.abs((baseSeed + 50) % 3);
        for (let i = 0; i < edgeTreeCount; i++) {
            const edgeAngle = (i / edgeTreeCount) * Math.PI * 2 + seededRandom(baseSeed + i * 20 + 200) * 0.6;
            const edgeRadius = hexRadius * (0.85 + seededRandom(baseSeed + i * 20 + 201) * 0.3);

            const offsetX = Math.cos(edgeAngle) * edgeRadius * 0.9;
            const offsetY = Math.sin(edgeAngle) * edgeRadius * 0.7 + TREE_Y_OFFSET;
            const sizeMultiplier = s * (0.6 + seededRandom(baseSeed + i * 20 + 202) * 1.0);
            const treeType = type === 'pine' ? 0 : Math.floor(seededRandom(baseSeed + i * 20 + 203) * 6);

            elements.push({
                type: 'tree-edge',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + BG_TREE_SORT_OFFSET,
                sizeMultiplier,
                extraParams: { treeType, seed: baseSeed + i + 100 },
                drawFn: (x, y, sz, params) => drawTree2D5(x, y, sz, params.treeType, params.seed)
            });
        }

        // Undergrowth
        const undergrowthCount = 3 + Math.abs((baseSeed + 100) % 3);
        for (let i = 0; i < undergrowthCount; i++) {
            const offsetX = (seededRandom(baseSeed + i * 15 + 101) - 0.5) * s * 1.4;
            const offsetY = (seededRandom(baseSeed + i * 15 + 102) - 0.5) * s * 0.9;
            const sizeMultiplier = s * (0.35 + seededRandom(baseSeed + i * 15 + 103) * 0.25);

            elements.push({
                type: 'shrub',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + SHRUB_SORT_OFFSET,
                sizeMultiplier,
                extraParams: { seed: baseSeed + i + 104 },
                drawFn: (x, y, sz, params) => drawSmallShrub(x, y, sz, params.seed)
            });
        }

        // Occasional large bush
        if (seededRandom(baseSeed + 300) > 0.6) {
            const offsetX = (seededRandom(baseSeed + 301) - 0.5) * s * 0.8;
            const offsetY = (seededRandom(baseSeed + 302) - 0.5) * s * 0.6;
            const sizeMultiplier = s * (0.6 + seededRandom(baseSeed + 303) * 0.3);

            elements.push({
                type: 'bush',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + BUSH_SORT_OFFSET,
                sizeMultiplier,
                extraParams: { seed: baseSeed + 304 },
                drawFn: (x, y, sz, params) => drawBush2D5(x, y, sz, params.seed)
            });
        }
    } else if (type === 'grass' || type === 'clearing' || type === 'flowers' || type === 'heather') {
        const grassType = Math.abs(baseSeed) % 100;

        if (grassType < 20) {
            const offsetX = (seededRandom(baseSeed + 500) - 0.5) * s * 0.6;
            const offsetY = (seededRandom(baseSeed + 501) - 0.5) * s * 0.4;
            const sizeMultiplier = s * (0.7 + seededRandom(baseSeed + 502) * 0.4);
            elements.push({
                type: 'bush',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + BUSH_SORT_OFFSET,
                sizeMultiplier,
                extraParams: { seed: baseSeed },
                drawFn: (x, y, sz, params) => drawBush2D5(x, y, sz, params.seed)
            });
        }

        if (grassType >= 20 && grassType < 50) {
            const shrubCount = 1 + Math.floor(seededRandom(baseSeed + 510) * 2);
            for (let i = 0; i < shrubCount; i++) {
                const offsetX = (seededRandom(baseSeed + i * 10 + 520) - 0.5) * s * 1.2;
                const offsetY = (seededRandom(baseSeed + i * 10 + 521) - 0.5) * s * 0.8;
                const sizeMultiplier = s * (0.25 + seededRandom(baseSeed + i * 10 + 522) * 0.2);
                elements.push({
                    type: 'shrub',
                    offsetX,
                    offsetY,
                    sortOffsetY: offsetY + SHRUB_SORT_OFFSET,
                    sizeMultiplier,
                    extraParams: { seed: baseSeed + i + 523 },
                    drawFn: (x, y, sz, params) => drawSmallShrub(x, y, sz, params.seed)
                });
            }
        }

        if (grassType >= 70 && grassType < 78) {
            const offsetX = (seededRandom(baseSeed + 600) - 0.5) * s * 0.4;
            const offsetY = (seededRandom(baseSeed + 601) - 0.5) * s * 0.3 + TREE_Y_OFFSET;
            const sizeMultiplier = s * (1.0 + seededRandom(baseSeed + 602) * 0.6);
            const treeType = Math.floor(seededRandom(baseSeed + 603) * 4);
            elements.push({
                type: 'tree-solitary',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + TREE_SORT_OFFSET,
                sizeMultiplier,
                extraParams: { treeType, seed: baseSeed + 604 },
                drawFn: (x, y, sz, params) => drawTree2D5(x, y, sz, params.treeType, params.seed)
            });
        }

        if (type === 'heather' && grassType >= 80 && grassType < 90) {
            const offsetX = (seededRandom(baseSeed + 700) - 0.5) * s * 0.5;
            const offsetY = (seededRandom(baseSeed + 701) - 0.5) * s * 0.4;
            elements.push({
                type: 'rock-small',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + SHRUB_SORT_OFFSET,
                sizeMultiplier: s * 1.0,
                extraParams: { seed: baseSeed + 702 },
                drawFn: (x, y, sz, params) => drawRockFormation2D5(x, y, sz, params.seed)
            });
        }
    } else if (type === 'hills') {
        const hillsType = Math.abs(baseSeed) % 100;

        if (hillsType < 40) {
            const offsetX = (seededRandom(baseSeed + 800) - 0.5) * s * 0.6;
            const offsetY = (seededRandom(baseSeed + 801) - 0.5) * s * 0.4;
            elements.push({
                type: 'rock-hills',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + TREE_SORT_OFFSET,
                sizeMultiplier: s * 1.5,
                extraParams: { seed: baseSeed + 802 },
                drawFn: (x, y, sz, params) => drawRockFormation2D5(x, y, sz, params.seed)
            });
        }

        if (hillsType >= 60 && hillsType < 80) {
            const offsetX = (seededRandom(baseSeed + 810) - 0.5) * s * 0.8;
            const offsetY = (seededRandom(baseSeed + 811) - 0.5) * s * 0.6;
            elements.push({
                type: 'shrub-hills',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + SHRUB_SORT_OFFSET,
                sizeMultiplier: s * 0.35,
                extraParams: { seed: baseSeed + 812 },
                drawFn: (x, y, sz, params) => drawSmallShrub(x, y, sz, params.seed)
            });
        }
    } else if (type === 'sand') {
        const sandType = Math.abs(baseSeed) % 100;
        if (sandType < 15) {
            const offsetX = (seededRandom(baseSeed + 900) - 0.5) * s * 0.8;
            const offsetY = (seededRandom(baseSeed + 901) - 0.5) * s * 0.6;
            elements.push({
                type: 'rock-sand',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + SHRUB_SORT_OFFSET,
                sizeMultiplier: s * 0.8,
                extraParams: { seed: baseSeed + 902 },
                drawFn: (x, y, sz, params) => drawRockFormation2D5(x, y, sz, params.seed)
            });
        }
    } else if (type === 'rock' || type === 'cliff') {
        elements.push({
            type: 'rock',
            offsetX: 0,
            offsetY: 0,
            sortOffsetY: TREE_SORT_OFFSET,
            sizeMultiplier: s * 2.2,
            extraParams: { seed: baseSeed },
            drawFn: (x, y, sz, params) => drawRockFormation2D5(x, y, sz, params.seed)
        });
    } else if (type === 'ruins') {
        const ruinsType = Math.abs(baseSeed) % 100;
        if (ruinsType < 60) {
            const offsetX = (seededRandom(baseSeed + 1000) - 0.5) * s * 0.5;
            const offsetY = (seededRandom(baseSeed + 1001) - 0.5) * s * 0.4;
            elements.push({
                type: 'rock',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + TREE_SORT_OFFSET,
                sizeMultiplier: s * 1.8,
                extraParams: { seed: baseSeed },
                drawFn: (x, y, sz, params) => drawRockFormation2D5(x, y, sz, params.seed)
            });
        }
        if (ruinsType >= 40 && ruinsType < 70) {
            const offsetX = (seededRandom(baseSeed + 1010) - 0.5) * s * 0.8;
            const offsetY = (seededRandom(baseSeed + 1011) - 0.5) * s * 0.6;
            elements.push({
                type: 'shrub-ruins',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + SHRUB_SORT_OFFSET,
                sizeMultiplier: s * 0.4,
                extraParams: { seed: baseSeed + 1012 },
                drawFn: (x, y, sz, params) => drawSmallShrub(x, y, sz, params.seed)
            });
        }
    } else if (type === 'swamp') {
        const swampType = Math.abs(baseSeed) % 100;
        if (swampType < 25) {
            const offsetX = (seededRandom(baseSeed + 1100) - 0.5) * s * 0.6;
            const offsetY = (seededRandom(baseSeed + 1101) - 0.5) * s * 0.4 + TREE_Y_OFFSET;
            const sizeMultiplier = s * (0.6 + seededRandom(baseSeed + 1102) * 0.4);
            elements.push({
                type: 'dead-tree',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + TREE_SORT_OFFSET,
                sizeMultiplier,
                extraParams: { treeType: 5, seed: baseSeed + 1103 },
                drawFn: (x, y, sz, params) => drawTree2D5(x, y, sz, params.treeType, params.seed)
            });
        }
        if (swampType >= 30 && swampType < 60) {
            const offsetX = (seededRandom(baseSeed + 1110) - 0.5) * s * 0.9;
            const offsetY = (seededRandom(baseSeed + 1111) - 0.5) * s * 0.7;
            elements.push({
                type: 'reeds',
                offsetX,
                offsetY,
                sortOffsetY: offsetY + SHRUB_SORT_OFFSET,
                sizeMultiplier: s * 0.3,
                extraParams: { seed: baseSeed + 1112 },
                drawFn: (x, y, sz, params) => drawSmallShrub(x, y, sz, params.seed)
            });
        }
    }

    return elements;
}

/**
 * Get the appropriate texture for a terrain type
 * Uses animated frame if available, otherwise falls back to static texture
 * @param {string} terrainType - The terrain type (e.g., 'water', 'grass')
 * @param {number} q - Hex q coordinate (for static variant selection)
 * @param {number} r - Hex r coordinate (for static variant selection)
 * @returns {Image|Canvas|null} The texture to use
 */
function getTerrainTexture(terrainType, q, r) {
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
 */
function shouldSkipCache(hexType) {
    // Skip caching for animated terrain that has loaded animation frames
    return hasAnimatedTexture(hexType);
}

/**
 * Get or create a cached hex tile with terrain details
 * Tiles are cached at a fixed base size and scaled when drawn to avoid
 * cache invalidation during zoom operations
 * @param {Object} hex - The hex object
 * @param {string} fogLevel - 'visible', 'explored', or 'hidden'
 * @returns {Object|null} { canvas, scale } or null if caching disabled
 */
function getCachedHexTile(hex, fogLevel) {
    // Only cache on medium/high quality - low quality is simple enough
    if (state.effectiveQuality === 'low') {
        return null;
    }

    // Skip caching for animated terrain types (they need to update each frame)
    if (fogLevel === 'visible' && shouldSkipCache(hex.type)) {
        return null;
    }

    // Invalidate cache if quality changed
    if (cachedQualityLevel !== state.effectiveQuality) {
        hexTileCache.clear();
        foregroundCache.clear();
        cachedQualityLevel = state.effectiveQuality;
    }

    // Use fixed base size for caching - zoom independent!
    const cacheKey = `${hex.q},${hex.r}_${fogLevel}_${state.effectiveQuality}`;

    if (hexTileCache.has(cacheKey)) {
        return hexTileCache.get(cacheKey);
    }

    // Enforce cache size limit using LRU-style eviction
    if (hexTileCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entries (first 20% of cache)
        const keysToRemove = Array.from(hexTileCache.keys()).slice(0, MAX_CACHE_SIZE / 5);
        keysToRemove.forEach(key => hexTileCache.delete(key));
    }

    // Create new cached tile at fixed base size
    const tileCanvas = createHexTileCanvas(hex, fogLevel, CACHE_BASE_HEX_SIZE);
    const cacheEntry = { canvas: tileCanvas, baseSize: CACHE_BASE_HEX_SIZE };
    hexTileCache.set(cacheKey, cacheEntry);

    return cacheEntry;
}

/**
 * Create a canvas with the pre-rendered hex tile
 * @param {Object} hex - The hex object
 * @param {string} fogLevel - 'visible', 'explored', or 'hidden'
 * @param {number} hexSize - Current hex size
 * @returns {HTMLCanvasElement} Canvas with rendered hex
 */
function createHexTileCanvas(hex, fogLevel, hexSize) {
    // Canvas size needs margin for effects
    const margin = hexSize * 0.2;
    const canvasSize = hexSize * 2 + margin * 2;

    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = canvasSize;
    tileCanvas.height = canvasSize;
    const tileCtx = tileCanvas.getContext('2d');

    const cx = canvasSize / 2;
    const cy = canvasSize / 2;

    const terrain = TERRAIN[hex.type];
    let fillColor = terrain.color;
    const texture = fogLevel === 'visible' ? getTerrainTexture(hex.type, hex.q, hex.r) : null;

    // Fog of war overlay
    if (fogLevel === 'hidden') {
        fillColor = '#000000';
    } else if (fogLevel === 'explored') {
        fillColor = desaturateAndDarken(terrain.color, 0.5, 0.75);
    }

    // Draw hex with texture - NO grid lines in cached tiles for seamless terrain
    const terrainData = fogLevel === 'visible' ? terrain : null;

    // Pass null for strokeColor - grid overlay is drawn separately when needed
    drawHexToContext(tileCtx, cx, cy, hexSize, fillColor, null, 1, texture, terrainData, hex.q, hex.r);

    // Add terrain blending for seamless transitions between terrain types
    if (fogLevel === 'visible' && terrainData) {
        const neighbors = getNeighborTerrains(state.hexMap, hex.q, hex.r);
        drawTerrainBlend(tileCtx, cx, cy, hexSize, hex.type, neighbors);
    }

    // Draw terrain details ONLY for visible hexes (not explored/hidden)
    if (fogLevel === 'visible' && shouldRenderDetails()) {
        drawTerrainDetailsToContext(tileCtx, cx, cy, hexSize, hex.type, hex.q, hex.r);
    }

    // Add fog overlays AFTER terrain (so they cover everything properly)
    if (fogLevel === 'explored') {
        drawExploredOverlay(tileCtx, cx, cy, hexSize);
    } else if (fogLevel === 'hidden') {
        drawHiddenOverlay(tileCtx, cx, cy, hexSize);
    }

    return tileCanvas;
}

/**
 * Draw explored hex shadow overlay to a context
 * Creates a clean, natural-looking dim effect for previously seen areas
 */
function drawExploredOverlay(context, cx, cy, hexSize) {
    context.save();

    // Single clean overlay with slight gradient for natural look
    context.beginPath();
    drawHexPathToContext(context, cx, cy, hexSize);

    // Subtle radial gradient - darker at edges, slightly lighter in center
    const dimGradient = context.createRadialGradient(cx, cy, 0, cx, cy, hexSize);
    dimGradient.addColorStop(0, 'rgba(8, 12, 20, 0.55)');
    dimGradient.addColorStop(0.6, 'rgba(5, 8, 15, 0.62)');
    dimGradient.addColorStop(1, 'rgba(2, 4, 10, 0.70)');
    context.fillStyle = dimGradient;
    context.fill();

    context.restore();
}

/**
 * Draw hidden hex fog overlay to a context
 * Creates a solid black fog for unseen areas
 */
function drawHiddenOverlay(context, cx, cy, hexSize) {
    context.save();
    context.beginPath();
    drawHexPathToContext(context, cx, cy, hexSize);

    // Solid dark fog - completely obscures the terrain
    context.fillStyle = '#050810';
    context.fill();

    context.restore();
}

/**
 * Draw hex path to a specific context
 */
function drawHexPathToContext(context, cx, cy, size) {
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
 * Draw hex with texture to a specific context (for caching)
 * Now includes 3D bevel effect for realistic raised border appearance
 */
function drawHexToContext(context, cx, cy, size, fillColor, strokeColor, lineWidth, texture, terrain, hexQ, hexR) {
    context.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
    }
    context.closePath();

    // Priority: 1) Texture sprite, 2) Gradient, 3) Solid color
    if (texture) {
        // Draw sprite texture - scale to fit hex with slight overlap to prevent seams
        context.save();
        context.clip();
        // Hex dimensions: width = 2*size, height = sqrt(3)*size
        // Buffer to prevent anti-aliasing seams between tiles (1-2px overlap)
        const buffer = Math.max(6, size * 0.06);
        const spriteWidth = size * 2 + buffer;
        const spriteHeight = size * Math.sqrt(3) + buffer;
        context.drawImage(texture, cx - spriteWidth / 2, cy - spriteHeight / 2, spriteWidth, spriteHeight);
        context.restore();

        // Restore hex path for border drawing
        context.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = cx + size * Math.cos(angle);
            const py = cy + size * Math.sin(angle);
            if (i === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
        }
        context.closePath();
    } else if (terrain && terrain.colorLight && terrain.colorDark) {
        // Fallback: gradient fill
        const gradient = context.createLinearGradient(cx - size * 0.7, cy - size * 0.7, cx + size * 0.7, cy + size * 0.7);
        gradient.addColorStop(0, terrain.colorLight);
        gradient.addColorStop(0.5, terrain.color);
        gradient.addColorStop(1, terrain.colorDark);
        context.fillStyle = gradient;
        context.fill();
    } else {
        // Final fallback: solid color
        context.fillStyle = fillColor;
        context.fill();
    }

    if (strokeColor) {
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

/**
 * Draw STATIC terrain details to a specific context (for caching)
 * This is a wrapper that temporarily swaps the global ctx
 * Only draws non-animated elements that can be safely cached
 */
function drawTerrainDetailsToContext(context, cx, cy, size, type, hexQ, hexR) {
    const originalCtx = ctx;
    ctx = context;
    drawStaticTerrainDetails(cx, cy, size, type, hexQ, hexR);
    ctx = originalCtx;
}

/**
 * Draw a subtle terrain-matched camouflage pattern for enemy cloaked units
 * This makes them barely visible, blending into the terrain without shimmering
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {number} size - Unit size
 * @param {Object} unit - The cloaked unit
 */
function drawCamouflagePattern(cx, cy, size, unit) {
    // Get terrain at unit's position
    const hex = getHex(unit.q, unit.r);
    if (!hex) return;

    const terrainData = TERRAIN[hex.type];
    const baseColor = terrainData?.color || '#2d5a40';

    // Parse base color
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Deterministic pseudo-random for camo shapes (stable per unit position)
    const seed = (unit.q * 73856093) ^ (unit.r * 19349663);
    const rand = (offset) => {
        const x = Math.sin(seed + offset) * 43758.5453;
        return x - Math.floor(x);
    };

    ctx.save();

    // Base camouflage silhouette
    ctx.globalAlpha = 0.22;

    // Soft camo fill with terrain-tinted gradient
    const baseGrad = ctx.createRadialGradient(
        cx, cy - size * 0.2, 0,
        cx, cy, size * 0.9
    );
    baseGrad.addColorStop(0, `rgba(${r + 20}, ${g + 20}, ${b + 20}, 0.3)`);
    baseGrad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.18)`);
    baseGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = baseGrad;

    // Draw subtle humanoid shape
    ctx.beginPath();
    // Head
    ctx.arc(cx, cy - size * 0.5, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Body (oval)
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.25, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Add low-contrast camo blotches
    for (let i = 0; i < 6; i++) {
        const angle = rand(i * 11) * Math.PI * 2;
        const radius = size * (0.1 + rand(i * 7) * 0.35);
        const blotchX = cx + Math.cos(angle) * radius;
        const blotchY = cy + Math.sin(angle) * radius * 0.6;
        const blotchSize = size * (0.12 + rand(i * 17) * 0.18);
        const shade = rand(i * 19) > 0.5 ? 18 : -12;
        ctx.fillStyle = `rgba(${r + shade}, ${g + shade}, ${b + shade}, 0.22)`;
        ctx.beginPath();
        ctx.ellipse(blotchX, blotchY, blotchSize * 0.9, blotchSize * 0.6, angle, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Calculate stealth unit visibility alpha based on distance to nearest friendly unit.
 * Stealth units become more visible the closer they are to friendly non-cloaked units.
 * @param {Object} stealthUnit - The cloaked unit to calculate visibility for
 * @returns {number} Alpha value between 0 (invisible) and 0.85 (nearly visible)
 */
function getStealthVisibilityAlpha(stealthUnit) {
    const friendlyUnits = getPlayerUnits(stealthUnit.player);

    // Find the nearest non-cloaked friendly unit
    let minDistance = Infinity;
    for (const unit of friendlyUnits) {
        // Skip the stealth unit itself and other cloaked units
        if (unit.id === stealthUnit.id || unit.cloaked) continue;

        const distance = hexDistance(
            { q: stealthUnit.q, r: stealthUnit.r },
            { q: unit.q, r: unit.r }
        );
        minDistance = Math.min(minDistance, distance);
    }

    // If no friendly units nearby, use moderate visibility
    if (minDistance === Infinity) {
        return 0.4;
    }

    // Distance-based transparency:
    // 0-1 hexes: High visibility (alpha 0.7-0.85)
    // 2-3 hexes: Medium visibility (alpha 0.4-0.6)
    // 4-5 hexes: Low visibility (alpha 0.2-0.35)
    // 6+ hexes: Very low visibility (alpha 0.1-0.15)
    if (minDistance <= 1) {
        return 0.85 - minDistance * 0.15;
    } else if (minDistance <= 3) {
        return 0.6 - (minDistance - 1) * 0.1;
    } else if (minDistance <= 5) {
        return 0.35 - (minDistance - 3) * 0.075;
    } else {
        // Beyond 5 hexes, very low visibility with minimum floor
        return Math.max(0.1, 0.2 - (minDistance - 5) * 0.02);
    }
}

/**
 * Initialize renderer
 */
let animationLoopRunning = false;
let animationFrameId = null;
let lastFrameTime = 0;

/**
 * Detect if the device is a mobile/tablet (iPad, iPhone, Android tablet, etc.)
 * Sets initial quality to 'medium' or 'low' for better performance on these devices
 */
function detectMobileDevice() {
    const ua = navigator.userAgent || navigator.vendor || '';

    // Check for iPad specifically (iPad on iOS 13+ reports as Mac)
    const isIPad = /iPad/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Check for iPhone/iPod
    const isIPhone = /iPhone|iPod/.test(ua);

    // Check for Android tablets/phones
    const isAndroid = /Android/.test(ua);

    // Check for general touch device with small screen
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 1024;

    // High DPI can cause performance issues on tablets
    const isHighDPI = window.devicePixelRatio >= 2;

    return {
        isMobile: isIPhone || (isAndroid && /Mobile/.test(ua)),
        isTablet: isIPad || (isAndroid && !/Mobile/.test(ua)),
        isIPad,
        isTouchDevice,
        isHighDPI,
        shouldReduceQuality: isIPad || isIPhone || isAndroid || (isTouchDevice && isSmallScreen && isHighDPI)
    };
}

export function initRenderer() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // Detect mobile/tablet and set initial quality
    const deviceInfo = detectMobileDevice();

    if (deviceInfo.shouldReduceQuality) {
        // Start with medium quality for tablets/mobile for smoother gameplay
        if (state.settings.renderQuality === 'auto') {
            if (deviceInfo.isIPad || deviceInfo.isTablet) {
                // iPads and tablets: start at medium, may drop to low
                state.effectiveQuality = 'medium';
                console.log('iPad/Tablet detected - starting with medium quality');
            } else if (deviceInfo.isMobile) {
                // Phones: start at low quality
                state.effectiveQuality = 'low';
                console.log('Mobile device detected - starting with low quality');
            }
        }

        // Reduce particle quality on mobile devices
        if (state.settings.particleQuality === 'high') {
            state.settings.particleQuality = 'medium';
        }
    }

    // Initialize sub-renderers with canvas context
    initVegetationRenderer(ctx);
    initTerrainRenderer(ctx);

    // Mark textures as initialized (now handled by assetLoader)
    texturesInitialized = true;

    resizeCanvas();

    // Start animation loop only when needed
    if (!animationLoopRunning) {
        animationLoopRunning = true;
    }
    ensureAnimationLoop();
}

function getTargetFps() {
    switch (state.effectiveQuality) {
        case 'low':
            return 20;
        case 'medium':
            return 30;
        case 'high':
        default:
            return 45;
    }
}

function shouldAnimate() {
    // Don't animate if a menu screen is showing or no map exists
    if (state.screen !== null || state.hexes.length === 0) return false;

    // ALWAYS animate when game is active (hexes exist and no menu showing)
    // This ensures the render loop keeps running even when there are no
    // active animations or particles. Without this, the game shows a black
    // screen because the render loop stops immediately after the first frame.
    return true;
}

function ensureAnimationLoop() {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(animationLoop);
}

function animationLoop(timestamp) {
    animationFrameId = null;
    if (!shouldAnimate()) return;

    const frameInterval = 1000 / getTargetFps();
    if (!lastFrameTime || timestamp - lastFrameTime >= frameInterval) {
        lastFrameTime = timestamp;
        try {
            render();
        } catch (error) {
            // CRITICAL: Never let render errors crash the animation loop
            // Log error to our error log system so it can be viewed on mobile
            logError('[Render] Fehler in render()', error);

            // Attempt to draw a simple error indicator instead of crashing
            if (canvas && ctx) {
                ctx.fillStyle = '#1a1a3e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#ff6b6b';
                ctx.font = '16px monospace';
                ctx.fillText('Renderfehler - Optionen > Debug-Log', 20, 30);
                ctx.fillStyle = '#aaa';
                ctx.font = '12px monospace';
                ctx.fillText(error.message || String(error), 20, 50);
            }
        }
    }

    ensureAnimationLoop();
}

/**
 * Calculate appropriate hex size for screen
 */
function calculateHexSize() {
    const container = canvas.parentElement;
    if (!container) return CONFIG.BASE_HEX_SIZE;

    const rect = container.getBoundingClientRect();
    const radius = CONFIG.MAP_SIZES[state.settings.size] || 8;

    // Calculate grid dimensions
    const gridWidth = (2 * radius + 1) * 1.8;
    const gridHeight = (2 * radius + 1) * 1.6;

    const padding = 40;
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;

    // Calculate hex size to fit
    const hexSize = Math.min(availableWidth / gridWidth, availableHeight / gridHeight);

    // Clamp to reasonable range - doubled for better visibility at 100% zoom
    const baseSize = Math.max(60, Math.min(130, hexSize));

    // Apply zoom level
    return baseSize * state.zoomLevel;
}

/**
 * Resize canvas to container
 */
export function resizeCanvas() {
    const container = canvas?.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        setTimeout(resizeCanvas, 50);
        return;
    }

    // Store canvas dimensions
    state.canvasWidth = rect.width;
    state.canvasHeight = rect.height;

    // Set canvas resolution
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Update hex size and center offset
    state.hexSize = calculateHexSize();
    state.offsetX = rect.width / 2 + state.cameraX;
    state.offsetY = rect.height / 2 + state.cameraY;

    render();
}

/**
 * Draw a hexagon with optional texture and 3D effect
 */
/**
 * Draw just the hex path (for stroking)
 */
function drawHexPath(cx, cy, size) {
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function drawHex(cx, cy, size, fillColor, strokeColor = null, lineWidth = 1, texture = null, terrain = null) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Priority: 1) Texture sprite, 2) Gradient, 3) Solid color
    if (texture) {
        ctx.save();
        ctx.clip();
        // Hex dimensions: width = 2*size, height = sqrt(3)*size
        // Buffer to prevent anti-aliasing seams between tiles (1-2px overlap)
        const buffer = Math.max(6, size * 0.06);
        const spriteWidth = size * 2 + buffer;
        const spriteHeight = size * Math.sqrt(3) + buffer;
        ctx.drawImage(texture, cx - spriteWidth / 2, cy - spriteHeight / 2, spriteWidth, spriteHeight);
        ctx.restore();

        // Draw hex shape again for stroke
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = cx + size * Math.cos(angle);
            const py = cy + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    } else if (terrain && terrain.colorLight && terrain.colorDark) {
        // Fallback: gradient fill
        const gradient = ctx.createLinearGradient(cx - size * 0.7, cy - size * 0.7, cx + size * 0.7, cy + size * 0.7);
        gradient.addColorStop(0, terrain.colorLight);
        gradient.addColorStop(0.5, terrain.color);
        gradient.addColorStop(1, terrain.colorDark);
        ctx.fillStyle = gradient;
        ctx.fill();
    } else {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }

    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = cx + size * Math.cos(angle);
            const py = cy + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
    }
}

/**
 * Collect foreground elements (trees, large rocks) for 2.5D depth sorting
 * Returns array of objects with draw function and y-position
 *
 * IMPORTANT: sortY must be based on consistent offsets from the element's base position,
 * NOT on the element's size. This ensures proper depth sorting at all zoom levels.
 */
function collectForegroundElements(cx, cy, size, type, hexQ, hexR) {
    const elements = [];
    const s = size * 0.45;
    const baseSeed = hexQ * 127 + hexR * 311 + hexQ * hexR * 7;

    // Consistent sort offsets based on hex size (not element size!)
    const TREE_SORT_OFFSET = size * 0.4;      // Trees sort at their base
    const BG_TREE_SORT_OFFSET = size * 0.25;  // Background trees sort behind
    const SHRUB_SORT_OFFSET = size * 0.35;    // Shrubs between trees and ground
    const BUSH_SORT_OFFSET = size * 0.38;     // Bushes similar to shrubs

    // Tree Y offset - position trees lower in tile (1/3 tile deeper)
    const TREE_Y_OFFSET = size * 0.25;

    if (type === 'forest' || type === 'pine') {
        // Mixed forest with trees distributed across entire hex including edges
        // Main trees: 4-6 per hex for dense forest feel
        const baseTreeCount = 4 + Math.abs(baseSeed % 3);
        const hexRadius = s * 1.1; // Extend beyond hex center for edge trees

        for (let i = 0; i < baseTreeCount; i++) {
            // Distribute trees more widely, including edges and bottom
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            const angle = i * goldenAngle + seededRandom(baseSeed + i) * 0.8;
            // Allow trees to reach edges (0.5 to 1.0 of radius)
            const radius = hexRadius * (0.2 + seededRandom(baseSeed + i * 7) * 0.8);

            const tx = cx + Math.cos(angle) * radius * 0.85;
            // Full Y range for isometric effect - trees positioned lower in tile
            const ty = cy + Math.sin(angle) * radius * 0.7 + TREE_Y_OFFSET;

            // Large size variation for mixed forest (0.5x to 1.8x)
            const baseSizeVar = 0.5 + seededRandom(baseSeed + i * 10 + 2) * 1.3;
            const treeSize = s * baseSizeVar * 1.4;

            // Mixed forest: use all tree types with weighted distribution
            const treeType = type === 'pine'
                ? 0
                : Math.floor(seededRandom(baseSeed + i * 10 + 3) * 6);

            elements.push({
                type: 'tree',
                x: tx,
                y: ty,
                sortY: ty + TREE_SORT_OFFSET,
                draw: () => drawTree2D5(tx, ty, treeSize, treeType, baseSeed + i)
            });
        }

        // Add edge/corner trees that extend beyond hex boundaries
        const edgeTreeCount = 2 + Math.abs((baseSeed + 50) % 3);
        for (let i = 0; i < edgeTreeCount; i++) {
            // Place trees at hex edges (left, right, bottom corners)
            const edgeAngle = (i / edgeTreeCount) * Math.PI * 2 + seededRandom(baseSeed + i * 20 + 200) * 0.6;
            const edgeRadius = hexRadius * (0.85 + seededRandom(baseSeed + i * 20 + 201) * 0.3);

            const tx = cx + Math.cos(edgeAngle) * edgeRadius * 0.9;
            const ty = cy + Math.sin(edgeAngle) * edgeRadius * 0.7 + TREE_Y_OFFSET;

            // Edge trees have varied sizes - some tall, some short
            const treeSize = s * (0.6 + seededRandom(baseSeed + i * 20 + 202) * 1.0);
            const treeType = type === 'pine' ? 0 : Math.floor(seededRandom(baseSeed + i * 20 + 203) * 6);

            elements.push({
                type: 'tree-edge',
                x: tx,
                y: ty,
                sortY: ty + BG_TREE_SORT_OFFSET,
                draw: () => drawTree2D5(tx, ty, treeSize, treeType, baseSeed + i + 100)
            });
        }

        // Dense undergrowth: multiple shrubs and small bushes
        const undergrowthCount = 3 + Math.abs((baseSeed + 100) % 3);
        for (let i = 0; i < undergrowthCount; i++) {
            const shrubX = cx + (seededRandom(baseSeed + i * 15 + 101) - 0.5) * s * 1.4;
            const shrubY = cy + (seededRandom(baseSeed + i * 15 + 102) - 0.5) * s * 0.9;
            const shrubSize = s * (0.35 + seededRandom(baseSeed + i * 15 + 103) * 0.25);

            elements.push({
                type: 'shrub',
                x: shrubX,
                y: shrubY,
                sortY: shrubY + SHRUB_SORT_OFFSET,
                draw: () => drawSmallShrub(shrubX, shrubY, shrubSize, baseSeed + i + 104)
            });
        }

        // Occasional large bush for variety
        if (seededRandom(baseSeed + 300) > 0.6) {
            const bushX = cx + (seededRandom(baseSeed + 301) - 0.5) * s * 0.8;
            const bushY = cy + (seededRandom(baseSeed + 302) - 0.5) * s * 0.6;
            const bushSize = s * (0.6 + seededRandom(baseSeed + 303) * 0.3);

            elements.push({
                type: 'bush',
                x: bushX,
                y: bushY,
                sortY: bushY + BUSH_SORT_OFFSET,
                draw: () => drawBush2D5(bushX, bushY, bushSize, baseSeed + 304)
            });
        }
    } else if (type === 'grass' || type === 'clearing' || type === 'flowers' || type === 'heather') {
        // Add variety to open terrain with bushes, rocks, and occasional trees
        const grassType = Math.abs(baseSeed) % 100;

        // Large bushes on grass (20% of tiles)
        if (grassType < 20) {
            const bushX = cx + (seededRandom(baseSeed + 500) - 0.5) * s * 0.6;
            const bushY = cy + (seededRandom(baseSeed + 501) - 0.5) * s * 0.4;
            const bushSize = s * (0.7 + seededRandom(baseSeed + 502) * 0.4);
            elements.push({
                type: 'bush',
                x: bushX,
                y: bushY,
                sortY: bushY + BUSH_SORT_OFFSET,
                draw: () => drawBush2D5(bushX, bushY, bushSize, baseSeed)
            });
        }

        // Small shrubs scattered across grass (30% of tiles)
        if (grassType >= 20 && grassType < 50) {
            const shrubCount = 1 + Math.floor(seededRandom(baseSeed + 510) * 2);
            for (let i = 0; i < shrubCount; i++) {
                const shrubX = cx + (seededRandom(baseSeed + i * 10 + 520) - 0.5) * s * 1.2;
                const shrubY = cy + (seededRandom(baseSeed + i * 10 + 521) - 0.5) * s * 0.8;
                const shrubSize = s * (0.25 + seededRandom(baseSeed + i * 10 + 522) * 0.2);
                elements.push({
                    type: 'shrub',
                    x: shrubX,
                    y: shrubY,
                    sortY: shrubY + SHRUB_SORT_OFFSET,
                    draw: () => drawSmallShrub(shrubX, shrubY, shrubSize, baseSeed + i + 523)
                });
            }
        }

        // Occasional solitary trees on open terrain (8% of tiles)
        if (grassType >= 70 && grassType < 78) {
            const treeX = cx + (seededRandom(baseSeed + 600) - 0.5) * s * 0.4;
            const treeY = cy + (seededRandom(baseSeed + 601) - 0.5) * s * 0.3 + TREE_Y_OFFSET;
            const treeSize = s * (1.0 + seededRandom(baseSeed + 602) * 0.6);
            const treeType = Math.floor(seededRandom(baseSeed + 603) * 4); // Oak, birch, etc.
            elements.push({
                type: 'tree-solitary',
                x: treeX,
                y: treeY,
                sortY: treeY + TREE_SORT_OFFSET,
                draw: () => drawTree2D5(treeX, treeY, treeSize, treeType, baseSeed + 604)
            });
        }

        // Rocky outcrops on heather/hills-adjacent grass (10% of heather)
        if (type === 'heather' && grassType >= 80 && grassType < 90) {
            const rockX = cx + (seededRandom(baseSeed + 700) - 0.5) * s * 0.5;
            const rockY = cy + (seededRandom(baseSeed + 701) - 0.5) * s * 0.4;
            elements.push({
                type: 'rock-small',
                x: rockX,
                y: rockY,
                sortY: rockY + SHRUB_SORT_OFFSET,
                draw: () => drawRockFormation2D5(rockX, rockY, s * 1.0, baseSeed + 702)
            });
        }
    } else if (type === 'hills') {
        // Hills get some scattered rocks and occasional shrubs
        const hillsType = Math.abs(baseSeed) % 100;

        if (hillsType < 40) {
            const rockX = cx + (seededRandom(baseSeed + 800) - 0.5) * s * 0.6;
            const rockY = cy + (seededRandom(baseSeed + 801) - 0.5) * s * 0.4;
            elements.push({
                type: 'rock-hills',
                x: rockX,
                y: rockY,
                sortY: rockY + TREE_SORT_OFFSET,
                draw: () => drawRockFormation2D5(rockX, rockY, s * 1.5, baseSeed + 802)
            });
        }

        if (hillsType >= 60 && hillsType < 80) {
            const shrubX = cx + (seededRandom(baseSeed + 810) - 0.5) * s * 0.8;
            const shrubY = cy + (seededRandom(baseSeed + 811) - 0.5) * s * 0.6;
            elements.push({
                type: 'shrub-hills',
                x: shrubX,
                y: shrubY,
                sortY: shrubY + SHRUB_SORT_OFFSET,
                draw: () => drawSmallShrub(shrubX, shrubY, s * 0.35, baseSeed + 812)
            });
        }
    } else if (type === 'sand') {
        // Sand gets occasional driftwood or coastal rocks
        const sandType = Math.abs(baseSeed) % 100;
        if (sandType < 15) {
            const rockX = cx + (seededRandom(baseSeed + 900) - 0.5) * s * 0.8;
            const rockY = cy + (seededRandom(baseSeed + 901) - 0.5) * s * 0.6;
            elements.push({
                type: 'rock-sand',
                x: rockX,
                y: rockY,
                sortY: rockY + SHRUB_SORT_OFFSET,
                draw: () => drawRockFormation2D5(rockX, rockY, s * 0.8, baseSeed + 902)
            });
        }
    } else if (type === 'rock' || type === 'cliff') {
        // Rock formations are foreground elements - make them much bigger for proper cover
        elements.push({
            type: 'rock',
            x: cx,
            y: cy,
            sortY: cy + TREE_SORT_OFFSET,  // Rocks sort like trees (tall elements)
            draw: () => drawRockFormation2D5(cx, cy, s * 2.2, baseSeed)
        });
    } else if (type === 'ruins') {
        // Ruins have rock formations and broken walls
        const ruinsType = Math.abs(baseSeed) % 100;
        if (ruinsType < 60) {
            const rockX = cx + (seededRandom(baseSeed + 1000) - 0.5) * s * 0.5;
            const rockY = cy + (seededRandom(baseSeed + 1001) - 0.5) * s * 0.4;
            elements.push({
                type: 'rock',
                x: rockX,
                y: rockY,
                sortY: rockY + TREE_SORT_OFFSET,
                draw: () => drawRockFormation2D5(rockX, rockY, s * 1.8, baseSeed)
            });
        }
        // Add some shrubs growing through ruins
        if (ruinsType >= 40 && ruinsType < 70) {
            const shrubX = cx + (seededRandom(baseSeed + 1010) - 0.5) * s * 0.8;
            const shrubY = cy + (seededRandom(baseSeed + 1011) - 0.5) * s * 0.6;
            elements.push({
                type: 'shrub-ruins',
                x: shrubX,
                y: shrubY,
                sortY: shrubY + SHRUB_SORT_OFFSET,
                draw: () => drawSmallShrub(shrubX, shrubY, s * 0.4, baseSeed + 1012)
            });
        }
    } else if (type === 'swamp') {
        // Swamp gets dead trees and reeds
        const swampType = Math.abs(baseSeed) % 100;
        if (swampType < 25) {
            // Dead tree stump
            const stumpX = cx + (seededRandom(baseSeed + 1100) - 0.5) * s * 0.6;
            const stumpY = cy + (seededRandom(baseSeed + 1101) - 0.5) * s * 0.4 + TREE_Y_OFFSET;
            const stumpSize = s * (0.6 + seededRandom(baseSeed + 1102) * 0.4);
            elements.push({
                type: 'dead-tree',
                x: stumpX,
                y: stumpY,
                sortY: stumpY + TREE_SORT_OFFSET,
                draw: () => drawTree2D5(stumpX, stumpY, stumpSize, 5, baseSeed + 1103) // Type 5 for dead/sparse tree
            });
        }
        // Reed clusters
        if (swampType >= 30 && swampType < 60) {
            const reedX = cx + (seededRandom(baseSeed + 1110) - 0.5) * s * 0.9;
            const reedY = cy + (seededRandom(baseSeed + 1111) - 0.5) * s * 0.7;
            elements.push({
                type: 'reeds',
                x: reedX,
                y: reedY,
                sortY: reedY + SHRUB_SORT_OFFSET,
                draw: () => drawSmallShrub(reedX, reedY, s * 0.3, baseSeed + 1112)
            });
        }
    }

    return elements;
}

/**
 * Draw STATIC terrain pattern on a hex (for caching)
 * ALL terrain details are cached - no runtime animations for max performance
 * Each hex has unique appearance via seeded random (no visible tiling pattern)
 */
function drawStaticTerrainDetails(cx, cy, size, type, hexQ = 0, hexR = 0) {
    const s = size * 0.45;
    ctx.save();

    // Create consistent seed for this hex - ensures unique but deterministic appearance
    const baseSeed = hexQ * 127 + hexR * 311 + hexQ * hexR * 7;

    switch (type) {
        case 'grass':
            drawStaticGrassBlades(cx, cy, size, baseSeed, 'grass');
            // Add occasional flowers
            if ((baseSeed % 100) >= 15 && (baseSeed % 100) < 30) {
                drawFlowerCluster(cx, cy, s, baseSeed);
            }
            // Add occasional small rocks (~15% of tiles)
            if ((baseSeed % 100) >= 70 && (baseSeed % 100) < 85) {
                const rockX = cx + (seededRandom(baseSeed * 5) - 0.5) * size * 0.6;
                const rockY = cy + (seededRandom(baseSeed * 6) - 0.5) * size * 0.4;
                drawRockFormation2D5(rockX, rockY, s, baseSeed);
            }
            // Add occasional bushes (~10% of tiles)
            if ((baseSeed % 100) >= 50 && (baseSeed % 100) < 60) {
                const bushX = cx + (seededRandom(baseSeed * 7) - 0.5) * size * 0.5;
                const bushY = cy + (seededRandom(baseSeed * 8) - 0.5) * size * 0.3;
                drawBush2D5(bushX, bushY, s * 0.7, baseSeed + 100);
            }
            break;

        case 'forest':
            drawForestFloor(cx, cy, s, baseSeed);
            // Static leaf scatter
            drawStaticLeafScatter(cx, cy, size, baseSeed);
            break;

        case 'rock':
            // Multiple rock formations for impassable rock terrain
            const rockCount = 3 + Math.floor(seededRandom(baseSeed * 12) * 3);
            for (let r = 0; r < rockCount; r++) {
                const rx = cx + (seededRandom(baseSeed * 13 + r) - 0.5) * size * 0.8;
                const ry = cy + (seededRandom(baseSeed * 14 + r) - 0.5) * size * 0.6;
                drawRockFormation2D5(rx, ry, s * 1.5, baseSeed + r * 50);
            }
            // Base shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy + s * 0.3, s * 0.8, s * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'water':
            drawWaterDetails(cx, cy, s, baseSeed);
            drawStaticWaterSurface(cx, cy, size, baseSeed);
            break;

        case 'deepwater':
            drawStaticWaterSurface(cx, cy, size, baseSeed, true);
            break;

        case 'shallows':
            drawStaticShallowWater(cx, cy, size, baseSeed);
            break;

        case 'sand':
            drawSandDetails(cx, cy, s, baseSeed);
            drawStaticDustMotes(cx, cy, size, baseSeed);
            break;

        case 'swamp':
            drawSwampDetails(cx, cy, s, baseSeed);
            break;

        case 'hills':
            drawHillsDetails(cx, cy, s, baseSeed);
            // Add multiple rocks to hills (tactical cover!)
            const hillRockCount = 2 + Math.floor(seededRandom(baseSeed * 9) * 3);
            for (let r = 0; r < hillRockCount; r++) {
                const rockX = cx + (seededRandom(baseSeed * 10 + r) - 0.5) * size * 0.7;
                const rockY = cy + (seededRandom(baseSeed * 11 + r) - 0.5) * size * 0.5;
                drawRockFormation2D5(rockX, rockY, s * 1.2, baseSeed + r * 100);
            }
            break;

        case 'road':
            drawRoadDetails(cx, cy, s, baseSeed);
            break;

        case 'path':
            drawPathDetails(cx, cy, s, baseSeed);
            break;

        case 'river':
            drawRiverDetails(cx, cy, s, baseSeed);
            drawStaticWaterSurface(cx, cy, size, baseSeed);
            break;

        case 'snow':
            drawStaticSnowDetails(cx, cy, size, baseSeed);
            break;

        case 'ice':
            drawStaticIceDetails(cx, cy, size, baseSeed);
            break;

        case 'reeds':
            drawStaticReeds(cx, cy, size, baseSeed);
            break;

        case 'flowers':
            drawStaticGrassBlades(cx, cy, size, baseSeed, 'grass');
            drawStaticFlowers(cx, cy, size, baseSeed);
            break;

        case 'wheat':
            drawStaticWheatField(cx, cy, size, baseSeed);
            break;

        case 'tallgrass':
            drawStaticGrassBlades(cx, cy, size, baseSeed, 'tallgrass');
            break;

        case 'clearing':
            drawStaticGrassBlades(cx, cy, size, baseSeed, 'clearing');
            break;

        case 'heather':
            drawStaticGrassBlades(cx, cy, size, baseSeed, 'heather');
            drawStaticHeather(cx, cy, size, baseSeed);
            break;

        case 'moss':
            drawStaticGrassBlades(cx, cy, size, baseSeed, 'moss');
            break;

        case 'gravel':
            drawGravel(ctx, cx, cy, size, hexQ, hexR);
            break;

        case 'ruins':
            drawRuins(ctx, cx, cy, size, hexQ, hexR);
            break;

        case 'pine':
            drawForestFloor(cx, cy, s, baseSeed);
            drawStaticLeafScatter(cx, cy, size, baseSeed);
            break;

        case 'farmland':
            drawFarmland(ctx, cx, cy, size, hexQ, hexR);
            break;

        case 'mud':
            drawMud(ctx, cx, cy, size, hexQ, hexR);
            break;
    }

    ctx.restore();
}

/**
 * Draw grass blades and ground texture for natural looking terrain
 */
function drawStaticGrassBlades(cx, cy, hexSize, seed, grassType) {
    ctx.save();

    // Determine blade count and height based on grass type
    const isTall = grassType === 'tallgrass';
    const isHeather = grassType === 'heather';
    const bladeCount = isTall ? 25 : (isHeather ? 20 : 18);
    const heightMult = isTall ? 1.4 : (isHeather ? 0.8 : 1.0);

    // Draw grass blades
    for (let i = 0; i < bladeCount; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);
        const rand3 = seededRandom(seed + i * 3 + 2);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * hexSize * 0.7;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        const bladeHeight = (4 + rand3 * 8) * heightMult;
        const lean = (rand1 - 0.5) * 4;

        // Color variation
        const greenShade = isHeather ?
            `rgb(${70 + rand3 * 30}, ${90 + rand3 * 20}, ${70 + rand3 * 30})` :
            `rgb(${40 + rand3 * 30}, ${100 + rand3 * 40}, ${40 + rand3 * 20})`;

        ctx.strokeStyle = greenShade;
        ctx.lineWidth = 1 + rand2 * 0.5;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + lean * 0.5, y - bladeHeight * 0.6, x + lean, y - bladeHeight);
        ctx.stroke();
    }

    // Add subtle ground texture patches
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 5; i++) {
        const rand1 = seededRandom(seed + i * 7 + 100);
        const rand2 = seededRandom(seed + i * 7 + 101);

        const px = cx + (rand1 - 0.5) * hexSize * 1.2;
        const py = cy + (rand2 - 0.5) * hexSize * 1.2;
        const patchSize = hexSize * 0.1 + rand2 * hexSize * 0.15;

        ctx.fillStyle = isHeather ? 'rgba(100, 60, 100, 0.4)' : 'rgba(30, 70, 30, 0.4)';
        ctx.beginPath();
        ctx.ellipse(px, py, patchSize, patchSize * 0.5, rand1 * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Draw minimal water surface details - subtle, natural looking
 */
function drawStaticWaterSurface(cx, cy, hexSize, seed, isDeep = false) {
    // Just a subtle gradient overlay for depth - no individual wave lines
    ctx.save();

    // Very subtle depth variation
    const gradient = ctx.createRadialGradient(
        cx + hexSize * 0.2, cy - hexSize * 0.2, 0,
        cx, cy, hexSize * 0.8
    );

    if (isDeep) {
        gradient.addColorStop(0, 'rgba(40, 80, 120, 0.1)');
        gradient.addColorStop(1, 'rgba(10, 30, 60, 0.15)');
    } else {
        gradient.addColorStop(0, 'rgba(100, 160, 200, 0.08)');
        gradient.addColorStop(1, 'rgba(60, 120, 160, 0.12)');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + hexSize * Math.cos(angle);
        const py = cy + hexSize * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

/**
 * Draw static shallow water
 */
function drawStaticShallowWater(cx, cy, hexSize, seed) {
    // Bottom stones
    for (let i = 0; i < 8; i++) {
        const stoneX = cx + (seededRandom(seed + i * 2) - 0.5) * hexSize * 1.2;
        const stoneY = cy + (seededRandom(seed + i * 2 + 1) - 0.5) * hexSize * 1.2;
        const stoneSize = 2 + seededRandom(seed + i * 3) * 4;

        ctx.fillStyle = 'rgba(100, 90, 70, 0.4)';
        ctx.beginPath();
        ctx.ellipse(stoneX, stoneY, stoneSize, stoneSize * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawStaticWaterSurface(cx, cy, hexSize, seed);
}

/**
 * Draw subtle forest floor texture - no individual leaves, just soft patches
 */
function drawStaticLeafScatter(cx, cy, hexSize, seed) {
    // Just draw 2-3 subtle dark patches on the forest floor
    for (let i = 0; i < 3; i++) {
        const x = cx + (seededRandom(seed + i * 5) - 0.5) * hexSize * 0.8;
        const y = cy + (seededRandom(seed + i * 5 + 1) - 0.5) * hexSize * 0.8;
        const size = 6 + seededRandom(seed + i * 5 + 2) * 8;

        ctx.fillStyle = 'rgba(30, 50, 30, 0.12)';
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw subtle sand texture variation - no floating particles
 */
function drawStaticDustMotes(cx, cy, hexSize, seed) {
    // Just subtle light patches to add texture variation
    for (let i = 0; i < 2; i++) {
        const x = cx + (seededRandom(seed + i * 6) - 0.5) * hexSize * 0.6;
        const y = cy + (seededRandom(seed + i * 6 + 1) - 0.5) * hexSize * 0.6;
        const size = 8 + seededRandom(seed + i * 6 + 2) * 6;

        ctx.fillStyle = 'rgba(220, 200, 160, 0.08)';
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw static snow details
 */
function drawStaticSnowDetails(cx, cy, hexSize, seed) {
    // Snow mounds
    for (let i = 0; i < 5; i++) {
        const mx = cx + (seededRandom(seed + i * 5) - 0.5) * hexSize * 1.2;
        const my = cy + (seededRandom(seed + i * 5 + 1) - 0.5) * hexSize * 1.2;
        const moundSize = 4 + seededRandom(seed + i * 5 + 2) * 8;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(mx, my, moundSize, moundSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Shadow areas
    for (let i = 0; i < 3; i++) {
        const sx = cx + (seededRandom(seed + i * 7) - 0.5) * hexSize;
        const sy = cy + (seededRandom(seed + i * 7 + 1) - 0.5) * hexSize;

        ctx.fillStyle = 'rgba(180, 200, 220, 0.15)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 6, 3, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw static ice details
 */
function drawStaticIceDetails(cx, cy, hexSize, seed) {
    // Ice cracks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 0.5;

    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        let x = cx + (seededRandom(seed + i * 3) - 0.5) * hexSize * 1.1;
        let y = cy + (seededRandom(seed + i * 3 + 1) - 0.5) * hexSize * 1.1;
        ctx.moveTo(x, y);

        for (let j = 0; j < 3; j++) {
            x += (seededRandom(seed + i * 10 + j) - 0.5) * hexSize * 0.35;
            y += (seededRandom(seed + i * 10 + j + 5) - 0.5) * hexSize * 0.35;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Shimmer spots
    for (let i = 0; i < 3; i++) {
        const shimmerVisible = seededRandom(seed + i * 30) > 0.4;
        if (shimmerVisible) {
            const sx = cx + (seededRandom(seed + i * 20) - 0.5) * hexSize * 1.3;
            const sy = cy + (seededRandom(seed + i * 20 + 10) - 0.5) * hexSize * 1.3;

            ctx.fillStyle = 'rgba(200, 230, 255, 0.25)';
            ctx.beginPath();
            ctx.ellipse(sx, sy, 3, 1.5, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/**
 * Draw simple reed texture - fewer, simpler stalks
 */
function drawStaticReeds(cx, cy, hexSize, seed) {
    // Just 8 simple vertical strokes to suggest reeds
    ctx.strokeStyle = 'rgba(70, 95, 55, 0.5)';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < 8; i++) {
        const rand1 = seededRandom(seed + i * 4);
        const rand2 = seededRandom(seed + i * 4 + 1);

        const x = cx + (rand1 - 0.5) * hexSize * 0.8;
        const y = cy + (rand2 - 0.5) * hexSize * 0.6;
        const height = 12 + seededRandom(seed + i * 4 + 2) * 8;
        const sway = (rand1 - 0.5) * 3;

        ctx.beginPath();
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x + sway, y - height);
        ctx.stroke();
    }
}

/**
 * Draw simple flower color spots - subtle, natural looking
 */
function drawStaticFlowers(cx, cy, hexSize, seed) {
    // Just a few subtle color spots to suggest wildflowers
    const colors = ['rgba(255, 100, 100, 0.4)', 'rgba(255, 220, 80, 0.4)', 'rgba(255, 255, 255, 0.3)', 'rgba(180, 140, 200, 0.3)'];

    for (let i = 0; i < 6; i++) {
        const angle = seededRandom(seed + i) * Math.PI * 2;
        const dist = seededRandom(seed + i + 50) * hexSize * 0.55;
        const fx = cx + Math.cos(angle) * dist;
        const fy = cy + Math.sin(angle) * dist;

        const colorIdx = Math.floor(seededRandom(seed + i + 100) * colors.length);
        const size = 2 + seededRandom(seed + i + 150) * 2;

        ctx.fillStyle = colors[colorIdx];
        ctx.beginPath();
        ctx.arc(fx, fy, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw subtle wheat field texture - golden patches
 */
function drawStaticWheatField(cx, cy, hexSize, seed) {
    // Draw subtle golden texture patches
    for (let i = 0; i < 4; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);

        const x = cx + (rand1 - 0.5) * hexSize * 0.8;
        const y = cy + (rand2 - 0.5) * hexSize * 0.8;
        const size = 8 + seededRandom(seed + i * 3 + 2) * 10;

        // Light golden patch
        ctx.fillStyle = 'rgba(210, 180, 100, 0.15)';
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, rand1 * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Add a few subtle darker streaks to suggest stalks
    ctx.strokeStyle = 'rgba(180, 150, 80, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const rand = seededRandom(seed + i * 5);
        const x = cx + (rand - 0.5) * hexSize * 0.6;
        const y = cy + (seededRandom(seed + i * 5 + 1) - 0.5) * hexSize * 0.6;

        ctx.beginPath();
        ctx.moveTo(x, y + 6);
        ctx.lineTo(x + (rand - 0.5) * 4, y - 6);
        ctx.stroke();
    }
}

/**
 * Draw subtle heather texture - purple patches
 */
function drawStaticHeather(cx, cy, hexSize, seed) {
    // Just a few subtle purple patches
    for (let i = 0; i < 4; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);

        const x = cx + (rand1 - 0.5) * hexSize * 0.7;
        const y = cy + (rand2 - 0.5) * hexSize * 0.7;
        const size = 6 + seededRandom(seed + i * 3 + 2) * 8;

        ctx.fillStyle = 'rgba(150, 100, 150, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.7, rand1 * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw minimal water details - just subtle depth variation and optional lily pad
 */
function drawWaterDetails(cx, cy, s, seed) {
    // Subtle depth gradient only
    const gradient = ctx.createRadialGradient(
        cx + s * 0.15, cy - s * 0.15, 0,
        cx, cy, s * 0.7
    );
    gradient.addColorStop(0, 'rgba(120, 180, 220, 0.08)');
    gradient.addColorStop(1, 'rgba(60, 100, 140, 0.1)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + s * Math.cos(angle);
        const py = cy + s * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Lily pad (rare) - keep as it's a nice natural touch
    if (seededRandom(seed + 500) > 0.75) {
        const lx = cx + (seededRandom(seed + 501) - 0.5) * s * 0.5;
        const ly = cy + (seededRandom(seed + 502) - 0.5) * s * 0.4;

        ctx.fillStyle = 'rgba(45, 122, 74, 0.7)';
        ctx.beginPath();
        ctx.ellipse(lx, ly, s * 0.15, s * 0.1, 0, 0.1, Math.PI * 1.9);
        ctx.fill();
    }
}

/**
 * Draw minimal sand details - subtle texture variation only
 */
function drawSandDetails(cx, cy, s, seed) {
    // Just subtle light/dark patches for natural texture variation
    for (let i = 0; i < 3; i++) {
        const x = cx + (seededRandom(seed + i * 5) - 0.5) * s * 0.7;
        const y = cy + (seededRandom(seed + i * 5 + 1) - 0.5) * s * 0.7;
        const size = 6 + seededRandom(seed + i * 5 + 2) * 8;

        ctx.fillStyle = i % 2 === 0 ? 'rgba(200, 170, 120, 0.08)' : 'rgba(160, 130, 90, 0.06)';
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Just 2 small pebbles
    for (let i = 0; i < 2; i++) {
        const px = cx + (seededRandom(seed + i * 37) - 0.5) * s * 0.6;
        const py = cy + (seededRandom(seed + i * 37 + 1) - 0.5) * s * 0.5;

        ctx.fillStyle = 'rgba(130, 120, 110, 0.3)';
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw swamp details
 */
function drawSwampDetails(cx, cy, s, seed) {
    // Murky water puddles
    ctx.fillStyle = 'rgba(25, 45, 30, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.1, s * 0.65, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Algae on water
    ctx.fillStyle = 'rgba(50, 80, 40, 0.4)';
    for (let i = 0; i < 3; i++) {
        const ax = cx + (seededRandom(seed + i * 41) - 0.5) * s * 0.8;
        const ay = cy + (seededRandom(seed + i * 41 + 1) - 0.5) * s * 0.5;
        ctx.beginPath();
        ctx.ellipse(ax, ay, s * 0.15, s * 0.1, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Bubbles
    ctx.fillStyle = 'rgba(60, 85, 55, 0.7)';
    for (let i = 0; i < 4; i++) {
        const bx = cx + (seededRandom(seed + i * 43) - 0.5) * s * 0.9;
        const by = cy + (seededRandom(seed + i * 43 + 1) - 0.5) * s * 0.7;
        const bSize = 2 + seededRandom(seed + i * 43 + 2) * 2;
        ctx.beginPath();
        ctx.arc(bx, by, bSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // Dead reeds
    ctx.strokeStyle = 'rgba(90, 70, 50, 0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        const rx = cx + (seededRandom(seed + i * 47) - 0.5) * s * 1.2;
        const ry = cy + (seededRandom(seed + i * 47 + 1) - 0.5) * s * 0.8;
        const height = s * (0.3 + seededRandom(seed + i * 47 + 2) * 0.3);
        const lean = (seededRandom(seed + i * 47 + 3) - 0.5) * s * 0.15;

        ctx.beginPath();
        ctx.moveTo(rx, ry + s * 0.2);
        ctx.lineTo(rx + lean, ry - height);
        ctx.stroke();

        // Reed tip
        ctx.fillStyle = 'rgba(70, 50, 35, 0.8)';
        ctx.beginPath();
        ctx.ellipse(rx + lean, ry - height - 3, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Moss on edges
    ctx.fillStyle = 'rgba(45, 70, 35, 0.5)';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.5, cy - s * 0.2, s * 0.2, s * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw a ghost indicator showing where a cloaked unit last attacked from
 */
function drawGhostIndicator(cx, cy, ghost) {
    const size = state.hexSize * 0.65;
    const now = Date.now();
    const age = now - ghost.timestamp;
    const fadeStart = ghost.fadeStart || (ghost.timestamp + 3000);

    // Calculate opacity - full for 3 seconds, then fade out over 5 seconds
    let alpha = 1;
    if (now > fadeStart) {
        const fadeProgress = (now - fadeStart) / 5000;
        alpha = Math.max(0, 1 - fadeProgress);
    }

    // Pulse effect
    const pulse = 0.8 + Math.sin(now / 200) * 0.2;

    ctx.save();
    ctx.globalAlpha = alpha * 0.6 * pulse;

    // Ghost silhouette - ethereal glow effect
    const playerColor = CONFIG.PLAYER_COLORS[ghost.player];

    // Outer glow ring - pulsing warning
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.8})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, size + 15 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner danger zone
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size + 10);
    gradient.addColorStop(0, `rgba(239, 68, 68, ${alpha * 0.3})`);
    gradient.addColorStop(0.7, `rgba(239, 68, 68, ${alpha * 0.15})`);
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size + 10, 0, Math.PI * 2);
    ctx.fill();

    // Ghost silhouette shape
    ctx.globalAlpha = alpha * 0.4 * pulse;
    ctx.fillStyle = playerColor;

    // Draw ghostly human shape
    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.5, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.3, cy - size * 0.2);
    ctx.lineTo(cx + size * 0.3, cy - size * 0.2);
    ctx.lineTo(cx + size * 0.25, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.25, cy + size * 0.3);
    ctx.closePath();
    ctx.fill();

    // Arms
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = playerColor;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.3, cy - size * 0.1);
    ctx.lineTo(cx - size * 0.5, cy + size * 0.1);
    ctx.moveTo(cx + size * 0.3, cy - size * 0.1);
    ctx.lineTo(cx + size * 0.5, cy + size * 0.1);
    ctx.stroke();

    // Warning icon
    ctx.globalAlpha = alpha * 0.9;
    ctx.font = `bold ${Math.round(size * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('👻', cx, cy - size - 15);
    ctx.shadowBlur = 0;

    // "Letzter Angriff" text
    ctx.globalAlpha = alpha * 0.7;
    ctx.font = `bold ${Math.round(size * 0.22)}px sans-serif`;
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('LETZTER ANGRIFF', cx, cy + size + 20);

    ctx.restore();
}

/**
 * Draw a speech bubble with text above a unit
 */
function drawSpeechBubble(ctx, x, y, text, color, size) {
    ctx.save();

    const padding = size * 0.15;
    const fontSize = Math.round(size * 0.28);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const bubbleWidth = textWidth + padding * 2;
    const bubbleHeight = fontSize + padding * 1.5;

    // Bubble background with rounded corners
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x - bubbleWidth / 2, y - bubbleHeight / 2, bubbleWidth, bubbleHeight, 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Speech bubble pointer (triangle pointing down)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + bubbleHeight / 2);
    ctx.lineTo(x, y + bubbleHeight / 2 + 10);
    ctx.lineTo(x + 8, y + bubbleHeight / 2);
    ctx.closePath();
    ctx.fill();

    // Pointer border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + bubbleHeight / 2);
    ctx.lineTo(x, y + bubbleHeight / 2 + 10);
    ctx.lineTo(x + 8, y + bubbleHeight / 2);
    ctx.stroke();

    // Text
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);

    ctx.restore();
}

/**
 * Draw a human unit with equipment
 */
function drawUnit(unit, cx, cy, isSelected, isTargeted, isAttackable, isBlocked = false, blockedInfo = null) {
    const size = state.hexSize * 0.65;
    const playerColor = CONFIG.PLAYER_COLORS[unit.player];

    ctx.save();

    // Cloaked units visibility based on distance to nearest friendly unit
    // Closer = more visible, farther = more transparent
    let isCamouflagedEnemy = false;
    if (unit.cloaked && unit.player === state.viewingPlayer) {
        // Own cloaked units - visibility based on distance to own non-cloaked units
        ctx.globalAlpha = getStealthVisibilityAlpha(unit);
    } else if (unit.cloaked && unit.player !== state.viewingPlayer) {
        // Enemy cloaked unit detected by proximity - show semi-transparent
        const alpha = getEnemyCloakedVisibilityAlpha(unit, state.viewingPlayer);
        if (alpha > 0) {
            ctx.globalAlpha = alpha;
        } else {
            // Even invisible enemies show as terrain-colored shimmer (subtle)
            isCamouflagedEnemy = true;
        }
    } else if (unit.revealedUntilEndOfTurn && unit.player !== state.viewingPlayer) {
        // Unit that attacked while cloaked - visible but semi-transparent until turn ends
        ctx.globalAlpha = 0.6;
    }

    // Draw terrain camouflage pattern for enemy cloaked units not in detection range
    if (isCamouflagedEnemy) {
        drawCamouflagePattern(cx, cy, size, unit);
        ctx.restore();
        return; // Don't draw the actual unit sprite
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.7, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Base ring around unit - dashed normally, solid when selected
    if (isSelected) {
        // Selected: solid thick ring in player color
        ctx.strokeStyle = playerColor;
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
    } else {
        // Normal: thin dashed ring in player color
        ctx.strokeStyle = playerColor;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Determine sprite status - note: 'selected' is not a sprite state, use 'normal' instead
    // Selection is indicated by the ring around the unit, not a different sprite
    const unitStatus = unit.hiding
        ? 'cover'
        : (isSelected && state.selectedAction === 'attack'
            ? 'attack'
            : 'normal');

    // Draw the human sprite (uses static asset if available, otherwise runtime)
    // Size increased from 1.3 to 1.8 for better visibility at 100% zoom
    drawUnitSprite(ctx, cx, cy - size * 0.2, size * 1.8, playerColor, unit.class, unitStatus, isSelected, unit.player);

    // NOTE: All HUD elements (badges, indicators, speech bubbles, HP bar) are now drawn
    // separately in drawUnitOverlay() to ensure they're always on top of trees

    // Attackable indicator
    if (isAttackable && !isSelected) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, size + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // "Target" icon
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy - size - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('!', cx, cy - size - 10);
    }

    // Targeted crosshair animation
    if (isTargeted) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        const crossSize = size + 25;

        // Crosshair lines
        ctx.beginPath();
        ctx.moveTo(cx - crossSize, cy);
        ctx.lineTo(cx - size - 10, cy);
        ctx.moveTo(cx + size + 10, cy);
        ctx.lineTo(cx + crossSize, cy);
        ctx.moveTo(cx, cy - crossSize);
        ctx.lineTo(cx, cy - size - 10);
        ctx.moveTo(cx, cy + size + 10);
        ctx.lineTo(cx, cy + crossSize);
        ctx.stroke();

        // Outer targeting ring
        ctx.beginPath();
        ctx.arc(cx, cy, crossSize, 0, Math.PI * 2);
        ctx.stroke();

        // Inner pulsing ring
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, size + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Blocked target indicator - in range but no line of sight
    if (isBlocked && !isSelected) {
        // Dimmed ring
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, size + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // "No LOS" indicator with crossed lines
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.8)';
        ctx.lineWidth = 3;
        const xSize = 8;
        const xY = cy - size - 15;
        ctx.beginPath();
        ctx.moveTo(cx - xSize, xY - xSize);
        ctx.lineTo(cx + xSize, xY + xSize);
        ctx.moveTo(cx + xSize, xY - xSize);
        ctx.lineTo(cx - xSize, xY + xSize);
        ctx.stroke();

        // Show what's blocking (icon)
        ctx.font = `${Math.round(size * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const blockIcon = blockedInfo && blockedInfo.blockedBy === 'rock' ? '🪨' : '🌲';
        ctx.fillText(blockIcon, cx + size * 0.7, cy - size - 15);
    }

    ctx.restore();
}

/**
 * Draw unit overlay - all HUD elements (badges, indicators, HP bar) on top of everything
 * Called after all depth-sorted elements to ensure visibility
 */
function drawUnitOverlay(unit, cx, cy) {
    // Safety check: bail out if coordinates are not finite (prevents NaN errors)
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(state.hexSize) || state.hexSize <= 0) {
        return;
    }

    const size = state.hexSize * 0.65;
    const playerColor = CONFIG.PLAYER_COLORS[unit.player];

    ctx.save();

    // Player number badge
    ctx.fillStyle = playerColor;
    ctx.beginPath();
    ctx.arc(cx + size * 0.5, cy - size * 0.6, size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.32)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unit.player + 1, cx + size * 0.5, cy - size * 0.6);

    // Level badge (left side)
    const level = unit.level || 1;
    if (level > 1) {
        const levelColors = ['#9ca3af', '#22c55e', '#3b82f6', '#a855f7', '#eab308'];
        const levelColor = levelColors[Math.min(level - 1, levelColors.length - 1)];

        ctx.fillStyle = levelColor;
        ctx.beginPath();
        ctx.arc(cx - size * 0.5, cy - size * 0.6, size * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(size * 0.24)}px sans-serif`;
        ctx.fillText(level, cx - size * 0.5, cy - size * 0.6);
    }

    // Shield indicator (if unit has shield from power-up)
    if (unit.shield) {
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.font = `${Math.round(size * 0.5)}px sans-serif`;
        ctx.fillText('🛡️', cx, cy - size - 5);
        ctx.shadowBlur = 0;
    }

    // Cover status speech bubble (only for current player's units in cover)
    if (unit.hiding && unit.player === state.currentPlayer) {
        drawSpeechBubble(ctx, cx + size * 0.8, cy - size * 1.2, 'In Deckung', '#22c55e', size);
    }

    // Cloak indicator (visible to owner) with speech bubble
    if (unit.cloaked && unit.player === state.viewingPlayer) {
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 15;

        // Draw speech bubble for stealth status
        drawSpeechBubble(ctx, cx + size * 0.8, cy - size * 1.2, 'Getarnt!', '#a855f7', size);

        ctx.font = `${Math.round(size * 0.45)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👁️‍🗨️', cx, cy - size - 5);
        ctx.shadowBlur = 0;
    }

    // Revealed after attack indicator
    if (unit.revealedUntilEndOfTurn && unit.player !== state.viewingPlayer) {
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.font = `${Math.round(size * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️', cx + size * 0.6, cy - size * 0.6);
        ctx.shadowBlur = 0;
    }

    // Sprint active indicator (Scout)
    if (unit.usedSpecial && unit.class === 'scout') {
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 10;
        ctx.font = `${Math.round(size * 0.4)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏃', cx + size * 0.6, cy - size * 0.8);
        ctx.shadowBlur = 0;
    }

    // Powershot active indicator (Assault)
    if (unit.usedSpecial && unit.class === 'assault' && unit.damage > UNIT_CLASSES.assault.damage) {
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.font = `${Math.round(size * 0.4)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💥', cx + size * 0.6, cy - size * 0.8);
        ctx.shadowBlur = 0;
    }

    // Damage boost indicator
    if (unit.damageBoost && unit.damageBoost > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = `${Math.round(size * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚔️', cx + size * 0.6, cy - size * 0.3);
    }

    // "Spotted!" indicator
    if (unit.spotted && unit.player === state.currentPlayer) {
        ctx.globalAlpha = 1;
        drawSpeechBubble(ctx, cx + size * 0.8, cy - size * 1.4, 'Entdeckt!', '#ef4444', size);
    }

    ctx.restore();

    // HP bar with gradient
    // Ensure hpPct is a valid number between 0 and 1
    const rawHpPct = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 0;
    const hpPct = Number.isFinite(rawHpPct) ? Math.max(0, Math.min(1, rawHpPct)) : 0;
    const barWidth = size * 1.6;
    const barHeight = 8;
    const barY = cy + size * 0.65;

    // Bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(cx - barWidth / 2 - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
    ctx.fill();

    // HP bar fill with gradient (use minimum width of 1 to prevent zero-width gradient)
    const gradientWidth = Math.max(1, barWidth * hpPct);
    const barGradient = ctx.createLinearGradient(cx - barWidth / 2, barY, cx - barWidth / 2 + gradientWidth, barY);
    if (hpPct > 0.5) {
        barGradient.addColorStop(0, '#22c55e');
        barGradient.addColorStop(1, '#16a34a');
    } else if (hpPct > 0.25) {
        barGradient.addColorStop(0, '#eab308');
        barGradient.addColorStop(1, '#ca8a04');
    } else {
        barGradient.addColorStop(0, '#ef4444');
        barGradient.addColorStop(1, '#dc2626');
    }

    ctx.fillStyle = barGradient;
    ctx.beginPath();
    ctx.roundRect(cx - barWidth / 2, barY, barWidth * hpPct, barHeight, 3);
    ctx.fill();

    // HP text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(barHeight * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${unit.currentHp}/${unit.maxHp}`, cx, barY + barHeight / 2);
}

/**
 * Lighten a hex color
 */
function lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `rgb(${R},${G},${B})`;
}

/**
 * Darken a hex color
 */
function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `rgb(${R},${G},${B})`;
}

/**
 * Desaturate and darken a color for shadow effect
 * @param color - Hex color string
 * @param saturation - 0 = grayscale, 1 = full saturation
 * @param brightness - 0 = black, 1 = original brightness
 */
function desaturateAndDarken(color, saturation, brightness) {
    const num = parseInt(color.replace('#', ''), 16);
    let R = (num >> 16) & 0xFF;
    let G = (num >> 8) & 0xFF;
    let B = num & 0xFF;

    // Calculate grayscale value (luminance-based)
    const gray = Math.round(0.299 * R + 0.587 * G + 0.114 * B);

    // Blend between grayscale and original color
    R = Math.round(gray + (R - gray) * saturation);
    G = Math.round(gray + (G - gray) * saturation);
    B = Math.round(gray + (B - gray) * saturation);

    // Apply brightness
    R = Math.round(R * brightness);
    G = Math.round(G * brightness);
    B = Math.round(B * brightness);

    return `rgb(${R},${G},${B})`;
}

/**
 * Blend a color with red for danger zone indication
 * @param color - Hex or rgb color string
 * @param amount - 0 = original, 1 = full red
 */
function blendWithRed(color, amount) {
    let R, G, B;

    if (color.startsWith('#')) {
        const num = parseInt(color.replace('#', ''), 16);
        R = (num >> 16) & 0xFF;
        G = (num >> 8) & 0xFF;
        B = num & 0xFF;
    } else if (color.startsWith('rgb')) {
        const match = color.match(/\d+/g);
        if (match) {
            R = parseInt(match[0]);
            G = parseInt(match[1]);
            B = parseInt(match[2]);
        } else {
            return color;
        }
    } else {
        return color;
    }

    // Blend toward red (239, 68, 68)
    R = Math.round(R + (239 - R) * amount);
    G = Math.round(G + (68 - G) * amount * 0.7); // Less green reduction
    B = Math.round(B + (68 - B) * amount * 0.7); // Less blue reduction

    return `rgb(${R},${G},${B})`;
}

/**
 * Update performance tracking and determine effective quality
 */
function updatePerformance() {
    const now = performance.now();

    if (state.lastFrameTime > 0) {
        const delta = now - state.lastFrameTime;
        const fps = 1000 / delta;

        // Smooth FPS calculation
        state.currentFps = state.currentFps * 0.9 + fps * 0.1;
        state.frameCount++;

        // Auto quality adjustment every 30 frames
        if (state.settings.renderQuality === 'auto' && state.frameCount % 30 === 0) {
            if (state.currentFps < 20) {
                state.lowPerfFrames++;
                if (state.lowPerfFrames > 2) {
                    state.effectiveQuality = 'low';
                }
            } else if (state.currentFps < 35) {
                state.effectiveQuality = 'medium';
                state.lowPerfFrames = Math.max(0, state.lowPerfFrames - 1);
            } else if (state.currentFps > 50 && state.lowPerfFrames === 0) {
                state.effectiveQuality = 'high';
            }
        } else if (state.settings.renderQuality !== 'auto') {
            state.effectiveQuality = state.settings.renderQuality;
        }
    }

    state.lastFrameTime = now;
}

/**
 * Check if terrain details should be rendered based on quality settings
 * Note: Always render base terrain details (grass, water, etc.) for visual consistency
 * Only skip foreground elements (trees, rocks) on low quality
 */
function shouldRenderDetails() {
    // Always render terrain details - they are essential for visual identity
    // Only foreground elements are skipped on low quality
    return state.effectiveQuality !== 'low';
}

/**
 * Check if foreground elements (trees, rocks) should be rendered
 */
function shouldRenderForeground() {
    return state.effectiveQuality !== 'low';
}

/**
 * Check if animated terrain overlays should be rendered
 * Enabled on medium and high quality for better visuals on mobile
 */
function shouldRenderAnimations() {
    return state.effectiveQuality !== 'low';
}

/**
 * Draw animated terrain overlay for a hex
 * These are drawn on top of cached/static terrain for dynamic effects
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {number} hexSize - Size of the hex
 * @param {string} terrainType - Type of terrain
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 */
function drawAnimatedTerrainOverlay(cx, cy, hexSize, terrainType, q, r) {
    switch (terrainType) {
        case 'grass':
        case 'clearing':
            drawAnimatedGrass(ctx, cx, cy, hexSize, q, r, 0.6, terrainType);
            break;
        case 'tallgrass':
            drawAnimatedGrass(ctx, cx, cy, hexSize, q, r, 0.8, 'tallgrass');
            break;
        case 'water':
            drawAnimatedWater(ctx, cx, cy, hexSize, q, r, false);
            break;
        case 'deepwater':
            drawAnimatedWater(ctx, cx, cy, hexSize, q, r, true);
            break;
        case 'shallows':
            drawShallowWater(ctx, cx, cy, hexSize, q, r);
            break;
        case 'wheat':
            drawWheatField(ctx, cx, cy, hexSize, q, r);
            break;
        case 'reeds':
            drawReeds(ctx, cx, cy, hexSize, q, r);
            break;
        case 'snow':
            drawSnowfall(ctx, cx, cy, hexSize, q, r);
            drawSnowDetails(ctx, cx, cy, hexSize, q, r);
            break;
        case 'ice':
            drawIceReflections(ctx, cx, cy, hexSize, q, r);
            break;
        case 'forest':
        case 'pine':
            // Removed expensive per-hex fireflies and falling leaves animations
            // These were rendering global animations on EVERY forest hex (very inefficient)
            break;
        case 'sand':
            // Removed dust motes animation (same performance issue as fireflies)
            break;
        case 'flowers':
            drawAnimatedGrass(ctx, cx, cy, hexSize, q, r, 0.5, 'grass');
            drawFlowers(ctx, cx, cy, hexSize, q, r);
            break;
        case 'heather':
            drawAnimatedGrass(ctx, cx, cy, hexSize, q, r, 0.5, 'heather');
            drawHeather(ctx, cx, cy, hexSize, q, r);
            break;
    }
}

/**
 * Check if hex grid should be visible
 * Only show when actively planning a path or targeting an attack
 */
function shouldShowHexGrid() {
    const currentUnit = getCurrentUnit();
    if (!currentUnit) return false;

    // Only show grid when actively planning (path exists or pending destination)
    // or when targeting an enemy for attack
    return state.currentPath !== null ||
           state.pendingMoveDestination !== null ||
           state.targetedUnit !== null ||
           state.hoveredHex !== null;
}

/**
 * Draw hex grid overlay on top of seamless terrain
 * Only draws grid on hexes within movement range or attack range
 */
function drawHexGridOverlay(w, h, reachableHexes, attackableUnits, currentUnit) {
    ctx.save();

    // Collect all hexes that should show grid (movement range + attack range)
    const gridHexKeys = new Set();

    // Add all reachable hexes (movement range)
    for (const key of reachableHexes.keys()) {
        gridHexKeys.add(key);
    }

    // Add hexes with attackable units
    for (const target of attackableUnits) {
        gridHexKeys.add(`${target.q},${target.r}`);
    }

    // Add current unit's hex
    if (currentUnit) {
        gridHexKeys.add(`${currentUnit.q},${currentUnit.r}`);
    }

    // Only draw grid on relevant hexes
    gridHexKeys.forEach(key => {
        const hex = state.hexMap.get(key);
        if (!hex) return;

        const pos = hexToPixel(hex.q, hex.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;

        // Skip if off screen
        if (sx < -state.hexSize * 2 || sx > w + state.hexSize * 2 ||
            sy < -state.hexSize * 2 || sy > h + state.hexSize * 2) {
            return;
        }

        const fogLevel = getFogLevel(hex.q, hex.r);

        // Draw grid lines - more visible for better gameplay clarity
        ctx.beginPath();
        drawHexPath(sx, sy, state.hexSize);

        if (fogLevel === 'visible') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        } else if (fogLevel === 'explored') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        } else {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        }
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });

    ctx.restore();
}

/**
 * Main render function
 */
export function render() {
    if (!canvas || !ctx) {
        logRender('Canvas oder Context nicht verfügbar', `canvas: ${!!canvas}, ctx: ${!!ctx}`);
        return;
    }

    // Skip rendering if canvas has invalid dimensions (not yet sized)
    if (canvas.width === 0 || canvas.height === 0) {
        logRender('Canvas hat keine Dimensionen', `width: ${canvas.width}, height: ${canvas.height}`);
        return;
    }

    // Validate critical state before rendering
    if (!state.hexes || state.hexes.length === 0) {
        logRender('Keine Hexfelder vorhanden', `hexes: ${state.hexes?.length || 0}`);
        // Draw a helpful message instead of black screen
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        ctx.fillStyle = '#1a1a3e';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Karte wird geladen...', w / 2, h / 2);
        return;
    }

    // SAFETY: Ensure visibility arrays exist for current viewing player
    const viewPlayer = state.viewingPlayer;
    if (viewPlayer < 0 || viewPlayer >= state.settings.players) {
        logRender('Ungültiger viewingPlayer', `viewPlayer: ${viewPlayer}, players: ${state.settings.players}`);
        state.viewingPlayer = 0;
    }

    // SAFETY: In any AI mode, ensure visibility is always up-to-date
    // This prevents black screen issues from stale visibility data during turn transitions
    if (isAIPlayer() || isSpectatorMode()) {
        // Ensure visibility arrays exist for this player
        if (!state.playerVisibleHexes[viewPlayer]) {
            state.playerVisibleHexes[viewPlayer] = new Set();
        }
        if (!state.playerExploredHexes[viewPlayer]) {
            state.playerExploredHexes[viewPlayer] = new Set();
        }

        const visibleHexes = state.playerVisibleHexes[viewPlayer];
        // Refresh if visibility seems stale (empty or undefined)
        if (!visibleHexes || visibleHexes.size === 0) {
            logRender('Visibility leer, aktualisiere', `viewPlayer: ${viewPlayer}, spectator: ${isSpectatorMode()}`);
            updateVisibilityForPlayer(viewPlayer);
        }
    }

    // Update animations
    animationTick(performance.now());

    // Track performance for auto-quality adjustment
    updatePerformance();

    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    // Background - simplified on low quality
    if (state.effectiveQuality === 'low') {
        ctx.fillStyle = '#12122b';
        ctx.fillRect(0, 0, w, h);
    } else {
        // Background with modern gradient
        const bgGradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8);
        bgGradient.addColorStop(0, '#1a1a3e');
        bgGradient.addColorStop(0.5, '#12122b');
        bgGradient.addColorStop(1, '#0c0c1d');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, w, h);

        // Subtle ambient glow - only on high quality
        if (state.effectiveQuality === 'high') {
            ctx.save();
            ctx.globalAlpha = 0.1;
            const ambientGlow = ctx.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.3, h * 0.3, w * 0.5);
            ambientGlow.addColorStop(0, '#10b981');
            ambientGlow.addColorStop(1, 'transparent');
            ctx.fillStyle = ambientGlow;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }
    }

    // Update screen shake and get current offset
    const shakeOffset = updateScreenShake();

    // Apply screen shake via canvas transform (affects all rendering)
    ctx.save();
    ctx.translate(shakeOffset.x, shakeOffset.y);

    const isAiTurnHidden = isAIPlayer() && state.currentPlayer !== state.viewingPlayer;
    const currentUnit = isAiTurnHidden ? null : getCurrentUnit();
    // Always show reachable hexes when a unit is selected (point-and-click system)
    const reachableHexes = currentUnit ? getReachableHexes(currentUnit) : new Map();
    const attackableUnits = currentUnit ? getAttackableUnits(currentUnit) : [];
    const blockedTargets = currentUnit ? getBlockedTargets(currentUnit) : [];

    // Only show hex grid borders when planning movement or attacking
    const showGrid = !isAiTurnHidden && shouldShowHexGrid();

    // Collect all foreground elements for 2.5D depth sorting
    const foregroundElements = [];

    // Collect cover positions to show only the best ones (max 4)
    const coverPositions = [];

    // Collect powerup positions for drawing on top of foreground elements
    const powerupPositions = [];

    // Collect AP cost overlay positions for drawing on top of everything
    const apCostOverlays = [];

    // Draw hexes (ground layer) - with tile caching for performance
    state.hexes.forEach(hex => {
        const pos = hexToPixel(hex.q, hex.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;

        // Skip if off screen (with margin)
        if (sx < -state.hexSize * 2 || sx > w + state.hexSize * 2 ||
            sy < -state.hexSize * 2 || sy > h + state.hexSize * 2) {
            return;
        }

        const fogLevel = getFogLevel(hex.q, hex.r);
        const terrain = TERRAIN[hex.type];

        // Try to use cached tile for better performance
        const cacheEntry = getCachedHexTile(hex, fogLevel);

        if (cacheEntry) {
            // Draw cached tile with scaling - prevents cache invalidation during zoom
            const { canvas: cachedTile, baseSize } = cacheEntry;
            const scale = state.hexSize / baseSize;
            const tileSize = cachedTile.width;
            const scaledSize = tileSize * scale;

            ctx.drawImage(
                cachedTile,
                sx - scaledSize / 2,
                sy - scaledSize / 2,
                scaledSize,
                scaledSize
            );
        } else {
            // Fallback: draw directly (low quality mode or cache miss, or animated terrain)
            let fillColor = terrain.color;
            const texture = fogLevel === 'visible' ? getTerrainTexture(hex.type, hex.q, hex.r) : null;

            if (fogLevel === 'hidden') {
                fillColor = '#000000';
            } else if (fogLevel === 'explored') {
                fillColor = desaturateAndDarken(terrain.color, 0.5, 0.75);
            }

            // No grid lines on base hex - grid overlay is drawn separately only for relevant hexes
            // This matches cached tile behavior for seamless terrain
            const terrainData = fogLevel === 'visible' ? terrain : null;
            drawHex(sx, sy, state.hexSize, fillColor, null, 1, texture, terrainData);

            // Draw terrain details for visible hexes (same as cached tiles)
            if (fogLevel === 'visible' && shouldRenderDetails()) {
                drawStaticTerrainDetails(sx, sy, state.hexSize, hex.type, hex.q, hex.r);
            }

            // Fog overlays for non-cached rendering (match cached version)
            if (fogLevel === 'explored') {
                ctx.save();
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize);
                // Clean dim overlay for explored areas
                const dimGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, state.hexSize);
                dimGradient.addColorStop(0, 'rgba(8, 12, 20, 0.55)');
                dimGradient.addColorStop(0.6, 'rgba(5, 8, 15, 0.62)');
                dimGradient.addColorStop(1, 'rgba(2, 4, 10, 0.70)');
                ctx.fillStyle = dimGradient;
                ctx.fill();
                ctx.restore();
            } else if (fogLevel === 'hidden') {
                ctx.save();
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize);
                // Solid dark fog for hidden areas
                ctx.fillStyle = '#050810';
                ctx.fill();
                ctx.restore();
            }
        }

        // Draw animated terrain overlays (grass swaying, water ripples, etc.)
        // These are drawn on top of cached/static terrain for dynamic effects
        if (fogLevel === 'visible' && shouldRenderAnimations()) {
            drawAnimatedTerrainOverlay(sx, sy, state.hexSize, hex.type, hex.q, hex.r);
        }

        // Collect foreground elements for 2.5D sorting (always needed for depth sorting)
        // Use cached foreground element definitions for better performance
        if (fogLevel === 'visible' && shouldRenderForeground()) {
            const elements = getCachedForegroundElements(hex.q, hex.r, sx, sy, state.hexSize, hex.type);
            foregroundElements.push(...elements);
        }

        // Collect power-up positions for drawing on top of foreground elements
        if (fogLevel === 'visible') {
            const powerup = getPowerupAt(hex.q, hex.r);
            if (powerup) {
                powerupPositions.push({ sx, sy, powerup });
            }
        }

        // === SHRINKING ZONE VISUAL INDICATOR ===
        // Draw red overlay on hexes outside the safe zone
        if (state.zoneRadius > 0 && state.zoneRadius < state.maxZoneRadius) {
            if (!isHexInZone(hex.q, hex.r)) {
                // Red danger zone overlay
                ctx.save();
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize);
                const zoneGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, state.hexSize);
                zoneGradient.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
                zoneGradient.addColorStop(0.6, 'rgba(220, 38, 38, 0.25)');
                zoneGradient.addColorStop(1, 'rgba(185, 28, 28, 0.35)');
                ctx.fillStyle = zoneGradient;
                ctx.fill();

                // Pulsing red border for danger zone edge
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
                ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.3})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
        }

        // Zone warning indicator for hexes at the boundary
        if (state.zoneShrinkWarning && state.zoneRadius > 0) {
            const hexDist = Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(-hex.q - hex.r));
            // Hexes that will be outside after next shrink
            if (hexDist > state.zoneRadius - 2 && hexDist <= state.zoneRadius) {
                ctx.save();
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize);
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
                ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 + pulse * 0.4})`;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.restore();
            }
        }

        // Highlight reachable hexes for movement - traffic light color system based on cumulative path cost
        // Only show colored overlays when a path is being planned (currentPath exists)
        const isPathPlanning = state.currentPath && state.currentPath.length > 0;
        if (reachableHexes.size > 0 && fogLevel === 'visible' && isPathPlanning) {
            const hexKey = `${hex.q},${hex.r}`;
            const pathData = reachableHexes.get(hexKey);
            if (pathData && !hex.unit) {
                // Check if this hex offers cover
                const hexTerrain = TERRAIN[hex.type];
                const offersCover = hexTerrain && hexTerrain.canHide;

                // Traffic light color system based on cumulative path cost (total AP to reach):
                // Green (1-2 AP): Close/easy to reach
                // Yellow (3-4 AP): Medium distance
                // Red (5+ AP): Far/expensive to reach
                const totalPathCost = pathData.cost;
                let fillColor, strokeColor;
                if (totalPathCost <= 2) {
                    // Green - close/cheap to reach
                    fillColor = offersCover ? 'rgba(16, 185, 129, 0.4)' : 'rgba(34, 197, 94, 0.3)';
                    strokeColor = offersCover ? 'rgba(16, 185, 129, 0.85)' : 'rgba(34, 197, 94, 0.7)';
                } else if (totalPathCost <= 4) {
                    // Yellow/Orange - medium distance
                    fillColor = offersCover ? 'rgba(234, 179, 8, 0.45)' : 'rgba(251, 191, 36, 0.35)';
                    strokeColor = offersCover ? 'rgba(234, 179, 8, 0.9)' : 'rgba(251, 191, 36, 0.75)';
                } else {
                    // Red - far/expensive (5+ AP)
                    fillColor = offersCover ? 'rgba(239, 68, 68, 0.45)' : 'rgba(248, 113, 113, 0.35)';
                    strokeColor = offersCover ? 'rgba(239, 68, 68, 0.9)' : 'rgba(248, 113, 113, 0.75)';
                }

                // Draw movement range highlight with traffic light colors
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize * 0.88);
                ctx.fillStyle = fillColor;
                ctx.fill();

                // Clear visible border
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = offersCover ? 3 : 2.5;
                ctx.stroke();

                // Collect cover positions for later (show only the best ones)
                if (offersCover) {
                    coverPositions.push({ sx, sy, cost: pathData.cost });
                }

                // Collect AP cost overlays for drawing on top of everything
                if (pathData.cost > 0) {
                    apCostOverlays.push({ sx, sy, cost: pathData.cost, offersCover });
                }
            }
        }
    });

    // Draw hex grid overlay only when planning movement or attack
    if (showGrid) {
        drawHexGridOverlay(w, h, reachableHexes, attackableUnits, currentUnit);
    }

    // NOTE: Path preview and attack line are now drawn AFTER foreground elements
    // See drawPathPreviewOnTop() call below for the path overlay rendering

    // Draw attack line when targeting an enemy
    if (currentUnit && state.targetedUnit) {
        const fromPos = hexToPixel(currentUnit.q, currentUnit.r, state.hexSize);
        const toPos = hexToPixel(state.targetedUnit.q, state.targetedUnit.r, state.hexSize);

        // Gradient attack line
        const gradient = ctx.createLinearGradient(
            state.offsetX + fromPos.x, state.offsetY + fromPos.y,
            state.offsetX + toPos.x, state.offsetY + toPos.y
        );
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
        gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.8)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');

        ctx.save();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 6]);
        ctx.beginPath();
        ctx.moveTo(state.offsetX + fromPos.x, state.offsetY + fromPos.y);
        ctx.lineTo(state.offsetX + toPos.x, state.offsetY + toPos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // Draw ghost indicators for cloaked enemy attacks
    const ghosts = getVisibleGhosts();
    ghosts.forEach(ghost => {
        const pos = hexToPixel(ghost.q, ghost.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;
        drawGhostIndicator(sx, sy, ghost);
    });

    // Combine units and foreground elements for 2.5D depth sorting
    // Use isUnitVisibleToViewer for proper fog of war from human player's perspective
    const visibleUnits = state.units
        .filter(unit => unit.alive && isUnitVisibleToViewer(unit));

    // Convert units to drawable objects with sortY
    const unitDrawables = visibleUnits.map(unit => {
        const pos = hexToPixel(unit.q, unit.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;

        const isSelected = currentUnit && unit.id === currentUnit.id;
        const isTargeted = state.targetedUnit && unit.id === state.targetedUnit.id;
        const isAttackable = attackableUnits.some(u => u.id === unit.id);
        const blockedInfo = blockedTargets.find(b => b.unit.id === unit.id);
        const isBlocked = !!blockedInfo;

        return {
            type: 'unit',
            x: sx,
            y: sy,
            // Sort units at their "feet" position for proper depth between trees
            // Trees sort at their base (y + 0.4) with extra Y offset (0.25)
            // Units should sort between background trees (0.25) and foreground trees (0.65)
            sortY: sy + state.hexSize * 0.5,
            draw: () => drawUnit(unit, sx, sy, isSelected, isTargeted, isAttackable, isBlocked, blockedInfo),
            unit: unit
        };
    });

    // Combine all drawable elements and sort by Y position (bottom-to-top)
    const allDrawables = [...foregroundElements, ...unitDrawables];
    allDrawables.sort((a, b) => a.sortY - b.sortY);

    // Draw all elements in sorted order
    allDrawables.forEach(drawable => {
        drawable.draw();
    });

    // Second pass: Draw all unit overlays (badges, indicators, HP bars) on top of everything
    unitDrawables.forEach(drawable => {
        drawUnitOverlay(drawable.unit, drawable.x, drawable.y);
    });

    // Draw powerups on top of all terrain and foreground elements
    powerupPositions.forEach(({ sx, sy, powerup }) => {
        drawPowerup(sx, sy, powerup, state.hexSize);
    });

    // Draw cover icons on top of all terrain and foreground elements (max 4 best positions)
    if (coverPositions.length > 0) {
        const bestCoverPositions = coverPositions
            .sort((a, b) => a.cost - b.cost)
            .slice(0, 4);

        bestCoverPositions.forEach(({ sx, sy }) => {
            ctx.globalAlpha = 1;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.font = `${Math.round(state.hexSize * 0.5)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🛡️', sx, sy - state.hexSize * 0.25);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        });
    }

    // Update and draw particles only when active
    if (particles.getActiveCount() > 0) {
        updateParticles();
        drawParticles(ctx, state.offsetX, state.offsetY);
    }

    // Draw attack range indicator when targeting an enemy
    if (currentUnit && state.targetedUnit) {
        const pos = hexToPixel(currentUnit.q, currentUnit.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;
        const rangeRadius = getEffectiveRange(currentUnit) * state.hexSize * 1.75;

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

    // Draw AP cost overlays - only when a path is being planned
    if (apCostOverlays.length > 0 && state.currentPath && state.currentPath.length > 0) {
        apCostOverlays.forEach(({ sx, sy, cost, offersCover }) => {
            // Background pill for cost
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(sx - state.hexSize * 0.2, sy + state.hexSize * 0.35, state.hexSize * 0.4, state.hexSize * 0.26, 5);
            ctx.fill();

            // Cost number
            ctx.fillStyle = offersCover ? '#10b981' : '#22c55e';
            ctx.font = `bold ${Math.round(state.hexSize * 0.22)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${cost}`, sx, sy + state.hexSize * 0.48);
        });
    }

    // Draw path preview ON TOP of all foreground elements (trees, units, etc.)
    drawPathPreviewOnTop(currentUnit);

    // Draw scroll hint if map is larger than viewport
    drawScrollHint(w, h);

    // Draw event indicator
    drawEventIndicator(w, h);

    // Draw zoom indicator
    drawZoomIndicator(w, h);

    // Draw minimap for strategic overview
    drawMinimap(w, h);

    // Apply post-processing effects (color grading, vignette, etc.)
    // Only on medium/high quality for performance
    if (state.effectiveQuality !== 'low') {
        applyPostProcessing(ctx, w, h);

        // Apply weather effects if there's an active event
        const currentEvent = getCurrentEvent();
        if (currentEvent) {
            const weatherMap = {
                'sandstorm': 'sandstorm',
                'storm': 'storm',
                'fog': 'fog'
            };
            const weather = weatherMap[currentEvent.type];
            if (weather) {
                applyWeatherEffect(ctx, w, h, weather);
            }
        }
    }

    // Restore canvas state (removes screen shake transform)
    ctx.restore();

    if (shouldAnimate()) {
        ensureAnimationLoop();
    }
}

/**
 * Draw scroll hint arrows if map extends beyond viewport
 */
function drawScrollHint(w, h) {
    if (!state.hexes.length) return;

    // Check if map extends beyond viewport
    const radius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    const mapPixelRadius = radius * state.hexSize * 1.8;

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

/**
 * Draw a power-up on the map
 */
function drawPowerup(cx, cy, powerup, size) {
    const powerupType = POWERUP_TYPES[powerup.type];
    if (!powerupType) return;

    ctx.save();

    // Floating animation offset
    const floatOffset = Math.sin(Date.now() / 400 + powerup.q + powerup.r) * 3;

    // Glow effect
    ctx.shadowColor = powerupType.color;
    ctx.shadowBlur = 15;

    // Background circle
    ctx.fillStyle = powerupType.color + '40';
    ctx.beginPath();
    ctx.arc(cx, cy + floatOffset, size * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = powerupType.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Icon
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(size * 0.45)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerupType.icon, cx, cy + floatOffset);

    ctx.restore();
}

/**
 * Draw active event indicator
 */
function drawEventIndicator(w, h) {
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

/**
 * Draw zoom indicator
 */
function drawZoomIndicator(w, h) {
    // Only show if zoom is not at default
    if (Math.abs(state.zoomLevel - 1.0) < 0.05) return;

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
    const zoomPercent = Math.round(state.zoomLevel * 100);
    ctx.fillText(`🔍 ${zoomPercent}%`, x + 35, y + 15);

    ctx.restore();
}

// ===== MINIMAP =====

/**
 * Minimap configuration - exported for interaction handling
 */
export const MINIMAP_CONFIG = {
    SIZE: 90,            // Minimap size in pixels (compact for mobile)
    EXPANDED_SIZE: 380,  // Expanded minimap size (large view, nearly full screen)
    PADDING: 8,          // Padding from screen edge
    HEX_SIZE: 3,         // Size of each hex on minimap
    OPACITY: 0.5,        // Base opacity (more transparent)
    OPACITY_ACTIVE: 0.95, // Opacity when touched/hovered
    POSITION: 'top-left' // Position on screen
};

// Track if minimap is being interacted with
let minimapActive = false;
let minimapExpanded = false;  // Track expanded/fullscreen state

export function setMinimapActive(active) { minimapActive = active; }
export function isMinimapExpanded() { return minimapExpanded; }
export function setMinimapExpanded(expanded) { minimapExpanded = expanded; }

// Store last drawn minimap bounds for click detection
let lastMinimapBounds = { x: 0, y: 0, size: 0, centerX: 0, centerY: 0, hexSize: 0, hidden: false, expanded: false };
export function getMinimapBounds() { return lastMinimapBounds; }

// Store toggle button bounds for click detection
let toggleButtonBounds = { x: 0, y: 0, size: 24 };
export function getToggleButtonBounds() { return toggleButtonBounds; }

// Store close button bounds for expanded minimap
let closeButtonBounds = { x: 0, y: 0, size: 32 };
export function getCloseButtonBounds() { return closeButtonBounds; }

/**
 * Draw minimap expand button (to open expanded view)
 */
function drawMinimapExpandButton(mapX, mapY, mapSize) {
    const btnSize = 24;
    const btnX = mapX + mapSize - btnSize - 4;
    const btnY = mapY + 4;

    // Store bounds for click detection
    toggleButtonBounds = { x: btnX, y: btnY, size: btnSize };

    ctx.save();
    ctx.globalAlpha = 0.8;

    // Button background
    ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnSize, btnSize, 4);
    ctx.fill();

    // Button border
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Expand icon (⤢ or similar)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const padding = 6;
    // Draw expand arrows (top-right and bottom-left corners)
    ctx.beginPath();
    // Top-right corner arrow
    ctx.moveTo(btnX + btnSize - padding - 4, btnY + padding);
    ctx.lineTo(btnX + btnSize - padding, btnY + padding);
    ctx.lineTo(btnX + btnSize - padding, btnY + padding + 4);
    // Bottom-left corner arrow
    ctx.moveTo(btnX + padding + 4, btnY + btnSize - padding);
    ctx.lineTo(btnX + padding, btnY + btnSize - padding);
    ctx.lineTo(btnX + padding, btnY + btnSize - padding - 4);
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw close button for expanded minimap
 */
function drawMinimapCloseButton(mapX, mapY, mapSize) {
    const btnSize = 32;
    const btnX = mapX + mapSize - btnSize - 8;
    const btnY = mapY + 8;

    // Store bounds for click detection
    closeButtonBounds = { x: btnX, y: btnY, size: btnSize };

    ctx.save();

    // Button background - dark with red tint
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnSize, btnSize, 6);
    ctx.fill();

    // Button border
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // X icon
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const padding = 10;
    ctx.beginPath();
    ctx.moveTo(btnX + padding, btnY + padding);
    ctx.lineTo(btnX + btnSize - padding, btnY + btnSize - padding);
    ctx.moveTo(btnX + btnSize - padding, btnY + padding);
    ctx.lineTo(btnX + padding, btnY + btnSize - padding);
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw strategic minimap showing terrain, units, and zone
 * Supports both compact (corner) and expanded (center) modes
 * - Shows all terrain
 * - Shows own units (including eliminated ones marked with X)
 * - Shows enemies only when visible
 * - Shows shrinking zone boundary
 * - Shows viewport rectangle with correct zoom level
 */
function drawMinimap(w, h) {
    if (state.hexes.length === 0) return;

    const config = MINIMAP_CONFIG;
    const isExpanded = minimapExpanded;

    // Determine size and position based on mode
    let size, x, y;
    if (isExpanded) {
        // Expanded mode: centered on screen, nearly full screen
        size = Math.min(config.EXPANDED_SIZE, Math.min(w, h) - 40);
        x = (w - size) / 2;
        y = (h - size) / 2;
    } else {
        // Compact mode: top-left corner
        size = config.SIZE;
        x = config.PADDING;
        y = config.PADDING + 55; // Offset for top bar
    }

    // Store bounds for interaction
    lastMinimapBounds = {
        x, y, size,
        centerX: x + size / 2,
        centerY: y + size / 2,
        hexSize: 0,
        hidden: false, // Compact minimap is always visible
        expanded: isExpanded
    };

    ctx.save();

    // In expanded mode, draw dark backdrop
    if (isExpanded) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);
    }

    // Use higher opacity for expanded mode or when interacting
    ctx.globalAlpha = isExpanded ? 1.0 : (minimapActive ? config.OPACITY_ACTIVE : config.OPACITY);

    // Background with rounded corners - solid for expanded mode
    ctx.fillStyle = isExpanded ? 'rgba(15, 15, 25, 1.0)' : 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, size + 6, size + 6, isExpanded ? 12 : 6);
    ctx.fill();

    // Border - highlight when expanded or active
    ctx.strokeStyle = isExpanded ? 'rgba(16, 185, 129, 0.9)' : (minimapActive ? 'rgba(16, 185, 129, 0.8)' : 'rgba(255, 255, 255, 0.25)');
    ctx.lineWidth = isExpanded ? 3 : (minimapActive ? 2 : 1);
    ctx.stroke();

    // Calculate scale to fit map in minimap
    const mapRadius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    const hexSize = isExpanded
        ? Math.min(size / 2 / (mapRadius * 1.8), 8)  // Larger hexes for expanded view
        : Math.min(config.HEX_SIZE, (size / 2) / (mapRadius * 1.8));

    // Center of minimap
    const centerX = x + size / 2;
    const centerY = y + size / 2;

    // Clip to minimap area
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, size + 6, size + 6, isExpanded ? 12 : 6);
    ctx.clip();

    // Update bounds with hexSize for click detection
    lastMinimapBounds.hexSize = hexSize;

    // Draw all hexes
    state.hexes.forEach(hex => {
        const terrain = TERRAIN[hex.type];
        if (!terrain) return;

        // Convert hex coords to minimap pixel position
        const px = centerX + hex.q * hexSize * 1.5;
        const py = centerY + (hex.r + hex.q * 0.5) * hexSize * Math.sqrt(3);

        // Check fog level for coloring
        const fogLevel = getFogLevel(hex.q, hex.r);

        // Check if hex is outside the safe zone
        const outsideZone = state.zoneRadius > 0 && state.zoneRadius < state.maxZoneRadius && !isHexInZone(hex.q, hex.r);

        // Draw hex as small circle/diamond (larger in expanded mode)
        ctx.beginPath();
        ctx.arc(px, py, hexSize * (isExpanded ? 0.9 : 0.8), 0, Math.PI * 2);

        if (fogLevel === 'hidden') {
            ctx.fillStyle = outsideZone ? '#2a1a1e' : '#1a1a2e';
        } else if (fogLevel === 'explored') {
            const baseColor = desaturateAndDarken(terrain.color, 0.4, 0.6);
            ctx.fillStyle = outsideZone ? blendWithRed(baseColor, 0.4) : baseColor;
        } else {
            ctx.fillStyle = outsideZone ? blendWithRed(terrain.color, 0.3) : terrain.color;
        }
        ctx.fill();

        // Add red border for hexes outside zone
        if (outsideZone && fogLevel !== 'hidden') {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
            ctx.lineWidth = isExpanded ? 1.5 : 1;
            ctx.stroke();
        }
    });

    // Draw shrinking zone boundary (if active)
    if (state.zoneRadius > 0 && state.zoneRadius < state.maxZoneRadius) {
        // Draw zone circle
        const zoneRadiusPx = state.zoneRadius * hexSize * 1.8;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = isExpanded ? 3 : 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, zoneRadiusPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw units
    const currentPlayer = state.viewingPlayer;
    const unitDotSize = isExpanded ? hexSize * 2 : hexSize * 1.5;

    // First, draw eliminated friendly units (grayed out with X)
    state.units.forEach(unit => {
        if (unit.player !== currentPlayer) return;
        if (unit.alive) return; // Skip alive units for now

        const px = centerX + unit.q * hexSize * 1.5;
        const py = centerY + (unit.r + unit.q * 0.5) * hexSize * Math.sqrt(3);

        // Draw eliminated unit marker
        ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
        ctx.beginPath();
        ctx.arc(px, py, hexSize * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Draw X over eliminated unit
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = isExpanded ? 2 : 1.5;
        const xSize = hexSize * 0.8;
        ctx.beginPath();
        ctx.moveTo(px - xSize, py - xSize);
        ctx.lineTo(px + xSize, py + xSize);
        ctx.moveTo(px + xSize, py - xSize);
        ctx.lineTo(px - xSize, py + xSize);
        ctx.stroke();
    });

    // Draw alive friendly units
    state.units.forEach(unit => {
        if (unit.player !== currentPlayer || !unit.alive) return;

        const px = centerX + unit.q * hexSize * 1.5;
        const py = centerY + (unit.r + unit.q * 0.5) * hexSize * Math.sqrt(3);

        // Draw unit dot with player color
        ctx.fillStyle = CONFIG.PLAYER_COLORS[unit.player];
        ctx.beginPath();
        ctx.arc(px, py, unitDotSize, 0, Math.PI * 2);
        ctx.fill();

        // White outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isExpanded ? 2 : 1;
        ctx.stroke();
    });

    // Draw visible enemy units
    state.units.forEach(unit => {
        if (unit.player === currentPlayer || !unit.alive) return;

        // Check if enemy is visible
        if (!isUnitVisibleToViewer(unit)) return;

        const px = centerX + unit.q * hexSize * 1.5;
        const py = centerY + (unit.r + unit.q * 0.5) * hexSize * Math.sqrt(3);

        // Draw enemy unit dot
        ctx.fillStyle = CONFIG.PLAYER_COLORS[unit.player];
        ctx.beginPath();
        ctx.arc(px, py, unitDotSize, 0, Math.PI * 2);
        ctx.fill();

        // Red hostile outline
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = isExpanded ? 2.5 : 1.5;
        ctx.stroke();
    });

    // Draw current viewport indicator
    // Scale factor from main view to minimap coordinates
    const scale = hexSize / state.hexSize;

    // Viewport center position on minimap
    const viewX = centerX - state.cameraX * scale;
    const viewY = centerY - state.cameraY * scale;

    // Viewport size on minimap (canvas dimensions scaled to minimap)
    const viewportW = state.canvasWidth * scale;
    const viewportH = state.canvasHeight * scale;

    // Viewport rectangle - more visible in expanded mode
    ctx.strokeStyle = isExpanded ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = isExpanded ? 2 : 1;
    ctx.strokeRect(
        viewX - viewportW / 2,
        viewY - viewportH / 2,
        viewportW,
        viewportH
    );

    // Semi-transparent fill for viewport area in expanded mode
    if (isExpanded) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(
            viewX - viewportW / 2,
            viewY - viewportH / 2,
            viewportW,
            viewportH
        );
    }

    ctx.restore();

    // Draw label and close button outside the clip region
    ctx.save();
    if (isExpanded) {
        // Title for expanded view
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('KARTE', x + size / 2, y - 15);

        // Hint text
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText('Tippe um den Viewport zu verschieben', x + size / 2, y + size + 20);

        // Draw close button
        drawMinimapCloseButton(x, y, size);
    } else {
        // Label for compact view
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('KARTE', x + size / 2, y - 8);

        // Draw expand button for compact view
        drawMinimapExpandButton(x, y, size);
    }
    ctx.restore();
}

// ===== PATH PREVIEW (drawn on top of foreground elements) =====

/**
 * Draw path preview on top of all foreground elements
 * This ensures the path line and markers are always visible above trees, units, etc.
 */
function drawPathPreviewOnTop(currentUnit) {
    if (!state.currentPath || state.currentPath.length < 2 || !currentUnit) return;

    // Use same budget as movement logic: shared AP pool
    const maxCost = state.sharedAP;

    // Calculate cumulative costs along path
    let cumulativeCost = 0;
    const pathWithCosts = state.currentPath.map((point, index) => {
        if (index > 0) {
            const hex = getHex(point.q, point.r);
            if (hex && TERRAIN[hex.type]) {
                cumulativeCost += TERRAIN[hex.type].moveCost;
            }
        }
        return { ...point, totalCost: cumulativeCost, reachable: cumulativeCost <= maxCost };
    });

    // Find last reachable point this turn
    let lastReachableIndex = 0;
    for (let i = 1; i < pathWithCosts.length; i++) {
        const pathHex = getHex(pathWithCosts[i].q, pathWithCosts[i].r);
        if (pathHex && pathHex.unit && pathHex.unit.id !== currentUnit.id) break;
        if (pathWithCosts[i].totalCost <= maxCost) {
            lastReachableIndex = i;
        }
    }

    // Check if this is a multi-turn path
    const isMultiTurnPath = lastReachableIndex < pathWithCosts.length - 1;

    // Draw the future path (orange, dashed) - for multi-turn movement
    if (isMultiTurnPath && lastReachableIndex >= 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([8, 6]);
        ctx.beginPath();

        // Start from where reachable path ends
        const startPoint = pathWithCosts[lastReachableIndex];
        const startPos = hexToPixel(startPoint.q, startPoint.r, state.hexSize);
        ctx.moveTo(state.offsetX + startPos.x, state.offsetY + startPos.y);

        // Draw to final destination
        for (let i = lastReachableIndex + 1; i < pathWithCosts.length; i++) {
            const pathHex = getHex(pathWithCosts[i].q, pathWithCosts[i].r);
            if (pathHex && pathHex.unit && pathHex.unit.id !== currentUnit.id) break;
            const point = pathWithCosts[i];
            const pos = hexToPixel(point.q, point.r, state.hexSize);
            ctx.lineTo(state.offsetX + pos.x, state.offsetY + pos.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Draw final destination marker (orange)
        const finalPoint = pathWithCosts[pathWithCosts.length - 1];
        const finalPos = hexToPixel(finalPoint.q, finalPoint.r, state.hexSize);
        const finalSx = state.offsetX + finalPos.x;
        const finalSy = state.offsetY + finalPos.y;

        ctx.save();
        ctx.fillStyle = 'rgba(251, 146, 60, 0.3)';
        ctx.beginPath();
        ctx.arc(finalSx, finalSy, state.hexSize * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(251, 146, 60, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(finalSx, finalSy, state.hexSize * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Flag icon for future destination
        ctx.font = `${Math.round(state.hexSize * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚩', finalSx, finalSy);
        ctx.restore();
    }

    // Draw the reachable path line (green, solid)
    if (lastReachableIndex >= 1) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 3;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i <= lastReachableIndex; i++) {
            const point = pathWithCosts[i];
            const pos = hexToPixel(point.q, point.r, state.hexSize);
            const sx = state.offsetX + pos.x;
            const sy = state.offsetY + pos.y;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.restore();

        // Destination marker for this turn
        const endPoint = pathWithCosts[lastReachableIndex];
        const endPos = hexToPixel(endPoint.q, endPoint.r, state.hexSize);
        const endSx = state.offsetX + endPos.x;
        const endSy = state.offsetY + endPos.y;

        // Check if pending confirmation
        const isPending = state.pendingMoveDestination &&
            state.pendingMoveDestination.q === endPoint.q &&
            state.pendingMoveDestination.r === endPoint.r;

        if (isPending) {
            // Pulsing confirmation marker
            const pulse = 0.7 + Math.sin(Date.now() / 150) * 0.3;

            ctx.fillStyle = `rgba(34, 197, 94, ${0.2 * pulse})`;
            ctx.beginPath();
            ctx.arc(endSx, endSy, state.hexSize * 0.6 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Confirm button
            const btnSize = state.hexSize * 0.45;
            ctx.fillStyle = `rgba(22, 163, 74, ${0.85 + 0.15 * pulse})`;
            ctx.beginPath();
            ctx.arc(endSx, endSy, btnSize, 0, Math.PI * 2);
            ctx.fill();

            // Checkmark
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const s = btnSize * 0.4;
            ctx.moveTo(endSx - s * 0.5, endSy);
            ctx.lineTo(endSx - s * 0.1, endSy + s * 0.4);
            ctx.lineTo(endSx + s * 0.5, endSy - s * 0.4);
            ctx.stroke();

            // Cost badge - larger and more visible
            const cost = pathWithCosts[lastReachableIndex].totalCost;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.beginPath();
            ctx.roundRect(endSx - 26, endSy + btnSize + 6, 52, 24, 6);
            ctx.fill();
            // Border for visibility
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#4ade80';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`-${cost}⚡`, endSx, endSy + btnSize + 18);

            // Show multi-turn indicator if applicable
            if (isMultiTurnPath) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.beginPath();
                ctx.roundRect(endSx - 30, endSy - btnSize - 26, 60, 18, 4);
                ctx.fill();
                ctx.fillStyle = '#fb923c';
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText('📍 Mehr...', endSx, endSy - btnSize - 17);
            }
        } else {
            // Simple destination dot
            ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
            ctx.beginPath();
            ctx.arc(endSx, endSy, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // Draw queued path indicator for selected unit
    const queuedPath = getQueuedPath(currentUnit.id);
    if (queuedPath && queuedPath.path && !state.currentPath) {
        // Draw indicator showing there's a queued destination
        const targetPos = hexToPixel(queuedPath.targetQ, queuedPath.targetR, state.hexSize);
        const targetSx = state.offsetX + targetPos.x;
        const targetSy = state.offsetY + targetPos.y;

        ctx.save();
        const pulse = 0.6 + Math.sin(Date.now() / 300) * 0.4;
        ctx.fillStyle = `rgba(251, 146, 60, ${0.2 * pulse})`;
        ctx.beginPath();
        ctx.arc(targetSx, targetSy, state.hexSize * 0.5 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(targetSx, targetSy, state.hexSize * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `${Math.round(state.hexSize * 0.4)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚩', targetSx, targetSy);
        ctx.restore();
    }
}
