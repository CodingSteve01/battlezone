/**
 * PixiJS WebGL Renderer for Shadow Squad
 * Hardware-accelerated rendering with smooth animations
 */

import { Application, Container, Graphics, Text, TextStyle, Sprite, Texture, RenderTexture, Assets } from 'pixi.js';
import { CONFIG, TERRAIN, UNIT_CLASSES } from './config.js';
import { state, getHex, getCurrentUnit } from './state.js';
import { hexToPixel, pixelToHex } from './hexMath.js';
import { isHexVisible, isHexExplored } from './fogOfWar.js';
import { getReachableHexes } from './pathfinding.js';
import { getAttackableUnits } from './units.js';
import { getPowerupAt } from './powerups.js';

// ===== PIXI APPLICATION =====
let app = null;
let gameContainer = null;
let terrainLayer = null;
let detailsLayer = null;
let unitsLayer = null;
let uiLayer = null;
let particlesLayer = null;

// Cached textures
const hexTextureCache = new Map();
const terrainGraphicsCache = new Map();

// Animation state
let animationTime = 0;

// Seeded random for consistent per-hex variation
function seededRandom(seed) {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
}

/**
 * Initialize the PixiJS renderer
 */
export async function initRenderer() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    // Create PixiJS Application
    app = new Application();

    await app.init({
        canvas: canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x1a1a2e,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        powerPreference: 'high-performance'
    });

    // Create layer hierarchy
    gameContainer = new Container();
    gameContainer.sortableChildren = true;

    terrainLayer = new Container();
    terrainLayer.zIndex = 0;

    detailsLayer = new Container();
    detailsLayer.zIndex = 1;

    unitsLayer = new Container();
    unitsLayer.zIndex = 2;
    unitsLayer.sortableChildren = true;

    particlesLayer = new Container();
    particlesLayer.zIndex = 3;

    uiLayer = new Container();
    uiLayer.zIndex = 10;

    gameContainer.addChild(terrainLayer);
    gameContainer.addChild(detailsLayer);
    gameContainer.addChild(unitsLayer);
    gameContainer.addChild(particlesLayer);
    gameContainer.addChild(uiLayer);

    app.stage.addChild(gameContainer);

    // Start animation loop
    app.ticker.add((ticker) => {
        animationTime += ticker.deltaMS;
        updateAnimations(ticker.deltaMS);
    });

    // Handle resize
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    console.log('[PixiRenderer] WebGL renderer initialized');
}

/**
 * Resize canvas to fit window
 */
export function resizeCanvas() {
    if (!app) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    app.renderer.resize(width, height);
    state.canvasWidth = width;
    state.canvasHeight = height;

    // Update camera offset
    state.offsetX = width / 2 + state.cameraX;
    state.offsetY = height / 2 + state.cameraY;
}

/**
 * Clear all render caches
 */
export function clearRenderCaches() {
    hexTextureCache.clear();
    terrainGraphicsCache.clear();

    // Clear layer children
    if (terrainLayer) terrainLayer.removeChildren();
    if (detailsLayer) detailsLayer.removeChildren();
    if (unitsLayer) unitsLayer.removeChildren();
    if (particlesLayer) particlesLayer.removeChildren();
    if (uiLayer) uiLayer.removeChildren();
}

/**
 * Main render function
 */
export function render() {
    if (!app || state.screen !== null) return;

    // Update container position (camera)
    gameContainer.x = state.offsetX;
    gameContainer.y = state.offsetY;
    gameContainer.scale.set(state.zoomLevel);

    // Clear and rebuild layers
    terrainLayer.removeChildren();
    detailsLayer.removeChildren();
    unitsLayer.removeChildren();
    uiLayer.removeChildren();

    const currentUnit = getCurrentUnit();
    const reachableHexes = currentUnit && state.selectedAction === 'move'
        ? getReachableHexes(currentUnit)
        : new Map();
    const attackableUnits = currentUnit && state.selectedAction === 'attack'
        ? getAttackableUnits(currentUnit)
        : [];

    // Render hexes
    for (const hex of state.hexes) {
        renderHex(hex, reachableHexes, attackableUnits);
    }

    // Render units
    for (const unit of state.units) {
        if (unit.alive) {
            renderUnit(unit);
        }
    }

    // Render UI overlays
    renderUIOverlays(currentUnit, reachableHexes, attackableUnits);
}

/**
 * Render a single hex tile
 */
function renderHex(hex, reachableHexes, attackableUnits) {
    const pos = hexToPixel(hex.q, hex.r, state.hexSize);
    const fogLevel = getFogLevel(hex.q, hex.r);

    if (fogLevel === 'hidden' && !state.settings.singlePlayer) {
        // Draw black hex for hidden areas
        const blackHex = createHexGraphics(state.hexSize, 0x000000, 1);
        blackHex.x = pos.x;
        blackHex.y = pos.y;
        terrainLayer.addChild(blackHex);
        return;
    }

    const terrain = TERRAIN[hex.type];
    const color = hexColorToNumber(terrain.color);

    // Create hex base
    const hexGraphics = createHexGraphics(state.hexSize, color, fogLevel === 'explored' ? 0.5 : 1);
    hexGraphics.x = pos.x;
    hexGraphics.y = pos.y;
    terrainLayer.addChild(hexGraphics);

    // Add terrain details
    if (fogLevel === 'visible') {
        const details = createTerrainDetails(hex, state.hexSize);
        details.x = pos.x;
        details.y = pos.y;
        detailsLayer.addChild(details);
    }

    // Movement highlight
    if (reachableHexes.has(`${hex.q},${hex.r}`) && !hex.unit) {
        const highlight = createMovementHighlight(state.hexSize);
        highlight.x = pos.x;
        highlight.y = pos.y;
        uiLayer.addChild(highlight);
    }

    // Power-up
    const powerup = getPowerupAt(hex.q, hex.r);
    if (powerup && fogLevel === 'visible') {
        const powerupSprite = createPowerupGraphics(powerup, state.hexSize);
        powerupSprite.x = pos.x;
        powerupSprite.y = pos.y;
        uiLayer.addChild(powerupSprite);
    }
}

/**
 * Create hex graphics
 */
function createHexGraphics(size, color, alpha = 1) {
    const graphics = new Graphics();

    graphics.poly(getHexPoints(size));
    graphics.fill({ color, alpha });

    return graphics;
}

/**
 * Get hex corner points
 */
function getHexPoints(size) {
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        points.push(Math.cos(angle) * size);
        points.push(Math.sin(angle) * size);
    }
    return points;
}

/**
 * Create terrain detail graphics with animations
 */
function createTerrainDetails(hex, size) {
    const container = new Container();
    const seed = hex.q * 127 + hex.r * 311 + hex.q * hex.r * 7;

    switch (hex.type) {
        case 'grass':
            addGrassBlades(container, size, seed);
            break;
        case 'forest':
            addForestDetails(container, size, seed);
            break;
        case 'water':
        case 'river':
        case 'deepwater':
            addWaterDetails(container, size, seed, hex.type === 'deepwater');
            break;
        case 'sand':
            addSandDetails(container, size, seed);
            break;
        case 'snow':
            addSnowDetails(container, size, seed);
            break;
        case 'flowers':
            addGrassBlades(container, size, seed);
            addFlowers(container, size, seed);
            break;
        case 'wheat':
            addWheatField(container, size, seed);
            break;
        case 'tallgrass':
            addGrassBlades(container, size, seed, 1.8);
            break;
        case 'reeds':
            addReeds(container, size, seed);
            break;
    }

    return container;
}

/**
 * Add animated grass blades
 */
function addGrassBlades(container, size, seed, heightMult = 1) {
    const bladeCount = 50;

    for (let i = 0; i < bladeCount; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);
        const rand3 = seededRandom(seed + i * 3 + 2);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * size * 0.75;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;

        const height = (4 + rand3 * 10) * heightMult;
        const thickness = 0.5 + rand3 * 0.8;

        // Animated sway based on time and position
        const swayPhase = rand1 * Math.PI * 2;
        const swayAmount = Math.sin(animationTime * 0.002 + swayPhase) * 3;

        const blade = new Graphics();
        blade.moveTo(x, y);
        blade.quadraticCurveTo(
            x + swayAmount * 0.5, y - height * 0.6,
            x + swayAmount, y - height
        );
        blade.stroke({
            width: thickness,
            color: 0x228B22 + Math.floor(rand2 * 0x003300),
            cap: 'round'
        });

        container.addChild(blade);
    }
}

/**
 * Add forest floor details
 */
function addForestDetails(container, size, seed) {
    // Fallen leaves
    const leafCount = 8;
    const colors = [0x8B4513, 0xD2691E, 0x228B22, 0x6B8E23];

    for (let i = 0; i < leafCount; i++) {
        const x = (seededRandom(seed + i * 5) - 0.5) * size * 1.4;
        const y = (seededRandom(seed + i * 5 + 1) - 0.5) * size * 1.4;
        const leafSize = 2 + seededRandom(seed + i * 5 + 2) * 2;
        const colorIdx = Math.floor(seededRandom(seed + i * 5 + 4) * colors.length);

        const leaf = new Graphics();
        leaf.ellipse(0, 0, leafSize, leafSize * 0.5);
        leaf.fill({ color: colors[colorIdx], alpha: 0.7 });
        leaf.x = x;
        leaf.y = y;
        leaf.rotation = seededRandom(seed + i * 5 + 3) * Math.PI * 2;

        container.addChild(leaf);
    }

    // Animated fireflies (evening effect)
    for (let i = 0; i < 3; i++) {
        const fireflyPhase = seededRandom(seed + i * 20) * Math.PI * 2;
        const glow = Math.sin(animationTime * 0.003 + fireflyPhase) * 0.5 + 0.5;

        if (glow > 0.3) {
            const fx = (seededRandom(seed + i * 7) - 0.5) * size;
            const fy = (seededRandom(seed + i * 7 + 1) - 0.5) * size;

            const firefly = new Graphics();
            firefly.circle(0, 0, 2);
            firefly.fill({ color: 0xCCFF66, alpha: glow * 0.8 });
            firefly.x = fx + Math.sin(animationTime * 0.001 + fireflyPhase) * 5;
            firefly.y = fy + Math.cos(animationTime * 0.0015 + fireflyPhase) * 3;

            container.addChild(firefly);
        }
    }
}

/**
 * Add animated water details
 */
function addWaterDetails(container, size, seed, isDeep = false) {
    // Animated wave lines
    for (let i = 0; i < 4; i++) {
        const yOffset = (seededRandom(seed + i * 10) - 0.5) * size;
        const wavePhase = seededRandom(seed + i * 20) * Math.PI * 2;

        const wave = new Graphics();
        wave.moveTo(-size * 0.8, yOffset);

        for (let x = -size * 0.8; x <= size * 0.8; x += 8) {
            const waveY = yOffset + Math.sin((x / 20) + animationTime * 0.003 + wavePhase) * 4;
            wave.lineTo(x, waveY);
        }

        wave.stroke({ width: 1.5, color: 0x78B4DC, alpha: 0.3 });
        container.addChild(wave);
    }

    // Animated sparkles
    const sparkleCount = isDeep ? 2 : 5;
    for (let i = 0; i < sparkleCount; i++) {
        const sparklePhase = seededRandom(seed + i * 100) * Math.PI * 2;
        const sparkleAlpha = Math.sin(animationTime * 0.004 + sparklePhase) * 0.5 + 0.5;

        if (sparkleAlpha > 0.5) {
            const sx = (seededRandom(seed + i * 7) - 0.5) * size * 1.2;
            const sy = (seededRandom(seed + i * 11) - 0.5) * size * 1.2;

            const sparkle = new Graphics();
            sparkle.circle(0, 0, 1.5);
            sparkle.fill({ color: 0xFFFFFF, alpha: sparkleAlpha * 0.6 });
            sparkle.x = sx;
            sparkle.y = sy;

            container.addChild(sparkle);
        }
    }
}

/**
 * Add sand details with dust particles
 */
function addSandDetails(container, size, seed) {
    // Sand ripples
    for (let i = 0; i < 5; i++) {
        const rx = (seededRandom(seed + i * 4) - 0.5) * size;
        const ry = (seededRandom(seed + i * 4 + 1) - 0.5) * size;
        const rippleWidth = 8 + seededRandom(seed + i * 4 + 2) * 12;

        const ripple = new Graphics();
        ripple.ellipse(0, 0, rippleWidth, 2);
        ripple.fill({ color: 0xC2B280, alpha: 0.3 });
        ripple.x = rx;
        ripple.y = ry;
        ripple.rotation = seededRandom(seed + i) * 0.5 - 0.25;

        container.addChild(ripple);
    }

    // Animated dust motes
    for (let i = 0; i < 6; i++) {
        const dustPhase = seededRandom(seed + i * 50) * Math.PI * 2;
        const dustY = (seededRandom(seed + i * 6 + 1) - 0.5) * size * 1.2;

        const mote = new Graphics();
        mote.circle(0, 0, 0.8);
        mote.fill({ color: 0xC8B496, alpha: 0.4 });

        // Floating animation
        mote.x = (seededRandom(seed + i * 6) - 0.5) * size * 1.2;
        mote.y = dustY + Math.sin(animationTime * 0.002 + dustPhase) * 5;

        container.addChild(mote);
    }
}

/**
 * Add snow details with falling snowflakes
 */
function addSnowDetails(container, size, seed) {
    // Snow mounds
    for (let i = 0; i < 5; i++) {
        const mx = (seededRandom(seed + i * 5) - 0.5) * size;
        const my = (seededRandom(seed + i * 5 + 1) - 0.5) * size;
        const moundSize = 4 + seededRandom(seed + i * 5 + 2) * 8;

        const mound = new Graphics();
        mound.ellipse(0, 0, moundSize, moundSize * 0.5);
        mound.fill({ color: 0xFFFFFF, alpha: 0.5 });
        mound.x = mx;
        mound.y = my;

        container.addChild(mound);
    }

    // Animated snowflakes
    for (let i = 0; i < 8; i++) {
        const flakePhase = seededRandom(seed + i * 30);
        const flakeY = ((animationTime * 0.02 + flakePhase * 100) % (size * 2)) - size;
        const flakeX = (seededRandom(seed + i * 31) - 0.5) * size +
                       Math.sin(animationTime * 0.002 + flakePhase * 10) * 5;

        const flake = new Graphics();
        flake.circle(0, 0, 1 + seededRandom(seed + i * 32));
        flake.fill({ color: 0xFFFFFF, alpha: 0.7 });
        flake.x = flakeX;
        flake.y = flakeY;

        container.addChild(flake);
    }
}

/**
 * Add flower details
 */
function addFlowers(container, size, seed) {
    const flowerCount = 12;
    const colors = [0xFF6B6B, 0xFFD93D, 0xFFFFFF, 0xFF9ECD, 0xB19CD9];

    for (let i = 0; i < flowerCount; i++) {
        const angle = seededRandom(seed + i) * Math.PI * 2;
        const dist = seededRandom(seed + i + 50) * size * 0.6;
        const fx = Math.cos(angle) * dist;
        const fy = Math.sin(angle) * dist;

        const colorIdx = Math.floor(seededRandom(seed + i + 100) * colors.length);
        const flowerSize = 2 + seededRandom(seed + i + 150) * 2;

        // Gentle sway animation
        const sway = Math.sin(animationTime * 0.002 + seededRandom(seed + i) * 10) * 2;

        // Stem
        const stem = new Graphics();
        stem.moveTo(fx, fy + 3);
        stem.quadraticCurveTo(fx + sway * 0.3, fy, fx + sway * 0.5, fy - 4);
        stem.stroke({ width: 0.8, color: 0x2D6A2D });
        container.addChild(stem);

        // Petals
        for (let p = 0; p < 5; p++) {
            const petalAngle = (p / 5) * Math.PI * 2;
            const petal = new Graphics();
            petal.ellipse(0, 0, flowerSize * 0.5, flowerSize * 0.25);
            petal.fill({ color: colors[colorIdx] });
            petal.x = fx + Math.cos(petalAngle) * flowerSize + sway * 0.4;
            petal.y = fy - 4 + Math.sin(petalAngle) * flowerSize;
            petal.rotation = petalAngle;
            container.addChild(petal);
        }

        // Center
        const center = new Graphics();
        center.circle(0, 0, flowerSize * 0.35);
        center.fill({ color: 0xFFDD00 });
        center.x = fx + sway * 0.4;
        center.y = fy - 4;
        container.addChild(center);
    }
}

/**
 * Add wheat field
 */
function addWheatField(container, size, seed) {
    const stalkCount = 40;

    for (let i = 0; i < stalkCount; i++) {
        const rand1 = seededRandom(seed + i * 3);
        const rand2 = seededRandom(seed + i * 3 + 1);
        const rand3 = seededRandom(seed + i * 3 + 2);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * size * 0.7;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;

        const height = 10 + rand3 * 8;

        // Wave animation
        const sway = Math.sin(animationTime * 0.003 + rand1 * 10) * 4;

        const stalk = new Graphics();
        stalk.moveTo(x, y);
        stalk.quadraticCurveTo(x + sway * 0.5, y - height * 0.6, x + sway, y - height);
        stalk.stroke({ width: 1, color: 0xB4962D + Math.floor(rand3 * 0x202000) });
        container.addChild(stalk);

        // Wheat head
        const head = new Graphics();
        head.ellipse(0, 0, 2, 4);
        head.fill({ color: 0xC8AA3C + Math.floor(rand3 * 0x201000) });
        head.x = x + sway;
        head.y = y - height - 3;
        head.rotation = sway * 0.05;
        container.addChild(head);
    }
}

/**
 * Add reeds
 */
function addReeds(container, size, seed) {
    const reedCount = 20;

    for (let i = 0; i < reedCount; i++) {
        const rand1 = seededRandom(seed + i * 4);
        const rand2 = seededRandom(seed + i * 4 + 1);
        const rand3 = seededRandom(seed + i * 4 + 2);

        const angle = rand1 * Math.PI * 2;
        const dist = rand2 * size * 0.65;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;

        const height = 15 + rand3 * 12;
        const sway = Math.sin(animationTime * 0.002 + rand1 * 8) * 5;

        const reed = new Graphics();
        reed.moveTo(x, y);
        reed.quadraticCurveTo(x + sway * 0.3, y - height * 0.7, x + sway, y - height);
        reed.stroke({ width: 1.5, color: 0x466432 + Math.floor(rand3 * 0x101000) });
        container.addChild(reed);

        // Reed head
        if (rand3 > 0.3) {
            const head = new Graphics();
            head.ellipse(0, 0, 2.5, 5);
            head.fill({ color: 0x8B7355, alpha: 0.9 });
            head.x = x + sway;
            head.y = y - height - 4;
            container.addChild(head);
        }
    }
}

/**
 * Create movement highlight
 */
function createMovementHighlight(size) {
    const highlight = new Graphics();
    highlight.poly(getHexPoints(size * 0.85));
    highlight.fill({ color: 0x22C55E, alpha: 0.2 });
    highlight.stroke({ width: 2, color: 0x22C55E, alpha: 0.5 });
    return highlight;
}

/**
 * Create powerup graphics
 */
function createPowerupGraphics(powerup, size) {
    const container = new Container();

    // Glow effect
    const glow = new Graphics();
    const glowAlpha = 0.3 + Math.sin(animationTime * 0.005) * 0.15;
    glow.circle(0, 0, size * 0.35);
    glow.fill({ color: 0xFFD700, alpha: glowAlpha });
    container.addChild(glow);

    // Icon text
    const style = new TextStyle({
        fontSize: size * 0.4,
        fill: 0xFFFFFF
    });
    const icon = new Text({ text: powerup.icon || '?', style });
    icon.anchor.set(0.5);
    container.addChild(icon);

    return container;
}

/**
 * Render a unit
 */
function renderUnit(unit) {
    const pos = hexToPixel(unit.q, unit.r, state.hexSize);
    const fogLevel = getFogLevel(unit.q, unit.r);

    if (fogLevel !== 'visible' && unit.player !== state.viewingPlayer) {
        return; // Don't render enemy units in fog
    }

    const container = new Container();
    container.x = pos.x;
    container.y = pos.y;
    container.zIndex = pos.y; // Depth sorting

    const isSelected = state.units[state.selectedUnit]?.id === unit.id;
    const playerColor = hexColorToNumber(CONFIG.PLAYER_COLORS[unit.player]);

    // Unit body
    const body = new Graphics();
    body.circle(0, -state.hexSize * 0.2, state.hexSize * 0.35);
    body.fill({ color: playerColor });

    if (isSelected) {
        body.stroke({ width: 3, color: 0xFFFFFF });
    }

    container.addChild(body);

    // Health bar
    const hpPct = unit.currentHp / unit.maxHp;
    const hpBarWidth = state.hexSize * 0.6;

    const hpBg = new Graphics();
    hpBg.rect(-hpBarWidth / 2, state.hexSize * 0.2, hpBarWidth, 4);
    hpBg.fill({ color: 0x333333 });
    container.addChild(hpBg);

    const hpFill = new Graphics();
    const hpColor = hpPct > 0.5 ? 0x22C55E : (hpPct > 0.25 ? 0xEAB308 : 0xEF4444);
    hpFill.rect(-hpBarWidth / 2, state.hexSize * 0.2, hpBarWidth * hpPct, 4);
    hpFill.fill({ color: hpColor });
    container.addChild(hpFill);

    // Class icon
    const classInfo = UNIT_CLASSES[unit.class];
    const iconStyle = new TextStyle({ fontSize: state.hexSize * 0.3, fill: 0xFFFFFF });
    const icon = new Text({ text: classInfo?.icon || '?', style: iconStyle });
    icon.anchor.set(0.5);
    icon.y = -state.hexSize * 0.2;
    container.addChild(icon);

    unitsLayer.addChild(container);
}

/**
 * Render UI overlays (path preview, attack lines, etc.)
 */
function renderUIOverlays(currentUnit, reachableHexes, attackableUnits) {
    // Path preview
    if (state.currentPath && state.currentPath.length >= 2) {
        const pathGraphics = new Graphics();

        for (let i = 0; i < state.currentPath.length; i++) {
            const point = state.currentPath[i];
            const pos = hexToPixel(point.q, point.r, state.hexSize);

            if (i === 0) {
                pathGraphics.moveTo(pos.x, pos.y);
            } else {
                pathGraphics.lineTo(pos.x, pos.y);
            }
        }

        pathGraphics.stroke({ width: 3, color: 0x22C55E, alpha: 0.8 });
        uiLayer.addChild(pathGraphics);

        // Destination marker
        const dest = state.currentPath[state.currentPath.length - 1];
        const destPos = hexToPixel(dest.q, dest.r, state.hexSize);
        const destMarker = new Graphics();
        destMarker.circle(0, 0, state.hexSize * 0.3);
        destMarker.fill({ color: 0x22C55E, alpha: 0.4 });
        destMarker.stroke({ width: 2, color: 0x22C55E });
        destMarker.x = destPos.x;
        destMarker.y = destPos.y;
        uiLayer.addChild(destMarker);
    }

    // Attack lines
    if (state.targetedUnit && currentUnit) {
        const fromPos = hexToPixel(currentUnit.q, currentUnit.r, state.hexSize);
        const toPos = hexToPixel(state.targetedUnit.q, state.targetedUnit.r, state.hexSize);

        const attackLine = new Graphics();
        attackLine.moveTo(fromPos.x, fromPos.y);
        attackLine.lineTo(toPos.x, toPos.y);
        attackLine.stroke({ width: 3, color: 0xEF4444, alpha: 0.8 });
        uiLayer.addChild(attackLine);
    }
}

/**
 * Update animations (called every frame by ticker)
 */
function updateAnimations(deltaMS) {
    // Animation updates are handled inline in terrain details
    // This function can be used for global particle systems
}

/**
 * Get fog level for a hex
 */
function getFogLevel(q, r) {
    if (isHexVisible(q, r)) return 'visible';
    if (isHexExplored(q, r)) return 'explored';
    return 'hidden';
}

/**
 * Convert hex color string to number
 */
function hexColorToNumber(hexString) {
    if (typeof hexString === 'number') return hexString;
    return parseInt(hexString.replace('#', ''), 16);
}

/**
 * Start continuous render loop
 */
export function startRenderLoop() {
    // PixiJS handles this automatically via ticker
    console.log('[PixiRenderer] Render loop started');
}
