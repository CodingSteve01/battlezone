import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, resetState, setHex } from '../js/state.js';

// Mock audio module to prevent actual sound playback during tests
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

// Mock ui module
vi.mock('../js/ui.js', () => ({
    showToast: vi.fn(),
    showFloatingDamage: vi.fn()
}));

// Mock events module
vi.mock('../js/events.js', () => ({
    checkEventMiss: vi.fn(() => false)
}));

import {
    canTakeCover,
    takeCover,
    revealFromCover,
    hasLineOfSight,
    calculateHitChance,
    checkGameOver
} from '../js/combat.js';

describe('combat', () => {
    beforeEach(() => {
        resetState();
        vi.clearAllMocks();

        // Initialize shared AP pool for tests
        state.sharedAP = 12;
        state.maxSharedAP = 12;

        // Set up a basic map
        for (let q = -5; q <= 5; q++) {
            for (let r = -5; r <= 5; r++) {
                setHex({ q, r, type: 'grass', cover: false });
            }
        }
    });

    describe('canTakeCover', () => {
        it('should return false for null unit', () => {
            expect(canTakeCover(null)).toBe(false);
        });

        it('should return false for dead unit', () => {
            const unit = { alive: false, hiding: false, ap: 4, q: 0, r: 0 };
            expect(canTakeCover(unit)).toBe(false);
        });

        it('should return false for unit already hiding', () => {
            setHex({ q: 0, r: 0, type: 'forest', cover: true });
            const unit = { alive: true, hiding: true, ap: 4, q: 0, r: 0 };
            expect(canTakeCover(unit)).toBe(false);
        });

        it('should return false when shared AP pool is empty', () => {
            setHex({ q: 0, r: 0, type: 'forest', cover: true });
            state.sharedAP = 0;  // Empty shared pool
            const unit = { alive: true, hiding: false, q: 0, r: 0 };
            expect(canTakeCover(unit)).toBe(false);
        });

        it('should return false on non-hideable terrain', () => {
            setHex({ q: 0, r: 0, type: 'grass', cover: false });
            const unit = { alive: true, hiding: false, ap: 4, q: 0, r: 0 };
            expect(canTakeCover(unit)).toBe(false);
        });

        it('should return true on forest terrain with AP', () => {
            setHex({ q: 0, r: 0, type: 'forest', cover: true });
            const unit = { alive: true, hiding: false, ap: 4, q: 0, r: 0 };
            expect(canTakeCover(unit)).toBe(true);
        });
    });

    describe('takeCover', () => {
        it('should set hiding flag and consume AP from shared pool', () => {
            setHex({ q: 0, r: 0, type: 'forest', cover: true });
            state.sharedAP = 12;
            const unit = { alive: true, hiding: false, q: 0, r: 0 };

            const result = takeCover(unit);

            expect(result).toBe(true);
            expect(unit.hiding).toBe(true);
            expect(state.sharedAP).toBe(11);  // 12 - 1 = 11
        });

        it('should return false if cannot take cover', () => {
            setHex({ q: 0, r: 0, type: 'grass', cover: false });
            state.sharedAP = 12;
            const unit = { alive: true, hiding: false, q: 0, r: 0 };

            const result = takeCover(unit);

            expect(result).toBe(false);
            expect(unit.hiding).toBe(false);
            expect(state.sharedAP).toBe(12);  // Unchanged
        });
    });

    describe('revealFromCover', () => {
        it('should set hiding to false', () => {
            const unit = { hiding: true };
            revealFromCover(unit);
            expect(unit.hiding).toBe(false);
        });

        it('should not affect unit not hiding', () => {
            const unit = { hiding: false };
            revealFromCover(unit);
            expect(unit.hiding).toBe(false);
        });
    });

    describe('hasLineOfSight', () => {
        it('should return clear for adjacent hexes', () => {
            const result = hasLineOfSight(0, 0, 1, 0);
            expect(result.clear).toBe(true);
            expect(result.blockedBy).toBeNull();
        });

        it('should return clear when path is all grass', () => {
            const result = hasLineOfSight(0, 0, 3, 0);
            expect(result.clear).toBe(true);
        });

        it('should be blocked by rock', () => {
            setHex({ q: 1, r: 0, type: 'rock' });
            const result = hasLineOfSight(0, 0, 2, 0);
            expect(result.clear).toBe(false);
            expect(result.blockedBy).toBe('rock');
        });

        it('should be blocked by 2+ forests', () => {
            setHex({ q: 1, r: 0, type: 'forest', cover: true });
            setHex({ q: 2, r: 0, type: 'forest', cover: true });
            const result = hasLineOfSight(0, 0, 4, 0);
            expect(result.clear).toBe(false);
            expect(result.blockedBy).toBe('forest');
        });

        it('should not be blocked by single forest', () => {
            setHex({ q: 1, r: 0, type: 'forest', cover: true });
            const result = hasLineOfSight(0, 0, 3, 0);
            expect(result.clear).toBe(true);
        });

        it('should return blocking hex position', () => {
            setHex({ q: 2, r: 0, type: 'rock' });
            const result = hasLineOfSight(0, 0, 4, 0);
            expect(result.blockingHex).toEqual({ q: 2, r: 0 });
        });
    });

    describe('calculateHitChance', () => {
        it('should have base 70% hit chance', () => {
            const attacker = { class: 'assault', q: 0, r: 0 };
            const defender = { q: 1, r: 0, hiding: false };

            const chance = calculateHitChance(attacker, defender);

            // Base is 70%, no modifiers for adjacent grass hexes
            expect(chance).toBeGreaterThanOrEqual(25);
            expect(chance).toBeLessThanOrEqual(95);
        });

        it('should give scout accuracy bonus', () => {
            const scout = { class: 'scout', q: 0, r: 0 };
            const assault = { class: 'assault', q: 0, r: 0 };
            const defender = { q: 1, r: 0, hiding: false };

            const scoutChance = calculateHitChance(scout, defender);
            const assaultChance = calculateHitChance(assault, defender);

            expect(scoutChance).toBeGreaterThan(assaultChance);
        });

        it('should give sniper accuracy bonus', () => {
            const sniper = { class: 'sniper', q: 0, r: 0 };
            const assault = { class: 'assault', q: 0, r: 0 };
            const defender = { q: 1, r: 0, hiding: false };

            const sniperChance = calculateHitChance(sniper, defender);
            const assaultChance = calculateHitChance(assault, defender);

            expect(sniperChance).toBeGreaterThan(assaultChance);
        });

        it('should apply hills accuracy bonus for attacker', () => {
            setHex({ q: 0, r: 0, type: 'hills' });
            const attacker = { class: 'assault', q: 0, r: 0 };
            const defender = { q: 1, r: 0, hiding: false };

            const hillsChance = calculateHitChance(attacker, defender);

            // Reset hex and compare
            setHex({ q: 0, r: 0, type: 'grass' });
            const normalChance = calculateHitChance(attacker, defender);

            expect(hillsChance).toBeGreaterThan(normalChance);
        });

        it('should apply hills defense for defender', () => {
            setHex({ q: 1, r: 0, type: 'hills' });
            const attacker = { class: 'assault', q: 0, r: 0 };
            const defender = { q: 1, r: 0, hiding: false };

            const hillsDefenderChance = calculateHitChance(attacker, defender);

            setHex({ q: 1, r: 0, type: 'grass' });
            const normalChance = calculateHitChance(attacker, defender);

            expect(hillsDefenderChance).toBeLessThan(normalChance);
        });

        it('should apply cover penalty when defender in forest', () => {
            setHex({ q: 1, r: 0, type: 'forest', cover: true });
            const attacker = { class: 'assault', q: 0, r: 0 };
            const defender = { q: 1, r: 0, hiding: false };

            const coverChance = calculateHitChance(attacker, defender);

            setHex({ q: 1, r: 0, type: 'grass', cover: false });
            const normalChance = calculateHitChance(attacker, defender);

            expect(coverChance).toBeLessThan(normalChance);
        });

        it('should reduce hit chance at longer distances (non-sniper)', () => {
            const attacker = { class: 'assault', q: 0, r: 0 };
            const nearDefender = { q: 1, r: 0, hiding: false };
            const farDefender = { q: 3, r: 0, hiding: false };

            const nearChance = calculateHitChance(attacker, nearDefender);
            const farChance = calculateHitChance(attacker, farDefender);

            expect(farChance).toBeLessThan(nearChance);
        });

        it('should cap hit chance between 25% and 95%', () => {
            // Create very unfavorable conditions
            setHex({ q: 5, r: 0, type: 'forest', cover: true });
            setHex({ q: 4, r: 0, type: 'forest', cover: true });
            const attacker = { class: 'medic', q: 0, r: 0 };
            const defender = { q: 5, r: 0, hiding: true };

            const chance = calculateHitChance(attacker, defender);

            expect(chance).toBeGreaterThanOrEqual(25);
            expect(chance).toBeLessThanOrEqual(95);
        });
    });

    describe('checkGameOver', () => {
        it('should return false when multiple players have units', () => {
            state.settings.players = 2;
            state.units = [
                { id: '0-0', player: 0, alive: true },
                { id: '1-0', player: 1, alive: true }
            ];

            const result = checkGameOver();

            expect(result.gameOver).toBe(false);
            expect(result.winner).toBeNull();
        });

        it('should return true with winner when only one player has units', () => {
            state.settings.players = 2;
            state.units = [
                { id: '0-0', player: 0, alive: true },
                { id: '0-1', player: 0, alive: true },
                { id: '1-0', player: 1, alive: false }
            ];

            const result = checkGameOver();

            expect(result.gameOver).toBe(true);
            expect(result.winner).toBe(0);
        });

        it('should handle draw (no units left)', () => {
            state.settings.players = 2;
            state.units = [
                { id: '0-0', player: 0, alive: false },
                { id: '1-0', player: 1, alive: false }
            ];

            const result = checkGameOver();

            expect(result.gameOver).toBe(true);
            expect(result.winner).toBeNull();
        });

        it('should work with more than 2 players', () => {
            state.settings.players = 4;
            state.units = [
                { id: '0-0', player: 0, alive: false },
                { id: '1-0', player: 1, alive: false },
                { id: '2-0', player: 2, alive: true },
                { id: '3-0', player: 3, alive: false }
            ];

            const result = checkGameOver();

            expect(result.gameOver).toBe(true);
            expect(result.winner).toBe(2);
        });

        it('should return false when two players still have units in 4 player game', () => {
            state.settings.players = 4;
            state.units = [
                { id: '0-0', player: 0, alive: false },
                { id: '1-0', player: 1, alive: true },
                { id: '2-0', player: 2, alive: true },
                { id: '3-0', player: 3, alive: false }
            ];

            const result = checkGameOver();

            expect(result.gameOver).toBe(false);
        });
    });
});
