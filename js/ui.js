// ===== UI MANAGEMENT =====

import { CONFIG, UNIT_CLASSES, TERRAIN } from './config.js';
import { state, getPlayerUnits, getCurrentUnit, getHex, getEnemyDirection, getPlayerStats, getPlayerName, getTileScreenPosition, getPlayerRankings } from './state.js';
import {
    calculateHitChance, getCoverInfo, canPrepareAmbush, getEligibleCoordinators,
    canUseSpecialAbility, getSpecialAbilityCost, canUseSuppression, canUseOverwatch
} from './combat.js';
import { isUnitOnOverwatch } from './state.js';
import { render, resizeCanvas } from './renderer.js';
import { getEffectiveDamage, getXPProgress, getRankName } from './progression.js';
import { playPowerup, playLevelUp, playSelect } from './audio.js';
import { isAIPlayer, isSpectatorMode } from './ai.js';
import { drawUnit } from './assetLoader.js';

// Note: updateWaypointUI is called at the end of updateUI() via lazy import to avoid circular deps

/**
 * Center camera on a specific unit with smooth scrolling
 */
function centerOnUnit(unit, duration = 400) {
    if (!unit) return;

    // Calculate unit position in pixels
    const unitHex = getHex(unit.q, unit.r);
    const pos = getTileScreenPosition(unit.q, unit.r, unitHex?.height ?? 0);
    const targetCameraX = -pos.x;
    const targetCameraY = -pos.y;

    const startCameraX = state.cameraX;
    const startCameraY = state.cameraY;
    const startTime = Date.now();

    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    function animateScroll() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Ease out cubic for smooth deceleration
        const ease = 1 - Math.pow(1 - progress, 3);

        state.cameraX = startCameraX + (targetCameraX - startCameraX) * ease;
        state.cameraY = startCameraY + (targetCameraY - startCameraY) * ease;

        // Update offset
        const rect = canvas.getBoundingClientRect();
        state.offsetX = rect.width / 2 + state.cameraX;
        state.offsetY = rect.height / 2 + state.cameraY;

        render();

        if (progress < 1) {
            requestAnimationFrame(animateScroll);
        }
    }

    requestAnimationFrame(animateScroll);
}

/**
 * Update all UI elements
 */
export function updateUI() {
    const spectator = isSpectatorMode();
    const isAiTurnHidden = isAIPlayer() && state.currentPlayer !== state.viewingPlayer;
    const units = isAiTurnHidden ? getPlayerUnits(state.viewingPlayer) : getPlayerUnits(state.currentPlayer);
    const unit = isAiTurnHidden ? null : getCurrentUnit();

    updateTopBar(unit, isAiTurnHidden);
    updateUnitTabs(units, isAiTurnHidden);
    updateActionButtons(unit, isAiTurnHidden);
    updateTargetInfo(unit);
    updateCompassIndicator();
    updatePlayersAlive();

    // === BEOBACHTER-MODUS: Interaktions-Buttons ausblenden ===
    const actionRow = document.querySelector('.action-row');
    const unitTabs = document.getElementById('unit-tabs');
    if (spectator) {
        // Im Beobachter-Modus alle Interaktions-Elemente ausblenden
        if (actionRow) actionRow.style.display = 'none';
        if (unitTabs) unitTabs.style.display = 'none';
    } else {
        // Normal-Modus: Elemente einblenden
        if (actionRow) actionRow.style.display = '';
        if (unitTabs) unitTabs.style.display = '';
    }

    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.disabled = isAiTurnHidden || spectator;
        if (spectator) endTurnBtn.style.display = 'none';
        else endTurnBtn.style.display = '';
    }
    const giveUpBtn = document.getElementById('give-up-btn');
    if (giveUpBtn) {
        giveUpBtn.disabled = state.gameOver || spectator;
    }

    // Update waypoint cancel button (lazy import to avoid circular deps)
    import('./input.js').then(({ updateWaypointUI }) => {
        updateWaypointUI();
    }).catch(() => {}); // Ignore if not yet loaded
}

/**
 * Update players alive display (Turn Screen and Dropdown)
 * Shows which players are still in the game with colored indicators
 */
export function updatePlayersAlive() {
    const turnContainer = document.getElementById('turn-players-alive');
    const dropdownContainer = document.getElementById('dropdown-players-alive');

    // Generate the HTML for player status indicators
    let html = '';
    for (let p = 0; p < state.settings.players; p++) {
        const units = getPlayerUnits(p);
        const isAlive = units.length > 0;
        const isCurrent = p === state.currentPlayer;
        const color = CONFIG.PLAYER_COLORS[p];

        let statusClass = isAlive ? 'alive' : 'eliminated';
        if (isCurrent && isAlive) statusClass = 'current';

        const unitCount = isAlive ? ` (${units.length})` : '';

        // Use player name (abbreviated if too long for display)
        const fullName = getPlayerName(p);
        const displayName = fullName.length > 10 ? fullName.substring(0, 8) + '..' : fullName;

        html += `
            <div class="player-status ${statusClass}" title="${fullName}">
                <span class="player-dot" style="background-color: ${color}"></span>
                <span>${displayName}${unitCount}</span>
            </div>
        `;
    }

    // Update both containers
    if (turnContainer) {
        turnContainer.innerHTML = html;
    }
    if (dropdownContainer) {
        dropdownContainer.innerHTML = html;
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
        nameEl.textContent = isAiTurnHidden ? 'KI am Zug' : getPlayerName(state.currentPlayer);
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
            // Update label with unit's special ability name and cost
            const unitClass = UNIT_CLASSES[unit.class];
            const apCost = getSpecialAbilityCost(unit.class);
            if (labelEl && unitClass) {
                labelEl.textContent = `${unitClass.special || 'Spezial'} (${apCost} AP)`;
            }

            // Generate contextual tip based on unit class
            let tip = '';
            let shouldSuggest = false;

            if (canUseSpecialAbility(unit)) {
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
                        tip = '🏃 Sprint für +3 Bewegung!';
                        shouldSuggest = state.sharedAP >= 2; // Show as suggested if enough AP for sprint + 1 move
                        break;
                    case 'assault':
                        // Suggest powershot before attacking
                        tip = '💥 Powershot für +25 Schaden!';
                        shouldSuggest = state.sharedAP >= 2; // Show as suggested if enough AP for powershot + attack
                        break;
                }
            }

            if (tipEl) tipEl.textContent = tip;
            if (shouldSuggest) specialBtn.classList.add('suggested');

            // Disable if ability cannot be used
            if (!canUseSpecialAbility(unit)) {
                specialBtn.classList.add('disabled');
                if (tipEl) {
                    if (unit.usedSpecial) {
                        tipEl.textContent = 'Bereits benutzt';
                    } else if (state.sharedAP < apCost) {
                        tipEl.textContent = `Nicht genug AP (${apCost} benötigt)`;
                    } else if (unit.class === 'assault') {
                        tipEl.textContent = 'Kein Angriff mehr möglich';
                    } else if ((unit.class === 'sniper' || unit.class === 'commando') && unit.cloaked) {
                        tipEl.textContent = 'Bereits getarnt';
                    } else {
                        tipEl.textContent = 'Nicht verfügbar';
                    }
                }
            }
        }
    }

    // === HINTERHALT-BUTTON ===
    const ambushBtn = document.getElementById('ambush-btn');
    if (ambushBtn) {
        if (!unit || isAiTurnHidden) {
            ambushBtn.style.display = 'none';
        } else if (canPrepareAmbush(unit)) {
            // Zeige Button wenn Hinterhalt möglich
            ambushBtn.style.display = 'flex';
            ambushBtn.classList.remove('disabled');
            ambushBtn.classList.add('suggested'); // Hervorheben
        } else if (unit.ambushReady) {
            // Zeige dass Hinterhalt vorbereitet ist
            ambushBtn.style.display = 'flex';
            ambushBtn.classList.add('disabled');
            ambushBtn.querySelector('.label').textContent = 'Bereit!';
        } else if (unit.cloaked || unit.hiding) {
            // Versteckt aber nicht genug AP
            ambushBtn.style.display = 'flex';
            ambushBtn.classList.add('disabled');
            ambushBtn.querySelector('.label').textContent = 'Hinterhalt';
        } else {
            ambushBtn.style.display = 'none';
        }
    }

    // === KOORDINATIONS-BUTTON ===
    const coordBtn = document.getElementById('coordinate-btn');
    if (coordBtn) {
        // Zeige Button wenn ein Ziel anvisiert ist und mehrere Einheiten angreifen können
        if (!unit || isAiTurnHidden || !state.targetedUnit) {
            coordBtn.style.display = 'none';
        } else {
            const eligible = getEligibleCoordinators(state.targetedUnit);
            if (eligible.length >= 2) {
                coordBtn.style.display = 'flex';
                coordBtn.classList.remove('disabled');
                coordBtn.querySelector('.label').textContent = `Koordinieren (${eligible.length})`;
            } else {
                coordBtn.style.display = 'none';
            }
        }
    }

    // === UNTERDRÜCKUNGSFEUER BUTTON ===
    const suppressBtn = document.getElementById('suppress-btn');
    if (suppressBtn) {
        if (!unit || isAiTurnHidden) {
            suppressBtn.style.display = 'none';
        } else if (canUseSuppression(unit)) {
            suppressBtn.style.display = 'flex';
            suppressBtn.classList.remove('disabled');
            suppressBtn.classList.add('suggested');
        } else if (['assault', 'sniper'].includes(unit.class)) {
            // Assault/Sniper können unterdrücken, aber nicht genug AP
            suppressBtn.style.display = 'flex';
            suppressBtn.classList.add('disabled');
            suppressBtn.classList.remove('suggested');
        } else {
            suppressBtn.style.display = 'none';
        }
    }

    // === OVERWATCH BUTTON ===
    const overwatchBtn = document.getElementById('overwatch-btn');
    if (overwatchBtn) {
        if (!unit || isAiTurnHidden) {
            overwatchBtn.style.display = 'none';
        } else if (isUnitOnOverwatch(unit.id)) {
            // Einheit ist bereits im Overwatch
            overwatchBtn.style.display = 'flex';
            overwatchBtn.classList.add('disabled');
            overwatchBtn.querySelector('.label').textContent = 'Aktiv!';
        } else if (canUseOverwatch(unit)) {
            overwatchBtn.style.display = 'flex';
            overwatchBtn.classList.remove('disabled');
            overwatchBtn.querySelector('.label').textContent = 'Overwatch';
        } else {
            // Nicht genug AP oder bereits angegriffen
            overwatchBtn.style.display = 'flex';
            overwatchBtn.classList.add('disabled');
            overwatchBtn.querySelector('.label').textContent = 'Overwatch';
        }
    }
}

/**
 * Update target info overlay
 * This is the unified place for showing targeting information
 * No separate toast notifications needed - all info is shown here
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

        // === VISUELLES FEEDBACK FÜR SCHUSSCHWIERIGKEIT ===
        if (hitChanceEl) {
            hitChanceEl.textContent = chance + '%';

            // Farbcodierung basierend auf Trefferchance
            hitChanceEl.classList.remove('shot-easy', 'shot-medium', 'shot-hard', 'shot-impossible');
            if (chance >= 95) {
                hitChanceEl.classList.add('shot-easy');
                hitChanceEl.title = '✓ Einfacher Schuss - fast garantierter Treffer';
            } else if (chance >= 85) {
                hitChanceEl.classList.add('shot-easy');
                hitChanceEl.title = '✓ Guter Schuss - hohe Trefferchance';
            } else if (chance >= 75) {
                hitChanceEl.classList.add('shot-medium');
                hitChanceEl.title = '⚡ Mittelschwerer Schuss';
            } else {
                hitChanceEl.classList.add('shot-hard');
                hitChanceEl.title = '⚠️ Schwieriger Schuss - Distanz am Limit!';
            }
        }

        if (damageEl) {
            // Show damage with any bonuses
            const bonusDmg = effectiveDamage - unit.damage;
            if (bonusDmg > 0) {
                damageEl.textContent = `~${effectiveDamage} Schaden (+${bonusDmg})`;
            } else {
                damageEl.textContent = `~${effectiveDamage} Schaden`;
            }
        }

        // === SCHUSSCHWIERIGKEIT-HINWEIS ===
        if (coverEl) {
            // Zeige primär die Schusschwierigkeit
            const distInfo = coverInfo.distance;

            if (unit.class === 'commando') {
                // Commando trifft IMMER im Nahkampf
                coverEl.textContent = '⚔️ Nahkampf - 100% Treffer!';
                coverEl.className = 'cover-info guaranteed';
            } else if (distInfo <= 2) {
                // Nahschuss - fast garantiert
                coverEl.textContent = '🎯 Nahschuss - garantierter Treffer';
                coverEl.className = 'cover-info guaranteed';
            } else if (chance >= 95) {
                coverEl.textContent = '✓ Freie Sicht - einfacher Schuss';
                coverEl.className = 'cover-info clear';
            } else if (chance >= 85) {
                // Gute Chance
                if (coverInfo.hasLineOfSightCover) {
                    coverEl.textContent = '🌲 Leichte Hindernisse';
                    coverEl.className = 'cover-info obstacles';
                } else {
                    coverEl.textContent = '✓ Guter Schuss';
                    coverEl.className = 'cover-info clear';
                }
            } else if (chance >= 75) {
                // Mittelschwer
                if (state.targetedUnit.hiding) {
                    if (coverInfo.isFlanked) {
                        coverEl.textContent = '⚠️ Ziel in Deckung (flankiert)';
                        coverEl.className = 'cover-info flanked';
                    } else {
                        coverEl.textContent = '🌲 Ziel in Deckung (-Schaden)';
                        coverEl.className = 'cover-info effective';
                    }
                } else {
                    coverEl.textContent = '⚡ Mittlere Distanz';
                    coverEl.className = 'cover-info obstacles';
                }
            } else {
                // Schwieriger Schuss (nur bei maximaler Reichweite)
                coverEl.textContent = '⚠️ Maximale Reichweite - schwieriger Schuss!';
                coverEl.className = 'cover-info hard-shot';
            }
        }

        // The attack-hint element in the target info panel already shows the instruction
        // We update the UI to make it clear and visible
        const attackHintEl = infoEl.querySelector('.attack-hint');
        if (attackHintEl) {
            attackHintEl.textContent = '👆 Nochmal tippen zum Angriff';
            attackHintEl.classList.add('visible');
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

// ===== NOTIFICATION MANAGER =====
// Prevents notification flooding and respects verbosity settings

const notificationManager = {
    queue: [],
    isShowing: false,
    lastShown: 0,
    minDelay: 800,      // Minimum time between notifications (ms)
    recentMessages: [], // Track recent messages to prevent duplicates
    maxRecent: 10       // How many recent messages to remember
};

/**
 * Notification priority levels:
 * - 'critical': Always shown (victory, defeat, zone damage)
 * - 'important': Shown in normal+ (attacks, kills, special abilities)
 * - 'info': Shown in normal+ but can be skipped if busy (movement, selection)
 * - 'verbose': Only shown in verbose mode (unit selected, path saved, etc.)
 */
const NOTIFICATION_PRIORITY = {
    // Critical - always shown
    'levelup': 'critical',
    'crit': 'critical',
    'hit': 'important',
    'miss': 'important',
    'special': 'important',
    'warning': 'important',
    'powerup': 'important',
    // Info - shown in normal mode
    'info': 'info',
    // Default
    '': 'info'
};

/**
 * Check if a notification should be shown based on settings
 */
function shouldShowNotification(type, message) {
    const level = state.settings.notificationLevel || 'normal';
    const priority = NOTIFICATION_PRIORITY[type] || 'info';

    // Critical always shown
    if (priority === 'critical') return true;

    // Check verbosity level
    if (level === 'minimal') {
        // Only critical and important combat notifications
        return priority === 'critical' || (priority === 'important' && (type === 'hit' || type === 'crit' || type === 'miss'));
    }

    if (level === 'normal') {
        // Everything except verbose
        return priority !== 'verbose';
    }

    // Verbose mode - show everything
    return true;
}

/**
 * Check if message was recently shown (prevent duplicates)
 */
function isRecentDuplicate(message) {
    // Allow exact same messages if they're combat-related
    if (message.includes('Schaden') || message.includes('eliminiert')) {
        return false;
    }

    // Check if this exact message was shown in the last few
    const isDuplicate = notificationManager.recentMessages.includes(message);
    if (!isDuplicate) {
        notificationManager.recentMessages.push(message);
        if (notificationManager.recentMessages.length > notificationManager.maxRecent) {
            notificationManager.recentMessages.shift();
        }
    }
    return isDuplicate;
}

/**
 * Show a toast notification
 */
export function showToast(message, type = '') {
    // Check if notification should be shown based on settings
    if (!shouldShowNotification(type, message)) {
        return;
    }

    // Check for recent duplicates (except for combat messages)
    if (isRecentDuplicate(message)) {
        return;
    }

    // For critical/important messages, show immediately
    const priority = NOTIFICATION_PRIORITY[type] || 'info';
    if (priority === 'critical' || priority === 'important') {
        showToastImmediate(message, type);
        return;
    }

    // For info messages, check if we're flooding
    const now = Date.now();
    if (now - notificationManager.lastShown < notificationManager.minDelay) {
        // Queue the message if it's not too long
        if (notificationManager.queue.length < 3) {
            notificationManager.queue.push({ message, type });
            scheduleNextNotification();
        }
        // Otherwise skip this message (not important enough)
        return;
    }

    showToastImmediate(message, type);
}

/**
 * Actually display a toast notification
 */
function showToastImmediate(message, type) {
    notificationManager.lastShown = Date.now();
    notificationManager.isShowing = true;

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

    // Calculate duration based on message length (min 2.5s for info, 3.5s for important)
    const priority = NOTIFICATION_PRIORITY[type] || 'info';
    const baseDuration = (priority === 'info') ? 2500 : 3500;
    const extraChars = Math.max(0, message.length - 30);
    const duration = baseDuration + extraChars * 40;

    // Set CSS animation duration to match
    toast.style.animationDuration = `${duration}ms`;

    // Auto remove and process queue
    setTimeout(() => {
        toast.remove();
        notificationManager.isShowing = false;
        processNotificationQueue();
    }, duration);
}

/**
 * Schedule next notification from queue
 */
function scheduleNextNotification() {
    if (notificationManager.queue.length === 0) return;

    const timeSinceLastShow = Date.now() - notificationManager.lastShown;
    const delay = Math.max(0, notificationManager.minDelay - timeSinceLastShow);

    setTimeout(() => {
        processNotificationQueue();
    }, delay);
}

/**
 * Process notification queue
 */
function processNotificationQueue() {
    if (notificationManager.isShowing || notificationManager.queue.length === 0) return;

    const next = notificationManager.queue.shift();
    if (next) {
        showToastImmediate(next.message, next.type);
    }
}

/**
 * Clear notification queue (e.g., when changing screens)
 */
export function clearNotificationQueue() {
    notificationManager.queue = [];
    notificationManager.recentMessages = [];
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
 * Compact, non-intrusive notification that doesn't interrupt gameplay
 */
export function showEventBanner(event) {
    // Remove existing banner
    const existing = document.querySelector('.event-banner');
    if (existing) existing.remove();

    // Create compact event banner
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

    // Animate in after a brief delay
    requestAnimationFrame(() => {
        banner.classList.add('show');
    });

    // Auto remove after shorter delay (less intrusive)
    setTimeout(() => {
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 400);
    }, 2000);
}

/**
 * Show round start screen with game status overview
 * Displays for a few seconds at the beginning of each round
 */
export function showRoundStartScreen(roundInfo) {
    // Remove existing round screen
    const existing = document.querySelector('.round-start-screen');
    if (existing) existing.remove();

    // Build player status HTML
    const playersHTML = roundInfo.players.map(p => {
        const statusClass = p.alive ? (p.isCurrentPlayer ? 'current' : '') : 'eliminated';
        const unitsText = p.alive ? `${p.units} Einheit${p.units !== 1 ? 'en' : ''}` : 'Eliminiert';
        return `
            <div class="round-player ${statusClass}">
                <div class="round-player-color" style="background: ${p.color}"></div>
                <div class="round-player-info">
                    <div class="round-player-name">${p.name}</div>
                    <div class="round-player-units">${unitsText}</div>
                </div>
                ${p.isCurrentPlayer ? '<div class="round-player-turn">Am Zug</div>' : ''}
            </div>
        `;
    }).join('');

    // Build zone status HTML
    let zoneHTML = '';
    if (roundInfo.zone) {
        const zoneClass = roundInfo.zone.warning ? 'warning' : (roundInfo.zone.shrinking ? 'shrinking' : '');
        zoneHTML = `
            <div class="round-zone ${zoneClass}">
                <div class="round-zone-icon">${roundInfo.zone.warning ? '⚠️' : (roundInfo.zone.shrinking ? '🔴' : '🟢')}</div>
                <div class="round-zone-text">${roundInfo.zone.text}</div>
            </div>
        `;
    }

    // Build event HTML
    let eventHTML = '';
    if (roundInfo.event) {
        eventHTML = `
            <div class="round-event">
                <span class="round-event-icon">${roundInfo.event.icon}</span>
                <span class="round-event-name">${roundInfo.event.name}</span>
            </div>
        `;
    }

    // Create the round start screen
    const screen = document.createElement('div');
    screen.className = 'round-start-screen';
    screen.innerHTML = `
        <div class="round-start-content">
            <div class="round-number">Runde ${roundInfo.round}</div>
            <div class="round-players">
                ${playersHTML}
            </div>
            ${zoneHTML}
            ${eventHTML}
        </div>
    `;
    document.body.appendChild(screen);

    // Animate in
    requestAnimationFrame(() => {
        screen.classList.add('show');
    });

    // Auto remove after delay
    return new Promise(resolve => {
        setTimeout(() => {
            screen.classList.remove('show');
            setTimeout(() => {
                screen.remove();
                resolve();
            }, 400);
        }, roundInfo.duration || 2500);
    });
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
    if (state.gameOver || isAIPlayer()) {
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

// === SIEGEREHRUNG / AWARDS ===

/**
 * Award definitions with fun, varied titles
 * Each award has multiple title variants for variety
 */
const AWARDS = [
    {
        id: 'terminator',
        icon: '💀',
        titles: ['Sensenmann', 'Terminator', 'Todesengel', 'Henker'],
        stat: 'kills',
        condition: (stats) => stats.kills >= 2,
        getValue: (stats) => `${stats.kills} Eliminierungen`
    },
    {
        id: 'firstblood',
        icon: '🩸',
        titles: ['First Blood', 'Erster Treffer', 'Schnellstarter'],
        stat: 'kills',
        condition: (stats) => stats.kills >= 1,
        getValue: (stats) => `${stats.kills} Kill${stats.kills > 1 ? 's' : ''}`
    },
    {
        id: 'marathon',
        icon: '🏃',
        titles: ['Marathon-Held', 'Roadrunner', 'Wandervogel', 'Langstreckenläufer'],
        stat: 'hexesMoved',
        condition: (stats) => stats.hexesMoved >= 8,
        getValue: (stats) => `${stats.hexesMoved} Felder gelaufen`
    },
    {
        id: 'tank',
        icon: '🛡️',
        titles: ['Unkaputtbar', 'Stehaufmännchen', 'Eiserner Wille', 'Härtetest bestanden'],
        stat: 'damageTaken',
        condition: (stats) => stats.damageTaken >= 40,
        getValue: (stats) => `${stats.damageTaken} HP eingesteckt`
    },
    {
        id: 'destroyer',
        icon: '💥',
        titles: ['Zerstörungswut', 'Abrissbirne', 'Schadensmaschine', 'Feuerteufel'],
        stat: 'damageDealt',
        condition: (stats) => stats.damageDealt >= 60,
        getValue: (stats) => `${stats.damageDealt} Schaden ausgeteilt`
    },
    {
        id: 'sniper',
        icon: '🔭',
        titles: ['Fernschütze', 'Adlerauge', 'Scharfschützen-Elite', 'Weitsicht'],
        stat: 'longestKillDistance',
        condition: (stats) => stats.longestKillDistance >= 4,
        getValue: (stats) => `Kill aus ${stats.longestKillDistance} Feldern Entfernung`
    },
    {
        id: 'medic',
        icon: '💚',
        titles: ['Engel in Weiß', 'Lebensretter', 'Sanitäter des Jahres', 'Heilende Hände'],
        stat: 'healing',
        condition: (stats) => stats.healing >= 20,
        getValue: (stats) => `${stats.healing} HP geheilt`
    },
    {
        id: 'lucky',
        icon: '🍀',
        titles: ['Glückspilz', 'Sonntagskind', 'Fortuna lächelt', 'Würfelglück'],
        stat: 'criticalHits',
        condition: (stats) => stats.criticalHits >= 2,
        getValue: (stats) => `${stats.criticalHits} kritische Treffer`
    },
    {
        id: 'unlucky',
        icon: '🎰',
        titles: ['Pechvogel', 'Schussliger Schütze', 'Daneben ist auch vorbei', 'Zielfernrohr kaputt?'],
        stat: 'shotsMissed',
        condition: (stats) => stats.shotsMissed >= 4 && stats.shotsMissed > stats.shotsHit,
        getValue: (stats) => `${stats.shotsMissed} Fehlschüsse`
    },
    {
        id: 'tactician',
        icon: '🧠',
        titles: ['Taktikfuchs', 'Stratege', 'Meister der Spezialitäten', 'Multitalent'],
        stat: 'specialsUsed',
        condition: (stats) => stats.specialsUsed >= 3,
        getValue: (stats) => `${stats.specialsUsed} Spezialfähigkeiten eingesetzt`
    },
    {
        id: 'survivor',
        icon: '⏳',
        titles: ['Überlebenskünstler', 'Zähes Biest', 'Steh-auf-Männchen', 'Nicht kleinzukriegen'],
        stat: 'survivalRounds',
        condition: (stats, allStats, playerIndex, winner) =>
            playerIndex !== winner && stats.survivalRounds >= state.round - 2,
        getValue: (stats) => `Überlebt bis Runde ${stats.survivalRounds}`
    },
    {
        id: 'pacifist',
        icon: '🕊️',
        titles: ['Friedenstaube', 'Pazifist', 'Gandhi Award', 'Gewaltfreier Widerstand'],
        stat: 'damageDealt',
        condition: (stats) => stats.kills === 0 && stats.damageDealt < 20 && stats.hexesMoved >= 5,
        getValue: () => 'Kampf vermieden'
    },
    {
        id: 'accurate',
        icon: '🎯',
        titles: ['Präzisionsarbeit', 'Treffsicher', 'Kein Schuss daneben', 'Augenmaß'],
        stat: 'accuracy',
        condition: (stats) => {
            const total = stats.shotsHit + stats.shotsMissed;
            return total >= 3 && (stats.shotsHit / total) >= 0.75;
        },
        getValue: (stats) => {
            const total = stats.shotsHit + stats.shotsMissed;
            const accuracy = Math.round((stats.shotsHit / total) * 100);
            return `${accuracy}% Trefferquote`;
        }
    },
    {
        id: 'rambo',
        icon: '💪',
        titles: ['Einzelkämpfer', 'Rambo', 'Ein-Mann-Armee', 'Solo-Mission'],
        stat: 'kills',
        condition: (stats) => stats.kills >= 3 && stats.unitsLost === 0,
        getValue: (stats) => `${stats.kills} Kills ohne Verluste`
    },
    {
        id: 'glass_cannon',
        icon: '🔥',
        titles: ['Glaskanone', 'Alles oder nichts', 'High Risk, High Reward'],
        stat: 'damageDealt',
        condition: (stats) => stats.damageDealt >= 80 && stats.damageTaken >= 60,
        getValue: (stats) => `${stats.damageDealt} ausgeteilt, ${stats.damageTaken} eingesteckt`
    },
    {
        id: 'camper',
        icon: '⛺',
        titles: ['Camper Award', 'Stubenhocker', 'Bewegungsmuffel', 'Festung'],
        stat: 'hexesMoved',
        condition: (stats) => stats.hexesMoved <= 3 && stats.kills >= 1,
        getValue: (stats) => `Nur ${stats.hexesMoved} Felder bewegt`
    }
];

/**
 * Pick a random title from the award's title variants
 */
function getRandomTitle(award, seed = 0) {
    const index = Math.abs(seed) % award.titles.length;
    return award.titles[index];
}

/**
 * Generate awards based on player statistics
 * Returns array of {icon, title, player, value, color}
 */
export function generateAwards(winner) {
    const awards = [];
    const allStats = [];

    // Collect all player stats
    for (let p = 0; p < state.settings.players; p++) {
        allStats.push(getPlayerStats(p));
    }

    // Use round number as seed for title variety
    const titleSeed = state.round + (winner || 0);

    // Find best player for each award category
    let awardIndex = 0;
    for (const award of AWARDS) {
        let bestPlayer = -1;
        let bestValue = -Infinity;

        for (let p = 0; p < state.settings.players; p++) {
            const stats = allStats[p];

            // Check if player qualifies for this award
            if (!award.condition(stats, allStats, p, winner)) continue;

            // Get the stat value
            let value;
            if (award.stat === 'accuracy') {
                const total = stats.shotsHit + stats.shotsMissed;
                value = total > 0 ? stats.shotsHit / total : 0;
            } else {
                value = stats[award.stat] || 0;
            }

            if (value > bestValue) {
                bestValue = value;
                bestPlayer = p;
            }
        }

        // Award to best player if found
        if (bestPlayer >= 0) {
            const stats = allStats[bestPlayer];
            awards.push({
                icon: award.icon,
                title: getRandomTitle(award, titleSeed + awardIndex),
                player: bestPlayer,
                value: award.getValue(stats),
                color: CONFIG.PLAYER_COLORS[bestPlayer]
            });
        }
        awardIndex++;
    }

    return awards;
}

/**
 * Get MVP unit for a player (unit with most damage dealt)
 */
function getPlayerMVP(playerIndex) {
    const playerUnits = state.units.filter(u => u.player === playerIndex);
    if (playerUnits.length === 0) return null;

    // Calculate score for each unit based on their contributions
    let bestUnit = null;
    let bestScore = -1;

    for (const unit of playerUnits) {
        // Score based on damage, kills, survival
        let score = 0;
        score += (unit.damageDealt || 0);
        score += (unit.kills || 0) * 30;
        score += unit.alive ? 20 : 0;
        score += (unit.healingDone || 0) * 0.5;

        if (score > bestScore) {
            bestScore = score;
            bestUnit = unit;
        }
    }

    return bestUnit;
}

/**
 * Get unit title based on performance
 */
function getUnitTitle(unit) {
    if (!unit) return 'Unbekannt';

    const kills = unit.kills || 0;
    const damage = unit.damageDealt || 0;
    const healing = unit.healingDone || 0;

    // Class-specific titles
    const classTitles = {
        scout: ['Aufklärer', 'Pfadfinder', 'Späher', 'Kundschafter'],
        assault: ['Sturmtrupp', 'Frontsoldat', 'Berserker', 'Brecher'],
        medic: ['Sanitäter', 'Feldarzt', 'Heiler', 'Lebensretter'],
        sniper: ['Scharfschütze', 'Präzisionsschütze', 'Jäger', 'Silentium'],
        ninja: ['Schatten', 'Geist', 'Phantom', 'Assassine']
    };

    // Performance-based titles override class titles
    if (kills >= 3) return 'Held des Tages';
    if (kills >= 2) return 'Kampfveteran';
    if (damage >= 100) return 'Zerstörer';
    if (healing >= 50) return 'Engel';
    if (!unit.alive) return 'Gefallen';

    // Random class title
    const titles = classTitles[unit.class] || ['Soldat'];
    return titles[Math.floor(Math.random() * titles.length)];
}

/**
 * Calculate game statistics
 */
function getGameStatistics() {
    let totalDamage = 0;
    let totalHealing = 0;
    let totalKills = 0;
    let totalMoves = 0;

    for (let p = 0; p < state.settings.players; p++) {
        const stats = getPlayerStats(p);
        totalDamage += stats.damageDealt;
        totalHealing += stats.healing;
        totalKills += stats.kills;
        totalMoves += stats.hexesMoved;
    }

    return {
        rounds: state.round,
        totalDamage,
        totalHealing,
        totalKills,
        totalMoves
    };
}

/**
 * Display podium with player rankings, unit MVPs, and game statistics
 */
export function displayAwards(winner) {
    const container = document.getElementById('awards-container');
    if (!container) return;

    const rankings = getPlayerRankings();
    const awards = generateAwards(winner);
    const gameStats = getGameStatistics();

    // Take top 4 awards for variety
    const topAwards = awards.slice(0, 4);

    // Get top 3 players for podium
    const podiumPlayers = rankings.slice(0, Math.min(3, rankings.length));

    // ===== PODIUM SECTION =====
    let podiumHTML = '<div class="victory-podium">';

    const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd
    const medals = ['🥇', '🥈', '🥉'];
    const podiumHeights = [70, 90, 50]; // Heights for positions 1, 2, 3

    for (const posIndex of podiumOrder) {
        if (posIndex >= podiumPlayers.length) {
            podiumHTML += '<div class="podium-slot empty"></div>';
            continue;
        }

        const ranking = podiumPlayers[posIndex];
        const position = posIndex + 1;
        const playerColor = CONFIG.PLAYER_COLORS[ranking.player];
        const playerName = getPlayerName(ranking.player);
        const isWinner = ranking.player === winner;
        const mvpUnit = getPlayerMVP(ranking.player);
        const unitClass = mvpUnit ? mvpUnit.class : 'assault';

        podiumHTML += `
            <div class="podium-slot position-${position} ${isWinner ? 'champion' : ''}">
                <div class="podium-figure">
                    <div class="podium-medal-badge">${medals[posIndex]}</div>
                    <div class="podium-unit" data-player="${ranking.player}" data-class="${unitClass}">
                        <canvas class="podium-canvas" width="100" height="100"></canvas>
                    </div>
                    <div class="podium-details">
                        <span class="podium-player-name" style="color: ${playerColor}">${playerName}</span>
                        <span class="podium-points">${ranking.score} Pkt</span>
                    </div>
                </div>
                <div class="podium-pedestal" style="height: ${podiumHeights[posIndex]}px; --player-color: ${playerColor}">
                    <span class="pedestal-rank">${position}</span>
                </div>
            </div>
        `;
    }
    podiumHTML += '</div>';

    // ===== UNIT MVP SECTION =====
    let mvpHTML = '<div class="mvp-section">';
    mvpHTML += '<div class="section-header">Team-Helden</div>';
    mvpHTML += '<div class="mvp-grid">';

    for (let p = 0; p < state.settings.players; p++) {
        const mvp = getPlayerMVP(p);
        if (!mvp) continue;

        const playerColor = CONFIG.PLAYER_COLORS[p];
        const playerName = getPlayerName(p);
        const unitTitle = getUnitTitle(mvp);
        const kills = mvp.kills || 0;
        const damage = mvp.damageDealt || 0;

        mvpHTML += `
            <div class="mvp-card" style="--card-color: ${playerColor}">
                <div class="mvp-unit-sprite" data-player="${p}" data-class="${mvp.class}">
                    <canvas class="mvp-canvas" width="64" height="64"></canvas>
                </div>
                <div class="mvp-info">
                    <div class="mvp-title">${unitTitle}</div>
                    <div class="mvp-player" style="color: ${playerColor}">${playerName}</div>
                    <div class="mvp-stats">
                        ${kills > 0 ? `<span>💀 ${kills}</span>` : ''}
                        ${damage > 0 ? `<span>💥 ${damage}</span>` : ''}
                        ${!mvp.alive ? '<span>☠️</span>' : '<span>❤️</span>'}
                    </div>
                </div>
            </div>
        `;
    }
    mvpHTML += '</div></div>';

    // ===== AWARDS SECTION =====
    let awardsHTML = '';
    if (topAwards.length > 0) {
        awardsHTML = `
            <div class="awards-section">
                <div class="section-header">Auszeichnungen</div>
                <div class="awards-grid">
                    ${topAwards.map(award => `
                        <div class="award-card">
                            <span class="award-icon-large">${award.icon}</span>
                            <div class="award-details">
                                <div class="award-name">${award.title}</div>
                                <div class="award-recipient" style="color: ${award.color}">${getPlayerName(award.player)}</div>
                                <div class="award-value">${award.value}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ===== GAME STATISTICS =====
    const statsHTML = `
        <div class="game-stats-section">
            <div class="section-header">Spielstatistik</div>
            <div class="stats-row">
                <div class="stat-item">
                    <span class="stat-icon">⏱️</span>
                    <span class="stat-value">${gameStats.rounds}</span>
                    <span class="stat-label">Runden</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">💥</span>
                    <span class="stat-value">${gameStats.totalDamage}</span>
                    <span class="stat-label">Schaden</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">💀</span>
                    <span class="stat-value">${gameStats.totalKills}</span>
                    <span class="stat-label">Kills</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">💚</span>
                    <span class="stat-value">${gameStats.totalHealing}</span>
                    <span class="stat-label">Heilung</span>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = podiumHTML + mvpHTML + awardsHTML + statsHTML;

    // Draw unit sprites
    requestAnimationFrame(() => {
        drawPodiumSprites();
        drawMVPSprites();
    });
}

/**
 * Draw unit sprites on the podium canvases
 */
function drawPodiumSprites() {
    const canvases = document.querySelectorAll('.podium-canvas');

    canvases.forEach(canvas => {
        // Try both old and new class names for the parent
        const parent = canvas.closest('.podium-unit') || canvas.closest('.podium-sprite');
        if (!parent) return;

        const player = parseInt(parent.dataset.player);
        const unitClass = parent.dataset.class;
        const playerColor = CONFIG.PLAYER_COLORS[player];

        const ctx = canvas.getContext('2d');
        const size = canvas.width;

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Draw unit using assetLoader
        try {
            drawUnit(ctx, size / 2, size / 2 + size * 0.12, size * 0.42, playerColor, unitClass, 'normal', false, player);
        } catch {
            // Fallback on error: draw colored circle with class initial
            ctx.fillStyle = playerColor;
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = `bold ${size * 0.3}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(unitClass.charAt(0).toUpperCase(), size / 2, size / 2);
        }
    });
}

/**
 * Draw unit sprites on the MVP canvases
 */
function drawMVPSprites() {
    const canvases = document.querySelectorAll('.mvp-canvas');

    canvases.forEach(canvas => {
        const parent = canvas.closest('.mvp-unit-sprite');
        if (!parent) return;

        const player = parseInt(parent.dataset.player);
        const unitClass = parent.dataset.class;
        const playerColor = CONFIG.PLAYER_COLORS[player];

        const ctx = canvas.getContext('2d');
        const size = canvas.width;

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Draw unit using assetLoader
        try {
            drawUnit(ctx, size / 2, size / 2 + size * 0.1, size * 0.4, playerColor, unitClass, 'normal', false, player);
        } catch {
            // Fallback
            ctx.fillStyle = playerColor;
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = `bold ${size * 0.35}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(unitClass.charAt(0).toUpperCase(), size / 2, size / 2);
        }
    });
}
