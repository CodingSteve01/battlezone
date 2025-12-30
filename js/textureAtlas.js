/**
 * Texture Atlas Generator for WebGL Renderer
 * 
 * Creates a single texture atlas from terrain tiles for efficient WebGL rendering.
 * Converts hex-based terrain sprites to rectangular texture regions.
 */

import { TERRAIN } from './config.js';
import { logEntry, logError } from './errorLog.js';

// Atlas configuration
const ATLAS_SIZE = 2048; // 2048x2048 texture atlas
const TILE_SIZE = 512;   // Each terrain type gets a 512x512 region
const TILES_PER_ROW = Math.floor(ATLAS_SIZE / TILE_SIZE);

// Cache for generated atlas
let atlasCanvas = null;
let atlasTexture = null;
let atlasReady = false;

/**
 * Generate texture atlas from terrain types
 * Creates a single texture with all terrain types in a grid layout
 * @returns {Promise<HTMLCanvasElement>} Canvas containing the texture atlas
 */
export async function generateTextureAtlas() {
    if (atlasCanvas) {
        logEntry('debug', '[TextureAtlas] Using cached atlas', `Size: ${atlasCanvas.width}x${atlasCanvas.height}`);
        return atlasCanvas;
    }
    
    try {
        logEntry('info', '[TextureAtlas] Generating texture atlas...', `Target size: ${ATLAS_SIZE}x${ATLAS_SIZE}, Tile size: ${TILE_SIZE}px`);
        
        // Create canvas for atlas
        atlasCanvas = document.createElement('canvas');
        atlasCanvas.width = ATLAS_SIZE;
        atlasCanvas.height = ATLAS_SIZE;
        const ctx = atlasCanvas.getContext('2d');
        
        if (!ctx) {
            throw new Error('Failed to get 2D context from atlas canvas');
        }
        
        // Fill with placeholder background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
        
        // Generate each terrain type
        const terrainTypes = Object.keys(TERRAIN);
        let index = 0;
        let generatedCount = 0;
        
        for (const terrainType of terrainTypes) {
            if (index >= TILES_PER_ROW * TILES_PER_ROW) {
                logEntry('warn', '[TextureAtlas] Atlas full, skipping remaining terrain types', 
                    `Generated: ${generatedCount}/${terrainTypes.length}`);
                break;
            }
            
            try {
                const row = Math.floor(index / TILES_PER_ROW);
                const col = index % TILES_PER_ROW;
                const x = col * TILE_SIZE;
                const y = row * TILE_SIZE;
                
                // Generate terrain tile
                await generateTerrainTile(ctx, x, y, TILE_SIZE, terrainType);
                generatedCount++;
            } catch (err) {
                logError(`[TextureAtlas] Failed to generate terrain tile: ${terrainType}`, err);
            }
            
            index++;
        }
        
        atlasReady = true;
        logEntry('info', '[TextureAtlas] Atlas generated successfully', 
            `Terrain types: ${generatedCount}/${terrainTypes.length}, Size: ${ATLAS_SIZE}x${ATLAS_SIZE}`);
        
        return atlasCanvas;
    } catch (err) {
        logError('[TextureAtlas] Failed to generate texture atlas', err);
        throw err;
    }
}

/**
 * Generate a single terrain tile in the atlas
 * Creates a rectangular texture with the terrain's appearance
 */
async function generateTerrainTile(ctx, x, y, size, terrainType) {
    const terrain = TERRAIN[terrainType];
    if (!terrain) return;
    
    // Draw base color
    ctx.fillStyle = terrain.color;
    ctx.fillRect(x, y, size, size);
    
    // Add gradient for depth
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, terrain.colorLight || terrain.color);
    gradient.addColorStop(0.5, terrain.color);
    gradient.addColorStop(1, terrain.colorDark || terrain.color);
    
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);
    ctx.globalAlpha = 1.0;
    
    // Add texture detail based on terrain type
    addTerrainDetail(ctx, x, y, size, terrainType, terrain);
}

/**
 * Add procedural detail to terrain tiles
 * Creates noise, patterns, or other visual detail for each terrain type
 */
function addTerrainDetail(ctx, x, y, size, terrainType, terrain) {
    // Seeded random for consistent results
    const seed = terrainType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let randomState = seed;
    
    const seededRandom = () => {
        randomState = (randomState * 16807) % 2147483647;
        return (randomState - 1) / 2147483646;
    };
    
    ctx.save();
    ctx.globalAlpha = 0.15;
    
    // Add different detail patterns based on terrain
    if (terrainType === 'grass' || terrainType === 'forest') {
        // Grass texture - small dots and lines
        ctx.strokeStyle = terrain.colorDark;
        ctx.lineWidth = 1;
        for (let i = 0; i < 200; i++) {
            const px = x + seededRandom() * size;
            const py = y + seededRandom() * size;
            const length = 3 + seededRandom() * 5;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + seededRandom() * length - length / 2, py + length);
            ctx.stroke();
        }
    } else if (terrainType === 'water' || terrainType === 'river') {
        // Water texture - horizontal waves
        ctx.strokeStyle = terrain.colorLight;
        ctx.lineWidth = 2;
        for (let i = 0; i < 20; i++) {
            const py = y + (i / 20) * size;
            ctx.beginPath();
            ctx.moveTo(x, py);
            for (let px = 0; px < size; px += 10) {
                const wave = Math.sin(px / 20 + i) * 3;
                ctx.lineTo(x + px, py + wave);
            }
            ctx.stroke();
        }
    } else if (terrainType === 'rock' || terrainType === 'hills') {
        // Rock texture - irregular shapes
        ctx.fillStyle = terrain.colorDark;
        for (let i = 0; i < 30; i++) {
            const px = x + seededRandom() * size;
            const py = y + seededRandom() * size;
            const rockSize = 5 + seededRandom() * 15;
            ctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const angle = (j / 6) * Math.PI * 2;
                const radius = rockSize * (0.7 + seededRandom() * 0.3);
                const rx = px + Math.cos(angle) * radius;
                const ry = py + Math.sin(angle) * radius;
                if (j === 0) ctx.moveTo(rx, ry);
                else ctx.lineTo(rx, ry);
            }
            ctx.closePath();
            ctx.fill();
        }
    } else if (terrainType === 'sand') {
        // Sand texture - fine dots
        ctx.fillStyle = terrain.colorDark;
        for (let i = 0; i < 500; i++) {
            const px = x + seededRandom() * size;
            const py = y + seededRandom() * size;
            ctx.fillRect(px, py, 1, 1);
        }
    }
    
    ctx.restore();
}

/**
 * Get UV coordinates for a terrain type in the atlas
 * Returns normalized coordinates [uMin, vMin, uMax, vMax] in range 0-1
 */
export function getTerrainUVCoords(terrainType) {
    const terrainTypes = Object.keys(TERRAIN);
    const index = terrainTypes.indexOf(terrainType);
    
    if (index === -1) {
        // Default to first terrain type
        return [0, 0, 1 / TILES_PER_ROW, 1 / TILES_PER_ROW];
    }
    
    const row = Math.floor(index / TILES_PER_ROW);
    const col = index % TILES_PER_ROW;
    
    const uMin = col / TILES_PER_ROW;
    const vMin = row / TILES_PER_ROW;
    const uMax = (col + 1) / TILES_PER_ROW;
    const vMax = (row + 1) / TILES_PER_ROW;
    
    return [uMin, vMin, uMax, vMax];
}

/**
 * Create WebGL texture from atlas
 * @param {WebGLRenderingContext} gl - WebGL context
 * @returns {WebGLTexture} Created texture
 */
export async function createWebGLTexture(gl) {
    try {
        if (!atlasCanvas && !atlasReady) {
            await generateTextureAtlas();
        }
        
        if (!atlasCanvas) {
            throw new Error('Atlas canvas not available after generation');
        }
        
        const texture = gl.createTexture();
        if (!texture) {
            throw new Error('gl.createTexture() returned null');
        }
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Upload atlas to GPU
        // texImage2D parameters: target, level, internalFormat, format, type, source
        gl.texImage2D(
            gl.TEXTURE_2D,      // target
            0,                  // mipmap level
            gl.RGBA,            // internalFormat - how WebGL stores the texture
            gl.RGBA,            // format - format of the data being uploaded
            gl.UNSIGNED_BYTE,   // type - data type
            atlasCanvas         // source data
        );
        
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        atlasTexture = texture;
        logEntry('info', '[TextureAtlas] WebGL texture created', 
            `Size: ${atlasCanvas.width}x${atlasCanvas.height}, ID: ${texture}`);
        
        return texture;
    } catch (err) {
        logError('[TextureAtlas] Failed to create WebGL texture', err);
        throw err;
    }
}

/**
 * Get the atlas canvas for debugging or preview
 */
export function getAtlasCanvas() {
    return atlasCanvas;
}

/**
 * Check if atlas is ready
 */
export function isAtlasReady() {
    return atlasReady;
}

/**
 * Clear atlas cache (e.g., when terrain config changes)
 */
export function clearAtlas() {
    atlasCanvas = null;
    atlasTexture = null;
    atlasReady = false;
    console.log('[TextureAtlas] Atlas cache cleared');
}
