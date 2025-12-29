const WATER_TYPES = new Set(['water', 'river', 'deepwater']);
const SWAMP_TYPES = new Set(['swamp']);

// Asset generator directions follow hex corner edges starting at 0° (right) and rotating clockwise.
// Map neighbor direction indices (hexMath.getNeighbors order) to shoreline edge indices.
export const SHORELINE_EDGE_BY_NEIGHBOR = [0, 5, 4, 3, 2, 1];

export function getShorelineEdges(terrainType, neighborTerrains) {
    if (!neighborTerrains || neighborTerrains.length !== 6) return [];
    if (WATER_TYPES.has(terrainType) || SWAMP_TYPES.has(terrainType)) {
        return [];
    }

    const edges = [];
    for (let i = 0; i < 6; i++) {
        const neighborType = neighborTerrains[i];
        let subtype = null;

        if (WATER_TYPES.has(neighborType)) {
            subtype = 'water';
        } else if (SWAMP_TYPES.has(neighborType)) {
            subtype = 'swamp';
        } else {
            continue;
        }

        edges.push({ edgeIndex: SHORELINE_EDGE_BY_NEIGHBOR[i], subtype });
    }

    return edges;
}
