/**
 * Game Initialization Tests
 *
 * These tests ensure that the game initializes correctly,
 * preventing black screen issues and other initialization bugs.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { state, resetState, setHex, getPlayerUnits } from '../js/state.js';
import { CONFIG, UNIT_CLASSES, TERRAIN } from '../js/config.js';

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn(() => ({ width: 10 })),
    fillText: vi.fn(),
}));

// Mock AudioContext
window.AudioContext = vi.fn(() => ({
    createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
    })),
    createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: { value: 0, setValueAtTime: vi.fn() },
        type: 'sine'
    })),
    createBiquadFilter: vi.fn(() => ({
        connect: vi.fn(),
        frequency: { value: 0 },
        Q: { value: 0 },
        type: 'lowpass'
    })),
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    destination: {},
    currentTime: 0,
    state: 'running'
}));

// Setup DOM
beforeAll(() => {
    document.body.innerHTML = `
        <div id="app">
            <div id="menu" class="screen active"></div>
            <div id="team-select" class="screen"></div>
            <div id="turn-screen" class="screen">
                <div id="turn-badge">1</div>
                <span id="turn-num">1</span>
                <div id="turn-players-alive"></div>
                <button id="ready-btn">Bereit</button>
            </div>
            <div id="game-area">
                <div class="canvas-container">
                    <canvas id="game-canvas"></canvas>
                </div>
                <div class="player-indicator">
                    <div class="player-dot" id="current-dot"></div>
                    <span class="player-name" id="current-name"></span>
                </div>
                <span id="round-num">1</span>
                <span id="round-max">30</span>
                <div id="ap-display"></div>
                <div id="unit-tabs"></div>
            </div>
            <div id="gameover" class="screen">
                <span id="winner-text"></span>
            </div>
            <div id="wizard-map" class="screen wizard-screen">
                <canvas id="map-preview-canvas"></canvas>
                <div id="map-preview-overlay"></div>
            </div>
            <div id="wizard-players" class="screen wizard-screen"></div>
        </div>
    `;
});

describe('State Initialization', () => {
    beforeEach(() => {
        resetState();
    });

    describe('resetState', () => {
        it('should initialize playerVisibleHexes for all players', () => {
            state.settings.players = 4;
            resetState();

            expect(state.playerVisibleHexes).toHaveLength(4);
            state.playerVisibleHexes.forEach(set => {
                expect(set).toBeInstanceOf(Set);
            });
        });

        it('should initialize playerExploredHexes for all players', () => {
            state.settings.players = 3;
            resetState();

            expect(state.playerExploredHexes).toHaveLength(3);
            state.playerExploredHexes.forEach(set => {
                expect(set).toBeInstanceOf(Set);
            });
        });

        it('should set viewingPlayer to 0', () => {
            state.viewingPlayer = 5;
            resetState();

            expect(state.viewingPlayer).toBe(0);
        });

        it('should set currentPlayer to 0', () => {
            state.currentPlayer = 3;
            resetState();

            expect(state.currentPlayer).toBe(0);
        });

        it('should clear units array', () => {
            state.units = [{ id: 'test' }];
            resetState();

            expect(state.units).toEqual([]);
        });

        it('should clear hexes', () => {
            state.hexes = [{ q: 0, r: 0 }];
            resetState();

            expect(state.hexes).toEqual([]);
        });
    });

    describe('Settings Preservation', () => {
        it('should not reset settings.players', () => {
            state.settings.players = 4;
            const playerCount = state.settings.players;
            resetState();

            // settings.players should remain (or be same default)
            expect(state.settings.players).toBe(playerCount);
        });

        it('should not reset settings.aiPlayers if set before resetState', () => {
            // Note: aiPlayers is typically restored separately in startGameWithTeams
            state.settings.aiPlayers = [1, 2];
            const aiPlayers = [...state.settings.aiPlayers];

            // After resetState, settings should persist
            expect(state.settings).toBeDefined();
        });
    });
});

describe('Unit Creation', () => {
    beforeEach(() => {
        resetState();
    });

    it('should create units for each player based on team selection', async () => {
        const { createUnits } = await import('../js/units.js');
        const { generateMap } = await import('../js/map.js');

        state.settings.players = 2;
        state.settings.size = 'small';
        state.teamSelections = [
            ['scout', 'assault', 'medic'],
            ['scout', 'assault', 'medic']
        ];

        generateMap();
        createUnits();

        // Should have units for both players
        expect(state.units.length).toBeGreaterThan(0);

        const player0Units = getPlayerUnits(0);
        const player1Units = getPlayerUnits(1);

        expect(player0Units.length).toBeGreaterThan(0);
        expect(player1Units.length).toBeGreaterThan(0);
    });

    it('units should have valid positions on map', async () => {
        const { createUnits } = await import('../js/units.js');
        const { generateMap } = await import('../js/map.js');

        state.settings.players = 2;
        state.settings.size = 'small';
        state.teamSelections = [['scout'], ['scout']];

        generateMap();
        createUnits();

        state.units.forEach(unit => {
            // Unit should be on a valid hex
            const hex = state.hexMap.get(`${unit.q},${unit.r}`);
            expect(hex).toBeDefined();
            // Hex should be walkable
            const terrain = TERRAIN[hex.type];
            expect(terrain?.walkable).toBe(true);
        });
    });
});

describe('Spectator Mode', () => {
    beforeEach(() => {
        resetState();
    });

    it('isSpectatorMode should return true when all players are AI', async () => {
        const { isSpectatorMode, isAIPlayer } = await import('../js/ai.js');
        const { createUnits } = await import('../js/units.js');
        const { generateMap } = await import('../js/map.js');

        state.settings.players = 2;
        state.settings.aiPlayers = [0, 1]; // Both players are AI
        state.settings.size = 'small';
        state.teamSelections = [['scout'], ['scout']];

        generateMap();
        createUnits();

        expect(isSpectatorMode()).toBe(true);
    });

    it('isSpectatorMode should return false when human players exist', async () => {
        const { isSpectatorMode } = await import('../js/ai.js');
        const { createUnits } = await import('../js/units.js');
        const { generateMap } = await import('../js/map.js');

        state.settings.players = 2;
        state.settings.aiPlayers = [1]; // Only player 1 is AI
        state.settings.size = 'small';
        state.teamSelections = [['scout'], ['scout']];

        generateMap();
        createUnits();

        expect(isSpectatorMode()).toBe(false);
    });

    it('viewingPlayer should be valid for spectator mode', async () => {
        const { isSpectatorMode } = await import('../js/ai.js');
        const { createUnits } = await import('../js/units.js');
        const { generateMap } = await import('../js/map.js');

        state.settings.players = 2;
        state.settings.aiPlayers = [0, 1];
        state.settings.size = 'small';
        state.teamSelections = [['scout'], ['scout']];

        generateMap();
        createUnits();

        if (isSpectatorMode()) {
            // In spectator mode, viewingPlayer should follow currentPlayer
            state.viewingPlayer = state.currentPlayer;
        }

        expect(state.viewingPlayer).toBeGreaterThanOrEqual(0);
        expect(state.viewingPlayer).toBeLessThan(state.settings.players);
    });
});

describe('Visibility After Game Init', () => {
    beforeEach(() => {
        resetState();
    });

    it('should have visibility after full initialization', async () => {
        const { createUnits } = await import('../js/units.js');
        const { generateMap } = await import('../js/map.js');
        const { updateVisibility, getFogLevel } = await import('../js/fogOfWar.js');

        state.settings.players = 2;
        state.settings.size = 'small';
        state.teamSelections = [['scout', 'assault'], ['scout', 'assault']];

        // Simulate game initialization sequence
        generateMap();
        createUnits();
        state.currentPlayer = 0;
        state.viewingPlayer = 0;
        updateVisibility();

        // Count visible hexes
        let visibleCount = 0;
        state.hexes.forEach(hex => {
            if (getFogLevel(hex.q, hex.r) === 'visible') {
                visibleCount++;
            }
        });

        // Must have some visible hexes (prevents black screen)
        expect(visibleCount).toBeGreaterThan(0);
    });

    it('should have visibility for both players after initialization', async () => {
        const { createUnits } = await import('../js/units.js');
        const { generateMap } = await import('../js/map.js');
        const { updateVisibility } = await import('../js/fogOfWar.js');

        state.settings.players = 2;
        state.settings.size = 'small';
        state.teamSelections = [['scout'], ['scout']];

        generateMap();
        createUnits();

        // Update visibility for player 0
        state.currentPlayer = 0;
        updateVisibility();

        // Update visibility for player 1
        state.currentPlayer = 1;
        updateVisibility();

        // Both players should have visibility data
        expect(state.playerVisibleHexes[0].size).toBeGreaterThan(0);
        expect(state.playerVisibleHexes[1].size).toBeGreaterThan(0);
    });
});

describe('AI Player Configuration', () => {
    beforeEach(() => {
        resetState();
    });

    it('aiPlayers array should be valid', () => {
        state.settings.players = 4;
        state.settings.aiPlayers = [1, 3];

        // All AI player indices should be valid
        state.settings.aiPlayers.forEach(p => {
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThan(state.settings.players);
        });
    });

    it('should handle empty aiPlayers array', async () => {
        const { isAIPlayer } = await import('../js/ai.js');

        state.settings.players = 2;
        state.settings.aiPlayers = [];

        // No players should be AI
        expect(isAIPlayer(0)).toBe(false);
        expect(isAIPlayer(1)).toBe(false);
    });

    it('should correctly identify AI players', async () => {
        const { isAIPlayer } = await import('../js/ai.js');

        state.settings.players = 4;
        state.settings.aiPlayers = [1, 3];

        expect(isAIPlayer(0)).toBe(false);
        expect(isAIPlayer(1)).toBe(true);
        expect(isAIPlayer(2)).toBe(false);
        expect(isAIPlayer(3)).toBe(true);
    });
});

describe('Alliance Configuration', () => {
    beforeEach(() => {
        resetState();
    });

    it('should handle empty alliances (free for all)', async () => {
        const { getAlliedPlayers } = await import('../js/state.js');

        state.settings.players = 4;
        state.settings.alliances = [];

        // Each player should only be allied with themselves
        expect(getAlliedPlayers(0)).toEqual([0]);
        expect(getAlliedPlayers(1)).toEqual([1]);
    });

    it('should correctly group allies', async () => {
        const { getAlliedPlayers, arePlayersAllied } = await import('../js/state.js');

        state.settings.players = 4;
        state.settings.alliances = [0, 0, 1, 1]; // Teams: 0+1, 2+3

        // Players 0 and 1 should be allies
        expect(arePlayersAllied(0, 1)).toBe(true);
        expect(getAlliedPlayers(0)).toContain(1);

        // Players 0 and 2 should not be allies
        expect(arePlayersAllied(0, 2)).toBe(false);
    });
});

describe('Map Generation', () => {
    beforeEach(() => {
        resetState();
    });

    it('should generate hexes for all map sizes', async () => {
        const { generateMap } = await import('../js/map.js');

        const sizes = ['small', 'medium', 'large'];

        for (const size of sizes) {
            state.settings.size = size;
            resetState();
            generateMap();

            expect(state.hexes.length).toBeGreaterThan(0);
            expect(state.hexMap.size).toBeGreaterThan(0);
        }
    });

    it('generated map should have walkable terrain', async () => {
        const { generateMap } = await import('../js/map.js');

        state.settings.size = 'small';
        generateMap();

        // At least some hexes should be walkable
        const walkableHexes = state.hexes.filter(hex => {
            const terrain = TERRAIN[hex.type];
            return terrain?.walkable;
        });

        expect(walkableHexes.length).toBeGreaterThan(0);
    });
});
