import { describe, it, expect } from 'vitest';
import {
    hexToPixel,
    pixelToHex,
    hexRound,
    hexDistance,
    getNeighbors,
    getHexesInRange,
    hexLine,
    isValidHex
} from '../js/hexMath.js';

describe('hexMath', () => {
    describe('hexToPixel', () => {
        it('should convert origin hex to origin pixel', () => {
            const result = hexToPixel(0, 0, 10);
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        it('should correctly convert positive q coordinate', () => {
            const result = hexToPixel(1, 0, 10);
            expect(result.x).toBe(15); // 10 * (3/2 * 1)
            expect(result.y).toBeCloseTo(8.66, 1); // 10 * (sqrt(3)/2 * 1)
        });

        it('should correctly convert positive r coordinate', () => {
            const result = hexToPixel(0, 1, 10);
            expect(result.x).toBe(0);
            expect(result.y).toBeCloseTo(17.32, 1); // 10 * sqrt(3)
        });
    });

    describe('pixelToHex', () => {
        it('should convert origin pixel to origin hex', () => {
            const result = pixelToHex(0, 0, 10);
            expect(result.q).toBe(0);
            expect(result.r).toBe(0);
        });

        it('should be inverse of hexToPixel', () => {
            const hexSize = 10;
            const original = { q: 2, r: 3 };
            const pixel = hexToPixel(original.q, original.r, hexSize);
            const result = pixelToHex(pixel.x, pixel.y, hexSize);
            expect(result.q).toBe(original.q);
            expect(result.r).toBe(original.r);
        });
    });

    describe('hexRound', () => {
        it('should round fractional coordinates', () => {
            const result = hexRound(0.3, 0.2);
            expect(result.q).toBe(0);
            expect(result.r).toBe(0);
        });

        it('should round to nearest hex', () => {
            const result = hexRound(0.6, 0.6);
            expect(result.q).toBe(1);
            expect(result.r).toBe(0);
        });
    });

    describe('hexDistance', () => {
        it('should return 0 for same hex', () => {
            const a = { q: 0, r: 0 };
            const b = { q: 0, r: 0 };
            expect(hexDistance(a, b)).toBe(0);
        });

        it('should return 1 for adjacent hexes', () => {
            const a = { q: 0, r: 0 };
            const b = { q: 1, r: 0 };
            expect(hexDistance(a, b)).toBe(1);
        });

        it('should calculate correct distance for distant hexes', () => {
            const a = { q: 0, r: 0 };
            const b = { q: 3, r: 2 };
            expect(hexDistance(a, b)).toBe(5);
        });

        it('should be symmetric', () => {
            const a = { q: 1, r: 2 };
            const b = { q: -2, r: 3 };
            expect(hexDistance(a, b)).toBe(hexDistance(b, a));
        });
    });

    describe('getNeighbors', () => {
        it('should return 6 neighbors', () => {
            const neighbors = getNeighbors(0, 0);
            expect(neighbors).toHaveLength(6);
        });

        it('should return correct neighbor coordinates for origin', () => {
            const neighbors = getNeighbors(0, 0);
            const expected = [
                { q: 1, r: 0 },
                { q: 1, r: -1 },
                { q: 0, r: -1 },
                { q: -1, r: 0 },
                { q: -1, r: 1 },
                { q: 0, r: 1 }
            ];
            expect(neighbors).toEqual(expected);
        });

        it('should all be distance 1 from center', () => {
            const center = { q: 3, r: -2 };
            const neighbors = getNeighbors(center.q, center.r);
            neighbors.forEach(neighbor => {
                expect(hexDistance(center, neighbor)).toBe(1);
            });
        });
    });

    describe('getHexesInRange', () => {
        it('should return 1 hex for range 0', () => {
            const hexes = getHexesInRange(0, 0, 0);
            expect(hexes).toHaveLength(1);
            expect(hexes[0]).toEqual({ q: 0, r: 0 });
        });

        it('should return 7 hexes for range 1 (center + 6 neighbors)', () => {
            const hexes = getHexesInRange(0, 0, 1);
            expect(hexes).toHaveLength(7);
        });

        it('should return 19 hexes for range 2', () => {
            const hexes = getHexesInRange(0, 0, 2);
            expect(hexes).toHaveLength(19);
        });

        it('should all be within range distance', () => {
            const center = { q: 2, r: 3 };
            const range = 3;
            const hexes = getHexesInRange(center.q, center.r, range);
            hexes.forEach(hex => {
                expect(hexDistance(center, hex)).toBeLessThanOrEqual(range);
            });
        });
    });

    describe('hexLine', () => {
        it('should return single hex for same start and end', () => {
            const a = { q: 0, r: 0 };
            const result = hexLine(a, a);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(a);
        });

        it('should return correct number of hexes for line', () => {
            const a = { q: 0, r: 0 };
            const b = { q: 3, r: 0 };
            const line = hexLine(a, b);
            expect(line).toHaveLength(4); // 0, 1, 2, 3
        });

        it('should include start and end points', () => {
            const a = { q: 0, r: 0 };
            const b = { q: 2, r: 1 };
            const line = hexLine(a, b);
            expect(line[0]).toEqual(a);
            expect(line[line.length - 1]).toEqual(b);
        });
    });

    describe('isValidHex', () => {
        it('should return true for origin in any positive radius', () => {
            expect(isValidHex(0, 0, 5)).toBe(true);
        });

        it('should return true for hex within radius', () => {
            expect(isValidHex(2, 1, 5)).toBe(true);
        });

        it('should return false for hex outside radius', () => {
            expect(isValidHex(10, 10, 5)).toBe(false);
        });

        it('should validate boundary hexes correctly', () => {
            // Hex at boundary should be valid
            expect(isValidHex(3, 0, 3)).toBe(true);
            expect(isValidHex(0, 3, 3)).toBe(true);
            expect(isValidHex(-3, 0, 3)).toBe(true);
        });
    });
});
