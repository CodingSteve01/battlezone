// ===== SEAMLESS TILEABLE NOISE =====
// Perlin/Simplex noise that tiles perfectly for seamless textures

/**
 * Permutation table for noise generation
 */
const perm = new Uint8Array(512);
const gradP = new Array(512);

// Gradient vectors for 2D
const grad3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];

/**
 * Initialize the permutation table with a seed
 */
export function seedNoise(seed = 0) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        p[i] = i;
    }

    // Seeded shuffle
    let s = seed;
    for (let i = 255; i > 0; i--) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }

    for (let i = 0; i < 512; i++) {
        perm[i] = p[i & 255];
        gradP[i] = grad3[perm[i] % 12];
    }
}

// Initialize with default seed
seedNoise(42);

/**
 * Fade function for smooth interpolation
 */
function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Linear interpolation
 */
function lerp(a, b, t) {
    return a + t * (b - a);
}

/**
 * Dot product of gradient and distance vectors
 */
function dot2(g, x, y) {
    return g[0] * x + g[1] * y;
}

/**
 * 2D Perlin noise - NOT tileable
 */
export function perlin2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = fade(x);
    const v = fade(y);

    const A = perm[X] + Y;
    const B = perm[X + 1] + Y;

    return lerp(
        lerp(dot2(gradP[perm[A]], x, y), dot2(gradP[perm[B]], x - 1, y), u),
        lerp(dot2(gradP[perm[A + 1]], x, y - 1), dot2(gradP[perm[B + 1]], x - 1, y - 1), u),
        v
    );
}

/**
 * Seamless tileable 2D Perlin noise
 * Uses 4D noise sampled on a torus to create seamless 2D texture
 * @param {number} x - X coordinate (0-1 for one tile)
 * @param {number} y - Y coordinate (0-1 for one tile)
 * @param {number} scale - Noise scale (higher = more detail)
 * @param {number} seed - Seed offset for variation
 */
export function seamlessNoise2D(x, y, scale = 1, seed = 0) {
    // Map 2D coordinates to a torus in 4D space
    // This creates perfectly seamless tiles
    const s = x * scale;
    const t = y * scale;

    const nx = Math.cos(s * Math.PI * 2) / (Math.PI * 2);
    const ny = Math.cos(t * Math.PI * 2) / (Math.PI * 2);
    const nz = Math.sin(s * Math.PI * 2) / (Math.PI * 2);
    const nw = Math.sin(t * Math.PI * 2) / (Math.PI * 2);

    // Sample 4D noise
    return perlin4D(nx * scale, ny * scale, nz * scale + seed, nw * scale + seed);
}

/**
 * 4D Perlin noise for seamless tiling
 */
function perlin4D(x, y, z, w) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const W = Math.floor(w) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    w -= Math.floor(w);

    const fx = fade(x);
    const fy = fade(y);
    const fz = fade(z);
    const fw = fade(w);

    // Hash coordinates
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;

    const AAA = perm[AA] + W;
    const AAB = perm[AA + 1] + W;
    const ABA = perm[AB] + W;
    const ABB = perm[AB + 1] + W;
    const BAA = perm[BA] + W;
    const BAB = perm[BA + 1] + W;
    const BBA = perm[BB] + W;
    const BBB = perm[BB + 1] + W;

    // Gradient values
    const g0000 = grad4D(perm[AAA], x, y, z, w);
    const g1000 = grad4D(perm[BAA], x - 1, y, z, w);
    const g0100 = grad4D(perm[ABA], x, y - 1, z, w);
    const g1100 = grad4D(perm[BBA], x - 1, y - 1, z, w);
    const g0010 = grad4D(perm[AAB], x, y, z - 1, w);
    const g1010 = grad4D(perm[BAB], x - 1, y, z - 1, w);
    const g0110 = grad4D(perm[ABB], x, y - 1, z - 1, w);
    const g1110 = grad4D(perm[BBB], x - 1, y - 1, z - 1, w);
    const g0001 = grad4D(perm[AAA + 1], x, y, z, w - 1);
    const g1001 = grad4D(perm[BAA + 1], x - 1, y, z, w - 1);
    const g0101 = grad4D(perm[ABA + 1], x, y - 1, z, w - 1);
    const g1101 = grad4D(perm[BBA + 1], x - 1, y - 1, z, w - 1);
    const g0011 = grad4D(perm[AAB + 1], x, y, z - 1, w - 1);
    const g1011 = grad4D(perm[BAB + 1], x - 1, y, z - 1, w - 1);
    const g0111 = grad4D(perm[ABB + 1], x, y - 1, z - 1, w - 1);
    const g1111 = grad4D(perm[BBB + 1], x - 1, y - 1, z - 1, w - 1);

    // Interpolate
    const x00 = lerp(lerp(g0000, g1000, fx), lerp(g0100, g1100, fx), fy);
    const x10 = lerp(lerp(g0010, g1010, fx), lerp(g0110, g1110, fx), fy);
    const x01 = lerp(lerp(g0001, g1001, fx), lerp(g0101, g1101, fx), fy);
    const x11 = lerp(lerp(g0011, g1011, fx), lerp(g0111, g1111, fx), fy);

    const y0 = lerp(x00, x10, fz);
    const y1 = lerp(x01, x11, fz);

    return lerp(y0, y1, fw);
}

/**
 * 4D gradient
 */
function grad4D(hash, x, y, z, w) {
    const h = hash & 31;
    const u = h < 24 ? x : y;
    const v = h < 16 ? y : z;
    const s = h < 8 ? z : w;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v) + ((h & 4) ? -s : s);
}

/**
 * Seamless fractal Brownian motion (fBm) noise
 * Multiple octaves of seamless noise combined
 * @param {number} x - X coordinate (0-1)
 * @param {number} y - Y coordinate (0-1)
 * @param {number} octaves - Number of noise layers
 * @param {number} persistence - How much each octave contributes
 * @param {number} scale - Base scale
 * @param {number} seed - Seed for variation
 */
export function seamlessFBM(x, y, octaves = 4, persistence = 0.5, scale = 4, seed = 0) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += seamlessNoise2D(x, y, scale * frequency, seed + i * 100) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
    }

    return value / maxValue;
}

/**
 * Seamless turbulence noise (absolute value fBm)
 * Creates more dramatic, cloud-like patterns
 */
export function seamlessTurbulence(x, y, octaves = 4, persistence = 0.5, scale = 4, seed = 0) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += Math.abs(seamlessNoise2D(x, y, scale * frequency, seed + i * 100)) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
    }

    return value / maxValue;
}

/**
 * Seamless ridged noise
 * Creates ridge-like patterns, good for mountains/veins
 */
export function seamlessRidged(x, y, octaves = 4, persistence = 0.5, scale = 4, seed = 0) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    let prev = 1;

    for (let i = 0; i < octaves; i++) {
        const n = 1 - Math.abs(seamlessNoise2D(x, y, scale * frequency, seed + i * 100));
        const ridge = n * n * prev;
        value += ridge * amplitude;
        maxValue += amplitude;
        prev = n;
        amplitude *= persistence;
        frequency *= 2;
    }

    return value / maxValue;
}

/**
 * Voronoi/Worley noise for cellular patterns
 * Creates organic cell-like structures
 */
export function seamlessVoronoi(x, y, scale = 4, seed = 0) {
    x *= scale;
    y *= scale;

    let minDist = Infinity;
    let secondMin = Infinity;

    // Check 3x3 grid of cells
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            // Cell coordinates (wrap for seamless)
            const cellX = Math.floor(x) + i;
            const cellY = Math.floor(y) + j;

            // Seeded random point in cell
            const px = cellX + seededRandom(cellX * 374761393 + cellY * 668265263 + seed);
            const py = cellY + seededRandom(cellY * 374761393 + cellX * 668265263 + seed + 1);

            // Wrap point coordinates
            const wrappedPx = ((px % scale) + scale) % scale;
            const wrappedPy = ((py % scale) + scale) % scale;
            const wrappedX = ((x % scale) + scale) % scale;
            const wrappedY = ((y % scale) + scale) % scale;

            // Distance (considering wrapping)
            let dx = Math.abs(wrappedX - wrappedPx);
            let dy = Math.abs(wrappedY - wrappedPy);
            if (dx > scale / 2) dx = scale - dx;
            if (dy > scale / 2) dy = scale - dy;

            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                secondMin = minDist;
                minDist = dist;
            } else if (dist < secondMin) {
                secondMin = dist;
            }
        }
    }

    return minDist;
}

/**
 * Simple seeded random
 */
function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

/**
 * Domain warping for more organic patterns
 * Applies noise to distort the sampling coordinates
 */
export function seamlessWarpedNoise(x, y, scale = 4, warpAmount = 0.3, seed = 0) {
    // First pass: get warp offsets
    const warpX = seamlessFBM(x, y, 3, 0.5, scale * 0.5, seed) * warpAmount;
    const warpY = seamlessFBM(x, y, 3, 0.5, scale * 0.5, seed + 100) * warpAmount;

    // Second pass: sample noise at warped coordinates
    return seamlessFBM(x + warpX, y + warpY, 4, 0.5, scale, seed + 200);
}
