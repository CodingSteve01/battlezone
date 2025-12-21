/**
 * Game State Management
 * Central state store for the game
 */

import { CONFIG } from './config.js';

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.app = null;
        this.containers = {};
        this.settings = {
            players: 2,
            mapSize: 10,
            mode: 'deathmatch'
        };
        this.map = [];
        this.players = [];
        this.currentPlayer = 0;
        this.round = 1;
        this.selectedAction = 'move';
        this.selectedTile = null;
        this.gameOver = false;
        this.overwatchers = [];
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayer];
    }

    getAlivePlayersCount() {
        return this.players.filter(p => p.alive).length;
    }

    getAlivePlayers() {
        return this.players.filter(p => p.alive);
    }

    getTile(x, y) {
        if (y < 0 || y >= this.map.length) return null;
        if (x < 0 || x >= this.map[0].length) return null;
        return this.map[y][x];
    }

    getMaxAp() {
        return this.settings.mode === 'tactical' ? CONFIG.AP_TACTICAL : CONFIG.AP_PER_TURN;
    }
}

// Singleton instance
export const gameState = new GameState();
