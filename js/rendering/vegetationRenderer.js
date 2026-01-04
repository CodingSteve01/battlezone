// ===== VEGETATION RENDERER =====
// Handles biome-specific vegetation drawing: trees, bushes, shrubs, rocks

import { state } from '../state.js';
import {
    getRandomDetailSpriteWithAnchor
} from '../assetLoader.js';
import {
    seededRandom,
    getSpriteDimensions
} from './renderUtils.js';
import { drawSpriteShadow } from './effectsRenderer.js';

// Canvas context reference (set by initVegetationRenderer)
let ctx = null;

/**
 * Initialize the vegetation renderer with a canvas context
 * @param {CanvasRenderingContext2D} context - The 2D rendering context
 */
export function initVegetationRenderer(context) {
    ctx = context;
}

// ===== TREE TYPE DEFINITIONS =====

export const TREE_TYPE_NAMES = ['oak', 'pine', 'birch', 'willow', 'maple', 'dead', 'palm', 'datepalm', 'fanpalm'];

/**
 * Get the tree pool for a specific biome/terrain
 * @param {string} terrainType - The terrain type
 * @returns {string[]} Array of tree type names
 */
export function getBiomeTreePool(terrainType) {
    const biome = state.activeBiome || 'temperate';

    // Terrain-specific overrides
    if (terrainType === 'pine' || terrainType === 'snow') {
        return ['pine', 'pine', 'birch', 'dead', 'pine'];
    }

    if (terrainType === 'swamp') {
        return ['willow', 'willow', 'dead', 'oak', 'willow'];
    }

    if (terrainType === 'sand') {
        return ['dead', 'dead', 'dead', 'oak'];  // Sparse dead trees
    }

    // Biome-specific tree pools for more realistic vegetation
    switch (biome) {
        case 'tundra':
            return ['pine', 'birch', 'dead', 'pine'];
        case 'highland':
            return ['pine', 'birch', 'oak', 'pine'];
        case 'tropical':
            return ['palm', 'datepalm', 'fanpalm', 'willow', 'maple', 'palm', 'fanpalm'];
        case 'wetland':
            return ['willow', 'oak', 'dead', 'birch', 'willow'];
        case 'desert':
            return ['dead', 'palm', 'datepalm', 'dead', 'fanpalm'];
        case 'temperate':
        default:
            return ['oak', 'birch', 'maple', 'oak', 'maple'];
    }
}

/**
 * Pick a tree type index based on biome and seed
 * @param {number} seed - Random seed
 * @param {string} terrainType - The terrain type
 * @returns {number} Tree type index
 */
export function pickTreeTypeForBiome(seed, terrainType) {
    const pool = getBiomeTreePool(terrainType);
    const pick = pool[Math.floor(seededRandom(seed) * pool.length)] || 'oak';
    return TREE_TYPE_NAMES.indexOf(pick) >= 0 ? TREE_TYPE_NAMES.indexOf(pick) : 0;
}

/**
 * Get the detail sprite type name for a tree type
 * @param {number} treeType - Tree type index
 * @returns {string} Detail type name (e.g., 'tree_oak')
 */
export function getTreeDetailType(treeType) {
    const typeName = TREE_TYPE_NAMES[treeType] || 'oak';
    return `tree_${typeName}`;
}

// ===== SPRITE BOUNDS HELPERS =====

/**
 * Calculate bounds for a sprite given its position and anchor
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} spriteWidth - Sprite width
 * @param {number} spriteHeight - Sprite height
 * @param {{x: number, y: number}} anchorPoint - Anchor point (0-1)
 * @returns {{minX: number, maxX: number, minY: number, maxY: number}}
 */
export function getSpriteBounds(x, y, spriteWidth, spriteHeight, anchorPoint) {
    const drawX = x - spriteWidth * anchorPoint.x;
    const drawY = y - spriteHeight * anchorPoint.y;
    return {
        minX: drawX,
        maxX: drawX + spriteWidth,
        minY: drawY,
        maxY: drawY + spriteHeight
    };
}

/**
 * Get bounds for a tree sprite
 */
export function getTreeSpriteBounds(x, y, size, treeType, seed) {
    const detailType = getTreeDetailType(treeType);
    const result = getRandomDetailSpriteWithAnchor(detailType, seed * 0.001)
        || getRandomDetailSpriteWithAnchor('tree', seed * 0.001);
    if (!result) return null;

    const { sprite, contentScale, anchor } = result;
    const sizeVariation = 0.7 + seededRandom(seed * 1.1) * 0.6;
    const baseHeight = size * 1.6 * sizeVariation;
    const { spriteWidth, spriteHeight } = getSpriteDimensions(sprite, contentScale, baseHeight);
    const anchorPoint = anchor || { x: 0.5, y: 1.0 };
    return getSpriteBounds(x, y, spriteWidth, spriteHeight, anchorPoint);
}

/**
 * Get bounds for a bush sprite
 */
export function getBushSpriteBounds(x, y, size, seed) {
    const result = getRandomDetailSpriteWithAnchor('bush', seed * 0.001);
    if (!result) return null;

    const { sprite, contentScale, anchor } = result;
    const sizeVariation = 0.6 + seededRandom(seed * 1.3) * 0.8;
    const baseSize = size * 1.1 * sizeVariation;
    const { spriteWidth, spriteHeight } = getSpriteDimensions(sprite, contentScale, baseSize);
    const anchorPoint = anchor || { x: 0.5, y: 1.0 };
    return getSpriteBounds(x, y, spriteWidth, spriteHeight, anchorPoint);
}

/**
 * Get bounds for a shrub sprite
 */
export function getShrubSpriteBounds(x, y, size, seed) {
    const result = getRandomDetailSpriteWithAnchor('grass', seed * 0.001);
    if (!result) return null;

    const { sprite, contentScale, anchor } = result;
    const sizeVariation = 0.7 + seededRandom(seed * 1.5) * 0.6;
    const baseSize = size * 0.9 * sizeVariation;
    const { spriteWidth, spriteHeight } = getSpriteDimensions(sprite, contentScale, baseSize);
    const anchorPoint = anchor || { x: 0.5, y: 1.0 };
    return getSpriteBounds(x, y, spriteWidth, spriteHeight, anchorPoint);
}

/**
 * Get bounds for a rock formation
 */
export function getRockBounds(x, y, size, seed) {
    const sizeVariation = 0.5 + seededRandom(seed) * 0.8;
    const rockSize = size * 0.6 * sizeVariation;
    return {
        minX: x - rockSize,
        maxX: x + rockSize,
        minY: y - rockSize * 0.9,
        maxY: y + rockSize * 0.6
    };
}

/**
 * Get bounds for any vegetation element type
 * @param {string} type - Element type
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} size - Hex size
 * @param {Object} params - Additional parameters (treeType, seed)
 * @returns {Object|null} Bounds object or null
 */
export function getElementBounds(type, x, y, size, params) {
    switch (type) {
        case 'tree':
        case 'tree-edge':
        case 'tree-solitary':
        case 'dead-tree':
            return getTreeSpriteBounds(x, y, size, params.treeType ?? 0, params.seed ?? 0);
        case 'bush':
            return getBushSpriteBounds(x, y, size, params.seed ?? 0);
        case 'shrub':
        case 'shrub-hills':
        case 'shrub-ruins':
        case 'reeds':
            return getShrubSpriteBounds(x, y, size, params.seed ?? 0);
        case 'rock':
        case 'rock-small':
        case 'rock-hills':
        case 'rock-sand':
            return getRockBounds(x, y, size, params.seed ?? 0);
        default:
            return null;
    }
}

// ===== VEGETATION DRAWING FUNCTIONS =====

/**
 * Apply biome-appropriate color tinting to vegetation sprites
 * Creates more cohesive and realistic environments
 */
export function applyBiomeVegetationTint(x, y, width, height) {
    const biome = state.activeBiome || 'temperate';

    const biomeTints = {
        desert: { color: 'rgba(200, 180, 120, 0.12)', blend: 'multiply' },
        tropical: { color: 'rgba(40, 120, 60, 0.1)', blend: 'overlay' },
        tundra: { color: 'rgba(100, 120, 140, 0.12)', blend: 'multiply' },
        wetland: { color: 'rgba(60, 90, 70, 0.1)', blend: 'multiply' },
        highland: { color: 'rgba(110, 120, 100, 0.08)', blend: 'multiply' },
        temperate: null
    };

    const tintConfig = biomeTints[biome];
    if (tintConfig) {
        ctx.globalCompositeOperation = tintConfig.blend;
        ctx.fillStyle = tintConfig.color;
        ctx.fillRect(x, y, width, height);
        ctx.globalCompositeOperation = 'source-over';
    }
}

/**
 * Draw a tree with 2.5D perspective
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} size - Hex size
 * @param {number} treeType - Tree type index
 * @param {number} seed - Random seed
 */
export function drawTree2D5(x, y, size, treeType, seed) {
    const detailType = getTreeDetailType(treeType);
    const result = getRandomDetailSpriteWithAnchor(detailType, seed * 0.001)
        || getRandomDetailSpriteWithAnchor('tree', seed * 0.001);
    if (result) {
        const { sprite, contentScale, anchor } = result;

        const sizeVariation = 0.7 + seededRandom(seed * 1.1) * 0.6;
        const baseHeight = size * 1.6 * sizeVariation;

        const { spriteWidth, spriteHeight } = getSpriteDimensions(sprite, contentScale, baseHeight);

        const shouldMirror = seededRandom(seed * 2.2) > 0.5;

        const anchorPoint = anchor || { x: 0.5, y: 1.0 };
        const drawX = x - spriteWidth * anchorPoint.x;
        const drawY = y - spriteHeight * anchorPoint.y;

        drawSpriteShadow(x, y, spriteWidth, spriteHeight, 2);
        ctx.save();
        if (shouldMirror) {
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -spriteWidth * anchorPoint.x, -spriteHeight * anchorPoint.y, spriteWidth, spriteHeight);
        } else {
            ctx.drawImage(sprite, drawX, drawY, spriteWidth, spriteHeight);
        }
        ctx.restore();
    }
}

/**
 * Draw a bush with 2.5D perspective
 */
export function drawBush2D5(x, y, size, seed) {
    const result = getRandomDetailSpriteWithAnchor('bush', seed * 0.001);
    if (result) {
        const { sprite, contentScale, anchor } = result;

        const sizeVariation = 0.6 + seededRandom(seed * 1.3) * 0.8;
        const baseSize = size * 1.1 * sizeVariation;

        const { spriteWidth, spriteHeight } = getSpriteDimensions(sprite, contentScale, baseSize);

        const shouldMirror = seededRandom(seed * 2.4) > 0.5;

        const anchorPoint = anchor || { x: 0.5, y: 1.0 };
        const drawX = x - spriteWidth * anchorPoint.x;
        const drawY = y - spriteHeight * anchorPoint.y;

        drawSpriteShadow(x, y, spriteWidth, spriteHeight, 1);
        ctx.save();
        if (shouldMirror) {
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -spriteWidth * anchorPoint.x, -spriteHeight * anchorPoint.y, spriteWidth, spriteHeight);
        } else {
            ctx.drawImage(sprite, drawX, drawY, spriteWidth, spriteHeight);
        }

        applyBiomeVegetationTint(drawX, drawY, spriteWidth, spriteHeight);

        ctx.restore();
    }
}

/**
 * Draw a small shrub
 */
export function drawSmallShrub(x, y, size, seed) {
    const result = getRandomDetailSpriteWithAnchor('grass', seed * 0.001);
    if (result) {
        const { sprite, contentScale, anchor } = result;

        const sizeVariation = 0.7 + seededRandom(seed * 1.5) * 0.6;
        const baseSize = size * 0.9 * sizeVariation;

        const { spriteWidth, spriteHeight } = getSpriteDimensions(sprite, contentScale, baseSize);
        const shouldMirror = seededRandom(seed * 2.6) > 0.5;

        const anchorPoint = anchor || { x: 0.5, y: 1.0 };
        const drawX = x - spriteWidth * anchorPoint.x;
        const drawY = y - spriteHeight * anchorPoint.y;

        drawSpriteShadow(x, y, spriteWidth, spriteHeight, 1);
        ctx.save();
        if (shouldMirror) {
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -spriteWidth * anchorPoint.x, -spriteHeight * anchorPoint.y, spriteWidth, spriteHeight);
        } else {
            ctx.drawImage(sprite, drawX, drawY, spriteWidth, spriteHeight);
        }

        applyBiomeVegetationTint(drawX, drawY, spriteWidth, spriteHeight);

        ctx.restore();
    }
}

/**
 * Draw a flower cluster
 */
export function drawFlowerCluster(x, y, size, seed) {
    const result = getRandomDetailSpriteWithAnchor('grass', seed * 0.001);
    if (result) {
        const { sprite, contentScale, anchor } = result;

        const sizeVariation = 0.5 + seededRandom(seed * 1.7) * 0.5;
        const baseSize = size * 0.9 * sizeVariation;

        const { spriteWidth, spriteHeight } = getSpriteDimensions(sprite, contentScale, baseSize);

        const anchorPoint = anchor || { x: 0.5, y: 1.0 };
        const drawX = x - spriteWidth * anchorPoint.x;
        const drawY = y - spriteHeight * anchorPoint.y;
        ctx.drawImage(sprite, drawX, drawY, spriteWidth, spriteHeight);
    }
}

/**
 * Draw a rock formation with procedural details
 */
export function drawRockFormation2D5(x, y, size, seed) {
    const sizeVariation = 0.4 + seededRandom(seed) * 0.5;
    const rockSize = Math.min(size * 0.5 * sizeVariation, size * 0.4);

    ctx.save();
    ctx.translate(x, y);

    const biome = state.activeBiome || 'temperate';

    const rockColors = {
        temperate: { r: 95, g: 88, b: 78 },
        tropical: { r: 85, g: 80, b: 70 },
        desert: { r: 140, g: 120, b: 95 },
        tundra: { r: 100, g: 100, b: 105 },
        wetland: { r: 80, g: 78, b: 72 },
        highland: { r: 90, g: 85, b: 80 }
    };
    const baseColor = rockColors[biome] || rockColors.temperate;

    const colorVar = seededRandom(seed * 3) * 20 - 10;
    const r = Math.max(0, Math.min(255, baseColor.r + colorVar));
    const g = Math.max(0, Math.min(255, baseColor.g + colorVar - 3));
    const b = Math.max(0, Math.min(255, baseColor.b + colorVar - 5));

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(rockSize * 0.1, rockSize * 0.35, rockSize * 0.9, rockSize * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rock gradient
    const rockGrad = ctx.createRadialGradient(
        -rockSize * 0.3, -rockSize * 0.2, 0,
        rockSize * 0.1, rockSize * 0.1, rockSize
    );
    rockGrad.addColorStop(0, `rgb(${r + 25}, ${g + 25}, ${b + 20})`);
    rockGrad.addColorStop(0.4, `rgb(${r}, ${g}, ${b})`);
    rockGrad.addColorStop(1, `rgb(${r - 25}, ${g - 25}, ${b - 20})`);

    // Draw irregular rock shape
    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    const points = 7 + Math.floor(seededRandom(seed * 4) * 4);
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const dist = rockSize * (0.65 + seededRandom(seed + i * 7) * 0.35);
        const px = Math.cos(angle) * dist;
        const yScale = Math.abs(Math.cos(angle)) < 0.3 ? 0.4 : 0.55;
        const py = Math.sin(angle) * dist * yScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Surface cracks
    ctx.strokeStyle = `rgba(${r - 30}, ${g - 30}, ${b - 25}, 0.3)`;
    ctx.lineWidth = 0.8;

    ctx.beginPath();
    ctx.moveTo(-rockSize * 0.2, -rockSize * 0.25);
    ctx.quadraticCurveTo(0, 0, rockSize * 0.15, rockSize * 0.2);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
        const crackSeed = seed + i * 100;
        const startX = (seededRandom(crackSeed) - 0.5) * rockSize * 1.2;
        const startY = (seededRandom(crackSeed + 1) - 0.5) * rockSize * 0.5;
        const length = rockSize * 0.2 + seededRandom(crackSeed + 2) * rockSize * 0.2;
        const angle = seededRandom(crackSeed + 3) * Math.PI * 2;

        ctx.strokeStyle = `rgba(${r - 35}, ${g - 35}, ${b - 30}, 0.25)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + Math.cos(angle) * length, startY + Math.sin(angle) * length * 0.5);
        ctx.stroke();
    }

    // Top highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.ellipse(-rockSize * 0.25, -rockSize * 0.15, rockSize * 0.35, rockSize * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.ellipse(-rockSize * 0.15, -rockSize * 0.2, rockSize * 0.12, rockSize * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Moss patches
    const mossChance = biome === 'wetland' ? 0.7 : biome === 'desert' ? 0.1 : 0.4;
    if (seededRandom(seed * 5) < mossChance) {
        const mossColor = biome === 'wetland'
            ? 'rgba(60, 85, 50, 0.4)'
            : 'rgba(70, 90, 55, 0.3)';

        ctx.fillStyle = mossColor;
        const mossCount = 2 + Math.floor(seededRandom(seed * 6) * 3);
        for (let i = 0; i < mossCount; i++) {
            const mx = rockSize * 0.2 + seededRandom(seed + i * 50) * rockSize * 0.4;
            const my = seededRandom(seed + i * 51) * rockSize * 0.3 - rockSize * 0.05;
            const mSize = rockSize * 0.1 + seededRandom(seed + i * 52) * rockSize * 0.1;

            ctx.beginPath();
            ctx.ellipse(mx, my, mSize, mSize * 0.6, seededRandom(seed + i * 53) * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Edge definition
    ctx.strokeStyle = `rgba(${r - 40}, ${g - 40}, ${b - 35}, 0.2)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const dist = rockSize * (0.65 + seededRandom(seed + i * 7) * 0.35);
        const px = Math.cos(angle) * dist;
        const yScale = Math.abs(Math.cos(angle)) < 0.3 ? 0.4 : 0.55;
        const py = Math.sin(angle) * dist * yScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
}
