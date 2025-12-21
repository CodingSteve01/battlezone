/**
 * Rendering System
 */

import { CONFIG, TILE_TYPES } from './config.js';
import { gameState } from './state.js';
import { toIso } from './map.js';
import { handleTileClick } from './input.js';

export function renderMap() {
    gameState.containers.tiles.removeChildren();
    gameState.containers.objects.removeChildren();

    const size = gameState.settings.mapSize;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const tile = gameState.map[y][x];
            const pos = toIso(x, y);

            // Draw tile
            const tileGfx = new PIXI.Graphics();
            tileGfx.beginFill(tile.color);
            tileGfx.moveTo(0, 0);
            tileGfx.lineTo(CONFIG.TILE_WIDTH / 2, CONFIG.TILE_HEIGHT / 2);
            tileGfx.lineTo(0, CONFIG.TILE_HEIGHT);
            tileGfx.lineTo(-CONFIG.TILE_WIDTH / 2, CONFIG.TILE_HEIGHT / 2);
            tileGfx.closePath();
            tileGfx.endFill();

            // Subtle grid lines
            tileGfx.lineStyle(1, 0x000000, 0.15);
            tileGfx.moveTo(0, 0);
            tileGfx.lineTo(CONFIG.TILE_WIDTH / 2, CONFIG.TILE_HEIGHT / 2);
            tileGfx.lineTo(0, CONFIG.TILE_HEIGHT);
            tileGfx.lineTo(-CONFIG.TILE_WIDTH / 2, CONFIG.TILE_HEIGHT / 2);
            tileGfx.closePath();

            tileGfx.x = pos.x;
            tileGfx.y = pos.y;
            tileGfx.tileX = x;
            tileGfx.tileY = y;
            tileGfx.eventMode = 'static';
            tileGfx.cursor = 'pointer';
            tileGfx.on('pointerdown', () => handleTileClick(x, y));

            gameState.containers.tiles.addChild(tileGfx);

            // Draw objects
            if (tile.object) {
                const objGfx = createObjectGraphic(tile.object, pos);
                gameState.containers.objects.addChild(objGfx);
            }
        }
    }

    gameState.containers.objects.sortChildren();
}

function createObjectGraphic(type, pos) {
    const gfx = new PIXI.Graphics();

    switch (type) {
        case 'CRATE':
            gfx.beginFill(0x8b6914);
            gfx.drawRect(-15, -25, 30, 25);
            gfx.endFill();
            gfx.beginFill(0x9a7518);
            gfx.moveTo(-15, -25);
            gfx.lineTo(0, -35);
            gfx.lineTo(15, -25);
            gfx.lineTo(-15, -25);
            gfx.endFill();
            gfx.beginFill(0x6b5010);
            gfx.moveTo(15, -25);
            gfx.lineTo(15, 0);
            gfx.lineTo(0, -10);
            gfx.lineTo(0, -35);
            gfx.closePath();
            gfx.endFill();
            break;

        case 'BUSH':
            gfx.beginFill(0x2d5a2d);
            gfx.drawEllipse(0, -10, 20, 15);
            gfx.endFill();
            gfx.beginFill(0x3d7a3d);
            gfx.drawEllipse(-8, -15, 12, 10);
            gfx.drawEllipse(8, -12, 10, 8);
            gfx.endFill();
            break;

        case 'TREE':
            gfx.beginFill(0x5a3a1a);
            gfx.drawRect(-5, -15, 10, 20);
            gfx.endFill();
            gfx.beginFill(0x1a5a1a);
            gfx.drawEllipse(0, -35, 22, 25);
            gfx.endFill();
            gfx.beginFill(0x2a6a2a);
            gfx.drawEllipse(-5, -45, 15, 18);
            gfx.drawEllipse(8, -40, 12, 15);
            gfx.endFill();
            break;

        case 'ROCK':
            gfx.beginFill(0x5a5a5a);
            gfx.moveTo(-18, 0);
            gfx.lineTo(-15, -20);
            gfx.lineTo(5, -25);
            gfx.lineTo(18, -15);
            gfx.lineTo(15, 0);
            gfx.closePath();
            gfx.endFill();
            gfx.beginFill(0x7a7a7a);
            gfx.moveTo(-15, -20);
            gfx.lineTo(5, -25);
            gfx.lineTo(3, -18);
            gfx.lineTo(-12, -15);
            gfx.closePath();
            gfx.endFill();
            break;

        case 'WALL':
            gfx.beginFill(0x4a4a5a);
            gfx.drawRect(-CONFIG.TILE_WIDTH / 2 + 5, -40, CONFIG.TILE_WIDTH - 10, 40);
            gfx.endFill();
            gfx.beginFill(0x5a5a6a);
            gfx.moveTo(-CONFIG.TILE_WIDTH / 2 + 5, -40);
            gfx.lineTo(0, -50);
            gfx.lineTo(CONFIG.TILE_WIDTH / 2 - 5, -40);
            gfx.closePath();
            gfx.endFill();
            gfx.beginFill(0x2a3a4a);
            gfx.drawRect(-8, -30, 16, 12);
            gfx.endFill();
            break;
    }

    gfx.x = pos.x;
    gfx.y = pos.y + CONFIG.TILE_HEIGHT / 2;
    gfx.zIndex = pos.y + 1000;

    return gfx;
}

export function renderPlayers() {
    gameState.containers.entities.removeChildren();

    gameState.players.forEach(player => {
        if (!player.alive) return;

        const pos = toIso(player.x, player.y);
        const container = new PIXI.Container();

        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.3);
        shadow.drawEllipse(0, 5, 12, 6);
        shadow.endFill();
        container.addChild(shadow);

        // Body
        const body = new PIXI.Graphics();
        const color = parseInt(player.color.replace('#', ''), 16);

        // Torso
        body.beginFill(color);
        body.drawEllipse(0, -15, 10, 12);
        body.endFill();

        // Head
        body.beginFill(0xddb892);
        body.drawCircle(0, -32, 8);
        body.endFill();

        // Helmet/Hair
        body.beginFill(color);
        body.drawEllipse(0, -36, 9, 5);
        body.endFill();

        if (player.sneaking) {
            body.alpha = 0.7;
            body.y = 8;
        }

        container.addChild(body);

        // Player number
        const numText = new PIXI.Text(String(player.id + 1), {
            fontFamily: 'Orbitron',
            fontSize: 10,
            fill: 0xffffff,
            fontWeight: 'bold'
        });
        numText.anchor.set(0.5);
        numText.y = -32;
        container.addChild(numText);

        // Overwatch indicator
        if (player.overwatch) {
            const eye = new PIXI.Graphics();
            eye.beginFill(0xffff00);
            eye.drawEllipse(0, -50, 8, 4);
            eye.endFill();
            eye.beginFill(0x000000);
            eye.drawCircle(0, -50, 2);
            eye.endFill();
            container.addChild(eye);
        }

        // Health bar (small, above head)
        if (player.health < CONFIG.MAX_HEALTH) {
            const hpBg = new PIXI.Graphics();
            hpBg.beginFill(0x333333);
            hpBg.drawRect(-15, -48, 30, 4);
            hpBg.endFill();
            container.addChild(hpBg);

            const hpBar = new PIXI.Graphics();
            const hpWidth = (player.health / CONFIG.MAX_HEALTH) * 30;
            const hpColor = player.health > 50 ? 0x00ff88 : (player.health > 25 ? 0xffaa00 : 0xff4444);
            hpBar.beginFill(hpColor);
            hpBar.drawRect(-15, -48, hpWidth, 4);
            hpBar.endFill();
            container.addChild(hpBar);
        }

        container.x = pos.x;
        container.y = pos.y + CONFIG.TILE_HEIGHT / 2;
        container.zIndex = pos.y + 2000;

        player.sprite = container;
        gameState.containers.entities.addChild(container);
    });

    gameState.containers.entities.sortChildren();
}
