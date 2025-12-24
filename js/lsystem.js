// ===== L-SYSTEM TREE GENERATION =====
// Lindenmayer System for procedural, realistic tree structures

/**
 * L-System rules for different tree types
 */
const TREE_RULES = {
    // Realistic deciduous tree (oak-like)
    deciduous: {
        axiom: 'X',
        rules: {
            'X': 'F[+X][-X]FX',
            'F': 'FF'
        },
        angle: 25,
        iterations: 4,
        lengthFactor: 0.7,
        lengthVariation: 0.15
    },
    // Pine/conifer tree
    pine: {
        axiom: 'X',
        rules: {
            'X': 'F[+X][-X][^X][&X]X',
            'F': 'F'
        },
        angle: 30,
        iterations: 5,
        lengthFactor: 0.75,
        lengthVariation: 0.1
    },
    // Birch tree (more vertical, delicate)
    birch: {
        axiom: 'X',
        rules: {
            'X': 'F[-X][+X]FX',
            'F': 'FF'
        },
        angle: 18,
        iterations: 4,
        lengthFactor: 0.72,
        lengthVariation: 0.12
    },
    // Willow tree (drooping branches)
    willow: {
        axiom: 'X',
        rules: {
            'X': 'F[--X][++X]F[-X]X',
            'F': 'F'
        },
        angle: 35,
        iterations: 4,
        lengthFactor: 0.68,
        lengthVariation: 0.2
    },
    // Bush/shrub (dense, low)
    bush: {
        axiom: 'X',
        rules: {
            'X': '[+FX][-FX][FX]',
            'F': 'F'
        },
        angle: 40,
        iterations: 3,
        lengthFactor: 0.65,
        lengthVariation: 0.25
    }
};

/**
 * Seeded random number generator
 */
function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

/**
 * Apply L-System rules to generate the tree string
 */
function generateLSystemString(type, seed) {
    const config = TREE_RULES[type] || TREE_RULES.deciduous;
    let current = config.axiom;

    for (let i = 0; i < config.iterations; i++) {
        let next = '';
        for (const char of current) {
            next += config.rules[char] || char;
        }
        current = next;
    }

    return current;
}

/**
 * Parse L-System string and generate branch segments
 * Returns array of segments with start, end, thickness, depth
 */
export function generateTreeStructure(type, seed, baseLength = 30) {
    const config = TREE_RULES[type] || TREE_RULES.deciduous;
    const lstring = generateLSystemString(type, seed);

    const segments = [];
    const stack = [];

    let x = 0;
    let y = 0;
    let angle = -90; // Start pointing up
    let length = baseLength;
    let thickness = 5;
    let depth = 0;
    let seedOffset = 0;

    for (const char of lstring) {
        switch (char) {
            case 'F': {
                // Draw forward - create a branch segment
                const variation = 1 + (seededRandom(seed + seedOffset++) - 0.5) * config.lengthVariation * 2;
                const segLength = length * variation;
                const rad = angle * Math.PI / 180;

                const endX = x + Math.cos(rad) * segLength;
                const endY = y + Math.sin(rad) * segLength;

                segments.push({
                    x1: x,
                    y1: y,
                    x2: endX,
                    y2: endY,
                    thickness: Math.max(1, thickness),
                    depth: depth,
                    isBranch: depth > 0
                });

                x = endX;
                y = endY;
                length *= config.lengthFactor;
                thickness *= 0.85;
                break;
            }
            case '+': {
                // Turn right
                const angleVar = (seededRandom(seed + seedOffset++) - 0.5) * 10;
                angle += config.angle + angleVar;
                break;
            }
            case '-': {
                // Turn left
                const angleVar = (seededRandom(seed + seedOffset++) - 0.5) * 10;
                angle -= config.angle + angleVar;
                break;
            }
            case '^': {
                // Slight upward tilt (3D simulation)
                angle -= config.angle * 0.5;
                break;
            }
            case '&': {
                // Slight downward tilt (3D simulation)
                angle += config.angle * 0.5;
                break;
            }
            case '[': {
                // Save state
                stack.push({ x, y, angle, length, thickness, depth });
                depth++;
                break;
            }
            case ']': {
                // Restore state
                if (stack.length > 0) {
                    const state = stack.pop();
                    x = state.x;
                    y = state.y;
                    angle = state.angle;
                    length = state.length;
                    thickness = state.thickness;
                    depth = state.depth;
                }
                break;
            }
            case 'X': {
                // Growth point - could add leaves here
                break;
            }
        }
    }

    return segments;
}

/**
 * Calculate bounding box of tree structure
 */
export function getTreeBounds(segments) {
    if (segments.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const seg of segments) {
        minX = Math.min(minX, seg.x1, seg.x2);
        maxX = Math.max(maxX, seg.x1, seg.x2);
        minY = Math.min(minY, seg.y1, seg.y2);
        maxY = Math.max(maxY, seg.y1, seg.y2);
    }

    return {
        minX, maxX, minY, maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

/**
 * Draw an L-System tree on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - Base X position
 * @param {number} y - Base Y position (ground level)
 * @param {number} size - Overall tree size
 * @param {string} type - Tree type ('deciduous', 'pine', 'birch', 'willow', 'bush')
 * @param {number} seed - Random seed for variation
 */
export function drawLSystemTree(ctx, x, y, size, type, seed) {
    const baseLength = size * 0.3;
    const segments = generateTreeStructure(type, seed, baseLength);
    const bounds = getTreeBounds(segments);

    if (bounds.height === 0) return;

    // Scale to fit desired size
    const scale = (size * 0.8) / bounds.height;

    ctx.save();
    ctx.translate(x, y);

    // Draw shadow
    ctx.fillStyle = 'rgba(0, 20, 10, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.05, size * 0.3, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sort segments by depth (draw trunk first, then branches)
    const sortedSegments = [...segments].sort((a, b) => a.depth - b.depth);

    // Draw branches
    for (const seg of sortedSegments) {
        const x1 = seg.x1 * scale;
        const y1 = seg.y1 * scale;
        const x2 = seg.x2 * scale;
        const y2 = seg.y2 * scale;
        const thick = seg.thickness * scale * 0.8;

        // Branch gradient for 3D effect
        const grad = ctx.createLinearGradient(x1 - thick, y1, x1 + thick, y1);

        if (seg.depth === 0) {
            // Trunk - darker brown
            grad.addColorStop(0, '#2a1a0f');
            grad.addColorStop(0.3, '#4a3020');
            grad.addColorStop(0.7, '#4a3020');
            grad.addColorStop(1, '#2a1a0f');
        } else {
            // Branches - lighter brown
            grad.addColorStop(0, '#3a2a1a');
            grad.addColorStop(0.5, '#5a4030');
            grad.addColorStop(1, '#3a2a1a');
        }

        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, thick);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // Add foliage clusters at branch endpoints
    const leafColor = getLeafColor(type, seed);
    const endpoints = segments.filter(s => s.depth >= 2);

    // Draw foliage in layers for depth effect (back to front)
    for (let layer = 0; layer < 3; layer++) {
        const layerAlpha = 0.7 + layer * 0.15;
        const layerOffset = (2 - layer) * size * 0.02;

        for (let i = 0; i < endpoints.length; i++) {
            const seg = endpoints[i];
            const baseLx = seg.x2 * scale;
            const baseLy = seg.y2 * scale - layerOffset;
            const clusterSize = size * (0.06 + seededRandom(seed + i * 7) * 0.04);

            // Draw multiple small leaves per cluster
            const leafCount = type === 'pine' ? 8 : 5;

            for (let j = 0; j < leafCount; j++) {
                const angle = seededRandom(seed + i * 100 + j * 17 + layer) * Math.PI * 2;
                const dist = seededRandom(seed + i * 100 + j * 23 + layer) * clusterSize * 0.8;
                const lx = baseLx + Math.cos(angle) * dist;
                const ly = baseLy + Math.sin(angle) * dist * 0.6; // Flatten vertically

                const leafW = clusterSize * (0.3 + seededRandom(seed + i * 50 + j * 31) * 0.3);
                const leafH = type === 'pine'
                    ? leafW * 0.3  // Pine needles are thin
                    : leafW * (0.5 + seededRandom(seed + i * 50 + j * 37) * 0.3);
                const leafAngle = seededRandom(seed + i * 50 + j * 41) * Math.PI;

                // Color variation per leaf
                const colorVar = seededRandom(seed + i * 50 + j * 47);
                let leafFill;
                if (colorVar < 0.3) {
                    leafFill = leafColor.light;
                } else if (colorVar < 0.7) {
                    leafFill = leafColor.mid;
                } else {
                    leafFill = leafColor.dark;
                }

                ctx.save();
                ctx.translate(lx, ly);
                ctx.rotate(leafAngle);
                ctx.globalAlpha = layerAlpha * (0.7 + seededRandom(seed + i + j) * 0.3);
                ctx.fillStyle = leafFill;
                ctx.beginPath();

                if (type === 'pine') {
                    // Pine needles - thin elongated shapes
                    ctx.ellipse(0, 0, leafW, leafH, 0, 0, Math.PI * 2);
                } else {
                    // Deciduous leaves - more organic leaf shape
                    drawLeafShape(ctx, leafW, leafH);
                }

                ctx.fill();
                ctx.restore();
            }
        }
    }

    ctx.restore();
}

/**
 * Draw an organic leaf shape (pointed oval)
 */
function drawLeafShape(ctx, w, h) {
    ctx.moveTo(w, 0);
    ctx.bezierCurveTo(w, h * 0.5, w * 0.3, h, 0, h * 1.2);
    ctx.bezierCurveTo(-w * 0.3, h, -w, h * 0.5, -w, 0);
    ctx.bezierCurveTo(-w, -h * 0.5, -w * 0.3, -h, 0, -h * 1.2);
    ctx.bezierCurveTo(w * 0.3, -h, w, -h * 0.5, w, 0);
}

/**
 * Get leaf colors based on tree type
 */
function getLeafColor(type, seed) {
    const season = seededRandom(seed + 999);

    // Base green colors
    let base = { r: 40, g: 90, b: 45 };

    if (type === 'pine') {
        base = { r: 25, g: 60, b: 35 }; // Darker green
    } else if (type === 'birch') {
        base = { r: 55, g: 100, b: 50 }; // Lighter green
    } else if (type === 'willow') {
        base = { r: 70, g: 110, b: 55 }; // Yellow-green
    }

    // Occasional autumn colors
    if (season > 0.85 && type !== 'pine') {
        const autumnType = seededRandom(seed + 1000);
        if (autumnType < 0.3) {
            base = { r: 180, g: 80, b: 30 }; // Orange
        } else if (autumnType < 0.6) {
            base = { r: 150, g: 50, b: 40 }; // Red
        } else {
            base = { r: 200, g: 160, b: 40 }; // Yellow
        }
    }

    return {
        light: `rgb(${base.r + 30}, ${base.g + 40}, ${base.b + 20})`,
        mid: `rgb(${base.r}, ${base.g}, ${base.b})`,
        dark: `rgb(${base.r - 20}, ${base.g - 25}, ${base.b - 15})`
    };
}

/**
 * Get available tree types
 */
export function getTreeTypes() {
    return Object.keys(TREE_RULES);
}
