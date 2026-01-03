// ===== SPECIAL ABILITIES =====
// Unit class-specific special abilities

import { state, getPlayerUnits } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { UNIT_CLASSES, CONFIG } from '../config.js';
import { updateUI, showToast } from '../ui.js';
import { render } from '../renderer.js';
import { updateVisibility } from '../fogOfWar.js';
import { addXP } from '../progression.js';

/**
 * Get AP cost for special ability
 */
export function getSpecialAbilityCost(unit) {
    const classInfo = UNIT_CLASSES[unit.class];
    return classInfo?.specialCost || 2;
}

/**
 * Check if unit can use special ability
 */
export function canUseSpecialAbility(unit) {
    if (!unit || !unit.alive) return false;
    if (unit.usedSpecial) return false;

    const cost = getSpecialAbilityCost(unit);
    if (state.sharedAP < cost) return false;

    // Class-specific checks
    switch (unit.class) {
        case 'medic':
            // Check if there are wounded allies nearby
            return hasWoundedAlliesInRange(unit);
        case 'sniper':
            return !unit.cloaked; // Can't cloak if already cloaked
        case 'commando':
            return !unit.cloaked;
        default:
            return true;
    }
}

/**
 * Check if medic has wounded allies in range
 */
function hasWoundedAlliesInRange(medic) {
    const healRange = 4;
    const allies = getPlayerUnits(medic.player);

    for (const ally of allies) {
        if (!ally.alive) continue;
        if (ally.currentHp >= ally.maxHp) continue;

        const dist = hexDistance(
            { q: medic.q, r: medic.r },
            { q: ally.q, r: ally.r }
        );

        if (dist <= healRange) return true;
    }

    return false;
}

/**
 * Use special ability (main dispatcher)
 */
export async function useSpecialAbility(unit, context = {}) {
    if (!canUseSpecialAbility(unit)) {
        showToast('Fähigkeit nicht verfügbar', 'error');
        return null;
    }

    const cost = getSpecialAbilityCost(unit);

    switch (unit.class) {
        case 'scout':
            return useScoutSpecial(unit, cost);
        case 'assault':
            return useAssaultSpecial(unit, cost);
        case 'medic':
            return useMedicSpecial(unit, cost, context);
        case 'sniper':
            return useSniperSpecial(unit, cost);
        case 'commando':
            return useCommandoSpecial(unit, cost);
        case 'elitesoldat':
            return useEliteSpecial(unit, cost);
        default:
            return null;
    }
}

/**
 * Scout: Sprint (+3 movement this turn)
 */
function useScoutSpecial(unit, cost) {
    unit.usedSpecial = true;
    unit.sprintActive = true;
    unit.move += 3;

    state.sharedAP -= cost;
    updateUI();
    render();

    showToast(`${unit.name || 'Späher'} aktiviert Sprint! +3 Bewegung`, 'success');
    return { success: true, type: 'sprint' };
}

/**
 * Assault: Powershot (+20 damage next attack)
 */
function useAssaultSpecial(unit, cost) {
    unit.usedSpecial = true;
    unit.powershotActive = true;
    unit.damage += 20;

    state.sharedAP -= cost;
    updateUI();
    render();

    showToast(`${unit.name || 'Sturmsoldatin'} lädt Powershot! +20 Schaden`, 'success');
    return { success: true, type: 'powershot' };
}

/**
 * Medic: Heal nearby allies
 */
async function useMedicSpecial(unit, cost, context = {}) {
    const healRange = 4;
    const healAmount = 30;
    const allies = getPlayerUnits(unit.player);
    let healedCount = 0;
    let totalHealed = 0;

    for (const ally of allies) {
        if (!ally.alive) continue;
        if (ally.currentHp >= ally.maxHp) continue;

        const dist = hexDistance(
            { q: unit.q, r: unit.r },
            { q: ally.q, r: ally.r }
        );

        if (dist <= healRange) {
            const actualHeal = Math.min(healAmount, ally.maxHp - ally.currentHp);
            ally.currentHp += actualHeal;
            totalHealed += actualHeal;
            healedCount++;
        }
    }

    if (healedCount > 0) {
        unit.usedSpecial = true;
        state.sharedAP -= cost;

        // XP for healing
        addXP(unit, Math.floor(totalHealed / 2));

        updateUI();
        render();

        showToast(`${unit.name || 'Sanitäter'} heilt ${healedCount} Verbündete! (+${totalHealed} HP)`, 'success');
        return { success: true, type: 'heal', healedCount, totalHealed };
    }

    showToast('Keine verwundeten Verbündeten in Reichweite', 'warning');
    return null;
}

/**
 * Sniper: Cloak (become invisible)
 */
function useSniperSpecial(unit, cost) {
    unit.usedSpecial = true;
    unit.cloaked = true;
    unit.cloakTurns = 3;

    state.sharedAP -= cost;
    updateVisibility();
    updateUI();
    render();

    showToast(`${unit.name || 'Scharfschützin'} aktiviert Tarnung!`, 'success');
    return { success: true, type: 'cloak' };
}

/**
 * Commando: Stealth + bonus move
 */
function useCommandoSpecial(unit, cost) {
    unit.usedSpecial = true;
    unit.cloaked = true;
    unit.cloakTurns = 2;
    unit.move += 2;

    state.sharedAP -= cost;
    updateVisibility();
    updateUI();
    render();

    showToast(`${unit.name || 'Kommando'} aktiviert Stealth! +2 Bewegung`, 'success');
    return { success: true, type: 'stealth' };
}

/**
 * Elite: Tactical Mode (+damage, +range, reduced movement)
 */
function useEliteSpecial(unit, cost) {
    unit.usedSpecial = true;
    unit.tacticalMode = true;
    unit.damage += 15;
    unit.range += 1;
    unit.move = Math.max(1, unit.move - 2);

    state.sharedAP -= cost;
    updateUI();
    render();

    showToast(`${unit.name || 'Elitesoldat'} aktiviert taktischen Modus!`, 'success');
    return { success: true, type: 'tactical' };
}

/**
 * Reset special ability states at start of turn
 */
export function resetSpecialAbilities(playerIndex) {
    for (const unit of state.units) {
        if (unit.player !== playerIndex) continue;
        if (!unit.alive) continue;

        // Reset single-turn abilities
        if (unit.sprintActive) {
            unit.sprintActive = false;
            const baseMove = UNIT_CLASSES[unit.class]?.move || 3;
            unit.move = baseMove;
        }

        if (unit.powershotActive) {
            unit.powershotActive = false;
            const baseDamage = UNIT_CLASSES[unit.class]?.damage || 20;
            unit.damage = baseDamage;
        }

        // Decrement cloak turns
        if (unit.cloaked && unit.cloakTurns !== undefined) {
            unit.cloakTurns--;
            if (unit.cloakTurns <= 0) {
                unit.cloaked = false;
                unit.cloakTurns = 0;
            }
        }

        // Reset tactical mode
        if (unit.tacticalMode) {
            unit.tacticalMode = false;
            const classInfo = UNIT_CLASSES[unit.class];
            unit.damage = classInfo?.damage || 20;
            unit.range = classInfo?.range || 3;
            unit.move = classInfo?.move || 3;
        }
    }
}

/**
 * Break cloak when attacking
 */
export function breakCloak(unit) {
    if (unit.cloaked) {
        unit.cloaked = false;
        unit.cloakTurns = 0;
        updateVisibility();
    }
}
