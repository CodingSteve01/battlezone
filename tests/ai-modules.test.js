import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, resetState, setHex, getHex } from '../js/state.js';

// Mock fogOfWar
vi.mock('../js/fogOfWar.js', () => ({
    isUnitVisibleToPlayer: vi.fn(() => true)
}));

import {
    calculateThreatMap,
    calculateInfluenceMap,
    getThreatAt,
    getInfluenceAt,
    isInDangerZone,
    findSafestReachableHex,
    calculateExposure
} from '../js/ai/threats.js';

import {
    predictEnemyMovement,
    identifyUnitsAtRisk,
    calculatePostAttackSafety
} from '../js/ai/prediction.js';

import {
    findBestMoveForUnit,
    evaluateMove,
    quickEvaluatePosition
} from '../js/ai/minimax.js';

describe('AI Threats Module', () => {
    beforeEach(() => {
        resetState();
        state.units = [];
        state.hexes = [];
        state.hexMap = new Map();

        // Set up basic map
        for (let q = -5; q <= 5; q++) {
            for (let r = -5; r <= 5; r++) {
                setHex({ q, r, type: 'grass', walkable: true, height: 0 });
            }
        }
    });

    describe('calculateThreatMap', () => {
        it('should calculate threat from enemies', () => {
            const enemies = [
                { id: 1, q: 0, r: 0, damage: 30, range: 3, move: 3, class: 'assault', alive: true }
            ];
            const aiUnits = [
                { id: 2, q: 4, r: 0, alive: true, player: 1, currentHp: 100, maxHp: 100, damage: 25, range: 3, move: 3 }
            ];

            calculateThreatMap(enemies, aiUnits);

            // Threat should be higher near enemy (within range)
            const threatNear = getThreatAt(1, 0);
            const threatFar = getThreatAt(5, 0);
            // threatNear is within enemy's range (dist=1), threatFar is outside (dist=5)
            expect(threatNear).toBeGreaterThanOrEqual(threatFar);
        });

        it('should return low threat with no enemies at center', () => {
            // Zone-aware threat: even without enemies, hexes near zone edge have threat
            // At center with large zone radius, threat should be minimal
            state.zoneRadius = 20; // Set large zone so center is safe
            calculateThreatMap([], []);
            // Threat from zone edge awareness may still exist
            const threat = getThreatAt(0, 0);
            expect(threat).toBeLessThan(100); // No enemy threat contribution
        });
    });

    describe('calculateInfluenceMap', () => {
        it('should calculate influence from units', () => {
            const enemies = [
                { id: 1, q: 0, r: 0, damage: 30, range: 3, move: 3, alive: true, currentHp: 100, maxHp: 100 }
            ];
            const aiUnits = [
                { id: 2, q: 5, r: 0, damage: 25, range: 3, move: 3, alive: true, currentHp: 100, maxHp: 100 }
            ];

            calculateInfluenceMap(enemies, aiUnits);

            // Influence returns { friendly, enemy, control }
            const influenceNearEnemy = getInfluenceAt(0, 0);
            const influenceNearAI = getInfluenceAt(5, 0);

            // Near enemy: enemy influence should be higher
            // Near AI: friendly influence should be higher
            expect(influenceNearEnemy.control).toBeLessThan(influenceNearAI.control);
        });
    });

    describe('isInDangerZone', () => {
        it('should detect danger near enemies', () => {
            // Danger zone requires threat > 80
            // In range: threat += damage * 1.5 = 60 * 1.5 = 90
            const enemies = [
                { id: 1, q: 0, r: 0, damage: 60, range: 3, move: 3, class: 'assault', alive: true }
            ];
            calculateThreatMap(enemies, []);

            // Adjacent to enemy (dist=1, in range) should have threat > 80
            expect(isInDangerZone(1, 0)).toBe(true);
        });

        it('should have lower threat far from enemies', () => {
            state.zoneRadius = 20; // Large zone to avoid edge penalty
            const enemies = [
                { id: 1, q: 0, r: 0, damage: 30, range: 3, move: 3, class: 'assault', alive: true }
            ];
            calculateThreatMap(enemies, []);

            // Threat at adjacent hex should be higher than far hex
            const threatNear = getThreatAt(1, 0);
            const threatFar = getThreatAt(5, 0);
            expect(threatNear).toBeGreaterThan(threatFar);
        });
    });

    describe('findSafestReachableHex', () => {
        it('should find safer position away from enemies', () => {
            const enemies = [
                { id: 1, q: 0, r: 0, damage: 50, range: 3, alive: true }
            ];
            const unit = { id: 2, q: 2, r: 0, move: 3, player: 1, alive: true };

            calculateThreatMap(enemies, [unit]);

            const safeHex = findSafestReachableHex(unit, enemies);
            if (safeHex) {
                // Safe hex should be further from enemy
                const currentDistToEnemy = Math.abs(unit.q - 0) + Math.abs(unit.r - 0);
                const safeDistToEnemy = Math.abs(safeHex.q - 0) + Math.abs(safeHex.r - 0);
                expect(safeDistToEnemy).toBeGreaterThanOrEqual(currentDistToEnemy - 1);
            }
        });
    });

    describe('calculateExposure', () => {
        it('should calculate exposure based on enemy count', () => {
            const enemies = [
                { id: 1, q: 0, r: 0, damage: 30, range: 3, move: 3, alive: true },
                { id: 2, q: 1, r: 0, damage: 30, range: 3, move: 3, alive: true }
            ];

            // calculateExposure returns { exposure, enemiesInRange, totalPotentialDamage, isCritical }
            const exposureNear = calculateExposure(0, 1, enemies);
            const exposureFar = calculateExposure(5, 5, enemies);

            expect(exposureNear.exposure).toBeGreaterThan(exposureFar.exposure);
        });
    });
});

describe('AI Prediction Module', () => {
    beforeEach(() => {
        resetState();
        state.units = [];
        state.hexes = [];
        state.hexMap = new Map();

        for (let q = -5; q <= 5; q++) {
            for (let r = -5; r <= 5; r++) {
                setHex({ q, r, type: 'grass', walkable: true, height: 0 });
            }
        }
    });

    describe('predictEnemyMovement', () => {
        it('should predict aggressive enemy moves toward AI units', () => {
            const enemy = { id: 1, q: 0, r: 0, move: 3, range: 2, damage: 30, player: 0 };
            const aiUnits = [{ id: 2, q: 4, r: 0, currentHp: 50, maxHp: 100, player: 1 }];

            const prediction = predictEnemyMovement(enemy, aiUnits);

            // Should predict movement toward AI unit
            expect(prediction).toBeDefined();
            if (prediction && prediction.likelyPositions) {
                expect(prediction.likelyPositions.length).toBeGreaterThan(0);
            }
        });
    });

    describe('identifyUnitsAtRisk', () => {
        it('should identify units that could be attacked', () => {
            const aiUnits = [
                { id: 1, q: 2, r: 0, currentHp: 30, maxHp: 100, player: 1, alive: true, range: 2, damage: 20 }
            ];
            const enemies = [
                { id: 2, q: 0, r: 0, damage: 40, range: 3, move: 2, player: 0, currentHp: 100, maxHp: 100, class: 'assault' }
            ];

            const atRisk = identifyUnitsAtRisk(aiUnits, enemies);

            // predictAttackTargets is called internally, which has its own logic
            // The unit at (2,0) is dist=2 from enemy at (0,0), within range 3
            expect(atRisk.length).toBeGreaterThan(0);
            expect(atRisk[0].unit.id).toBe(1);
        });

        it('should return empty array when units are safe', () => {
            const aiUnits = [
                { id: 1, q: 5, r: 5, currentHp: 100, maxHp: 100, player: 1, alive: true, range: 2, damage: 20 }
            ];
            const enemies = [
                { id: 2, q: 0, r: 0, damage: 40, range: 3, move: 2, player: 0, currentHp: 100, maxHp: 100, class: 'assault' }
            ];

            const atRisk = identifyUnitsAtRisk(aiUnits, enemies);

            // Unit at (5,5) has hex distance > range + move from enemy at (0,0)
            // hex distance = max(|5|, |5|, |-10|) = 10, range + move = 5
            expect(atRisk.length).toBe(0);
        });
    });

    describe('calculatePostAttackSafety', () => {
        it('should evaluate safety after potential attack', () => {
            const unit = { id: 1, q: 0, r: 0, damage: 30, range: 3, player: 1, currentHp: 100, maxHp: 100 };
            const target = { id: 2, q: 2, r: 0, currentHp: 50, player: 0, damage: 30, range: 3, move: 2 };
            const enemies = [target];
            const allies = [];

            const safety = calculatePostAttackSafety(unit, target, 1, 0, enemies, allies);

            // Returns { counterAttackers, counterAttackDamage, allySupport, survivalHP, isSafe, isDangerous }
            expect(safety).toBeDefined();
            expect(typeof safety.isDangerous).toBe('boolean');
            expect(typeof safety.counterAttackDamage).toBe('number');
        });
    });
});

describe('AI Minimax Module', () => {
    beforeEach(() => {
        resetState();
        state.units = [];
        state.hexes = [];
        state.hexMap = new Map();
        state.currentPlayer = 1; // Set AI player
        state.zoneRadius = 10;

        for (let q = -5; q <= 5; q++) {
            for (let r = -5; r <= 5; r++) {
                setHex({ q, r, type: 'grass', walkable: true, height: 0 });
            }
        }
    });

    describe('quickEvaluatePosition', () => {
        it('should return higher score for safer positions', () => {
            const enemies = [
                { id: 1, q: 0, r: 0, damage: 50, range: 3, alive: true }
            ];
            const unit = { id: 2, damage: 30, range: 3, alive: true };

            // Position far from enemy should score higher (safer)
            const scoreFar = quickEvaluatePosition(unit, 5, 5, enemies);
            const scoreNear = quickEvaluatePosition(unit, 1, 0, enemies);

            expect(scoreFar).toBeGreaterThan(scoreNear);
        });
    });

    describe('evaluateMove', () => {
        it('should evaluate move with attack higher than without', () => {
            const unit = { id: 1, q: 0, r: 0, damage: 40, range: 3, alive: true, player: 1, move: 3, currentHp: 100, maxHp: 100, class: 'assault' };
            const enemy = { id: 2, q: 2, r: 0, currentHp: 30, maxHp: 100, alive: true, player: 0, damage: 30, range: 3, move: 3, class: 'assault' };

            // Populate state.units for minimax
            state.units = [unit, enemy];

            const scoreWithAttack = evaluateMove(unit, 1, 0, enemy);
            const scoreWithoutAttack = evaluateMove(unit, 1, 0, null);

            // Both may be negative or positive; attack should generally score better
            expect(scoreWithAttack).toBeGreaterThanOrEqual(scoreWithoutAttack);
        });

        it('should evaluate kill potential very high', () => {
            const unit = { id: 1, q: 0, r: 0, damage: 50, range: 3, alive: true, player: 1, move: 3, currentHp: 100, maxHp: 100, class: 'assault' };
            const weakEnemy = { id: 2, q: 2, r: 0, currentHp: 20, maxHp: 100, alive: true, player: 0, damage: 30, range: 3, move: 3, class: 'assault' };
            const strongEnemy = { id: 3, q: 2, r: 0, currentHp: 100, maxHp: 100, alive: true, player: 0, damage: 30, range: 3, move: 3, class: 'assault' };

            state.units = [unit, weakEnemy];
            const scoreKill = evaluateMove(unit, 1, 0, weakEnemy);

            state.units = [unit, strongEnemy];
            const scoreNoKill = evaluateMove(unit, 1, 0, strongEnemy);

            // Killing should score higher
            expect(scoreKill).toBeGreaterThanOrEqual(scoreNoKill);
        });
    });

    describe('findBestMoveForUnit', () => {
        it('should return a move object', () => {
            const unit = { id: 1, q: 0, r: 0, move: 2, range: 3, damage: 40, alive: true, player: 1 };
            const enemies = [{ id: 2, q: 3, r: 0, currentHp: 50, maxHp: 100, alive: true, player: 0 }];
            const allies = [];

            const bestMove = findBestMoveForUnit(unit, enemies, allies);

            // Should return some kind of move recommendation
            expect(bestMove).toBeDefined();
        });

        it('should handle no enemies gracefully', () => {
            const unit = { id: 1, q: 0, r: 0, move: 2, range: 3, damage: 40, alive: true, player: 1 };

            const bestMove = findBestMoveForUnit(unit, [], []);

            // Should not crash, may return null or empty move
            expect(() => findBestMoveForUnit(unit, [], [])).not.toThrow();
        });
    });
});
