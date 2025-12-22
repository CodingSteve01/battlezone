// ===== INPUT HANDLING =====

import { state, getHex, getCurrentUnit, getPlayerUnits, setQueuedPath, getQueuedPath, clearQueuedPath, getPreviouslyVisibleEnemies, updatePreviouslyVisibleEnemies } from './state.js';
import { pixelToHex, hexToPixel } from './hexMath.js';
import { getReachableHexes, getPathToHex, findPath } from './pathfinding.js';
import { getAttackableUnits, moveUnit, animateUnitMovement, canAutoTakeCover, autoTakeCover } from './units.js';
import { executeAttack, useSpecialAbility, revealFromCover, takeCover, canTakeCover } from './combat.js';
import { checkWinCondition, endTurn } from './turns.js';
import { updateVisibility, getVisibleEnemies } from './fogOfWar.js';
import { updateUI, showScreen, showToast, showPowerupPickup } from './ui.js';
import { render, resizeCanvas } from './renderer.js';
import { CONFIG, TERRAIN } from './config.js';
import { checkPowerupPickup, POWERUP_TYPES } from './powerups.js';
import { playSelect, playTarget, playError, playMoveStart, playMoveEnd, playClick, resumeAudio } from './audio.js';

let canvas;
let pendingMoveAnimationId = null;

// Scrolling/panning state
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
let initialPinchCenter = null;  // Store initial pinch center for consistent zoom point
let initialCameraX = 0;
let initialCameraY = 0;

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

    if (e.touches.length === 2) {
        // Two finger touch - start pinch zoom
        isPinching = true;
        isDragging = false;
        initialPinchDistance = getPinchDistance(e.touches);
        initialZoomLevel = state.zoomLevel;
        initialCameraX = state.cameraX;
        initialCameraY = state.cameraY;
        // Store initial pinch center for consistent zoom point
        const rect = canvas.getBoundingClientRect();
        const center = getPinchCenter(e.touches);
        initialPinchCenter = {
            x: center.x - rect.left - rect.width / 2,
            y: center.y - rect.top - rect.height / 2
        };
    } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        isDragging = true;
        isPinching = false;
        hasDragged = false;
        dragDistance = 0;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        dragStartCameraX = state.cameraX;
        dragStartCameraY = state.cameraY;
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
 * Get center point between two touches
 */
function getPinchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

/**
 * Handle touch move
 */
function handleTouchMove(e) {
    if (state.gameOver) return;

    // Always prevent default
    e.preventDefault();
    e.stopPropagation();

    if (e.touches.length === 2 && isPinching && initialPinchCenter) {
        // Handle pinch zoom
        const currentDistance = getPinchDistance(e.touches);
        const scale = currentDistance / initialPinchDistance;
        const newZoom = Math.max(state.minZoom, Math.min(state.maxZoom, initialZoomLevel * scale));

        if (newZoom !== state.zoomLevel) {
            // Use the INITIAL pinch center for consistent zoom point
            const relX = initialPinchCenter.x;
            const relY = initialPinchCenter.y;

            // Calculate zoom ratio from initial state
            const zoomRatio = newZoom / initialZoomLevel;

            // Adjust camera to keep the initial pinch center stationary
            // Formula derived from: keeping world point under finger fixed
            // newCamera = relX * (1 - zoomRatio) + initialCamera * zoomRatio
            state.cameraX = relX * (1 - zoomRatio) + initialCameraX * zoomRatio;
            state.cameraY = relY * (1 - zoomRatio) + initialCameraY * zoomRatio;

            state.zoomLevel = newZoom;

            // Update camera offset before limiting bounds (uses current hexSize)
            updateCameraOffset();
            // Recalculate hex size with new zoom, then limit bounds
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

    // If we were pinching and now have one finger, switch to drag
    if (isPinching && e.touches.length === 1) {
        isPinching = false;
        initialPinchCenter = null;  // Reset pinch center
        isDragging = true;
        hasDragged = true;  // Prevent accidental tap
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
    isPinching = false;
    initialPinchCenter = null;  // Reset pinch center
    hasDragged = false;
    dragDistance = 0;
}

/**
 * Limit camera to reasonable bounds
 */
function limitCameraBounds() {
    const radius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    // Adjust max offset based on zoom level - allows more panning when zoomed in
    const maxOffset = radius * state.hexSize * 2.5;

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
 * Handle mouse wheel for zooming and scrolling
 */
function handleWheel(e) {
    e.preventDefault();

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

/**
 * Apply zoom centered on a screen position
 */
function applyZoom(zoomDelta, screenX, screenY) {
    const oldZoom = state.zoomLevel;
    const newZoom = Math.max(state.minZoom, Math.min(state.maxZoom, oldZoom + zoomDelta));

    if (newZoom === oldZoom) return;

    // Calculate mouse position relative to canvas center
    const rect = canvas.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;
    const relX = screenX - rect.left - canvasCenterX;
    const relY = screenY - rect.top - canvasCenterY;

    const zoomRatio = newZoom / oldZoom;

    // Adjust camera to keep the point under the mouse stationary
    // Formula derived from: keeping world point under cursor fixed
    // newCamera = relX * (1 - zoomRatio) + oldCamera * zoomRatio
    state.cameraX = relX * (1 - zoomRatio) + state.cameraX * zoomRatio;
    state.cameraY = relY * (1 - zoomRatio) + state.cameraY * zoomRatio;

    state.zoomLevel = newZoom;

    // Update camera offset, then recalculate hex size with new zoom
    updateCameraOffset();
    resizeCanvas();
    // Limit bounds AFTER hexSize is updated so bounds are calculated correctly
    limitCameraBounds();
    updateCameraOffset();
}

/**
 * Handle tap or click at position - Unified Point-and-Click system
 * - Click own unit: Select it
 * - Click enemy: Attack if in range, otherwise move toward them
 * - Click empty hex: Move there
 */
function handleTapOrClick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();

    const x = clientX - rect.left - state.offsetX;
    const y = clientY - rect.top - state.offsetY;

    const hexCoord = pixelToHex(x, y, state.hexSize);
    const hex = getHex(hexCoord.q, hexCoord.r);
    if (!hex) return;

    const unit = getCurrentUnit();

    // 1. Check if clicking on own unit
    if (hex.unit && hex.unit.player === state.currentPlayer && hex.unit.alive) {
        const playerUnits = getPlayerUnits(state.currentPlayer);
        const unitIndex = playerUnits.findIndex(u => u.id === hex.unit.id);
        if (unitIndex >= 0) {
            // Check if current unit is a Medic and clicking on injured ally (context action: heal)
            if (unit && unit.class === 'medic' && hex.unit.id !== unit.id) {
                const allyHex = hex.unit;
                if (allyHex.currentHp < allyHex.maxHp && unit.ap >= 2 && !unit.usedSpecial) {
                    // Show healing option
                    showToast(`💚 ${unit.name} kann ${allyHex.name} heilen! Tippe nochmal zum Heilen.`, 'info');
                    if (state.pendingHealTarget && state.pendingHealTarget.id === allyHex.id) {
                        // Second tap - use special ability
                        useSpecialAbility(unit);
                        state.pendingHealTarget = null;
                        render();
                        updateUI();
                        return;
                    }
                    state.pendingHealTarget = allyHex;
                    return;
                }
            }

            // If clicking on already selected unit, do nothing special
            if (unitIndex === state.selectedUnit) {
                return;
            }
            // Select this unit
            state.selectedUnit = unitIndex;
            state.pendingMoveDestination = null;
            state.currentPath = null;
            state.targetedUnit = null;
            state.pendingHealTarget = null;
            state.selectedAction = 'move';  // Reset to move mode
            playSelect();
            updateUI();
            render();
            showToast(`${hex.unit.name} ausgewählt`, 'info');
            return;
        }
    }

    if (!unit) return;

    // 2. Check if clicking on enemy unit
    if (hex.unit && hex.unit.player !== state.currentPlayer && hex.unit.alive) {
        handleEnemyClick(unit, hex);
        return;
    }

    // 3. Click on empty/walkable hex - move there
    if (hex.walkable && !hex.unit) {
        handleMoveClick(unit, hex);
    }
}

/**
 * Handle click on enemy unit - auto-attack or move toward
 */
function handleEnemyClick(unit, hex) {
    const enemy = hex.unit;

    // Check if enemy is in attack range
    const attackable = getAttackableUnits(unit);
    const canAttack = attackable.some(u => u.id === enemy.id);

    if (canAttack && unit.ap >= 1) {
        // Enemy is in range - attack!
        if (state.targetedUnit && state.targetedUnit.id === enemy.id) {
            // Second tap on same enemy - execute attack
            const result = executeAttack(unit, enemy);
            state.targetedUnit = null;
            state.pendingMoveDestination = null;
            state.currentPath = null;

            if (result.killed) {
                checkWinCondition();
            }

            render();
            updateUI();
        } else {
            // First tap - target this enemy
            state.targetedUnit = enemy;
            state.pendingMoveDestination = null;
            state.currentPath = null;
            playTarget();
            render();
            updateUI();
            showToast(`🎯 ${enemy.name} anvisiert - nochmal tippen zum Angriff`, 'warning');
        }
    } else {
        // Enemy not in range - show message
        playError();
        if (unit.ap < 1) {
            showToast('❌ Keine AP für Angriff!', 'warning');
        } else {
            showToast('❌ Feind außer Reichweite!', 'warning');
        }
        state.targetedUnit = null;
        render();
    }
}

/**
 * Handle path preview on hover (mouse only)
 */
function handlePathPreview(clientX, clientY) {
    if (state.gameOver) return;
    // Don't show path preview if targeting an enemy
    if (state.targetedUnit) return;

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
 * Handle move action click - tap-to-confirm system with multi-turn path support
 */
function handleMoveClick(unit, hex) {
    // Don't allow movement during animation
    if (state.animating) return;

    // Try to find path with extended range for multi-turn movement
    const maxExtendedCost = unit.move * 10; // Allow planning for many turns ahead
    // Use the lesser of AP or move stat (unit's movement capability per turn)
    const maxMoveCost = Math.min(unit.ap, unit.move);

    // First try to find the full path
    let pathResult = findPath(unit.q, unit.r, hex.q, hex.r, maxExtendedCost);

    if (!pathResult || !pathResult.path || pathResult.path.length < 2) {
        // Clear pending destination if tapping on invalid hex
        state.pendingMoveDestination = null;
        state.currentPath = null;
        clearQueuedPath(unit.id);
        render();
        return;
    }

    // Calculate the reachable portion of the path this turn
    let cumulativeCost = 0;
    let reachablePath = [pathResult.path[0]]; // Start with current position
    let totalCost = 0;
    let lastReachableIndex = 0;

    for (let i = 1; i < pathResult.path.length; i++) {
        const point = pathResult.path[i];
        const pointHex = getHex(point.q, point.r);
        if (!pointHex) break;

        const terrain = TERRAIN[pointHex.type];
        cumulativeCost += terrain.moveCost;

        if (cumulativeCost <= maxMoveCost && !pointHex.unit) {
            reachablePath.push(point);
            totalCost = cumulativeCost;
            lastReachableIndex = i;
        } else if (pointHex.unit && pointHex.unit.id !== unit.id) {
            // Stop at units
            break;
        }
    }

    // Check if full destination is beyond current reach
    const isMultiTurnPath = lastReachableIndex < pathResult.path.length - 1;
    const fullDestination = pathResult.path[pathResult.path.length - 1];

    // Only proceed if we can reach at least one hex this turn
    if (reachablePath.length < 2 || totalCost === 0) {
        showToast('❌ Ziel nicht erreichbar!', 'warning');
        state.pendingMoveDestination = null;
        state.currentPath = null;
        clearQueuedPath(unit.id);
        render();
        return;
    }

    // Get the final reachable destination for this turn
    const finalDest = reachablePath[reachablePath.length - 1];

    // Check if tapping on already pending destination (confirm move)
    if (state.pendingMoveDestination &&
        state.pendingMoveDestination.q === finalDest.q &&
        state.pendingMoveDestination.r === finalDest.r) {

        // Second tap - execute the movement
        state.pendingMoveDestination = null;
        state.currentPath = null;

        // Play move start sound
        playMoveStart();

        // Reveal from cover when moving
        if (unit.hiding) {
            unit.hiding = false;
        }

        // Store previous visible enemies before movement
        const prevEnemies = getVisibleEnemies();
        const prevEnemyIds = new Set(prevEnemies.map(e => e.id));

        // If this is a multi-turn path, save the remaining path
        if (isMultiTurnPath) {
            const remainingPath = pathResult.path.slice(lastReachableIndex);
            setQueuedPath(unit.id, remainingPath, fullDestination.q, fullDestination.r);
            showToast('📍 Pfad für nächste Runde gespeichert', 'info');
        } else {
            // Clear any existing queued path since we reached the destination
            clearQueuedPath(unit.id);
        }

        // Animate the movement
        animateUnitMovement(unit, reachablePath, totalCost, () => {
            // Play move end sound
            playMoveEnd();

            // Check for power-up pickup after animation
            const pickup = checkPowerupPickup(unit);
            if (pickup) {
                showPowerupPickup(pickup.powerup, pickup.result);
            }

            updateVisibility();

            // Check for newly discovered enemies
            checkForNewEnemies(prevEnemyIds);

            // Auto-take cover if on valid terrain (forest)
            if (canAutoTakeCover(unit)) {
                autoTakeCover(unit);
                showToast('🌲 Automatisch in Deckung gegangen!', 'special');
            }

            render();
            updateUI();
        }, render);
    } else {
        // First tap - show path preview and set pending destination
        state.pendingMoveDestination = { q: finalDest.q, r: finalDest.r };
        state.currentPath = pathResult.path;

        // Show info about multi-turn path
        if (isMultiTurnPath) {
            const turnsNeeded = Math.ceil(pathResult.cost / unit.move);
            showToast(`📍 Ziel in ~${turnsNeeded} Zügen erreichbar`, 'info');
        }

        render();

        // Start animation loop for pulsing effect
        startPendingMoveAnimation();
    }
}

/**
 * Check for newly discovered enemies after movement and alert the player
 */
function checkForNewEnemies(prevEnemyIds) {
    const currentEnemies = getVisibleEnemies();
    const newEnemies = currentEnemies.filter(e => !prevEnemyIds.has(e.id));

    if (newEnemies.length > 0) {
        // Found new enemies!
        showToast(`⚠️ ${newEnemies.length} Feind${newEnemies.length > 1 ? 'e' : ''} entdeckt!`, 'warning');

        // Scroll to the first new enemy after a short delay
        setTimeout(() => {
            scrollToUnit(newEnemies[0]);
        }, 500);
    }

    // Update tracked enemies
    updatePreviouslyVisibleEnemies(currentEnemies.map(e => e.id));
}

/**
 * Smoothly scroll camera to center on a unit
 */
export function scrollToUnit(unit, duration = 500) {
    if (!unit) return;

    const targetPos = hexToPixel(unit.q, unit.r, state.hexSize);
    const targetCameraX = -targetPos.x;
    const targetCameraY = -targetPos.y;

    const startCameraX = state.cameraX;
    const startCameraY = state.cameraY;
    const startTime = Date.now();

    function animateScroll() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Ease out cubic
        const ease = 1 - Math.pow(1 - progress, 3);

        state.cameraX = startCameraX + (targetCameraX - startCameraX) * ease;
        state.cameraY = startCameraY + (targetCameraY - startCameraY) * ease;

        limitCameraBounds();
        updateCameraOffset();
        render();

        if (progress < 1) {
            requestAnimationFrame(animateScroll);
        }
    }

    requestAnimationFrame(animateScroll);
}

/**
 * Continue queued path for a unit if it exists
 */
export function continueQueuedPath(unit) {
    const queuedPath = getQueuedPath(unit.id);
    if (!queuedPath || !queuedPath.path || queuedPath.path.length < 2) {
        return false;
    }

    // Recalculate path from current position to target
    // Use the lesser of AP or move stat (unit's movement capability per turn)
    const maxMoveCost = Math.min(unit.ap, unit.move);
    const pathResult = findPath(unit.q, unit.r, queuedPath.targetQ, queuedPath.targetR, unit.move * 10);

    if (!pathResult || !pathResult.path || pathResult.path.length < 2) {
        // Path is no longer valid
        clearQueuedPath(unit.id);
        showToast('❌ Gespeicherter Pfad nicht mehr gültig', 'warning');
        return false;
    }

    // Calculate reachable portion
    let cumulativeCost = 0;
    let reachablePath = [pathResult.path[0]];
    let totalCost = 0;
    let lastReachableIndex = 0;

    for (let i = 1; i < pathResult.path.length; i++) {
        const point = pathResult.path[i];
        const pointHex = getHex(point.q, point.r);
        if (!pointHex) break;

        const terrain = TERRAIN[pointHex.type];
        cumulativeCost += terrain.moveCost;

        if (cumulativeCost <= maxMoveCost && !pointHex.unit) {
            reachablePath.push(point);
            totalCost = cumulativeCost;
            lastReachableIndex = i;
        } else if (pointHex.unit && pointHex.unit.id !== unit.id) {
            break;
        }
    }

    if (reachablePath.length < 2 || totalCost === 0) {
        clearQueuedPath(unit.id);
        return false;
    }

    // Check if we reached the destination
    const isComplete = lastReachableIndex >= pathResult.path.length - 1;

    // Store enemies before movement
    const prevEnemies = getVisibleEnemies();
    const prevEnemyIds = new Set(prevEnemies.map(e => e.id));

    // Update queued path with remaining
    if (!isComplete) {
        const remainingPath = pathResult.path.slice(lastReachableIndex);
        setQueuedPath(unit.id, remainingPath, queuedPath.targetQ, queuedPath.targetR);
    } else {
        clearQueuedPath(unit.id);
    }

    // Show the path and confirm indicator
    state.currentPath = pathResult.path;
    state.pendingMoveDestination = {
        q: reachablePath[reachablePath.length - 1].q,
        r: reachablePath[reachablePath.length - 1].r
    };

    showToast('📍 Gespeicherter Pfad wird fortgesetzt...', 'info');
    render();

    return true;
}

/**
 * Start animation loop for pending move indicator
 */
function startPendingMoveAnimation() {
    // Cancel any existing animation
    if (pendingMoveAnimationId) {
        cancelAnimationFrame(pendingMoveAnimationId);
    }

    function animate() {
        // Stop if no longer pending
        if (!state.pendingMoveDestination) {
            pendingMoveAnimationId = null;
            return;
        }

        render();
        pendingMoveAnimationId = requestAnimationFrame(animate);
    }

    pendingMoveAnimationId = requestAnimationFrame(animate);
}

/**
 * Stop pending move animation
 */
function stopPendingMoveAnimation() {
    if (pendingMoveAnimationId) {
        cancelAnimationFrame(pendingMoveAnimationId);
        pendingMoveAnimationId = null;
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
 * Note: [data-players], [data-size], and [data-mode] buttons are handled in main.js
 */
function setupMenuButtons() {
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
    // Cover button - take cover on forest/rock tiles
    const coverBtn = document.querySelector('.action-btn[data-action="cover"]');
    if (coverBtn) {
        coverBtn.onclick = () => {
            const unit = getCurrentUnit();
            if (unit && canTakeCover(unit)) {
                takeCover(unit);
                render();
                updateUI();
            } else if (unit && unit.hiding) {
                showToast('❌ Bereits in Deckung!', 'warning');
            } else if (unit && unit.ap < 1) {
                showToast('❌ Nicht genug AP (braucht 1)!', 'warning');
            } else {
                showToast('❌ Hier keine Deckung möglich!', 'warning');
            }
        };
    }

    // Special ability button - simplified UI
    const specialBtn = document.querySelector('.action-btn[data-action="special"]');
    if (specialBtn) {
        specialBtn.onclick = () => {
            const unit = getCurrentUnit();
            if (unit && unit.ap >= 2 && !unit.usedSpecial) {
                useSpecialAbility(unit);
                render();
                updateUI();
            } else if (unit && unit.usedSpecial) {
                showToast('❌ Spezialfähigkeit bereits benutzt!', 'warning');
            } else if (unit && unit.ap < 2) {
                showToast('❌ Nicht genug AP (braucht 2)!', 'warning');
            }
        };
    }
}
