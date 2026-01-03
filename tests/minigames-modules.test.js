import { describe, it, expect } from 'vitest';

import {
    RESULT_LEVELS,
    RESULT_MULTIPLIERS,
    HEALING_RESULT_MULTIPLIERS,
    MINIGAME_DESCRIPTIONS,
    TAP_COOLDOWN_MS
} from '../js/minigames/constants.js';

import { calculateDifficultyModifiers } from '../js/minigames/difficulty.js';

describe('Minigames Constants Module', () => {
    describe('RESULT_LEVELS', () => {
        it('should have all result levels defined', () => {
            expect(RESULT_LEVELS.PERFECT).toBe('perfect');
            expect(RESULT_LEVELS.GOOD).toBe('good');
            expect(RESULT_LEVELS.OKAY).toBe('okay');
            expect(RESULT_LEVELS.MISS).toBe('miss');
        });
    });

    describe('RESULT_MULTIPLIERS', () => {
        it('should have multipliers for all result levels', () => {
            expect(RESULT_MULTIPLIERS[RESULT_LEVELS.PERFECT]).toBeDefined();
            expect(RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD]).toBeDefined();
            expect(RESULT_MULTIPLIERS[RESULT_LEVELS.OKAY]).toBeDefined();
            expect(RESULT_MULTIPLIERS[RESULT_LEVELS.MISS]).toBeDefined();
        });

        it('should have correct damage multipliers', () => {
            expect(RESULT_MULTIPLIERS[RESULT_LEVELS.PERFECT].damage).toBe(1.0);
            expect(RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD].damage).toBe(1.0);
            expect(RESULT_MULTIPLIERS[RESULT_LEVELS.OKAY].damage).toBe(0.7);
            expect(RESULT_MULTIPLIERS[RESULT_LEVELS.MISS].damage).toBe(0.3);
        });

        it('should have labels and colors', () => {
            for (const level of Object.values(RESULT_LEVELS)) {
                expect(RESULT_MULTIPLIERS[level].label).toBeDefined();
                expect(RESULT_MULTIPLIERS[level].color).toBeDefined();
            }
        });
    });

    describe('HEALING_RESULT_MULTIPLIERS', () => {
        it('should have multipliers for all result levels', () => {
            expect(HEALING_RESULT_MULTIPLIERS[RESULT_LEVELS.PERFECT]).toBeDefined();
            expect(HEALING_RESULT_MULTIPLIERS[RESULT_LEVELS.GOOD]).toBeDefined();
            expect(HEALING_RESULT_MULTIPLIERS[RESULT_LEVELS.OKAY]).toBeDefined();
            expect(HEALING_RESULT_MULTIPLIERS[RESULT_LEVELS.MISS]).toBeDefined();
        });
    });

    describe('MINIGAME_DESCRIPTIONS', () => {
        it('should have descriptions for all unit classes', () => {
            expect(MINIGAME_DESCRIPTIONS.scout).toBeDefined();
            expect(MINIGAME_DESCRIPTIONS.assault).toBeDefined();
            expect(MINIGAME_DESCRIPTIONS.sniper).toBeDefined();
            expect(MINIGAME_DESCRIPTIONS.medic).toBeDefined();
            expect(MINIGAME_DESCRIPTIONS.commando).toBeDefined();
        });

        it('should have required fields in descriptions', () => {
            for (const [className, desc] of Object.entries(MINIGAME_DESCRIPTIONS)) {
                expect(desc.title).toBeDefined();
                expect(desc.instruction).toBeDefined();
                expect(desc.hint).toBeDefined();
                expect(desc.detailedExplanation).toBeDefined();
            }
        });
    });

    describe('TAP_COOLDOWN_MS', () => {
        it('should be a reasonable anti-cheat value', () => {
            expect(TAP_COOLDOWN_MS).toBeGreaterThan(50);
            expect(TAP_COOLDOWN_MS).toBeLessThan(500);
        });
    });
});

describe('Minigames Difficulty Module', () => {
    describe('calculateDifficultyModifiers', () => {
        it('should return default modifiers when no context', () => {
            const mods = calculateDifficultyModifiers('scout', null);
            expect(mods.speedMultiplier).toBe(1.0);
            expect(mods.zoneMultiplier).toBe(1.0);
            expect(mods.timeMultiplier).toBe(1.0);
            expect(mods.extraChance).toBe(0);
            expect(mods.description).toBe(null);
        });

        it('should adjust scout modifiers for close range', () => {
            const context = {
                distance: 1,
                maxRange: 4,
                alliesInRange: 0,
                enemiesInRange: 0
            };
            const mods = calculateDifficultyModifiers('scout', context);
            // Close range = easier (larger zone)
            expect(mods.zoneMultiplier).toBeGreaterThan(1.0);
        });

        it('should adjust scout modifiers for allies nearby', () => {
            const context = {
                distance: 2,
                maxRange: 4,
                alliesInRange: 2,
                enemiesInRange: 0
            };
            const mods = calculateDifficultyModifiers('scout', context);
            // Allies = more time
            expect(mods.timeMultiplier).toBeGreaterThan(1.0);
        });

        it('should adjust sniper modifiers for close range (harder)', () => {
            const context = {
                distance: 2,
                maxRange: 6,
                alliesInRange: 0,
                enemiesInRange: 0
            };
            const mods = calculateDifficultyModifiers('sniper', context);
            // Close range for sniper = harder (faster speed)
            expect(mods.speedMultiplier).toBeGreaterThan(1.0);
        });

        it('should adjust sniper modifiers for optimal range (easier)', () => {
            const context = {
                distance: 5,
                maxRange: 6,
                alliesInRange: 0,
                enemiesInRange: 0
            };
            const mods = calculateDifficultyModifiers('sniper', context);
            // Optimal range = easier (slower speed)
            expect(mods.speedMultiplier).toBeLessThan(1.0);
        });

        it('should give commando bonus for ambush', () => {
            const context = {
                distance: 1,
                maxRange: 1,
                alliesInRange: 0,
                enemiesInRange: 0,
                isAmbush: true
            };
            const mods = calculateDifficultyModifiers('commando', context);
            expect(mods.extraChance).toBeGreaterThan(0);
            expect(mods.timeMultiplier).toBeGreaterThan(1.0);
        });

        it('should adjust medic modifiers for low HP (harder)', () => {
            const context = {
                distance: 2,
                maxRange: 2,
                alliesInRange: 0,
                enemiesInRange: 0,
                attackerHP: 0.3
            };
            const mods = calculateDifficultyModifiers('medic', context);
            // Low HP = faster (harder)
            expect(mods.speedMultiplier).toBeGreaterThan(1.0);
        });

        it('should adjust assault for hills terrain', () => {
            const context = {
                distance: 2,
                maxRange: 3,
                alliesInRange: 0,
                enemiesInRange: 0,
                attackerTerrain: 'hills'
            };
            const mods = calculateDifficultyModifiers('assault', context);
            // Hills = easier (larger zone)
            expect(mods.zoneMultiplier).toBeGreaterThan(1.0);
        });

        it('should handle elitesoldat in close range like commando', () => {
            const context = {
                distance: 1,
                maxRange: 3,
                alliesInRange: 0,
                enemiesInRange: 0,
                isAmbush: true
            };
            const mods = calculateDifficultyModifiers('elitesoldat', context);
            // Close range + ambush = bonus
            expect(mods.extraChance).toBeGreaterThan(0);
        });

        it('should handle elitesoldat in far range like assault', () => {
            const context = {
                distance: 3,
                maxRange: 3,
                alliesInRange: 2,
                enemiesInRange: 0
            };
            const mods = calculateDifficultyModifiers('elitesoldat', context);
            // Far range + allies = better zone
            expect(mods.zoneMultiplier).toBeGreaterThan(1.0);
        });
    });
});
