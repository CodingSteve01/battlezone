// ===== CAMERA AND ZOOM STATE =====
// Functions for zoom levels, tile sizing, and screen positioning
// Extracted from state.js for better modularity

import { CONFIG } from '../config.js';
import { hexToPixel } from '../hexMath.js';

// Reference zoom level for scale calculations
export const ZOOM_REFERENCE = 0.45;

/**
 * Convert zoom level to scale factor
 * @param {number} zoomLevel - The zoom level
 * @returns {number} Scale factor
 */
export function zoomLevelToScale(zoomLevel) {
    const safeZoom = Number.isFinite(zoomLevel) ? zoomLevel : ZOOM_REFERENCE;
    return safeZoom / ZOOM_REFERENCE;
}

/**
 * Convert scale factor to zoom level
 * @param {number} scale - The scale factor
 * @returns {number} Zoom level
 */
export function scaleToZoomLevel(scale) {
    const safeScale = Number.isFinite(scale) ? scale : 1;
    return safeScale * ZOOM_REFERENCE;
}

/**
 * Get the current world scale based on hex size
 * @param {object} state - The game state object
 * @returns {number} World scale factor
 */
export function getWorldScale(state) {
    const baseSize = CONFIG.BASE_HEX_SIZE * CONFIG.HEX_SIZE_SCALE;
    const scale = baseSize > 0 ? state.hexSize / baseSize : 1;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * Get the tile scale from config
 * @returns {number} Tile scale factor
 */
export function getTileScale() {
    const scale = Number.isFinite(CONFIG.TILE_SCALE) && CONFIG.TILE_SCALE > 0 ? CONFIG.TILE_SCALE : 1;
    return scale;
}

/**
 * Get current tile size based on hex size and scale
 * @param {object} state - The game state object
 * @returns {number} Tile size in pixels
 */
export function getTileSize(state) {
    return state.hexSize * getTileScale();
}

/**
 * Get tile size for a specific hex size
 * @param {number} hexSize - The hex size to calculate for
 * @returns {number} Tile size in pixels
 */
export function getTileSizeForHexSize(hexSize) {
    const baseSize = Number.isFinite(hexSize) && hexSize > 0 ? hexSize : CONFIG.BASE_HEX_SIZE;
    return baseSize * getTileScale();
}

/**
 * Calculate vertical offset for a tile at a given height
 * @param {number} height - The terrain height
 * @param {number} hexSize - The hex size (defaults to tile size)
 * @returns {number} Vertical offset in pixels
 */
export function getTileZOffset(height, hexSize) {
    const level = Math.max(0, height ?? 0);
    return level * hexSize * 0.18;
}

/**
 * Get screen position for a tile including height offset
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @param {number} height - Terrain height
 * @param {number} hexSize - The hex size
 * @returns {{x: number, y: number, zOffset: number}} Screen position
 */
export function getTileScreenPosition(q, r, height, hexSize) {
    const pos = hexToPixel(q, r, hexSize);
    const zOffset = getTileZOffset(height, hexSize);
    return { x: pos.x, y: pos.y - zOffset, zOffset };
}

// Default zoom limits
export const DEFAULT_MIN_ZOOM = scaleToZoomLevel(0.6);
export const DEFAULT_MAX_ZOOM = scaleToZoomLevel(1.2);
