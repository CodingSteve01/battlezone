// ===== AI OPPONENT =====

import { state, getHex, getPlayerUnits } from './state.js';
import { hexDistance, hexToPixel } from './hexMath.js';
import { getReachableHexes } from './pathfinding.js';
import { getAttackableUnits, moveUnitInstant } from './units.js';
import { executeAttack, useSpecialAbility } from './combat.js';
import { updateVisibility } from './fogOfWar.js';
import { updateUI, showToast } from './ui.js';
import { render } from './renderer.js';
import { endTurn } from './turns.js';
import { TERRAIN } from './config.js';

/**
 * Check if current player is AI controlled
 */
export function isAIPlayer(playerIndex = state.currentPlayer) {
    return state.settings.singlePlayer && playerIndex > 0;
}

/**
 * Execute AI turn
 */
export function executeAITurn() {
    if (!isAIPlayer()) return;

    showAIThinking();

    // Small delay to show thinking indicator
    setTimeout(() => {
        performAIActions();
    }, 800);
}

/**
 * Show AI thinking overlay
 */
function showAIThinking() {
    const existing = document.querySelector('.ai-thinking');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ai-thinking';
    overlay.innerHTML = `
        <div class="ai-icon">🤖</div>
        <div class="ai-text">KI denkt nach...</div>
    `;
    document.body.appendChild(overlay);
}

/**
 * Hide AI thinking overlay
 */
function hideAIThinking() {
    const overlay = document.querySelector('.ai-thinking');
    if (overlay) overlay.remove();
}

/**
 * Perform all AI actions for current turn
 */
async function performAIActions() {
    const units = getPlayerUnits(state.currentPlayer);

    for (const unit of units) {
        if (!unit.alive) continue;

        // Give each unit some time between actions
        await performUnitAI(unit);
        await delay(400);
    }

    hideAIThinking();

    // End turn after all actions
    setTimeout(() => {
        endTurn();
    }, 500);
}

/**
 * Perform AI for a single unit
 * In single-player mode, we don't render during AI actions to avoid revealing AI positions
 */
async function performUnitAI(unit) {
    // Find visible enemies
    const enemies = findVisibleEnemies(unit);

    // In single-player, don't render during AI turn to hide AI positions
    const shouldRender = !state.settings.singlePlayer;

    // Priority 1: Attack if enemy in range
    const attackable = getAttackableUnits(unit);
    if (attackable.length > 0 && unit.ap >= 1) {
        const target = selectBestTarget(unit, attackable);
        if (target) {
            state.targetedUnit = target;
            if (shouldRender) render();
            await delay(shouldRender ? 300 : 100);
            executeAttack(unit, target);
            state.targetedUnit = null;
            if (shouldRender) {
                updateUI();
                render();
            }
            await delay(shouldRender ? 400 : 100);
        }
    }

    // Priority 2: Use special ability if beneficial
    if (unit.ap >= 2 && !unit.usedSpecial) {
        if (shouldUseSpecial(unit, enemies)) {
            useSpecialAbility(unit);
            if (shouldRender) {
                updateUI();
                render();
            }
            await delay(shouldRender ? 400 : 100);
        }
    }

    // Priority 3: Move towards enemy or explore
    if (unit.ap >= 1) {
        const moveTarget = selectMoveTarget(unit, enemies);
        if (moveTarget) {
            await executeAIMove(unit, moveTarget, shouldRender);
        }
    }

    // Priority 4: Attack again after moving
    const attackableAfterMove = getAttackableUnits(unit);
    if (attackableAfterMove.length > 0 && unit.ap >= 1) {
        const target = selectBestTarget(unit, attackableAfterMove);
        if (target) {
            state.targetedUnit = target;
            if (shouldRender) render();
            await delay(shouldRender ? 300 : 100);
            executeAttack(unit, target);
            state.targetedUnit = null;
            if (shouldRender) {
                updateUI();
                render();
            }
        }
    }
}

/**
 * Find enemies visible to the AI
 */
function findVisibleEnemies(unit) {
    return state.units.filter(u =>
        u.alive &&
        u.player !== unit.player &&
        state.visibleHexes.has(`${u.q},${u.r}`)
    );
}

/**
 * Select best target to attack
 */
function selectBestTarget(attacker, targets) {
    if (targets.length === 0) return null;

    // Prioritize: low HP > medics > closest
    return targets.sort((a, b) => {
        // Kill targets first (can be killed in one hit)
        const aCanKill = a.currentHp <= attacker.damage;
        const bCanKill = b.currentHp <= attacker.damage;
        if (aCanKill && !bCanKill) return -1;
        if (bCanKill && !aCanKill) return 1;

        // Then medics (high value targets)
        if (a.class === 'medic' && b.class !== 'medic') return -1;
        if (b.class === 'medic' && a.class !== 'medic') return 1;

        // Then snipers (dangerous)
        if (a.class === 'sniper' && b.class !== 'sniper') return -1;
        if (b.class === 'sniper' && a.class !== 'sniper') return 1;

        // Then ninjas (dangerous in melee)
        if (a.class === 'ninja' && b.class !== 'ninja') return -1;
        if (b.class === 'ninja' && a.class !== 'ninja') return 1;

        // Then by HP (low HP first)
        return a.currentHp - b.currentHp;
    })[0];
}

/**
 * Decide if special ability should be used
 */
function shouldUseSpecial(unit, enemies) {
    switch (unit.class) {
        case 'medic':
            // Heal if allies are damaged
            const allies = getPlayerUnits(unit.player);
            const needsHealing = allies.some(a =>
                a.currentHp < a.maxHp * 0.7 &&
                hexDistance({ q: unit.q, r: unit.r }, { q: a.q, r: a.r }) <= 3
            );
            return needsHealing;

        case 'scout':
            // Sprint if enemies are visible but far
            return enemies.length > 0 && enemies.every(e =>
                hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) > unit.range
            );

        case 'assault':
            // Powershot if enemy is close
            return enemies.some(e =>
                hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= unit.range
            );

        case 'sniper':
            // Cloak if not cloaked and enemies nearby
            return !unit.cloaked && enemies.length > 0;

        case 'ninja':
            // Stealth if not cloaked and enemies are close
            if (unit.cloaked) return false;
            return enemies.some(e =>
                hexDistance({ q: unit.q, r: unit.r }, { q: e.q, r: e.r }) <= 4
            );

        default:
            return false;
    }
}

/**
 * Select best hex to move to
 */
function selectMoveTarget(unit, enemies) {
    const reachable = getReachableHexes(unit);
    if (reachable.size === 0) return null;

    const maxCost = Math.min(unit.ap, unit.move);
    const candidates = [];

    reachable.forEach((data, key) => {
        if (data.cost > maxCost) return;

        const [q, r] = key.split(',').map(Number);
        const hex = getHex(q, r);
        if (!hex || hex.unit) return;

        let score = 0;

        // Prefer moving towards enemies
        if (enemies.length > 0) {
            const closestEnemy = enemies.reduce((closest, e) => {
                const dist = hexDistance({ q, r }, { q: e.q, r: e.r });
                return dist < closest.dist ? { enemy: e, dist } : closest;
            }, { enemy: null, dist: Infinity });

            // Get closer to attack range
            const idealDist = unit.range;
            const distToIdeal = Math.abs(closestEnemy.dist - idealDist);
            score -= distToIdeal * 10;

            // Bonus for being in attack range
            if (closestEnemy.dist <= unit.range) {
                score += 50;
            }
        } else {
            // Explore: prefer moving towards unexplored areas
            score += Math.random() * 20;
        }

        // Prefer cover (forest)
        if (hex.cover) {
            score += 15;
        }

        // Avoid expensive terrain
        score -= TERRAIN[hex.type].moveCost * 5;

        candidates.push({ q, r, score, cost: data.cost });
    });

    if (candidates.length === 0) return null;

    // Sort by score and return best
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
}

/**
 * Execute AI movement
 * @param {boolean} shouldRender - Whether to render (false in single-player to hide AI)
 */
async function executeAIMove(unit, target, shouldRender = true) {
    const targetHex = getHex(target.q, target.r);
    if (!targetHex) return;

    // Clear old position
    const oldHex = getHex(unit.q, unit.r);
    if (oldHex) oldHex.unit = null;

    // Move unit
    unit.q = target.q;
    unit.r = target.r;
    targetHex.unit = unit;
    unit.ap -= target.cost;

    // In single-player, don't update visibility/render to hide AI positions
    if (shouldRender) {
        updateVisibility();
        render();
        updateUI();
    }
}

/**
 * Utility: delay helper
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
