/**
 * Realistic Tree Generator
 * Creates detailed tree sprites with proper foliage, bark texture, and shading
 */

const TreeGenerator = {
    types: {
        oak: {
            trunkColor: '#4a3a28',
            trunkHighlight: '#6a5a48',
            trunkShadow: '#2a1a10',
            leafColors: ['#3a6a35', '#4a7a45', '#5a8a55', '#2a5a28'],
            leafHighlight: '#6a9a65',
            leafShadow: '#1a4a18',
            shape: 'round',
            foliageDensity: 0.85,
            trunkTaper: 0.7,
            branchiness: 0.6
        },
        pine: {
            trunkColor: '#3a2a1a',
            trunkHighlight: '#5a4a38',
            trunkShadow: '#1a0a00',
            leafColors: ['#2a5a30', '#3a6a40', '#1a4a28', '#2a5535'],
            leafHighlight: '#4a7a50',
            leafShadow: '#0a3a18',
            shape: 'cone',
            foliageDensity: 0.9,
            trunkTaper: 0.85,
            branchiness: 0.3
        },
        birch: {
            trunkColor: '#e8e0d8',
            trunkHighlight: '#ffffff',
            trunkShadow: '#c8c0b8',
            barkMarks: '#2a2a2a',
            leafColors: ['#5a9a48', '#6aaa58', '#7aba68', '#4a8a38'],
            leafHighlight: '#8aca78',
            leafShadow: '#3a7a28',
            shape: 'oval',
            foliageDensity: 0.65,
            trunkTaper: 0.9,
            branchiness: 0.5
        },
        dead: {
            trunkColor: '#5a4a38',
            trunkHighlight: '#7a6a58',
            trunkShadow: '#2a1a08',
            leafColors: [],
            shape: 'bare',
            foliageDensity: 0,
            trunkTaper: 0.75,
            branchiness: 0.8
        },
        willow: {
            trunkColor: '#4a3a28',
            trunkHighlight: '#6a5a48',
            trunkShadow: '#2a1a10',
            leafColors: ['#5a8a45', '#6a9a55', '#7aaa65', '#4a7a35'],
            leafHighlight: '#8aba75',
            leafShadow: '#3a6a25',
            shape: 'weeping',
            foliageDensity: 0.75,
            trunkTaper: 0.7,
            branchiness: 0.7
        },
        maple: {
            trunkColor: '#4a3020',
            trunkHighlight: '#6a5040',
            trunkShadow: '#2a1008',
            leafColors: ['#4a8a40', '#5a9a50', '#3a7a30', '#6aaa60'],
            leafHighlight: '#7aba70',
            leafShadow: '#2a6a20',
            shape: 'round',
            foliageDensity: 0.9,
            trunkTaper: 0.65,
            branchiness: 0.55
        }
    },

    generate(type, variant, width = 256, height = 380) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);

        const config = this.types[type] || this.types.oak;
        const seed = type.charCodeAt(0) * 1000 + variant;
        const rand = this.seededRandom(seed);

        // Draw shadow
        this.drawShadow(ctx, width, height, config, rand);

        // Draw trunk with bark texture
        this.drawTrunk(ctx, width, height, config, rand);

        // Draw branches
        this.drawBranches(ctx, width, height, config, rand);

        // Draw foliage if not dead tree
        if (config.foliageDensity > 0) {
            this.drawFoliage(ctx, width, height, config, rand);
        }

        return canvas;
    },

    seededRandom(seed) {
        return function () {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    },

    drawShadow(ctx, width, height, config, rand) {
        ctx.save();
        ctx.globalAlpha = 0.25;

        const shadowWidth = width * 0.35;
        const shadowHeight = height * 0.06;

        const gradient = ctx.createRadialGradient(
            width / 2 + 8, height - 12, 0,
            width / 2 + 8, height - 12, shadowWidth
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0.5)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(width / 2 + 8, height - 12, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    drawTrunk(ctx, width, height, config, rand) {
        const centerX = width / 2;
        const baseY = height - 15;
        const trunkHeight = height * 0.45;
        const baseWidth = width * 0.08;
        const topWidth = baseWidth * config.trunkTaper;

        // Main trunk gradient
        const trunkGradient = ctx.createLinearGradient(
            centerX - baseWidth, baseY,
            centerX + baseWidth, baseY - trunkHeight
        );
        trunkGradient.addColorStop(0, config.trunkShadow);
        trunkGradient.addColorStop(0.3, config.trunkColor);
        trunkGradient.addColorStop(0.6, config.trunkHighlight);
        trunkGradient.addColorStop(0.8, config.trunkColor);
        trunkGradient.addColorStop(1, config.trunkShadow);

        // Draw tapered trunk
        ctx.beginPath();
        ctx.moveTo(centerX - baseWidth, baseY);
        ctx.lineTo(centerX - topWidth, baseY - trunkHeight);
        ctx.lineTo(centerX + topWidth, baseY - trunkHeight);
        ctx.lineTo(centerX + baseWidth, baseY);
        ctx.closePath();
        ctx.fillStyle = trunkGradient;
        ctx.fill();

        // Bark texture
        this.drawBarkTexture(ctx, centerX, baseY, baseWidth, topWidth, trunkHeight, config, rand);

        // Birch-specific bark marks
        if (config.barkMarks) {
            ctx.fillStyle = config.barkMarks;
            for (let i = 0; i < 12; i++) {
                const y = baseY - rand() * trunkHeight * 0.9;
                const markWidth = 2 + rand() * 6;
                const markHeight = 1 + rand() * 2;
                const xOffset = (rand() - 0.5) * baseWidth * 1.2;

                ctx.beginPath();
                ctx.ellipse(centerX + xOffset, y, markWidth, markHeight, rand() * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Trunk highlight (left side light)
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(centerX - baseWidth * 0.8, baseY);
        ctx.quadraticCurveTo(centerX - baseWidth * 0.9, baseY - trunkHeight * 0.5, centerX - topWidth * 0.8, baseY - trunkHeight);
        ctx.lineTo(centerX - topWidth * 0.4, baseY - trunkHeight);
        ctx.quadraticCurveTo(centerX - baseWidth * 0.5, baseY - trunkHeight * 0.5, centerX - baseWidth * 0.4, baseY);
        ctx.closePath();
        ctx.fill();

        // Roots at base
        this.drawRoots(ctx, centerX, baseY, baseWidth, config, rand);
    },

    drawBarkTexture(ctx, centerX, baseY, baseWidth, topWidth, trunkHeight, config, rand) {
        ctx.strokeStyle = config.trunkShadow;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.3;

        // Vertical bark lines
        for (let i = 0; i < 8; i++) {
            const xOffset = (i / 7 - 0.5) * baseWidth * 1.6;
            const startX = centerX + xOffset;
            const endXOffset = xOffset * (topWidth / baseWidth);

            ctx.beginPath();
            ctx.moveTo(startX, baseY - rand() * 10);

            let y = baseY;
            while (y > baseY - trunkHeight) {
                const nextY = y - 10 - rand() * 15;
                const wobble = (rand() - 0.5) * 2;
                const t = (baseY - y) / trunkHeight;
                const currentX = centerX + xOffset * (1 - t) + endXOffset * t + wobble;

                ctx.lineTo(currentX, nextY);
                y = nextY;
            }
            ctx.stroke();
        }

        // Horizontal bark texture
        for (let i = 0; i < 15; i++) {
            const y = baseY - rand() * trunkHeight * 0.95;
            const t = (baseY - y) / trunkHeight;
            const widthAtY = baseWidth * (1 - t) + topWidth * t;

            ctx.beginPath();
            ctx.moveTo(centerX - widthAtY * (0.3 + rand() * 0.5), y);
            ctx.lineTo(centerX + widthAtY * (0.3 + rand() * 0.5), y + (rand() - 0.5) * 3);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    },

    drawRoots(ctx, centerX, baseY, baseWidth, config, rand) {
        ctx.strokeStyle = config.trunkColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI - Math.PI / 2 + (rand() - 0.5) * 0.3;
            const rootLength = 8 + rand() * 12;

            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(angle + Math.PI / 2) * baseWidth * 0.7, baseY - 2);
            ctx.quadraticCurveTo(
                centerX + Math.cos(angle) * rootLength * 0.5,
                baseY + 3,
                centerX + Math.cos(angle) * rootLength,
                baseY + 5 + rand() * 3
            );
            ctx.stroke();
        }
    },

    drawBranches(ctx, width, height, config, rand) {
        const centerX = width / 2;
        const baseY = height - 15;
        const trunkHeight = height * 0.45;
        const branchStartY = baseY - trunkHeight * 0.4;

        const branchCount = Math.floor(4 + config.branchiness * 8);

        for (let i = 0; i < branchCount; i++) {
            const t = (i + 0.5) / branchCount;
            const y = branchStartY - t * trunkHeight * 0.5;
            const side = i % 2 === 0 ? 1 : -1;
            const angle = side * (0.3 + rand() * 0.4);
            const length = 20 + rand() * 40;

            // Main branch
            const branchGradient = ctx.createLinearGradient(
                centerX, y,
                centerX + Math.cos(angle) * length, y + Math.sin(angle) * length
            );
            branchGradient.addColorStop(0, config.trunkColor);
            branchGradient.addColorStop(1, config.trunkShadow);

            ctx.strokeStyle = branchGradient;
            ctx.lineWidth = 4 - t * 2;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(centerX + side * 2, y);
            ctx.quadraticCurveTo(
                centerX + Math.cos(angle) * length * 0.5,
                y + Math.sin(angle) * length * 0.3 - 5,
                centerX + Math.cos(angle) * length,
                y + Math.sin(angle) * length
            );
            ctx.stroke();

            // Sub-branches
            if (rand() > 0.4) {
                const subAngle = angle + side * (0.2 + rand() * 0.3);
                const subLength = length * 0.5;
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.moveTo(centerX + Math.cos(angle) * length * 0.6, y + Math.sin(angle) * length * 0.4);
                ctx.lineTo(
                    centerX + Math.cos(angle) * length * 0.6 + Math.cos(subAngle) * subLength,
                    y + Math.sin(angle) * length * 0.4 + Math.sin(subAngle) * subLength
                );
                ctx.stroke();
            }
        }
    },

    drawFoliage(ctx, width, height, config, rand) {
        const centerX = width / 2;
        const baseY = height - 15;
        const trunkHeight = height * 0.45;
        const foliageY = baseY - trunkHeight - height * 0.1;

        switch (config.shape) {
            case 'round':
                this.drawRoundFoliage(ctx, centerX, foliageY, width, height, config, rand);
                break;
            case 'cone':
                this.drawConeFoliage(ctx, centerX, foliageY, width, height, config, rand);
                break;
            case 'oval':
                this.drawOvalFoliage(ctx, centerX, foliageY, width, height, config, rand);
                break;
            case 'weeping':
                this.drawWeepingFoliage(ctx, centerX, foliageY, width, height, config, rand);
                break;
        }
    },

    drawRoundFoliage(ctx, centerX, foliageY, width, height, config, rand) {
        const foliageWidth = width * 0.42;
        const foliageHeight = height * 0.45;

        // Multiple layers of leaf clusters for depth
        const layers = 4;

        for (let layer = 0; layer < layers; layer++) {
            const layerOffset = (layer - layers / 2) * 8;
            const layerScale = 1 - Math.abs(layer - layers / 2) * 0.1;

            const clusterCount = Math.floor(15 + config.foliageDensity * 20);

            for (let i = 0; i < clusterCount; i++) {
                const angle = rand() * Math.PI * 2;
                const dist = rand() * foliageWidth * layerScale * 0.9;
                const x = centerX + Math.cos(angle) * dist;
                const y = foliageY + Math.sin(angle) * dist * 0.7 + layerOffset;

                this.drawLeafCluster(ctx, x, y, config, rand, layer / layers);
            }
        }

        // Add highlights on top
        this.drawFoliageHighlights(ctx, centerX, foliageY - foliageHeight * 0.3, foliageWidth * 0.6, foliageHeight * 0.4, config, rand);
    },

    drawConeFoliage(ctx, centerX, foliageY, width, height, config, rand) {
        const foliageHeight = height * 0.55;
        const baseWidth = width * 0.35;

        // Draw cone-shaped foliage in tiers
        const tiers = 6;

        for (let tier = 0; tier < tiers; tier++) {
            const t = tier / (tiers - 1);
            const tierY = foliageY + t * foliageHeight * 0.8;
            const tierWidth = baseWidth * (1 - t * 0.85);
            const tierHeight = foliageHeight / tiers * 1.2;

            // Multiple clusters per tier
            const clustersPerTier = Math.floor(6 + (1 - t) * 8);

            for (let i = 0; i < clustersPerTier; i++) {
                const angle = (i / clustersPerTier) * Math.PI * 2 + rand() * 0.3;
                const dist = tierWidth * (0.5 + rand() * 0.5);
                const x = centerX + Math.cos(angle) * dist;
                const y = tierY - tierHeight * 0.3 + rand() * tierHeight * 0.6;

                this.drawPineNeedles(ctx, x, y, config, rand, t);
            }
        }

        // Top point
        for (let i = 0; i < 5; i++) {
            this.drawPineNeedles(ctx, centerX + (rand() - 0.5) * 10, foliageY - foliageHeight * 0.15 + rand() * 15, config, rand, 0);
        }
    },

    drawOvalFoliage(ctx, centerX, foliageY, width, height, config, rand) {
        const foliageWidth = width * 0.35;
        const foliageHeight = height * 0.4;

        // Oval shape with looser clusters
        const layers = 3;

        for (let layer = 0; layer < layers; layer++) {
            const clusterCount = Math.floor(12 + config.foliageDensity * 15);

            for (let i = 0; i < clusterCount; i++) {
                const angle = rand() * Math.PI * 2;
                const distX = rand() * foliageWidth * 0.9;
                const distY = rand() * foliageHeight * 0.7;
                const x = centerX + Math.cos(angle) * distX;
                const y = foliageY + Math.sin(angle) * distY * 0.5 - layer * 10;

                this.drawLeafCluster(ctx, x, y, config, rand, layer / layers);
            }
        }

        this.drawFoliageHighlights(ctx, centerX, foliageY - foliageHeight * 0.25, foliageWidth * 0.5, foliageHeight * 0.35, config, rand);
    },

    drawWeepingFoliage(ctx, centerX, foliageY, width, height, config, rand) {
        const foliageWidth = width * 0.4;

        // Crown clusters
        for (let i = 0; i < 20; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * foliageWidth * 0.6;
            const x = centerX + Math.cos(angle) * dist;
            const y = foliageY + Math.sin(angle) * dist * 0.4;

            this.drawLeafCluster(ctx, x, y, config, rand, 0.5);
        }

        // Hanging branches with leaves
        const hangingCount = 15;
        for (let i = 0; i < hangingCount; i++) {
            const startAngle = (i / hangingCount) * Math.PI * 2;
            const startDist = foliageWidth * (0.4 + rand() * 0.4);
            const startX = centerX + Math.cos(startAngle) * startDist;
            const startY = foliageY + Math.sin(startAngle) * startDist * 0.3;

            const hangLength = 40 + rand() * 60;
            const curve = (rand() - 0.5) * 30;

            // Draw hanging strand
            ctx.strokeStyle = config.leafColors[Math.floor(rand() * config.leafColors.length)];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(
                startX + curve,
                startY + hangLength * 0.6,
                startX + curve * 0.5,
                startY + hangLength
            );
            ctx.stroke();

            // Leaves along the strand
            for (let j = 0; j < 6; j++) {
                const t = j / 5;
                const leafX = startX + curve * t * (1 - t * 0.5);
                const leafY = startY + hangLength * t;
                this.drawSmallLeaf(ctx, leafX, leafY, config, rand);
            }
        }
    },

    drawLeafCluster(ctx, x, y, config, rand, depthFactor) {
        const size = 12 + rand() * 18;
        const colorIdx = Math.floor(rand() * config.leafColors.length);
        const baseColor = config.leafColors[colorIdx];

        // Main cluster (radial gradient)
        const gradient = ctx.createRadialGradient(
            x - size * 0.2, y - size * 0.2, 0,
            x, y, size
        );

        // Adjust colors based on depth
        const lightColor = depthFactor < 0.5 ? config.leafHighlight : baseColor;
        const darkColor = depthFactor > 0.5 ? config.leafShadow : baseColor;

        gradient.addColorStop(0, lightColor);
        gradient.addColorStop(0.4, baseColor);
        gradient.addColorStop(1, darkColor);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        // Add texture with smaller sub-clusters
        for (let i = 0; i < 4; i++) {
            const subAngle = rand() * Math.PI * 2;
            const subDist = rand() * size * 0.5;
            const subX = x + Math.cos(subAngle) * subDist;
            const subY = y + Math.sin(subAngle) * subDist;
            const subSize = size * (0.25 + rand() * 0.25);

            ctx.fillStyle = rand() > 0.5 ? lightColor : baseColor;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(subX, subY, subSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;

        // Individual leaf shapes on edges
        if (rand() > 0.6) {
            for (let i = 0; i < 3; i++) {
                const leafAngle = rand() * Math.PI * 2;
                const leafDist = size * 0.8;
                this.drawSmallLeaf(ctx, x + Math.cos(leafAngle) * leafDist, y + Math.sin(leafAngle) * leafDist, config, rand);
            }
        }
    },

    drawSmallLeaf(ctx, x, y, config, rand) {
        const size = 3 + rand() * 4;
        const rotation = rand() * Math.PI;
        const colorIdx = Math.floor(rand() * config.leafColors.length);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        ctx.fillStyle = config.leafColors[colorIdx];
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.quadraticCurveTo(size * 0.5, -size * 0.3, size * 0.3, size * 0.3);
        ctx.quadraticCurveTo(0, size * 0.5, -size * 0.3, size * 0.3);
        ctx.quadraticCurveTo(-size * 0.5, -size * 0.3, 0, -size);
        ctx.fill();

        ctx.restore();
    },

    drawPineNeedles(ctx, x, y, config, rand, depthFactor) {
        const colorIdx = Math.floor(rand() * config.leafColors.length);
        const color = depthFactor < 0.5 ? config.leafHighlight : config.leafColors[colorIdx];

        const needleCount = 8 + Math.floor(rand() * 8);
        const needleLength = 8 + rand() * 12;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';

        for (let i = 0; i < needleCount; i++) {
            const angle = (i / needleCount) * Math.PI * 2 + rand() * 0.3;
            const length = needleLength * (0.6 + rand() * 0.4);

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
            ctx.stroke();
        }

        // Center cluster
        ctx.fillStyle = config.leafShadow;
        ctx.beginPath();
        ctx.arc(x, y, 2 + rand() * 2, 0, Math.PI * 2);
        ctx.fill();
    },

    drawFoliageHighlights(ctx, x, y, width, height, config, rand) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.ellipse(x - width * 0.2, y - height * 0.1, width * 0.4, height * 0.3, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }
};

window.TreeGenerator = TreeGenerator;
