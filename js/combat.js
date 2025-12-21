// ===== COMBAT SYSTEM =====

import { state, getHex, getPlayerUnits } from './state.js';
import { UNIT_CLASSES } from './config.js';
import { hexDistance, hexToPixel } from './hexMath.js';
import { killUnit } from './units.js';
import { showToast, showFloatingDamage } from './ui.js';
import { calculateCritical, getEffectiveDamage, trackDamage, awardKillXP, XP_REWARDS, awardXP } from './progression.js';
import { checkEventMiss } from './events.js';

/**
 * Calculate hit chance for an attack
 */
export function calculateHitChance(attacker, defender) {
    let chance = 70; // Base hit chance

    // Defender in cover (forest)
    const defHex = getHex(defender.q, defender.r);
    if (defHex && defHex.cover) {
        chance -= 25;
    }

    // Scout accuracy bonus
    if (attacker.class === 'scout') {
        chance += 15;
    }

    // Distance calculation
    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );

    // Sniper: accuracy bonus, especially at range
    if (attacker.class === 'sniper') {
        chance += 20; // Base accuracy bonus
        // Sniper gets BETTER at range, not worse
        if (dist >= 4) {
            chance += 10; // Optimal range bonus
        }
    } else {
        // Normal units: distance penalty
        chance -= (dist - 1) * 5;
    }

    // Clamp to reasonable bounds
    return Math.min(95, Math.max(25, chance));
}

/**
 * Execute an attack
 */
export function executeAttack(attacker, defender) {
    // Remove cloak when attacking
    if (attacker.cloaked) {
        attacker.cloaked = false;
        showToast('🔫 Tarnung aufgehoben!', 'special');
    }

    const hitChance = calculateHitChance(attacker, defender);
    const roll = Math.random() * 100;
    let hit = roll < hitChance;

    // Check for event-based miss (storm)
    if (hit && checkEventMiss()) {
        hit = false;
        showToast('⛈️ Sturm! Schuss verfehlt!', 'miss');
        attacker.ap -= 1;
        return { hit: false, damage: 0, killed: false, eventMiss: true };
    }

    // Consume AP
    attacker.ap -= 1;

    if (hit) {
        // Check for shield (from power-up)
        if (defender.shield) {
            defender.shield = false;
            showToast('🛡️ Schild blockiert Angriff!', 'special');
            return { hit: true, damage: 0, killed: false, blocked: true };
        }

        // Calculate base damage with all bonuses
        let damage = getEffectiveDamage(attacker);

        // Assault has damage variance
        if (attacker.class === 'assault') {
            damage += Math.floor(Math.random() * 15);
        }

        // Calculate critical hit
        const crit = calculateCritical(attacker, defender);
        if (crit.isCrit) {
            damage = Math.floor(damage * crit.multiplier);
        }

        // Apply damage
        defender.currentHp -= damage;

        // Track damage for XP and assists
        trackDamage(attacker, defender, damage);

        // Calculate screen position for floating damage
        const defenderPos = hexToPixel(defender.q, defender.r, state.hexSize);
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const screenX = rect.left + state.offsetX + defenderPos.x;
            const screenY = rect.top + state.offsetY + defenderPos.y - 20;
            showFloatingDamage(screenX, screenY, damage, crit.isCrit);
        }

        // Show appropriate message
        if (crit.isCrit) {
            showToast(`⚡ KRITISCH! ${damage} Schaden!`, 'crit');
        } else {
            showToast(`💥 Treffer! ${damage} Schaden`, 'hit');
        }

        // Check for kill
        if (defender.currentHp <= 0) {
            killUnit(defender);

            // Award XP for kill and assists
            const levelUps = awardKillXP(attacker, defender);

            setTimeout(() => {
                showToast(`☠️ ${UNIT_CLASSES[defender.class].name} eliminiert!`, 'hit');
            }, 800);

            // Show level up notifications
            levelUps.forEach((levelUp, i) => {
                setTimeout(() => {
                    showToast(`⭐ ${UNIT_CLASSES[levelUp.unit.class].name} → ${levelUp.rank}!`, 'levelup');
                }, 1600 + i * 800);
            });

            return { hit: true, damage, killed: true, crit: crit.isCrit, levelUps };
        }

        return { hit: true, damage, killed: false, crit: crit.isCrit };
    } else {
        showToast('💨 Verfehlt!', 'miss');
        return { hit: false, damage: 0, killed: false };
    }
}

/**
 * Use special ability
 */
export function useSpecialAbility(unit) {
    if (unit.ap < 2 || unit.usedSpecial) return false;

    unit.ap -= 2;
    unit.usedSpecial = true;

    switch (unit.class) {
        case 'medic':
            return useMedicSpecial(unit);
        case 'scout':
            return useScoutSpecial(unit);
        case 'assault':
            return useAssaultSpecial(unit);
        case 'sniper':
            return useSniperSpecial(unit);
        default:
            return false;
    }
}

/**
 * Medic healing ability
 */
function useMedicSpecial(unit) {
    const allies = getPlayerUnits(unit.player);
    let totalHealed = 0;

    allies.forEach(ally => {
        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: ally.q, r: ally.r }
        );

        if (dist <= 3) {
            const healAmount = Math.min(30, ally.maxHp - ally.currentHp);
            if (healAmount > 0) {
                ally.currentHp += healAmount;
                totalHealed += healAmount;

                // Show floating heal number
                const allyPos = hexToPixel(ally.q, ally.r, state.hexSize);
                const canvas = document.getElementById('game-canvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const screenX = rect.left + state.offsetX + allyPos.x;
                    const screenY = rect.top + state.offsetY + allyPos.y - 20;
                    showFloatingDamage(screenX, screenY, healAmount, false, true);
                }
            }
        }
    });

    // Award XP for healing
    if (totalHealed > 0) {
        awardXP(unit, XP_REWARDS.HEAL, 'heal');
    }

    showToast(`💚 ${totalHealed} HP geheilt!`, 'special');
    return true;
}

/**
 * Scout sprint ability
 */
function useScoutSpecial(unit) {
    unit.move += 3;
    showToast('🎯 Sprint aktiviert!', 'special');
    return true;
}

/**
 * Assault powershot ability
 */
function useAssaultSpecial(unit) {
    unit.damage += 20;
    showToast('💥 Powershot bereit!', 'special');
    return true;
}

/**
 * Sniper cloak ability
 */
function useSniperSpecial(unit) {
    unit.cloaked = true;
    showToast('🔫 Getarnt! Unsichtbar bis zum Angriff', 'special');
    return true;
}

/**
 * Check if the game is over
 */
export function checkGameOver() {
    const alivePlayers = [];

    for (let p = 0; p < state.settings.players; p++) {
        if (getPlayerUnits(p).length > 0) {
            alivePlayers.push(p);
        }
    }

    if (alivePlayers.length <= 1) {
        return {
            gameOver: true,
            winner: alivePlayers[0] ?? null
        };
    }

    return { gameOver: false, winner: null };
}
