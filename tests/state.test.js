import { describe, it, expect, beforeEach } from 'vitest';
import {
    state,
    getHex,
    setHex,
    resetState,
    getPlayerUnits,
    getCurrentUnit,
    isHexVisible,
    isHexExplored,
    setQueuedPath,
    getQueuedPath,
    clearQueuedPath,
    addGhostIndicator,
    clearGhostIndicator,
    getVisibleGhosts,
    updatePreviouslyVisibleEnemies,
    getPreviouslyVisibleEnemies
} from '../js/state.js';

describe('state', () => {
    beforeEach(() => {
        resetState();
    });

    describe('initial state', () => {
        it('should have default screen', () => {
            expect(state.screen).toBe('menu');
        });

        it('should have default settings', () => {
            expect(state.settings.players).toBe(2);
            expect(state.settings.size).toBe('medium');
            expect(state.settings.singlePlayer).toBe(false);
        });

        it('should have empty units array', () => {
            expect(state.units).toEqual([]);
        });

        it('should have round 1', () => {
            expect(state.round).toBe(1);
        });

        it('should not be game over', () => {
            expect(state.gameOver).toBe(false);
        });
    });

    describe('getHex / setHex', () => {
        it('should return undefined for non-existent hex', () => {
            expect(getHex(0, 0)).toBeUndefined();
        });

        it('should set and get hex correctly', () => {
            const hex = { q: 1, r: 2, type: 'grass' };
            setHex(hex);
            expect(getHex(1, 2)).toEqual(hex);
        });

        it('should update existing hex', () => {
            const hex1 = { q: 1, r: 2, type: 'grass' };
            const hex2 = { q: 1, r: 2, type: 'forest' };
            setHex(hex1);
            setHex(hex2);
            expect(getHex(1, 2).type).toBe('forest');
        });

        it('should handle negative coordinates', () => {
            const hex = { q: -3, r: -5, type: 'water' };
            setHex(hex);
            expect(getHex(-3, -5)).toEqual(hex);
        });
    });

    describe('resetState', () => {
        it('should clear hexes', () => {
            setHex({ q: 0, r: 0, type: 'grass' });
            resetState();
            expect(state.hexes).toEqual([]);
            expect(getHex(0, 0)).toBeUndefined();
        });

        it('should clear units', () => {
            state.units.push({ id: '0-0', alive: true });
            resetState();
            expect(state.units).toEqual([]);
        });

        it('should reset round to 1', () => {
            state.round = 5;
            resetState();
            expect(state.round).toBe(1);
        });

        it('should reset gameOver', () => {
            state.gameOver = true;
            resetState();
            expect(state.gameOver).toBe(false);
        });

        it('should initialize playerExploredHexes for each player', () => {
            state.settings.players = 3;
            resetState();
            expect(state.playerExploredHexes).toHaveLength(3);
            state.playerExploredHexes.forEach(set => {
                expect(set).toBeInstanceOf(Set);
            });
        });
    });

    describe('getPlayerUnits', () => {
        beforeEach(() => {
            state.units = [
                { id: '0-0', player: 0, alive: true },
                { id: '0-1', player: 0, alive: true },
                { id: '0-2', player: 0, alive: false },
                { id: '1-0', player: 1, alive: true }
            ];
        });

        it('should return only alive units for player', () => {
            const units = getPlayerUnits(0);
            expect(units).toHaveLength(2);
            expect(units.every(u => u.player === 0 && u.alive)).toBe(true);
        });

        it('should return empty array for player with no units', () => {
            expect(getPlayerUnits(2)).toEqual([]);
        });

        it('should not return dead units', () => {
            const units = getPlayerUnits(0);
            expect(units.find(u => u.id === '0-2')).toBeUndefined();
        });
    });

    describe('getCurrentUnit', () => {
        beforeEach(() => {
            state.units = [
                { id: '0-0', player: 0, alive: true },
                { id: '0-1', player: 0, alive: true }
            ];
            state.currentPlayer = 0;
        });

        it('should return null when no unit selected', () => {
            state.selectedUnit = null;
            expect(getCurrentUnit()).toBeNull();
        });

        it('should return selected unit', () => {
            state.selectedUnit = 0;
            expect(getCurrentUnit()).toEqual(state.units[0]);
        });

        it('should return null for invalid selection', () => {
            state.selectedUnit = 99;
            expect(getCurrentUnit()).toBeNull();
        });
    });

    describe('visibility functions', () => {
        it('isHexVisible should check visibleHexes set', () => {
            state.visibleHexes.add('1,2');
            expect(isHexVisible(1, 2)).toBe(true);
            expect(isHexVisible(3, 4)).toBe(false);
        });

        it('isHexExplored should check exploredHexes set', () => {
            state.exploredHexes.add('5,6');
            expect(isHexExplored(5, 6)).toBe(true);
            expect(isHexExplored(7, 8)).toBe(false);
        });
    });

    describe('queued paths', () => {
        it('setQueuedPath should store path for unit', () => {
            const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
            setQueuedPath('0-0', path, 1, 0);
            expect(state.queuedPaths['0-0']).toEqual({ path, targetQ: 1, targetR: 0 });
        });

        it('getQueuedPath should return stored path', () => {
            const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
            setQueuedPath('0-0', path, 1, 0);
            expect(getQueuedPath('0-0')).toEqual({ path, targetQ: 1, targetR: 0 });
        });

        it('getQueuedPath should return null for non-existent path', () => {
            expect(getQueuedPath('non-existent')).toBeNull();
        });

        it('clearQueuedPath should remove path', () => {
            setQueuedPath('0-0', [], 0, 0);
            clearQueuedPath('0-0');
            expect(getQueuedPath('0-0')).toBeNull();
        });
    });

    describe('ghost indicators', () => {
        const mockUnit = { id: 'test-unit', q: 5, r: 3, player: 1, class: 'sniper' };

        it('addGhostIndicator should add indicator', () => {
            addGhostIndicator(mockUnit);
            expect(state.ghostIndicators).toHaveLength(1);
            expect(state.ghostIndicators[0].unitId).toBe('test-unit');
            expect(state.ghostIndicators[0].q).toBe(5);
            expect(state.ghostIndicators[0].r).toBe(3);
        });

        it('addGhostIndicator should replace existing indicator for same unit', () => {
            addGhostIndicator(mockUnit);
            addGhostIndicator({ ...mockUnit, q: 7, r: 8 });
            expect(state.ghostIndicators).toHaveLength(1);
            expect(state.ghostIndicators[0].q).toBe(7);
        });

        it('clearGhostIndicator should remove indicator', () => {
            addGhostIndicator(mockUnit);
            clearGhostIndicator('test-unit');
            expect(state.ghostIndicators).toHaveLength(0);
        });

        it('getVisibleGhosts should filter by player and age', () => {
            state.currentPlayer = 0;
            addGhostIndicator({ id: 'enemy', q: 1, r: 1, player: 1, class: 'scout' });
            addGhostIndicator({ id: 'ally', q: 2, r: 2, player: 0, class: 'medic' });

            const ghosts = getVisibleGhosts();
            expect(ghosts).toHaveLength(1);
            expect(ghosts[0].unitId).toBe('enemy');
        });
    });

    describe('previously visible enemies', () => {
        it('updatePreviouslyVisibleEnemies should update set', () => {
            updatePreviouslyVisibleEnemies(['enemy-1', 'enemy-2']);
            expect(getPreviouslyVisibleEnemies().size).toBe(2);
            expect(getPreviouslyVisibleEnemies().has('enemy-1')).toBe(true);
        });

        it('should replace previous set', () => {
            updatePreviouslyVisibleEnemies(['enemy-1']);
            updatePreviouslyVisibleEnemies(['enemy-2', 'enemy-3']);
            expect(getPreviouslyVisibleEnemies().size).toBe(2);
            expect(getPreviouslyVisibleEnemies().has('enemy-1')).toBe(false);
        });
    });
});
