// ===== MAIN ENTRY POINT =====

import { state, resetState, initZone } from './state.js';
import { CONFIG, UNIT_CLASSES } from './config.js';
import { generateMap } from './map.js';
import { createUnits } from './units.js';
import { startTurn } from './turns.js';
// Use the legacy canvas renderer for stability/performance
import { initRenderer, resizeCanvas, render, clearRenderCaches } from './renderer.js';
import { updateUI, showScreen } from './ui.js';
import { initInput, centerOnCurrentUnit } from './input.js';
import { updateVisibility } from './fogOfWar.js';
import { generatePowerups } from './powerups.js';
import { initUnitProgression } from './progression.js';
import { isAIPlayer, executeAITurn, resetAIMemory } from './ai.js';
import { initAudio, resumeAudio, playClick, startAmbient, setMasterVolume, toggleAudio, audioSettings } from './audio.js';
import { initAssetLoader, isUsingStaticAssets } from './assetLoader.js';
import { resetTutorial } from './tutorial.js';

// Team selection state
let currentTeamSelectPlayer = 0;
let currentPlayerSelection = [];

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

// AI personality types for team selection variety
const AI_PERSONALITIES = {
    aggressive: {
        name: 'Aggressor',
        compositions: [
            ['assault', 'commando', 'medic'],    // Heavy offense with healing
            ['assault', 'assault', 'medic'],     // Double tank
            ['commando', 'commando', 'scout'],   // Assassin squad
        ],
        weight: 1
    },
    defensive: {
        name: 'Defender',
        compositions: [
            ['medic', 'sniper', 'assault'],      // Long range with tank
            ['medic', 'medic', 'assault'],       // Extreme sustain
            ['sniper', 'sniper', 'scout'],       // Long range focus
        ],
        weight: 1
    },
    balanced: {
        name: 'Taktiker',
        compositions: [
            ['scout', 'assault', 'medic'],       // Classic balanced
            ['scout', 'sniper', 'medic'],        // Vision + range + heal
            ['assault', 'sniper', 'medic'],      // All-rounder
        ],
        weight: 1.5  // Slightly prefer balanced teams
    },
    stealth: {
        name: 'Schattenjäger',
        compositions: [
            ['scout', 'commando', 'sniper'],     // Stealth + assassination
            ['commando', 'sniper', 'medic'],     // Ambush squad
            ['scout', 'commando', 'commando'],   // Fast strike team
        ],
        weight: 0.8
    },
    specialist: {
        name: 'Spezialist',
        compositions: [
            ['scout', 'scout', 'sniper'],        // Maximum vision
            ['assault', 'assault', 'assault'],   // Brute force
            ['medic', 'scout', 'commando'],      // Support + mobility
        ],
        weight: 0.6  // Rarer specialist teams
    }
};

// Track last AI team to avoid repetition
let lastAITeamKey = null;

/**
 * Generate a balanced team for AI
 * Wählt ein intelligentes Team basierend auf KI-Persönlichkeit und vermeidet Wiederholungen
 */
function generateAITeam() {
    // Select a personality based on weighted random
    const personalities = Object.entries(AI_PERSONALITIES);
    const totalWeight = personalities.reduce((sum, [, p]) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedPersonality = personalities[0][1]; // Default fallback
    for (const [, personality] of personalities) {
        random -= personality.weight;
        if (random <= 0) {
            selectedPersonality = personality;
            break;
        }
    }

    // Get compositions for this personality
    const compositions = selectedPersonality.compositions;

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

    return selectedTeam;
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
        hint.textContent = `Spieler ${playerIndex + 1}: Wähle dein Team`;
    }

    // Generate unit cards
    generateUnitCards();

    // Update card selection state and preview
    updateCardSelectionState();
    updateTeamPreview();

    // Enable/disable confirm button based on current selection
    const confirmBtn = document.getElementById('team-confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = currentPlayerSelection.length !== CONFIG.UNITS_PER_PLAYER;
    }

    showScreen('team-select');
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

        card.innerHTML = `
            <div class="unit-icon">${classData.icon}</div>
            <div class="unit-name">${classData.name}</div>
            <div class="unit-stats">
                ❤️ ${classData.hp} HP • ⚔️ ${classData.damage} DMG<br>
                📍 ${classData.move} Felder • 🎯 ${classData.range} Reichweite
            </div>
            <div class="unit-special">✨ ${classData.special}: ${classData.specialDesc}</div>
        `;

        card.onclick = () => {
            playClick();
            toggleUnitSelection(classKey, card);
        };
        grid.appendChild(card);
    });
}

/**
 * Toggle unit selection
 */
function toggleUnitSelection(classKey, card) {
    if (currentPlayerSelection.length < CONFIG.UNITS_PER_PLAYER) {
        // Add to selection (allow duplicates)
        currentPlayerSelection.push(classKey);
        updateCardSelectionState();
    }

    updateTeamPreview();

    // Enable/disable confirm button
    const confirmBtn = document.getElementById('team-confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = currentPlayerSelection.length !== CONFIG.UNITS_PER_PLAYER;
    }
}

/**
 * Update visual selection state of cards
 */
function updateCardSelectionState() {
    const cards = document.querySelectorAll('.unit-card');
    cards.forEach(card => {
        const classKey = card.dataset.class;
        const count = currentPlayerSelection.filter(c => c === classKey).length;

        card.classList.toggle('selected', count > 0);

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

    const slots = previewContainer.querySelectorAll('.team-slot');
    slots.forEach((slot, index) => {
        if (currentPlayerSelection[index]) {
            const classData = UNIT_CLASSES[currentPlayerSelection[index]];
            slot.textContent = classData.icon;
            slot.classList.add('filled');
            slot.classList.remove('empty');
            slot.style.cursor = 'pointer';
            slot.onclick = () => removeFromSelection(index);
        } else {
            slot.textContent = '?';
            slot.classList.remove('filled');
            slot.classList.add('empty');
            slot.style.cursor = 'default';
            slot.onclick = null;
        }
    });
}

/**
 * Remove unit from selection by index
 */
function removeFromSelection(index) {
    currentPlayerSelection.splice(index, 1);
    updateCardSelectionState();
    updateTeamPreview();

    const confirmBtn = document.getElementById('team-confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = currentPlayerSelection.length !== CONFIG.UNITS_PER_PLAYER;
    }
}

/**
 * Confirm team selection for current player
 */
function confirmTeamSelection() {
    if (currentPlayerSelection.length !== CONFIG.UNITS_PER_PLAYER) return;

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

    // Initialize visibility
    updateVisibility();

    // Show game area
    showScreen(null);

    // Use requestAnimationFrame to ensure the browser has updated the layout
    // before sizing the canvas. This is critical for AI vs AI games where
    // everything happens synchronously without user interaction.
    requestAnimationFrame(() => {
        // Initialize canvas
        resizeCanvas();

        // Start first turn
        startTurn();
    });
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

    // Setup tutorial reset button
    const resetTutorialBtn = document.getElementById('reset-tutorial-btn');
    if (resetTutorialBtn) {
        resetTutorialBtn.addEventListener('click', () => {
            resetTutorial();
            state.settings.showTutorial = true;

            // Visual feedback
            resetTutorialBtn.textContent = '✓ Zurückgesetzt!';
            resetTutorialBtn.style.borderColor = 'var(--green)';
            resetTutorialBtn.style.color = 'var(--green)';

            setTimeout(() => {
                resetTutorialBtn.textContent = '🔄 Zurücksetzen';
                resetTutorialBtn.style.borderColor = '';
                resetTutorialBtn.style.color = '';
            }, 2000);

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
 * Update the AI config grid based on current player count
 */
function updateAIConfigGrid() {
    const grid = document.getElementById('ai-config-grid');
    if (!grid) return;

    // Filter out AI players that are no longer valid (when player count reduced)
    state.settings.aiPlayers = state.settings.aiPlayers.filter(p => p < state.settings.players);

    grid.innerHTML = '';

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
