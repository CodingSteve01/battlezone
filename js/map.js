/**
 * Map Generation and Rendering
 */

import { CONFIG, TILE_TYPES } from './config.js';
import { gameState } from './state.js';

export function toIso(x, y) {
    return {
        x: (x - y) * CONFIG.TILE_WIDTH / 2,
        y: (x + y) * CONFIG.TILE_HEIGHT / 2
    };
}

export function fromIso(screenX, screenY) {
    const x = (screenX / (CONFIG.TILE_WIDTH / 2) + screenY / (CONFIG.TILE_HEIGHT / 2)) / 2;
    const y = (screenY / (CONFIG.TILE_HEIGHT / 2) - screenX / (CONFIG.TILE_WIDTH / 2)) / 2;
    return { x: Math.floor(x), y: Math.floor(y) };
}

export function generateMap() {
    const size = gameState.settings.mapSize;
    gameState.map = [];

    // Base terrain with Perlin-like noise
    for (let y = 0; y < size; y++) {
        gameState.map[y] = [];
        for (let x = 0; x < size; x++) {
            const noise = Math.sin(x * 0.5) * Math.cos(y * 0.5) + Math.random() * 0.5;
            let type = 'GRASS';

            if (noise < -0.3) type = 'WATER';
            else if (noise < 0) type = 'SAND';
            else if (noise > 0.7) type = 'DIRT';
            else if (Math.random() < 0.1) type = 'STONE';

            gameState.map[y][x] = {
                type: type,
                ...TILE_TYPES[type],
                x, y,
                occupied: null,
                object: null
            };
        }
    }

    // Add structures
    addStructures(size);

    // Add buildings
    addBuildings(size);

    // Ensure spawn corners are walkable
    ensureSpawnPoints(size);
}

function addStructures(size) {
    const numStructures = Math.floor(size * 0.8);
    for (let i = 0; i < numStructures; i++) {
        const x = Math.floor(Math.random() * (size - 2)) + 1;
        const y = Math.floor(Math.random() * (size - 2)) + 1;

        if (gameState.map[y][x].walkable && !gameState.map[y][x].object) {
            const objects = ['CRATE', 'BUSH', 'TREE', 'ROCK'];
            const obj = objects[Math.floor(Math.random() * objects.length)];
            gameState.map[y][x].object = obj;
            gameState.map[y][x].walkable = TILE_TYPES[obj].walkable;
            gameState.map[y][x].cover = TILE_TYPES[obj].cover;
            gameState.map[y][x].height = TILE_TYPES[obj].height;
        }
    }
}

function addBuildings(size) {
    const numBuildings = Math.floor(size * 0.3);
    for (let b = 0; b < numBuildings; b++) {
        const bx = Math.floor(Math.random() * (size - 4)) + 1;
        const by = Math.floor(Math.random() * (size - 4)) + 1;
        const bw = Math.floor(Math.random() * 2) + 2;
        const bh = Math.floor(Math.random() * 2) + 2;

        for (let y = by; y < by + bh && y < size; y++) {
            for (let x = bx; x < bx + bw && x < size; x++) {
                if ((y === by || y === by + bh - 1 || x === bx || x === bx + bw - 1)) {
                    if (!gameState.map[y][x].object) {
                        gameState.map[y][x].object = 'WALL';
                        gameState.map[y][x].walkable = false;
                        gameState.map[y][x].cover = true;
                        gameState.map[y][x].height = 2;
                    }
                }
            }
        }
    }
}

function ensureSpawnPoints(size) {
    const corners = [[1, 1], [size - 2, 1], [1, size - 2], [size - 2, size - 2]];
    corners.forEach(([x, y]) => {
        gameState.map[y][x] = {
            type: 'GRASS',
            ...TILE_TYPES['GRASS'],
            x, y,
            occupied: null,
            object: null
        };
    });
}

export function hasLineOfSight(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;

    while (true) {
        if (x === x2 && y === y2) return true;

        if (!(x === x1 && y === y1) && !(x === x2 && y === y2)) {
            const tile = gameState.getTile(x, y);
            if (tile && tile.height >= 2 && !tile.walkable) return false;
        }

        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
    }
}

export function isInCover(target, attacker) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const attackDir = {
        x: Math.sign(attacker.x - target.x),
        y: Math.sign(attacker.y - target.y)
    };

    for (const [dx, dy] of dirs) {
        if ((dx === attackDir.x || dy === attackDir.y)) {
            const checkX = target.x + dx;
            const checkY = target.y + dy;
            const tile = gameState.getTile(checkX, checkY);
            if (tile && tile.cover && tile.height > 0) {
                return true;
            }
        }
    }
    return false;
}

export function getAttackAngle(attacker, target) {
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const facing = target.facing || 'se';

    if ((facing === 'se' && dx < 0 && dy < 0) ||
        (facing === 'sw' && dx > 0 && dy < 0) ||
        (facing === 'ne' && dx < 0 && dy > 0) ||
        (facing === 'nw' && dx > 0 && dy > 0)) {
        return 'back';
    }

    if (Math.abs(dx) > Math.abs(dy) * 1.5 || Math.abs(dy) > Math.abs(dx) * 1.5) {
        return 'flank';
    }

    return 'front';
}
