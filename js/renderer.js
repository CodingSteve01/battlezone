// ===== CANVAS RENDERING =====

import { CONFIG, TERRAIN, UNIT_CLASSES } from './config.js';
import { state, getHex, getCurrentUnit, getVisibleGhosts, getQueuedPath, getPlayerUnits, getRemainingMoveCapacity } from './state.js';
import { hexToPixel, hexDistance } from './hexMath.js';
import { getReachableHexes } from './pathfinding.js';
import { getAttackableUnits, getEffectiveRange, getBlockedTargets } from './units.js';
import { getFogLevel, isUnitVisible, isUnitVisibleToViewer, getEnemyCloakedVisibilityAlpha } from './fogOfWar.js';
import { initTextures, getTexture, drawHumanSprite, drawAPIndicator } from './assets.js';
import { getPowerupAt, POWERUP_TYPES } from './powerups.js';
import { getCurrentEvent } from './events.js';
import { getRankName } from './progression.js';

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
 * Maximum number of cached tiles to prevent memory issues
 */
const MAX_CACHE_SIZE = 1000;

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
 * @param {Object} hex - The hex object
 * @param {string} fogLevel - 'visible', 'explored', or 'hidden'
 * @param {number} hexSize - Current hex size for rendering
 * @returns {HTMLCanvasElement|null} Cached canvas or null if caching disabled
 */
function getCachedHexTile(hex, fogLevel, hexSize) {
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

    const cacheKey = `${hex.q},${hex.r}_${fogLevel}_${state.effectiveQuality}_${Math.round(hexSize)}`;

    if (hexTileCache.has(cacheKey)) {
        return hexTileCache.get(cacheKey);
    }

    // Enforce cache size limit using LRU-style eviction
    if (hexTileCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entries (first 20% of cache)
        const keysToRemove = Array.from(hexTileCache.keys()).slice(0, MAX_CACHE_SIZE / 5);
        keysToRemove.forEach(key => hexTileCache.delete(key));
    }

    // Create new cached tile
    const tileCanvas = createHexTileCanvas(hex, fogLevel, hexSize);
    hexTileCache.set(cacheKey, tileCanvas);

    return tileCanvas;
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

    // Draw hex with texture
    const strokeColor = fogLevel === 'visible' ? 'rgba(255,255,255,0.12)' :
        (fogLevel === 'explored' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)');
    const terrainData = fogLevel === 'visible' ? terrain : null;

    drawHexToContext(tileCtx, cx, cy, hexSize * 0.95, fillColor, strokeColor, 1, texture, terrainData, hex.q, hex.r);

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
    drawHexPathToContext(context, cx, cy, hexSize * 0.95);

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
    drawHexPathToContext(context, cx, cy, hexSize * 0.95);
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
    drawHexPathToContext(context, cx, cy, hexSize * 0.95);
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

    if (terrain) {
        context.save();
        context.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = cx + size * 0.85 * Math.cos(angle);
            const py = cy + size * 0.85 * Math.sin(angle);
            if (i === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
        }
        context.closePath();
        context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        context.lineWidth = 1.5;
        context.stroke();
        context.restore();
    }

    if (strokeColor) {
        context.strokeStyle = strokeColor;
        context.lineWidth = lineWidth;
        context.stroke();
    }
}

/**
 * Draw terrain details to a specific context (for caching)
 * This is a wrapper that temporarily swaps the global ctx
 */
function drawTerrainDetailsToContext(context, cx, cy, size, type, hexQ, hexR) {
    const originalCtx = ctx;
    ctx = context;
    drawTerrainDetails(cx, cy, size, type, hexQ, hexR);
    ctx = originalCtx;
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
export function initRenderer() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // Initialize textures once
    if (!texturesInitialized) {
        initTextures();
        texturesInitialized = true;
    }

    resizeCanvas();
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

    // Inner highlight for depth - hexagon shape
    if (terrain) {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = cx + size * 0.85 * Math.cos(angle);
            const py = cy + size * 0.85 * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

/**
 * Seeded random number generator for consistent decorations
 */
function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

/**
 * Collect foreground elements (trees, large rocks) for 2.5D depth sorting
 * Returns array of objects with draw function and y-position
 */
function collectForegroundElements(cx, cy, size, type, hexQ, hexR) {
    const elements = [];
    const s = size * 0.45;
    const baseSeed = hexQ * 127 + hexR * 311 + hexQ * hexR * 7;

    if (type === 'forest') {
        // Trees are foreground elements - make them bigger for 2.5D effect
        const treeCount = 1 + Math.abs(baseSeed % 2);
        for (let i = 0; i < treeCount; i++) {
            const tx = cx + (seededRandom(baseSeed + i * 10) - 0.5) * s * 0.6;
            const ty = cy + (seededRandom(baseSeed + i * 10 + 5) - 0.5) * s * 0.4;
            // Make trees 2x bigger for proper 2.5D effect
            const treeSize = s * (1.4 + seededRandom(baseSeed + i * 10 + 2) * 0.6);
            // Now includes 5 tree types: 0=pine, 1=round, 2=birch, 3=willow, 4=oak
            const treeType = Math.floor(seededRandom(baseSeed + i * 10 + 3) * 5);

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
    } else if (type === 'grass') {
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
    } else if (type === 'rock') {
        // Rock formations are foreground elements - make them much bigger for proper cover
        elements.push({
            type: 'rock',
            x: cx,
            y: cy,
            sortY: cy + s * 0.5,
            draw: () => drawRockFormation2D5(cx, cy, s * 2.2, baseSeed)
        });
    }

    return elements;
}

/**
 * Draw enhanced terrain pattern on a hex - optimized for performance
 * Now only draws ground-level details, foreground elements are collected separately
 */
function drawTerrainDetails(cx, cy, size, type, hexQ = 0, hexR = 0) {
    const s = size * 0.45;
    ctx.save();

    // Create consistent seed for this hex
    const baseSeed = hexQ * 127 + hexR * 311 + hexQ * hexR * 7;

    switch (type) {
        case 'grass':
            // Draw ground-level grass blades
            drawGrassBlades(cx, cy, s, baseSeed);

            // Small flowers stay on ground level
            const grassType = Math.abs(baseSeed) % 100;
            if (grassType >= 15 && grassType < 30) {
                drawFlowerCluster(cx, cy, s, baseSeed);
            }
            break;

        case 'forest':
            // Draw forest floor (leaves, small plants) - trees are drawn as foreground
            drawForestFloor(cx, cy, s, baseSeed);
            break;

        case 'rock':
            // Ground shadow for rocks - actual rocks are foreground
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy + s * 0.3, s * 0.7, s * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'water':
            drawWaterDetails(cx, cy, s, baseSeed);
            break;

        case 'sand':
            drawSandDetails(cx, cy, s, baseSeed);
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
            break;
    }

    ctx.restore();
}

/**
 * Draw a tree with 2.5D depth effect - larger and more detailed
 */
function drawTree2D5(x, y, size, treeType, seed) {
    ctx.save();

    // Ground shadow - larger and more visible
    ctx.fillStyle = 'rgba(0, 20, 10, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.55, size * 0.5, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk - thicker for bigger trees
    ctx.fillStyle = '#3d2817';
    const trunkWidth = size * 0.15;
    const trunkHeight = size * 0.5;
    ctx.fillRect(x - trunkWidth / 2, y, trunkWidth, trunkHeight);

    // Trunk detail/bark
    ctx.strokeStyle = '#2a1a0f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - trunkWidth * 0.25, y + size * 0.1);
    ctx.lineTo(x - trunkWidth * 0.15, y + trunkHeight * 0.8);
    ctx.moveTo(x + trunkWidth * 0.2, y + size * 0.15);
    ctx.lineTo(x + trunkWidth * 0.1, y + trunkHeight * 0.7);
    ctx.stroke();

    if (treeType === 0) {
        // Pine tree - larger layers
        const layers = 5;
        for (let i = layers - 1; i >= 0; i--) {
            const layerY = y - size * 0.05 - i * size * 0.18;
            const layerWidth = size * (0.55 - i * 0.08);

            ctx.fillStyle = `rgb(${15 + i * 7}, ${45 + i * 10}, ${25 + i * 5})`;
            ctx.beginPath();
            ctx.moveTo(x, layerY - size * 0.28);
            ctx.lineTo(x - layerWidth, layerY + size * 0.12);
            ctx.lineTo(x + layerWidth, layerY + size * 0.12);
            ctx.closePath();
            ctx.fill();
        }
    } else if (treeType === 1) {
        // Round/deciduous tree - larger canopy
        const foliageColors = ['#1a4d2e', '#165a32', '#1e6b3a', '#2a7a45'];
        for (let i = 0; i < 4; i++) {
            const fx = x + (seededRandom(seed + i * 5) - 0.5) * size * 0.35;
            const fy = y - size * 0.3 + (seededRandom(seed + i * 5 + 1) - 0.5) * size * 0.25;
            const fSize = size * (0.4 + seededRandom(seed + i * 5 + 2) * 0.2);

            ctx.fillStyle = foliageColors[i % foliageColors.length];
            ctx.beginPath();
            ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (treeType === 2) {
        // Birch tree - white bark, lighter foliage
        // White trunk with dark marks
        ctx.fillStyle = '#e8e4dc';
        ctx.fillRect(x - trunkWidth / 2, y, trunkWidth, trunkHeight);

        // Birch bark markings (horizontal dark lines)
        ctx.fillStyle = '#3a3530';
        for (let m = 0; m < 4; m++) {
            const markY = y + trunkHeight * (0.1 + m * 0.22);
            const markWidth = trunkWidth * (0.4 + seededRandom(seed + m * 3) * 0.4);
            ctx.fillRect(x - markWidth / 2, markY, markWidth, 2);
        }

        // Lighter, more delicate foliage
        const birchColors = ['#3d7a4a', '#4a8f58', '#5aa368', '#68b575'];
        for (let i = 0; i < 5; i++) {
            const fx = x + (seededRandom(seed + i * 7) - 0.5) * size * 0.5;
            const fy = y - size * 0.35 + (seededRandom(seed + i * 7 + 1) - 0.5) * size * 0.35;
            const fSize = size * (0.25 + seededRandom(seed + i * 7 + 2) * 0.15);

            ctx.fillStyle = birchColors[i % birchColors.length];
            ctx.beginPath();
            ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (treeType === 3) {
        // Willow tree - drooping branches
        ctx.fillStyle = '#4a3520';
        ctx.fillRect(x - trunkWidth * 0.6, y, trunkWidth * 1.2, trunkHeight * 0.8);

        // Drooping willow branches
        ctx.strokeStyle = '#2d5a35';
        ctx.lineWidth = 2;
        for (let b = 0; b < 8; b++) {
            const branchStartX = x + (seededRandom(seed + b * 5) - 0.5) * size * 0.7;
            const branchStartY = y - size * 0.2;
            const branchEndX = branchStartX + (seededRandom(seed + b * 5 + 1) - 0.5) * size * 0.4;
            const branchEndY = y + size * 0.3;

            ctx.beginPath();
            ctx.moveTo(branchStartX, branchStartY);
            ctx.bezierCurveTo(
                branchStartX, branchStartY + size * 0.3,
                branchEndX, branchEndY - size * 0.2,
                branchEndX, branchEndY
            );
            ctx.stroke();

            // Leaves along the branch
            ctx.fillStyle = '#3d6b42';
            for (let l = 0; l < 5; l++) {
                const t = 0.2 + l * 0.18;
                const lx = branchStartX + (branchEndX - branchStartX) * t;
                const ly = branchStartY + (branchEndY - branchStartY) * t * t;
                ctx.beginPath();
                ctx.ellipse(lx, ly, size * 0.06, size * 0.03, Math.PI / 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else {
        // Oak-style tree - larger and fuller
        ctx.fillStyle = '#1a4d2e';
        ctx.beginPath();
        ctx.ellipse(x, y - size * 0.25, size * 0.55, size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#165a32';
        ctx.beginPath();
        ctx.ellipse(x - size * 0.18, y - size * 0.38, size * 0.35, size * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e6b3a';
        ctx.beginPath();
        ctx.ellipse(x + size * 0.15, y - size * 0.42, size * 0.3, size * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Light highlight on foliage
    ctx.fillStyle = 'rgba(150, 200, 120, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.18, y - size * 0.4, size * 0.18, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/**
 * Draw a bush with 2.5D depth effect - larger
 */
function drawBush2D5(x, y, size, seed) {
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 30, 10, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.35, size * 0.6, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bush layers - larger
    const layers = 4;
    for (let i = layers - 1; i >= 0; i--) {
        const layerSize = size * (0.5 + i * 0.18);
        const yOff = -i * size * 0.1;
        const shade = 0.55 + i * 0.12;
        ctx.fillStyle = `rgb(${Math.floor(30 * shade)}, ${Math.floor(70 * shade)}, ${Math.floor(35 * shade)})`;
        ctx.beginPath();
        ctx.ellipse(x, y + yOff, layerSize, layerSize * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Highlight
    ctx.fillStyle = 'rgba(100, 160, 80, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.18, y - size * 0.2, size * 0.28, size * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/**
 * Draw a small shrub/undergrowth - lower vegetation for forest floors
 */
function drawSmallShrub(x, y, size, seed) {
    ctx.save();

    // Small shadow
    ctx.fillStyle = 'rgba(0, 30, 10, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.15, size * 0.4, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Multiple small leaf clusters
    const colors = ['#2a5a35', '#345f3a', '#3d6b42', '#467348'];
    const clusterCount = 3 + Math.floor(seededRandom(seed) * 3);

    for (let i = 0; i < clusterCount; i++) {
        const cx = x + (seededRandom(seed + i * 5) - 0.5) * size * 0.6;
        const cy = y + (seededRandom(seed + i * 5 + 1) - 0.5) * size * 0.4;
        const cSize = size * (0.2 + seededRandom(seed + i * 5 + 2) * 0.15);

        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.ellipse(cx, cy, cSize, cSize * 0.7, seededRandom(seed + i * 5 + 3) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Small berries or flowers occasionally
    if (seededRandom(seed + 50) > 0.6) {
        const berryColor = seededRandom(seed + 51) > 0.5 ? '#8b3a3a' : '#a04080';
        ctx.fillStyle = berryColor;
        for (let b = 0; b < 3; b++) {
            const bx = x + (seededRandom(seed + b * 7 + 60) - 0.5) * size * 0.5;
            const by = y + (seededRandom(seed + b * 7 + 61) - 0.5) * size * 0.3;
            ctx.beginPath();
            ctx.arc(bx, by, size * 0.04, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

/**
 * Draw a rock formation with 2.5D depth effect - large enough to provide cover
 */
function drawRockFormation2D5(cx, cy, s, seed) {
    ctx.save();

    // Large main rock shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy + s * 0.35, s * 0.75, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main large boulder - tall enough to hide behind
    ctx.fillStyle = '#4a4a5a';
    ctx.beginPath();
    // Draw as a tall irregular polygon for more rock-like appearance
    ctx.moveTo(cx - s * 0.5, cy + s * 0.25);
    ctx.lineTo(cx - s * 0.55, cy - s * 0.1);
    ctx.lineTo(cx - s * 0.35, cy - s * 0.45);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.55);
    ctx.lineTo(cx + s * 0.45, cy - s * 0.35);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.3);
    ctx.closePath();
    ctx.fill();

    // Add 3D shading to the rock
    const rockGradient = ctx.createLinearGradient(cx - s * 0.5, cy - s * 0.5, cx + s * 0.5, cy + s * 0.3);
    rockGradient.addColorStop(0, 'rgba(100, 100, 120, 0.6)');
    rockGradient.addColorStop(0.5, 'rgba(70, 70, 85, 0.3)');
    rockGradient.addColorStop(1, 'rgba(30, 30, 40, 0.5)');
    ctx.fillStyle = rockGradient;
    ctx.fill();

    // Secondary rock pillar
    ctx.fillStyle = '#5a5a6a';
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.2, cy + s * 0.25);
    ctx.lineTo(cx + s * 0.15, cy - s * 0.2);
    ctx.lineTo(cx + s * 0.35, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.25);
    ctx.lineTo(cx + s * 0.6, cy + s * 0.15);
    ctx.closePath();
    ctx.fill();

    // Small rock in front
    ctx.fillStyle = '#656575';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.25, cy + s * 0.2, s * 0.25, s * 0.15, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Rock face details - cracks
    ctx.strokeStyle = 'rgba(30, 30, 40, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.2, cy - s * 0.4);
    ctx.lineTo(cx - s * 0.15, cy - s * 0.1);
    ctx.lineTo(cx - s * 0.05, cy + s * 0.15);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + s * 0.2, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.25, cy + s * 0.05);
    ctx.stroke();

    // Edge highlights (top-left lit)
    ctx.strokeStyle = 'rgba(150, 150, 170, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.35, cy - s * 0.45);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.55);
    ctx.lineTo(cx + s * 0.45, cy - s * 0.35);
    ctx.stroke();

    // Moss patches for natural look
    if (seededRandom(seed) > 0.3) {
        ctx.fillStyle = 'rgba(50, 90, 45, 0.7)';
        ctx.beginPath();
        ctx.ellipse(cx - s * 0.3, cy - s * 0.15, s * 0.12, s * 0.08, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.35, cy - s * 0.1, s * 0.1, s * 0.06, -0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Cover indicator icon (shield symbol)
    ctx.fillStyle = 'rgba(100, 100, 120, 0.6)';
    ctx.font = `${Math.round(s * 0.25)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪨', cx, cy - s * 0.65);

    ctx.restore();
}

/**
 * Draw hills terrain details
 */
function drawHillsDetails(cx, cy, s, seed) {
    // Draw rolling hill contours
    ctx.strokeStyle = 'rgba(80, 100, 70, 0.4)';
    ctx.lineWidth = 2;

    // Multiple contour lines to show elevation
    for (let i = 0; i < 3; i++) {
        const yOffset = (i - 1) * s * 0.35;
        const xWobble = (seededRandom(seed + i * 17) - 0.5) * s * 0.3;

        ctx.beginPath();
        ctx.moveTo(cx - s * 0.8, cy + yOffset + s * 0.1);
        ctx.bezierCurveTo(
            cx - s * 0.3 + xWobble, cy + yOffset - s * 0.15,
            cx + s * 0.3 - xWobble, cy + yOffset - s * 0.1,
            cx + s * 0.8, cy + yOffset + s * 0.05
        );
        ctx.stroke();
    }

    // Add some rocks on the hills
    const rockCount = 1 + (seed % 2);
    for (let i = 0; i < rockCount; i++) {
        const rx = cx + (seededRandom(seed + i * 23) - 0.5) * s * 1.2;
        const ry = cy + (seededRandom(seed + i * 23 + 1) - 0.5) * s * 0.8;
        const rSize = s * (0.12 + seededRandom(seed + i * 23 + 2) * 0.1);

        // Rock shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(rx + 1, ry + 1, rSize, rSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rock
        const grayVal = 100 + seededRandom(seed + i * 23 + 3) * 30;
        ctx.fillStyle = `rgb(${grayVal}, ${grayVal - 5}, ${grayVal - 10})`;
        ctx.beginPath();
        ctx.ellipse(rx, ry, rSize, rSize * 0.6, seededRandom(seed + i) * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Sparse grass on hills
    for (let i = 0; i < 3; i++) {
        const gx = cx + (seededRandom(seed + i * 31) - 0.5) * s * 1.4;
        const gy = cy + (seededRandom(seed + i * 31 + 1) - 0.5) * s * 1.1;
        const height = s * (0.12 + seededRandom(seed + i * 31 + 2) * 0.08);

        ctx.strokeStyle = 'rgba(70, 100, 60, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + (seededRandom(seed + i * 31 + 3) - 0.5) * s * 0.08, gy - height);
        ctx.stroke();
    }

    // Height indicator icon (small mountain symbol)
    ctx.fillStyle = 'rgba(90, 110, 80, 0.5)';
    ctx.font = `${Math.round(s * 0.35)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛰', cx, cy);
}

/**
 * Draw road terrain details
 */
function drawRoadDetails(cx, cy, s, seed) {
    // Cobblestone pattern
    ctx.strokeStyle = 'rgba(80, 70, 60, 0.4)';
    ctx.lineWidth = 1;

    // Draw cobblestone grid
    for (let i = 0; i < 5; i++) {
        const rx = cx + (seededRandom(seed + i * 7) - 0.5) * s * 1.2;
        const ry = cy + (seededRandom(seed + i * 7 + 1) - 0.5) * s * 0.9;
        const rSize = s * (0.15 + seededRandom(seed + i * 7 + 2) * 0.1);

        ctx.beginPath();
        ctx.roundRect(
            rx - rSize / 2,
            ry - rSize / 2,
            rSize,
            rSize * 0.7,
            rSize * 0.1
        );
        ctx.stroke();
    }

    // Road edge markings
    ctx.strokeStyle = 'rgba(90, 80, 70, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.7, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.7, cy - s * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.7, cy + s * 0.4);
    ctx.lineTo(cx + s * 0.7, cy + s * 0.4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Speed indicator
    ctx.fillStyle = 'rgba(100, 90, 80, 0.4)';
    ctx.font = `${Math.round(s * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛤️', cx, cy);
}

/**
 * Draw path terrain details
 */
function drawPathDetails(cx, cy, s, seed) {
    // Dirt path with footprints
    ctx.strokeStyle = 'rgba(70, 60, 50, 0.4)';
    ctx.lineWidth = 1;

    // Worn path marks
    for (let i = 0; i < 6; i++) {
        const px = cx + (seededRandom(seed + i * 11) - 0.5) * s * 1.0;
        const py = cy + (seededRandom(seed + i * 11 + 1) - 0.5) * s * 0.8;
        const pSize = s * (0.08 + seededRandom(seed + i * 11 + 2) * 0.06);

        ctx.fillStyle = `rgba(${70 + seededRandom(seed + i) * 20}, ${60 + seededRandom(seed + i + 1) * 20}, ${50 + seededRandom(seed + i + 2) * 15}, 0.3)`;
        ctx.beginPath();
        ctx.ellipse(px, py, pSize, pSize * 0.5, seededRandom(seed + i * 11 + 3) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Small pebbles
    for (let i = 0; i < 3; i++) {
        const px = cx + (seededRandom(seed + i * 19) - 0.5) * s * 0.8;
        const py = cy + (seededRandom(seed + i * 19 + 1) - 0.5) * s * 0.6;
        const pSize = s * 0.05;

        ctx.fillStyle = 'rgba(80, 75, 65, 0.5)';
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw river terrain details
 */
function drawRiverDetails(cx, cy, s, seed) {
    // Flowing water ripples
    ctx.strokeStyle = 'rgba(60, 120, 160, 0.4)';
    ctx.lineWidth = 1.5;

    // Wave patterns
    for (let i = 0; i < 3; i++) {
        const yOffset = (i - 1) * s * 0.35;
        ctx.beginPath();
        for (let x = -s * 0.8; x <= s * 0.8; x += s * 0.2) {
            const wobble = Math.sin(x * 0.3 + seed * 0.1 + i) * s * 0.1;
            if (x === -s * 0.8) {
                ctx.moveTo(cx + x, cy + yOffset + wobble);
            } else {
                ctx.lineTo(cx + x, cy + yOffset + wobble);
            }
        }
        ctx.stroke();
    }

    // Sparkle effects on water
    ctx.fillStyle = 'rgba(180, 220, 255, 0.5)';
    for (let i = 0; i < 2; i++) {
        const sx = cx + (seededRandom(seed + i * 13) - 0.5) * s * 1.0;
        const sy = cy + (seededRandom(seed + i * 13 + 1) - 0.5) * s * 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
    }

    // River flow indicator
    ctx.fillStyle = 'rgba(70, 130, 170, 0.4)';
    ctx.font = `${Math.round(s * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌊', cx, cy);
}

/**
 * Draw full grass texture coverage - creates the base meadow look
 */
function drawGrassTexture(cx, cy, size, seed) {
    const radius = size * 0.8;

    // Multiple overlapping grass patches for natural coverage
    for (let ring = 0; ring < 3; ring++) {
        const ringRadius = radius * (0.3 + ring * 0.3);
        const patchCount = 4 + ring * 2;

        for (let i = 0; i < patchCount; i++) {
            const angle = (i / patchCount) * Math.PI * 2 + seededRandom(seed + ring * 100 + i) * 0.5;
            const dist = ringRadius * (0.5 + seededRandom(seed + ring * 100 + i + 50) * 0.5);
            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;

            // Grass patch - organic shape
            const patchSize = size * (0.15 + seededRandom(seed + ring * 100 + i + 10) * 0.12);
            const shade = 0.7 + seededRandom(seed + ring * 100 + i + 20) * 0.3;

            ctx.fillStyle = `rgba(${Math.floor(55 * shade)}, ${Math.floor(115 * shade)}, ${Math.floor(60 * shade)}, 0.4)`;
            ctx.beginPath();
            ctx.ellipse(px, py, patchSize, patchSize * 0.7,
                seededRandom(seed + ring * 100 + i + 30) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Central grass tufts
    for (let i = 0; i < 5; i++) {
        const tx = cx + (seededRandom(seed + i * 23) - 0.5) * radius * 0.6;
        const ty = cy + (seededRandom(seed + i * 23 + 1) - 0.5) * radius * 0.5;
        const shade = 0.8 + seededRandom(seed + i * 23 + 2) * 0.2;

        ctx.fillStyle = `rgba(${Math.floor(60 * shade)}, ${Math.floor(120 * shade)}, ${Math.floor(65 * shade)}, 0.35)`;
        ctx.beginPath();
        ctx.ellipse(tx, ty, size * 0.1, size * 0.06, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw wild meadow with mixed vegetation
 */
function drawWildMeadow(cx, cy, s, seed) {
    // Scattered wild grass clumps
    const clumpCount = 4 + (seed % 3);
    for (let i = 0; i < clumpCount; i++) {
        const clumpX = cx + (seededRandom(seed + i * 31) - 0.5) * s * 1.4;
        const clumpY = cy + (seededRandom(seed + i * 31 + 1) - 0.5) * s * 1.1;

        // Draw 3-5 grass blades per clump
        const bladeCount = 3 + (Math.floor(seededRandom(seed + i * 31 + 2) * 3));
        for (let j = 0; j < bladeCount; j++) {
            const bx = clumpX + (seededRandom(seed + i * 31 + j * 5) - 0.5) * s * 0.15;
            const by = clumpY;
            const height = s * (0.2 + seededRandom(seed + i * 31 + j * 5 + 1) * 0.2);
            const lean = (seededRandom(seed + i * 31 + j * 5 + 2) - 0.5) * s * 0.12;

            const shade = 0.7 + seededRandom(seed + i * 31 + j * 5 + 3) * 0.3;
            ctx.strokeStyle = `rgba(${Math.floor(50 * shade)}, ${Math.floor(105 * shade)}, ${Math.floor(55 * shade)}, 0.85)`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + lean * 0.5, by - height * 0.6, bx + lean, by - height);
            ctx.stroke();
        }
    }

    // Occasional small wildflowers
    if (seededRandom(seed + 500) > 0.4) {
        const flowerCount = 2 + Math.floor(seededRandom(seed + 501) * 3);
        const flowerColors = ['#ffeb99', '#ffd4e5', '#d4f0ff', '#e5d4ff'];
        for (let i = 0; i < flowerCount; i++) {
            const fx = cx + (seededRandom(seed + 600 + i) - 0.5) * s * 1.2;
            const fy = cy + (seededRandom(seed + 601 + i) - 0.5) * s;
            const fSize = 2 + seededRandom(seed + 602 + i) * 1.5;

            ctx.fillStyle = flowerColors[Math.floor(seededRandom(seed + 603 + i) * flowerColors.length)];
            ctx.beginPath();
            ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/**
 * Draw forest floor - leaves, fallen branches, small plants
 */
function drawForestFloor(cx, cy, s, seed) {
    // Fallen leaves scattered on ground
    const leafCount = 4 + (seed % 4);
    for (let i = 0; i < leafCount; i++) {
        const lx = cx + (seededRandom(seed + i * 11) - 0.5) * s * 1.6;
        const ly = cy + (seededRandom(seed + i * 11 + 1) - 0.5) * s * 1.2;
        const leafSize = s * (0.08 + seededRandom(seed + i * 11 + 2) * 0.06);
        const rotation = seededRandom(seed + i * 11 + 3) * Math.PI * 2;

        const shade = 0.4 + seededRandom(seed + i * 11 + 4) * 0.3;
        ctx.fillStyle = `rgba(${Math.floor(80 * shade)}, ${Math.floor(60 * shade)}, ${Math.floor(30 * shade)}, 0.6)`;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, leafSize, leafSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Small ferns/plants
    const fernCount = 2 + (seed % 2);
    for (let i = 0; i < fernCount; i++) {
        const fx = cx + (seededRandom(seed + i * 17) - 0.5) * s * 1.2;
        const fy = cy + (seededRandom(seed + i * 17 + 1) - 0.5) * s * 0.8;
        const fernSize = s * (0.15 + seededRandom(seed + i * 17 + 2) * 0.1);

        ctx.strokeStyle = 'rgba(35, 80, 45, 0.7)';
        ctx.lineWidth = 1.5;

        // Draw small fern fronds
        for (let j = 0; j < 3; j++) {
            const angle = -Math.PI / 2 + (j - 1) * 0.4;
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx + Math.cos(angle) * fernSize, fy + Math.sin(angle) * fernSize);
            ctx.stroke();
        }
    }

    // Darker ground patches (shade from trees)
    ctx.fillStyle = 'rgba(0, 20, 10, 0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.5, s * 0.3, seededRandom(seed + 50) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw grass blades for texture - optimized
 */
function drawGrassBlades(cx, cy, s, seed) {
    const bladeCount = 5 + (seed % 3);  // Reduced for performance
    for (let i = 0; i < bladeCount; i++) {
        const bx = cx + (seededRandom(seed + i * 7) - 0.5) * s * 1.4;
        const by = cy + (seededRandom(seed + i * 7 + 3) - 0.5) * s * 1.2;
        const height = s * (0.15 + seededRandom(seed + i * 7 + 1) * 0.2);
        const lean = (seededRandom(seed + i * 7 + 2) - 0.5) * s * 0.15;

        const shade = 0.7 + seededRandom(seed + i * 7 + 4) * 0.3;
        ctx.strokeStyle = `rgba(${Math.floor(45 * shade)}, ${Math.floor(95 * shade)}, ${Math.floor(50 * shade)}, 0.8)`;
        ctx.lineWidth = 1 + seededRandom(seed + i * 7 + 5) * 0.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + lean * 0.5, by - height * 0.6, bx + lean, by - height);
        ctx.stroke();
    }
}

/**
 * Draw a decorative bush
 */
function drawBush(x, y, size, seed) {
    // Shadow
    ctx.fillStyle = 'rgba(0, 30, 10, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.4, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bush layers
    const layers = 3;
    for (let i = layers - 1; i >= 0; i--) {
        const layerSize = size * (0.6 + i * 0.2);
        const yOff = -i * size * 0.12;
        const shade = 0.6 + i * 0.15;
        ctx.fillStyle = `rgb(${Math.floor(35 * shade)}, ${Math.floor(75 * shade)}, ${Math.floor(40 * shade)})`;
        ctx.beginPath();
        ctx.ellipse(x, y + yOff, layerSize, layerSize * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Highlight
    ctx.fillStyle = 'rgba(100, 160, 80, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.15, y - size * 0.2, size * 0.25, size * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw flower cluster
 */
function drawFlowerCluster(cx, cy, s, seed) {
    const flowerColors = ['#ff6b9d', '#ffeb3b', '#ffffff', '#ff9f43', '#a29bfe', '#fd79a8'];
    const flowerCount = 4 + (seed % 4);

    for (let i = 0; i < flowerCount; i++) {
        const fx = cx + (seededRandom(seed + i * 11) - 0.5) * s * 1.3;
        const fy = cy + (seededRandom(seed + i * 11 + 1) - 0.5) * s * 1.1;
        const fSize = 2 + seededRandom(seed + i * 11 + 2) * 2;
        const colorIdx = Math.floor(seededRandom(seed + i * 11 + 3) * flowerColors.length);

        // Stem
        ctx.strokeStyle = '#3d6b3d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, fy + fSize);
        ctx.lineTo(fx, fy + fSize + 4);
        ctx.stroke();

        // Petals
        ctx.fillStyle = flowerColors[colorIdx];
        const petalCount = 5;
        for (let p = 0; p < petalCount; p++) {
            const angle = (p / petalCount) * Math.PI * 2;
            ctx.beginPath();
            ctx.ellipse(
                fx + Math.cos(angle) * fSize * 0.5,
                fy + Math.sin(angle) * fSize * 0.5,
                fSize * 0.4, fSize * 0.25,
                angle, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // Center
        ctx.fillStyle = '#ffd32a';
        ctx.beginPath();
        ctx.arc(fx, fy, fSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw stones with moss
 */
function drawStones(cx, cy, s, seed) {
    const stoneCount = 2 + (seed % 3);
    for (let i = 0; i < stoneCount; i++) {
        const sx = cx + (seededRandom(seed + i * 13) - 0.5) * s * 0.8;
        const sy = cy + (seededRandom(seed + i * 13 + 1) - 0.5) * s * 0.6;
        const sSize = s * (0.15 + seededRandom(seed + i * 13 + 2) * 0.15);

        // Stone shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(sx + 2, sy + 2, sSize, sSize * 0.6, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Stone
        const grayVal = 90 + seededRandom(seed + i * 13 + 3) * 40;
        ctx.fillStyle = `rgb(${grayVal}, ${grayVal - 5}, ${grayVal + 10})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sSize, sSize * 0.6, seededRandom(seed + i) * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Moss on stone
        if (seededRandom(seed + i * 13 + 4) > 0.4) {
            ctx.fillStyle = 'rgba(60, 100, 50, 0.6)';
            ctx.beginPath();
            ctx.ellipse(sx - sSize * 0.3, sy - sSize * 0.2, sSize * 0.3, sSize * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/**
 * Draw tall grass patch
 */
function drawTallGrass(cx, cy, s, seed) {
    const bladeCount = 8 + (seed % 5);
    for (let i = 0; i < bladeCount; i++) {
        const bx = cx + (seededRandom(seed + i * 9) - 0.5) * s * 1.2;
        const by = cy + (seededRandom(seed + i * 9 + 1) - 0.5) * s * 0.8;
        const height = s * (0.35 + seededRandom(seed + i * 9 + 2) * 0.25);
        const lean = (seededRandom(seed + i * 9 + 3) - 0.5) * s * 0.25;

        const shade = 0.6 + seededRandom(seed + i * 9 + 4) * 0.4;
        ctx.strokeStyle = `rgba(${Math.floor(50 * shade)}, ${Math.floor(110 * shade)}, ${Math.floor(55 * shade)}, 0.9)`;
        ctx.lineWidth = 1.5 + seededRandom(seed + i * 9 + 5) * 1;
        ctx.beginPath();
        ctx.moveTo(bx, by + s * 0.1);
        ctx.bezierCurveTo(
            bx + lean * 0.3, by - height * 0.3,
            bx + lean * 0.7, by - height * 0.7,
            bx + lean, by - height
        );
        ctx.stroke();
    }
}

/**
 * Draw forest undergrowth
 */
function drawUndergrowth(cx, cy, s, seed) {
    // Dark undergrowth patches
    for (let i = 0; i < 3; i++) {
        const ux = cx + (seededRandom(seed + i * 17) - 0.5) * s * 1.5;
        const uy = cy + (seededRandom(seed + i * 17 + 1) - 0.5) * s * 1.2;
        ctx.fillStyle = `rgba(20, 40, 25, ${0.2 + seededRandom(seed + i * 17 + 2) * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(ux, uy, s * 0.4, s * 0.25, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Small ferns
    for (let i = 0; i < 2; i++) {
        const fx = cx + (seededRandom(seed + i * 19 + 50) - 0.5) * s * 1.2;
        const fy = cy + (seededRandom(seed + i * 19 + 51) - 0.5) * s;
        drawFern(fx, fy, s * 0.3, seed + i * 100);
    }
}

/**
 * Draw a small fern
 */
function drawFern(x, y, size, seed) {
    ctx.strokeStyle = '#2d5a35';
    ctx.lineWidth = 1;

    const fronds = 5;
    for (let i = 0; i < fronds; i++) {
        const angle = -Math.PI / 2 + (i - fronds / 2) * 0.3;
        const length = size * (0.8 + seededRandom(seed + i) * 0.4);

        ctx.beginPath();
        ctx.moveTo(x, y);
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Leaflets
        for (let j = 1; j < 4; j++) {
            const t = j / 4;
            const lx = x + (endX - x) * t;
            const ly = y + (endY - y) * t;
            const leafSize = size * 0.15 * (1 - t * 0.5);

            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + leafSize, ly - leafSize * 0.5);
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - leafSize, ly - leafSize * 0.5);
            ctx.stroke();
        }
    }
}


/**
 * Draw a tree with type variation
 */
function drawTree(x, y, size, treeType, seed) {
    // Shadow
    ctx.fillStyle = 'rgba(0, 20, 10, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.5, size * 0.4, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#3d2817';
    const trunkWidth = size * 0.12;
    ctx.fillRect(x - trunkWidth / 2, y, trunkWidth, size * 0.45);

    // Trunk detail
    ctx.strokeStyle = '#2a1a0f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - trunkWidth * 0.3, y + size * 0.1);
    ctx.lineTo(x - trunkWidth * 0.2, y + size * 0.35);
    ctx.stroke();

    if (treeType === 0) {
        // Pine tree
        const layers = 4;
        for (let i = layers - 1; i >= 0; i--) {
            const layerY = y - size * 0.1 - i * size * 0.18;
            const layerWidth = size * (0.5 - i * 0.08);

            ctx.fillStyle = `rgb(${15 + i * 8}, ${50 + i * 12}, ${25 + i * 6})`;
            ctx.beginPath();
            ctx.moveTo(x, layerY - size * 0.25);
            ctx.lineTo(x - layerWidth, layerY + size * 0.1);
            ctx.lineTo(x + layerWidth, layerY + size * 0.1);
            ctx.closePath();
            ctx.fill();
        }
    } else if (treeType === 1) {
        // Round tree
        const foliageColors = ['#1a4d2e', '#165a32', '#1e6b3a'];
        for (let i = 0; i < 3; i++) {
            const fx = x + (seededRandom(seed + i * 5) - 0.5) * size * 0.3;
            const fy = y - size * 0.25 + (seededRandom(seed + i * 5 + 1) - 0.5) * size * 0.2;
            const fSize = size * (0.35 + seededRandom(seed + i * 5 + 2) * 0.15);

            ctx.fillStyle = foliageColors[i % foliageColors.length];
            ctx.beginPath();
            ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        // Oak-style tree
        ctx.fillStyle = '#1a4d2e';
        ctx.beginPath();
        ctx.ellipse(x, y - size * 0.2, size * 0.45, size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#165a32';
        ctx.beginPath();
        ctx.ellipse(x - size * 0.15, y - size * 0.3, size * 0.3, size * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e6b3a';
        ctx.beginPath();
        ctx.ellipse(x + size * 0.1, y - size * 0.35, size * 0.25, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Highlight
    ctx.fillStyle = 'rgba(150, 200, 120, 0.15)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.15, y - size * 0.35, size * 0.15, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw rock formation with detail
 */
function drawRockFormation(cx, cy, s, seed) {
    // Main rock shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy + s * 0.15, s * 0.85, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main rock
    ctx.fillStyle = '#6a6a7a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.05, s * 0.85, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Secondary rocks
    ctx.fillStyle = '#7a7a8a';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.25, cy - s * 0.15, s * 0.45, s * 0.3, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#858595';
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.3, cy - s * 0.05, s * 0.35, s * 0.25, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Cracks
    ctx.strokeStyle = 'rgba(40, 40, 50, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy);
    ctx.lineTo(cx - s * 0.1, cy + s * 0.15);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.1);
    ctx.stroke();

    // Highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.35, cy - s * 0.2, s * 0.15, s * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Moss patches
    if (seededRandom(seed) > 0.5) {
        ctx.fillStyle = 'rgba(60, 100, 50, 0.5)';
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.2, cy - s * 0.25, s * 0.15, s * 0.1, 0.5, 0, Math.PI * 2);
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
    if (unit.cloaked && unit.player === state.viewingPlayer) {
        // Own cloaked units - visibility based on distance to own non-cloaked units
        ctx.globalAlpha = getStealthVisibilityAlpha(unit);
    } else if (unit.cloaked && unit.player !== state.viewingPlayer) {
        // Enemy cloaked unit detected by proximity - show semi-transparent
        ctx.globalAlpha = getEnemyCloakedVisibilityAlpha(unit, state.viewingPlayer);
    } else if (unit.revealedUntilEndOfTurn && unit.player !== state.viewingPlayer) {
        // Unit that attacked while cloaked - visible but semi-transparent until turn ends
        ctx.globalAlpha = 0.6;
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

    // Draw the human sprite
    drawHumanSprite(ctx, cx, cy - size * 0.15, size * 1.3, playerColor, unit.class, isSelected);

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
 */
function shouldRenderDetails() {
    return state.effectiveQuality === 'high';
}

/**
 * Check if foreground elements (trees, rocks) should be rendered
 */
function shouldRenderForeground() {
    return state.effectiveQuality !== 'low';
}

/**
 * Main render function
 */
export function render() {
    if (!canvas || !ctx) return;

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
        const cachedTile = getCachedHexTile(hex, fogLevel, state.hexSize);

        if (cachedTile) {
            // Draw cached tile - much faster than individual draw calls
            const tileSize = cachedTile.width;
            ctx.drawImage(
                cachedTile,
                sx - tileSize / 2,
                sy - tileSize / 2
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

            const strokeColor = fogLevel === 'visible' ? 'rgba(255,255,255,0.12)' :
                (fogLevel === 'explored' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)');
            const terrainData = fogLevel === 'visible' ? terrain : null;
            drawHex(sx, sy, state.hexSize * 0.95, fillColor, strokeColor, 1, texture, terrainData);

            // Fog overlays for non-cached rendering
            if (fogLevel === 'explored') {
                ctx.save();
                ctx.beginPath();
                drawHexPath(sx, sy, state.hexSize * 0.95);
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
                drawHexPath(sx, sy, state.hexSize * 0.95);
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
