// ===== DAMAGE CALCULATION =====
// Cover mechanics, line of sight, damage reduction

import { state, getHex } from '../state.js';
import { hexDistance, getHexesInRange } from '../hexMath.js';
import { TERRAIN } from '../config.js';

/**
 * Check if attacker has line of sight to target
 */
export function hasLineOfSight(attacker, target) {
    // Simple distance-based LoS for now
    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: target.q, r: target.r }
    );

    // Check for blocking terrain along the line
    const steps = Math.max(dist, 1);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const q = Math.round(attacker.q + (target.q - attacker.q) * t);
        const r = Math.round(attacker.r + (target.r - attacker.r) * t);

        const hex = getHex(q, r);
        if (hex && !hex.walkable) {
            return false; // Blocked by impassable terrain
        }
    }

    return true;
}

/**
 * Calculate line of sight cover (partial blocking)
 */
export function calculateLineOfSightCover(attacker, target) {
    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: target.q, r: target.r }
    );

    let coverCount = 0;
    const steps = Math.max(dist, 1);

    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const q = Math.round(attacker.q + (target.q - attacker.q) * t);
        const r = Math.round(attacker.r + (target.r - attacker.r) * t);

        const hex = getHex(q, r);
        if (hex && hex.cover) {
            coverCount++;
        }
    }

    return coverCount;
}

/**
 * Check if cover is effective against attacker direction
 */
export function isCoverEffectiveAgainstAttacker(defender, attacker) {
    const defenderHex = getHex(defender.q, defender.r);
    if (!defenderHex || !defenderHex.cover) return false;

    // Cover is always effective in this simplified model
    return true;
}

/**
 * Calculate cover effectiveness percentage
 */
export function calculateCoverEffectiveness(defender, attacker) {
    const defenderHex = getHex(defender.q, defender.r);
    if (!defenderHex) return 0;

    let effectiveness = 0;

    // Direct cover from terrain
    if (defenderHex.cover) {
        effectiveness += 0.25; // 25% base cover
    }

    // Hills give defensive bonus
    if (defenderHex.type === 'hills') {
        effectiveness += 0.10; // 10% from elevation
    }

    // Forest gives additional cover
    if (defenderHex.type === 'forest') {
        effectiveness += 0.15; // 15% from forest
    }

    return Math.min(0.5, effectiveness); // Cap at 50%
}

/**
 * Get detailed cover info for UI display
 */
export function getCoverInfo(defender, attacker) {
    const defenderHex = getHex(defender.q, defender.r);
    const terrain = defenderHex ? TERRAIN[defenderHex.type] : null;

    const info = {
        hasCover: false,
        coverType: null,
        hitChanceModifier: 0,
        damageReduction: 0,
        description: ''
    };

    if (!defenderHex) return info;

    if (defenderHex.cover) {
        info.hasCover = true;
        info.coverType = terrain?.name || 'Deckung';
        info.hitChanceModifier = -25;
        info.description = `${info.coverType}: -25% Trefferchance`;
    }

    if (defenderHex.type === 'hills') {
        info.hitChanceModifier -= 10;
        if (info.description) {
            info.description += ', Hügel: -10%';
        } else {
            info.description = 'Hügel: -10% Trefferchance';
        }
    }

    return info;
}

/**
 * Calculate damage reduction from cover
 */
export function calculateCoverDamageReduction(defender, baseDamage) {
    const defenderHex = getHex(defender.q, defender.r);
    if (!defenderHex) return 0;

    let reduction = 0;

    if (defenderHex.cover) {
        reduction += baseDamage * 0.15; // 15% damage reduction
    }

    if (defenderHex.type === 'hills') {
        reduction += baseDamage * 0.05; // 5% from elevation
    }

    return Math.floor(reduction);
}

/**
 * Calculate hold position defense bonus
 */
export function calculateHoldPositionDefense(unit) {
    if (!unit.holdPosition || unit.holdPositionTurns < 1) return 0;

    // +5% defense per turn held, max 15%
    return Math.min(15, unit.holdPositionTurns * 5);
}

/**
 * Called when unit moves - resets hold position
 */
export function onUnitMoved(unit) {
    if (unit.holdPosition) {
        unit.holdPosition = false;
        unit.holdPositionTurns = 0;
    }
}

/**
 * Update hold position for all units at end of turn
 */
export function updateAllHoldPositions(playerIndex) {
    for (const unit of state.units) {
        if (unit.player === playerIndex && unit.alive && unit.holdPosition) {
            unit.holdPositionTurns = (unit.holdPositionTurns || 0) + 1;
        }
    }
}

/**
 * Calculate effective damage after all modifiers
 */
export function calculateEffectiveDamage(attacker, defender, baseDamage) {
    let damage = baseDamage;

    // Cover reduction
    damage -= calculateCoverDamageReduction(defender, baseDamage);

    // Hold position bonus
    const holdBonus = calculateHoldPositionDefense(defender);
    if (holdBonus > 0) {
        damage -= Math.floor(baseDamage * holdBonus / 100);
    }

    // Minimum damage
    return Math.max(1, Math.floor(damage));
}
