// ===== ASSET MANAGEMENT & TEXTURES =====

// Pre-rendered texture canvases for performance
const textureCache = new Map();

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
}

/**
 * Get a cached texture pattern
 */
export function getTexture(type) {
    return textureCache.get(type);
}

/**
 * Create grass texture with subtle variation
 */
function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Base color
    ctx.fillStyle = '#3d6b4f';
    ctx.fillRect(0, 0, 64, 64);

    // Add grass blades
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const height = 4 + Math.random() * 8;
        const angle = (Math.random() - 0.5) * 0.5;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = `rgba(${45 + Math.random() * 30}, ${90 + Math.random() * 40}, ${60 + Math.random() * 30}, 0.6)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -height);
        ctx.stroke();
        ctx.restore();
    }

    // Small dots for texture
    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(${30 + Math.random() * 40}, ${80 + Math.random() * 50}, ${40 + Math.random() * 30}, 0.3)`;
        ctx.beginPath();
        ctx.arc(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('grass', canvas);
}

/**
 * Create forest texture with trees
 */
function createForestTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Dark forest floor
    ctx.fillStyle = '#2d5a3d';
    ctx.fillRect(0, 0, 64, 64);

    // Fallen leaves/debris
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.fillStyle = `rgba(${20 + Math.random() * 30}, ${50 + Math.random() * 40}, ${25 + Math.random() * 25}, 0.5)`;
        ctx.beginPath();
        ctx.ellipse(x, y, 2 + Math.random() * 3, 1 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Tree shadows
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(0, 30, 15, 0.3)';
        ctx.beginPath();
        ctx.ellipse(15 + i * 20, 32 + (i % 2) * 10, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('forest', canvas);
}

/**
 * Create rock texture with cracks
 */
function createRockTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Base rock color
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(0, 0, 64, 64);

    // Rock layers
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const w = 10 + Math.random() * 20;
        const h = 6 + Math.random() * 12;
        ctx.fillStyle = `rgba(${80 + Math.random() * 40}, ${80 + Math.random() * 40}, ${90 + Math.random() * 40}, 0.5)`;
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Cracks
    ctx.strokeStyle = 'rgba(40, 40, 50, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        let x = Math.random() * 64;
        let y = Math.random() * 64;
        ctx.moveTo(x, y);
        for (let j = 0; j < 3; j++) {
            x += (Math.random() - 0.5) * 15;
            y += (Math.random() - 0.5) * 15;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Highlights
    for (let i = 0; i < 10; i++) {
        ctx.fillStyle = `rgba(150, 150, 160, ${0.1 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('rock', canvas);
}

/**
 * Create water texture with waves
 */
function createWaterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Deep water gradient
    const gradient = ctx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, '#2a4a6f');
    gradient.addColorStop(0.5, '#1e3a5f');
    gradient.addColorStop(1, '#2a4a6f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    // Wave patterns
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const y = 10 + i * 15;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= 64; x += 8) {
            ctx.quadraticCurveTo(x + 4, y - 4 + (i % 2) * 8, x + 8, y);
        }
        ctx.stroke();
    }

    // Light reflections
    for (let i = 0; i < 8; i++) {
        ctx.fillStyle = `rgba(200, 230, 255, ${0.1 + Math.random() * 0.15})`;
        ctx.beginPath();
        ctx.ellipse(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 4, 1, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('water', canvas);
}

/**
 * Create sand texture with grains
 */
function createSandTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Base sand color
    ctx.fillStyle = '#9b8365';
    ctx.fillRect(0, 0, 64, 64);

    // Sand grains
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.fillStyle = `rgba(${140 + Math.random() * 40}, ${120 + Math.random() * 30}, ${80 + Math.random() * 40}, ${0.3 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Wind patterns
    ctx.strokeStyle = 'rgba(180, 160, 120, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 15 + i * 20);
        ctx.bezierCurveTo(20, 10 + i * 20, 44, 20 + i * 20, 64, 15 + i * 20);
        ctx.stroke();
    }

    textureCache.set('sand', canvas);
}

/**
 * Create swamp texture with murky water
 */
function createSwampTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Murky base
    ctx.fillStyle = '#4a5a3a';
    ctx.fillRect(0, 0, 64, 64);

    // Muddy patches
    for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(${50 + Math.random() * 30}, ${60 + Math.random() * 30}, ${30 + Math.random() * 30}, 0.5)`;
        ctx.beginPath();
        ctx.ellipse(Math.random() * 64, Math.random() * 64, 8 + Math.random() * 10, 5 + Math.random() * 8, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Water puddles
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(40, 60, 50, 0.4)';
        ctx.beginPath();
        ctx.ellipse(10 + Math.random() * 44, 10 + Math.random() * 44, 5 + Math.random() * 8, 3 + Math.random() * 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Vegetation bits
    for (let i = 0; i < 15; i++) {
        ctx.fillStyle = `rgba(${40 + Math.random() * 30}, ${70 + Math.random() * 40}, ${30 + Math.random() * 30}, 0.4)`;
        ctx.beginPath();
        ctx.arc(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    textureCache.set('swamp', canvas);
}

/**
 * Draw a human character sprite
 */
export function drawHumanSprite(ctx, cx, cy, size, playerColor, classType, isSelected, direction = 0) {
    ctx.save();
    ctx.translate(cx, cy);

    const scale = size / 40; // Base size is 40
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 28, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Selection glow
    if (isSelected) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
    }

    // Body colors based on class
    let bodyColor, armorColor, helmetColor;
    switch (classType) {
        case 'scout':
            bodyColor = '#3a3a4a';
            armorColor = '#4a4a5a';
            helmetColor = '#5a5a6a';
            break;
        case 'assault':
            bodyColor = '#4a3a3a';
            armorColor = '#5a4a4a';
            helmetColor = '#6a5a5a';
            break;
        case 'medic':
            bodyColor = '#3a4a3a';
            armorColor = '#4a5a4a';
            helmetColor = '#5a6a5a';
            break;
        default:
            bodyColor = '#3a3a4a';
            armorColor = '#4a4a5a';
            helmetColor = '#5a5a6a';
    }

    // Legs
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(-10, 8, 8, 20, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(2, 8, 8, 20, 3);
    ctx.fill();

    // Boots
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(-11, 24, 10, 6, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(1, 24, 10, 6, 2);
    ctx.fill();

    // Torso/Armor
    ctx.fillStyle = armorColor;
    ctx.beginPath();
    ctx.roundRect(-14, -12, 28, 24, 4);
    ctx.fill();

    // Armor details - player color stripe
    ctx.fillStyle = playerColor;
    ctx.fillRect(-12, -8, 4, 16);
    ctx.fillRect(8, -8, 4, 16);

    // Arms
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(-20, -10, 8, 18, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(12, -10, 8, 18, 3);
    ctx.fill();

    // Gloves
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(-16, 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(16, 10, 5, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.roundRect(-4, -18, 8, 8, 2);
    ctx.fill();

    // Head/Helmet
    ctx.fillStyle = helmetColor;
    ctx.beginPath();
    ctx.arc(0, -26, 12, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, -26, 10, 6, 0, 0, Math.PI);
    ctx.fill();

    // Class-specific equipment
    ctx.shadowBlur = 0;
    switch (classType) {
        case 'scout':
            // Sniper rifle on back
            ctx.fillStyle = '#3a3a3a';
            ctx.save();
            ctx.rotate(-0.3);
            ctx.fillRect(-25, -35, 4, 45);
            ctx.restore();
            // Scope
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.ellipse(-22, -32, 3, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'assault':
            // Heavy weapon in hands
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.roundRect(14, -2, 20, 6, 2);
            ctx.fill();
            // Barrel
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(30, 0, 8, 3);
            // Shoulder pads
            ctx.fillStyle = armorColor;
            ctx.beginPath();
            ctx.ellipse(-18, -8, 6, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(18, -8, 6, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'medic':
            // Medical backpack
            ctx.fillStyle = '#4a5a4a';
            ctx.beginPath();
            ctx.roundRect(-18, -15, 10, 20, 3);
            ctx.fill();
            // Red cross
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-16, -10, 6, 2);
            ctx.fillRect(-14, -12, 2, 6);
            // Medical tool in hand
            ctx.fillStyle = '#aaaaaa';
            ctx.beginPath();
            ctx.roundRect(14, 0, 12, 4, 2);
            ctx.fill();
            break;
    }

    // Player number badge on shoulder
    ctx.fillStyle = playerColor;
    ctx.beginPath();
    ctx.arc(12, -10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.restore();
}

/**
 * Create action point indicator icons
 */
export function drawAPIndicator(ctx, x, y, current, max, size = 20) {
    const spacing = size + 4;
    const startX = x - ((max - 1) * spacing) / 2;

    for (let i = 0; i < max; i++) {
        const px = startX + i * spacing;
        const isActive = i < current;

        // Lightning bolt shape
        ctx.save();
        ctx.translate(px, y);

        if (isActive) {
            // Glow effect
            ctx.shadowColor = '#eab308';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#eab308';
        } else {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
        }

        // Draw lightning bolt
        const s = size / 20;
        ctx.beginPath();
        ctx.moveTo(4 * s, -10 * s);
        ctx.lineTo(-2 * s, 0);
        ctx.lineTo(2 * s, 0);
        ctx.lineTo(-4 * s, 10 * s);
        ctx.lineTo(2 * s, 2 * s);
        ctx.lineTo(-2 * s, 2 * s);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}
