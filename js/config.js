// ===== GAME CONFIGURATION =====

export const CONFIG = {
    BASE_HEX_SIZE: 170,
    PLAYER_COLORS: ['#22c55e', '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'],
    PLAYER_NAMES: ['Grün', 'Rot', 'Blau', 'Gelb', 'Violett', 'Orange', 'Cyan', 'Pink'],
    UNITS_PER_PLAYER: 3,
    AP_PER_TURN: 4,
    MAX_ROUNDS: 30,
    VISION_RANGE: 6,  // Fog of War vision range (increased from 5)

    // Balance: Limit attacks per unit per turn to prevent one unit from dominating
    MAX_ATTACKS_PER_UNIT: 1,  // Each unit can attack max 1 time per turn

    // Map sizes (radius in hexes) - increased for up to 8 players
    MAP_SIZES: {
        small: 12,
        medium: 18,
        large: 24
    },

    // Spawn distance from center
    SPAWN_OFFSET: {
        small: 8,
        medium: 12,
        large: 18
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
        moveCost: 2,
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
        moveCost: 2,
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
        cover: false,
        canHide: false,
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
        cover: false,
        canHide: false,
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
        cover: false,
        canHide: false,
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
        cover: false,
        canHide: false,
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
        hp: 70,             // Erhöht von 60 - robuster Aufklärer
        damage: 22,         // Erhöht von 18 - besserer Schaden
        range: 4,
        move: 5,
        vision: 8,          // Beste Sicht im Spiel - Hauptrolle: Aufklärung
        special: 'Sprint',
        specialDesc: '+3 Bewegung',
        // Scout-Bonus: Findet versteckte Einheiten leichter
        stealthDetectionRange: 3
    },
    assault: {
        name: 'Assault',
        icon: '🪖',
        hp: 120,            // Erhöht von 100 - der Tank des Teams
        damage: 40,         // Erhöht von 35 - hoher Burst-Schaden
        range: 2,
        move: 3,
        vision: 5,
        special: 'Powershot',
        specialDesc: '+25 Schaden',  // Erhöht von +20
        // Assault-Bonus: Weniger Schadensreduktion durch Deckung
        armorPiercing: 0.5  // 50% der Deckungsreduktion ignorieren
    },
    medic: {
        name: 'Medic',
        icon: '⛑️',
        hp: 90,             // Erhöht von 80 - überlebensfähiger
        damage: 15,         // Erhöht von 12
        range: 3,           // Erhöht von 2 - kann aus sicherer Distanz helfen
        move: 4,
        vision: 6,
        special: 'Heilung',
        specialDesc: 'Heilt Team +40 HP', // Erhöht von +30
        healAmount: 40,     // Stärker heilen
        healRange: 4        // Erhöhte Heilreichweite
    },
    sniper: {
        name: 'Sniper',
        icon: '🎯',
        hp: 45,             // Leicht erhöht von 40 - etwas robuster
        damage: 65,         // STARK ERHÖHT von 45 - Sniper soll mit einem Schuss töten können!
        range: 6,
        move: 2,
        vision: 7,          // Reduziert von 8 - Scout ist jetzt bester Spotter
        special: 'Tarnung',
        specialDesc: 'Unsichtbar für 1 Runde',
        stealthDetectionRange: 2,
        // Sniper-Schwäche: Braucht Zeit zum Nachladen
        reloadPenalty: true // Kann nicht 2x in Folge angreifen (braucht Bewegung dazwischen)
    },
    commando: {
        name: 'Commando',
        icon: '⚔️',
        hp: 75,             // Erhöht von 65 - robuster im Nahkampf
        damage: 50,         // Erhöht von 40 - SEHR gefährlich im Nahkampf
        range: 1,           // Nahkampf
        move: 5,            // Erhöht von 4 - schneller anschleichen
        vision: 5,
        special: 'Schleichen',
        specialDesc: 'Tarnung + Bonus-Bewegung',
        stealthDetectionRange: 1,  // Schwer zu entdecken
        meleeBonus: 20,     // Erhöht von 15 - brutaler Nahkampf
        // Commando-Bonus: Erste Attacke nach Stealth macht Bonusschaden
        ambushBonus: 15     // Extra Schaden aus dem Hinterhalt
    }
};

// Biome/Landscape configurations for map generation
export const BIOMES = {
    temperate: {
        name: 'Temperate',
        nameDE: 'Gemäßigt',
        description: 'Balanced mix of forests, meadows, and hills',
        // Terrain type weights (higher = more common)
        weights: {
            grass: 1.0,
            forest: 0.8,
            hills: 0.6,
            rock: 0.4,
            water: 0.5,
            swamp: 0.3,
            sand: 0.2,
            flowers: 0.4,
            heather: 0.3,
            pine: 0.4,
            clearing: 0.3,
            ruins: 0.15
        },
        // Thresholds for noise-based generation
        elevationThresholds: { rock: 0.78, hills: 0.65, water: 0.25, swamp: 0.32 },
        moistureThresholds: { forest: 0.62, swamp: 0.55, sand: 0.28 },
        features: { rivers: 1, roads: true, paths: 2 }
    },
    desert: {
        name: 'Desert',
        nameDE: 'Wüste',
        description: 'Arid landscape with sand dunes and rocky outcrops',
        weights: {
            grass: 0.2,
            forest: 0.1,
            hills: 0.5,
            rock: 0.8,
            water: 0.1,
            swamp: 0.0,
            sand: 1.0,
            flowers: 0.05,
            heather: 0.1,
            pine: 0.0,
            clearing: 0.1,
            ruins: 0.25
        },
        elevationThresholds: { rock: 0.65, hills: 0.50, water: 0.10, swamp: 0.15 },
        moistureThresholds: { forest: 0.85, swamp: 0.90, sand: 0.55 },
        features: { rivers: 0, roads: true, paths: 1 }
    },
    tundra: {
        name: 'Tundra',
        nameDE: 'Tundra',
        description: 'Frozen landscape with snow, ice, and sparse vegetation',
        weights: {
            grass: 0.3,
            forest: 0.2,
            hills: 0.6,
            rock: 0.7,
            water: 0.3,
            swamp: 0.1,
            sand: 0.0,
            flowers: 0.1,
            heather: 0.2,
            pine: 0.6,
            clearing: 0.2,
            ruins: 0.15,
            snow: 1.0,
            ice: 0.5
        },
        elevationThresholds: { rock: 0.70, hills: 0.55, water: 0.20, swamp: 0.25 },
        moistureThresholds: { forest: 0.70, swamp: 0.75, sand: 0.15 },
        features: { rivers: 1, roads: false, paths: 1 },
        specialTerrain: { replaceWater: 'ice', addSnow: true }
    },
    tropical: {
        name: 'Tropical',
        nameDE: 'Tropisch',
        description: 'Dense jungles with rivers, swamps, and lush vegetation',
        weights: {
            grass: 0.5,
            forest: 1.0,
            hills: 0.3,
            rock: 0.2,
            water: 0.6,
            swamp: 0.7,
            sand: 0.3,
            flowers: 0.6,
            heather: 0.0,
            pine: 0.0,
            clearing: 0.4,
            ruins: 0.2,
            reeds: 0.5,
            tallgrass: 0.6
        },
        elevationThresholds: { rock: 0.85, hills: 0.72, water: 0.30, swamp: 0.38 },
        moistureThresholds: { forest: 0.45, swamp: 0.40, sand: 0.15 },
        features: { rivers: 2, roads: false, paths: 3 }
    },
    highland: {
        name: 'Highland',
        nameDE: 'Hochland',
        description: 'Mountainous terrain with rocks, cliffs, and sparse meadows',
        weights: {
            grass: 0.6,
            forest: 0.3,
            hills: 1.0,
            rock: 1.0,
            water: 0.2,
            swamp: 0.1,
            sand: 0.1,
            flowers: 0.2,
            heather: 0.7,
            pine: 0.4,
            clearing: 0.3,
            ruins: 0.3,
            cliff: 0.6,
            gravel: 0.5
        },
        elevationThresholds: { rock: 0.60, hills: 0.45, water: 0.15, swamp: 0.20 },
        moistureThresholds: { forest: 0.70, swamp: 0.80, sand: 0.35 },
        features: { rivers: 1, roads: true, paths: 1 }
    },
    wetland: {
        name: 'Wetland',
        nameDE: 'Feuchtgebiet',
        description: 'Marshlands with shallow water, reeds, and muddy terrain',
        weights: {
            grass: 0.5,
            forest: 0.4,
            hills: 0.2,
            rock: 0.1,
            water: 0.8,
            swamp: 1.0,
            sand: 0.1,
            flowers: 0.3,
            heather: 0.1,
            pine: 0.2,
            clearing: 0.3,
            ruins: 0.15,
            reeds: 0.8,
            shallows: 0.7,
            mud: 0.6,
            tallgrass: 0.5
        },
        elevationThresholds: { rock: 0.90, hills: 0.80, water: 0.35, swamp: 0.42 },
        moistureThresholds: { forest: 0.55, swamp: 0.35, sand: 0.10 },
        features: { rivers: 2, roads: false, paths: 2 }
    }
};
