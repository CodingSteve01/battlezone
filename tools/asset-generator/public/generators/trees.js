/**
 * Realistic Tree Generator
 * Creates detailed tree sprites with tiny leaves, micro-branches, bark texture, and proper shadows
 */

const TreeGenerator = {
    types: {
        oak: {
            trunkColor: '#4a3a28',
            trunkHighlight: '#6a5a48',
            trunkShadow: '#2a1a10',
            leafColors: ['#2a5a25', '#3a6a35', '#4a7a45', '#3a5a30', '#2a4a22', '#4a6a3a', '#355a2d'],
            leafHighlight: '#5a8a55',
            leafShadow: '#1a3a15',
            shape: 'round',
            foliageDensity: 0.9,
            trunkTaper: 0.7,
            branchiness: 0.6
        },
        pine: {
            trunkColor: '#3a2a1a',
            trunkHighlight: '#5a4a38',
            trunkShadow: '#1a0a00',
            leafColors: ['#1a4a25', '#2a5a30', '#1a3a20', '#255530', '#1a4028'],
            leafHighlight: '#3a6a40',
            leafShadow: '#0a2a12',
            shape: 'cone',
            foliageDensity: 0.95,
            trunkTaper: 0.85,
            branchiness: 0.3
        },
        birch: {
            trunkColor: '#e8e0d8',
            trunkHighlight: '#ffffff',
            trunkShadow: '#c8c0b8',
            barkMarks: '#2a2a2a',
            leafColors: ['#4a8a38', '#5a9a48', '#6aaa58', '#4a7a30', '#5a8a40'],
            leafHighlight: '#7aba68',
            leafShadow: '#3a6a25',
            shape: 'oval',
            foliageDensity: 0.7,
            trunkTaper: 0.9,
            branchiness: 0.2
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
            leafColors: ['#4a7a35', '#5a8a45', '#6a9a55', '#4a6a30', '#5a7a3a'],
            leafHighlight: '#7aaa65',
            leafShadow: '#3a5a22',
            shape: 'weeping',
            foliageDensity: 0.8,
            trunkTaper: 0.7,
            branchiness: 0.7
        },
        maple: {
            trunkColor: '#4a3020',
            trunkHighlight: '#6a5040',
            trunkShadow: '#2a1008',
            leafColors: ['#3a7a30', '#4a8a40', '#2a6a25', '#5a9a50', '#3a6a28'],
            leafHighlight: '#6aaa55',
            leafShadow: '#2a5a1a',
            shape: 'round',
            foliageDensity: 0.95,
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

        // Draw shadow first (beneath tree)
        this.drawShadow(ctx, width, height, config, rand);

        // Draw grass base at bottom of tree for realistic grounding
        this.drawGrassBase(ctx, width, height, config, rand);

        // Draw trunk with bark texture
        this.drawTrunk(ctx, width, height, config, rand);

        // Draw branches (visible through and around foliage)
        this.drawBranches(ctx, width, height, config, rand);

        // Draw micro-branches extending into foliage area
        if (config.foliageDensity > 0) {
            this.drawMicroBranches(ctx, width, height, config, rand);
        }

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

        // Large elliptical shadow on ground
        const shadowWidth = width * 0.4;
        const shadowHeight = height * 0.08;
        const shadowX = width / 2 + 10;
        const shadowY = height - 10;

        // Multi-layer shadow for depth
        const gradient = ctx.createRadialGradient(
            shadowX, shadowY, 0,
            shadowX, shadowY, shadowWidth
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.25)');
        gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(shadowX, shadowY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    drawGrassBase(ctx, width, height, config, rand) {
        // Draw a small grass patch at the base of the tree for realistic grounding
        const centerX = width / 2;
        const baseY = height - 10;

        // Grass colors - natural green tones
        const grassColors = ['#4a7a3a', '#5a8a4a', '#3a6a2a', '#6a9a5a', '#4a6a35', '#5a7a40'];
        const darkGrass = '#2a4a1a';

        ctx.save();

        // Draw multiple grass blade clusters
        const clusterCount = 12 + Math.floor(rand() * 8);

        for (let cluster = 0; cluster < clusterCount; cluster++) {
            // Position clusters around the base
            const clusterX = centerX + (rand() - 0.5) * width * 0.35;
            const clusterY = baseY + (rand() - 0.5) * 10;

            // Draw several blades per cluster
            const bladeCount = 3 + Math.floor(rand() * 4);

            for (let i = 0; i < bladeCount; i++) {
                const bladeX = clusterX + (rand() - 0.5) * 8;
                const bladeHeight = 6 + rand() * 12;
                const bladeLean = (rand() - 0.5) * 6;
                const bladeWidth = 1 + rand() * 1.5;

                // Pick grass color
                const colorIdx = Math.floor(rand() * grassColors.length);
                ctx.strokeStyle = rand() > 0.3 ? grassColors[colorIdx] : darkGrass;
                ctx.lineWidth = bladeWidth;
                ctx.lineCap = 'round';

                // Draw grass blade as curved line
                ctx.beginPath();
                ctx.moveTo(bladeX, clusterY);
                ctx.quadraticCurveTo(
                    bladeX + bladeLean * 0.5,
                    clusterY - bladeHeight * 0.5,
                    bladeX + bladeLean,
                    clusterY - bladeHeight
                );
                ctx.stroke();
            }
        }

        // Add some small ground details (dirt patches, small stones)
        for (let i = 0; i < 5; i++) {
            const detailX = centerX + (rand() - 0.5) * width * 0.3;
            const detailY = baseY + rand() * 5;
            const detailSize = 1 + rand() * 2;

            ctx.fillStyle = rand() > 0.5 ? '#5a4a3a' : '#6a5a4a';
            ctx.beginPath();
            ctx.ellipse(detailX, detailY, detailSize, detailSize * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    drawTrunk(ctx, width, height, config, rand) {
        const centerX = width / 2;
        const baseY = height - 15;
        const trunkHeight = height * 0.45;
        const baseWidth = width * 0.04; // Thinner trunk
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
        ctx.lineWidth = 2; // Thinner roots to match thinner trunk
        ctx.lineCap = 'round';

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI - Math.PI / 2 + (rand() - 0.5) * 0.3;
            const rootLength = 6 + rand() * 8; // Smaller roots

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

        const branchCount = Math.floor(4 + config.branchiness * 6);

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
                const subEndX = centerX + Math.cos(angle) * length * 0.6 + Math.cos(subAngle) * subLength;
                const subEndY = y + Math.sin(angle) * length * 0.4 + Math.sin(subAngle) * subLength;
                ctx.lineTo(subEndX, subEndY);
                ctx.stroke();

                if (config.foliageDensity > 0 && rand() > 0.2) {
                    this.drawLeafCluster(ctx, subEndX, subEndY, config, rand, 10);
                }
            }

            if (config.foliageDensity > 0) {
                this.drawLeafCluster(ctx, centerX + Math.cos(angle) * length, y + Math.sin(angle) * length, config, rand, 14);
            }
        }
    },

    drawMicroBranches(ctx, width, height, config, rand) {
        // Draw a realistic network of fine branches visible through foliage
        const centerX = width / 2;
        const baseY = height - 15;
        const trunkHeight = height * 0.45;
        const foliageY = baseY - trunkHeight;
        const foliageHeight = height * 0.45;
        const foliageWidth = width * 0.42;

        // === MAIN STRUCTURAL BRANCHES (visible through gaps in foliage) ===
        // These are medium branches that support the foliage structure
        const structuralCount = 3 + Math.floor(config.branchiness * 3);

        for (let i = 0; i < structuralCount; i++) {
            const angle = (i / structuralCount) * Math.PI * 2 + rand() * 0.5;
            const startY = foliageY + foliageHeight * 0.3;

            // Main structural branch
            const length = foliageWidth * (0.5 + rand() * 0.4);
            const branchAngle = angle + (rand() - 0.5) * 0.4;
            const endX = centerX + Math.cos(branchAngle) * length;
            const endY = startY - length * 0.4 - rand() * 20;

            // Draw main branch with gradient thickness
            ctx.strokeStyle = config.trunkShadow;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.5;

            ctx.beginPath();
            ctx.moveTo(centerX, startY);
            ctx.quadraticCurveTo(
                centerX + Math.cos(branchAngle) * length * 0.4,
                startY - length * 0.2,
                endX,
                endY
            );
            ctx.stroke();

            // Secondary branches off the main structural branch
            const secondaryCount = 1 + Math.floor(rand() * 2);
            for (let j = 0; j < secondaryCount; j++) {
                const t = 0.3 + (j / secondaryCount) * 0.5;
                const branchX = centerX + Math.cos(branchAngle) * length * t;
                const branchY = startY - length * 0.2 * t - t * 15;
                const subAngle = branchAngle + (rand() - 0.5) * 1.2;
                const subLength = length * (0.3 + rand() * 0.2);

                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.moveTo(branchX, branchY);
                ctx.quadraticCurveTo(
                    branchX + Math.cos(subAngle) * subLength * 0.5,
                    branchY - subLength * 0.3,
                    branchX + Math.cos(subAngle) * subLength,
                    branchY - subLength * 0.5
                );
                ctx.stroke();

                if (config.foliageDensity > 0 && rand() > 0.3) {
                    this.drawLeafCluster(ctx, branchX + Math.cos(subAngle) * subLength * 0.7,
                        branchY - subLength * 0.35, config, rand, 6);
                }
            }

            if (config.foliageDensity > 0 && rand() > 0.2) {
                this.drawLeafCluster(ctx, endX, endY, config, rand, 10);
            }
        }

        // === FINE TWIGS throughout foliage ===
        const twigCount = 12 + Math.floor(config.branchiness * 10);

        for (let i = 0; i < twigCount; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * foliageWidth * 0.8;
            const startX = centerX + Math.cos(angle) * dist * 0.5;
            const startY = foliageY - rand() * foliageHeight * 0.6;
            const twigLength = 10 + rand() * 25;
            const twigAngle = angle + (rand() - 0.5) * 1.2;

            ctx.strokeStyle = config.trunkShadow;
            ctx.globalAlpha = 0.25 + rand() * 0.25;
            ctx.lineWidth = 0.8;

            ctx.beginPath();
            ctx.moveTo(startX, startY);

            // Curved twig
            const ctrlX = startX + Math.cos(twigAngle) * twigLength * 0.5;
            const ctrlY = startY - twigLength * 0.3;
            const endX = startX + Math.cos(twigAngle) * twigLength;
            const endY = startY - twigLength * 0.4 + Math.sin(twigAngle) * twigLength * 0.2;

            ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
            ctx.stroke();

        }

        // === PERIPHERAL TWIGS at foliage edges ===
        const edgeTwigCount = 6 + Math.floor(config.branchiness * 4);

        for (let i = 0; i < edgeTwigCount; i++) {
            const angle = (i / edgeTwigCount) * Math.PI * 2;
            const edgeDist = foliageWidth * (0.85 + rand() * 0.15);
            const x = centerX + Math.cos(angle) * edgeDist;
            const y = foliageY + Math.sin(angle) * edgeDist * 0.5;

            // Twigs pointing outward from edge
            ctx.strokeStyle = config.trunkShadow;
            ctx.globalAlpha = 0.3 + rand() * 0.2;
            ctx.lineWidth = 0.6;

            const twigLen = 8 + rand() * 12;
            ctx.beginPath();
            ctx.moveTo(x - Math.cos(angle) * 10, y - Math.sin(angle) * 5);
            ctx.lineTo(x + Math.cos(angle) * twigLen, y + Math.sin(angle) * twigLen * 0.3 - twigLen * 0.2);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    },

    drawLeafCluster(ctx, x, y, config, rand, count = 10) {
        const radius = 10 + rand() * 6;
        for (let i = 0; i < count; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = radius * (0.3 + rand() * 0.7);
            const leafX = x + Math.cos(angle) * dist;
            const leafY = y + Math.sin(angle) * dist * 0.6;
            this.drawTinyLeaf(ctx, leafX, leafY, config, rand, 0.6 + rand() * 0.3);
        }
    },

    /**
     * Draw a cluster of fine twigs at a branch endpoint
     */
    drawTwigCluster(ctx, x, y, config, rand, count) {
        ctx.strokeStyle = config.trunkShadow;
        ctx.lineCap = 'round';

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 1.5 - Math.PI * 0.75 + (rand() - 0.5) * 0.5;
            const len = 6 + rand() * 10;

            ctx.lineWidth = 0.6;
            ctx.globalAlpha = 0.3 + rand() * 0.2;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
                x + Math.cos(angle) * len,
                y + Math.sin(angle) * len * 0.3 - len * 0.7
            );
            ctx.stroke();

            // Tiny sub-twigs
            if (rand() > 0.6) {
                const midX = x + Math.cos(angle) * len * 0.6;
                const midY = y + Math.sin(angle) * len * 0.15 - len * 0.4;
                const subLen = len * 0.4;
                const subAngle = angle + (rand() - 0.5) * 1.0;

                ctx.lineWidth = 0.4;
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.moveTo(midX, midY);
                ctx.lineTo(midX + Math.cos(subAngle) * subLen, midY - subLen * 0.5);
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

        // Draw many tiny individual leaves instead of big clusters
        const leafCount = Math.floor(400 + config.foliageDensity * 300);

        // Back layer (darker, deeper leaves)
        for (let i = 0; i < leafCount * 0.4; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * foliageWidth * 0.85;
            const x = centerX + Math.cos(angle) * dist;
            const y = foliageY + Math.sin(angle) * dist * 0.65 + 10;

            this.drawTinyLeaf(ctx, x, y, config, rand, 0.3);
        }

        // Middle layer
        for (let i = 0; i < leafCount * 0.35; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * foliageWidth * 0.9;
            const x = centerX + Math.cos(angle) * dist;
            const y = foliageY + Math.sin(angle) * dist * 0.6;

            this.drawTinyLeaf(ctx, x, y, config, rand, 0.55);
        }

        // Front layer (lighter, highlight leaves)
        for (let i = 0; i < leafCount * 0.25; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * foliageWidth * 0.75;
            const x = centerX + Math.cos(angle) * dist;
            const y = foliageY + Math.sin(angle) * dist * 0.5 - 8;

            this.drawTinyLeaf(ctx, x, y, config, rand, 0.85);
        }

        // Top highlight spots
        for (let i = 0; i < 30; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * foliageWidth * 0.5;
            const x = centerX + Math.cos(angle) * dist;
            const y = foliageY - foliageHeight * 0.2 + Math.sin(angle) * dist * 0.3;

            this.drawTinyLeaf(ctx, x, y, config, rand, 1.0);
        }
    },

    drawConeFoliage(ctx, centerX, foliageY, width, height, config, rand) {
        // CONE shape: narrow at TOP, wide at BOTTOM (like a real pine tree)
        const foliageHeight = height * 0.55;
        const maxWidth = width * 0.4;

        // Draw from bottom to top in tiers
        const tiers = 8;

        for (let tier = 0; tier < tiers; tier++) {
            // tier 0 = bottom (wide), tier = tiers-1 = top (narrow)
            const t = tier / (tiers - 1);

            // Y position: start at bottom, go up
            const tierY = foliageY + foliageHeight * 0.7 - t * foliageHeight * 0.85;

            // Width: wide at bottom, narrow at top
            const tierWidth = maxWidth * (1 - t * 0.9);

            // Needle clusters for this tier
            const needlesPerTier = Math.floor(20 + (1 - t) * 25);

            for (let i = 0; i < needlesPerTier; i++) {
                const angle = (i / needlesPerTier) * Math.PI * 2 + rand() * 0.5;
                const dist = tierWidth * (0.4 + rand() * 0.6);
                const x = centerX + Math.cos(angle) * dist;
                const y = tierY + (rand() - 0.5) * 15;

                this.drawPineNeedleCluster(ctx, x, y, config, rand, t);
            }
        }

        // Top point - small cluster at the very top
        for (let i = 0; i < 8; i++) {
            const x = centerX + (rand() - 0.5) * 8;
            const y = foliageY - foliageHeight * 0.15 + (rand() - 0.5) * 10;
            this.drawPineNeedleCluster(ctx, x, y, config, rand, 0.1);
        }
    },

    drawPineNeedleCluster(ctx, x, y, config, rand, depthFactor) {
        // Draw a cluster of pine needles radiating from a point
        const needleCount = 6 + Math.floor(rand() * 6);
        const needleLength = 4 + rand() * 6;

        // Darker needles at back, lighter at front
        const colorIdx = Math.floor(rand() * config.leafColors.length);
        let color = config.leafColors[colorIdx];

        if (depthFactor > 0.7) {
            color = config.leafHighlight;
        } else if (depthFactor < 0.3) {
            color = config.leafShadow;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';

        for (let i = 0; i < needleCount; i++) {
            const angle = (i / needleCount) * Math.PI * 2 + rand() * 0.4;
            const len = needleLength * (0.7 + rand() * 0.3);

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();
        }
    },

    drawOvalFoliage(ctx, centerX, foliageY, width, height, config, rand) {
        const foliageWidth = width * 0.35;
        const foliageHeight = height * 0.4;

        // Many tiny leaves in oval shape
        const leafCount = Math.floor(300 + config.foliageDensity * 200);

        for (let layer = 0; layer < 3; layer++) {
            const layerLeaves = leafCount / 3;
            const depthFactor = (layer + 1) / 3;

            for (let i = 0; i < layerLeaves; i++) {
                const angle = rand() * Math.PI * 2;
                const distX = rand() * foliageWidth * 0.9;
                const distY = rand() * foliageHeight * 0.7;
                const x = centerX + Math.cos(angle) * distX;
                const y = foliageY + Math.sin(angle) * distY * 0.5 - layer * 8;

                this.drawTinyLeaf(ctx, x, y, config, rand, depthFactor);
            }
        }
    },

    drawWeepingFoliage(ctx, centerX, foliageY, width, height, config, rand) {
        const foliageWidth = width * 0.4;

        // Crown with tiny leaves
        const crownLeaves = 200;
        for (let i = 0; i < crownLeaves; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * foliageWidth * 0.5;
            const x = centerX + Math.cos(angle) * dist;
            const y = foliageY + Math.sin(angle) * dist * 0.4;

            this.drawTinyLeaf(ctx, x, y, config, rand, 0.6);
        }

        // Hanging branches with leaves
        const hangingCount = 18;
        for (let i = 0; i < hangingCount; i++) {
            const startAngle = (i / hangingCount) * Math.PI * 2;
            const startDist = foliageWidth * (0.35 + rand() * 0.35);
            const startX = centerX + Math.cos(startAngle) * startDist;
            const startY = foliageY + Math.sin(startAngle) * startDist * 0.25;

            const hangLength = 50 + rand() * 70;
            const curve = (rand() - 0.5) * 40;

            // Draw hanging strand
            ctx.strokeStyle = config.leafColors[Math.floor(rand() * config.leafColors.length)];
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(
                startX + curve,
                startY + hangLength * 0.6,
                startX + curve * 0.5,
                startY + hangLength
            );
            ctx.stroke();

            // Many tiny leaves along the strand
            for (let j = 0; j < 12; j++) {
                const t = j / 11;
                const leafX = startX + curve * t * (1 - t * 0.5) + (rand() - 0.5) * 5;
                const leafY = startY + hangLength * t;
                this.drawTinyLeaf(ctx, leafX, leafY, config, rand, 0.5 + t * 0.3);
            }
        }
    },

    drawTinyLeaf(ctx, x, y, config, rand, depthFactor) {
        // Very small leaf - just 2-4 pixels
        const size = 1.5 + rand() * 2.5;
        const colorIdx = Math.floor(rand() * config.leafColors.length);

        // Color based on depth
        let color;
        if (depthFactor > 0.75) {
            color = config.leafHighlight;
        } else if (depthFactor < 0.35) {
            color = config.leafShadow;
        } else {
            color = config.leafColors[colorIdx];
        }

        ctx.fillStyle = color;

        // Simple leaf shape variations
        const shapeType = Math.floor(rand() * 3);

        if (shapeType === 0) {
            // Small ellipse
            ctx.beginPath();
            ctx.ellipse(x, y, size, size * 0.6, rand() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        } else if (shapeType === 1) {
            // Tiny pointed leaf
            const rotation = rand() * Math.PI * 2;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.quadraticCurveTo(size * 0.4, 0, 0, size * 0.7);
            ctx.quadraticCurveTo(-size * 0.4, 0, 0, -size);
            ctx.fill();
            ctx.restore();
        } else {
            // Simple circle
            ctx.beginPath();
            ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
    }
};

window.TreeGenerator = TreeGenerator;
