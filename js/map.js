// ===== MAP GENERATION =====

import { CONFIG, TERRAIN } from './config.js';
import { state, setHex, getHex } from './state.js';
import { hexDistance, isValidHex, getNeighbors } from './hexMath.js';

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

    // Clear spawn areas first
    clearSpawnAreas();

    // Add some interesting features
    addMapFeatures(radius);

    // Ensure all walkable areas are connected
    ensureMapConnectivity(radius);

    // Final validation pass
    validateAndFixMap(radius);
}

/**
 * Create a single hex with terrain
 */
function createHex(q, r, distFromCenter, radius) {
    const rand = Math.random();
    const edgeFactor = distFromCenter / radius;

    let type = 'grass';

    // More variety based on position
    if (rand < 0.10) {
        type = 'forest';
    } else if (rand < 0.14) {
        type = 'rock';
    } else if (rand < 0.18 && distFromCenter > 2) {
        type = 'water';
    } else if (rand < 0.24) {
        type = 'sand';
    } else if (rand < 0.28 && distFromCenter > 1) {
        type = 'swamp';
    }

    // Fewer rocks at edges to ensure connectivity
    if (edgeFactor > 0.85 && Math.random() < 0.15) {
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

    // Clear exact spawn positions
    spawns.flat().forEach(pos => {
        const hex = getHex(pos.q, pos.r);
        if (hex) {
            hex.type = 'grass';
            hex.walkable = true;
            hex.cover = false;
            hex.moveCost = 1;
        }
    });

    // Clear area around spawns (3 hex radius) to ensure movement
    spawns.forEach(playerSpawns => {
        const center = playerSpawns[0];
        for (let dq = -3; dq <= 3; dq++) {
            for (let dr = -3; dr <= 3; dr++) {
                if (Math.abs(dq + dr) <= 3) {
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
    // Add forest clusters - fewer and smaller
    addClusters('forest', 2, Math.floor(radius / 3), radius);

    // Add rock formations - smaller
    addClusters('rock', 1, Math.floor(radius / 4), radius);

    // Add water bodies - smaller
    addWaterBodies(Math.floor(radius / 5), radius);
}

/**
 * Add clusters of a terrain type
 */
function addClusters(type, count, size, radius) {
    for (let i = 0; i < count; i++) {
        // Random center point (not too close to center or edge)
        const angle = Math.random() * Math.PI * 2;
        const dist = radius * 0.25 + Math.random() * radius * 0.35;
        const centerQ = Math.round(Math.cos(angle) * dist);
        const centerR = Math.round(Math.sin(angle) * dist * 0.866);

        // Create cluster with gaps to maintain connectivity
        for (let dq = -size; dq <= size; dq++) {
            for (let dr = -size; dr <= size; dr++) {
                // Create more sparse clusters with gaps
                if (Math.abs(dq + dr) <= size && Math.random() < 0.5) {
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
        const dist = radius * 0.15 + Math.random() * radius * 0.25;
        const centerQ = Math.round(Math.cos(angle) * dist);
        const centerR = Math.round(Math.sin(angle) * dist * 0.866);

        // Create small lake - very small to not block paths
        const lakeSize = 1;
        for (let dq = -lakeSize; dq <= lakeSize; dq++) {
            for (let dr = -lakeSize; dr <= lakeSize; dr++) {
                if (Math.abs(dq + dr) <= lakeSize && Math.random() < 0.6) {
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

/**
 * Ensure all walkable areas are connected using flood fill
 */
function ensureMapConnectivity(radius) {
    // Find all walkable hexes
    const walkableHexes = state.hexes.filter(h => h.walkable);
    if (walkableHexes.length === 0) return;

    // Start flood fill from first spawn position
    const spawns = getSpawnPositions();
    const startHex = getHex(spawns[0][0].q, spawns[0][0].r);
    if (!startHex || !startHex.walkable) return;

    // Flood fill to find connected region
    const visited = new Set();
    const queue = [startHex];
    visited.add(`${startHex.q},${startHex.r}`);

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = getNeighbors(current.q, current.r);

        for (const neighbor of neighbors) {
            const key = `${neighbor.q},${neighbor.r}`;
            if (visited.has(key)) continue;

            const hex = getHex(neighbor.q, neighbor.r);
            if (hex && hex.walkable) {
                visited.add(key);
                queue.push(hex);
            }
        }
    }

    // Find all walkable hexes that are NOT connected
    const disconnected = walkableHexes.filter(h => !visited.has(`${h.q},${h.r}`));

    // Connect disconnected regions by creating paths
    for (const hex of disconnected) {
        // Find nearest connected hex
        let nearestConnected = null;
        let minDist = Infinity;

        for (const connectedKey of visited) {
            const [q, r] = connectedKey.split(',').map(Number);
            const dist = hexDistance(hex, { q, r });
            if (dist < minDist) {
                minDist = dist;
                nearestConnected = { q, r };
            }
        }

        if (nearestConnected && minDist > 0) {
            // Create path between disconnected and nearest connected hex
            createPath(hex, nearestConnected, visited);
        }
    }

    // Also ensure spawn points are connected to each other
    ensureSpawnConnectivity(spawns, radius);
}

/**
 * Create a walkable path between two points
 */
function createPath(from, to, visitedSet) {
    // Simple line-based path creation
    const dist = hexDistance(from, to);
    if (dist === 0) return;

    for (let i = 0; i <= dist; i++) {
        const t = i / dist;
        const q = Math.round(from.q + (to.q - from.q) * t);
        const r = Math.round(from.r + (to.r - from.r) * t);

        const hex = getHex(q, r);
        if (hex && !hex.walkable) {
            hex.type = 'grass';
            hex.walkable = true;
            hex.cover = false;
            hex.moveCost = 1;
        }

        if (hex) {
            visitedSet.add(`${q},${r}`);
        }
    }
}

/**
 * Ensure all spawn points are connected to each other
 */
function ensureSpawnConnectivity(spawns, radius) {
    const activePlayers = state.settings.players;

    // Get first spawn of each active player
    const spawnCenters = [];
    for (let i = 0; i < activePlayers; i++) {
        spawnCenters.push(spawns[i][0]);
    }

    // Create paths between adjacent spawn points
    for (let i = 0; i < spawnCenters.length; i++) {
        const from = spawnCenters[i];
        const to = spawnCenters[(i + 1) % spawnCenters.length];

        // Create a wide path between spawns
        createWidePath(from, to, 2);
    }

    // Also create path through center for better connectivity
    const center = { q: 0, r: 0 };
    for (const spawn of spawnCenters) {
        createWidePath(spawn, center, 1);
    }
}

/**
 * Create a wider walkable path between two points
 */
function createWidePath(from, to, width) {
    const dist = hexDistance(from, to);
    if (dist === 0) return;

    for (let i = 0; i <= dist; i++) {
        const t = i / dist;
        const q = Math.round(from.q + (to.q - from.q) * t);
        const r = Math.round(from.r + (to.r - from.r) * t);

        // Clear the hex and its neighbors within width
        for (let dq = -width; dq <= width; dq++) {
            for (let dr = -width; dr <= width; dr++) {
                if (Math.abs(dq + dr) <= width) {
                    const hex = getHex(q + dq, r + dr);
                    if (hex && !hex.walkable) {
                        hex.type = 'grass';
                        hex.walkable = true;
                        hex.cover = false;
                        hex.moveCost = 1;
                    }
                }
            }
        }
    }
}

/**
 * Final validation and fix pass
 */
function validateAndFixMap(radius) {
    // Check that each spawn area has at least 6 walkable neighbors
    const spawns = getSpawnPositions();

    for (let p = 0; p < state.settings.players; p++) {
        for (const spawn of spawns[p]) {
            const hex = getHex(spawn.q, spawn.r);
            if (!hex) continue;

            // Ensure spawn is walkable
            if (!hex.walkable) {
                hex.type = 'grass';
                hex.walkable = true;
                hex.cover = false;
                hex.moveCost = 1;
            }

            // Count walkable neighbors
            const neighbors = getNeighbors(spawn.q, spawn.r);
            let walkableCount = 0;

            for (const n of neighbors) {
                const nHex = getHex(n.q, n.r);
                if (nHex && nHex.walkable) walkableCount++;
            }

            // If fewer than 3 walkable neighbors, clear more
            if (walkableCount < 3) {
                for (const n of neighbors) {
                    const nHex = getHex(n.q, n.r);
                    if (nHex && !nHex.walkable) {
                        nHex.type = 'grass';
                        nHex.walkable = true;
                        nHex.cover = false;
                        nHex.moveCost = 1;
                    }
                }
            }
        }
    }

    // Remove isolated unwalkable hexes that completely block paths
    state.hexes.forEach(hex => {
        if (!hex.walkable) {
            const neighbors = getNeighbors(hex.q, hex.r);
            let unwalkableNeighbors = 0;

            for (const n of neighbors) {
                const nHex = getHex(n.q, n.r);
                if (!nHex || !nHex.walkable) unwalkableNeighbors++;
            }

            // If surrounded by mostly unwalkable hexes, might be part of a blocking wall
            // Check if it's creating a complete blockage
            if (unwalkableNeighbors <= 1) {
                // This is an isolated blocker, make it walkable
                hex.type = 'grass';
                hex.walkable = true;
                hex.cover = false;
                hex.moveCost = 1;
            }
        }
    });
}
