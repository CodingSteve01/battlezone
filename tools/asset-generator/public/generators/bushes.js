/**
 * Bush & Vegetation Generator (Browser)
 * Enhanced with individual leaves, depth layers, and realistic detail
 */

const BushGenerator = {
    types: {
        round: {
            shape: 'spherical',
            leafColors: ['#3a7a35', '#4a8a45', '#5a9a55', '#2a6a28', '#3a6a30'],
            leafHighlight: '#7aba75',
            leafShadow: '#1a4a18',
            stemColor: '#4a3a28',
            leafSize: { min: 2, max: 4 },
            leafDensity: 0.9,
            layers: 4
        },
        wild: {
            shape: 'irregular',
            leafColors: ['#4a7a40', '#5a8a50', '#6a9a60', '#3a6a35', '#4a6a38'],
            leafHighlight: '#8aba80',
            leafShadow: '#2a5a20',
            stemColor: '#5a4a30',
            leafSize: { min: 2, max: 4 },
            leafDensity: 0.7,
            layers: 3
        },
        flowering: {
            shape: 'spherical',
            leafColors: ['#3a8a38', '#4a9a48', '#5aaa58', '#2a7a2a'],
            leafHighlight: '#6aca68',
            leafShadow: '#1a5a1a',
            stemColor: '#4a3a20',
            leafSize: { min: 2, max: 3 },
            leafDensity: 0.85,
            layers: 3,
            flowers: true
        },
        berry: {
            shape: 'irregular',
            leafColors: ['#2a6a30', '#3a7a40', '#4a8a50', '#1a5a28'],
            leafHighlight: '#5a9a58',
            leafShadow: '#0a3a10',
            stemColor: '#3a2a18',
            leafSize: { min: 2, max: 4 },
            leafDensity: 0.8,
            layers: 3,
            berries: true
        },
        fern: {
            shape: 'fronds',
            leafColors: ['#2a7a35', '#3a8a45', '#4a9a55', '#1a6a28'],
            leafHighlight: '#5aaa60',
            leafShadow: '#0a4a15',
            stemColor: '#3a5a30',
            leafDensity: 0.6,
            layers: 1
        },
        holly: {
            shape: 'spherical',
            leafColors: ['#1a5a20', '#2a6a30', '#1a4a18', '#2a5a28'],
            leafHighlight: '#3a7a38',
            leafShadow: '#0a3a0a',
            stemColor: '#3a2a15',
            leafSize: { min: 3, max: 5 },
            leafDensity: 0.75,
            layers: 3,
            spiky: true,
            berries: true
        }
    },

    generate(type, variant, width = 200, height = 200) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);

        const config = this.types[type] || this.types.round;
        const seed = type.charCodeAt(0) * 1000 + variant;
        const rand = ColorUtils.seededRandom(seed);

        // Draw shadow
        this.drawShadow(ctx, width, height);

        // Draw main bush based on shape
        if (config.shape === 'fronds') {
            this.drawFernBush(ctx, config, rand, width, height);
        } else {
            this.drawDetailedBush(ctx, config, rand, width, height, config.shape === 'irregular');
        }

        // Add decorations
        if (config.flowers) this.addDetailedFlowers(ctx, rand, width, height);
        if (config.berries) this.addDetailedBerries(ctx, rand, width, height, config.spiky);

        return canvas;
    },

    drawShadow(ctx, width, height) {
        ctx.save();
        // Shadow positioned at bush base (bush center is at height * 0.6)
        const shadowY = height * 0.72;
        const shadowX = width / 2 + 3;
        const shadowRadius = width * 0.28;

        const gradient = ctx.createRadialGradient(
            shadowX, shadowY, 0,
            shadowX, shadowY, shadowRadius
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(shadowX, shadowY, shadowRadius, height * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawDetailedBush(ctx, config, rand, width, height, irregular) {
        const centerX = width / 2;
        const centerY = height * 0.6;
        const baseRadius = width * 0.32;

        // Draw small branches/stems visible through foliage
        this.drawInnerBranches(ctx, centerX, centerY, baseRadius, config, rand);

        // Determine blob positions for irregular bushes
        const blobs = [];
        if (irregular) {
            const blobCount = 4 + Math.floor(rand() * 3);
            for (let b = 0; b < blobCount; b++) {
                blobs.push({
                    x: centerX + (rand() - 0.5) * width * 0.35,
                    y: centerY + (rand() - 0.5) * height * 0.25 - 10,
                    radius: 25 + rand() * 30
                });
            }
        } else {
            blobs.push({ x: centerX, y: centerY, radius: baseRadius });
        }

        // Draw leaves in layers (back to front)
        for (let layer = 0; layer < config.layers; layer++) {
            const layerDepth = layer / config.layers;
            const layerY = -layer * 6; // Each layer slightly higher

            for (const blob of blobs) {
                const leafCount = Math.floor(25 + rand() * 20 * config.leafDensity);

                for (let i = 0; i < leafCount; i++) {
                    const angle = rand() * Math.PI * 2;
                    const distance = rand() * blob.radius * (0.4 + layerDepth * 0.5);

                    const x = blob.x + Math.cos(angle) * distance;
                    const y = blob.y + Math.sin(angle) * distance * 0.5 + layerY;

                    // Skip leaves that would be underground
                    if (y > height - 20) continue;

                    const leafSize = config.leafSize.min + rand() * (config.leafSize.max - config.leafSize.min);
                    const leafAngle = angle + (rand() - 0.5) * 0.8;

                    // Color variation based on depth and position
                    const colorIndex = Math.floor(rand() * config.leafColors.length);
                    let leafColor = config.leafColors[colorIndex];

                    // Darken back layers, lighten front layers
                    if (layerDepth < 0.3) {
                        leafColor = ColorUtils.darkenColor(leafColor, 15);
                    } else if (layerDepth > 0.7) {
                        leafColor = ColorUtils.lightenColor(leafColor, 10);
                    }

                    // Add highlight on top leaves
                    const isHighlight = y < blob.y - blob.radius * 0.3 && rand() > 0.6;
                    if (isHighlight) {
                        leafColor = config.leafHighlight;
                    }

                    if (config.spiky) {
                        this.drawSpikyLeaf(ctx, x, y, leafSize, leafAngle, leafColor, config, rand);
                    } else {
                        this.drawLeaf(ctx, x, y, leafSize, leafAngle, leafColor, config, rand);
                    }
                }
            }
        }

        // Add top highlight leaves
        this.addHighlightLeaves(ctx, centerX, centerY - 15, baseRadius * 0.6, config, rand);
    },

    drawInnerBranches(ctx, centerX, centerY, radius, config, rand) {
        const branchCount = 5 + Math.floor(rand() * 4);
        ctx.strokeStyle = config.stemColor;
        ctx.lineCap = 'round';

        for (let i = 0; i < branchCount; i++) {
            const angle = (rand() - 0.5) * Math.PI * 0.8 - Math.PI / 2;
            const length = radius * (0.5 + rand() * 0.4);
            const startX = centerX + (rand() - 0.5) * 20;
            const baseY = centerY + radius * 0.4;

            ctx.lineWidth = 2 + rand() * 2;
            ctx.beginPath();
            ctx.moveTo(startX, baseY);

            // Curved branch
            const midX = startX + Math.cos(angle) * length * 0.5;
            const midY = baseY + Math.sin(angle) * length * 0.5;
            const endX = startX + Math.cos(angle) * length;
            const endY = baseY + Math.sin(angle) * length;

            ctx.quadraticCurveTo(midX, midY, endX, endY);
            ctx.stroke();

            // Small sub-branches
            if (rand() > 0.4) {
                ctx.lineWidth = 1;
                const subAngle = angle + (rand() - 0.5) * 0.6;
                ctx.beginPath();
                ctx.moveTo(midX, midY);
                ctx.lineTo(midX + Math.cos(subAngle) * length * 0.3, midY + Math.sin(subAngle) * length * 0.3);
                ctx.stroke();
            }
        }
    },

    drawLeaf(ctx, x, y, size, angle, color, config, rand) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Main leaf shape
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(
            size * 0.3, -size * 0.2,
            size * 0.8, -size * 0.15,
            size, 0
        );
        ctx.bezierCurveTo(
            size * 0.8, size * 0.15,
            size * 0.3, size * 0.2,
            0, 0
        );
        ctx.fill();

        // Central vein
        ctx.strokeStyle = ColorUtils.darkenColor(color, 20);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(size * 0.1, 0);
        ctx.lineTo(size * 0.85, 0);
        ctx.stroke();

        // Highlight edge
        ctx.strokeStyle = ColorUtils.lightenColor(color, 25);
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(size * 0.2, -size * 0.1);
        ctx.quadraticCurveTo(size * 0.5, -size * 0.12, size * 0.8, -size * 0.05);
        ctx.stroke();

        ctx.restore();
    },

    drawSpikyLeaf(ctx, x, y, size, angle, color, config, rand) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Holly-style spiky leaf
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 0);

        const spikes = 3 + Math.floor(rand() * 2);
        for (let i = 0; i <= spikes; i++) {
            const t = i / spikes;
            const baseY = Math.sin(t * Math.PI) * size * 0.25;
            const spikeOut = (i > 0 && i < spikes) ? size * 0.12 : 0;

            ctx.lineTo(t * size, -baseY - spikeOut);
        }

        for (let i = spikes; i >= 0; i--) {
            const t = i / spikes;
            const baseY = Math.sin(t * Math.PI) * size * 0.25;
            const spikeOut = (i > 0 && i < spikes) ? size * 0.12 : 0;

            ctx.lineTo(t * size, baseY + spikeOut);
        }

        ctx.closePath();
        ctx.fill();

        // Central vein
        ctx.strokeStyle = ColorUtils.darkenColor(color, 25);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(size * 0.1, 0);
        ctx.lineTo(size * 0.9, 0);
        ctx.stroke();

        // Glossy highlight
        ctx.fillStyle = ColorUtils.lightenColor(color, 30);
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(size * 0.4, -size * 0.08, size * 0.25, size * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    addHighlightLeaves(ctx, centerX, centerY, radius, config, rand) {
        const count = 8 + Math.floor(rand() * 6);

        for (let i = 0; i < count; i++) {
            const angle = rand() * Math.PI * 2;
            const distance = rand() * radius;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance * 0.4 - 5;

            const leafSize = config.leafSize.min + rand() * 3;
            const leafAngle = (rand() - 0.5) * Math.PI;

            if (config.spiky) {
                this.drawSpikyLeaf(ctx, x, y, leafSize, leafAngle, config.leafHighlight, config, rand);
            } else {
                this.drawLeaf(ctx, x, y, leafSize, leafAngle, config.leafHighlight, config, rand);
            }
        }
    },

    drawFernBush(ctx, config, rand, width, height) {
        const centerX = width / 2;
        const baseY = height - 20;
        const frondCount = 8 + Math.floor(rand() * 6);

        // Sort fronds by angle for proper layering
        const fronds = [];
        for (let f = 0; f < frondCount; f++) {
            const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 0.8;
            fronds.push({
                angle,
                length: 60 + rand() * 45,
                startX: centerX + (rand() - 0.5) * 30,
                curve: (rand() - 0.5) * 0.4
            });
        }

        // Draw back fronds first
        fronds.sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle));

        for (const frond of fronds) {
            this.drawDetailedFrond(ctx, frond.startX, baseY, frond.angle, frond.length, frond.curve, config, rand);
        }

        // Add unfurling fronds (fiddleheads) at center
        this.drawFiddleheads(ctx, centerX, baseY, config, rand);
    },

    drawDetailedFrond(ctx, startX, startY, angle, length, curve, config, rand) {
        ctx.save();
        ctx.translate(startX, startY);
        ctx.rotate(angle + Math.PI / 2);

        // Main stem with gradient
        const stemGradient = ctx.createLinearGradient(0, 0, 0, -length);
        stemGradient.addColorStop(0, config.stemColor);
        stemGradient.addColorStop(1, ColorUtils.lightenColor(config.stemColor, 15));

        ctx.strokeStyle = stemGradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(curve * length, -length * 0.5, curve * length * 0.5, -length);
        ctx.stroke();

        // Leaflets along the stem
        const segments = 12 + Math.floor(rand() * 6);
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            // Calculate position along curved stem
            const stemX = curve * length * (2 * t - t * t);
            const stemY = -t * length;
            const leafletSize = length * 0.12 * (1 - t * 0.5) * (0.5 + t * 0.5);

            for (const side of [-1, 1]) {
                const colorIndex = Math.floor(rand() * config.leafColors.length);
                let leafColor = config.leafColors[colorIndex];

                // Vary color slightly
                if (rand() > 0.7) {
                    leafColor = ColorUtils.lightenColor(leafColor, 8);
                }

                const leafAngle = side * (0.3 + rand() * 0.2) + curve * 0.5;

                ctx.save();
                ctx.translate(stemX, stemY);
                ctx.rotate(leafAngle);

                // Pointed fern leaflet
                ctx.fillStyle = leafColor;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(
                    side * leafletSize * 0.6, -leafletSize * 0.15,
                    side * leafletSize, -leafletSize * 0.1
                );
                ctx.quadraticCurveTo(
                    side * leafletSize * 0.6, leafletSize * 0.1,
                    0, leafletSize * 0.05
                );
                ctx.fill();

                // Small vein
                ctx.strokeStyle = ColorUtils.darkenColor(leafColor, 15);
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(side * leafletSize * 0.8, -leafletSize * 0.05);
                ctx.stroke();

                ctx.restore();
            }
        }

        ctx.restore();
    },

    drawFiddleheads(ctx, centerX, baseY, config, rand) {
        const count = 2 + Math.floor(rand() * 2);

        for (let i = 0; i < count; i++) {
            const x = centerX + (rand() - 0.5) * 15;
            const height = 15 + rand() * 20;
            const curl = 0.7 + rand() * 0.3;

            ctx.save();
            ctx.translate(x, baseY);

            // Stem
            ctx.strokeStyle = config.stemColor;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(3, -height * 0.6, 0, -height);
            ctx.stroke();

            // Spiral curl at top
            const spiralColor = config.leafColors[0];
            ctx.fillStyle = spiralColor;

            const spiralX = 0;
            const spiralY = -height;
            const spiralSize = 4 + rand() * 3;

            ctx.beginPath();
            for (let a = 0; a < Math.PI * 2 * curl; a += 0.1) {
                const r = spiralSize * (1 - a / (Math.PI * 3));
                const px = spiralX + Math.cos(a - Math.PI / 2) * r;
                const py = spiralY + Math.sin(a - Math.PI / 2) * r * 0.6 - r * 0.3;
                if (a === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.lineWidth = 2;
            ctx.strokeStyle = spiralColor;
            ctx.stroke();

            ctx.restore();
        }
    },

    addDetailedFlowers(ctx, rand, width, height) {
        const flowerCount = 10 + Math.floor(rand() * 8);
        const centerX = width / 2;
        const centerY = height * 0.5;
        const radius = width * 0.28;

        const flowerColors = [
            { petals: '#FF69B4', center: '#FFD700' },
            { petals: '#FFB6C1', center: '#FFA500' },
            { petals: '#FFFFFF', center: '#FFFF00' },
            { petals: '#FF6B6B', center: '#FFD700' },
            { petals: '#DDA0DD', center: '#FF8C00' },
            { petals: '#87CEEB', center: '#FFFF00' }
        ];

        for (let i = 0; i < flowerCount; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * radius;
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist * 0.45;
            const size = 5 + rand() * 4;
            const colorSet = flowerColors[Math.floor(rand() * flowerColors.length)];
            const petalCount = 5 + Math.floor(rand() * 3);

            // Draw petals
            for (let p = 0; p < petalCount; p++) {
                const petalAngle = (p / petalCount) * Math.PI * 2 + rand() * 0.2;
                const petalX = x + Math.cos(petalAngle) * size * 0.6;
                const petalY = y + Math.sin(petalAngle) * size * 0.6;

                ctx.save();
                ctx.translate(petalX, petalY);
                ctx.rotate(petalAngle);

                // Petal gradient
                const petalGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
                petalGrad.addColorStop(0, ColorUtils.lightenColor(colorSet.petals, 20));
                petalGrad.addColorStop(1, colorSet.petals);

                ctx.fillStyle = petalGrad;
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.45, size * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            // Flower center
            const centerGrad = ctx.createRadialGradient(x, y, 0, x, y, size * 0.35);
            centerGrad.addColorStop(0, ColorUtils.lightenColor(colorSet.center, 20));
            centerGrad.addColorStop(0.6, colorSet.center);
            centerGrad.addColorStop(1, ColorUtils.darkenColor(colorSet.center, 20));

            ctx.fillStyle = centerGrad;
            ctx.beginPath();
            ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Pollen dots
            ctx.fillStyle = ColorUtils.darkenColor(colorSet.center, 30);
            for (let d = 0; d < 3; d++) {
                const dotAngle = rand() * Math.PI * 2;
                const dotDist = rand() * size * 0.15;
                ctx.beginPath();
                ctx.arc(
                    x + Math.cos(dotAngle) * dotDist,
                    y + Math.sin(dotAngle) * dotDist,
                    0.8,
                    0, Math.PI * 2
                );
                ctx.fill();
            }
        }
    },

    addDetailedBerries(ctx, rand, width, height, isHolly = false) {
        const berryCount = isHolly ? 8 + Math.floor(rand() * 6) : 15 + Math.floor(rand() * 10);
        const centerX = width / 2;
        const centerY = height * 0.55;
        const radius = width * 0.25;

        // Berry clusters
        const clusters = isHolly ? 3 + Math.floor(rand() * 2) : 1;

        for (let c = 0; c < clusters; c++) {
            const clusterX = centerX + (rand() - 0.5) * radius;
            const clusterY = centerY + (rand() - 0.5) * radius * 0.4;
            const clusterBerries = Math.floor(berryCount / clusters);

            for (let i = 0; i < clusterBerries; i++) {
                const angle = rand() * Math.PI * 2;
                const dist = rand() * (isHolly ? 12 : radius * 0.8);
                const x = clusterX + Math.cos(angle) * dist;
                const y = clusterY + Math.sin(angle) * dist * 0.5;
                const size = isHolly ? 3 + rand() * 2 : 2.5 + rand() * 2;

                // Berry gradient
                const grad = ctx.createRadialGradient(
                    x - size * 0.3, y - size * 0.3, 0,
                    x, y, size
                );
                grad.addColorStop(0, '#FF5050');
                grad.addColorStop(0.4, '#CC0000');
                grad.addColorStop(0.8, '#8B0000');
                grad.addColorStop(1, '#4a0000');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();

                // Highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.beginPath();
                ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.25, 0, Math.PI * 2);
                ctx.fill();

                // Small stem attachment point
                if (isHolly) {
                    ctx.fillStyle = '#2a1a10';
                    ctx.beginPath();
                    ctx.arc(x, y - size * 0.8, size * 0.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
};

// Grass Generator - Enhanced
const GrassGenerator = {
    types: {
        short: {
            bladeMin: 20, bladeMax: 35,
            heightMin: 18, heightMax: 32,
            baseColors: ['#3a6a30', '#4a7a40', '#3a5a28'],
            tipColors: ['#5a8a50', '#6a9a60', '#7aaa70'],
            thickness: { min: 1, max: 2 }
        },
        tall: {
            bladeMin: 16, bladeMax: 26,
            heightMin: 45, heightMax: 75,
            baseColors: ['#3a6a30', '#2a5a28', '#4a7a38'],
            tipColors: ['#6a9a58', '#7aaa68', '#8aba78'],
            thickness: { min: 1.5, max: 2.5 }
        },
        wheat: {
            bladeMin: 12, bladeMax: 20,
            heightMin: 55, heightMax: 85,
            baseColors: ['#8a7a40', '#9a8a50', '#7a6a30'],
            tipColors: ['#baa860', '#caba70', '#daca80'],
            thickness: { min: 1.5, max: 2.5 },
            seeds: true
        },
        reed: {
            bladeMin: 8, bladeMax: 14,
            heightMin: 65, heightMax: 100,
            baseColors: ['#5a7a48', '#4a6a38', '#6a8a58'],
            tipColors: ['#7a9a68', '#8aaa78', '#6a8a58'],
            thickness: { min: 3, max: 5 },
            cattails: true
        }
    },

    generate(type, variant, width = 200, height = 200) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);

        const config = this.types[type] || this.types.short;
        const seed = (type.charCodeAt(0) + 100) * 1000 + variant;
        const rand = ColorUtils.seededRandom(seed);

        // Shadow
        this.drawGrassShadow(ctx, width, height);

        const centerX = width / 2;
        const baseY = height - 15;
        const bladeCount = config.bladeMin + Math.floor(rand() * (config.bladeMax - config.bladeMin));

        // Sort blades by their end position for proper layering
        const blades = [];
        for (let i = 0; i < bladeCount; i++) {
            const x = centerX + (rand() - 0.5) * width * 0.6;
            const lean = (rand() - 0.5) * 0.8;
            const h = config.heightMin + rand() * (config.heightMax - config.heightMin);
            blades.push({ x, lean, h, depth: x + lean * h });
        }

        blades.sort((a, b) => a.depth - b.depth);

        for (const blade of blades) {
            this.drawGrassBlade(ctx, blade.x, baseY, blade.lean, blade.h, config, rand);

            if (config.seeds) {
                this.drawDetailedWheatSeed(ctx, blade.x + blade.lean * blade.h, baseY - blade.h, rand);
            }
            if (config.cattails) {
                this.drawCattail(ctx, blade.x + blade.lean * blade.h, baseY - blade.h, rand);
            }
        }

        return canvas;
    },

    drawGrassShadow(ctx, width, height) {
        ctx.save();
        const gradient = ctx.createRadialGradient(
            width / 2, height - 8, 0,
            width / 2, height - 8, width * 0.4
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
        gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(width / 2, height - 8, width * 0.4, height * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawGrassBlade(ctx, x, baseY, lean, h, config, rand) {
        const w = config.thickness.min + rand() * (config.thickness.max - config.thickness.min);

        const baseColor = config.baseColors[Math.floor(rand() * config.baseColors.length)];
        const tipColor = config.tipColors[Math.floor(rand() * config.tipColors.length)];

        const endX = x + lean * h;
        const endY = baseY - h;

        // Create gradient along blade
        const grad = ctx.createLinearGradient(x, baseY, endX, endY);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(0.7, tipColor);
        grad.addColorStop(1, ColorUtils.lightenColor(tipColor, 15));

        ctx.strokeStyle = grad;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';

        // Curved blade with slight wave
        const wave = (rand() - 0.5) * 8;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.bezierCurveTo(
            x + lean * h * 0.25 + wave, baseY - h * 0.4,
            x + lean * h * 0.7 - wave * 0.5, baseY - h * 0.75,
            endX, endY
        );
        ctx.stroke();

        // Subtle highlight on one side
        if (rand() > 0.6) {
            ctx.strokeStyle = ColorUtils.lightenColor(tipColor, 25);
            ctx.lineWidth = w * 0.3;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(x + w * 0.3, baseY - h * 0.3);
            ctx.quadraticCurveTo(
                x + lean * h * 0.5 + w * 0.3, baseY - h * 0.6,
                endX, endY
            );
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    },

    drawDetailedWheatSeed(ctx, x, y, rand) {
        const seedCount = 6 + Math.floor(rand() * 4);
        const seedSize = 5 + rand() * 2;

        // Draw seed head
        for (let i = 0; i < seedCount; i++) {
            const oy = i * 3.2;
            const side = (i % 2 === 0 ? 1 : -1);
            const angle = side * (0.2 + rand() * 0.15);

            ctx.save();
            ctx.translate(x + side * 2, y + oy);
            ctx.rotate(angle);

            // Seed gradient
            const seedGrad = ctx.createLinearGradient(-seedSize, 0, seedSize, 0);
            seedGrad.addColorStop(0, '#C4A035');
            seedGrad.addColorStop(0.3, '#DAB84D');
            seedGrad.addColorStop(0.7, '#DAB84D');
            seedGrad.addColorStop(1, '#A08020');

            ctx.fillStyle = seedGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, seedSize, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Whisker/awn
            ctx.strokeStyle = '#A08020';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(seedSize * 0.8, 0);
            ctx.lineTo(seedSize * 1.5, -3 - rand() * 4);
            ctx.stroke();

            ctx.restore();
        }
    },

    drawCattail(ctx, x, y, rand) {
        const cattailHeight = 18 + rand() * 10;
        const cattailWidth = 5 + rand() * 2;

        // Brown cattail head
        const cattailGrad = ctx.createLinearGradient(x - cattailWidth, y, x + cattailWidth, y);
        cattailGrad.addColorStop(0, '#4a3020');
        cattailGrad.addColorStop(0.3, '#6a4a30');
        cattailGrad.addColorStop(0.7, '#6a4a30');
        cattailGrad.addColorStop(1, '#3a2015');

        ctx.fillStyle = cattailGrad;

        // Rounded rectangle shape
        ctx.beginPath();
        ctx.moveTo(x - cattailWidth, y + 2);
        ctx.quadraticCurveTo(x - cattailWidth, y, x, y);
        ctx.quadraticCurveTo(x + cattailWidth, y, x + cattailWidth, y + 2);
        ctx.lineTo(x + cattailWidth, y + cattailHeight - 2);
        ctx.quadraticCurveTo(x + cattailWidth, y + cattailHeight, x, y + cattailHeight);
        ctx.quadraticCurveTo(x - cattailWidth, y + cattailHeight, x - cattailWidth, y + cattailHeight - 2);
        ctx.closePath();
        ctx.fill();

        // Fuzzy texture
        ctx.fillStyle = '#5a3a25';
        for (let i = 0; i < 8; i++) {
            const fy = y + 2 + rand() * (cattailHeight - 4);
            const fx = x + (rand() - 0.5) * cattailWidth * 1.5;
            ctx.beginPath();
            ctx.arc(fx, fy, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Spike at top
        ctx.strokeStyle = '#5a7a48';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 8 - rand() * 6);
        ctx.stroke();
    }
};

window.BushGenerator = BushGenerator;
window.GrassGenerator = GrassGenerator;
