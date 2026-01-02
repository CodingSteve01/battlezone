// ===== INPUT HANDLING =====

import { state, getHex, getCurrentUnit, getPlayerUnits, setQueuedPath, getQueuedPath, clearQueuedPath, getPreviouslyVisibleEnemies, updatePreviouslyVisibleEnemies, spendSharedAP, isUnitOnOverwatch, areUnitsAllied, zoomLevelToScale, scaleToZoomLevel, getTileSize, getTileSizeForHexSize, getTileZOffset, getTileScreenPosition, canUnitAttack } from './state.js';
import { pixelToHex, hexDistance } from './hexMath.js';
import { findPath, getMoveCost } from './pathfinding.js';
import { getAttackableUnits, moveUnit, animateUnitMovement, canAutoTakeCover, autoTakeCover, getEffectiveRange } from './units.js';
import {
    executeAttack, executeAttackWithMinigame, useSpecialAbility, useMedicHealingWithMinigame,
    prepareAmbush, canPrepareAmbush, getEligibleCoordinators, executeCoordinatedAttack,
    canUseSpecialAbility, getSpecialAbilityCost,
    canUseSuppression, useSuppression, canUseOverwatch, activateOverwatch,
    checkAmbushTriggers, executeAmbushAttack,
    checkOverwatchTriggers, executeOverwatchAttack, onUnitMoved,
    hasLineOfSight
} from './combat.js';
import { checkWinCondition, endTurn, endGame } from './turns.js';
import { updateVisibility, getVisibleEnemies } from './fogOfWar.js';
import { updateUI, showScreen, showToast, showPowerupPickup } from './ui.js';
import { render, resizeCanvas, getMinimapBounds, getToggleButtonBounds, getCloseButtonBounds, getHeightOverlayButtonBounds, setMinimapActive, isMinimapExpanded, setMinimapExpanded } from './renderer.js';
import { CONFIG, UNIT_CLASSES } from './config.js';
import { checkPowerupPickup, POWERUP_TYPES } from './powerups.js';
import { playSelect, playTarget, playError, playMoveStart, playMoveEnd, playClick, resumeAudio } from './audio.js';
import { isAIPlayer, isSpectatorMode } from './ai.js';
import { shouldStartTutorial, startTutorial, checkTutorialHint, showActionHint, shouldStartGuidedTutorial, startGuidedTutorial, notifyTutorialAction, isGuidedTutorialActive } from './tutorial.js';

let canvas;
let pendingMoveAnimationId = null;

function pixelToHexWithHeight(x, y) {
    const tileSize = getTileSize();
    const rough = pixelToHex(x, y, tileSize);
    const roughHex = getHex(rough.q, rough.r);
    if (!roughHex) return rough;

    const adjustedY = y + getTileZOffset(roughHex.height, tileSize);
    return pixelToHex(x, adjustedY, tileSize);
}

function getUnitTilePosition(unit, tileSize = getTileSize()) {
    const hex = getHex(unit.q, unit.r);
    return getTileScreenPosition(unit.q, unit.r, hex?.height ?? 0, tileSize);
}

// ===== FIRST-USE EXPLANATIONS FOR TACTICAL FEATURES =====
// Shows detailed explanation the first time a player uses a feature

const FIRST_USE_EXPLANATIONS = {
    overwatch: {
        title: '👁️ Overwatch - Deckungsfeuer',
        message: `<b>So funktioniert Overwatch:</b><br><br>
            ⏳ Deine Einheit wartet auf feindliche Bewegung<br>
            🎯 Wenn ein Feind in Reichweite läuft → <b>automatischer Angriff!</b><br>
            ⚡ Schaden: 70% des normalen Schadens (Reaktionsschuss)<br><br>
            <b>Tipp:</b> Ideal um Engpässe und Flanken zu sichern!`
    },
    ambush: {
        title: '🎯 Hinterhalt',
        message: `<b>So funktioniert der Hinterhalt:</b><br><br>
            🌲 Nur aus Tarnung oder Deckung möglich<br>
            ⏳ Deine Einheit lauert auf Feinde<br>
            💥 Feind in Reichweite → <b>automatischer Angriff mit Bonus-Schaden!</b><br><br>
            <b>Tipp:</b> Perfekt für Commando und Sniper nach Tarnung!`
    },
    suppress: {
        title: '🔥 Unterdrückungsfeuer',
        message: `<b>So funktioniert Unterdrückung:</b><br><br>
            🎯 Wähle ein Hex-Feld in Reichweite<br>
            🔥 Feinde auf diesem Feld werden "festgenagelt":<br>
            &nbsp;&nbsp;• <b>-30% Trefferchance</b> für unterdrückte Feinde<br>
            &nbsp;&nbsp;• <b>+1 Bewegungskosten</b> zum Verlassen<br><br>
            <b>Tipp:</b> Unterdrücke feindliche Sniper-Positionen!`
    },
    coordinate: {
        title: '👥 Koordinierter Angriff',
        message: `<b>So funktioniert koordinierter Angriff:</b><br><br>
            🎯 Mehrere Einheiten müssen das gleiche Ziel in Reichweite haben<br>
            💥 Alle greifen gleichzeitig an mit <b>+15% Schaden pro Angreifer!</b><br><br>
            <b>Beispiel:</b> 3 Einheiten = +30% Bonus-Schaden für alle!<br><br>
            <b>Tipp:</b> Ideal um starke Gegner schnell auszuschalten!`
    }
};

// Track which explanations have been shown
let shownExplanations = new Set();

// Load from localStorage
try {
    const saved = localStorage.getItem('shadowSquad_tacticalExplanations');
    if (saved) {
        shownExplanations = new Set(JSON.parse(saved));
    }
} catch { /* ignore */ }

/**
 * Show first-use explanation for a tactical feature
 * Returns true if explanation was shown (first time), false otherwise
 */
function showFirstUseExplanation(featureId) {
    if (shownExplanations.has(featureId)) {
        return false; // Already shown
    }

    const explanation = FIRST_USE_EXPLANATIONS[featureId];
    if (!explanation) return false;

    // Mark as shown
    shownExplanations.add(featureId);
    try {
        localStorage.setItem('shadowSquad_tacticalExplanations', JSON.stringify([...shownExplanations]));
    } catch { /* ignore */ }

    // Create modal overlay
    let overlay = document.getElementById('tactical-explanation-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tactical-explanation-overlay';
        overlay.className = 'tutorial-overlay tutorial-center';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="tutorial-hint tactical-hint">
            <div class="tutorial-hint-header">
                <span class="tutorial-hint-title">${explanation.title}</span>
            </div>
            <div class="tutorial-hint-message">${explanation.message}</div>
            <div class="tutorial-hint-actions">
                <button class="tutorial-btn tutorial-btn-ok" onclick="document.getElementById('tactical-explanation-overlay').style.display='none'">
                    ✓ Verstanden!
                </button>
            </div>
        </div>
    `;

    overlay.style.display = 'flex';
    return true;
}

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

    // Target info panel click - allows tapping "tap to attack" hint to attack
    setupTargetInfoClick();

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
    // Ensure valid camera values when starting drag
    dragStartCameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
    dragStartCameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;

    canvas.style.cursor = 'grabbing';
}

/**
 * Handle mouse move for dragging and path preview
 */
function handleMouseMove(e) {
    if (state.gameOver) return;

    // Block camera panning when minimap is expanded (tactical briefing mode)
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
        // Ensure valid zoom level before pinch
        initialZoomLevel = Number.isFinite(state.zoomLevel) && state.zoomLevel > 0 ? state.zoomLevel : scaleToZoomLevel(1.0);
        initialCameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
        initialCameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;
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
        // Ensure valid camera values when starting touch drag
        dragStartCameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
        dragStartCameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;
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

    // Block camera panning/zooming when minimap is expanded (tactical briefing mode)
    if (isMinimapExpanded()) {
        return;
    }

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

    // Ensure hexSize is valid before calculating bounds
    const hexSize = getTileSizeForHexSize(Number.isFinite(state.hexSize) && state.hexSize > 0 ? state.hexSize : CONFIG.BASE_HEX_SIZE);
    const heightMargin = getTileZOffset(CONFIG.HEIGHT.MAX, hexSize);
    const maxOffset = radius * hexSize * 2.5 + heightMargin;

    // Ensure camera values are valid before clamping
    const cameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
    const cameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;

    state.cameraX = Math.max(-maxOffset, Math.min(maxOffset, cameraX));
    state.cameraY = Math.max(-maxOffset, Math.min(maxOffset, cameraY));
}

/**
 * Update camera offset after panning
 */
function updateCameraOffset() {
    const container = canvas?.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Ensure camera values are valid
    const cameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
    const cameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;

    state.offsetX = rect.width / 2 + cameraX;
    state.offsetY = rect.height / 2 + cameraY;
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
    const pos = getUnitTilePosition(unit);

    // Set camera to center on unit
    state.cameraX = -pos.x;
    state.cameraY = -pos.y;

    updateCameraOffset();
    render();
}

/**
 * Center view on all player's units with slight zoom out for overview
 * @param {number} playerIndex - The player index to center on
 * @param {number} duration - Animation duration in ms
 * @returns {Promise} - Resolves when animation completes
 */
export function centerOnTeam(playerIndex, duration = 600) {
    return new Promise(resolve => {
        const playerUnits = getPlayerUnits(playerIndex);

        if (playerUnits.length === 0) {
            resolve();
            return;
        }

        // Get visible enemies for situational zoom
        const visibleEnemies = [];
        for (const unit of state.units) {
            if (unit.player === playerIndex || unit.hp <= 0) continue;
            const hex = getHex(unit.q, unit.r);
            if (hex && hex.visible && hex.visible[playerIndex]) {
                visibleEnemies.push(unit);
            }
        }

        // Calculate situational zoom: show own units + visible enemies
        // Use first player unit as reference, include all relevant units
        const referenceUnit = playerUnits[0];
        const allRelevantUnits = [...playerUnits.slice(1), ...visibleEnemies];
        const situationalZoom = calculateSituationalZoom(referenceUnit, allRelevantUnits);
        const situationalScale = zoomLevelToScale(situationalZoom);

        // Clamp between 0.7 and 0.95 for turn start overview
        const targetZoomScale = Math.max(0.7, Math.min(0.95, situationalScale));
        const targetZoom = scaleToZoomLevel(targetZoomScale);
        const targetHexSize = CONFIG.BASE_HEX_SIZE * zoomLevelToScale(targetZoom);
        const targetTileSize = getTileSizeForHexSize(targetHexSize);

        // Calculate center of units at target zoom level
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const unit of playerUnits) {
            const pos = getUnitTilePosition(unit, targetTileSize);
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        }

        const targetCenterX = (minX + maxX) / 2;
        const targetCenterY = (minY + maxY) / 2;

        // Animate to position and zoom
        const startCameraX = Number.isFinite(state.cameraX) ? state.cameraX : 0;
        const startCameraY = Number.isFinite(state.cameraY) ? state.cameraY : 0;
        const startZoom = Number.isFinite(state.zoomLevel) && state.zoomLevel > 0 ? state.zoomLevel : scaleToZoomLevel(1.0);
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Ease in-out cubic
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // Animate zoom to 100%
            state.zoomLevel = startZoom + (targetZoom - startZoom) * ease;
            state.hexSize = CONFIG.BASE_HEX_SIZE * zoomLevelToScale(state.zoomLevel);

            // Recalculate center at current zoom level for smooth animation
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

            // Animate camera position
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

/**
 * Handle mouse wheel for zooming and scrolling
 */
function handleWheel(e) {
    e.preventDefault();

    // Block zoom/scroll when minimap is expanded (tactical briefing mode)
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

/**
 * Apply zoom centered on a screen position
 */
function applyZoom(zoomDelta, screenX, screenY) {
    // Ensure valid starting zoom level
    const oldZoom = Number.isFinite(state.zoomLevel) && state.zoomLevel > 0 ? state.zoomLevel : scaleToZoomLevel(1.0);
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
 * Check if a click/touch is on the minimap expand button (compact mode)
 * Returns true if click was on expand button (handled), false otherwise
 */
function handleMinimapExpandClick(clientX, clientY) {
    // Expand button only visible in compact mode
    if (isMinimapExpanded()) return false;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const toggleBounds = getToggleButtonBounds();
    if (!toggleBounds) return false;

    // Check if click is on expand button
    if (canvasX >= toggleBounds.x &&
        canvasX <= toggleBounds.x + toggleBounds.size &&
        canvasY >= toggleBounds.y &&
        canvasY <= toggleBounds.y + toggleBounds.size) {

        setMinimapExpanded(true);
        playClick();
        render();
        return true;
    }

    return false;
}

/**
 * Check if a click/touch is on the close button (expanded mode)
 * Returns true if click was on close button (handled), false otherwise
 */
function handleMinimapCloseClick(clientX, clientY) {
    // Close button only visible in expanded mode
    if (!isMinimapExpanded()) return false;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const closeBounds = getCloseButtonBounds();
    if (!closeBounds) return false;

    // Check if click is on close button
    if (canvasX >= closeBounds.x &&
        canvasX <= closeBounds.x + closeBounds.size &&
        canvasY >= closeBounds.y &&
        canvasY <= closeBounds.y + closeBounds.size) {

        setMinimapExpanded(false);
        playClick();
        render();
        return true;
    }

    return false;
}

/**
 * Check if a click/touch is on the height overlay toggle button
 * Returns true if click was on button (handled), false otherwise
 */
function handleHeightOverlayToggleClick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const bounds = getHeightOverlayButtonBounds();
    if (!bounds) return false;

    if (canvasX >= bounds.x &&
        canvasX <= bounds.x + bounds.size &&
        canvasY >= bounds.y &&
        canvasY <= bounds.y + bounds.size) {
        state.debug.showHeightOverlay = !state.debug.showHeightOverlay;
        playClick();
        render();
        return true;
    }

    return false;
}

/**
 * Check if a click/touch is on the minimap and handle interaction
 * - Both modes: Touch to navigate viewport
 * - Compact mode: Expand button to enlarge
 * - Expanded mode: Close button or click outside to collapse
 * Returns true if click was on minimap (handled), false otherwise
 */
function handleMinimapClick(clientX, clientY) {
    const expanded = isMinimapExpanded();

    // First check expand button (compact mode only)
    if (!expanded && handleMinimapExpandClick(clientX, clientY)) {
        return true;
    }

    // Check close button (expanded mode only)
    if (expanded && handleMinimapCloseClick(clientX, clientY)) {
        return true;
    }

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const bounds = getMinimapBounds();
    if (!bounds || bounds.size === 0) return false;

    // Check if click is within minimap bounds (with some padding)
    const padding = 5;
    const isWithinMinimap = canvasX >= bounds.x - padding &&
        canvasX <= bounds.x + bounds.size + padding &&
        canvasY >= bounds.y - padding &&
        canvasY <= bounds.y + bounds.size + padding;

    if (isWithinMinimap) {
        // Both modes: click within minimap navigates viewport
        setMinimapActive(true);
        setTimeout(() => setMinimapActive(false), 300);

        // Convert minimap click to hex coordinates
        const relX = canvasX - bounds.centerX;
        const relY = canvasY - bounds.centerY;

        // Reverse the hex-to-pixel conversion used in minimap drawing
        const q = relX / (bounds.hexSize * 1.5);
        const r = (relY / (bounds.hexSize * Math.sqrt(3))) - q * 0.5;

        // Convert to world pixel position
        const tileSize = getTileSize();
        const worldX = q * tileSize * 1.5;
        const worldY = (r + q * 0.5) * tileSize * Math.sqrt(3);

        // Smooth scroll to position
        scrollToPosition(-worldX, -worldY);

        return true;
    } else if (expanded) {
        // Click outside expanded minimap - close it
        setMinimapExpanded(false);
        playClick();
        render();
        return true;
    }

    return false;
}

/**
 * Smoothly scroll camera to a specific position
 */
export function scrollToPosition(targetCameraX, targetCameraY, duration = 300) {
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
 * Handle tap or click at position - Unified Point-and-Click system
 * - Click own unit: Select it
 * - Click enemy: Attack if in range, otherwise move toward them
 * - Click empty hex: Move there
 * - Second click anywhere (when enemy targeted): Execute attack
 */
function handleTapOrClick(clientX, clientY) {
    // Block all input during AI turns (including spectator mode)
    if (isAIPlayer()) {
        return;
    }

    // Check if click is on minimap first
    if (handleMinimapClick(clientX, clientY)) {
        return;
    }
    if (handleHeightOverlayToggleClick(clientX, clientY)) {
        return;
    }

    // Block all game interactions when minimap is expanded (tactical briefing mode)
    if (isMinimapExpanded()) {
        return;
    }

    const rect = canvas.getBoundingClientRect();

    const x = clientX - rect.left - state.offsetX;
    const y = clientY - rect.top - state.offsetY;

    const hexCoord = pixelToHexWithHeight(x, y);
    const hex = getHex(hexCoord.q, hexCoord.r);
    if (!hex) return;

    const unit = getCurrentUnit();

    // === CANCEL TARGETING ON EMPTY HEX CLICK ===
    // If an enemy is targeted and clicking on empty hex, cancel the targeting
    if (state.targetedUnit && !state.minigameInProgress) {
        const targetedEnemy = state.targetedUnit;

        // Clicking on empty hex (no unit) or walkable terrain: cancel targeting
        if (!hex.unit) {
            state.targetedUnit = null;
            state.selectedAction = 'move';
            updateUI();
            render();
            return;
        }

        // Clicking on the SAME targeted enemy: execute attack
        if (hex.unit && hex.unit.id === targetedEnemy.id && unit && state.sharedAP >= 1) {
            const attackable = getAttackableUnits(unit);
            const canAttack = attackable.some(u => u.id === targetedEnemy.id);

            if (canAttack && targetedEnemy.alive) {
                // Execute attack on the targeted enemy
                state.targetedUnit = null;
                state.pendingMoveDestination = null;
                state.currentPath = null;
                state.minigameInProgress = true;

                (async () => {
                    try {
                        const result = await executeAttackWithMinigame(unit, targetedEnemy);
                        // If cancelled, just show message and return
                        if (result.cancelled) {
                            showToast('Angriff abgebrochen', 'info');
                            render();
                            updateUI();
                            return;
                        }
                        if (result.killed) {
                            checkWinCondition();
                        }
                        render();
                        updateUI();
                        notifyTutorialAction('unitAttacked');
                        showActionHint('attacked');
                        checkTutorialHint();
                    } finally {
                        state.minigameInProgress = false;
                    }
                })();
                return;
            } else if (targetedEnemy.alive) {
                // Attack not possible - show feedback why
                showAttackBlockedFeedback(unit, targetedEnemy);
                return;
            }
        }

        // Clicking on own unit - fall through to selection logic below
        if (hex.unit && hex.unit.player === state.currentPlayer && hex.unit.alive) {
            // Will be handled by unit selection below - also clears targetedUnit
        } else if (hex.unit && !areUnitsAllied(unit, hex.unit) && hex.unit.alive) {
            // Clicking on DIFFERENT enemy - switch targeting to that enemy
            // Let the enemy click handler below handle this
        }
    }

    // 1. Check if clicking on own unit
    if (hex.unit && hex.unit.player === state.currentPlayer && hex.unit.alive) {
        const playerUnits = getPlayerUnits(state.currentPlayer);
        const unitIndex = playerUnits.findIndex(u => u.id === hex.unit.id);
        if (unitIndex >= 0) {
            // Check if current unit is a Medic and clicking on injured ally (context action: heal)
            if (unit && unit.class === 'medic' && hex.unit.id !== unit.id) {
                const allyHex = hex.unit;
                const healCost = getSpecialAbilityCost('medic');
                if (allyHex.currentHp < allyHex.maxHp && state.sharedAP >= healCost && !unit.usedSpecial) {
                    // Block if minigame is already in progress (prevents exploit)
                    if (state.minigameInProgress) {
                        return;
                    }
                    // Show healing option
                    const unitName = UNIT_CLASSES[unit.class]?.name || unit.class;
                    const allyName = UNIT_CLASSES[allyHex.class]?.name || allyHex.class;
                    showToast(`💚 ${unitName} kann ${allyName} heilen! Tippe nochmal zum Heilen.`, 'info');
                    if (state.pendingHealTarget && state.pendingHealTarget.id === allyHex.id) {
                        // Second tap - use special ability with minigame
                        state.pendingHealTarget = null;
                        // Spend AP and mark as used before starting minigame
                        spendSharedAP(healCost);
                        unit.usedSpecial = true;
                        state.minigameInProgress = true;  // Block additional triggers
                        // Use async healing minigame
                        (async () => {
                            try {
                                const result = await useMedicHealingWithMinigame(unit);
                                // If cancelled, refund AP and reset usedSpecial
                                if (result && result.cancelled) {
                                    state.sharedAP += healCost;
                                    unit.usedSpecial = false;
                                    showToast('Heilung abgebrochen', 'info');
                                }
                            } finally {
                                state.minigameInProgress = false;  // Always reset
                            }
                            render();
                            updateUI();
                        })();
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
            const selectedName = UNIT_CLASSES[hex.unit.class]?.name || hex.unit.class;
            showToast(`${selectedName} ausgewählt`, 'info');
            // Notify guided tutorial of unit selection
            notifyTutorialAction('unitSelected');
            // Check for tutorial hints after selection
            checkTutorialHint();
            return;
        }
    }

    if (!unit) return;

    // === UNTERDRÜCKUNGSFEUER-MODUS ===
    // Wenn im Suppress-Modus, versuche das Hex zu unterdrücken
    if (state.selectedAction === 'suppress') {
        handleSuppressionClick(unit, hex);
        return;
    }

    // 2. Check if clicking on enemy unit (NOT an ally!)
    if (hex.unit && !areUnitsAllied(unit, hex.unit) && hex.unit.alive) {
        handleEnemyClick(unit, hex);
        return;
    }

    // 2b. Check if clicking on allied unit (different player but same team)
    if (hex.unit && areUnitsAllied(unit, hex.unit) && hex.unit.player !== unit.player && hex.unit.alive) {
        showToast('🤝 Verbündeter - Team ' + (state.settings.alliances[hex.unit.player] + 1), 'info');
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
async function handleEnemyClick(unit, hex) {
    const enemy = hex.unit;

    // Check if enemy is in attack range
    const attackable = getAttackableUnits(unit);
    const canAttack = attackable.some(u => u.id === enemy.id);

    if (canAttack && state.sharedAP >= 1) {
        // Block if minigame is already in progress (prevents exploit)
        if (state.minigameInProgress) {
            return;
        }
        // Enemy is in range - attack!
        if (state.targetedUnit && state.targetedUnit.id === enemy.id) {
            // Second tap on same enemy - execute attack with minigame
            state.targetedUnit = null;
            state.pendingMoveDestination = null;
            state.currentPath = null;
            state.minigameInProgress = true;  // Block additional triggers

            try {
                // Start the attack minigame and wait for result
                const result = await executeAttackWithMinigame(unit, enemy);

                // If cancelled, just show message and return
                if (result.cancelled) {
                    showToast('Angriff abgebrochen', 'info');
                    render();
                    updateUI();
                    return;
                }

                if (result.killed) {
                    checkWinCondition();
                }

                render();
                updateUI();

                // Notify guided tutorial of attack
                notifyTutorialAction('unitAttacked');
                // Check for tutorial hints after attack
                showActionHint('attacked');
                checkTutorialHint();
            } finally {
                state.minigameInProgress = false;  // Always reset
            }
        } else {
            // First tap - target this enemy
            state.targetedUnit = enemy;
            state.pendingMoveDestination = null;
            state.currentPath = null;
            playTarget();
            render();
            updateUI();
            // Note: The target info panel now shows all attack details
            // No toast needed here as it would overlap with the target info panel
        }
    } else {
        // Enemy not in range - still target them so player can see info and plan approach
        if (state.sharedAP < 1) {
            playError();
            showToast('❌ Keine AP für Angriff!', 'warning');
            state.targetedUnit = null;
        } else {
            // Target the enemy even though out of range - helps player plan
            state.targetedUnit = enemy;
            state.pendingMoveDestination = null;
            state.currentPath = null;
            state.selectedAction = 'attack';  // Switch to attack mode
            playTarget();
            showToast('⚠️ Feind entdeckt! Näher herangehen zum Angreifen.', 'info');
        }
        render();
        updateUI();
    }
}

/**
 * Handle path preview on hover (mouse only)
 */
function handlePathPreview(clientX, clientY) {
    if (state.gameOver) return;
    // Block path preview during AI turns (including spectator mode)
    if (isAIPlayer()) return;
    // Don't show path preview if targeting an enemy
    if (state.targetedUnit) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - state.offsetX;
    const y = clientY - rect.top - state.offsetY;

    const hexCoord = pixelToHexWithHeight(x, y);
    const hex = getHex(hexCoord.q, hexCoord.r);

    state.hoveredHex = hex;

    state.currentPath = null;
}

/**
 * Handle move action click - tap-to-confirm system with multi-turn path support
 */
function handleMoveClick(unit, hex) {
    // Don't allow movement during animation
    if (state.animating) return;

    // Try to find path with extended range for multi-turn movement
    const maxExtendedCost = unit.move * 10; // Allow planning for many turns ahead
    // Movement limited by shared AP pool
    const maxMoveCost = state.sharedAP;

    // First try to find the full path
    const pathResult = findPath(unit.q, unit.r, hex.q, hex.r, maxExtendedCost);

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
    const reachablePath = [pathResult.path[0]]; // Start with current position
    let totalCost = 0;
    let lastReachableIndex = 0;

    for (let i = 1; i < pathResult.path.length; i++) {
        const point = pathResult.path[i];
        const pointHex = getHex(point.q, point.r);
        if (!pointHex) break;
        const prevPoint = pathResult.path[i - 1];
        const prevHex = getHex(prevPoint.q, prevPoint.r);
        cumulativeCost += getMoveCost(prevHex, pointHex);

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
        animateUnitMovement(unit, reachablePath, totalCost, async () => {
            // Play move end sound
            playMoveEnd();

            // Bewegung beendet Stellung-halten Bonus
            onUnitMoved(unit);

            // Check for power-up pickup after animation
            const pickup = checkPowerupPickup(unit);
            if (pickup) {
                showPowerupPickup(pickup.powerup, pickup.result);
            }

            updateVisibility();

            // Check for newly discovered enemies
            checkForNewEnemies(prevEnemyIds);

            // Auto-take cover if on valid terrain (forest)
            if (unit.alive && canAutoTakeCover(unit)) {
                autoTakeCover(unit);
                showToast('🌲 Automatisch in Deckung gegangen!', 'special');
            }

            render();
            updateUI();

            // Notify guided tutorial of movement
            notifyTutorialAction('unitMoved');
            // Check for tutorial hints after movement
            showActionHint('moved');
            checkTutorialHint();
        }, render, async () => processReactiveFire(unit));
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

async function processReactiveFire(movedUnit) {
    if (!movedUnit || !movedUnit.alive) return true;

    const ambushTriggers = checkAmbushTriggers(movedUnit);
    for (const trigger of ambushTriggers) {
        if (!movedUnit.alive) break;
        await executeAmbushAttack(trigger.ambusher, movedUnit);
        render();
        if (!movedUnit.alive) {
            checkWinCondition();
            return false;
        }
    }

    const overwatchTriggers = checkOverwatchTriggers(movedUnit);
    for (const trigger of overwatchTriggers) {
        if (!movedUnit.alive) break;
        await executeOverwatchAttack(trigger.watcher, movedUnit);
        render();
        if (!movedUnit.alive) {
            checkWinCondition();
            return false;
        }
    }

    return movedUnit.alive;
}

/**
 * Smoothly scroll camera to center on a unit
 */
export function scrollToUnit(unit, duration = 500) {
    if (!unit) return;

    const targetPos = getUnitTilePosition(unit);
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
 * Instantly center the camera on a unit (used for follow-cam tracking).
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
 * Calculate optimal zoom level to capture all relevant action in view
 * Used for situational/dynamic zoom during AI turns or spectator mode
 * @param {Object} focusUnit - The main unit to focus on
 * @param {Array} relevantUnits - Other units that should be visible (enemies, allies in combat)
 * @returns {number} Optimal zoom level (0.5 to 1.2 range)
 */
export function calculateSituationalZoom(focusUnit, relevantUnits = []) {
    if (!focusUnit || !canvas) return scaleToZoomLevel(0.85); // Default zoom

    // Gather all units that should be visible
    const unitsToShow = [focusUnit, ...relevantUnits].filter(u => u && u.hp > 0);

    if (unitsToShow.length <= 1) {
        // Single unit - use moderate zoom for context
        return scaleToZoomLevel(0.9);
    }

    // Calculate bounding box of all relevant units
    let minQ = Infinity, maxQ = -Infinity;
    let minR = Infinity, maxR = -Infinity;

    for (const unit of unitsToShow) {
        minQ = Math.min(minQ, unit.q);
        maxQ = Math.max(maxQ, unit.q);
        minR = Math.min(minR, unit.r);
        maxR = Math.max(maxR, unit.r);
    }

    // Calculate the spread of units in hex coordinates
    const spreadQ = maxQ - minQ;
    const spreadR = maxR - minR;
    const maxSpread = Math.max(spreadQ, spreadR);

    // Calculate zoom to fit all units with padding
    // More units spread out = zoom out more
    const viewportWidth = canvas.width || 800;
    const viewportHeight = canvas.height || 600;
    const minViewportDim = Math.min(viewportWidth, viewportHeight);

    // Each hex at zoom=1.0 is BASE_HEX_SIZE * 2 pixels wide approximately
    const hexPixelSize = getTileSizeForHexSize(CONFIG.BASE_HEX_SIZE) * 2;
    const requiredPixels = (maxSpread + 2) * hexPixelSize; // +2 for padding

    // Calculate zoom that would fit all units
    const zoomToFit = minViewportDim / requiredPixels;

    // Clamp to reasonable range:
    // - Minimum 0.6 for complex situations (many units spread out)
    // - Maximum 1.0 for close combat (don't zoom in too much)
    const minZoom = zoomLevelToScale(state.minZoom || 0.5);
    const maxZoom = Math.min(zoomLevelToScale(state.maxZoom || 2.0), 1.0); // Cap at 1.0 for situational

    const clampedScale = Math.max(minZoom, Math.min(maxZoom, zoomToFit * 0.8)); // 0.8 factor for extra padding
    return scaleToZoomLevel(clampedScale);
}

/**
 * Get units relevant to current action for situational zoom
 * @param {Object} activeUnit - The unit performing an action
 * @param {number} playerIndex - The player viewing
 * @returns {Array} Units that should be visible in the camera
 */
export function getRelevantUnitsForZoom(activeUnit, playerIndex) {
    if (!activeUnit) return [];

    const relevantUnits = [];
    const maxRelevantDistance = 8; // Only consider units within this hex distance

    for (const unit of state.units) {
        if (unit === activeUnit || unit.hp <= 0) continue;

        const dist = hexDistance(activeUnit, unit);
        if (dist > maxRelevantDistance) continue;

        // Include enemies visible to the viewer
        if (unit.player !== activeUnit.player) {
            // Check if visible to viewer
            const hex = getHex(unit.q, unit.r);
            if (hex && hex.visible && hex.visible[playerIndex]) {
                relevantUnits.push(unit);
            }
        }
        // Include nearby allies (for coordinated attacks, etc.)
        else if (dist <= 4) {
            relevantUnits.push(unit);
        }
    }

    return relevantUnits;
}

/**
 * Smoothly scroll camera to unit with dynamic zoom for spectator mode
 * Zooms in closer for a cinematic follow-cam experience
 * @param {Object} unit - Unit to focus on
 * @param {number} duration - Animation duration in ms
 * @param {number|null} targetZoom - Explicit zoom level, or null for situational zoom
 * @param {Array} relevantUnits - Additional units to keep in view (for situational zoom)
 * @returns Promise that resolves when animation completes
 */
export function scrollToUnitWithZoom(unit, duration = 600, targetZoom = null, relevantUnits = null) {
    return new Promise(resolve => {
        if (!unit) {
            resolve();
            return;
        }

        // Ensure valid starting zoom level
        const safeCurrentZoom = Number.isFinite(state.zoomLevel) && state.zoomLevel > 0 ? state.zoomLevel : scaleToZoomLevel(1.0);

        // Determine ideal zoom level:
        // 1. If explicit targetZoom is provided, use it
        // 2. If relevantUnits are provided (spectator mode), calculate situational zoom
        // 3. Otherwise keep current zoom
        let idealZoom;
        if (targetZoom !== null) {
            idealZoom = targetZoom;
        } else if (relevantUnits !== null) {
            // Situational zoom based on unit distribution
            idealZoom = calculateSituationalZoom(unit, relevantUnits);
        } else {
            // Keep current zoom
            idealZoom = safeCurrentZoom;
        }

        // Use state.minZoom and state.maxZoom for clamping
        const minZoom = state.minZoom || 0.5;
        const maxZoom = state.maxZoom || 2.0;
        const clampedZoom = Math.min(Math.max(idealZoom, minZoom), maxZoom);

        // Calculate target position at the target zoom level
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

            // Ease in-out cubic for smooth cinematic movement
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // Animate zoom
            state.zoomLevel = startZoom + (clampedZoom - startZoom) * ease;
            state.hexSize = CONFIG.BASE_HEX_SIZE * zoomLevelToScale(state.zoomLevel);

            // Recalculate target position at current zoom level for smooth tracking
            const currentTargetPos = getUnitTilePosition(unit);
            const currentTargetCameraX = -currentTargetPos.x;
            const currentTargetCameraY = -currentTargetPos.y;

            // Animate camera position
            state.cameraX = startCameraX + (currentTargetCameraX - startCameraX) * ease;
            state.cameraY = startCameraY + (currentTargetCameraY - startCameraY) * ease;

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
 * Smoothly animate zoom level
 * @returns Promise that resolves when animation completes
 */
function animateZoom(targetZoom, duration = 500) {
    return new Promise(resolve => {
        // Ensure valid starting zoom level
        const startZoom = Number.isFinite(state.zoomLevel) && state.zoomLevel > 0 ? state.zoomLevel : scaleToZoomLevel(1.0);
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Ease in-out cubic
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            state.zoomLevel = startZoom + (targetZoom - startZoom) * ease;
            state.hexSize = CONFIG.BASE_HEX_SIZE * zoomLevelToScale(state.zoomLevel);

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
 * Smoothly animate camera to position
 * @returns Promise that resolves when animation completes
 */
function animateCameraTo(targetCameraX, targetCameraY, duration = 500) {
    return new Promise(resolve => {
        const startCameraX = state.cameraX;
        const startCameraY = state.cameraY;
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Ease in-out cubic
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

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
 * Play game intro flyover animation
 * Shows an overview of the map, pans across visible terrain, then zooms to player's units
 */
export async function playGameIntro() {
    if (state.introShown) return;

    state.introShown = true;
    state.animating = true;

    try {
        const playerUnits = getPlayerUnits(state.currentPlayer);
        if (playerUnits.length === 0) {
            state.animating = false;
            return;
        }

        // Calculate bounding box of player's units
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const unit of playerUnits) {
            const pos = getUnitTilePosition(unit, getTileSizeForHexSize(CONFIG.BASE_HEX_SIZE));
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        }

        // Calculate center of units
        const unitCenterX = (minX + maxX) / 2;
        const unitCenterY = (minY + maxY) / 2;

        // Get map size for overview
        const mapRadius = CONFIG.MAP_SIZES[state.settings.size] || 8;
        const mapExtent = mapRadius * getTileSizeForHexSize(CONFIG.BASE_HEX_SIZE) * 1.5;

        // Step 1: Start with a wide overview of the entire map
        const overviewZoom = scaleToZoomLevel(0.4);
        state.cameraX = 0;
        state.cameraY = 0;
        state.zoomLevel = overviewZoom;
        state.hexSize = CONFIG.BASE_HEX_SIZE * zoomLevelToScale(state.zoomLevel);
        limitCameraBounds();
        updateCameraOffset();
        render();

        await delay(600);

        // Step 2: Pan diagonally across the visible map area
        // This shows the terrain before focusing on units
        const panPoints = [
            { x: mapExtent * 0.3, y: -mapExtent * 0.3 },   // Upper right area
            { x: -mapExtent * 0.3, y: mapExtent * 0.2 },   // Lower left area
        ];

        for (const point of panPoints) {
            await animateCameraTo(-point.x, -point.y, 800);
            await delay(300);
        }

        // Step 3: Pan to player's units area (still zoomed out)
        await animateCameraTo(-unitCenterX, -unitCenterY, 600);
        await delay(400);

        // Step 4: Zoom in while panning to each unit
        const intermediateZoom = scaleToZoomLevel(0.7);
        await animateZoom(intermediateZoom, 500);

        // Step 5: Show each unit briefly
        for (const unit of playerUnits.slice(0, 3)) {
            const pos = getUnitTilePosition(unit, getTileSizeForHexSize(CONFIG.BASE_HEX_SIZE));
            await animateCameraTo(-pos.x, -pos.y, 500);
            await delay(350);
        }

        // Step 6: Final zoom to first unit
        const firstUnit = playerUnits[0];
        const firstPos = getUnitTilePosition(firstUnit, getTileSizeForHexSize(CONFIG.BASE_HEX_SIZE));

        await Promise.all([
            animateCameraTo(-firstPos.x, -firstPos.y, 700),
            animateZoom(scaleToZoomLevel(1.0), 700)
        ]);

        // Start tutorial if this is the first game
        startTutorialIfNeeded();
    } catch (error) {
        console.error('[Intro] Error during game intro animation:', error);
    } finally {
        // Always reset animation state, even if error occurred
        state.animating = false;
    }
}

/**
 * Start the tutorial if this is the player's first game
 */
function startTutorialIfNeeded() {
    // Try guided tutorial first (for better first-time experience)
    if (shouldStartGuidedTutorial()) {
        // Small delay to let the UI settle
        setTimeout(() => {
            startGuidedTutorial();
        }, 500);
        return;
    }

    // Fall back to simple tutorial hints
    if (shouldStartTutorial()) {
        setTimeout(() => {
            startTutorial();
        }, 500);
    }
}

/**
 * Utility: delay helper for async functions
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    // Movement limited by shared AP pool
    const maxMoveCost = state.sharedAP;
    const pathResult = findPath(unit.q, unit.r, queuedPath.targetQ, queuedPath.targetR, unit.move * 10);

    if (!pathResult || !pathResult.path || pathResult.path.length < 2) {
        // Path is no longer valid
        clearQueuedPath(unit.id);
        showToast('❌ Gespeicherter Pfad nicht mehr gültig', 'warning');
        return false;
    }

    // Calculate reachable portion
    let cumulativeCost = 0;
    const reachablePath = [pathResult.path[0]];
    let totalCost = 0;
    let lastReachableIndex = 0;

    for (let i = 1; i < pathResult.path.length; i++) {
        const point = pathResult.path[i];
        const pointHex = getHex(point.q, point.r);
        if (!pointHex) break;
        const prevPoint = pathResult.path[i - 1];
        const prevHex = getHex(prevPoint.q, prevPoint.r);
        cumulativeCost += getMoveCost(prevHex, pointHex);

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
 * Execute all queued paths for the current player automatically at turn start
 * Returns a Promise that resolves when all movements are complete
 */
export async function executeQueuedPathsForPlayer() {
    const playerUnits = getPlayerUnits(state.currentPlayer);
    const unitsWithPaths = playerUnits.filter(unit => {
        const queuedPath = getQueuedPath(unit.id);
        return queuedPath && queuedPath.path && queuedPath.path.length >= 1;
    });

    if (unitsWithPaths.length === 0) return;

    showToast(`📍 ${unitsWithPaths.length} Wegpunkt${unitsWithPaths.length > 1 ? 'e werden' : ' wird'} ausgeführt...`, 'info');

    for (const unit of unitsWithPaths) {
        if (!unit.alive) continue;
        if (state.sharedAP <= 0) break;

        const success = await executeQueuedPathForUnit(unit);
        if (!success) continue;

        // Small delay between units
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    render();
    updateUI();
}

/**
 * Execute a single queued path for a unit
 * Returns a Promise that resolves when movement is complete
 */
async function executeQueuedPathForUnit(unit) {
    const queuedPath = getQueuedPath(unit.id);
    if (!queuedPath || !queuedPath.path) return false;

    // Recalculate path from current position to target
    const pathResult = findPath(unit.q, unit.r, queuedPath.targetQ, queuedPath.targetR, unit.move * 10);

    if (!pathResult || !pathResult.path || pathResult.path.length < 2) {
        // Path is blocked or invalid
        clearQueuedPath(unit.id);
        const blockedUnitName = UNIT_CLASSES[unit.class]?.name || unit.class;
        showToast(`❌ Pfad für ${blockedUnitName} blockiert`, 'warning');
        return false;
    }

    // Calculate reachable portion with current AP
    const maxMoveCost = state.sharedAP;
    let cumulativeCost = 0;
    const reachablePath = [pathResult.path[0]];
    let totalCost = 0;
    let lastReachableIndex = 0;

    for (let i = 1; i < pathResult.path.length; i++) {
        const point = pathResult.path[i];
        const pointHex = getHex(point.q, point.r);
        if (!pointHex) break;
        const prevPoint = pathResult.path[i - 1];
        const prevHex = getHex(prevPoint.q, prevPoint.r);
        cumulativeCost += getMoveCost(prevHex, pointHex);

        if (cumulativeCost <= maxMoveCost && !pointHex.unit) {
            reachablePath.push(point);
            totalCost = cumulativeCost;
            lastReachableIndex = i;
        } else if (pointHex.unit && pointHex.unit.id !== unit.id) {
            // Path blocked by another unit
            break;
        }
    }

    if (reachablePath.length < 2 || totalCost === 0) {
        // Can't move this turn, keep the path for next turn
        return false;
    }

    // Check if we reached the destination
    const isComplete = lastReachableIndex >= pathResult.path.length - 1;

    // Update or clear queued path
    if (!isComplete) {
        const remainingPath = pathResult.path.slice(lastReachableIndex);
        setQueuedPath(unit.id, remainingPath, queuedPath.targetQ, queuedPath.targetR);
    } else {
        clearQueuedPath(unit.id);
    }

    // Scroll to unit before moving
    scrollToUnit(unit, 300);
    await new Promise(resolve => setTimeout(resolve, 350));

    // Execute the movement
    playMoveStart();

    // Reveal from cover when moving
    if (unit.hiding) {
        unit.hiding = false;
    }

    await animateUnitMovement(unit, reachablePath, totalCost, null, render, async () => processReactiveFire(unit));

    playMoveEnd();

    // Bewegung beendet Stellung-halten Bonus
    onUnitMoved(unit);

    // Check for power-up pickup
    const pickup = checkPowerupPickup(unit);
    if (pickup) {
        showPowerupPickup(pickup.powerup, pickup.result);
    }

    updateVisibility();

    // Auto-take cover if on valid terrain
    if (unit.alive && canAutoTakeCover(unit)) {
        autoTakeCover(unit);
    }

    render();
    updateUI();
    return true;
}

/**
 * Cancel all queued paths for the current player
 */
export function cancelAllQueuedPaths() {
    const playerUnits = getPlayerUnits(state.currentPlayer);
    let cancelled = 0;

    playerUnits.forEach(unit => {
        if (getQueuedPath(unit.id)) {
            clearQueuedPath(unit.id);
            cancelled++;
        }
    });

    if (cancelled > 0) {
        showToast(`🚫 ${cancelled} Wegpunkt${cancelled > 1 ? 'e' : ''} abgebrochen`, 'info');
        render();
    }

    return cancelled;
}

/**
 * Get count of units with queued paths for current player
 */
export function getQueuedPathCount() {
    const playerUnits = getPlayerUnits(state.currentPlayer);
    return playerUnits.filter(unit => {
        const queuedPath = getQueuedPath(unit.id);
        return queuedPath && queuedPath.path && queuedPath.path.length >= 1;
    }).length;
}

/**
 * Update the waypoint cancel button UI based on queued path count
 */
export function updateWaypointUI() {
    const cancelBtn = document.getElementById('cancel-waypoints-btn');
    const waypointCount = document.getElementById('waypoint-count');

    if (!cancelBtn) return;

    const count = getQueuedPathCount();

    if (count > 0) {
        cancelBtn.style.display = 'flex';
        if (waypointCount) {
            waypointCount.textContent = count;
        }
    } else {
        cancelBtn.style.display = 'none';
    }
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
async function handleAttackClick(unit, hex) {
    // Prüfe ob Einheit auf Hex ist, ob sie ein FEIND ist (nicht verbündet), und ob sie lebt
    if (hex.unit && !areUnitsAllied(unit, hex.unit) && hex.unit.alive) {
        const attackable = getAttackableUnits(unit);
        const canAttack = attackable.some(u => u.id === hex.unit.id);

        if (canAttack) {
            // Block if minigame is already in progress (prevents exploit)
            if (state.minigameInProgress) {
                return;
            }
            if (state.targetedUnit && state.targetedUnit.id === hex.unit.id) {
                state.targetedUnit = null;
                state.minigameInProgress = true;  // Block additional triggers

                try {
                    // Execute attack with minigame
                    const result = await executeAttackWithMinigame(unit, hex.unit);

                    // If cancelled, just show message and return
                    if (result.cancelled) {
                        showToast('Angriff abgebrochen', 'info');
                        render();
                        updateUI();
                        return;
                    }

                    if (result.killed) {
                        checkWinCondition();
                    }

                    render();
                    updateUI();
                } finally {
                    state.minigameInProgress = false;  // Always reset
                }
            } else {
                state.targetedUnit = hex.unit;
                render();
                updateUI();
            }
        } else {
            // Target is out of range
            showToast('❌ Ziel außer Reichweite!', 'warning');
        }
    } else if (hex.unit && areUnitsAllied(unit, hex.unit) && hex.unit.player !== unit.player) {
        // Verbündeter angeklickt - zeige Hinweis
        showToast('🤝 Verbündete können nicht angegriffen werden!', 'info');
        state.targetedUnit = null;
        render();
        updateUI();
    } else {
        state.targetedUnit = null;
        render();
        updateUI();
    }
}

/**
 * Handle suppression action click - suppress a hex within attack range
 */
function handleSuppressionClick(unit, hex) {
    // Prüfe ob das Hex in Angriffsreichweite ist
    const distance = hexDistance({ q: unit.q, r: unit.r }, { q: hex.q, r: hex.r });
    const attackRange = unit.range || 2;

    if (distance > attackRange) {
        showToast('❌ Hex außer Reichweite!', 'warning');
        playError();
        return;
    }

    if (distance === 0) {
        showToast('❌ Kann eigenes Feld nicht unterdrücken!', 'warning');
        playError();
        return;
    }

    // Führe Unterdrückung aus
    const success = useSuppression(unit, hex.q, hex.r);

    if (success) {
        // Zurück zum Move-Modus
        state.selectedAction = 'move';
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
        readyBtn.onclick = async () => {
            showScreen(null);
            updateVisibility();
            updateUI();

            // Center on team and zoom to show all units
            requestAnimationFrame(async () => {
                await centerOnTeam(state.currentPlayer, 600);
            });

            // Execute any queued paths after a short delay
            setTimeout(async () => {
                await executeQueuedPathsForPlayer();
            }, 700);
        };
    }

    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        let endTurnPending = false;
        endTurnBtn.onclick = () => {
            // Check if any unit still has AP
            const playerUnits = state.units.filter(u => u.player === state.currentPlayer && u.alive);
            const totalAP = state.sharedAP;

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

    // Cancel waypoints button
    const cancelWaypointsBtn = document.getElementById('cancel-waypoints-btn');
    if (cancelWaypointsBtn) {
        cancelWaypointsBtn.onclick = () => {
            cancelAllQueuedPaths();
            updateWaypointUI();
        };
    }

    // Round info dropdown toggle (AP display and round info)
    const roundInfoToggle = document.getElementById('round-info-toggle');
    const roundDropdown = document.getElementById('round-dropdown');
    if (roundInfoToggle && roundDropdown) {
        // Toggle dropdown on click/touch
        const toggleDropdown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            roundDropdown.classList.toggle('visible');
        };

        // Support both click and touch events for reliable mobile handling
        roundInfoToggle.onclick = toggleDropdown;
        roundInfoToggle.addEventListener('touchend', (e) => {
            // Only handle if not already handled by onclick
            if (e.cancelable) {
                toggleDropdown(e);
            }
        }, { passive: false });

        // Close dropdown when clicking/touching elsewhere
        const closeDropdown = (e) => {
            if (!roundDropdown.contains(e.target) && !roundInfoToggle.contains(e.target)) {
                roundDropdown.classList.remove('visible');
            }
        };
        document.addEventListener('click', closeDropdown);
        document.addEventListener('touchend', closeDropdown);
    }

    const giveUpBtn = document.getElementById('give-up-btn');
    if (giveUpBtn) {
        giveUpBtn.onclick = () => {
            if (state.gameOver) return;
            // Close dropdown
            const roundDropdown = document.getElementById('round-dropdown');
            if (roundDropdown) roundDropdown.classList.remove('visible');

            // Show confirmation dialog
            if (!confirm('Spiel wirklich aufgeben?')) {
                return;
            }

            const remainingPlayers = [];
            for (let p = 0; p < state.settings.players; p++) {
                if (p === state.currentPlayer) continue;
                const units = getPlayerUnits(p);
                if (units.length > 0) remainingPlayers.push(p);
            }
            const winner = remainingPlayers.length === 1 ? remainingPlayers[0] : (remainingPlayers[0] ?? null);
            showToast('🏳️ Du hast aufgegeben.', 'warning');
            endGame(winner);
        };
    }

    // Back to menu button
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    if (backToMenuBtn) {
        backToMenuBtn.onclick = () => {
            // Close dropdown
            const roundDropdown = document.getElementById('round-dropdown');
            if (roundDropdown) roundDropdown.classList.remove('visible');

            // Show confirmation dialog
            if (!confirm('Spiel wirklich beenden und zum Menü?')) {
                return;
            }

            // Stop ambient audio
            import('./audio.js').then(({ stopAmbient }) => {
                stopAmbient();
            });

            // Mark game as over to prevent any further processing
            state.gameOver = true;

            // Return to menu
            showScreen('menu');
        };
    }
}

/**
 * Setup click handler for target info panel
 * Allows tapping the "tap again to attack" panel to execute attack
 */
function setupTargetInfoClick() {
    const targetInfo = document.getElementById('target-info');
    if (!targetInfo) return;

    const handleClick = async () => {
        // Only respond if there's a targeted enemy and game is active
        if (!state.targetedUnit || state.gameOver || isAIPlayer()) return;

        const unit = getCurrentUnit();
        if (!unit) return;

        // Check if enemy is in attack range
        const attackable = getAttackableUnits(unit);
        const canAttack = attackable.some(u => u.id === state.targetedUnit.id);

        if (canAttack && state.sharedAP >= 1 && !state.minigameInProgress) {
            // Execute attack with minigame
            const enemy = state.targetedUnit;
            state.targetedUnit = null;
            state.pendingMoveDestination = null;
            state.currentPath = null;
            state.minigameInProgress = true;

            try {
                const result = await executeAttackWithMinigame(unit, enemy);
                // If cancelled, just show message and return
                if (result.cancelled) {
                    showToast('Angriff abgebrochen', 'info');
                    render();
                    updateUI();
                    return;
                }
                if (result.killed) {
                    checkWinCondition();
                }
                render();
                updateUI();
                notifyTutorialAction('unitAttacked');
                showActionHint('attacked');
                checkTutorialHint();
            } finally {
                state.minigameInProgress = false;
            }
        } else if (!state.minigameInProgress && state.targetedUnit) {
            // Attack not possible - show feedback why
            showAttackBlockedFeedback(unit, state.targetedUnit);
        }
    };

    // Support both click and touch
    targetInfo.addEventListener('click', handleClick);
    targetInfo.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleClick();
    });
}

/**
 * Setup action buttons
 */
function setupActionButtons() {
    // Special ability button - uses correct AP costs and healing minigame for medic
    const specialBtn = document.querySelector('.action-btn[data-action="special"]');
    if (specialBtn) {
        specialBtn.onclick = () => {
            const unit = getCurrentUnit();
            if (!unit) return;

            const cost = getSpecialAbilityCost(unit.class);

            if (canUseSpecialAbility(unit)) {
                // Block if minigame is already in progress (prevents exploit)
                if (state.minigameInProgress) {
                    return;
                }
                // Medic uses healing minigame
                if (unit.class === 'medic') {
                    // Spend AP and mark as used before starting minigame
                    spendSharedAP(cost);
                    unit.usedSpecial = true;
                    state.minigameInProgress = true;  // Block additional triggers
                    (async () => {
                        try {
                            await useMedicHealingWithMinigame(unit);
                        } finally {
                            state.minigameInProgress = false;  // Always reset
                        }
                        render();
                        updateUI();
                    })();
                } else {
                    // Other classes use normal special ability
                    useSpecialAbility(unit);
                    render();
                    updateUI();
                }
            } else if (unit.usedSpecial) {
                showToast('❌ Spezialfähigkeit bereits benutzt!', 'warning');
            } else if (state.sharedAP < cost) {
                showToast(`❌ Nicht genug AP (braucht ${cost})!`, 'warning');
            } else {
                showToast('❌ Spezialfähigkeit nicht verfügbar!', 'warning');
            }
        };
    }

    // === HINTERHALT-BUTTON ===
    const ambushBtn = document.getElementById('ambush-btn');
    if (ambushBtn) {
        ambushBtn.onclick = () => {
            const unit = getCurrentUnit();
            if (unit && canPrepareAmbush(unit)) {
                // Show first-use explanation
                showFirstUseExplanation('ambush');
                prepareAmbush(unit);
                render();
                updateUI();
            } else if (unit && unit.ambushReady) {
                showToast('🎯 Hinterhalt bereits vorbereitet!', 'info');
            } else if (unit && state.sharedAP < 1) {
                showToast('❌ Nicht genug AP (braucht 1)!', 'warning');
            } else if (unit && !unit.cloaked && !unit.hiding) {
                showToast('❌ Nur aus Tarnung oder Deckung möglich!', 'warning');
            }
        };
    }

    // === KOORDINATIONS-BUTTON ===
    const coordBtn = document.getElementById('coordinate-btn');
    if (coordBtn) {
        coordBtn.onclick = async () => {
            const unit = getCurrentUnit();
            const target = state.targetedUnit;

            if (!unit || !target) {
                showToast('❌ Ziel wählen, dann koordinieren!', 'warning');
                return;
            }

            const eligible = getEligibleCoordinators(target);
            if (eligible.length < 2) {
                showToast('❌ Mindestens 2 Einheiten zum Koordinieren nötig!', 'warning');
                return;
            }

            // Show first-use explanation
            showFirstUseExplanation('coordinate');

            // Alle geeigneten Einheiten greifen an
            state.animating = true;
            await executeCoordinatedAttack(eligible, target);
            state.animating = false;

            state.targetedUnit = null;
            render();
            updateUI();
            checkWinCondition();
        };
    }

    // === UNTERDRÜCKUNGSFEUER BUTTON ===
    const suppressBtn = document.getElementById('suppress-btn');
    if (suppressBtn) {
        suppressBtn.onclick = () => {
            const unit = getCurrentUnit();
            if (!unit) return;

            if (canUseSuppression(unit)) {
                // Show first-use explanation
                showFirstUseExplanation('suppress');
                // Wechsle in den Unterdrückungs-Modus
                state.selectedAction = 'suppress';
                showToast('🔥 Wähle ein Feld zum Unterdrücken (2 AP)', 'info');
                render();
                updateUI();
            } else if (!['assault', 'sniper'].includes(unit.class)) {
                showToast('❌ Nur Assault und Sniper können unterdrücken!', 'warning');
            } else if (state.sharedAP < 2) {
                showToast('❌ Nicht genug AP (braucht 2)!', 'warning');
            }
        };
    }

    // === OVERWATCH BUTTON ===
    const overwatchBtn = document.getElementById('overwatch-btn');
    if (overwatchBtn) {
        overwatchBtn.onclick = () => {
            const unit = getCurrentUnit();
            if (!unit) return;

            if (canUseOverwatch(unit)) {
                // Show first-use explanation
                showFirstUseExplanation('overwatch');
                activateOverwatch(unit);
                render();
                updateUI();
            } else if (isUnitOnOverwatch(unit.id)) {
                showToast('👁️ Einheit ist bereits im Overwatch!', 'info');
            } else if (state.sharedAP < 2) {
                showToast('❌ Nicht genug AP (braucht 2)!', 'warning');
            }
        };
    }
}

/**
 * Show feedback when an attack is blocked
 * Explains WHY the attack can't be executed
 */
function showAttackBlockedFeedback(unit, target) {
    if (!unit || !target) return;

    // Check possible reasons for blocked attack

    // 1. Check if unit has reached attack limit
    if (!canUnitAttack(unit)) {
        playError();
        showToast('❌ Diese Einheit hat diese Runde bereits angegriffen!', 'warning');
        state.targetedUnit = null;
        render();
        updateUI();
        return;
    }

    // 2. Check if not enough AP
    if (state.sharedAP < 1) {
        playError();
        showToast('❌ Nicht genug AP für Angriff!', 'warning');
        state.targetedUnit = null;
        render();
        updateUI();
        return;
    }

    // 3. Check distance vs range
    const effectiveRange = getEffectiveRange(unit);
    const distance = hexDistance({ q: unit.q, r: unit.r }, { q: target.q, r: target.r });

    if (distance > effectiveRange) {
        playError();
        showToast(`❌ Ziel außer Reichweite! (${distance} Felder, max. ${effectiveRange})`, 'warning');
        // Keep target for reference, but provide guidance
        render();
        updateUI();
        return;
    }

    // 4. Check line of sight
    const los = hasLineOfSight(unit.q, unit.r, target.q, target.r);
    if (!los.clear) {
        playError();
        const blockedByName = los.blockedBy || 'Hindernis';
        showToast(`❌ Keine Sichtlinie! Blockiert durch ${blockedByName}`, 'warning');
        // Keep target for reference
        render();
        updateUI();
        return;
    }

    // 5. Generic fallback
    playError();
    showToast('❌ Angriff nicht möglich!', 'warning');
    render();
    updateUI();
}
