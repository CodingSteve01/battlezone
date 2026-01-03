// ===== CAMERA CONTROL =====
// Camera movement, zoom, and unit following

import { state, getHex, getPlayerUnits, zoomLevelToScale, scaleToZoomLevel, getTileSize, getTileSizeForHexSize, getTileZOffset, getTileScreenPosition } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { render, resizeCanvas } from '../renderer.js';
import { CONFIG } from '../config.js';

// Camera helpers - these need canvas reference
let canvas = null;

/**
 * Initialize camera module with canvas reference
 */
export function initCamera(canvasRef) {
    canvas = canvasRef;
}

/**
 * Get unit position in tile coordinates
 */
export function getUnitTilePosition(unit, tileSize = getTileSize()) {
    const hex = getHex(unit.q, unit.r);
    return getTileScreenPosition(unit.q, unit.r, hex?.height ?? 0, tileSize);
}

/**
 * Update camera offset from camera position
 */
export function updateCameraOffset() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    state.offsetX = Math.round(state.cameraX + rect.width / 2);
    state.offsetY = Math.round(state.cameraY + rect.height / 2);
}

/**
 * Limit camera bounds to map extents
 */
export function limitCameraBounds() {
    if (!canvas) return;

    const hexCount = state.hexes.length;
    if (hexCount === 0) return;

    const tileSize = getTileSize();
    const rect = canvas.getBoundingClientRect();
    const padding = tileSize * 2;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const hex of state.hexes) {
        const pos = getTileScreenPosition(hex.q, hex.r, hex.height ?? 0);
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
    }

    const mapWidth = maxX - minX + padding * 2;
    const mapHeight = maxY - minY + padding * 2;
    const mapCenterX = (minX + maxX) / 2;
    const mapCenterY = (minY + maxY) / 2;

    const maxCameraX = Math.max(0, (mapWidth - rect.width) / 2);
    const maxCameraY = Math.max(0, (mapHeight - rect.height) / 2);

    state.cameraX = Math.max(-maxCameraX - mapCenterX, Math.min(maxCameraX - mapCenterX, state.cameraX));
    state.cameraY = Math.max(-maxCameraY - mapCenterY, Math.min(maxCameraY - mapCenterY, state.cameraY));
}

/**
 * Apply zoom centered on screen position
 */
export function applyZoom(zoomDelta, screenX, screenY) {
    if (!canvas) return;

    const oldZoom = Number.isFinite(state.zoomLevel) && state.zoomLevel > 0 ? state.zoomLevel : scaleToZoomLevel(1.0);
    const newZoom = Math.max(state.minZoom, Math.min(state.maxZoom, oldZoom + zoomDelta));

    if (newZoom === oldZoom) return;

    const rect = canvas.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;
    const relX = screenX - rect.left - canvasCenterX;
    const relY = screenY - rect.top - canvasCenterY;

    const zoomRatio = newZoom / oldZoom;

    state.cameraX = relX * (1 - zoomRatio) + state.cameraX * zoomRatio;
    state.cameraY = relY * (1 - zoomRatio) + state.cameraY * zoomRatio;

    state.zoomLevel = newZoom;

    updateCameraOffset();
    resizeCanvas();
    limitCameraBounds();
    updateCameraOffset();
}

/**
 * Calculate optimal zoom to show all relevant units
 */
export function calculateSituationalZoom(focusUnit, relevantUnits = []) {
    if (!focusUnit || !canvas) return scaleToZoomLevel(0.85);

    const unitsToShow = [focusUnit, ...relevantUnits].filter(u => u && u.hp > 0);

    if (unitsToShow.length <= 1) {
        return scaleToZoomLevel(0.9);
    }

    let minQ = Infinity, maxQ = -Infinity;
    let minR = Infinity, maxR = -Infinity;

    for (const unit of unitsToShow) {
        minQ = Math.min(minQ, unit.q);
        maxQ = Math.max(maxQ, unit.q);
        minR = Math.min(minR, unit.r);
        maxR = Math.max(maxR, unit.r);
    }

    const spreadQ = maxQ - minQ;
    const spreadR = maxR - minR;
    const maxSpread = Math.max(spreadQ, spreadR);

    const viewportWidth = canvas.width || 800;
    const viewportHeight = canvas.height || 600;
    const minViewportDim = Math.min(viewportWidth, viewportHeight);

    const hexPixelSize = getTileSizeForHexSize(CONFIG.BASE_HEX_SIZE) * 2;
    const requiredPixels = (maxSpread + 2) * hexPixelSize;

    const zoomToFit = minViewportDim / requiredPixels;

    const minZoom = zoomLevelToScale(state.minZoom || 0.5);
    const maxZoom = Math.min(zoomLevelToScale(state.maxZoom || 2.0), 1.0);

    const clampedScale = Math.max(minZoom, Math.min(maxZoom, zoomToFit * 0.8));
    return scaleToZoomLevel(clampedScale);
}

/**
 * Get units relevant for situational zoom
 */
export function getRelevantUnitsForZoom(activeUnit, playerIndex) {
    if (!activeUnit) return [];

    const relevantUnits = [];
    const maxRelevantDistance = 8;

    for (const unit of state.units) {
        if (unit === activeUnit || unit.hp <= 0) continue;

        const dist = hexDistance(activeUnit, unit);
        if (dist > maxRelevantDistance) continue;

        if (unit.player !== activeUnit.player) {
            const hex = getHex(unit.q, unit.r);
            if (hex && hex.visible && hex.visible[playerIndex]) {
                relevantUnits.push(unit);
            }
        } else if (dist <= 4) {
            relevantUnits.push(unit);
        }
    }

    return relevantUnits;
}

/**
 * Smoothly scroll to a position
 */
export function scrollToPosition(targetCameraX, targetCameraY, duration = 300) {
    return new Promise(resolve => {
        const startCameraX = state.cameraX;
        const startCameraY = state.cameraY;
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);
            const ease = 1 - Math.pow(1 - progress, 3);

            state.cameraX = startCameraX + (targetCameraX - startCameraX) * ease;
            state.cameraY = startCameraY + (targetCameraY - startCameraY) * ease;

            limitCameraBounds();
            updateCameraOffset();
            render();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(animate);
    });
}

/**
 * Smoothly scroll to unit
 */
export function scrollToUnit(unit, duration = 500) {
    if (!unit) return;

    const targetPos = getUnitTilePosition(unit);
    return scrollToPosition(-targetPos.x, -targetPos.y, duration);
}

/**
 * Instantly follow a unit
 */
export function followUnitInstant(unit) {
    if (!unit) return;

    const targetPos = getUnitTilePosition(unit);
    state.cameraX = -targetPos.x;
    state.cameraY = -targetPos.y;

    limitCameraBounds();
    updateCameraOffset();
}

/**
 * Scroll to unit with dynamic zoom
 */
export function scrollToUnitWithZoom(unit, duration = 600, targetZoom = null, relevantUnits = null) {
    return new Promise(resolve => {
        if (!unit) {
            resolve();
            return;
        }

        const safeCurrentZoom = Number.isFinite(state.zoomLevel) && state.zoomLevel > 0 ? state.zoomLevel : scaleToZoomLevel(1.0);

        let idealZoom;
        if (targetZoom !== null) {
            idealZoom = targetZoom;
        } else if (relevantUnits !== null) {
            idealZoom = calculateSituationalZoom(unit, relevantUnits);
        } else {
            idealZoom = safeCurrentZoom;
        }

        const minZoom = state.minZoom || 0.5;
        const maxZoom = state.maxZoom || 2.0;
        const clampedZoom = Math.min(Math.max(idealZoom, minZoom), maxZoom);

        const targetHexSize = CONFIG.BASE_HEX_SIZE * zoomLevelToScale(clampedZoom);
        const targetTileSize = getTileSizeForHexSize(targetHexSize);
        const targetPos = getUnitTilePosition(unit, targetTileSize);
        const targetCameraX = -targetPos.x;
        const targetCameraY = -targetPos.y;

        const startCameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
        const startCameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;
        const startZoom = safeCurrentZoom;
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            state.zoomLevel = startZoom + (clampedZoom - startZoom) * ease;
            state.hexSize = CONFIG.BASE_HEX_SIZE * zoomLevelToScale(state.zoomLevel);

            const currentPos = getUnitTilePosition(unit);
            state.cameraX = startCameraX + (-currentPos.x - startCameraX) * ease;
            state.cameraY = startCameraY + (-currentPos.y - startCameraY) * ease;

            limitCameraBounds();
            updateCameraOffset();
            render();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(animate);
    });
}

/**
 * Center view on team with situational zoom
 */
export function centerOnTeam(playerIndex, duration = 600) {
    return new Promise(resolve => {
        const playerUnits = getPlayerUnits(playerIndex);

        if (playerUnits.length === 0) {
            resolve();
            return;
        }

        const visibleEnemies = [];
        for (const unit of state.units) {
            if (unit.player === playerIndex || unit.hp <= 0) continue;
            const hex = getHex(unit.q, unit.r);
            if (hex && hex.visible && hex.visible[playerIndex]) {
                visibleEnemies.push(unit);
            }
        }

        const referenceUnit = playerUnits[0];
        const allRelevantUnits = [...playerUnits.slice(1), ...visibleEnemies];
        const situationalZoom = calculateSituationalZoom(referenceUnit, allRelevantUnits);
        const situationalScale = zoomLevelToScale(situationalZoom);

        const targetZoomScale = Math.max(0.7, Math.min(0.95, situationalScale));
        const targetZoom = scaleToZoomLevel(targetZoomScale);
        const targetHexSize = CONFIG.BASE_HEX_SIZE * zoomLevelToScale(targetZoom);
        const targetTileSize = getTileSizeForHexSize(targetHexSize);

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const unit of playerUnits) {
            const pos = getUnitTilePosition(unit, targetTileSize);
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        }

        const startCameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
        const startCameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;
        const startZoom = Number.isFinite(state.zoomLevel) && state.zoomLevel > 0 ? state.zoomLevel : scaleToZoomLevel(1.0);
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            state.zoomLevel = startZoom + (targetZoom - startZoom) * ease;
            state.hexSize = CONFIG.BASE_HEX_SIZE * zoomLevelToScale(state.zoomLevel);

            let newMinX = Infinity, newMaxX = -Infinity;
            let newMinY = Infinity, newMaxY = -Infinity;

            for (const unit of playerUnits) {
                const pos = getUnitTilePosition(unit);
                newMinX = Math.min(newMinX, pos.x);
                newMaxX = Math.max(newMaxX, pos.x);
                newMinY = Math.min(newMinY, pos.y);
                newMaxY = Math.max(newMaxY, pos.y);
            }

            const newCenterX = (newMinX + newMaxX) / 2;
            const newCenterY = (newMinY + newMaxY) / 2;

            state.cameraX = startCameraX + (-newCenterX - startCameraX) * ease;
            state.cameraY = startCameraY + (-newCenterY - startCameraY) * ease;

            limitCameraBounds();
            updateCameraOffset();
            render();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(animate);
    });
}
