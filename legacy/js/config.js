// ===== GAME CONFIGURATION =====

export const CONFIG = {
    BASE_HEX_SIZE: 55,
    PLAYER_COLORS: ['#22c55e', '#ef4444', '#3b82f6', '#eab308'],
    PLAYER_NAMES: ['Grün', 'Rot', 'Blau', 'Gelb'],
    UNITS_PER_PLAYER: 3,
    AP_PER_TURN: 4,
    MAX_ROUNDS: 15,
    VISION_RANGE: 6,  // Fog of War vision range (increased from 5)

    // Balance: Limit attacks per unit per turn to prevent one unit from dominating
    MAX_ATTACKS_PER_UNIT: 2,  // Each unit can attack max 2 times per turn

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
    },
    // Realistic enhanced terrain types
    snow: {
        color: '#e8eef5',
        colorLight: '#f5f8fc',
        colorDark: '#c8d4e0',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 2,
        name: 'Schnee',
        slippery: true
    },
    ice: {
        color: '#a0d4e8',
        colorLight: '#c0e8f5',
        colorDark: '#70b0d0',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Eis',
        slippery: true,
        reflective: true
    },
    deepwater: {
        color: '#0a2540',
        colorLight: '#1a3555',
        colorDark: '#051530',
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Tiefes Wasser',
        animated: true,
        depth: 'deep'
    },
    shallows: {
        color: '#3a7a9a',
        colorLight: '#4a8aaa',
        colorDark: '#2a6a8a',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 2,
        name: 'Seichtes Wasser',
        animated: true
    },
    reeds: {
        color: '#4a6a45',
        colorLight: '#5a7a55',
        colorDark: '#3a5a35',
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 2,
        name: 'Schilf',
        animated: true
    },
    flowers: {
        color: '#3d8050',
        colorLight: '#4d9060',
        colorDark: '#2d7040',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Blumenwiese',
        decorative: true
    },
    mud: {
        color: '#5a4a30',
        colorLight: '#6a5a40',
        colorDark: '#4a3a20',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 2,
        name: 'Schlamm',
        sticky: true
    },
    farmland: {
        color: '#6a5535',
        colorLight: '#7a6545',
        colorDark: '#5a4525',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Ackerland'
    },
    wheat: {
        color: '#c4a84a',
        colorLight: '#d4b85a',
        colorDark: '#b4983a',
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 1,
        name: 'Weizenfeld',
        animated: true
    },
    gravel: {
        color: '#8a8075',
        colorLight: '#9a9085',
        colorDark: '#7a7065',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Kies'
    },
    cliff: {
        color: '#5a5550',
        colorLight: '#6a6560',
        colorDark: '#4a4540',
        walkable: false,
        cover: true,
        moveCost: Infinity,
        name: 'Klippe',
        elevation: 2
    },
    ruins: {
        color: '#6a6560',
        colorLight: '#7a7570',
        colorDark: '#5a5550',
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 2,
        name: 'Ruinen'
    },
    bridge: {
        color: '#6a5040',
        colorLight: '#7a6050',
        colorDark: '#5a4030',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Brücke',
        elevated: true
    },
    tallgrass: {
        color: '#3a6a40',
        colorLight: '#4a7a50',
        colorDark: '#2a5a30',
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 1,
        name: 'Hohes Gras',
        animated: true
    },
    pine: {
        color: '#1a3a25',
        colorLight: '#2a4a35',
        colorDark: '#0a2a15',
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 2,
        name: 'Nadelwald'
    },
    clearing: {
        color: '#4a8a55',
        colorLight: '#5a9a65',
        colorDark: '#3a7a45',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Lichtung'
    },
    heather: {
        color: '#7a5a7a',
        colorLight: '#8a6a8a',
        colorDark: '#6a4a6a',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Heide'
    },
    moss: {
        color: '#3a5a3a',
        colorLight: '#4a6a4a',
        colorDark: '#2a4a2a',
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Moos'
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
