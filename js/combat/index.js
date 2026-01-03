// ===== COMBAT MODULE INDEX =====
// Re-exports all combat functionality from submodules

// Calculations
export {
    hasLineOfSight,
    calculateLineOfSightCover,
    calculateCoverEffectiveness,
    calculateHitChance,
    getCoverInfo,
    calculateCoverDamageReduction
} from './calculations.js';

// Special Abilities
export {
    getSpecialAbilityCost,
    canUseSpecialAbility,
    useSpecialAbility,
    useMedicHealingWithMinigame
} from './abilities.js';

// Tactical Systems
export {
    // Ambush
    canPrepareAmbush,
    prepareAmbush,
    checkAmbushTriggers,
    executeAmbushAttack,
    resetAmbushStatus,
    // Overwatch
    canUseOverwatch,
    activateOverwatch,
    checkOverwatchTriggers,
    executeOverwatchAttack,
    // Suppression
    canUseSuppression,
    useSuppression,
    getSuppressionPenalty,
    getSuppressionMoveCost,
    // Coordinated
    getEligibleCoordinators,
    executeCoordinatedAttack,
    // Hold Position
    calculateHoldPositionDefense,
    onUnitMoved,
    updateAllHoldPositions,
    // Setup
    setExecuteAttack
} from './tactical.js';
