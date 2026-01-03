// ===== COMBAT CALCULATIONS =====
// Hit chance, cover, and damage calculations

import { state, getHex, isHexSuppressedForUnit, getHoldPositionBonus } from '../state.js';
import { CONFIG, UNIT_CLASSES, TERRAIN } from '../config.js';
import { hexDistance, hexLine } from '../hexMath.js';

/**
 * Check if there is a clear line of sight between two hex positions
 */
export function hasLineOfSight(fromQ, fromR, toQ, toR) {
    const line = hexLine(
        { q: fromQ, r: fromR },
        { q: toQ, r: toR }
    );

    let forestCount = 0;

    for (let i = 1; i < line.length - 1; i++) {
        const hex = getHex(line[i].q, line[i].r);
        if (hex) {
            if (hex.type === 'rock') {
                return {
                    clear: false,
                    blockedBy: 'rock',
                    blockingHex: { q: line[i].q, r: line[i].r }
                };
            }
            if (hex.type === 'forest') {
                forestCount++;
                if (forestCount >= 2) {
                    return {
                        clear: false,
                        blockedBy: 'forest',
                        blockingHex: { q: line[i].q, r: line[i].r }
                    };
                }
            }
        }
    }

    return { clear: true, blockedBy: null, blockingHex: null };
}

/**
 * Calculate how much cover is on the line of sight
 */
export function calculateLineOfSightCover(attacker, defender) {
    const line = hexLine(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    let coverCount = 0;
    const blockingTerrain = [];

    for (let i = 1; i < line.length - 1; i++) {
        const hex = getHex(line[i].q, line[i].r);
        if (hex) {
            if (hex.type === 'rock') {
                coverCount += 2;
                blockingTerrain.push('rock');
            } else if (hex.type === 'forest') {
                coverCount += 1;
                blockingTerrain.push('forest');
            }
        }
    }

    return {
        hasCover: coverCount > 0,
        hasObstruction: coverCount > 0,
        coverCount,
        blockingTerrain
    };
}

/**
 * Calculate cover effectiveness (0-1)
 */
export function calculateCoverEffectiveness(attacker, defender) {
    const defenderHex = getHex(defender.q, defender.r);
    if (!defenderHex) return 0;

    const terrain = TERRAIN[defenderHex.type];
    let effectiveness = 0;

    if (terrain && terrain.cover) {
        effectiveness = 0.25;
    }

    const losCover = calculateLineOfSightCover(attacker, defender);
    if (losCover.hasCover) {
        effectiveness += Math.min(0.25, losCover.coverCount * 0.1);
    }

    if (defender.hiding) {
        effectiveness += 0.15;
    }

    return Math.min(0.5, effectiveness);
}

/**
 * Calculate hit chance
 */
export function calculateHitChance(attacker, defender) {
    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    const unitRange = attacker.range;

    // Commando always hits
    if (attacker.class === 'commando') {
        return 100;
    }

    // Close range = high hit chance
    if (dist === 1) return 100;
    if (dist === 2) return 98;

    let chance = 95;

    const rangeRatio = dist / unitRange;
    if (rangeRatio > 0.7) {
        const distancePenalty = Math.round((rangeRatio - 0.7) * 67);
        chance -= distancePenalty;
    }

    // Sniper special
    if (attacker.class === 'sniper') {
        if (dist >= 5) {
            chance -= (dist - 4) * 8;
        } else {
            chance += 5;
        }
    }

    // Terrain modifiers
    const attHex = getHex(attacker.q, attacker.r);
    const defHex = getHex(defender.q, defender.r);

    if (attHex && attHex.type === 'hills') {
        chance += 5;
    }

    if (defHex && defHex.type === 'hills') {
        chance -= 5;
    }

    if (attHex && defHex) {
        const heightAdvantage = Math.max(0, (defHex.height ?? 0) - (attHex.height ?? 0));
        if (heightAdvantage > 0) {
            chance -= heightAdvantage * CONFIG.HEIGHT.DEFENSE_BONUS_PER_LEVEL;
        }
    }

    // LOS obstacles at range
    if (dist >= 4) {
        const losInfo = calculateLineOfSightCover(attacker, defender);
        if (losInfo.hasObstruction) {
            chance -= losInfo.coverCount * 5;
        }
    }

    // Cover/hiding
    if (defender.hiding && dist >= 4) {
        const coverEffectiveness = calculateCoverEffectiveness(attacker, defender);
        if (coverEffectiveness > 0) {
            chance -= Math.round(10 * coverEffectiveness);
        }
    }

    // Scout precision bonus
    if (attacker.class === 'scout') {
        chance += 5;
    }

    // Suppression penalty
    if (isHexSuppressedForUnit(attacker.q, attacker.r, attacker)) {
        chance -= 30;
    }

    const minChance = isHexSuppressedForUnit(attacker.q, attacker.r, attacker) ? 50 : 75;
    return Math.min(100, Math.max(minChance, chance));
}

/**
 * Get cover info for UI display
 */
export function getCoverInfo(attacker, defender) {
    const losInfo = calculateLineOfSightCover(attacker, defender);
    const coverEffectiveness = calculateCoverEffectiveness(attacker, defender);
    const distance = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    return {
        hasLineOfSightCover: losInfo.hasObstruction,
        blockingTerrain: losInfo.blockingTerrain,
        isHidingEffective: coverEffectiveness > 0,
        coverEffectiveness: Math.round(coverEffectiveness * 100),
        distance,
        isFlanked: defender.hiding && coverEffectiveness === 0
    };
}

/**
 * Calculate cover damage reduction
 */
export function calculateCoverDamageReduction(attacker, defender) {
    const defHex = getHex(defender.q, defender.r);
    if (!defHex) return 0;

    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    let reduction = 0;

    if (defHex.cover) {
        reduction += 0.15;

        if (defender.hiding) {
            const coverEffectiveness = calculateCoverEffectiveness(attacker, defender);
            reduction += 0.20 * coverEffectiveness;
        }
    }

    if (dist >= 4 && attacker.class !== 'sniper') {
        reduction += (dist - 3) * 0.05;
    }

    if (defHex.type === 'hills') {
        reduction += 0.10;
    }

    if (dist >= 3) {
        const losInfo = calculateLineOfSightCover(attacker, defender);
        if (losInfo.hasObstruction) {
            reduction += losInfo.coverCount * 0.08;
        }
    }

    // Assault armor piercing
    if (attacker.class === 'assault') {
        const armorPiercing = UNIT_CLASSES.assault.armorPiercing || 0.5;
        reduction *= (1 - armorPiercing);
    }

    // Hold position bonus
    const holdBonus = getHoldPositionBonus(defender.id);
    if (holdBonus > 0) {
        reduction += holdBonus;
    }

    return Math.min(0.60, reduction);
}
