// ===== CANVAS RENDERING =====

import { CONFIG, TERRAIN, UNIT_CLASSES } from './config.js';
import { state, getHex, getCurrentUnit, getVisibleGhosts, getQueuedPath, getPlayerUnits, getRemainingMoveCapacity } from './state.js';
import { hexToPixel, hexDistance } from './hexMath.js';
import { getReachableHexes } from './pathfinding.js';
import { getAttackableUnits, getEffectiveRange, getBlockedTargets } from './units.js';
import { getFogLevel, isUnitVisible, isUnitVisibleToViewer, getEnemyCloakedVisibilityAlpha } from './fogOfWar.js';
import { initTextures, drawAPIndicator } from './assets.js';
import { getTexture, drawUnit as drawUnitSprite } from './assetLoader.js';
import { getPowerupAt, POWERUP_TYPES } from './powerups.js';
import { getCurrentEvent } from './events.js';
import { getRankName } from './progression.js';
import { updateParticles, drawParticles } from './particles.js';
import {
    animationTick,
    drawAnimatedGrass,
    drawAnimatedWater,
    drawShallowWater,
    drawWheatField,
    drawReeds,
    drawSnowfall,
    drawSnowDetails,
    drawIceReflections,
    drawFireflies,
    drawDustMotes,
    drawFallingLeaves,
    drawFlowers,
    drawHeather,
    drawRuins,
    drawGravel,
    drawFarmland,
    drawMud,
    drawTerrainBlend,
    getNeighborTerrains,
    getCharacterAnimState,
    setCharacterAnimation,
    CHAR_ANIM
} from './animations.js';
import { seededRandom } from './renderUtils.js';
import {
    initVegetationRenderer,
    drawTree2D5,
    drawBush2D5,
    drawSmallShrub,
    drawFlowerCluster
} from './renderVegetation.js';
import {
    initTerrainRenderer,
    drawRockFormation2D5,
    drawHillsDetails,
    drawRoadDetails,
    drawPathDetails,
    drawRiverDetails,
    drawForestFloor
} from './renderTerrain.js';

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
    const texture = fogLevel === 'visible' ? getTexture(hex.type) : null;

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

    // Add fog overlays
    if (fogLevel === 'explored') {
        drawExploredOverlay(tileCtx, cx, cy, hexSize);
    } else if (fogLevel === 'hidden') {
        drawHiddenOverlay(tileCtx, cx, cy, hexSize);
    }

    // Draw terrain details for visible/explored hexes
    if (fogLevel === 'visible' && shouldRenderDetails()) {
        drawTerrainDetailsToContext(tileCtx, cx, cy, hexSize, hex.type, hex.q, hex.r);
    } else if (fogLevel === 'explored' && shouldRenderDetails()) {
        tileCtx.save();
        tileCtx.globalAlpha = 0.3;
        drawTerrainDetailsToContext(tileCtx, cx, cy, hexSize, hex.type, hex.q, hex.r);
        tileCtx.restore();
    }

    return tileCanvas;
}

/**
 * Draw explored hex shadow overlay to a context
 */
function drawExploredOverlay(context, cx, cy, hexSize) {
    context.save();
    context.beginPath();
    drawHexPathToContext(context, cx, cy, hexSize);

    const shadowGradient = context.createLinearGradient(
        cx - hexSize * 0.5, cy - hexSize * 0.5,
        cx + hexSize * 0.5, cy + hexSize * 0.5
    );
    shadowGradient.addColorStop(0, 'rgba(15, 20, 35, 0.65)');
    shadowGradient.addColorStop(0.5, 'rgba(10, 15, 30, 0.55)');
    shadowGradient.addColorStop(1, 'rgba(5, 10, 25, 0.70)');
    context.fillStyle = shadowGradient;
    context.fill();

    const vignetteGradient = context.createRadialGradient(cx, cy, 0, cx, cy, hexSize);
    vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)');
    vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.20)');
    context.beginPath();
    drawHexPathToContext(context, cx, cy, hexSize);
    context.fillStyle = vignetteGradient;
    context.fill();

    context.restore();
}

/**
 * Draw hidden hex fog overlay to a context
 */
function drawHiddenOverlay(context, cx, cy, hexSize) {
    context.save();
    context.beginPath();
    drawHexPathToContext(context, cx, cy, hexSize);
    const fogGradient = context.createRadialGradient(cx, cy, 0, cx, cy, hexSize);
    fogGradient.addColorStop(0, 'rgba(5, 5, 15, 0.95)');
    fogGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
    context.fillStyle = fogGradient;
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

    if (terrain && terrain.colorLight && terrain.colorDark) {
        const gradient = context.createLinearGradient(cx - size * 0.7, cy - size * 0.7, cx + size * 0.7, cy + size * 0.7);
        gradient.addColorStop(0, terrain.colorLight);
        gradient.addColorStop(0.5, terrain.color);
        gradient.addColorStop(1, terrain.colorDark);
        context.fillStyle = gradient;
        context.fill();
    } else if (texture) {
        context.save();
        context.clip();
        const pattern = context.createPattern(texture, 'repeat');
        // Use hex coordinates for consistent pattern alignment
        pattern.setTransform(new DOMMatrix().translate(hexQ * 10, hexR * 10));
        context.fillStyle = pattern;
        context.fillRect(cx - size, cy - size, size * 2, size * 2);
        context.restore();

        context.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = cx + size * Math.cos(angle);
            const py = cy + size * Math.sin(angle);
            if (i === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
        }
        context.closePath();
    } else {
        context.fillStyle = fillColor;
        context.fill();
    }

    // Removed inner hex highlight for seamless terrain appearance
    // Grid overlay is now drawn separately only when needed

    if (strokeColor) {
        context.strokeStyle = strokeColor;
        context.lineWidth = lineWidth;
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
 * Draw a subtle terrain-colored shimmer for enemy cloaked units
 * This makes them visible if you look carefully, but camouflaged with the terrain
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {number} size - Unit size
 * @param {Object} unit - The cloaked unit
 */
function drawCamouflageShimmer(cx, cy, size, unit) {
    // Get terrain at unit's position
    const hex = getHex(unit.q, unit.r);
    if (!hex) return;

    const terrainData = TERRAIN[hex.type];
    const baseColor = terrainData?.color || '#2d5a40';

    // Parse base color
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Create a subtle shimmer effect using animated noise
    const time = Date.now() * 0.002;
    const shimmerIntensity = 0.15 + Math.sin(time + unit.q * 0.5 + unit.r * 0.7) * 0.05;

    ctx.save();

    // Draw a subtle distortion/heat-wave effect
    // Base camouflage shape (humanoid silhouette)
    ctx.globalAlpha = shimmerIntensity;

    // Create gradient that matches terrain
    const shimmerGrad = ctx.createRadialGradient(
        cx, cy - size * 0.3, 0,
        cx, cy, size * 0.8
    );
    shimmerGrad.addColorStop(0, `rgba(${r + 30}, ${g + 30}, ${b + 30}, 0.3)`);
    shimmerGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.15)`);
    shimmerGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = shimmerGrad;

    // Draw subtle humanoid shape
    ctx.beginPath();
    // Head
    ctx.arc(cx, cy - size * 0.5, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Body (oval)
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.25, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Add subtle shimmer lines (like heat distortion)
    ctx.strokeStyle = `rgba(${r + 40}, ${g + 40}, ${b + 40}, ${shimmerIntensity * 0.5})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const offsetY = (i - 1) * size * 0.3;
        const wave = Math.sin(time * 2 + i) * size * 0.05;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.2 + wave, cy + offsetY);
        ctx.quadraticCurveTo(cx + wave * 2, cy + offsetY - size * 0.1, cx + size * 0.2 + wave, cy + offsetY);
        ctx.stroke();
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

export function initRenderer() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // Initialize sub-renderers with canvas context
    initVegetationRenderer(ctx);
    initTerrainRenderer(ctx);

    // Initialize textures once
    if (!texturesInitialized) {
        initTextures();
        texturesInitialized = true;
    }

    resizeCanvas();

    // Start continuous animation loop for smooth animations
    if (!animationLoopRunning) {
        animationLoopRunning = true;
        startAnimationLoop();
    }
}

/**
 * Continuous animation loop for smooth particle/vegetation animations
 */
function startAnimationLoop() {
    function loop() {
        // Only render if game is active (not in menu)
        if (state.screen === null && state.hexes.length > 0) {
            render();
        }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
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
    let hexSize = Math.min(availableWidth / gridWidth, availableHeight / gridHeight);

    // Clamp to reasonable range - larger minimum for better visuals
    const baseSize = Math.max(30, Math.min(65, hexSize));

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

    // Fill with gradient for 3D effect
    if (terrain && terrain.colorLight && terrain.colorDark) {
        const gradient = ctx.createLinearGradient(cx - size * 0.7, cy - size * 0.7, cx + size * 0.7, cy + size * 0.7);
        gradient.addColorStop(0, terrain.colorLight);
        gradient.addColorStop(0.5, terrain.color);
        gradient.addColorStop(1, terrain.colorDark);
        ctx.fillStyle = gradient;
        ctx.fill();
    } else if (texture) {
        ctx.save();
        ctx.clip();
        const pattern = ctx.createPattern(texture, 'repeat');
        // Anchor pattern to world coordinates so it doesn't slide when scrolling
        pattern.setTransform(new DOMMatrix().translate(state.offsetX, state.offsetY));
        ctx.fillStyle = pattern;
        ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
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
    } else {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }

    // Removed inner hex highlight for seamless terrain appearance
    // Grid overlay is now drawn separately only when needed

    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

/**
 * Collect foreground elements (trees, large rocks) for 2.5D depth sorting
 * Returns array of objects with draw function and y-position
 */
function collectForegroundElements(cx, cy, size, type, hexQ, hexR) {
    const elements = [];
    const s = size * 0.45;
    const baseSeed = hexQ * 127 + hexR * 311 + hexQ * hexR * 7;

    if (type === 'forest' || type === 'pine') {
        // Trees are foreground elements - make them bigger for 2.5D effect
        const treeCount = 1 + Math.abs(baseSeed % 2);
        for (let i = 0; i < treeCount; i++) {
            const tx = cx + (seededRandom(baseSeed + i * 10) - 0.5) * s * 0.6;
            const ty = cy + (seededRandom(baseSeed + i * 10 + 5) - 0.5) * s * 0.4;
            // Make trees 2x bigger for proper 2.5D effect
            const treeSize = s * (1.4 + seededRandom(baseSeed + i * 10 + 2) * 0.6);
            // Pine terrain uses mostly pine trees (type 0), forest uses all types
            const treeType = type === 'pine' ? 0 : Math.floor(seededRandom(baseSeed + i * 10 + 3) * 5);

            elements.push({
                type: 'tree',
                x: tx,
                y: ty,
                // Sort by base of tree (where it touches ground)
                sortY: ty + treeSize * 0.5,
                draw: () => drawTree2D5(tx, ty, treeSize, treeType, baseSeed + i)
            });
        }

        // Add small shrubs/undergrowth around the trees
        const shrubChance = seededRandom(baseSeed + 100);
        if (shrubChance > 0.4) {
            const shrubX = cx + (seededRandom(baseSeed + 101) - 0.5) * s * 1.2;
            const shrubY = cy + (seededRandom(baseSeed + 102) - 0.5) * s * 0.8;
            const shrubSize = s * (0.5 + seededRandom(baseSeed + 103) * 0.3);

            elements.push({
                type: 'shrub',
                x: shrubX,
                y: shrubY,
                sortY: shrubY + shrubSize * 0.2,
                draw: () => drawSmallShrub(shrubX, shrubY, shrubSize, baseSeed + 104)
            });
        }
    } else if (type === 'grass' || type === 'clearing' || type === 'flowers' || type === 'heather') {
        // Large bushes on grass are foreground elements
        const grassType = Math.abs(baseSeed) % 100;
        if (grassType < 15) {
            const bushSize = s * 0.8;
            elements.push({
                type: 'bush',
                x: cx,
                y: cy,
                sortY: cy + bushSize * 0.3,
                draw: () => drawBush2D5(cx, cy, bushSize, baseSeed)
            });
        }
    } else if (type === 'rock' || type === 'cliff') {
        // Rock formations are foreground elements - make them much bigger for proper cover
        elements.push({
            type: 'rock',
            x: cx,
            y: cy,
            sortY: cy + s * 0.5,
            draw: () => drawRockFormation2D5(cx, cy, s * 2.2, baseSeed)
        });
    } else if (type === 'ruins') {
        // Ruins have some rock formations
        if (seededRandom(baseSeed) > 0.5) {
            elements.push({
                type: 'rock',
                x: cx,
                y: cy,
                sortY: cy + s * 0.3,
                draw: () => drawRockFormation2D5(cx, cy, s * 1.5, baseSeed)
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
            break;

        case 'forest':
            drawForestFloor(cx, cy, s, baseSeed);
            // Static leaf scatter
            drawStaticLeafScatter(cx, cy, size, baseSeed);
            break;

        case 'rock':
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy + s * 0.3, s * 0.7, s * 0.25, 0, 0, Math.PI * 2);
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
 * Draw static grass blades - cached, unique per hex
 */
function drawStaticGrassBlades(cx, cy, hexSize, seed, grassType) {
    const bladeCount = 60;

    // Color settings based on grass type
    let baseR = 30, baseG = 100, baseB = 35;
    let heightMult = 1;

    if (grassType === 'tallgrass') {
        heightMult = 1.8;
        baseG = 90;
    } else if (grassType === 'clearing') {
        baseG = 120;
        baseB = 45;
    } else if (grassType === 'heather') {
        baseR = 90;
        baseG = 60;
        baseB = 90;
    } else if (grassType === 'moss') {
        baseR = 40;
        baseG = 80;
        baseB = 45;
    }

    for (let i = 0; i < bladeCount; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);
        const rand3 = seededRandom(seed + i * 3 + 2);

        // Position within hex
        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * hexSize * 0.75;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        // Blade properties
        const height = (4 + rand3 * 10) * heightMult;
        const thickness = 0.4 + rand3 * 0.8;

        // Frozen sway position (based on seed, not time)
        const swayAmount = (rand1 - 0.5) * 6;

        // Color variation
        const r = Math.floor(baseR + rand2 * 30);
        const g = Math.floor(baseG + rand2 * 40);
        const b = Math.floor(baseB + rand2 * 20);

        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(x, y);
        const tipX = x + swayAmount;
        const tipY = y - height;
        const cpX = x + swayAmount * 0.5;
        const cpY = y - height * 0.6;
        ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
        ctx.stroke();
    }
}

/**
 * Draw static water surface details - no animation, unique per hex
 */
function drawStaticWaterSurface(cx, cy, hexSize, seed, isDeep = false) {
    // Static wave lines
    ctx.strokeStyle = `rgba(120, 180, 220, 0.15)`;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < 4; i++) {
        const yOffset = (seededRandom(seed + i * 10) - 0.5) * hexSize;
        const wavePhase = seededRandom(seed + i * 20) * Math.PI * 2;

        ctx.beginPath();
        for (let x = -hexSize * 0.8; x <= hexSize * 0.8; x += 4) {
            const waveY = cy + yOffset + Math.sin(x / 15 + wavePhase) * 3;
            if (x === -hexSize * 0.8) {
                ctx.moveTo(cx + x, waveY);
            } else {
                ctx.lineTo(cx + x, waveY);
            }
        }
        ctx.stroke();
    }

    // Static sparkle positions
    const sparkleCount = isDeep ? 2 : 5;
    for (let i = 0; i < sparkleCount; i++) {
        const sparkleVisible = seededRandom(seed + i * 100) > 0.6;
        if (sparkleVisible) {
            const sx = cx + (seededRandom(seed + i * 7) - 0.5) * hexSize * 1.2;
            const sy = cy + (seededRandom(seed + i * 11) - 0.5) * hexSize * 1.2;
            const sparkleSize = 1 + seededRandom(seed + i * 13) * 2;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
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
 * Draw static leaf scatter for forest
 */
function drawStaticLeafScatter(cx, cy, hexSize, seed) {
    const leafCount = 8;
    const colors = ['#8B4513', '#D2691E', '#228B22', '#6B8E23'];

    for (let i = 0; i < leafCount; i++) {
        const x = cx + (seededRandom(seed + i * 5) - 0.5) * hexSize * 1.4;
        const y = cy + (seededRandom(seed + i * 5 + 1) - 0.5) * hexSize * 1.4;
        const size = 2 + seededRandom(seed + i * 5 + 2) * 2;
        const rotation = seededRandom(seed + i * 5 + 3) * Math.PI * 2;
        const colorIdx = Math.floor(seededRandom(seed + i * 5 + 4) * colors.length);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.fillStyle = colors[colorIdx];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Draw static dust motes for sand
 */
function drawStaticDustMotes(cx, cy, hexSize, seed) {
    for (let i = 0; i < 10; i++) {
        const visible = seededRandom(seed + i * 50) > 0.5;
        if (visible) {
            const mx = cx + (seededRandom(seed + i * 6) - 0.5) * hexSize * 1.4;
            const my = cy + (seededRandom(seed + i * 6 + 1) - 0.5) * hexSize * 1.4;
            const moteSize = 0.5 + seededRandom(seed + i * 6 + 2) * 1;

            ctx.fillStyle = 'rgba(200, 180, 140, 0.3)';
            ctx.beginPath();
            ctx.arc(mx, my, moteSize, 0, Math.PI * 2);
            ctx.fill();
        }
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
 * Draw static reeds
 */
function drawStaticReeds(cx, cy, hexSize, seed) {
    const reedCount = 25;

    for (let i = 0; i < reedCount; i++) {
        const rand1 = seededRandom(seed + i * 4);
        const rand2 = seededRandom(seed + i * 4 + 1);
        const rand3 = seededRandom(seed + i * 4 + 2);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * hexSize * 0.7;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        const height = 18 + rand3 * 12;
        const sway = (rand1 - 0.5) * 6;

        // Reed stalk
        ctx.strokeStyle = `rgb(${70 + rand3 * 20}, ${90 + rand3 * 20}, ${50 + rand3 * 15})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + sway * 0.3, y - height * 0.7, x + sway, y - height);
        ctx.stroke();

        // Reed head
        if (rand3 > 0.3) {
            ctx.fillStyle = `rgba(${150 + rand3 * 30}, ${130 + rand3 * 30}, ${100 + rand3 * 20}, 0.8)`;
            ctx.beginPath();
            ctx.ellipse(x + sway, y - height - 4, 2.5, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/**
 * Draw static flowers
 */
function drawStaticFlowers(cx, cy, hexSize, seed) {
    const flowerCount = 15;
    const colors = ['#ff6b6b', '#ffd93d', '#ffffff', '#ff9ecd', '#b19cd9'];

    for (let i = 0; i < flowerCount; i++) {
        const angle = seededRandom(seed + i) * Math.PI * 2;
        const dist = seededRandom(seed + i + 50) * hexSize * 0.65;
        const fx = cx + Math.cos(angle) * dist;
        const fy = cy + Math.sin(angle) * dist;

        const colorIdx = Math.floor(seededRandom(seed + i + 100) * colors.length);
        const size = 1.5 + seededRandom(seed + i + 150) * 2.5;
        const sway = (seededRandom(seed + i + 200) - 0.5) * 3;

        // Stem
        ctx.strokeStyle = '#2d6a2d';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(fx, fy + 3);
        ctx.quadraticCurveTo(fx + sway * 0.3, fy, fx + sway * 0.5, fy - 4);
        ctx.stroke();

        // Petals
        ctx.fillStyle = colors[colorIdx];
        for (let p = 0; p < 5; p++) {
            const petalAngle = (p / 5) * Math.PI * 2;
            const px = fx + Math.cos(petalAngle) * size + sway * 0.4;
            const py = fy - 4 + Math.sin(petalAngle) * size;

            ctx.beginPath();
            ctx.ellipse(px, py, size * 0.5, size * 0.25, petalAngle, 0, Math.PI * 2);
            ctx.fill();
        }

        // Center
        ctx.fillStyle = '#ffdd00';
        ctx.beginPath();
        ctx.arc(fx + sway * 0.4, fy - 4, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw static wheat field
 */
function drawStaticWheatField(cx, cy, hexSize, seed) {
    const stalkCount = 50;

    for (let i = 0; i < stalkCount; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);
        const rand3 = seededRandom(seed + i * 3 + 2);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * hexSize * 0.7;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        const height = 12 + rand3 * 8;
        const sway = (rand1 - 0.5) * 5;

        // Stalk
        const goldenColor = `rgb(${180 + rand3 * 40}, ${150 + rand3 * 30}, ${70 + rand3 * 20})`;
        ctx.strokeStyle = goldenColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + sway * 0.5, y - height * 0.6, x + sway, y - height);
        ctx.stroke();

        // Wheat head
        ctx.fillStyle = `rgb(${200 + rand3 * 30}, ${170 + rand3 * 30}, ${80 + rand3 * 20})`;
        ctx.beginPath();
        ctx.ellipse(x + sway, y - height - 3, 2, 4, sway * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw static heather
 */
function drawStaticHeather(cx, cy, hexSize, seed) {
    for (let i = 0; i < 30; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * hexSize * 0.7;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        const sway = (rand1 - 0.5) * 2;

        ctx.fillStyle = `rgb(${140 + rand2 * 50}, ${80 + rand2 * 40}, ${140 + rand2 * 50})`;
        ctx.beginPath();
        ctx.arc(x + sway, y, 1 + rand2, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw water details
 */
function drawWaterDetails(cx, cy, s, seed) {
    // Wave patterns
    ctx.strokeStyle = 'rgba(150, 210, 255, 0.4)';
    ctx.lineWidth = 2;

    for (let i = 0; i < 4; i++) {
        const yOff = (i - 1.5) * s * 0.3;
        const phase = seededRandom(seed + i) * Math.PI * 2;

        ctx.beginPath();
        ctx.moveTo(cx - s * 0.8, cy + yOff);
        for (let x = -0.8; x <= 0.8; x += 0.2) {
            const waveY = cy + yOff + Math.sin(x * 3 + phase) * s * 0.08;
            ctx.lineTo(cx + x * s, waveY);
        }
        ctx.stroke();
    }

    // Light reflections/sparkles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 5; i++) {
        const rx = cx + (seededRandom(seed + i * 31) - 0.5) * s * 1.4;
        const ry = cy + (seededRandom(seed + i * 31 + 1) - 0.5) * s * 1.1;
        const rSize = 1 + seededRandom(seed + i * 31 + 2) * 2;

        ctx.beginPath();
        ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // Lily pad (rare)
    if (seededRandom(seed + 500) > 0.7) {
        const lx = cx + (seededRandom(seed + 501) - 0.5) * s * 0.6;
        const ly = cy + (seededRandom(seed + 502) - 0.5) * s * 0.5;

        ctx.fillStyle = '#2d7a4a';
        ctx.beginPath();
        ctx.ellipse(lx, ly, s * 0.18, s * 0.12, 0, 0.1, Math.PI * 1.9);
        ctx.fill();

        // Flower on lily pad
        if (seededRandom(seed + 503) > 0.5) {
            ctx.fillStyle = '#ff9ff3';
            ctx.beginPath();
            ctx.arc(lx, ly - 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/**
 * Draw sand details
 */
function drawSandDetails(cx, cy, s, seed) {
    // Sand ripples
    ctx.strokeStyle = 'rgba(180, 150, 100, 0.25)';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < 3; i++) {
        const yOff = (i - 1) * s * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.9, cy + yOff);
        ctx.bezierCurveTo(
            cx - s * 0.3, cy + yOff - s * 0.15,
            cx + s * 0.3, cy + yOff + s * 0.1,
            cx + s * 0.9, cy + yOff - s * 0.05
        );
        ctx.stroke();
    }

    // Pebbles and shells
    for (let i = 0; i < 6; i++) {
        const px = cx + (seededRandom(seed + i * 37) - 0.5) * s * 1.5;
        const py = cy + (seededRandom(seed + i * 37 + 1) - 0.5) * s * 1.2;
        const pSize = 1.5 + seededRandom(seed + i * 37 + 2) * 2;

        if (seededRandom(seed + i * 37 + 3) > 0.7) {
            // Shell
            ctx.fillStyle = '#f5e6d3';
            ctx.beginPath();
            ctx.ellipse(px, py, pSize * 1.2, pSize * 0.8, seededRandom(seed + i) * Math.PI, 0, Math.PI);
            ctx.fill();
        } else {
            // Pebble
            const grayVal = 100 + seededRandom(seed + i * 37 + 4) * 50;
            ctx.fillStyle = `rgb(${grayVal}, ${grayVal - 10}, ${grayVal - 20})`;
            ctx.beginPath();
            ctx.ellipse(px, py, pSize, pSize * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Sparse grass tuft
    if (seededRandom(seed + 600) > 0.7) {
        const gx = cx + (seededRandom(seed + 601) - 0.5) * s * 0.8;
        const gy = cy + (seededRandom(seed + 602) - 0.5) * s * 0.6;

        ctx.strokeStyle = '#7a9a60';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(gx + (i - 1) * 3, gy);
            ctx.lineTo(gx + (i - 1) * 4, gy - 8 - seededRandom(seed + 603 + i) * 4);
            ctx.stroke();
        }
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

    // Draw terrain camouflage shimmer for enemy cloaked units not in detection range
    if (isCamouflagedEnemy) {
        drawCamouflageShimmer(cx, cy, size, unit);
        ctx.restore();
        return; // Don't draw the actual unit sprite
    }

    // Selection glow effect
    if (isSelected) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;

        // Pulsing selection ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, size + 8, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.7, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Draw the human sprite (uses static asset if available, otherwise runtime)
    drawUnitSprite(ctx, cx, cy - size * 0.15, size * 1.3, playerColor, unit.class, isSelected, unit.player);

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
        ctx.globalAlpha = 1;  // Reset for indicators
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.font = `${Math.round(size * 0.5)}px sans-serif`;
        ctx.fillText('🛡️', cx, cy - size - 5);
        ctx.shadowBlur = 0;
    }

    // Hiding/Cover indicator - unit is in cover
    if (unit.hiding) {
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 12;
        ctx.font = `${Math.round(size * 0.45)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌲', cx - size * 0.5, cy - size - 5);
        ctx.shadowBlur = 0;

        // Draw speech bubble for cover status (only for current player's units)
        if (unit.player === state.currentPlayer) {
            drawSpeechBubble(ctx, cx + size * 0.8, cy - size * 1.2, 'In Deckung', '#22c55e', size);
        }

        // Draw cover effect around unit
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, size + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
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

    // Enemy cloaked unit detected - show shimmer/distortion indicator
    if (unit.cloaked && unit.player !== state.viewingPlayer) {
        ctx.globalAlpha = 0.8;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 10;

        // Pulsing detection indicator
        const pulse = 0.7 + Math.sin(Date.now() / 300) * 0.3;
        ctx.strokeStyle = `rgba(168, 85, 247, ${pulse * 0.6})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, size + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    }

    // Revealed after attack indicator - enemy can see unit was here
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

    // "Spotted!" indicator - shown when enemy unit can be seen (for own units that might be detected)
    if (unit.spotted && unit.player === state.currentPlayer) {
        ctx.globalAlpha = 1;
        drawSpeechBubble(ctx, cx + size * 0.8, cy - size * 1.4, 'Entdeckt!', '#ef4444', size);
    }

    // HP bar with gradient
    const hpPct = unit.currentHp / unit.maxHp;
    const barWidth = size * 1.6;
    const barHeight = 8;
    const barY = cy + size * 0.65;

    // Bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(cx - barWidth / 2 - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
    ctx.fill();

    // HP bar fill with gradient
    let barGradient = ctx.createLinearGradient(cx - barWidth / 2, barY, cx - barWidth / 2 + barWidth * hpPct, barY);
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

    // Movement capacity indicator below HP bar (for selected unit)
    if (isSelected) {
        const remainingMove = getRemainingMoveCapacity(unit);
        drawAPIndicator(ctx, cx, barY + barHeight + 16, remainingMove, unit.move, 14);
    }

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
 * Check if hex grid should be visible
 * Only show when planning movement or attacking
 */
function shouldShowHexGrid() {
    const currentUnit = getCurrentUnit();
    if (!currentUnit) return false;

    // Show grid when we have reachable hexes (movement mode) or targeting (attack mode)
    return state.selectedAction === 'move' ||
           state.selectedAction === 'attack' ||
           state.currentPath !== null ||
           state.pendingMoveDestination !== null;
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

        // Draw subtle grid lines based on fog level
        ctx.beginPath();
        drawHexPath(sx, sy, state.hexSize);

        if (fogLevel === 'visible') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        } else if (fogLevel === 'explored') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        } else {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        }
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    ctx.restore();
}

/**
 * Main render function
 */
export function render() {
    if (!canvas || !ctx) return;

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

    const currentUnit = getCurrentUnit();
    // Always show reachable hexes when a unit is selected (point-and-click system)
    const reachableHexes = currentUnit ? getReachableHexes(currentUnit) : new Map();
    const attackableUnits = currentUnit ? getAttackableUnits(currentUnit) : [];
    const blockedTargets = currentUnit ? getBlockedTargets(currentUnit) : [];

    // Only show hex grid borders when planning movement or attacking
    const showGrid = shouldShowHexGrid();

    // Get max move cost for path visualization (consistent with getReachableHexes)
    const maxMoveCost = currentUnit ? Math.min(currentUnit.ap, currentUnit.move) : 0;

    // Collect all foreground elements for 2.5D depth sorting
    const foregroundElements = [];

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
            // Fallback: draw directly (low quality mode or cache miss)
            let fillColor = terrain.color;
            const texture = fogLevel === 'visible' ? getTexture(hex.type) : null;

            if (fogLevel === 'hidden') {
                fillColor = '#000000';
            } else if (fogLevel === 'explored') {
                fillColor = desaturateAndDarken(terrain.color, 0.5, 0.75);
            }

            // Only show grid lines when in movement/attack mode
            const strokeColor = showGrid ?
                (fogLevel === 'visible' ? 'rgba(255,255,255,0.12)' :
                (fogLevel === 'explored' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)')) : null;
            const terrainData = fogLevel === 'visible' ? terrain : null;
            drawHex(sx, sy, state.hexSize, fillColor, strokeColor, 1, texture, terrainData);

            // Fog overlays for non-cached rendering
            if (fogLevel === 'explored') {
                ctx.save();
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize);
                const shadowGradient = ctx.createLinearGradient(
                    sx - state.hexSize * 0.5, sy - state.hexSize * 0.5,
                    sx + state.hexSize * 0.5, sy + state.hexSize * 0.5
                );
                shadowGradient.addColorStop(0, 'rgba(15, 20, 35, 0.65)');
                shadowGradient.addColorStop(0.5, 'rgba(10, 15, 30, 0.55)');
                shadowGradient.addColorStop(1, 'rgba(5, 10, 25, 0.70)');
                ctx.fillStyle = shadowGradient;
                ctx.fill();
                ctx.restore();
            } else if (fogLevel === 'hidden') {
                ctx.save();
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize);
                const fogGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, state.hexSize);
                fogGradient.addColorStop(0, 'rgba(5, 5, 15, 0.95)');
                fogGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
                ctx.fillStyle = fogGradient;
                ctx.fill();
                ctx.restore();
            }
        }

        // Collect foreground elements for 2.5D sorting (always needed for depth sorting)
        if (fogLevel === 'visible' && shouldRenderForeground()) {
            const elements = collectForegroundElements(sx, sy, state.hexSize, hex.type, hex.q, hex.r);
            foregroundElements.push(...elements);
        }

        // Draw power-up if present
        if (fogLevel === 'visible') {
            const powerup = getPowerupAt(hex.q, hex.r);
            if (powerup) {
                drawPowerup(sx, sy, powerup, state.hexSize);
            }
        }

        // Highlight reachable hexes for movement - simple green overlay (point-and-click system)
        if (reachableHexes.size > 0 && fogLevel === 'visible') {
            const hexKey = `${hex.q},${hex.r}`;
            const pathData = reachableHexes.get(hexKey);
            if (pathData && !hex.unit) {
                // Check if this hex offers cover
                const hexTerrain = TERRAIN[hex.type];
                const offersCover = hexTerrain && hexTerrain.canHide;

                // Draw simple movement range highlight (green, or darker green for cover)
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize * 0.85);
                ctx.fillStyle = offersCover ? 'rgba(16, 185, 129, 0.25)' : 'rgba(34, 197, 94, 0.15)';
                ctx.fill();

                // Subtle border with cost indicator for high-cost terrain
                ctx.strokeStyle = offersCover ? 'rgba(16, 185, 129, 0.6)' : 'rgba(34, 197, 94, 0.4)';
                ctx.lineWidth = offersCover ? 2 : 1.5;
                ctx.stroke();

                // Show cover icon for hexes that offer hiding
                if (offersCover) {
                    ctx.font = `${Math.round(state.hexSize * 0.35)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🛡️', sx, sy - state.hexSize * 0.25);
                }

                // Show movement cost on each hex for better clarity
                if (pathData.cost > 0) {
                    ctx.fillStyle = offersCover ? 'rgba(16, 185, 129, 0.9)' : 'rgba(34, 197, 94, 0.9)';
                    ctx.font = `bold ${Math.round(state.hexSize * 0.25)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${pathData.cost}`, sx, sy + state.hexSize * 0.5);
                }
            }
        }
    });

    // Draw hex grid overlay only when planning movement or attack
    if (showGrid) {
        drawHexGridOverlay(w, h, reachableHexes, attackableUnits, currentUnit);
    }

    // Draw path preview - clean simple path line with destination marker (point-and-click system)
    if (state.currentPath && state.currentPath.length >= 2 && currentUnit) {
        // Use the lesser of AP or move stat (consistent with movement calculation)
        const maxCost = Math.min(currentUnit.ap, currentUnit.move);

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

                // Cost badge
                const cost = pathWithCosts[lastReachableIndex].totalCost;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.beginPath();
                ctx.roundRect(endSx - 18, endSy + btnSize + 8, 36, 18, 4);
                ctx.fill();
                ctx.fillStyle = '#22c55e';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`-${cost}⚡`, endSx, endSy + btnSize + 17);

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
    }

    // Draw queued path indicator for selected unit
    if (currentUnit) {
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
            sortY: sy + state.hexSize * 0.4, // Sort by feet position
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

    // Update and draw particles
    updateParticles();
    drawParticles(ctx, state.offsetX, state.offsetY);

    // Draw attack range indicator when targeting an enemy
    if (currentUnit && state.targetedUnit) {
        const pos = hexToPixel(currentUnit.q, currentUnit.r, state.hexSize);
        const sx = state.offsetX + pos.x;
        const sy = state.offsetY + pos.y;
        const rangeRadius = getEffectiveRange(currentUnit) * state.hexSize * 1.75;

        // Gradient range circle
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 3;
        ctx.setLineDash([15, 8]);
        ctx.beginPath();
        ctx.arc(sx, sy, rangeRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Inner glow
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(sx, sy, rangeRadius - 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw scroll hint if map is larger than viewport
    drawScrollHint(w, h);

    // Draw event indicator
    drawEventIndicator(w, h);

    // Draw zoom indicator
    drawZoomIndicator(w, h);
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
