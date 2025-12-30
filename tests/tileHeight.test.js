import { describe, it, expect, beforeEach } from 'vitest';
import { CONFIG, TERRAIN } from '../js/config.js';
import { getTileSizeForHexSize, getTileZOffset, getTileScreenPosition, state } from '../js/state.js';
import { hexToPixel } from '../js/hexMath.js';
import { getHeightForTerrain, generateMap, getActiveBiome } from '../js/map.js';

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

describe('z-axis offset calculations', () => {
    it('calculates correct z-offset for each height level', () => {
        const hexSize = 100;
        
        expect(getTileZOffset(0, hexSize)).toBe(0);
        expect(getTileZOffset(1, hexSize)).toBe(hexSize * 0.18);
        expect(getTileZOffset(2, hexSize)).toBe(hexSize * 0.36);
        expect(getTileZOffset(3, hexSize)).toBe(hexSize * 0.54);
    });

    it('handles negative heights gracefully', () => {
        const hexSize = 100;
        expect(getTileZOffset(-1, hexSize)).toBe(0);
        expect(getTileZOffset(-5, hexSize)).toBe(0);
    });

    it('handles null/undefined heights', () => {
        const hexSize = 100;
        expect(getTileZOffset(null, hexSize)).toBe(0);
        expect(getTileZOffset(undefined, hexSize)).toBe(0);
    });

    it('scales z-offset proportionally with hex size', () => {
        const height = 2;
        
        expect(getTileZOffset(height, 50)).toBe(50 * 0.18 * height);
        expect(getTileZOffset(height, 100)).toBe(100 * 0.18 * height);
        expect(getTileZOffset(height, 200)).toBe(200 * 0.18 * height);
    });
});

describe('tile screen position with height', () => {
    it('adjusts screen Y position based on height', () => {
        const size = 100;
        const q = 2;
        const r = 3;
        
        const pos0 = getTileScreenPosition(q, r, 0, size);
        const pos1 = getTileScreenPosition(q, r, 1, size);
        const pos2 = getTileScreenPosition(q, r, 2, size);
        
        // Higher tiles should have lower Y (drawn higher on screen)
        expect(pos1.y).toBeLessThan(pos0.y);
        expect(pos2.y).toBeLessThan(pos1.y);
        
        // X position should remain the same
        expect(pos0.x).toBe(pos1.x);
        expect(pos1.x).toBe(pos2.x);
    });

    it('includes zOffset in return value', () => {
        const size = 100;
        const height = 2;
        const pos = getTileScreenPosition(0, 0, height, size);
        
        expect(pos.zOffset).toBe(getTileZOffset(height, size));
    });

    it('matches manual calculation', () => {
        const size = 50;
        const q = 1;
        const r = 1;
        const height = 2;
        
        const basePos = hexToPixel(q, r, size);
        const zOffset = getTileZOffset(height, size);
        const pos = getTileScreenPosition(q, r, height, size);
        
        expect(pos.x).toBe(basePos.x);
        expect(pos.y).toBe(basePos.y - zOffset);
        expect(pos.zOffset).toBe(zOffset);
    });
});

describe('terrain height mapping', () => {
    it('assigns height 0 to water terrains', () => {
        const waterTerrains = ['water', 'river', 'deepwater', 'shallows'];
        
        for (const type of waterTerrains) {
            expect(getHeightForTerrain(type)).toBe(0);
        }
    });

    it('assigns height 0 to swampy terrains', () => {
        const swampTerrains = ['swamp', 'reeds', 'mud', 'ice'];
        
        for (const type of swampTerrains) {
            expect(getHeightForTerrain(type)).toBe(0);
        }
    });

    it('assigns height 2 to elevated terrains', () => {
        const elevatedTerrains = ['hills', 'gravel'];
        
        for (const type of elevatedTerrains) {
            expect(getHeightForTerrain(type)).toBe(2);
        }
    });

    it('assigns max height to rock terrains', () => {
        const rockTerrains = ['rock', 'cliff'];
        
        for (const type of rockTerrains) {
            expect(getHeightForTerrain(type)).toBe(CONFIG.HEIGHT.MAX);
        }
    });

    it('assigns height 1 to ground-level terrains', () => {
        const groundTerrains = ['grass', 'forest', 'sand', 'road', 'path', 
                                'snow', 'flowers', 'tallgrass', 'pine', 
                                'clearing', 'heather', 'moss', 'ruins', 
                                'farmland', 'wheat', 'bridge'];
        
        for (const type of groundTerrains) {
            expect(getHeightForTerrain(type)).toBe(1);
        }
    });

    it('handles unknown terrain types', () => {
        expect(getHeightForTerrain(null)).toBe(1);
        expect(getHeightForTerrain(undefined)).toBe(1);
        expect(getHeightForTerrain('unknown')).toBe(1);
    });
});

describe('map generation with heights', () => {
    beforeEach(() => {
        state.settings = {
            size: 'small',
            landscape: 'temperate',
            players: 2
        };
        state.hexes = [];
        state.hexMap.clear();
        state.mapSeed = 12345;
    });

    it('generates map with valid height values', () => {
        generateMap();
        
        expect(state.hexes.length).toBeGreaterThan(0);
        
        for (const hex of state.hexes) {
            expect(hex.height).toBeDefined();
            expect(hex.height).toBeGreaterThanOrEqual(0);
            expect(hex.height).toBeLessThanOrEqual(CONFIG.HEIGHT.MAX);
        }
    });

    it('assigns heights consistent with terrain types', () => {
        generateMap();
        
        for (const hex of state.hexes) {
            const expectedHeight = getHeightForTerrain(hex.type);
            expect(hex.height).toBe(expectedHeight);
        }
    });

    it('creates varied height profiles', () => {
        generateMap();
        
        const heightCounts = new Map();
        for (const hex of state.hexes) {
            heightCounts.set(hex.height, (heightCounts.get(hex.height) || 0) + 1);
        }
        
        // Should have multiple different height levels
        expect(heightCounts.size).toBeGreaterThan(1);
        
        // Should have hexes at each valid height level
        expect(heightCounts.has(0)).toBe(true); // Water/swamp level
        expect(heightCounts.has(1)).toBe(true); // Ground level
    });

    it('generates height profiles for all biomes', () => {
        const biomes = ['temperate', 'desert', 'tundra', 'tropical', 'highland', 'wetland'];
        
        for (const biome of biomes) {
            state.settings.landscape = biome;
            generateMap();
            
            expect(state.hexes.length).toBeGreaterThan(0);
            
            // Check that heights are assigned
            const hasHeights = state.hexes.every(hex => 
                hex.height !== undefined && 
                hex.height >= 0 && 
                hex.height <= CONFIG.HEIGHT.MAX
            );
            
            expect(hasHeights).toBe(true);
        }
    });

    it('maintains height consistency across map sizes', () => {
        const sizes = ['small', 'medium', 'large'];
        
        for (const size of sizes) {
            state.settings.size = size;
            generateMap();
            
            // Verify all hexes have valid heights
            const validHeights = state.hexes.every(hex => 
                hex.height >= 0 && hex.height <= CONFIG.HEIGHT.MAX
            );
            
            expect(validHeights).toBe(true);
        }
    });

    it('places rocky terrain at higher elevations', () => {
        state.settings.landscape = 'highland';
        generateMap();
        
        const rockHexes = state.hexes.filter(h => h.type === 'rock' || h.type === 'cliff');
        
        if (rockHexes.length > 0) {
            for (const hex of rockHexes) {
                expect(hex.height).toBe(CONFIG.HEIGHT.MAX);
            }
        }
    });

    it('places water at lowest elevation', () => {
        generateMap();
        
        const waterHexes = state.hexes.filter(h => 
            ['water', 'river', 'deepwater', 'shallows', 'swamp', 'reeds'].includes(h.type)
        );
        
        if (waterHexes.length > 0) {
            for (const hex of waterHexes) {
                expect(hex.height).toBe(0);
            }
        }
    });
});

describe('height-based gameplay mechanics', () => {
    it('height config defines correct bonuses', () => {
        expect(CONFIG.HEIGHT.MAX).toBe(3);
        expect(CONFIG.HEIGHT.VISION_BONUS_PER_LEVEL).toBeDefined();
        expect(CONFIG.HEIGHT.DEFENSE_BONUS_PER_LEVEL).toBeDefined();
        expect(CONFIG.HEIGHT.CLIMB_COST_PER_LEVEL).toBeDefined();
    });

    it('vision bonus scales with height', () => {
        const bonusPerLevel = CONFIG.HEIGHT.VISION_BONUS_PER_LEVEL;
        
        expect(bonusPerLevel).toBeGreaterThan(0);
        expect(typeof bonusPerLevel).toBe('number');
    });

    it('defense bonus scales with height', () => {
        const bonusPerLevel = CONFIG.HEIGHT.DEFENSE_BONUS_PER_LEVEL;
        
        expect(bonusPerLevel).toBeGreaterThan(0);
        expect(typeof bonusPerLevel).toBe('number');
    });

    it('climb cost scales with height difference', () => {
        const costPerLevel = CONFIG.HEIGHT.CLIMB_COST_PER_LEVEL;
        
        expect(costPerLevel).toBeGreaterThan(0);
        expect(typeof costPerLevel).toBe('number');
    });
});
