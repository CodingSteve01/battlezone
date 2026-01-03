// ===== SPECIAL ABILITIES =====
// Unit special abilities for all classes

import {
    state, getHex, getPlayerUnits, spendSharedAP, canUnitAttack,
    recordSpecialUsed, getAlliedPlayers, getTileScreenPosition
} from '../state.js';
import { UNIT_CLASSES } from '../config.js';
import { hexDistance } from '../hexMath.js';
import { showToast, showFloatingDamage } from '../ui.js';
import { awardXP, XP_REWARDS } from '../progression.js';
import { playHeal, playSprint, playPowershot, playCloak } from '../audio.js';
import { particles } from '../particles.js';
import { recordHealing } from '../state.js';
import { areMinigamesEnabled, startHealingMinigame } from '../minigames.js';

/**
 * Get AP cost for special ability
 */
export function getSpecialAbilityCost(unitClass) {
    switch (unitClass) {
        case 'scout': return 1;
        case 'assault': return 1;
        case 'medic': return 2;
        case 'sniper': return 2;
        case 'commando': return 2;
        case 'elitesoldat': return 1;
        default: return 2;
    }
}

/**
 * Check if unit can use special ability
 */
export function canUseSpecialAbility(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.usedSpecial) return false;

    const cost = getSpecialAbilityCost(unit.class);
    if (state.sharedAP < cost) return false;

    switch (unit.class) {
        case 'assault':
            if (!canUnitAttack(unit)) return false;
            break;
        case 'sniper':
            if (unit.cloaked) return false;
            break;
        case 'commando':
            if (unit.cloaked) return false;
            break;
    }

    return true;
}

/**
 * Internal medic healing implementation
 */
function useMedicSpecialInternal(unit, healMultiplier = 1.0) {
    const alliedPlayers = getAlliedPlayers(unit.player);
    const allies = [];
    for (const player of alliedPlayers) {
        allies.push(...getPlayerUnits(player));
    }

    let totalHealed = 0;
    playHeal();

    const medicHex = getHex(unit.q, unit.r);
    const medicPos = getTileScreenPosition(unit.q, unit.r, medicHex?.height ?? 0);
    particles.healEffect(medicPos.x, medicPos.y - 10);

    const baseHealAmount = UNIT_CLASSES.medic.healAmount || 40;
    const healAmount = Math.round(baseHealAmount * healMultiplier);
    const healRange = UNIT_CLASSES.medic.healRange || 4;

    allies.forEach(ally => {
        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: ally.q, r: ally.r }
        );

        if (dist <= healRange) {
            const actualHeal = Math.min(healAmount, ally.maxHp - ally.currentHp);
            if (actualHeal > 0) {
                ally.currentHp += actualHeal;
                totalHealed += actualHeal;

                const allyHex = getHex(ally.q, ally.r);
                const allyPos = getTileScreenPosition(ally.q, ally.r, allyHex?.height ?? 0);
                particles.burst('heal', allyPos.x, allyPos.y - 10, 8);

                const canvas = document.getElementById('game-canvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const screenX = rect.left + state.offsetX + allyPos.x;
                    const screenY = rect.top + state.offsetY + allyPos.y - 20;
                    showFloatingDamage(screenX, screenY, actualHeal, false, true);
                }
            }
        }
    });

    if (totalHealed > 0) {
        awardXP(unit, XP_REWARDS.HEAL, 'heal');
        recordHealing(unit.player, totalHealed);
    }

    if (healMultiplier >= 1.5) {
        showToast(`💚 PERFEKT! ${totalHealed} HP geheilt!`, 'special');
    } else if (healMultiplier >= 1.0) {
        showToast(`💚 ${totalHealed} HP geheilt!`, 'special');
    } else {
        showToast(`💚 ${totalHealed} HP geheilt (${Math.round(healMultiplier * 100)}%)`, 'info');
    }

    return totalHealed;
}

/**
 * Medic healing - synchronous version
 */
function useMedicSpecial(unit) {
    useMedicSpecialInternal(unit, 1.0);
    return true;
}

/**
 * Medic healing with minigame - async version
 */
export async function useMedicHealingWithMinigame(unit) {
    if (!areMinigamesEnabled()) {
        return useMedicSpecialInternal(unit, 1.0);
    }

    const allies = getPlayerUnits(unit.player);
    const woundedAllies = allies.filter(a => a.currentHp < a.maxHp * 0.6);
    const enemiesNearby = state.units.filter(u =>
        u.alive &&
        u.player !== unit.player &&
        hexDistance({ q: unit.q, r: unit.r }, { q: u.q, r: u.r }) <= 3
    );

    const context = {
        attackerHP: unit.currentHp / unit.maxHp,
        alliesInRange: woundedAllies.length,
        enemiesInRange: enemiesNearby.length
    };

    const result = await startHealingMinigame(context);

    if (result.cancelled) {
        return { cancelled: true };
    }

    const healMultiplier = result.multiplier?.healMultiplier ?? result.healMultiplier ?? 1.0;
    return useMedicSpecialInternal(unit, healMultiplier);
}

/**
 * Scout sprint ability
 */
function useScoutSpecial(unit) {
    unit.move += 3;
    playSprint();

    const unitHex = getHex(unit.q, unit.r);
    const unitPos = getTileScreenPosition(unit.q, unit.r, unitHex?.height ?? 0);
    particles.sprintEffect(unitPos.x, unitPos.y);

    showToast('🎯 Sprint aktiviert!', 'special');
    return true;
}

/**
 * Assault powershot ability
 */
function useAssaultSpecial(unit) {
    unit.damage += 25;
    playPowershot();

    const unitHex = getHex(unit.q, unit.r);
    const unitPos = getTileScreenPosition(unit.q, unit.r, unitHex?.height ?? 0);
    particles.powershotEffect(unitPos.x, unitPos.y - 10, 0);

    showToast('💥 Powershot bereit! (+25 Schaden)', 'special');
    return true;
}

/**
 * Sniper cloak ability
 */
function useSniperSpecial(unit) {
    unit.cloaked = true;
    playCloak();

    const unitHex = getHex(unit.q, unit.r);
    const unitPos = getTileScreenPosition(unit.q, unit.r, unitHex?.height ?? 0);
    particles.cloakEffect(unitPos.x, unitPos.y - 10);

    showToast('🔫 Getarnt!', 'special');
    return true;
}

/**
 * Commando stealth + movement ability
 */
function useCommandoSpecial(unit) {
    unit.cloaked = true;
    unit.move += 2;
    playCloak();

    const unitHex = getHex(unit.q, unit.r);
    const unitPos = getTileScreenPosition(unit.q, unit.r, unitHex?.height ?? 0);
    particles.cloakEffect(unitPos.x, unitPos.y - 10);
    particles.sprintEffect(unitPos.x, unitPos.y);

    showToast('🥷 Schleichen aktiviert!', 'special');
    return true;
}

/**
 * Elite soldier tactical mode ability
 */
function useEliteSpecial(unit) {
    unit.damage += 15;
    unit.move += 2;
    unit.tacticalMode = true;

    const unitHex = getHex(unit.q, unit.r);
    const unitPos = getTileScreenPosition(unit.q, unit.r, unitHex?.height ?? 0);
    particles.powershotEffect(unitPos.x, unitPos.y - 10, 0);
    particles.sprintEffect(unitPos.x, unitPos.y);

    playPowershot();
    showToast('🎖️ Taktischer Modus! +15 DMG, +2 Bewegung', 'special');
    return true;
}

/**
 * Use special ability
 */
export function useSpecialAbility(unit) {
    if (!canUseSpecialAbility(unit)) return false;

    const cost = getSpecialAbilityCost(unit.class);
    spendSharedAP(cost);
    unit.usedSpecial = true;

    recordSpecialUsed(unit.player);

    switch (unit.class) {
        case 'medic': return useMedicSpecial(unit);
        case 'scout': return useScoutSpecial(unit);
        case 'assault': return useAssaultSpecial(unit);
        case 'sniper': return useSniperSpecial(unit);
        case 'commando': return useCommandoSpecial(unit);
        case 'elitesoldat': return useEliteSpecial(unit);
        default: return false;
    }
}
