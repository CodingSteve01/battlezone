/**
 * Terrain Generator (Browser)
 */

const TerrainGenerator = {
    types: {
        grass: {
            baseColor: { h: 95, s: 55, l: 40 },
            accentColor: { h: 80, s: 60, l: 35 },
            noiseScale: 0.05,
            variation: 15
        },
        forest: {
            baseColor: { h: 120, s: 45, l: 28 },
            accentColor: { h: 100, s: 50, l: 22 },
            noiseScale: 0.04,
            variation: 20
        },
        hills: {
            baseColor: { h: 75, s: 40, l: 45 },
            accentColor: { h: 35, s: 35, l: 50 },
            noiseScale: 0.03,
            variation: 25
        },
        rock: {
            baseColor: { h: 30, s: 10, l: 45 },
            accentColor: { h: 25, s: 15, l: 35 },
            noiseScale: 0.06,
            variation: 20
        },
        water: {
            baseColor: { h: 200, s: 60, l: 45 },
            accentColor: { h: 210, s: 70, l: 35 },
            noiseScale: 0.04,
            variation: 15
        },
        sand: {
            baseColor: { h: 45, s: 50, l: 70 },
            accentColor: { h: 40, s: 45, l: 60 },
            noiseScale: 0.08,
            variation: 10
        },
        swamp: {
            baseColor: { h: 90, s: 35, l: 30 },
            accentColor: { h: 70, s: 40, l: 25 },
            noiseScale: 0.05,
            variation: 18
        },
        river: {
            baseColor: { h: 195, s: 55, l: 50 },
            accentColor: { h: 180, s: 50, l: 45 },
            noiseScale: 0.03,
            variation: 12
        }
    },

    generate(type, variant, width = 256, height = 192) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const config = this.types[type] || this.types.grass;
        const seed = type.charCodeAt(0) * 1000 + variant;
        const noise = new SimplexNoise(seed);
        const rand = ColorUtils.seededRandom(seed);

        // Generate base texture with noise
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const nx = (x + variant * 500) * config.noiseScale;
                const ny = (y + variant * 500) * config.noiseScale;

                // Multi-octave noise
                let noiseVal = 0;
                let amp = 1;
                let freq = 1;
                let maxVal = 0;

                for (let oct = 0; oct < 4; oct++) {
                    noiseVal += amp * noise.noise2D(nx * freq, ny * freq);
                    maxVal += amp;
                    amp *= 0.5;
                    freq *= 2;
                }
                noiseVal = (noiseVal / maxVal + 1) / 2;

                // Blend colors
                const h = config.baseColor.h + (config.accentColor.h - config.baseColor.h) * noiseVal + (rand() - 0.5) * config.variation;
                const s = config.baseColor.s + (config.accentColor.s - config.baseColor.s) * noiseVal;
                const l = config.baseColor.l + (config.accentColor.l - config.baseColor.l) * noiseVal + (rand() - 0.5) * 10;

                const [r, g, b] = ColorUtils.hslToRgb(h / 360, Math.max(0, Math.min(1, s / 100)), Math.max(0, Math.min(1, l / 100)));

                const idx = (y * width + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Add type-specific details
        this.addDetails(ctx, type, width, height, rand);

        // Add lighting
        this.addLighting(ctx, width, height);

        return canvas;
    },

    addDetails(ctx, type, width, height, rand) {
        switch (type) {
            case 'grass':
                this.drawGrassBlades(ctx, width, height, rand);
                break;
            case 'water':
            case 'river':
                this.drawWaves(ctx, width, height, rand);
                break;
            case 'sand':
                this.drawRipples(ctx, width, height, rand);
                break;
            case 'forest':
                this.drawLeafLitter(ctx, width, height, rand);
                break;
            case 'rock':
                this.drawCracks(ctx, width, height, rand);
                break;
        }
    },

    drawGrassBlades(ctx, width, height, rand) {
        const bladeCount = 60 + Math.floor(rand() * 30);
        ctx.save();

        for (let i = 0; i < bladeCount; i++) {
            const x = rand() * width;
            const y = rand() * height;
            const h = 6 + rand() * 10;
            const lean = (rand() - 0.5) * 0.4;

            ctx.strokeStyle = `hsl(${85 + rand() * 30}, 55%, ${30 + rand() * 20}%)`;
            ctx.lineWidth = 1 + rand() * 0.5;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + lean * h, y - h * 0.6, x + lean * h * 1.5, y - h);
            ctx.stroke();
        }

        ctx.restore();
    },

    drawWaves(ctx, width, height, rand) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;

        for (let i = 0; i < 5; i++) {
            const y = 15 + i * 35;
            ctx.beginPath();
            for (let x = 0; x <= width; x += 5) {
                const wave = Math.sin(x * 0.08 + i * 0.5) * 6;
                if (x === 0) ctx.moveTo(x, y + wave);
                else ctx.lineTo(x, y + wave);
            }
            ctx.stroke();
        }

        ctx.restore();
    },

    drawRipples(ctx, width, height, rand) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = '#8B7355';
        ctx.lineWidth = 1;

        for (let i = 0; i < 10; i++) {
            const y = 8 + i * 18;
            ctx.beginPath();
            for (let x = 0; x <= width; x += 3) {
                const wave = Math.sin(x * 0.1 + i * 0.3) * 2;
                if (x === 0) ctx.moveTo(x, y + wave);
                else ctx.lineTo(x, y + wave);
            }
            ctx.stroke();
        }

        ctx.restore();
    },

    drawLeafLitter(ctx, width, height, rand) {
        const leafCount = 25 + Math.floor(rand() * 20);

        for (let i = 0; i < leafCount; i++) {
            const x = rand() * width;
            const y = rand() * height;
            const size = 3 + rand() * 5;
            const rotation = rand() * Math.PI * 2;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            ctx.fillStyle = `hsl(${30 + rand() * 50}, 40%, ${25 + rand() * 15}%)`;
            ctx.beginPath();
            ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    },

    drawCracks(ctx, width, height, rand) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;

        for (let i = 0; i < 6; i++) {
            let x = rand() * width;
            let y = rand() * height;

            ctx.beginPath();
            ctx.moveTo(x, y);

            for (let j = 0; j < 4; j++) {
                x += (rand() - 0.5) * 25;
                y += rand() * 15;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        ctx.restore();
    },

    addLighting(ctx, width, height) {
        ctx.save();
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, 'rgba(255,255,255,0.08)');
        grad.addColorStop(0.5, 'transparent');
        grad.addColorStop(1, 'rgba(0,0,0,0.08)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
};

window.TerrainGenerator = TerrainGenerator;
