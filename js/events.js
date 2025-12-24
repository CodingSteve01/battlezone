// ===== ROUND EVENTS SYSTEM =====

import { state, getHex } from './state.js';
import { CONFIG, TERRAIN } from './config.js';

// Event types with their effects
export const ROUND_EVENTS = {
    none: {
        name: null,
        icon: null,
        description: null,
        effect: () => {}
    },
    reinforcement: {
        name: 'Verstärkung',
        icon: '🎁',
        description: 'Alle Einheiten heilen 15 HP!',
        color: '#22c55e',
        effect: () => {
            state.units.forEach(unit => {
                if (unit.alive) {
                    unit.currentHp = Math.min(unit.maxHp, unit.currentHp + 15);
                }
            });
        }
    },
    airdrop: {
        name: 'Luftversorgung',
        icon: '📦',
        description: 'Neue Power-Ups erscheinen!',
        color: '#3b82f6',
        effect: () => {
            // This triggers extra power-up spawn (handled in main game loop)
            state.eventSpawnPowerups = true;
        }
    },
    morale_boost: {
        name: 'Kampfgeist',
        icon: '🔥',
        description: 'Team erhält +3 AP zum Pool!',
        color: '#eab308',
        effect: () => {
            // Add bonus to shared AP pool instead of individual units
            state.sharedAP += 3;
            state.maxSharedAP += 3;  // Also increase max for display
        }
    },
    thick_fog: {
        name: 'Dichter Nebel',
        icon: '🌫️',
        description: 'Sichtweite um 2 reduziert!',
        color: '#9ca3af',
        effect: () => {
            state.fogModifier = -2;
        },
        cleanup: () => {
            state.fogModifier = 0;
        }
    },
    clear_skies: {
        name: 'Klare Sicht',
        icon: '☀️',
        description: 'Sichtweite um 2 erhöht!',
        color: '#fbbf24',
        effect: () => {
            state.fogModifier = 2;
        },
        cleanup: () => {
            state.fogModifier = 0;
        }
    },
    flare: {
        name: 'Leuchtrakete',
        icon: '🔦',
        description: 'Getarnte Einheiten werden kurz sichtbar!',
        color: '#f59e0b',
        effect: () => {
            // Reveal all cloaked units temporarily
            state.units.forEach(unit => {
                if (unit.alive && unit.cloaked) {
                    unit.flareRevealed = true;
                }
            });
            state.flareActive = true;
        },
        cleanup: () => {
            state.units.forEach(unit => {
                unit.flareRevealed = false;
            });
            state.flareActive = false;
        }
    },
    storm: {
        name: 'Gewitter',
        icon: '⛈️',
        description: 'Angriffe haben 20% Fehlschuss-Chance!',
        color: '#6366f1',
        effect: () => {
            state.missChanceModifier = 0.20;
        },
        cleanup: () => {
            state.missChanceModifier = 0;
        }
    },
    second_wind: {
        name: 'Zweiter Atem',
        icon: '💨',
        description: 'Alle Einheiten erhalten +2 Bewegung!',
        color: '#14b8a6',
        effect: () => {
            state.units.forEach(unit => {
                if (unit.alive) {
                    unit.move += 2;
                    unit.secondWindActive = true;
                }
            });
        },
        cleanup: () => {
            state.units.forEach(unit => {
                if (unit.secondWindActive) {
                    unit.move -= 2;
                    unit.secondWindActive = false;
                }
            });
        }
    }
};

// Current active event
let currentEvent = null;

/**
 * Roll for a round event
 */
export function rollRoundEvent() {
    // Clean up previous event
    if (currentEvent && ROUND_EVENTS[currentEvent]?.cleanup) {
        ROUND_EVENTS[currentEvent].cleanup();
    }

    // 40% chance of an event each round (after round 1)
    if (state.round <= 1 || Math.random() > 0.40) {
        currentEvent = 'none';
        state.currentEvent = null;
        return null;
    }

    // Pick random event (excluding 'none')
    const eventTypes = Object.keys(ROUND_EVENTS).filter(e => e !== 'none');
    const selectedType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    currentEvent = selectedType;
    const event = ROUND_EVENTS[selectedType];

    // Apply effect
    event.effect();

    state.currentEvent = {
        type: selectedType,
        ...event
    };

    return state.currentEvent;
}

/**
 * Get current active event
 */
export function getCurrentEvent() {
    return state.currentEvent;
}

/**
 * Clear event at round end
 */
export function clearRoundEvent() {
    if (currentEvent && ROUND_EVENTS[currentEvent]?.cleanup) {
        ROUND_EVENTS[currentEvent].cleanup();
    }
    currentEvent = null;
    state.currentEvent = null;
}

/**
 * Check if attack misses due to event (storm)
 */
export function checkEventMiss(distance = null) {
    if (!state.missChanceModifier) {
        return false;
    }

    let modifier = state.missChanceModifier;
    if (distance !== null) {
        if (distance <= 1) {
            modifier = 0;
        } else if (distance === 2) {
            modifier *= 0.5;
        } else if (distance === 3) {
            modifier *= 0.75;
        }
    }

    return Math.random() < modifier;
}

/**
 * Get fog modifier from events
 */
export function getFogEventModifier() {
    return state.fogModifier || 0;
}
