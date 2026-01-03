import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, resetState, setHex } from '../js/state.js';

// Mock audio
vi.mock('../js/audio.js', () => ({
    playWeaponSound: vi.fn(),
    playHit: vi.fn(),
    playCriticalHit: vi.fn(),
    playMiss: vi.fn(),
    playDeath: vi.fn(),
    playShieldBlock: vi.fn(),
    playHeal: vi.fn(),
    playSprint: vi.fn(),
    playPowershot: vi.fn(),
    playCloak: vi.fn(),
    playCover: vi.fn(),
    playLevelUp: vi.fn()
}));

// Mock ui
vi.mock('../js/ui.js', () => ({
    showToast: vi.fn(),
    showFloatingDamage: vi.fn()
}));

// Mock particles
vi.mock('../js/particles.js', () => ({
    particles: {
        burst: vi.fn(),
        healEffect: vi.fn(),
        sprintEffect: vi.fn(),
        powershotEffect: vi.fn(),
        cloakEffect: vi.fn()
    }
}));

// Mock minigames
vi.mock('../js/minigames.js', () => ({
    areMinigamesEnabled: vi.fn(() => false),
    startMinigame: vi.fn(),
    startHealingMinigame: vi.fn(),
    RESULT_LEVELS: { PERFECT: 'PERFECT', GOOD: 'GOOD', OK: 'OK', MISS: 'MISS' },
    RESULT_MULTIPLIERS: {
        PERFECT: { damage: 1.5, hitBonus: 1.0, critBonus: 0.3, label: 'PERFEKT!' },
        GOOD: { damage: 1.0, hitBonus: 0.1, critBonus: 0.1, label: 'GUT' },
        OK: { damage: 0.8, hitBonus: 0, critBonus: 0, label: 'OK' },
        MISS: { damage: 0.5, hitBonus: -0.2, critBonus: 0, label: 'VERFEHLT' }
    }
}));

import {
    hasLineOfSight,
    calculateHitChance,
    calculateCoverDamageReduction,
    getCoverInfo,
    calculateLineOfSightCover
} from '../js/combat/calculations.js';

import {
    getSpecialAbilityCost,
    canUseSpecialAbility
} from '../js/combat/abilities.js';

import {
    canPrepareAmbush,
    canUseOverwatch,
    canUseSuppression,
    getSuppressionPenalty,
    getSuppressionMoveCost
} from '../js/combat/tactical.js';

describe('Combat Calculations Module', () => {
    beforeEach(() => {
        resetState();
        state.sharedAP = 12;
        state.maxSharedAP = 12;

        // Set up basic map
        for (let q = -5; q <= 5; q++) {
            for (let r = -5; r <= 5; r++) {
                setHex({ q, r, type: 'grass', walkable: true, height: 0 });
            }
        }
    });

    describe('hasLineOfSight', () => {
        it('should return clear when no obstacles', () => {
            const result = hasLineOfSight(0, 0, 3, 0);
            expect(result.clear).toBe(true);
            expect(result.blockedBy).toBe(null);
        });

        it('should be blocked by rock', () => {
            setHex({ q: 1, r: 0, type: 'rock', walkable: false, height: 0 });
            const result = hasLineOfSight(0, 0, 3, 0);
            expect(result.clear).toBe(false);
            expect(result.blockedBy).toBe('rock');
        });

        it('should be blocked by multiple forests', () => {
            setHex({ q: 1, r: 0, type: 'forest', walkable: true, cover: true, height: 0 });
            setHex({ q: 2, r: 0, type: 'forest', walkable: true, cover: true, height: 0 });
            const result = hasLineOfSight(0, 0, 4, 0);
            expect(result.clear).toBe(false);
            expect(result.blockedBy).toBe('forest');
        });

        it('should allow single forest', () => {
            setHex({ q: 1, r: 0, type: 'forest', walkable: true, cover: true, height: 0 });
            const result = hasLineOfSight(0, 0, 3, 0);
            expect(result.clear).toBe(true);
        });
    });

    describe('calculateHitChance', () => {
        it('should return 100% for commando at any range', () => {
            const attacker = { q: 0, r: 0, class: 'commando', range: 1 };
            const defender = { q: 1, r: 0 };
            const chance = calculateHitChance(attacker, defender);
            expect(chance).toBe(100);
        });

        it('should return 100% at range 1 for non-commando', () => {
            const attacker = { q: 0, r: 0, class: 'assault', range: 3 };
            const defender = { q: 1, r: 0 };
            const chance = calculateHitChance(attacker, defender);
            expect(chance).toBe(100);
        });

        it('should return 98% at range 2', () => {
            const attacker = { q: 0, r: 0, class: 'assault', range: 3 };
            const defender = { q: 2, r: 0 };
            const chance = calculateHitChance(attacker, defender);
            expect(chance).toBe(98);
        });

        it('should give scout precision bonus', () => {
            const scout = { q: 0, r: 0, class: 'scout', range: 4 };
            const assault = { q: 0, r: 0, class: 'assault', range: 4 };
            const defender = { q: 3, r: 0 };

            const scoutChance = calculateHitChance(scout, defender);
            const assaultChance = calculateHitChance(assault, defender);

            expect(scoutChance).toBeGreaterThan(assaultChance);
        });
    });

    describe('calculateCoverDamageReduction', () => {
        it('should return 0 for open terrain', () => {
            const attacker = { q: 0, r: 0, class: 'assault', range: 3 };
            const defender = { q: 2, r: 0 };
            const reduction = calculateCoverDamageReduction(attacker, defender);
            expect(reduction).toBe(0);
        });

        it('should reduce damage in forest (cover terrain)', () => {
            // Use forest which has cover: true in TERRAIN config
            setHex({ q: 2, r: 0, type: 'forest', walkable: true, cover: true, height: 0 });
            const attacker = { q: 0, r: 0, class: 'assault', range: 3 };
            const defender = { q: 2, r: 0 };
            const reduction = calculateCoverDamageReduction(attacker, defender);
            expect(reduction).toBeGreaterThan(0);
        });

        it('should cap at 60% reduction', () => {
            setHex({ q: 2, r: 0, type: 'forest', walkable: true, cover: true, height: 0 });
            setHex({ q: 1, r: 0, type: 'rock', walkable: false, height: 0 });
            const attacker = { q: 0, r: 0, class: 'scout', range: 6 };
            const defender = { q: 5, r: 0, hiding: true };
            const reduction = calculateCoverDamageReduction(attacker, defender);
            expect(reduction).toBeLessThanOrEqual(0.6);
        });
    });
});

describe('Combat Abilities Module', () => {
    beforeEach(() => {
        resetState();
        state.sharedAP = 12;
    });

    describe('getSpecialAbilityCost', () => {
        it('should return correct costs for each class', () => {
            expect(getSpecialAbilityCost('scout')).toBe(1);
            expect(getSpecialAbilityCost('assault')).toBe(1);
            expect(getSpecialAbilityCost('medic')).toBe(2);
            expect(getSpecialAbilityCost('sniper')).toBe(2);
            expect(getSpecialAbilityCost('commando')).toBe(2);
            expect(getSpecialAbilityCost('elitesoldat')).toBe(1);
        });

        it('should return 2 for unknown class', () => {
            expect(getSpecialAbilityCost('unknown')).toBe(2);
        });
    });

    describe('canUseSpecialAbility', () => {
        it('should return false for dead unit', () => {
            const unit = { alive: false, class: 'scout', usedSpecial: false };
            expect(canUseSpecialAbility(unit)).toBe(false);
        });

        it('should return false if already used', () => {
            const unit = { alive: true, class: 'scout', usedSpecial: true };
            expect(canUseSpecialAbility(unit)).toBe(false);
        });

        it('should return false if not enough AP', () => {
            state.sharedAP = 1;
            const unit = { alive: true, class: 'medic', usedSpecial: false };
            expect(canUseSpecialAbility(unit)).toBe(false);
        });

        it('should return true for valid scout', () => {
            const unit = { alive: true, class: 'scout', usedSpecial: false };
            expect(canUseSpecialAbility(unit)).toBe(true);
        });

        it('should return false for already cloaked sniper', () => {
            const unit = { alive: true, class: 'sniper', usedSpecial: false, cloaked: true };
            expect(canUseSpecialAbility(unit)).toBe(false);
        });
    });
});

describe('Combat Tactical Module', () => {
    beforeEach(() => {
        resetState();
        state.sharedAP = 12;
        state.units = [];
    });

    describe('canPrepareAmbush', () => {
        it('should return false for dead unit', () => {
            const unit = { alive: false };
            expect(canPrepareAmbush(unit)).toBe(false);
        });

        it('should return false if already in ambush', () => {
            const unit = { alive: true, ambushReady: true };
            expect(canPrepareAmbush(unit)).toBe(false);
        });

        it('should return false if not cloaked or hiding', () => {
            const unit = { alive: true, ambushReady: false, cloaked: false, hiding: false };
            expect(canPrepareAmbush(unit)).toBe(false);
        });

        it('should return true if cloaked', () => {
            const unit = { alive: true, ambushReady: false, cloaked: true };
            expect(canPrepareAmbush(unit)).toBe(true);
        });

        it('should return true if hiding', () => {
            const unit = { alive: true, ambushReady: false, hiding: true };
            expect(canPrepareAmbush(unit)).toBe(true);
        });
    });

    describe('canUseOverwatch', () => {
        it('should return false with insufficient AP', () => {
            state.sharedAP = 1;
            state.unitAttackCounts = new Map();
            const unit = { id: 1, alive: true };
            expect(canUseOverwatch(unit)).toBe(false);
        });
    });

    describe('canUseSuppression', () => {
        it('should return false for non-assault/sniper', () => {
            state.unitAttackCounts = new Map();
            const unit = { id: 1, alive: true, class: 'scout' };
            expect(canUseSuppression(unit)).toBe(false);
        });

        it('should return true for assault with enough AP', () => {
            state.unitAttackCounts = new Map();
            const unit = { id: 1, alive: true, class: 'assault' };
            expect(canUseSuppression(unit)).toBe(true);
        });
    });

    describe('getSuppressionPenalty', () => {
        it('should return 0 when not suppressed', () => {
            state.suppressedHexes = [];
            const unit = { q: 0, r: 0, player: 0 };
            expect(getSuppressionPenalty(unit)).toBe(0);
        });
    });

    describe('getSuppressionMoveCost', () => {
        it('should return 0 when not suppressed', () => {
            state.suppressedHexes = [];
            expect(getSuppressionMoveCost(0, 0)).toBe(0);
        });
    });
});
