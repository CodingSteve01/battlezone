// ===== ATTACK MINIGAMES =====
// Each unit class has a unique skill-based minigame that determines attack effectiveness

import { UNIT_CLASSES } from './config.js';
import { playClick, playTarget, playError } from './audio.js';

// Minigame result levels
export const RESULT_LEVELS = {
    PERFECT: 'perfect',   // 100% damage + crit chance bonus
    GOOD: 'good',         // 100% damage
    OKAY: 'okay',         // 70% damage
    MISS: 'miss'          // 30% damage
};

// Result multipliers for damage
export const RESULT_MULTIPLIERS = {
    [RESULT_LEVELS.PERFECT]: { damage: 1.0, critBonus: 0.25, label: 'PERFEKT!', color: '#ffd700' },
    [RESULT_LEVELS.GOOD]: { damage: 1.0, critBonus: 0, label: 'GUT!', color: '#22c55e' },
    [RESULT_LEVELS.OKAY]: { damage: 0.7, critBonus: 0, label: 'OK', color: '#f59e0b' },
    [RESULT_LEVELS.MISS]: { damage: 0.3, critBonus: 0, label: 'DANEBEN', color: '#ef4444' }
};

// Current active minigame state
let activeMinigame = null;
let minigameOverlay = null;
let minigameCanvas = null;
let minigameCtx = null;
let animationFrameId = null;

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
            color: #a0aec0;
            font-size: 14px;
            margin-bottom: 15px;
            min-height: 20px;
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
 * Start a minigame for the given unit class
 * Returns a Promise that resolves with the result
 */
export function startMinigame(unitClass) {
    return new Promise((resolve) => {
        initMinigames();

        const classInfo = UNIT_CLASSES[unitClass];
        if (!classInfo) {
            resolve({ level: RESULT_LEVELS.GOOD, multiplier: RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD] });
            return;
        }

        // Show overlay
        minigameOverlay.classList.add('active');
        document.getElementById('minigame-icon').textContent = classInfo.icon;
        document.getElementById('minigame-title').textContent = classInfo.name;
        document.getElementById('minigame-result').classList.remove('show');
        document.getElementById('minigame-result').textContent = '';

        // Start the appropriate minigame
        switch (unitClass) {
            case 'scout':
                startScoutMinigame(resolve);
                break;
            case 'assault':
                startAssaultMinigame(resolve);
                break;
            case 'sniper':
                startSniperMinigame(resolve);
                break;
            case 'medic':
                startMedicMinigame(resolve);
                break;
            case 'commando':
                startCommandoMinigame(resolve);
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

function startScoutMinigame(resolve) {
    document.getElementById('minigame-instruction').textContent = 'Tippe das Ziel!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    let target = null;
    let startTime = 0;
    let gameActive = true;
    const maxTime = 1200; // 1.2 seconds to hit

    function spawnTarget() {
        const padding = 40;
        target = {
            x: padding + Math.random() * (width - padding * 2),
            y: padding + Math.random() * (height - padding * 2),
            radius: 30,
            dx: (Math.random() - 0.5) * 4,
            dy: (Math.random() - 0.5) * 4
        };
        startTime = Date.now();
    }

    function update() {
        if (!gameActive) return;

        const elapsed = Date.now() - startTime;

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

function startAssaultMinigame(resolve) {
    document.getElementById('minigame-instruction').textContent = 'Stoppe im grünen Bereich!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    let barPosition = 0;
    let direction = 1;
    let speed = 4;
    let gameActive = true;

    // Define zones
    const perfectZone = { start: 0.45, end: 0.55 }; // 10% in the middle
    const goodZone = { start: 0.35, end: 0.65 };    // 30% around center
    const okayZone = { start: 0.2, end: 0.8 };      // 60% wider zone

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
        ctx.fillText('PERFEKT', width * 0.5, meterY + meterHeight + 20);

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

function startSniperMinigame(resolve) {
    document.getElementById('minigame-instruction').textContent = 'Schieße wenn das Fadenkreuz still steht!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    const centerX = width / 2;
    const centerY = height / 2;

    let crosshairX = centerX;
    let crosshairY = centerY;
    let wobbleTime = 0;
    let gameActive = true;
    let stillMoment = false;
    let stillTimer = 0;
    const stillDuration = 400; // ms the crosshair stays still

    function update() {
        if (!gameActive) return;

        wobbleTime += 16;

        // Create wobble pattern with occasional still moments
        const wobbleCycle = wobbleTime % 3000;

        if (wobbleCycle > 2000 && wobbleCycle < 2000 + stillDuration) {
            // Still moment
            stillMoment = true;
            crosshairX = centerX;
            crosshairY = centerY;
        } else {
            stillMoment = false;
            // Wobble using multiple sine waves
            const wobbleAmount = 30 + Math.sin(wobbleTime * 0.002) * 10;
            crosshairX = centerX + Math.sin(wobbleTime * 0.008) * wobbleAmount + Math.sin(wobbleTime * 0.013) * (wobbleAmount * 0.5);
            crosshairY = centerY + Math.cos(wobbleTime * 0.006) * wobbleAmount + Math.cos(wobbleTime * 0.011) * (wobbleAmount * 0.5);
        }

        // Draw
        ctx.clearRect(0, 0, width, height);

        // Draw target
        ctx.beginPath();
        ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        // Draw crosshair
        const crosshairColor = stillMoment ? '#22c55e' : '#fff';
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
        ctx.arc(crosshairX, crosshairY, 2, 0, Math.PI * 2);
        ctx.fillStyle = crosshairColor;
        ctx.fill();

        // Hint text
        if (stillMoment) {
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('JETZT!', centerX, height - 20);
        }

        animationFrameId = requestAnimationFrame(update);
    }

    function handleTap() {
        if (!gameActive) return;
        gameActive = false;

        // Calculate distance from center
        const dist = Math.sqrt((crosshairX - centerX) ** 2 + (crosshairY - centerY) ** 2);

        if (stillMoment && dist < 5) {
            finishMinigame(RESULT_LEVELS.PERFECT, resolve);
        } else if (dist < 15) {
            finishMinigame(RESULT_LEVELS.GOOD, resolve);
        } else if (dist < 35) {
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

// ===== MEDIC MINIGAME: Heartbeat Rhythm =====
// Tap in rhythm with the heartbeat pattern

function startMedicMinigame(resolve) {
    document.getElementById('minigame-instruction').textContent = 'Tippe im Rhythmus des Herzschlags!';

    const canvas = minigameCanvas;
    const ctx = minigameCtx;
    const width = canvas.width;
    const height = canvas.height;

    const beatInterval = 800; // ms between beats
    const beats = [0, beatInterval, beatInterval * 2, beatInterval * 3];
    let currentBeat = 0;
    let startTime = Date.now();
    let taps = [];
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
    let startTime = Date.now();
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

/**
 * Check if minigames are enabled (could be a setting)
 */
export function areMinigamesEnabled() {
    // Could check a settings flag here
    return true;
}
