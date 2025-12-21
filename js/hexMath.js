// ===== HEX MATHEMATICS (Flat-top hexagons with axial coordinates) =====

/**
 * Convert axial hex coordinates to pixel position
 */
export function hexToPixel(q, r, hexSize) {
    const x = hexSize * (3/2 * q);
    const y = hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
    return { x, y };
}

/**
 * Convert pixel position to axial hex coordinates
 */
export function pixelToHex(px, py, hexSize) {
    const q = (2/3 * px) / hexSize;
    const r = (-1/3 * px + Math.sqrt(3)/3 * py) / hexSize;
    return hexRound(q, r);
}

/**
 * Round fractional hex coordinates to nearest hex
 */
export function hexRound(q, r) {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
        rq = -rr - rs;
    } else if (rDiff > sDiff) {
        rr = -rq - rs;
    }

    return { q: rq, r: rr };
}

/**
 * Calculate distance between two hexes
 */
export function hexDistance(a, b) {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/**
 * Get all 6 neighboring hex coordinates
 */
export function getNeighbors(q, r) {
    const directions = [
        { q: 1, r: 0 },
        { q: 1, r: -1 },
        { q: 0, r: -1 },
        { q: -1, r: 0 },
        { q: -1, r: 1 },
        { q: 0, r: 1 }
    ];

    return directions.map(dir => ({
        q: q + dir.q,
        r: r + dir.r
    }));
}

/**
 * Get all hexes within a given range from center
 */
export function getHexesInRange(centerQ, centerR, range) {
    const results = [];

    for (let q = -range; q <= range; q++) {
        for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
            results.push({
                q: centerQ + q,
                r: centerR + r
            });
        }
    }

    return results;
}

/**
 * Linear interpolation between two hexes (for line drawing)
 */
export function hexLerp(a, b, t) {
    return {
        q: a.q + (b.q - a.q) * t,
        r: a.r + (b.r - a.r) * t
    };
}

/**
 * Get all hexes in a line between two points
 */
export function hexLine(a, b) {
    const dist = hexDistance(a, b);
    if (dist === 0) return [a];

    const results = [];
    for (let i = 0; i <= dist; i++) {
        const lerped = hexLerp(a, b, i / dist);
        results.push(hexRound(lerped.q, lerped.r));
    }

    return results;
}

/**
 * Check if a hex coordinate is valid (within a given radius)
 */
export function isValidHex(q, r, radius) {
    return Math.abs(q + r) <= radius &&
           Math.abs(q) <= radius &&
           Math.abs(r) <= radius;
}
