// ===== TERRAIN & CHARACTER ANIMATION SYSTEM =====

import { TERRAIN, CONFIG } from './config.js';
import { state } from './state.js';

// Animation state
export const animationState = {
    time: 0,
    lastFrameTime: 0,
    windDirection: 0.3,
    windStrength: 0.5,
    windPhase: 0,
    // Grass animation
    grassWaveOffset: 0,
    grassBlades: new Map(), // Per-hex grass blade data
    // Water animation
    waterPhase: 0,
    waterRipples: [],
    // Snow animation
    snowflakes: [],
    // Character animations
    unitAnimations: new Map(), // unitId -> animation state
    // Environmental particles
    particles: [],
    fireflies: [],
    dustMotes: [],
    fallingLeaves: [],
    // Wheat/reeds swaying
    reedPositions: new Map()
};

// Animation configuration
const ANIM_CONFIG = {
    // Grass
    GRASS_BLADES_PER_HEX: 80,
    GRASS_WAVE_SPEED: 0.002,
    GRASS_SWAY_AMOUNT: 6,
    // Water
    WATER_WAVE_SPEED: 0.003,
    WATER_RIPPLE_COUNT: 3,
    // Snow
    SNOWFLAKE_COUNT: 40,
    SNOWFALL_SPEED: 0.5,
    // Fireflies
    FIREFLY_COUNT: 15,
    // Wind
    WIND_CHANGE_SPEED: 0.0003,
    // Wheat/Tall grass
    WHEAT_STALKS_PER_HEX: 50,
    WHEAT_WAVE_SPEED: 0.0015
};

/**
 * Seeded random for consistent per-hex details
 */
function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

/**
 * Initialize grass blades for a hex
 */
export function initGrassBlades(q, r, hexSize) {
    const key = `${q},${r}`;
    if (animationState.grassBlades.has(key)) return;

    const blades = [];
    const seed = q * 1000 + r;

    for (let i = 0; i < ANIM_CONFIG.GRASS_BLADES_PER_HEX; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);
        const rand3 = seededRandom(seed + i * 3 + 2);

        // Position within hex (polar coordinates)
        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * hexSize * 0.75;

        blades.push({
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            height: 4 + rand3 * 10,
            thickness: 0.4 + rand3 * 0.8,
            phase: rand1 * Math.PI * 2,
            colorVariant: rand2
        });
    }

    animationState.grassBlades.set(key, blades);
}

/**
 * Get grass blade color with variation
 */
function getGrassColor(variant, baseR = 30, baseG = 100, baseB = 35) {
    const r = Math.floor(baseR + variant * 30);
    const g = Math.floor(baseG + variant * 40);
    const b = Math.floor(baseB + variant * 20);
    return `rgb(${r},${g},${b})`;
}

/**
 * Update all animations
 */
export function updateAnimations(deltaTime) {
    animationState.time += deltaTime;

    // Update wind
    updateWind(deltaTime);

    // Update grass wave
    animationState.grassWaveOffset += ANIM_CONFIG.GRASS_WAVE_SPEED * deltaTime;

    // Update water
    animationState.waterPhase += ANIM_CONFIG.WATER_WAVE_SPEED * deltaTime;

    // Update terrain sprite animation frames (for animated PNG textures)
    updateTerrainAnimationFrame(animationState.time);

    // Update snowflakes
    updateSnowflakes(deltaTime);

    // Update environmental particles
    updateFireflies(deltaTime);
    updateDustMotes(deltaTime);
    updateFallingLeaves(deltaTime);

    // Update character animations
    updateCharacterAnimations(deltaTime);
}

/**
 * Update terrain animation frame index based on time
 * This cycles through sprite sheet frames for animated terrain like water, wheat, etc.
 */
function updateTerrainAnimationFrame(currentTime) {
    if (!CONFIG.ANIMATION?.ENABLED) return;

    const frameDuration = CONFIG.ANIMATION.FRAME_DURATION || 250;
    const frameCount = CONFIG.ANIMATION.FRAME_COUNT || 4;

    // Check if it's time to advance to the next frame
    if (currentTime - state.terrainAnimationTime >= frameDuration) {
        state.terrainAnimationFrame = (state.terrainAnimationFrame + 1) % frameCount;
        state.terrainAnimationTime = currentTime;
    }
}

/**
 * Update wind direction and strength
 */
function updateWind(deltaTime) {
    animationState.windPhase += ANIM_CONFIG.WIND_CHANGE_SPEED * deltaTime;
    animationState.windDirection = Math.sin(animationState.windPhase) * 0.4;
    animationState.windStrength = 0.3 + Math.sin(animationState.windPhase * 0.7) * 0.25;
}

/**
 * Draw animated grass blades for a hex
 */
export function drawAnimatedGrass(ctx, cx, cy, hexSize, q, r, alpha = 1, terrainType = 'grass') {
    const key = `${q},${r}`;
    let blades = animationState.grassBlades.get(key);

    if (!blades) {
        initGrassBlades(q, r, hexSize);
        blades = animationState.grassBlades.get(key);
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    const windOffset = animationState.grassWaveOffset;
    const windDir = animationState.windDirection;
    const windStr = animationState.windStrength;

    // Adjust colors based on terrain
    let baseR = 30, baseG = 100, baseB = 35;
    let heightMultiplier = 1;

    if (terrainType === 'tallgrass') {
        heightMultiplier = 1.8;
        baseG = 90;
    } else if (terrainType === 'clearing') {
        baseG = 120;
        baseB = 45;
    } else if (terrainType === 'heather') {
        baseR = 90;
        baseG = 60;
        baseB = 90;
    } else if (terrainType === 'moss') {
        baseR = 40;
        baseG = 80;
        baseB = 45;
    }

    for (const blade of blades) {
        const waveX = q * 0.1 + r * 0.1;
        const sway = Math.sin(windOffset + blade.phase + waveX) *
                     ANIM_CONFIG.GRASS_SWAY_AMOUNT * windStr;

        const color = getGrassColor(blade.colorVariant, baseR, baseG, baseB);
        ctx.strokeStyle = color;
        ctx.lineWidth = blade.thickness;
        ctx.lineCap = 'round';

        ctx.beginPath();
        const baseX = cx + blade.x;
        const baseY = cy + blade.y;
        ctx.moveTo(baseX, baseY);

        // Curved grass blade with wind
        const height = blade.height * heightMultiplier;
        const tipX = baseX + sway + windDir * height * 0.3;
        const tipY = baseY - height;
        const cpX = baseX + sway * 0.5;
        const cpY = baseY - height * 0.6;

        ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Draw wheat field stalks
 */
export function drawWheatField(ctx, cx, cy, hexSize, q, r, alpha = 1) {
    const seed = q * 1000 + r;

    ctx.save();
    ctx.globalAlpha = alpha;

    const windOffset = animationState.grassWaveOffset;
    const windStr = animationState.windStrength;

    for (let i = 0; i < ANIM_CONFIG.WHEAT_STALKS_PER_HEX; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);
        const rand3 = seededRandom(seed + i * 3 + 2);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * hexSize * 0.7;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        const height = 12 + rand3 * 8;
        const phase = rand1 * Math.PI * 2;
        const sway = Math.sin(windOffset * 1.2 + phase + q * 0.1) * 4 * windStr;

        // Stalk
        const goldenColor = `rgb(${180 + rand3 * 40}, ${150 + rand3 * 30}, ${70 + rand3 * 20})`;
        ctx.strokeStyle = goldenColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + sway * 0.5, y - height * 0.6, x + sway, y - height);
        ctx.stroke();

        // Wheat head
        ctx.fillStyle = `rgb(${200 + rand3 * 30}, ${170 + rand3 * 30}, ${80 + rand3 * 20})`;
        ctx.beginPath();
        ctx.ellipse(x + sway, y - height - 3, 2, 4, sway * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Draw animated reeds
 */
export function drawReeds(ctx, cx, cy, hexSize, q, r, alpha = 1) {
    const seed = q * 1000 + r;

    ctx.save();
    ctx.globalAlpha = alpha;

    const windOffset = animationState.grassWaveOffset;
    const windStr = animationState.windStrength;

    const reedCount = 25;
    for (let i = 0; i < reedCount; i++) {
        const rand1 = seededRandom(seed + i * 4);
        const rand2 = seededRandom(seed + i * 4 + 1);
        const rand3 = seededRandom(seed + i * 4 + 2);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * hexSize * 0.7;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        const height = 18 + rand3 * 12;
        const phase = rand1 * Math.PI * 2;
        const sway = Math.sin(windOffset * 0.8 + phase) * 5 * windStr;

        // Reed stalk
        ctx.strokeStyle = `rgb(${70 + rand3 * 20}, ${90 + rand3 * 20}, ${50 + rand3 * 15})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + sway * 0.3, y - height * 0.7, x + sway, y - height);
        ctx.stroke();

        // Reed head (fluffy top)
        if (rand3 > 0.3) {
            ctx.fillStyle = `rgba(${150 + rand3 * 30}, ${130 + rand3 * 30}, ${100 + rand3 * 20}, 0.8)`;
            ctx.beginPath();
            ctx.ellipse(x + sway, y - height - 4, 2.5, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

/**
 * Draw animated water surface
 */
export function drawAnimatedWater(ctx, cx, cy, hexSize, q, r, isDeep = false) {
    const phase = animationState.waterPhase;
    const waveOffset = q * 0.3 + r * 0.3;

    ctx.save();

    // Draw multiple wave layers
    for (let layer = 0; layer < 4; layer++) {
        const layerPhase = phase + layer * 0.7;
        const alpha = 0.12 - layer * 0.02;

        ctx.strokeStyle = `rgba(120, 180, 220, ${alpha})`;
        ctx.lineWidth = 2 - layer * 0.3;

        for (let i = 0; i < 5; i++) {
            const yOffset = (i - 2) * hexSize * 0.3;
            const amplitude = 2.5 + layer;

            ctx.beginPath();
            for (let x = -hexSize; x <= hexSize; x += 3) {
                const waveY = cy + yOffset +
                    Math.sin((x / 12) + layerPhase + waveOffset + i) * amplitude;
                if (x === -hexSize) {
                    ctx.moveTo(cx + x, waveY);
                } else {
                    ctx.lineTo(cx + x, waveY);
                }
            }
            ctx.stroke();
        }
    }

    // Sparkle effects
    const sparkleCount = isDeep ? 3 : 6;
    for (let i = 0; i < sparkleCount; i++) {
        const sparklePhase = (phase * 2.5 + i * 1.3 + waveOffset) % (Math.PI * 2);
        const sparkleAlpha = Math.max(0, Math.sin(sparklePhase)) * 0.5;

        if (sparkleAlpha > 0.1) {
            const sx = cx + seededRandom(q * 100 + r + i * 7) * hexSize * 1.4 - hexSize * 0.7;
            const sy = cy + seededRandom(q + r * 100 + i * 11) * hexSize * 1.4 - hexSize * 0.7;

            ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5 + sparkleAlpha, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Ripple circles
    const ripplePhase = (phase * 0.4 + waveOffset) % 1;
    const rippleX = cx + seededRandom(q * 50 + r) * hexSize * 0.5 - hexSize * 0.25;
    const rippleY = cy + seededRandom(q + r * 50) * hexSize * 0.5 - hexSize * 0.25;
    const rippleRadius = ripplePhase * hexSize * 0.35;
    const rippleAlpha = (1 - ripplePhase) * 0.25;

    if (rippleAlpha > 0.05) {
        ctx.strokeStyle = `rgba(200, 230, 255, ${rippleAlpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rippleX, rippleY, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Draw shallow water with visible bottom
 */
export function drawShallowWater(ctx, cx, cy, hexSize, q, r) {
    const phase = animationState.waterPhase;

    ctx.save();

    // Draw stones on bottom
    const seed = q * 100 + r;
    for (let i = 0; i < 8; i++) {
        const stoneX = cx + (seededRandom(seed + i * 2) - 0.5) * hexSize * 1.2;
        const stoneY = cy + (seededRandom(seed + i * 2 + 1) - 0.5) * hexSize * 1.2;
        const stoneSize = 2 + seededRandom(seed + i * 3) * 4;

        ctx.fillStyle = 'rgba(100, 90, 70, 0.4)';
        ctx.beginPath();
        ctx.ellipse(stoneX, stoneY, stoneSize, stoneSize * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Caustic light patterns
    for (let i = 0; i < 4; i++) {
        const causticPhase = (phase * 1.5 + i * 1.5 + q * 0.2) % (Math.PI * 2);
        const causticAlpha = Math.max(0, Math.sin(causticPhase)) * 0.15;

        if (causticAlpha > 0.03) {
            const cx1 = cx + (seededRandom(seed + i * 20) - 0.5) * hexSize;
            const cy1 = cy + (seededRandom(seed + i * 20 + 10) - 0.5) * hexSize;

            ctx.strokeStyle = `rgba(200, 230, 255, ${causticAlpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx1, cy1, 5 + causticAlpha * 10, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Surface ripples
    drawAnimatedWater(ctx, cx, cy, hexSize, q, r, false);

    ctx.restore();
}

/**
 * Update snowflakes
 */
function updateSnowflakes(deltaTime) {
    // Ensure we have enough snowflakes
    while (animationState.snowflakes.length < ANIM_CONFIG.SNOWFLAKE_COUNT) {
        animationState.snowflakes.push({
            x: Math.random(),
            y: Math.random(),
            size: 1 + Math.random() * 2,
            speed: 0.25 + Math.random() * 0.35,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.001 + Math.random() * 0.002
        });
    }

    // Update snowflakes
    for (const flake of animationState.snowflakes) {
        flake.y += flake.speed * deltaTime * 0.001;
        flake.wobble += flake.wobbleSpeed * deltaTime;
        flake.x += Math.sin(flake.wobble) * 0.0008;

        // Reset when off screen
        if (flake.y > 1.2) {
            flake.y = -0.1;
            flake.x = Math.random();
        }
    }
}

/**
 * Draw snowflakes for snow terrain
 */
export function drawSnowfall(ctx, cx, cy, hexSize, q, r) {
    ctx.save();

    const offset = q * 0.1 + r * 0.1;

    for (const flake of animationState.snowflakes) {
        const fx = cx + (flake.x + Math.sin(flake.wobble + offset) * 0.08 - 0.5) * hexSize * 2;
        const fy = cy + (flake.y - 0.5) * hexSize * 2;

        ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + Math.random() * 0.25})`;
        ctx.beginPath();
        ctx.arc(fx, fy, flake.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Draw ice reflections
 */
export function drawIceReflections(ctx, cx, cy, hexSize, q, r) {
    const phase = animationState.time * 0.001;

    ctx.save();

    // Ice cracks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 0.5;

    const seed = q * 100 + r;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        let x = cx + (seededRandom(seed + i * 3) - 0.5) * hexSize * 1.1;
        let y = cy + (seededRandom(seed + i * 3 + 1) - 0.5) * hexSize * 1.1;
        ctx.moveTo(x, y);

        for (let j = 0; j < 3; j++) {
            x += (seededRandom(seed + i * 10 + j) - 0.5) * hexSize * 0.35;
            y += (seededRandom(seed + i * 10 + j + 5) - 0.5) * hexSize * 0.35;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Shimmering reflections
    for (let i = 0; i < 4; i++) {
        const shimmerPhase = (phase + i * 1.2 + q * 0.2 + r * 0.2) % (Math.PI * 2);
        const shimmerAlpha = Math.max(0, Math.sin(shimmerPhase)) * 0.35;

        if (shimmerAlpha > 0.05) {
            const sx = cx + (seededRandom(seed + i * 20) - 0.5) * hexSize * 1.3;
            const sy = cy + (seededRandom(seed + i * 20 + 10) - 0.5) * hexSize * 1.3;

            ctx.fillStyle = `rgba(200, 230, 255, ${shimmerAlpha})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 2.5 + shimmerAlpha * 1.5, 1.2 + shimmerAlpha * 0.5,
                       seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

/**
 * Draw snow patches and footprints
 */
export function drawSnowDetails(ctx, cx, cy, hexSize, q, r) {
    const seed = q * 100 + r;

    ctx.save();

    // Small snow mounds
    for (let i = 0; i < 5; i++) {
        const mx = cx + (seededRandom(seed + i * 5) - 0.5) * hexSize * 1.2;
        const my = cy + (seededRandom(seed + i * 5 + 1) - 0.5) * hexSize * 1.2;
        const size = 4 + seededRandom(seed + i * 5 + 2) * 8;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(mx, my, size, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Shadow areas
    for (let i = 0; i < 3; i++) {
        const sx = cx + (seededRandom(seed + i * 7) - 0.5) * hexSize;
        const sy = cy + (seededRandom(seed + i * 7 + 1) - 0.5) * hexSize;

        ctx.fillStyle = 'rgba(180, 200, 220, 0.15)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 6, 3, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Update fireflies
 */
function updateFireflies(deltaTime) {
    // Ensure we have fireflies
    while (animationState.fireflies.length < ANIM_CONFIG.FIREFLY_COUNT) {
        animationState.fireflies.push({
            x: Math.random(),
            y: Math.random(),
            vx: (Math.random() - 0.5) * 0.0008,
            vy: (Math.random() - 0.5) * 0.0008,
            phase: Math.random() * Math.PI * 2,
            glowSpeed: 0.002 + Math.random() * 0.002,
            size: 1.2 + Math.random() * 0.8
        });
    }

    for (const fly of animationState.fireflies) {
        fly.x += fly.vx * deltaTime;
        fly.y += fly.vy * deltaTime;
        fly.phase += fly.glowSpeed * deltaTime;

        // Bounce at edges
        if (fly.x < 0 || fly.x > 1) fly.vx *= -1;
        if (fly.y < 0 || fly.y > 1) fly.vy *= -1;

        // Clamp
        fly.x = Math.max(0, Math.min(1, fly.x));
        fly.y = Math.max(0, Math.min(1, fly.y));

        // Random direction changes
        if (Math.random() < 0.008) {
            fly.vx += (Math.random() - 0.5) * 0.0004;
            fly.vy += (Math.random() - 0.5) * 0.0004;
        }
    }
}

/**
 * Draw fireflies for forest at dusk
 */
export function drawFireflies(ctx, cx, cy, hexSize) {
    ctx.save();

    for (const fly of animationState.fireflies) {
        const glow = Math.sin(fly.phase) * 0.5 + 0.5;
        if (glow > 0.25) {
            const fx = cx + (fly.x - 0.5) * hexSize * 1.8;
            const fy = cy + (fly.y - 0.5) * hexSize * 1.8;

            // Glow effect
            const gradient = ctx.createRadialGradient(fx, fy, 0, fx, fy, fly.size * 3.5);
            gradient.addColorStop(0, `rgba(200, 255, 100, ${glow * 0.7})`);
            gradient.addColorStop(0.3, `rgba(150, 255, 50, ${glow * 0.35})`);
            gradient.addColorStop(1, 'rgba(100, 200, 50, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(fx, fy, fly.size * 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Core
            ctx.fillStyle = `rgba(255, 255, 200, ${glow * 0.9})`;
            ctx.beginPath();
            ctx.arc(fx, fy, fly.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

/**
 * Update dust motes
 */
function updateDustMotes(deltaTime) {
    // Maintain dust mote count
    while (animationState.dustMotes.length < 25) {
        animationState.dustMotes.push({
            x: Math.random(),
            y: Math.random(),
            size: 0.4 + Math.random() * 0.8,
            speed: 0.00008 + Math.random() * 0.00015,
            drift: Math.random() * Math.PI * 2
        });
    }

    for (const mote of animationState.dustMotes) {
        mote.y -= mote.speed * deltaTime;
        mote.x += Math.sin(mote.drift + animationState.time * 0.0008) * 0.00008 * deltaTime;
        mote.drift += 0.0008;

        if (mote.y < -0.1) {
            mote.y = 1.1;
            mote.x = Math.random();
        }
    }
}

/**
 * Draw dust motes for sand/path terrain
 */
export function drawDustMotes(ctx, cx, cy, hexSize) {
    ctx.save();

    for (const mote of animationState.dustMotes) {
        const mx = cx + (mote.x - 0.5) * hexSize * 1.8;
        const my = cy + (mote.y - 0.5) * hexSize * 1.8;

        ctx.fillStyle = 'rgba(200, 180, 140, 0.25)';
        ctx.beginPath();
        ctx.arc(mx, my, mote.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Update falling leaves
 */
function updateFallingLeaves(deltaTime) {
    // Maintain leaf count
    while (animationState.fallingLeaves.length < 12) {
        animationState.fallingLeaves.push({
            x: Math.random(),
            y: -0.1 - Math.random() * 0.4,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.008,
            size: 2 + Math.random() * 2.5,
            speed: 0.00025 + Math.random() * 0.00018,
            sway: Math.random() * Math.PI * 2,
            color: Math.random() < 0.4 ? '#8B4513' : (Math.random() < 0.5 ? '#D2691E' : '#228B22')
        });
    }

    for (const leaf of animationState.fallingLeaves) {
        leaf.y += leaf.speed * deltaTime;
        leaf.x += Math.sin(leaf.sway + animationState.time * 0.0015) * 0.00015 * deltaTime;
        leaf.rotation += leaf.rotSpeed * deltaTime;
        leaf.sway += 0.0015;

        if (leaf.y > 1.15) {
            leaf.y = -0.1;
            leaf.x = Math.random();
        }
    }
}

/**
 * Draw falling leaves for forest terrain
 */
export function drawFallingLeaves(ctx, cx, cy, hexSize) {
    ctx.save();

    for (const leaf of animationState.fallingLeaves) {
        const lx = cx + (leaf.x - 0.5) * hexSize * 1.8;
        const ly = cy + (leaf.y - 0.5) * hexSize * 1.8;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(leaf.rotation);

        ctx.fillStyle = leaf.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.size, leaf.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    ctx.restore();
}

/**
 * Draw flower patches for flower terrain
 */
export function drawFlowers(ctx, cx, cy, hexSize, q, r) {
    const seed = q * 100 + r;
    const flowerCount = 15;
    const phase = animationState.time * 0.0008;

    ctx.save();

    // Flower colors - natural palette
    const colors = ['#ff6b6b', '#ffd93d', '#ffffff', '#ff9ecd', '#b19cd9'];

    for (let i = 0; i < flowerCount; i++) {
        const angle = seededRandom(seed + i) * Math.PI * 2;
        const dist = seededRandom(seed + i + 50) * hexSize * 0.65;
        const fx = cx + Math.cos(angle) * dist;
        const fy = cy + Math.sin(angle) * dist;

        const color = colors[Math.floor(seededRandom(seed + i + 100) * colors.length)];
        const size = 1.5 + seededRandom(seed + i + 150) * 2.5;

        // Gentle swaying
        const sway = Math.sin(phase + seededRandom(seed + i) * 4) * 1.5;

        // Stem
        ctx.strokeStyle = '#2d6a2d';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(fx, fy + 3);
        ctx.quadraticCurveTo(fx + sway * 0.3, fy, fx + sway * 0.5, fy - 4);
        ctx.stroke();

        // Petals
        ctx.fillStyle = color;
        for (let p = 0; p < 5; p++) {
            const petalAngle = (p / 5) * Math.PI * 2;
            const px = fx + Math.cos(petalAngle) * size + sway * 0.4;
            const py = fy - 4 + Math.sin(petalAngle) * size;

            ctx.beginPath();
            ctx.ellipse(px, py, size * 0.5, size * 0.25, petalAngle, 0, Math.PI * 2);
            ctx.fill();
        }

        // Center
        ctx.fillStyle = '#ffdd00';
        ctx.beginPath();
        ctx.arc(fx + sway * 0.4, fy - 4, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Draw heather details
 */
export function drawHeather(ctx, cx, cy, hexSize, q, r) {
    const seed = q * 100 + r;
    const phase = animationState.time * 0.0006;

    ctx.save();

    for (let i = 0; i < 30; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * hexSize * 0.7;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        const sway = Math.sin(phase + rand1 * 5) * 1.2;

        // Small purple/pink flowers
        ctx.fillStyle = `rgb(${140 + rand2 * 50}, ${80 + rand2 * 40}, ${140 + rand2 * 50})`;
        ctx.beginPath();
        ctx.arc(x + sway, y, 1 + rand2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Draw ruins details
 */
export function drawRuins(ctx, cx, cy, hexSize, q, r) {
    const seed = q * 100 + r;

    ctx.save();

    // Broken stone blocks
    for (let i = 0; i < 4; i++) {
        const bx = cx + (seededRandom(seed + i * 5) - 0.5) * hexSize * 1.1;
        const by = cy + (seededRandom(seed + i * 5 + 1) - 0.5) * hexSize * 1.1;
        const size = 6 + seededRandom(seed + i * 5 + 2) * 10;
        const height = 4 + seededRandom(seed + i * 5 + 3) * 8;

        // Stone block
        ctx.fillStyle = `rgb(${100 + seededRandom(seed + i) * 30}, ${95 + seededRandom(seed + i) * 25}, ${90 + seededRandom(seed + i) * 20})`;
        ctx.beginPath();
        ctx.rect(bx - size/2, by - height, size, height);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.rect(bx - size/2, by - height, size, 2);
        ctx.fill();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(bx, by + 1, size * 0.6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Moss/ivy on ruins
    for (let i = 0; i < 8; i++) {
        const mx = cx + (seededRandom(seed + i * 10) - 0.5) * hexSize;
        const my = cy + (seededRandom(seed + i * 10 + 1) - 0.5) * hexSize;

        ctx.fillStyle = `rgba(60, 100, 50, ${0.3 + seededRandom(seed + i) * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(mx, my, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Draw gravel details
 */
export function drawGravel(ctx, cx, cy, hexSize, q, r) {
    const seed = q * 100 + r;

    ctx.save();

    for (let i = 0; i < 40; i++) {
        const gx = cx + (seededRandom(seed + i * 2) - 0.5) * hexSize * 1.4;
        const gy = cy + (seededRandom(seed + i * 2 + 1) - 0.5) * hexSize * 1.4;
        const size = 1 + seededRandom(seed + i * 3) * 3;

        const shade = 0.6 + seededRandom(seed + i) * 0.4;
        ctx.fillStyle = `rgb(${Math.floor(130 * shade)}, ${Math.floor(125 * shade)}, ${Math.floor(115 * shade)})`;
        ctx.beginPath();
        ctx.ellipse(gx, gy, size, size * 0.7, seededRandom(seed + i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Draw farmland details (plowed furrows)
 */
export function drawFarmland(ctx, cx, cy, hexSize, _q, _r) {
    ctx.save();

    ctx.strokeStyle = 'rgba(90, 75, 50, 0.4)';
    ctx.lineWidth = 2;

    // Plowed rows
    for (let i = -3; i <= 3; i++) {
        const y = cy + i * hexSize * 0.25;
        ctx.beginPath();
        ctx.moveTo(cx - hexSize * 0.8, y);
        ctx.lineTo(cx + hexSize * 0.8, y);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Draw mud details
 */
export function drawMud(ctx, cx, cy, hexSize, q, r) {
    const seed = q * 100 + r;
    const phase = animationState.time * 0.001;

    ctx.save();

    // Puddles
    for (let i = 0; i < 4; i++) {
        const px = cx + (seededRandom(seed + i * 4) - 0.5) * hexSize;
        const py = cy + (seededRandom(seed + i * 4 + 1) - 0.5) * hexSize;
        const size = 5 + seededRandom(seed + i * 4 + 2) * 10;

        ctx.fillStyle = 'rgba(70, 55, 35, 0.4)';
        ctx.beginPath();
        ctx.ellipse(px, py, size, size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Reflection
        const reflectAlpha = Math.sin(phase + i) * 0.1 + 0.1;
        ctx.fillStyle = `rgba(150, 170, 200, ${reflectAlpha})`;
        ctx.beginPath();
        ctx.ellipse(px - size * 0.2, py - size * 0.2, size * 0.3, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// ===== CHARACTER ANIMATION SYSTEM =====

/**
 * Character animation states
 */
export const CHAR_ANIM = {
    IDLE: 'idle',
    WALK: 'walk',
    ATTACK: 'attack',
    HIT: 'hit',
    DEATH: 'death',
    SPECIAL: 'special'
};

/**
 * Initialize character animation
 */
export function initCharacterAnimation(unitId) {
    if (!animationState.unitAnimations.has(unitId)) {
        animationState.unitAnimations.set(unitId, {
            state: CHAR_ANIM.IDLE,
            frame: 0,
            time: 0,
            bobOffset: 0,
            breatheOffset: 0,
            weaponAngle: 0,
            lastState: CHAR_ANIM.IDLE
        });
    }
    return animationState.unitAnimations.get(unitId);
}

/**
 * Set character animation state
 */
export function setCharacterAnimation(unitId, animState) {
    const anim = initCharacterAnimation(unitId);
    if (anim.state !== animState) {
        anim.lastState = anim.state;
        anim.state = animState;
        anim.frame = 0;
        anim.time = 0;
    }
}

/**
 * Update character animations
 */
function updateCharacterAnimations(deltaTime) {
    for (const [_unitId, anim] of animationState.unitAnimations) {
        anim.time += deltaTime;

        // Idle breathing
        anim.breatheOffset = Math.sin(anim.time * 0.003) * 1.5;

        switch (anim.state) {
            case CHAR_ANIM.IDLE:
                // Gentle bob
                anim.bobOffset = Math.sin(anim.time * 0.002) * 1.2;
                break;

            case CHAR_ANIM.WALK:
                // Walking bob
                anim.bobOffset = Math.abs(Math.sin(anim.time * 0.012)) * 3.5;
                break;

            case CHAR_ANIM.ATTACK: {
                // Attack animation
                const attackProgress = Math.min(1, anim.time / 300);
                anim.weaponAngle = Math.sin(attackProgress * Math.PI) * 0.4;
                if (attackProgress >= 1) {
                    anim.state = CHAR_ANIM.IDLE;
                }
                break;
            }

            case CHAR_ANIM.HIT: {
                // Hit recoil
                const hitProgress = Math.min(1, anim.time / 200);
                anim.bobOffset = Math.sin(hitProgress * Math.PI * 2) * 4;
                if (hitProgress >= 1) {
                    anim.state = CHAR_ANIM.IDLE;
                }
                break;
            }

            case CHAR_ANIM.DEATH: {
                // Death animation (stays in this state)
                const deathProgress = Math.min(1, anim.time / 500);
                anim.bobOffset = deathProgress * 18;
                break;
            }

            case CHAR_ANIM.SPECIAL: {
                // Special ability effect
                const specialProgress = Math.min(1, anim.time / 400);
                anim.bobOffset = Math.sin(specialProgress * Math.PI * 3) * 2.5;
                if (specialProgress >= 1) {
                    anim.state = CHAR_ANIM.IDLE;
                }
                break;
            }
        }
    }
}

/**
 * Get character animation state for rendering
 */
export function getCharacterAnimState(unitId) {
    return initCharacterAnimation(unitId);
}

/**
 * Apply character animation to drawing context
 */
export function applyCharacterAnimation(ctx, unitId, _baseY) {
    const anim = getCharacterAnimState(unitId);

    // Apply breathing/bob offset
    const yOffset = anim.bobOffset + anim.breatheOffset * 0.4;
    ctx.translate(0, -yOffset);

    // Apply weapon angle if attacking
    if (anim.weaponAngle !== 0) {
        ctx.rotate(anim.weaponAngle);
    }

    return anim;
}

// ===== TERRAIN BLENDING =====

/**
 * Get neighboring terrain types for blending
 */
export function getNeighborTerrains(hexMap, q, r) {
    // Directions ordered to match hex edge indices (starting from angle 0, going clockwise)
    // Edge 0 (0°-60°) = East, Edge 1 (60°-120°) = Southeast, Edge 2 (120°-180°) = Southwest
    // Edge 3 (180°-240°) = West, Edge 4 (240°-300°) = Northwest, Edge 5 (300°-360°) = Northeast
    const directions = [
        [1, 0], [0, 1], [-1, 1],
        [-1, 0], [0, -1], [1, -1]
    ];

    const neighbors = [];
    for (const [dq, dr] of directions) {
        const key = `${q + dq},${r + dr}`;
        const hex = hexMap.get(key);
        neighbors.push(hex ? hex.type : null);
    }

    return neighbors;
}

/**
 * Draw enhanced terrain transition/blend effects with organic edges
 * Uses full hex size for seamless edge-to-edge transitions
 */
export function drawTerrainBlend(ctx, cx, cy, hexSize, currentType, neighbors) {
    ctx.save();

    const currentTerrain = TERRAIN[currentType];
    if (!currentTerrain) {
        ctx.restore();
        return;
    }

    // Process each neighbor for blending
    for (let i = 0; i < 6; i++) {
        const neighborType = neighbors[i];
        if (!neighborType || neighborType === currentType) continue;

        const neighborTerrain = TERRAIN[neighborType];
        if (!neighborTerrain) continue;

        // Calculate edge positions - use FULL hex size for seamless tiling
        const angle = (Math.PI / 3) * i;
        const nextAngle = (Math.PI / 3) * ((i + 1) % 6);

        // Edge points at full hex size for seamless connection
        const x1 = cx + Math.cos(angle) * hexSize;
        const y1 = cy + Math.sin(angle) * hexSize;
        const x2 = cx + Math.cos(nextAngle) * hexSize;
        const y2 = cy + Math.sin(nextAngle) * hexSize;

        // Mid-edge point at full hex size
        const midAngle = (angle + nextAngle) / 2;
        const midX = cx + Math.cos(midAngle) * hexSize;
        const midY = cy + Math.sin(midAngle) * hexSize;

        // Create multi-layer blending for realistic transition
        for (let layer = 0; layer < 3; layer++) {
            const blendDepth = 0.3 + layer * 0.15;
            const alpha = 0.25 - layer * 0.07;

            // Inner control points for curved blend
            const innerX1 = cx + (x1 - cx) * (1 - blendDepth);
            const innerY1 = cy + (y1 - cy) * (1 - blendDepth);
            const innerX2 = cx + (x2 - cx) * (1 - blendDepth);
            const innerY2 = cy + (y2 - cy) * (1 - blendDepth);
            const innerMidX = cx + (midX - cx) * (1 - blendDepth * 0.8);
            const innerMidY = cy + (midY - cy) * (1 - blendDepth * 0.8);

            // Create gradient from neighbor color to transparent
            const gradient = ctx.createLinearGradient(midX, midY, innerMidX, innerMidY);
            gradient.addColorStop(0, neighborTerrain.color);
            gradient.addColorStop(0.4, `${neighborTerrain.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
            gradient.addColorStop(1, 'transparent');

            // Draw curved blend region
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.quadraticCurveTo(midX + (innerMidX - midX) * 0.3, midY + (innerMidY - midY) * 0.3, x2, y2);
            ctx.lineTo(innerX2, innerY2);
            ctx.quadraticCurveTo(innerMidX, innerMidY, innerX1, innerY1);
            ctx.closePath();
            ctx.fill();
        }

        // Add noise-based edge detail for organic transition
        const edgeNoise = seededRandom(cx * 100 + cy + i * 50);
        for (let j = 0; j < 5; j++) {
            const t = j / 4;
            const noiseOffset = seededRandom(i * 100 + j * 30 + cx) * 0.15;

            // Position along edge
            const edgeX = x1 + (x2 - x1) * t;
            const edgeY = y1 + (y2 - y1) * t;

            // Small organic blob
            const blobSize = hexSize * (0.08 + noiseOffset);
            const blobDepth = hexSize * (0.12 + edgeNoise * 0.08);

            const blobX = edgeX + (cx - edgeX) * (blobDepth / hexSize);
            const blobY = edgeY + (cy - edgeY) * (blobDepth / hexSize);

            const gradient = ctx.createRadialGradient(blobX, blobY, 0, blobX, blobY, blobSize);
            gradient.addColorStop(0, `${neighborTerrain.color}40`);
            gradient.addColorStop(1, 'transparent');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(blobX, blobY, blobSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

/**
 * Main animation loop tick
 */
let lastAnimTime = 0;
export function animationTick(timestamp) {
    const deltaTime = lastAnimTime ? timestamp - lastAnimTime : 16;
    lastAnimTime = timestamp;

    updateAnimations(deltaTime);
}

/**
 * Reset animation state
 */
export function resetAnimations() {
    animationState.time = 0;
    animationState.grassBlades.clear();
    animationState.waterRipples = [];
    animationState.snowflakes = [];
    animationState.unitAnimations.clear();
    animationState.fireflies = [];
    animationState.dustMotes = [];
    animationState.fallingLeaves = [];
    animationState.reedPositions.clear();
    lastAnimTime = 0;
}
