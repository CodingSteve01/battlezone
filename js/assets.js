// ===== ASSET MANAGEMENT & TEXTURES =====

// Pre-rendered texture canvases for performance
const textureCache = new Map();
const TEXTURE_SIZE = 128;

// Perlin-like noise for realistic textures
function noise2D(x, y, seed = 0) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
}

function smoothNoise(x, y, seed = 0) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;

    const v00 = noise2D(x0, y0, seed);
    const v10 = noise2D(x0 + 1, y0, seed);
    const v01 = noise2D(x0, y0 + 1, seed);
    const v11 = noise2D(x0 + 1, y0 + 1, seed);

    const i1 = v00 * (1 - fx) + v10 * fx;
    const i2 = v01 * (1 - fx) + v11 * fx;

    return i1 * (1 - fy) + i2 * fy;
}

function fractalNoise(x, y, octaves = 4, seed = 0) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += smoothNoise(x * frequency, y * frequency, seed + i * 100) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / maxValue;
}

/**
 * Initialize all textures
 */
export function initTextures() {
    createGrassTexture();
    createForestTexture();
    createRockTexture();
    createWaterTexture();
    createSandTexture();
    createSwampTexture();
    // New terrain textures
    createSnowTexture();
    createIceTexture();
    createDeepwaterTexture();
    createFlowersTexture();
    createWheatTexture();
    createMudTexture();
    createGravelTexture();
    createRuinsTexture();
    createHeatherTexture();
    createMossTexture();
}

/**
 * Get a cached texture pattern
 */
export function getTexture(type) {
    return textureCache.get(type);
}

/**
 * Create realistic grass texture
 */
function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Base green with variation
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 20, y / 20, 4, 1);
            const r = Math.floor(40 + n * 30);
            const g = Math.floor(90 + n * 50);
            const b = Math.floor(50 + n * 25);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Add grass blades
    for (let i = 0; i < 300; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const height = 3 + Math.random() * 8;
        const lean = (Math.random() - 0.5) * 3;

        const shade = 0.6 + Math.random() * 0.4;
        ctx.strokeStyle = `rgba(${Math.floor(30 * shade)}, ${Math.floor(100 * shade)}, ${Math.floor(40 * shade)}, 0.8)`;
        ctx.lineWidth = 0.5 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + lean * 0.5, y - height * 0.5, x + lean, y - height);
        ctx.stroke();
    }

    // Add small highlights
    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(150, 200, 100, ${0.1 + Math.random() * 0.15})`;
        ctx.beginPath();
        ctx.arc(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 1 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('grass', canvas);
}

/**
 * Create realistic forest floor texture
 */
function createForestTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Dark forest floor base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 15, y / 15, 5, 2);
            const r = Math.floor(30 + n * 25);
            const g = Math.floor(55 + n * 35);
            const b = Math.floor(30 + n * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Add fallen leaves
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const size = 2 + Math.random() * 4;
        const hue = Math.random() < 0.5 ?
            `rgba(${60 + Math.random() * 40}, ${40 + Math.random() * 30}, ${20}, 0.6)` :
            `rgba(${30 + Math.random() * 30}, ${50 + Math.random() * 30}, ${25}, 0.5)`;
        ctx.fillStyle = hue;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Add twigs
    for (let i = 0; i < 20; i++) {
        ctx.strokeStyle = `rgba(60, 45, 30, ${0.4 + Math.random() * 0.3})`;
        ctx.lineWidth = 1 + Math.random();
        ctx.beginPath();
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20);
        ctx.stroke();
    }

    // Tree shadows
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(0, 20, 10, 0.3)';
        ctx.beginPath();
        ctx.ellipse(
            30 + Math.random() * 68,
            30 + Math.random() * 68,
            15 + Math.random() * 15,
            10 + Math.random() * 10,
            Math.random() * Math.PI,
            0, Math.PI * 2
        );
        ctx.fill();
    }

    textureCache.set('forest', canvas);
}

/**
 * Create realistic rock texture
 */
function createRockTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Stone base with layers
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n1 = fractalNoise(x / 25, y / 25, 4, 3);
            const n2 = fractalNoise(x / 10, y / 10, 3, 4);
            const combined = n1 * 0.7 + n2 * 0.3;
            const base = 70 + combined * 50;
            const r = Math.floor(base);
            const g = Math.floor(base * 0.95);
            const b = Math.floor(base * 1.05);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Add cracks
    ctx.strokeStyle = 'rgba(40, 40, 50, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        let x = Math.random() * TEXTURE_SIZE;
        let y = Math.random() * TEXTURE_SIZE;
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
            x += (Math.random() - 0.5) * 20;
            y += (Math.random() - 0.5) * 20;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Add highlights
    for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(180, 180, 190, ${0.1 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 1 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Dark spots
    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(50, 50, 60, ${0.15 + Math.random() * 0.15})`;
        ctx.beginPath();
        ctx.arc(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 2 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('rock', canvas);
}

/**
 * Create realistic water texture
 */
function createWaterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Deep water gradient
    const gradient = ctx.createLinearGradient(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    gradient.addColorStop(0, '#1a3a5c');
    gradient.addColorStop(0.5, '#0d2840');
    gradient.addColorStop(1, '#1a3a5c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    // Wave distortion
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 30, y / 30, 3, 5);
            if (n > 0.55) {
                ctx.fillStyle = `rgba(80, 150, 200, ${(n - 0.55) * 0.5})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    // Wave lines
    ctx.strokeStyle = 'rgba(120, 180, 220, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
        const yBase = 15 + i * 18;
        ctx.beginPath();
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= TEXTURE_SIZE; x += 8) {
            const waveY = yBase + Math.sin(x / 15 + i) * 4;
            ctx.lineTo(x, waveY);
        }
        ctx.stroke();
    }

    // Light reflections
    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(200, 230, 255, ${0.15 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(
            Math.random() * TEXTURE_SIZE,
            Math.random() * TEXTURE_SIZE,
            2 + Math.random() * 5,
            1 + Math.random() * 2,
            Math.random() * Math.PI,
            0, Math.PI * 2
        );
        ctx.fill();
    }

    textureCache.set('water', canvas);
}

/**
 * Create realistic sand texture
 */
function createSandTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Sandy base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 20, y / 20, 4, 6);
            const r = Math.floor(170 + n * 40);
            const g = Math.floor(145 + n * 35);
            const b = Math.floor(100 + n * 30);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Sand grains
    for (let i = 0; i < 400; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const shade = 0.7 + Math.random() * 0.3;
        ctx.fillStyle = `rgba(${Math.floor(200 * shade)}, ${Math.floor(175 * shade)}, ${Math.floor(130 * shade)}, 0.6)`;
        ctx.beginPath();
        ctx.arc(x, y, 0.5 + Math.random() * 1, 0, Math.PI * 2);
        ctx.fill();
    }

    // Wind ripples
    ctx.strokeStyle = 'rgba(190, 165, 120, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const yBase = 20 + i * 30;
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= TEXTURE_SIZE; x += 5) {
            ctx.lineTo(x, yBase + Math.sin(x / 20 + i) * 3);
        }
        ctx.stroke();
    }

    // Small pebbles
    for (let i = 0; i < 10; i++) {
        ctx.fillStyle = `rgba(130, 110, 80, ${0.4 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(
            Math.random() * TEXTURE_SIZE,
            Math.random() * TEXTURE_SIZE,
            2 + Math.random() * 3,
            1.5 + Math.random() * 2,
            Math.random() * Math.PI,
            0, Math.PI * 2
        );
        ctx.fill();
    }

    textureCache.set('sand', canvas);
}

/**
 * Create realistic swamp texture
 */
function createSwampTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Murky base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 18, y / 18, 4, 7);
            const r = Math.floor(55 + n * 30);
            const g = Math.floor(70 + n * 35);
            const b = Math.floor(45 + n * 25);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Murky water puddles
    for (let i = 0; i < 5; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15 + Math.random() * 15);
        gradient.addColorStop(0, 'rgba(35, 50, 40, 0.6)');
        gradient.addColorStop(1, 'rgba(55, 70, 50, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, 20 + Math.random() * 15, 12 + Math.random() * 10, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Mud patches
    for (let i = 0; i < 8; i++) {
        ctx.fillStyle = `rgba(60, 50, 35, ${0.3 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(
            Math.random() * TEXTURE_SIZE,
            Math.random() * TEXTURE_SIZE,
            8 + Math.random() * 12,
            5 + Math.random() * 8,
            Math.random() * Math.PI,
            0, Math.PI * 2
        );
        ctx.fill();
    }

    // Bubbles
    for (let i = 0; i < 15; i++) {
        ctx.fillStyle = `rgba(70, 85, 60, ${0.4 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 1 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Dead reeds
    for (let i = 0; i < 10; i++) {
        ctx.strokeStyle = `rgba(90, 75, 50, ${0.4 + Math.random() * 0.3})`;
        ctx.lineWidth = 1 + Math.random();
        ctx.beginPath();
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 8, y - 10 - Math.random() * 15);
        ctx.stroke();
    }

    textureCache.set('swamp', canvas);
}

/**
 * Create snow texture
 */
function createSnowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // White snow base with subtle blue shadows
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 25, y / 25, 3, 20);
            const r = Math.floor(230 + n * 25);
            const g = Math.floor(235 + n * 20);
            const b = Math.floor(245 + n * 10);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Sparkles
    for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.arc(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 1, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('snow', canvas);
}

/**
 * Create ice texture
 */
function createIceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Light blue ice base
    const gradient = ctx.createLinearGradient(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    gradient.addColorStop(0, '#a0d4e8');
    gradient.addColorStop(0.5, '#c0e8f5');
    gradient.addColorStop(1, '#90c4d8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    // Ice cracks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        let x = Math.random() * TEXTURE_SIZE;
        let y = Math.random() * TEXTURE_SIZE;
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
            x += (Math.random() - 0.5) * 30;
            y += (Math.random() - 0.5) * 30;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    textureCache.set('ice', canvas);
}

/**
 * Create deep water texture
 */
function createDeepwaterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Very dark blue gradient
    const gradient = ctx.createLinearGradient(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    gradient.addColorStop(0, '#0a2540');
    gradient.addColorStop(0.5, '#051530');
    gradient.addColorStop(1, '#0a2540');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    // Deep wave patterns
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 40, y / 40, 3, 10);
            if (n > 0.6) {
                ctx.fillStyle = `rgba(50, 100, 150, ${(n - 0.6) * 0.3})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    textureCache.set('deepwater', canvas);
}

/**
 * Create flowers texture
 */
function createFlowersTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Green grass base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 20, y / 20, 4, 15);
            const r = Math.floor(50 + n * 30);
            const g = Math.floor(120 + n * 40);
            const b = Math.floor(60 + n * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Small colorful flowers
    const colors = ['#ff6b6b', '#ffd93d', '#ffffff', '#ff9ecd', '#b19cd9'];
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('flowers', canvas);
}

/**
 * Create wheat texture
 */
function createWheatTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Golden wheat base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 15, y / 15, 4, 25);
            const r = Math.floor(180 + n * 40);
            const g = Math.floor(150 + n * 35);
            const b = Math.floor(70 + n * 25);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Wheat stalks
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const height = 8 + Math.random() * 10;

        ctx.strokeStyle = `rgba(${200 + Math.random() * 40}, ${170 + Math.random() * 30}, ${80 + Math.random() * 20}, 0.7)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 3, y - height);
        ctx.stroke();
    }

    textureCache.set('wheat', canvas);
}

/**
 * Create mud texture
 */
function createMudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Brown mud base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 18, y / 18, 4, 30);
            const r = Math.floor(85 + n * 30);
            const g = Math.floor(70 + n * 25);
            const b = Math.floor(45 + n * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Wet patches
    for (let i = 0; i < 6; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
        gradient.addColorStop(0, 'rgba(60, 45, 30, 0.5)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    }

    textureCache.set('mud', canvas);
}

/**
 * Create gravel texture
 */
function createGravelTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Gray gravel base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 12, y / 12, 4, 35);
            const shade = 120 + n * 50;
            ctx.fillStyle = `rgb(${shade},${shade * 0.95},${shade * 0.9})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Pebbles
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        const shade = 0.5 + Math.random() * 0.5;
        ctx.fillStyle = `rgb(${Math.floor(130 * shade)}, ${Math.floor(125 * shade)}, ${Math.floor(115 * shade)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 2 + Math.random() * 3, 1.5 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('gravel', canvas);
}

/**
 * Create ruins texture
 */
function createRuinsTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Stone floor base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 20, y / 20, 4, 40);
            const shade = 100 + n * 40;
            ctx.fillStyle = `rgb(${shade},${shade * 0.95},${shade * 0.9})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Stone blocks pattern
    ctx.strokeStyle = 'rgba(60, 55, 50, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * TEXTURE_SIZE;
        const y = Math.random() * TEXTURE_SIZE;
        ctx.strokeRect(x, y, 20 + Math.random() * 20, 15 + Math.random() * 15);
    }

    // Moss patches
    for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(60, 100, 50, 0.3)';
        ctx.beginPath();
        ctx.ellipse(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('ruins', canvas);
}

/**
 * Create heather texture
 */
function createHeatherTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Purple-brown heather base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 20, y / 20, 4, 45);
            const r = Math.floor(100 + n * 40);
            const g = Math.floor(70 + n * 30);
            const b = Math.floor(100 + n * 40);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Small purple flowers
    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgb(${140 + Math.random() * 50}, ${80 + Math.random() * 40}, ${140 + Math.random() * 50})`;
        ctx.beginPath();
        ctx.arc(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 1 + Math.random(), 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('heather', canvas);
}

/**
 * Create moss texture
 */
function createMossTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');

    // Dark green moss base
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const n = fractalNoise(x / 15, y / 15, 5, 50);
            const r = Math.floor(40 + n * 25);
            const g = Math.floor(80 + n * 35);
            const b = Math.floor(40 + n * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Moss clumps
    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(${50 + Math.random() * 30}, ${90 + Math.random() * 30}, ${50 + Math.random() * 20}, 0.6)`;
        ctx.beginPath();
        ctx.ellipse(Math.random() * TEXTURE_SIZE, Math.random() * TEXTURE_SIZE, 5 + Math.random() * 8, 3 + Math.random() * 5, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('moss', canvas);
}

/**
 * Draw a human character sprite
 */
export function drawHumanSprite(ctx, cx, cy, size, playerColor, classType, isSelected, direction = 0) {
    ctx.save();
    ctx.translate(cx, cy);

    const scale = size / 45;
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 32, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Selection glow
    if (isSelected) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;
    }

    // Class-specific colors
    let bodyColor, armorColor, helmetColor;
    switch (classType) {
        case 'scout':
            bodyColor = '#2a2a3a';
            armorColor = '#3a3a4a';
            helmetColor = '#4a4a5a';
            break;
        case 'assault':
            bodyColor = '#3a2a2a';
            armorColor = '#4a3a3a';
            helmetColor = '#5a4a4a';
            break;
        case 'medic':
            bodyColor = '#2a3a2a';
            armorColor = '#3a4a3a';
            helmetColor = '#4a5a4a';
            break;
        case 'sniper':
            bodyColor = '#2a2a40';  // Dark blue-purple
            armorColor = '#3a3a55';
            helmetColor = '#4a4a65';
            break;
        case 'ninja':
            bodyColor = '#1a1a1a';  // Very dark/black
            armorColor = '#252525';
            helmetColor = '#303030';
            break;
        default:
            bodyColor = '#2a2a3a';
            armorColor = '#3a3a4a';
            helmetColor = '#4a4a5a';
    }

    // Legs
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(-12, 8, 10, 22, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(2, 8, 10, 22, 3);
    ctx.fill();

    // Boots
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(-13, 26, 12, 7, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(1, 26, 12, 7, 2);
    ctx.fill();

    // Torso/Armor
    ctx.fillStyle = armorColor;
    ctx.beginPath();
    ctx.roundRect(-16, -14, 32, 26, 5);
    ctx.fill();

    // Player color stripe
    ctx.fillStyle = playerColor;
    ctx.fillRect(-14, -10, 5, 18);
    ctx.fillRect(9, -10, 5, 18);

    // Chest plate highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(-10, -12, 20, 10, 3);
    ctx.fill();

    // Arms
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(-24, -12, 10, 20, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(14, -12, 10, 20, 3);
    ctx.fill();

    // Gloves
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-19, 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(19, 10, 6, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = '#c9a07a';
    ctx.beginPath();
    ctx.roundRect(-5, -20, 10, 8, 2);
    ctx.fill();

    // Head/Helmet
    ctx.fillStyle = helmetColor;
    ctx.beginPath();
    ctx.arc(0, -28, 14, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    const visorGradient = ctx.createLinearGradient(-10, -30, 10, -26);
    visorGradient.addColorStop(0, 'rgba(80, 180, 220, 0.8)');
    visorGradient.addColorStop(1, 'rgba(40, 120, 180, 0.6)');
    ctx.fillStyle = visorGradient;
    ctx.beginPath();
    ctx.ellipse(0, -28, 11, 7, 0, 0, Math.PI);
    ctx.fill();

    // Helmet detail
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -28, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Class-specific equipment
    ctx.shadowBlur = 0;
    switch (classType) {
        case 'scout':
            // Sniper rifle
            ctx.fillStyle = '#2a2a2a';
            ctx.save();
            ctx.rotate(-0.25);
            ctx.fillRect(-28, -38, 5, 50);
            ctx.restore();
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.ellipse(-24, -35, 4, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'assault':
            // Heavy weapon
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.roundRect(16, -4, 24, 8, 2);
            ctx.fill();
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(36, -2, 10, 4);
            // Shoulder pads
            ctx.fillStyle = armorColor;
            ctx.beginPath();
            ctx.ellipse(-20, -10, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(20, -10, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'medic':
            // Medical backpack
            ctx.fillStyle = '#3a4a3a';
            ctx.beginPath();
            ctx.roundRect(-22, -18, 12, 24, 4);
            ctx.fill();
            // Red cross
            ctx.fillStyle = '#cc3333';
            ctx.fillRect(-19, -12, 6, 2);
            ctx.fillRect(-17, -14, 2, 6);
            // Medical tool
            ctx.fillStyle = '#aaaaaa';
            ctx.beginPath();
            ctx.roundRect(16, -2, 14, 5, 2);
            ctx.fill();
            break;

        case 'sniper':
            // Long sniper rifle with scope
            ctx.fillStyle = '#1a1a1a';
            ctx.save();
            ctx.rotate(-0.2);
            ctx.fillRect(-30, -42, 4, 60);  // Long barrel
            ctx.restore();
            // Scope
            ctx.fillStyle = '#3a3a55';
            ctx.beginPath();
            ctx.ellipse(-26, -38, 5, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Scope lens (glowing)
            ctx.fillStyle = '#6080ff';
            ctx.beginPath();
            ctx.arc(-26, -38, 3, 0, Math.PI * 2);
            ctx.fill();
            // Ghillie hood detail
            ctx.fillStyle = '#3a4a3a';
            ctx.beginPath();
            ctx.arc(0, -35, 8, Math.PI, 2 * Math.PI);
            ctx.fill();
            // Camo stripes on armor
            ctx.fillStyle = '#2a3a2a';
            ctx.fillRect(-8, -8, 3, 12);
            ctx.fillRect(5, -8, 3, 12);
            break;

        case 'ninja':
            // Katana on back
            ctx.fillStyle = '#1a1a1a';
            ctx.save();
            ctx.rotate(0.3);
            ctx.fillRect(8, -48, 3, 45);  // Blade
            ctx.restore();
            // Katana handle
            ctx.fillStyle = '#4a2020';
            ctx.save();
            ctx.rotate(0.3);
            ctx.fillRect(8, -5, 3, 12);
            ctx.restore();
            // Katana guard
            ctx.fillStyle = '#c0a040';
            ctx.beginPath();
            ctx.ellipse(15, -2, 4, 2, 0.3, 0, Math.PI * 2);
            ctx.fill();
            // Shuriken on belt
            ctx.fillStyle = '#606060';
            ctx.beginPath();
            ctx.moveTo(-18, 4);
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI / 2) * i;
                ctx.lineTo(-18 + Math.cos(angle) * 5, 4 + Math.sin(angle) * 5);
                ctx.lineTo(-18 + Math.cos(angle + Math.PI / 4) * 2, 4 + Math.sin(angle + Math.PI / 4) * 2);
            }
            ctx.closePath();
            ctx.fill();
            // Mask detail (covering lower face)
            ctx.fillStyle = '#151515';
            ctx.beginPath();
            ctx.arc(0, -24, 10, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.fill();
            // Glowing eyes
            ctx.fillStyle = '#ff3030';
            ctx.beginPath();
            ctx.ellipse(-4, -30, 2, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(4, -30, 2, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
    }

    ctx.restore();
}

/**
 * Draw action point indicators
 */
export function drawAPIndicator(ctx, x, y, current, max, size = 16) {
    const spacing = size + 3;
    const startX = x - ((max - 1) * spacing) / 2;

    for (let i = 0; i < max; i++) {
        const px = startX + i * spacing;
        const isActive = i < current;

        ctx.save();
        ctx.translate(px, y);

        if (isActive) {
            ctx.shadowColor = '#eab308';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#eab308';
        } else {
            ctx.fillStyle = 'rgba(80, 80, 80, 0.5)';
        }

        // Lightning bolt
        const s = size / 16;
        ctx.beginPath();
        ctx.moveTo(3 * s, -8 * s);
        ctx.lineTo(-1 * s, 0);
        ctx.lineTo(2 * s, 0);
        ctx.lineTo(-3 * s, 8 * s);
        ctx.lineTo(1 * s, 1 * s);
        ctx.lineTo(-2 * s, 1 * s);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}
