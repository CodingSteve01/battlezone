// ===== MAIN ENTRY POINT =====

import { state, resetState, initZone } from './state.js';
import { CONFIG, UNIT_CLASSES } from './config.js';
import { generateMap } from './map.js';
import { createUnits } from './units.js';
import { startTurn } from './turns.js';
// Use the legacy canvas renderer for stability/performance
import { initRenderer, resizeCanvas, render, clearRenderCaches } from './renderer.js';
import { updateUI, showScreen, showToast } from './ui.js';
import { initInput, centerOnCurrentUnit } from './input.js';
import { updateVisibility } from './fogOfWar.js';
import { generatePowerups } from './powerups.js';
import { initUnitProgression } from './progression.js';
import { isAIPlayer, executeAITurn, resetAIMemory, isSpectatorMode } from './ai.js';
import { initAudio, resumeAudio, playClick, startAmbient, setMasterVolume, toggleAudio, audioSettings } from './audio.js';
import { initAssetLoader, isUsingStaticAssets } from './assetLoader.js';
import { resetTutorial, startTeamSelectTutorial, showUnitClassHint, hideTeamSelectTutorial } from './tutorial.js';

// Team selection state
let currentTeamSelectPlayer = 0;
let currentPlayerSelection = [];
let currentBudgetSpent = 0;

/**
 * Start team selection process
 */
function startTeamSelection() {
    // Initialize team selections array
    state.teamSelections = [];

    for (let i = 0; i < state.settings.players; i++) {
        state.teamSelections.push([]);
    }

    // AI teams are auto-generated in showTeamSelectForPlayer when skipping AI players
    currentTeamSelectPlayer = 0;
    showTeamSelectForPlayer(0);
}

// AI personality types for team selection variety - Budget-aware compositions
const AI_PERSONALITIES = {
    aggressive: {
        name: 'Aggressor',
        description: 'Bevorzugt offensive Einheiten und schnelle Eliminierung',
        // Budget-aware compositions: each has a cost
        compositions: [
            ['assault', 'commando', 'medic'],           // 100+90+80 = 270
            ['assault', 'assault', 'medic'],            // 100+100+80 = 280
            ['commando', 'commando', 'scout', 'medic'], // 90+90+70+80 = 330
            ['elitesoldat', 'commando', 'medic'],       // 150+90+80 = 320
        ],
        weight: 1.0
    },
    defensive: {
        name: 'Defender',
        description: 'Bevorzugt Verteidigung und Heilung',
        compositions: [
            ['medic', 'sniper', 'assault'],             // 80+110+100 = 290
            ['medic', 'medic', 'assault', 'scout'],     // 80+80+100+70 = 330
            ['sniper', 'sniper', 'medic'],              // 110+110+80 = 300
            ['elitesoldat', 'medic', 'scout'],          // 150+80+70 = 300
        ],
        weight: 1.0
    },
    balanced: {
        name: 'Taktiker',
        description: 'Ausgewogene Teams mit vielseitigen Fähigkeiten',
        compositions: [
            ['scout', 'assault', 'medic'],              // 70+100+80 = 250
            ['scout', 'sniper', 'medic'],               // 70+110+80 = 260
            ['assault', 'sniper', 'medic'],             // 100+110+80 = 290
            ['scout', 'assault', 'medic', 'commando'],  // 70+100+80+90 = 340
        ],
        weight: 1.5  // Slightly prefer balanced teams
    },
    stealth: {
        name: 'Schattenjäger',
        description: 'Spezialisiert auf Hinterhalte und Überraschungsangriffe',
        compositions: [
            ['scout', 'commando', 'sniper'],            // 70+90+110 = 270
            ['commando', 'sniper', 'medic'],            // 90+110+80 = 280
            ['scout', 'commando', 'commando', 'medic'], // 70+90+90+80 = 330
        ],
        weight: 0.8
    },
    elite: {
        name: 'Elite-Kommando',
        description: 'Weniger Einheiten, dafür Elite-Soldaten',
        compositions: [
            ['elitesoldat', 'medic'],                   // 150+80 = 230 (nur 2 Einheiten!)
            ['elitesoldat', 'sniper'],                  // 150+110 = 260
            ['elitesoldat', 'assault'],                 // 150+100 = 250
            ['elitesoldat', 'elitesoldat'],             // 150+150 = 300 (zwei Elite!)
        ],
        weight: 0.6  // Rarer elite teams
    },
    swarm: {
        name: 'Schwarm',
        description: 'Viele günstige Einheiten für Überzahl',
        compositions: [
            ['scout', 'scout', 'medic', 'medic'],       // 70+70+80+80 = 300
            ['scout', 'scout', 'scout', 'medic'],       // 70+70+70+80 = 290
            ['commando', 'commando', 'scout', 'scout'], // 90+90+70+70 = 320
            ['scout', 'medic', 'medic', 'commando', 'scout'], // 70+80+80+90+70 = 390 (5 Einheiten, über Budget!)
        ],
        weight: 0.7
    }
};

// Track last AI team to avoid repetition
let lastAITeamKey = null;

/**
 * Calculate team cost
 */
function calculateTeamCost(team) {
    return team.reduce((total, classKey) => {
        const unitClass = UNIT_CLASSES[classKey];
        return total + (unitClass ? unitClass.cost : 0);
    }, 0);
}

/**
 * Generate a balanced team for AI respecting budget
 * Wählt ein intelligentes Team basierend auf KI-Persönlichkeit und Budget
 */
function generateAITeam() {
    // Select a personality based on weighted random
    const personalities = Object.entries(AI_PERSONALITIES);
    const totalWeight = personalities.reduce((sum, [, p]) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedPersonality = personalities[0][1]; // Default fallback
    let personalityName = personalities[0][0];
    for (const [name, personality] of personalities) {
        random -= personality.weight;
        if (random <= 0) {
            selectedPersonality = personality;
            personalityName = name;
            break;
        }
    }

    // Get compositions for this personality and filter by budget
    const validCompositions = selectedPersonality.compositions.filter(comp => {
        const cost = calculateTeamCost(comp);
        const unitCount = comp.length;
        return cost <= CONFIG.TEAM_BUDGET &&
               unitCount >= CONFIG.MIN_UNITS &&
               unitCount <= CONFIG.MAX_UNITS;
    });

    // If no valid compositions, fall back to balanced
    const compositions = validCompositions.length > 0 ?
        validCompositions :
        AI_PERSONALITIES.balanced.compositions.filter(comp =>
            calculateTeamCost(comp) <= CONFIG.TEAM_BUDGET
        );

    // Try to pick a different composition than last time
    let attempts = 0;
    let selectedTeam;
    do {
        selectedTeam = compositions[Math.floor(Math.random() * compositions.length)];
        const teamKey = selectedTeam.join(',');
        if (teamKey !== lastAITeamKey || attempts >= 3) {
            lastAITeamKey = teamKey;
            break;
        }
        attempts++;
    } while (attempts < 5);

    // Small chance to shuffle order for visual variety
    if (Math.random() < 0.3) {
        selectedTeam = [...selectedTeam].sort(() => Math.random() - 0.5);
    }

    // Log AI team selection for debugging
    console.log(`[AI] ${selectedPersonality.name}: ${selectedTeam.join(', ')} (${calculateTeamCost(selectedTeam)}/${CONFIG.TEAM_BUDGET})`);

    return selectedTeam;
}

/**
 * Calculate total cost of current selection
 */
function calculateSelectionCost(selection) {
    return selection.reduce((total, classKey) => {
        const unitClass = UNIT_CLASSES[classKey];
        return total + (unitClass ? unitClass.cost : 0);
    }, 0);
}

/**
 * Check if selection is valid (within budget and unit limits)
 */
function isSelectionValid(selection) {
    const cost = calculateSelectionCost(selection);
    const unitCount = selection.length;
    return cost <= CONFIG.TEAM_BUDGET &&
           unitCount >= CONFIG.MIN_UNITS &&
           unitCount <= CONFIG.MAX_UNITS;
}

/**
 * Check if can add a unit (budget and max units check)
 */
function canAddUnit(classKey) {
    const unitClass = UNIT_CLASSES[classKey];
    if (!unitClass) return false;

    const newCost = currentBudgetSpent + unitClass.cost;
    const newCount = currentPlayerSelection.length + 1;

    return newCost <= CONFIG.TEAM_BUDGET && newCount <= CONFIG.MAX_UNITS;
}

/**
 * Show team selection screen for a specific player
 */
function showTeamSelectForPlayer(playerIndex) {
    // Skip AI players (both in single player mode and mixed multiplayer)
    if (isAIPlayer(playerIndex)) {
        // Auto-generate team for AI
        state.teamSelections[playerIndex] = generateAITeam();

        // Move to next player
        const nextPlayer = playerIndex + 1;
        if (nextPlayer >= state.settings.players) {
            startGameWithTeams();
        } else {
            showTeamSelectForPlayer(nextPlayer);
        }
        return;
    }

    currentTeamSelectPlayer = playerIndex;
    currentPlayerSelection = [];
    currentBudgetSpent = 0;

    // Update header
    const badge = document.getElementById('team-select-badge');
    const playerNum = document.getElementById('team-select-player');
    const hint = document.querySelector('.team-select-hint');

    if (badge) {
        badge.style.backgroundColor = CONFIG.PLAYER_COLORS[playerIndex];
        badge.textContent = playerIndex + 1;
    }
    if (playerNum) {
        playerNum.textContent = playerIndex + 1;
    }
    if (hint) {
        hint.textContent = `Spieler ${playerIndex + 1}: Stelle dein Team zusammen`;
    }

    // Generate unit cards
    generateUnitCards();

    // Update card selection state and preview
    updateCardSelectionState();
    updateTeamPreview();
    updateBudgetDisplay();

    // Enable/disable confirm button based on current selection
    updateConfirmButton();

    showScreen('team-select');

    // Start team selection tutorial for first player
    if (playerIndex === 0) {
        setTimeout(() => startTeamSelectTutorial(), 300);
    }
}

/**
 * Update confirm button state
 */
function updateConfirmButton() {
    const confirmBtn = document.getElementById('team-confirm-btn');
    if (confirmBtn) {
        const isValid = currentPlayerSelection.length >= CONFIG.MIN_UNITS &&
                       currentPlayerSelection.length <= CONFIG.MAX_UNITS &&
                       currentBudgetSpent <= CONFIG.TEAM_BUDGET;
        confirmBtn.disabled = !isValid;

        // Update button text to show unit count
        if (isValid) {
            confirmBtn.textContent = `Weiter (${currentPlayerSelection.length} Einheiten)`;
        } else if (currentPlayerSelection.length < CONFIG.MIN_UNITS) {
            confirmBtn.textContent = `Noch ${CONFIG.MIN_UNITS - currentPlayerSelection.length} Einheit(en) wählen`;
        } else {
            confirmBtn.textContent = 'Budget überschritten!';
        }
    }
}

/**
 * Generate unit selection cards
 */
function generateUnitCards() {
    const grid = document.getElementById('team-select-grid');
    if (!grid) return;

    grid.innerHTML = '';

    Object.entries(UNIT_CLASSES).forEach(([classKey, classData]) => {
        const card = document.createElement('div');
        card.className = 'unit-card';
        card.dataset.class = classKey;
        card.dataset.cost = classData.cost;

        // Determine cost category for styling
        let costCategory = 'normal';
        if (classData.cost >= 140) costCategory = 'expensive';
        else if (classData.cost <= 80) costCategory = 'cheap';

        // Check if this is an elite unit (has special dual-attack capability)
        const isElite = classData.canMelee && classData.canRanged;

        card.innerHTML = `
            <div class="unit-cost cost-${costCategory}">${classData.cost} 💰</div>
            ${isElite ? '<div class="unit-elite-badge">ELITE</div>' : ''}
            <div class="unit-icon">${classData.icon}</div>
            <div class="unit-name">${classData.name}</div>
            <div class="unit-stats">
                ❤️ ${classData.hp} HP • ⚔️ ${classData.damage} DMG<br>
                📍 ${classData.move} Felder • 🎯 ${classData.range} Reichweite
                ${classData.meleeBonus ? `<br>🗡️ +${classData.meleeBonus} Nahkampf` : ''}
            </div>
            <div class="unit-special">✨ ${classData.special}: ${classData.specialDesc}</div>
        `;

        card.onclick = () => {
            playClick();
            toggleUnitSelection(classKey, card);
        };

        // Show unit class hint on first interaction
        card.onmouseenter = () => showUnitClassHint(classKey);
        card.onfocus = () => showUnitClassHint(classKey);

        grid.appendChild(card);
    });
}

/**
 * Update budget display
 */
function updateBudgetDisplay() {
    let budgetDisplay = document.getElementById('budget-display');

    // Create budget display if it doesn't exist
    if (!budgetDisplay) {
        const preview = document.querySelector('.team-select-preview');
        if (preview) {
            budgetDisplay = document.createElement('div');
            budgetDisplay.id = 'budget-display';
            budgetDisplay.className = 'budget-display';
            preview.insertBefore(budgetDisplay, preview.firstChild);
        }
    }

    if (budgetDisplay) {
        const remaining = CONFIG.TEAM_BUDGET - currentBudgetSpent;
        const percentage = (currentBudgetSpent / CONFIG.TEAM_BUDGET) * 100;

        let statusClass = 'budget-ok';
        if (percentage > 90) statusClass = 'budget-warning';
        if (remaining < 0) statusClass = 'budget-over';

        budgetDisplay.innerHTML = `
            <div class="budget-bar">
                <div class="budget-fill ${statusClass}" style="width: ${Math.min(100, percentage)}%"></div>
            </div>
            <div class="budget-text">
                <span class="budget-spent">${currentBudgetSpent}</span>
                <span class="budget-separator">/</span>
                <span class="budget-total">${CONFIG.TEAM_BUDGET}</span>
                <span class="budget-label">💰 Budget</span>
                <span class="budget-remaining">(${remaining} übrig)</span>
            </div>
        `;
    }
}

/**
 * Toggle unit selection
 */
function toggleUnitSelection(classKey, card) {
    const unitClass = UNIT_CLASSES[classKey];
    if (!unitClass) return;

    // Check if we can add this unit (budget and max units)
    if (canAddUnit(classKey)) {
        // Add to selection (allow duplicates)
        currentPlayerSelection.push(classKey);
        currentBudgetSpent += unitClass.cost;
        updateCardSelectionState();
    } else if (currentPlayerSelection.length >= CONFIG.MAX_UNITS) {
        // Show max units warning
        import('./ui.js').then(ui => ui.showToast(`Maximum ${CONFIG.MAX_UNITS} Einheiten erlaubt!`, 'error'));
    } else {
        // Show budget warning
        import('./ui.js').then(ui => ui.showToast('Nicht genug Budget!', 'error'));
    }

    updateTeamPreview();
    updateBudgetDisplay();
    updateConfirmButton();
}

/**
 * Update visual selection state of cards
 */
function updateCardSelectionState() {
    const cards = document.querySelectorAll('.unit-card');
    cards.forEach(card => {
        const classKey = card.dataset.class;
        const count = currentPlayerSelection.filter(c => c === classKey).length;
        const unitClass = UNIT_CLASSES[classKey];

        card.classList.toggle('selected', count > 0);

        // Check if unit is affordable
        const remaining = CONFIG.TEAM_BUDGET - currentBudgetSpent;
        const canAfford = unitClass && unitClass.cost <= remaining && currentPlayerSelection.length < CONFIG.MAX_UNITS;
        card.classList.toggle('unaffordable', !canAfford && count === 0);

        // Update or remove count badge
        let countBadge = card.querySelector('.select-count');
        if (count > 0) {
            if (!countBadge) {
                countBadge = document.createElement('div');
                countBadge.className = 'select-count';
                card.appendChild(countBadge);
            }
            countBadge.textContent = count;
        } else if (countBadge) {
            countBadge.remove();
        }
    });
}

/**
 * Update team preview slots
 */
function updateTeamPreview() {
    const previewContainer = document.getElementById('team-preview-units');
    if (!previewContainer) return;

    // Clear existing slots
    previewContainer.innerHTML = '';

    // Create slots for selected units
    currentPlayerSelection.forEach((classKey, index) => {
        const classData = UNIT_CLASSES[classKey];
        const slot = document.createElement('div');
        slot.className = 'team-slot filled';
        slot.innerHTML = `
            <span class="slot-icon">${classData.icon}</span>
            <span class="slot-cost">${classData.cost}</span>
        `;
        slot.style.cursor = 'pointer';
        slot.onclick = () => removeFromSelection(index);
        slot.title = `${classData.name} - Klicken zum Entfernen`;
        previewContainer.appendChild(slot);
    });

    // Add empty slots up to max units
    const emptySlots = CONFIG.MAX_UNITS - currentPlayerSelection.length;
    for (let i = 0; i < emptySlots; i++) {
        const slot = document.createElement('div');
        slot.className = 'team-slot empty';
        slot.textContent = '+';
        slot.title = 'Einheit hinzufügen';
        previewContainer.appendChild(slot);
    }
}

/**
 * Remove unit from selection by index
 */
function removeFromSelection(index) {
    const removedClass = currentPlayerSelection[index];
    const unitClass = UNIT_CLASSES[removedClass];

    if (unitClass) {
        currentBudgetSpent -= unitClass.cost;
    }

    currentPlayerSelection.splice(index, 1);
    updateCardSelectionState();
    updateTeamPreview();
    updateBudgetDisplay();
    updateConfirmButton();
}

/**
 * Confirm team selection for current player
 */
function confirmTeamSelection() {
    // Validate selection
    if (currentPlayerSelection.length < CONFIG.MIN_UNITS ||
        currentPlayerSelection.length > CONFIG.MAX_UNITS ||
        currentBudgetSpent > CONFIG.TEAM_BUDGET) {
        return;
    }

    // Save selection
    state.teamSelections[currentTeamSelectPlayer] = [...currentPlayerSelection];

    // Move to next player or start game
    // showTeamSelectForPlayer automatically skips AI players
    const nextPlayer = currentTeamSelectPlayer + 1;

    if (nextPlayer < state.settings.players) {
        showTeamSelectForPlayer(nextPlayer);
    } else {
        // All players selected, start game
        startGameWithTeams();
    }
}

/**
 * Start a new game with selected teams
 */
function startGameWithTeams() {
    // === VALIDIERE TEAM-KONFIGURATION ===
    // Verhindere, dass alle Spieler im gleichen Team sind
    if (state.settings.alliances && state.settings.alliances.length > 0) {
        const uniqueTeams = new Set(state.settings.alliances);
        if (uniqueTeams.size < 2) {
            showToast('⚠️ Es müssen mindestens 2 verschiedene Teams existieren!', 'warning');
            return;
        }
    }

    // Hide team selection tutorial
    hideTeamSelectTutorial();

    // Initialize audio on game start (requires user interaction)
    initAudio();
    resumeAudio();
    startAmbient();

    // Reset state (but keep teamSelections and aiPlayers setting)
    const savedSelections = [...state.teamSelections];
    const aiPlayers = [...state.settings.aiPlayers];
    resetState();
    resetAIMemory();  // Reset AI's strategic memory for new game
    state.teamSelections = savedSelections;
    state.settings.aiPlayers = aiPlayers;

    // Clear cached hex tiles since map is regenerating
    clearRenderCaches();

    // Reset camera position
    state.cameraX = 0;
    state.cameraY = 0;

    // Generate map and units
    generateMap();
    createUnits();

    // Initialize progression for all units
    state.units.forEach(unit => initUnitProgression(unit));

    // Generate power-ups on the map
    generatePowerups();

    // Initialize shrinking zone with map radius
    const mapRadius = CONFIG.MAP_SIZES[state.settings.size] || CONFIG.MAP_SIZES.medium;
    initZone(mapRadius);

    // Check if this is spectator mode (all AI players) BEFORE initializing visibility
    // This ensures viewingPlayer is set correctly for the first render
    if (isSpectatorMode()) {
        state.viewingPlayer = state.currentPlayer;
        console.log('[Main] Spectator mode detected - viewingPlayer set to', state.viewingPlayer);
    }

    // Initialize visibility for the viewing player
    updateVisibility();

    // Show game area
    showScreen(null);

    // Use requestAnimationFrame to ensure the browser has updated the layout
    // before sizing the canvas. This is critical for AI vs AI games where
    // everything happens synchronously without user interaction.
    requestAnimationFrame(() => {
        // Initialize canvas - this may retry if container has 0 dimensions
        resizeCanvas();

        // Wait for canvas to be properly sized before starting the turn
        // This is necessary because resizeCanvas() may need multiple retries
        waitForCanvasReady(() => {
            startTurn();
        });
    });
}

/**
 * Wait for canvas to be properly sized before executing callback
 * Polls until canvas has valid dimensions (non-zero width/height)
 */
function waitForCanvasReady(callback, maxAttempts = 20) {
    const canvas = document.getElementById('game-canvas');
    let attempts = 0;

    function check() {
        attempts++;
        if (canvas && canvas.width > 0 && canvas.height > 0) {
            callback();
        } else if (attempts < maxAttempts) {
            setTimeout(check, 50);
        } else {
            // Fallback: start anyway after max attempts (1 second)
            console.warn('Canvas not ready after max attempts, starting anyway');
            callback();
        }
    }

    check();
}

/**
 * Start a new game
 */
export function startGame() {
    startTeamSelection();
}

/**
 * Check if we should trigger AI turn
 */
export function checkAITurn() {
    if (isAIPlayer()) {
        setTimeout(() => {
            executeAITurn();
        }, 500);
        return true;
    }
    return false;
}

/**
 * Initialize the application
 */
async function init() {
    // Show menu first to ensure it's visible while loading
    showScreen('menu');

    // Initialize asset loader (loads static assets if available)
    await initAssetLoader();

    if (isUsingStaticAssets()) {
        console.log('Using pre-generated static assets');
    } else {
        console.log('Using runtime-generated assets');
    }

    // Setup start button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.onclick = startGame;
    }

    // Initialize AI config grid on startup (default: Player 2 is AI)
    state.settings.aiPlayers = [1];
    updateAIConfigGrid();

    // Setup alliance mode buttons
    setupAllianceButtons();

    // Setup player count buttons
    document.querySelectorAll('[data-players]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            document.querySelectorAll('[data-players]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            state.settings.players = parseInt(btn.dataset.players, 10);

            // Update AI config grid when player count changes
            updateAIConfigGrid();
        });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.click();
        });
    });

    // Setup map size buttons
    document.querySelectorAll('[data-size]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            document.querySelectorAll('[data-size]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            state.settings.size = btn.dataset.size;
        });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.click();
        });
    });

    // Landscape name and icon mapping
    const landscapeInfo = {
        random: { icon: '🎲', name: 'Zufällig' },
        temperate: { icon: '🌳', name: 'Gemäßigt' },
        desert: { icon: '🏜️', name: 'Wüste' },
        tundra: { icon: '❄️', name: 'Tundra' },
        tropical: { icon: '🌴', name: 'Tropisch' },
        highland: { icon: '⛰️', name: 'Hochland' },
        wetland: { icon: '🌿', name: 'Feuchtgebiet' }
    };

    // Function to update landscape preview
    function updateLandscapePreview(landscape) {
        const preview = document.getElementById('landscape-preview');
        if (!preview) return;

        const info = landscapeInfo[landscape] || landscapeInfo.random;
        const iconEl = preview.querySelector('.landscape-preview-icon');
        const nameEl = preview.querySelector('.landscape-preview-name');

        if (iconEl) iconEl.textContent = info.icon;
        if (nameEl) nameEl.textContent = info.name;
    }

    // Setup landscape/biome buttons
    document.querySelectorAll('[data-landscape]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            document.querySelectorAll('[data-landscape]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            state.settings.landscape = btn.dataset.landscape;
            updateLandscapePreview(btn.dataset.landscape);
        });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.click();
        });
    });

    // Setup help toggle
    const helpToggle = document.getElementById('help-toggle');
    const helpPanel = document.getElementById('help-panel');
    if (helpToggle && helpPanel) {
        helpToggle.onclick = () => {
            helpToggle.classList.toggle('active');
            helpPanel.classList.toggle('show');
        };
    }

    // Setup advanced settings toggle
    const advancedToggle = document.getElementById('advanced-toggle');
    const advancedSection = document.getElementById('advanced-section');
    if (advancedToggle && advancedSection) {
        advancedToggle.onclick = () => {
            advancedSection.classList.toggle('collapsed');
        };
    }

    // Setup audio controls
    const volumeSlider = document.getElementById('volume-slider');
    const muteBtn = document.getElementById('mute-btn');

    // Initialize audio on first user interaction (required by browsers)
    const initAudioOnInteraction = () => {
        initAudio();
        resumeAudio();
        // Remove listeners after first interaction
        document.removeEventListener('click', initAudioOnInteraction);
        document.removeEventListener('touchstart', initAudioOnInteraction);
    };
    document.addEventListener('click', initAudioOnInteraction);
    document.addEventListener('touchstart', initAudioOnInteraction);

    if (volumeSlider) {
        volumeSlider.value = audioSettings.masterVolume * 100;
        volumeSlider.addEventListener('input', (e) => {
            initAudio(); // Ensure audio is ready
            resumeAudio();
            const volume = parseInt(e.target.value) / 100;
            setMasterVolume(volume);
            // Update mute button icon
            if (muteBtn) {
                muteBtn.textContent = volume === 0 ? '🔇' : (volume < 0.5 ? '🔉' : '🔊');
                muteBtn.classList.toggle('muted', volume === 0);
            }
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            initAudio(); // Ensure audio is ready
            resumeAudio();
            const isMuted = audioSettings.masterVolume === 0;
            if (isMuted) {
                // Unmute - restore to previous or default
                setMasterVolume(0.7);
                if (volumeSlider) volumeSlider.value = 70;
                muteBtn.textContent = '🔊';
                muteBtn.classList.remove('muted');
            } else {
                // Mute
                setMasterVolume(0);
                if (volumeSlider) volumeSlider.value = 0;
                muteBtn.textContent = '🔇';
                muteBtn.classList.add('muted');
            }
            playClick();
        });
    }

    // Setup notification level buttons
    const notificationBtns = document.querySelectorAll('#notification-level .setting-btn');
    notificationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            notificationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update setting
            state.settings.notificationLevel = btn.dataset.value;

            // Save to localStorage
            try {
                localStorage.setItem('shadowSquad_notificationLevel', btn.dataset.value);
            } catch { /* ignore */ }

            playClick();
        });
    });

    // Load saved notification level
    try {
        const savedLevel = localStorage.getItem('shadowSquad_notificationLevel');
        if (savedLevel) {
            state.settings.notificationLevel = savedLevel;
            notificationBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === savedLevel);
            });
        }
    } catch { /* ignore */ }

    // Setup tutorial toggle buttons
    const tutorialBtns = document.querySelectorAll('#tutorial-toggle .setting-btn');
    tutorialBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tutorialBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            state.settings.showTutorial = btn.dataset.value === 'on';

            // Save to localStorage
            try {
                localStorage.setItem('shadowSquad_showTutorial', btn.dataset.value);
            } catch { /* ignore */ }

            playClick();
        });
    });

    // Load saved tutorial setting
    try {
        const savedTutorial = localStorage.getItem('shadowSquad_showTutorial');
        if (savedTutorial) {
            state.settings.showTutorial = savedTutorial === 'on';
            tutorialBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === savedTutorial);
            });
        }
    } catch { /* ignore */ }

    // Setup tutorial reset button
    const resetTutorialBtn = document.getElementById('reset-tutorial-btn');
    if (resetTutorialBtn) {
        resetTutorialBtn.addEventListener('click', () => {
            resetTutorial();
            state.settings.showTutorial = true;

            // Also update the toggle to "on"
            tutorialBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === 'on');
            });
            try {
                localStorage.setItem('shadowSquad_showTutorial', 'on');
            } catch { /* ignore */ }

            // Visual feedback
            resetTutorialBtn.textContent = '✓';
            resetTutorialBtn.style.borderColor = 'var(--green)';
            resetTutorialBtn.style.color = 'var(--green)';

            setTimeout(() => {
                resetTutorialBtn.textContent = '🔄';
                resetTutorialBtn.style.borderColor = '';
                resetTutorialBtn.style.color = '';
            }, 1500);

            playClick();
        });
    }

    // Setup team confirm button
    const teamConfirmBtn = document.getElementById('team-confirm-btn');
    if (teamConfirmBtn) {
        teamConfirmBtn.onclick = confirmTeamSelection;
    }

    // Setup team back button
    const teamBackBtn = document.getElementById('team-back-btn');
    if (teamBackBtn) {
        teamBackBtn.onclick = () => {
            // Go back to previous player or main menu
            if (currentTeamSelectPlayer > 0) {
                // Go back to previous player's selection
                currentTeamSelectPlayer--;
                currentPlayerSelection = [...state.teamSelections[currentTeamSelectPlayer]];
                showTeamSelectForPlayer(currentTeamSelectPlayer);
            } else {
                // Go back to main menu
                showScreen('menu');
            }
        };
    }

    // Setup turn back button (go back to menu during turn transition)
    const turnBackBtn = document.getElementById('turn-back-btn');
    if (turnBackBtn) {
        turnBackBtn.onclick = () => {
            showScreen('menu');
        };
    }

    // Setup rematch button
    const rematchBtn = document.getElementById('rematch-btn');
    if (rematchBtn) {
        rematchBtn.onclick = startGame;
    }

    // Initialize renderer (await to ensure canvas is properly set up)
    await initRenderer();

    // Initialize input handlers
    initInput();

    // Menu is already shown at the start of init()
    // showScreen() now automatically handles pointer-events on game-area

    console.log('Shadow Squad initialized');
}

/**
 * Update alliance section visibility and config
 */
function updateAllianceSection() {
    const section = document.getElementById('alliance-section');
    const ffaBtn = document.getElementById('alliance-ffa-btn');
    const teamsBtn = document.getElementById('alliance-teams-btn');
    const configGrid = document.getElementById('alliance-config-grid');

    if (!section) return;

    // Only show alliance section for 3+ players
    if (state.settings.players >= 3) {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
        // Reset alliances for 2 players
        state.settings.alliances = [];
        return;
    }

    // Update config grid when in teams mode
    if (teamsBtn && teamsBtn.classList.contains('selected')) {
        updateAllianceConfigGrid();
    }
}

/**
 * Update the alliance config grid (team assignment dropdowns)
 */
function updateAllianceConfigGrid() {
    const grid = document.getElementById('alliance-config-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Initialize alliances array if needed
    if (!state.settings.alliances || state.settings.alliances.length !== state.settings.players) {
        // Default: alternate teams (0,1,0,1,0,1...)
        state.settings.alliances = [];
        for (let i = 0; i < state.settings.players; i++) {
            state.settings.alliances.push(i % 2);
        }
    }

    // Determine max teams based on player count
    const maxTeams = Math.min(4, Math.ceil(state.settings.players / 2));

    for (let i = 0; i < state.settings.players; i++) {
        const item = document.createElement('div');
        item.className = 'alliance-player-item';

        const badge = document.createElement('div');
        badge.className = 'player-badge';
        badge.style.backgroundColor = CONFIG.PLAYER_COLORS[i];
        badge.textContent = i + 1;

        const select = document.createElement('select');
        select.className = 'team-select';
        select.dataset.player = i;

        // Add team options
        for (let t = 0; t < maxTeams; t++) {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = `Team ${t + 1}`;
            if (state.settings.alliances[i] === t) {
                option.selected = true;
            }
            select.appendChild(option);
        }

        select.addEventListener('change', () => {
            const playerIndex = parseInt(select.dataset.player, 10);
            const newTeam = parseInt(select.value, 10);
            state.settings.alliances[playerIndex] = newTeam;
            // Update visual indicators
            updateAllianceConfigGrid();
        });

        // Team color indicator
        const indicator = document.createElement('div');
        indicator.className = `team-indicator team-${state.settings.alliances[i]}`;

        item.appendChild(badge);
        item.appendChild(select);
        item.appendChild(indicator);
        grid.appendChild(item);
    }
}

/**
 * Setup alliance mode buttons
 */
function setupAllianceButtons() {
    const ffaBtn = document.getElementById('alliance-ffa-btn');
    const teamsBtn = document.getElementById('alliance-teams-btn');
    const configGrid = document.getElementById('alliance-config-grid');

    if (ffaBtn) {
        ffaBtn.addEventListener('click', () => {
            ffaBtn.classList.add('selected');
            if (teamsBtn) teamsBtn.classList.remove('selected');
            if (configGrid) configGrid.style.display = 'none';
            // Clear alliances (free for all)
            state.settings.alliances = [];
        });
    }

    if (teamsBtn) {
        teamsBtn.addEventListener('click', () => {
            teamsBtn.classList.add('selected');
            if (ffaBtn) ffaBtn.classList.remove('selected');
            if (configGrid) configGrid.style.display = 'flex';
            // Initialize default team assignments
            updateAllianceConfigGrid();
        });
    }
}

/**
 * Update the AI config grid based on current player count
 */
function updateAIConfigGrid() {
    const grid = document.getElementById('ai-config-grid');
    if (!grid) return;

    // Filter out AI players that are no longer valid (when player count reduced)
    state.settings.aiPlayers = state.settings.aiPlayers.filter(p => p < state.settings.players);

    grid.innerHTML = '';

    // Also update alliance section
    updateAllianceSection();

    for (let i = 0; i < state.settings.players; i++) {
        const item = document.createElement('div');
        item.className = 'ai-config-item';

        const badge = document.createElement('div');
        badge.className = 'player-badge';
        badge.style.backgroundColor = CONFIG.PLAYER_COLORS[i];
        badge.textContent = i + 1;

        const isAI = state.settings.aiPlayers.includes(i);
        const toggle = document.createElement('button');
        toggle.className = `type-toggle ${isAI ? 'ai' : 'human'}`;
        toggle.textContent = isAI ? '🤖 KI' : '👤 Mensch';
        toggle.dataset.player = i;

        toggle.addEventListener('click', () => {
            const playerIndex = parseInt(toggle.dataset.player, 10);
            const isCurrentlyAI = state.settings.aiPlayers.includes(playerIndex);

            if (isCurrentlyAI) {
                // Remove from AI players
                state.settings.aiPlayers = state.settings.aiPlayers.filter(p => p !== playerIndex);
                toggle.className = 'type-toggle human';
                toggle.textContent = '👤 Mensch';
            } else {
                // Add to AI players
                state.settings.aiPlayers.push(playerIndex);
                toggle.className = 'type-toggle ai';
                toggle.textContent = '🤖 KI';
            }
        });

        item.appendChild(badge);
        item.appendChild(toggle);
        grid.appendChild(item);
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Service Worker registration with update handling
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('[App] Service worker registered');

            // Check for updates periodically (every 5 minutes)
            setInterval(() => {
                registration.update();
            }, 5 * 60 * 1000);

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[App] New service worker installing...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available, show update notification
                        console.log('[App] New version available!');
                        showUpdateNotification();
                    }
                });
            });

            // Handle controller change (when new SW takes over)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[App] New service worker activated, reloading...');
                window.location.reload();
            });
        } catch (error) {
            console.warn('[App] Service worker registration failed:', error);
        }
    });
}

/**
 * Show update notification to user
 */
function showUpdateNotification() {
    // Check if notification already exists
    if (document.getElementById('update-notification')) return;

    const notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.className = 'update-notification';
    notification.innerHTML = `
        <span>🔄 Neue Version verfügbar!</span>
        <button id="update-btn">Jetzt aktualisieren</button>
    `;
    document.body.appendChild(notification);

    document.getElementById('update-btn').addEventListener('click', () => {
        // Tell the waiting service worker to take over
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                if (registration.waiting) {
                    registration.waiting.postMessage('skipWaiting');
                }
            });
        }
        notification.remove();
    });

    // Auto-dismiss after 30 seconds if user doesn't interact
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 30000);
}
