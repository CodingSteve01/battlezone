// ===== MINIGAME DIFFICULTY SYSTEM =====
// Adaptive difficulty based on game context

/**
 * @typedef {Object} MinigameContext
 * @property {number} distance - Hex-Distanz zum Ziel
 * @property {number} maxRange - Max Reichweite der Unit
 * @property {string} attackerTerrain - Terrain des Angreifers
 * @property {string} targetTerrain - Terrain des Ziels
 * @property {number} alliesInRange - Verbündete in 2 Hex Radius
 * @property {number} enemiesInRange - Feinde in 2 Hex Radius (Stress-Faktor)
 * @property {boolean} isAmbush - Aus Tarnung/Hinterhalt angreifend
 * @property {boolean} targetHiding - Ziel ist versteckt
 * @property {number} attackerHP - HP-Prozent des Angreifers
 * @property {number} targetHP - HP-Prozent des Ziels
 */

/**
 * Berechne Schwierigkeitsmodifikatoren basierend auf Kontext
 * @param {string} unitClass - Einheitsklasse
 * @param {MinigameContext} context - Kontextdaten
 * @returns {Object} Modifikatoren für das Minigame
 */
export function calculateDifficultyModifiers(unitClass, context) {
    if (!context) {
        return {
            speedMultiplier: 1.0,      // Geschwindigkeit bewegter Elemente
            zoneMultiplier: 1.0,       // Größe von Trefferzonen
            timeMultiplier: 1.0,       // Verfügbare Zeit
            extraChance: 0,            // Extra Erfolgs-Chance
            description: null          // Beschreibung für UI
        };
    }

    const mods = {
        speedMultiplier: 1.0,
        zoneMultiplier: 1.0,
        timeMultiplier: 1.0,
        extraChance: 0,
        description: null
    };

    // Distanz-Verhältnis (0 = nah, 1 = max Reichweite)
    const distanceRatio = context.maxRange > 0 ? context.distance / context.maxRange : 0;

    // === KLASSEN-SPEZIFISCHE MODIFIKATOREN ===

    switch (unitClass) {
        case 'scout':
            // Scout: Schnelle Reflexe, profitiert von Verbündeten (Ablenkung)
            // Nahkampf ist einfacher (größeres Ziel)
            if (distanceRatio < 0.3) {
                mods.zoneMultiplier = 1.3;  // 30% größeres Ziel bei kurzer Distanz
                mods.description = 'Nahes Ziel - leichter zu treffen';
            } else if (distanceRatio > 0.7) {
                mods.speedMultiplier = 1.3; // Ziel bewegt sich schneller bei weiter Distanz
                mods.zoneMultiplier = 0.8;
                mods.description = 'Weites Ziel - schneller & kleiner';
            }
            // Verbündete lenken Feind ab
            if (context.alliesInRange > 0) {
                mods.timeMultiplier = 1 + (context.alliesInRange * 0.15);
                mods.description = `Verbündete lenken ab (+${context.alliesInRange * 15}% Zeit)`;
            }
            break;

        case 'assault':
            // Assault: Unterdrückungsfeuer, Verbündete helfen
            if (distanceRatio > 0.8) {
                mods.zoneMultiplier = 0.7;  // Schwieriger auf Distanz
                mods.description = 'Maximale Reichweite - präzises Timing nötig';
            }
            // Hügel-Vorteil
            if (context.attackerTerrain === 'hills') {
                mods.zoneMultiplier *= 1.2;
                mods.description = 'Erhöhte Position - bessere Kontrolle';
            }
            // Verbündete: Unterdrückungsfeuer
            if (context.alliesInRange > 0) {
                mods.zoneMultiplier *= 1 + (context.alliesInRange * 0.1);
                mods.description = `Unterdrückungsfeuer (+${context.alliesInRange * 10}% Zone)`;
            }
            break;

        case 'sniper':
            // Sniper: Arbeitet ALLEINE, keine Ally-Boni!
            // Kurze Distanz ist SCHWIERIGER (Sniper braucht Abstand)
            if (distanceRatio < 0.4) {
                mods.speedMultiplier = 1.5;  // Mehr Wackeln bei Nahkampf
                mods.timeMultiplier = 0.8;   // Weniger Zeit zum Zielen
                mods.description = 'Zu nah! Schwer zu zielen';
            } else if (distanceRatio > 0.7) {
                // Optimale Sniper-Distanz
                mods.speedMultiplier = 0.85;
                mods.description = 'Optimale Schussdistanz';
            }
            // Hügel-Vorteil für Sniper
            if (context.attackerTerrain === 'hills') {
                mods.speedMultiplier *= 0.9;  // Ruhigere Hand
                mods.description = 'Erhöhte Position - stabiler';
            }
            // Stress bei vielen Feinden in der Nähe
            if (context.enemiesInRange > 1) {
                mods.speedMultiplier *= 1 + (context.enemiesInRange * 0.1);
                mods.description = 'Unter Druck - unruhige Hand!';
            }
            break;

        case 'medic':
            // Medic: Ruhiger wenn Verbündete beschützen
            // Stress bei niedrigen HP oder wenn alleine
            if (context.attackerHP < 0.5) {
                mods.speedMultiplier = 1.3;  // Schnellerer Puls bei niedrigen HP
                mods.description = 'Verletzt - erhöhter Puls!';
            }
            if (context.alliesInRange > 0) {
                mods.speedMultiplier *= 0.9;  // Ruhiger mit Schutz
                mods.timeMultiplier = 1.1;
                mods.description = 'Beschützt - ruhigerer Puls';
            }
            if (context.alliesInRange === 0 && context.enemiesInRange > 0) {
                mods.speedMultiplier = 1.4;  // Panik wenn alleine mit Feinden
                mods.description = 'Alleine unter Feinden!';
            }
            break;

        case 'commando':
            // Commando: Nahkampf-Spezialist
            // Duell wird durch Kontext beeinflusst
            if (context.isAmbush) {
                mods.extraChance = 0.2;      // 20% extra Erfolgschance aus Hinterhalt
                mods.timeMultiplier = 1.3;   // Mehr Zeit für Reaktion
                mods.description = 'Überraschungsangriff!';
            }
            if (context.alliesInRange > 0) {
                mods.extraChance += context.alliesInRange * 0.1;
                mods.description = `Verbündete lenken ab (+${context.alliesInRange * 10}% Chance)`;
            }
            // Feind versteckt = schwieriger
            if (context.targetHiding) {
                mods.timeMultiplier = 0.85;
                mods.description = 'Feind in Deckung!';
            }
            break;

        case 'elitesoldat':
            // Kommando-Soldat: Vielseitig - passt sich an Situation an
            // Im Nahkampf (distance = 1): wie Commando
            // Im Fernkampf: wie Assault aber stabiler
            if (context.distance === 1) {
                // Nahkampf: Wie Commando
                if (context.isAmbush) {
                    mods.extraChance = 0.15;     // Elite ist gut, aber nicht ganz so stark wie Commando
                    mods.timeMultiplier = 1.2;
                    mods.description = 'Nahkampf-Überraschung!';
                }
                if (context.alliesInRange > 0) {
                    mods.extraChance += context.alliesInRange * 0.08;
                    mods.description = `Taktische Unterstützung (+${context.alliesInRange * 8}% Chance)`;
                }
            } else {
                // Fernkampf: Wie Assault aber mit Elite-Bonus
                mods.zoneMultiplier = 1.1;       // Elite ist präziser
                if (context.alliesInRange > 0) {
                    mods.zoneMultiplier += context.alliesInRange * 0.05;
                    mods.description = `Koordinierter Angriff (+${context.alliesInRange * 5}%)`;
                }
                if (context.attackerHP < 0.3) {
                    mods.speedMultiplier = 1.2;  // Auch Eliten geraten unter Druck
                    mods.description = 'Kritischer Zustand!';
                }
            }
            break;
    }

    // === TERRAIN-EFFEKTE ===
    if (context.targetTerrain === 'forest' && unitClass !== 'commando' && unitClass !== 'elitesoldat') {
        mods.zoneMultiplier *= 0.85;  // Wald versteckt das Ziel leicht
    }

    return mods;
}
