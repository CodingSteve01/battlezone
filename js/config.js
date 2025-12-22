// ===== GAME CONFIGURATION =====

export const CONFIG = {
    BASE_HEX_SIZE: 55,
    PLAYER_COLORS: ['#22c55e', '#ef4444', '#3b82f6', '#eab308'],
    PLAYER_NAMES: ['Grün', 'Rot', 'Blau', 'Gelb'],
    UNITS_PER_PLAYER: 3,
    AP_PER_TURN: 4,
    MAX_ROUNDS: 15,
    VISION_RANGE: 6,  // Fog of War vision range (increased from 5)

    // Map sizes (radius in hexes)
    MAP_SIZES: {
        small: 8,
        medium: 12,
        large: 16
    },

    // Spawn distance from center (reduced for faster encounters)
    SPAWN_OFFSET: {
        small: 4,    // Was 6 - now teams start closer
        medium: 7,   // Was 10 - reduces ~6 hexes of search distance
        large: 10    // Was 14 - still big, but manageable
    }
};

export const TERRAIN = {
    grass: {
        color: '#2d5a40',
        colorLight: '#3d7352',
        colorDark: '#1e4030',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Gras'
    },
    forest: {
        color: '#1e4d35',
        colorLight: '#2a6045',
        colorDark: '#143525',
        walkable: true,
        cover: true,
        canHide: true,  // Units can hide in forest
        moveCost: 2,
        name: 'Wald'
    },
    hills: {
        color: '#5a6a50',
        colorLight: '#6a7a60',
        colorDark: '#4a5a40',
        walkable: true,
        cover: false,
        moveCost: 2,
        name: 'Hügel',
        rangeBonus: 1,      // +1 range for attacks
        defenseBonus: 10    // +10% hit chance when defending (height advantage)
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
    },
    road: {
        color: '#6a5a4a',
        colorLight: '#7a6a5a',
        colorDark: '#5a4a3a',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 0.5,  // Fast movement on roads (half cost)
        name: 'Straße'
    },
    path: {
        color: '#5a5040',
        colorLight: '#6a6050',
        colorDark: '#4a4030',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,  // Normal movement cost (but good for visual variety)
        name: 'Pfad'
    },
    river: {
        color: '#2a5a80',
        colorLight: '#3a6a95',
        colorDark: '#1a4a65',
        walkable: true,  // Can cross, but expensive
        cover: false,
        canHide: false,
        moveCost: 3,  // Expensive to cross
        name: 'Fluss'
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
        vision: 7,          // Increased from 6 - best at finding enemies
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
        vision: 5,          // Increased from 4
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
        vision: 6,          // Increased from 5
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
        vision: 8,          // Increased from 7 - excellent spotter
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
        vision: 5,          // Kept at 5 - relies on stealth, not vision
        special: 'Schleichen',
        specialDesc: 'Tarnung + Bonus-Bewegung',
        stealthDetectionRange: 1,  // Noch schwerer zu entdecken
        meleeBonus: 15      // Extra Schaden im Nahkampf
    }
};
