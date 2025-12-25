/**
 * High-Detail Hexagonal Terrain Generator
 * Creates realistic, seamless hexagonal terrain textures for tactical games
 *
 * Features:
 * - Proper pointy-top hexagonal shape matching game renderer
 * - Multi-octave Simplex noise for sub-pixel detail
 * - Terrain-specific detail rendering (grass blades, rock cracks, etc.)
 * - 3D bevel effect matching game's hex borders
 */

const TerrainGenerator = {
    // Terrain type definitions matching game's config.js
    types: {
        grass: {
            baseColor: '#6a9a58',
            lightColor: '#7db068',
            darkColor: '#4a7a40',
            detailType: 'grass_blades',
            noiseScale: 0.03,
            detailDensity: 0.8
        },
        forest: {
            baseColor: '#3d6a4a',
            lightColor: '#4d7a58',
            darkColor: '#2a5038',
            detailType: 'leaf_litter',
            noiseScale: 0.04,
            detailDensity: 0.9
        },
        hills: {
            baseColor: '#7a8c5a',
            lightColor: '#8a9c68',
            darkColor: '#5a7040',
            detailType: 'contour_lines',
            noiseScale: 0.02,
            detailDensity: 0.6
        },
        rock: {
            baseColor: '#7a7878',
            lightColor: '#908a88',
            darkColor: '#5a5858',
            detailType: 'cracks',
            noiseScale: 0.05,
            detailDensity: 0.7
        },
        water: {
            baseColor: '#4a7a95',
            lightColor: '#5a8aa8',
            darkColor: '#3a6a80',
            detailType: 'waves',
            noiseScale: 0.015,
            detailDensity: 0.5
        },
        sand: {
            baseColor: '#d4b888',
            lightColor: '#e4c898',
            darkColor: '#c4a878',
            detailType: 'ripples',
            noiseScale: 0.025,
            detailDensity: 0.4
        },
        swamp: {
            baseColor: '#5a6a45',
            lightColor: '#6a7a55',
            darkColor: '#3a4a30',
            detailType: 'murky',
            noiseScale: 0.035,
            detailDensity: 0.85
        },
        river: {
            baseColor: '#4a7c9a',
            lightColor: '#5a8caa',
            darkColor: '#3a6c8a',
            detailType: 'current',
            noiseScale: 0.02,
            detailDensity: 0.6
        }
    },

    /**
     * Generate a hexagonal terrain texture
     * @param {string} type - Terrain type
     * @param {number} variant - Variant number for randomization
     * @param {number} size - Output texture size (square canvas, hex clipped)
     * @returns {HTMLCanvasElement}
     */
    generate(type, variant = 0, size = 128) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const terrain = this.types[type] || this.types.grass;
        const seed = type.charCodeAt(0) * 1000 + variant;
        const noise = new SimplexNoise(seed);
        const detailNoise = new SimplexNoise(seed + 12345);
        const microNoise = new SimplexNoise(seed + 67890);

        // Create hex clipping path (pointy-top orientation)
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 2; // Slight inset to avoid edge artifacts

        ctx.save();
        this.createHexPath(ctx, centerX, centerY, radius);
        ctx.clip();

        // Render base terrain with multi-octave noise
        this.renderBaseLayer(ctx, terrain, noise, size, variant);

        // Add detail layer based on terrain type
        this.renderDetailLayer(ctx, terrain, detailNoise, microNoise, size, variant);

        // Add subtle ambient occlusion at edges
        this.renderEdgeShadow(ctx, centerX, centerY, radius);

        ctx.restore();

        // Draw hex border with 3D bevel effect
        this.renderHexBorder(ctx, centerX, centerY, radius, terrain);

        return canvas;
    },

    /**
     * Create a pointy-top hexagon path matching game's renderer
     */
    createHexPath(ctx, cx, cy, radius) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i; // 0, 60, 120, 180, 240, 300 degrees
            const px = cx + radius * Math.cos(angle);
            const py = cy + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    },

    /**
     * Parse hex color to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
    },

    /**
     * Render base terrain layer with multi-octave noise
     */
    renderBaseLayer(ctx, terrain, noise, size, variant) {
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;

        const baseRGB = this.hexToRgb(terrain.baseColor);
        const lightRGB = this.hexToRgb(terrain.lightColor);
        const darkRGB = this.hexToRgb(terrain.darkColor);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Multi-octave fractal Brownian motion
                let value = 0;
                let amplitude = 1;
                let frequency = terrain.noiseScale;
                let maxAmplitude = 0;

                // 6 octaves for fine detail
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

                // Add micro-detail noise for sub-pixel variation
                const microDetail = noise.noise2D(x * 0.2, y * 0.2) * 0.1;
                value = Math.max(0, Math.min(1, value + microDetail));

                // Blend between dark and light based on noise
                let r, g, b;
                if (value < 0.5) {
                    const t = value * 2;
                    r = darkRGB.r + (baseRGB.r - darkRGB.r) * t;
                    g = darkRGB.g + (baseRGB.g - darkRGB.g) * t;
                    b = darkRGB.b + (baseRGB.b - darkRGB.b) * t;
                } else {
                    const t = (value - 0.5) * 2;
                    r = baseRGB.r + (lightRGB.r - baseRGB.r) * t;
                    g = baseRGB.g + (lightRGB.g - baseRGB.g) * t;
                    b = baseRGB.b + (lightRGB.b - baseRGB.b) * t;
                }

                const idx = (y * size + x) * 4;
                data[idx] = Math.round(r);
                data[idx + 1] = Math.round(g);
                data[idx + 2] = Math.round(b);
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    },

    /**
     * Render terrain-specific detail layer
     */
    renderDetailLayer(ctx, terrain, noise, microNoise, size, variant) {
        const cx = size / 2;
        const cy = size / 2;
        const radius = size / 2 - 4;

        switch (terrain.detailType) {
            case 'grass_blades':
                this.renderGrassBlades(ctx, noise, microNoise, size, terrain, variant, cx, cy, radius);
                break;
            case 'leaf_litter':
                this.renderLeafLitter(ctx, noise, microNoise, size, terrain, variant, cx, cy, radius);
                break;
            case 'contour_lines':
                this.renderContourLines(ctx, noise, size, terrain, variant, cx, cy, radius);
                break;
            case 'cracks':
                this.renderRockCracks(ctx, noise, microNoise, size, terrain, variant, cx, cy, radius);
                break;
            case 'waves':
                this.renderWaterWaves(ctx, noise, size, terrain, variant, cx, cy, radius);
                break;
            case 'ripples':
                this.renderSandRipples(ctx, noise, size, terrain, variant, cx, cy, radius);
                break;
            case 'murky':
                this.renderSwampMurk(ctx, noise, microNoise, size, terrain, variant, cx, cy, radius);
                break;
            case 'current':
                this.renderRiverCurrent(ctx, noise, size, terrain, variant, cx, cy, radius);
                break;
        }
    },

    /**
     * Check if a point is inside the hexagon
     */
    isInsideHex(x, y, cx, cy, radius) {
        // Transform to local coordinates
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);

        // Quick bounding box check
        if (dx > radius || dy > radius * 0.866) return false;

        // Precise hex check using the hex geometry
        // For pointy-top hex: width = 2*radius, height = sqrt(3)*radius
        const hexWidth = radius;
        const hexHeight = radius * 0.866; // sqrt(3)/2

        return (hexHeight * hexWidth - hexHeight * dx - 0.5 * hexWidth * dy) >= 0;
    },

    /**
     * Render individual grass blades
     */
    renderGrassBlades(ctx, noise, microNoise, size, terrain, variant, cx, cy, radius) {
        const bladeCount = Math.floor(size * terrain.detailDensity * 1.5);

        ctx.lineCap = 'round';

        const darkRGB = this.hexToRgb(terrain.darkColor);
        const lightRGB = this.hexToRgb(terrain.lightColor);

        for (let i = 0; i < bladeCount; i++) {
            const seed = variant * 10000 + i;
            const x = cx + (noise.noise2D(seed * 0.1, 0)) * radius * 0.9;
            const y = cy + (noise.noise2D(0, seed * 0.1)) * radius * 0.9;

            if (!this.isInsideHex(x, y, cx, cy, radius)) continue;

            const height = 4 + microNoise.noise2D(x * 0.1, y * 0.1) * 6;
            const bend = microNoise.noise2D(x * 0.05, y * 0.05) * 0.5;
            const thickness = 0.6 + Math.abs(microNoise.noise2D(x, y)) * 0.6;

            // Draw blade with slight curve
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(
                x + bend * height * 0.5,
                y - height * 0.6,
                x + bend * height,
                y - height
            );

            // Gradient from dark base to light tip
            const gradient = ctx.createLinearGradient(x, y, x, y - height);
            gradient.addColorStop(0, `rgba(${darkRGB.r}, ${darkRGB.g}, ${darkRGB.b}, 0.7)`);
            gradient.addColorStop(1, `rgba(${lightRGB.r}, ${lightRGB.g}, ${lightRGB.b}, 0.5)`);

            ctx.strokeStyle = gradient;
            ctx.lineWidth = thickness;
            ctx.stroke();
        }
    },

    /**
     * Render leaf litter for forest floor
     */
    renderLeafLitter(ctx, noise, microNoise, size, terrain, variant, cx, cy, radius) {
        const leafCount = Math.floor(size * terrain.detailDensity * 0.6);

        const leafColors = [
            '#5a4a30', '#4a3a25', '#6a5a40', '#3a2a1a', // Browns
            '#3d5a3a', '#4d6a4a', '#2d4a2a' // Dark greens
        ];

        for (let i = 0; i < leafCount; i++) {
            const seed = variant * 10000 + i;
            const x = cx + (noise.noise2D(seed * 0.1, 0)) * radius * 0.85;
            const y = cy + (noise.noise2D(0, seed * 0.1)) * radius * 0.85;

            if (!this.isInsideHex(x, y, cx, cy, radius)) continue;

            const leafSize = 2 + Math.abs(microNoise.noise2D(x * 0.1, y * 0.1)) * 3;
            const rotation = microNoise.noise2D(x * 0.05, y * 0.05) * Math.PI;
            const colorIdx = Math.floor(Math.abs(noise.noise2D(x, y)) * leafColors.length);
            const color = leafColors[colorIdx % leafColors.length];

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            // Draw oval leaf shape
            ctx.beginPath();
            ctx.ellipse(0, 0, leafSize, leafSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.5 + Math.abs(microNoise.noise2D(i, 0)) * 0.4;
            ctx.fill();

            ctx.restore();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render contour lines for hills
     */
    renderContourLines(ctx, noise, size, terrain, variant, cx, cy, radius) {
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = terrain.darkColor;
        ctx.lineWidth = 0.8;

        // Draw subtle elevation contour lines
        for (let contour = 0; contour < 6; contour++) {
            const threshold = 0.15 + contour * 0.12;

            ctx.beginPath();
            let hasPoints = false;

            for (let x = 0; x < size; x += 2) {
                for (let y = 0; y < size; y += 2) {
                    if (!this.isInsideHex(x, y, cx, cy, radius)) continue;

                    const value = (noise.noise2D(x * 0.02 + variant, y * 0.02) + 1) / 2;

                    if (Math.abs(value - threshold) < 0.015) {
                        if (!hasPoints) {
                            ctx.moveTo(x, y);
                            hasPoints = true;
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                }
            }
            if (hasPoints) ctx.stroke();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render cracks and texture for rock terrain
     */
    renderRockCracks(ctx, noise, microNoise, size, terrain, variant, cx, cy, radius) {
        // Draw crack lines
        ctx.strokeStyle = terrain.darkColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.35;

        const crackCount = Math.floor(terrain.detailDensity * 10);

        for (let i = 0; i < crackCount; i++) {
            const startAngle = (i / crackCount) * Math.PI * 2;
            const startDist = 0.3 + Math.abs(noise.noise2D(i * 10, variant)) * 0.5;
            let x = cx + Math.cos(startAngle) * radius * startDist;
            let y = cy + Math.sin(startAngle) * radius * startDist;

            if (!this.isInsideHex(x, y, cx, cy, radius)) continue;

            ctx.beginPath();
            ctx.moveTo(x, y);

            const segments = 4 + Math.floor(Math.abs(noise.noise2D(i, 0)) * 8);

            for (let s = 0; s < segments; s++) {
                const angle = noise.noise2D(x * 0.1 + s, y * 0.1) * Math.PI;
                const length = 4 + Math.abs(microNoise.noise2D(x, y)) * 10;
                x += Math.cos(angle) * length;
                y += Math.sin(angle) * length;

                if (!this.isInsideHex(x, y, cx, cy, radius)) break;
                ctx.lineTo(x, y);
            }

            ctx.stroke();
        }

        // Add some moss spots
        ctx.globalAlpha = 0.25;
        const mossCount = Math.floor(terrain.detailDensity * 6);

        for (let i = 0; i < mossCount; i++) {
            const angle = noise.noise2D(i * 5, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.7;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;

            if (!this.isInsideHex(x, y, cx, cy, radius)) continue;

            const mossSize = 4 + Math.abs(microNoise.noise2D(x, y)) * 8;
            ctx.beginPath();
            ctx.arc(x, y, mossSize, 0, Math.PI * 2);
            ctx.fillStyle = '#4a6a4a';
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render water waves
     */
    renderWaterWaves(ctx, noise, size, terrain, variant, cx, cy, radius) {
        ctx.strokeStyle = terrain.lightColor;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.25;
        ctx.lineCap = 'round';

        // Draw wave lines
        const waveCount = 8;
        for (let w = 0; w < waveCount; w++) {
            const baseY = cy - radius + (w + 0.5) * (radius * 2 / waveCount);

            ctx.beginPath();
            let started = false;

            for (let x = cx - radius; x <= cx + radius; x += 2) {
                if (!this.isInsideHex(x, baseY, cx, cy, radius)) continue;

                const waveOffset = noise.noise2D(x * 0.03 + variant, w * 0.5) * 6;
                const y = baseY + waveOffset;

                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        // Add sparkle highlights
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffffff';

        for (let i = 0; i < 20; i++) {
            const angle = noise.noise2D(i * 3, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.8;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;

            if (!this.isInsideHex(x, y, cx, cy, radius)) continue;

            ctx.beginPath();
            ctx.arc(x, y, 0.5 + Math.abs(noise.noise2D(x, y)) * 1, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render sand ripples
     */
    renderSandRipples(ctx, noise, size, terrain, variant, cx, cy, radius) {
        ctx.strokeStyle = terrain.darkColor;
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = 0.18;

        // Draw ripple lines
        const rippleCount = 14;
        for (let r = 0; r < rippleCount; r++) {
            const baseY = cy - radius + (r + 0.5) * (radius * 2 / rippleCount);

            ctx.beginPath();
            let started = false;

            for (let x = cx - radius; x <= cx + radius; x += 2) {
                if (!this.isInsideHex(x, baseY, cx, cy, radius)) continue;

                const rippleOffset = noise.noise2D(x * 0.05 + variant, r * 0.3) * 2.5;
                const y = baseY + rippleOffset;

                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render murky swamp details
     */
    renderSwampMurk(ctx, noise, microNoise, size, terrain, variant, cx, cy, radius) {
        // Dark murky patches
        ctx.globalAlpha = 0.35;

        const patchCount = Math.floor(terrain.detailDensity * 8);
        for (let i = 0; i < patchCount; i++) {
            const angle = noise.noise2D(i * 4, variant) * Math.PI * 2;
            const dist = Math.abs(noise.noise2D(i, variant)) * radius * 0.7;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;

            if (!this.isInsideHex(x, y, cx, cy, radius)) continue;

            const patchSize = 10 + Math.abs(microNoise.noise2D(x, y)) * 18;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, patchSize);
            gradient.addColorStop(0, 'rgba(30, 40, 20, 0.5)');
            gradient.addColorStop(1, 'rgba(30, 40, 20, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(x - patchSize, y - patchSize, patchSize * 2, patchSize * 2);
        }

        // Add some algae spots
        ctx.fillStyle = '#3a5a30';
        ctx.globalAlpha = 0.4;

        for (let i = 0; i < 25; i++) {
            const angle = microNoise.noise2D(i * 2, variant) * Math.PI * 2;
            const dist = Math.abs(microNoise.noise2D(i, variant)) * radius * 0.85;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;

            if (!this.isInsideHex(x, y, cx, cy, radius)) continue;

            ctx.beginPath();
            ctx.arc(x, y, 1 + Math.abs(noise.noise2D(x, y)) * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render river current lines
     */
    renderRiverCurrent(ctx, noise, size, terrain, variant, cx, cy, radius) {
        ctx.strokeStyle = terrain.lightColor;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.22;
        ctx.lineCap = 'round';

        // Draw flowing current lines
        const lineCount = 7;
        for (let l = 0; l < lineCount; l++) {
            const baseY = cy - radius + (l + 0.5) * (radius * 2 / lineCount);

            ctx.beginPath();
            let started = false;
            let x = cx - radius;
            let y = baseY;

            while (x < cx + radius) {
                if (this.isInsideHex(x, y, cx, cy, radius)) {
                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                const flowOffset = noise.noise2D(x * 0.04 + variant, l * 0.3) * 8;
                x += 6;
                y = baseY + flowOffset;
            }

            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    },

    /**
     * Render subtle edge shadow for depth
     */
    renderEdgeShadow(ctx, cx, cy, radius) {
        const gradient = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.12)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, cx * 2, cy * 2);
    },

    /**
     * Render 3D hex border matching game's bevel effect
     */
    renderHexBorder(ctx, cx, cy, radius, terrain) {
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            vertices.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            });
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const bevelWidth = Math.max(2, radius * 0.04);

        // Top edges - highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = bevelWidth;
        ctx.beginPath();
        ctx.moveTo(vertices[5].x, vertices[5].y);
        ctx.lineTo(vertices[0].x, vertices[0].y);
        ctx.lineTo(vertices[1].x, vertices[1].y);
        ctx.stroke();

        // Upper-left edge
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = bevelWidth * 0.8;
        ctx.beginPath();
        ctx.moveTo(vertices[4].x, vertices[4].y);
        ctx.lineTo(vertices[5].x, vertices[5].y);
        ctx.stroke();

        // Bottom edges - shadow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.lineWidth = bevelWidth;
        ctx.beginPath();
        ctx.moveTo(vertices[2].x, vertices[2].y);
        ctx.lineTo(vertices[3].x, vertices[3].y);
        ctx.lineTo(vertices[4].x, vertices[4].y);
        ctx.stroke();

        // Lower-right edge
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.lineWidth = bevelWidth * 0.8;
        ctx.beginPath();
        ctx.moveTo(vertices[1].x, vertices[1].y);
        ctx.lineTo(vertices[2].x, vertices[2].y);
        ctx.stroke();
    },

    /**
     * Get list of available terrain types
     */
    getTypes() {
        return Object.keys(this.types);
    }
};

window.TerrainGenerator = TerrainGenerator;
