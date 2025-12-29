import { describe, it, expect } from 'vitest';
import { SHORELINE_EDGE_BY_NEIGHBOR, getShorelineEdges } from '../js/shoreline.js';

describe('shoreline helpers', () => {
    it('maps neighbor directions to shoreline edge indices based on asset generator', () => {
        expect(SHORELINE_EDGE_BY_NEIGHBOR).toEqual([0, 5, 4, 3, 2, 1]);
    });

    it('returns shoreline edges only for land tiles with water/swamp neighbors', () => {
        const neighborTerrains = ['water', 'forest', 'swamp', 'sand', 'water', 'hills'];
        const edges = getShorelineEdges('grass', neighborTerrains);

        expect(edges).toEqual([
            { edgeIndex: 0, subtype: 'water' },
            { edgeIndex: 4, subtype: 'swamp' },
            { edgeIndex: 2, subtype: 'water' }
        ]);
    });

    it('returns no shoreline edges for water tiles in a coast mosaic', () => {
        const neighborTerrains = ['grass', 'water', 'grass', 'water', 'grass', 'water'];
        const edges = getShorelineEdges('water', neighborTerrains);

        expect(edges).toEqual([]);
    });
});
