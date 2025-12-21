// ===== PROGRESSION SYSTEM (XP, Levels, Critical Hits) =====

import { state } from './state.js';
import { CONFIG } from './config.js';

// XP required for each level
export const XP_LEVELS = [0, 50, 120, 200, 300];

// Level up bonuses
const LEVEL_BONUSES = {
    1: { hp: 0, damage: 0, name: 'Rekrut' },
    2: { hp: 10, damage: 3, name: 'Soldat' },
    3: { hp: 20, damage: 6, name: 'Veteran' },
    4: { hp: 35, damage: 10, name: 'Elite' },
    5: { hp: 50, damage: 15, name: 'Legende' }
};

/**
 * Initialize progression for a unit
 */
export function initUnitProgression(unit) {
    unit.xp = 0;
    unit.level = 1;
    unit.kills = 0;
    unit.damageDealt = 0;
}

/**
 * Award XP to a unit
 */
export function awardXP(unit, amount, reason) {
    if (!unit.alive) return null;

    unit.xp = (unit.xp || 0) + amount;

    // Check for level up
    const newLevel = calculateLevel(unit.xp);
    if (newLevel > (unit.level || 1)) {
        return levelUp(unit, newLevel);
    }

    return null;
}

/**
 * Calculate level from XP
 */
function calculateLevel(xp) {
    for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
        if (xp >= XP_LEVELS[i]) {
            return i + 1;
        }
    }
    return 1;
}

/**
 * Level up a unit
 */
function levelUp(unit, newLevel) {
    const oldLevel = unit.level || 1;
    unit.level = newLevel;

    const bonus = LEVEL_BONUSES[newLevel];

    // Apply cumulative bonuses
    const totalHpBonus = bonus.hp;
    const totalDamageBonus = bonus.damage;

    unit.maxHp += (bonus.hp - (LEVEL_BONUSES[oldLevel]?.hp || 0));
    unit.currentHp += (bonus.hp - (LEVEL_BONUSES[oldLevel]?.hp || 0));
    unit.baseDamageBonus = totalDamageBonus;

    return {
        unit,
        oldLevel,
        newLevel,
        bonus,
        rank: bonus.name
    };
}

/**
 * Get unit's effective damage (base + bonuses)
 */
export function getEffectiveDamage(unit) {
    let damage = unit.damage;

    // Level bonus
    if (unit.baseDamageBonus) {
        damage += unit.baseDamageBonus;
    }

    // Power-up bonus
    if (unit.damageBoost) {
        damage += unit.damageBoost;
    }

    return damage;
}

/**
 * Calculate critical hit
 */
export function calculateCritical(attacker, defender) {
    // Base crit chance: 10%
    let critChance = 0.10;

    // Scout has higher crit chance
    if (attacker.class === 'scout') {
        critChance += 0.10;
    }

    // Level bonus to crit
    critChance += (attacker.level || 1) * 0.02;

    // Forest cover reduces crit chance on defender
    const defenderHex = state.hexes.find(h => h.q === defender.q && h.r === defender.r);
    if (defenderHex?.cover) {
        critChance -= 0.05;
    }

    const isCrit = Math.random() < critChance;
    const critMultiplier = isCrit ? 1.5 : 1.0;

    return {
        isCrit,
        multiplier: critMultiplier,
        chance: critChance
    };
}

/**
 * XP rewards
 */
export const XP_REWARDS = {
    KILL: 50,
    DAMAGE_PER_10: 5,    // 5 XP per 10 damage dealt
    ASSIST: 20,
    HEAL: 15,
    CAPTURE: 10,
    SURVIVE_ROUND: 5
};

/**
 * Track damage for assist XP
 */
export function trackDamage(attacker, defender, damage) {
    if (!defender.damagedBy) {
        defender.damagedBy = new Map();
    }

    const current = defender.damagedBy.get(attacker.id) || 0;
    defender.damagedBy.set(attacker.id, current + damage);

    // Award damage XP
    const xpForDamage = Math.floor(damage / 10) * XP_REWARDS.DAMAGE_PER_10;
    if (xpForDamage > 0) {
        awardXP(attacker, xpForDamage, 'damage');
    }

    attacker.damageDealt = (attacker.damageDealt || 0) + damage;
}

/**
 * Award kill and assist XP
 */
export function awardKillXP(killer, victim) {
    // Award kill XP
    killer.kills = (killer.kills || 0) + 1;
    const levelUpResult = awardXP(killer, XP_REWARDS.KILL, 'kill');

    const results = [];
    if (levelUpResult) {
        results.push(levelUpResult);
    }

    // Award assist XP to others who damaged the victim
    if (victim.damagedBy) {
        for (const [attackerId, damage] of victim.damagedBy) {
            if (attackerId !== killer.id) {
                const assister = state.units.find(u => u.id === attackerId);
                if (assister && assister.alive) {
                    const assistResult = awardXP(assister, XP_REWARDS.ASSIST, 'assist');
                    if (assistResult) {
                        results.push(assistResult);
                    }
                }
            }
        }
    }

    return results;
}

/**
 * Get XP progress to next level
 */
export function getXPProgress(unit) {
    const level = unit.level || 1;
    const currentXP = unit.xp || 0;

    if (level >= XP_LEVELS.length) {
        return { current: currentXP, required: currentXP, progress: 1, maxLevel: true };
    }

    const currentLevelXP = XP_LEVELS[level - 1];
    const nextLevelXP = XP_LEVELS[level];
    const progressXP = currentXP - currentLevelXP;
    const requiredXP = nextLevelXP - currentLevelXP;

    return {
        current: progressXP,
        required: requiredXP,
        progress: progressXP / requiredXP,
        maxLevel: false
    };
}

/**
 * Get rank name for level
 */
export function getRankName(level) {
    return LEVEL_BONUSES[level]?.name || 'Rekrut';
}
