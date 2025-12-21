// ===== INPUT HANDLING =====

import { state, getHex, getCurrentUnit } from './state.js';
import { pixelToHex } from './hexMath.js';
import { getReachableHexes, getPathToHex, findPath } from './pathfinding.js';
import { getAttackableUnits, moveUnit } from './units.js';
import { executeAttack, useSpecialAbility } from './combat.js';
import { checkWinCondition, endTurn } from './turns.js';
import { updateVisibility } from './fogOfWar.js';
import { updateUI, selectAction, showScreen } from './ui.js';
import { render, resizeCanvas } from './renderer.js';
import { CONFIG, TERRAIN } from './config.js';

let canvas;

// Scrolling/panning state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartCameraX = 0;
let dragStartCameraY = 0;
let lastTapTime = 0;
let hasDragged = false;

// Touch handling
let lastTouchDistance = 0;
let initialPinchDistance = 0;

/**
 * Initialize input handlers
 */
export function initInput() {
    canvas = document.getElementById('game-canvas');

    // Canvas interactions - mouse
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('click', handleCanvasClick);

    // Touch support
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Prevent context menu on long press
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse wheel for zooming (optional future feature)
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Menu buttons
    setupMenuButtons();

    // Action buttons
    setupActionButtons();

    // Window resize
    window.addEventListener('resize', () => {
        if (state.screen !== 'menu') resizeCanvas();
    });

    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (state.screen !== 'menu') resizeCanvas();
        }, 100);
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            if (state.screen !== 'menu') resizeCanvas();
        });
    }
}

/**
 * Handle mouse down for dragging
 */
function handleMouseDown(e) {
    if (state.gameOver || state.animating) return;

    isDragging = true;
    hasDragged = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartCameraX = state.cameraX;
    dragStartCameraY = state.cameraY;

    canvas.style.cursor = 'grabbing';
}

/**
 * Handle mouse move for dragging and path preview
 */
function handleMouseMove(e) {
    if (state.gameOver) return;

    if (isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        // Only count as drag if moved more than 5 pixels
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasDragged = true;
        }

        // Update camera position
        state.cameraX = dragStartCameraX + dx;
        state.cameraY = dragStartCameraY + dy;

        // Limit camera to map bounds
        limitCameraBounds();

        // Update offsets and re-render
        updateCameraOffset();
        render();
    } else {
        // Path preview when not dragging
        handlePathPreview(e.clientX, e.clientY);
    }
}

/**
 * Handle mouse up
 */
function handleMouseUp(e) {
    isDragging = false;
    canvas.style.cursor = 'grab';
}

/**
 * Handle touch start
 */
function handleTouchStart(e) {
    if (state.gameOver || state.animating) return;
    e.preventDefault();

    if (e.touches.length === 1) {
        // Single touch - start drag
        isDragging = true;
        hasDragged = false;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragStartCameraX = state.cameraX;
        dragStartCameraY = state.cameraY;
    } else if (e.touches.length === 2) {
        // Two finger touch - prepare for pinch zoom (future feature)
        isDragging = false;
        initialPinchDistance = getPinchDistance(e.touches);
    }
}

/**
 * Handle touch move
 */
function handleTouchMove(e) {
    if (state.gameOver) return;
    e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - dragStartX;
        const dy = e.touches[0].clientY - dragStartY;

        // Only count as drag if moved more than 10 pixels (more forgiving on touch)
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            hasDragged = true;
        }

        // Update camera position
        state.cameraX = dragStartCameraX + dx;
        state.cameraY = dragStartCameraY + dy;

        // Limit camera to map bounds
        limitCameraBounds();

        // Update offsets and re-render
        updateCameraOffset();
        render();
    } else if (e.touches.length === 2) {
        // Two finger pinch - future zoom feature
        const currentDistance = getPinchDistance(e.touches);
        // Could implement zoom here
    }
}

/**
 * Handle touch end
 */
function handleTouchEnd(e) {
    if (state.gameOver || state.animating) return;
    e.preventDefault();

    // Check for tap (not drag)
    if (!hasDragged && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];

        // Double tap detection for centering
        const now = Date.now();
        if (now - lastTapTime < 300) {
            // Double tap - center on current unit
            centerOnCurrentUnit();
            lastTapTime = 0;
            isDragging = false;
            return;
        }
        lastTapTime = now;

        // Single tap - handle as click
        handleTapOrClick(touch.clientX, touch.clientY);
    }

    isDragging = false;
    hasDragged = false;
}

/**
 * Get distance between two touch points
 */
function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Limit camera to reasonable bounds
 */
function limitCameraBounds() {
    const radius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    const maxOffset = radius * state.hexSize * 1.5;

    state.cameraX = Math.max(-maxOffset, Math.min(maxOffset, state.cameraX));
    state.cameraY = Math.max(-maxOffset, Math.min(maxOffset, state.cameraY));
}

/**
 * Update camera offset after panning
 */
function updateCameraOffset() {
    const container = canvas?.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    state.offsetX = rect.width / 2 + state.cameraX;
    state.offsetY = rect.height / 2 + state.cameraY;
}

/**
 * Center view on current unit
 */
export function centerOnCurrentUnit() {
    const unit = getCurrentUnit();
    if (!unit) return;

    // Calculate where unit should be
    const hexSize = state.hexSize;
    const unitX = hexSize * (3/2 * unit.q);
    const unitY = hexSize * (Math.sqrt(3)/2 * unit.q + Math.sqrt(3) * unit.r);

    // Set camera to center on unit
    state.cameraX = -unitX;
    state.cameraY = -unitY;

    updateCameraOffset();
    render();
}

/**
 * Handle mouse wheel for potential zoom
 */
function handleWheel(e) {
    e.preventDefault();
    // Could implement zoom here in the future
    // For now, use wheel for panning
    state.cameraX -= e.deltaX * 0.5;
    state.cameraY -= e.deltaY * 0.5;
    limitCameraBounds();
    updateCameraOffset();
    render();
}

/**
 * Handle canvas click (after checking for drag)
 */
function handleCanvasClick(e) {
    if (state.gameOver || state.animating) return;

    // Don't handle click if we were dragging
    if (hasDragged) {
        hasDragged = false;
        return;
    }

    handleTapOrClick(e.clientX, e.clientY);
}

/**
 * Handle tap or click at position
 */
function handleTapOrClick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();

    const x = clientX - rect.left - state.offsetX;
    const y = clientY - rect.top - state.offsetY;

    const hexCoord = pixelToHex(x, y, state.hexSize);
    const hex = getHex(hexCoord.q, hexCoord.r);
    if (!hex) return;

    const unit = getCurrentUnit();
    if (!unit) return;

    if (state.selectedAction === 'move') {
        handleMoveClick(unit, hex);
    } else if (state.selectedAction === 'attack') {
        handleAttackClick(unit, hex);
    }
}

/**
 * Handle path preview on hover
 */
function handlePathPreview(clientX, clientY) {
    if (state.gameOver || state.selectedAction !== 'move') return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - state.offsetX;
    const y = clientY - rect.top - state.offsetY;

    const hexCoord = pixelToHex(x, y, state.hexSize);
    const hex = getHex(hexCoord.q, hexCoord.r);

    state.hoveredHex = hex;

    // Update path preview - now showing full path even beyond AP
    const unit = getCurrentUnit();
    if (unit && hex && hex.walkable && !hex.unit) {
        // Try to find path to hex (even if beyond current AP)
        const maxPossibleCost = unit.move * 3; // Allow showing path beyond current AP
        const pathResult = findPath(unit.q, unit.r, hex.q, hex.r, maxPossibleCost);

        if (pathResult && pathResult.path) {
            state.currentPath = pathResult.path;
        } else {
            // Try reachable hexes as fallback
            const reachable = getReachableHexes(unit);
            const hexKey = `${hex.q},${hex.r}`;
            const pathData = reachable.get(hexKey);

            if (pathData && pathData.path) {
                state.currentPath = pathData.path;
            } else {
                state.currentPath = null;
            }
        }
    } else {
        state.currentPath = null;
    }

    render();
}

/**
 * Handle move action click
 */
function handleMoveClick(unit, hex) {
    // First check if hex is directly reachable
    const reachable = getReachableHexes(unit);
    const hexKey = `${hex.q},${hex.r}`;
    const pathData = reachable.get(hexKey);

    if (pathData) {
        // Direct move - hex is within AP range
        moveUnit(unit, pathData.hex, pathData.cost);
        state.currentPath = null;

        // Update visibility after move
        updateVisibility();

        render();
        updateUI();
    } else {
        // Check if we can move partially along the path
        const maxMoveCost = Math.min(unit.ap, unit.move);
        const maxPossibleCost = unit.move * 3;
        const pathResult = findPath(unit.q, unit.r, hex.q, hex.r, maxPossibleCost);

        if (pathResult && pathResult.path && pathResult.path.length > 1) {
            // Find the furthest hex we can reach along this path
            let cumulativeCost = 0;
            let targetHex = null;
            let targetCost = 0;

            for (let i = 1; i < pathResult.path.length; i++) {
                const point = pathResult.path[i];
                const pointHex = getHex(point.q, point.r);
                if (!pointHex) break;

                const terrain = TERRAIN[pointHex.type];
                cumulativeCost += terrain.moveCost;

                if (cumulativeCost <= maxMoveCost && !pointHex.unit) {
                    targetHex = pointHex;
                    targetCost = cumulativeCost;
                } else {
                    break;
                }
            }

            // Move to the furthest reachable hex along the path
            if (targetHex && targetCost > 0) {
                moveUnit(unit, targetHex, targetCost);
                state.currentPath = null;
                updateVisibility();
                render();
                updateUI();
            }
        }
    }
}

/**
 * Handle attack action click
 */
function handleAttackClick(unit, hex) {
    if (hex.unit && hex.unit.player !== unit.player && hex.unit.alive) {
        const attackable = getAttackableUnits(unit);
        const canAttack = attackable.some(u => u.id === hex.unit.id);

        if (canAttack) {
            if (state.targetedUnit && state.targetedUnit.id === hex.unit.id) {
                // Confirm attack (second click)
                const result = executeAttack(unit, hex.unit);

                state.targetedUnit = null;

                if (result.killed) {
                    checkWinCondition();
                }

                render();
                updateUI();
            } else {
                // Target unit (first click)
                state.targetedUnit = hex.unit;
                render();
                updateUI();
            }
        }
    } else {
        // Clicked empty hex - deselect target
        state.targetedUnit = null;
        render();
        updateUI();
    }
}

/**
 * Setup menu buttons
 */
function setupMenuButtons() {
    // Player count buttons
    document.querySelectorAll('[data-players]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('[data-players]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.settings.players = parseInt(btn.dataset.players);
        };
    });

    // Map size buttons
    document.querySelectorAll('[data-size]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('[data-size]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.settings.size = btn.dataset.size;
        };
    });

    // Ready button (turn screen)
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
        readyBtn.onclick = () => {
            showScreen(null);
            updateVisibility();
            updateUI();

            // Center on current unit when turn starts
            setTimeout(() => {
                centerOnCurrentUnit();
            }, 100);
        };
    }

    // End turn button
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.onclick = endTurn;
    }

    // Game over buttons
    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn) {
        menuBtn.onclick = () => showScreen('menu');
    }
}

/**
 * Setup action buttons
 */
function setupActionButtons() {
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.onclick = () => {
            const action = btn.dataset.action;

            if (action === 'special') {
                const unit = getCurrentUnit();
                if (unit && unit.ap >= 2 && !unit.usedSpecial) {
                    useSpecialAbility(unit);
                    render();
                    updateUI();
                }
            } else {
                selectAction(action);
            }
        };
    });
}
