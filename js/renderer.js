// renderer.js
import { Human, Vehicle, distance, isInSight } from './entities.js';

export class Renderer {
  constructor(game) {
    this.game = game;
    this.setupCanvases();
    this.setupEffects();
    this.loadTextures();
  }

  setupCanvases() {
    // Main game canvases setup remains the same...
    // Previous canvas setup code...
  }

  loadTextures() {
    this.textures = {};
    const textureNames = [
      'grass', 'road', 'sand', 'water', 'rocks',
      'tree1', 'tree2', 'tree3',
      'house1', 'house2', 'bunker',
      'tank', 'jeep', 'lkw', 'schuetzenpanzer'
    ];

    textureNames.forEach(name => {
      const img = new Image();
      img.src = `/assets/textures/${name}.png`;
      this.textures[name] = img;
    });
  }

  setupEffects() {
    this.effects = {
      particles: [],
      lights: [],
      shadows: [],
      weather: {
        rain: false,
        rainDrops: [],
        fog: false,
        fogDensity: 0,
        timeOfDay: 'day'
      }
    };

    // Initialize weather effects
    this.initializeWeatherEffects();
  }

  initializeWeatherEffects() {
    // Rain effect setup
    for (let i = 0; i < 1000; i++) {
      this.effects.weather.rainDrops.push({
        x: Math.random() * this.canvas1.width,
        y: Math.random() * this.canvas1.height,
        speed: Math.random() * 5 + 10,
        length: Math.random() * 10 + 10
      });
    }
  }

  drawMap(ctx, player) {
    const TILE_SIZE = 40;
    const viewRadius = Math.max(this.canvas1.width, this.canvas1.height) / 2;
    
    // Calculate visible area
    const startX = Math.max(0, Math.floor((player.x - viewRadius) / TILE_SIZE));
    const endX = Math.min(100, Math.ceil((player.x + viewRadius) / TILE_SIZE));
    const startY = Math.max(0, Math.floor((player.y - viewRadius) / TILE_SIZE));
    const endY = Math.min(100, Math.ceil((player.y + viewRadius) / TILE_SIZE));

    // Draw base terrain
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = this.game.map[y][x];
        const screenX = x * TILE_SIZE;
        const screenY = y * TILE_SIZE;

        if (distance({x: screenX, y: screenY}, player) > viewRadius + TILE_SIZE) {
          continue;
        }

        this.drawTerrain(ctx, tile, screenX, screenY, TILE_SIZE, x, y);
      }
    }

    // Draw terrain details and decorations
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = this.game.map[y][x];
        const screenX = x * TILE_SIZE;
        const screenY = y * TILE_SIZE;

        this.drawTerrainDetails(ctx, tile, screenX, screenY, TILE_SIZE, x, y);
      }
    }

    // Apply lighting and shadows
    this.applyLighting(ctx, player);
  }

  drawTerrain(ctx, tile, x, y, size, gridX, gridY) {
    switch(tile) {
      case 0: // Grass
        this.drawDetailedGrass(ctx, x, y, size);
        break;
      case 1: // Rocks
        this.drawDetailedRocks(ctx, x, y, size);
        break;
      case 2: // Trees
        this.drawDetailedGrass(ctx, x, y, size);
        break;
      case 3: // Walls
        this.drawDetailedWall(ctx, x, y, size);
        break;
      case 4: // Road
        this.drawDetailedRoad(ctx, x, y, size, gridX, gridY);
        break;
      case 5: // Water
        this.drawDetailedWater(ctx, x, y, size);
        break;
      case 6: // Buildings
        this.drawDetailedBuilding(ctx, x, y, size);
        break;
    }
  }

  drawTerrainDetails(ctx, tile, x, y, size, gridX, gridY) {
    switch(tile) {
      case 2: // Trees
        this.drawDetailedTree(ctx, x + size/2, y + size/2);
        break;
      case 6: // Building details
        this.drawBuildingDetails(ctx, x, y, size);
        break;
    }
  }

  drawDetailedGrass(ctx, x, y, size) {
    // Base grass color
    ctx.fillStyle = '#3a5a3a';
    ctx.fillRect(x, y, size, size);

    // Grass detail pattern
    ctx.strokeStyle = '#2d462d';
    for (let i = 0; i < 5; i++) {
      const offsetX = Math.random() * size;
      const offsetY = Math.random() * size;
      const length = Math.random() * 5 + 3;
      const angle = Math.random() * Math.PI;
      
      ctx.save();
      ctx.translate(x + offsetX, y + offsetY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, length);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawDetailedRocks(ctx, x, y, size) {
    // Base rock color
    ctx.fillStyle = '#666';
    ctx.fillRect(x, y, size, size);

    // Rock texture
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 3; i++) {
      const rockSize = Math.random() * 15 + 10;
      const offsetX = Math.random() * (size - rockSize);
      const offsetY = Math.random() * (size - rockSize);
      
      ctx.beginPath();
      ctx.ellipse(
        x + offsetX + rockSize/2,
        y + offsetY + rockSize/2,
        rockSize/2,
        rockSize/3,
        Math.random() * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = `rgb(${100 + Math.random()*30}, ${100 + Math.random()*30}, ${100 + Math.random()*30})`;
      ctx.fill();
      ctx.stroke();
    }
  }

  drawDetailedTree(ctx, x, y) {
    // Tree shadow
    const gradient = ctx.createRadialGradient(x, y + 15, 0, x, y + 15, 20);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y + 15, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  
    // Trunk with texture
    const trunkGradient = ctx.createLinearGradient(x - 4, y, x + 4, y);
    trunkGradient.addColorStop(0, '#4a3726');
    trunkGradient.addColorStop(0.5, '#6b4c34');
    trunkGradient.addColorStop(1, '#4a3726');
    ctx.fillStyle = trunkGradient;
    ctx.fillRect(x - 4, y - 5, 8, 25);
  
    // Bark texture
    ctx.strokeStyle = '#2d2319';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 4 + Math.random() * 8, y + Math.random() * 20);
      ctx.lineTo(x - 4 + Math.random() * 8, y + Math.random() * 20 + 5);
      ctx.stroke();

      // Enhanced foliage with multiple layers and lighting
      const layers = 4;
      for (let i = 0; i < layers; i++) {
        const layerSize = 30 - i * 5;
        const heightOffset = i * 10;
        
        // Create gradient for each layer
        const foliageGradient = ctx.createRadialGradient(
          x, y - heightOffset, 0,
          x, y - heightOffset, layerSize
        );
        foliageGradient.addColorStop(0, `rgba(${40 + i*20}, ${100 + i*20}, ${40 + i*20}, 0.9)`);
        foliageGradient.addColorStop(1, `rgba(${30 + i*20}, ${90 + i*20}, ${30 + i*20}, 0.7)`);
        
        ctx.fillStyle = foliageGradient;
        
        // Create organic-looking foliage shape
        ctx.beginPath();
        ctx.moveTo(x, y - heightOffset - layerSize);
        
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const radius = layerSize * (0.8 + Math.random() * 0.4);
          const leafX = x + Math.cos(angle) * radius;
          const leafY = y - heightOffset + Math.sin(angle) * radius * 0.7;
          ctx.lineTo(leafX, leafY);
        }
        
        ctx.closePath();
        ctx.fill();
    
        // Add highlight details
        ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
        for (let j = 0; j < 5; j++) {
          const highlightX = x - layerSize/2 + Math.random() * layerSize;
          const highlightY = y - heightOffset - layerSize/2 + Math.random() * layerSize;
          ctx.beginPath();
          ctx.arc(highlightX, highlightY, 2 + Math.random() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawDetailedWall(ctx, x, y, size) {
    // Base wall
    ctx.fillStyle = '#777';
    ctx.fillRect(x, y, size, size);

    // Brick pattern
    const brickWidth = 10;
    const brickHeight = 5;
    const mortar = 1;

    ctx.strokeStyle = '#666';
    ctx.lineWidth = mortar;

    for (let row = 0; row < size/brickHeight; row++) {
      const offset = (row % 2) * (brickWidth/2);
      for (let col = -1; col < size/brickWidth + 1; col++) {
        const brickX = x + col * brickWidth + offset;
        const brickY = y + row * brickHeight;
        
        // Brick outline
        ctx.strokeRect(brickX, brickY, brickWidth - mortar, brickHeight - mortar);
        
        // Brick texture
        ctx.fillStyle = `rgb(${119 + Math.random()*20}, ${119 + Math.random()*20}, ${119 + Math.random()*20})`;
        ctx.fillRect(brickX + mortar, brickY + mortar, 
                    brickWidth - 2*mortar, brickHeight - 2*mortar);
      }
    }

    // Add wear and damage
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 0; i < 5; i++) {
      const crackX = x + Math.random() * size;
      const crackY = y + Math.random() * size;
      const length = Math.random() * 10 + 5;
      const angle = Math.random() * Math.PI;
      
      ctx.save();
      ctx.translate(crackX, crackY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(length, length/2);
      ctx.lineTo(length*0.8, -length/3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawDetailedRoad(ctx, x, y, size, gridX, gridY) {
    // Base road
    ctx.fillStyle = '#444';
    ctx.fillRect(x, y, size, size);

    // Asphalt texture
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(${60 + Math.random()*20}, ${60 + Math.random()*20}, ${60 + Math.random()*20}, 0.5)`;
      ctx.beginPath();
      ctx.arc(x + Math.random()*size, y + Math.random()*size, 
              Math.random()*2 + 1, 0, Math.PI*2);
      ctx.fill();
    }

    // Road markings
    const hasNorth = gridY > 0 && this.game.map[gridY-1][gridX] === 4;
    const hasSouth = gridY < 99 && this.game.map[gridY+1][gridX] === 4;
    const hasEast = gridX < 99 && this.game.map[gridY][gridX+1] === 4;
    const hasWest = gridX > 0 && this.game.map[gridY][gridX-1] === 4;

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);

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
    } else if ((hasNorth || hasSouth) && (hasEast || hasWest)) {
      // Intersection
      ctx.strokeStyle = '#ddd';
      ctx.strokeRect(x + 5, y + 5, size - 10, size - 10);
    }

    ctx.setLineDash([]);
  }

  drawDetailedWater(ctx, x, y, size) {
    const time = Date.now() / 1000;
    
    // Base water
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, '#2a80b9');
    gradient.addColorStop(1, '#1a608a');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);

    // Wave effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;

    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      for (let j = 0; j <= size; j += 5) {
        const waveHeight = Math.sin((j/size) * Math.PI * 2 + time * (i+1)) * 3;
        if (j === 0) {
          ctx.moveTo(x + j, y + size/2 + waveHeight + i*10);
        } else {
          ctx.lineTo(x + j, y + size/2 + waveHeight + i*10);
        }
      }
      ctx.stroke();
    }

    // Reflection highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 5; i++) {
      const reflectX = x + Math.random() * size;
      const reflectY = y + Math.random() * size;
      const length = Math.random() * 10 + 5;
      
      ctx.beginPath();
      ctx.ellipse(reflectX, reflectY, length, length/3, 
                  Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawDetailedBunker(ctx, x, y, size) {
    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x - 2, y - 2, size + 4, size + 4);
  
    // Main bunker structure
    const bunkerGradient = ctx.createLinearGradient(x, y, x + size, y + size);
    bunkerGradient.addColorStop(0, '#4a4a4a');
    bunkerGradient.addColorStop(0.5, '#5a5a5a');
    bunkerGradient.addColorStop(1, '#404040');
    ctx.fillStyle = bunkerGradient;
    ctx.fillRect(x, y, size, size);
  
    // Reinforced corners
    ctx.fillStyle = '#333';
    const cornerSize = 6;
    ctx.fillRect(x, y, cornerSize, cornerSize);
    ctx.fillRect(x + size - cornerSize, y, cornerSize, cornerSize);
    ctx.fillRect(x, y + size - cornerSize, cornerSize, cornerSize);
    ctx.fillRect(x + size - cornerSize, y + size - cornerSize, cornerSize, cornerSize);
  
    // Steel door
    const doorWidth = size / 3;
    const doorHeight = size / 2;
    const doorX = x + size/2 - doorWidth/2;
    const doorY = y + size - doorHeight;
    
    const doorGradient = ctx.createLinearGradient(doorX, doorY, doorX + doorWidth, doorY);
    doorGradient.addColorStop(0, '#2a2a2a');
    doorGradient.addColorStop(0.5, '#3a3a3a');
    doorGradient.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = doorGradient;
    ctx.fillRect(doorX, doorY, doorWidth, doorHeight);
  
    // Door details
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.strokeRect(doorX + 2, doorY + 2, doorWidth - 4, doorHeight - 4);
    
    // Handle
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(doorX + doorWidth - 5, doorY + doorHeight/2, 2, 0, Math.PI * 2);
    ctx.fill();
  
    // Ventilation slits
    ctx.fillStyle = '#262626';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + size/4, y + 5 + i * 7, size/2, 3);
    }
  
    // Wear and damage
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    for (let i = 0; i < 5; i++) {
      const startX = x + Math.random() * size;
      const startY = y + Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + Math.random() * 10 - 5, startY + Math.random() * 10 - 5);
      ctx.stroke();
    }
  }

  drawDetailedBuilding(ctx, x, y, size) {
    // Base building
    ctx.fillStyle = '#555';
    ctx.fillRect(x, y, size, size);

    // Window pattern
    const windowSize = 6;
    const gap = 4;
    const rows = 3;
    const cols = 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const windowX = x + gap + col * (windowSize + gap);
        const windowY = y + gap + row * (windowSize + gap);

        // Window frame
        ctx.fillStyle = '#333';
        ctx.fillRect(windowX, windowY, windowSize, windowSize);

        // Glass
        ctx.fillStyle = 'rgba(155, 155, 255, 0.3)';
        ctx.fillRect(windowX + 1, windowY + 1, windowSize - 2, windowSize - 2);

        // Reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(windowX + 1, windowY + 1);
        ctx.lineTo(windowX + 3, windowY + 1);
        ctx.lineTo(windowX + 1, windowY + 3);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Door
    const doorWidth = 8;
    const doorHeight = 12;
    ctx.fillStyle = '#333';
    ctx.fillRect(x + size/2 - doorWidth/2, y + size - doorHeight, 
                doorWidth, doorHeight);

    // Door handle
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(x + size/2 + doorWidth/4, y + size - doorHeight/2, 
            1, 0, Math.PI * 2);
    ctx.fill();

    // Roof
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x + size + 2, y);
    ctx.lineTo(x + size/2, y - size/4);
    ctx.closePath();
    ctx.fill();

    // Roof texture
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < size + 4; i += 4) {
      ctx.beginPath();
      ctx.moveTo(x - 2 + i, y);
      ctx.lineTo(x + size/2, y - size/4);
      ctx.stroke();
    }
  }

  applyLighting(ctx, player) {
    // Create a radial gradient for player's view
    const gradient = ctx.createRadialGradient(
      player.x, player.y, 0,
      player.x, player.y, 300
    );
    
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');

    // Apply the gradient as a mask
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gradient;
    ctx.fillRect(player.x - 400, player.y - 400, 800, 800);
    ctx.globalCompositeOperation = 'source-over';
  }

  drawVehicles(ctx) {
    this.game.vehicles.forEach(vehicle => {
      ctx.save();
      ctx.translate(vehicle.x, vehicle.y);
      ctx.rotate(vehicle.angle);

      // Draw vehicle shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 10, vehicle.radius * 1.2, vehicle.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      switch(vehicle.type) {
        case 'tank':
          this.drawTank(ctx, vehicle);
          break;
        case 'jeep':
          this.drawJeep(ctx, vehicle);
          break;
        case 'lkw':
          this.drawTruck(ctx, vehicle);
          break;
        case 'schuetzenpanzer':
          this.drawAPC(ctx, vehicle);
          break;
      }

      // Draw health bar
      const healthPercent = vehicle.health / vehicle.maxHealth;
      ctx.fillStyle = `rgb(${255 * (1-healthPercent)}, ${255 * healthPercent}, 0)`;
      ctx.fillRect(-20, -30, 40 * healthPercent, 4);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(-20, -30, 40, 4);

      ctx.restore();
    });
  }

  drawTank(ctx, vehicle) {
    // Enhanced shadow with perspective
    const shadowGradient = ctx.createRadialGradient(0, 10, 0, 0, 10, vehicle.radius * 1.5);
    shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGradient;
    ctx.beginPath();
    ctx.ellipse(0, 10, vehicle.radius * 1.2, vehicle.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  
    // Enhanced tracks with detailed treads
    this.drawTankTracks(ctx, vehicle);
  
    // Main hull with gradient and weathering
    const hullGradient = ctx.createLinearGradient(-15, -8, 15, 8);
    hullGradient.addColorStop(0, '#445566');
    hullGradient.addColorStop(0.5, '#556677');
    hullGradient.addColorStop(1, '#445566');
    ctx.fillStyle = hullGradient;
    ctx.fillRect(-15, -8, 30, 16);
  
    // Add armor plates and rivets
    this.drawTankArmor(ctx);
  
    // Enhanced turret with detail
    ctx.save();
    ctx.rotate(vehicle.turretAngle);
    this.drawTankTurret(ctx, vehicle);
    ctx.restore();
  
    // Battle damage and wear effects
    if (vehicle.health < vehicle.maxHealth) {
      this.drawTankDamage(ctx, vehicle);
    }
  }

  drawTankTracks(ctx, vehicle) {
    // Track base
    ctx.fillStyle = '#222';
    ctx.fillRect(-20, -12, 40, 6);
    ctx.fillRect(-20, 6, 40, 6);
  
    // Detailed treads
    ctx.fillStyle = '#111';
    const treadCount = 10;
    const treadSpacing = 40 / treadCount;
    
    for (let i = 0; i < treadCount; i++) {
      const x = -20 + i * treadSpacing;
      // Upper track
      ctx.fillRect(x, -12, 2, 6);
      // Lower track
      ctx.fillRect(x, 6, 2, 6);
    }
  
    // Track wheels
    for (let i = -1; i <= 1; i++) {
      const x = i * 15;
      ctx.beginPath();
      ctx.arc(x, -9, 3, 0, Math.PI * 2);
      ctx.arc(x, 9, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#333';
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.stroke();
    }
  }

  drawTankArmor(ctx) {
    // Armor plates
    ctx.strokeStyle = '#334455';
    ctx.lineWidth = 1;
    
    // Front plate
    ctx.beginPath();
    ctx.moveTo(-15, -8);
    ctx.lineTo(15, -8);
    ctx.lineTo(15, 8);
    ctx.lineTo(-15, 8);
    ctx.closePath();
    ctx.stroke();
  
    // Rivets
    ctx.fillStyle = '#223344';
    const rivetPositions = [
      {x: -12, y: -6}, {x: -12, y: 6},
      {x: 0, y: -6}, {x: 0, y: 6},
      {x: 12, y: -6}, {x: 12, y: 6}
    ];
    
    rivetPositions.forEach(pos => {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  drawTankTurret(ctx, vehicle) {
    // Turret base with gradient
    const turretGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    turretGradient.addColorStop(0, '#556677');
    turretGradient.addColorStop(1, '#445566');
    ctx.fillStyle = turretGradient;
    
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  
    // Turret details
    ctx.strokeStyle = '#334455';
    ctx.lineWidth = 1;
    ctx.stroke();
  
    // Main gun with enhanced detail
    const gunGradient = ctx.createLinearGradient(0, 0, vehicle.weaponOffset, 0);
    gunGradient.addColorStop(0, '#445566');
    gunGradient.addColorStop(1, '#334455');
    ctx.fillStyle = gunGradient;
    ctx.fillRect(0, -3, vehicle.weaponOffset, 6);
  
    // Gun mantlet
    ctx.fillStyle = '#334455';
    ctx.beginPath();
    ctx.ellipse(2, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  
    // Muzzle brake
    ctx.fillStyle = '#223344';
    ctx.fillRect(vehicle.weaponOffset - 2, -4, 6, 8);
    
    // Muzzle details
    ctx.fillStyle = '#112233';
    ctx.fillRect(vehicle.weaponOffset + 2, -3, 1, 6);
  }
  
  drawTankDamage(ctx, vehicle) {
    const damageLevel = 1 - (vehicle.health / vehicle.maxHealth);
    
    // Scorch marks
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let i = 0; i < damageLevel * 10; i++) {
      const x = (Math.random() - 0.5) * 30;
      const y = (Math.random() - 0.5) * 20;
      const size = Math.random() * 5 + 2;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  
    // Damage holes
    if (damageLevel > 0.5) {
      ctx.fillStyle = '#000';
      for (let i = 0; i < (damageLevel - 0.5) * 10; i++) {
        const x = (Math.random() - 0.5) * 30;
        const y = (Math.random() - 0.5) * 20;
        const size = Math.random() * 3 + 1;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  
    // Smoke effects for heavily damaged vehicles
    if (damageLevel > 0.7) {
      this.drawSmoke(ctx, 0, -10, damageLevel);
    }
  }
  
  drawSmoke(ctx, x, y, intensity) {
    const time = Date.now() / 1000;
    const particleCount = Math.floor(intensity * 10);
    
    for (let i = 0; i < particleCount; i++) {
      const offset = Math.sin(time * 2 + i) * 3;
      const alpha = (0.3 - (i * 0.03)) * intensity;
      const size = 4 + i + Math.sin(time * 3 + i) * 2;
      
      const gradient = ctx.createRadialGradient(
        x + offset, y - (i * 5), 0,
        x + offset, y - (i * 5), size
      );
      gradient.addColorStop(0, `rgba(80, 80, 80, ${alpha})`);
      gradient.addColorStop(1, 'rgba(80, 80, 80, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x + offset, y - (i * 5), size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawJeep(ctx, vehicle) {
    // Wheels
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-12, -12, 6, 0, Math.PI * 2);
    ctx.arc(12, -12, 6, 0, Math.PI * 2);
    ctx.arc(-12, 12, 6, 0, Math.PI * 2);
    ctx.arc(12, 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = vehicle.color;
    ctx.fillRect(-15, -8, 30, 16);
    
    // Windshield
    ctx.fillStyle = 'rgba(155, 155, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(-5, -12);
    ctx.lineTo(5, -12);
    ctx.lineTo(10, -8);
    ctx.closePath();
    ctx.fill();

    // Mounted gun
    if (vehicle.weapon) {
      ctx.save();
      ctx.rotate(vehicle.turretAngle);
      ctx.fillStyle = '#333';
      ctx.fillRect(0, -2, vehicle.weaponOffset, 4);
      ctx.restore();
    }
  }

  drawTruck(ctx, vehicle) {
    // Wheels
    ctx.fillStyle = '#222';
    ctx.beginPath();
    for(let x = -20; x <= 20; x += 10) {
      ctx.arc(x, -12, 5, 0, Math.PI * 2);
      ctx.arc(x, 12, 5, 0, Math.PI * 2);
    }
    ctx.fill();

    // Cargo area
    ctx.fillStyle = vehicle.color;
    ctx.fillRect(-25, -10, 40, 20);
    
    // Cab
    ctx.fillStyle = '#556677';
    ctx.fillRect(-25, -10, 15, 20);
    
    // Windshield
    ctx.fillStyle = 'rgba(155, 155, 255, 0.3)';
    ctx.fillRect(-20, -8, 8, 6);
  }

  drawAPC(ctx, vehicle) {
    // Tracks
    ctx.fillStyle = '#333';
    ctx.fillRect(-25, -15, 50, 8);
    ctx.fillRect(-25, 7, 50, 8);
    
    // Track details
    ctx.fillStyle = '#222';
    for(let i = -23; i < 23; i += 4) {
      ctx.fillRect(i, -15, 2, 8);
      ctx.fillRect(i, 7, 2, 8);
    }

    // Main body
    ctx.fillStyle = vehicle.color;
    ctx.beginPath();
    ctx.moveTo(-25, -10);
    ctx.lineTo(25, -10);
    ctx.lineTo(25, 10);
    ctx.lineTo(-25, 10);
    ctx.closePath();
    ctx.fill();

    // Turret
    ctx.save();
    ctx.rotate(vehicle.turretAngle);
    ctx.fillStyle = '#445566';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Gun
    ctx.fillStyle = '#334455';
    ctx.fillRect(0, -2, vehicle.weaponOffset, 4);
    ctx.restore();

    // Vision slits
    ctx.fillStyle = '#223344';
    for(let i = -15; i <= 15; i += 10) {
      ctx.fillRect(i, -8, 6, 2);
    }
  }

  drawVehicleDetails(ctx, vehicle) {
    // Battle damage if health is low
    if (vehicle.health < vehicle.maxHealth * 0.5) {
      const damageCount = Math.floor((1 - vehicle.health/vehicle.maxHealth) * 10);
      ctx.fillStyle = '#000';
      for(let i = 0; i < damageCount; i++) {
        const x = (Math.random() - 0.5) * 30;
        const y = (Math.random() - 0.5) * 20;
        const size = Math.random() * 3 + 2;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Add smoke effects for damaged vehicles
    if (vehicle.health < vehicle.maxHealth * 0.3) {
      this.drawSmoke(ctx, 0, -10);
    }
  }

  drawSmoke(ctx, x, y) {
    const time = Date.now() / 1000;
    for(let i = 0; i < 3; i++) {
      const offset = Math.sin(time * 2 + i) * 2;
      const alpha = 0.3 - (i * 0.1);
      ctx.fillStyle = `rgba(100, 100, 100, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x + offset, y - (i * 5), 4 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPlayers(ctx, playerIndex) {
    this.game.players.forEach((player, index) => {
      if (player.health <= 0) return;

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      // Draw shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 5, player.radius, player.radius/2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw body
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw equipment
      this.drawPlayerEquipment(ctx, player);

      // Draw weapon
      this.drawPlayerWeapon(ctx, player);

      // Health bar
      const healthPercent = player.health / player.maxHealth;
      ctx.fillStyle = `rgb(${255 * (1-healthPercent)}, ${255 * healthPercent}, 0)`;
      ctx.fillRect(-15, -25, 30 * healthPercent, 3);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(-15, -25, 30, 3);

      ctx.restore();
    });
  }

  drawPlayerEquipment(ctx, player) {
    // Draw armor
    if (player.armor) {
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw camouflage effect
    if (player.camouflage) {
      const pattern = ctx.createPattern(this.getCamoPattern(player.camouflage), 'repeat');
      ctx.fillStyle = pattern;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPlayerWeapon(ctx, player) {
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    // Draw weapon based on type
    switch(player.weapon) {
      case 'Pistole':
        ctx.beginPath();
        ctx.moveTo(player.radius - 2, 0);
        ctx.lineTo(player.radius + 8, 0);
        ctx.stroke();
        break;
      case 'Gewehr':
        ctx.beginPath();
        ctx.moveTo(player.radius - 2, 0);
        ctx.lineTo(player.radius + 15, 0);
        ctx.stroke();
        break;
      case 'Maschinengewehr':
        ctx.beginPath();
        ctx.moveTo(player.radius - 2, 0);
        ctx.lineTo(player.radius + 20, 0);
        ctx.rect(player.radius + 15, -2, 5, 4);
        ctx.stroke();
        break;
      case 'Schrotflinte':
        ctx.beginPath();
        ctx.moveTo(player.radius - 2, 0);
        ctx.lineTo(player.radius + 12, 0);
        ctx.rect(player.radius + 8, -1.5, 4, 3);
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  getCamoPattern(camouflage) {
    // Create canvas for camo pattern
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const patternCtx = patternCanvas.getContext('2d');

    // Draw different patterns based on camo type
    switch(camouflage.name) {
      case 'Urban Tarnung':
        this.drawUrbanCamo(patternCtx);
        break;
      case 'Wald Tarnung':
        this.drawWoodlandCamo(patternCtx);
        break;
      case 'Wüsten Tarnung':
        this.drawDesertCamo(patternCtx);
        break;
      case 'Ghillie Anzug':
        this.drawGhillieCamo(patternCtx);
        break;
    }

    return patternCanvas;
  }

  drawUrbanCamo(ctx) {
    const colors = ['#555', '#777', '#999', '#333'];
    for(let i = 0; i < 10; i++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.beginPath();
      ctx.rect(Math.random() * 20, Math.random() * 20, 
               Math.random() * 10, Math.random() * 10);
      ctx.fill();
    }
  }

  drawWoodlandCamo(ctx) {
    const colors = ['#1a4314', '#2d5a1a', '#3f7120', '#1c2e0f'];
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, 20, 20);
    
    for(let i = 1; i < colors.length; i++) {
      ctx.fillStyle = colors[i];
      for(let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * 20, Math.random() * 20, 
                   Math.random() * 5 + 3, Math.random() * 5 + 3,
                   Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawDesertCamo(ctx) {
    const colors = ['#c2b280', '#a89b6a', '#8f8558', '#d4c397'];
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, 20, 20);
    
    for(let i = 1; i < colors.length; i++) {
      ctx.fillStyle = colors[i];
      for(let j = 0; j < 3; j++) {
        const x = Math.random() * 20;
        const y = Math.random() * 20;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.random() * 8, y + Math.random() * 8);
        ctx.lineTo(x + Math.random() * 8, y - Math.random() * 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawGhillieCamo(ctx) {
    // Base layer
    ctx.fillStyle = '#2d5a1a';
    ctx.fillRect(0, 0, 20, 20);
    
    // Random grass-like strokes
    for(let i = 0; i < 20; i++) {
      ctx.strokeStyle = i % 2 ? '#1a4314' : '#3f7120';
      ctx.beginPath();
      const x = Math.random() * 20;
      const y = Math.random() * 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.random() * 4 - 2, y + Math.random() * 4 - 2);
      ctx.stroke();
    }
  }

  drawEnemies(ctx) {
    this.game.enemies.forEach(enemy => {
      if (enemy.health <= 0) return;
      
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);

      // Draw shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 5, enemy.radius, enemy.radius/2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw enemy with state-based visual feedback
      switch(enemy.state) {
        case 'patrol':
          ctx.fillStyle = '#FFD700';
          break;
        case 'engage':
          ctx.fillStyle = '#FF4500';
          break;
        case 'flee':
          ctx.fillStyle = '#98FB98';
          break;
        case 'investigate':
          ctx.fillStyle = '#DEB887';
          break;
        default:
          ctx.fillStyle = enemy.color;
      }

      // Main body
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw alertness indicator
      if (enemy.alertness > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${enemy.alertness / 100})`;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw equipment
      this.drawEnemyEquipment(ctx, enemy);

      // Draw vision cone
      this.drawVisionCone(ctx, enemy);

      // Health bar
      const healthPercent = enemy.health / enemy.maxHealth;
      ctx.fillStyle = `rgb(${255 * (1-healthPercent)}, ${255 * healthPercent}, 0)`;
      ctx.fillRect(-15, -25, 30 * healthPercent, 3);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(-15, -25, 30, 3);

      ctx.restore();
    });
  }

  drawVisionCone(ctx, enemy) {
    const visionRange = enemy.visionRange;
    const visionAngle = enemy.visionAngle;
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, visionRange, -visionAngle/2, visionAngle/2);
    ctx.closePath();
    
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, visionRange);
    gradient.addColorStop(0, 'rgba(255, 255, 0, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  drawEnemyEquipment(ctx, enemy) {
    // Similar to drawPlayerEquipment but for enemies
    if (enemy.armor) {
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw weapon
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(enemy.radius - 2, 0);
    ctx.lineTo(enemy.radius + 10, 0);
    ctx.stroke();
    ctx.restore();
  }

  drawBullets(ctx) {
    this.game.bullets.forEach(bullet => {
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(bullet.angle);

      // Bullet trail effect
      const gradient = ctx.createLinearGradient(-10, 0, 0, 0);
      gradient.addColorStop(0, 'rgba(255, 255, 0, 0)');
      gradient.addColorStop(1, 'rgba(255, 255, 0, 0.5)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(-10, -1, 10, 2);

      // Bullet
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      // Bullet glow
      ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  drawEffects(ctx) {
    // Draw explosions
    this.game.explosions.forEach(explosion => {
      ctx.save();
      ctx.translate(explosion.x, explosion.y);
      
      // Inner explosion
      const innerRadius = explosion.radius * (explosion.frame / explosion.maxFrames);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, innerRadius);
      gradient.addColorStop(0, 'rgba(255, 200, 0, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Shock wave
      const outerRadius = innerRadius * 1.5;
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - explosion.frame / explosion.maxFrames})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Debris particles
      const particleCount = 10;
      for(let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = innerRadius * 0.8;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // Draw weather effects
    if (this.effects.weather.rain) {
      this.drawRain(ctx);
    }
    if (this.effects.weather.fog) {
      this.drawFog(ctx);
    }

    // Draw particle effects
    this.drawParticles(ctx);
  }

  drawRain(ctx) {
    ctx.strokeStyle = 'rgba(155, 155, 255, 0.5)';
    ctx.lineWidth = 1;
    
    this.effects.weather.rainDrops.forEach(drop => {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - drop.speed, drop.y + drop.length);
      ctx.stroke();

      // Update drop position
      drop.x += drop.speed;
      drop.y += drop.speed * 2;

      // Reset drop when it goes off screen
      if (drop.y > this.canvas1.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * this.canvas1.width;
      }
    });
  }

  drawFog(ctx) {
    const gradient = ctx.createRadialGradient(
      this.canvas1.width/2, this.canvas1.height/2, 0,
      this.canvas1.width/2, this.canvas1.height/2, Math.max(this.canvas1.width, this.canvas1.height)
    );
    
    gradient.addColorStop(0, `rgba(200, 200, 200, ${this.effects.weather.fogDensity})`);
    gradient.addColorStop(1, `rgba(200, 200, 200, ${this.effects.weather.fogDensity * 0.5})`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas1.width, this.canvas1.height);
  }

  drawParticles(ctx) {
    this.effects.particles.forEach((particle, index) => {
      particle.life -= 1;
      if (particle.life <= 0) {
        this.effects.particles.splice(index, 1);
        return;
      }

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.globalAlpha = particle.life / particle.maxLife;
      
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
      ctx.fill();
      
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += particle.gravity;
      
      ctx.restore();
    });
  }

  addParticle(x, y, type) {
    const particle = {
      x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 3 + 1,
      life: 60,
      maxLife: 60,
      gravity: 0.1,
      color: type === 'smoke' ? '#888' : type === 'fire' ? '#f50' : '#fff'
    };
    
    this.effects.particles.push(particle);
  }
}