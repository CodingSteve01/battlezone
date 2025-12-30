/**
 * Unit tests for WebGL renderer
 * Tests WebGL renderer utilities and basic functionality
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { 
    isWebGLAvailable,
    cleanupWebGL,
    markMeshDirty
} from '../js/rendererWebGL.js';

// Mock state
vi.mock('../js/state.js', () => ({
    state: {
        hexes: [],
        hexMap: new Map(),
        meshDirty: false
    },
    getHex: vi.fn((q, r) => ({
        q, r,
        type: 'grass',
        height: 0,
        walkable: true
    }))
}));

// Mock config
vi.mock('../js/config.js', () => ({
    CONFIG: {
        BASE_HEX_SIZE: 100,
        HEX_SIZE_SCALE: 0.8,
        TILE_SCALE: 0.5,
        HEIGHT: {
            MAX: 3
        },
        LIGHTING: {
            DIRECTION: { x: -0.6, y: -1.0 },
            HEIGHT: 1.2
        }
    },
    TERRAIN: {
        grass: { color: '#6a9a58' }
    }
}));

// Mock hex math
vi.mock('../js/hexMath.js', () => ({
    hexToPixel: vi.fn((q, r, size) => ({ x: q * size, y: r * size }))
}));

// Mock fog of war
vi.mock('../js/fogOfWar.js', () => ({
    getFogLevel: vi.fn(() => 'visible')
}));

// Mock texture atlas
vi.mock('../js/textureAtlas.js', () => ({
    createWebGLTexture: vi.fn(async () => ({})),
    getTerrainUVCoords: vi.fn(() => [0, 0, 0.25, 0.25])
}));

// Mock error log
vi.mock('../js/errorLog.js', () => ({
    logEntry: vi.fn(),
    logError: vi.fn()
}));

describe('WebGL Renderer', () => {
    describe('isWebGLAvailable', () => {
        it('should return a boolean', () => {
            const available = isWebGLAvailable();
            expect(typeof available).toBe('boolean');
        });

        it('should detect WebGL support correctly', () => {
            // In jsdom, WebGL is typically not available
            // but the function should not throw
            expect(() => isWebGLAvailable()).not.toThrow();
        });
    });

    describe('markMeshDirty', () => {
        it('should mark mesh as dirty in state', async () => {
            const { state } = await import('../js/state.js');
            state.meshDirty = false;
            
            markMeshDirty();
            
            expect(state.meshDirty).toBe(true);
        });

        it('should be idempotent', async () => {
            const { state } = await import('../js/state.js');
            
            markMeshDirty();
            markMeshDirty();
            
            expect(state.meshDirty).toBe(true);
        });
    });

    describe('cleanupWebGL', () => {
        it('should not throw when cleaning up', () => {
            expect(() => cleanupWebGL()).not.toThrow();
        });

        it('should be safe to call multiple times', () => {
            expect(() => {
                cleanupWebGL();
                cleanupWebGL();
            }).not.toThrow();
        });
    });
});

describe('WebGL Integration', () => {
    it('should export required functions', async () => {
        const module = await import('../js/rendererWebGL.js');
        
        expect(module.initWebGLRenderer).toBeDefined();
        expect(module.renderWebGL).toBeDefined();
        expect(module.isWebGLAvailable).toBeDefined();
        expect(module.cleanupWebGL).toBeDefined();
        expect(module.markMeshDirty).toBeDefined();
    });
});

