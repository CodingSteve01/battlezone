// ===== TURN MANAGEMENT =====

import {
    state, getPlayerUnits, getQueuedPath, updatePreviouslyVisibleEnemies,
    initSharedAPPool, isHexInZone, setOnAPDepletedCallback,
    clearPlayerOverwatch, cleanupSuppression, hasAlliances, getPlayersInTeam,
    getPlayerName
} from './state.js';
import { CONFIG } from './config.js';
import { resetUnitsForTurn, resetSpecialAbilities, killUnit } from './units.js';
import { updateVisibility, getVisibleEnemies, revealAllEnemies } from './fogOfWar.js';
import { checkGameOver, updateAllHoldPositions } from './combat.js';
import { showScreen, updateUI, showToast, showEventBanner, updatePlayersAlive, displayAwards, showRoundStartScreen } from './ui.js';
import { render } from './renderer.js';
import { centerOnCurrentUnit, centerOnTeam, executeQueuedPathsForPlayer, playGameIntro } from './input.js';
import { updatePowerupBuffs, spawnNewPowerups } from './powerups.js';
import { rollRoundEvent, clearRoundEvent } from './events.js';
import { isAIPlayer, executeAITurn, isSpectatorMode } from './ai.js';
import { logInfo, logError } from './errorLog.js';
import { playRoundStart, playTurnEnd, playVictory, playDefeat, playEvent, stopAmbient } from './audio.js';

// === SHRINKING ZONE CONSTANTS ===
// AGGRESSIV: Zone schrumpft schnell, um Wegrennen zu verhindern!
const ZONE_CONFIG = {
    ROUNDS_BEFORE_SHRINK: 2,      // NUR 2 Runden ohne Kampf bevor Zone schrumpft (vorher 4)
    SHRINK_AMOUNT: 3,             // 3 Felder pro Schrumpfung (vorher 2) - DRASTISCH
    MIN_ZONE_RADIUS: 3,           // Minimaler Radius nur 3 Felder (vorher 5) - erzwingt Nahkampf!
    ZONE_DAMAGE: 25,              // 25 Schaden pro Runde außerhalb (vorher 15) - TÖDLICH
    REVEAL_INTERVAL: 3,           // Alle 3 Runden (vorher 5) versteckte Einheiten aufdecken
    WARNING_ROUNDS: 1             // 1 Runde Vorwarnung
};

// === AI TURN WATCHDOG ===
// Ensures AI turns always complete, even if executeAITurn() fails to start
let aiTurnWatchdogId = null;
const AI_TURN_WATCHDOG_TIMEOUT = 45000; // 45 seconds - longer than AI's internal 30s timeout

/**
 * Start AI turn watchdog timer
 * This is a backup safety mechanism in case executeAITurn() is never called
 * or fails to set up its own timeout
 */
function startAIWatchdog() {
    clearAIWatchdog();
    aiTurnWatchdogId = setTimeout(() => {
        console.error('AI WATCHDOG TRIGGERED - AI turn never completed! Forcing next player...');
        // Force end the turn - this is a last resort
        nextPlayer();
    }, AI_TURN_WATCHDOG_TIMEOUT);
}

/**
 * Clear AI turn watchdog timer
 * Called when turn ends normally
 */
function clearAIWatchdog() {
    if (aiTurnWatchdogId) {
        clearTimeout(aiTurnWatchdogId);
        aiTurnWatchdogId = null;
    }
}

/**
 * Start a player's turn
 */
export function startTurn() {
    // Clear any pending auto-end timer from previous turn
    clearAutoEndTurnTimer();

    logInfo('Zug startet', `Spieler ${state.currentPlayer + 1}, Runde ${state.round}, AI: ${isAIPlayer()}, Spectator: ${isSpectatorMode()}`);

    const units = getPlayerUnits(state.currentPlayer);

    // Skip players with no units
    if (units.length === 0) {
        logInfo('Spieler übersprungen - keine Einheiten');
        nextPlayer();
        return;
    }

    // Reset units for turn
    resetUnitsForTurn(state.currentPlayer);

    // Lösche Overwatch des aktiven Spielers (Overwatch gilt nur bis zum eigenen Zug)
    clearPlayerOverwatch(state.currentPlayer);

    // Initialize shared AP pool for this player
    initSharedAPPool(state.currentPlayer);

    // Set initial selection
    state.selectedUnit = 0;
    state.selectedAction = 'move';
    state.targetedUnit = null;
    state.currentPath = null;
    state.pendingMoveDestination = null;
    state.hoveredHex = null;

    // Safety: Reset animation state to prevent stuck animations from previous turn
    // This can happen if an animation callback fails or times out
    state.animating = false;
    state.movementAnimation = null;

    // Determine viewing player perspective:
    // - If spectator mode (all AI or humans eliminated), follow current AI's perspective
    // - If current player is AI and humans exist, keep the human player's perspective
    // - If current player is human, view from their perspective
    if (isSpectatorMode()) {
        // SPECTATOR MODE: Follow the current AI's perspective
        state.viewingPlayer = state.currentPlayer;
    } else if (isAIPlayer()) {
        // AI is playing but humans still have units - find the first human for viewing
        let firstHuman = 0;
        for (let p = 0; p < state.settings.players; p++) {
            if (!isAIPlayer(p)) {
                firstHuman = p;
                break;
            }
        }
        state.viewingPlayer = firstHuman;
    } else {
        // Human is playing - view from their perspective
        state.viewingPlayer = state.currentPlayer;
    }

    // Update fog of war
    updateVisibility();
    logInfo('Sichtbarkeit aktualisiert', `viewingPlayer: ${state.viewingPlayer}, visibleHexes: ${state.visibleHexes?.size || 0}`);

    // Initialize enemy tracking for this player's turn
    const visibleEnemies = getVisibleEnemies();
    updatePreviouslyVisibleEnemies(visibleEnemies.map(e => e.id));

    // Note: Queued paths are now automatically executed after turn screen is dismissed
    // See executeQueuedPathsForPlayer() in input.js

    // CAMERA HANDLING at turn start:
    // - Hot-seat multiplayer: center on current player's team (prevents screen-cheating)
    // - AI turn with human watching: DON'T move camera (stay on human's last view)
    // - Spectator mode (all AI): center on current AI's team to follow the action
    if (isAIPlayer() && !isSpectatorMode()) {
        // AI is playing but a human player exists - keep camera on human's position
        // This prevents the camera from scrolling away to enemy positions
    } else {
        // Human player's turn OR spectator mode - center on current player's team
        centerOnTeam(state.currentPlayer, 0); // Instant centering (duration=0)
    }

    // Check if this is an AI player
    if (isAIPlayer()) {
        // Skip turn screen for AI, go directly to game
        showScreen(null);
        updateUI();
        render();

        // Reset transition flag - AI turn is starting
        state.turnTransitionInProgress = false;

        // Start watchdog timer - ensures AI turn ALWAYS completes
        // This is a backup safety in case executeAITurn() fails or never starts
        startAIWatchdog();

        // Execute AI turn after short delay
        setTimeout(() => {
            executeAITurn();
        }, 500);
        return;
    }

    // Play round start sound
    playRoundStart();

    // Show turn screen for human players
    const turnBadge = document.getElementById('turn-badge');
    if (turnBadge) {
        turnBadge.style.backgroundColor = CONFIG.PLAYER_COLORS[state.currentPlayer];
        turnBadge.textContent = state.currentPlayer + 1;
    }

    const turnNum = document.getElementById('turn-num');
    if (turnNum) {
        // Use full player name instead of just number
        turnNum.textContent = getPlayerName(state.currentPlayer);
    }

    // Skip the turn screen for the sole human player after first turn
    // (no need to "pass device" if there's only one human)
    const humanPlayers = [];
    for (let i = 0; i < state.settings.players; i++) {
        if (!isAIPlayer(i)) humanPlayers.push(i);
    }
    const onlyOneHuman = humanPlayers.length === 1;
    const isCurrentHuman = !isAIPlayer();

    if (isCurrentHuman && onlyOneHuman && state.round > 1) {
        // Reset transition flag - human turn is starting
        state.turnTransitionInProgress = false;

        showScreen(null);
        updateUI();
        render();

        // Center on team and zoom to show all units at round start
        requestAnimationFrame(async () => {
            await centerOnTeam(state.currentPlayer, 600);
        });

        // Execute any queued paths after a short delay
        setTimeout(async () => {
            await executeQueuedPathsForPlayer();
        }, 700);
        return;
    }

    // Reset transition flag - human turn is starting (turn screen will be shown)
    state.turnTransitionInProgress = false;

    // Update players alive display before showing turn screen
    updatePlayersAlive();

    showScreen('turn-screen');
}

/**
 * End current turn
 */
export function endTurn() {
    // Clear auto-end timer to prevent double-ending
    clearAutoEndTurnTimer();

    // Prevent race conditions: don't allow multiple turn transitions
    if (state.turnTransitionInProgress) {
        console.warn('endTurn() called while turn transition already in progress - ignoring');
        return;
    }
    state.turnTransitionInProgress = true;

    // Clear AI watchdog since turn is ending normally
    clearAIWatchdog();
    playTurnEnd();
    nextPlayer();
}

/**
 * Move to next player
 */
export function nextPlayer() {
    // Clear AI watchdog since we're moving to next player
    clearAIWatchdog();

    // Prevent race conditions: if called directly (not via endTurn), set the flag
    // This handles the AI watchdog case and recursive calls for eliminated players
    if (!state.turnTransitionInProgress) {
        state.turnTransitionInProgress = true;
    }

    // Update power-up buffs for ending player
    updatePowerupBuffs(state.currentPlayer);

    state.currentPlayer = (state.currentPlayer + 1) % state.settings.players;

    // New round
    if (state.currentPlayer === 0) {
        state.round++;
        resetSpecialAbilities();

        // === TAKTISCHE SYSTEME AKTUALISIEREN ===
        // Unterdrückungsfeuer bereinigen (abgelaufene entfernen)
        cleanupSuppression();

        // Stellung-Halten Status für alle Einheiten aktualisieren
        updateAllHoldPositions();

        // Clear previous round's event
        clearRoundEvent();

        // === SHRINKING ZONE MECHANIK ===
        // Store zone state before processing
        const zoneWasWarning = state.zoneShrinkWarning;
        const zoneRadiusBefore = state.zoneRadius;
        processZoneMechanic();
        const zoneShrunk = state.zoneRadius < zoneRadiusBefore;

        // Roll for new round event
        const event = rollRoundEvent();
        if (event) {
            playEvent();
        }

        // === ROUND START SCREEN ===
        // Build round info for display
        const roundInfo = buildRoundInfo(zoneShrunk, zoneWasWarning, event);
        showRoundStartScreen(roundInfo);

        // Spawn new power-ups periodically
        spawnNewPowerups();

        // Check max rounds
        if (state.round > CONFIG.MAX_ROUNDS) {
            endGame(null);
            return;
        }
    }

    // Skip eliminated players
    const units = getPlayerUnits(state.currentPlayer);
    if (units.length === 0) {
        // Check if game is over
        const result = checkGameOver();
        if (result.gameOver) {
            endGame(result.winner);
            return;
        }

        // Skip to next player
        nextPlayer();
        return;
    }

    startTurn();
}

/**
 * Handle ready button (after turn screen)
 */
export async function handleReady() {
    showScreen(null);
    updateVisibility();
    updateUI();
    render();

    // Play intro flyover on first turn of the game
    if (state.round === 1 && !state.introShown) {
        await playGameIntro();
    } else {
        // Center camera on first unit
        requestAnimationFrame(() => {
            centerOnCurrentUnit();
        });
    }
}

/**
 * End the game
 * @param {number|null} winner - Winning player index or null for draw
 * @param {Object} result - Optional result object from checkGameOver (for team victories)
 */
export function endGame(winner, result = null) {
    state.gameOver = true;

    // Stop ambient sounds
    stopAmbient();

    // Play victory or defeat sound
    if (winner !== null) {
        // Check if winner is human or AI
        const winnerIsAI = isAIPlayer(winner);
        // If there are any human players and the winner is AI, play defeat
        // Otherwise play victory
        const hasHumans = state.settings.aiPlayers.length < state.settings.players;
        if (hasHumans && winnerIsAI) {
            playDefeat();
        } else {
            playVictory();
        }
    } else {
        playDefeat();  // Draw
    }

    const winnerText = document.getElementById('winner-text');
    if (winnerText) {
        if (winner !== null) {
            // === TEAM-SIEG ANZEIGE ===
            if (result && result.isTeamVictory && hasAlliances()) {
                const teamPlayers = getPlayersInTeam(result.winningTeam);
                if (teamPlayers.length > 1) {
                    // Team-Sieg: Zeige alle Spieler des Teams
                    const playerNames = teamPlayers.map(p => getPlayerName(p)).join(' & ');
                    winnerText.innerHTML = `🏆 TEAM GEWINNT!<br><span style="font-size: 0.8em">${playerNames}</span>`;
                    // Mische die Farben der Sieger
                    winnerText.style.color = CONFIG.PLAYER_COLORS[teamPlayers[0]];
                } else {
                    winnerText.textContent = `${getPlayerName(winner)} gewinnt!`;
                    winnerText.style.color = CONFIG.PLAYER_COLORS[winner];
                }
            } else {
                winnerText.textContent = `${getPlayerName(winner)} gewinnt!`;
                winnerText.style.color = CONFIG.PLAYER_COLORS[winner];
            }
        } else {
            winnerText.textContent = 'Unentschieden!';
            winnerText.style.color = '#e2e8f0';
        }
    }

    // Display awards/Siegerehrung
    displayAwards(winner);

    showScreen('gameover');
}

/**
 * Check and handle win condition
 */
export function checkWinCondition() {
    const result = checkGameOver();
    if (result.gameOver) {
        // Show announcement toast before game over screen
        if (result.winner !== null) {
            // === TEAM-SIEG TOAST ===
            if (result.isTeamVictory && hasAlliances()) {
                const teamPlayers = getPlayersInTeam(result.winningTeam);
                if (teamPlayers.length > 1) {
                    const playerNames = teamPlayers.map(p => getPlayerName(p)).join(' & ');
                    showToast(`🏆 TEAM GEWINNT! (${playerNames})`, 'levelup');
                } else {
                    showToast(`🏆 ${getPlayerName(result.winner).toUpperCase()} GEWINNT!`, 'levelup');
                }
            } else {
                showToast(`🏆 ${getPlayerName(result.winner).toUpperCase()} GEWINNT!`, 'levelup');
            }
        } else {
            showToast('⚖️ UNENTSCHIEDEN!', 'special');
        }
        setTimeout(() => endGame(result.winner, result), 1500);
        return true;
    }
    return false;
}

// === ROUND START SCREEN ===

/**
 * Build round info object for the round start screen
 */
function buildRoundInfo(zoneShrunk, zoneWasWarning, event) {
    // Build player info
    const players = [];
    for (let p = 0; p < state.settings.players; p++) {
        const units = getPlayerUnits(p);
        const aliveUnits = units.filter(u => u.alive);
        players.push({
            name: getPlayerName(p),
            color: CONFIG.PLAYER_COLORS[p],
            units: aliveUnits.length,
            alive: aliveUnits.length > 0,
            isCurrentPlayer: p === 0 // First player starts
        });
    }

    // Build zone info
    let zone = null;
    if (state.maxZoneRadius > 0) {
        if (zoneShrunk) {
            zone = {
                shrinking: true,
                warning: false,
                text: `Zone geschrumpft! Neuer Radius: ${state.zoneRadius} Felder`
            };
        } else if (zoneWasWarning) {
            zone = {
                shrinking: false,
                warning: true,
                text: 'Zone schrumpft bald! Sucht den Feind!'
            };
        } else if (state.zoneRadius < state.maxZoneRadius) {
            zone = {
                shrinking: false,
                warning: false,
                text: `Zone-Radius: ${state.zoneRadius} Felder`
            };
        }
    }

    return {
        round: state.round,
        players,
        zone,
        event: event ? { icon: event.icon, name: event.name } : null,
        duration: zoneShrunk ? 3000 : 2500 // Longer display if zone shrunk
    };
}

// === SHRINKING ZONE MECHANIK ===

/**
 * Process the shrinking zone mechanic at the start of each new round
 */
function processZoneMechanic() {
    // Nur aktiv wenn Zone initialisiert wurde
    if (state.maxZoneRadius === 0) return;

    const roundsWithoutCombat = state.round - state.lastCombatRound;

    // === 1. VERSTECKTE EINHEITEN AUFDECKEN ===
    // Alle X Runden ohne Kampf werden getarnte Einheiten kurz aufgedeckt
    if (roundsWithoutCombat > 0 && roundsWithoutCombat % ZONE_CONFIG.REVEAL_INTERVAL === 0) {
        revealAllStealthedUnits();
    }

    // === 2. WARNUNG VOR ZONE-SCHRUMPFUNG ===
    const roundsUntilShrink = ZONE_CONFIG.ROUNDS_BEFORE_SHRINK - roundsWithoutCombat;

    if (roundsUntilShrink === ZONE_CONFIG.WARNING_ROUNDS && state.zoneRadius > ZONE_CONFIG.MIN_ZONE_RADIUS) {
        state.zoneShrinkWarning = true;
        // Zone warning is now shown in the round start screen
    }

    // === 3. ZONE SCHRUMPFEN ===
    if (roundsWithoutCombat >= ZONE_CONFIG.ROUNDS_BEFORE_SHRINK) {
        shrinkZone();
    }

    // === 4. SCHADEN AN EINHEITEN AUSSERHALB DER ZONE ===
    applyZoneDamage();
}

/**
 * Reveal all stealthed/cloaked units temporarily
 */
function revealAllStealthedUnits() {
    let revealed = 0;

    state.units.forEach(unit => {
        if (!unit.alive) return;

        if (unit.cloaked || unit.hiding) {
            unit.cloaked = false;
            unit.hiding = false;
            unit.revealedByZone = true; // Marker für temporäre Enthüllung
            revealed++;
        }
    });

    if (revealed > 0) {
        showToast(`👁️ AUFKLÄRUNG! ${revealed} versteckte Einheit${revealed > 1 ? 'en' : ''} aufgedeckt!`, 'special');

        // Visibility aktualisieren
        setTimeout(() => {
            updateVisibility();
            render();
        }, 500);
    }
}

/**
 * Shrink the playable zone
 */
function shrinkZone() {
    if (state.zoneRadius <= ZONE_CONFIG.MIN_ZONE_RADIUS) {
        // Zone ist bereits minimal - stattdessen öfter Einheiten aufdecken
        revealAllStealthedUnits();
        return;
    }

    const oldRadius = state.zoneRadius;
    state.zoneRadius = Math.max(
        ZONE_CONFIG.MIN_ZONE_RADIUS,
        state.zoneRadius - ZONE_CONFIG.SHRINK_AMOUNT
    );

    state.zonePhase++;
    state.zoneShrinkWarning = false;

    // Reset Kampf-Timer nach Schrumpfung (gibt Spielern Zeit zu reagieren)
    state.lastCombatRound = state.round;
    // Zone shrink info is now shown in the round start screen
}

/**
 * Apply damage to units outside the safe zone
 * First tries to displace units inward, then applies damage if they can't move
 */
function applyZoneDamage() {
    if (state.zoneRadius >= state.maxZoneRadius) return; // Zone noch nicht geschrumpft

    // First, try to displace units in the danger zone inward
    displaceUnitsFromDangerZone();

    // Now apply damage to any remaining units outside the zone
    let unitsHit = 0;
    let unitsKilled = 0;

    state.units.forEach(unit => {
        if (!unit.alive) return;

        if (!isHexInZone(unit.q, unit.r)) {
            const damage = ZONE_CONFIG.ZONE_DAMAGE;
            unit.currentHp -= damage;
            unitsHit++;

            if (unit.currentHp <= 0) {
                killUnit(unit);
                unitsKilled++;
            }
        }
    });

    // Single consolidated toast for zone damage
    if (unitsHit > 0) {
        if (unitsKilled > 0) {
            showToast(`☢️ Zonenschaden! ${unitsKilled} eliminiert!`, 'miss');
        } else {
            showToast(`☢️ ${unitsHit} Einheit${unitsHit > 1 ? 'en' : ''}: Zonenschaden!`, 'miss');
        }
    }

    // Prüfe Spielende nach Zonenschaden
    const result = checkGameOver();
    if (result.gameOver) {
        setTimeout(() => endGame(result.winner), 1000);
    }
}

/**
 * Displace units from the danger zone inward
 * Units are moved to the nearest valid hex inside the safe zone
 * Never places units on top of each other
 */
function displaceUnitsFromDangerZone() {
    // Get all units outside the safe zone
    const unitsInDanger = state.units.filter(unit =>
        unit.alive && !isHexInZone(unit.q, unit.r)
    );

    if (unitsInDanger.length === 0) return;

    let unitsMoved = 0;

    // Sort units by distance from center (furthest first to prevent blocking)
    unitsInDanger.sort((a, b) => {
        const distA = Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(-a.q - a.r));
        const distB = Math.max(Math.abs(b.q), Math.abs(b.r), Math.abs(-b.q - b.r));
        return distB - distA;
    });

    for (const unit of unitsInDanger) {
        const newPos = findSafeHexForUnit(unit);
        if (newPos) {
            // Move unit to new position
            const oldHex = state.hexMap.get(`${unit.q},${unit.r}`);
            if (oldHex) {
                oldHex.unit = null;
            }

            unit.q = newPos.q;
            unit.r = newPos.r;

            const newHex = state.hexMap.get(`${unit.q},${unit.r}`);
            if (newHex) {
                newHex.unit = unit;
            }

            unitsMoved++;
        }
    }

    if (unitsMoved > 0) {
        showToast(`⚡ ${unitsMoved} Einheit${unitsMoved > 1 ? 'en' : ''} wurde${unitsMoved > 1 ? 'n' : ''} in sichere Zone versetzt!`, 'special');
    }
}

/**
 * Find the nearest safe hex for a unit to be displaced to
 * Returns null if no valid hex is found
 */
function findSafeHexForUnit(unit) {
    // Get all hexes inside the safe zone
    const safeHexes = [];
    state.hexes.forEach(hex => {
        if (isHexInZone(hex.q, hex.r) && hex.walkable && !hex.unit) {
            // Calculate distance from unit's current position
            const distFromUnit = Math.abs(hex.q - unit.q) + Math.abs(hex.r - unit.r) +
                Math.abs((-hex.q - hex.r) - (-unit.q - unit.r));
            safeHexes.push({
                q: hex.q,
                r: hex.r,
                dist: distFromUnit / 2 // Proper hex distance
            });
        }
    });

    // Sort by distance (nearest first)
    safeHexes.sort((a, b) => a.dist - b.dist);

    // Return the nearest unoccupied safe hex
    for (const hex of safeHexes) {
        // Double-check it's not occupied (in case another unit was just moved there)
        const hexData = state.hexMap.get(`${hex.q},${hex.r}`);
        if (hexData && hexData.walkable && !hexData.unit) {
            return { q: hex.q, r: hex.r };
        }
    }

    return null; // No valid position found
}

/**
 * Get current zone info for UI display
 */
export function getZoneInfo() {
    if (state.maxZoneRadius === 0) return null;

    const roundsWithoutCombat = state.round - state.lastCombatRound;
    const roundsUntilShrink = Math.max(0, ZONE_CONFIG.ROUNDS_BEFORE_SHRINK - roundsWithoutCombat);

    return {
        currentRadius: state.zoneRadius,
        maxRadius: state.maxZoneRadius,
        phase: state.zonePhase,
        roundsUntilShrink,
        isWarning: state.zoneShrinkWarning,
        roundsWithoutCombat
    };
}

// ===== AUTO END TURN =====

// Timer ID for auto-end turn (to prevent double-ending)
let autoEndTurnTimerId = null;

/**
 * Clear the auto-end turn timer
 */
function clearAutoEndTurnTimer() {
    if (autoEndTurnTimerId !== null) {
        clearTimeout(autoEndTurnTimerId);
        autoEndTurnTimerId = null;
    }
}

/**
 * Auto-end turn when all AP is depleted
 * Shows a brief notification before ending
 */
function autoEndTurn() {
    // Don't auto-end during AI turns or if game is over
    if (state.gameOver) return;
    if (isAIPlayer()) return;

    // Double-check AP is actually 0
    if (state.sharedAP > 0) return;

    // Clear any existing timer first
    clearAutoEndTurnTimer();

    showToast('⚡ Alle AP verbraucht - Zug wird beendet', 'info');
    autoEndTurnTimerId = setTimeout(() => {
        autoEndTurnTimerId = null;
        endTurn();
    }, 1000);
}

// Set up the callback for auto-end turn
setOnAPDepletedCallback(autoEndTurn);
