import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    XP_LEVELS,
    XP_REWARDS,
    initUnitProgression,
    awardXP,
    getEffectiveDamage,
    calculateCritical,
    trackDamage,
    awardKillXP,
    getXPProgress,
    getRankName
} from '../js/progression.js';
import { state, resetState } from '../js/state.js';

describe('progression', () => {
    beforeEach(() => {
        resetState();
        // Reset random for predictable tests
        vi.spyOn(Math, 'random');
    });

    describe('XP_LEVELS', () => {
        it('should have increasing XP requirements', () => {
            for (let i = 1; i < XP_LEVELS.length; i++) {
                expect(XP_LEVELS[i]).toBeGreaterThan(XP_LEVELS[i - 1]);
            }
        });

        it('should start at 0 for level 1', () => {
            expect(XP_LEVELS[0]).toBe(0);
        });
    });

    describe('XP_REWARDS', () => {
        it('should have all reward types defined', () => {
            expect(XP_REWARDS.KILL).toBeGreaterThan(0);
            expect(XP_REWARDS.DAMAGE_PER_10).toBeGreaterThan(0);
            expect(XP_REWARDS.ASSIST).toBeGreaterThan(0);
            expect(XP_REWARDS.HEAL).toBeGreaterThan(0);
        });

        it('KILL should reward more than ASSIST', () => {
            expect(XP_REWARDS.KILL).toBeGreaterThan(XP_REWARDS.ASSIST);
        });
    });

    describe('initUnitProgression', () => {
        it('should initialize unit with level 1 and 0 XP', () => {
            const unit = {};
            initUnitProgression(unit);
            expect(unit.xp).toBe(0);
            expect(unit.level).toBe(1);
            expect(unit.kills).toBe(0);
            expect(unit.damageDealt).toBe(0);
        });
    });

    describe('awardXP', () => {
        it('should add XP to unit', () => {
            const unit = { alive: true, xp: 0, level: 1 };
            awardXP(unit, 25, 'test');
            expect(unit.xp).toBe(25);
        });

        it('should not award XP to dead units', () => {
            const unit = { alive: false, xp: 0, level: 1 };
            const result = awardXP(unit, 25, 'test');
            expect(result).toBeNull();
            expect(unit.xp).toBe(0);
        });

        it('should level up when XP threshold reached', () => {
            const unit = { alive: true, xp: 0, level: 1, maxHp: 100, currentHp: 100 };
            // Level 2 requires 50 XP
            const result = awardXP(unit, 50, 'test');
            expect(unit.level).toBe(2);
            expect(result).not.toBeNull();
            expect(result.newLevel).toBe(2);
        });

        it('should accumulate XP correctly', () => {
            const unit = { alive: true, xp: 0, level: 1 };
            awardXP(unit, 20, 'test');
            awardXP(unit, 15, 'test');
            expect(unit.xp).toBe(35);
        });
    });

    describe('getEffectiveDamage', () => {
        it('should return base damage when no bonuses', () => {
            const unit = { damage: 30 };
            expect(getEffectiveDamage(unit)).toBe(30);
        });

        it('should add level bonus damage', () => {
            const unit = { damage: 30, baseDamageBonus: 5 };
            expect(getEffectiveDamage(unit)).toBe(35);
        });

        it('should add power-up damage boost', () => {
            const unit = { damage: 30, damageBoost: 10 };
            expect(getEffectiveDamage(unit)).toBe(40);
        });

        it('should combine all bonuses', () => {
            const unit = { damage: 30, baseDamageBonus: 5, damageBoost: 10 };
            expect(getEffectiveDamage(unit)).toBe(45);
        });
    });

    describe('calculateCritical', () => {
        it('should return crit object with required properties', () => {
            const attacker = { class: 'assault', level: 1, q: 0, r: 0 };
            const defender = { q: 1, r: 0 };

            const result = calculateCritical(attacker, defender);
            expect(result).toHaveProperty('isCrit');
            expect(result).toHaveProperty('multiplier');
            expect(result).toHaveProperty('chance');
        });

        it('should have 1.5x multiplier on crit', () => {
            Math.random.mockReturnValue(0); // Force crit
            const attacker = { class: 'assault', level: 1, q: 0, r: 0 };
            const defender = { q: 1, r: 0 };

            const result = calculateCritical(attacker, defender);
            expect(result.isCrit).toBe(true);
            expect(result.multiplier).toBe(1.5);
        });

        it('should have 1.0x multiplier on non-crit', () => {
            Math.random.mockReturnValue(0.99); // Force no crit
            const attacker = { class: 'assault', level: 1, q: 0, r: 0 };
            const defender = { q: 1, r: 0 };

            const result = calculateCritical(attacker, defender);
            expect(result.isCrit).toBe(false);
            expect(result.multiplier).toBe(1.0);
        });

        it('scout should have higher crit chance', () => {
            const scout = { class: 'scout', level: 1, q: 0, r: 0 };
            const assault = { class: 'assault', level: 1, q: 0, r: 0 };
            const defender = { q: 1, r: 0 };

            const scoutResult = calculateCritical(scout, defender);
            const assaultResult = calculateCritical(assault, defender);

            expect(scoutResult.chance).toBeGreaterThan(assaultResult.chance);
        });

        it('higher level should increase crit chance', () => {
            const lowLevel = { class: 'assault', level: 1, q: 0, r: 0 };
            const highLevel = { class: 'assault', level: 5, q: 0, r: 0 };
            const defender = { q: 1, r: 0 };

            const lowResult = calculateCritical(lowLevel, defender);
            const highResult = calculateCritical(highLevel, defender);

            expect(highResult.chance).toBeGreaterThan(lowResult.chance);
        });
    });

    describe('trackDamage', () => {
        it('should initialize damagedBy map on defender', () => {
            const attacker = { id: 'att-1', alive: true, xp: 0, level: 1 };
            const defender = { id: 'def-1' };

            trackDamage(attacker, defender, 20);
            expect(defender.damagedBy).toBeInstanceOf(Map);
        });

        it('should track damage per attacker', () => {
            const attacker = { id: 'att-1', alive: true, xp: 0, level: 1 };
            const defender = { id: 'def-1' };

            trackDamage(attacker, defender, 20);
            trackDamage(attacker, defender, 15);

            expect(defender.damagedBy.get('att-1')).toBe(35);
        });

        it('should update attacker damageDealt', () => {
            const attacker = { id: 'att-1', alive: true, xp: 0, level: 1 };
            const defender = { id: 'def-1' };

            trackDamage(attacker, defender, 30);
            expect(attacker.damageDealt).toBe(30);
        });

        it('should award XP for damage dealt', () => {
            const attacker = { id: 'att-1', alive: true, xp: 0, level: 1 };
            const defender = { id: 'def-1' };

            trackDamage(attacker, defender, 25);
            // 25 damage = 2 * DAMAGE_PER_10 XP (for 20 damage worth)
            expect(attacker.xp).toBe(2 * XP_REWARDS.DAMAGE_PER_10);
        });
    });

    describe('awardKillXP', () => {
        beforeEach(() => {
            state.units = [];
        });

        it('should increment killer kills count', () => {
            const killer = { id: 'killer', alive: true, xp: 0, level: 1, kills: 0 };
            const victim = { id: 'victim' };

            awardKillXP(killer, victim);
            expect(killer.kills).toBe(1);
        });

        it('should award kill XP', () => {
            const killer = { id: 'killer', alive: true, xp: 0, level: 1, kills: 0 };
            const victim = { id: 'victim' };

            awardKillXP(killer, victim);
            expect(killer.xp).toBe(XP_REWARDS.KILL);
        });

        it('should award assist XP to other attackers', () => {
            const killer = { id: 'killer', alive: true, xp: 0, level: 1, kills: 0 };
            const assister = { id: 'assister', alive: true, xp: 0, level: 1 };
            const victim = {
                id: 'victim',
                damagedBy: new Map([['killer', 50], ['assister', 30]])
            };

            state.units = [killer, assister, victim];

            awardKillXP(killer, victim);
            expect(assister.xp).toBe(XP_REWARDS.ASSIST);
        });
    });

    describe('getXPProgress', () => {
        it('should calculate progress for level 1', () => {
            const unit = { level: 1, xp: 25 };
            const progress = getXPProgress(unit);

            expect(progress.current).toBe(25);
            expect(progress.required).toBe(50); // Level 2 at 50 XP
            expect(progress.progress).toBe(0.5);
            expect(progress.maxLevel).toBe(false);
        });

        it('should handle max level', () => {
            const unit = { level: 5, xp: 500 };
            const progress = getXPProgress(unit);

            expect(progress.maxLevel).toBe(true);
            expect(progress.progress).toBe(1);
        });
    });

    describe('getRankName', () => {
        it('should return correct rank for each level', () => {
            expect(getRankName(1)).toBe('Rekrut');
            expect(getRankName(2)).toBe('Soldat');
            expect(getRankName(3)).toBe('Veteran');
            expect(getRankName(4)).toBe('Elite');
            expect(getRankName(5)).toBe('Legende');
        });

        it('should return Rekrut for invalid level', () => {
            expect(getRankName(0)).toBe('Rekrut');
            expect(getRankName(99)).toBe('Rekrut');
        });
    });
});
