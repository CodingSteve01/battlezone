// ===== MAIN ENTRY POINT =====

import { state, resetState, initZone, getPlayerName, ZOOM_REFERENCE } from './state.js';
import { CONFIG, UNIT_CLASSES, UNIT_VARIANTS, getUnitWithVariant, TERRAIN } from './config.js';
import { generateMap } from './map.js';
import { createUnits } from './units.js';
import { startTurn } from './turns.js';
// Use the legacy canvas renderer for stability/performance
import { initRenderer, resizeCanvas, render, clearRenderCaches } from './renderer.js';
import { updateUI, showScreen, showToast } from './ui.js';
import { initInput, centerOnCurrentUnit, centerOnTeam } from './input.js';
import { updateVisibility } from './fogOfWar.js';
import { generatePowerups } from './powerups.js';
import { initUnitProgression } from './progression.js';
import { isAIPlayer, executeAITurn, resetAIMemory, isSpectatorMode } from './ai.js';
import { initAudio, resumeAudio, playClick, startAmbient, setMasterVolume, toggleAudio, audioSettings } from './audio.js';
import { initAssetLoader, isUsingStaticAssets, getUnitSprite } from './assetLoader.js';
import { resetTutorial, startTeamSelectTutorial, showUnitClassHint, hideTeamSelectTutorial, shouldStartTutorial } from './tutorial.js';
import { hexToPixel } from './hexMath.js';
import { initErrorCapture, showLogViewer, getErrorCount, addLogListener, logInfo, logError } from './errorLog.js';

// Map preview state
let mapPreviewTimeout = null;

// Team selection state
let currentTeamSelectPlayer = 0;
let currentPlayerSelection = [];
let currentBudgetSpent = 0;

// Common German first names for random player name suggestions
const GERMAN_NAMES = [
    // Male names
    'Max', 'Felix', 'Leon', 'Paul', 'Finn', 'Noah', 'Elias', 'Ben', 'Lukas', 'Jonas',
    'Tim', 'Moritz', 'David', 'Jan', 'Tom', 'Niklas', 'Erik', 'Philipp', 'Julian', 'Liam',
    'Anton', 'Emil', 'Luca', 'Theo', 'Oskar', 'Matteo', 'Jakob', 'Simon', 'Daniel', 'Alex',
    // Female names
    'Emma', 'Mia', 'Hannah', 'Sofia', 'Lena', 'Marie', 'Anna', 'Emilia', 'Lea', 'Clara',
    'Lara', 'Lisa', 'Laura', 'Julia', 'Sarah', 'Nele', 'Nina', 'Sophie', 'Ella', 'Maya',
    'Amelie', 'Johanna', 'Paula', 'Ida', 'Frieda', 'Greta', 'Charlotte', 'Pia', 'Zoe', 'Lina',
    // Neutral/Nicknames
    'Sam', 'Robin', 'Kim', 'Jo', 'Charlie', 'Alex', 'Sascha', 'Toni', 'Nico', 'Mika'
];

/**
 * Get a random German name
 */
function getRandomName(usedNames = []) {
    const availableNames = GERMAN_NAMES.filter(n => !usedNames.includes(n));
    if (availableNames.length === 0) {
        return GERMAN_NAMES[Math.floor(Math.random() * GERMAN_NAMES.length)];
    }
    return availableNames[Math.floor(Math.random() * availableNames.length)];
}

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
    // === AGGRESSIVE TEAMS - High damage output, seeks kills ===
    aggressive: {
        name: 'Aggressor',
        description: 'Maximale Feuerkraft - eliminiert Feinde schnell',
        compositions: [
            ['sniper', 'sniper', 'commando'],           // 110+110+90 = 310 (180 dmg!)
            ['sniper', 'assault', 'commando'],          // 110+100+90 = 300 (155 dmg)
            ['assault', 'assault', 'sniper'],           // 100+100+110 = 310 (145 dmg)
            ['sniper', 'commando', 'commando'],         // 110+90+90 = 290 (165 dmg)
            ['sniper', 'sniper', 'assault'],            // 110+110+100 = 320 (170 dmg)
            ['commando', 'commando', 'commando', 'scout'], // 90+90+90+70 = 340 (172 dmg)
            // NEW with 400 budget:
            ['sniper', 'sniper', 'commando', 'scout'],  // 110+110+90+70 = 380 (202 dmg!)
            ['sniper', 'assault', 'commando', 'commando'], // 110+100+90+90 = 390 (205 dmg!)
        ],
        weight: 1.5  // HIGH weight - KI soll kämpfen!
    },
    // === BALANCED BUT STILL OFFENSIVE ===
    balanced: {
        name: 'Taktiker',
        description: 'Ausgewogen mit guter Feuerkraft und Unterstützung',
        compositions: [
            ['sniper', 'assault', 'medic'],             // 110+100+80 = 290 (120 dmg + heal)
            ['sniper', 'commando', 'medic'],            // 110+90+80 = 280 (130 dmg + heal)
            ['assault', 'commando', 'medic', 'scout'],  // 100+90+80+70 = 340 (127 dmg + heal)
            ['sniper', 'sniper', 'medic'],              // 110+110+80 = 300 (145 dmg + heal)
            ['assault', 'assault', 'medic'],            // 100+100+80 = 280 (95 dmg + heal)
            ['sniper', 'assault', 'commando'],          // 110+100+90 = 300 (155 dmg)
            // NEW with 400 budget:
            ['sniper', 'assault', 'commando', 'medic'], // 110+100+90+80 = 380 (155 dmg + heal)
            ['sniper', 'sniper', 'medic', 'scout'],     // 110+110+80+70 = 370 (167 dmg + heal)
        ],
        weight: 1.2  // Still common
    },
    // === ASSASSINATION TEAMS - High single-target damage ===
    stealth: {
        name: 'Schattenjäger',
        description: 'Hinterhalte und Überraschungsangriffe mit tödlicher Präzision',
        compositions: [
            ['sniper', 'commando', 'commando'],         // 110+90+90 = 290 (165 dmg)
            ['commando', 'commando', 'assault'],        // 90+90+100 = 280 (140 dmg)
            ['sniper', 'sniper', 'scout'],              // 110+110+70 = 290 (152 dmg)
            ['commando', 'commando', 'commando'],       // 90+90+90 = 270 (150 dmg)
            ['sniper', 'commando', 'assault'],          // 110+90+100 = 300 (155 dmg)
            // NEW with 400 budget:
            ['sniper', 'commando', 'commando', 'commando'], // 110+90+90+90 = 380 (215 dmg!)
            ['sniper', 'sniper', 'commando', 'scout'],  // 110+110+90+70 = 380 (202 dmg)
        ],
        weight: 1.0
    },
    // === ELITE POWERHOUSE ===
    elite: {
        name: 'Elite-Kommando',
        description: 'Weniger Einheiten, maximale Schlagkraft',
        compositions: [
            ['elitesoldat', 'sniper', 'scout'],         // 150+110+70 = 330 (127 dmg)
            ['elitesoldat', 'commando', 'scout'],       // 150+90+70 = 310 (112 dmg)
            ['elitesoldat', 'assault'],                 // 150+100 = 250 (80 dmg + versatility)
            ['elitesoldat', 'sniper'],                  // 150+110 = 260 (105 dmg)
            ['elitesoldat', 'commando', 'commando'],    // 150+90+90 = 330 (140 dmg)
            // NEW with 400 budget:
            ['elitesoldat', 'sniper', 'commando'],      // 150+110+90 = 350 (155 dmg)
            ['elitesoldat', 'elitesoldat'],             // 150+150 = 300 (80-110 dmg each!)
            ['elitesoldat', 'sniper', 'assault'],       // 150+110+100 = 360 (145 dmg)
        ],
        weight: 0.8
    },
    // === SWARM TACTICS - Numbers advantage ===
    swarm: {
        name: 'Schwarm',
        description: 'Überzahl für taktische Flexibilität',
        compositions: [
            ['commando', 'commando', 'scout', 'scout'], // 90+90+70+70 = 320 (144 dmg)
            ['assault', 'commando', 'scout', 'scout'],  // 100+90+70+70 = 330 (134 dmg)
            ['commando', 'commando', 'commando'],       // 90+90+90 = 270 (150 dmg)
            ['assault', 'assault', 'scout', 'scout'],   // 100+100+70+70 = 340 (124 dmg)
            ['sniper', 'scout', 'scout', 'medic'],      // 110+70+70+80 = 330 (124 dmg + heal)
            // NEW with 400 budget:
            ['assault', 'commando', 'commando', 'scout'], // 100+90+90+70 = 350 (162 dmg)
            ['commando', 'commando', 'commando', 'medic'], // 90+90+90+80 = 350 (165 dmg + heal)
            ['assault', 'assault', 'commando', 'scout'],  // 100+100+90+70 = 360 (152 dmg)
        ],
        weight: 0.7
    },
    // === DEFENSIVE - Only if needed ===
    defensive: {
        name: 'Defender',
        description: 'Verteidigung mit Fernkampf-Überlegenheit',
        compositions: [
            ['sniper', 'sniper', 'medic'],              // 110+110+80 = 300 (145 dmg + heal)
            ['sniper', 'assault', 'medic'],             // 110+100+80 = 290 (120 dmg + heal)
            ['elitesoldat', 'medic', 'commando'],       // 150+80+90 = 320 (105 dmg + heal)
            ['assault', 'medic', 'medic', 'scout'],     // 100+80+80+70 = 330 (77 dmg + 2x heal)
            // NEW with 400 budget:
            ['sniper', 'sniper', 'medic', 'scout'],     // 110+110+80+70 = 370 (167 dmg + heal)
            ['sniper', 'assault', 'medic', 'medic'],    // 110+100+80+80 = 370 (120 dmg + 2x heal)
        ],
        weight: 0.5  // LOW weight - KI soll angreifen!
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
 * Returns unitKeys (classKey:variantKey format)
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

    // Convert to unitKey format and potentially upgrade to variants
    // AI has 30% chance to use a variant if budget allows
    const unitKeysTeam = selectedTeam.map(classKey => {
        const variants = UNIT_VARIANTS[classKey];
        if (!variants || Math.random() > 0.3) {
            return `${classKey}:standard`;
        }

        // Get available variant keys (excluding standard)
        const variantKeys = Object.keys(variants).filter(k => k !== 'standard');
        if (variantKeys.length === 0) {
            return `${classKey}:standard`;
        }

        // Pick a random variant
        const variantKey = variantKeys[Math.floor(Math.random() * variantKeys.length)];
        return `${classKey}:${variantKey}`;
    });

    // Check if the team with variants is still within budget
    const totalCost = unitKeysTeam.reduce((sum, unitKey) => sum + getUnitCost(unitKey), 0);
    if (totalCost > CONFIG.TEAM_BUDGET) {
        // Fall back to standard variants
        const standardTeam = selectedTeam.map(classKey => `${classKey}:standard`);
        console.log(`[AI] ${selectedPersonality.name}: ${standardTeam.join(', ')} (${calculateTeamCost(selectedTeam)}/${CONFIG.TEAM_BUDGET})`);
        return standardTeam;
    }

    // Log AI team selection for debugging
    console.log(`[AI] ${selectedPersonality.name}: ${unitKeysTeam.join(', ')} (${totalCost}/${CONFIG.TEAM_BUDGET})`);

    return unitKeysTeam;
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
function canAddUnit(unitKey) {
    const cost = getUnitCost(unitKey);
    if (cost === 0) return false;

    const newCost = currentBudgetSpent + cost;
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

    // Update header - Both legacy and shop-style
    const badge = document.getElementById('team-select-badge');
    const playerNum = document.getElementById('team-select-player');
    const hint = document.querySelector('.team-select-hint');

    const playerColor = CONFIG.PLAYER_COLORS[playerIndex];
    const playerName = getPlayerName(playerIndex);

    if (badge) {
        badge.style.backgroundColor = playerColor;
        badge.style.boxShadow = `0 0 15px ${playerColor}`;
        badge.textContent = playerIndex + 1;
    }
    if (playerNum) {
        playerNum.textContent = playerName;
    }
    if (hint) {
        hint.textContent = `${playerName}: Stelle dein Team zusammen`;
    }

    // Update shop budget max
    const shopBudget = document.getElementById('shop-budget');
    if (shopBudget) {
        const maxEl = shopBudget.querySelector('.budget-max');
        if (maxEl) maxEl.textContent = CONFIG.TEAM_BUDGET;
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
 * Update confirm button state - Shop Style
 */
function updateConfirmButton() {
    const confirmBtn = document.getElementById('team-confirm-btn');
    if (confirmBtn) {
        const isValid = currentPlayerSelection.length >= CONFIG.MIN_UNITS &&
                       currentPlayerSelection.length <= CONFIG.MAX_UNITS &&
                       currentBudgetSpent <= CONFIG.TEAM_BUDGET;
        confirmBtn.disabled = !isValid;

        // Compact button text for shop style
        if (isValid) {
            confirmBtn.textContent = `Los! (${currentPlayerSelection.length})`;
        } else if (currentPlayerSelection.length < CONFIG.MIN_UNITS) {
            const needed = CONFIG.MIN_UNITS - currentPlayerSelection.length;
            confirmBtn.textContent = `+${needed}`;
        } else {
            confirmBtn.textContent = '💰!';
        }
    }
}

/**
 * Generate unit selection cards - Shop Style with Sprite Preview
 * Redesigned with explicit +/- cart controls and VARIANTS
 */
function generateUnitCards() {
    const grid = document.getElementById('team-select-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Generate grouped cards for each class
    Object.entries(UNIT_CLASSES).forEach(([classKey, baseClassData]) => {
        const variants = UNIT_VARIANTS[classKey] || { standard: { name: baseClassData.name, badge: null, costMod: 0, statMods: {} } };

        // Check if this is an elite unit (has special dual-attack capability)
        const isElite = baseClassData.canMelee && baseClassData.canRanged;

        // Create group container
        const group = document.createElement('div');
        group.className = 'unit-class-group';
        group.dataset.class = classKey;

        // Create group header with class name
        const header = document.createElement('div');
        header.className = 'unit-class-header';
        header.innerHTML = `
            <span class="class-icon">${baseClassData.icon}</span>
            <span class="class-name">${baseClassData.name}</span>
            ${isElite ? '<span class="elite-tag">ELITE</span>' : ''}
        `;
        group.appendChild(header);

        // Create variants container
        const variantsContainer = document.createElement('div');
        variantsContainer.className = 'unit-variants-row';

        Object.entries(variants).forEach(([variantKey, variantData]) => {
            // Get modified stats for this variant
            const unitData = getUnitWithVariant(classKey, variantKey);
            const unitKey = `${classKey}:${variantKey}`;

            const card = document.createElement('div');
            card.className = 'unit-card';
            if (variantKey !== 'standard') {
                card.classList.add('variant-card');
            }
            card.dataset.class = classKey;
            card.dataset.variant = variantKey;
            card.dataset.unitKey = unitKey;
            card.dataset.cost = unitData.cost;

            // Determine cost category for styling
            let costCategory = 'normal';
            if (unitData.cost >= 140) costCategory = 'expensive';
            else if (unitData.cost <= 80) costCategory = 'cheap';

            // Get player color for glow effect
            const playerColor = CONFIG.PLAYER_COLORS[currentTeamSelectPlayer] || '#22c55e';

            // Build variant badge HTML
            const variantBadgeHtml = variantData.badge
                ? `<div class="variant-badge" style="--badge-color: ${variantData.badgeColor || '#fff'}">${variantData.badge}</div>`
                : '';

            // Build bonus description - shorter for grouped layout
            const bonusHtml = variantData.bonusDesc
                ? `<div class="variant-bonus">${variantData.bonusDesc}</div>`
                : '';

            // Compact card layout for grouped view
            card.innerHTML = `
                ${variantBadgeHtml}
                <button class="card-info-btn" data-unit-key="${unitKey}" title="Details anzeigen">i</button>
                <div class="unit-sprite-container">
                    <div class="unit-sprite-glow" style="--player-color: ${playerColor}40;"></div>
                    <canvas class="unit-sprite-canvas" width="104" height="104" data-class="${classKey}"></canvas>
                </div>
                <div class="card-header">
                    <div class="unit-name">${variantKey === 'standard' ? 'Standard' : variantData.name || unitData.name}</div>
                    <div class="unit-cost cost-${costCategory}">${unitData.cost}💰</div>
                </div>
                <div class="unit-stats">
                    <span class="stat-item">❤️ ${unitData.hp}</span>
                    <span class="stat-item">⚔️ ${unitData.damage}</span>
                    <span class="stat-item">📍 ${unitData.move}</span>
                    <span class="stat-item">🎯 ${unitData.range}</span>
                </div>
                ${bonusHtml}
                <div class="cart-controls">
                    <button class="cart-btn cart-remove" data-unit-key="${unitKey}" title="Entfernen">−</button>
                    <span class="cart-count" data-unit-key="${unitKey}">0</span>
                    <button class="cart-btn cart-add" data-unit-key="${unitKey}" title="Hinzufügen">+</button>
                </div>
            `;

            // Render sprite to canvas (use base class sprite)
            const canvas = card.querySelector('.unit-sprite-canvas');
            if (canvas) {
                renderUnitSpriteToCanvas(canvas, classKey, currentTeamSelectPlayer);
            }

            // Add button click = add one unit
            const addBtn = card.querySelector('.cart-add');
            if (addBtn) {
                addBtn.onclick = (e) => {
                    e.stopPropagation();
                    playClick();
                    addToCart(unitKey);
                };
            }

            // Remove button click = remove one unit
            const removeBtn = card.querySelector('.cart-remove');
            if (removeBtn) {
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    playClick();
                    removeFromCart(unitKey);
                };
            }

            // Card click (not on buttons) = show details
            card.onclick = (e) => {
                if (e.target.classList.contains('cart-btn') ||
                    e.target.classList.contains('cart-count') ||
                    e.target.classList.contains('card-info-btn')) return;
                playClick();
                showUnitDetails(unitKey);
            };

            // Info button click = show details
            const infoBtn = card.querySelector('.card-info-btn');
            if (infoBtn) {
                infoBtn.onclick = (e) => {
                    e.stopPropagation();
                    playClick();
                    showUnitDetails(unitKey);
                };
            }

            variantsContainer.appendChild(card);
        });

        group.appendChild(variantsContainer);
        grid.appendChild(group);
    });

    // Setup detail overlay close handlers
    setupDetailOverlay();
}

/**
 * Parse unit key into class and variant
 */
function parseUnitKey(unitKey) {
    if (!unitKey) return { classKey: null, variantKey: 'standard' };
    if (unitKey.includes(':')) {
        const [classKey, variantKey] = unitKey.split(':');
        return { classKey, variantKey: variantKey || 'standard' };
    }
    // Legacy: just class name without variant
    return { classKey: unitKey, variantKey: 'standard' };
}

/**
 * Get unit cost for a unitKey (class:variant)
 */
function getUnitCost(unitKey) {
    const { classKey, variantKey } = parseUnitKey(unitKey);
    const unitData = getUnitWithVariant(classKey, variantKey);
    return unitData ? unitData.cost : 0;
}

/**
 * Add one unit to cart (supports unitKey format class:variant)
 */
function addToCart(unitKey) {
    const { classKey, variantKey } = parseUnitKey(unitKey);
    const unitData = getUnitWithVariant(classKey, variantKey);
    if (!unitData) return;

    if (canAddUnit(unitKey)) {
        currentPlayerSelection.push(unitKey);
        currentBudgetSpent += unitData.cost;
        updateCardSelectionState();
        updateTeamPreview();
        updateBudgetDisplay();
        updateConfirmButton();
    } else if (currentPlayerSelection.length >= CONFIG.MAX_UNITS) {
        import('./ui.js').then(ui => ui.showToast(`Maximum ${CONFIG.MAX_UNITS} Einheiten!`, 'error'));
    } else {
        import('./ui.js').then(ui => ui.showToast('Nicht genug Budget!', 'error'));
    }
}

/**
 * Remove one unit from cart by unitKey (class:variant)
 */
function removeFromCart(unitKey) {
    const index = currentPlayerSelection.lastIndexOf(unitKey);
    if (index !== -1) {
        const cost = getUnitCost(unitKey);
        currentBudgetSpent -= cost;
        currentPlayerSelection.splice(index, 1);
        updateCardSelectionState();
        updateTeamPreview();
        updateBudgetDisplay();
        updateConfirmButton();
    }
}

/**
 * Render a unit sprite to a canvas element for shop preview
 */
function renderUnitSpriteToCanvas(canvas, classKey, playerIndex) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const playerColor = CONFIG.PLAYER_COLORS[playerIndex] || '#22c55e';

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Try to get sprite
    const sprite = getUnitSprite(classKey, playerIndex, 'normal');

    if (sprite) {
        // Calculate drawing dimensions (maintain aspect ratio)
        const maxSize = Math.min(width, height) * 0.85;
        const aspectRatio = sprite.width / sprite.height;
        let drawWidth, drawHeight;

        if (aspectRatio > 1) {
            drawWidth = maxSize;
            drawHeight = maxSize / aspectRatio;
        } else {
            drawHeight = maxSize;
            drawWidth = maxSize * aspectRatio;
        }

        // Position using anchor point - center horizontally, place at bottom
        const drawX = (width - drawWidth) / 2;
        const drawY = height - drawHeight - 4; // 4px padding from bottom

        // Draw subtle glow effect
        ctx.save();
        ctx.shadowColor = playerColor;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(sprite, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();

        // Draw the actual sprite
        ctx.drawImage(sprite, drawX, drawY, drawWidth, drawHeight);
    } else {
        // Fallback: Draw unit icon from config
        const classData = UNIT_CLASSES[classKey];
        if (classData && classData.icon) {
            ctx.font = '36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(classData.icon, width / 2, height / 2);
        }
    }
}

/**
 * Playstyle descriptions for each unit class
 */
const UNIT_PLAYSTYLES = {
    scout: 'Ideal für Aufklärung und Flankenmanöver. Nutze die hohe Bewegungsreichweite, um Feinde zu umgehen und ungeschützte Ziele anzugreifen. Sprint ermöglicht schnelle Repositionierung oder Flucht.',
    assault: 'Der Frontkämpfer. Hohe HP erlauben es, Schaden einzustecken während du dich dem Feind näherst. Powershot ist perfekt, um schwer gepanzerte Ziele oder Gruppen zu eliminieren.',
    medic: 'Halte dich hinter der Front und heile verwundete Verbündete. Die Gruppenheilung kann Kämpfe wenden. Vermeide direkte Konfrontation - der Sanitäter ist das wertvollste Teammitglied.',
    sniper: 'Positioniere dich auf erhöhtem Gelände mit guter Sicht. Tarnung erlaubt sichere Repositionierung oder Hinterhalte. Vermeide Nahkampf um jeden Preis - der Scharfschütze stirbt schnell.',
    commando: 'Infiltrator und Assassine. Nutze Stealth, um unbemerkt in Angriffsposition zu kommen. Der Nahkampf-Bonus macht den Kommando tödlich im Nahkampf. Ideal für Überraschungsangriffe.',
    elitesoldat: 'Vielseitig einsetzbar - effektiv auf jede Distanz. Der taktische Modus erhöht Präzision UND Bewegung. Teuer, aber kann mehrere Rollen im Team erfüllen.'
};

/**
 * Show unit detail overlay with cart controls
 * Now supports unitKey format (classKey:variantKey)
 */
function showUnitDetails(unitKey) {
    const { classKey, variantKey } = parseUnitKey(unitKey);
    const baseClassData = UNIT_CLASSES[classKey];
    const unitData = getUnitWithVariant(classKey, variantKey);
    if (!unitData || !baseClassData) return;

    const overlay = document.getElementById('shop-detail-overlay');
    if (!overlay) return;

    // Store current unitKey for cart operations
    overlay.dataset.currentClass = unitKey;

    const variantData = unitData.variantData;

    // Populate detail panel
    document.getElementById('detail-icon').textContent = baseClassData.icon;

    // Show variant badge in name if applicable
    const nameEl = document.getElementById('detail-name');
    if (variantData && variantData.badge) {
        nameEl.innerHTML = `<span class="detail-variant-badge" style="color: ${variantData.badgeColor}">${variantData.badge}</span> ${unitData.name}`;
    } else {
        nameEl.textContent = unitData.name;
    }

    document.getElementById('detail-cost').textContent = `${unitData.cost} 💰`;

    // Stats grid - show modified stats
    const statsEl = document.getElementById('detail-stats');
    statsEl.innerHTML = `
        <div class="shop-detail-stat">
            <span class="stat-icon">❤️</span>
            <span class="stat-label">Leben</span>
            <span class="stat-value">${unitData.hp}</span>
        </div>
        <div class="shop-detail-stat">
            <span class="stat-icon">⚔️</span>
            <span class="stat-label">Schaden</span>
            <span class="stat-value">${unitData.damage}</span>
        </div>
        <div class="shop-detail-stat">
            <span class="stat-icon">📍</span>
            <span class="stat-label">Bewegung</span>
            <span class="stat-value">${unitData.move}</span>
        </div>
        <div class="shop-detail-stat">
            <span class="stat-icon">🎯</span>
            <span class="stat-label">Reichweite</span>
            <span class="stat-value">${unitData.range}</span>
        </div>
        ${unitData.meleeBonus ? `
        <div class="shop-detail-stat">
            <span class="stat-icon">🗡️</span>
            <span class="stat-label">Nahkampf</span>
            <span class="stat-value">+${unitData.meleeBonus}</span>
        </div>
        ` : ''}
        <div class="shop-detail-stat">
            <span class="stat-icon">👁️</span>
            <span class="stat-label">Sicht</span>
            <span class="stat-value">${unitData.vision}</span>
        </div>
    `;

    // Special ability
    let specialText = baseClassData.special;
    if (variantData && variantData.bonusAbility) {
        specialText += ` + ${variantData.bonusAbility}`;
    }
    document.getElementById('detail-special-desc').textContent = specialText;

    // Playstyle - add variant bonus description
    let playstyleText = UNIT_PLAYSTYLES[classKey] || 'Keine Beschreibung verfügbar.';
    if (variantData && variantData.bonusDesc) {
        playstyleText = `<strong>Bonus:</strong> ${variantData.bonusDesc}<br><br>${playstyleText}`;
    }
    document.getElementById('detail-playstyle').innerHTML = playstyleText;

    // Update cart controls in detail view
    updateDetailCartControls(unitKey);

    // Show overlay
    overlay.classList.add('visible');
}

/**
 * Update cart controls in detail overlay
 * Now uses unitKey format
 */
function updateDetailCartControls(unitKey) {
    const count = currentPlayerSelection.filter(c => c === unitKey).length;
    const cost = getUnitCost(unitKey);
    const remaining = CONFIG.TEAM_BUDGET - currentBudgetSpent;
    const canAdd = cost > 0 && cost <= remaining && currentPlayerSelection.length < CONFIG.MAX_UNITS;

    // Update count display
    const countEl = document.getElementById('detail-cart-count');
    if (countEl) {
        countEl.textContent = count;
        countEl.classList.toggle('has-items', count > 0);
    }

    // Update button states
    const removeBtn = document.getElementById('detail-cart-remove');
    const addBtn = document.getElementById('detail-cart-add');

    if (removeBtn) {
        removeBtn.disabled = count === 0;
        removeBtn.classList.toggle('disabled', count === 0);
    }
    if (addBtn) {
        addBtn.disabled = !canAdd;
        addBtn.classList.toggle('disabled', !canAdd);
    }
}

/**
 * Hide unit detail overlay
 */
function hideUnitDetails() {
    const overlay = document.getElementById('shop-detail-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

/**
 * Setup detail overlay event handlers
 */
function setupDetailOverlay() {
    const overlay = document.getElementById('shop-detail-overlay');
    const closeBtn = document.getElementById('shop-detail-close');

    if (closeBtn) {
        closeBtn.onclick = () => {
            playClick();
            hideUnitDetails();
        };
    }

    // Click outside panel to close
    if (overlay) {
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                hideUnitDetails();
            }
        };
    }

    // Cart controls in detail view
    const detailAddBtn = document.getElementById('detail-cart-add');
    const detailRemoveBtn = document.getElementById('detail-cart-remove');

    if (detailAddBtn) {
        detailAddBtn.onclick = (e) => {
            e.stopPropagation();
            playClick();
            const classKey = overlay?.dataset.currentClass;
            if (classKey) {
                addToCart(classKey);
                updateDetailCartControls(classKey);
            }
        };
    }

    if (detailRemoveBtn) {
        detailRemoveBtn.onclick = (e) => {
            e.stopPropagation();
            playClick();
            const classKey = overlay?.dataset.currentClass;
            if (classKey) {
                removeFromCart(classKey);
                updateDetailCartControls(classKey);
            }
        };
    }
}

/**
 * Update budget display - Shop Style
 */
function updateBudgetDisplay() {
    // Update Shop-Style budget display
    const shopBudget = document.getElementById('shop-budget');
    if (shopBudget) {
        const currentEl = shopBudget.querySelector('.budget-current');
        const maxEl = shopBudget.querySelector('.budget-max');
        if (currentEl) currentEl.textContent = currentBudgetSpent;
        if (maxEl) maxEl.textContent = CONFIG.TEAM_BUDGET;

        // Visual feedback for budget status
        const remaining = CONFIG.TEAM_BUDGET - currentBudgetSpent;
        shopBudget.classList.remove('budget-warning', 'budget-over');
        if (remaining < 70) shopBudget.classList.add('budget-warning');
        if (remaining < 0) shopBudget.classList.add('budget-over');
    }

    // Legacy support for old budget display
    let budgetDisplay = document.getElementById('budget-display');
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
 * Update visual selection state of cards and cart controls
 * Now uses unitKey format (classKey:variantKey)
 */
function updateCardSelectionState() {
    const cards = document.querySelectorAll('.unit-card');
    cards.forEach(card => {
        const unitKey = card.dataset.unitKey;
        const count = currentPlayerSelection.filter(c => c === unitKey).length;
        const cost = getUnitCost(unitKey);

        card.classList.toggle('selected', count > 0);

        // Check if unit is affordable
        const remaining = CONFIG.TEAM_BUDGET - currentBudgetSpent;
        const canAfford = cost > 0 && cost <= remaining && currentPlayerSelection.length < CONFIG.MAX_UNITS;
        card.classList.toggle('unaffordable', !canAfford && count === 0);

        // Update cart count display
        const cartCount = card.querySelector('.cart-count');
        if (cartCount) {
            cartCount.textContent = count;
            cartCount.classList.toggle('has-items', count > 0);
        }

        // Update button states
        const removeBtn = card.querySelector('.cart-remove');
        const addBtn = card.querySelector('.cart-add');
        if (removeBtn) {
            removeBtn.disabled = count === 0;
            removeBtn.classList.toggle('disabled', count === 0);
        }
        if (addBtn) {
            addBtn.disabled = !canAfford;
            addBtn.classList.toggle('disabled', !canAfford);
        }

        // Keep legacy count badge for visual feedback (optional)
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
 * Update team preview slots with sprite canvases
 * Now uses unitKey format (classKey:variantKey)
 */
function updateTeamPreview() {
    const previewContainer = document.getElementById('team-preview-units');
    if (!previewContainer) return;

    // Clear existing slots
    previewContainer.innerHTML = '';

    // Create slots for selected units with sprite preview
    currentPlayerSelection.forEach((unitKey, index) => {
        const { classKey, variantKey } = parseUnitKey(unitKey);
        const unitData = getUnitWithVariant(classKey, variantKey);
        const variantData = unitData?.variantData;

        const slot = document.createElement('div');
        slot.className = 'team-slot filled';

        // Create canvas for sprite
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 80;
        canvas.className = 'team-slot-canvas';
        slot.appendChild(canvas);

        // Add variant badge if not standard
        if (variantData && variantData.badge) {
            const badge = document.createElement('div');
            badge.className = 'slot-variant-badge';
            badge.textContent = variantData.badge;
            badge.style.color = variantData.badgeColor || '#fff';
            slot.appendChild(badge);
        }

        // Render sprite (use base class sprite)
        renderTeamSlotSprite(canvas, classKey, currentTeamSelectPlayer);

        slot.style.cursor = 'pointer';
        slot.onclick = () => removeFromSelection(index);
        slot.title = `${unitData?.name || classKey} - Klicken zum Entfernen`;
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
 * Render sprite for team slot preview (smaller version)
 */
function renderTeamSlotSprite(canvas, classKey, playerIndex) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const sprite = getUnitSprite(classKey, playerIndex, 'normal');

    if (sprite) {
        const maxSize = Math.min(width, height) * 0.9;
        const aspectRatio = sprite.width / sprite.height;
        let drawWidth, drawHeight;

        if (aspectRatio > 1) {
            drawWidth = maxSize;
            drawHeight = maxSize / aspectRatio;
        } else {
            drawHeight = maxSize;
            drawWidth = maxSize * aspectRatio;
        }

        const drawX = (width - drawWidth) / 2;
        const drawY = height - drawHeight - 2;

        ctx.drawImage(sprite, drawX, drawY, drawWidth, drawHeight);
    } else {
        // Fallback: icon
        const classData = UNIT_CLASSES[classKey];
        if (classData && classData.icon) {
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(classData.icon, width / 2, height / 2);
        }
    }
}

/**
 * Remove unit from selection by index
 */
function removeFromSelection(index) {
    const unitKey = currentPlayerSelection[index];
    if (!unitKey) return;

    // Use the same cost calculation as removeFromCart (supports variants)
    const cost = getUnitCost(unitKey);
    currentBudgetSpent -= cost;

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

    // Reset camera and zoom to defaults
    state.cameraX = 0;
    state.cameraY = 0;
    state.zoomLevel = ZOOM_REFERENCE;
    state.hexSize = CONFIG.BASE_HEX_SIZE;  // Reset to base size (will be recalculated by resizeCanvas)

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
            logInfo('Canvas bereit', `${canvas.width}x${canvas.height}, hexSize: ${state.hexSize}`);
            callback();
        } else if (attempts < maxAttempts) {
            setTimeout(check, 50);
        } else {
            // Fallback: start anyway after max attempts (1 second)
            logError('Canvas nicht bereit nach max. Versuchen', `width: ${canvas?.width}, height: ${canvas?.height}`);
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
 * Setup wizard navigation buttons
 */
function setupWizardNavigation() {
    // Wizard Map - Back to Menu
    const wizardMapBack = document.getElementById('wizard-map-back');
    if (wizardMapBack) {
        wizardMapBack.onclick = () => {
            playClick();
            showScreen('menu');
        };
    }

    // Wizard Map - Next to Players
    const wizardMapNext = document.getElementById('wizard-map-next');
    if (wizardMapNext) {
        wizardMapNext.onclick = () => {
            playClick();
            showScreen('wizard-players');
        };
    }

    // Wizard Players - Back to Map
    const wizardPlayersBack = document.getElementById('wizard-players-back');
    if (wizardPlayersBack) {
        wizardPlayersBack.onclick = () => {
            playClick();
            showScreen('wizard-map');
            setTimeout(() => updateMapPreview(), 100);
        };
    }

    // Wizard Players - Next to Team Selection
    const wizardPlayersNext = document.getElementById('wizard-players-next');
    if (wizardPlayersNext) {
        wizardPlayersNext.onclick = () => {
            playClick();
            startTeamSelection();
        };
    }
}

/**
 * Update map preview in wizard
 * Generates the actual game map and renders it as preview
 */
function updateMapPreview() {
    const canvas = document.getElementById('map-preview-canvas');
    const overlay = document.getElementById('map-preview-overlay');
    if (!canvas) return;

    // Show loading overlay
    if (overlay) overlay.classList.remove('hidden');

    // Debounce preview generation
    if (mapPreviewTimeout) {
        clearTimeout(mapPreviewTimeout);
    }

    mapPreviewTimeout = setTimeout(() => {
        // Generate a new random seed for this map
        state.mapSeed = Math.floor(Math.random() * 100000);

        // Generate the ACTUAL game map (this is what will be played)
        generateMap();

        // Render preview using the generated map
        renderMapPreview(canvas, overlay);
    }, 150);
}

/**
 * Render the map preview on canvas
 * Uses the actual game map (state.hexes) for accurate preview
 */
function renderMapPreview(canvas, overlay) {
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    // Set canvas size based on container
    const size = Math.min(container.clientWidth, container.clientHeight) || 300;
    canvas.width = size * window.devicePixelRatio;
    canvas.height = size * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Use the actual game map (already generated in updateMapPreview)
    const hexes = state.hexes;
    if (!hexes || hexes.length === 0) {
        // Fallback if map not yet generated
        if (overlay) overlay.classList.add('hidden');
        return;
    }

    // Calculate hex size for preview based on map radius
    const radius = CONFIG.MAP_SIZES[state.settings.size] || 8;
    const previewHexSize = (size * 0.4) / (radius + 1);

    // Clear and fill background
    ctx.fillStyle = '#0c0c1d';
    ctx.fillRect(0, 0, size, size);

    // Center offset
    const centerX = size / 2;
    const centerY = size / 2;

    // Draw hexes using terrain color (like minimap)
    for (const hex of hexes) {
        const x = centerX + hex.q * previewHexSize * 1.5;
        const y = centerY + (hex.r + hex.q * 0.5) * previewHexSize * Math.sqrt(3);

        // Use terrain color directly (consistent with minimap)
        const terrain = TERRAIN[hex.type];
        const color = terrain ? terrain.color : '#1a1a3e';

        // Draw hex
        drawPreviewHex(ctx, x, y, previewHexSize * 0.95, color);
    }

    // Hide loading overlay
    if (overlay) overlay.classList.add('hidden');
}

/**
 * Draw a single hex for preview
 */
function drawPreviewHex(ctx, x, y, size, color) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i - Math.PI / 6;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(hx, hy);
        } else {
            ctx.lineTo(hx, hy);
        }
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
}

/**
 * Initialize the application
 */
async function init() {
    // Initialize error capture FIRST so we catch any loading errors
    initErrorCapture();

    // Show menu first to ensure it's visible while loading
    showScreen('menu');

    // Initialize asset loader (loads static assets if available)
    await initAssetLoader();

    if (isUsingStaticAssets()) {
        console.log('Using pre-generated static assets');
    } else {
        console.log('Using runtime-generated assets');
    }

    // Setup start button - now goes to wizard
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.onclick = () => {
            playClick();
            showScreen('wizard-map');
            // Trigger initial map preview
            setTimeout(() => updateMapPreview(), 100);
        };
    }

    // Setup options button
    const optionsBtn = document.getElementById('options-btn');
    if (optionsBtn) {
        optionsBtn.onclick = () => {
            playClick();
            showScreen('options-screen');
        };
    }

    // Setup options back button
    const optionsBackBtn = document.getElementById('options-back-btn');
    if (optionsBackBtn) {
        optionsBackBtn.onclick = () => {
            playClick();
            showScreen('menu');
        };
    }

    // Setup wizard navigation
    setupWizardNavigation();

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

            // Update map preview in wizard
            updateMapPreview();
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

            // Update map preview in wizard
            updateMapPreview();
        });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.click();
        });
    });

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

    // Setup debug log button
    const showLogBtn = document.getElementById('show-log-btn');
    if (showLogBtn) {
        showLogBtn.onclick = () => {
            playClick();
            showLogViewer();
        };

        // Update error count badge when errors occur
        addLogListener(() => {
            const count = getErrorCount();
            const badge = document.getElementById('error-count-badge');
            if (badge) {
                if (count > 0) {
                    badge.textContent = count;
                    badge.style.display = 'inline-flex';
                    showLogBtn.classList.add('has-errors');
                } else {
                    badge.style.display = 'none';
                    showLogBtn.classList.remove('has-errors');
                }
            }
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
            // Go back to previous player or wizard-players
            if (currentTeamSelectPlayer > 0) {
                // Go back to previous player's selection
                currentTeamSelectPlayer--;
                currentPlayerSelection = [...state.teamSelections[currentTeamSelectPlayer]];
                showTeamSelectForPlayer(currentTeamSelectPlayer);
            } else {
                // Go back to wizard-players step
                showScreen('wizard-players');
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

    // Mark app as fully initialized (used by E2E tests)
    document.body.dataset.appReady = 'true';

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
 * Update the player config grid based on current player count
 * Includes player names and AI/Human toggles
 */
function updateAIConfigGrid() {
    const grid = document.getElementById('player-config-grid') || document.getElementById('ai-config-grid');
    if (!grid) return;

    // Filter out AI players that are no longer valid (when player count reduced)
    state.settings.aiPlayers = state.settings.aiPlayers.filter(p => p < state.settings.players);

    // Initialize player names array if needed
    if (!state.settings.playerNames || state.settings.playerNames.length < state.settings.players) {
        const usedNames = state.settings.playerNames || [];
        state.settings.playerNames = [];
        for (let i = 0; i < state.settings.players; i++) {
            if (usedNames[i]) {
                state.settings.playerNames[i] = usedNames[i];
            } else {
                state.settings.playerNames[i] = getRandomName(state.settings.playerNames);
            }
        }
    }
    // Trim excess names if player count reduced
    state.settings.playerNames = state.settings.playerNames.slice(0, state.settings.players);

    grid.innerHTML = '';

    // Also update alliance section
    updateAllianceSection();

    for (let i = 0; i < state.settings.players; i++) {
        const item = document.createElement('div');
        item.className = 'player-config-item';

        // Player badge with number
        const badge = document.createElement('div');
        badge.className = 'player-badge';
        badge.style.backgroundColor = CONFIG.PLAYER_COLORS[i];
        badge.textContent = i + 1;

        // Name input with refresh button
        const nameContainer = document.createElement('div');
        nameContainer.className = 'player-name-container';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'player-name-input';
        nameInput.value = state.settings.playerNames[i] || '';
        nameInput.placeholder = `Spieler ${i + 1}`;
        nameInput.maxLength = 15;
        nameInput.dataset.player = i;

        nameInput.addEventListener('input', (e) => {
            const playerIndex = parseInt(e.target.dataset.player, 10);
            state.settings.playerNames[playerIndex] = e.target.value;
        });

        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'name-refresh-btn';
        refreshBtn.textContent = '🎲';
        refreshBtn.title = 'Zufälliger Name';
        refreshBtn.dataset.player = i;

        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const playerIndex = parseInt(e.target.closest('button').dataset.player, 10);
            const newName = getRandomName(state.settings.playerNames.filter((_, idx) => idx !== playerIndex));
            state.settings.playerNames[playerIndex] = newName;
            nameInput.value = newName;
            playClick();
        });

        nameContainer.appendChild(nameInput);
        nameContainer.appendChild(refreshBtn);

        // AI/Human toggle
        const isAI = state.settings.aiPlayers.includes(i);
        const toggle = document.createElement('button');
        toggle.className = `type-toggle ${isAI ? 'ai' : 'human'}`;
        toggle.textContent = isAI ? '🤖 KI' : '👤';
        toggle.title = isAI ? 'KI-Spieler' : 'Mensch';
        toggle.dataset.player = i;

        toggle.addEventListener('click', () => {
            const playerIndex = parseInt(toggle.dataset.player, 10);
            const isCurrentlyAI = state.settings.aiPlayers.includes(playerIndex);

            if (isCurrentlyAI) {
                // Remove from AI players
                state.settings.aiPlayers = state.settings.aiPlayers.filter(p => p !== playerIndex);
                toggle.className = 'type-toggle human';
                toggle.textContent = '👤';
                toggle.title = 'Mensch';
            } else {
                // Add to AI players
                state.settings.aiPlayers.push(playerIndex);
                toggle.className = 'type-toggle ai';
                toggle.textContent = '🤖 KI';
                toggle.title = 'KI-Spieler';
            }
            playClick();
        });

        item.appendChild(badge);
        item.appendChild(nameContainer);
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
