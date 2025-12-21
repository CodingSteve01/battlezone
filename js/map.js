// ===== MAP GENERATION =====

import { CONFIG, TERRAIN } from './config.js';
import { state, setHex, getHex } from './state.js';
import { hexDistance, isValidHex } from './hexMath.js';

/**
 * Generate a new map with the current settings
 */
export function generateMap() {
    state.hexes = [];
    state.hexMap.clear();

    const radius = CONFIG.MAP_SIZES[state.settings.size];

    // Generate hexagonal grid
    for (let q = -radius; q <= radius; q++) {
        for (let r = -radius; r <= radius; r++) {
            if (!isValidHex(q, r, radius)) continue;

            const distFromCenter = hexDistance({ q: 0, r: 0 }, { q, r });
            const hex = createHex(q, r, distFromCenter, radius);
            setHex(hex);
        }
    }

    // Clear spawn areas
    clearSpawnAreas();

    // Add some interesting features
    addMapFeatures(radius);
}

/**
 * Create a single hex with terrain
 */
function createHex(q, r, distFromCenter, radius) {
    const rand = Math.random();
    const edgeFactor = distFromCenter / radius;

    let type = 'grass';

    // More variety based on position
    if (rand < 0.12) {
        type = 'forest';
    } else if (rand < 0.18) {
        type = 'rock';
    } else if (rand < 0.24 && distFromCenter > 2) {
        type = 'water';
    } else if (rand < 0.30) {
        type = 'sand';
    } else if (rand < 0.35 && distFromCenter > 1) {
        type = 'swamp';
    }

    // More rocks at edges
    if (edgeFactor > 0.8 && Math.random() < 0.3) {
        type = 'rock';
    }

    const terrain = TERRAIN[type];

    return {
        q,
        r,
        type,
        walkable: terrain.walkable,
        cover: terrain.cover,
        moveCost: terrain.moveCost,
        unit: null
    };
}

/**
 * Get spawn positions for all players
 */
export function getSpawnPositions() {
    const radius = CONFIG.MAP_SIZES[state.settings.size];
    const offset = CONFIG.SPAWN_OFFSET[state.settings.size];

    // Spawn positions at corners/edges of the map
    // Increased spacing for larger maps
    return [
        // Player 1: West
        [
            { q: -offset, r: 0 },
            { q: -offset, r: 1 },
            { q: -offset + 1, r: 0 }
        ],
        // Player 2: East
        [
            { q: offset, r: 0 },
            { q: offset, r: -1 },
            { q: offset - 1, r: 0 }
        ],
        // Player 3: North
        [
            { q: 0, r: -offset },
            { q: 1, r: -offset },
            { q: 0, r: -offset + 1 }
        ],
        // Player 4: South
        [
            { q: 0, r: offset },
            { q: -1, r: offset },
            { q: 0, r: offset - 1 }
        ]
    ];
}

/**
 * Clear spawn areas to ensure walkable terrain
 */
function clearSpawnAreas() {
    const spawns = getSpawnPositions();

    spawns.flat().forEach(pos => {
        const hex = getHex(pos.q, pos.r);
        if (hex) {
            hex.type = 'grass';
            hex.walkable = true;
            hex.cover = false;
            hex.moveCost = 1;
        }
    });

    // Also clear area around spawns (2 hex radius)
    spawns.forEach(playerSpawns => {
        const center = playerSpawns[0];
        for (let dq = -2; dq <= 2; dq++) {
            for (let dr = -2; dr <= 2; dr++) {
                if (Math.abs(dq + dr) <= 2) {
                    const hex = getHex(center.q + dq, center.r + dr);
                    if (hex && !hex.walkable) {
                        hex.type = 'grass';
                        hex.walkable = true;
                        hex.cover = false;
                        hex.moveCost = 1;
                    }
                }
            }
        }
    });
}

/**
 * Add interesting map features (clusters, paths, etc.)
 */
function addMapFeatures(radius) {
    // Add forest clusters
    addClusters('forest', 3, Math.floor(radius / 2), radius);

    // Add rock formations
    addClusters('rock', 2, Math.floor(radius / 3), radius);

    // Add water bodies
    addWaterBodies(Math.floor(radius / 4), radius);
}

/**
 * Add clusters of a terrain type
 */
function addClusters(type, count, size, radius) {
    for (let i = 0; i < count; i++) {
        // Random center point (not too close to center or edge)
        const angle = Math.random() * Math.PI * 2;
        const dist = radius * 0.3 + Math.random() * radius * 0.4;
        const centerQ = Math.round(Math.cos(angle) * dist);
        const centerR = Math.round(Math.sin(angle) * dist * 0.866);

        // Create cluster
        for (let dq = -size; dq <= size; dq++) {
            for (let dr = -size; dr <= size; dr++) {
                if (Math.abs(dq + dr) <= size && Math.random() < 0.6) {
                    const hex = getHex(centerQ + dq, centerR + dr);
                    if (hex && hex.type === 'grass') {
                        const terrain = TERRAIN[type];
                        hex.type = type;
                        hex.walkable = terrain.walkable;
                        hex.cover = terrain.cover;
                        hex.moveCost = terrain.moveCost;
                    }
                }
            }
        }
    }
}

/**
 * Add water bodies (lakes/rivers)
 */
function addWaterBodies(count, radius) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = radius * 0.2 + Math.random() * radius * 0.3;
        const centerQ = Math.round(Math.cos(angle) * dist);
        const centerR = Math.round(Math.sin(angle) * dist * 0.866);

        // Create small lake
        const lakeSize = 1 + Math.floor(Math.random() * 2);
        for (let dq = -lakeSize; dq <= lakeSize; dq++) {
            for (let dr = -lakeSize; dr <= lakeSize; dr++) {
                if (Math.abs(dq + dr) <= lakeSize && Math.random() < 0.7) {
                    const hex = getHex(centerQ + dq, centerR + dr);
                    if (hex && hex.type === 'grass') {
                        hex.type = 'water';
                        hex.walkable = false;
                        hex.cover = false;
                        hex.moveCost = Infinity;
                    }
                }
            }
        }
    }
}
