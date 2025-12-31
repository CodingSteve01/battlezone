/**
 * Hexagonal Terrain Generator
 * Creates flat-top hexagonal terrain textures
 *
 * Flat-top hex orientation (like game board hexes):
 * - Vertices at left/right (pointy sides)
 * - Flat edges at top/bottom
 * - Width (point-to-point) = 2 * radius
 * - Height (flat-to-flat) = sqrt(3) * radius
 * - Angles at: 0°, 60°, 120°, 180°, 240°, 300°
 */

const TerrainGenerator = {
    // Earth layer colors for isometric cliff edges
    earthColors: {
        default: { light: '#8a6840', mid: '#6a5030', dark: '#4a3820' },
        forest: { light: '#604830', mid: '#503828', dark: '#402820' },
        sand: { light: '#a89058', mid: '#8a7048', dark: '#6a5038' },
        rock: { light: '#5a5550', mid: '#4a4540', dark: '#3a3530' },
        water: { light: '#6a5a48', mid: '#5a4a38', dark: '#4a3a28' }
    },

    types: {
        grass: {
            baseColor: '#5a9848',      // Lush vibrant grass
            lightColor: '#72b058',     // Sun-lit highlights
            darkColor: '#3a7830',      // Shaded areas
            midColor: '#4a8840',       // Mid-tone
            accentColor: '#82c068',    // Bright accent
            earthType: 'default',
            detailType: 'grass',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        forest: {
            baseColor: '#3a5a3a',      // Rich dark forest
            lightColor: '#4a6a48',     // Dappled light
            darkColor: '#2a4028',      // Deep shadow
            midColor: '#355535',       // Mid forest
            accentColor: '#5a7a58',    // Light patches
            earthType: 'forest',
            detailType: 'forest_floor',
            noiseScale: 0.03,
            hasGrassOverhang: false
        },
        hills: {
            baseColor: '#6a8a50',      // Grassy hill
            lightColor: '#7a9a60',     // Sunlit slope
            darkColor: '#4a6a38',      // Hill shadow
            midColor: '#5a7a45',       // Mid-tone
            accentColor: '#8aaa70',    // Highlight
            earthType: 'default',
            detailType: 'rocky_grass',
            noiseScale: 0.02,
            hasGrassOverhang: true
        },
        rock: {
            baseColor: '#6a6a68',      // Natural stone
            lightColor: '#8a8a85',     // Sunlit rock
            darkColor: '#4a4a48',      // Rock shadow
            midColor: '#5a5a58',       // Mid gray
            accentColor: '#9a9a95',    // Light patches
            earthType: 'rock',
            detailType: 'stone',
            noiseScale: 0.04,
            hasGrassOverhang: false,
            hasRockOverhang: true
        },
        water: {
            // Clear blue water with visible bottom
            baseColor: '#3a8ab0',      // Clear blue
            lightColor: '#5aaad0',     // Sunlit surface
            darkColor: '#2a6a90',      // Deep water
            midColor: '#4a9ac0',       // Mid-tone
            accentColor: '#6abae0',    // Bright highlight
            bottomColor: '#c0a878',    // Sandy bottom
            pebbleColors: ['#8a7868', '#9a8a78', '#7a6858', '#aa9a88'],
            earthType: 'water',
            detailType: 'shallow_water',
            noiseScale: 0.015,
            hasGrassOverhang: false
        },
        sand: {
            baseColor: '#c4a870',      // Warm golden sand
            lightColor: '#d8bc88',     // Bright sand
            darkColor: '#a89058',      // Shadowed
            midColor: '#b4a068',       // Mid-tone
            accentColor: '#e8cc98',    // Highlight
            earthType: 'sand',
            detailType: 'sand',
            noiseScale: 0.02,
            hasGrassOverhang: false
        },
        swamp: {
            baseColor: '#4a5a38',      // Murky green
            lightColor: '#5a6a48',     // Surface
            darkColor: '#3a4a28',      // Deep murk
            midColor: '#455530',       // Mid-tone
            accentColor: '#6a7a55',    // Highlight
            earthType: 'forest',
            detailType: 'murky',
            noiseScale: 0.025,
            hasGrassOverhang: false
        },
        river: {
            baseColor: '#3a7090',      // Clear river blue
            lightColor: '#5a90b0',     // Sunlit surface
            darkColor: '#2a5070',      // Deep water
            midColor: '#3a6080',       // Mid-tone
            accentColor: '#6aa0c0',    // Sparkle highlights
            earthType: 'water',
            detailType: 'flowing_water',
            noiseScale: 0.02,
            hasGrassOverhang: false
        },
        road: {
            baseColor: '#8a7a60',      // Worn dirt road
            lightColor: '#9a8a70',     // Dusty surface
            darkColor: '#6a5a48',      // Packed earth
            midColor: '#7a6a55',       // Mid-tone
            accentColor: '#aa9a80',    // Dry patches
            earthType: 'default',
            detailType: 'road',
            noiseScale: 0.03,
            hasGrassOverhang: false
        },
        path: {
            baseColor: '#7a6850',      // Worn trail
            lightColor: '#8a7860',     // Lighter patches
            darkColor: '#5a4838',      // Shaded areas
            midColor: '#6a5845',       // Mid-tone
            accentColor: '#9a8870',    // Highlights
            earthType: 'default',
            detailType: 'path',
            noiseScale: 0.025,
            hasGrassOverhang: false
        },
        snow: {
            baseColor: '#e8eef5',      // Pristine snow
            lightColor: '#f8fcff',     // Bright highlights
            darkColor: '#d0d8e0',      // Blue shadows
            midColor: '#e0e8f0',       // Mid-tone
            accentColor: '#ffffff',    // Pure white
            earthType: 'rock',
            detailType: 'snow',
            noiseScale: 0.02,
            hasGrassOverhang: false
        },
        pine: {
            baseColor: '#2a4a35',      // Dark pine forest
            lightColor: '#3a5a45',     // Dappled light
            darkColor: '#1a3a25',      // Deep shadow
            midColor: '#254030',       // Mid-tone
            accentColor: '#4a6a55',    // Light patches
            earthType: 'forest',
            detailType: 'forest_floor',
            noiseScale: 0.03,
            hasGrassOverhang: false
        },
        tallgrass: {
            baseColor: '#5a9850',      // Lush tall grass
            lightColor: '#6aaa60',     // Sun-lit tips
            darkColor: '#4a8840',      // Shaded base
            midColor: '#559548',       // Mid-tone
            accentColor: '#7aba70',    // Golden highlights
            earthType: 'default',
            detailType: 'tallgrass',
            noiseScale: 0.02,
            hasGrassOverhang: true
        },
        mud: {
            baseColor: '#5a4838',      // Wet mud
            lightColor: '#6a5848',     // Surface sheen
            darkColor: '#4a3828',      // Deep mud
            midColor: '#554030',       // Mid-tone
            accentColor: '#7a6858',    // Dry patches
            earthType: 'forest',
            detailType: 'mud',
            noiseScale: 0.03,
            hasGrassOverhang: false
        },
        clearing: {
            baseColor: '#6aa860',      // Bright meadow grass
            lightColor: '#7ab870',     // Sunlit areas
            darkColor: '#5a9850',      // Shaded grass
            midColor: '#659a58',       // Mid-tone
            accentColor: '#8ac880',    // Highlights
            earthType: 'default',
            detailType: 'grass',
            noiseScale: 0.02,
            hasGrassOverhang: true
        },
        // Directional stream tiles - straight connection (opposite edges)
        stream_ew: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            waterColor: '#4a90a8',
            waterLight: '#6ab0c8',
            bankColor: '#8a7050',
            earthType: 'default',
            detailType: 'stream_straight',
            direction: 'ew',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        stream_nesw: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            waterColor: '#4a90a8',
            waterLight: '#6ab0c8',
            bankColor: '#8a7050',
            earthType: 'default',
            detailType: 'stream_straight',
            direction: 'nesw',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        stream_nwse: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            waterColor: '#4a90a8',
            waterLight: '#6ab0c8',
            bankColor: '#8a7050',
            earthType: 'default',
            detailType: 'stream_straight',
            direction: 'nwse',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        // Directional stream tiles - curved connections (adjacent edges)
        stream_e_ne: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            waterColor: '#4a90a8',
            waterLight: '#6ab0c8',
            bankColor: '#8a7050',
            earthType: 'default',
            detailType: 'stream_curve',
            direction: 'e_ne',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        stream_ne_nw: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            waterColor: '#4a90a8',
            waterLight: '#6ab0c8',
            bankColor: '#8a7050',
            earthType: 'default',
            detailType: 'stream_curve',
            direction: 'ne_nw',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        stream_nw_w: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            waterColor: '#4a90a8',
            waterLight: '#6ab0c8',
            bankColor: '#8a7050',
            earthType: 'default',
            detailType: 'stream_curve',
            direction: 'nw_w',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        stream_w_sw: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            waterColor: '#4a90a8',
            waterLight: '#6ab0c8',
            bankColor: '#8a7050',
            earthType: 'default',
            detailType: 'stream_curve',
            direction: 'w_sw',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        stream_sw_se: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            waterColor: '#4a90a8',
            waterLight: '#6ab0c8',
            bankColor: '#8a7050',
            earthType: 'default',
            detailType: 'stream_curve',
            direction: 'sw_se',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        stream_se_e: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            waterColor: '#4a90a8',
            waterLight: '#6ab0c8',
            bankColor: '#8a7050',
            earthType: 'default',
            detailType: 'stream_curve',
            direction: 'se_e',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        // Directional path tiles - straight connections
        path_ew: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            pathColor: '#9a8a68',
            pathLight: '#aa9a78',
            pathDark: '#7a6a50',
            earthType: 'default',
            detailType: 'path_straight',
            direction: 'ew',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        path_nesw: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            pathColor: '#9a8a68',
            pathLight: '#aa9a78',
            pathDark: '#7a6a50',
            earthType: 'default',
            detailType: 'path_straight',
            direction: 'nesw',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        path_nwse: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            pathColor: '#9a8a68',
            pathLight: '#aa9a78',
            pathDark: '#7a6a50',
            earthType: 'default',
            detailType: 'path_straight',
            direction: 'nwse',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        // Directional path tiles - curved connections
        path_e_ne: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            pathColor: '#9a8a68',
            pathLight: '#aa9a78',
            pathDark: '#7a6a50',
            earthType: 'default',
            detailType: 'path_curve',
            direction: 'e_ne',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        path_ne_nw: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            pathColor: '#9a8a68',
            pathLight: '#aa9a78',
            pathDark: '#7a6a50',
            earthType: 'default',
            detailType: 'path_curve',
            direction: 'ne_nw',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        path_nw_w: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            pathColor: '#9a8a68',
            pathLight: '#aa9a78',
            pathDark: '#7a6a50',
            earthType: 'default',
            detailType: 'path_curve',
            direction: 'nw_w',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        path_w_sw: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            pathColor: '#9a8a68',
            pathLight: '#aa9a78',
            pathDark: '#7a6a50',
            earthType: 'default',
            detailType: 'path_curve',
            direction: 'w_sw',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        path_sw_se: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            pathColor: '#9a8a68',
            pathLight: '#aa9a78',
            pathDark: '#7a6a50',
            earthType: 'default',
            detailType: 'path_curve',
            direction: 'sw_se',
            noiseScale: 0.025,
            hasGrassOverhang: true
        },
        path_se_e: {
            baseColor: '#5a9848',
            lightColor: '#72b058',
            darkColor: '#3a7830',
            midColor: '#4a8840',
            accentColor: '#82c068',
            pathColor: '#9a8a68',
            pathLight: '#aa9a78',
            pathDark: '#7a6a50',
            earthType: 'default',
            detailType: 'path_curve',
            direction: 'se_e',
            noiseScale: 0.025,
            hasGrassOverhang: true
        }
    },

    /**
     * Generate a hexagonal terrain texture
     * @param {string} type - Terrain type
     * @param {number} variant - Variant for randomization
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height (for pointy-top hex: height > width)
     */
    generate(type, variant = 0, width = 256, height = 192) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const terrain = this.types[type] || this.types.grass;
        const seed = type.charCodeAt(0) * 1000 + variant;
        const noise = new SimplexNoise(seed);
        const detailNoise = new SimplexNoise(seed + 12345);
        const microNoise = new SimplexNoise(seed + 67890);

        // For flat-top hex: width = 2*radius, height = sqrt(3)*radius
        // Center the hex in the canvas
        const centerX = width / 2;
        const centerY = height / 2;

        // Calculate hex radius from dimensions
        // For flat-top: width = 2r, height = sqrt(3)*r
        const radiusFromWidth = width / 2;
        const radiusFromHeight = height / Math.sqrt(3);
        const radius = Math.min(radiusFromWidth, radiusFromHeight) * 0.98;

        // Clear with transparency
        ctx.clearRect(0, 0, width, height);

        // Create hex clipping path
        ctx.save();
        this.createHexPath(ctx, centerX, centerY, radius);
        ctx.clip();

        // Render base terrain with noise
        this.renderBaseLayer(ctx, terrain, noise, width, height, variant, centerX, centerY, radius);

        // Add terrain-specific details
        this.renderDetails(ctx, terrain, noise, detailNoise, microNoise, width, height, variant, centerX, centerY, radius);

        ctx.restore();

        return canvas;
    },

    /**
     * Generate an isometric hexagonal terrain texture with earth layer and grass overhang
     * Creates a 2.5D appearance similar to board game tiles
     * @param {string} type - Terrain type
     * @param {number} variant - Variant for randomization
     * @param {number} width - Canvas width (default 256)
     * @param {number} height - Canvas height for hex top surface (default 192)
     * @param {number} earthHeight - Height of the earth layer below hex (default 160)
     */
    generateIsometric(type, variant = 0, width = 256, height = 192, earthHeight = 160) {
        const terrain = this.types[type] || this.types.grass;
        const totalHeight = height + earthHeight;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');

        const seed = type.charCodeAt(0) * 1000 + variant;
        const noise = new SimplexNoise(seed);
        const detailNoise = new SimplexNoise(seed + 12345);
        const microNoise = new SimplexNoise(seed + 67890);

        // Calculate hex dimensions - position hex in upper portion
        const hexCenterX = width / 2;
        const hexCenterY = height / 2;  // Center of hex surface area (not including earth)

        // Calculate hex radius from dimensions
        const radiusFromWidth = width / 2;
        const radiusFromHeight = height / Math.sqrt(3);
        const radius = Math.min(radiusFromWidth, radiusFromHeight) * 0.95;

        // Clear with transparency
        ctx.clearRect(0, 0, width, totalHeight);

        // Get earth colors for this terrain type
        const earthType = terrain.earthType || 'default';
        const earthPalette = this.earthColors[earthType] || this.earthColors.default;

        // Draw earth layer first (behind everything)
        this.renderEarthLayer(ctx, hexCenterX, hexCenterY, radius, earthHeight, earthPalette, noise, variant);

        // Draw hex surface with clipping
        ctx.save();
        this.createHexPath(ctx, hexCenterX, hexCenterY, radius);
        ctx.clip();

        // Render base terrain with noise
        this.renderBaseLayer(ctx, terrain, noise, width, height, variant, hexCenterX, hexCenterY, radius);

        // Add terrain-specific details
        this.renderDetails(ctx, terrain, noise, detailNoise, microNoise, width, height, variant, hexCenterX, hexCenterY, radius);

        ctx.restore();

        // Add grass overhang for applicable terrains
        if (terrain.hasGrassOverhang) {
            this.renderGrassOverhang(ctx, hexCenterX, hexCenterY, radius, earthHeight, terrain, noise, variant);
        }

        // Add rock overhang for rock terrain - boulders extending above the hex
        if (terrain.hasRockOverhang) {
            this.renderRockOverhang(ctx, hexCenterX, hexCenterY, radius, earthHeight, terrain, noise, variant);
        }

        // Add waterfall for water terrain
        if (type === 'water' || type === 'river' || type.startsWith('stream')) {
            this.renderWaterfall(ctx, hexCenterX, hexCenterY, radius, earthHeight, noise, variant);
        }

        return canvas;
    },

    /**
     * Render the earth/cliff layer below the hex surface
     * Creates a 3D isometric platform with three connected faces:
     * - L (left quadrilateral): v3-v2 edge at top, v3'-v2' at bottom
     * - F (front rectangle): v1-v2 at top, v1'-v2' at bottom
     * - R (right quadrilateral): v0-v1 edge at top, v0'-v1' at bottom
     *
     * The earth layer connects directly to the hex edges from the
     * outermost points (v0=E, v3=W) down to the bottom vertices.
     */
    renderEarthLayer(ctx, cx, cy, radius, earthHeight, earthPalette, noise, variant) {
        // For flat-top hex vertices at angles: 0° (E), 60° (SE), 120° (SW), 180° (W), 240° (NW), 300° (NE)
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            vertices.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            });
        }

        // v0 = E (right point) at cy
        // v1 = SE (bottom right) at cy + radius*sin(60°) - lowest point
        // v2 = SW (bottom left) at cy + radius*sin(60°) - lowest point
        // v3 = W (left point) at cy

        // Small overlap to prevent anti-aliasing gaps between hex surface and earth layer
        const overlap = 2;

        // All bottom vertices at the SAME Y level (flat bottom for isometric look)
        // The bottom Y is the lowest hex point (v1/v2) plus earthHeight
        const bottomY = vertices[1].y + earthHeight;

        // Create bottom vertices - X matches top vertex, Y is flat at bottomY
        const v0_bottom = { x: vertices[0].x, y: bottomY };
        const v1_bottom = { x: vertices[1].x, y: bottomY };
        const v2_bottom = { x: vertices[2].x, y: bottomY };
        const v3_bottom = { x: vertices[3].x, y: bottomY };

        // Adjusted TOP vertices with overlap for seamless connection to hex surface
        // These start at the actual hex edge positions (not offset down)
        const v0_adj = { x: vertices[0].x, y: vertices[0].y - overlap };
        const v1_adj = { x: vertices[1].x, y: vertices[1].y - overlap };
        const v2_adj = { x: vertices[2].x, y: vertices[2].y - overlap };
        const v3_adj = { x: vertices[3].x, y: vertices[3].y - overlap };

        // Draw 3 cliff faces in back-to-front order for proper layering
        // renderCliffFaceIsometric draws: v1 → v2 → v2Bottom → v1Bottom
        // Parameters: (ctx, topLeft, topRight, bottomLeft, bottomRight, ...)
        // bottomLeft corresponds to topLeft, bottomRight corresponds to topRight

        // 1. L (left parallelogram): v3 → v2 → v3' → v2'
        this.renderCliffFaceIsometric(ctx, v3_adj, v2_adj, v3_bottom, v2_bottom,
            earthPalette, 'left', noise, variant);

        // 2. F (front rectangle): v2 → v1 → v2' → v1'
        this.renderCliffFaceIsometric(ctx, v2_adj, v1_adj, v2_bottom, v1_bottom,
            earthPalette, 'front', noise, variant);

        // 3. R (right parallelogram): v1 → v0 → v1' → v0'
        this.renderCliffFaceIsometric(ctx, v1_adj, v0_adj, v1_bottom, v0_bottom,
            earthPalette, 'right', noise, variant);
    },

    /**
     * Render a triangular cliff face (for L and R sides)
     * This creates the proper isometric 3D appearance with earth starting at hex bottom edge
     */
    renderCliffFaceTriangle(ctx, topVertex, bottomLeft, bottomRight, earthPalette, facing, noise, variant) {
        ctx.save();

        // Create triangular path
        ctx.beginPath();
        ctx.moveTo(topVertex.x, topVertex.y);
        ctx.lineTo(bottomLeft.x, bottomLeft.y);
        ctx.lineTo(bottomRight.x, bottomRight.y);
        ctx.closePath();

        // Determine colors based on facing direction
        let baseColor, shadowColor, highlightColor;
        if (facing === 'left') {
            baseColor = earthPalette.mid;
            shadowColor = earthPalette.dark;
            highlightColor = earthPalette.light;
        } else {
            baseColor = this.darkenColor(earthPalette.mid, 0.7);
            shadowColor = this.darkenColor(earthPalette.dark, 0.6);
            highlightColor = earthPalette.mid;
        }

        // Create gradient
        const gradient = ctx.createLinearGradient(topVertex.x, topVertex.y, bottomLeft.x, bottomLeft.y);
        gradient.addColorStop(0, highlightColor);
        gradient.addColorStop(0.3, baseColor);
        gradient.addColorStop(0.7, baseColor);
        gradient.addColorStop(1, shadowColor);

        ctx.fillStyle = gradient;
        ctx.fill();

        // Add subtle texture lines
        ctx.clip();
        ctx.strokeStyle = this.darkenColor(baseColor, 0.85);
        ctx.lineWidth = 0.5;

        const height = bottomLeft.y - topVertex.y;
        const strataCount = Math.floor(height / 12);
        for (let i = 0; i < strataCount; i++) {
            const y = topVertex.y + (i / strataCount) * height;
            const noiseOffset = noise.noise2D(i * 0.3, variant * 0.1) * 4;
            ctx.beginPath();
            ctx.moveTo(topVertex.x - 20, y + noiseOffset);
            ctx.lineTo(bottomRight.x + 20, y + noiseOffset);
            ctx.stroke();
        }

        ctx.restore();
    },

    /**
     * Render a single cliff face with realistic rock/earth texture
     * Uses custom bottom vertices for proper isometric cliff geometry
     */
    renderCliffFaceIsometric(ctx, v1, v2, v1Bottom, v2Bottom, earthPalette, facing, noise, variant) {
        ctx.save();

        // Create quadrilateral path (may be trapezoid or parallelogram depending on vertices)
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.lineTo(v2Bottom.x, v2Bottom.y);
        ctx.lineTo(v1Bottom.x, v1Bottom.y);
        ctx.closePath();

        // Calculate dimensions from actual vertices
        const faceWidth = Math.max(Math.abs(v2.x - v1.x), Math.abs(v2Bottom.x - v1Bottom.x));
        const topY = Math.min(v1.y, v2.y);
        const bottomY = Math.max(v1Bottom.y, v2Bottom.y);
        const faceHeight = bottomY - topY;

        // Color based on facing direction
        let baseColor, shadowColor, highlightColor;
        if (facing === 'front') {
            baseColor = earthPalette.mid;
            shadowColor = earthPalette.dark;
            highlightColor = earthPalette.light;
        } else if (facing === 'right') {
            baseColor = earthPalette.light;
            shadowColor = earthPalette.mid;
            highlightColor = this.lightenColor(earthPalette.light, 1.1);
        } else {
            baseColor = this.darkenColor(earthPalette.mid, 0.7);
            shadowColor = this.darkenColor(earthPalette.dark, 0.6);
            highlightColor = earthPalette.mid;
        }

        // Fill with gradient
        const gradient = ctx.createLinearGradient(
            (v1.x + v2.x) / 2, topY,
            (v1.x + v2.x) / 2, bottomY
        );
        gradient.addColorStop(0, highlightColor);
        gradient.addColorStop(0.3, baseColor);
        gradient.addColorStop(0.7, baseColor);
        gradient.addColorStop(1, shadowColor);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.clip();

        // Add horizontal earth strata (layers)
        const strataCount = 4 + Math.floor(variant % 3);
        for (let i = 0; i < strataCount; i++) {
            const strataY = topY + (faceHeight * (i + 0.5)) / strataCount;
            const strataThickness = 2 + noise.noise2D(i * 7 + variant, 0) * 3;

            ctx.beginPath();
            const segments = 8;
            for (let s = 0; s <= segments; s++) {
                const t = s / segments;
                const x = v1.x + (v2.x - v1.x) * t;
                const waveOffset = noise.noise2D(x * 0.05, i * 10 + variant) * 4;
                const y = strataY + waveOffset;
                if (s === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(0,0,0,${0.1 + (i % 2) * 0.05})`;
            ctx.lineWidth = strataThickness;
            ctx.stroke();
        }

        // Add rock texture
        const rockCount = 15 + Math.floor(faceWidth / 10);
        for (let i = 0; i < rockCount; i++) {
            const rx = v1.x + Math.random() * (v2.x - v1.x);
            const ry = topY + Math.random() * faceHeight;
            const noiseVal = noise.noise2D(rx * 0.1 + variant, ry * 0.1);
            if (noiseVal > 0.2) {
                const rockSize = 3 + Math.random() * 8;
                ctx.beginPath();
                const points = 5 + Math.floor(Math.random() * 3);
                for (let p = 0; p < points; p++) {
                    const angle = (Math.PI * 2 * p) / points;
                    const dist = rockSize * (0.5 + Math.random() * 0.5);
                    const px = rx + Math.cos(angle) * dist;
                    const py = ry + Math.sin(angle) * dist * 0.7;
                    if (p === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fillStyle = noiseVal > 0.5
                    ? `rgba(255,255,255,${0.05 * (0.8 + noiseVal * 0.4)})`
                    : `rgba(0,0,0,${0.08 * (1.2 - noiseVal * 0.4)})`;
                ctx.fill();
            }
        }

        // Add vertical cracks
        const crackCount = 2 + Math.floor(variant % 3);
        for (let i = 0; i < crackCount; i++) {
            const crackX = v1.x + (v2.x - v1.x) * (0.2 + Math.random() * 0.6);
            const crackStartY = topY + Math.random() * faceHeight * 0.3;
            const crackEndY = crackStartY + faceHeight * (0.3 + Math.random() * 0.5);

            ctx.beginPath();
            ctx.moveTo(crackX, crackStartY);
            let currentY = crackStartY;
            while (currentY < crackEndY) {
                currentY += 5 + Math.random() * 10;
                const offsetX = (Math.random() - 0.5) * 6;
                ctx.lineTo(crackX + offsetX, Math.min(currentY, crackEndY));
            }
            ctx.strokeStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.1})`;
            ctx.lineWidth = 0.5 + Math.random() * 1;
            ctx.stroke();
        }

        // Add dirt spots
        for (let i = 0; i < 20; i++) {
            const dx = v1.x + Math.random() * (v2.x - v1.x);
            const dy = topY + Math.random() * faceHeight;
            ctx.beginPath();
            ctx.arc(dx, dy, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${60 + Math.random() * 40}, ${40 + Math.random() * 30}, ${20 + Math.random() * 20}, ${0.3 + Math.random() * 0.3})`;
            ctx.fill();
        }

        // Edge highlight at top
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.strokeStyle = `rgba(255,255,255,0.2)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    },

    /**
     * Helper to lighten a hex color
     */
    lightenColor(hex, factor) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.min(255, Math.floor(r * factor))}, ${Math.min(255, Math.floor(g * factor))}, ${Math.min(255, Math.floor(b * factor))})`;
    },

    /**
     * Render grass overhang on the edges of the hex
     * Creates small grass tufts that extend beyond the hex boundary
     */
    renderGrassOverhang(ctx, cx, cy, radius, earthHeight, terrain, noise, variant) {
        const darkGreen = terrain.darkColor || '#3a7830';
        const lightGreen = terrain.accentColor || '#82c068';
        const midGreen = terrain.baseColor || '#5a9848';

        // Get hex vertices
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            vertices.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            });
        }

        // Render dense grass across the hex surface based on noise map
        this.renderSurfaceGrass(ctx, cx, cy, radius, darkGreen, midGreen, lightGreen, noise, variant);

        // Draw grass overhang on ALL visible edges of the hex and earth layer
        // Bottom edges of hex (v0-v1, v1-v2, v2-v3) - main grass overhang
        const bottomEdges = [
            { v1: vertices[0], v2: vertices[1], facing: 'se', density: 1.0 },
            { v1: vertices[1], v2: vertices[2], facing: 's', density: 1.2 },
            { v1: vertices[2], v2: vertices[3], facing: 'sw', density: 1.0 }
        ];

        for (const edge of bottomEdges) {
            this.renderEdgeGrass(ctx, edge.v1, edge.v2, edge.facing, darkGreen, midGreen, lightGreen, noise, variant, edge.density);
        }
    },

    /**
     * Render dense grass blades across the hex surface using noise map
     * Creates a natural-looking grass coverage with varying density
     */
    renderSurfaceGrass(ctx, cx, cy, radius, darkColor, midColor, lightColor, noise, variant) {
        // Grid-based grass placement with noise-driven density
        const gridSpacing = 8; // Base spacing between grass tufts
        const innerRadius = radius * 0.9; // Stay within hex bounds

        // Calculate grid bounds
        const gridSize = Math.ceil(innerRadius * 2 / gridSpacing);

        for (let gx = -gridSize; gx <= gridSize; gx++) {
            for (let gy = -gridSize; gy <= gridSize; gy++) {
                // Calculate position with slight randomization
                const baseX = cx + gx * gridSpacing;
                const baseY = cy + gy * gridSpacing;

                // Add noise-based offset
                const offsetX = noise.noise2D(gx * 0.3 + variant, gy * 0.3) * gridSpacing * 0.4;
                const offsetY = noise.noise2D(gy * 0.3, gx * 0.3 + variant) * gridSpacing * 0.4;

                const x = baseX + offsetX;
                const y = baseY + offsetY;

                // Check if point is inside hex (approximate with distance)
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > innerRadius) continue;

                // Use noise to determine if grass grows here (creates natural patches)
                const densityNoise = noise.noise2D(x * 0.05 + variant * 0.1, y * 0.05);
                if (densityNoise < -0.3) continue; // Skip sparse areas

                // Calculate grass density based on noise
                const density = Math.max(0.3, (densityNoise + 1) * 0.5);
                const bladeCount = Math.floor(3 + density * 4);

                // Draw grass tuft at this position
                for (let b = 0; b < bladeCount; b++) {
                    // Base angle is straight up (-PI/2) with natural variation
                    const windNoise = noise.noise2D(x * 0.02, y * 0.02 + variant * 0.5);
                    const bladeAngle = -Math.PI / 2 + windNoise * 0.3 + (Math.random() - 0.5) * 0.5;
                    const bladeLength = 4 + Math.random() * 6 + density * 4;
                    const tipBend = (Math.random() - 0.5) * 0.3 + windNoise * 0.2;

                    const endX = x + Math.cos(bladeAngle + tipBend) * bladeLength;
                    const endY = y + Math.sin(bladeAngle + tipBend) * bladeLength;
                    const ctrlX = x + Math.cos(bladeAngle) * bladeLength * 0.6 + (Math.random() - 0.5) * 3;
                    const ctrlY = y + Math.sin(bladeAngle) * bladeLength * 0.5;

                    // Gradient from dark base to light tip
                    const gradient = ctx.createLinearGradient(x, y, endX, endY);
                    gradient.addColorStop(0, darkColor);
                    gradient.addColorStop(0.4, midColor);
                    gradient.addColorStop(0.8, lightColor);
                    gradient.addColorStop(1, this.lightenColor(lightColor, 1.15));

                    ctx.beginPath();
                    ctx.moveTo(x + (b - bladeCount / 2) * 0.5, y);
                    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 0.8 + Math.random() * 0.4;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }
            }
        }
    },

    /**
     * Render hanging grass/vines on a triangular cliff face
     */
    renderHangingGrassTriangle(ctx, topVertex, bottomLeft, bottomRight, _facing, darkColor, midColor, lightColor, _noise, _variant) {
        // Calculate the bottom edge length for vine count
        const bottomEdgeLength = Math.abs(bottomRight.x - bottomLeft.x);
        const vineCount = Math.floor(bottomEdgeLength / 15);

        for (let i = 0; i < vineCount; i++) {
            const t = (i + 0.5 + (Math.random() - 0.5) * 0.3) / vineCount;

            // All vines start from the single top vertex
            const startX = topVertex.x;
            const startY = topVertex.y;

            // End position is along the bottom edge
            const endX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t;
            const endY = bottomLeft.y;

            // Vine length - doesn't go all the way down
            const vineLength = 0.15 + Math.random() * 0.35;
            const vineEndX = startX + (endX - startX) * vineLength;
            const vineEndY = startY + (endY - startY) * vineLength;

            // Draw hanging grass blade
            const gradient = ctx.createLinearGradient(startX, startY, vineEndX, vineEndY);
            gradient.addColorStop(0, darkColor);
            gradient.addColorStop(0.5, midColor);
            gradient.addColorStop(1, lightColor);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            const ctrlX = startX + (vineEndX - startX) * 0.5 + (Math.random() - 0.5) * 8;
            const ctrlY = startY + (vineEndY - startY) * 0.7;
            ctx.quadraticCurveTo(ctrlX, ctrlY, vineEndX, vineEndY);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1 + Math.random() * 0.5;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Add small leaf at end
            if (Math.random() > 0.5) {
                ctx.beginPath();
                ctx.arc(vineEndX, vineEndY, 2, 0, Math.PI * 2);
                ctx.fillStyle = lightColor;
                ctx.fill();
            }
        }
    },

    /**
     * Render hanging grass/vines on a cliff face
     */
    renderHangingGrass(ctx, topLeft, topRight, bottomLeft, bottomRight, facing, darkColor, midColor, lightColor, noise, variant) {
        const edgeLength = Math.sqrt((topRight.x - topLeft.x) ** 2 + (topRight.y - topLeft.y) ** 2);
        const vineCount = Math.floor(edgeLength / 12);

        for (let i = 0; i < vineCount; i++) {
            const t = (i + 0.5 + (Math.random() - 0.5) * 0.3) / vineCount;
            const startX = topLeft.x + (topRight.x - topLeft.x) * t;
            const startY = topLeft.y + (topRight.y - topLeft.y) * t;
            const endX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t;
            const endY = bottomLeft.y + (bottomRight.y - bottomLeft.y) * t;

            // Vine length - doesn't go all the way down
            const vineLength = 0.2 + Math.random() * 0.4;
            const vineEndX = startX + (endX - startX) * vineLength;
            const vineEndY = startY + (endY - startY) * vineLength;

            // Draw hanging grass blade
            const gradient = ctx.createLinearGradient(startX, startY, vineEndX, vineEndY);
            gradient.addColorStop(0, darkColor);
            gradient.addColorStop(0.5, midColor);
            gradient.addColorStop(1, lightColor);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            const ctrlX = startX + (vineEndX - startX) * 0.5 + (Math.random() - 0.5) * 8;
            const ctrlY = startY + (vineEndY - startY) * 0.7;
            ctx.quadraticCurveTo(ctrlX, ctrlY, vineEndX, vineEndY);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1 + Math.random() * 0.5;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Add small leaf at end
            if (Math.random() > 0.5) {
                ctx.beginPath();
                ctx.arc(vineEndX, vineEndY, 2, 0, Math.PI * 2);
                ctx.fillStyle = lightColor;
                ctx.fill();
            }
        }
    },

    /**
     * Render grass tufts along a hex edge - grass grows UPWARD
     */
    renderEdgeGrass(ctx, v1, v2, facing, darkColor, midColor, lightColor, noise, variant, density = 1.0) {
        const edgeLength = Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2);
        const tuftCount = Math.floor((edgeLength / 6) * density); // More grass with density
        const edgeAngle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
        const outwardAngle = edgeAngle + Math.PI / 2;

        for (let i = 0; i < tuftCount; i++) {
            const t = (i + 0.5) / tuftCount;
            const baseX = v1.x + (v2.x - v1.x) * t;
            const baseY = v1.y + (v2.y - v1.y) * t;

            // Position grass slightly over the edge (outward)
            const overhang = 2 + noise.noise2D(i * 3 + variant, variant) * 3;
            const tuftX = baseX + Math.cos(outwardAngle) * overhang;
            const tuftY = baseY + Math.sin(outwardAngle) * overhang;

            // Draw grass tuft growing UPWARD
            const bladeCount = 4 + Math.floor(Math.random() * 4);
            for (let b = 0; b < bladeCount; b++) {
                // Base angle is straight up (-PI/2) with slight lean
                const leanFactor = (facing === 'se') ? 0.3 : (facing === 'sw') ? -0.3 : 0;
                const bladeAngle = -Math.PI / 2 + leanFactor + (Math.random() - 0.5) * 0.6;
                const bladeLength = 6 + Math.random() * 10;
                const tipBend = (Math.random() - 0.5) * 0.4;

                const endX = tuftX + Math.cos(bladeAngle + tipBend) * bladeLength;
                const endY = tuftY + Math.sin(bladeAngle + tipBend) * bladeLength;
                const ctrlX = tuftX + Math.cos(bladeAngle) * bladeLength * 0.6 + (Math.random() - 0.5) * 4;
                const ctrlY = tuftY + Math.sin(bladeAngle) * bladeLength * 0.5;

                // Gradient from dark base to light tip
                const gradient = ctx.createLinearGradient(tuftX, tuftY, endX, endY);
                gradient.addColorStop(0, darkColor);
                gradient.addColorStop(0.4, midColor);
                gradient.addColorStop(0.8, lightColor);
                gradient.addColorStop(1, this.lightenColor(lightColor, 1.2));

                ctx.beginPath();
                ctx.moveTo(tuftX, tuftY);
                ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 1.2 - (b / bladeCount) * 0.6;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }
    },

    /**
     * Render large realistic boulders that extend above the hex boundary
     * Creates an imposing, impassable rock formation look
     */
    renderRockOverhang(ctx, cx, cy, radius, earthHeight, terrain, noise, variant) {
        // Rock color palettes for natural variation
        const rockPalettes = [
            { base: '#5a5855', light: '#908a85', dark: '#3a3835', highlight: '#b5aba5' },
            { base: '#656260', light: '#959290', dark: '#454240', highlight: '#c5c2c0' },
            { base: '#4a4845', light: '#7a7875', dark: '#2a2825', highlight: '#aaa8a5' }
        ];

        // Get hex vertices for reference
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            vertices.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            });
        }

        // Draw 2-4 large boulders that extend above the hex
        const boulderCount = 2 + Math.floor(Math.abs(noise.noise2D(variant * 7, 0)) * 3);

        for (let i = 0; i < boulderCount; i++) {
            const seed = variant * 100 + i * 17;

            // Position boulders along the top edges of the hex (v3-v4, v4-v5, v5-v0)
            // These are the edges that face "up" in isometric view
            const edgeIndex = i % 3;
            const edgePositions = [
                { v1: vertices[4], v2: vertices[5] }, // NW-NE edge (top)
                { v1: vertices[3], v2: vertices[4] }, // W-NW edge (upper left)
                { v1: vertices[5], v2: vertices[0] }  // NE-E edge (upper right)
            ];
            const edge = edgePositions[edgeIndex];

            // Position along the edge
            const t = 0.2 + Math.abs(noise.noise2D(seed, i)) * 0.6;
            const baseX = edge.v1.x + (edge.v2.x - edge.v1.x) * t;
            const baseY = edge.v1.y + (edge.v2.y - edge.v1.y) * t;

            // Boulder extends UPWARD (negative Y) from the hex edge
            const boulderWidth = radius * (0.3 + Math.abs(noise.noise2D(seed + 1, i)) * 0.25);
            const boulderHeight = radius * (0.4 + Math.abs(noise.noise2D(seed + 2, i)) * 0.35);

            // Select color palette
            const paletteIdx = Math.floor(Math.abs(noise.noise2D(i * 5, seed)) * rockPalettes.length);
            const colors = rockPalettes[paletteIdx % rockPalettes.length];

            // Draw the boulder with realistic 3D shading
            this.drawRealisticBoulder(ctx, baseX, baseY - boulderHeight * 0.3, boulderWidth, boulderHeight, colors, noise, seed);
        }

        // Add some smaller accent rocks near the edges
        const smallRockCount = 3 + Math.floor(Math.abs(noise.noise2D(variant * 3, 0)) * 4);
        for (let i = 0; i < smallRockCount; i++) {
            const seed = variant * 200 + i * 13;

            // Position near hex edges
            const angle = noise.noise2D(seed, i) * Math.PI * 2;
            const dist = radius * (0.7 + Math.abs(noise.noise2D(i, seed)) * 0.35);
            const rx = cx + Math.cos(angle) * dist;
            const ry = cy + Math.sin(angle) * dist;

            // Only draw if it's near the top half of the hex
            if (ry < cy + radius * 0.2) {
                const rockSize = radius * (0.12 + Math.abs(noise.noise2D(seed + 3, i)) * 0.1);
                const paletteIdx = Math.floor(Math.abs(noise.noise2D(i * 3, seed)) * rockPalettes.length);
                const colors = rockPalettes[paletteIdx % rockPalettes.length];

                this.drawSmallRock(ctx, rx, ry - rockSize * 0.5, rockSize, colors, noise, seed);
            }
        }
    },

    /**
     * Draw a single realistic boulder with 3D shading and texture
     */
    drawRealisticBoulder(ctx, x, y, width, height, colors, noise, seed) {
        // Create irregular boulder outline using bezier curves
        ctx.beginPath();

        // Generate control points for organic boulder shape
        const points = [];
        const segments = 10;
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            // Vary radius for irregular shape - more variation horizontally
            const radiusVar = 0.7 + noise.noise2D(seed + i * 0.5, i * 0.3) * 0.35;
            const rx = width * 0.5 * radiusVar;
            const ry = height * 0.5 * (0.8 + noise.noise2D(i * 0.3, seed) * 0.25);

            points.push({
                x: x + Math.cos(angle) * rx,
                y: y + Math.sin(angle) * ry
            });
        }

        // Draw smooth boulder outline
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length; i++) {
            const curr = points[i];
            const next = points[(i + 1) % points.length];
            const midX = (curr.x + next.x) / 2;
            const midY = (curr.y + next.y) / 2;
            ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
        }
        ctx.closePath();

        // Create radial gradient for 3D effect - light from top-left
        const grad = ctx.createRadialGradient(
            x - width * 0.25, y - height * 0.3, 0,
            x + width * 0.1, y + height * 0.2, Math.max(width, height) * 0.7
        );
        grad.addColorStop(0, colors.highlight);
        grad.addColorStop(0.25, colors.light);
        grad.addColorStop(0.6, colors.base);
        grad.addColorStop(1, colors.dark);

        ctx.fillStyle = grad;
        ctx.fill();

        // Add subtle outline
        ctx.strokeStyle = colors.dark;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Add surface texture - cracks and facets
        ctx.strokeStyle = colors.dark;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25;

        // Draw 2-4 crack lines
        const crackCount = 2 + Math.floor(Math.abs(noise.noise2D(seed * 2, 0)) * 3);
        for (let c = 0; c < crackCount; c++) {
            const startAngle = noise.noise2D(c * 8, seed) * Math.PI * 2;
            const startDist = Math.abs(noise.noise2D(c, seed * 2)) * 0.3;
            let cx1 = x + Math.cos(startAngle) * width * startDist;
            let cy1 = y + Math.sin(startAngle) * height * startDist;

            ctx.beginPath();
            ctx.moveTo(cx1, cy1);

            const segments = 2 + Math.floor(Math.abs(noise.noise2D(c * 3, seed)) * 2);
            for (let s = 0; s < segments; s++) {
                const crackAngle = startAngle + (noise.noise2D(cx1 * 0.1 + s, cy1 * 0.1) - 0.5) * Math.PI * 0.8;
                const crackLen = (width + height) * 0.15 * (0.5 + Math.random() * 0.5);
                cx1 += Math.cos(crackAngle) * crackLen;
                cy1 += Math.sin(crackAngle) * crackLen;
                ctx.lineTo(cx1, cy1);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Add highlight on top-left
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.ellipse(x - width * 0.2, y - height * 0.25, width * 0.2, height * 0.12, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // Add shadow underneath for grounding
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(x + width * 0.05, y + height * 0.4, width * 0.35, height * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    /**
     * Draw a small accent rock
     */
    drawSmallRock(ctx, x, y, size, colors, noise, seed) {
        // Simple irregular rock shape
        ctx.beginPath();
        const points = 6;
        for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const r = size * (0.7 + noise.noise2D(seed + i, i * 0.5) * 0.4);
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r * 0.7; // Flatten vertically
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();

        // Simple gradient
        const grad = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
        grad.addColorStop(0, colors.light);
        grad.addColorStop(0.5, colors.base);
        grad.addColorStop(1, colors.dark);

        ctx.fillStyle = grad;
        ctx.fill();

        // Subtle outline
        ctx.strokeStyle = colors.dark;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
    },

    /**
     * Render waterfall effect on ALL THREE water terrain cliff faces (L, F, R)
     */
    renderWaterfall(ctx, cx, cy, radius, earthHeight, noise, variant) {
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            vertices.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            });
        }

        // v0 = E (4), v1 = SE (5), v2 = SW (6), v3 = W (7)
        const v0 = vertices[0];
        const v1 = vertices[1];
        const v2 = vertices[2];
        const v3 = vertices[3];

        // All bottom vertices at the SAME Y level (flat bottom, consistent with renderEarthLayer)
        const bottomY = v1.y + earthHeight;
        const v0_bottom = { x: v0.x, y: bottomY };
        const v1_bottom = { x: v1.x, y: bottomY };
        const v2_bottom = { x: v2.x, y: bottomY };
        const v3_bottom = { x: v3.x, y: bottomY };

        const waterLight = '#7dd3fc';
        const waterMid = '#38bdf8';
        const waterDark = '#0284c7';
        const foamWhite = '#f0f9ff';

        ctx.save();

        // Helper to draw waterfall streams on a face
        const drawWaterfallOnFace = (topLeft, topRight, bottomLeft, bottomRight, facing, streamCount) => {
            for (let s = 0; s < streamCount; s++) {
                const t = (s + 0.5) / streamCount;

                // Interpolate position along the top edge
                const startX = topLeft.x + (topRight.x - topLeft.x) * t;
                const startY = topLeft.y + (topRight.y - topLeft.y) * t;

                // Interpolate position along the bottom edge
                const endX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t;
                const endY = bottomLeft.y + (bottomRight.y - bottomLeft.y) * t;

                const streamWidth = 6 + noise.noise2D(s * 5 + facing.charCodeAt(0), variant) * 4;

                const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
                gradient.addColorStop(0, waterLight);
                gradient.addColorStop(0.3, waterMid);
                gradient.addColorStop(0.7, waterDark);
                gradient.addColorStop(1, waterMid);

                ctx.beginPath();
                const segments = 10;

                // Left edge of stream
                for (let i = 0; i <= segments; i++) {
                    const segT = i / segments;
                    const x = startX + (endX - startX) * segT;
                    const y = startY + (endY - startY) * segT;
                    const waveOffset = Math.sin(segT * Math.PI * 3 + variant + s) * 2;
                    const width = streamWidth * (0.8 + Math.sin(segT * Math.PI * 2) * 0.2);
                    if (i === 0) ctx.moveTo(x + waveOffset - width / 2, y);
                    else ctx.lineTo(x + waveOffset - width / 2, y);
                }

                // Right edge of stream (reverse)
                for (let i = segments; i >= 0; i--) {
                    const segT = i / segments;
                    const x = startX + (endX - startX) * segT;
                    const y = startY + (endY - startY) * segT;
                    const waveOffset = Math.sin(segT * Math.PI * 3 + variant + s) * 2;
                    const width = streamWidth * (0.8 + Math.sin(segT * Math.PI * 2) * 0.2);
                    ctx.lineTo(x + waveOffset + width / 2, y);
                }

                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();

                // Foam highlights
                ctx.strokeStyle = foamWhite;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.5;
                for (let f = 0; f < 2; f++) {
                    const foamT = 0.3 + f * 0.35;
                    const foamX = startX + (endX - startX) * foamT;
                    const foamY = startY + (endY - startY) * foamT;
                    ctx.beginPath();
                    ctx.arc(foamX, foamY, streamWidth * 0.3, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }
        };

        // Draw waterfalls on all three faces
        // L and R are now triangular (single top vertex)

        // Helper to draw waterfall on triangular face
        const drawWaterfallOnTriangle = (topVertex, bottomLeft, bottomRight, facing, streamCount) => {
            for (let s = 0; s < streamCount; s++) {
                const t = (s + 0.5) / streamCount;

                // All streams start from the single top vertex
                const startX = topVertex.x;
                const startY = topVertex.y;

                // End position is along the bottom edge
                const endX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t;
                const endY = bottomLeft.y;

                const streamWidth = 5 + noise.noise2D(s * 5 + facing.charCodeAt(0), variant) * 3;

                const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
                gradient.addColorStop(0, waterLight);
                gradient.addColorStop(0.3, waterMid);
                gradient.addColorStop(0.7, waterDark);
                gradient.addColorStop(1, waterMid);

                ctx.beginPath();
                const segments = 10;

                // Left edge of stream
                for (let i = 0; i <= segments; i++) {
                    const segT = i / segments;
                    const x = startX + (endX - startX) * segT;
                    const y = startY + (endY - startY) * segT;
                    const waveOffset = Math.sin(segT * Math.PI * 3 + variant + s) * 2;
                    const width = streamWidth * (0.6 + segT * 0.4); // Widen as it falls
                    if (i === 0) ctx.moveTo(x + waveOffset - width / 2, y);
                    else ctx.lineTo(x + waveOffset - width / 2, y);
                }

                // Right edge of stream (reverse)
                for (let i = segments; i >= 0; i--) {
                    const segT = i / segments;
                    const x = startX + (endX - startX) * segT;
                    const y = startY + (endY - startY) * segT;
                    const waveOffset = Math.sin(segT * Math.PI * 3 + variant + s) * 2;
                    const width = streamWidth * (0.6 + segT * 0.4);
                    ctx.lineTo(x + waveOffset + width / 2, y);
                }

                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        };

        // L (left parallelogram): top edge v3→v2, bottom edge v3'→v2'
        drawWaterfallOnFace(v3, v2, v3_bottom, v2_bottom, 'left', 3);

        // F (front rectangle): top edge v2→v1, bottom edge v2'→v1'
        drawWaterfallOnFace(v2, v1, v2_bottom, v1_bottom, 'front', 5 + Math.floor(variant % 3));

        // R (right parallelogram): top edge v1→v0, bottom edge v1'→v0'
        drawWaterfallOnFace(v1, v0, v1_bottom, v0_bottom, 'right', 3);

        // Splash effects at all three bottom edges
        const addSplash = (bottomLeft, bottomRight) => {
            for (let i = 0; i < 8; i++) {
                const t = Math.random();
                const splashX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t;
                const splashY = bottomLeft.y + (bottomRight.y - bottomLeft.y) * t - 3 + Math.random() * 6;
                ctx.beginPath();
                ctx.arc(splashX, splashY, 1.5 + Math.random() * 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(240, 249, 255, ${0.2 + Math.random() * 0.3})`;
                ctx.fill();
            }
        };

        addSplash(v3_bottom, v2_bottom);  // L bottom edge
        addSplash(v2_bottom, v1_bottom);  // F bottom edge
        addSplash(v1_bottom, v0_bottom);  // R bottom edge

        ctx.restore();
    },

    /**
     * Darken a hex color by a factor
     */
    darkenColor(hex, factor) {
        const rgb = this.hexToRgb(hex);
        return this.rgbToHex(
            Math.round(rgb.r * factor),
            Math.round(rgb.g * factor),
            Math.round(rgb.b * factor)
        );
    },

    /**
     * Create flat-top hexagon path
     * Angles: 0°, 60°, 120°, 180°, 240°, 300° (vertices on left/right, flat top/bottom)
     */
    createHexPath(ctx, cx, cy, radius) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i; // 60 degree increments, starting at 0°
            const px = cx + radius * Math.cos(angle);
            const py = cy + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
    },

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    },

    shiftRgb(rgb, offset) {
        return {
            r: Math.max(0, Math.min(255, rgb.r + offset.r)),
            g: Math.max(0, Math.min(255, rgb.g + offset.g)),
            b: Math.max(0, Math.min(255, rgb.b + offset.b))
        };
    },

    drawFernCluster(ctx, x, y, scale, rotation, color, mirrorX) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale((mirrorX ? -1 : 1) * scale, scale);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';

        const fronds = 5;
        for (let i = 0; i < fronds; i++) {
            const frondAngle = (-0.6 + (i / (fronds - 1)) * 1.2);
            const frondLength = 8 + i * 1.4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(
                Math.cos(frondAngle) * frondLength * 0.4,
                -frondLength * 0.4,
                Math.cos(frondAngle) * frondLength,
                -frondLength
            );
            ctx.stroke();

            const leafletCount = 4 + Math.floor(frondLength / 4);
            for (let l = 1; l < leafletCount; l++) {
                const t = l / leafletCount;
                const lx = Math.cos(frondAngle) * frondLength * t;
                const ly = -frondLength * t;
                const leafAngle = frondAngle + (l % 2 === 0 ? 0.6 : -0.6);
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                ctx.lineTo(
                    lx + Math.cos(leafAngle) * 3,
                    ly + Math.sin(leafAngle) * 3
                );
                ctx.stroke();
            }
        }

        ctx.restore();
    },

    drawFlowerCluster(ctx, x, y, scale, rotation, palette, mirrorX) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale((mirrorX ? -1 : 1) * scale, scale);

        const flowers = 5 + Math.floor(Math.random() * 5);
        for (let i = 0; i < flowers; i++) {
            const fx = (Math.random() - 0.5) * 8;
            const fy = (Math.random() - 0.5) * 6;
            const size = 1.4 + Math.random() * 1.6;
            const petalCount = 4 + Math.floor(Math.random() * 3);
            const color = palette[i % palette.length];

            ctx.fillStyle = color;
            for (let p = 0; p < petalCount; p++) {
                const angle = (p / petalCount) * Math.PI * 2;
                ctx.beginPath();
                ctx.ellipse(
                    fx + Math.cos(angle) * size * 0.6,
                    fy + Math.sin(angle) * size * 0.6,
                    size * 0.5,
                    size * 0.3,
                    angle,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }

            ctx.fillStyle = '#e6c44a';
            ctx.beginPath();
            ctx.arc(fx, fy, size * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },


    /**
     * Render base terrain with multi-octave fractal noise
     * Uses proper hex masking since putImageData ignores clip paths
     */
    renderBaseLayer(ctx, terrain, noise, width, height, variant, cx, cy, radius) {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        const baseRGB = this.hexToRgb(terrain.baseColor);
        const lightRGB = this.hexToRgb(terrain.lightColor);
        const darkRGB = this.hexToRgb(terrain.darkColor);
        const midRGB = this.hexToRgb(terrain.midColor);
        const accentRGB = this.hexToRgb(terrain.accentColor);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // Check if pixel is inside hex
                if (!this.isPointInHex(x, y, cx, cy, radius)) {
                    // Outside hex - transparent
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = 0;
                    continue;
                }

                // Multi-octave fractal noise (6 octaves for fine detail)
                let value = 0;
                let amplitude = 1;
                let frequency = terrain.noiseScale;
                let maxAmplitude = 0;

                for (let octave = 0; octave < 6; octave++) {
                    value += amplitude * noise.noise2D(
                        x * frequency + variant * 100,
                        y * frequency + variant * 100
                    );
                    maxAmplitude += amplitude;
                    amplitude *= 0.5;
                    frequency *= 2;
                }

                value = (value / maxAmplitude + 1) / 2; // Normalize to 0-1

                // Add micro-detail for texture
                const microDetail = noise.noise2D(x * 0.15, y * 0.15) * 0.08;
                value = Math.max(0, Math.min(1, value + microDetail));

                // Color blend with 5 stops for richer variation
                let r, g, b;
                if (value < 0.25) {
                    const t = value * 4;
                    r = darkRGB.r + (midRGB.r - darkRGB.r) * t;
                    g = darkRGB.g + (midRGB.g - darkRGB.g) * t;
                    b = darkRGB.b + (midRGB.b - darkRGB.b) * t;
                } else if (value < 0.5) {
                    const t = (value - 0.25) * 4;
                    r = midRGB.r + (baseRGB.r - midRGB.r) * t;
                    g = midRGB.g + (baseRGB.g - midRGB.g) * t;
                    b = midRGB.b + (baseRGB.b - midRGB.b) * t;
                } else if (value < 0.75) {
                    const t = (value - 0.5) * 4;
                    r = baseRGB.r + (lightRGB.r - baseRGB.r) * t;
                    g = baseRGB.g + (lightRGB.g - baseRGB.g) * t;
                    b = baseRGB.b + (lightRGB.b - baseRGB.b) * t;
                } else {
                    const t = (value - 0.75) * 4;
                    r = lightRGB.r + (accentRGB.r - lightRGB.r) * t;
                    g = lightRGB.g + (accentRGB.g - lightRGB.g) * t;
                    b = lightRGB.b + (accentRGB.b - lightRGB.b) * t;
                }

                data[idx] = Math.round(r);
                data[idx + 1] = Math.round(g);
                data[idx + 2] = Math.round(b);
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    },

    /**
     * Check if point is inside flat-top hex
     * Hex vertices at angles 0°, 60°, 120°, 180°, 240°, 300°
     * This creates vertices at left/right with flat edges at top/bottom
     */
    isPointInHex(px, py, cx, cy, radius) {
        // Translate point to hex-relative coordinates
        const dx = px - cx;
        const dy = py - cy;

        // Flat-top hex geometry:
        // - Vertices at (±r, 0) and (±r/2, ±r*sqrt(3)/2)
        // - Width (point-to-point) = 2r
        // - Height (flat-to-flat) = sqrt(3)*r

        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        // Bounding box check first
        if (absX > radius) return false;
        if (absY > radius * Math.sqrt(3) / 2) return false;

        // Check diagonal edges
        // The edge from (r, 0) to (r/2, r*sqrt(3)/2):
        // Using two-point form: (y - 0) / (x - r) = (r*sqrt(3)/2 - 0) / (r/2 - r)
        // y / (x - r) = (r*sqrt(3)/2) / (-r/2) = -sqrt(3)
        // y = -sqrt(3) * (x - r) = -sqrt(3)*x + r*sqrt(3)
        // Inside: y <= r*sqrt(3) - sqrt(3)*x
        // Or: sqrt(3)*x + y <= r*sqrt(3)
        // Simplified: x/r + y/(r*sqrt(3)) <= 1
        // Or: absX + absY / sqrt(3) <= r

        return (absX + absY / Math.sqrt(3)) <= radius;
    },

    /**
     * Render terrain-specific details
     */
    renderDetails(ctx, terrain, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius) {
        switch (terrain.detailType) {
            case 'grass':
                this.renderGrassDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'forest_floor':
                this.renderForestFloor(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'rocky_grass':
                this.renderRockyGrass(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'stone':
                this.renderStoneDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'water':
                this.renderWaterDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'shallow_water':
                this.renderShallowWater(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'flowing_water':
                this.renderFlowingWater(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'sand':
                this.renderSandDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'murky':
                this.renderMurkyDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'road':
                this.renderRoadDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'path':
                this.renderPathDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'snow':
                this.renderSnowDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'tallgrass':
                this.renderTallgrassDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'mud':
                this.renderMudDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'stream_straight':
                this.renderStreamStraight(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'stream_curve':
                this.renderStreamCurve(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'path_straight':
                this.renderPathStraight(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'path_curve':
                this.renderPathCurve(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
        }
    },

    /**
     * Render grass blade details with flowers, patches, and natural variation
     */
    renderGrassDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        const darkRGB = this.hexToRgb(terrain.darkColor);
        const lightRGB = this.hexToRgb(terrain.accentColor);

        // Grass patches (darker/lighter areas)
        ctx.globalAlpha = 0.15;
        const patchCount = 6 + Math.floor(Math.abs(noise.noise2D(variant, 0)) * 5);
        for (let i = 0; i < patchCount; i++) {
            const angle = noise.noise2D(i * 5, variant * 2) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(variant * 2, i * 5)) * radius * 0.8;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const patchSize = 12 + Math.abs(microNoise.noise2D(x, y)) * 20;

            const isDark = i % 2 === 0;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, patchSize);
            gradient.addColorStop(0, isDark ? 'rgba(50, 80, 35, 0.5)' : 'rgba(110, 150, 85, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, patchSize, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Ground texture - small dirt spots and pebbles
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 25; i++) {
            const x = cx + (noise.noise2D(i * 2.5, variant * 1.5) - 0.5) * radius * 1.6;
            const y = cy + (noise.noise2D(variant * 1.5, i * 2.5) - 0.5) * radius * 1.4;
            const size = 1 + Math.abs(microNoise.noise2D(x * 0.1, y * 0.1)) * 2.5;

            // Dirt spots
            ctx.fillStyle = '#8a7a60';
            ctx.beginPath();
            ctx.ellipse(x, y, size, size * 0.7, noise.noise2D(i, i) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Tiny pebbles
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 15; i++) {
            const x = cx + (detailNoise.noise2D(i * 3, variant * 2) - 0.5) * radius * 1.5;
            const y = cy + (detailNoise.noise2D(variant * 2, i * 3) - 0.5) * radius * 1.3;
            const size = 0.8 + Math.abs(noise.noise2D(x, y)) * 1.5;

            ctx.fillStyle = i % 2 === 0 ? '#7a7068' : '#8a8078';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Dense grass tufts (clusters of blades)
        const tuftCount = 12 + Math.floor(Math.abs(noise.noise2D(variant * 2, 0)) * 8);
        for (let t = 0; t < tuftCount; t++) {
            const tuftAngle = detailNoise.noise2D(t * 0.2, variant) * Math.PI * 2;
            const tuftDist = Math.abs(detailNoise.noise2D(variant, t * 0.2)) * radius * 0.85;
            const tuftX = cx + Math.cos(tuftAngle) * tuftDist;
            const tuftY = cy + Math.sin(tuftAngle) * tuftDist;
            const tuftSize = 0.6 + Math.abs(microNoise.noise2D(tuftX * 0.1, tuftY * 0.1)) * 0.6;

            // Each tuft has 4-7 blades
            const bladesInTuft = 4 + Math.floor(Math.abs(noise.noise2D(t * 5, variant)) * 4);
            for (let b = 0; b < bladesInTuft; b++) {
                const bladeAngle = (b / bladesInTuft) * Math.PI - Math.PI / 2 + (Math.random() - 0.5) * 0.5;
                const bladeHeight = (5 + microNoise.noise2D(tuftX + b, tuftY) * 8) * tuftSize;
                const bend = (bladeAngle - Math.PI / 2) * 0.3 + microNoise.noise2D(tuftX * 0.05, tuftY * 0.05 + b) * 0.3;

                const gradient = ctx.createLinearGradient(tuftX, tuftY, tuftX + bend * bladeHeight, tuftY - bladeHeight);
                gradient.addColorStop(0, `rgba(${darkRGB.r - 10}, ${darkRGB.g - 10}, ${darkRGB.b - 10}, 0.6)`);
                gradient.addColorStop(0.5, `rgba(${darkRGB.r}, ${darkRGB.g}, ${darkRGB.b}, 0.5)`);
                gradient.addColorStop(1, `rgba(${lightRGB.r}, ${lightRGB.g}, ${lightRGB.b}, 0.4)`);

                ctx.beginPath();
                ctx.moveTo(tuftX + (b - bladesInTuft / 2) * 0.8, tuftY);
                ctx.quadraticCurveTo(
                    tuftX + bend * bladeHeight * 0.5 + (b - bladesInTuft / 2) * 0.5,
                    tuftY - bladeHeight * 0.6,
                    tuftX + bend * bladeHeight,
                    tuftY - bladeHeight
                );
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 0.6 + Math.random() * 0.4;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }

        // Scattered individual grass blades
        const bladeCount = Math.floor(radius * 2.2);
        for (let i = 0; i < bladeCount; i++) {
            const seed = variant * 10000 + i;
            const angle = detailNoise.noise2D(seed * 0.1, 0) * Math.PI * 2;
            const dist = Math.abs(detailNoise.noise2D(0, seed * 0.1)) * radius * 0.92;

            const baseX = cx + Math.cos(angle) * dist;
            const baseY = cy + Math.sin(angle) * dist;

            const bladeHeight = 3 + microNoise.noise2D(baseX * 0.1, baseY * 0.1) * 7;
            const bend = microNoise.noise2D(baseX * 0.05, baseY * 0.05) * 0.6;
            const thickness = 0.4 + Math.abs(microNoise.noise2D(i, 0)) * 0.5;

            const gradient = ctx.createLinearGradient(baseX, baseY, baseX + bend * bladeHeight, baseY - bladeHeight);
            gradient.addColorStop(0, `rgba(${darkRGB.r}, ${darkRGB.g}, ${darkRGB.b}, 0.5)`);
            gradient.addColorStop(1, `rgba(${lightRGB.r}, ${lightRGB.g}, ${lightRGB.b}, 0.35)`);

            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.quadraticCurveTo(
                baseX + bend * bladeHeight * 0.5,
                baseY - bladeHeight * 0.6,
                baseX + bend * bladeHeight,
                baseY - bladeHeight
            );
            ctx.strokeStyle = gradient;
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Small clovers (3-leaf clusters)
        ctx.globalAlpha = 0.5;
        const cloverCount = 4 + Math.floor(Math.abs(noise.noise2D(variant * 4, 0)) * 4);
        for (let i = 0; i < cloverCount; i++) {
            const x = cx + (noise.noise2D(i * 6, variant * 5) - 0.5) * radius * 1.3;
            const y = cy + (noise.noise2D(variant * 5, i * 6) - 0.5) * radius * 1.1;
            const cloverSize = 1.5 + Math.abs(microNoise.noise2D(x, y)) * 1.5;

            ctx.fillStyle = '#4a8a48';
            for (let leaf = 0; leaf < 3; leaf++) {
                const leafAngle = (leaf / 3) * Math.PI * 2 - Math.PI / 2;
                const leafX = x + Math.cos(leafAngle) * cloverSize * 0.8;
                const leafY = y + Math.sin(leafAngle) * cloverSize * 0.8;
                ctx.beginPath();
                ctx.arc(leafX, leafY, cloverSize * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Small flowers (scattered)
        const flowerColors = ['#e8e850', '#ffffff', '#e8a0d0', '#a0c0e8', '#e8c080', '#f0a0a0'];
        const flowerCount = 5 + Math.floor(Math.abs(noise.noise2D(variant * 3, 0)) * 6);
        for (let i = 0; i < flowerCount; i++) {
            const angle = microNoise.noise2D(i * 7, variant * 3) * Math.PI * 2;
            const dist = Math.abs(microNoise.noise2D(variant * 3, i * 7)) * radius * 0.8;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const flowerSize = 1.2 + Math.abs(noise.noise2D(x, y)) * 2;
            const colorIdx = Math.floor(Math.abs(noise.noise2D(i, variant)) * flowerColors.length);

            ctx.fillStyle = flowerColors[colorIdx];
            ctx.globalAlpha = 0.75;

            // Petals
            const petalCount = 4 + Math.floor(Math.random() * 3);
            for (let p = 0; p < petalCount; p++) {
                const petalAngle = (p / petalCount) * Math.PI * 2;
                const petalX = x + Math.cos(petalAngle) * flowerSize * 0.5;
                const petalY = y + Math.sin(petalAngle) * flowerSize * 0.5;
                ctx.beginPath();
                ctx.ellipse(petalX, petalY, flowerSize * 0.5, flowerSize * 0.3, petalAngle, 0, Math.PI * 2);
                ctx.fill();
            }

            // Flower center
            ctx.fillStyle = '#e8c040';
            ctx.beginPath();
            ctx.arc(x, y, flowerSize * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Ferns and wildflower clusters for denser variety
        const fernBase = this.hexToRgb(terrain.darkColor);
        const fernHighlights = [
            this.shiftRgb(fernBase, { r: 18, g: 24, b: 10 }),
            this.shiftRgb(fernBase, { r: 8, g: 18, b: 6 }),
            this.shiftRgb(fernBase, { r: 26, g: 30, b: 16 })
        ];
        const fernCount = 4 + Math.floor(Math.abs(noise.noise2D(variant * 5, 0)) * 4);
        ctx.globalAlpha = 0.45;
        for (let i = 0; i < fernCount; i++) {
            const x = cx + (detailNoise.noise2D(i * 4, variant * 6) - 0.5) * radius * 1.3;
            const y = cy + (detailNoise.noise2D(variant * 6, i * 4) - 0.5) * radius * 1.1;
            const scale = 0.6 + Math.abs(microNoise.noise2D(x * 0.1, y * 0.1)) * 0.8;
            const rotation = microNoise.noise2D(x * 0.05, y * 0.05) * 0.8;
            const mirrorX = microNoise.noise2D(x * 0.07, y * 0.07) > 0;
            const fernColor = fernHighlights[i % fernHighlights.length];
            this.drawFernCluster(ctx, x, y, scale, rotation, this.rgbToHex(fernColor.r, fernColor.g, fernColor.b), mirrorX);
        }
        ctx.globalAlpha = 1;

        const wildflowerPalette = ['#f7d77a', '#ffffff', '#f2a3c7', '#b1d2f7', '#f6c88d', '#f2a7a7'];
        const wildflowerCount = 3 + Math.floor(Math.abs(noise.noise2D(variant * 7, 0)) * 3);
        ctx.globalAlpha = 0.8;
        for (let i = 0; i < wildflowerCount; i++) {
            const x = cx + (detailNoise.noise2D(i * 8, variant * 9) - 0.5) * radius * 1.2;
            const y = cy + (detailNoise.noise2D(variant * 9, i * 8) - 0.5) * radius * 1.0;
            const scale = 0.7 + Math.abs(microNoise.noise2D(x * 0.12, y * 0.12)) * 0.7;
            const rotation = microNoise.noise2D(x * 0.06, y * 0.06) * Math.PI;
            const mirrorX = microNoise.noise2D(x * 0.09, y * 0.09) > 0;
            this.drawFlowerCluster(ctx, x, y, scale, rotation, wildflowerPalette, mirrorX);
        }
        ctx.globalAlpha = 1;

        // Small twigs and debris
        ctx.strokeStyle = 'rgba(90, 70, 50, 0.3)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 12; i++) {
            const x = cx + (noise.noise2D(i * 4, variant * 4) - 0.5) * radius * 1.5;
            const y = cy + (noise.noise2D(variant * 4, i * 4) - 0.5) * radius * 1.3;
            const len = 3 + Math.random() * 6;
            const angle = Math.random() * Math.PI;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();

            // Small branch offshoots
            if (Math.random() > 0.5) {
                const midX = x + Math.cos(angle) * len * 0.5;
                const midY = y + Math.sin(angle) * len * 0.5;
                const branchAngle = angle + (Math.random() > 0.5 ? 0.5 : -0.5);
                ctx.beginPath();
                ctx.moveTo(midX, midY);
                ctx.lineTo(midX + Math.cos(branchAngle) * len * 0.3, midY + Math.sin(branchAngle) * len * 0.3);
                ctx.stroke();
            }
        }

        // Fallen leaves (few)
        const leafColors = ['#8a7a50', '#9a8a60', '#7a6a40', '#6a8a50'];
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < 6; i++) {
            const x = cx + (microNoise.noise2D(i * 8, variant * 6) - 0.5) * radius * 1.4;
            const y = cy + (microNoise.noise2D(variant * 6, i * 8) - 0.5) * radius * 1.2;
            const leafSize = 1.5 + Math.random() * 2;
            const rotation = Math.random() * Math.PI * 2;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.fillStyle = leafColors[i % leafColors.length];
            ctx.beginPath();
            ctx.ellipse(0, 0, leafSize, leafSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.globalAlpha = 1;

        // Dandelions (both yellow flowers and fuzzy seed heads)
        ctx.globalAlpha = 0.7;
        const dandelionCount = 2 + Math.floor(Math.abs(noise.noise2D(variant * 8, 0)) * 3);
        for (let i = 0; i < dandelionCount; i++) {
            const x = cx + (noise.noise2D(i * 9, variant * 8) - 0.5) * radius * 1.2;
            const y = cy + (noise.noise2D(variant * 8, i * 9) - 0.5) * radius;
            const size = 2 + Math.abs(microNoise.noise2D(x, y)) * 1.5;
            const isSeedHead = i % 2 === 0;

            if (isSeedHead) {
                // Fuzzy seed head (puffball)
                ctx.fillStyle = 'rgba(245, 245, 235, 0.9)';
                const seedCount = 12 + Math.floor(Math.random() * 8);
                for (let s = 0; s < seedCount; s++) {
                    const sAngle = (s / seedCount) * Math.PI * 2;
                    const sRadius = size * (0.6 + Math.random() * 0.4);
                    ctx.beginPath();
                    ctx.arc(x + Math.cos(sAngle) * sRadius, y + Math.sin(sAngle) * sRadius, 0.4, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Center
                ctx.fillStyle = '#d0d0c0';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Yellow dandelion flower
                ctx.fillStyle = '#e8d030';
                const petalCount = 16 + Math.floor(Math.random() * 8);
                for (let p = 0; p < petalCount; p++) {
                    const pAngle = (p / petalCount) * Math.PI * 2;
                    const pLen = size * 0.9;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + Math.cos(pAngle) * pLen, y + Math.sin(pAngle) * pLen);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#e8d030';
                    ctx.stroke();
                }
                ctx.fillStyle = '#c8a020';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Grass seed heads (tall grass with drooping seeds)
        ctx.globalAlpha = 0.5;
        const seedHeadCount = 4 + Math.floor(Math.abs(noise.noise2D(variant * 9, 0)) * 4);
        for (let i = 0; i < seedHeadCount; i++) {
            const baseX = cx + (noise.noise2D(i * 10, variant * 9) - 0.5) * radius * 1.3;
            const baseY = cy + (noise.noise2D(variant * 9, i * 10) - 0.5) * radius * 1.1;
            const height = 8 + Math.abs(microNoise.noise2D(baseX, baseY)) * 10;
            const bend = (microNoise.noise2D(baseX * 0.1, baseY * 0.1) - 0.5) * 0.6;

            // Stem
            ctx.strokeStyle = '#7a9a60';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            const tipX = baseX + bend * height;
            const tipY = baseY - height;
            ctx.quadraticCurveTo(baseX + bend * height * 0.3, baseY - height * 0.6, tipX, tipY);
            ctx.stroke();

            // Seed cluster at top (drooping)
            ctx.fillStyle = '#b0a070';
            const seedDropAngle = Math.PI / 2 + bend * 0.5;
            for (let s = 0; s < 6; s++) {
                const sAngle = seedDropAngle + (s - 2.5) * 0.2;
                const sLen = 2 + Math.random() * 2;
                const seedX = tipX + Math.cos(sAngle) * sLen;
                const seedY = tipY + Math.sin(sAngle) * sLen;
                ctx.beginPath();
                ctx.ellipse(seedX, seedY, 0.8, 0.4, sAngle, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Small ants/insects trail (optional detail)
        if (variant % 3 === 0) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#2a2015';
            const antX = cx + (noise.noise2D(variant * 11, 0) - 0.5) * radius * 0.8;
            const antY = cy + (noise.noise2D(0, variant * 11) - 0.5) * radius * 0.6;
            const antDirection = noise.noise2D(variant, variant) * Math.PI * 2;

            for (let a = 0; a < 5; a++) {
                const ax = antX + Math.cos(antDirection) * a * 6 + (Math.random() - 0.5) * 2;
                const ay = antY + Math.sin(antDirection) * a * 6 + (Math.random() - 0.5) * 2;
                // Ant body (simple)
                ctx.beginPath();
                ctx.ellipse(ax, ay, 0.8, 0.5, antDirection, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(ax + Math.cos(antDirection) * 0.8, ay + Math.sin(antDirection) * 0.8, 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Fine texture dots
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#000000';
        for (let i = 0; i < 80; i++) {
            const x = cx + (noise.noise2D(i * 3, variant) - 0.5) * radius * 1.7;
            const y = cy + (noise.noise2D(variant, i * 3) - 0.5) * radius * 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 0.3 + Math.random() * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render forest floor with rich leaf litter, twigs, branches, and organic debris
     */
    renderForestFloor(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        // Ground texture - dark humus patches
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 12; i++) {
            const x = cx + (noise.noise2D(i * 3, variant) - 0.5) * radius * 1.5;
            const y = cy + (noise.noise2D(variant, i * 3) - 0.5) * radius * 1.3;
            const patchSize = 10 + Math.abs(microNoise.noise2D(x, y)) * 18;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, patchSize);
            gradient.addColorStop(0, 'rgba(30, 25, 18, 0.5)');
            gradient.addColorStop(1, 'rgba(30, 25, 18, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, patchSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Larger fallen branches
        ctx.globalAlpha = 0.5;
        const branchColors = ['#4a3828', '#5a4838', '#3a2818', '#6a5848'];
        const branchCount = 3 + Math.floor(Math.abs(noise.noise2D(variant * 2, 0)) * 3);
        for (let i = 0; i < branchCount; i++) {
            const x = cx + (noise.noise2D(i * 6, variant * 3) - 0.5) * radius * 1.2;
            const y = cy + (noise.noise2D(variant * 3, i * 6) - 0.5) * radius * 1.0;
            const len = 12 + Math.random() * 20;
            const angle = Math.random() * Math.PI;
            const thickness = 1.5 + Math.random() * 2;

            // Main branch
            ctx.strokeStyle = branchColors[i % branchColors.length];
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            const endX = x + Math.cos(angle) * len;
            const endY = y + Math.sin(angle) * len;
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Branch shadow
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = thickness + 1;
            ctx.beginPath();
            ctx.moveTo(x + 1, y + 1);
            ctx.lineTo(endX + 1, endY + 1);
            ctx.stroke();

            // Small offshoots from branch
            const offshootCount = 2 + Math.floor(Math.random() * 3);
            ctx.lineWidth = thickness * 0.5;
            ctx.strokeStyle = branchColors[i % branchColors.length];
            for (let j = 0; j < offshootCount; j++) {
                const t = 0.2 + Math.random() * 0.6;
                const offX = x + Math.cos(angle) * len * t;
                const offY = y + Math.sin(angle) * len * t;
                const offAngle = angle + (Math.random() > 0.5 ? 0.5 : -0.5) + (Math.random() - 0.5) * 0.3;
                const offLen = len * 0.2 + Math.random() * len * 0.15;

                ctx.beginPath();
                ctx.moveTo(offX, offY);
                ctx.lineTo(offX + Math.cos(offAngle) * offLen, offY + Math.sin(offAngle) * offLen);
                ctx.stroke();
            }
        }

        // Small twigs scattered around
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 20; i++) {
            const x = cx + (noise.noise2D(i * 5, variant * 2) - 0.5) * radius * 1.5;
            const y = cy + (noise.noise2D(variant * 2, i * 5) - 0.5) * radius * 1.3;
            const len = 4 + Math.random() * 8;
            const angle = Math.random() * Math.PI;

            ctx.strokeStyle = branchColors[i % branchColors.length];
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();

            // Tiny offshoot
            if (Math.random() > 0.6) {
                const midX = x + Math.cos(angle) * len * 0.6;
                const midY = y + Math.sin(angle) * len * 0.6;
                const offAngle = angle + (Math.random() > 0.5 ? 0.6 : -0.6);
                ctx.beginPath();
                ctx.moveTo(midX, midY);
                ctx.lineTo(midX + Math.cos(offAngle) * len * 0.3, midY + Math.sin(offAngle) * len * 0.3);
                ctx.stroke();
            }
        }

        // Dense leaf litter - multiple layers
        const leafColors = [
            '#5a4a30', '#4a3a25', '#6a5a40', '#3d5a3a', '#4d6a4a', '#5a4020',
            '#7a6a50', '#8a7a60', '#4a4030', '#3a5a35', '#6a5535'
        ];

        // Bottom layer - older decomposed leaves (more transparent)
        ctx.globalAlpha = 0.3;
        const bottomLeafCount = Math.floor(radius * 1.2);
        for (let i = 0; i < bottomLeafCount; i++) {
            const seed = variant * 10000 + i;
            const angle = detailNoise.noise2D(seed * 0.1, 0) * Math.PI * 2;
            const dist = Math.abs(detailNoise.noise2D(0, seed * 0.1)) * radius * 0.92;

            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const leafSize = 2 + Math.abs(microNoise.noise2D(x * 0.1, y * 0.1)) * 3;
            const rotation = microNoise.noise2D(x * 0.05, y * 0.05) * Math.PI;
            const colorIdx = Math.floor(Math.abs(noise.noise2D(x, y)) * leafColors.length);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.fillStyle = leafColors[colorIdx % leafColors.length];
            ctx.beginPath();
            ctx.ellipse(0, 0, leafSize, leafSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Top layer - fresher leaves with veins
        ctx.globalAlpha = 0.5;
        const topLeafCount = Math.floor(radius * 0.9);
        for (let i = 0; i < topLeafCount; i++) {
            const seed = variant * 20000 + i;
            const angle = detailNoise.noise2D(seed * 0.15, 0) * Math.PI * 2;
            const dist = Math.abs(detailNoise.noise2D(0, seed * 0.15)) * radius * 0.88;

            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const leafSize = 2.5 + Math.abs(microNoise.noise2D(x * 0.08, y * 0.08)) * 4;
            const rotation = microNoise.noise2D(x * 0.04, y * 0.04) * Math.PI;
            const colorIdx = Math.floor(Math.abs(noise.noise2D(x * 1.5, y * 1.5)) * leafColors.length);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            // Leaf shape - slightly more complex
            ctx.fillStyle = leafColors[colorIdx % leafColors.length];
            ctx.beginPath();
            ctx.moveTo(leafSize, 0);
            ctx.quadraticCurveTo(leafSize * 0.8, -leafSize * 0.4, 0, -leafSize * 0.35);
            ctx.quadraticCurveTo(-leafSize * 0.8, -leafSize * 0.3, -leafSize, 0);
            ctx.quadraticCurveTo(-leafSize * 0.8, leafSize * 0.3, 0, leafSize * 0.35);
            ctx.quadraticCurveTo(leafSize * 0.8, leafSize * 0.4, leafSize, 0);
            ctx.fill();

            // Leaf vein
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(-leafSize * 0.8, 0);
            ctx.lineTo(leafSize * 0.8, 0);
            ctx.stroke();

            // Side veins
            ctx.lineWidth = 0.25;
            for (let v = -2; v <= 2; v++) {
                if (v === 0) continue;
                const vx = v * leafSize * 0.25;
                ctx.beginPath();
                ctx.moveTo(vx, 0);
                ctx.lineTo(vx + (v > 0 ? leafSize * 0.15 : -leafSize * 0.15), v > 0 ? -leafSize * 0.15 : leafSize * 0.15);
                ctx.stroke();
            }

            ctx.restore();
        }

        // Pine needles clusters
        ctx.globalAlpha = 0.35;
        const needleClusterCount = 6 + Math.floor(Math.abs(noise.noise2D(variant * 4, 0)) * 5);
        for (let i = 0; i < needleClusterCount; i++) {
            const clusterX = cx + (noise.noise2D(i * 7, variant * 4) - 0.5) * radius * 1.4;
            const clusterY = cy + (noise.noise2D(variant * 4, i * 7) - 0.5) * radius * 1.2;

            ctx.strokeStyle = '#3a4a30';
            ctx.lineWidth = 0.5;
            const needleCount = 5 + Math.floor(Math.random() * 8);
            for (let n = 0; n < needleCount; n++) {
                const needleAngle = Math.random() * Math.PI * 2;
                const needleLen = 3 + Math.random() * 4;
                ctx.beginPath();
                ctx.moveTo(clusterX, clusterY);
                ctx.lineTo(clusterX + Math.cos(needleAngle) * needleLen, clusterY + Math.sin(needleAngle) * needleLen);
                ctx.stroke();
            }
        }

        // Acorns and seed pods
        ctx.globalAlpha = 0.45;
        const acornCount = 4 + Math.floor(Math.abs(noise.noise2D(variant * 5, 0)) * 4);
        for (let i = 0; i < acornCount; i++) {
            const x = cx + (microNoise.noise2D(i * 9, variant * 5) - 0.5) * radius * 1.3;
            const y = cy + (microNoise.noise2D(variant * 5, i * 9) - 0.5) * radius * 1.1;
            const size = 1.5 + Math.random() * 1.5;

            // Acorn cap
            ctx.fillStyle = '#5a4a35';
            ctx.beginPath();
            ctx.arc(x, y - size * 0.3, size * 0.7, Math.PI, 0);
            ctx.fill();

            // Acorn body
            ctx.fillStyle = '#8a6a45';
            ctx.beginPath();
            ctx.ellipse(x, y + size * 0.2, size * 0.6, size * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Small mushrooms
        ctx.globalAlpha = 0.5;
        const mushroomCount = 2 + Math.floor(Math.abs(noise.noise2D(variant * 6, 0)) * 3);
        for (let i = 0; i < mushroomCount; i++) {
            const x = cx + (noise.noise2D(i * 11, variant * 6) - 0.5) * radius * 1.2;
            const y = cy + (noise.noise2D(variant * 6, i * 11) - 0.5) * radius;
            const size = 2 + Math.random() * 2;

            // Stem
            ctx.fillStyle = '#e8e0d0';
            ctx.beginPath();
            ctx.rect(x - size * 0.2, y, size * 0.4, size * 0.8);
            ctx.fill();

            // Cap
            const capColors = ['#8a4030', '#a05040', '#7a3525', '#9a6050'];
            ctx.fillStyle = capColors[i % capColors.length];
            ctx.beginPath();
            ctx.ellipse(x, y, size * 0.7, size * 0.4, 0, Math.PI, 0);
            ctx.fill();

            // Cap spots (for some)
            if (Math.random() > 0.5) {
                ctx.fillStyle = '#f8f0e0';
                for (let s = 0; s < 3; s++) {
                    const spotX = x + (Math.random() - 0.5) * size * 0.8;
                    const spotY = y - size * 0.1 - Math.random() * size * 0.2;
                    ctx.beginPath();
                    ctx.arc(spotX, spotY, size * 0.1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Moss patches
        ctx.globalAlpha = 0.35;
        const mossCount = 5 + Math.floor(Math.abs(noise.noise2D(variant * 7, 0)) * 4);
        for (let i = 0; i < mossCount; i++) {
            const x = cx + (detailNoise.noise2D(i * 4, variant * 7) - 0.5) * radius * 1.4;
            const y = cy + (detailNoise.noise2D(variant * 7, i * 4) - 0.5) * radius * 1.2;
            const mossSize = 6 + Math.abs(microNoise.noise2D(x, y)) * 10;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, mossSize);
            gradient.addColorStop(0, 'rgba(60, 90, 50, 0.6)');
            gradient.addColorStop(0.7, 'rgba(50, 80, 45, 0.3)');
            gradient.addColorStop(1, 'rgba(50, 80, 45, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, mossSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Fern clusters and woodland flowers
        const fernBase = this.hexToRgb('#36543a');
        const fernColors = [
            this.shiftRgb(fernBase, { r: 12, g: 18, b: 8 }),
            this.shiftRgb(fernBase, { r: 2, g: 10, b: 4 }),
            this.shiftRgb(fernBase, { r: 20, g: 24, b: 12 })
        ];
        ctx.globalAlpha = 0.45;
        const fernCount = 4 + Math.floor(Math.abs(noise.noise2D(variant * 9, 0)) * 4);
        for (let i = 0; i < fernCount; i++) {
            const x = cx + (detailNoise.noise2D(i * 5, variant * 8) - 0.5) * radius * 1.3;
            const y = cy + (detailNoise.noise2D(variant * 8, i * 5) - 0.5) * radius * 1.1;
            const scale = 0.6 + Math.abs(microNoise.noise2D(x * 0.09, y * 0.09)) * 0.9;
            const rotation = microNoise.noise2D(x * 0.04, y * 0.04) * 0.9;
            const mirrorX = microNoise.noise2D(x * 0.06, y * 0.06) > 0;
            const fernColor = fernColors[i % fernColors.length];
            this.drawFernCluster(ctx, x, y, scale, rotation, this.rgbToHex(fernColor.r, fernColor.g, fernColor.b), mirrorX);
        }
        ctx.globalAlpha = 1;

        const woodlandPalette = ['#f4d97f', '#ffffff', '#f2a5c8', '#c5d9f4', '#f4c38f'];
        const flowerPatchCount = 2 + Math.floor(Math.abs(noise.noise2D(variant * 10, 0)) * 3);
        ctx.globalAlpha = 0.75;
        for (let i = 0; i < flowerPatchCount; i++) {
            const x = cx + (detailNoise.noise2D(i * 9, variant * 10) - 0.5) * radius * 1.1;
            const y = cy + (detailNoise.noise2D(variant * 10, i * 9) - 0.5) * radius * 0.9;
            const scale = 0.6 + Math.abs(microNoise.noise2D(x * 0.1, y * 0.1)) * 0.7;
            const rotation = microNoise.noise2D(x * 0.05, y * 0.05) * Math.PI;
            const mirrorX = microNoise.noise2D(x * 0.08, y * 0.08) > 0;
            this.drawFlowerCluster(ctx, x, y, scale, rotation, woodlandPalette, mirrorX);
        }
        ctx.globalAlpha = 1;

        // Fine ground texture
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#000000';
        for (let i = 0; i < 100; i++) {
            const x = cx + (noise.noise2D(i * 2.5, variant * 1.5) - 0.5) * radius * 1.7;
            const y = cy + (noise.noise2D(variant * 1.5, i * 2.5) - 0.5) * radius * 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 0.3 + Math.random() * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render rocky grass (hills) with detailed stones, pebbles, and weathered vegetation
     */
    renderRockyGrass(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        const darkRGB = this.hexToRgb(terrain.darkColor);
        const lightRGB = this.hexToRgb(terrain.accentColor);

        // Ground color variation patches
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 8; i++) {
            const x = cx + (noise.noise2D(i * 4, variant) - 0.5) * radius * 1.4;
            const y = cy + (noise.noise2D(variant, i * 4) - 0.5) * radius * 1.2;
            const patchSize = 12 + Math.abs(microNoise.noise2D(x, y)) * 18;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, patchSize);
            gradient.addColorStop(0, i % 2 === 0 ? 'rgba(90, 100, 60, 0.4)' : 'rgba(70, 80, 50, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, patchSize, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Sparse grass tufts (hills have less dense grass)
        const tuftCount = 8 + Math.floor(Math.abs(noise.noise2D(variant * 2, 0)) * 6);
        for (let t = 0; t < tuftCount; t++) {
            const tuftAngle = detailNoise.noise2D(t * 0.25, variant) * Math.PI * 2;
            const tuftDist = Math.abs(detailNoise.noise2D(variant, t * 0.25)) * radius * 0.8;
            const tuftX = cx + Math.cos(tuftAngle) * tuftDist;
            const tuftY = cy + Math.sin(tuftAngle) * tuftDist;

            const bladesInTuft = 3 + Math.floor(Math.abs(noise.noise2D(t * 5, variant)) * 4);
            for (let b = 0; b < bladesInTuft; b++) {
                const bladeAngle = (b / bladesInTuft) * Math.PI - Math.PI / 2 + (Math.random() - 0.5) * 0.6;
                const bladeHeight = 4 + microNoise.noise2D(tuftX + b, tuftY) * 6;
                const bend = (bladeAngle - Math.PI / 2) * 0.25 + microNoise.noise2D(tuftX * 0.05, tuftY * 0.05 + b) * 0.3;

                const gradient = ctx.createLinearGradient(tuftX, tuftY, tuftX + bend * bladeHeight, tuftY - bladeHeight);
                gradient.addColorStop(0, `rgba(${darkRGB.r}, ${darkRGB.g}, ${darkRGB.b}, 0.5)`);
                gradient.addColorStop(1, `rgba(${lightRGB.r}, ${lightRGB.g}, ${lightRGB.b}, 0.35)`);

                ctx.beginPath();
                ctx.moveTo(tuftX + (b - bladesInTuft / 2) * 0.6, tuftY);
                ctx.quadraticCurveTo(
                    tuftX + bend * bladeHeight * 0.5,
                    tuftY - bladeHeight * 0.6,
                    tuftX + bend * bladeHeight,
                    tuftY - bladeHeight
                );
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 0.5 + Math.random() * 0.4;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }

        // Scattered pebbles and gravel
        ctx.globalAlpha = 0.4;
        const pebbleColors = ['#7a7570', '#8a8580', '#6a6560', '#9a9590', '#5a5550'];
        for (let i = 0; i < 35; i++) {
            const x = cx + (detailNoise.noise2D(i * 2, variant * 3) - 0.5) * radius * 1.5;
            const y = cy + (detailNoise.noise2D(variant * 3, i * 2) - 0.5) * radius * 1.3;
            const size = 1 + Math.abs(noise.noise2D(x * 0.1, y * 0.1)) * 2.5;

            ctx.fillStyle = pebbleColors[i % pebbleColors.length];
            ctx.beginPath();
            ctx.ellipse(x, y, size, size * 0.7, noise.noise2D(i, i) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Medium-sized rocks with 3D shading
        const rockCount = Math.floor(radius * 0.2);
        for (let i = 0; i < rockCount; i++) {
            const seed = variant * 20000 + i;
            const angle = detailNoise.noise2D(seed * 0.15, 0) * Math.PI * 2;
            const dist = Math.abs(detailNoise.noise2D(0, seed * 0.15)) * radius * 0.8;

            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const rockSize = 3 + Math.abs(microNoise.noise2D(x * 0.1, y * 0.1)) * 6;

            ctx.globalAlpha = 0.8;

            // Rock shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(x + rockSize * 0.15, y + rockSize * 0.5, rockSize * 0.9, rockSize * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Rock with highlight gradient
            const rockGrad = ctx.createRadialGradient(
                x - rockSize * 0.3, y - rockSize * 0.3, 0,
                x + rockSize * 0.2, y + rockSize * 0.2, rockSize * 1.2
            );
            rockGrad.addColorStop(0, '#9a9898');
            rockGrad.addColorStop(0.3, '#7a7878');
            rockGrad.addColorStop(0.7, '#5a5858');
            rockGrad.addColorStop(1, '#3a3838');

            ctx.beginPath();
            ctx.moveTo(x + rockSize * 0.7, y);
            ctx.quadraticCurveTo(x + rockSize, y - rockSize * 0.5, x + rockSize * 0.3, y - rockSize * 0.8);
            ctx.quadraticCurveTo(x - rockSize * 0.3, y - rockSize, x - rockSize * 0.7, y - rockSize * 0.3);
            ctx.quadraticCurveTo(x - rockSize, y + rockSize * 0.2, x - rockSize * 0.3, y + rockSize * 0.6);
            ctx.quadraticCurveTo(x + rockSize * 0.2, y + rockSize * 0.8, x + rockSize * 0.7, y);
            ctx.fillStyle = rockGrad;
            ctx.fill();

            // Rock highlight
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.ellipse(x - rockSize * 0.25, y - rockSize * 0.35, rockSize * 0.25, rockSize * 0.15, -0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Dried grass / hay strands
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#a09060';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 15; i++) {
            const x = cx + (noise.noise2D(i * 6, variant * 5) - 0.5) * radius * 1.3;
            const y = cy + (noise.noise2D(variant * 5, i * 6) - 0.5) * radius * 1.1;
            const len = 5 + Math.random() * 8;
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + len * 0.3, y - len * 0.5, x + len * 0.5, y - len);
            ctx.stroke();
        }

        // Lichen patches on rocks
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 6; i++) {
            const x = cx + (microNoise.noise2D(i * 8, variant * 4) - 0.5) * radius * 1.2;
            const y = cy + (microNoise.noise2D(variant * 4, i * 8) - 0.5) * radius;
            const size = 3 + Math.random() * 5;

            ctx.fillStyle = i % 2 === 0 ? '#8a9a70' : '#a0a080';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Contour lines for elevation feel
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = terrain.darkColor;
        ctx.lineWidth = 0.6;
        for (let contour = 0; contour < 3; contour++) {
            const threshold = 0.25 + contour * 0.2;
            ctx.beginPath();
            let hasPoints = false;
            for (let px = 0; px < width; px += 4) {
                for (let py = 0; py < height; py += 4) {
                    const value = (noise.noise2D(px * 0.02 + variant, py * 0.02) + 1) / 2;
                    if (Math.abs(value - threshold) < 0.015) {
                        if (!hasPoints) { ctx.moveTo(px, py); hasPoints = true; }
                        else ctx.lineTo(px, py);
                    }
                }
            }
            if (hasPoints) ctx.stroke();
        }
        ctx.globalAlpha = 1;
    },

    /**
     * Render imposing rock wall terrain - large boulders that clearly show this is impassable
     */
    renderStoneDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        // Rock colors for variety
        const rockColors = [
            { base: '#5a5858', light: '#8a8888', dark: '#3a3838', highlight: '#a0a0a0' },
            { base: '#6a6565', light: '#9a9595', dark: '#4a4545', highlight: '#b0abab' },
            { base: '#555050', light: '#858080', dark: '#353030', highlight: '#959090' }
        ];

        // Draw large imposing boulders filling the hex
        const boulderCount = 4 + Math.floor(Math.abs(noise.noise2D(variant, 0)) * 3);

        // First pass: draw background/base rock layer
        ctx.fillStyle = terrain.darkColor;
        ctx.globalAlpha = 1;
        this.createHexPath(ctx, cx, cy, radius);
        ctx.fill();

        // Draw main large boulders
        for (let i = 0; i < boulderCount; i++) {
            const seed = variant * 1000 + i;
            const angle = (i / boulderCount) * Math.PI * 2 + noise.noise2D(seed, 0) * 0.8;
            const dist = Math.abs(noise.noise2D(seed, variant)) * radius * 0.5;

            const bx = cx + Math.cos(angle) * dist;
            const by = cy + Math.sin(angle) * dist;
            const boulderSize = radius * (0.35 + Math.abs(microNoise.noise2D(bx, by)) * 0.25);

            const colorIdx = Math.floor(Math.abs(noise.noise2D(i * 3, variant)) * rockColors.length);
            const colors = rockColors[colorIdx % rockColors.length];

            // Boulder main body with 3D gradient
            const grad = ctx.createRadialGradient(
                bx - boulderSize * 0.3, by - boulderSize * 0.3, 0,
                bx + boulderSize * 0.2, by + boulderSize * 0.3, boulderSize * 1.2
            );
            grad.addColorStop(0, colors.highlight);
            grad.addColorStop(0.3, colors.light);
            grad.addColorStop(0.6, colors.base);
            grad.addColorStop(1, colors.dark);

            // Irregular boulder shape
            ctx.beginPath();
            const points = 8;
            for (let p = 0; p <= points; p++) {
                const a = (p / points) * Math.PI * 2;
                const irregularity = 0.7 + microNoise.noise2D(bx + p * 5, by + seed) * 0.4;
                const px = bx + Math.cos(a) * boulderSize * irregularity;
                const py = by + Math.sin(a) * boulderSize * irregularity * 0.85; // Flatten slightly
                if (p === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // Deep shadow under boulder
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(bx + boulderSize * 0.1, by + boulderSize * 0.7, boulderSize * 0.8, boulderSize * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Highlight on top-left
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.beginPath();
            ctx.ellipse(bx - boulderSize * 0.3, by - boulderSize * 0.3, boulderSize * 0.35, boulderSize * 0.2, -0.5, 0, Math.PI * 2);
            ctx.fill();

            // Rock texture cracks on boulder
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.lineWidth = 1;
            const crackCount = 2 + Math.floor(Math.abs(noise.noise2D(i * 7, variant)) * 3);
            for (let c = 0; c < crackCount; c++) {
                const startA = noise.noise2D(c * 10, seed) * Math.PI * 2;
                let cx1 = bx + Math.cos(startA) * boulderSize * 0.2;
                let cy1 = by + Math.sin(startA) * boulderSize * 0.2;
                ctx.beginPath();
                ctx.moveTo(cx1, cy1);
                const segments = 2 + Math.floor(Math.random() * 2);
                for (let s = 0; s < segments; s++) {
                    const crackAngle = noise.noise2D(cx1 * 0.1, cy1 * 0.1) * Math.PI;
                    cx1 += Math.cos(crackAngle) * boulderSize * 0.3;
                    cy1 += Math.sin(crackAngle) * boulderSize * 0.2;
                    ctx.lineTo(cx1, cy1);
                }
                ctx.stroke();
            }
        }

        // Add smaller rocks filling gaps
        const smallRockCount = 8 + Math.floor(Math.abs(noise.noise2D(variant * 2, 0)) * 6);
        for (let i = 0; i < smallRockCount; i++) {
            const angle = detailNoise.noise2D(i * 0.3, variant) * Math.PI * 2;
            const dist = 0.3 + Math.abs(detailNoise.noise2D(variant, i * 0.3)) * 0.6;
            const rx = cx + Math.cos(angle) * radius * dist;
            const ry = cy + Math.sin(angle) * radius * dist;
            const rockSize = 6 + Math.abs(microNoise.noise2D(rx * 0.1, ry * 0.1)) * 12;

            const colorIdx = Math.floor(Math.abs(noise.noise2D(i * 5, variant * 2)) * rockColors.length);
            const colors = rockColors[colorIdx % rockColors.length];

            // Small rock gradient
            const grad = ctx.createLinearGradient(rx - rockSize, ry - rockSize, rx + rockSize, ry + rockSize);
            grad.addColorStop(0, colors.light);
            grad.addColorStop(0.5, colors.base);
            grad.addColorStop(1, colors.dark);

            ctx.beginPath();
            ctx.moveTo(rx + rockSize * 0.8, ry);
            ctx.quadraticCurveTo(rx + rockSize, ry - rockSize * 0.4, rx + rockSize * 0.4, ry - rockSize * 0.7);
            ctx.quadraticCurveTo(rx - rockSize * 0.2, ry - rockSize * 0.9, rx - rockSize * 0.7, ry - rockSize * 0.4);
            ctx.quadraticCurveTo(rx - rockSize * 0.9, ry + rockSize * 0.2, rx - rockSize * 0.4, ry + rockSize * 0.6);
            ctx.quadraticCurveTo(rx + rockSize * 0.2, ry + rockSize * 0.8, rx + rockSize * 0.8, ry);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Deep crevice shadows between rocks for dramatic effect
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        const creviceCount = 5 + Math.floor(Math.abs(noise.noise2D(variant * 3, 0)) * 4);
        for (let i = 0; i < creviceCount; i++) {
            const startAngle = (i / creviceCount) * Math.PI * 2 + noise.noise2D(i, variant) * 0.5;
            const startDist = 0.2 + Math.abs(noise.noise2D(i * 8, variant)) * 0.5;
            let x = cx + Math.cos(startAngle) * radius * startDist;
            let y = cy + Math.sin(startAngle) * radius * startDist;

            ctx.beginPath();
            ctx.moveTo(x, y);
            const segments = 2 + Math.floor(Math.abs(noise.noise2D(i, 0)) * 3);
            for (let s = 0; s < segments; s++) {
                const crackAngle = noise.noise2D(x * 0.08 + s, y * 0.08) * Math.PI;
                const length = 8 + Math.abs(microNoise.noise2D(x, y)) * 15;
                x += Math.cos(crackAngle) * length;
                y += Math.sin(crackAngle) * length;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Small moss patches in crevices (subtle)
        ctx.globalAlpha = 0.3;
        const mossCount = 3 + Math.floor(Math.abs(noise.noise2D(variant * 4, 0)) * 3);
        for (let i = 0; i < mossCount; i++) {
            const angle = noise.noise2D(i * 6, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.6;
            const mx = cx + Math.cos(angle) * dist;
            const my = cy + Math.sin(angle) * dist;
            const mossSize = 3 + Math.abs(microNoise.noise2D(mx, my)) * 6;

            ctx.fillStyle = '#3a5a3a';
            ctx.beginPath();
            ctx.arc(mx, my, mossSize, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    /**
     * Render water with waves and sparkles
     */
    renderWaterDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Wave lines
        ctx.strokeStyle = terrain.lightColor;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.2;
        ctx.lineCap = 'round';

        const waveCount = 6;
        for (let w = 0; w < waveCount; w++) {
            const baseY = cy - radius * 0.8 + (w + 0.5) * (radius * 1.6 / waveCount);
            ctx.beginPath();
            let started = false;

            for (let x = cx - radius; x <= cx + radius; x += 3) {
                const waveOffset = noise.noise2D(x * 0.02 + variant + w * 0.3, w * 0.5) * 8;
                const y = baseY + waveOffset;
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Sparkle highlights
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 25; i++) {
            const angle = noise.noise2D(i * 3, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.8;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const sparkleSize = 0.5 + Math.abs(noise.noise2D(x * 0.1, y * 0.1)) * 1.5;

            ctx.beginPath();
            ctx.arc(x, y, sparkleSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render shallow brook/stream water with visible sandy bottom and pebbles
     * More like a clear shallow creek than deep water
     */
    renderShallowWater(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Draw sandy bottom showing through clear water
        const bottomColor = terrain.bottomColor || '#c4b088';
        const pebbleColors = terrain.pebbleColors || ['#8a7868', '#9a8a78', '#7a6858'];

        // Sandy bottom patches visible through water
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 15; i++) {
            const angle = noise.noise2D(i * 2, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.85;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const patchSize = 8 + Math.abs(noise.noise2D(x * 0.05, y * 0.05)) * 15;

            ctx.fillStyle = bottomColor;
            ctx.beginPath();
            ctx.ellipse(x, y, patchSize, patchSize * 0.7, noise.noise2D(i, i) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Pebbles on the bottom
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 30; i++) {
            const angle = detailNoise.noise2D(i * 3, variant) * Math.PI * 2;
            const dist = Math.abs(detailNoise.noise2D(i, variant)) * radius * 0.8;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const pebbleSize = 2 + Math.abs(noise.noise2D(x * 0.08, y * 0.08)) * 4;

            const colorIdx = Math.floor(Math.abs(noise.noise2D(i * 0.5, variant)) * pebbleColors.length);
            ctx.fillStyle = pebbleColors[colorIdx % pebbleColors.length];
            ctx.beginPath();
            ctx.ellipse(x, y, pebbleSize, pebbleSize * 0.6, noise.noise2D(i, i) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Light ripples on water surface
        ctx.strokeStyle = terrain.lightColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25;
        ctx.lineCap = 'round';

        for (let w = 0; w < 4; w++) {
            const baseY = cy - radius * 0.6 + w * (radius * 0.4);
            ctx.beginPath();
            let started = false;

            for (let x = cx - radius * 0.8; x <= cx + radius * 0.8; x += 4) {
                const waveOffset = noise.noise2D(x * 0.025 + variant, w * 0.4) * 5;
                const y = baseY + waveOffset;
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Gentle sparkles (fewer than deep water)
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 12; i++) {
            const angle = noise.noise2D(i * 4, variant + 1) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i + 1, variant)) * radius * 0.7;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const sparkleSize = 0.8 + Math.abs(noise.noise2D(x * 0.1, y * 0.1)) * 1;

            ctx.beginPath();
            ctx.arc(x, y, sparkleSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render flowing river water with clear directional flow
     * variant determines flow direction: 0=horizontal, 1=diagonal-right, 2=diagonal-left, 3=vertical
     */
    renderFlowingWater(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Determine flow direction based on variant
        const flowAngle = (variant % 4) * Math.PI / 4; // 0, 45, 90, 135 degrees
        const flowDirX = Math.cos(flowAngle);
        const flowDirY = Math.sin(flowAngle);

        // Main flow lines - follow the flow direction
        ctx.strokeStyle = terrain.lightColor;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.22;
        ctx.lineCap = 'round';

        const lineCount = 7;
        for (let l = 0; l < lineCount; l++) {
            // Offset perpendicular to flow direction
            const perpOffset = (l - lineCount / 2) * (radius * 0.25);
            const startX = cx - flowDirX * radius + flowDirY * perpOffset;
            const startY = cy - flowDirY * radius - flowDirX * perpOffset;

            ctx.beginPath();
            let t = 0;
            let started = false;

            while (t < radius * 2.2) {
                const x = startX + flowDirX * t;
                const y = startY + flowDirY * t;

                // Add wave motion perpendicular to flow
                const waveOffset = noise.noise2D(t * 0.04 + variant, l * 0.5) * 6;
                const finalX = x + flowDirY * waveOffset;
                const finalY = y - flowDirX * waveOffset;

                if (!started) { ctx.moveTo(finalX, finalY); started = true; }
                else ctx.lineTo(finalX, finalY);
                t += 6;
            }
            ctx.stroke();
        }

        // Flow arrows/chevrons to show direction
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 1.2;
        const arrowCount = 4;
        for (let i = 0; i < arrowCount; i++) {
            const t = (i + 0.5) / arrowCount;
            const arrowX = cx + (t - 0.5) * flowDirX * radius * 1.2;
            const arrowY = cy + (t - 0.5) * flowDirY * radius * 1.2;
            const arrowSize = 6;

            // Draw small chevron pointing in flow direction
            ctx.beginPath();
            ctx.moveTo(
                arrowX - flowDirX * arrowSize - flowDirY * arrowSize * 0.5,
                arrowY - flowDirY * arrowSize + flowDirX * arrowSize * 0.5
            );
            ctx.lineTo(arrowX, arrowY);
            ctx.lineTo(
                arrowX - flowDirX * arrowSize + flowDirY * arrowSize * 0.5,
                arrowY - flowDirY * arrowSize - flowDirX * arrowSize * 0.5
            );
            ctx.stroke();
        }

        // Ripples - elongated in flow direction
        ctx.globalAlpha = 0.14;
        for (let i = 0; i < 10; i++) {
            const rx = cx + (noise.noise2D(i * 4, variant) - 0.5) * radius * 1.3;
            const ry = cy + (noise.noise2D(variant, i * 4) - 0.5) * radius * 1.3;

            ctx.beginPath();
            ctx.ellipse(rx, ry, 4 + Math.random() * 4, 1.5 + Math.random() * 1.5, flowAngle, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Sparkle highlights
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < 12; i++) {
            const sx = cx + (noise.noise2D(i * 5 + 100, variant) - 0.5) * radius * 1.4;
            const sy = cy + (noise.noise2D(variant, i * 5 + 100) - 0.5) * radius * 1.4;
            const sparkleSize = 0.5 + Math.abs(noise.noise2D(sx * 0.1, sy * 0.1)) * 1.2;

            ctx.beginPath();
            ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render sand with ripples, shells, driftwood, and coastal grass
     */
    renderSandDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Color variation patches
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < 6; i++) {
            const x = cx + (noise.noise2D(i * 3.5, variant * 2) - 0.5) * radius * 1.4;
            const y = cy + (noise.noise2D(variant * 2, i * 3.5) - 0.5) * radius * 1.2;
            const patchSize = 15 + Math.abs(noise.noise2D(x * 0.05, y * 0.05)) * 20;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, patchSize);
            gradient.addColorStop(0, i % 2 === 0 ? 'rgba(180, 160, 120, 0.4)' : 'rgba(200, 180, 140, 0.3)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, patchSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Wind ripple lines
        ctx.strokeStyle = terrain.darkColor;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.12;

        const rippleCount = 12;
        for (let r = 0; r < rippleCount; r++) {
            const baseY = cy - radius * 0.85 + (r + 0.5) * (radius * 1.7 / rippleCount);
            ctx.beginPath();
            let started = false;

            for (let x = cx - radius; x <= cx + radius; x += 2) {
                const rippleOffset = noise.noise2D(x * 0.03 + variant, r * 0.25) * 4;
                const y = baseY + rippleOffset;
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Scattered small pebbles
        ctx.globalAlpha = 0.25;
        const pebbleColors = ['#a09080', '#b0a090', '#908070', '#c0b0a0'];
        for (let i = 0; i < 25; i++) {
            const angle = noise.noise2D(i * 3, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.88;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const size = 0.8 + Math.random() * 2;

            ctx.fillStyle = pebbleColors[i % pebbleColors.length];
            ctx.beginPath();
            ctx.ellipse(x, y, size, size * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Seashells
        ctx.globalAlpha = 0.5;
        const shellCount = 5 + Math.floor(Math.abs(noise.noise2D(variant * 3, 0)) * 5);
        for (let i = 0; i < shellCount; i++) {
            const x = cx + (detailNoise.noise2D(i * 5, variant * 4) - 0.5) * radius * 1.3;
            const y = cy + (detailNoise.noise2D(variant * 4, i * 5) - 0.5) * radius * 1.1;
            const size = 2 + Math.random() * 3;
            const rotation = Math.random() * Math.PI * 2;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            // Shell type variation
            if (i % 3 === 0) {
                // Spiral shell
                ctx.fillStyle = '#e8dcc8';
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 1.7);
                ctx.lineTo(0, 0);
                ctx.fill();
                ctx.strokeStyle = '#c8b8a0';
                ctx.lineWidth = 0.3;
                ctx.stroke();
            } else if (i % 3 === 1) {
                // Clam shell
                ctx.fillStyle = '#f0e8d8';
                ctx.beginPath();
                ctx.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI);
                ctx.fill();
                // Ridges
                ctx.strokeStyle = '#d0c0a8';
                ctx.lineWidth = 0.3;
                for (let r = 0; r < 4; r++) {
                    const ridgeY = -size * 0.5 + r * size * 0.25;
                    ctx.beginPath();
                    ctx.arc(0, ridgeY, size * (0.3 + r * 0.15), 0, Math.PI);
                    ctx.stroke();
                }
            } else {
                // Small shell fragment
                ctx.fillStyle = '#e0d4c0';
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        // Small driftwood pieces
        ctx.globalAlpha = 0.4;
        const woodColors = ['#8a7a60', '#9a8a70', '#7a6a50'];
        for (let i = 0; i < 4; i++) {
            const x = cx + (noise.noise2D(i * 7, variant * 5) - 0.5) * radius * 1.2;
            const y = cy + (noise.noise2D(variant * 5, i * 7) - 0.5) * radius;
            const len = 8 + Math.random() * 15;
            const thickness = 1.5 + Math.random() * 2;
            const angle = Math.random() * Math.PI;

            ctx.strokeStyle = woodColors[i % woodColors.length];
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();
        }

        // Dried coastal grass tufts
        ctx.globalAlpha = 0.35;
        const grassColors = ['#b0a070', '#c0b080', '#a09060'];
        const grassTuftCount = 4 + Math.floor(Math.abs(noise.noise2D(variant * 6, 0)) * 4);
        for (let t = 0; t < grassTuftCount; t++) {
            const tuftX = cx + (detailNoise.noise2D(t * 4, variant * 6) - 0.5) * radius * 1.3;
            const tuftY = cy + (detailNoise.noise2D(variant * 6, t * 4) - 0.5) * radius * 1.1;

            ctx.strokeStyle = grassColors[t % grassColors.length];
            ctx.lineWidth = 0.5;
            const bladeCount = 4 + Math.floor(Math.random() * 5);
            for (let b = 0; b < bladeCount; b++) {
                const bladeAngle = -Math.PI / 2 + (b - bladeCount / 2) * 0.2 + (Math.random() - 0.5) * 0.3;
                const bladeLen = 6 + Math.random() * 8;
                const bendDir = (Math.random() - 0.5) * 0.4;

                ctx.beginPath();
                ctx.moveTo(tuftX + (b - bladeCount / 2) * 0.5, tuftY);
                ctx.quadraticCurveTo(
                    tuftX + Math.cos(bladeAngle) * bladeLen * 0.5 + bendDir * bladeLen,
                    tuftY + Math.sin(bladeAngle) * bladeLen * 0.5,
                    tuftX + Math.cos(bladeAngle + bendDir) * bladeLen,
                    tuftY + Math.sin(bladeAngle + bendDir) * bladeLen
                );
                ctx.stroke();
            }
        }

        // Fine sand texture dots
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#000000';
        for (let i = 0; i < 60; i++) {
            const x = cx + (noise.noise2D(i * 2, variant * 1.5) - 0.5) * radius * 1.6;
            const y = cy + (noise.noise2D(variant * 1.5, i * 2) - 0.5) * radius * 1.4;
            ctx.beginPath();
            ctx.arc(x, y, 0.3 + Math.random() * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render murky swamp with dead plants, roots, algae, and organic debris
     */
    renderMurkyDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        // Dark murky water patches
        ctx.globalAlpha = 0.35;
        const patchCount = Math.floor(radius * 0.12);
        for (let i = 0; i < patchCount; i++) {
            const angle = noise.noise2D(i * 4, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.75;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const patchSize = 15 + Math.abs(microNoise.noise2D(x, y)) * 25;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, patchSize);
            gradient.addColorStop(0, 'rgba(25, 35, 15, 0.6)');
            gradient.addColorStop(0.6, 'rgba(30, 40, 20, 0.3)');
            gradient.addColorStop(1, 'rgba(30, 40, 20, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, patchSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Exposed roots/branches in the water
        ctx.globalAlpha = 0.45;
        const rootColors = ['#3a3025', '#4a4035', '#2a2015', '#5a5045'];
        for (let i = 0; i < 6; i++) {
            const startX = cx + (noise.noise2D(i * 8, variant * 3) - 0.5) * radius * 1.2;
            const startY = cy + (noise.noise2D(variant * 3, i * 8) - 0.5) * radius;

            ctx.strokeStyle = rootColors[i % rootColors.length];
            ctx.lineWidth = 1.5 + Math.random() * 2;
            ctx.lineCap = 'round';

            // Main root
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            let curX = startX, curY = startY;
            const segments = 3 + Math.floor(Math.random() * 3);
            for (let s = 0; s < segments; s++) {
                const angle = noise.noise2D(curX * 0.1, curY * 0.1) * Math.PI * 0.6;
                const len = 8 + Math.random() * 12;
                curX += Math.cos(angle) * len;
                curY += Math.sin(angle) * len;
                ctx.lineTo(curX, curY);
            }
            ctx.stroke();

            // Small root offshoots
            ctx.lineWidth = 0.8;
            const offshootCount = 2 + Math.floor(Math.random() * 3);
            for (let j = 0; j < offshootCount; j++) {
                const t = 0.3 + Math.random() * 0.5;
                const offX = startX + (curX - startX) * t;
                const offY = startY + (curY - startY) * t;
                const offAngle = Math.random() * Math.PI * 2;
                const offLen = 4 + Math.random() * 6;

                ctx.beginPath();
                ctx.moveTo(offX, offY);
                ctx.lineTo(offX + Math.cos(offAngle) * offLen, offY + Math.sin(offAngle) * offLen);
                ctx.stroke();
            }
        }

        // Floating algae mats
        ctx.globalAlpha = 0.4;
        const algaeColors = ['#3a5a30', '#4a6a40', '#2a4a20', '#5a7a50'];
        for (let i = 0; i < 15; i++) {
            const angle = microNoise.noise2D(i * 2, variant) * Math.PI * 2;
            const dist = Math.abs(microNoise.noise2D(i, variant)) * radius * 0.85;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const size = 3 + Math.abs(noise.noise2D(x * 0.1, y * 0.1)) * 8;

            ctx.fillStyle = algaeColors[i % algaeColors.length];
            ctx.beginPath();
            // Irregular blob shape
            for (let p = 0; p < 8; p++) {
                const pa = (p / 8) * Math.PI * 2;
                const pr = size * (0.6 + microNoise.noise2D(x + p, y + p) * 0.5);
                const px = x + Math.cos(pa) * pr;
                const py = y + Math.sin(pa) * pr;
                if (p === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Dead reeds/cattails
        ctx.globalAlpha = 0.45;
        const reedCount = 8 + Math.floor(Math.abs(noise.noise2D(variant * 4, 0)) * 6);
        for (let i = 0; i < reedCount; i++) {
            const baseX = cx + (detailNoise.noise2D(i * 3, variant * 5) - 0.5) * radius * 1.3;
            const baseY = cy + (detailNoise.noise2D(variant * 5, i * 3) - 0.5) * radius * 1.1;

            // Reed stalk
            ctx.strokeStyle = '#5a5040';
            ctx.lineWidth = 1;
            const height = 10 + Math.random() * 15;
            const bend = (Math.random() - 0.5) * 0.3;

            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.quadraticCurveTo(
                baseX + bend * height,
                baseY - height * 0.6,
                baseX + bend * height * 1.5,
                baseY - height
            );
            ctx.stroke();

            // Cattail head (on some)
            if (Math.random() > 0.4) {
                const headX = baseX + bend * height * 1.5;
                const headY = baseY - height;
                ctx.fillStyle = '#4a3a28';
                ctx.beginPath();
                ctx.ellipse(headX, headY + 2, 1.5, 4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Lily pads
        ctx.globalAlpha = 0.5;
        const lilyCount = 4 + Math.floor(Math.abs(noise.noise2D(variant * 5, 0)) * 4);
        for (let i = 0; i < lilyCount; i++) {
            const x = cx + (noise.noise2D(i * 9, variant * 6) - 0.5) * radius * 1.1;
            const y = cy + (noise.noise2D(variant * 6, i * 9) - 0.5) * radius * 0.9;
            const size = 4 + Math.random() * 5;
            const rotation = Math.random() * Math.PI * 2;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            // Lily pad (circle with wedge cut out)
            ctx.fillStyle = '#4a6a45';
            ctx.beginPath();
            ctx.arc(0, 0, size, 0.2, Math.PI * 2 - 0.2);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();

            // Veins
            ctx.strokeStyle = '#3a5a35';
            ctx.lineWidth = 0.3;
            for (let v = 0; v < 5; v++) {
                const va = 0.3 + (v / 5) * Math.PI * 1.7;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(va) * size * 0.8, Math.sin(va) * size * 0.8);
                ctx.stroke();
            }

            ctx.restore();
        }

        // Bubbles from decomposition
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < 12; i++) {
            const x = cx + (noise.noise2D(i * 7, variant) - 0.5) * radius * 1.3;
            const y = cy + (noise.noise2D(variant, i * 7) - 0.5) * radius * 1.1;
            const size = 1 + Math.random() * 2.5;

            ctx.fillStyle = 'rgba(100, 120, 80, 0.4)';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Bubble highlight
            ctx.fillStyle = 'rgba(150, 170, 130, 0.3)';
            ctx.beginPath();
            ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Floating debris/leaves
        ctx.globalAlpha = 0.35;
        const debrisColors = ['#4a4030', '#5a5040', '#3a3020', '#6a5a48'];
        for (let i = 0; i < 10; i++) {
            const x = cx + (microNoise.noise2D(i * 6, variant * 7) - 0.5) * radius * 1.4;
            const y = cy + (microNoise.noise2D(variant * 7, i * 6) - 0.5) * radius * 1.2;
            const size = 1.5 + Math.random() * 2.5;
            const rotation = Math.random() * Math.PI * 2;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.fillStyle = debrisColors[i % debrisColors.length];
            ctx.beginPath();
            ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Fine texture
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#000000';
        for (let i = 0; i < 70; i++) {
            const x = cx + (noise.noise2D(i * 2.2, variant * 1.8) - 0.5) * radius * 1.6;
            const y = cy + (noise.noise2D(variant * 1.8, i * 2.2) - 0.5) * radius * 1.4;
            ctx.beginPath();
            ctx.arc(x, y, 0.3 + Math.random() * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render road details
     */
    renderRoadDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Wheel tracks
        ctx.strokeStyle = terrain.darkColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.2;

        for (let track = -1; track <= 1; track += 2) {
            const trackOffset = track * radius * 0.25;
            ctx.beginPath();
            for (let x = cx - radius; x <= cx + radius; x += 4) {
                const y = cy + trackOffset + noise.noise2D(x * 0.05, variant + track) * 3;
                if (x === cx - radius) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Scattered pebbles
        ctx.fillStyle = terrain.darkColor;
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 20; i++) {
            const x = cx + (noise.noise2D(i * 3, variant) - 0.5) * radius * 1.5;
            const y = cy + (noise.noise2D(variant, i * 3) - 0.5) * radius * 1.2;
            ctx.beginPath();
            ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    /**
     * Render path details
     */
    renderPathDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Footprints/worn areas
        ctx.fillStyle = terrain.darkColor;
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < 8; i++) {
            const x = cx + (noise.noise2D(i * 4, variant) - 0.5) * radius * 1.2;
            const y = cy + (noise.noise2D(variant, i * 4) - 0.5) * radius * 0.8;
            ctx.beginPath();
            ctx.ellipse(x, y, 3 + Math.random() * 4, 2 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Edge grass
        ctx.strokeStyle = '#5a8a48';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 15; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const x = cx + (noise.noise2D(i * 2, variant) - 0.5) * radius * 1.4;
            const baseY = cy + side * radius * 0.5 + (noise.noise2D(variant, i * 2) - 0.5) * radius * 0.3;
            ctx.beginPath();
            ctx.moveTo(x, baseY);
            ctx.lineTo(x + (Math.random() - 0.5) * 3, baseY - 3 - Math.random() * 4);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    },

    /**
     * Render snow details
     */
    renderSnowDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Snow sparkles
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 40; i++) {
            const x = cx + (noise.noise2D(i * 3, variant) - 0.5) * radius * 1.6;
            const y = cy + (noise.noise2D(variant, i * 3) - 0.5) * radius * 1.4;
            ctx.beginPath();
            ctx.arc(x, y, 0.5 + Math.random() * 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Subtle drifts
        ctx.fillStyle = terrain.darkColor;
        ctx.globalAlpha = 0.08;
        for (let i = 0; i < 4; i++) {
            const x = cx + (noise.noise2D(i * 5, variant) - 0.5) * radius;
            const y = cy + (noise.noise2D(variant, i * 5) - 0.5) * radius;
            ctx.beginPath();
            ctx.ellipse(x, y, 15 + Math.random() * 20, 8 + Math.random() * 10, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    /**
     * Render tallgrass details
     */
    renderTallgrassDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        const darkRGB = this.hexToRgb(terrain.darkColor);
        const lightRGB = this.hexToRgb(terrain.accentColor);

        // Tall grass blades
        const bladeCount = Math.floor(radius * 2.5);
        for (let i = 0; i < bladeCount; i++) {
            const angle = detailNoise.noise2D(i * 0.1, variant) * Math.PI * 2;
            const dist = Math.abs(detailNoise.noise2D(variant, i * 0.1)) * radius * 0.9;
            const baseX = cx + Math.cos(angle) * dist;
            const baseY = cy + Math.sin(angle) * dist;

            const bladeHeight = 8 + microNoise.noise2D(baseX * 0.1, baseY * 0.1) * 12;
            const bend = microNoise.noise2D(baseX * 0.05, baseY * 0.05) * 0.6;

            const gradient = ctx.createLinearGradient(baseX, baseY, baseX + bend * bladeHeight, baseY - bladeHeight);
            gradient.addColorStop(0, `rgba(${darkRGB.r}, ${darkRGB.g}, ${darkRGB.b}, 0.6)`);
            gradient.addColorStop(1, `rgba(${lightRGB.r}, ${lightRGB.g}, ${lightRGB.b}, 0.4)`);

            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.quadraticCurveTo(
                baseX + bend * bladeHeight * 0.5,
                baseY - bladeHeight * 0.6,
                baseX + bend * bladeHeight,
                baseY - bladeHeight
            );
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        // Lush tall grass clumps with varied scale/mirroring
        const clumpCount = 6 + Math.floor(Math.abs(noise.noise2D(variant * 4, 0)) * 5);
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < clumpCount; i++) {
            const x = cx + (detailNoise.noise2D(i * 3, variant * 4) - 0.5) * radius * 1.1;
            const y = cy + (detailNoise.noise2D(variant * 4, i * 3) - 0.5) * radius * 0.9;
            const scale = 0.7 + Math.abs(microNoise.noise2D(x * 0.1, y * 0.1)) * 0.9;
            const rotation = microNoise.noise2D(x * 0.06, y * 0.06) * 0.6;
            const mirrorX = microNoise.noise2D(x * 0.08, y * 0.08) > 0;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.scale((mirrorX ? -1 : 1) * scale, scale);

            const blades = 7 + Math.floor(Math.random() * 5);
            for (let b = 0; b < blades; b++) {
                const bladeAngle = -Math.PI / 2 + (b - blades / 2) * 0.12;
                const bladeHeight = 10 + Math.random() * 10;
                const bend = (Math.random() - 0.5) * 0.4;
                const gradient = ctx.createLinearGradient(0, 0, bend * bladeHeight, -bladeHeight);
                gradient.addColorStop(0, `rgba(${darkRGB.r}, ${darkRGB.g}, ${darkRGB.b}, 0.6)`);
                gradient.addColorStop(1, `rgba(${lightRGB.r}, ${lightRGB.g}, ${lightRGB.b}, 0.45)`);

                ctx.beginPath();
                ctx.moveTo((b - blades / 2) * 0.6, 0);
                ctx.quadraticCurveTo(
                    bend * bladeHeight * 0.4,
                    -bladeHeight * 0.5,
                    bend * bladeHeight,
                    -bladeHeight
                );
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            ctx.restore();
        }
        ctx.globalAlpha = 1;
    },

    /**
     * Render mud details
     */
    renderMudDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Wet patches
        ctx.fillStyle = terrain.darkColor;
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 6; i++) {
            const x = cx + (noise.noise2D(i * 4, variant) - 0.5) * radius * 1.2;
            const y = cy + (noise.noise2D(variant, i * 4) - 0.5) * radius * 1.0;
            const patchSize = 8 + Math.random() * 15;
            ctx.beginPath();
            ctx.ellipse(x, y, patchSize, patchSize * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Footprint impressions
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 4; i++) {
            const x = cx + (noise.noise2D(i * 6, variant) - 0.5) * radius;
            const y = cy + (noise.noise2D(variant, i * 6) - 0.5) * radius * 0.8;
            ctx.beginPath();
            ctx.ellipse(x, y, 2 + Math.random() * 2, 3 + Math.random() * 3, Math.random() * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    // ============================================
    // DIRECTIONAL STREAM TILES
    // ============================================

    /**
     * Get hex edge center points for a flat-top hex
     * Edges: E=0, NE=1, NW=2, W=3, SW=4, SE=5
     */
    getHexEdgeCenter(cx, cy, radius, edgeIndex) {
        const angle1 = (Math.PI / 3) * edgeIndex;
        const angle2 = (Math.PI / 3) * ((edgeIndex + 1) % 6);
        return {
            x: cx + radius * (Math.cos(angle1) + Math.cos(angle2)) / 2,
            y: cy + radius * (Math.sin(angle1) + Math.sin(angle2)) / 2
        };
    },

    getEdgeIndex(dir) {
        const edges = { e: 0, ne: 1, nw: 2, w: 3, sw: 4, se: 5 };
        return edges[dir] ?? 0;
    },

    /**
     * Render straight stream connecting opposite edges
     */
    renderStreamStraight(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        const dir = terrain.direction || 'ew';
        let edge1, edge2;

        if (dir === 'ew') { edge1 = 0; edge2 = 3; }
        else if (dir === 'nesw') { edge1 = 1; edge2 = 4; }
        else if (dir === 'nwse') { edge1 = 2; edge2 = 5; }

        const start = this.getHexEdgeCenter(cx, cy, radius, edge1);
        const end = this.getHexEdgeCenter(cx, cy, radius, edge2);

        this.drawStreamChannel(ctx, noise, microNoise, start, end, cx, cy, radius, terrain, variant);
        this.addBankDetails(ctx, noise, detailNoise, microNoise, start, end, cx, cy, radius, terrain, variant);
    },

    /**
     * Render curved stream connecting adjacent edges
     */
    renderStreamCurve(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        const dir = terrain.direction || 'e_ne';
        const parts = dir.split('_');
        const edge1 = this.getEdgeIndex(parts[0]);
        const edge2 = this.getEdgeIndex(parts[1]);

        const start = this.getHexEdgeCenter(cx, cy, radius, edge1);
        const end = this.getHexEdgeCenter(cx, cy, radius, edge2);

        this.drawStreamChannelCurved(ctx, noise, microNoise, start, end, cx, cy, radius, terrain, variant);
        this.addBankDetailsCurved(ctx, noise, detailNoise, microNoise, start, end, cx, cy, radius, terrain, variant);
    },

    drawStreamChannel(ctx, noise, microNoise, start, end, cx, cy, radius, terrain, variant) {
        const waterColor = terrain.waterColor || '#5a9aaa';
        const waterLight = terrain.waterLight || '#7abaca';
        const bankColor = terrain.bankColor || '#8a7a60';

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;

        const streamWidth = radius * 0.32;
        const bankWidth = streamWidth * 1.4;
        const steps = 12;

        // Bank
        ctx.fillStyle = bankColor;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const wobble = microNoise.noise2D(t * 3 + variant, 0) * 6;
            if (i === 0) ctx.moveTo(x + nx * (bankWidth + wobble), y + ny * (bankWidth + wobble));
            else ctx.lineTo(x + nx * (bankWidth + wobble), y + ny * (bankWidth + wobble));
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const wobble = microNoise.noise2D(t * 3 + variant, 0) * 6;
            ctx.lineTo(x - nx * (bankWidth + wobble), y - ny * (bankWidth + wobble));
        }
        ctx.closePath();
        ctx.fill();

        // Water
        ctx.fillStyle = waterColor;
        ctx.globalAlpha = 1;
        ctx.beginPath();

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const wobble = microNoise.noise2D(t * 4 + variant, 1) * 4;
            if (i === 0) ctx.moveTo(x + nx * (streamWidth + wobble), y + ny * (streamWidth + wobble));
            else ctx.lineTo(x + nx * (streamWidth + wobble), y + ny * (streamWidth + wobble));
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const wobble = microNoise.noise2D(t * 4 + variant, 1) * 4;
            ctx.lineTo(x - nx * (streamWidth + wobble), y - ny * (streamWidth + wobble));
        }
        ctx.closePath();
        ctx.fill();

        // Flow lines
        ctx.strokeStyle = waterLight;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.35;
        ctx.lineCap = 'round';

        for (let l = 0; l < 3; l++) {
            const offset = (l - 1) * streamWidth * 0.45;
            ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = start.x + dx * t + nx * (offset + noise.noise2D(t * 5 + l, l) * 3);
                const y = start.y + dy * t + ny * (offset + noise.noise2D(t * 5 + l, l) * 3);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Pebbles
        ctx.globalAlpha = 0.45;
        for (let i = 0; i < 8; i++) {
            const t = 0.15 + noise.noise2D(i * 2, variant) * 0.7;
            const offset = (noise.noise2D(i * 3, variant) - 0.5) * streamWidth * 0.5;
            const x = start.x + dx * t + nx * offset;
            const y = start.y + dy * t + ny * offset;
            ctx.fillStyle = ['#7a6a5a', '#8a7a6a', '#6a5a4a'][i % 3];
            ctx.beginPath();
            ctx.ellipse(x, y, 1.5 + Math.random() * 2, 1 + Math.random(), Math.atan2(dy, dx), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    drawStreamChannelCurved(ctx, noise, microNoise, start, end, cx, cy, radius, terrain, variant) {
        const waterColor = terrain.waterColor || '#5a9aaa';
        const waterLight = terrain.waterLight || '#7abaca';
        const bankColor = terrain.bankColor || '#8a7a60';

        const streamWidth = radius * 0.28;
        const bankWidth = streamWidth * 1.4;
        const steps = 14;

        const getCurve = (t) => {
            const mt = 1 - t;
            return {
                x: mt * mt * start.x + 2 * mt * t * cx + t * t * end.x,
                y: mt * mt * start.y + 2 * mt * t * cy + t * t * end.y
            };
        };

        const getNormal = (t) => {
            const mt = 1 - t;
            const dx = 2 * mt * (cx - start.x) + 2 * t * (end.x - cx);
            const dy = 2 * mt * (cy - start.y) + 2 * t * (end.y - cy);
            const len = Math.sqrt(dx * dx + dy * dy);
            return { x: -dy / len, y: dx / len };
        };

        // Bank
        ctx.fillStyle = bankColor;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pt = getCurve(t);
            const n = getNormal(t);
            const w = microNoise.noise2D(t * 3 + variant, 0) * 5;
            if (i === 0) ctx.moveTo(pt.x + n.x * (bankWidth + w), pt.y + n.y * (bankWidth + w));
            else ctx.lineTo(pt.x + n.x * (bankWidth + w), pt.y + n.y * (bankWidth + w));
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const pt = getCurve(t);
            const n = getNormal(t);
            const w = microNoise.noise2D(t * 3 + variant, 0) * 5;
            ctx.lineTo(pt.x - n.x * (bankWidth + w), pt.y - n.y * (bankWidth + w));
        }
        ctx.closePath();
        ctx.fill();

        // Water
        ctx.fillStyle = waterColor;
        ctx.globalAlpha = 1;
        ctx.beginPath();

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pt = getCurve(t);
            const n = getNormal(t);
            const w = microNoise.noise2D(t * 4 + variant, 1) * 3;
            if (i === 0) ctx.moveTo(pt.x + n.x * (streamWidth + w), pt.y + n.y * (streamWidth + w));
            else ctx.lineTo(pt.x + n.x * (streamWidth + w), pt.y + n.y * (streamWidth + w));
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const pt = getCurve(t);
            const n = getNormal(t);
            const w = microNoise.noise2D(t * 4 + variant, 1) * 3;
            ctx.lineTo(pt.x - n.x * (streamWidth + w), pt.y - n.y * (streamWidth + w));
        }
        ctx.closePath();
        ctx.fill();

        // Flow lines
        ctx.strokeStyle = waterLight;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.35;
        for (let l = 0; l < 2; l++) {
            const offset = (l - 0.5) * streamWidth * 0.5;
            ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const pt = getCurve(t);
                const n = getNormal(t);
                const x = pt.x + n.x * (offset + noise.noise2D(t * 4 + l, l) * 2);
                const y = pt.y + n.y * (offset + noise.noise2D(t * 4 + l, l) * 2);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    },

    addBankDetails(ctx, noise, detailNoise, microNoise, start, end, cx, cy, radius, terrain, variant) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;
        const bankOffset = radius * 0.5;

        // Grass on banks
        ctx.globalAlpha = 0.55;
        const grassColors = ['#4a7a38', '#5a8a48', '#4a8a40'];

        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < 12; i++) {
                const t = 0.1 + (i / 12) * 0.8;
                const offset = bankOffset + Math.abs(noise.noise2D(i, variant)) * radius * 0.2;
                const x = start.x + dx * t + nx * offset * side;
                const y = start.y + dy * t + ny * offset * side;

                if (!this.isPointInHex(x, y, cx, cy, radius * 0.92)) continue;

                ctx.strokeStyle = grassColors[i % 3];
                ctx.lineWidth = 0.6;
                for (let b = 0; b < 3; b++) {
                    const angle = -Math.PI / 2 + (b - 1) * 0.3;
                    const h = 4 + Math.random() * 5;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.quadraticCurveTo(x + Math.cos(angle) * h * 0.4, y - h * 0.5, x + Math.cos(angle) * h, y - h);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
    },

    addBankDetailsCurved(ctx, noise, detailNoise, microNoise, start, end, cx, cy, radius, terrain, variant) {
        const streamWidth = radius * 0.28;
        const bankOffset = streamWidth * 1.8;
        const steps = 10;

        const getCurve = (t) => {
            const mt = 1 - t;
            return {
                x: mt * mt * start.x + 2 * mt * t * cx + t * t * end.x,
                y: mt * mt * start.y + 2 * mt * t * cy + t * t * end.y
            };
        };

        const getNormal = (t) => {
            const mt = 1 - t;
            const dx = 2 * mt * (cx - start.x) + 2 * t * (end.x - cx);
            const dy = 2 * mt * (cy - start.y) + 2 * t * (end.y - cy);
            const len = Math.sqrt(dx * dx + dy * dy);
            return { x: -dy / len, y: dx / len };
        };

        ctx.globalAlpha = 0.55;
        const grassColors = ['#4a7a38', '#5a8a48', '#4a8a40'];

        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < steps; i++) {
                const t = 0.1 + (i / steps) * 0.8;
                const pt = getCurve(t);
                const n = getNormal(t);
                const offset = bankOffset + Math.abs(noise.noise2D(i, variant)) * radius * 0.15;
                const x = pt.x + n.x * offset * side;
                const y = pt.y + n.y * offset * side;

                if (!this.isPointInHex(x, y, cx, cy, radius * 0.92)) continue;

                ctx.strokeStyle = grassColors[i % 3];
                ctx.lineWidth = 0.6;
                for (let b = 0; b < 2; b++) {
                    const angle = -Math.PI / 2 + (b - 0.5) * 0.4;
                    const h = 3 + Math.random() * 4;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + Math.cos(angle) * h, y - h);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
    },

    // ============================================
    // DIRECTIONAL PATH TILES
    // ============================================

    /**
     * Render straight path connecting opposite edges
     */
    renderPathStraight(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        const dir = terrain.direction || 'ew';
        let edge1, edge2;

        if (dir === 'ew') { edge1 = 0; edge2 = 3; }
        else if (dir === 'nesw') { edge1 = 1; edge2 = 4; }
        else if (dir === 'nwse') { edge1 = 2; edge2 = 5; }

        const start = this.getHexEdgeCenter(cx, cy, radius, edge1);
        const end = this.getHexEdgeCenter(cx, cy, radius, edge2);

        this.drawPathChannel(ctx, noise, microNoise, start, end, cx, cy, radius, terrain, variant);
        this.addPathEdgeDetails(ctx, noise, detailNoise, microNoise, start, end, cx, cy, radius, terrain, variant);
    },

    /**
     * Render curved path connecting adjacent edges
     */
    renderPathCurve(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        const dir = terrain.direction || 'e_ne';
        const parts = dir.split('_');
        const edge1 = this.getEdgeIndex(parts[0]);
        const edge2 = this.getEdgeIndex(parts[1]);

        const start = this.getHexEdgeCenter(cx, cy, radius, edge1);
        const end = this.getHexEdgeCenter(cx, cy, radius, edge2);

        this.drawPathChannelCurved(ctx, noise, microNoise, start, end, cx, cy, radius, terrain, variant);
        this.addPathEdgeDetailsCurved(ctx, noise, detailNoise, microNoise, start, end, cx, cy, radius, terrain, variant);
    },

    drawPathChannel(ctx, noise, microNoise, start, end, cx, cy, radius, terrain, variant) {
        const pathColor = terrain.pathColor || '#8a7a60';
        const pathLight = terrain.pathLight || '#9a8a70';
        const pathDark = terrain.pathDark || '#6a5a48';

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;

        const pathWidth = radius * 0.38;
        const steps = 14;

        // Path base with worn texture
        ctx.fillStyle = pathColor;
        ctx.globalAlpha = 1;
        ctx.beginPath();

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const wobble = microNoise.noise2D(t * 3 + variant, 0) * 5;
            if (i === 0) ctx.moveTo(x + nx * (pathWidth + wobble), y + ny * (pathWidth + wobble));
            else ctx.lineTo(x + nx * (pathWidth + wobble), y + ny * (pathWidth + wobble));
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const wobble = microNoise.noise2D(t * 3 + variant, 0) * 5;
            ctx.lineTo(x - nx * (pathWidth + wobble), y - ny * (pathWidth + wobble));
        }
        ctx.closePath();
        ctx.fill();

        // Worn center track (darker)
        ctx.fillStyle = pathDark;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();

        const trackWidth = pathWidth * 0.5;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const wobble = microNoise.noise2D(t * 4 + variant, 1) * 3;
            if (i === 0) ctx.moveTo(x + nx * (trackWidth + wobble), y + ny * (trackWidth + wobble));
            else ctx.lineTo(x + nx * (trackWidth + wobble), y + ny * (trackWidth + wobble));
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const wobble = microNoise.noise2D(t * 4 + variant, 1) * 3;
            ctx.lineTo(x - nx * (trackWidth + wobble), y - ny * (trackWidth + wobble));
        }
        ctx.closePath();
        ctx.fill();

        // Footprints/impressions
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = pathDark;
        for (let i = 0; i < 8; i++) {
            const t = 0.1 + (noise.noise2D(i * 2, variant) * 0.8);
            const offset = (noise.noise2D(i * 3, variant) - 0.5) * pathWidth * 0.6;
            const x = start.x + dx * t + nx * offset;
            const y = start.y + dy * t + ny * offset;
            ctx.beginPath();
            ctx.ellipse(x, y, 2 + Math.random() * 2, 1.5 + Math.random(), Math.atan2(dy, dx) + Math.random() * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Pebbles on path
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < 12; i++) {
            const t = 0.1 + noise.noise2D(i * 2.5, variant * 2) * 0.8;
            const offset = (noise.noise2D(i * 3.5, variant) - 0.5) * pathWidth * 0.8;
            const x = start.x + dx * t + nx * offset;
            const y = start.y + dy * t + ny * offset;
            ctx.fillStyle = ['#7a7068', '#8a8078', '#6a6058'][i % 3];
            ctx.beginPath();
            ctx.arc(x, y, 1 + Math.random() * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    drawPathChannelCurved(ctx, noise, microNoise, start, end, cx, cy, radius, terrain, variant) {
        const pathColor = terrain.pathColor || '#8a7a60';
        const pathDark = terrain.pathDark || '#6a5a48';

        const pathWidth = radius * 0.32;
        const steps = 16;

        const getCurve = (t) => {
            const mt = 1 - t;
            return {
                x: mt * mt * start.x + 2 * mt * t * cx + t * t * end.x,
                y: mt * mt * start.y + 2 * mt * t * cy + t * t * end.y
            };
        };

        const getNormal = (t) => {
            const mt = 1 - t;
            const dx = 2 * mt * (cx - start.x) + 2 * t * (end.x - cx);
            const dy = 2 * mt * (cy - start.y) + 2 * t * (end.y - cy);
            const len = Math.sqrt(dx * dx + dy * dy);
            return { x: -dy / len, y: dx / len };
        };

        // Path base
        ctx.fillStyle = pathColor;
        ctx.globalAlpha = 1;
        ctx.beginPath();

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pt = getCurve(t);
            const n = getNormal(t);
            const w = microNoise.noise2D(t * 3 + variant, 0) * 4;
            if (i === 0) ctx.moveTo(pt.x + n.x * (pathWidth + w), pt.y + n.y * (pathWidth + w));
            else ctx.lineTo(pt.x + n.x * (pathWidth + w), pt.y + n.y * (pathWidth + w));
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const pt = getCurve(t);
            const n = getNormal(t);
            const w = microNoise.noise2D(t * 3 + variant, 0) * 4;
            ctx.lineTo(pt.x - n.x * (pathWidth + w), pt.y - n.y * (pathWidth + w));
        }
        ctx.closePath();
        ctx.fill();

        // Worn track
        ctx.fillStyle = pathDark;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();

        const trackWidth = pathWidth * 0.45;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pt = getCurve(t);
            const n = getNormal(t);
            const w = microNoise.noise2D(t * 4 + variant, 1) * 2;
            if (i === 0) ctx.moveTo(pt.x + n.x * (trackWidth + w), pt.y + n.y * (trackWidth + w));
            else ctx.lineTo(pt.x + n.x * (trackWidth + w), pt.y + n.y * (trackWidth + w));
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const pt = getCurve(t);
            const n = getNormal(t);
            const w = microNoise.noise2D(t * 4 + variant, 1) * 2;
            ctx.lineTo(pt.x - n.x * (trackWidth + w), pt.y - n.y * (trackWidth + w));
        }
        ctx.closePath();
        ctx.fill();

        // Pebbles
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 8; i++) {
            const t = 0.15 + noise.noise2D(i * 2, variant) * 0.7;
            const pt = getCurve(t);
            const n = getNormal(t);
            const offset = (noise.noise2D(i * 3, variant) - 0.5) * pathWidth * 0.6;
            const x = pt.x + n.x * offset;
            const y = pt.y + n.y * offset;
            ctx.fillStyle = ['#7a7068', '#8a8078'][i % 2];
            ctx.beginPath();
            ctx.arc(x, y, 1 + Math.random(), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    addPathEdgeDetails(ctx, noise, detailNoise, microNoise, start, end, cx, cy, radius, terrain, variant) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;
        const edgeOffset = radius * 0.45;

        // Grass along path edges
        ctx.globalAlpha = 0.5;
        const grassColors = ['#4a7a38', '#5a8a48', '#4a8a40'];

        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < 15; i++) {
                const t = 0.05 + (i / 15) * 0.9;
                const offset = edgeOffset + Math.abs(noise.noise2D(i, variant)) * radius * 0.15;
                const x = start.x + dx * t + nx * offset * side;
                const y = start.y + dy * t + ny * offset * side;

                if (!this.isPointInHex(x, y, cx, cy, radius * 0.92)) continue;

                ctx.strokeStyle = grassColors[i % 3];
                ctx.lineWidth = 0.5;
                for (let b = 0; b < 2; b++) {
                    const angle = -Math.PI / 2 + (b - 0.5) * 0.3 + side * 0.2;
                    const h = 3 + Math.random() * 4;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + Math.cos(angle) * h, y - h);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
    },

    addPathEdgeDetailsCurved(ctx, noise, detailNoise, microNoise, start, end, cx, cy, radius, terrain, variant) {
        const pathWidth = radius * 0.32;
        const edgeOffset = pathWidth * 1.5;
        const steps = 12;

        const getCurve = (t) => {
            const mt = 1 - t;
            return {
                x: mt * mt * start.x + 2 * mt * t * cx + t * t * end.x,
                y: mt * mt * start.y + 2 * mt * t * cy + t * t * end.y
            };
        };

        const getNormal = (t) => {
            const mt = 1 - t;
            const dx = 2 * mt * (cx - start.x) + 2 * t * (end.x - cx);
            const dy = 2 * mt * (cy - start.y) + 2 * t * (end.y - cy);
            const len = Math.sqrt(dx * dx + dy * dy);
            return { x: -dy / len, y: dx / len };
        };

        ctx.globalAlpha = 0.5;
        const grassColors = ['#4a7a38', '#5a8a48', '#4a8a40'];

        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < steps; i++) {
                const t = 0.1 + (i / steps) * 0.8;
                const pt = getCurve(t);
                const n = getNormal(t);
                const offset = edgeOffset + Math.abs(noise.noise2D(i, variant)) * radius * 0.1;
                const x = pt.x + n.x * offset * side;
                const y = pt.y + n.y * offset * side;

                if (!this.isPointInHex(x, y, cx, cy, radius * 0.92)) continue;

                ctx.strokeStyle = grassColors[i % 3];
                ctx.lineWidth = 0.5;
                for (let b = 0; b < 2; b++) {
                    const angle = -Math.PI / 2 + (b - 0.5) * 0.3;
                    const h = 3 + Math.random() * 3;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + Math.cos(angle) * h, y - h);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
    },

    getTypes() {
        return Object.keys(this.types);
    }
};

window.TerrainGenerator = TerrainGenerator;
