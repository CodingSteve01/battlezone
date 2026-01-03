// ===== INPUT EVENT HANDLERS =====
// Mouse and touch event handling for camera panning, zooming, and hex selection

import { state, getHex, scaleToZoomLevel, getTileSize, getTileSizeForHexSize, getTileZOffset } from '../state.js';
import { pixelToHex } from '../hexMath.js';
import { render, resizeCanvas, isMinimapExpanded } from '../renderer.js';
import { CONFIG } from '../config.js';

// Drag/pan state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartCameraX = 0;
let dragStartCameraY = 0;
let lastTapTime = 0;
let hasDragged = false;
let dragDistance = 0;

// Pinch-to-zoom state
let isPinching = false;
let initialPinchDistance = 0;
let initialZoomLevel = 1.0;
let initialPinchCenter = null;
let initialCameraX = 0;
let initialCameraY = 0;

// Canvas reference
let canvas = null;

/**
 * Initialize handlers module with canvas reference
 * @param {HTMLCanvasElement} canvasRef - The game canvas
 */
export function initHandlers(canvasRef) {
    canvas = canvasRef;
}

/**
 * Get canvas reference
 * @returns {HTMLCanvasElement|null}
 */
export function getCanvas() {
    return canvas;
}

/**
 * Convert pixel coordinates to hex, accounting for height
 */
export function pixelToHexWithHeight(x, y) {
    const tileSize = getTileSize();
    const rough = pixelToHex(x, y, tileSize);
    const roughHex = getHex(rough.q, rough.r);
    if (!roughHex) return rough;

    const adjustedY = y + getTileZOffset(roughHex.height, tileSize);
    return pixelToHex(x, adjustedY, tileSize);
}

/**
 * Get current drag state
 * @returns {Object} Drag state information
 */
export function getDragState() {
    return {
        isDragging,
        hasDragged,
        dragDistance,
        lastTapTime
    };
}

/**
 * Check if currently dragging
 * @returns {boolean}
 */
export function getIsDragging() {
    return isDragging;
}

/**
 * Check if drag has occurred
 * @returns {boolean}
 */
export function getHasDragged() {
    return hasDragged;
}

/**
 * Get last tap time for double-tap detection
 * @returns {number}
 */
export function getLastTapTime() {
    return lastTapTime;
}

/**
 * Set last tap time
 * @param {number} time
 */
export function setLastTapTime(time) {
    lastTapTime = time;
}

/**
 * Reset drag state
 */
export function resetDragState() {
    isDragging = false;
    hasDragged = false;
    dragDistance = 0;
}

/**
 * Handle mouse down for dragging
 * @param {MouseEvent} e
 * @param {Function} limitCameraBounds
 * @param {Function} updateCameraOffset
 */
export function handleMouseDown(e) {
    if (state.gameOver || state.animating) return;

    isDragging = true;
    hasDragged = false;
    dragDistance = 0;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartCameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
    dragStartCameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;

    if (canvas) {
        canvas.style.cursor = 'grabbing';
    }
}

/**
 * Handle mouse move for dragging and path preview
 * @param {MouseEvent} e
 * @param {Function} limitCameraBounds
 * @param {Function} updateCameraOffset
 */
export function handleMouseMove(e, limitCameraBounds, updateCameraOffset) {
    if (state.gameOver) return;

    // Block camera panning when minimap is expanded
    if (isMinimapExpanded()) {
        return;
    }

    if (isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        dragDistance = Math.sqrt(dx * dx + dy * dy);

        // Only count as drag if moved more than 8 pixels
        if (dragDistance > 8) {
            hasDragged = true;

            state.cameraX = dragStartCameraX + dx;
            state.cameraY = dragStartCameraY + dy;

            limitCameraBounds();
            updateCameraOffset();
            render();
        }
    }
}

/**
 * Handle mouse up
 * @param {MouseEvent} e
 * @param {Function} onTapOrClick - Callback for tap/click handling
 */
export function handleMouseUp(e, onTapOrClick) {
    if (isDragging && !hasDragged && onTapOrClick) {
        onTapOrClick(e.clientX, e.clientY);
    }

    isDragging = false;
    hasDragged = false;
    dragDistance = 0;

    if (canvas) {
        canvas.style.cursor = 'grab';
    }
}

/**
 * Calculate distance between two touch points
 * @param {TouchList} touches
 * @returns {number}
 */
export function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get center point between two touches
 * @param {TouchList} touches
 * @returns {{x: number, y: number}}
 */
export function getPinchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

/**
 * Handle touch start
 * @param {TouchEvent} e
 */
export function handleTouchStart(e) {
    if (state.gameOver || state.animating) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.touches.length === 2) {
        // Two finger touch - start pinch zoom
        isPinching = true;
        isDragging = false;
        initialPinchDistance = getPinchDistance(e.touches);
        initialZoomLevel = Number.isFinite(state.zoomLevel) && state.zoomLevel > 0 ? state.zoomLevel : scaleToZoomLevel(1.0);
        initialCameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
        initialCameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;

        // Store initial pinch center for consistent zoom point
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const center = getPinchCenter(e.touches);
            initialPinchCenter = {
                x: center.x - rect.left - rect.width / 2,
                y: center.y - rect.top - rect.height / 2
            };
        }
    } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        isDragging = true;
        isPinching = false;
        hasDragged = false;
        dragDistance = 0;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        dragStartCameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
        dragStartCameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;
    }
}

/**
 * Handle touch move
 * @param {TouchEvent} e
 * @param {Function} limitCameraBounds
 * @param {Function} updateCameraOffset
 */
export function handleTouchMove(e, limitCameraBounds, updateCameraOffset) {
    if (state.gameOver) return;

    e.preventDefault();
    e.stopPropagation();

    // Block camera panning/zooming when minimap is expanded
    if (isMinimapExpanded()) {
        return;
    }

    if (e.touches.length === 2 && isPinching && initialPinchCenter) {
        // Handle pinch zoom
        const currentDistance = getPinchDistance(e.touches);
        const scale = currentDistance / initialPinchDistance;
        const newZoom = Math.max(state.minZoom, Math.min(state.maxZoom, initialZoomLevel * scale));

        if (newZoom !== state.zoomLevel) {
            const relX = initialPinchCenter.x;
            const relY = initialPinchCenter.y;

            const zoomRatio = newZoom / initialZoomLevel;

            state.cameraX = relX * (1 - zoomRatio) + initialCameraX * zoomRatio;
            state.cameraY = relY * (1 - zoomRatio) + initialCameraY * zoomRatio;

            state.zoomLevel = newZoom;

            updateCameraOffset();
            resizeCanvas();
            limitCameraBounds();
            updateCameraOffset();
        }
    } else if (e.touches.length === 1 && isDragging && !isPinching) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;
        dragDistance = Math.sqrt(dx * dx + dy * dy);

        // Lower threshold for touch - 15 pixels
        if (dragDistance > 15) {
            hasDragged = true;

            state.cameraX = dragStartCameraX + dx;
            state.cameraY = dragStartCameraY + dy;

            limitCameraBounds();
            updateCameraOffset();
            render();
        }
    }
}

/**
 * Handle touch end
 * @param {TouchEvent} e
 * @param {Function} onTapOrClick - Callback for tap/click handling
 * @param {Function} onDoubleTap - Callback for double-tap handling
 */
export function handleTouchEnd(e, onTapOrClick, onDoubleTap) {
    if (state.gameOver || state.animating) return;

    e.preventDefault();
    e.stopPropagation();

    // If we were pinching and now have one finger, switch to drag
    if (isPinching && e.touches.length === 1) {
        isPinching = false;
        initialPinchCenter = null;
        isDragging = true;
        hasDragged = true; // Prevent accidental tap
        const touch = e.touches[0];
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        dragStartCameraX = state.cameraX;
        dragStartCameraY = state.cameraY;
        return;
    }

    // Get the touch that ended
    const touch = e.changedTouches[0];
    if (!touch) {
        isDragging = false;
        isPinching = false;
        hasDragged = false;
        return;
    }

    // Check for tap (not drag, not pinch)
    if (!hasDragged && !isPinching && dragDistance < 15) {
        // Double tap detection
        const now = Date.now();
        if (now - lastTapTime < 350 && onDoubleTap) {
            onDoubleTap();
            lastTapTime = 0;
        } else {
            lastTapTime = now;
            if (onTapOrClick) {
                onTapOrClick(touch.clientX, touch.clientY);
            }
        }
    }

    isDragging = false;
    isPinching = false;
    initialPinchCenter = null;
    hasDragged = false;
    dragDistance = 0;
}

/**
 * Handle mouse wheel for zooming and scrolling
 * @param {WheelEvent} e
 * @param {Function} applyZoom
 * @param {Function} limitCameraBounds
 * @param {Function} updateCameraOffset
 */
export function handleWheel(e, applyZoom, limitCameraBounds, updateCameraOffset) {
    e.preventDefault();

    // Block zoom/scroll when minimap is expanded
    if (isMinimapExpanded()) {
        return;
    }

    // Check if ctrl/meta is held for zoom, otherwise pan
    if (e.ctrlKey || e.metaKey) {
        // Zoom with ctrl+scroll
        const zoomDelta = -e.deltaY * 0.002;
        applyZoom(zoomDelta, e.clientX, e.clientY);
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal scrolling - pan
        state.cameraX -= e.deltaX;
        limitCameraBounds();
        updateCameraOffset();
        render();
    } else {
        // Vertical scrolling - zoom
        const zoomDelta = -e.deltaY * 0.001;
        applyZoom(zoomDelta, e.clientX, e.clientY);
    }
}
