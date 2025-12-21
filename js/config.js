/**
 * Game Configuration
 * All constants and settings for Shadow Tactics
 */

export const CONFIG = {
    // Rendering
    TILE_WIDTH: 64,
    TILE_HEIGHT: 32,

    // Gameplay
    AP_PER_TURN: 4,
    AP_TACTICAL: 6,
    MAX_HEALTH: 100,
    MAX_AMMO: 8,
    MAX_GRENADES: 2,

    // Combat
    BASE_DAMAGE: 30,
    GRENADE_DAMAGE: 50,
    GRENADE_RADIUS: 1.5,
    VISION_RANGE: 6,

    // Tactical modifiers
    COVER_REDUCTION: 0.5,
    FLANK_BONUS: 1.25,
    BACK_BONUS: 1.5,
    HEIGHT_ACCURACY: 0.15,
    BASE_HIT_CHANCE: 0.75,
    OVERWATCH_HIT_CHANCE: 0.6,
    SNEAK_HIT_PENALTY: 0.2,

    // Game rules
    MAX_ROUNDS: 15,

    // Player colors
    PLAYER_COLORS: ['#00ff88', '#ff4444', '#4488ff', '#ffaa00']
};

export const TILE_TYPES = {
    GRASS: { walkable: true, cover: false, height: 0, color: 0x3d6b3d },
    DIRT: { walkable: true, cover: false, height: 0, color: 0x6b5a3d },
    STONE: { walkable: true, cover: false, height: 0, color: 0x5a5a5a },
    WATER: { walkable: false, cover: false, height: -1, color: 0x3d5a8a },
    WALL: { walkable: false, cover: true, height: 2, color: 0x4a4a5a },
    CRATE: { walkable: false, cover: true, height: 1, color: 0x8b6914 },
    BUSH: { walkable: true, cover: true, height: 0, color: 0x2d5a2d },
    TREE: { walkable: false, cover: true, height: 2, color: 0x1a4a1a },
    ROCK: { walkable: false, cover: true, height: 1, color: 0x6a6a6a },
    SAND: { walkable: true, cover: false, height: 0, color: 0xc4a35a }
};

export const ACTION_COSTS = {
    move: 1,
    shoot: 1,
    grenade: 2,
    overwatch: 2,
    reload: 1,
    sneak: 0
};
