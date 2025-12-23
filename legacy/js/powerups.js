// ===== POWER-UP SYSTEM =====

import { state, getHex } from './state.js';
import { CONFIG } from './config.js';

// Power-up types with their effects
export const POWERUP_TYPES = {
    health: {
        name: 'Heilpaket',
        icon: '💊',
        color: '#22c55e',
        description: '+40 HP',
        effect: (unit) => {
            const healAmount = 40;
            const oldHp = unit.currentHp;
            unit.currentHp = Math.min(unit.maxHp, unit.currentHp + healAmount);
            return { type: 'heal', amount: unit.currentHp - oldHp };
        }
    },
    damage: {
        name: 'Waffenöl',
        icon: '⚔️',
        color: '#ef4444',
        description: '+15 Schaden für 2 Runden',
        effect: (unit) => {
            unit.damageBoost = (unit.damageBoost || 0) + 15;
            unit.damageBoostRounds = 2;
            return { type: 'buff', stat: 'damage', amount: 15, duration: 2 };
        }
    },
    ap: {
        name: 'Energiegetränk',
        icon: '⚡',
        color: '#eab308',
        description: '+2 AP sofort',
        effect: (unit) => {
            // Add to shared AP pool instead of unit AP
            state.sharedAP += 2;
            return { type: 'ap', amount: 2 };
        }
    },
    shield: {
        name: 'Schutzschild',
        icon: '🛡️',
        color: '#3b82f6',
        description: 'Blockiert nächsten Angriff',
        effect: (unit) => {
            unit.shield = true;
            return { type: 'shield' };
        }
    },
    speed: {
        name: 'Adrenalin',
        icon: '🏃',
        color: '#a855f7',
        description: '+2 Bewegung für diesen Zug',
        effect: (unit) => {
            unit.move += 2;
            unit.speedBoostTemp = true;
            return { type: 'buff', stat: 'move', amount: 2, duration: 1 };
        }
    }
};

/**
 * Generate power-ups on the map
 */
export function generatePowerups() {
    state.powerups = [];

    const radius = CONFIG.MAP_SIZES[state.settings.size];
    const powerupCount = Math.floor(radius / 2) + 2; // More power-ups on larger maps

    const types = Object.keys(POWERUP_TYPES);
    const occupiedPositions = new Set();

    // Mark spawn positions as occupied
    state.units.forEach(unit => {
        occupiedPositions.add(`${unit.q},${unit.r}`);
        // Also block adjacent hexes to spawns
        const neighbors = getNeighborCoords(unit.q, unit.r);
        neighbors.forEach(n => occupiedPositions.add(`${n.q},${n.r}`));
    });

    let attempts = 0;
    while (state.powerups.length < powerupCount && attempts < 100) {
        attempts++;

        // Random position within map
        const q = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
        const r = Math.floor(Math.random() * (radius * 2 + 1)) - radius;

        const key = `${q},${r}`;
        const hex = getHex(q, r);

        // Check valid placement
        if (!hex || !hex.walkable || occupiedPositions.has(key)) {
            continue;
        }

        occupiedPositions.add(key);

        const type = types[Math.floor(Math.random() * types.length)];

        state.powerups.push({
            id: `powerup-${state.powerups.length}`,
            q,
            r,
            type,
            collected: false
        });
    }
}

/**
 * Get neighbor coordinates
 */
function getNeighborCoords(q, r) {
    return [
        { q: q + 1, r: r },
        { q: q - 1, r: r },
        { q: q, r: r + 1 },
        { q: q, r: r - 1 },
        { q: q + 1, r: r - 1 },
        { q: q - 1, r: r + 1 }
    ];
}

/**
 * Check if unit can pick up a power-up at position
 */
export function checkPowerupPickup(unit) {
    if (!state.powerups) return null;

    const powerup = state.powerups.find(p =>
        !p.collected && p.q === unit.q && p.r === unit.r
    );

    if (powerup) {
        return collectPowerup(unit, powerup);
    }

    return null;
}

/**
 * Collect a power-up
 */
function collectPowerup(unit, powerup) {
    powerup.collected = true;

    const powerupType = POWERUP_TYPES[powerup.type];
    const result = powerupType.effect(unit);

    return {
        powerup: powerupType,
        result,
        unit
    };
}

/**
 * Get active power-up at position (for rendering)
 */
export function getPowerupAt(q, r) {
    if (!state.powerups) return null;
    return state.powerups.find(p => !p.collected && p.q === q && p.r === r);
}

/**
 * Update power-up buffs at turn end
 */
export function updatePowerupBuffs(player) {
    state.units.filter(u => u.player === player && u.alive).forEach(unit => {
        // Decrease damage boost duration
        if (unit.damageBoostRounds && unit.damageBoostRounds > 0) {
            unit.damageBoostRounds--;
            if (unit.damageBoostRounds <= 0) {
                unit.damageBoost = 0;
            }
        }

        // Reset temp speed boost
        if (unit.speedBoostTemp) {
            unit.move = UNIT_CLASSES_LOOKUP[unit.class].move;
            unit.speedBoostTemp = false;
        }
    });
}

// Reference to unit classes for resetting
import { UNIT_CLASSES } from './config.js';
const UNIT_CLASSES_LOOKUP = UNIT_CLASSES;

/**
 * Spawn new power-ups during game (every few rounds)
 */
export function spawnNewPowerups() {
    if (!state.powerups) return;

    // Every 3 rounds, spawn 1-2 new power-ups
    if (state.round % 3 === 0) {
        const radius = CONFIG.MAP_SIZES[state.settings.size];
        const types = Object.keys(POWERUP_TYPES);

        const occupiedPositions = new Set();
        state.units.forEach(unit => occupiedPositions.add(`${unit.q},${unit.r}`));
        state.powerups.forEach(p => {
            if (!p.collected) occupiedPositions.add(`${p.q},${p.r}`);
        });

        const newCount = Math.floor(Math.random() * 2) + 1;
        let attempts = 0;
        let added = 0;

        while (added < newCount && attempts < 50) {
            attempts++;

            const q = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
            const r = Math.floor(Math.random() * (radius * 2 + 1)) - radius;

            const key = `${q},${r}`;
            const hex = getHex(q, r);

            if (!hex || !hex.walkable || occupiedPositions.has(key)) {
                continue;
            }

            occupiedPositions.add(key);

            const type = types[Math.floor(Math.random() * types.length)];

            state.powerups.push({
                id: `powerup-${Date.now()}-${added}`,
                q,
                r,
                type,
                collected: false
            });

            added++;
        }
    }
}
