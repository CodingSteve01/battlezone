import { Human, Vehicle, distance, isInSight } from './entities.js';

export class Renderer {
  constructor(game) {
    this.game = game;
    this.setupCanvases();
    this.loadImages();
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

  loadImages() {
    this.images = {
      terrain: {},
      vehicles: {},
      powerUps: {},
      effects: {}
    };

    // Terrain textures
    const terrainTypes = ['grass', 'rock', 'tree', 'wall', 'road', 'water'];
    terrainTypes.forEach(type => {
      const img = new Image();
      img.src = `assets/terrain/${type}.png`;
      this.images.terrain[type] = img;
    });

    // Vehicle textures
    const vehicleTypes = ['tank', 'jeep', 'apc', 'truck'];
    vehicleTypes.forEach(type => {
      const img = new Image();
      img.src = `assets/vehicles/${type}.png`;
      this.images.vehicles[type] = img;
    });

    // Power-up textures
    const powerUpTypes = ['health', 'ammo', 'weapon_upgrade', 'speed_boost'];
    powerUpTypes.forEach(type => {
      const img = new Image();
      img.src = `assets/powerups/${type}.png`;
      this.images.powerUps[type] = img;
    });

    // Effect textures
    ['explosion', 'smoke', 'splash'].forEach(effect => {
      const img = new Image();
      img.src = `assets/effects/${effect}.png`;
      this.images.effects[effect] = img;
    });
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
    this.drawPowerUps(ctx);
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
}