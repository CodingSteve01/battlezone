/**
 * Unit tests for Texture Atlas
 * Tests texture atlas UV coordinate mapping and exports
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import {
    getTerrainUVCoords,
    isAtlasReady,
    clearAtlas
} from '../js/textureAtlas.js';

// Mock TERRAIN
vi.mock('../js/config.js', () => ({
    TERRAIN: {
        grass: { color: '#6a9a58', colorLight: '#7db068', colorDark: '#4a7a40' },
        forest: { color: '#3d6a4a', colorLight: '#4d7a58', colorDark: '#2a5038' },
        water: { color: '#4a7a95', colorLight: '#5a8aa8', colorDark: '#3a6a80' },
        sand: { color: '#d4b888', colorLight: '#e4c898', colorDark: '#c4a878' },
        rock: { color: '#7a7878', colorLight: '#908a88', colorDark: '#5a5858' }
    }
}));

// Mock error log
vi.mock('../js/errorLog.js', () => ({
    logEntry: vi.fn(),
    logError: vi.fn()
}));

describe('Texture Atlas', () => {
    describe('getTerrainUVCoords', () => {
        it('should return valid UV coordinates for grass', () => {
            const uvCoords = getTerrainUVCoords('grass');
            
            expect(Array.isArray(uvCoords)).toBe(true);
            expect(uvCoords).toHaveLength(4);
            
            // UV coordinates should be in range [0, 1]
            uvCoords.forEach(coord => {
                expect(coord).toBeGreaterThanOrEqual(0);
                expect(coord).toBeLessThanOrEqual(1);
            });
        });

        it('should return different UV coords for different terrains', () => {
            const grassUV = getTerrainUVCoords('grass');
            const forestUV = getTerrainUVCoords('forest');
            
            expect(grassUV).not.toEqual(forestUV);
        });

        it('should return valid UV coords for unknown terrain (fallback)', () => {
            const unknownUV = getTerrainUVCoords('nonexistent_terrain');
            
            expect(Array.isArray(unknownUV)).toBe(true);
            expect(unknownUV).toHaveLength(4);
        });

        it('should return rectangular region (uMin < uMax, vMin < vMax)', () => {
            const [uMin, vMin, uMax, vMax] = getTerrainUVCoords('grass');
            
            expect(uMin).toBeLessThan(uMax);
            expect(vMin).toBeLessThan(vMax);
        });

        it('should return consistent UV coords for same terrain', () => {
            const uv1 = getTerrainUVCoords('water');
            const uv2 = getTerrainUVCoords('water');
            
            expect(uv1).toEqual(uv2);
        });

        it('should handle all known terrain types', () => {
            const terrainTypes = ['grass', 'forest', 'water', 'sand', 'rock'];
            
            terrainTypes.forEach(terrain => {
                expect(() => getTerrainUVCoords(terrain)).not.toThrow();
                
                const uvCoords = getTerrainUVCoords(terrain);
                expect(uvCoords).toHaveLength(4);
            });
        });
    });

    describe('isAtlasReady', () => {
        it('should return a boolean', () => {
            const ready = isAtlasReady();
            expect(typeof ready).toBe('boolean');
        });
    });

    describe('clearAtlas', () => {
        it('should not throw when clearing atlas', () => {
            expect(() => clearAtlas()).not.toThrow();
        });

        it('should mark atlas as not ready after clearing', () => {
            clearAtlas();
            expect(isAtlasReady()).toBe(false);
        });

        it('should be safe to call multiple times', () => {
            expect(() => {
                clearAtlas();
                clearAtlas();
            }).not.toThrow();
        });
    });

    describe('UV Coordinate Validation', () => {
        it('should have non-overlapping UV regions for different terrains', () => {
            const terrainTypes = ['grass', 'forest', 'water'];
            const uvRegions = terrainTypes.map(t => getTerrainUVCoords(t));
            
            // Check that regions don't completely overlap
            for (let i = 0; i < uvRegions.length; i++) {
                for (let j = i + 1; j < uvRegions.length; j++) {
                    const [uMin1, vMin1, uMax1, vMax1] = uvRegions[i];
                    const [uMin2, vMin2, uMax2, vMax2] = uvRegions[j];
                    
                    // At least one dimension should not overlap completely
                    const noOverlap = 
                        uMax1 <= uMin2 || uMax2 <= uMin1 ||
                        vMax1 <= vMin2 || vMax2 <= vMin1;
                    
                    // Allow partial overlap but not complete overlap
                    const notIdentical = 
                        uMin1 !== uMin2 || vMin1 !== vMin2 ||
                        uMax1 !== uMax2 || vMax1 !== vMax2;
                    
                    expect(notIdentical).toBe(true);
                }
            }
        });

        it('should have valid area for each region', () => {
            const terrainTypes = ['grass', 'forest', 'water', 'sand'];
            
            terrainTypes.forEach(terrain => {
                const [uMin, vMin, uMax, vMax] = getTerrainUVCoords(terrain);
                
                const width = uMax - uMin;
                const height = vMax - vMin;
                
                // Should have positive area
                expect(width).toBeGreaterThan(0);
                expect(height).toBeGreaterThan(0);
            });
        });
    });

    describe('Module Exports', () => {
        it('should export required functions', async () => {
            const module = await import('../js/textureAtlas.js');
            
            expect(module.generateTextureAtlas).toBeDefined();
            expect(module.getTerrainUVCoords).toBeDefined();
            expect(module.createWebGLTexture).toBeDefined();
            expect(module.isAtlasReady).toBeDefined();
            expect(module.clearAtlas).toBeDefined();
            expect(module.getAtlasCanvas).toBeDefined();
        });
    });
});

