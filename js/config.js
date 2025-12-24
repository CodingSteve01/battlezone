// ===== GAME CONFIGURATION =====

export const CONFIG = {
    BASE_HEX_SIZE: 55,
    PLAYER_COLORS: ['#22c55e', '#ef4444', '#3b82f6', '#eab308'],
    PLAYER_NAMES: ['Grün', 'Rot', 'Blau', 'Gelb'],
    UNITS_PER_PLAYER: 3,
    AP_PER_TURN: 4,
    MAX_ROUNDS: 30,
    VISION_RANGE: 6,  // Fog of War vision range (increased from 5)

    // Balance: Limit attacks per unit per turn to prevent one unit from dominating
    MAX_ATTACKS_PER_UNIT: 1,  // Each unit can attack max 1 time per turn

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
    },

    // Number of pre-generated terrain variants per type (e.g., grass_v1.png)
    // Set to >0 only if you have generated *_v#.png files in assets/terrain
    TERRAIN_VARIANTS: 4,

    // Animation settings for animated terrain (water, wheat, etc.)
    ANIMATION: {
        FRAME_COUNT: 4,        // Number of frames per animation (e.g., water_f0.png to water_f3.png)
        FRAME_DURATION: 250,   // Milliseconds per frame (4 FPS for subtle movement)
        ENABLED: true          // Master toggle for terrain animations
    }
};

// Ultra-realistic color palette - warm, natural earth tones inspired by high-quality strategy games
export const TERRAIN = {
    grass: {
        color: '#6a9a58',      // Warm meadow green with yellow undertones
        colorLight: '#7db068', // Sun-drenched grass
        colorDark: '#4a7a40',  // Shadowed meadow
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Gras'
    },
    forest: {
        color: '#3d6a4a',      // Rich forest green
        colorLight: '#4d7a58', // Canopy with light filtering
        colorDark: '#2a5038',  // Deep forest shade
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 2,
        name: 'Wald'
    },
    hills: {
        color: '#7a8c5a',      // Warm grassy hill
        colorLight: '#8a9c68', // Sunlit slope with golden highlights
        colorDark: '#5a7040',  // Hill in shadow
        walkable: true,
        cover: false,
        moveCost: 2,
        name: 'Hügel',
        rangeBonus: 1,
        defenseBonus: 10
    },
    rock: {
        color: '#7a7878',      // Natural weathered stone
        colorLight: '#908a88', // Sun-bleached rock
        colorDark: '#5a5858',  // Rock shadow
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Felsen'
    },
    water: {
        color: '#4a7a95',      // Natural lake blue-green
        colorLight: '#5a8aa8', // Sunlit ripples
        colorDark: '#3a6a80',  // Deeper water
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Wasser'
    },
    sand: {
        color: '#d4b888',      // Warm golden sand
        colorLight: '#e4c898', // Sun-baked sand
        colorDark: '#c4a878',  // Shadowed sand
        walkable: true,
        cover: false,
        moveCost: 1,
        name: 'Sand'
    },
    swamp: {
        color: '#5a6a45',      // Murky swamp with warm undertones
        colorLight: '#6a7a55', // Algae-covered surface
        colorDark: '#3a4a30',  // Deep swamp shadow
        walkable: true,
        cover: false,
        moveCost: 3,
        name: 'Sumpf'
    },
    road: {
        color: '#9a8a70',      // Warm dusty road
        colorLight: '#aa9a80', // Sun-baked road
        colorDark: '#7a6a55',  // Shadowed road
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 0.5,
        name: 'Straße'
    },
    path: {
        color: '#8a7860',      // Worn earth path with warm tones
        colorLight: '#9a8870', // Sunlit path
        colorDark: '#6a5845',  // Path in shadow
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Pfad'
    },
    river: {
        color: '#4a7c9a',      // Natural river blue-green
        colorLight: '#5a8caa', // Sunlit ripples
        colorDark: '#3a6c8a',  // Deep river
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 3,
        name: 'Fluss'
    },
    // Natural enhanced terrain types
    snow: {
        color: '#e8eef5',      // Fresh snow white
        colorLight: '#f8fcff', // Bright snow
        colorDark: '#d8dee8',  // Shadowed snow
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 2,
        name: 'Schnee',
        slippery: true
    },
    ice: {
        color: '#b8d8e8',      // Natural ice blue
        colorLight: '#d0e8f5', // Bright ice
        colorDark: '#98c0d8',  // Deep ice
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Eis',
        slippery: true,
        reflective: true
    },
    deepwater: {
        color: '#1a4060',      // Dark ocean blue
        colorLight: '#2a5070', // Sunlit deep
        colorDark: '#0a3050',  // Abyss
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Tiefes Wasser',
        animated: true,
        depth: 'deep'
    },
    shallows: {
        color: '#5a9aaa',      // Clear shallow water
        colorLight: '#6aaaba', // Bright shallows
        colorDark: '#4a8a9a',  // Shadowed shallows
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 2,
        name: 'Seichtes Wasser',
        animated: true
    },
    reeds: {
        color: '#5a7a50',      // Natural reed green
        colorLight: '#6a8a60', // Sunlit reeds
        colorDark: '#4a6a40',  // Shadowed reeds
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 2,
        name: 'Schilf',
        animated: true
    },
    flowers: {
        color: '#5a8a60',      // Flower meadow green
        colorLight: '#6a9a70', // Bright meadow
        colorDark: '#4a7a50',  // Shadowed meadow
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Blumenwiese',
        decorative: true
    },
    mud: {
        color: '#5a4838',      // Natural brown mud
        colorLight: '#6a5848', // Drying mud
        colorDark: '#4a3828',  // Wet mud
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 2,
        name: 'Schlamm',
        sticky: true
    },
    farmland: {
        color: '#7a6545',      // Tilled earth
        colorLight: '#8a7555', // Dry soil
        colorDark: '#6a5535',  // Moist soil
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Ackerland'
    },
    wheat: {
        color: '#c8b060',      // Golden wheat
        colorLight: '#d8c070', // Sunlit wheat
        colorDark: '#b8a050',  // Shadowed wheat
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 1,
        name: 'Weizenfeld',
        animated: true
    },
    gravel: {
        color: '#9a9088',      // Natural gravel grey
        colorLight: '#aaa098', // Light gravel
        colorDark: '#8a8078',  // Dark gravel
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Kies'
    },
    cliff: {
        color: '#6a6560',      // Natural rock face
        colorLight: '#7a7570', // Lit cliff
        colorDark: '#5a5550',  // Shadowed cliff
        walkable: false,
        cover: true,
        moveCost: Infinity,
        name: 'Klippe',
        elevation: 2
    },
    ruins: {
        color: '#7a7570',      // Weathered stone ruins
        colorLight: '#8a8580', // Lichen-covered stone
        colorDark: '#6a6560',  // Shadowed ruins
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 2,
        name: 'Ruinen'
    },
    bridge: {
        color: '#8a7060',      // Wooden bridge planks
        colorLight: '#9a8070', // Weathered wood
        colorDark: '#7a6050',  // Shadowed planks
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Brücke',
        elevated: true
    },
    tallgrass: {
        color: '#5a8a55',      // Wild tall grass
        colorLight: '#6a9a65', // Sun-touched grass
        colorDark: '#4a7a45',  // Shaded grass
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 1,
        name: 'Hohes Gras',
        animated: true
    },
    pine: {
        color: '#2a4a35',      // Dark pine forest
        colorLight: '#3a5a45', // Sunlit pines
        colorDark: '#1a3a25',  // Dense forest shade
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 2,
        name: 'Nadelwald'
    },
    clearing: {
        color: '#5a9a60',      // Bright forest clearing
        colorLight: '#6aaa70', // Sunlit clearing
        colorDark: '#4a8a50',  // Shaded clearing
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Lichtung'
    },
    heather: {
        color: '#8a6a8a',      // Purple heather moorland
        colorLight: '#9a7a9a', // Blooming heather
        colorDark: '#7a5a7a',  // Shaded heather
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Heide'
    },
    moss: {
        color: '#4a6a48',      // Soft forest moss
        colorLight: '#5a7a58', // Damp moss
        colorDark: '#3a5a38',  // Deep shade moss
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
        icon: '🧭',
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
        icon: '🪖',
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
        icon: '⛑️',
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
        icon: '🎯',
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
        name: 'Commando',
        icon: '⚔️',
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
