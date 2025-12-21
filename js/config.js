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
        small: 6,
        medium: 8,
        large: 10
    },

    // Spawn-Abstände vom Rand
    SPAWN_OFFSET: {
        small: 5,
        medium: 7,
        large: 9
    }
};

export const TERRAIN = {
    grass: {
        color: '#3d6b4f',
        walkable: true,
        cover: false,
        moveCost: 1,
        name: 'Gras'
    },
    forest: {
        color: '#2d5a3d',
        walkable: true,
        cover: true,
        moveCost: 2,
        name: 'Wald'
    },
    rock: {
        color: '#5a5a6a',
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Felsen'
    },
    water: {
        color: '#2a4a6f',
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Wasser'
    },
    sand: {
        color: '#9b8365',
        walkable: true,
        cover: false,
        moveCost: 1,
        name: 'Sand'
    },
    swamp: {
        color: '#4a5a3a',
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
    }
};
