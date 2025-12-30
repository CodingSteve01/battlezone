// ===== ATTACK MINIGAMES =====
// Each unit class has a unique skill-based minigame that determines attack effectiveness
// Mit adaptivem Kontext-System für realistische Schwierigkeitsanpassung

import { UNIT_CLASSES, TERRAIN } from './config.js';
import { playClick, playTarget, playError } from './audio.js';
import { hexDistance } from './hexMath.js';

// === MINIGAME CONTEXT SYSTEM ===
// Kontextdaten die das Minigame beeinflussen

/**
 * @typedef {Object} MinigameContext
 * @property {number} distance - Hex-Distanz zum Ziel
 * @property {number} maxRange - Max Reichweite der Unit
 * @property {string} attackerTerrain - Terrain des Angreifers
 * @property {string} targetTerrain - Terrain des Ziels
 * @property {number} alliesInRange - Verbündete in 2 Hex Radius
 * @property {number} enemiesInRange - Feinde in 2 Hex Radius (Stress-Faktor)
 * @property {boolean} isAmbush - Aus Tarnung/Hinterhalt angreifend
 * @property {boolean} targetHiding - Ziel ist versteckt
 * @property {number} attackerHP - HP-Prozent des Angreifers
 * @property {number} targetHP - HP-Prozent des Ziels
 */

/**
 * Berechne Schwierigkeitsmodifikatoren basierend auf Kontext
 * @param {string} unitClass - Einheitsklasse
 * @param {MinigameContext} context - Kontextdaten
 * @returns {Object} Modifikatoren für das Minigame
 */
export function calculateDifficultyModifiers(unitClass, context) {
    if (!context) {
        return {
            speedMultiplier: 1.0,      // Geschwindigkeit bewegter Elemente
            zoneMultiplier: 1.0,       // Größe von Trefferzonen
            timeMultiplier: 1.0,       // Verfügbare Zeit
            extraChance: 0,            // Extra Erfolgs-Chance
            description: null          // Beschreibung für UI
        };
    }

    const mods = {
        speedMultiplier: 1.0,
        zoneMultiplier: 1.0,
        timeMultiplier: 1.0,
        extraChance: 0,
        description: null
    };

    // Distanz-Verhältnis (0 = nah, 1 = max Reichweite)
    const distanceRatio = context.maxRange > 0 ? context.distance / context.maxRange : 0;

    // === KLASSEN-SPEZIFISCHE MODIFIKATOREN ===

    switch (unitClass) {
        case 'scout':
            // Scout: Schnelle Reflexe, profitiert von Verbündeten (Ablenkung)
            // Nahkampf ist einfacher (größeres Ziel)
            if (distanceRatio < 0.3) {
                mods.zoneMultiplier = 1.3;  // 30% größeres Ziel bei kurzer Distanz
                mods.description = 'Nahes Ziel - leichter zu treffen';
            } else if (distanceRatio > 0.7) {
                mods.speedMultiplier = 1.3; // Ziel bewegt sich schneller bei weiter Distanz
                mods.zoneMultiplier = 0.8;
                mods.description = 'Weites Ziel - schneller & kleiner';
            }
            // Verbündete lenken Feind ab
            if (context.alliesInRange > 0) {
                mods.timeMultiplier = 1 + (context.alliesInRange * 0.15);
                mods.description = `Verbündete lenken ab (+${context.alliesInRange * 15}% Zeit)`;
            }
            break;

        case 'assault':
            // Assault: Unterdrückungsfeuer, Verbündete helfen
            if (distanceRatio > 0.8) {
                mods.zoneMultiplier = 0.7;  // Schwieriger auf Distanz
                mods.description = 'Maximale Reichweite - präzises Timing nötig';
            }
            // Hügel-Vorteil
            if (context.attackerTerrain === 'hills') {
                mods.zoneMultiplier *= 1.2;
                mods.description = 'Erhöhte Position - bessere Kontrolle';
            }
            // Verbündete: Unterdrückungsfeuer
            if (context.alliesInRange > 0) {
                mods.zoneMultiplier *= 1 + (context.alliesInRange * 0.1);
                mods.description = `Unterdrückungsfeuer (+${context.alliesInRange * 10}% Zone)`;
            }
            break;

        case 'sniper':
            // Sniper: Arbeitet ALLEINE, keine Ally-Boni!
            // Kurze Distanz ist SCHWIERIGER (Sniper braucht Abstand)
            if (distanceRatio < 0.4) {
                mods.speedMultiplier = 1.5;  // Mehr Wackeln bei Nahkampf
                mods.timeMultiplier = 0.8;   // Weniger Zeit zum Zielen
                mods.description = 'Zu nah! Schwer zu zielen';
            } else if (distanceRatio > 0.7) {
                // Optimale Sniper-Distanz
                mods.speedMultiplier = 0.85;
                mods.description = 'Optimale Schussdistanz';
            }
            // Hügel-Vorteil für Sniper
            if (context.attackerTerrain === 'hills') {
                mods.speedMultiplier *= 0.9;  // Ruhigere Hand
                mods.description = 'Erhöhte Position - stabiler';
            }
            // Stress bei vielen Feinden in der Nähe
            if (context.enemiesInRange > 1) {
                mods.speedMultiplier *= 1 + (context.enemiesInRange * 0.1);
                mods.description = 'Unter Druck - unruhige Hand!';
            }
            break;

        case 'medic':
            // Medic: Ruhiger wenn Verbündete beschützen
            // Stress bei niedrigen HP oder wenn alleine
            if (context.attackerHP < 0.5) {
                mods.speedMultiplier = 1.3;  // Schnellerer Puls bei niedrigen HP
                mods.description = 'Verletzt - erhöhter Puls!';
            }
            if (context.alliesInRange > 0) {
                mods.speedMultiplier *= 0.9;  // Ruhiger mit Schutz
                mods.timeMultiplier = 1.1;
                mods.description = 'Beschützt - ruhigerer Puls';
            }
            if (context.alliesInRange === 0 && context.enemiesInRange > 0) {
                mods.speedMultiplier = 1.4;  // Panik wenn alleine mit Feinden
                mods.description = 'Alleine unter Feinden!';
            }
            break;

        case 'commando':
            // Commando: Nahkampf-Spezialist
            // Duell wird durch Kontext beeinflusst
            if (context.isAmbush) {
                mods.extraChance = 0.2;      // 20% extra Erfolgschance aus Hinterhalt
                mods.timeMultiplier = 1.3;   // Mehr Zeit für Reaktion
                mods.description = 'Überraschungsangriff!';
            }
            if (context.alliesInRange > 0) {
                mods.extraChance += context.alliesInRange * 0.1;
                mods.description = `Verbündete lenken ab (+${context.alliesInRange * 10}% Chance)`;
            }
            // Feind versteckt = schwieriger
            if (context.targetHiding) {
                mods.timeMultiplier = 0.85;
                mods.description = 'Feind in Deckung!';
            }
            break;
        
        case 'elitesoldat':
            // Kommando-Soldat: Vielseitig - passt sich an Situation an
            // Im Nahkampf (distance = 1): wie Commando
            // Im Fernkampf: wie Assault aber stabiler
            if (context.distance === 1) {
                // Nahkampf: Wie Commando
                if (context.isAmbush) {
                    mods.extraChance = 0.15;     // Elite ist gut, aber nicht ganz so stark wie Commando
                    mods.timeMultiplier = 1.2;
                    mods.description = 'Nahkampf-Überraschung!';
                }
                if (context.alliesInRange > 0) {
                    mods.extraChance += context.alliesInRange * 0.08;
                    mods.description = `Taktische Unterstützung (+${context.alliesInRange * 8}% Chance)`;
                }
            } else {
                // Fernkampf: Wie Assault aber mit Elite-Bonus
                mods.zoneMultiplier = 1.1;       // Elite ist präziser
                if (context.alliesInRange > 0) {
                    mods.zoneMultiplier += context.alliesInRange * 0.05;
                    mods.description = `Koordinierter Angriff (+${context.alliesInRange * 5}%)`;
                }
                if (context.attackerHP < 0.3) {
                    mods.speedMultiplier = 1.2;  // Auch Eliten geraten unter Druck
                    mods.description = 'Kritischer Zustand!';
                }
            }
            break;
    }

    // === TERRAIN-EFFEKTE ===
    if (context.targetTerrain === 'forest' && unitClass !== 'commando' && unitClass !== 'elitesoldat') {
        mods.zoneMultiplier *= 0.85;  // Wald versteckt das Ziel leicht
    }

    return mods;
}

// Minigame result levels
export const RESULT_LEVELS = {
    PERFECT: 'perfect',   // 100% damage + crit chance bonus + guaranteed hit
    GOOD: 'good',         // 100% damage + high hit chance
    OKAY: 'okay',         // 70% damage
    MISS: 'miss'          // 30% damage
};

// Result multipliers for damage and hit chance
export const RESULT_MULTIPLIERS = {
    [RESULT_LEVELS.PERFECT]: { damage: 1.0, critBonus: 0.25, hitBonus: 1.0, label: 'PERFEKT!', color: '#ffd700' },
    [RESULT_LEVELS.GOOD]: { damage: 1.0, critBonus: 0, hitBonus: 0.15, label: 'GUT!', color: '#22c55e' },
    [RESULT_LEVELS.OKAY]: { damage: 0.7, critBonus: 0, hitBonus: 0, label: 'OK', color: '#f59e0b' },
    [RESULT_LEVELS.MISS]: { damage: 0.3, critBonus: 0, hitBonus: -0.2, label: 'DANEBEN', color: '#ef4444' }
};

// Current active minigame state
let activeMinigame = null;
let minigameOverlay = null;
let minigameCanvas = null;
let minigameCtx = null;
let animationFrameId = null;

// Anti-cheat: Tap cooldown tracking
let lastTapTime = 0;
const TAP_COOLDOWN_MS = 120; // Minimum ms between taps to prevent spam

/**
 * Anti-cheat tap validator - returns true if tap is valid (not spam)
 */
function isValidTap() {
    const now = Date.now();
    if (now - lastTapTime < TAP_COOLDOWN_MS) {
        return false; // Too fast, ignore tap
    }
    lastTapTime = now;
    return true;
}

/**
 * Initialize the minigame overlay (called once on game start)
 */
export function initMinigames() {
    // Create overlay if it doesn't exist
    if (!document.getElementById('minigame-overlay')) {
        createMinigameOverlay();
    }
    minigameOverlay = document.getElementById('minigame-overlay');
    minigameCanvas = document.getElementById('minigame-canvas');
    minigameCtx = minigameCanvas?.getContext('2d');
}

// Unit-specific minigame descriptions with detailed explanations
const MINIGAME_DESCRIPTIONS = {
    scout: {
        title: 'Schnellfeuer',
        instruction: 'Tippe das bewegliche Ziel!',
        hint: 'Je näher am Zentrum, desto besser!',
        detailedExplanation: 'Ein rotes Ziel bewegt sich über den Bildschirm.\n\nTippe darauf, um zu treffen!\n\n💎 Perfekt = Mitte des Ziels\n✅ Gut = Nahe am Zentrum\n⚠️ OK = Rand des Ziels'
    },
    assault: {
        title: 'Powerschuss',
        instruction: 'Stoppe im grünen Bereich!',
        hint: 'Gold = Perfekt, Grün = Gut',
        detailedExplanation: 'Ein Balken bewegt sich hin und her.\n\nTippe, um ihn zu stoppen!\n\n💎 Gold-Zone = Perfekter Treffer\n✅ Grüne Zone = Guter Treffer\n🟠 Orange Zone = OK\n❌ Roter Rand = Daneben'
    },
    sniper: {
        title: 'Präzisionsschuss',
        instruction: 'Schieße wenn das Fadenkreuz still steht!',
        hint: 'Warte auf den grünen Moment!',
        detailedExplanation: 'Das Fadenkreuz wackelt ständig.\n\nWarte auf den "stillen Moment"!\n\n🔴 Rot = Wackelt - NICHT schießen!\n🟡 Gelb = Gleich ruhig...\n🟢 Grün = JETZT schießen!'
    },
    medic: {
        title: 'Zielschuss',
        instruction: 'Stoppe im grünen Bereich!',
        hint: 'Medic greift mit Pistole an',
        detailedExplanation: 'Ein Balken bewegt sich hin und her.\n\nTippe, um ihn zu stoppen!\n\n💎 Goldene Zone = Perfekt\n✅ Grüne Zone = Gut'
    },
    commando: {
        title: 'Nahkampf-Duell',
        instruction: 'Reagiere auf den Feind!',
        hint: 'Stein-Schere-Papier Prinzip',
        detailedExplanation: 'Ein 3-Runden Duell!\n\n⚔️ ANGRIFF schlägt 💨 Ausweichen\n🛡️ BLOCK schlägt ⚔️ Angriff\n💨 AUSWEICHEN schlägt 🛡️ Block\n\nBeobachte den Feind und wähle die richtige Antwort!\n2 von 3 Runden gewinnen!'
    }
};

// Healing minigame description (separate from attack)
const HEALING_MINIGAME_DESC = {
    title: 'Heilungsrhythmus',
    instruction: 'Tippe im Rhythmus des Herzschlags!',
    hint: '4 Schläge im richtigen Timing',
    detailedExplanation: 'Eine EKG-Linie zeigt den Herzschlag.\n\n4 Herz-Symbole erscheinen nacheinander.\nTippe GENAU wenn sie aufleuchten!\n\n🟡 Gelb = JETZT tippen!\n✅ Grün = Getroffen!\n❌ Rot = Verpasst\n\nTreffe alle 4 für Perfekt!'
};

/**
 * Create the minigame overlay DOM elements
 */
function createMinigameOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'minigame-overlay';
    overlay.className = 'minigame-overlay';
    overlay.innerHTML = `
        <div class="minigame-container">
            <div class="minigame-header">
                <span class="minigame-icon" id="minigame-icon"></span>
                <span class="minigame-title" id="minigame-title">Angriff!</span>
            </div>
            <div class="minigame-instruction" id="minigame-instruction"></div>
            <div class="minigame-hint" id="minigame-hint"></div>
            <div class="minigame-explanation" id="minigame-explanation"></div>
            <div class="minigame-start-prompt" id="minigame-start-prompt">Tippe zum Starten</div>
            <div class="minigame-countdown" id="minigame-countdown"></div>
            <canvas id="minigame-canvas" width="300" height="200"></canvas>
            <div class="minigame-result" id="minigame-result"></div>
        </div>
    `;
    document.getElementById('app').appendChild(overlay);

    // Add styles
    addMinigameStyles();
}

/**
 * Add CSS styles for the minigame overlay
 */
function addMinigameStyles() {
    if (document.getElementById('minigame-styles')) return;

    const style = document.createElement('style');
    style.id = 'minigame-styles';
    style.textContent = `
        .minigame-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .minigame-overlay.active {
            display: flex;
            opacity: 1;
        }

        .minigame-container {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 2px solid #324363;
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            max-width: 340px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            animation: minigame-appear 0.3s ease;
        }

        @keyframes minigame-appear {
            from {
                transform: scale(0.8);
                opacity: 0;
            }
            to {
                transform: scale(1);
                opacity: 1;
            }
        }

        .minigame-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .minigame-icon {
            font-size: 32px;
        }

        .minigame-title {
            font-size: 24px;
            font-weight: bold;
            color: #fff;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .minigame-instruction {
            color: #fff;
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 8px;
            min-height: 20px;
        }

        .minigame-hint {
            color: #a0aec0;
            font-size: 13px;
            margin-bottom: 8px;
            min-height: 16px;
            font-style: italic;
        }

        .minigame-explanation {
            color: #e2e8f0;
            font-size: 14px;
            line-height: 1.5;
            margin: 12px 0;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            white-space: pre-line;
            text-align: left;
            display: none;
        }

        .minigame-explanation.visible {
            display: block;
        }

        .minigame-start-prompt {
            color: #22c55e;
            font-size: 18px;
            font-weight: bold;
            margin: 15px 0;
            padding: 12px 24px;
            border: 2px solid #22c55e;
            border-radius: 25px;
            display: none;
            animation: prompt-pulse 1.5s infinite;
            cursor: pointer;
        }

        .minigame-start-prompt.visible {
            display: inline-block;
        }

        @keyframes prompt-pulse {
            0%, 100% {
                opacity: 1;
                box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
            }
            50% {
                opacity: 0.7;
                box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
            }
        }

        .minigame-countdown {
            font-size: 48px;
            font-weight: bold;
            color: #fbbf24;
            text-shadow: 0 0 20px rgba(251, 191, 36, 0.5);
            min-height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: countdown-pulse 0.5s ease-in-out;
        }

        .minigame-countdown.hidden {
            display: none;
        }

        .minigame-countdown.go {
            color: #22c55e;
            text-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
        }

        @keyframes countdown-pulse {
            0% { transform: scale(1.5); opacity: 0; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }

        #minigame-canvas {
            background: #0d1117;
            border-radius: 8px;
            border: 1px solid #324363;
            touch-action: none;
            cursor: pointer;
        }

        .minigame-result {
            margin-top: 15px;
            font-size: 28px;
            font-weight: bold;
            min-height: 40px;
            opacity: 0;
            transform: scale(0.5);
            transition: all 0.3s ease;
        }

        .minigame-result.show {
            opacity: 1;
            transform: scale(1);
        }

        /* Scout: Reflex target styles */
        .minigame-target {
            position: absolute;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: radial-gradient(circle, #ef4444 0%, #b91c1c 100%);
            border: 3px solid #fff;
            cursor: pointer;
            animation: target-pulse 0.5s infinite;
        }

        @keyframes target-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        /* Swipe direction indicators */
        .swipe-arrow {
            font-size: 48px;
            color: #fff;
            text-shadow: 0 0 10px currentColor;
            animation: arrow-pulse 0.5s infinite;
        }

        @keyframes arrow-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show explanation and wait for user to tap to start
 * Returns a Promise that resolves when user taps
 */
function showExplanationAndWaitForStart(explanation) {
    return new Promise((resolve) => {
        const explanationEl = document.getElementById('minigame-explanation');
        const startPromptEl = document.getElementById('minigame-start-prompt');
        const countdownEl = document.getElementById('minigame-countdown');
        const canvasEl = document.getElementById('minigame-canvas');

        // Hide countdown and canvas, show explanation
        countdownEl.classList.add('hidden');
        canvasEl.style.display = 'none';

        explanationEl.textContent = explanation;
        explanationEl.classList.add('visible');
        startPromptEl.classList.add('visible');

        function handleStart(e) {
            if (e) e.preventDefault();

            // Clean up
            explanationEl.classList.remove('visible');
            startPromptEl.classList.remove('visible');
            startPromptEl.removeEventListener('click', handleStart);
            startPromptEl.removeEventListener('touchstart', handleStart);
            minigameOverlay.removeEventListener('click', handleOverlayClick);
            minigameOverlay.removeEventListener('touchstart', handleOverlayClick);

            playClick();
            resolve();
        }

        function handleOverlayClick(e) {
            // Allow tapping anywhere on overlay to start
            if (e.target === minigameOverlay || e.target.closest('.minigame-container')) {
                handleStart(e);
            }
        }

        // Allow both button click and anywhere tap
        startPromptEl.addEventListener('click', handleStart);
        startPromptEl.addEventListener('touchstart', handleStart);
        minigameOverlay.addEventListener('click', handleOverlayClick);
        minigameOverlay.addEventListener('touchstart', handleOverlayClick);
    });
}

/**
 * Show countdown before minigame starts
 * Returns a Promise that resolves when countdown is complete
 */
function showCountdown() {
    return new Promise((resolve) => {
        const countdownEl = document.getElementById('minigame-countdown');
        const canvasEl = document.getElementById('minigame-canvas');
        const explanationEl = document.getElementById('minigame-explanation');
        const startPromptEl = document.getElementById('minigame-start-prompt');

        // Hide canvas and explanation during countdown
        canvasEl.style.display = 'none';
        explanationEl.classList.remove('visible');
        startPromptEl.classList.remove('visible');
        countdownEl.classList.remove('hidden', 'go');

        const steps = ['3', '2', '1', 'LOS!'];
        let step = 0;

        function showStep() {
            if (step >= steps.length) {
                // Countdown complete
                countdownEl.classList.add('hidden');
                canvasEl.style.display = 'block';
                resolve();
                return;
            }

            countdownEl.textContent = steps[step];
            if (steps[step] === 'LOS!') {
                countdownEl.classList.add('go');
            }

            // Reset animation
            countdownEl.style.animation = 'none';
            countdownEl.offsetHeight; // Trigger reflow
            countdownEl.style.animation = 'countdown-pulse 0.5s ease-in-out';

            playClick();
            step++;
            setTimeout(showStep, step === steps.length ? 400 : 600);
        }

        showStep();
    });
}

// Aktuelle Kontext-Modifikatoren (global für aktives Minigame)
let currentModifiers = null;

/**
 * Start a minigame for the given unit class
 * Returns a Promise that resolves with the result
 * @param {string} unitClass - Die Einheitsklasse
 * @param {MinigameContext} context - Optionaler Kontext für adaptive Schwierigkeit
 */
export async function startMinigame(unitClass, context = null) {
    initMinigames();

    // Reset anti-cheat tap cooldown
    lastTapTime = 0;

    const classInfo = UNIT_CLASSES[unitClass];
    if (!classInfo) {
        return { level: RESULT_LEVELS.GOOD, multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD] };
    }

    // Berechne Schwierigkeitsmodifikatoren basierend auf Kontext
    currentModifiers = calculateDifficultyModifiers(unitClass, context);

    // Get minigame description
    const desc = MINIGAME_DESCRIPTIONS[unitClass] || {
        title: 'Angriff',
        instruction: 'Reagiere schnell!',
        hint: '',
        detailedExplanation: ''
    };

    // Show overlay with instructions
    minigameOverlay.classList.add('active');
    document.getElementById('minigame-icon').textContent = classInfo.icon;
    document.getElementById('minigame-title').textContent = desc.title;
    document.getElementById('minigame-instruction').textContent = desc.instruction;

    // Zeige Kontext-Hinweis wenn vorhanden
    const hintText = currentModifiers.description || desc.hint;
    document.getElementById('minigame-hint').textContent = hintText;
    if (currentModifiers.description) {
        document.getElementById('minigame-hint').style.color =
            currentModifiers.zoneMultiplier > 1 || currentModifiers.extraChance > 0
                ? '#22c55e'  // Grün für Vorteil
                : currentModifiers.speedMultiplier > 1.2
                    ? '#ef4444'  // Rot für Nachteil
                    : '#fbbf24'; // Gelb für neutral
    } else {
        document.getElementById('minigame-hint').style.color = '#a0aec0';
    }

    document.getElementById('minigame-result').classList.remove('show');
    document.getElementById('minigame-result').textContent = '';

    // Show detailed explanation and wait for tap to start
    if (desc.detailedExplanation) {
        await showExplanationAndWaitForStart(desc.detailedExplanation);
    }

    // Show countdown
    await showCountdown();

    // Start the appropriate minigame and return a Promise
    return new Promise((resolve) => {
        switch (unitClass) {
            case 'scout':
                startScoutMinigame(resolve, currentModifiers);
                break;
            case 'assault':
                startAssaultMinigame(resolve, currentModifiers);
                break;
            case 'sniper':
                startSniperMinigame(resolve, currentModifiers);
                break;
            case 'medic':
                // Medic greift wie normaler Soldat an - verwendet Assault-Minigame
                startAssaultMinigame(resolve, currentModifiers);
                break;
            case 'commando':
                startCommandoDuelMinigame(resolve, currentModifiers);
                break;
            case 'elitesoldat':
                // Kommando-Soldat: Dual-Mode basierend auf Distanz
                // Nahkampf (Distanz 1): Commando-Duell-Minigame
                // Fernkampf (Distanz > 1): Assault-Minigame
                if (context && context.distance === 1) {
                    // Nahkampf-Modus
                    startCommandoDuelMinigame(resolve, currentModifiers);
                } else {
                    // Fernkampf-Modus
                    startAssaultMinigame(resolve, currentModifiers);
                }
                break;
            default:
                // Unknown class - auto-resolve with GOOD
                finishMinigame(RESULT_LEVELS.GOOD, resolve);
        }
    });
}

/**
 * Clean up and close the minigame
 */
function finishMinigame(resultLevel, resolve) {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    const result = RESULT_MULTIPLIERS[resultLevel];

    // Show result
    const resultEl = document.getElementById('minigame-result');
    resultEl.textContent = result.label;
    resultEl.style.color = result.color;
    resultEl.classList.add('show');

    // Play sound based on result
    if (resultLevel === RESULT_LEVELS.PERFECT || resultLevel === RESULT_LEVELS.GOOD) {
        playTarget();
    } else if (resultLevel === RESULT_LEVELS.MISS) {
        playError();
    } else {
        playClick();
    }

    // Close after short delay
    setTimeout(() => {
        minigameOverlay.classList.remove('active');
        activeMinigame = null;

        // Remove event listeners
        minigameCanvas.onclick = null;
        minigameCanvas.ontouchstart = null;
        minigameCanvas.ontouchmove = null;
        minigameCanvas.ontouchend = null;

        resolve({ level: resultLevel, multiplier: result });
    }, 800);
}

// ===== SCOUT MINIGAME: Reflex Target =====
// A target appears and moves quickly - tap it before it disappears
// Adaptiv: Zielgröße und Geschwindigkeit basierend auf Kontext

function startScoutMinigame(resolve, mods = {}) {
    document.getElementById('minigame-instruction').textContent = 'Tippe das Ziel!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    // Adaptive Parameter
    const speedMult = mods.speedMultiplier || 1.0;
    const zoneMult = mods.zoneMultiplier || 1.0;
    const timeMult = mods.timeMultiplier || 1.0;

    let target = null;
    let startTime = 0;
    let gameActive = true;
    let lastDirectionChange = 0;
    const maxTime = Math.round(1200 * timeMult); // Adaptive Zeit

    function spawnTarget() {
        const padding = 40;
        const baseRadius = 30 * zoneMult; // Adaptive Zielgröße
        const baseSpeed = 4 * speedMult;  // Adaptive Geschwindigkeit
        target = {
            x: padding + Math.random() * (width - padding * 2),
            y: padding + Math.random() * (height - padding * 2),
            radius: baseRadius,
            baseSpeed: baseSpeed,
            dx: (Math.random() - 0.5) * baseSpeed,
            dy: (Math.random() - 0.5) * baseSpeed
        };
        startTime = Date.now();
        lastDirectionChange = startTime;
    }

    function update() {
        if (!gameActive) return;

        const now = Date.now();
        const elapsed = now - startTime;

        // VARIATION: Random direction changes every 200-400ms
        if (now - lastDirectionChange > 200 + Math.random() * 200) {
            // Slight random adjustment to direction (±30%)
            const angleChange = (Math.random() - 0.5) * 0.6 * Math.PI;
            const currentAngle = Math.atan2(target.dy, target.dx);
            const newAngle = currentAngle + angleChange;
            const speed = Math.sqrt(target.dx * target.dx + target.dy * target.dy);
            target.dx = Math.cos(newAngle) * speed;
            target.dy = Math.sin(newAngle) * speed;
            lastDirectionChange = now;
        }

        // Move target
        target.x += target.dx;
        target.y += target.dy;

        // Bounce off walls
        if (target.x < target.radius || target.x > width - target.radius) target.dx *= -1;
        if (target.y < target.radius || target.y > height - target.radius) target.dy *= -1;

        // Draw
        ctx.clearRect(0, 0, width, height);

        // Draw time indicator
        const timeRatio = 1 - (elapsed / maxTime);
        ctx.fillStyle = `rgba(${timeRatio > 0.3 ? '34, 197, 94' : '239, 68, 68'}, 0.3)`;
        ctx.fillRect(0, height - 10, width * timeRatio, 10);

        // Draw target with pulsing effect
        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.1;
        const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, target.radius * pulse);
        gradient.addColorStop(0, '#ef4444');
        gradient.addColorStop(0.7, '#dc2626');
        gradient.addColorStop(1, '#b91c1c');

        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner circle
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Check time
        if (elapsed >= maxTime) {
            gameActive = false;
            finishMinigame(RESULT_LEVELS.MISS, resolve);
            return;
        }

        animationFrameId = requestAnimationFrame(update);
    }

    function handleTap(clientX, clientY) {
        if (!gameActive) return;

        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);

        const dist = Math.sqrt((x - target.x) ** 2 + (y - target.y) ** 2);
        const elapsed = Date.now() - startTime;

        gameActive = false;

        if (dist <= target.radius) {
            // Hit! Determine quality based on timing and accuracy
            const centerDist = dist / target.radius; // 0 = perfect center, 1 = edge
            const timeBonus = 1 - (elapsed / maxTime); // Earlier is better

            if (centerDist < 0.3 && timeBonus > 0.5) {
                finishMinigame(RESULT_LEVELS.PERFECT, resolve);
            } else if (centerDist < 0.7) {
                finishMinigame(RESULT_LEVELS.GOOD, resolve);
            } else {
                finishMinigame(RESULT_LEVELS.OKAY, resolve);
            }
        } else {
            finishMinigame(RESULT_LEVELS.MISS, resolve);
        }
    }

    canvas.onclick = (e) => handleTap(e.clientX, e.clientY);
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleTap(touch.clientX, touch.clientY);
    };

    spawnTarget();
    update();
}

// ===== ASSAULT MINIGAME: Power Meter =====
// Stop the moving bar in the green zone for maximum damage
// Adaptiv: Zonengröße basierend auf Kontext

function startAssaultMinigame(resolve, mods = {}) {
    document.getElementById('minigame-instruction').textContent = 'Stoppe im grünen Bereich!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    // Adaptive Parameter
    const speedMult = mods.speedMultiplier || 1.0;
    const zoneMult = mods.zoneMultiplier || 1.0;

    let barPosition = 0;
    let direction = 1;
    let speed = 4 * speedMult;
    let gameActive = true;

    // VARIATION: Randomize zone center position (0.35-0.65 instead of always 0.5)
    const zoneCenter = 0.35 + Math.random() * 0.30;

    // Define zones - adaptiv basierend auf Kontext
    const perfectWidth = 0.05 * zoneMult;
    const goodWidth = 0.15 * zoneMult;
    const okayWidth = 0.30 * zoneMult;

    const perfectZone = { start: zoneCenter - perfectWidth, end: zoneCenter + perfectWidth };
    const goodZone = { start: zoneCenter - goodWidth, end: zoneCenter + goodWidth };
    const okayZone = { start: zoneCenter - okayWidth, end: zoneCenter + okayWidth };

    function update() {
        if (!gameActive) return;

        // Move bar
        barPosition += direction * speed;
        if (barPosition >= width || barPosition <= 0) {
            direction *= -1;
            speed += 0.3; // Speed up over time
        }

        // Draw
        ctx.clearRect(0, 0, width, height);

        const meterHeight = 60;
        const meterY = (height - meterHeight) / 2;

        // Draw zones (background to foreground)
        // Miss zone (red)
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(0, meterY, width, meterHeight);

        // Okay zone (orange)
        ctx.fillStyle = '#78350f';
        ctx.fillRect(width * okayZone.start, meterY, width * (okayZone.end - okayZone.start), meterHeight);

        // Good zone (green)
        ctx.fillStyle = '#166534';
        ctx.fillRect(width * goodZone.start, meterY, width * (goodZone.end - goodZone.start), meterHeight);

        // Perfect zone (gold)
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(width * perfectZone.start, meterY, width * (perfectZone.end - perfectZone.start), meterHeight);

        // Draw meter border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, meterY, width, meterHeight);

        // Draw moving indicator
        ctx.fillStyle = '#fff';
        ctx.fillRect(barPosition - 3, meterY - 10, 6, meterHeight + 20);

        // Glow effect
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.fillRect(barPosition - 2, meterY - 5, 4, meterHeight + 10);
        ctx.shadowBlur = 0;

        // Zone labels
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PERFEKT', width * zoneCenter, meterY + meterHeight + 20);

        animationFrameId = requestAnimationFrame(update);
    }

    function handleTap() {
        if (!gameActive) return;
        gameActive = false;

        const ratio = barPosition / width;

        if (ratio >= perfectZone.start && ratio <= perfectZone.end) {
            finishMinigame(RESULT_LEVELS.PERFECT, resolve);
        } else if (ratio >= goodZone.start && ratio <= goodZone.end) {
            finishMinigame(RESULT_LEVELS.GOOD, resolve);
        } else if (ratio >= okayZone.start && ratio <= okayZone.end) {
            finishMinigame(RESULT_LEVELS.OKAY, resolve);
        } else {
            finishMinigame(RESULT_LEVELS.MISS, resolve);
        }
    }

    canvas.onclick = handleTap;
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        handleTap();
    };

    update();
}

// ===== SNIPER MINIGAME: Steady Aim =====
// A crosshair wobbles - tap when it's centered on the target
// Adaptiv: Wackelstärke basierend auf Distanz und Stress

function startSniperMinigame(resolve, mods = {}) {
    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    const centerX = width / 2;
    const centerY = height / 2;

    // Adaptive Parameter
    const speedMult = mods.speedMultiplier || 1.0;  // Wackelgeschwindigkeit
    const timeMult = mods.timeMultiplier || 1.0;    // Still-Moment Dauer

    let crosshairX = centerX;
    let crosshairY = centerY;
    let wobbleTime = 0;
    let gameActive = true;
    let stillMoment = false;
    let nearStill = false;
    const stillDuration = Math.round(600 * timeMult);     // Adaptive Still-Dauer
    const nearStillDuration = Math.round(300 * timeMult); // Adaptive Vorwarnung
    const wobbleIntensity = 25 * speedMult;               // Adaptive Wackelstärke

    // VARIATION: Randomize cycle timing to prevent memorization
    const baseCycleLength = 2500;
    let currentCycleLength = baseCycleLength + (Math.random() - 0.5) * 800; // 2100-2900ms
    let stillStartTime = 1400 + Math.random() * 400; // 1400-1800ms into cycle
    let cycleStartTime = 0;

    function update() {
        if (!gameActive) return;

        wobbleTime += 16;

        // Calculate position within current cycle
        const cycleElapsed = wobbleTime - cycleStartTime;

        // Check if we need to start a new cycle with new random timing
        if (cycleElapsed >= currentCycleLength) {
            cycleStartTime = wobbleTime;
            // VARIATION: New random timing for next cycle
            currentCycleLength = baseCycleLength + (Math.random() - 0.5) * 800;
            stillStartTime = 1400 + Math.random() * 400;
        }

        const wobbleCycle = cycleElapsed;

        // Pre-still warning phase (crosshair slowing down)
        if (wobbleCycle > stillStartTime - nearStillDuration && wobbleCycle < stillStartTime) {
            nearStill = true;
            stillMoment = false;
            // Slower wobble during approach (adaptiv)
            const wobbleAmount = (wobbleIntensity * 0.6) * (1 - (wobbleCycle - (stillStartTime - nearStillDuration)) / nearStillDuration);
            crosshairX = centerX + Math.sin(wobbleTime * 0.006 * speedMult) * wobbleAmount;
            crosshairY = centerY + Math.cos(wobbleTime * 0.004 * speedMult) * wobbleAmount;
        } else if (wobbleCycle >= stillStartTime && wobbleCycle < stillStartTime + stillDuration) {
            // Still moment - perfect shot opportunity
            stillMoment = true;
            nearStill = false;
            crosshairX = centerX;
            crosshairY = centerY;
        } else {
            stillMoment = false;
            nearStill = false;
            // Normal wobble using multiple sine waves (adaptiv basierend auf Kontext)
            const wobbleAmount = wobbleIntensity + Math.sin(wobbleTime * 0.002) * (wobbleIntensity * 0.32);
            crosshairX = centerX + Math.sin(wobbleTime * 0.008 * speedMult) * wobbleAmount + Math.sin(wobbleTime * 0.013 * speedMult) * (wobbleAmount * 0.4);
            crosshairY = centerY + Math.cos(wobbleTime * 0.006 * speedMult) * wobbleAmount + Math.cos(wobbleTime * 0.011 * speedMult) * (wobbleAmount * 0.4);
        }

        // Draw
        ctx.clearRect(0, 0, width, height);

        // Draw target rings with better visibility
        ctx.beginPath();
        ctx.arc(centerX, centerY, 45, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(55, 65, 81, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Bullseye
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        // Draw crosshair with color coding
        let crosshairColor = '#fff';
        if (stillMoment) {
            crosshairColor = '#22c55e'; // Green = SHOOT NOW!
        } else if (nearStill) {
            crosshairColor = '#fbbf24'; // Yellow = get ready
        }

        ctx.strokeStyle = crosshairColor;
        ctx.lineWidth = 2;

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(crosshairX - 25, crosshairY);
        ctx.lineTo(crosshairX - 8, crosshairY);
        ctx.moveTo(crosshairX + 8, crosshairY);
        ctx.lineTo(crosshairX + 25, crosshairY);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(crosshairX, crosshairY - 25);
        ctx.lineTo(crosshairX, crosshairY - 8);
        ctx.moveTo(crosshairX, crosshairY + 8);
        ctx.lineTo(crosshairX, crosshairY + 25);
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(crosshairX, crosshairY, 3, 0, Math.PI * 2);
        ctx.fillStyle = crosshairColor;
        ctx.fill();

        // Status hint at bottom
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        if (stillMoment) {
            ctx.fillStyle = '#22c55e';
            ctx.fillText('JETZT SCHIESSEN!', centerX, height - 15);
        } else if (nearStill) {
            ctx.fillStyle = '#fbbf24';
            ctx.fillText('Bereit machen...', centerX, height - 15);
        } else {
            ctx.fillStyle = '#6b7280';
            ctx.fillText('Warte auf ruhige Hand...', centerX, height - 15);
        }

        animationFrameId = requestAnimationFrame(update);
    }

    function handleTap() {
        if (!gameActive) return;
        gameActive = false;

        // Calculate distance from center
        const dist = Math.sqrt((crosshairX - centerX) ** 2 + (crosshairY - centerY) ** 2);

        // More forgiving thresholds - Sniper is a precision class, good performance should be rewarded
        if (stillMoment && dist < 8) {
            // Perfect: Shot during still moment with good aim
            finishMinigame(RESULT_LEVELS.PERFECT, resolve);
        } else if (stillMoment || dist < 12) {
            // Good: Either during still moment OR very close to center
            finishMinigame(RESULT_LEVELS.GOOD, resolve);
        } else if (nearStill || dist < 25) {
            // Okay: Near-still moment OR reasonably close
            finishMinigame(RESULT_LEVELS.OKAY, resolve);
        } else if (dist < 40) {
            // At least on target - still OKAY for sniper
            finishMinigame(RESULT_LEVELS.OKAY, resolve);
        } else {
            // Really missed
            finishMinigame(RESULT_LEVELS.MISS, resolve);
        }
    }

    canvas.onclick = handleTap;
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        handleTap();
    };

    update();
}

// ===== MEDIC MINIGAME: Heartbeat Rhythm =====
// Tap in rhythm with the heartbeat pattern
// Adaptiv: Pulsgeschwindigkeit basierend auf Stress-Level

function startMedicMinigame(resolve, mods = {}) {
    document.getElementById('minigame-instruction').textContent = 'Tippe im Rhythmus des Herzschlags!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    // Adaptive Parameter - schnellerer Puls = weniger Zeit zwischen Beats
    const speedMult = mods.speedMultiplier || 1.0;
    const timeMult = mods.timeMultiplier || 1.0;

    // Basis-Intervall wird durch Stress verkürzt
    const beatInterval = Math.round(800 / speedMult * timeMult); // Adaptiver Puls
    const beats = [0, beatInterval, beatInterval * 2, beatInterval * 3];
    const currentBeat = 0;
    const startTime = Date.now();
    const taps = [];
    let gameActive = true;
    let ecgPosition = 0;

    // ECG wave pattern
    const ecgPattern = [0, 0, 0, 0.1, 0.2, 0.1, -0.3, 1, -0.5, 0.1, 0.2, 0.15, 0.1, 0, 0, 0, 0, 0];

    function update() {
        if (!gameActive) return;

        const elapsed = Date.now() - startTime;
        ecgPosition = (ecgPosition + 3) % width;

        // Draw
        ctx.clearRect(0, 0, width, height);

        // Draw ECG line
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let x = 0; x < width; x++) {
            const patternIndex = Math.floor(((x + ecgPosition) / width) * ecgPattern.length * 3) % ecgPattern.length;
            const y = height / 2 - ecgPattern[patternIndex] * 60;
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // Draw beat indicators
        const beatY = height - 40;
        beats.forEach((beat, i) => {
            const beatX = 50 + i * 60;
            const isCurrent = elapsed >= beat && elapsed < beat + 200;
            const wasHit = taps[i] !== undefined;

            ctx.beginPath();
            ctx.arc(beatX, beatY, 20, 0, Math.PI * 2);

            if (wasHit) {
                ctx.fillStyle = taps[i] ? '#22c55e' : '#ef4444';
            } else if (isCurrent) {
                ctx.fillStyle = '#fbbf24';
            } else if (elapsed > beat + 200) {
                ctx.fillStyle = '#ef4444'; // Missed
                taps[i] = false;
            } else {
                ctx.fillStyle = '#374151';
            }

            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Heart icon
            ctx.fillStyle = '#fff';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('♥', beatX, beatY + 5);
        });

        // Check if game is complete
        if (elapsed > beats[beats.length - 1] + 400) {
            gameActive = false;

            // Calculate score
            const hits = taps.filter(t => t === true).length;
            if (hits === 4) {
                finishMinigame(RESULT_LEVELS.PERFECT, resolve);
            } else if (hits >= 3) {
                finishMinigame(RESULT_LEVELS.GOOD, resolve);
            } else if (hits >= 2) {
                finishMinigame(RESULT_LEVELS.OKAY, resolve);
            } else {
                finishMinigame(RESULT_LEVELS.MISS, resolve);
            }
            return;
        }

        animationFrameId = requestAnimationFrame(update);
    }

    function handleTap() {
        if (!gameActive) return;

        const elapsed = Date.now() - startTime;
        playClick();

        // Find the closest beat
        let closestBeat = -1;
        let closestDist = Infinity;

        beats.forEach((beat, i) => {
            if (taps[i] !== undefined) return; // Already tapped
            const dist = Math.abs(elapsed - beat);
            if (dist < closestDist && dist < 300) {
                closestDist = dist;
                closestBeat = i;
            }
        });

        if (closestBeat >= 0) {
            taps[closestBeat] = closestDist < 150; // Within 150ms is a hit
        }
    }

    canvas.onclick = handleTap;
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        handleTap();
    };

    update();
}

// ===== COMMANDO MINIGAME: Swipe Sequence =====
// Swipe in the correct direction sequence quickly

function startCommandoMinigame(resolve) {
    document.getElementById('minigame-instruction').textContent = 'Wische in der richtigen Reihenfolge!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    const directions = ['up', 'right', 'down', 'left'];
    const arrows = { up: '↑', right: '→', down: '↓', left: '←' };
    const sequence = [];
    const sequenceLength = 4;

    // Generate random sequence
    for (let i = 0; i < sequenceLength; i++) {
        sequence.push(directions[Math.floor(Math.random() * 4)]);
    }

    let currentIndex = 0;
    let gameActive = true;
    const startTime = Date.now();
    const maxTime = 3000; // 3 seconds total

    let touchStartX = 0;
    let touchStartY = 0;

    function update() {
        if (!gameActive) return;

        const elapsed = Date.now() - startTime;

        // Draw
        ctx.clearRect(0, 0, width, height);

        // Draw time bar
        const timeRatio = 1 - (elapsed / maxTime);
        ctx.fillStyle = timeRatio > 0.3 ? '#22c55e' : '#ef4444';
        ctx.fillRect(0, 0, width * timeRatio, 5);

        // Draw sequence
        const arrowSize = 50;
        const startX = (width - sequenceLength * arrowSize) / 2;

        sequence.forEach((dir, i) => {
            const x = startX + i * arrowSize + arrowSize / 2;
            const y = height / 2;

            // Background
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, Math.PI * 2);
            if (i < currentIndex) {
                ctx.fillStyle = '#22c55e'; // Completed
            } else if (i === currentIndex) {
                ctx.fillStyle = '#3b82f6'; // Current
            } else {
                ctx.fillStyle = '#374151'; // Pending
            }
            ctx.fill();

            // Arrow
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(arrows[dir], x, y);
        });

        // Current direction hint
        if (currentIndex < sequenceLength) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Wische ${arrows[sequence[currentIndex]]}`, width / 2, height - 30);
        }

        // Check timeout
        if (elapsed >= maxTime) {
            gameActive = false;
            if (currentIndex >= 3) {
                finishMinigame(RESULT_LEVELS.OKAY, resolve);
            } else if (currentIndex >= 2) {
                finishMinigame(RESULT_LEVELS.OKAY, resolve);
            } else {
                finishMinigame(RESULT_LEVELS.MISS, resolve);
            }
            return;
        }

        animationFrameId = requestAnimationFrame(update);
    }

    function detectSwipe(startX, startY, endX, endY) {
        const dx = endX - startX;
        const dy = endY - startY;
        const minSwipe = 30;

        if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) {
            return null; // Too short
        }

        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        } else {
            return dy > 0 ? 'down' : 'up';
        }
    }

    function handleSwipe(direction) {
        if (!gameActive || currentIndex >= sequenceLength) return;

        if (direction === sequence[currentIndex]) {
            currentIndex++;
            playClick();

            if (currentIndex >= sequenceLength) {
                gameActive = false;
                const elapsed = Date.now() - startTime;
                if (elapsed < 1500) {
                    finishMinigame(RESULT_LEVELS.PERFECT, resolve);
                } else if (elapsed < 2200) {
                    finishMinigame(RESULT_LEVELS.GOOD, resolve);
                } else {
                    finishMinigame(RESULT_LEVELS.OKAY, resolve);
                }
            }
        } else {
            // Wrong direction - penalty
            playError();
            gameActive = false;
            if (currentIndex >= 2) {
                finishMinigame(RESULT_LEVELS.OKAY, resolve);
            } else {
                finishMinigame(RESULT_LEVELS.MISS, resolve);
            }
        }
    }

    // Mouse support (click and drag)
    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        touchStartX = e.clientX - rect.left;
        touchStartY = e.clientY - rect.top;
    };

    canvas.onmouseup = (e) => {
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;
        const direction = detectSwipe(touchStartX, touchStartY, endX, endY);
        if (direction) handleSwipe(direction);
    };

    // Touch support
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        touchStartX = touch.clientX - rect.left;
        touchStartY = touch.clientY - rect.top;
    };

    canvas.ontouchend = (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const endX = touch.clientX - rect.left;
        const endY = touch.clientY - rect.top;
        const direction = detectSwipe(touchStartX, touchStartY, endX, endY);
        if (direction) handleSwipe(direction);
    };

    update();
}

// ===== COMMANDO DUEL MINIGAME: Combat Duel =====
// Echtes Nahkampf-Duell mit Angriff/Block/Ausweichen
// Rock-Paper-Scissors Mechanik: Angriff > Ausweichen > Block > Angriff

const DUEL_MOVES = {
    ATTACK: { id: 'attack', icon: '⚔️', name: 'Angriff', beats: 'dodge', losesTo: 'block', color: '#ef4444' },
    BLOCK: { id: 'block', icon: '🛡️', name: 'Block', beats: 'attack', losesTo: 'dodge', color: '#3b82f6' },
    DODGE: { id: 'dodge', icon: '💨', name: 'Ausweichen', beats: 'block', losesTo: 'attack', color: '#22c55e' }
};

function startCommandoDuelMinigame(resolve, mods = {}) {
    document.getElementById('minigame-instruction').textContent = 'Reagiere auf den Feind!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    // Adaptive Parameter
    const timeMult = mods.timeMultiplier || 1.0;
    const extraChance = mods.extraChance || 0;

    // Duel Config
    const totalRounds = 3;
    const reactionWindow = Math.round(1200 * timeMult); // Zeit zum Reagieren (adaptiv)
    const tellDuration = 500;    // Feind zeigt Absicht
    const resultDuration = 600;  // Ergebnis-Anzeige

    // Duel State
    let currentRound = 0;
    const roundResults = [];       // Array von 'win', 'lose', 'draw'
    let phase = 'ready';         // 'ready', 'tell', 'react', 'result'
    let phaseStartTime = 0;
    let enemyMove = null;
    let playerMove = null;
    let gameActive = true;
    let selectedButton = -1;     // Für Hover-Effekt

    // Button-Bereiche für Touch/Click
    const buttonY = height - 55;
    const buttonSize = 45;
    const buttonGap = 15;
    const totalButtonWidth = 3 * buttonSize + 2 * buttonGap;
    const buttonStartX = (width - totalButtonWidth) / 2;

    const buttons = [
        { move: DUEL_MOVES.ATTACK, x: buttonStartX, y: buttonY, size: buttonSize },
        { move: DUEL_MOVES.BLOCK, x: buttonStartX + buttonSize + buttonGap, y: buttonY, size: buttonSize },
        { move: DUEL_MOVES.DODGE, x: buttonStartX + 2 * (buttonSize + buttonGap), y: buttonY, size: buttonSize }
    ];

    function getEnemyMove() {
        // KI wählt zufällig, aber mit leichter Tendenz
        const moves = [DUEL_MOVES.ATTACK, DUEL_MOVES.BLOCK, DUEL_MOVES.DODGE];
        // Leichte Tendenz zu Angriff (aggressiver Feind)
        const weights = [0.4, 0.3, 0.3];
        const rand = Math.random();
        let cumulative = 0;
        for (let i = 0; i < moves.length; i++) {
            cumulative += weights[i];
            if (rand < cumulative) return moves[i];
        }
        return moves[0];
    }

    function startRound() {
        currentRound++;
        phase = 'tell';
        phaseStartTime = Date.now();
        enemyMove = getEnemyMove();
        playerMove = null;
    }

    function resolveRound() {
        if (!playerMove) {
            // Keine Reaktion = Verloren (aber Extra-Chance aus Hinterhalt prüfen)
            if (Math.random() < extraChance) {
                roundResults.push('draw');
            } else {
                roundResults.push('lose');
            }
        } else if (playerMove.beats === enemyMove.id) {
            roundResults.push('win');
        } else if (playerMove.losesTo === enemyMove.id) {
            roundResults.push('lose');
        } else {
            roundResults.push('draw');
        }

        phase = 'result';
        phaseStartTime = Date.now();
    }

    function checkGameEnd() {
        const wins = roundResults.filter(r => r === 'win').length;
        const losses = roundResults.filter(r => r === 'lose').length;

        if (wins >= 2) {
            gameActive = false;
            // Extra-Chance kann zu PERFECT upgraden
            if (wins === 3 || Math.random() < extraChance) {
                finishMinigame(RESULT_LEVELS.PERFECT, resolve);
            } else {
                finishMinigame(RESULT_LEVELS.GOOD, resolve);
            }
            return true;
        } else if (losses >= 2) {
            gameActive = false;
            if (wins >= 1) {
                finishMinigame(RESULT_LEVELS.OKAY, resolve);
            } else {
                finishMinigame(RESULT_LEVELS.MISS, resolve);
            }
            return true;
        } else if (currentRound >= totalRounds) {
            gameActive = false;
            if (wins > losses) {
                finishMinigame(RESULT_LEVELS.GOOD, resolve);
            } else if (wins === losses) {
                finishMinigame(RESULT_LEVELS.OKAY, resolve);
            } else {
                finishMinigame(RESULT_LEVELS.MISS, resolve);
            }
            return true;
        }
        return false;
    }

    function update() {
        if (!gameActive) return;

        const now = Date.now();
        const elapsed = now - phaseStartTime;

        // Phase-Übergänge
        if (phase === 'ready') {
            startRound();
        } else if (phase === 'tell' && elapsed >= tellDuration) {
            phase = 'react';
            phaseStartTime = now;
        } else if (phase === 'react' && elapsed >= reactionWindow) {
            resolveRound();
        } else if (phase === 'result' && elapsed >= resultDuration) {
            if (!checkGameEnd()) {
                phase = 'ready';
                phaseStartTime = Date.now();
            } else {
                return; // Spiel ist vorbei, Animation beenden
            }
        }

        // Draw
        ctx.clearRect(0, 0, width, height);

        // Hintergrund-Gradient für Kampfatmosphäre
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#1a1a2e');
        bgGrad.addColorStop(1, '#0d0d1a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Runden-Anzeige oben
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Runde ${currentRound}/${totalRounds}`, width / 2, 20);

        // Runden-Ergebnisse
        for (let i = 0; i < totalRounds; i++) {
            const circleX = width / 2 - 30 + i * 30;
            const circleY = 40;
            ctx.beginPath();
            ctx.arc(circleX, circleY, 10, 0, Math.PI * 2);
            if (roundResults[i] === 'win') {
                ctx.fillStyle = '#22c55e';
            } else if (roundResults[i] === 'lose') {
                ctx.fillStyle = '#ef4444';
            } else if (roundResults[i] === 'draw') {
                ctx.fillStyle = '#fbbf24';
            } else {
                ctx.fillStyle = '#374151';
            }
            ctx.fill();
        }

        // Kampfszene - Mitte
        const centerY = height / 2 - 20;

        // Feind (rechts)
        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👤', width - 60, centerY);

        // Feind-Aktion anzeigen
        if (phase === 'tell' || phase === 'react' || phase === 'result') {
            // Feind-Move-Indikator
            const enemyIndicatorAlpha = phase === 'tell' ? Math.min(1, elapsed / 300) : 1;
            ctx.globalAlpha = enemyIndicatorAlpha;

            // Zeige feindliche Absicht (nur Andeutung in tell-Phase)
            if (phase === 'tell') {
                // Feind bereitet sich vor - zeige nur Hinweis
                ctx.font = 'bold 14px sans-serif';
                ctx.fillStyle = '#fbbf24';
                ctx.fillText('bereitet vor...', width - 60, centerY + 35);
            } else {
                // Zeige tatsächliche Aktion mit Highlight-Hintergrund
                const moveX = width - 60;
                const moveY = centerY + 35;

                // Highlight-Kreis hinter dem Icon
                ctx.beginPath();
                ctx.arc(moveX, moveY, 28, 0, Math.PI * 2);
                ctx.fillStyle = enemyMove.color + '40'; // 25% opacity
                ctx.fill();
                ctx.strokeStyle = enemyMove.color;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Icon größer und zentriert
                ctx.font = '32px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(enemyMove.icon, moveX, moveY);

                // Move name darunter
                ctx.font = 'bold 11px sans-serif';
                ctx.fillStyle = enemyMove.color;
                ctx.fillText(enemyMove.name.toUpperCase(), moveX, moveY + 35);
            }
            ctx.globalAlpha = 1;
        }

        // Spieler (links)
        ctx.font = '40px sans-serif';
        ctx.fillText('🥷', 60, centerY);

        // Spieler-Aktion
        if (playerMove) {
            ctx.font = '28px sans-serif';
            ctx.fillText(playerMove.icon, 60, centerY + 40);
        }

        // Ergebnis der Runde
        if (phase === 'result') {
            const lastResult = roundResults[roundResults.length - 1];
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            if (lastResult === 'win') {
                ctx.fillStyle = '#22c55e';
                ctx.fillText('GETROFFEN!', width / 2, centerY);
            } else if (lastResult === 'lose') {
                ctx.fillStyle = '#ef4444';
                ctx.fillText('GEBLOCKT!', width / 2, centerY);
            } else {
                ctx.fillStyle = '#fbbf24';
                ctx.fillText('AUSGEWICHEN!', width / 2, centerY);
            }
        }

        // Zeitbalken für Reaktion
        if (phase === 'react') {
            const timeLeft = 1 - (elapsed / reactionWindow);
            const barWidth = 200;
            const barHeight = 8;
            const barX = (width - barWidth) / 2;
            const barY = height - 90;

            ctx.fillStyle = '#374151';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = timeLeft > 0.3 ? '#22c55e' : '#ef4444';
            ctx.fillRect(barX, barY, barWidth * timeLeft, barHeight);
        }

        // Aktions-Buttons
        if (phase === 'react' && !playerMove) {
            buttons.forEach((btn, i) => {
                const isHovered = selectedButton === i;
                const btnRadius = btn.size / 2;

                // Button-Hintergrund
                ctx.beginPath();
                ctx.arc(btn.x + btnRadius, btn.y, btnRadius, 0, Math.PI * 2);
                ctx.fillStyle = isHovered ? btn.move.color : '#1f2937';
                ctx.fill();
                ctx.strokeStyle = btn.move.color;
                ctx.lineWidth = 3;
                ctx.stroke();

                // Icon
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fff';
                ctx.fillText(btn.move.icon, btn.x + btnRadius, btn.y);

                // Label
                ctx.font = '10px sans-serif';
                ctx.fillStyle = '#a0aec0';
                ctx.fillText(btn.move.name, btn.x + btnRadius, btn.y + btnRadius + 12);
            });
        }

        // Hilfe-Text - clearer instruction based on enemy move
        if (phase === 'react' && !playerMove && enemyMove) {
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';

            // Show counter hint based on enemy move
            let counterHint = '';
            let counterColor = '#22c55e';
            if (enemyMove.id === 'attack') {
                counterHint = '🛡️ BLOCK gegen Angriff!';
            } else if (enemyMove.id === 'block') {
                counterHint = '💨 AUSWEICHEN gegen Block!';
            } else if (enemyMove.id === 'dodge') {
                counterHint = '⚔️ ANGRIFF gegen Ausweichen!';
            }

            // Draw hint with background
            const hintY = height - 15;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(width / 2 - 100, hintY - 12, 200, 18);
            ctx.fillStyle = counterColor;
            ctx.fillText(counterHint, width / 2, hintY);
        }

        animationFrameId = requestAnimationFrame(update);
    }

    function handleClick(clientX, clientY) {
        if (!gameActive || phase !== 'react' || playerMove) return;

        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);

        // Prüfe Button-Klicks
        for (const btn of buttons) {
            const btnCenterX = btn.x + btn.size / 2;
            const dist = Math.sqrt((x - btnCenterX) ** 2 + (y - btn.y) ** 2);
            if (dist <= btn.size / 2 + 5) { // Etwas Toleranz
                playerMove = btn.move;
                playClick();
                resolveRound();
                return;
            }
        }
    }

    function handleMove(clientX, clientY) {
        if (!gameActive || phase !== 'react') return;

        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);

        selectedButton = -1;
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            const btnCenterX = btn.x + btn.size / 2;
            const dist = Math.sqrt((x - btnCenterX) ** 2 + (y - btn.y) ** 2);
            if (dist <= btn.size / 2 + 5) {
                selectedButton = i;
                break;
            }
        }
    }

    canvas.onclick = (e) => handleClick(e.clientX, e.clientY);
    canvas.onmousemove = (e) => handleMove(e.clientX, e.clientY);
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleClick(touch.clientX, touch.clientY);
    };

    update();
}

/**
 * Check if minigames are enabled (could be a setting)
 */
export function areMinigamesEnabled() {
    // Could check a settings flag here
    return true;
}

// ===== HEALING MINIGAME =====
// Exported function for Medic's healing ability
// Uses the heartbeat rhythm minigame

/**
 * Healing result multipliers for heal amount
 */
export const HEALING_RESULT_MULTIPLIERS = {
    [RESULT_LEVELS.PERFECT]: { healMultiplier: 1.5, label: 'PERFEKT!', color: '#ffd700' },  // 150% Heilung
    [RESULT_LEVELS.GOOD]: { healMultiplier: 1.0, label: 'GUT!', color: '#22c55e' },         // 100% Heilung
    [RESULT_LEVELS.OKAY]: { healMultiplier: 0.7, label: 'OK', color: '#f59e0b' },           // 70% Heilung
    [RESULT_LEVELS.MISS]: { healMultiplier: 0.4, label: 'DANEBEN', color: '#ef4444' }       // 40% Heilung
};

/**
 * Start the healing minigame for Medic's special ability
 * Returns a Promise that resolves with the result including healMultiplier
 * @param {Object} context - Optional context (wounded allies nearby, etc.)
 */
export async function startHealingMinigame(context = null) {
    initMinigames();

    // Reset anti-cheat tap cooldown
    lastTapTime = 0;

    // Calculate modifiers based on context (stress, allies, etc.)
    const mods = context ? calculateDifficultyModifiers('medic', context) : {
        speedMultiplier: 1.0,
        timeMultiplier: 1.0,
        description: null
    };

    // Show overlay with healing-specific instructions
    minigameOverlay.classList.add('active');
    document.getElementById('minigame-icon').textContent = '💚';
    document.getElementById('minigame-title').textContent = HEALING_MINIGAME_DESC.title;
    document.getElementById('minigame-instruction').textContent = HEALING_MINIGAME_DESC.instruction;

    // Show context hint if available
    const hintText = mods.description || HEALING_MINIGAME_DESC.hint;
    document.getElementById('minigame-hint').textContent = hintText;
    if (mods.description) {
        document.getElementById('minigame-hint').style.color =
            mods.speedMultiplier < 1 ? '#22c55e' : mods.speedMultiplier > 1.2 ? '#ef4444' : '#fbbf24';
    } else {
        document.getElementById('minigame-hint').style.color = '#a0aec0';
    }

    document.getElementById('minigame-result').classList.remove('show');
    document.getElementById('minigame-result').textContent = '';

    // Show detailed explanation and wait for tap to start
    if (HEALING_MINIGAME_DESC.detailedExplanation) {
        await showExplanationAndWaitForStart(HEALING_MINIGAME_DESC.detailedExplanation);
    }

    // Show countdown
    await showCountdown();

    // Start healing minigame
    return new Promise((resolve) => {
        startHealingMinigameInternal(resolve, mods);
    });
}

/**
 * Internal healing minigame - heartbeat rhythm
 * With variation: randomized beat intervals to prevent memorization
 */
function startHealingMinigameInternal(resolve, mods = {}) {
    document.getElementById('minigame-instruction').textContent = 'Tippe im Rhythmus des Herzschlags!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    // Adaptive parameters
    const speedMult = mods.speedMultiplier || 1.0;
    const timeMult = mods.timeMultiplier || 1.0;

    // VARIATION: Randomize beat intervals slightly (±15% variation)
    const baseInterval = Math.round(800 / speedMult * timeMult);
    const randomizeInterval = () => {
        const variation = 0.15; // ±15%
        return Math.round(baseInterval * (1 + (Math.random() - 0.5) * 2 * variation));
    };

    // Generate beats with variation
    const beats = [
        400, // First beat starts after a small delay
        400 + randomizeInterval(),
        400 + randomizeInterval() + randomizeInterval(),
        400 + randomizeInterval() + randomizeInterval() + randomizeInterval()
    ];
    const currentBeat = 0;
    const startTime = Date.now();
    const taps = [];
    let gameActive = true;
    let ecgPosition = 0;

    // ECG wave pattern
    const ecgPattern = [0, 0, 0, 0.1, 0.2, 0.1, -0.3, 1, -0.5, 0.1, 0.2, 0.15, 0.1, 0, 0, 0, 0, 0];

    function finishHealingMinigame(level) {
        gameActive = false;

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        const result = HEALING_RESULT_MULTIPLIERS[level];
        const resultEl = document.getElementById('minigame-result');
        resultEl.textContent = result.label;
        resultEl.style.color = result.color;
        resultEl.classList.add('show');

        setTimeout(() => {
            minigameOverlay.classList.remove('active');
            canvas.onclick = null;
            canvas.ontouchstart = null;
            resolve({ level, multiplier: result });
        }, 800);
    }

    function update() {
        if (!gameActive) return;

        const elapsed = Date.now() - startTime;
        ecgPosition = (ecgPosition + 3) % width;

        // Draw
        ctx.clearRect(0, 0, width, height);

        // Background with healing green tint
        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(0, 0, width, height);

        // Draw ECG line
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 10;
        ctx.beginPath();

        for (let x = 0; x < width; x++) {
            const patternIndex = Math.floor(((x + ecgPosition) / width) * ecgPattern.length * 3) % ecgPattern.length;
            const y = height / 2 - ecgPattern[patternIndex] * 60;
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw beat indicators
        const beatY = height - 50;
        beats.forEach((beat, i) => {
            const beatX = 60 + i * 65;
            const isCurrent = elapsed >= beat && elapsed < beat + 250;
            const wasHit = taps[i] !== undefined;

            ctx.beginPath();
            ctx.arc(beatX, beatY, 22, 0, Math.PI * 2);

            if (wasHit) {
                ctx.fillStyle = taps[i] ? '#22c55e' : '#ef4444';
            } else if (isCurrent) {
                ctx.fillStyle = '#fbbf24';
                // Pulse effect
                ctx.save();
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(beatX, beatY, 30, 0, Math.PI * 2);
                ctx.fillStyle = '#fbbf24';
                ctx.fill();
                ctx.restore();
            } else if (elapsed > beat + 250) {
                ctx.fillStyle = '#ef4444';
                if (taps[i] === undefined) taps[i] = false;
            } else {
                ctx.fillStyle = '#1f3a1f';
            }

            ctx.fill();
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Heart icon
            ctx.fillStyle = '#fff';
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('♥', beatX, beatY + 6);
        });

        // Title
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#22c55e';
        ctx.textAlign = 'center';
        ctx.fillText('💚 HEILUNG 💚', width / 2, 25);

        // Check if game is complete
        if (elapsed > beats[beats.length - 1] + 500) {
            const hits = taps.filter(t => t === true).length;
            if (hits === 4) {
                finishHealingMinigame(RESULT_LEVELS.PERFECT);
            } else if (hits >= 3) {
                finishHealingMinigame(RESULT_LEVELS.GOOD);
            } else if (hits >= 2) {
                finishHealingMinigame(RESULT_LEVELS.OKAY);
            } else {
                finishHealingMinigame(RESULT_LEVELS.MISS);
            }
            return;
        }

        animationFrameId = requestAnimationFrame(update);
    }

    function handleTap() {
        if (!gameActive) return;

        // Anti-cheat: Prevent fast-tapping spam
        if (!isValidTap()) {
            return; // Ignore spam taps
        }

        const elapsed = Date.now() - startTime;
        playClick();

        // Find nearest beat
        for (let i = 0; i < beats.length; i++) {
            if (taps[i] !== undefined) continue;

            const diff = Math.abs(elapsed - beats[i]);
            if (diff < 250) {  // 250ms tolerance window
                taps[i] = true;
                playTarget();  // Success sound
                return;
            }
        }
    }

    canvas.onclick = handleTap;
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        handleTap();
    };

    update();
}
