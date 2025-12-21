// ===== COMBAT SYSTEM =====

import { state, getHex, getPlayerUnits } from './state.js';
import { UNIT_CLASSES } from './config.js';
import { hexDistance } from './hexMath.js';
import { killUnit } from './units.js';
import { showToast } from './ui.js';

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

    // Distance penalty
    const dist = hexDistance(
        { q: attacker.q, r: attacker.r },
        { q: defender.q, r: defender.r }
    );
    chance -= (dist - 1) * 5;

    // Clamp to reasonable bounds
    return Math.min(95, Math.max(25, chance));
}

/**
 * Execute an attack
 */
export function executeAttack(attacker, defender) {
    const hitChance = calculateHitChance(attacker, defender);
    const roll = Math.random() * 100;
    const hit = roll < hitChance;

    // Consume AP
    attacker.ap -= 1;

    if (hit) {
        // Calculate damage
        let damage = attacker.damage;

        // Assault has damage variance
        if (attacker.class === 'assault') {
            damage += Math.floor(Math.random() * 15);
        }

        // Apply damage
        defender.currentHp -= damage;

        showToast(`💥 Treffer! ${damage} Schaden`, 'hit');

        // Check for kill
        if (defender.currentHp <= 0) {
            killUnit(defender);
            setTimeout(() => {
                showToast(`☠️ ${UNIT_CLASSES[defender.class].name} eliminiert!`, 'hit');
            }, 800);

            return { hit: true, damage, killed: true };
        }

        return { hit: true, damage, killed: false };
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
            ally.currentHp += healAmount;
            totalHealed += healAmount;
        }
    });

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
