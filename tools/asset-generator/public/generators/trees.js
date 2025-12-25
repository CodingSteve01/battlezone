/**
 * L-System Tree Generator (Browser)
 */

const TreeGenerator = {
    types: {
        oak: {
            axiom: 'F',
            rules: { 'F': 'FF+[+F-F-F]-[-F+F+F]' },
            iterations: 4,
            angle: 22.5,
            lengthFactor: 0.65,
            leafDensity: 0.8,
            leafColor: { h: 120, s: 45, l: 35 },
            barkColor: '#5D4037',
            branchWidth: 1.2
        },
        pine: {
            axiom: 'F',
            rules: { 'F': 'FF[++F][-F][+F][-F][F]' },
            iterations: 4,
            angle: 30,
            lengthFactor: 0.55,
            leafDensity: 0.9,
            leafColor: { h: 140, s: 50, l: 25 },
            barkColor: '#4E342E',
            branchWidth: 0.9,
            isPine: true
        },
        birch: {
            axiom: 'F',
            rules: { 'F': 'F[+F]F[-F]F' },
            iterations: 4,
            angle: 25,
            lengthFactor: 0.6,
            leafDensity: 0.6,
            leafColor: { h: 90, s: 50, l: 45 },
            barkColor: '#E8E8E8',
            branchWidth: 0.7
        },
        dead: {
            axiom: 'F',
            rules: { 'F': 'FF[+F][-F][F]' },
            iterations: 3,
            angle: 35,
            lengthFactor: 0.7,
            leafDensity: 0,
            barkColor: '#5D4037',
            branchWidth: 1.0
        },
        willow: {
            axiom: 'F',
            rules: { 'F': 'F[+F][--F][-F][++F]' },
            iterations: 4,
            angle: 15,
            lengthFactor: 0.7,
            leafDensity: 0.7,
            leafColor: { h: 100, s: 40, l: 40 },
            barkColor: '#6D4C41',
            branchWidth: 0.8,
            drooping: true
        },
        maple: {
            axiom: 'F',
            rules: { 'F': 'F[+F][-F]F[++F][--F]' },
            iterations: 4,
            angle: 28,
            lengthFactor: 0.58,
            leafDensity: 0.85,
            leafColor: { h: 110, s: 55, l: 38 },
            barkColor: '#5D4037',
            branchWidth: 1.1
        }
    },

    generateLSystem(axiom, rules, iterations) {
        let result = axiom;
        for (let i = 0; i < iterations; i++) {
            let next = '';
            for (const char of result) {
                next += rules[char] || char;
            }
            result = next;
        }
        return result;
    },

    generate(type, variant, width = 256, height = 380) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);

        const config = this.types[type] || this.types.oak;
        const seed = type.charCodeAt(0) * 1000 + variant;
        const rand = ColorUtils.seededRandom(seed);

        const lsystem = this.generateLSystem(config.axiom, config.rules, config.iterations);
        this.drawTree(ctx, lsystem, config, rand, variant, width, height);

        return canvas;
    },

    drawTree(ctx, lsystem, config, rand, variant, width, height) {
        const startX = width / 2;
        const startY = height - 10;
        const initialLength = height * 0.12;
        const initialWidth = 6 * config.branchWidth;

        const stack = [];
        let x = startX;
        let y = startY;
        let angle = -90;
        let length = initialLength;
        let lineWidth = initialWidth;
        let depth = 0;

        const branches = [];
        const leaves = [];
        const angleVariation = (rand() - 0.5) * 8;

        for (const char of lsystem) {
            switch (char) {
                case 'F': {
                    const rad = (angle + angleVariation * rand()) * Math.PI / 180;
                    const windSway = Math.sin(variant * 0.5) * 2 * (depth / 5);
                    const newX = x + Math.cos(rad) * length + windSway;
                    const newY = y + Math.sin(rad) * length;

                    branches.push({
                        x1: x, y1: y, x2: newX, y2: newY,
                        width: lineWidth, depth,
                        color: this.getBranchColor(config.barkColor, depth, rand)
                    });

                    if (depth > 2 && config.leafDensity > 0 && rand() < config.leafDensity) {
                        leaves.push({
                            x: newX, y: newY,
                            size: 12 + rand() * 16,
                            color: this.getLeafColor(config.leafColor, rand),
                            isPine: config.isPine,
                            depth
                        });
                    }

                    x = newX;
                    y = newY;
                    break;
                }
                case '+':
                    angle += config.angle * (0.8 + rand() * 0.4);
                    if (config.drooping) angle += 4;
                    break;
                case '-':
                    angle -= config.angle * (0.8 + rand() * 0.4);
                    if (config.drooping) angle += 2;
                    break;
                case '[':
                    stack.push({ x, y, angle, length, lineWidth, depth });
                    length *= config.lengthFactor;
                    lineWidth *= 0.7;
                    depth++;
                    break;
                case ']':
                    if (stack.length > 0) {
                        const state = stack.pop();
                        x = state.x;
                        y = state.y;
                        angle = state.angle;
                        length = state.length;
                        lineWidth = state.lineWidth;
                        depth = state.depth;
                    }
                    break;
            }
        }

        // Sort by depth
        branches.sort((a, b) => a.depth - b.depth);
        leaves.sort((a, b) => a.depth - b.depth);

        // Draw shadow
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.translate(4, 4);
        for (const branch of branches) {
            this.drawBranch(ctx, branch, '#000000');
        }
        ctx.restore();

        // Draw branches
        for (const branch of branches) {
            this.drawBranch(ctx, branch, branch.color);
        }

        // Draw leaves
        for (const leaf of leaves) {
            this.drawLeaf(ctx, leaf, rand);
        }
    },

    drawBranch(ctx, branch, color) {
        ctx.beginPath();
        ctx.moveTo(branch.x1, branch.y1);
        ctx.lineTo(branch.x2, branch.y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, branch.width);
        ctx.lineCap = 'round';
        ctx.stroke();
    },

    drawLeaf(ctx, leaf, rand) {
        ctx.save();

        if (leaf.isPine) {
            const needleCount = 6 + Math.floor(rand() * 6);
            for (let i = 0; i < needleCount; i++) {
                const angle = (i / needleCount) * Math.PI * 2 + rand() * 0.3;
                const len = leaf.size * (0.4 + rand() * 0.4);
                ctx.beginPath();
                ctx.moveTo(leaf.x, leaf.y);
                ctx.lineTo(leaf.x + Math.cos(angle) * len, leaf.y + Math.sin(angle) * len);
                ctx.strokeStyle = leaf.color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        } else {
            for (let i = 0; i < 4; i++) {
                const ox = (rand() - 0.5) * leaf.size * 0.4;
                const oy = (rand() - 0.5) * leaf.size * 0.4;
                const size = leaf.size * (0.35 + rand() * 0.35);

                const grad = ctx.createRadialGradient(
                    leaf.x + ox - size * 0.2, leaf.y + oy - size * 0.2, 0,
                    leaf.x + ox, leaf.y + oy, size
                );
                grad.addColorStop(0, ColorUtils.lightenColor(leaf.color, 25));
                grad.addColorStop(0.5, leaf.color);
                grad.addColorStop(1, ColorUtils.darkenColor(leaf.color, 20));

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(leaf.x + ox, leaf.y + oy, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    },

    getBranchColor(baseColor, depth, rand) {
        return ColorUtils.darkenColor(baseColor, depth * 4 + rand() * 8);
    },

    getLeafColor(baseHSL, rand) {
        const h = baseHSL.h + (rand() - 0.5) * 18;
        const s = baseHSL.s + (rand() - 0.5) * 12;
        const l = baseHSL.l + (rand() - 0.5) * 12;
        const [r, g, b] = ColorUtils.hslToRgb(h / 360, s / 100, l / 100);
        return ColorUtils.rgbToHex(r, g, b);
    }
};

window.TreeGenerator = TreeGenerator;
