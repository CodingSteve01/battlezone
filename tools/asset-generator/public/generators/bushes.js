/**
 * Bush & Vegetation Generator (Browser)
 */

const BushGenerator = {
    types: {
        round: { shape: 'spherical', leafDensity: 0.9, baseH: 115, baseS: 50, baseL: 35 },
        wild: { shape: 'irregular', leafDensity: 0.7, baseH: 105, baseS: 45, baseL: 38 },
        flowering: { shape: 'spherical', leafDensity: 0.85, baseH: 120, baseS: 50, baseL: 32, flowers: true },
        berry: { shape: 'irregular', leafDensity: 0.8, baseH: 118, baseS: 48, baseL: 30, berries: true },
        fern: { shape: 'fronds', leafDensity: 0.6, baseH: 130, baseS: 55, baseL: 30 }
    },

    generate(type, variant, width = 307, height = 300) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);

        const config = this.types[type] || this.types.round;
        const seed = type.charCodeAt(0) * 1000 + variant;
        const rand = ColorUtils.seededRandom(seed);

        // Draw shadow
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(width / 2 + 4, height - 15, width * 0.3, height * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (config.shape === 'fronds') {
            this.drawFernBush(ctx, config, rand, width, height);
        } else {
            this.drawBush(ctx, config, rand, width, height, config.shape === 'irregular');
        }

        if (config.flowers) this.addFlowers(ctx, rand, width, height);
        if (config.berries) this.addBerries(ctx, rand, width, height);

        return canvas;
    },

    drawBush(ctx, config, rand, width, height, irregular) {
        const centerX = width / 2;
        const centerY = height * 0.65;
        const baseRadius = width * 0.35;

        const blobCount = irregular ? 5 + Math.floor(rand() * 3) : 1;

        for (let b = 0; b < blobCount; b++) {
            const blobX = irregular ? centerX + (rand() - 0.5) * width * 0.3 : centerX;
            const blobY = irregular ? centerY + (rand() - 0.5) * height * 0.2 - 15 : centerY;
            const blobRadius = irregular ? 35 + rand() * 35 : baseRadius;

            const clusterCount = 20 + Math.floor(rand() * 12);
            for (let layer = 0; layer < 3; layer++) {
                for (let i = 0; i < clusterCount; i++) {
                    const angle = rand() * Math.PI * 2;
                    const distance = rand() * blobRadius * (0.3 + layer * 0.25);
                    const x = blobX + Math.cos(angle) * distance * 1.1;
                    const y = blobY + Math.sin(angle) * distance * 0.55 - layer * 8;

                    const depth = (y - (blobY - blobRadius)) / (blobRadius * 2);
                    const clusterSize = (12 + rand() * 16) * (0.7 + depth * 0.3);

                    this.drawLeafCluster(ctx, x, y, clusterSize, config, rand, depth);
                }
            }
        }
    },

    drawFernBush(ctx, config, rand, width, height) {
        const centerX = width / 2;
        const baseY = height - 25;
        const frondCount = 7 + Math.floor(rand() * 5);

        for (let f = 0; f < frondCount; f++) {
            const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 0.7;
            const frondLength = 70 + rand() * 50;
            const startX = centerX + (rand() - 0.5) * 25;

            this.drawFrond(ctx, startX, baseY, angle, frondLength, config, rand);
        }
    },

    drawFrond(ctx, startX, startY, angle, length, config, rand) {
        ctx.save();
        ctx.translate(startX, startY);
        ctx.rotate(angle + Math.PI / 2);

        // Main stem
        const stemColor = ColorUtils.rgbToHex(...ColorUtils.hslToRgb(config.baseH / 360, (config.baseS - 10) / 100, (config.baseL - 10) / 100));
        ctx.strokeStyle = stemColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -length);
        ctx.stroke();

        // Leaflets
        const segments = 10;
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const y = -t * length;
            const leafletSize = length * 0.12 * (1 - t * 0.4);

            for (const side of [-1, 1]) {
                const leafColor = ColorUtils.rgbToHex(...ColorUtils.hslToRgb(
                    (config.baseH + (rand() - 0.5) * 10) / 360,
                    config.baseS / 100,
                    config.baseL / 100
                ));

                ctx.fillStyle = leafColor;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.quadraticCurveTo(side * leafletSize * 0.8, y - leafletSize * 0.3, side * leafletSize, y - leafletSize * 0.1);
                ctx.quadraticCurveTo(side * leafletSize * 0.5, y + leafletSize * 0.2, 0, y);
                ctx.fill();
            }
        }

        ctx.restore();
    },

    drawLeafCluster(ctx, x, y, size, config, rand, depth) {
        ctx.save();

        const baseColor = ColorUtils.rgbToHex(...ColorUtils.hslToRgb(config.baseH / 360, config.baseS / 100, config.baseL / 100));
        const lightColor = ColorUtils.lightenColor(baseColor, 20);
        const darkColor = ColorUtils.darkenColor(baseColor, 15);

        const grad = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, 0, x, y, size);
        grad.addColorStop(0, lightColor);
        grad.addColorStop(0.4, baseColor);
        grad.addColorStop(1, darkColor);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        // Texture
        for (let i = 0; i < 2; i++) {
            const ox = (rand() - 0.5) * size * 0.4;
            const oy = (rand() - 0.5) * size * 0.4;
            const subSize = size * (0.25 + rand() * 0.25);

            ctx.fillStyle = rand() > 0.5 ? lightColor : baseColor;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, subSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    addFlowers(ctx, rand, width, height) {
        const flowerCount = 8 + Math.floor(rand() * 10);
        const centerX = width / 2;
        const centerY = height * 0.55;
        const radius = width * 0.25;

        const colors = ['#FF69B4', '#FFB6C1', '#FFFFFF', '#FF6B6B', '#DDA0DD'];

        for (let i = 0; i < flowerCount; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * radius;
            const x = centerX + Math.cos(angle) * dist * 1.1;
            const y = centerY + Math.sin(angle) * dist * 0.5;
            const size = 4 + rand() * 5;
            const color = colors[Math.floor(rand() * colors.length)];

            ctx.fillStyle = color;
            for (let p = 0; p < 5; p++) {
                const pa = (p / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.ellipse(x + Math.cos(pa) * size, y + Math.sin(pa) * size, size * 0.5, size * 0.35, pa, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    addBerries(ctx, rand, width, height) {
        const berryCount = 12 + Math.floor(rand() * 12);
        const centerX = width / 2;
        const centerY = height * 0.6;
        const radius = width * 0.22;

        for (let i = 0; i < berryCount; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * radius;
            const x = centerX + Math.cos(angle) * dist * 1.15;
            const y = centerY + Math.sin(angle) * dist * 0.55;
            const size = 2.5 + rand() * 2.5;

            const grad = ctx.createRadialGradient(x - size * 0.3, y - size * 0.3, 0, x, y, size);
            grad.addColorStop(0, '#FF4040');
            grad.addColorStop(0.5, '#8B0000');
            grad.addColorStop(1, '#400000');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
};

// Grass Generator
const GrassGenerator = {
    types: {
        short: { bladeMin: 18, bladeMax: 32, heightMin: 15, heightMax: 28, baseH: 95, tipH: 85 },
        tall: { bladeMin: 14, bladeMax: 22, heightMin: 38, heightMax: 65, baseH: 90, tipH: 80 },
        wheat: { bladeMin: 10, bladeMax: 18, heightMin: 48, heightMax: 75, baseH: 45, tipH: 40, seeds: true },
        reed: { bladeMin: 7, bladeMax: 12, heightMin: 55, heightMax: 90, baseH: 85, tipH: 75, thick: true }
    },

    generate(type, variant, width = 307, height = 344) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);

        const config = this.types[type] || this.types.short;
        const seed = (type.charCodeAt(0) + 100) * 1000 + variant;
        const rand = ColorUtils.seededRandom(seed);

        // Shadow
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(width / 2, height - 10, width * 0.35, height * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const centerX = width / 2;
        const baseY = height - 18;
        const bladeCount = config.bladeMin + Math.floor(rand() * (config.bladeMax - config.bladeMin));

        for (let i = 0; i < bladeCount; i++) {
            const x = centerX + (rand() - 0.5) * width * 0.55;
            const lean = (rand() - 0.5) * 0.7;
            const h = config.heightMin + rand() * (config.heightMax - config.heightMin);
            const w = config.thick ? 3.5 + rand() * 2.5 : 1.5 + rand() * 1.5;

            const baseColor = ColorUtils.rgbToHex(...ColorUtils.hslToRgb(config.baseH / 360, 0.5, 0.38));
            const tipColor = ColorUtils.rgbToHex(...ColorUtils.hslToRgb(config.tipH / 360, 0.45, 0.5));

            const grad = ctx.createLinearGradient(x, baseY, x + lean * h, baseY - h);
            grad.addColorStop(0, baseColor);
            grad.addColorStop(1, tipColor);

            ctx.strokeStyle = grad;
            ctx.lineWidth = w;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(x, baseY);
            ctx.bezierCurveTo(
                x + lean * h * 0.3, baseY - h * 0.5,
                x + lean * h * 0.8, baseY - h * 0.8,
                x + lean * h, baseY - h
            );
            ctx.stroke();

            if (config.seeds) {
                this.drawWheatSeed(ctx, x + lean * h, baseY - h, rand);
            }
        }

        return canvas;
    },

    drawWheatSeed(ctx, x, y, rand) {
        ctx.fillStyle = '#DAA520';
        for (let i = 0; i < 5; i++) {
            const oy = i * 3.5;
            const angle = (i % 2 === 0 ? 1 : -1) * 0.25;

            ctx.save();
            ctx.translate(x, y + oy);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
};

window.BushGenerator = BushGenerator;
window.GrassGenerator = GrassGenerator;
