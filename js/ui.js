// ===== UI MANAGEMENT =====

import { CONFIG, UNIT_CLASSES } from './config.js';
import { state, getPlayerUnits, getCurrentUnit } from './state.js';
import { calculateHitChance } from './combat.js';
import { render, resizeCanvas } from './renderer.js';
import { getEffectiveDamage, getXPProgress, getRankName } from './progression.js';
import { hexToPixel } from './hexMath.js';

/**
 * Center camera on a specific unit
 */
function centerOnUnit(unit) {
    if (!unit) return;

    // Calculate unit position in pixels
    const pos = hexToPixel(unit.q, unit.r, state.hexSize);

    // Set camera to center on unit with smooth animation feel
    state.cameraX = -pos.x;
    state.cameraY = -pos.y;

    // Update offset (replicated from input.js to avoid circular dependency)
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        const rect = canvas.getBoundingClientRect();
        state.offsetX = rect.width / 2 + state.cameraX;
        state.offsetY = rect.height / 2 + state.cameraY;
    }
}

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

        // Get XP progress
        const xpProgress = getXPProgress(unit);
        const level = unit.level || 1;
        const rankName = getRankName(level);

        // Level badge color based on level
        const levelColors = ['#9ca3af', '#22c55e', '#3b82f6', '#a855f7', '#eab308'];
        const levelColor = levelColors[Math.min(level - 1, levelColors.length - 1)];

        // AP info
        const apPct = (unit.ap / CONFIG.AP_PER_TURN) * 100;
        let apClass = '';
        if (unit.ap <= 1) apClass = ' low';
        else if (unit.ap <= 2) apClass = ' medium';

        tab.innerHTML = `
            <div class="class-icon">${UNIT_CLASSES[unit.class].icon}</div>
            <div class="class-name">${UNIT_CLASSES[unit.class].name}</div>
            <div class="unit-level" style="background: ${levelColor}">Lv.${level}</div>
            <div class="hp-bar">
                <div class="hp-fill${hpClass}" style="width: ${hpPct * 100}%"></div>
            </div>
            <div class="ap-bar-container">
                <div class="ap-bar">
                    <div class="ap-fill${apClass}" style="width: ${apPct}%"></div>
                </div>
                <div class="ap-number">${unit.ap}⚡</div>
            </div>
            ${!xpProgress.maxLevel ? `
                <div class="xp-bar">
                    <div class="xp-fill" style="width: ${xpProgress.progress * 100}%"></div>
                </div>
            ` : ''}
        `;

        tab.onclick = () => {
            if (unit.alive) {
                state.selectedUnit = index;
                state.targetedUnit = null;
                state.currentPath = null;
                state.pendingMoveDestination = null;
                // Center camera on the selected unit
                centerOnUnit(unit);
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
    // Update special ability button
    const specialBtn = document.querySelector('.action-btn[data-action="special"]');
    if (specialBtn) {
        specialBtn.classList.remove('disabled');

        const labelEl = document.getElementById('special-label');

        if (!unit) {
            specialBtn.classList.add('disabled');
            if (labelEl) labelEl.textContent = 'Spezial';
        } else {
            // Update label with unit's special ability name
            const unitClass = UNIT_CLASSES[unit.class];
            if (labelEl && unitClass) {
                labelEl.textContent = unitClass.special || 'Spezial';
            }

            // Disable if not enough AP or already used
            if (unit.ap < 2 || unit.usedSpecial) {
                specialBtn.classList.add('disabled');
            }
        }
    }
}

/**
 * Update target info overlay
 */
function updateTargetInfo(unit) {
    const infoEl = document.getElementById('target-info');
    if (!infoEl) return;

    // Show target info when an enemy is targeted
    if (state.targetedUnit && unit) {
        const chance = calculateHitChance(unit, state.targetedUnit);
        const effectiveDamage = getEffectiveDamage(unit);

        const hitChanceEl = document.getElementById('hit-chance');
        const damageEl = document.getElementById('damage-info');

        if (hitChanceEl) hitChanceEl.textContent = chance + '%';
        if (damageEl) {
            // Show damage with any bonuses
            const bonusDmg = effectiveDamage - unit.damage;
            if (bonusDmg > 0) {
                damageEl.textContent = `~${effectiveDamage} Schaden (+${bonusDmg})`;
            } else {
                damageEl.textContent = `~${effectiveDamage} Schaden`;
            }
        }

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

    // Screen shake on hit/crit
    if (type === 'hit' || type === 'crit') {
        triggerScreenShake(type === 'crit' ? 'heavy' : 'light');
    }

    // Auto remove
    setTimeout(() => toast.remove(), 1800);
}

/**
 * Trigger screen shake effect
 */
export function triggerScreenShake(intensity = 'light') {
    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;

    // Remove existing shake class
    gameArea.classList.remove('shake-light', 'shake-heavy');

    // Force reflow
    void gameArea.offsetWidth;

    // Add shake class
    gameArea.classList.add(`shake-${intensity}`);

    // Also show hit flash
    showHitFlash();

    // Remove after animation
    setTimeout(() => {
        gameArea.classList.remove('shake-light', 'shake-heavy');
    }, intensity === 'heavy' ? 400 : 200);
}

/**
 * Show hit flash overlay
 */
function showHitFlash() {
    // Remove existing flash
    const existing = document.querySelector('.hit-flash');
    if (existing) existing.remove();

    const flash = document.createElement('div');
    flash.className = 'hit-flash';
    document.body.appendChild(flash);

    setTimeout(() => flash.remove(), 300);
}

/**
 * Show floating damage number at position
 */
export function showFloatingDamage(x, y, damage, isCrit = false, isHeal = false) {
    const floater = document.createElement('div');
    floater.className = 'floating-damage';
    if (isCrit) floater.classList.add('crit');
    if (isHeal) floater.classList.add('heal');

    floater.textContent = (isHeal ? '+' : '-') + damage;
    floater.style.left = x + 'px';
    floater.style.top = y + 'px';

    document.body.appendChild(floater);

    // Remove after animation
    setTimeout(() => floater.remove(), 1000);
}

/**
 * Show event banner for round events
 */
export function showEventBanner(event) {
    // Remove existing banner
    const existing = document.querySelector('.event-banner');
    if (existing) existing.remove();

    // Create event banner
    const banner = document.createElement('div');
    banner.className = 'event-banner';
    banner.innerHTML = `
        <div class="event-icon">${event.icon}</div>
        <div class="event-content">
            <div class="event-title">${event.name}</div>
            <div class="event-desc">${event.description}</div>
        </div>
    `;
    banner.style.setProperty('--event-color', event.color);
    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(() => {
        banner.classList.add('show');
    });

    // Auto remove after delay
    setTimeout(() => {
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 500);
    }, 3000);
}

/**
 * Show power-up pickup notification
 */
export function showPowerupPickup(powerup, result) {
    const message = `${powerup.icon} ${powerup.name} aufgesammelt!`;
    showToast(message, 'powerup');
}

/**
 * Select an action
 */
export function selectAction(action) {
    state.selectedAction = action;
    state.targetedUnit = null;
    state.currentPath = null;
    state.pendingMoveDestination = null;
    updateUI();
    render();
}
