/**
 * Hexagonal Terrain Generator
 * Creates proper pointy-top hexagonal terrain textures matching the game engine
 *
 * Game uses pointy-top hexagons where:
 * - Width (flat-to-flat) = sqrt(3) * radius
 * - Height (point-to-point) = 2 * radius
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
            baseColor: '#3a6a85',
            lightColor: '#4a7a98',
            darkColor: '#2a5a70',
            midColor: '#356580',
            accentColor: '#5a8aaa',
            detailType: 'water',
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
            baseColor: '#3a6c8a',
            lightColor: '#4a7c9a',
            darkColor: '#2a5c7a',
            midColor: '#356885',
            accentColor: '#5a8caa',
            detailType: 'flowing_water',
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

        // For pointy-top hex: height = 2*radius, width = sqrt(3)*radius
        // Center the hex in the canvas
        const centerX = width / 2;
        const centerY = height / 2;

        // Calculate hex radius from dimensions
        // Use the smaller of the two constraints
        const radiusFromWidth = width / Math.sqrt(3);
        const radiusFromHeight = height / 2;
        const radius = Math.min(radiusFromWidth, radiusFromHeight) * 0.95;

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
     * Create pointy-top hexagon path (matching game's renderer.js)
     * Angles: 0°, 60°, 120°, 180°, 240°, 300°
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

                const idx = (y * width + x) * 4;
                data[idx] = Math.round(r);
                data[idx + 1] = Math.round(g);
                data[idx + 2] = Math.round(b);
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
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
            case 'flowing_water':
                this.renderFlowingWater(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'sand':
                this.renderSandDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain);
                break;
            case 'murky':
                this.renderMurkyDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);
                break;
        }
    },

    /**
     * Render grass blade details
     */
    renderGrassDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        const darkRGB = this.hexToRgb(terrain.darkColor);
        const lightRGB = this.hexToRgb(terrain.accentColor);

        // Individual grass blades
        const bladeCount = Math.floor(radius * 1.5);

        for (let i = 0; i < bladeCount; i++) {
            const seed = variant * 10000 + i;
            const angle = detailNoise.noise2D(seed * 0.1, 0) * Math.PI * 2;
            const dist = Math.abs(detailNoise.noise2D(0, seed * 0.1)) * radius * 0.85;

            const baseX = cx + Math.cos(angle) * dist;
            const baseY = cy + Math.sin(angle) * dist;

            // Blade properties
            const bladeHeight = 3 + microNoise.noise2D(baseX * 0.1, baseY * 0.1) * 5;
            const bend = microNoise.noise2D(baseX * 0.05, baseY * 0.05) * 0.4;
            const thickness = 0.5 + Math.abs(microNoise.noise2D(i, 0)) * 0.5;

            // Gradient from dark base to light tip
            const gradient = ctx.createLinearGradient(baseX, baseY, baseX + bend * bladeHeight, baseY - bladeHeight);
            gradient.addColorStop(0, `rgba(${darkRGB.r}, ${darkRGB.g}, ${darkRGB.b}, 0.5)`);
            gradient.addColorStop(1, `rgba(${lightRGB.r}, ${lightRGB.g}, ${lightRGB.b}, 0.3)`);

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

        // Small dots for texture
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        for (let i = 0; i < 50; i++) {
            const x = cx + (noise.noise2D(i * 3, variant) - 0.5) * radius * 1.6;
            const y = cy + (noise.noise2D(variant, i * 3) - 0.5) * radius * 1.6;
            ctx.beginPath();
            ctx.arc(x, y, 0.5 + Math.random() * 1, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    /**
     * Render forest floor with leaf litter and twigs
     */
    renderForestFloor(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        // Fallen leaves
        const leafColors = ['#5a4a30', '#4a3a25', '#6a5a40', '#3d5a3a', '#4d6a4a', '#5a4020'];
        const leafCount = Math.floor(radius * 0.8);

        for (let i = 0; i < leafCount; i++) {
            const seed = variant * 10000 + i;
            const angle = detailNoise.noise2D(seed * 0.1, 0) * Math.PI * 2;
            const dist = Math.abs(detailNoise.noise2D(0, seed * 0.1)) * radius * 0.9;

            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const leafSize = 1.5 + Math.abs(microNoise.noise2D(x * 0.1, y * 0.1)) * 3;
            const rotation = microNoise.noise2D(x * 0.05, y * 0.05) * Math.PI;
            const colorIdx = Math.floor(Math.abs(noise.noise2D(x, y)) * leafColors.length);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.globalAlpha = 0.4 + Math.abs(microNoise.noise2D(i, 0)) * 0.3;

            // Leaf shape
            ctx.beginPath();
            ctx.ellipse(0, 0, leafSize, leafSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = leafColors[colorIdx % leafColors.length];
            ctx.fill();

            // Leaf vein
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(-leafSize * 0.7, 0);
            ctx.lineTo(leafSize * 0.7, 0);
            ctx.stroke();

            ctx.restore();
        }

        // Small twigs
        ctx.strokeStyle = 'rgba(60,40,20,0.3)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 12; i++) {
            const x = cx + (noise.noise2D(i * 5, variant * 2) - 0.5) * radius * 1.4;
            const y = cy + (noise.noise2D(variant * 2, i * 5) - 0.5) * radius * 1.4;
            const len = 3 + Math.random() * 6;
            const angle = Math.random() * Math.PI;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render rocky grass (hills)
     */
    renderRockyGrass(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        // First add some grass
        this.renderGrassDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain);

        // Then add scattered small rocks
        const rockCount = Math.floor(radius * 0.15);

        for (let i = 0; i < rockCount; i++) {
            const seed = variant * 20000 + i;
            const angle = detailNoise.noise2D(seed * 0.15, 0) * Math.PI * 2;
            const dist = Math.abs(detailNoise.noise2D(0, seed * 0.15)) * radius * 0.8;

            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const rockSize = 2 + Math.abs(microNoise.noise2D(x * 0.1, y * 0.1)) * 4;

            // Rock with highlight
            const rockGrad = ctx.createLinearGradient(x - rockSize, y - rockSize, x + rockSize, y + rockSize);
            rockGrad.addColorStop(0, '#8a8888');
            rockGrad.addColorStop(0.4, '#6a6868');
            rockGrad.addColorStop(1, '#4a4848');

            ctx.beginPath();
            // Irregular rock shape
            ctx.moveTo(x + rockSize * 0.7, y);
            ctx.quadraticCurveTo(x + rockSize, y - rockSize * 0.5, x + rockSize * 0.3, y - rockSize * 0.8);
            ctx.quadraticCurveTo(x - rockSize * 0.3, y - rockSize, x - rockSize * 0.7, y - rockSize * 0.3);
            ctx.quadraticCurveTo(x - rockSize, y + rockSize * 0.2, x - rockSize * 0.3, y + rockSize * 0.6);
            ctx.quadraticCurveTo(x + rockSize * 0.2, y + rockSize * 0.8, x + rockSize * 0.7, y);
            ctx.fillStyle = rockGrad;
            ctx.fill();

            // Rock highlight
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.ellipse(x - rockSize * 0.2, y - rockSize * 0.3, rockSize * 0.3, rockSize * 0.2, -0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Contour lines for elevation feel
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = terrain.darkColor;
        ctx.lineWidth = 0.8;
        for (let contour = 0; contour < 4; contour++) {
            const threshold = 0.2 + contour * 0.15;
            ctx.beginPath();
            let hasPoints = false;
            for (let px = 0; px < width; px += 3) {
                for (let py = 0; py < height; py += 3) {
                    const value = (noise.noise2D(px * 0.02 + variant, py * 0.02) + 1) / 2;
                    if (Math.abs(value - threshold) < 0.02) {
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
     * Render stone/rock terrain
     */
    renderStoneDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        // Cracks
        ctx.strokeStyle = terrain.darkColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.3;

        const crackCount = Math.floor(radius * 0.12);
        for (let i = 0; i < crackCount; i++) {
            const startAngle = (i / crackCount) * Math.PI * 2;
            const startDist = 0.2 + Math.abs(noise.noise2D(i * 10, variant)) * 0.6;
            let x = cx + Math.cos(startAngle) * radius * startDist;
            let y = cy + Math.sin(startAngle) * radius * startDist;

            ctx.beginPath();
            ctx.moveTo(x, y);

            const segments = 3 + Math.floor(Math.abs(noise.noise2D(i, 0)) * 6);
            for (let s = 0; s < segments; s++) {
                const crackAngle = noise.noise2D(x * 0.1 + s, y * 0.1) * Math.PI;
                const length = 5 + Math.abs(microNoise.noise2D(x, y)) * 12;
                x += Math.cos(crackAngle) * length;
                y += Math.sin(crackAngle) * length;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Moss patches
        ctx.globalAlpha = 0.2;
        const mossCount = Math.floor(radius * 0.08);
        for (let i = 0; i < mossCount; i++) {
            const angle = noise.noise2D(i * 5, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.7;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const mossSize = 5 + Math.abs(microNoise.noise2D(x, y)) * 10;

            ctx.fillStyle = '#4a6a4a';
            ctx.beginPath();
            ctx.arc(x, y, mossSize, 0, Math.PI * 2);
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
     * Render flowing river water
     */
    renderFlowingWater(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Flow lines
        ctx.strokeStyle = terrain.lightColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.18;
        ctx.lineCap = 'round';

        const lineCount = 5;
        for (let l = 0; l < lineCount; l++) {
            const baseY = cy - radius * 0.7 + l * (radius * 1.4 / lineCount);
            ctx.beginPath();
            let x = cx - radius;
            let y = baseY;
            let started = false;

            while (x < cx + radius) {
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);

                const flowOffset = noise.noise2D(x * 0.03 + variant, l * 0.4) * 10;
                x += 8;
                y = baseY + flowOffset;
            }
            ctx.stroke();
        }

        // Ripples
        ctx.globalAlpha = 0.12;
        for (let i = 0; i < 8; i++) {
            const x = cx + (noise.noise2D(i * 4, variant) - 0.5) * radius * 1.4;
            const y = cy + (noise.noise2D(variant, i * 4) - 0.5) * radius * 1.4;

            ctx.beginPath();
            ctx.ellipse(x, y, 5 + Math.random() * 5, 2 + Math.random() * 2, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render sand ripples
     */
    renderSandDetails(ctx, noise, detailNoise, width, height, variant, cx, cy, radius, terrain) {
        // Ripple lines
        ctx.strokeStyle = terrain.darkColor;
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = 0.15;

        const rippleCount = 10;
        for (let r = 0; r < rippleCount; r++) {
            const baseY = cy - radius * 0.8 + (r + 0.5) * (radius * 1.6 / rippleCount);
            ctx.beginPath();
            let started = false;

            for (let x = cx - radius; x <= cx + radius; x += 3) {
                const rippleOffset = noise.noise2D(x * 0.04 + variant, r * 0.3) * 3;
                const y = baseY + rippleOffset;
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Small pebbles
        ctx.fillStyle = terrain.darkColor;
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 15; i++) {
            const angle = noise.noise2D(i * 3, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.85;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;

            ctx.beginPath();
            ctx.ellipse(x, y, 1 + Math.random() * 1.5, 0.5 + Math.random() * 1, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render murky swamp
     */
    renderMurkyDetails(ctx, noise, detailNoise, microNoise, width, height, variant, cx, cy, radius, terrain) {
        // Dark murky patches
        ctx.globalAlpha = 0.3;
        const patchCount = Math.floor(radius * 0.1);

        for (let i = 0; i < patchCount; i++) {
            const angle = noise.noise2D(i * 4, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.7;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const patchSize = 12 + Math.abs(microNoise.noise2D(x, y)) * 20;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, patchSize);
            gradient.addColorStop(0, 'rgba(30, 40, 20, 0.5)');
            gradient.addColorStop(1, 'rgba(30, 40, 20, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(x - patchSize, y - patchSize, patchSize * 2, patchSize * 2);
        }

        // Algae spots
        ctx.fillStyle = '#3a5a30';
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < 30; i++) {
            const angle = microNoise.noise2D(i * 2, variant) * Math.PI * 2;
            const dist = Math.abs(microNoise.noise2D(i, variant)) * radius * 0.85;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;

            ctx.beginPath();
            ctx.arc(x, y, 1.5 + Math.abs(noise.noise2D(x * 0.1, y * 0.1)) * 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Bubbles
        ctx.fillStyle = 'rgba(100, 120, 80, 0.3)';
        for (let i = 0; i < 8; i++) {
            const x = cx + (noise.noise2D(i * 7, variant) - 0.5) * radius * 1.2;
            const y = cy + (noise.noise2D(variant, i * 7) - 0.5) * radius * 1.2;

            ctx.beginPath();
            ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    getTypes() {
        return Object.keys(this.types);
    }
};

window.TerrainGenerator = TerrainGenerator;
