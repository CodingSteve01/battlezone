// ===== GAME CONFIGURATION =====

export const CONFIG = {
    BASE_HEX_SIZE: 100,
    HEX_SIZE_SCALE: 0.8,
    TILE_SCALE: 0.5,              // Tile size multiplier (hexes only)
    UNIT_SCALE: 0.6,              // Unit size relative to tile size for better proportions
    PLAYER_COLORS: ['#22c55e', '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'],
    PLAYER_NAMES: ['Grün', 'Rot', 'Blau', 'Gelb', 'Violett', 'Orange', 'Cyan', 'Pink'],
    
    // Renderer configuration - Canvas 2D only
    RENDERER: {
        TYPE: 'canvas2d'
    },

    // Team Budget System - players spend points to build their team
    TEAM_BUDGET: 400,         // Total points available for team composition (erhöht für mehr Möglichkeiten)
    MIN_UNITS: 2,             // Minimum units required
    MAX_UNITS: 5,             // Maximum units allowed
    UNITS_PER_PLAYER: 3,      // Default/base units per player (for AP pool calculations)

    AP_PER_TURN: 4,
    MAX_ROUNDS: 30,
    VISION_RANGE: 6,  // Fog of War vision range (increased from 5)
    HEIGHT: {
        MAX: 3,
        VISION_BONUS_PER_LEVEL: 1,
        DEFENSE_BONUS_PER_LEVEL: 5,
        CLIMB_COST_PER_LEVEL: 1
    },

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
    },

    // Subtle post-processing to unify asset palette and mood
    COLOR_GRADING: {
        ENABLED: true,
        WARM_TINT: '#f5d6a0',
        WARM_INTENSITY: 0.08,
        COOL_SHADOW: '#5b6f8a',
        COOL_INTENSITY: 0.06,
        SATURATION_BOOST: 0.06,
        VIGNETTE_STRENGTH: 0.35,
        VIGNETTE_SOFTNESS: 0.75
    },

    LIGHTING: {
        DIRECTION: { x: -0.6, y: -1.0 },
        HEIGHT: 1.2,
        SHADOW_STRENGTH: 0.25,
        HIGHLIGHT_STRENGTH: 0.18
    },

    VISIBILITY_CLEARING: {
        ENABLED: true,
        CLEAR_RADIUS: 0,
        FADE_RADIUS: 1,
        TREE_KEEP_CHANCE: 0.25,
        SHRUB_KEEP_CHANCE: 0.55,
        CLEAR_ALPHA: 0.35,
        FADE_ALPHA: 0.65
    }
};

// Natural color palette - inspired by high-quality isometric terrain tiles
// Colors matched to reference image with lush greens, warm earth tones
export const TERRAIN = {
    grass: {
        color: '#5a9848',      // Lush vibrant grass green
        colorLight: '#72b058', // Sun-lit grass
        colorDark: '#3a7830',  // Shaded grass
        earthColor: '#8a6840', // Brown earth visible on cliff edges
        earthDark: '#5a4830',  // Darker earth shadow
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
        name: 'Gras'
    },
    forest: {
        color: '#3a5a3a',      // Rich dark forest green
        colorLight: '#4a6a48', // Dappled light
        colorDark: '#2a4028',  // Deep forest shadow
        earthColor: '#604830', // Forest floor earth
        earthDark: '#402820',  // Dark humus
        walkable: true,
        cover: true,
        canHide: true,
        moveCost: 1,
        name: 'Wald'
    },
    hills: {
        color: '#6a8a50',      // Grassy hill with rocky patches
        colorLight: '#7a9a60', // Sunlit hillside
        colorDark: '#4a6a38',  // Hill shadow
        earthColor: '#7a6a50', // Rocky earth
        earthDark: '#5a4a38',  // Stone shadow
        walkable: true,
        cover: false,
        moveCost: 1,
        name: 'Hügel',
        rangeBonus: 1,
        defenseBonus: 10
    },
    rock: {
        color: '#5a8a48',      // Rocky grassland - grass base with stones
        colorLight: '#6a9a58', // Sunlit grass
        colorDark: '#4a7a38',  // Shaded grass
        earthColor: '#5a5550', // Stone base
        earthDark: '#3a3530',  // Dark crevice
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Felsen'
    },
    water: {
        color: '#3a8ab0',      // Clear blue water
        colorLight: '#5aaad0', // Sunlit surface
        colorDark: '#2a6a90',  // Deep water
        bottomColor: '#c0a878', // Sandy/rocky bottom visible
        earthColor: '#8a7a60', // Bank earth
        earthDark: '#5a4a40',  // Wet earth
        walkable: false,
        cover: false,
        moveCost: Infinity,
        name: 'Wasser'
    },
    sand: {
        color: '#c4a870',      // Warm golden sand
        colorLight: '#d8bc88', // Bright sand
        colorDark: '#a89058',  // Shadowed sand
        earthColor: '#9a8060', // Sandy earth
        earthDark: '#7a6040',  // Darker sand
        walkable: true,
        cover: false,
        moveCost: 1,
        name: 'Sand'
    },
    swamp: {
        color: '#4a5a38',      // Murky swamp green
        colorLight: '#5a6a48', // Surface algae
        colorDark: '#3a4a28',  // Deep murk
        earthColor: '#504838', // Muddy earth
        earthDark: '#383028',  // Dark mud
        walkable: true,
        cover: false,
        moveCost: 1,
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
        moveCost: 0.5,
        name: 'Pfad'
    },
    river: {
        color: '#4a7c9a',      // Natural river blue-green
        colorLight: '#5a8caa', // Sunlit ripples
        colorDark: '#3a6c8a',  // Deep river
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 1,
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
        moveCost: 1,
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
        moveCost: 1,
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
        moveCost: 1,
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
        moveCost: 1,
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
        moveCost: 1,
        name: 'Ruinen'
    },
    bridge: {
        color: '#8a7060',      // Wooden bridge planks
        colorLight: '#9a8070', // Weathered wood
        colorDark: '#7a6050',  // Shadowed planks
        walkable: true,
        cover: false,
        canHide: false,
        moveCost: 0.5,
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
        moveCost: 1,
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
        name: 'Späher',
        icon: '🧭',
        cost: 70,           // Günstig - Aufklärer und Unterstützung
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
        name: 'Sturmsoldat',
        icon: '🪖',
        cost: 100,          // Mittel - solider Frontkämpfer
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
        name: 'Sanitäter',
        icon: '⛑️',
        cost: 80,           // Günstig - wichtige Unterstützung
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
        name: 'Scharfschütze',
        icon: '🎯',
        cost: 110,          // Mittel-hoch - hoher Schaden aber fragil
        hp: 45,             // Leicht erhöht von 40 - etwas robuster
        damage: 65,         // STARK ERHÖHT von 45 - Scharfschütze soll mit einem Schuss töten können!
        range: 6,
        move: 2,
        vision: 7,          // Reduziert von 8 - Späher ist jetzt bester Spotter
        special: 'Tarnung',
        specialDesc: 'Unsichtbar für 1 Runde',
        stealthDetectionRange: 2,
        // Scharfschütze-Schwäche: Braucht Zeit zum Nachladen
        reloadPenalty: true // Kann nicht 2x in Folge angreifen (braucht Bewegung dazwischen)
    },
    commando: {
        name: 'Kommando',
        icon: '⚔️',
        cost: 90,           // Mittel - schneller Nahkämpfer
        hp: 75,             // Erhöht von 65 - robuster im Nahkampf
        damage: 50,         // Erhöht von 40 - SEHR gefährlich im Nahkampf
        range: 1,           // Nahkampf
        move: 5,            // Erhöht von 4 - schneller anschleichen
        vision: 5,
        special: 'Schleichen',
        specialDesc: 'Tarnung + Bonus-Bewegung',
        stealthDetectionRange: 1,  // Schwer zu entdecken
        meleeBonus: 20,     // Erhöht von 15 - brutaler Nahkampf
        // Kommando-Bonus: Erste Attacke nach Stealth macht Bonusschaden
        ambushBonus: 15     // Extra Schaden aus dem Hinterhalt
    },
    elitesoldat: {
        name: 'Elitesoldat',
        icon: '🎖️',
        cost: 150,          // TEUER - Elite-Einheit mit Vielseitigkeit
        hp: 100,            // Robust - kann einiges einstecken
        damage: 40,         // Solider Fernkampfschaden
        range: 3,           // Kann auf Distanz kämpfen
        move: 3,
        vision: 5,
        special: 'Taktischer Wechsel',
        specialDesc: 'Wechselt zwischen Nah- und Fernkampfmodus',
        // Dual-Attack-System: Kann sowohl Nahkampf als auch Fernkampf
        meleeBonus: 30,     // +30 Schaden im Nahkampf (Gesamt: 70 bei Range 1)
        meleeDamage: 55,    // Alternativer Basis-Schaden im Nahkampf-Modus
        canMelee: true,     // Kann Nahkampf-Angriffe ausführen
        canRanged: true,    // Kann Fernkampf-Angriffe ausführen
        // Taktischer Bonus: Kein Bewegungsmalus nach Angriff
        tacticalAdvantage: true,
        armorPiercing: 0.3  // 30% Deckung ignorieren
    }
};

/**
 * Unit Variants - Spezialisierungen für jede Einheitsklasse
 * Jede Variante modifiziert die Basiswerte und kostet unterschiedlich viel
 * Badge-Symbole: ★ (Veteran), ✦ (Elite), ☆ (Spezial)
 */
export const UNIT_VARIANTS = {
    scout: {
        standard: {
            name: 'Späher',
            badge: null,
            costMod: 0,
            statMods: {}
        },
        pathfinder: {
            name: 'Pfadfinder',
            badge: '★',
            badgeColor: '#22c55e',
            costMod: 20,  // 70 + 20 = 90
            statMods: {
                vision: 2,      // 8 → 10 (beste Sicht!)
                move: 1         // 5 → 6
            },
            bonusDesc: '+2 Sicht, +1 Bewegung'
        },
        saboteur: {
            name: 'Saboteur',
            badge: '✦',
            badgeColor: '#ef4444',
            costMod: 30,  // 70 + 30 = 100
            statMods: {
                damage: 8,      // 22 → 30
                stealthDetectionRange: 2  // 3 → 5
            },
            bonusAbility: 'Aufdecken',  // Kann getarnte Feinde sichtbar machen
            bonusDesc: '+8 Schaden, +2 Aufspüren'
        }
    },
    assault: {
        standard: {
            name: 'Sturmsoldat',
            badge: null,
            costMod: 0,
            statMods: {}
        },
        heavy: {
            name: 'Schwerer Sturm',
            badge: '★',
            badgeColor: '#3b82f6',
            costMod: 25,  // 100 + 25 = 125
            statMods: {
                hp: 30,         // 120 → 150
                damage: 5       // 40 → 45
            },
            bonusDesc: '+30 HP, +5 Schaden'
        },
        breacher: {
            name: 'Brecher',
            badge: '✦',
            badgeColor: '#f59e0b',
            costMod: 35,  // 100 + 35 = 135
            statMods: {
                damage: 10,     // 40 → 50
                armorPiercing: 0.3  // 0.5 → 0.8 (ignoriert 80% Deckung!)
            },
            bonusDesc: '+10 Schaden, 80% Deckung ignorieren'
        }
    },
    medic: {
        standard: {
            name: 'Sanitäter',
            badge: null,
            costMod: 0,
            statMods: {}
        },
        fieldSurgeon: {
            name: 'Feldarzt',
            badge: '★',
            badgeColor: '#22c55e',
            costMod: 25,  // 80 + 25 = 105
            statMods: {
                healAmount: 20,   // 40 → 60
                healRange: 2      // 4 → 6
            },
            bonusDesc: '+20 Heilung, +2 Reichweite'
        },
        combatMedic: {
            name: 'Kampfsanitäter',
            badge: '✦',
            badgeColor: '#ef4444',
            costMod: 30,  // 80 + 30 = 110
            statMods: {
                hp: 20,         // 90 → 110
                damage: 10,     // 15 → 25
                range: 1        // 3 → 4
            },
            bonusDesc: '+20 HP, +10 Schaden, +1 Reichweite'
        }
    },
    sniper: {
        standard: {
            name: 'Scharfschütze',
            badge: null,
            costMod: 0,
            statMods: {}
        },
        marksman: {
            name: 'Präzisionsschütze',
            badge: '★',
            badgeColor: '#8b5cf6',
            costMod: 25,  // 110 + 25 = 135
            statMods: {
                damage: 15,     // 65 → 80 (One-shot kill potential!)
                range: 1        // 6 → 7
            },
            bonusDesc: '+15 Schaden, +1 Reichweite'
        },
        ghost: {
            name: 'Phantom',
            badge: '✦',
            badgeColor: '#1e293b',
            costMod: 35,  // 110 + 35 = 145
            statMods: {
                hp: 10,         // 45 → 55
                move: 1,        // 2 → 3
                stealthDetectionRange: -1  // Noch schwerer zu entdecken
            },
            bonusAbility: 'Doppeltarnung',  // Tarnung hält 2 Runden
            bonusDesc: '+10 HP, +1 Bewegung, verbesserte Tarnung'
        }
    },
    commando: {
        standard: {
            name: 'Kommando',
            badge: null,
            costMod: 0,
            statMods: {}
        },
        assassin: {
            name: 'Assassine',
            badge: '★',
            badgeColor: '#dc2626',
            costMod: 25,  // 90 + 25 = 115
            statMods: {
                damage: 10,     // 50 → 60
                meleeBonus: 10, // 20 → 30
                ambushBonus: 10 // 15 → 25
            },
            bonusDesc: '+10 Schaden, +10 Nahkampf, +10 Hinterhalt'
        },
        infiltrator: {
            name: 'Infiltrator',
            badge: '✦',
            badgeColor: '#6366f1',
            costMod: 30,  // 90 + 30 = 120
            statMods: {
                hp: 15,         // 75 → 90
                move: 1,        // 5 → 6
                vision: 2       // 5 → 7
            },
            bonusAbility: 'Schnelltarnung',  // Tarnung kostet nur 1 AP
            bonusDesc: '+15 HP, +1 Bewegung, +2 Sicht'
        }
    },
    elitesoldat: {
        standard: {
            name: 'Elitesoldat',
            badge: null,
            costMod: 0,
            statMods: {}
        },
        commander: {
            name: 'Kommandant',
            badge: '★',
            badgeColor: '#eab308',
            costMod: 30,  // 150 + 30 = 180
            statMods: {
                hp: 20,         // 100 → 120
                damage: 5,      // 40 → 45
                vision: 2       // 5 → 7
            },
            bonusAbility: 'Führung',  // Verbündete in Reichweite 2 kriegen +10% Trefferchance
            bonusDesc: '+20 HP, +5 Schaden, +2 Sicht, Team-Buff'
        },
        juggernaut: {
            name: 'Juggernaut',
            badge: '✦',
            badgeColor: '#b91c1c',
            costMod: 40,  // 150 + 40 = 190
            statMods: {
                hp: 50,         // 100 → 150
                damage: 10,     // 40 → 50
                meleeDamage: 15,// 55 → 70
                move: -1        // 3 → 2 (langsamer aber stärker)
            },
            bonusDesc: '+50 HP, +10 Schaden, -1 Bewegung'
        }
    }
};

/**
 * Helper: Get full unit stats with variant modifiers applied
 */
export function getUnitWithVariant(classKey, variantKey = 'standard') {
    const baseClass = UNIT_CLASSES[classKey];
    if (!baseClass) return null;

    const variants = UNIT_VARIANTS[classKey];
    if (!variants) return { ...baseClass, variant: 'standard', variantData: null };

    const variant = variants[variantKey] || variants.standard;

    // Apply stat modifiers
    const modifiedUnit = { ...baseClass };
    modifiedUnit.cost = baseClass.cost + (variant.costMod || 0);
    modifiedUnit.variant = variantKey;
    modifiedUnit.variantData = variant;

    // Apply stat mods
    if (variant.statMods) {
        for (const [stat, mod] of Object.entries(variant.statMods)) {
            if (typeof modifiedUnit[stat] === 'number') {
                modifiedUnit[stat] = modifiedUnit[stat] + mod;
            } else {
                modifiedUnit[stat] = mod;
            }
        }
    }

    // Override name if variant has one
    if (variant.name) {
        modifiedUnit.name = variant.name;
    }

    return modifiedUnit;
}

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
