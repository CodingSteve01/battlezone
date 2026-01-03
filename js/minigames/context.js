// ===== MINIGAME DIFFICULTY CONTEXT =====
// Calculate difficulty modifiers based on game state

import { hexDistance } from '../hexMath.js';
import { CONFIG } from '../config.js';

/**
 * @typedef {Object} MinigameContext
 * @property {Object} attacker - Attacking unit
 * @property {Object} target - Target unit
 * @property {number} distance - Distance to target
 * @property {boolean} hasCover - Target has cover
 * @property {boolean} isHealing - Is this a healing action
 * @property {number} [healTargetCount] - Number of units to heal
 */

/**
 * @typedef {Object} DifficultyModifiers
 * @property {number} speedMultiplier - Target/animation speed
 * @property {number} sizeMultiplier - Target size
 * @property {number} durationMultiplier - Game duration
 * @property {number} toleranceMultiplier - Timing tolerance
 */

/**
 * Calculate difficulty modifiers for a minigame
 * @param {string} unitClass - Class of the acting unit
 * @param {MinigameContext} context - Game context
 * @returns {DifficultyModifiers}
 */
export function calculateDifficultyModifiers(unitClass, context) {
    const mods = {
        speedMultiplier: 1.0,
        sizeMultiplier: 1.0,
        durationMultiplier: 1.0,
        toleranceMultiplier: 1.0
    };

    if (!context) return mods;

    const { attacker, target, distance, hasCover, isHealing, healTargetCount } = context;

    // Distance affects difficulty
    if (distance !== undefined) {
        const maxRange = attacker?.range || 4;
        const distanceFactor = distance / maxRange;

        // Longer distance = harder (faster targets, smaller zones)
        mods.speedMultiplier += distanceFactor * 0.3;
        mods.sizeMultiplier -= distanceFactor * 0.2;
    }

    // Cover makes it harder
    if (hasCover) {
        mods.speedMultiplier += 0.15;
        mods.sizeMultiplier -= 0.1;
        mods.toleranceMultiplier -= 0.1;
    }

    // Class-specific adjustments
    switch (unitClass) {
        case 'scout':
            // Scout reflex game - affected by target movement
            if (target?.cloaked) {
                mods.speedMultiplier += 0.3;
                mods.sizeMultiplier -= 0.2;
            }
            break;

        case 'assault':
            // Assault power meter - steady timing
            // Wounded assault has shakier aim
            if (attacker && attacker.currentHp < attacker.maxHp * 0.5) {
                mods.speedMultiplier += 0.2;
            }
            break;

        case 'sniper':
            // Sniper steady aim - affected by distance and stability
            // Hills give stability bonus
            if (context.attackerOnHills) {
                mods.speedMultiplier -= 0.15;
                mods.toleranceMultiplier += 0.1;
            }
            // Wounded sniper has more wobble
            if (attacker && attacker.currentHp < attacker.maxHp * 0.5) {
                mods.speedMultiplier += 0.25;
            }
            break;

        case 'commando':
            // Commando melee - affected by target type
            if (target?.class === 'assault') {
                // Harder against tanky targets
                mods.speedMultiplier += 0.15;
            }
            break;

        case 'medic':
            if (isHealing) {
                // Healing multiple targets is harder
                if (healTargetCount && healTargetCount > 2) {
                    mods.speedMultiplier += 0.1;
                    mods.durationMultiplier += 0.3;
                }
            }
            break;

        case 'elitesoldat':
            // Elite has bonus precision
            mods.toleranceMultiplier += 0.15;
            mods.sizeMultiplier += 0.1;
            break;
    }

    // Clamp values
    mods.speedMultiplier = Math.max(0.5, Math.min(2.0, mods.speedMultiplier));
    mods.sizeMultiplier = Math.max(0.5, Math.min(1.5, mods.sizeMultiplier));
    mods.durationMultiplier = Math.max(0.7, Math.min(1.5, mods.durationMultiplier));
    mods.toleranceMultiplier = Math.max(0.5, Math.min(1.5, mods.toleranceMultiplier));

    return mods;
}

/**
 * Get base difficulty settings for a unit class
 */
export function getBaseDifficulty(unitClass) {
    const defaults = {
        scout: {
            targetSpeed: 200,
            targetSize: 40,
            duration: 3000,
            perfectWindow: 0.15
        },
        assault: {
            barSpeed: 300,
            perfectZoneSize: 0.15,
            goodZoneSize: 0.3,
            duration: 2500
        },
        sniper: {
            wobbleIntensity: 30,
            stillMomentDuration: 400,
            holdTime: 500,
            duration: 4000
        },
        commando: {
            swipeCount: 4,
            swipeTimeout: 800,
            duelRounds: 3
        },
        medic: {
            beatInterval: 800,
            perfectWindow: 100,
            goodWindow: 200,
            beatCount: 5
        },
        elitesoldat: {
            // Uses assault or sniper minigame randomly
            perfectBonus: 0.1
        }
    };

    return defaults[unitClass] || defaults.assault;
}
