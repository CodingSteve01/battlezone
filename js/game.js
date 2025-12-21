/**
 * Core Game Logic
 */

import { gameState } from './state.js';
import { generateMap } from './map.js';
import { createPlayers } from './player.js';
import { renderMap, renderPlayers } from './renderer.js';
import { startTurn } from './turns.js';

export async function initPixi() {
    gameState.app = new PIXI.Application({
        resizeTo: document.getElementById('game-container'),
        backgroundColor: 0x1a1a25,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
    });

    document.getElementById('game-container').appendChild(gameState.app.view);

    // Create containers
    gameState.containers.world = new PIXI.Container();
    gameState.containers.tiles = new PIXI.Container();
    gameState.containers.objects = new PIXI.Container();
    gameState.containers.entities = new PIXI.Container();
    gameState.containers.effects = new PIXI.Container();
    gameState.containers.ui = new PIXI.Container();

    gameState.containers.world.addChild(gameState.containers.tiles);
    gameState.containers.world.addChild(gameState.containers.objects);
    gameState.containers.world.addChild(gameState.containers.entities);
    gameState.containers.world.addChild(gameState.containers.effects);

    gameState.app.stage.addChild(gameState.containers.world);
    gameState.app.stage.addChild(gameState.containers.ui);

    // Center world
    gameState.containers.world.x = gameState.app.screen.width / 2;
    gameState.containers.world.y = 100;

    // Make interactive
    gameState.app.stage.eventMode = 'static';
    gameState.app.stage.hitArea = gameState.app.screen;

    // Handle resize
    window.addEventListener('resize', () => {
        gameState.containers.world.x = gameState.app.screen.width / 2;
    });

    document.getElementById('loading').style.display = 'none';
}

export function startGame() {
    // Reset game state (preserve app and containers)
    const app = gameState.app;
    const containers = gameState.containers;
    const settings = gameState.settings;

    gameState.reset();

    gameState.app = app;
    gameState.containers = containers;
    gameState.settings = settings;

    // Initialize game
    generateMap();
    renderMap();
    createPlayers();
    startTurn();
}
