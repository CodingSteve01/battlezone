import { describe, it, expect } from 'vitest';
import { CONFIG, TERRAIN, UNIT_CLASSES } from '../js/config.js';

describe('CONFIG', () => {
    it('should have valid player colors', () => {
        expect(CONFIG.PLAYER_COLORS).toHaveLength(8);
        CONFIG.PLAYER_COLORS.forEach(color => {
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
    });

    it('should have matching player names count', () => {
        expect(CONFIG.PLAYER_NAMES).toHaveLength(CONFIG.PLAYER_COLORS.length);
    });

    it('should have positive AP per turn', () => {
        expect(CONFIG.AP_PER_TURN).toBeGreaterThan(0);
    });

    it('should have valid map sizes', () => {
        expect(CONFIG.MAP_SIZES.small).toBeLessThan(CONFIG.MAP_SIZES.medium);
        expect(CONFIG.MAP_SIZES.medium).toBeLessThan(CONFIG.MAP_SIZES.large);
    });

    it('should have spawn offsets less than map sizes', () => {
        expect(CONFIG.SPAWN_OFFSET.small).toBeLessThan(CONFIG.MAP_SIZES.small);
        expect(CONFIG.SPAWN_OFFSET.medium).toBeLessThan(CONFIG.MAP_SIZES.medium);
        expect(CONFIG.SPAWN_OFFSET.large).toBeLessThan(CONFIG.MAP_SIZES.large);
    });
});

describe('TERRAIN', () => {
    const terrainTypes = Object.keys(TERRAIN);

    it('should have essential terrain types', () => {
        expect(terrainTypes).toContain('grass');
        expect(terrainTypes).toContain('forest');
        expect(terrainTypes).toContain('water');
        expect(terrainTypes).toContain('rock');
    });

    it('should have valid move costs for walkable terrain', () => {
        terrainTypes.forEach(type => {
            const terrain = TERRAIN[type];
            if (terrain.walkable) {
                expect(terrain.moveCost).toBeGreaterThan(0);
                expect(terrain.moveCost).toBeLessThan(10);
            }
        });
    });

    it('should have infinite move cost for non-walkable terrain', () => {
        terrainTypes.forEach(type => {
            const terrain = TERRAIN[type];
            if (!terrain.walkable) {
                expect(terrain.moveCost).toBe(Infinity);
            }
        });
    });

    it('should have names for all terrain types', () => {
        terrainTypes.forEach(type => {
            expect(TERRAIN[type].name).toBeDefined();
            expect(TERRAIN[type].name.length).toBeGreaterThan(0);
        });
    });

    it('should have color definitions for all terrain', () => {
        terrainTypes.forEach(type => {
            const terrain = TERRAIN[type];
            expect(terrain.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
    });

    it('forest should provide cover', () => {
        expect(TERRAIN.forest.cover).toBe(true);
        expect(TERRAIN.forest.canHide).toBe(true);
    });

    it('water and rock should not be walkable', () => {
        expect(TERRAIN.water.walkable).toBe(false);
        expect(TERRAIN.rock.walkable).toBe(false);
    });
});

describe('UNIT_CLASSES', () => {
    const unitTypes = Object.keys(UNIT_CLASSES);

    it('should have at least 3 unit classes', () => {
        expect(unitTypes.length).toBeGreaterThanOrEqual(3);
    });

    it('should have essential unit types', () => {
        expect(unitTypes).toContain('scout');
        expect(unitTypes).toContain('assault');
        expect(unitTypes).toContain('medic');
    });

    it('should have valid HP values', () => {
        unitTypes.forEach(type => {
            const unit = UNIT_CLASSES[type];
            expect(unit.hp).toBeGreaterThan(0);
            expect(unit.hp).toBeLessThanOrEqual(200);
        });
    });

    it('should have valid damage values', () => {
        unitTypes.forEach(type => {
            const unit = UNIT_CLASSES[type];
            expect(unit.damage).toBeGreaterThan(0);
            expect(unit.damage).toBeLessThanOrEqual(100);
        });
    });

    it('should have valid range values', () => {
        unitTypes.forEach(type => {
            const unit = UNIT_CLASSES[type];
            expect(unit.range).toBeGreaterThan(0);
            expect(unit.range).toBeLessThanOrEqual(10);
        });
    });

    it('should have valid movement values', () => {
        unitTypes.forEach(type => {
            const unit = UNIT_CLASSES[type];
            expect(unit.move).toBeGreaterThan(0);
            expect(unit.move).toBeLessThanOrEqual(10);
        });
    });

    it('should have icons for all units', () => {
        unitTypes.forEach(type => {
            expect(UNIT_CLASSES[type].icon).toBeDefined();
            expect(UNIT_CLASSES[type].icon.length).toBeGreaterThan(0);
        });
    });

    it('should have special abilities for all units', () => {
        unitTypes.forEach(type => {
            const unit = UNIT_CLASSES[type];
            expect(unit.special).toBeDefined();
            expect(unit.specialDesc).toBeDefined();
        });
    });

    it('scout should have highest movement', () => {
        const scoutMove = UNIT_CLASSES.scout.move;
        unitTypes.forEach(type => {
            if (type !== 'scout') {
                expect(UNIT_CLASSES[type].move).toBeLessThanOrEqual(scoutMove);
            }
        });
    });

    it('sniper should have highest range', () => {
        const sniperRange = UNIT_CLASSES.sniper.range;
        unitTypes.forEach(type => {
            if (type !== 'sniper') {
                expect(UNIT_CLASSES[type].range).toBeLessThanOrEqual(sniperRange);
            }
        });
    });

    it('assault should have highest HP', () => {
        const assaultHP = UNIT_CLASSES.assault.hp;
        unitTypes.forEach(type => {
            expect(UNIT_CLASSES[type].hp).toBeLessThanOrEqual(assaultHP);
        });
    });
});
