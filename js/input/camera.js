// ===== CAMERA CONTROL =====
// Pan, zoom, and viewport management

import { state, zoomLevelToScale, scaleToZoomLevel, getTileSize } from '../state.js';
import { hexToPixel } from '../hexMath.js';
import { render, resizeCanvas } from '../renderer.js';

/**
 * Limit camera to map boundaries
 */
export function limitCameraBounds() {
    const mapRadius = state.mapRadius || 12;
    const hexSize = getTileSize();
    const maxOffset = mapRadius * hexSize * 2;

    state.cameraX = Math.max(-maxOffset, Math.min(maxOffset, state.cameraX));
    state.cameraY = Math.max(-maxOffset, Math.min(maxOffset, state.cameraY));
}

/**
 * Update screen offset from camera position
 */
export function updateCameraOffset() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    const scale = zoomLevelToScale(state.zoomLevel);
    state.offsetX = canvas.width / 2 - state.cameraX * scale;
    state.offsetY = canvas.height / 2 - state.cameraY * scale;
}

/**
 * Center view on a specific unit
 */
export function centerOnUnit(unit) {
    if (!unit) return;

    const hexSize = getTileSize();
    const pos = hexToPixel(unit.q, unit.r, hexSize);

    state.cameraX = pos.x;
    state.cameraY = pos.y;

    limitCameraBounds();
    updateCameraOffset();
    render();
}

/**
 * Center view on current player's team
 */
export function centerOnTeam(playerIndex = state.currentPlayer) {
    const units = state.units.filter(u => u.player === playerIndex && u.alive);
    if (units.length === 0) return;

    const hexSize = getTileSize();
    let sumX = 0, sumY = 0;

    for (const unit of units) {
        const pos = hexToPixel(unit.q, unit.r, hexSize);
        sumX += pos.x;
        sumY += pos.y;
    }

    state.cameraX = sumX / units.length;
    state.cameraY = sumY / units.length;

    // Calculate appropriate zoom to show all units
    if (units.length > 1) {
        let maxDist = 0;
        for (const unit of units) {
            const pos = hexToPixel(unit.q, unit.r, hexSize);
            const dist = Math.sqrt(
                Math.pow(pos.x - state.cameraX, 2) +
                Math.pow(pos.y - state.cameraY, 2)
            );
            maxDist = Math.max(maxDist, dist);
        }

        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            const targetScale = Math.min(canvas.width, canvas.height) / (maxDist * 3);
            const targetZoom = scaleToZoomLevel(targetScale);
            state.zoomLevel = Math.max(0.5, Math.min(2, targetZoom));
        }
    }

    limitCameraBounds();
    updateCameraOffset();
    render();
}

/**
 * Apply zoom centered on a specific point
 */
export function applyZoom(delta, centerX, centerY) {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    const oldScale = zoomLevelToScale(state.zoomLevel);

    // Calculate new zoom level
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    state.zoomLevel = Math.max(0.3, Math.min(3, state.zoomLevel * zoomFactor));

    const newScale = zoomLevelToScale(state.zoomLevel);

    // Adjust camera to keep zoom centered on mouse position
    const worldX = (centerX - state.offsetX) / oldScale;
    const worldY = (centerY - state.offsetY) / oldScale;

    state.cameraX = worldX - (centerX - canvas.width / 2) / newScale;
    state.cameraY = worldY - (centerY - canvas.height / 2) / newScale;

    limitCameraBounds();
    updateCameraOffset();
    resizeCanvas();
    render();
}

/**
 * Smoothly scroll to a position
 */
export function scrollToPosition(targetX, targetY, duration = 500) {
    return new Promise(resolve => {
        const startX = state.cameraX;
        const startY = state.cameraY;
        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Easing function
            const eased = 1 - Math.pow(1 - progress, 3);

            state.cameraX = startX + (targetX - startX) * eased;
            state.cameraY = startY + (targetY - startY) * eased;

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
 * Smoothly scroll to center on a unit
 */
export function scrollToUnit(unit, duration = 500) {
    if (!unit) return Promise.resolve();

    const hexSize = getTileSize();
    const pos = hexToPixel(unit.q, unit.r, hexSize);

    return scrollToPosition(pos.x, pos.y, duration);
}

/**
 * Instantly snap camera to unit position
 */
export function followUnitInstant(unit) {
    if (!unit) return;

    const hexSize = getTileSize();
    const pos = hexToPixel(unit.q, unit.r, hexSize);

    state.cameraX = pos.x;
    state.cameraY = pos.y;

    limitCameraBounds();
    updateCameraOffset();
}

/**
 * Calculate appropriate zoom level based on unit distribution
 */
export function calculateSituationalZoom(units, padding = 1.5) {
    if (!units || units.length === 0) return state.zoomLevel;

    const hexSize = getTileSize();
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return state.zoomLevel;

    // Find bounding box of all units
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const unit of units) {
        const pos = hexToPixel(unit.q, unit.r, hexSize);
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
    }

    const width = (maxX - minX) * padding;
    const height = (maxY - minY) * padding;

    const scaleX = canvas.width / Math.max(width, 100);
    const scaleY = canvas.height / Math.max(height, 100);
    const targetScale = Math.min(scaleX, scaleY);

    return Math.max(0.5, Math.min(2, scaleToZoomLevel(targetScale)));
}

/**
 * Get relevant units for situational zoom
 */
export function getRelevantUnitsForZoom(focusUnit, viewingPlayer) {
    const relevantUnits = [focusUnit];

    // Add nearby enemies
    for (const unit of state.units) {
        if (!unit.alive) continue;
        if (unit.player === focusUnit.player) continue;

        const dx = unit.q - focusUnit.q;
        const dy = unit.r - focusUnit.r;
        const dist = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dx + dy));

        if (dist <= 6) {
            relevantUnits.push(unit);
        }
    }

    return relevantUnits;
}

/**
 * Smoothly scroll and zoom to show unit with context
 */
export async function scrollToUnitWithZoom(unit, duration = 500, targetZoom = null, relevantUnits = null) {
    if (!unit) return;

    const hexSize = getTileSize();
    const pos = hexToPixel(unit.q, unit.r, hexSize);

    // Calculate zoom if not specified
    if (targetZoom === null) {
        const units = relevantUnits || getRelevantUnitsForZoom(unit, state.viewingPlayer);
        targetZoom = calculateSituationalZoom(units);
    }

    // Animate both position and zoom
    const startX = state.cameraX;
    const startY = state.cameraY;
    const startZoom = state.zoomLevel;
    const startTime = performance.now();

    return new Promise(resolve => {
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - progress, 3);

            state.cameraX = startX + (pos.x - startX) * eased;
            state.cameraY = startY + (pos.y - startY) * eased;
            state.zoomLevel = startZoom + (targetZoom - startZoom) * eased;

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
 * Animate zoom level transition
 */
export function animateZoom(targetZoom, duration = 300) {
    const startZoom = state.zoomLevel;
    const startTime = performance.now();

    return new Promise(resolve => {
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - progress, 2);

            state.zoomLevel = startZoom + (targetZoom - startZoom) * eased;

            updateCameraOffset();
            resizeCanvas();
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
