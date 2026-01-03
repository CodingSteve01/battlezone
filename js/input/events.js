// ===== INPUT EVENT HANDLERS =====
// Mouse and touch event handling

import { state, getTileSize } from '../state.js';
import { render } from '../renderer.js';
import { limitCameraBounds, updateCameraOffset, applyZoom } from './camera.js';

// Event state
let isDragging = false;
let hasDragged = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartCameraX = 0;
let dragStartCameraY = 0;
let dragDistance = 0;

// Touch state
let isPinching = false;
let initialPinchDistance = 0;
let initialPinchCenter = { x: 0, y: 0 };
let lastTapTime = 0;

// Exported for other modules
export function getIsDragging() { return isDragging; }
export function getHasDragged() { return hasDragged; }

/**
 * Initialize all input event listeners
 */
export function initInputEvents(canvas) {
    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    // Prevent context menu on long press
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

/**
 * Handle mouse down event
 */
function handleMouseDown(e) {
    const rect = e.target.getBoundingClientRect();
    dragStartX = e.clientX - rect.left;
    dragStartY = e.clientY - rect.top;
    dragStartCameraX = state.cameraX;
    dragStartCameraY = state.cameraY;
    isDragging = true;
    hasDragged = false;
    dragDistance = 0;
}

/**
 * Handle mouse move event
 */
function handleMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
        const dx = x - dragStartX;
        const dy = y - dragStartY;
        dragDistance = Math.sqrt(dx * dx + dy * dy);

        if (dragDistance > 5) {
            hasDragged = true;

            const scale = state.zoomLevel || 1;
            state.cameraX = dragStartCameraX - dx / scale;
            state.cameraY = dragStartCameraY - dy / scale;

            limitCameraBounds();
            updateCameraOffset();
            render();
        }
    }
}

/**
 * Handle mouse up event
 */
function handleMouseUp(e) {
    const wasDragging = isDragging;
    const wasActualDrag = hasDragged;

    isDragging = false;

    if (wasDragging && !wasActualDrag) {
        // This was a click, not a drag
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Dispatch click event
        dispatchClickEvent(x, y);
    }

    hasDragged = false;
}

/**
 * Handle mouse wheel event
 */
function handleWheel(e) {
    e.preventDefault();

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    applyZoom(e.deltaY, x, y);
}

/**
 * Handle touch start event
 */
function handleTouchStart(e) {
    e.preventDefault();

    if (e.touches.length === 2) {
        // Pinch zoom start
        isPinching = true;
        initialPinchDistance = getPinchDistance(e.touches);
        initialPinchCenter = getPinchCenter(e.touches);
    } else if (e.touches.length === 1) {
        // Single touch - start drag
        const touch = e.touches[0];
        const rect = e.target.getBoundingClientRect();

        dragStartX = touch.clientX - rect.left;
        dragStartY = touch.clientY - rect.top;
        dragStartCameraX = state.cameraX;
        dragStartCameraY = state.cameraY;
        isDragging = true;
        hasDragged = false;
        dragDistance = 0;
    }
}

/**
 * Handle touch move event
 */
function handleTouchMove(e) {
    e.preventDefault();

    if (isPinching && e.touches.length === 2) {
        // Pinch zoom
        const newDistance = getPinchDistance(e.touches);
        const center = getPinchCenter(e.touches);

        const scale = newDistance / initialPinchDistance;
        const delta = scale > 1 ? -1 : 1;

        applyZoom(delta * 50, center.x, center.y);

        initialPinchDistance = newDistance;
    } else if (isDragging && e.touches.length === 1) {
        // Pan
        const touch = e.touches[0];
        const rect = e.target.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        const dx = x - dragStartX;
        const dy = y - dragStartY;
        dragDistance = Math.sqrt(dx * dx + dy * dy);

        if (dragDistance > 10) {
            hasDragged = true;

            const scale = state.zoomLevel || 1;
            state.cameraX = dragStartCameraX - dx / scale;
            state.cameraY = dragStartCameraY - dy / scale;

            limitCameraBounds();
            updateCameraOffset();
            render();
        }
    }
}

/**
 * Handle touch end event
 */
function handleTouchEnd(e) {
    if (isPinching) {
        isPinching = false;
        return;
    }

    const wasDragging = isDragging;
    const wasActualDrag = hasDragged;

    isDragging = false;
    hasDragged = false;

    if (wasDragging && !wasActualDrag) {
        // This was a tap
        const rect = e.target.getBoundingClientRect();
        const touch = e.changedTouches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Check for double tap
        const now = Date.now();
        if (now - lastTapTime < 300) {
            dispatchDoubleTapEvent(x, y);
        } else {
            dispatchClickEvent(x, y);
        }
        lastTapTime = now;
    }
}

/**
 * Calculate distance between two touch points
 */
function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate center between two touch points
 */
function getPinchCenter(touches) {
    const rect = document.getElementById('gameCanvas').getBoundingClientRect();
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
        y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
    };
}

/**
 * Dispatch click event to selection handler
 */
function dispatchClickEvent(x, y) {
    // Import dynamically to avoid circular deps
    import('./selection.js').then(module => {
        module.handleTapOrClick(x, y);
    });
}

/**
 * Dispatch double tap event
 */
function dispatchDoubleTapEvent(x, y) {
    import('./camera.js').then(module => {
        const currentUnit = state.units[state.selectedUnit];
        if (currentUnit) {
            module.centerOnUnit(currentUnit);
        }
    });
}
