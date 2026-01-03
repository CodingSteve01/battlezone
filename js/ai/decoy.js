// ===== AI DECOY/BAIT STRATEGY =====
// Tactical decoy strategy for luring enemies into ambushes

import { state, getHex, getPlayerUnits, isHexInZone, arePlayersAllied } from '../state.js';
import { hexDistance } from '../hexMath.js';
import { getSpawnPositions } from '../map.js';
import { getAIMemory } from './memory.js';
import { addMultiPartThought, CLASS_NAMES_DE } from './thoughts.js';

/**
 * Get enemy spawn centers for strategic planning
 */
export function getEnemySpawnCenters() {
    const spawns = getSpawnPositions();
    if (!spawns || spawns.length === 0) return [];

    return spawns
        .map((playerSpawns, playerIndex) => ({
            playerIndex,
            center: playerSpawns[0]
        }))
        .filter(({ playerIndex }) => playerIndex < state.settings.players)
        .filter(({ playerIndex }) => !arePlayersAllied(state.currentPlayer, playerIndex))
        .map(({ center }) => center)
        .filter(Boolean);
}

/**
 * Check if decoy strategy should be used
 * Conditions:
 * - Have 3+ units alive
 * - Have a tanky unit (Assault) or fast unit (Scout) to act as bait
 * - Have units that can deal high damage from ambush (Sniper, Commando)
 * - Enemies are visible but not too close
 */
export function shouldUseDecoyStrategy(aiUnits, enemies) {
    // Need at least 3 units for effective decoy
    if (aiUnits.length < 3) return false;

    // Need visible enemies
    if (enemies.length === 0) return false;

    // Check if enemies are at mid-range (not too close, not too far)
    const avgEnemyDist = enemies.reduce((sum, e) => {
        const closestUnit = aiUnits.reduce((minDist, u) => {
            const dist = hexDistance({ q: u.q, r: u.r }, { q: e.q, r: e.r });
            return dist < minDist ? dist : minDist;
        }, Infinity);
        return sum + closestUnit;
    }, 0) / enemies.length;

    // Decoy works best at 4-8 hex distance
    if (avgEnemyDist < 4 || avgEnemyDist > 10) return false;

    // Check for suitable decoy candidates
    const decoyCandidate = findDecoyCandidate(aiUnits);
    if (!decoyCandidate) return false;

    // Check for ambush units
    const ambushCandidates = aiUnits.filter(u =>
        u.id !== decoyCandidate.id &&
        (u.class === 'sniper' || u.class === 'commando' || u.class === 'assault')
    );

    return ambushCandidates.length >= 1;
}

/**
 * Find the best unit to act as decoy/bait
 * SICHERHEIT ZUERST: Nur Units mit hoher HP und Überlebensfähigkeit
 * Prefer: Assault (tanky, 100 HP), Scout (nur mit Sprint verfügbar)
 */
export function findDecoyCandidate(aiUnits) {
    // Assault ist die erste Wahl wegen hoher HP (100)
    const assault = aiUnits.find(u =>
        u.class === 'assault' &&
        u.currentHp > u.maxHp * 0.7 && // Braucht mindestens 70% HP für Sicherheit
        u.alive
    );
    if (assault) return assault;

    // Scout nur wenn Sprint noch verfügbar ist (für Fluchtmöglichkeit)
    const scout = aiUnits.find(u =>
        u.class === 'scout' &&
        u.currentHp > u.maxHp * 0.7 &&
        u.alive &&
        !u.usedSpecial // Sprint muss noch verfügbar sein!
    );
    if (scout) return scout;

    // Kein geeigneter Köder gefunden - Sicherheit geht vor
    return null;
}

/**
 * Plan decoy strategy - set up units for ambush
 */
export function planDecoyStrategy(aiUnits, _enemies) {
    const aiMemory = getAIMemory();

    // Find decoy
    const decoy = findDecoyCandidate(aiUnits);
    if (!decoy) return false;

    // Find ambush units (high damage dealers)
    const ambushers = aiUnits.filter(u =>
        u.id !== decoy.id &&
        u.alive &&
        (u.class === 'sniper' || u.class === 'commando' || u.class === 'assault')
    );

    if (ambushers.length === 0) return false;

    // Activate decoy strategy
    aiMemory.decoyUnit = decoy.id;
    aiMemory.ambushUnits = ambushers.map(u => u.id);
    aiMemory.decoyActive = true;

    addMultiPartThought([
        'Wir starten eine sichere Köder-Taktik.',
        `Der ${CLASS_NAMES_DE[decoy.class]} lockt Feinde an, bleibt aber außerhalb der Angriffsreichweite.`,
        'Die Hinterhalts-Einheiten warten auf den perfekten Moment zum Zuschlagen.'
    ], 'strategy');

    return true;
}

/**
 * Check if a unit is the current decoy
 */
export function isDecoyUnit(unit) {
    const aiMemory = getAIMemory();
    return aiMemory.decoyActive && aiMemory.decoyUnit === unit.id;
}

/**
 * Check if a unit is an ambush unit
 */
export function isAmbushUnit(unit) {
    const aiMemory = getAIMemory();
    return aiMemory.decoyActive && aiMemory.ambushUnits.includes(unit.id);
}

/**
 * Score position for decoy unit - lure enemies while STAYING SAFE
 * SICHERHEIT ZUERST: Köder soll überleben, nicht geopfert werden!
 * Ideal: AUSSERHALB der Feindreichweite, aber sichtbar und verlockend
 */
export function scoreDecoyPosition(unit, q, r, enemies) {
    let score = 0;
    const hex = getHex(q, r);

    if (!hex) return -1000;

    // Find closest enemy and calculate threat
    let closestEnemy = null;
    let closestDist = Infinity;
    let totalThreat = 0;

    for (const enemy of enemies) {
        const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
        if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = enemy;
        }
        // Berechne Bedrohung: Feinde die uns erreichen können
        const enemyRange = enemy.range || 3;
        if (dist <= enemyRange) {
            totalThreat += enemy.damage;
        }
    }

    // === SICHERHEITS-BEWERTUNG (HÖCHSTE PRIORITÄT) ===
    // VERMEIDE Positionen wo wir von mehreren Feinden angegriffen werden können
    if (totalThreat > unit.currentHp * 0.5) {
        score -= 300; // Zu gefährlich! Mehrere Feinde könnten uns erledigen
    } else if (totalThreat > 0) {
        score -= totalThreat * 2; // Leichte Strafe für jede Bedrohung
    }

    if (closestEnemy) {
        const enemyRange = closestEnemy.range || 3;

        // === SICHERE KÖDER-POSITION ===
        // Ideal: KNAPP AUSSERHALB der Feindreichweite (sie müssen sich bewegen um anzugreifen)
        if (closestDist === enemyRange + 1) {
            // PERFEKT: Knapp außerhalb - Feind muss sich bewegen, wir sind sicher
            score += 120;
        } else if (closestDist === enemyRange + 2) {
            // Gut: Etwas weiter weg, aber immer noch verlockend
            score += 80;
        } else if (closestDist === enemyRange) {
            // GEFÄHRLICH: Gerade noch in Reichweite - nur wenn Deckung vorhanden
            if (hex.cover) {
                score += 40; // Mit Deckung akzeptabel
            } else {
                score -= 50; // Ohne Deckung zu riskant
            }
        } else if (closestDist < enemyRange) {
            // ZU NAH: Stark bestraft - der Köder soll überleben!
            score -= 150;
        } else if (closestDist > enemyRange + 3) {
            // Zu weit - nicht effektiv als Köder
            score -= closestDist * 3;
        }
    }

    // === FLUCHTWEG-BEWERTUNG ===
    // Köder MUSS einen sicheren Rückzugsweg zu Verbündeten haben
    const ambushUnits = getPlayerUnits(unit.player).filter(u => isAmbushUnit(u));
    if (ambushUnits.length > 0) {
        const avgAmbushDist = ambushUnits.reduce((sum, a) =>
            sum + hexDistance({ q, r }, { q: a.q, r: a.r }), 0
        ) / ambushUnits.length;

        // Köder sollte 3-5 Felder von Verstärkung entfernt sein
        if (avgAmbushDist >= 3 && avgAmbushDist <= 5) {
            score += 50; // Ideale Fluchtdistanz - nah genug für Unterstützung
        } else if (avgAmbushDist <= 2) {
            score += 30; // Sehr nah - gut für Sicherheit
        } else if (avgAmbushDist > 6) {
            score -= 60; // ZU WEIT von Verstärkung - gefährlich!
        }
    } else {
        // Ohne Hinterhalts-Einheiten ist die Position sehr riskant
        score -= 100;
    }

    // === DECKUNG IST WICHTIG ===
    if (hex.cover) {
        score += 40; // Deckung ist jetzt viel wichtiger
    }
    if (hex.type === 'hills') {
        score += 20; // Hügel geben Überblick und defensive Vorteile
    }

    // Zone awareness
    if (!isHexInZone(q, r)) {
        score -= 200; // Don't lure outside safe zone
    }

    return score;
}

/**
 * Score position for ambush unit - stay hidden, ready to strike
 * Ambush units should be in cover, at flanking angles
 */
export function scoreAmbushPosition(unit, q, r, enemies) {
    let score = 0;
    const hex = getHex(q, r);

    if (!hex) return -1000;

    // Find closest enemy
    let closestEnemy = null;
    let closestDist = Infinity;
    for (const enemy of enemies) {
        const dist = hexDistance({ q, r }, { q: enemy.q, r: enemy.r });
        if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = enemy;
        }
    }

    // Ambush units want to be in attack range but from cover
    if (closestEnemy) {
        // Ideal distance: just at unit's attack range
        if (closestDist <= unit.range) {
            score += 80; // Can attack from here
        } else if (closestDist <= unit.range + 2) {
            score += 40; // Close to attack range
        } else {
            score -= (closestDist - unit.range) * 10;
        }
    }

    // Cover is essential for ambush
    if (hex.cover) {
        score += 60; // Ambush from cover
    } else {
        score -= 30; // Exposed position is bad for ambush
    }

    // Hills provide attack bonus for snipers
    if (hex.type === 'hills' && unit.class === 'sniper') {
        score += 50;
    }

    // Flanking position bonus
    // Check position relative to decoy unit
    const decoyUnit = getPlayerUnits(unit.player).find(u => isDecoyUnit(u));
    if (decoyUnit && closestEnemy) {
        // Ambush should be at different angle from decoy
        const decoyAngle = Math.atan2(decoyUnit.r - closestEnemy.r, decoyUnit.q - closestEnemy.q);
        const myAngle = Math.atan2(r - closestEnemy.r, q - closestEnemy.q);
        const angleDiff = Math.abs(myAngle - decoyAngle);

        // Reward flanking position (90+ degrees from decoy)
        if (angleDiff > Math.PI / 2) {
            score += 40; // Good flank
        } else if (angleDiff > Math.PI / 4) {
            score += 20; // Acceptable angle
        }
    }

    // Avoid clustering with other ambush units
    const otherAmbush = getPlayerUnits(unit.player).filter(u =>
        isAmbushUnit(u) && u.id !== unit.id
    );
    for (const other of otherAmbush) {
        const dist = hexDistance({ q, r }, { q: other.q, r: other.r });
        if (dist <= 1) score -= 25;
        else if (dist <= 2) score -= 10;
    }

    // Zone awareness
    if (!isHexInZone(q, r)) {
        score -= 200;
    }

    return score;
}
