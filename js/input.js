// ===== INPUT HANDLING =====

import { state, getHex, getCurrentUnit } from './state.js';
import { pixelToHex, hexToPixel } from './hexMath.js';
import { getReachableHexes, getPathToHex, findPath } from './pathfinding.js';
import { getAttackableUnits, moveUnit, animateUnitMovement } from './units.js';
import { executeAttack, useSpecialAbility } from './combat.js';
import { checkWinCondition, endTurn } from './turns.js';
import { updateVisibility } from './fogOfWar.js';
import { updateUI, selectAction, showScreen, showToast, showPowerupPickup } from './ui.js';
import { render, resizeCanvas } from './renderer.js';
import { CONFIG, TERRAIN } from './config.js';
import { checkPowerupPickup, POWERUP_TYPES } from './powerups.js';

let canvas;

// Scrolling/panning state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartCameraX = 0;
let dragStartCameraY = 0;
let lastTapTime = 0;
let hasDragged = false;
let dragDistance = 0;

/**
 * Initialize input handlers
 */
export function initInput() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas not found!');
        return;
    }

    // Canvas interactions - mouse
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    // Touch support - critical for mobile
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Prevent context menu on long press
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse wheel for scrolling
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Menu buttons
    setupMenuButtons();

    // Action buttons
    setupActionButtons();

    // Window resize
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
    }
}

function handleResize() {
    resizeCanvas();
}

/**
 * Handle mouse down for dragging
 */
function handleMouseDown(e) {
    if (state.gameOver || state.animating) return;

    isDragging = true;
    hasDragged = false;
    dragDistance = 0;
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
        dragDistance = Math.sqrt(dx * dx + dy * dy);

        // Only count as drag if moved more than 8 pixels
        if (dragDistance > 8) {
            hasDragged = true;

            // Update camera position
            state.cameraX = dragStartCameraX + dx;
            state.cameraY = dragStartCameraY + dy;

            // Limit camera to map bounds
            limitCameraBounds();

            // Update offsets and re-render
            updateCameraOffset();
            render();
        }
    } else {
        // Path preview when not dragging
        handlePathPreview(e.clientX, e.clientY);
    }
}

/**
 * Handle mouse up
 */
function handleMouseUp(e) {
    if (isDragging && !hasDragged) {
        // It was a click, not a drag
        handleTapOrClick(e.clientX, e.clientY);
    }

    isDragging = false;
    hasDragged = false;
    dragDistance = 0;
    canvas.style.cursor = 'grab';
}

/**
 * Handle touch start
 */
function handleTouchStart(e) {
    if (state.gameOver || state.animating) return;

    // Always prevent default to avoid scrolling the page
    e.preventDefault();
    e.stopPropagation();

    if (e.touches.length === 1) {
        const touch = e.touches[0];
        isDragging = true;
        hasDragged = false;
        dragDistance = 0;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        dragStartCameraX = state.cameraX;
        dragStartCameraY = state.cameraY;
    }
}

/**
 * Handle touch move
 */
function handleTouchMove(e) {
    if (state.gameOver) return;

    // Always prevent default
    e.preventDefault();
    e.stopPropagation();

    if (e.touches.length === 1 && isDragging) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;
        dragDistance = Math.sqrt(dx * dx + dy * dy);

        // Lower threshold for touch - 15 pixels
        if (dragDistance > 15) {
            hasDragged = true;

            // Update camera position
            state.cameraX = dragStartCameraX + dx;
            state.cameraY = dragStartCameraY + dy;

            // Limit camera to map bounds
            limitCameraBounds();

            // Update offsets and re-render
            updateCameraOffset();
            render();
        }
    }
}

/**
 * Handle touch end
 */
function handleTouchEnd(e) {
    if (state.gameOver || state.animating) return;

    e.preventDefault();
    e.stopPropagation();

    // Get the touch that ended
    const touch = e.changedTouches[0];
    if (!touch) {
        isDragging = false;
        hasDragged = false;
        return;
    }

    // Check for tap (not drag)
    if (!hasDragged && dragDistance < 15) {
        // Double tap detection for centering
        const now = Date.now();
        if (now - lastTapTime < 350) {
            // Double tap - center on current unit
            centerOnCurrentUnit();
            lastTapTime = 0;
        } else {
            lastTapTime = now;
            // Single tap - handle as click
            handleTapOrClick(touch.clientX, touch.clientY);
        }
    }

    isDragging = false;
    hasDragged = false;
    dragDistance = 0;
}

/**
 * Limit camera to reasonable bounds
 */
function limitCameraBounds() {
    const radius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    const maxOffset = radius * state.hexSize * 2;

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
 * Center view on current unit - exported for external use
 */
export function centerOnCurrentUnit() {
    const unit = getCurrentUnit();
    if (!unit) {
        // If no current unit, center on map
        state.cameraX = 0;
        state.cameraY = 0;
        updateCameraOffset();
        render();
        return;
    }

    // Calculate unit position in pixels
    const pos = hexToPixel(unit.q, unit.r, state.hexSize);

    // Set camera to center on unit
    state.cameraX = -pos.x;
    state.cameraY = -pos.y;

    updateCameraOffset();
    render();
}

/**
 * Handle mouse wheel for scrolling
 */
function handleWheel(e) {
    e.preventDefault();

    // Use wheel for panning
    state.cameraX -= e.deltaX;
    state.cameraY -= e.deltaY;

    limitCameraBounds();
    updateCameraOffset();
    render();
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
 * Handle path preview on hover (mouse only)
 */
function handlePathPreview(clientX, clientY) {
    if (state.gameOver || state.selectedAction !== 'move') return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - state.offsetX;
    const y = clientY - rect.top - state.offsetY;

    const hexCoord = pixelToHex(x, y, state.hexSize);
    const hex = getHex(hexCoord.q, hexCoord.r);

    state.hoveredHex = hex;

    // Update path preview
    const unit = getCurrentUnit();
    if (unit && hex && hex.walkable && !hex.unit) {
        const maxPossibleCost = unit.move * 3;
        const pathResult = findPath(unit.q, unit.r, hex.q, hex.r, maxPossibleCost);

        if (pathResult && pathResult.path) {
            state.currentPath = pathResult.path;
        } else {
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
    // Don't allow movement during animation
    if (state.animating) return;

    const maxMoveCost = Math.min(unit.ap, unit.move);
    const maxPossibleCost = unit.move * 3;
    const pathResult = findPath(unit.q, unit.r, hex.q, hex.r, maxPossibleCost);

    if (!pathResult || !pathResult.path || pathResult.path.length < 2) {
        return;
    }

    // Calculate the reachable portion of the path
    let cumulativeCost = 0;
    let reachablePath = [pathResult.path[0]]; // Start with current position
    let totalCost = 0;

    for (let i = 1; i < pathResult.path.length; i++) {
        const point = pathResult.path[i];
        const pointHex = getHex(point.q, point.r);
        if (!pointHex) break;

        const terrain = TERRAIN[pointHex.type];
        cumulativeCost += terrain.moveCost;

        if (cumulativeCost <= maxMoveCost && !pointHex.unit) {
            reachablePath.push(point);
            totalCost = cumulativeCost;
        } else {
            break;
        }
    }

    // Only move if we can reach at least one hex
    if (reachablePath.length < 2 || totalCost === 0) {
        showToast('❌ Ziel nicht erreichbar!', 'warning');
        return;
    }

    state.currentPath = null;

    // Animate the movement
    animateUnitMovement(unit, reachablePath, totalCost, () => {
        // Check for power-up pickup after animation
        const pickup = checkPowerupPickup(unit);
        if (pickup) {
            showPowerupPickup(pickup.powerup, pickup.result);
        }

        updateVisibility();
        render();
        updateUI();
    }, render);
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
                const result = executeAttack(unit, hex.unit);
                state.targetedUnit = null;

                if (result.killed) {
                    checkWinCondition();
                }

                render();
                updateUI();
            } else {
                state.targetedUnit = hex.unit;
                render();
                updateUI();
            }
        } else {
            // Target is out of range
            showToast('❌ Ziel außer Reichweite!', 'warning');
        }
    } else {
        state.targetedUnit = null;
        render();
        updateUI();
    }
}

/**
 * Setup menu buttons
 */
function setupMenuButtons() {
    document.querySelectorAll('[data-players]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('[data-players]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.settings.players = parseInt(btn.dataset.players);
        };
    });

    document.querySelectorAll('[data-size]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('[data-size]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.settings.size = btn.dataset.size;
        };
    });

    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
        readyBtn.onclick = () => {
            showScreen(null);
            updateVisibility();
            updateUI();

            // Center on current unit immediately
            requestAnimationFrame(() => {
                centerOnCurrentUnit();
            });
        };
    }

    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        let endTurnPending = false;
        endTurnBtn.onclick = () => {
            // Check if any unit still has AP
            const playerUnits = state.units.filter(u => u.player === state.currentPlayer && u.alive);
            const totalAP = playerUnits.reduce((sum, u) => sum + u.ap, 0);

            if (totalAP > 0 && !endTurnPending) {
                // First click: warn about remaining AP
                endTurnPending = true;
                showToast(`⚠️ Noch ${totalAP} AP übrig! Erneut tippen zum Beenden.`, 'warning');
                // Reset after 3 seconds
                setTimeout(() => { endTurnPending = false; }, 3000);
            } else {
                // Second click or no AP remaining: end turn
                endTurnPending = false;
                endTurn();
            }
        };
    }

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
