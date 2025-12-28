// ===== MAP GENERATION =====

import { CONFIG, TERRAIN, BIOMES } from './config.js';
import { state, setHex, getHex } from './state.js';
import { hexDistance, isValidHex, getNeighbors } from './hexMath.js';

/**
 * Resolve the active biome from settings (handles 'random' option)
 */
function resolveActiveBiome() {
    const landscape = state.settings.landscape;

    if (landscape === 'random') {
        // Pick a random biome
        const biomeKeys = Object.keys(BIOMES);
        const randomIndex = Math.floor(Math.random() * biomeKeys.length);
        state.activeBiome = biomeKeys[randomIndex];
    } else if (BIOMES[landscape]) {
        state.activeBiome = landscape;
    } else {
        state.activeBiome = 'temperate';
    }

    return BIOMES[state.activeBiome];
}

/**
 * Get the current active biome configuration
 */
function getActiveBiome() {
    return BIOMES[state.activeBiome] || BIOMES.temperate;
}

/**
 * Generate a new map with the current settings
 * Uses state.mapSeed for reproducible generation
 */
export function generateMap() {
    state.hexes = [];
    state.hexMap.clear();

    // Resolve and set the active biome
    const biome = resolveActiveBiome();

    const radius = CONFIG.MAP_SIZES[state.settings.size];

    // Use the stored mapSeed for reproducible generation
    const seed = state.mapSeed || 0;

    // Generate hexagonal grid with biome-specific terrain
    for (let q = -radius; q <= radius; q++) {
        for (let r = -radius; r <= radius; r++) {
            if (!isValidHex(q, r, radius)) continue;

            const distFromCenter = hexDistance({ q: 0, r: 0 }, { q, r });
            const hex = createHex(q, r, distFromCenter, radius, biome, seed);
            setHex(hex);
        }
    }

    // Apply biome-specific post-processing
    applyBiomePostProcessing(biome, radius);

    // Clear spawn areas first
    clearSpawnAreas();

    // Add some interesting features (biome-aware)
    addMapFeatures(radius, biome);

    // Ensure all walkable areas are connected
    ensureMapConnectivity(radius);

    // Final validation pass
    validateAndFixMap(radius);
}

/**
 * Get the active biome name for display
 */
export function getActiveBiomeName() {
    const biome = BIOMES[state.activeBiome];
    return biome ? biome.nameDE : 'Gemäßigt';
}

/**
 * Generate a lightweight map preview for the wizard
 * Returns an array of hex objects with terrain data (no state modification)
 */
export function generatePreviewMap(size, landscape) {
    const previewHexes = [];
    const radius = CONFIG.MAP_SIZES[size] || CONFIG.MAP_SIZES.medium;

    // Generate random seed for this preview (different map each time)
    const mapSeed = Math.floor(Math.random() * 100000);

    // Resolve biome
    let biome;
    if (landscape === 'random') {
        const biomeKeys = Object.keys(BIOMES);
        const randomIndex = Math.floor(Math.random() * biomeKeys.length);
        biome = BIOMES[biomeKeys[randomIndex]];
    } else {
        biome = BIOMES[landscape] || BIOMES.temperate;
    }

    // Generate hex data for preview
    for (let q = -radius; q <= radius; q++) {
        for (let r = -radius; r <= radius; r++) {
            if (!isValidHex(q, r, radius)) continue;

            const distFromCenter = hexDistance({ q: 0, r: 0 }, { q, r });
            const hex = createPreviewHex(q, r, distFromCenter, radius, biome, mapSeed);
            previewHexes.push(hex);
        }
    }

    return { hexes: previewHexes, biome, radius };
}

/**
 * Create a hex for preview (simplified, no state)
 */
function createPreviewHex(q, r, distFromCenter, radius, biome, mapSeed) {
    const edgeFactor = distFromCenter / radius;

    // Use simplified noise with random seed for variety
    const elevationNoise = simpleFractalNoise(q, r, 16, 3, mapSeed);
    const moistureNoise = simpleFractalNoise(q, r, 14, 2, mapSeed + 1000);

    const elev = biome.elevationThresholds;
    const moist = biome.moistureThresholds;

    let type = biome.baseType || 'grass';

    // Water at edges or low elevation
    if (edgeFactor > 0.85 || (elevationNoise < elev.water && !biome.noWaterEdge)) {
        type = 'water';
    } else if (elevationNoise > elev.rock) {
        type = biome.rockType || 'rock';
    } else if (elevationNoise > elev.hills) {
        type = biome.hillType || 'hills';
    } else if (moistureNoise > moist.forest) {
        type = biome.forestType || 'forest';
    } else if (moistureNoise < moist.sand) {
        type = biome.sandType || 'sand';
    }

    return {
        q,
        r,
        type,
        walkable: TERRAIN[type]?.walkable ?? true
    };
}

/**
 * Simplified fractal noise for preview
 */
function simpleFractalNoise(q, r, baseScale, octaves, seed) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += simpleNoise(q / (baseScale / frequency), r / (baseScale / frequency), seed + i * 11) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / maxValue;
}

/**
 * Simple noise for preview
 */
function simpleNoise(x, y, seed) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.758) * 43758.5453;
    return n - Math.floor(n);
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
 * Create a single hex with terrain using biome-specific noise generation
 */
function createHex(q, r, distFromCenter, radius, biome, baseSeed = 0) {
    const edgeFactor = distFromCenter / radius;

    // Use multiple noise layers for different terrain features
    // Each layer uses an offset from the base seed for variety
    const elevationNoise = fractalNoise(q, r, 16, 4, baseSeed + 1);
    const moistureNoise = fractalNoise(q, r, 14, 3, baseSeed + 1000);
    const vegetationNoise = fractalNoise(q, r, 10, 3, baseSeed + 2000);
    const roughnessNoise = fractalNoise(q, r, 8, 2, baseSeed + 3000);
    const varietyNoise = fractalNoise(q, r, 6, 2, baseSeed + 4000);

    // Get biome-specific thresholds
    const elev = biome.elevationThresholds;
    const moist = biome.moistureThresholds;
    const weights = biome.weights;

    let type = 'grass';

    // Determine terrain based on noise values using biome thresholds
    if (elevationNoise > elev.rock || (elevationNoise > elev.rock - 0.08 && roughnessNoise > 0.6)) {
        // High elevation = rocks/mountains (or cliff in highland)
        type = (weights.cliff > 0.3 && varietyNoise > 0.5) ? 'cliff' : 'rock';
    } else if (elevationNoise > elev.hills) {
        // Medium-high elevation = hills
        type = 'hills';
        // Add gravel in highland biome
        if (weights.gravel > 0.3 && varietyNoise > 0.6) {
            type = 'gravel';
        }
    } else if (elevationNoise < elev.water && moistureNoise > moist.swamp + 0.1 && distFromCenter > 2) {
        // Low elevation + high moisture = water (lakes)
        type = 'water';
        // Use shallows in wetland biome
        if (weights.shallows > 0.5 && varietyNoise > 0.4) {
            type = 'shallows';
        }
    } else if (elevationNoise < elev.swamp && moistureNoise > moist.swamp && distFromCenter > 1) {
        // Low elevation + medium moisture = swamp
        type = 'swamp';
        // Add reeds in wetland/tropical
        if (weights.reeds > 0.4 && varietyNoise > 0.5) {
            type = 'reeds';
        }
        // Add mud in wetland
        if (weights.mud > 0.4 && varietyNoise < 0.3) {
            type = 'mud';
        }
    } else if (moistureNoise > moist.forest && vegetationNoise > 0.5) {
        // High moisture + high vegetation = dense forest
        if (weights.pine > 0.5 && varietyNoise > 0.5) {
            type = 'pine';
        } else {
            type = 'forest';
        }
    } else if (moistureNoise > moist.forest - 0.12 && vegetationNoise > 0.4) {
        // Medium moisture + vegetation = lighter forest/clearing
        if (weights.tallgrass > 0.4 && varietyNoise > 0.6) {
            type = 'tallgrass';
        } else if (weights.clearing > 0.2 && varietyNoise > 0.7) {
            type = 'clearing';
        } else {
            type = 'forest';
        }
    } else if (moistureNoise < moist.sand && elevationNoise < 0.45) {
        // Low moisture + low elevation = sand
        type = 'sand';
    } else if (elevationNoise > 0.5 && moistureNoise < 0.4) {
        // Higher ground + drier = heather moorland
        if (weights.heather > 0.3 && varietyNoise > 0.45) {
            type = 'heather';
        }
    }
    // Default: grass

    // Add variety to grass areas based on biome weights
    const rand = smoothNoise(q, r, 2, 9);
    if (type === 'grass') {
        // Flowers based on biome weight
        if (rand < 0.05 + weights.flowers * 0.1 && vegetationNoise > 0.45) {
            type = 'flowers';
        }
        // Tallgrass in tropical/wetland
        else if (rand < 0.1 && weights.tallgrass > 0.4 && vegetationNoise > 0.5) {
            type = 'tallgrass';
        }
        // Scattered trees
        else if (rand < 0.08 + weights.forest * 0.05 && varietyNoise > 0.6) {
            type = vegetationNoise > 0.5 ? 'forest' : 'hills';
        }
        // Heather patches
        else if (rand < 0.12 && weights.heather > 0.3 && elevationNoise > 0.45) {
            type = 'heather';
        }
        // Moss in wet areas
        else if (rand < 0.1 && moistureNoise > 0.55 && weights.swamp > 0.3) {
            type = 'moss';
        }
    }

    // Biome-specific special terrain
    // Add snow in tundra biome
    if (biome.specialTerrain?.addSnow && type === 'grass' && elevationNoise > 0.35) {
        if (varietyNoise > 0.3) {
            type = 'snow';
        }
    }

    // Add ruins scattered across the map (rarity based on biome weight)
    const ruinsChance = weights.ruins || 0.15;
    if (type === 'grass' && varietyNoise > 0.85 && distFromCenter > 3 && rand < ruinsChance * 0.2) {
        type = 'ruins';
    }

    // Keep edges more passable
    if (edgeFactor > 0.85 && TERRAIN[type] && !TERRAIN[type].walkable) {
        type = biome.specialTerrain?.addSnow ? 'snow' : 'grass';
    }

    // Fallback to grass if terrain type doesn't exist
    if (!TERRAIN[type]) {
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
 * Apply biome-specific post-processing (e.g., replace water with ice in tundra)
 */
function applyBiomePostProcessing(biome, radius) {
    if (!biome.specialTerrain) return;

    state.hexes.forEach(hex => {
        // Replace water with ice in tundra
        if (biome.specialTerrain.replaceWater && hex.type === 'water') {
            const replacementType = biome.specialTerrain.replaceWater;
            if (TERRAIN[replacementType]) {
                hex.type = replacementType;
                hex.walkable = TERRAIN[replacementType].walkable;
                hex.cover = TERRAIN[replacementType].cover;
                hex.moveCost = TERRAIN[replacementType].moveCost;
            }
        }
    });
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
    // Each player can have up to 5 units (CONFIG.MAX_UNITS)
    const allSpawnLocations = [
        // West
        [
            { q: -offset, r: 0 },
            { q: -offset, r: 1 },
            { q: -offset + 1, r: 0 },
            { q: -offset, r: -1 },
            { q: -offset + 1, r: 1 }
        ],
        // East
        [
            { q: offset, r: 0 },
            { q: offset, r: -1 },
            { q: offset - 1, r: 0 },
            { q: offset, r: 1 },
            { q: offset - 1, r: -1 }
        ],
        // North-West
        [
            { q: -Math.floor(offset * 0.6), r: -Math.floor(offset * 0.6) },
            { q: -Math.floor(offset * 0.6) + 1, r: -Math.floor(offset * 0.6) },
            { q: -Math.floor(offset * 0.6), r: -Math.floor(offset * 0.6) + 1 },
            { q: -Math.floor(offset * 0.6) - 1, r: -Math.floor(offset * 0.6) + 1 },
            { q: -Math.floor(offset * 0.6) + 1, r: -Math.floor(offset * 0.6) - 1 }
        ],
        // North-East
        [
            { q: Math.floor(offset * 0.6), r: -Math.floor(offset * 0.8) },
            { q: Math.floor(offset * 0.6) - 1, r: -Math.floor(offset * 0.8) + 1 },
            { q: Math.floor(offset * 0.6), r: -Math.floor(offset * 0.8) + 1 },
            { q: Math.floor(offset * 0.6) + 1, r: -Math.floor(offset * 0.8) },
            { q: Math.floor(offset * 0.6) - 1, r: -Math.floor(offset * 0.8) }
        ],
        // South-West
        [
            { q: -Math.floor(offset * 0.6), r: Math.floor(offset * 0.8) },
            { q: -Math.floor(offset * 0.6), r: Math.floor(offset * 0.8) - 1 },
            { q: -Math.floor(offset * 0.6) + 1, r: Math.floor(offset * 0.8) - 1 },
            { q: -Math.floor(offset * 0.6) - 1, r: Math.floor(offset * 0.8) },
            { q: -Math.floor(offset * 0.6) + 1, r: Math.floor(offset * 0.8) }
        ],
        // South-East
        [
            { q: Math.floor(offset * 0.6), r: Math.floor(offset * 0.6) },
            { q: Math.floor(offset * 0.6) - 1, r: Math.floor(offset * 0.6) },
            { q: Math.floor(offset * 0.6), r: Math.floor(offset * 0.6) - 1 },
            { q: Math.floor(offset * 0.6) + 1, r: Math.floor(offset * 0.6) - 1 },
            { q: Math.floor(offset * 0.6) - 1, r: Math.floor(offset * 0.6) + 1 }
        ],
        // North (for 7+ players)
        [
            { q: 0, r: -offset },
            { q: 1, r: -offset },
            { q: -1, r: -offset + 1 },
            { q: 0, r: -offset + 1 },
            { q: 2, r: -offset }
        ],
        // South (for 8 players)
        [
            { q: 0, r: offset },
            { q: -1, r: offset },
            { q: 1, r: offset - 1 },
            { q: 0, r: offset - 1 },
            { q: -2, r: offset }
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
 * Add interesting map features (clusters, paths, etc.) based on biome
 */
function addMapFeatures(radius, biome) {
    const features = biome.features;
    const weights = biome.weights;

    // Add forest clusters based on biome weight
    if (weights.forest > 0.3) {
        const forestType = weights.pine > weights.forest ? 'pine' : 'forest';
        addClusters(forestType, Math.ceil(weights.forest * 3), Math.floor(radius / 3), radius);
    }

    // Add rock formations based on biome weight
    if (weights.rock > 0.3) {
        addClusters('rock', Math.ceil(weights.rock * 2), Math.floor(radius / 4), radius);
    }

    // Add water bodies based on biome weight
    if (weights.water > 0.2) {
        addWaterBodies(Math.floor(weights.water * radius / 4), radius);
    }

    // Add rivers based on biome features
    if (features.rivers > 0) {
        addRivers(features.rivers, radius);
    }

    // Add roads if biome supports them
    if (features.roads) {
        addRoads(radius);
    }

    // Add dirt paths based on biome features
    if (features.paths > 0) {
        addPaths(features.paths, radius);
    }

    // Add biome-specific terrain clusters
    if (weights.swamp > 0.5) {
        addClusters('swamp', Math.ceil(weights.swamp * 2), Math.floor(radius / 4), radius);
    }
    if (weights.sand > 0.5) {
        addClusters('sand', Math.ceil(weights.sand * 3), Math.floor(radius / 3), radius);
    }
    if (weights.snow && weights.snow > 0.5) {
        addClusters('snow', Math.ceil(weights.snow * 3), Math.floor(radius / 3), radius);
    }
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

    // CRITICAL: Ensure no isolated pools exist that would trap units when zone shrinks
    // This is especially important for shrinking zone mechanics
    eliminateIsolatedPools(radius);
}

/**
 * Eliminate isolated pools - areas that have no path to the map center
 * This prevents units from being trapped when the shrinking zone pushes inward
 */
function eliminateIsolatedPools(radius) {
    // Flood fill from center to find all hexes reachable from center
    const reachableFromCenter = new Set();
    const centerHex = getHex(0, 0);

    // Make sure center is walkable
    if (centerHex && !centerHex.walkable) {
        centerHex.type = 'grass';
        centerHex.walkable = true;
        centerHex.cover = false;
        centerHex.moveCost = 1;
    }

    if (!centerHex) return;

    const queue = [centerHex];
    reachableFromCenter.add('0,0');

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = getNeighbors(current.q, current.r);

        for (const neighbor of neighbors) {
            const key = `${neighbor.q},${neighbor.r}`;
            if (reachableFromCenter.has(key)) continue;

            const hex = getHex(neighbor.q, neighbor.r);
            if (hex && hex.walkable) {
                reachableFromCenter.add(key);
                queue.push(hex);
            }
        }
    }

    // Find all walkable hexes NOT reachable from center (isolated pools)
    const isolatedHexes = state.hexes.filter(h =>
        h.walkable && !reachableFromCenter.has(`${h.q},${h.r}`)
    );

    // For each isolated pool, create an escape path to the nearest reachable hex
    for (const isolatedHex of isolatedHexes) {
        // Find nearest hex that IS reachable from center
        let nearestReachable = null;
        let minDist = Infinity;

        for (const key of reachableFromCenter) {
            const [q, r] = key.split(',').map(Number);
            const dist = hexDistance(isolatedHex, { q, r });
            if (dist < minDist) {
                minDist = dist;
                nearestReachable = { q, r };
            }
        }

        if (nearestReachable && minDist > 0) {
            // Create path from isolated hex to nearest reachable hex
            // This breaks through the wall creating the pool
            const dist = hexDistance(isolatedHex, nearestReachable);
            for (let i = 0; i <= dist; i++) {
                const t = i / dist;
                const q = Math.round(isolatedHex.q + (nearestReachable.q - isolatedHex.q) * t);
                const r = Math.round(isolatedHex.r + (nearestReachable.r - isolatedHex.r) * t);

                const hex = getHex(q, r);
                if (hex && !hex.walkable) {
                    // Break through the wall
                    hex.type = 'grass';
                    hex.walkable = true;
                    hex.cover = false;
                    hex.moveCost = 1;
                }
                reachableFromCenter.add(`${q},${r}`);
            }
        }
    }

    // Additional pass: ensure there are no thin walls that could trap units
    // Check for "chokepoints" - narrow passages that could be blocked
    ensureEscapeRoutes(radius);
}

/**
 * Ensure there are multiple escape routes from outer areas to center
 * This prevents situations where a single wall blocks all paths inward
 */
function ensureEscapeRoutes(radius) {
    // Check at several radii from edge to ensure paths exist
    const checkRadii = [
        Math.floor(radius * 0.7),
        Math.floor(radius * 0.5),
        Math.floor(radius * 0.3)
    ];

    const center = { q: 0, r: 0 };

    for (const checkRadius of checkRadii) {
        // Get all hexes at approximately this radius
        const ringHexes = state.hexes.filter(h => {
            const dist = hexDistance(center, h);
            return dist >= checkRadius - 1 && dist <= checkRadius + 1 && h.walkable;
        });

        // For each walkable hex at this radius, verify it can reach center
        for (const hex of ringHexes) {
            // Quick check: can we reach center via A* (simplified)?
            if (!canReachCenter(hex, center)) {
                // Create direct path to center
                const dist = hexDistance(hex, center);
                for (let i = 0; i <= dist; i++) {
                    const t = i / dist;
                    const q = Math.round(hex.q + (center.q - hex.q) * t);
                    const r = Math.round(hex.r + (center.r - hex.r) * t);

                    const pathHex = getHex(q, r);
                    if (pathHex && !pathHex.walkable) {
                        pathHex.type = 'grass';
                        pathHex.walkable = true;
                        pathHex.cover = false;
                        pathHex.moveCost = 1;
                    }
                }
            }
        }
    }
}

/**
 * Check if a hex can reach the center (simplified BFS with limit)
 */
function canReachCenter(startHex, center) {
    const visited = new Set();
    const queue = [startHex];
    visited.add(`${startHex.q},${startHex.r}`);

    const maxSteps = 100; // Limit to prevent infinite loops
    let steps = 0;

    while (queue.length > 0 && steps < maxSteps) {
        const current = queue.shift();
        steps++;

        // Check if we reached center
        if (current.q === center.q && current.r === center.r) {
            return true;
        }

        // Check neighbors
        const neighbors = getNeighbors(current.q, current.r);
        for (const neighbor of neighbors) {
            const key = `${neighbor.q},${neighbor.r}`;
            if (visited.has(key)) continue;

            const hex = getHex(neighbor.q, neighbor.r);
            if (hex && hex.walkable) {
                visited.add(key);
                // Prioritize hexes closer to center
                if (hexDistance(hex, center) < hexDistance(current, center)) {
                    queue.unshift(hex);
                } else {
                    queue.push(hex);
                }
            }
        }
    }

    return false;
}
