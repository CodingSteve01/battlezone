// ===== EFFECTS RENDERER =====
// Height, lighting, and shadow effects for terrain rendering
// Extracted from renderer.js for better modularity

import { CONFIG, TERRAIN } from '../config.js';
import { getHex, getTileZOffset } from '../state.js';
import { getNeighbors } from '../hexMath.js';
import {
    safeRadialGradient,
    safeLinearGradient,
    desaturateAndDarken
} from './renderUtils.js';

// ===== MODULE STATE =====

let ctx = null;

/**
 * Initialize the effects renderer with canvas context
 * @param {CanvasRenderingContext2D} context - Canvas 2D context
 */
export function initEffectsRenderer(context) {
    ctx = context;
}

// ===== CONSTANTS =====

const HEIGHT_SHADE_COLORS = [
    { color: 'rgba(30, 58, 95, 0.12)', text: '#93c5fd' },  // Level 0: cool shadow
    { color: 'rgba(0, 0, 0, 0)', text: '#d1d5db' },        // Level 1: neutral
    { color: 'rgba(254, 240, 200, 0.12)', text: '#fde68a' }, // Level 2: warm highlight
    { color: 'rgba(253, 224, 160, 0.18)', text: '#fbbf24' }  // Level 3: bright highlight
];

const MIN_SKIRT_PIXELS = 20;

// ===== HEX PATH HELPER =====

/**
 * Draw a hexagonal path to the current context
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size (radius)
 */
export function drawHexPath(cx, cy, size) {
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

// ===== HEIGHT SHADE STYLES =====

/**
 * Get height shade style (color and text color) for a given height
 * @param {number} height - Height level (0-3)
 * @returns {{color: string, text: string}}
 */
export function getHeightShadeStyle(height) {
    const index = Math.max(0, Math.min(HEIGHT_SHADE_COLORS.length - 1, height ?? 0));
    return HEIGHT_SHADE_COLORS[index];
}

/**
 * Draw height-based shading overlay on a hex
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size
 * @param {number} height - Height level
 */
export function drawHeightShading(cx, cy, size, height) {
    const style = getHeightShadeStyle(height);
    if (!style || style.color === 'rgba(0, 0, 0, 0)') return;

    ctx.save();
    ctx.beginPath();
    drawHexPath(cx, cy, size);
    ctx.fillStyle = style.color;
    ctx.fill();
    ctx.restore();
}

// ===== LIGHTING VECTORS =====

/**
 * Get normalized light direction vector
 * @returns {{x: number, y: number}}
 */
export function getLightVector() {
    const dir = CONFIG.LIGHTING?.DIRECTION || { x: -0.6, y: -1.0 };
    const length = Math.hypot(dir.x, dir.y) || 1;
    return { x: dir.x / length, y: dir.y / length };
}

/**
 * Get view direction vector (opposite of light)
 * @returns {{x: number, y: number}}
 */
export function getViewVector() {
    const light = getLightVector();
    const length = Math.hypot(light.x, light.y) || 1;
    return { x: -light.x / length, y: -light.y / length };
}

/**
 * Check if a hex edge is facing the viewer
 * @param {number} direction - Edge direction (0-5)
 * @param {{x: number, y: number}} viewDir - View direction vector
 * @returns {boolean}
 */
export function isEdgeFacingViewer(direction, viewDir) {
    const faceAngle = (Math.PI / 3) * direction + Math.PI / 6;
    const faceDirX = Math.cos(faceAngle);
    const faceDirY = Math.sin(faceAngle);
    const dot = faceDirX * viewDir.x + faceDirY * viewDir.y;
    return dot > 0;
}

/**
 * Calculate shadow offset based on height and light position
 * @param {number} height - Height level
 * @param {number} size - Hex size
 * @returns {number}
 */
export function getShadowOffset(height, size) {
    const lightHeight = CONFIG.LIGHTING?.HEIGHT ?? 1.2;
    const zOffset = getTileZOffset(height, size);
    return zOffset * (0.6 + lightHeight * 0.4);
}

// ===== HEIGHT EXTRUSION / SKIRT =====

/**
 * Draw height extrusion (shadow underneath raised tiles)
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size
 * @param {number} height - Height level
 * @param {string} terrainType - Terrain type name
 * @param {string} fogLevel - Fog level ('visible', 'explored', 'hidden')
 */
export function drawHeightExtrusion(cx, cy, size, height, terrainType, fogLevel) {
    const offset = getTileZOffset(height, size);
    if (offset <= 0) return;

    ctx.save();
    ctx.beginPath();
    drawHexPath(cx, cy + offset, size);
    const fillColor = getSkirtFillColor(terrainType, fogLevel);
    ctx.fillStyle = fillColor;
    ctx.globalAlpha = fogLevel === 'visible' ? 0.85 : 1;
    ctx.fill();
    ctx.restore();
}

/**
 * Get base skirt depth in pixels
 * @param {number} size - Hex size
 * @returns {number}
 */
export function getBaseSkirtDepth(size) {
    return Math.max(MIN_SKIRT_PIXELS, size * 0.2);
}

/**
 * Get fill color for height skirt based on terrain and fog
 * @param {string} terrainType - Terrain type name
 * @param {string} fogLevel - Fog level
 * @returns {string}
 */
export function getSkirtFillColor(terrainType, fogLevel) {
    const terrain = TERRAIN[terrainType];
    const baseColor = terrain?.colorDark || terrain?.color || '#2f3b2e';

    if (fogLevel === 'hidden') {
        return desaturateAndDarken(baseColor, 0.3, 0.12);
    }

    if (fogLevel === 'explored') {
        return desaturateAndDarken(baseColor, 0.4, 0.25);
    }

    return desaturateAndDarken(baseColor, 0.7, 0.75);
}

/**
 * Draw base skirt for tile depth effect
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size
 * @param {string} terrainType - Terrain type
 * @param {string} fogLevel - Fog level
 */
export function drawBaseSkirt(cx, cy, size, terrainType, fogLevel) {
    const baseDepth = getBaseSkirtDepth(size);

    ctx.save();
    ctx.beginPath();
    drawHexPath(cx, cy + baseDepth, size);
    ctx.fillStyle = getSkirtFillColor(terrainType, fogLevel);
    ctx.fill();
    ctx.restore();
}

/**
 * Check if base skirt should be rendered for a hex
 * @param {Object} hex - Hex object with q, r, height
 * @returns {boolean}
 */
export function shouldRenderBaseSkirt(hex) {
    const neighbors = getNeighbors(hex.q, hex.r);
    const forwardDirections = [0, 4, 5];
    const myHeight = hex.height ?? 0;

    return forwardDirections.some(direction => {
        const neighbor = neighbors[direction];
        if (!neighbor) return true;
        const neighborHex = getHex(neighbor.q, neighbor.r);
        if (!neighborHex) return true;
        const neighborHeight = neighborHex.height ?? 0;
        return neighborHeight !== myHeight;
    });
}

// ===== CLIFF FACES =====

/**
 * Draw cliff/slope faces between tiles of different heights
 * Creates realistic earth/ground appearance with gradient shading
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size
 * @param {Object} hex - Hex object
 * @param {string} fogLevel - Fog level
 */
export function drawCliffFaces(cx, cy, size, hex, fogLevel) {
    if (!hex || hex.height === undefined) return;

    const myHeight = hex.height ?? 0;
    if (myHeight === 0) return;

    const neighbors = getNeighbors(hex.q, hex.r);
    const light = getLightVector();
    const viewDir = getViewVector();
    const terrain = TERRAIN[hex.type];

    const baseColor = terrain?.color || '#6a9a58';

    neighbors.forEach((neighbor, direction) => {
        if (!isEdgeFacingViewer(direction, viewDir)) return;
        const neighborHex = getHex(neighbor.q, neighbor.r);

        const neighborHeight = neighborHex?.height ?? 0;
        const heightDiff = myHeight - neighborHeight;

        if (heightDiff <= 0) return;

        const angle1 = (Math.PI / 3) * direction;
        const angle2 = (Math.PI / 3) * ((direction + 1) % 6);

        const myOffset = getTileZOffset(myHeight, size);
        const neighborOffset = getTileZOffset(neighborHeight, size);
        const faceHeight = myOffset - neighborOffset;

        const topX1 = cx + size * Math.cos(angle1);
        const topY1 = cy + size * Math.sin(angle1);
        const topX2 = cx + size * Math.cos(angle2);
        const topY2 = cy + size * Math.sin(angle2);

        const bottomX1 = topX1;
        const bottomY1 = topY1 + faceHeight;
        const bottomX2 = topX2;
        const bottomY2 = topY2 + faceHeight;

        const faceAngle = angle1 + Math.PI / 6;
        const faceDirX = Math.cos(faceAngle);
        const faceDirY = Math.sin(faceAngle);
        const lightDot = -(faceDirX * light.x + faceDirY * light.y);
        const lightFactor = Math.max(0.3, 0.6 + lightDot * 0.4);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(topX1, topY1);
        ctx.lineTo(topX2, topY2);
        ctx.lineTo(bottomX2, bottomY2);
        ctx.lineTo(bottomX1, bottomY1);
        ctx.closePath();

        const midX = (topX1 + topX2 + bottomX1 + bottomX2) / 4;
        const topY = Math.min(topY1, topY2);
        const bottomY = Math.max(bottomY1, bottomY2);

        let fogBrightnessFactor = 1.0;
        if (fogLevel === 'hidden') {
            fogBrightnessFactor = 0.12;
        } else if (fogLevel === 'explored') {
            fogBrightnessFactor = 0.25;
        }

        const gradient = safeLinearGradient(ctx, midX, topY, midX, bottomY, desaturateAndDarken(baseColor, 0.5, 0.5 * fogBrightnessFactor));
        if (typeof gradient !== 'string') {
            gradient.addColorStop(0, desaturateAndDarken(baseColor, 0.4, 0.65 * lightFactor * fogBrightnessFactor));
            gradient.addColorStop(0.4, desaturateAndDarken(baseColor, 0.55, 0.5 * lightFactor * fogBrightnessFactor));
            gradient.addColorStop(1, desaturateAndDarken(baseColor, 0.7, 0.35 * lightFactor * fogBrightnessFactor));
        }

        ctx.fillStyle = gradient;
        ctx.fill();

        if (fogLevel !== 'hidden') {
            ctx.beginPath();
            ctx.moveTo(topX1, topY1);
            ctx.lineTo(topX2, topY2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * lightFactor * fogBrightnessFactor})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    });
}

// ===== SHADOWS =====

/**
 * Draw height-based shadow for a hex
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size
 * @param {number} height - Height level
 */
export function drawHeightShadow(cx, cy, size, height) {
    const offset = getShadowOffset(height, size);
    if (offset <= 0) return;

    const light = getLightVector();
    ctx.save();
    ctx.globalAlpha = CONFIG.LIGHTING?.SHADOW_STRENGTH ?? 0.25;
    ctx.beginPath();
    drawHexPath(cx + light.x * offset, cy + light.y * offset + offset * 0.35, size * 0.98);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
    ctx.fill();
    ctx.restore();
}

/**
 * Apply lighting effect to a tile surface
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size
 * @param {number} height - Height level
 */
export function applyTileLighting(cx, cy, size, height) {
    if (!height) return;
    const light = getLightVector();
    const strength = (CONFIG.LIGHTING?.HIGHLIGHT_STRENGTH ?? 0.18) * 0.5;

    ctx.save();
    ctx.beginPath();
    drawHexPath(cx, cy, size);
    ctx.clip();

    const grad = safeRadialGradient(
        ctx,
        cx - light.x * size * 0.3,
        cy - light.y * size * 0.3,
        0,
        cx,
        cy,
        size,
        'transparent'
    );

    if (typeof grad !== 'string') {
        grad.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
        grad.addColorStop(0.5, `rgba(255, 255, 255, ${strength * 0.3})`);
        grad.addColorStop(1, 'transparent');
    }

    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
}

/**
 * Draw shadow for sprites (trees, bushes, etc.)
 * @param {number} x - Sprite center X
 * @param {number} y - Sprite center Y
 * @param {number} width - Sprite width
 * @param {number} height - Sprite height
 * @param {number} heightLevel - Height level (default 1)
 */
export function drawSpriteShadow(x, y, width, height, heightLevel = 1) {
    const light = getLightVector();
    const shadowOffset = getShadowOffset(heightLevel, width * 0.25);
    ctx.save();
    ctx.globalAlpha = CONFIG.LIGHTING?.SHADOW_STRENGTH ?? 0.25;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
    ctx.beginPath();
    ctx.ellipse(
        x + light.x * shadowOffset * 0.6,
        y + light.y * shadowOffset * 0.6 + height * 0.05,
        width * 0.2,
        height * 0.08,
        0,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
}

// ===== DEBUG OVERLAY =====

/**
 * Draw height debug overlay showing height value
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Hex size
 * @param {number} height - Height level
 */
export function drawHeightDebugOverlay(cx, cy, size, height) {
    const style = getHeightShadeStyle(height);
    ctx.save();
    ctx.beginPath();
    drawHexPath(cx, cy, size * 0.55);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fill();

    ctx.fillStyle = style.text;
    ctx.font = `bold ${Math.round(size * 0.32)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${height ?? 0}`, cx, cy);
    ctx.restore();
}
