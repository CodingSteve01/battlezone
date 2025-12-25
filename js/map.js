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
 * Simple noise function for terrain generation
 */
function noise2D(x, y, seed = 0) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.758) * 43758.5453;
    return n - Math.floor(n);
}

/**
 * Smooth noise using bilinear interpolation
 */
function smoothNoise(q, r, scale, seed) {
    const x = q / scale;
    const y = r / scale;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;

    const n00 = noise2D(x0, y0, seed);
    const n10 = noise2D(x0 + 1, y0, seed);
    const n01 = noise2D(x0, y0 + 1, seed);
    const n11 = noise2D(x0 + 1, y0 + 1, seed);

    const nx0 = n00 * (1 - fx) + n10 * fx;
    const nx1 = n01 * (1 - fx) + n11 * fx;

    return nx0 * (1 - fy) + nx1 * fy;
}

/**
 * Fractal noise for more natural terrain variation
 */
function fractalNoise(q, r, baseScale, octaves, seed) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += smoothNoise(q, r, baseScale / frequency, seed + i * 11) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / maxValue;
}

/**
 * Create a single hex with terrain using noise-based biomes
 */
function createHex(q, r, distFromCenter, radius) {
    const edgeFactor = distFromCenter / radius;

    // Use multiple noise layers for different terrain features
    const elevationNoise = fractalNoise(q, r, 16, 4, 1);
    const moistureNoise = fractalNoise(q, r, 14, 3, 2);
    const vegetationNoise = fractalNoise(q, r, 10, 3, 3);
    const roughnessNoise = fractalNoise(q, r, 8, 2, 4);
    const varietyNoise = fractalNoise(q, r, 6, 2, 5);

    let type = 'grass';

    // Determine terrain based on noise values (biome system)
    if (elevationNoise > 0.78 || (elevationNoise > 0.7 && roughnessNoise > 0.6)) {
        // High elevation = rocks/mountains
        type = 'rock';
    } else if (elevationNoise > 0.65) {
        // Medium-high elevation = hills
        type = 'hills';
    } else if (elevationNoise < 0.25 && moistureNoise > 0.65 && distFromCenter > 2) {
        // Low elevation + high moisture = water (lakes)
        type = 'water';
    } else if (elevationNoise < 0.32 && moistureNoise > 0.55 && distFromCenter > 1) {
        // Low elevation + medium moisture = swamp (near water)
        type = 'swamp';
    } else if (moistureNoise > 0.62 && vegetationNoise > 0.5) {
        // High moisture + high vegetation = dense forest
        type = varietyNoise > 0.6 ? 'pine' : 'forest';
    } else if (moistureNoise > 0.5 && vegetationNoise > 0.4) {
        // Medium moisture + vegetation = lighter forest/clearing
        type = varietyNoise > 0.7 ? 'clearing' : 'forest';
    } else if (moistureNoise < 0.28 && elevationNoise < 0.45) {
        // Low moisture + low elevation = sand
        type = 'sand';
    } else if (elevationNoise > 0.5 && moistureNoise < 0.4) {
        // Higher ground + drier = heather moorland
        type = varietyNoise > 0.55 ? 'heather' : 'grass';
    }
    // Default: grass

    // Add variety to grass areas
    const rand = smoothNoise(q, r, 2, 9);
    if (type === 'grass') {
        if (rand < 0.08 && vegetationNoise > 0.45) {
            // Add flowers to some grass tiles
            type = 'flowers';
        } else if (rand < 0.12 && varietyNoise > 0.6) {
            // Add occasional scattered trees (forest)
            type = vegetationNoise > 0.5 ? 'forest' : 'hills';
        } else if (rand < 0.15 && elevationNoise > 0.45) {
            // Add heather patches
            type = 'heather';
        }
    }

    // Add ancient ruins scattered across the map (rare)
    if (type === 'grass' && varietyNoise > 0.85 && distFromCenter > 3 && rand < 0.03) {
        type = 'ruins';
    }

    // Keep edges more passable
    if (edgeFactor > 0.85 && !TERRAIN[type].walkable) {
        type = 'grass';
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
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Clamp a spawn position to be within map bounds
 */
function clampSpawnPosition(pos, radius) {
    let { q, r } = pos;

    // First, check if position is valid
    if (isValidHex(q, r, radius)) {
        return { q, r };
    }

    // If not valid, find the nearest valid hex
    // Scale down the position proportionally to fit within bounds
    const maxCoord = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    if (maxCoord > 0) {
        const scale = (radius - 1) / maxCoord;
        q = Math.round(q * scale);
        r = Math.round(r * scale);
    }

    // Final validation - if still invalid, move toward center
    while (!isValidHex(q, r, radius) && (Math.abs(q) > 0 || Math.abs(r) > 0)) {
        if (Math.abs(q) >= Math.abs(r)) {
            q = q > 0 ? q - 1 : q + 1;
        } else {
            r = r > 0 ? r - 1 : r + 1;
        }
    }

    return { q, r };
}

/**
 * Get spawn positions for all players - randomized each game
 */
export function getSpawnPositions() {
    const radius = CONFIG.MAP_SIZES[state.settings.size];
    // Use a smaller offset to ensure spawns are well inside the map
    const baseOffset = CONFIG.SPAWN_OFFSET[state.settings.size];
    const offset = Math.min(baseOffset, radius - 2);

    // Define all possible spawn locations (8 directions for up to 8 players)
    const allSpawnLocations = [
        // West
        [
            { q: -offset, r: 0 },
            { q: -offset, r: 1 },
            { q: -offset + 1, r: 0 }
        ],
        // East
        [
            { q: offset, r: 0 },
            { q: offset, r: -1 },
            { q: offset - 1, r: 0 }
        ],
        // North-West
        [
            { q: -Math.floor(offset * 0.6), r: -Math.floor(offset * 0.6) },
            { q: -Math.floor(offset * 0.6) + 1, r: -Math.floor(offset * 0.6) },
            { q: -Math.floor(offset * 0.6), r: -Math.floor(offset * 0.6) + 1 }
        ],
        // North-East
        [
            { q: Math.floor(offset * 0.6), r: -Math.floor(offset * 0.8) },
            { q: Math.floor(offset * 0.6) - 1, r: -Math.floor(offset * 0.8) + 1 },
            { q: Math.floor(offset * 0.6), r: -Math.floor(offset * 0.8) + 1 }
        ],
        // South-West
        [
            { q: -Math.floor(offset * 0.6), r: Math.floor(offset * 0.8) },
            { q: -Math.floor(offset * 0.6), r: Math.floor(offset * 0.8) - 1 },
            { q: -Math.floor(offset * 0.6) + 1, r: Math.floor(offset * 0.8) - 1 }
        ],
        // South-East
        [
            { q: Math.floor(offset * 0.6), r: Math.floor(offset * 0.6) },
            { q: Math.floor(offset * 0.6) - 1, r: Math.floor(offset * 0.6) },
            { q: Math.floor(offset * 0.6), r: Math.floor(offset * 0.6) - 1 }
        ],
        // North (for 7+ players)
        [
            { q: 0, r: -offset },
            { q: 1, r: -offset },
            { q: -1, r: -offset + 1 }
        ],
        // South (for 8 players)
        [
            { q: 0, r: offset },
            { q: -1, r: offset },
            { q: 1, r: offset - 1 }
        ]
    ];

    // Validate and clamp all spawn positions to be within map bounds
    const validatedLocations = allSpawnLocations.map(playerSpawns =>
        playerSpawns.map(pos => clampSpawnPosition(pos, radius))
    );

    // Shuffle spawn locations for variety
    const shuffled = shuffleArray(validatedLocations);

    // Return only the number of spawns needed for active players (up to 8)
    return shuffled.slice(0, 8);
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

    // Add rivers flowing across the map
    addRivers(1, radius);

    // Add roads connecting areas
    addRoads(radius);

    // Add dirt paths for variety
    addPaths(2, radius);
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
 * Add rivers that flow across the map
 */
function addRivers(count, radius) {
    for (let i = 0; i < count; i++) {
        // Start from a random edge
        const startAngle = Math.random() * Math.PI * 2;
        const startDist = radius * 0.6;
        const q = Math.round(Math.cos(startAngle) * startDist);
        const r = Math.round(Math.sin(startAngle) * startDist * 0.866);

        // Flow toward opposite side with meandering
        const targetAngle = startAngle + Math.PI + (Math.random() - 0.5) * 0.8;
        const targetDist = radius * 0.6;
        const targetQ = Math.round(Math.cos(targetAngle) * targetDist);
        const targetR = Math.round(Math.sin(targetAngle) * targetDist * 0.866);

        const riverLength = hexDistance({ q, r }, { q: targetQ, r: targetR });

        for (let step = 0; step <= riverLength; step++) {
            const t = step / riverLength;
            const baseQ = q + (targetQ - q) * t;
            const baseR = r + (targetR - r) * t;

            // Add meandering
            const meander = Math.sin(step * 0.5) * 2;
            const perpQ = Math.round(baseQ + meander * Math.cos(startAngle + Math.PI / 2));
            const perpR = Math.round(baseR + meander * Math.sin(startAngle + Math.PI / 2) * 0.866);

            const hex = getHex(perpQ, perpR);
            if (hex && hex.walkable && hex.type !== 'road') {
                hex.type = 'river';
                hex.walkable = true;
                hex.cover = false;
                hex.moveCost = TERRAIN.river.moveCost;
            }
        }
    }
}

/**
 * Add roads connecting spawn areas through center
 */
function addRoads(radius) {
    const spawns = getSpawnPositions();
    const center = { q: 0, r: 0 };

    // Create road from center outward in several directions
    const roadAngles = [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3];

    for (let i = 0; i < Math.min(3, roadAngles.length); i++) {
        const angle = roadAngles[i] + (Math.random() - 0.5) * 0.3;
        const length = radius * 0.5;

        for (let d = 0; d < length; d++) {
            const q = Math.round(Math.cos(angle) * d);
            const r = Math.round(Math.sin(angle) * d * 0.866);

            const hex = getHex(q, r);
            if (hex && hex.walkable && hex.type !== 'river') {
                hex.type = 'road';
                hex.walkable = true;
                hex.cover = false;
                hex.moveCost = TERRAIN.road.moveCost;
            }
        }
    }
}

/**
 * Add dirt paths for visual variety
 */
function addPaths(count, radius) {
    for (let i = 0; i < count; i++) {
        // Random start and end points
        const startAngle = Math.random() * Math.PI * 2;
        const startDist = radius * 0.3 + Math.random() * radius * 0.2;
        const startQ = Math.round(Math.cos(startAngle) * startDist);
        const startR = Math.round(Math.sin(startAngle) * startDist * 0.866);

        const endAngle = startAngle + Math.PI / 2 + (Math.random() - 0.5);
        const endDist = radius * 0.3 + Math.random() * radius * 0.2;
        const endQ = Math.round(Math.cos(endAngle) * endDist);
        const endR = Math.round(Math.sin(endAngle) * endDist * 0.866);

        const pathLength = hexDistance({ q: startQ, r: startR }, { q: endQ, r: endR });

        for (let step = 0; step <= pathLength; step++) {
            const t = step / pathLength;
            const q = Math.round(startQ + (endQ - startQ) * t);
            const r = Math.round(startR + (endR - startR) * t);

            const hex = getHex(q, r);
            if (hex && hex.walkable && hex.type === 'grass') {
                hex.type = 'path';
                hex.walkable = true;
                hex.cover = false;
                hex.moveCost = TERRAIN.path.moveCost;
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
