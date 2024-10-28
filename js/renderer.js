// renderer.js
import { Human, Vehicle, distance, isInSight } from './entities.js';

export class Renderer {
  constructor(game) {
    this.game = game;
    this.setupCanvases();
    this.setupEffects();
  }

  setupCanvases() {
    // Main game canvases
    this.canvas1 = document.getElementById('canvas1');
    this.canvas2 = document.getElementById('canvas2');
    this.ctx1 = this.canvas1.getContext('2d');
    this.ctx2 = this.canvas2.getContext('2d');
    
    // Set canvas sizes
    this.updateCanvasSizes();
    window.addEventListener('resize', () => this.updateCanvasSizes());

    // Minimap canvases
    this.minimap1 = document.getElementById('minimap1');
    this.minimap2 = document.getElementById('minimap2');
    this.minimapCtx1 = this.minimap1.getContext('2d');
    this.minimapCtx2 = this.minimap2.getContext('2d');
    this.minimap1.width = this.minimap2.width = 150;
    this.minimap1.height = this.minimap2.height = 150;
  }

  updateCanvasSizes() {
    const containerWidth = document.querySelector('.game-container').clientWidth;
    const isSinglePlayer = this.game.mode === 'SinglePlayer';
    
    this.canvas1.width = isSinglePlayer ? containerWidth : containerWidth / 2;
    this.canvas1.height = window.innerHeight;
    
    if (!isSinglePlayer) {
      this.canvas2.width = containerWidth / 2;
      this.canvas2.height = window.innerHeight;
    }
  }

  setupEffects() {
    this.effects = {
      waterRipples: [],
      smokeParticles: [],
      explosionParticles: []
    };

    // Water effect parameters
    this.waterEffectParams = {
      amplitude: 5,
      frequency: 0.02,
      speed: 0.05
    };
  }

  draw() {
    // Clear canvases
    this.ctx1.clearRect(0, 0, this.canvas1.width, this.canvas1.height);
    if (this.game.mode !== 'SinglePlayer') {
      this.ctx2.clearRect(0, 0, this.canvas2.width, this.canvas2.height);
    }

    // Draw for each player's view
    this.drawPlayerView(this.ctx1, this.game.players[0], 0);
    if (this.game.mode !== 'SinglePlayer') {
      this.drawPlayerView(this.ctx2, this.game.players[1], 1);
    }

    // Draw minimaps
    this.drawMinimap(this.minimapCtx1, this.game.players[0]);
    if (this.game.mode !== 'SinglePlayer') {
      this.drawMinimap(this.minimapCtx2, this.game.players[1]);
    }
  }

  drawPlayerView(ctx, player, playerIndex) {
    ctx.save();
    
    // Center the camera on player
    const cameraX = this.canvas1.width / 2 - player.x;
    const cameraY = this.canvas1.height / 2 - player.y;
    ctx.translate(cameraX, cameraY);

    // Draw world
    this.drawMap(ctx, player);
    this.drawPowerUps(ctx); // Ensure this method is defined
    this.drawVehicles(ctx);
    this.drawPlayers(ctx, playerIndex);
    this.drawEnemies(ctx);
    this.drawBullets(ctx);
    this.drawEffects(ctx);

    // Draw field of view if in vehicle
    if (player.vehicle) {
      this.drawVehicleFieldOfView(ctx, player);
    }

    ctx.restore();

    // Draw HUD elements
    this.drawHUD(ctx, player, playerIndex);
  }

  drawMap(ctx, player) {
    const TILE_SIZE = 40;
    const viewRadius = Math.max(this.canvas1.width, this.canvas1.height) / 2;
    
    // Only render tiles within view
    const startX = Math.max(0, Math.floor((player.x - viewRadius) / TILE_SIZE));
    const endX = Math.min(100, Math.ceil((player.x + viewRadius) / TILE_SIZE));
    const startY = Math.max(0, Math.floor((player.y - viewRadius) / TILE_SIZE));
    const endY = Math.min(100, Math.ceil((player.y + viewRadius) / TILE_SIZE));

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = this.game.map[y][x];
        const screenX = x * TILE_SIZE;
        const screenY = y * TILE_SIZE;

        // Skip if tile is outside view
        if (distance({x: screenX, y: screenY}, player) > viewRadius + TILE_SIZE) {
          continue;
        }

        switch(tile) {
          case 0: // Grass
            ctx.fillStyle = '#5f5';
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            break;
          case 1: // Rocks
            ctx.fillStyle = '#888';
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            this.drawRockDetail(ctx, screenX, screenY, TILE_SIZE);
            break;
          case 2: // Trees
            ctx.fillStyle = '#5f5';
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            this.drawTree(ctx, screenX + TILE_SIZE/2, screenY + TILE_SIZE/2);
            break;
          case 3: // Walls
            ctx.fillStyle = '#555';
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            this.drawWallDetail(ctx, screenX, screenY, TILE_SIZE);
            break;
          case 4: // Road
            ctx.fillStyle = '#999';
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            this.drawRoadDetail(ctx, screenX, screenY, TILE_SIZE, x, y);
            break;
          case 5: // Water
            this.drawWater(ctx, screenX, screenY, TILE_SIZE);
            break;
        }
      }
    }
  }

  drawPowerUps(ctx) {
    this.game.powerUps.forEach(powerUp => {
      ctx.save();
      ctx.translate(powerUp.x, powerUp.y);
      
      switch(powerUp.type) {
        case 'health':
          ctx.fillStyle = '#ff0000'; // Red for health
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          break;
        case 'ammo':
          ctx.fillStyle = '#ffff00'; // Yellow for ammo
          ctx.beginPath();
          ctx.rect(-10, -10, 20, 20);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          break;
        case 'weapon_upgrade':
          ctx.fillStyle = '#0000ff'; // Blue for weapon upgrade
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(10, 10);
          ctx.lineTo(-10, 10);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          break;
        case 'speed_boost':
          ctx.fillStyle = '#00ff00'; // Green for speed boost
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          break;
        default:
          ctx.fillStyle = '#ffffff'; // White for unknown types
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.stroke();
      }

      ctx.restore();
    });
  }

  drawTree(ctx, x, y) {
    // Tree trunk
    ctx.fillStyle = '#73510D';
    ctx.fillRect(x - 2, y, 4, 8);

    // Tree crown
    ctx.fillStyle = '#25511F';
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y - 16);
    ctx.closePath();
    ctx.fill();
  }

  drawWater(ctx, x, y, size) {
    const time = Date.now() / 1000;
    ctx.fillStyle = '#4444ff';
    ctx.fillRect(x, y, size, size);

    // Animated water effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    for (let i = 0; i < size; i += 4) {
      const waveHeight = Math.sin(i * 0.1 + time) * 2;
      if (i === 0) {
        ctx.moveTo(x + i, y + size/2 + waveHeight);
      } else {
        ctx.lineTo(x + i, y + size/2 + waveHeight);
      }
    }
    ctx.stroke();
  }

  drawRockDetail(ctx, x, y, size) {
    ctx.strokeStyle = '#666';
    ctx.beginPath();
    // Draw crack patterns
    ctx.moveTo(x + size * 0.2, y + size * 0.3);
    ctx.lineTo(x + size * 0.8, y + size * 0.7);
    ctx.moveTo(x + size * 0.7, y + size * 0.2);
    ctx.lineTo(x + size * 0.3, y + size * 0.8);
    ctx.stroke();
  }

  drawWallDetail(ctx, x, y, size) {
    // Brick pattern
    ctx.strokeStyle = '#444';
    for (let i = 0; i < size; i += size/4) {
      ctx.beginPath();
      ctx.moveTo(x, y + i);
      ctx.lineTo(x + size, y + i);
      ctx.stroke();
    }
    for (let i = 0; i < size; i += size/3) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i, y + size);
      ctx.stroke();
    }
  }

  drawRoadDetail(ctx, x, y, size, gridX, gridY) {
    // Road markings
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([size/4, size/4]);
    
    // Check surrounding tiles to determine road direction
    const hasNorth = gridY > 0 && this.game.map[gridY-1][gridX] === 4;
    const hasSouth = gridY < 99 && this.game.map[gridY+1][gridX] === 4;
    const hasEast = gridX < 99 && this.game.map[gridY][gridX+1] === 4;
    const hasWest = gridX > 0 && this.game.map[gridY][gridX-1] === 4;

    if ((hasNorth || hasSouth) && !hasEast && !hasWest) {
      // Vertical road
      ctx.beginPath();
      ctx.moveTo(x + size/2, y);
      ctx.lineTo(x + size/2, y + size);
      ctx.stroke();
    } else if (!hasNorth && !hasSouth && (hasEast || hasWest)) {
      // Horizontal road
      ctx.beginPath();
      ctx.moveTo(x, y + size/2);
      ctx.lineTo(x + size, y + size/2);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
  }

  drawVehicles(ctx) {
    this.game.vehicles.forEach(vehicle => {
      ctx.save();
      ctx.translate(vehicle.x, vehicle.y);
      ctx.rotate(vehicle.angle);
      ctx.fillStyle = vehicle.color;
      ctx.fillRect(-vehicle.size / 2, -vehicle.size / 2, vehicle.size, vehicle.size);

      // Draw turret if applicable
      if (vehicle.weapon) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, -5, vehicle.weaponOffset, 10);
      }
      ctx.restore();
    });
  }

  drawPlayers(ctx, playerIndex) {
    this.game.players.forEach((player, index) => {
      if (player.health <= 0) return;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw direction indicator
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(player.radius, 0);
      ctx.stroke();
      ctx.restore();
    });
  }

  drawEnemies(ctx) {
    this.game.enemies.forEach(enemy => {
      if (enemy.health <= 0) return;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw direction indicator
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(enemy.radius, 0);
      ctx.stroke();
      ctx.restore();
    });
  }

  drawBullets(ctx) {
    this.game.bullets.forEach(bullet => {
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(bullet.angle);
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawEffects(ctx) {
    // Placeholder for effects like explosions, smoke, etc.
    this.game.explosions.forEach(explosion => {
      ctx.save();
      ctx.translate(explosion.x, explosion.y);
      ctx.globalAlpha = 1 - (explosion.frame / explosion.maxFrames);
      ctx.fillStyle = 'orange';
      ctx.beginPath();
      ctx.arc(0, 0, explosion.radius * explosion.frame, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawHUD(ctx, player, playerIndex) {
    // Additional HUD elements can be drawn here if needed
    // For example, draw crosshairs, weapon indicators, etc.
  }

  drawMinimap(ctx, player) {
    // Clear minimap
    ctx.clearRect(0, 0, this.minimap1.width, this.minimap1.height);

    // Draw map overview
    const scale = this.minimap1.width / (100 * 40);
    ctx.fillStyle = '#5f5'; // Grass
    ctx.fillRect(0, 0, this.minimap1.width, this.minimap1.height);

    // Draw roads
    ctx.fillStyle = '#999';
    for(let y = 0; y < 100; y++) {
      for(let x = 0; x < 100; x++) {
        if (this.game.map[y][x] === 4) {
          ctx.fillRect(x * 40 * scale, y * 40 * scale, 40 * scale, 40 * scale);
        }
      }
    }

    // Draw players
    this.game.players.forEach((player, index) => {
      ctx.fillStyle = index === 0 ? '#4444ff' : '#ff4444';
      ctx.beginPath();
      ctx.arc(player.x * scale, player.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw enemies
    this.game.enemies.forEach(enemy => {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(enemy.x * scale, enemy.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw vehicles
    this.game.vehicles.forEach(vehicle => {
      ctx.fillStyle = vehicle.color;
      ctx.beginPath();
      ctx.arc(vehicle.x * scale, vehicle.y * scale, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawPlayerFieldOfView(ctx, player) {
    // Optional: Draw field of view indicators
  }

  drawVehicleFieldOfView(ctx, player) {
    // Optional: Implement field of view visualization for vehicles
  }
}
