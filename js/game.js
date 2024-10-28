// game.js
import { Entity, Human, Vehicle, isColliding, isVehicleColliding, distance, isInSight } from './entities.js';
import { Renderer } from './renderer.js';

export class Game {
  constructor(mode) {
    this.mode = mode;
    this.renderer = new Renderer(this);
    this.setupControls();
    this.setupModeDisplay();
    this.gameOver = false;
    this.gameLoopRunning = false;
    this.score = 0;
    this.wave = 1;
    this.initSoundManager();
    this.initGame();
  }

  initSoundManager() {
    this.soundManager = new SoundManager();
  }

  setupControls() {
    this.keys = {};
    this.controls = [
      { 
        forward: 'ArrowUp', 
        backward: 'ArrowDown', 
        left: 'ArrowLeft', 
        right: 'ArrowRight', 
        shoot: 'Space', 
        action: 'Enter', 
        switch: 'ShiftRight' 
      },
      { 
        forward: 'KeyW', 
        backward: 'KeyS', 
        left: 'KeyA', 
        right: 'KeyD', 
        shoot: 'KeyF', 
        action: 'KeyE', 
        switch: 'KeyG' 
      }
    ];
    
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      e.preventDefault();
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      e.preventDefault();
    });
  }

  setupModeDisplay() {
    const modeDisplay = document.getElementById('modeDisplay');
    modeDisplay.textContent = `Mode: ${this.mode}`;
    modeDisplay.style.display = 'block';
  }

  initGame() {
    this.map = this.generateMap();
    this.players = [];
    
    if (this.mode === 'SinglePlayer') {
      this.players.push(new Human(100, 100, '#4444ff')); // Player 1
    } else if (this.mode === 'Cooperative') {
      this.players.push(new Human(100, 100, '#4444ff')); // Player 1
      this.players.push(new Human(150, 100, '#ff4444')); // Player 2
    } else if (this.mode === 'Versus') {
      this.players.push(new Human(100, 100, '#4444ff')); // Player 1
      this.players.push(new Human(3900, 3900, '#ff4444')); // Player 2
    }

    this.vehicles = this.generateVehicles();
    this.vehicles.forEach(v => v.game = this);
    this.bullets = [];
    this.powerUps = this.generatePowerUps();
    this.enemies = [];
    this.explosions = [];
    this.pickups = [];

    switch(this.mode) {
      case 'SinglePlayer':
        this.spawnEnemies(5 + this.wave * 2);
        break;
      case 'Cooperative':
        this.spawnEnemies(10 + this.wave * 3);
        break;
      case 'Versus':
        // No AI enemies in Versus mode
        break;
    }

    this.ensureSafeSpawns(); // Ensure safe spawning
    this.startGameLoop();
  }

  generateMap() {
    const map = [];
    const MAP_SIZE = 100;
    
    // Initialize with grass
    for(let y = 0; y < MAP_SIZE; y++) {
      const row = new Array(MAP_SIZE).fill(0);
      map.push(row);
    }

    this.generateRoads(map);
    this.generateTerrain(map);
    this.generateWater(map);
    this.generateStrategicPoints(map);

    return map;
  }

  generateRoads(map) {
    // Main roads
    for(let i = 0; i < map.length; i++) {
      if (i === 20 || i === 80) {
        for(let j = 10; j < 90; j++) {
          map[i][j] = 4;
        }
      }
      if (i >= 10 && i <= 90) {
        map[i][20] = 4;
        map[i][80] = 4;
      }
    }

    // Diagonal roads
    for(let i = 0; i < 30; i++) {
      map[20 + i][20 + i] = 4;
      map[20 + i][80 - i] = 4;
    }
  }

  generateTerrain(map) {
    // Forest clusters
    for(let i = 0; i < 10; i++) {
      const centerX = Math.floor(Math.random() * 80 + 10);
      const centerY = Math.floor(Math.random() * 80 + 10);
      this.generateCluster(map, centerX, centerY, 2, 0.7); // 2 = trees
    }

    // Rock formations
    for(let i = 0; i < 8; i++) {
      const centerX = Math.floor(Math.random() * 80 + 10);
      const centerY = Math.floor(Math.random() * 80 + 10);
      this.generateCluster(map, centerX, centerY, 1, 0.5); // 1 = rocks
    }

    // Barriers/Walls
    for(let i = 0; i < 6; i++) {
      const startX = Math.floor(Math.random() * 80 + 10);
      const startY = Math.floor(Math.random() * 80 + 10);
      this.generateWall(map, startX, startY);
    }
  }

  generateCluster(map, centerX, centerY, type, density) {
    const radius = Math.floor(Math.random() * 5) + 3;
    for(let y = -radius; y <= radius; y++) {
      for(let x = -radius; x <= radius; x++) {
        if (Math.random() < density && 
            Math.hypot(x, y) <= radius &&
            centerY + y >= 0 && centerY + y < 100 &&
            centerX + x >= 0 && centerX + x < 100 &&
            map[centerY + y][centerX + x] === 0) {
          map[centerY + y][centerX + x] = type;
        }
      }
    }
  }

  generateWall(map, startX, startY) {
    const length = Math.floor(Math.random() * 8) + 4;
    const direction = Math.floor(Math.random() * 4);
    const dx = [1, 0, -1, 0][direction];
    const dy = [0, 1, 0, -1][direction];

    for(let i = 0; i < length; i++) {
      const x = startX + dx * i;
      const y = startY + dy * i;
      if (x >= 0 && x < 100 && y >= 0 && y < 100 && map[y][x] === 0) {
        map[y][x] = 3; // 3 = wall
      }
    }
  }

  generateWater(map) {
    // Main lake
    const centerX = 50;
    const centerY = 50;
    const radius = 10;
    
    for(let y = -radius; y <= radius; y++) {
      for(let x = -radius; x <= radius; x++) {
        if (Math.hypot(x, y) <= radius &&
            centerY + y >= 0 && centerY + y < 100 &&
            centerX + x >= 0 && centerX + x < 100) {
          map[centerY + y][centerX + x] = 5; // 5 = water
        }
      }
    }

    // Small ponds
    for(let i = 0; i < 5; i++) {
      const x = Math.floor(Math.random() * 80 + 10);
      const y = Math.floor(Math.random() * 80 + 10);
      this.generateCluster(map, x, y, 5, 0.8);
    }
  }

  generateStrategicPoints(map) {
    // Add bunkers or defensive positions
    for(let i = 0; i < 6; i++) {
      const x = Math.floor(Math.random() * 80 + 10);
      const y = Math.floor(Math.random() * 80 + 10);
      if (map[y][x] === 0) {
        this.generateBunker(map, x, y);
      }
    }
  }

  generateBunker(map, x, y) {
    const size = 3;
    for(let dy = -size; dy <= size; dy++) {
      for(let dx = -size; dx <= size; dx++) {
        if (Math.abs(dx) === size || Math.abs(dy) === size) {
          if (y + dy >= 0 && y + dy < 100 && x + dx >= 0 && x + dx < 100) {
            map[y + dy][x + dx] = 3; // Walls
          }
        }
      }
    }
  }

  generateVehicles() {
    const vehicleTypes = ['tank', 'jeep', 'lkw', 'schuetzenpanzer'];
    const vehicles = [];
    const vehicleCount = this.mode === 'SinglePlayer' ? 5 : 10;

    for(let i = 0; i < vehicleCount; i++) {
      let x, y, type;
      do {
        x = Math.random() * 100 * 40;
        y = Math.random() * 100 * 40;
        type = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
      } while (this.isInvalidPosition(x, y) || this.isPositionOccupied(x, y, vehicles));

      vehicles.push(new Vehicle(x, y, type));
    }
    return vehicles;
  }

  generatePowerUps() {
    const powerUps = [];
    const types = ['health', 'ammo', 'weapon_upgrade', 'speed_boost'];
    const powerUpCount = this.mode === 'SinglePlayer' ? 20 : 40;

    for(let i = 0; i < powerUpCount; i++) {
      let x, y, type;
      do {
        x = Math.random() * 100 * 40;
        y = Math.random() * 100 * 40;
        type = types[Math.floor(Math.random() * types.length)];
      } while (this.isInvalidPosition(x, y) || this.isPositionOccupied(x, y, powerUps, 50));

      powerUps.push({x, y, type});
    }
    return powerUps;
  }

  isInvalidPosition(x, y) {
    const tileX = Math.floor(x / 40);
    const tileY = Math.floor(y / 40);
    return tileX < 0 || tileX >= 100 || tileY < 0 || tileY >= 100 || 
           this.map[tileY][tileX] === 4 || this.map[tileY][tileX] === 5;
  }

  isPositionOccupied(x, y, entities, minDistance = 40) {
    return entities.some(entity => distance({x, y}, entity) < minDistance);
  }

  spawnEnemies(count) {
    for(let i = 0; i < count; i++) {
      let x, y;
      do {
        x = Math.random() * 100 * 40;
        y = Math.random() * 100 * 40;
      } while (
        this.isInvalidPosition(x, y) || 
        this.isPositionOccupied(x, y, this.enemies) ||
        this.players.some(p => distance({x, y}, p) < 200)
      );

      const enemy = new Human(x, y, '#FFD700', true);
      enemy.weapon = Math.random() < 0.3 ? 'Maschinengewehr' : 'Pistole';
      this.enemies.push(enemy);
    }
  }

  ensureSafeSpawns() {
    // Ensure players are not spawned on obstacles
    this.players.forEach(player => {
      while (isColliding(player, this.map) || this.vehicles.some(v => distance(player, v) < v.radius + player.radius + 10)) {
        player.x = Math.random() * 100 * 40;
        player.y = Math.random() * 100 * 40;
      }
    });

    // Ensure vehicles are not spawned on obstacles or overlapping with each other
    this.vehicles.forEach(vehicle => {
      while (isColliding(vehicle, this.map) || this.vehicles.some(v => v !== vehicle && distance(v, vehicle) < v.radius + vehicle.radius + 10)) {
        vehicle.x = Math.random() * 100 * 40;
        vehicle.y = Math.random() * 100 * 40;
      }
    });
  }

  getPlayerControls(index) {
    const keys = this.controls[index];
    return {
      forward: this.keys[keys.forward],
      backward: this.keys[keys.backward],
      left: this.keys[keys.left],
      right: this.keys[keys.right],
      shoot: this.keys[keys.shoot],
      action: this.keys[keys.action],
      switch: this.keys[keys.switch]
    };
  }

  handleVehicleInteraction(player, index) {
    const controls = this.getPlayerControls(index);
    if (controls.action) {
      if (player.vehicle) {
        // Exit vehicle
        if (player.role === 'driver') player.vehicle.driver = null;
        else if (player.role === 'gunner') player.vehicle.gunner = null;
        player.vehicle = null;
        player.role = null;
        player.x += Math.cos(player.angle) * 30;
        player.y += Math.sin(player.angle) * 30;
        document.getElementById(`vehicle${index+1}`).textContent = 'None';
        this.soundManager.playSound('exitVehicle');
      } else {
        // Enter nearest available vehicle
        const nearestVehicle = this.vehicles.find(v => 
          distance(player, v) < 50 && (!v.driver || !v.gunner));
        if (nearestVehicle) {
          if (!nearestVehicle.driver) {
            nearestVehicle.driver = player;
            player.vehicle = nearestVehicle;
            player.role = 'driver';
            this.soundManager.playSound('enterVehicle');
          } else if (!nearestVehicle.gunner) {
            nearestVehicle.gunner = player;
            player.vehicle = nearestVehicle;
            player.role = 'gunner';
            this.soundManager.playSound('enterVehicle');
          }
          document.getElementById(`vehicle${index+1}`).textContent = nearestVehicle.type;
        }
      }
    }
  }

  handleSwitchPosition(player, index) {
    const controls = this.getPlayerControls(index);
    if (controls.switch && player.vehicle) {
      const v = player.vehicle;
      if (player.role === 'driver' && !v.gunner) {
        v.driver = null;
        v.gunner = player;
        player.role = 'gunner';
        this.soundManager.playSound('switchSeat');
      } else if (player.role === 'gunner' && !v.driver) {
        v.gunner = null;
        v.driver = player;
        player.role = 'driver';
        this.soundManager.playSound('switchSeat');
      }
      document.getElementById(`vehicle${index+1}`).textContent = v.type;
    }
  }

  startGameLoop() {
    if (this.gameLoopRunning) return;
    this.gameLoopRunning = true;

    const gameLoop = () => {
      if (this.gameOver) return;

      const currentTime = Date.now();
      this.update(currentTime);
      this.render();

      requestAnimationFrame(gameLoop);
    };

    gameLoop();
  }

  update(currentTime) {
    // Update players
    this.players.forEach((player, index) => {
      if (player.health <= 0) return;
      
      // Get and apply controls
      const controls = this.getPlayerControls(index);
      player.update(controls, this.map, currentTime);
      
      // Handle vehicle interaction
      if (controls.action) {
        this.handleVehicleInteraction(player, index);
      }
      
      // Handle position switching
      if (controls.switch) {
        this.handleSwitchPosition(player, index);
      }

      // Handle shooting
      if (controls.shoot && player.ammo > 0 && player.canShoot) {
        this.createBullet(player, index);
        player.canShoot = false;
        setTimeout(() => { player.canShoot = true; }, 200);
        this.soundManager.playSound('shoot');
      }
    });

    // Update vehicles
    this.vehicles.forEach(vehicle => {
      vehicle.update(this.map);
    });

    // Update enemies
    this.enemies.forEach(enemy => {
      enemy.update(null, this.map, currentTime);
      if (enemy.canShoot && enemy.ammo > 0) {
        this.handleEnemyShooting(enemy, currentTime);
      }
    });

    // Update bullets
    this.updateBullets();

    // Update power-ups
    this.updatePowerUps(currentTime);

    // Update explosions
    this.updateExplosions();

    // Check wave progress
    this.checkWaveProgress();

    // Update UI
    this.updateUI();
  }

  createBullet(shooter, ownerIndex) {
    const shootAngle = shooter.vehicle ? 
      shooter.vehicle.angle + shooter.vehicle.turretAngle : 
      shooter.angle;
    
    let damage = 10; // Default damage
    switch(shooter.weapon) {
      case 'Maschinengewehr': damage = 5; break;
      case 'Schrotflinte': damage = 20; break;
      case 'Kanone': damage = 50; break;
    }

    this.bullets.push({
      x: shooter.vehicle ? 
        shooter.vehicle.x + Math.cos(shootAngle) * 30 : 
        shooter.x + Math.cos(shootAngle) * 15,
      y: shooter.vehicle ? 
        shooter.vehicle.y + Math.sin(shootAngle) * 30 : 
        shooter.y + Math.sin(shootAngle) * 15,
      angle: shootAngle,
      speed: 15,
      damage: damage,
      owner: ownerIndex,
      vehicle: shooter.vehicle
    });

    shooter.ammo--;
    if (shooter === this.players[0] || shooter === this.players[1]) {
      const playerIndex = this.players.indexOf(shooter);
      document.getElementById(`ammo${playerIndex + 1}`).textContent = shooter.ammo;
    }
  }

  handleEnemyShooting(enemy, currentTime) {
    const target = this.findNearestPlayer(enemy);
    if (target && distance(enemy, target) < 300 && 
        isInSight(enemy, target, enemy.angle, Math.PI / 2, 300)) {
      this.createBullet(enemy, this.players.length + this.enemies.indexOf(enemy));
      enemy.canShoot = false;
      setTimeout(() => { enemy.canShoot = true; }, 1000);
      this.soundManager.playSound('enemyShoot');
    }
  }

  findNearestPlayer(entity) {
    return this.players.reduce((nearest, player) => {
      if (player.health <= 0) return nearest;
      const dist = distance(entity, player);
      return !nearest || dist < distance(entity, nearest) ? player : nearest;
    }, null);
  }

  updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      
      // Move bullet
      bullet.x += Math.cos(bullet.angle) * bullet.speed;
      bullet.y += Math.sin(bullet.angle) * bullet.speed;

      // Check collisions
      if (this.handleBulletCollisions(bullet, i)) continue;

      // Remove bullets that go off-map
      if (this.isInvalidPosition(bullet.x, bullet.y)) {
        this.bullets.splice(i, 1);
      }
    }
  }

  handleBulletCollisions(bullet, bulletIndex) {
    // Check map collision
    if (isColliding({x: bullet.x, y: bullet.y}, this.map)) {
      this.bullets.splice(bulletIndex, 1);
      this.createExplosion(bullet.x, bullet.y, 1);
      this.soundManager.playSound('explosion');
      return true;
    }

    // Check player collisions
    for (let i = 0; i < this.players.length; i++) {
      if (this.handlePlayerBulletCollision(bullet, bulletIndex, this.players[i], i)) {
        return true;
      }
    }

    // Check enemy collisions
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.handleEnemyBulletCollision(bullet, bulletIndex, this.enemies[i], i)) {
        return true;
      }
    }

    // Check vehicle collisions
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      if (this.handleVehicleBulletCollision(bullet, bulletIndex, this.vehicles[i], i)) {
        return true;
      }
    }

    return false;
  }

  handlePlayerBulletCollision(bullet, bulletIndex, player, playerIndex) {
    if (bullet.owner !== playerIndex && 
        distance(bullet, player) < 20 && 
        player.health > 0) {
      
      if (this.mode === 'Cooperative' && bullet.owner < this.players.length) {
        return false; // Skip friendly fire in cooperative mode
      }

      player.health -= bullet.damage;
      document.getElementById(`health${playerIndex +1}`).textContent = 
        Math.max(player.health, 0);
      
      this.bullets.splice(bulletIndex, 1);
      this.createExplosion(bullet.x, bullet.y, 1);
      this.soundManager.playSound('hit');

      if (player.health <= 0) {
        if (this.mode === 'Versus') {
          this.endGame(`Player ${bullet.owner + 1} wins!`);
        } else if (this.mode === 'SinglePlayer' || 
                   this.players.every(p => p.health <= 0)) {
          this.endGame(`Game Over! Score: ${this.score}`);
        }
      }
      return true;
    }
    return false;
  }

  updateUI() {
    this.players.forEach((player, index) => {
      if (player.health > 0) {
        document.getElementById(`health${index+1}`).textContent = Math.max(player.health, 0);
        document.getElementById(`ammo${index+1}`).textContent = player.ammo;
        document.getElementById(`weapon${index+1}`).textContent = player.weapon;
        document.getElementById(`vehicle${index+1}`).textContent = 
          player.vehicle ? player.vehicle.type : 'None';
        document.getElementById(`posX${index+1}`).textContent = Math.round(player.x);
        document.getElementById(`posY${index+1}`).textContent = Math.round(player.y);
      }

      // Update interaction messages
      const message = document.getElementById(`message${index+1}`);
      if (!player.vehicle) {
        const nearestVehicle = this.vehicles.find(v => 
          distance(player, v) < 50 && (!v.driver || !v.gunner));
        if (nearestVehicle) {
          message.textContent = `Press ${this.controls[index].action} to enter vehicle`;
          message.style.display = 'block';
        } else {
          message.style.display = 'none';
        }
      } else {
        message.textContent = `Press ${this.controls[index].action} to exit vehicle`;
        message.style.display = 'block';
      }
    });
  }

  handleEnemyBulletCollision(bullet, bulletIndex, enemy, enemyIndex) {
    if (bullet.owner < this.players.length && distance(bullet, enemy) < 20) {
      enemy.health -= bullet.damage;
      this.bullets.splice(bulletIndex, 1);
      this.createExplosion(bullet.x, bullet.y, 1);
      this.soundManager.playSound('hit');
      
      if (enemy.health <= 0) {
        this.enemies.splice(enemyIndex, 1);
        this.score += 100;
        // Drop powerup with 30% chance
        if (Math.random() < 0.3) {
          this.powerUps.push({
            x: enemy.x,
            y: enemy.y,
            type: Math.random() < 0.5 ? 'health' : 'ammo'
          });
          this.soundManager.playSound('powerUpDrop');
        }
      }
      return true;
    }
    return false;
  }

  handleVehicleBulletCollision(bullet, bulletIndex, vehicle, vehicleIndex) {
    if (!bullet.vehicle || bullet.vehicle !== vehicle) {
      if (distance(bullet, vehicle) < 30) {
        vehicle.health -= bullet.damage;
        this.bullets.splice(bulletIndex, 1);
        this.createExplosion(bullet.x, bullet.y, vehicle.health <= 0 ? 2 : 1);
        this.soundManager.playSound('explosion');

        if (vehicle.health <= 0) {
          // Handle vehicle destruction
          this.handleVehicleDestruction(vehicle, vehicleIndex);
        }
        return true;
      }
    }
    return false;
  }

  handleVehicleDestruction(vehicle, vehicleIndex) {
    // Create large explosion
    this.createExplosion(vehicle.x, vehicle.y, 3);
    this.soundManager.playSound('explosion');

    // Eject occupants
    if (vehicle.driver) {
      vehicle.driver.health -= 50; // Damage from explosion
      vehicle.driver.vehicle = null;
      vehicle.driver.role = null;
      const driverIndex = this.players.indexOf(vehicle.driver);
      if (driverIndex !== -1) {
        document.getElementById(`health${driverIndex +1}`).textContent = 
          Math.max(vehicle.driver.health, 0);
        document.getElementById(`vehicle${driverIndex +1}`).textContent = 'None';
      }
    }
    
    if (vehicle.gunner) {
      vehicle.gunner.health -= 50;
      vehicle.gunner.vehicle = null;
      vehicle.gunner.role = null;
      const gunnerIndex = this.players.indexOf(vehicle.gunner);
      if (gunnerIndex !== -1) {
        document.getElementById(`health${gunnerIndex +1}`).textContent = 
          Math.max(vehicle.gunner.health, 0);
        document.getElementById(`vehicle${gunnerIndex +1}`).textContent = 'None';
      }
    }

    // Remove vehicle
    this.vehicles.splice(vehicleIndex, 1);

    // Add score if vehicle was destroyed by player
    this.score += 200;
  }

  updatePowerUps(currentTime) {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      
      // Check collision with players
      for (let player of this.players) {
        if (player.health <= 0) continue;
        
        if (distance(player, powerUp) < 20) {
          this.applyPowerUp(player, powerUp);
          this.powerUps.splice(i, 1);
          this.soundManager.playSound('powerUpCollect');
          break;
        }
      }
    }

    // Respawn power-ups if needed
    if (this.powerUps.length < 10) {
      this.addNewPowerUp();
    }
  }

  applyPowerUp(player, powerUp) {
    const playerIndex = this.players.indexOf(player);
    switch(powerUp.type) {
      case 'health':
        player.health = Math.min(100, player.health + 25);
        document.getElementById(`health${playerIndex +1}`).textContent = player.health;
        break;
      case 'ammo':
        player.ammo += 30;
        document.getElementById(`ammo${playerIndex +1}`).textContent = player.ammo;
        break;
      case 'weapon_upgrade':
        if (player.weapon === 'Pistole') {
          player.weapon = 'Maschinengewehr';
        } else if (player.weapon === 'Maschinengewehr') {
          player.weapon = 'Schrotflinte';
        }
        document.getElementById(`weapon${playerIndex +1}`).textContent = player.weapon;
        break;
      case 'speed_boost':
        player.maxSpeed *= 1.5;
        setTimeout(() => {
          player.maxSpeed /= 1.5;
        }, 10000); // 10 second boost
        break;
    }
  }

  addNewPowerUp() {
    let x, y, type;
    const types = ['health', 'ammo', 'weapon_upgrade', 'speed_boost'];
    do {
      x = Math.random() * 100 * 40;
      y = Math.random() * 100 * 40;
      type = types[Math.floor(Math.random() * types.length)];
    } while (this.isInvalidPosition(x, y) || this.isPositionOccupied(x, y, this.powerUps, 50));

    this.powerUps.push({x, y, type});
  }

  createExplosion(x, y, maxFrames) {
    this.explosions.push({x, y, frame: 0, maxFrames});
  }

  updateExplosions() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.frame++;
      if (explosion.frame >= explosion.maxFrames) {
        this.explosions.splice(i, 1);
      }
    }
  }

  checkWaveProgress() {
    if ((this.mode === 'SinglePlayer' || this.mode === 'Cooperative') && 
        this.enemies.length === 0) {
      this.wave++;
      const baseEnemies = this.mode === 'SinglePlayer' ? 5 : 8;
      this.spawnEnemies(baseEnemies + this.wave * 2);
      this.addWaveRewards();
    }
  }

  addWaveRewards() {
    // Add bonus power-ups between waves
    for (let i = 0; i < 3; i++) {
      this.addNewPowerUp();
    }
    
    // Add bonus score
    this.score += this.wave * 500;
    
    // Add a new vehicle occasionally
    if (this.wave % 3 === 0) {
      this.vehicles.push(...this.generateVehicles());
    }
  }

  render() {
    this.renderer.draw();
  }

  resetGame() {
    this.gameOver = false;
    this.wave = 1;
    this.score = 0;
    document.getElementById('gameOverScreen').classList.add('hidden');
    this.initGame();
  }

  endGame(message) {
    this.gameOver = true;
    const gameOverScreen = document.getElementById('gameOverScreen');
    const gameOverMessage = document.getElementById('gameOverMessage');
    gameOverMessage.textContent = `${message}\nWave: ${this.wave}\nScore: ${this.score}`;
    gameOverScreen.classList.remove('hidden');
  }
}

// SoundManager class to handle sound effects using Web Audio API
class SoundManager {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.sounds = {};
    this.initSounds();
  }

  initSounds() {
    this.sounds['shoot'] = () => this.playShootSound();
    this.sounds['enemyShoot'] = () => this.playEnemyShootSound();
    this.sounds['explosion'] = () => this.playExplosionSound();
    this.sounds['hit'] = () => this.playHitSound();
    this.sounds['powerUpCollect'] = () => this.playPowerUpCollectSound();
    this.sounds['powerUpDrop'] = () => this.playPowerUpDropSound();
    this.sounds['enterVehicle'] = () => this.playEnterVehicleSound();
    this.sounds['switchSeat'] = () => this.playSwitchSeatSound();
    this.sounds['exitVehicle'] = () => this.playExitVehicleSound(); // Added exitVehicle sound
  }

  playSound(soundName) {
    if (this.sounds[soundName]) {
      this.sounds[soundName]();
    }
  }

  playShootSound() {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, this.audioCtx.currentTime); // frequency in hertz
    osc.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  playEnemyShootSound() {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, this.audioCtx.currentTime);
    osc.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  playExplosionSound() {
    const bufferSize = 2 * this.audioCtx.sampleRate;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.connect(this.audioCtx.destination);
    noise.start();
  }

  playHitSound() {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
    osc.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  playPowerUpCollectSound() {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, this.audioCtx.currentTime);
    osc.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.2);
  }

  playPowerUpDropSound() {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
    osc.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.2);
  }

  playEnterVehicleSound() {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(550, this.audioCtx.currentTime);
    osc.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  playSwitchSeatSound() {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, this.audioCtx.currentTime);
    osc.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  playExitVehicleSound() { // New sound for exiting vehicle
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, this.audioCtx.currentTime);
    osc.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }
}
