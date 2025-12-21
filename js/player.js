/**
 * Player System
 */

import { CONFIG } from './config.js';
import { gameState } from './state.js';

export function createPlayers() {
    gameState.players = [];
    const size = gameState.settings.mapSize;
    const spawns = [
        { x: 1, y: 1 },
        { x: size - 2, y: size - 2 },
        { x: 1, y: size - 2 },
        { x: size - 2, y: 1 }
    ];

    for (let i = 0; i < gameState.settings.players; i++) {
        const spawn = spawns[i];
        const player = {
            id: i,
            x: spawn.x,
            y: spawn.y,
            health: CONFIG.MAX_HEALTH,
            ammo: CONFIG.MAX_AMMO,
            grenades: CONFIG.MAX_GRENADES,
            ap: gameState.getMaxAp(),
            maxAp: gameState.getMaxAp(),
            alive: true,
            sneaking: false,
            overwatch: false,
            facing: 'se',
            color: CONFIG.PLAYER_COLORS[i],
            kills: 0,
            sprite: null
        };

        gameState.map[spawn.y][spawn.x].occupied = player;
        gameState.players.push(player);
    }
}

export function updateFacing(player, toX, toY) {
    const dx = toX - player.x;
    const dy = toY - player.y;

    if (dx > 0 && dy >= 0) player.facing = 'se';
    else if (dx <= 0 && dy > 0) player.facing = 'sw';
    else if (dx < 0 && dy <= 0) player.facing = 'nw';
    else player.facing = 'ne';
}

export function resetPlayerTurn(player) {
    player.ap = player.maxAp;
    player.overwatch = false;
}

export function damagePlayer(player, damage) {
    player.health -= Math.floor(damage);
    if (player.health <= 0) {
        player.alive = false;
        player.health = 0;
        gameState.map[player.y][player.x].occupied = null;
        return true; // Player died
    }
    return false;
}
