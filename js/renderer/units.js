// ===== UNIT RENDERING =====
// Functions for drawing units, ghosts, and unit overlays

import { state, getHex, getPlayerUnits, arePlayersAllied } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { TERRAIN, CONFIG } from '../config.js';
import { safeRadialGradient, safeLinearGradient } from './gradients.js';
import { getUnitOutlineColor } from './colors.js';
import { drawUnitSprite } from '../assetLoader.js';
import { getEnemyCloakedVisibilityAlpha } from '../fogOfWar.js';

/**
 * Draw terrain camouflage pattern for invisible cloaked units
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {number} size - Unit size
 * @param {Object} unit - The cloaked unit
 */
export function drawCamouflagePattern(ctx, cx, cy, size, unit) {
    // Get terrain at unit's position
    const hex = getHex(unit.q, unit.r);
    if (!hex) return;

    const terrainData = TERRAIN[hex.type];
    const baseColor = terrainData?.color || '#2d5a40';

    // Parse base color
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Deterministic pseudo-random for camo shapes (stable per unit position)
    const seed = (unit.q * 73856093) ^ (unit.r * 19349663);
    const rand = (offset) => {
        const x = Math.sin(seed + offset) * 43758.5453;
        return x - Math.floor(x);
    };

    ctx.save();

    // Base camouflage silhouette
    ctx.globalAlpha = 0.22;

    // Soft camo fill with terrain-tinted gradient
    const baseGrad = safeRadialGradient(
        ctx,
        cx, cy - size * 0.2, 0,
        cx, cy, size * 0.9,
        `rgba(${r}, ${g}, ${b}, 0.2)`
    );
    if (typeof baseGrad !== 'string') {
        baseGrad.addColorStop(0, `rgba(${r + 20}, ${g + 20}, ${b + 20}, 0.3)`);
        baseGrad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.18)`);
        baseGrad.addColorStop(1, 'transparent');
    }
    ctx.fillStyle = baseGrad;

    // Draw subtle humanoid shape
    ctx.beginPath();
    // Head
    ctx.arc(cx, cy - size * 0.5, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Body (oval)
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.25, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Add low-contrast camo blotches
    for (let i = 0; i < 6; i++) {
        const angle = rand(i * 11) * Math.PI * 2;
        const radius = size * (0.1 + rand(i * 7) * 0.35);
        const blotchX = cx + Math.cos(angle) * radius;
        const blotchY = cy + Math.sin(angle) * radius * 0.6;
        const blotchSize = size * (0.12 + rand(i * 17) * 0.18);
        const shade = rand(i * 19) > 0.5 ? 18 : -12;
        ctx.fillStyle = `rgba(${r + shade}, ${g + shade}, ${b + shade}, 0.22)`;
        ctx.beginPath();
        ctx.ellipse(blotchX, blotchY, blotchSize * 0.9, blotchSize * 0.6, angle, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Calculate stealth unit visibility alpha based on distance to nearest friendly unit.
 * Stealth units become more visible the closer they are to friendly non-cloaked units.
 * @param {Object} stealthUnit - The cloaked unit to calculate visibility for
 * @returns {number} Alpha value between 0 (invisible) and 0.85 (nearly visible)
 */
export function getStealthVisibilityAlpha(stealthUnit) {
    const friendlyUnits = getPlayerUnits(stealthUnit.player);

    // Find the nearest non-cloaked friendly unit
    let minDistance = Infinity;
    for (const unit of friendlyUnits) {
        // Skip the stealth unit itself and other cloaked units
        if (unit.id === stealthUnit.id || unit.cloaked) continue;

        const distance = hexDistance(
            { q: stealthUnit.q, r: stealthUnit.r },
            { q: unit.q, r: unit.r }
        );
        minDistance = Math.min(minDistance, distance);
    }

    // If no friendly units nearby, use moderate visibility
    if (minDistance === Infinity) {
        return 0.4;
    }

    // Distance-based transparency:
    // 0-1 hexes: High visibility (alpha 0.7-0.85)
    // 2-3 hexes: Medium visibility (alpha 0.4-0.6)
    // 4-5 hexes: Low visibility (alpha 0.2-0.35)
    // 6+ hexes: Very low visibility (alpha 0.1-0.15)
    if (minDistance <= 1) {
        return 0.85 - minDistance * 0.15;
    } else if (minDistance <= 3) {
        return 0.6 - (minDistance - 1) * 0.1;
    } else if (minDistance <= 5) {
        return 0.35 - (minDistance - 3) * 0.075;
    } else {
        // Beyond 5 hexes, very low visibility with minimum floor
        return Math.max(0.1, 0.2 - (minDistance - 5) * 0.02);
    }
}

/**
 * Draw a ghost indicator showing where a cloaked unit last attacked from
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {Object} ghost - Ghost indicator data
 */
export function drawGhostIndicator(ctx, cx, cy, ghost) {
    const size = state.hexSize * 0.65;
    const now = Date.now();
    const fadeStart = ghost.fadeStart || (ghost.timestamp + 3000);

    // Calculate opacity - full for 3 seconds, then fade out over 5 seconds
    let alpha = 1;
    if (now > fadeStart) {
        const fadeProgress = (now - fadeStart) / 5000;
        alpha = Math.max(0, 1 - fadeProgress);
    }

    // Pulse effect
    const pulse = 0.8 + Math.sin(now / 200) * 0.2;

    ctx.save();
    ctx.globalAlpha = alpha * 0.6 * pulse;

    // Ghost silhouette - ethereal glow effect
    const playerColor = CONFIG.PLAYER_COLORS[ghost.player];

    // Outer glow ring - pulsing warning
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.8})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, size + 15 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner danger zone
    const gradient = safeRadialGradient(ctx, cx, cy, 0, cx, cy, size + 10, `rgba(239, 68, 68, ${alpha * 0.2})`);
    if (typeof gradient !== 'string') {
        gradient.addColorStop(0, `rgba(239, 68, 68, ${alpha * 0.3})`);
        gradient.addColorStop(0.7, `rgba(239, 68, 68, ${alpha * 0.15})`);
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size + 10, 0, Math.PI * 2);
    ctx.fill();

    // Ghost silhouette shape
    ctx.globalAlpha = alpha * 0.4 * pulse;
    ctx.fillStyle = playerColor;

    // Draw ghostly human shape
    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.5, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.3, cy - size * 0.2);
    ctx.lineTo(cx + size * 0.3, cy - size * 0.2);
    ctx.lineTo(cx + size * 0.25, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.25, cy + size * 0.3);
    ctx.closePath();
    ctx.fill();

    // Arms
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = playerColor;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.3, cy - size * 0.1);
    ctx.lineTo(cx - size * 0.5, cy + size * 0.1);
    ctx.moveTo(cx + size * 0.3, cy - size * 0.1);
    ctx.lineTo(cx + size * 0.5, cy + size * 0.1);
    ctx.stroke();

    // Warning icon
    ctx.globalAlpha = alpha * 0.9;
    ctx.font = `bold ${Math.round(size * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('👻', cx, cy - size - 15);
    ctx.shadowBlur = 0;

    // "Letzter Angriff" text
    ctx.globalAlpha = alpha * 0.7;
    ctx.font = `bold ${Math.round(size * 0.22)}px sans-serif`;
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('LETZTER ANGRIFF', cx, cy + size + 20);

    ctx.restore();
}

/**
 * Draw a speech bubble with text above a unit
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} text - Text to display
 * @param {string} color - Bubble border and text color
 * @param {number} size - Size multiplier
 */
export function drawSpeechBubble(ctx, x, y, text, color, size) {
    ctx.save();

    const padding = size * 0.15;
    const fontSize = Math.round(size * 0.28);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const bubbleWidth = textWidth + padding * 2;
    const bubbleHeight = fontSize + padding * 1.5;

    // Bubble background with rounded corners
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x - bubbleWidth / 2, y - bubbleHeight / 2, bubbleWidth, bubbleHeight, 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Speech bubble pointer (triangle pointing down)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + bubbleHeight / 2);
    ctx.lineTo(x, y + bubbleHeight / 2 + 10);
    ctx.lineTo(x + 8, y + bubbleHeight / 2);
    ctx.closePath();
    ctx.fill();

    // Pointer border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + bubbleHeight / 2);
    ctx.lineTo(x, y + bubbleHeight / 2 + 10);
    ctx.lineTo(x + 8, y + bubbleHeight / 2);
    ctx.stroke();

    // Text
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);

    ctx.restore();
}

/**
 * Draw a human unit with equipment
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} unit - Unit to draw
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {boolean} isSelected - Whether unit is selected
 * @param {boolean} isTargeted - Whether unit is targeted
 * @param {boolean} isAttackable - Whether unit can be attacked
 * @param {boolean} isBlocked - Whether unit is blocked by LOS
 * @param {Object} blockedInfo - Info about what's blocking
 */
export function drawUnit(ctx, unit, cx, cy, isSelected, isTargeted, isAttackable, isBlocked = false, blockedInfo = null) {
    const size = state.hexSize * 0.59;
    const playerColor = CONFIG.PLAYER_COLORS[unit.player];

    ctx.save();

    // Cloaked units visibility based on distance to nearest friendly unit
    let isCamouflagedEnemy = false;
    if (unit.cloaked && unit.player === state.viewingPlayer) {
        ctx.globalAlpha = getStealthVisibilityAlpha(unit);
    } else if (unit.cloaked && unit.player !== state.viewingPlayer) {
        const alpha = getEnemyCloakedVisibilityAlpha(unit, state.viewingPlayer);
        if (alpha > 0) {
            ctx.globalAlpha = alpha;
        } else {
            isCamouflagedEnemy = true;
        }
    } else if (unit.revealedUntilEndOfTurn && unit.player !== state.viewingPlayer) {
        ctx.globalAlpha = 0.6;
    }

    // Draw terrain camouflage pattern for enemy cloaked units not in detection range
    if (isCamouflagedEnemy) {
        drawCamouflagePattern(ctx, cx, cy, size, unit);
        ctx.restore();
        return;
    }

    const unitHex = getHex(unit.q, unit.r);
    const terrainColor = TERRAIN[unitHex?.type]?.color || '#2d5a40';
    const outlineColor = getUnitOutlineColor(terrainColor);

    // Soft shadow under unit feet
    ctx.save();
    ctx.globalAlpha *= 0.3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.3, size * 0.35, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Base ring around unit
    if (isSelected) {
        ctx.strokeStyle = playerColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
    } else {
        ctx.strokeStyle = playerColor;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Determine sprite status
    const unitStatus = unit.hiding
        ? 'cover'
        : (isSelected && state.selectedAction === 'attack'
            ? 'attack'
            : 'normal');

    // Draw the human sprite
    drawUnitSprite(ctx, cx, cy + size * 0.3, size, playerColor, unit.class, unitStatus, isSelected, unit.player);

    // Attackable indicator
    if (isAttackable && !isSelected) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, size + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy - size - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('!', cx, cy - size - 10);
    }

    // Targeted crosshair animation
    if (isTargeted) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        const crossSize = size + 25;

        ctx.beginPath();
        ctx.moveTo(cx - crossSize, cy);
        ctx.lineTo(cx - size - 10, cy);
        ctx.moveTo(cx + size + 10, cy);
        ctx.lineTo(cx + crossSize, cy);
        ctx.moveTo(cx, cy - crossSize);
        ctx.lineTo(cx, cy - size - 10);
        ctx.moveTo(cx, cy + size + 10);
        ctx.lineTo(cx, cy + crossSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, crossSize, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, size + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Blocked target indicator
    if (isBlocked && !isSelected) {
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, size + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = 'rgba(156, 163, 175, 0.8)';
        ctx.lineWidth = 3;
        const xSize = 8;
        const xY = cy - size - 15;
        ctx.beginPath();
        ctx.moveTo(cx - xSize, xY - xSize);
        ctx.lineTo(cx + xSize, xY + xSize);
        ctx.moveTo(cx + xSize, xY - xSize);
        ctx.lineTo(cx - xSize, xY + xSize);
        ctx.stroke();

        ctx.font = `${Math.round(size * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const blockIcon = blockedInfo && blockedInfo.blockedBy === 'rock' ? '🪨' : '🌲';
        ctx.fillText(blockIcon, cx + size * 0.7, cy - size - 15);
    }

    ctx.restore();
}

/**
 * Draw a dead unit as a decoration on the map
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} unit - Dead unit to draw
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 */
export function drawDeadUnit(ctx, unit, cx, cy) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(state.hexSize) || state.hexSize <= 0) {
        return;
    }

    const size = state.hexSize * 0.49;
    const playerColor = CONFIG.PLAYER_COLORS[unit.player];

    ctx.save();
    ctx.filter = 'grayscale(70%) brightness(0.7)';

    try {
        drawUnitSprite(ctx, cx, cy + size * 0.3, size, playerColor, unit.class, 'dead', false, unit.player);
    } catch {
        ctx.fillStyle = playerColor;
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Draw unit overlay - all HUD elements (badges, indicators, HP bar) on top of everything
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} unit - Unit to draw overlay for
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 */
export function drawUnitOverlay(ctx, unit, cx, cy) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(state.hexSize) || state.hexSize <= 0) {
        return;
    }

    const size = state.hexSize * 0.59;
    const playerColor = CONFIG.PLAYER_COLORS[unit.player];

    ctx.save();

    // Enemy indicator
    const isEnemy = unit.player !== state.viewingPlayer && !arePlayersAllied(unit.player, state.viewingPlayer);
    if (isEnemy) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Shield indicator
    if (unit.shield) {
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.font = `${Math.round(size * 0.5)}px sans-serif`;
        ctx.fillText('🛡️', cx, cy - size - 5);
        ctx.shadowBlur = 0;
    }

    // Track vertical offset for speech bubbles
    let speechBubbleOffset = 0;

    // Cover status speech bubble
    if (unit.hiding && unit.player === state.currentPlayer) {
        drawSpeechBubble(ctx, cx + size * 0.6, cy - size * 1.8 - speechBubbleOffset, 'In Deckung', '#22c55e', size * 0.8);
        speechBubbleOffset += size * 0.6;
    }

    // "Spotted!" indicator
    if (unit.spotted && unit.player === state.currentPlayer) {
        ctx.globalAlpha = 1;
        drawSpeechBubble(ctx, cx + size * 0.6, cy - size * 1.8 - speechBubbleOffset, 'Entdeckt!', '#ef4444', size * 0.8);
        speechBubbleOffset += size * 0.6;
    }

    // Cloak indicator
    if (unit.cloaked && unit.player === state.viewingPlayer && !unit.spotted) {
        ctx.globalAlpha = 1;
        drawSpeechBubble(ctx, cx + size * 0.6, cy - size * 1.8 - speechBubbleOffset, 'Getarnt!', '#a855f7', size * 0.8);
        speechBubbleOffset += size * 0.6;
    }

    // Revealed after attack indicator
    if (unit.revealedUntilEndOfTurn && unit.player !== state.viewingPlayer) {
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.font = `${Math.round(size * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️', cx + size * 0.6, cy - size * 0.6);
        ctx.shadowBlur = 0;
    }

    ctx.restore();

    // HP bar
    const rawHpPct = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 0;
    const hpPct = Number.isFinite(rawHpPct) ? Math.max(0, Math.min(1, rawHpPct)) : 0;
    const barWidth = size * 0.8;
    const barHeight = 4;
    const barY = cy - size * 1.1;

    // Bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(cx - barWidth / 2 - 1, barY - 1, barWidth + 2, barHeight + 2, 3);
    ctx.fill();

    // HP bar fill
    const gradientWidth = Math.max(1, barWidth * hpPct);
    const barGradient = safeLinearGradient(ctx, cx - barWidth / 2, barY, cx - barWidth / 2 + gradientWidth, barY, '#22c55e');
    if (typeof barGradient !== 'string') {
        if (hpPct > 0.5) {
            barGradient.addColorStop(0, '#22c55e');
            barGradient.addColorStop(1, '#16a34a');
        } else if (hpPct > 0.25) {
            barGradient.addColorStop(0, '#eab308');
            barGradient.addColorStop(1, '#ca8a04');
        } else {
            barGradient.addColorStop(0, '#ef4444');
            barGradient.addColorStop(1, '#dc2626');
        }
    }

    ctx.fillStyle = barGradient;
    ctx.beginPath();
    ctx.roundRect(cx - barWidth / 2, barY, barWidth * hpPct, barHeight, 2);
    ctx.fill();
}
