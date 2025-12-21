// ===== UI MANAGEMENT =====

import { CONFIG, UNIT_CLASSES } from './config.js';
import { state, getPlayerUnits, getCurrentUnit } from './state.js';
import { calculateHitChance } from './combat.js';
import { render } from './renderer.js';

/**
 * Update all UI elements
 */
export function updateUI() {
    const units = getPlayerUnits(state.currentPlayer);
    const unit = getCurrentUnit();

    updateTopBar(unit);
    updateUnitTabs(units);
    updateActionButtons(unit);
    updateTargetInfo(unit);
}

/**
 * Update top bar (player indicator, round, AP)
 */
function updateTopBar(unit) {
    const dot = document.getElementById('current-dot');
    if (dot) {
        dot.style.backgroundColor = CONFIG.PLAYER_COLORS[state.currentPlayer];
        dot.style.boxShadow = `0 0 15px ${CONFIG.PLAYER_COLORS[state.currentPlayer]}`;
    }

    const nameEl = document.getElementById('current-name');
    if (nameEl) {
        nameEl.textContent = `Spieler ${state.currentPlayer + 1}`;
    }

    const roundEl = document.getElementById('round-num');
    if (roundEl) {
        roundEl.textContent = state.round;
    }

    // AP display
    const apDisplay = document.getElementById('ap-display');
    if (apDisplay) {
        apDisplay.innerHTML = '';
        if (unit) {
            for (let i = 0; i < CONFIG.AP_PER_TURN; i++) {
                const pip = document.createElement('div');
                pip.className = 'ap-pip' + (i >= unit.ap ? ' used' : '');
                pip.textContent = i < unit.ap ? '⚡' : '';
                apDisplay.appendChild(pip);
            }
        }
    }
}

/**
 * Update unit selection tabs
 */
function updateUnitTabs(units) {
    const tabsEl = document.getElementById('unit-tabs');
    if (!tabsEl) return;

    tabsEl.innerHTML = '';

    units.forEach((unit, index) => {
        const tab = document.createElement('div');
        tab.className = 'unit-tab';
        if (index === state.selectedUnit) tab.classList.add('selected');
        if (!unit.alive) tab.classList.add('dead');

        const hpPct = unit.currentHp / unit.maxHp;
        let hpClass = '';
        if (hpPct <= 0.5) hpClass = ' medium';
        if (hpPct <= 0.25) hpClass = ' low';

        tab.innerHTML = `
            <div class="class-icon">${UNIT_CLASSES[unit.class].icon}</div>
            <div class="class-name">${UNIT_CLASSES[unit.class].name}</div>
            <div class="hp-bar">
                <div class="hp-fill${hpClass}" style="width: ${hpPct * 100}%"></div>
            </div>
        `;

        tab.onclick = () => {
            if (unit.alive) {
                state.selectedUnit = index;
                state.targetedUnit = null;
                state.currentPath = null;
                updateUI();
                render();
            }
        };

        tabsEl.appendChild(tab);
    });
}

/**
 * Update action buttons state
 */
function updateActionButtons(unit) {
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.classList.remove('selected', 'disabled');
        const action = btn.dataset.action;

        if (action === state.selectedAction) {
            btn.classList.add('selected');
        }

        if (!unit) {
            btn.classList.add('disabled');
        } else {
            if (action === 'move' && unit.ap < 1) btn.classList.add('disabled');
            if (action === 'attack' && unit.ap < 1) btn.classList.add('disabled');
            if (action === 'special' && (unit.ap < 2 || unit.usedSpecial)) btn.classList.add('disabled');
        }
    });
}

/**
 * Update target info overlay
 */
function updateTargetInfo(unit) {
    const infoEl = document.getElementById('target-info');
    if (!infoEl) return;

    if (state.targetedUnit && state.selectedAction === 'attack' && unit) {
        const chance = calculateHitChance(unit, state.targetedUnit);

        const hitChanceEl = document.getElementById('hit-chance');
        const damageEl = document.getElementById('damage-info');

        if (hitChanceEl) hitChanceEl.textContent = chance + '%';
        if (damageEl) damageEl.textContent = `~${unit.damage} Schaden`;

        infoEl.classList.add('visible');
    } else {
        infoEl.classList.remove('visible');
    }
}

/**
 * Show a specific screen
 */
export function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) {
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active');
    }
}

/**
 * Show a toast notification
 */
export function showToast(message, type = '') {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast' + (type ? ` ${type}` : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto remove
    setTimeout(() => toast.remove(), 1800);
}

/**
 * Select an action
 */
export function selectAction(action) {
    state.selectedAction = action;
    state.targetedUnit = null;
    state.currentPath = null;
    updateUI();
    render();
}
