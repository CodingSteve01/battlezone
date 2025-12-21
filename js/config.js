// ===== GAME CONFIGURATION =====

export const CONFIG = {
    BASE_HEX_SIZE: 55,
    PLAYER_COLORS: ['#22c55e', '#ef4444', '#3b82f6', '#eab308'],
    PLAYER_NAMES: ['Grün', 'Rot', 'Blau', 'Gelb'],
    UNITS_PER_PLAYER: 3,
    AP_PER_TURN: 4,
    MAX_ROUNDS: 15,
    VISION_RANGE: 5,  // Fog of War Sichtweite

    // Map-Größen (Radius)
    MAP_SIZES: {
        small: 8,
        medium: 12,
        large: 16
    },

    // Spawn-Abstände vom Rand
    SPAWN_OFFSET: {
        small: 6,
        medium: 10,
        large: 14
    }
};

export const TERRAIN = {
    grass: {
        color: '#2d5a40',
        colorLight: '#3d7352',
        colorDark: '#1e4030',
        walkable: true,
        cover: false,
        moveCost: 1,
        name: 'Gras'
    },
    forest: {
        color: '#1e4d35',
        colorLight: '#2a6045',
        colorDark: '#143525',
        walkable: true,
        cover: true,
        moveCost: 2,
        name: 'Wald'
    },
    rock: {
        color: '#4a4a5a',
        colorLight: '#5a5a6a',
        colorDark: '#3a3a4a',
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Felsen'
    },
    water: {
        color: '#1a4a70',
        colorLight: '#2a5a85',
        colorDark: '#0f3555',
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Wasser'
    },
    sand: {
        color: '#8a7355',
        colorLight: '#a08565',
        colorDark: '#6a5540',
        walkable: true,
        cover: false,
        moveCost: 1,
        name: 'Sand'
    },
    swamp: {
        color: '#3a4a30',
        colorLight: '#4a5a40',
        colorDark: '#2a3520',
        walkable: true,
        cover: false,
        moveCost: 3,
        name: 'Sumpf'
    }
};

export const UNIT_CLASSES = {
    scout: {
        name: 'Scout',
        icon: '🎯',
        hp: 60,
        damage: 18,
        range: 4,
        move: 5,
        vision: 6,
        special: 'Sprint',
        specialDesc: '+3 Bewegung'
    },
    assault: {
        name: 'Assault',
        icon: '💥',
        hp: 100,
        damage: 35,
        range: 2,
        move: 3,
        vision: 4,
        special: 'Powershot',
        specialDesc: '+20 Schaden'
    },
    medic: {
        name: 'Medic',
        icon: '💚',
        hp: 80,
        damage: 12,
        range: 2,
        move: 4,
        vision: 5,
        special: 'Heilung',
        specialDesc: 'Heilt Team +30 HP'
    },
    sniper: {
        name: 'Sniper',
        icon: '🔫',
        hp: 50,
        damage: 45,
        range: 6,
        move: 2,
        vision: 7,
        special: 'Tarnung',
        specialDesc: 'Unsichtbar für 1 Runde',
        stealthDetectionRange: 2
    },
    ninja: {
        name: 'Ninja',
        icon: '🥷',
        hp: 65,
        damage: 40,
        range: 1,           // Nahkampf
        move: 4,
        vision: 5,
        special: 'Schleichen',
        specialDesc: 'Tarnung + Bonus-Bewegung',
        stealthDetectionRange: 1,  // Noch schwerer zu entdecken
        meleeBonus: 15      // Extra Schaden im Nahkampf
    }
};
