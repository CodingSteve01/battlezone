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
    types: {
        grass: {
            baseColor: '#5a8a48',
            lightColor: '#6d9a58',
            darkColor: '#4a7a38',
            midColor: '#558842',
            accentColor: '#7aaa68',
            detailType: 'grass',
            noiseScale: 0.025
        },
        forest: {
            baseColor: '#3d6a4a',
            lightColor: '#4d7a58',
            darkColor: '#2a5038',
            midColor: '#3a6045',
            accentColor: '#5a8a5a',
            detailType: 'forest_floor',
            noiseScale: 0.03
        },
        hills: {
            baseColor: '#7a8c5a',
            lightColor: '#8a9c68',
            darkColor: '#5a7040',
            midColor: '#6a8050',
            accentColor: '#9aac78',
            detailType: 'rocky_grass',
            noiseScale: 0.02
        },
        rock: {
            baseColor: '#6a6868',
            lightColor: '#7a7878',
            darkColor: '#4a4848',
            midColor: '#5a5858',
            accentColor: '#8a8888',
            detailType: 'stone',
            noiseScale: 0.04
        },
        water: {
            // Shallow brook colors - lighter, more transparent look with visible sandy bottom
            baseColor: '#5a9aaa',
            lightColor: '#7abaca',
            darkColor: '#4a8a9a',
            midColor: '#6aaaaa',
            accentColor: '#8acada',
            bottomColor: '#c4b088',  // Sandy bottom color
            pebbleColors: ['#8a7868', '#9a8a78', '#7a6858', '#aa9a88'],
            detailType: 'shallow_water',
            noiseScale: 0.015
        },
        sand: {
            baseColor: '#c4a868',
            lightColor: '#d4b878',
            darkColor: '#b49858',
            midColor: '#baa060',
            accentColor: '#e4c888',
            detailType: 'sand',
            noiseScale: 0.02
        },
        swamp: {
            baseColor: '#4a5a35',
            lightColor: '#5a6a45',
            darkColor: '#3a4a28',
            midColor: '#455530',
            accentColor: '#6a7a55',
            detailType: 'murky',
            noiseScale: 0.025
        },
        river: {
            baseColor: '#2a6078',
            lightColor: '#4a8098',
            darkColor: '#1a4a60',
            midColor: '#2a5570',
            accentColor: '#5a90a8',
            detailType: 'flowing_water',
            noiseScale: 0.02
        },
        road: {
            baseColor: '#8a7a60',
            lightColor: '#9a8a70',
            darkColor: '#6a5a48',
            midColor: '#7a6a55',
            accentColor: '#aa9a80',
            detailType: 'road',
            noiseScale: 0.03
        },
        path: {
            baseColor: '#7a6850',
            lightColor: '#8a7860',
            darkColor: '#5a4838',
            midColor: '#6a5845',
            accentColor: '#9a8870',
            detailType: 'path',
            noiseScale: 0.025
        },
        snow: {
            baseColor: '#e8eef5',
            lightColor: '#f8fcff',
            darkColor: '#d0d8e0',
            midColor: '#e0e8f0',
            accentColor: '#ffffff',
            detailType: 'snow',
            noiseScale: 0.02
        },
        pine: {
            baseColor: '#2a4a35',
            lightColor: '#3a5a45',
            darkColor: '#1a3a25',
            midColor: '#254030',
            accentColor: '#4a6a55',
            detailType: 'forest_floor',
            noiseScale: 0.03
        },
        tallgrass: {
            baseColor: '#5a8a50',
            lightColor: '#6a9a60',
            darkColor: '#4a7a40',
            midColor: '#558545',
            accentColor: '#7aaa70',
            detailType: 'tallgrass',
            noiseScale: 0.02
        },
        mud: {
            baseColor: '#5a4838',
            lightColor: '#6a5848',
            darkColor: '#4a3828',
            midColor: '#554030',
            accentColor: '#7a6858',
            detailType: 'mud',
            noiseScale: 0.03
        },
        clearing: {
            baseColor: '#6a9a60',
            lightColor: '#7aaa70',
            darkColor: '#5a8a50',
            midColor: '#659558',
            accentColor: '#8aba80',
            detailType: 'grass',
            noiseScale: 0.02
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

    getTypes() {
        return Object.keys(this.types);
    }
};

window.TerrainGenerator = TerrainGenerator;
