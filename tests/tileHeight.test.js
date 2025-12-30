import { describe, it, expect } from 'vitest';
import { CONFIG } from '../js/config.js';
import { getTileSizeForHexSize, getTileZOffset, getTileScreenPosition } from '../js/state.js';
import { hexToPixel } from '../js/hexMath.js';
import { getHeightForTerrain } from '../js/map.js';

describe('tile scaling and height', () => {
    it('scales tile size independently of asset size', () => {
        const baseSize = 100;
        const tileSize = getTileSizeForHexSize(baseSize);
        expect(tileSize).toBe(baseSize * CONFIG.TILE_SCALE);
    });

    it('returns zero z-offset for flat tiles', () => {
        const offset = getTileZOffset(0, 100);
        expect(offset).toBe(0);
    });

    it('offsets tile screen position by z height', () => {
        const size = 10;
        const basePos = hexToPixel(1, 0, size);
        const pos = getTileScreenPosition(1, 0, 1, size);
        expect(pos.x).toBe(basePos.x);
        expect(pos.y).toBeCloseTo(basePos.y - size * 0.18, 5);
    });

    it('maps terrain types to expected height levels', () => {
        expect(getHeightForTerrain('water')).toBe(0);
        expect(getHeightForTerrain('hills')).toBe(2);
        expect(getHeightForTerrain('rock')).toBe(CONFIG.HEIGHT.MAX);
        expect(getHeightForTerrain('grass')).toBe(1);
    });
});
