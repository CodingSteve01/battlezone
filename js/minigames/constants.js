// ===== MINIGAME CONSTANTS =====
// Result levels, multipliers, and descriptions

// Minigame result levels
export const RESULT_LEVELS = {
    PERFECT: 'perfect',   // 100% damage + crit chance bonus + guaranteed hit
    GOOD: 'good',         // 100% damage + high hit chance
    OKAY: 'okay',         // 70% damage
    MISS: 'miss'          // 30% damage
};

// Result multipliers for damage and hit chance
export const RESULT_MULTIPLIERS = {
    [RESULT_LEVELS.PERFECT]: { damage: 1.0, critBonus: 0.25, hitBonus: 1.0, label: 'PERFEKT!', color: '#ffd700' },
    [RESULT_LEVELS.GOOD]: { damage: 1.0, critBonus: 0, hitBonus: 0.15, label: 'GUT!', color: '#22c55e' },
    [RESULT_LEVELS.OKAY]: { damage: 0.7, critBonus: 0, hitBonus: 0, label: 'OK', color: '#f59e0b' },
    [RESULT_LEVELS.MISS]: { damage: 0.3, critBonus: 0, hitBonus: -0.2, label: 'DANEBEN', color: '#ef4444' }
};

// Healing result multipliers
export const HEALING_RESULT_MULTIPLIERS = {
    [RESULT_LEVELS.PERFECT]: { healing: 1.0, critBonus: 0.15, label: 'PERFEKT!', color: '#ffd700' },
    [RESULT_LEVELS.GOOD]: { healing: 0.85, critBonus: 0, label: 'GUT!', color: '#22c55e' },
    [RESULT_LEVELS.OKAY]: { healing: 0.7, critBonus: 0, label: 'OK', color: '#f59e0b' },
    [RESULT_LEVELS.MISS]: { healing: 0.5, critBonus: 0, label: 'SCHWACH', color: '#ef4444' }
};

// Unit-specific minigame descriptions with detailed explanations
export const MINIGAME_DESCRIPTIONS = {
    scout: {
        title: 'Schnellfeuer',
        instruction: 'Tippe das bewegliche Ziel!',
        hint: 'Je näher am Zentrum, desto besser!',
        detailedExplanation: 'Ein rotes Ziel bewegt sich über den Bildschirm.\n\nTippe darauf, um zu treffen!\n\n💎 Perfekt = Mitte des Ziels\n✅ Gut = Nahe am Zentrum\n⚠️ OK = Rand des Ziels'
    },
    assault: {
        title: 'Powerschuss',
        instruction: 'Stoppe im grünen Bereich!',
        hint: 'Gold = Perfekt, Grün = Gut',
        detailedExplanation: 'Ein Balken bewegt sich hin und her.\n\nTippe, um ihn zu stoppen!\n\n💎 Gold-Zone = Perfekter Treffer\n✅ Grüne Zone = Guter Treffer\n🟠 Orange Zone = OK\n❌ Roter Rand = Daneben'
    },
    sniper: {
        title: 'Präzisionsschuss',
        instruction: 'Schieße wenn das Fadenkreuz still steht!',
        hint: 'Warte auf den grünen Moment!',
        detailedExplanation: 'Das Fadenkreuz wackelt ständig.\n\nWarte auf den "stillen Moment"!\n\n🔴 Rot = Wackelt - NICHT schießen!\n🟡 Gelb = Gleich ruhig...\n🟢 Grün = JETZT schießen!'
    },
    medic: {
        title: 'Zielschuss',
        instruction: 'Stoppe im grünen Bereich!',
        hint: 'Medic greift mit Pistole an',
        detailedExplanation: 'Ein Balken bewegt sich hin und her.\n\nTippe, um ihn zu stoppen!\n\n💎 Goldene Zone = Perfekt\n✅ Grüne Zone = Gut'
    },
    commando: {
        title: 'Nahkampf-Duell',
        instruction: 'Reagiere auf den Feind!',
        hint: 'Stein-Schere-Papier Prinzip',
        detailedExplanation: 'Ein 3-Runden Duell!\n\n⚔️ ANGRIFF schlägt 💨 Ausweichen\n🛡️ BLOCK schlägt ⚔️ Angriff\n💨 AUSWEICHEN schlägt 🛡️ Block\n\nBeobachte den Feind und wähle die richtige Antwort!\n2 von 3 Runden gewinnen!'
    }
};

// Healing minigame description (separate from attack)
export const HEALING_MINIGAME_DESC = {
    title: 'Heilungsrhythmus',
    instruction: 'Tippe im Rhythmus des Herzschlags!',
    hint: '4 Schläge im richtigen Timing',
    detailedExplanation: 'Eine EKG-Linie zeigt den Herzschlag.\n\n4 Herz-Symbole erscheinen nacheinander.\nTippe GENAU wenn sie aufleuchten!\n\n🟡 Gelb = JETZT tippen!\n✅ Grün = Getroffen!\n❌ Rot = Verpasst\n\nTreffe alle 4 für Perfekt!'
};

// Anti-cheat: Tap cooldown in ms
export const TAP_COOLDOWN_MS = 120;
