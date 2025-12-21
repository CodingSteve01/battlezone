// ===== INPUT HANDLING =====

import { state, getHex, getCurrentUnit } from './state.js';
import { pixelToHex } from './hexMath.js';
import { getReachableHexes, getPathToHex } from './pathfinding.js';
import { getAttackableUnits, moveUnit } from './units.js';
import { executeAttack, useSpecialAbility } from './combat.js';
import { checkWinCondition, endTurn } from './turns.js';
import { updateVisibility } from './fogOfWar.js';
import { updateUI, selectAction, showScreen } from './ui.js';
import { render, resizeCanvas } from './renderer.js';

let canvas;

/**
 * Initialize input handlers
 */
export function initInput() {
    canvas = document.getElementById('game-canvas');

    // Canvas interactions
    canvas.addEventListener('click', handleCanvasClick);

    // Touch support - use changedTouches for touchend (FIXED BUG)
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleCanvasClick(e);
    });

    // Hover for path preview
    canvas.addEventListener('mousemove', handleCanvasMove);
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        handleCanvasMove(e);
    });

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
 * Handle canvas click/tap
 */
function handleCanvasClick(e) {
    if (state.gameOver || state.animating) return;

    const rect = canvas.getBoundingClientRect();

    // Support both mouse and touch - FIXED: use changedTouches for touchend
    const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const clientY = e.clientY ?? e.changedTouches?.[0]?.clientY;

    if (clientX === undefined || clientY === undefined) return;

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
 * Handle move action click
 */
function handleMoveClick(unit, hex) {
    const reachable = getReachableHexes(unit);
    const hexKey = `${hex.q},${hex.r}`;
    const pathData = reachable.get(hexKey);

    if (pathData) {
        moveUnit(unit, pathData.hex, pathData.cost);
        state.currentPath = null;

        // Update visibility after move
        updateVisibility();

        render();
        updateUI();
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
 * Handle canvas hover/move for path preview
 */
function handleCanvasMove(e) {
    if (state.gameOver || state.selectedAction !== 'move') return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const x = clientX - rect.left - state.offsetX;
    const y = clientY - rect.top - state.offsetY;

    const hexCoord = pixelToHex(x, y, state.hexSize);
    const hex = getHex(hexCoord.q, hexCoord.r);

    state.hoveredHex = hex;

    // Update path preview
    const unit = getCurrentUnit();
    if (unit && hex) {
        const reachable = getReachableHexes(unit);
        const hexKey = `${hex.q},${hex.r}`;
        const pathData = reachable.get(hexKey);

        if (pathData && pathData.path) {
            state.currentPath = pathData.path;
        } else {
            state.currentPath = null;
        }

        render();
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
            render();
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
