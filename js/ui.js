// ===== UI MANAGEMENT =====

import { CONFIG, UNIT_CLASSES, TERRAIN } from './config.js';
import { state, getPlayerUnits, getCurrentUnit, getHex, getEnemyDirection } from './state.js';
import { calculateHitChance, getCoverInfo } from './combat.js';
import { render, resizeCanvas } from './renderer.js';
import { getEffectiveDamage, getXPProgress, getRankName } from './progression.js';
import { hexToPixel } from './hexMath.js';
import { playPowerup, playLevelUp, playSelect } from './audio.js';

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
    const isAiTurnHidden = state.settings.singlePlayer && state.currentPlayer !== state.viewingPlayer;
    const units = isAiTurnHidden ? getPlayerUnits(state.viewingPlayer) : getPlayerUnits(state.currentPlayer);
    const unit = isAiTurnHidden ? null : getCurrentUnit();

    updateTopBar(unit, isAiTurnHidden);
    updateUnitTabs(units, isAiTurnHidden);
    updateActionButtons(unit, isAiTurnHidden);
    updateTargetInfo(unit);
    updateCompassIndicator();

    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.disabled = isAiTurnHidden;
    }
    const giveUpBtn = document.getElementById('give-up-btn');
    if (giveUpBtn) {
        giveUpBtn.disabled = state.gameOver;
    }
}

/**
 * Update top bar (player indicator, round, AP)
 */
function updateTopBar(unit, isAiTurnHidden = false) {
    const dot = document.getElementById('current-dot');
    if (dot) {
        dot.style.backgroundColor = CONFIG.PLAYER_COLORS[state.currentPlayer];
        dot.style.boxShadow = `0 0 15px ${CONFIG.PLAYER_COLORS[state.currentPlayer]}`;
    }

    const nameEl = document.getElementById('current-name');
    if (nameEl) {
        nameEl.textContent = isAiTurnHidden ? 'KI am Zug' : `Spieler ${state.currentPlayer + 1}`;
    }

    const roundEl = document.getElementById('round-num');
    if (roundEl) {
        roundEl.textContent = state.round;
    }
    const roundMaxEl = document.getElementById('round-max');
    if (roundMaxEl) {
        roundMaxEl.textContent = CONFIG.MAX_ROUNDS;
    }

    // AP display - now shows shared pool
    const apDisplay = document.getElementById('ap-display');
    if (apDisplay) {
        apDisplay.innerHTML = '';
        if (isAiTurnHidden) {
            const waitDisplay = document.createElement('div');
            waitDisplay.className = 'ap-pool-display';
            waitDisplay.innerHTML = `
                <span class="ap-pool-label">KI am Zug</span>
                <span class="ap-pool-icon">⏳</span>
            `;
            apDisplay.appendChild(waitDisplay);
        } else {
            // Show shared AP pool as numeric display
            const poolDisplay = document.createElement('div');
            poolDisplay.className = 'ap-pool-display';
            poolDisplay.innerHTML = `
                <span class="ap-pool-label">Team AP:</span>
                <span class="ap-pool-value">${state.sharedAP}</span>
                <span class="ap-pool-max">/ ${state.maxSharedAP}</span>
                <span class="ap-pool-icon">⚡</span>
            `;
            apDisplay.appendChild(poolDisplay);
        }
    }
}

/**
 * Update unit selection tabs
 */
function updateUnitTabs(units, isAiTurnHidden = false) {
    const tabsEl = document.getElementById('unit-tabs');
    if (!tabsEl) return;

    tabsEl.innerHTML = '';
    if (isAiTurnHidden) return;

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

        tab.innerHTML = `
            <div class="class-icon">${UNIT_CLASSES[unit.class].icon}</div>
            <div class="class-name">${UNIT_CLASSES[unit.class].name}</div>
            <div class="unit-level" style="background: ${levelColor}">Lv.${level}</div>
            <div class="hp-bar">
                <div class="hp-fill${hpClass}" style="width: ${hpPct * 100}%"></div>
            </div>
            ${!xpProgress.maxLevel ? `
                <div class="xp-bar">
                    <div class="xp-fill" style="width: ${xpProgress.progress * 100}%"></div>
                </div>
            ` : ''}
        `;

        tab.onclick = () => {
            if (unit.alive) {
                playSelect();
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
function updateActionButtons(unit, isAiTurnHidden = false) {
    // Update special ability button
    const specialBtn = document.querySelector('.action-btn[data-action="special"]');
    if (specialBtn) {
        specialBtn.classList.remove('disabled', 'suggested');

        const labelEl = document.getElementById('special-label');
        const tipEl = document.getElementById('special-tip');

        if (!unit || isAiTurnHidden) {
            specialBtn.classList.add('disabled');
            if (labelEl) labelEl.textContent = 'Spezial';
            if (tipEl) tipEl.textContent = '';
        } else {
            // Update label with unit's special ability name
            const unitClass = UNIT_CLASSES[unit.class];
            if (labelEl && unitClass) {
                labelEl.textContent = unitClass.special || 'Spezial';
            }

            // Generate contextual tip based on unit class
            let tip = '';
            let shouldSuggest = false;

            if (!unit.usedSpecial && state.sharedAP >= 2) {
                switch (unit.class) {
                    case 'medic':
                        // Check if allies need healing
                        const allies = getPlayerUnits(state.currentPlayer);
                        const injuredAllies = allies.filter(a => a.currentHp < a.maxHp && a.id !== unit.id);
                        if (injuredAllies.length > 0) {
                            tip = `💚 ${injuredAllies.length} Verbündete verletzt!`;
                            shouldSuggest = true;
                        }
                        break;
                    case 'sniper':
                    case 'commando':
                        // Suggest cloaking if not hidden
                        if (!unit.cloaked && !unit.hiding) {
                            tip = '👁️ Tarnung empfohlen!';
                            shouldSuggest = true;
                        }
                        break;
                    case 'scout':
                        // Suggest sprint if there's AP in pool
                        if (state.sharedAP >= 3) {
                            tip = '🏃 Sprint für +3 Bewegung!';
                            shouldSuggest = true;
                        }
                        break;
                    case 'assault':
                        // Suggest powershot before attacking
                        if (state.sharedAP >= 3) {
                            tip = '💥 Powershot für +20 Schaden!';
                            shouldSuggest = true;
                        }
                        break;
                }
            }

            if (tipEl) tipEl.textContent = tip;
            if (shouldSuggest) specialBtn.classList.add('suggested');

            // Disable if not enough AP in pool or already used
            if (state.sharedAP < 2 || unit.usedSpecial) {
                specialBtn.classList.add('disabled');
                if (tipEl) tipEl.textContent = unit.usedSpecial ? 'Bereits benutzt' : 'Nicht genug AP';
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
        const coverInfo = getCoverInfo(unit, state.targetedUnit);

        const hitChanceEl = document.getElementById('hit-chance');
        const damageEl = document.getElementById('damage-info');
        const coverEl = document.getElementById('cover-info');

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

        // Show cover effectiveness info
        if (coverEl) {
            if (state.targetedUnit.hiding) {
                if (coverInfo.isFlanked) {
                    coverEl.textContent = '⚠️ Flankiert! Deckung unwirksam';
                    coverEl.className = 'cover-info flanked';
                } else if (coverInfo.isHidingEffective) {
                    coverEl.textContent = `🌲 Deckung wirksam (${coverInfo.coverEffectiveness}%)`;
                    coverEl.className = 'cover-info effective';
                } else {
                    coverEl.textContent = '👁️ Deckung umgangen';
                    coverEl.className = 'cover-info bypassed';
                }
            } else if (coverInfo.hasLineOfSightCover) {
                coverEl.textContent = `🌲 Hindernisse: ${coverInfo.blockingTerrain.join(', ')}`;
                coverEl.className = 'cover-info obstacles';
            } else {
                coverEl.textContent = '✓ Freie Sicht';
                coverEl.className = 'cover-info clear';
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
    // Update state.screen to match - critical for render loop!
    state.screen = id;

    // Update pointer-events on game-area based on screen state
    // When a menu/screen is active, disable pointer events on game-area
    // to prevent the canvas from intercepting clicks meant for buttons
    const gameArea = document.getElementById('game-area');
    if (gameArea) {
        gameArea.style.pointerEvents = id !== null ? 'none' : 'auto';
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
    playPowerup();
    const message = `${powerup.icon} ${powerup.name} aufgesammelt!`;
    showToast(message, 'powerup');
}

/**
 * Update compass indicator (shows direction to enemies after 3 rounds without contact)
 */
function updateCompassIndicator() {
    // Remove existing compass
    const existing = document.querySelector('.compass-indicator');
    if (existing) existing.remove();

    // Don't show compass for AI player or if game is over
    if (state.gameOver || (state.settings.singlePlayer && state.currentPlayer > 0)) {
        return;
    }

    const direction = getEnemyDirection();
    if (!direction) return;

    // Arrow icons for each direction
    const arrows = {
        'N': '⬆️',
        'NE': '↗️',
        'E': '➡️',
        'SE': '↘️',
        'S': '⬇️',
        'SW': '↙️',
        'W': '⬅️',
        'NW': '↖️'
    };

    const compass = document.createElement('div');
    compass.className = 'compass-indicator';
    compass.innerHTML = `
        <div class="compass-arrow">${arrows[direction.direction]}</div>
        <div class="compass-text">
            <div class="compass-direction">Feinde im ${direction.directionName}</div>
            <div class="compass-info">~${direction.distance} Hexfelder entfernt</div>
            <div class="compass-hint">${direction.roundsSearching} Runden ohne Kontakt</div>
        </div>
    `;

    document.body.appendChild(compass);

    // Animate in
    requestAnimationFrame(() => {
        compass.classList.add('show');
    });
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
