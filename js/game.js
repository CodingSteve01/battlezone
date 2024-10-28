// js/game.js
import { Entity, Human, Vehicle, isColliding, isVehicleColliding, distance, isInSight } from './entities.js';
import { Renderer } from './renderer.js';

export class Game {
  constructor(mode) {
    this.mode = mode; // 'Cooperative' oder 'Versus'
    this.renderer = new Renderer(this);
    this.setupControls();
    this.setupModeDisplay();
    this.gameOver = false;
    this.gameLoopRunning = false; // Flag to prevent multiple loops
    this.initGame();
    this.gameLoop();
  }

  setupModeDisplay() {
    const modeDisplay = document.getElementById('modeDisplay');
    modeDisplay.textContent = `Mode: ${this.mode}`;
    modeDisplay.style.display = 'block';
  }

  initGame() {
    this.map = this.generateLogicalMap();
    this.players = [
      new Human(100, 100, '#4444ff'),
      new Human(100, 100, '#ff4444') // In Coop, starten beide am gleichen Ort
    ];
    this.vehicles = this.generateVehicles();
    // Assign the game reference to each vehicle
    this.vehicles.forEach(v => v.game = this);
    this.bullets = [];
    this.powerUps = this.generatePowerUps();
    this.kis = []; // KI-gesteuerte Gegner
    if (this.mode === 'Cooperative') {
      this.spawnKIs(30); // Erhöhte Anzahl an KI-Gegner
    }
    // Set initial positions based on mode
    if (this.mode === 'Cooperative') {
      // Set both players to start at same position
      this.players[1].x = this.players[0].x;
      this.players[1].y = this.players[0].y;
    } else {
      // Versus mode: separate start positions
      this.players[1].x = 3900;
      this.players[1].y = 3900;
    }
    // Sicherstellen, dass Spieler nicht auf Hindernissen spawnen
    this.players.forEach(player => {
      while (isColliding(player, this.map) || this.isPlayerOverlapping(player)) {
        player.x = Math.random() * 100 * 40; // MAP_SIZE * TILE_SIZE
        player.y = Math.random() * 100 * 40;
      }
    });
  }

  resetGame() {
    // Spielzustand zurücksetzen
    this.gameOver = false;
    document.getElementById('gameOverScreen').classList.add('hidden');
    this.map = this.generateLogicalMap();
    this.players.forEach((player, index) => {
      player.health = 100;
      player.ammo = 30;
      player.weapon = 'Pistole'; // Reset Weapon
      player.vehicle = null;
      player.role = null;
      player.canShoot = true; // Reset Schussflag
      if (this.mode === 'Cooperative') {
        player.x = 100;
        player.y = 100;
      } else {
        player.x = index === 0 ? 100 : 3900;
        player.y = index === 0 ? 100 : 3900;
      }
      // Sicherstellen, dass Spieler nicht auf Hindernissen oder anderen Spielern spawnen
      while (isColliding(player, this.map) || this.isPlayerOverlapping(player)) {
        player.x = Math.random() * 100 * 40;
        player.y = Math.random() * 100 * 40;
      }
      // Update HUD
      document.getElementById(`health${index+1}`).textContent = player.health;
      document.getElementById(`ammo${index+1}`).textContent = player.ammo;
      document.getElementById(`weapon${index+1}`).textContent = player.weapon;
      document.getElementById(`vehicle${index+1}`).textContent = 'None';
      document.getElementById(`posX${index+1}`).textContent = Math.round(player.x);
      document.getElementById(`posY${index+1}`).textContent = Math.round(player.y);
    });
    this.vehicles = this.generateVehicles();
    // Assign the game reference to each vehicle
    this.vehicles.forEach(v => v.game = this);
    this.bullets = [];
    this.powerUps = this.generatePowerUps();
    this.kis = [];
    if (this.mode === 'Cooperative') {
      this.spawnKIs(30);
    }
  }

  isPlayerOverlapping(newPlayer) {
    return this.players.some(player => distance(player, newPlayer) < 50 && player !== newPlayer);
  }

  generateLogicalMap() {
    const map = [];
    for(let y = 0; y < 100; y++) { // MAP_SIZE = 100
      const row = [];
      for(let x = 0; x < 100; x++) {
        // Logische Kartenerstellung mit Straßen und Landschaft
        if ((y === 20 || y === 80) && x > 10 && x < 90) {
          row.push(4); // Straße horizontal
        } else if ((x === 20 || x === 80) && y > 10 && y < 90) {
          row.push(4); // Straße vertikal
        } else {
          // Zufällige Platzierung von Bäumen, Felsen und Wasser
          if (Math.random() < 0.02) row.push(2); // 2 = Bäume
          else if (Math.random() < 0.02) row.push(1); // 1 = Felsen
          else if (Math.random() < 0.01) row.push(3); // 3 = Hindernisse (z.B. Wände)
          else if (y > 40 && y < 60 && x > 40 && x < 60) row.push(5); // 5 = Wasser
          else row.push(0); // 0 = Gras
        }
      }
      map.push(row);
    }
    return map;
  }

  generateVehicles() {
    const vehicleTypes = ['tank', 'jeep', 'lkw', 'schuetzenpanzer'];
    const vehicles = [];
    for(let i = 0; i < 10; i++) { // Anzahl der Fahrzeuge erhöhen
      let x, y, type;
      do {
        x = Math.random() * 100 * 40; // MAP_SIZE * TILE_SIZE
        y = Math.random() * 100 * 40;
        type = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
      } while (isColliding({x, y}, this.map) || this.isVehiclePlacementInvalid(x, y) || this.isVehicleOverlapping(x, y, vehicles));
      const vehicle = new Vehicle(x, y, type);
      vehicles.push(vehicle);
    }
    return vehicles;
  }

  isVehiclePlacementInvalid(x, y) {
    // Fahrzeuge nicht auf Straßen oder Wasser platzieren
    const tileX = Math.floor(x / 40);
    const tileY = Math.floor(y / 40);
    if (tileX < 0 || tileX >= 100 || tileY < 0 || tileY >= 100) return true; // Außen der Karte
    return this.map[tileY][tileX] === 4 || this.map[tileY][tileX] === 5;
  }

  isVehicleOverlapping(x, y, vehiclesList) {
    return vehiclesList.some(vehicle => distance(vehicle, {x, y}) < 40); // TILE_SIZE = 40
  }

  generatePowerUps() {
    const powerUps = [];
    for(let i = 0; i < 40; i++) { // Anzahl der Power-Ups erhöhen
      let x, y, type;
      do {
        x = Math.random() * 100 * 40;
        y = Math.random() * 100 * 40;
        type = Math.random() < 0.5 ? 'health' : 'ammo';
      } while (isColliding({x, y}, this.map) || this.isPowerUpOverlapping(x, y, powerUps));
      powerUps.push({x, y, type});
    }
    return powerUps;
  }

  isPowerUpOverlapping(x, y, powerUpsList) {
    return powerUpsList.some(pu => distance(pu, {x, y}) < 50);
  }

  spawnKIs(count) {
    for(let i = 0; i < count; i++) {
      let x, y;
      do {
        x = Math.random() * 100 * 40;
        y = Math.random() * 100 * 40;
      } while (isColliding({x, y}, this.map) || this.isTooCloseToPlayers(x, y) || this.isKIOverlapping(x, y));
      this.kis.push(new Human(x, y, '#FFD700')); // KI-Gegner in Gold (#FFD700)
    }
  }

  isKIOverlapping(x, y) {
    return this.kis.some(ki => distance(ki, {x, y}) < 40);
  }

  isTooCloseToPlayers(x, y) {
    return this.players.some(player => distance({x, y}, player) < 200); // Mindestabstand erhöhen
  }

  setupControls() {
    this.keys = {};
    this.controls = [
      { forward: 'ArrowUp', backward: 'ArrowDown', left: 'ArrowLeft', 
        right: 'ArrowRight', shoot: 'Space', action: 'Enter', switch: 'ShiftRight' },
      { forward: 'KeyW', backward: 'KeyS', left: 'KeyA', 
        right: 'KeyD', shoot: 'KeyF', action: 'KeyE', switch: 'KeyG' }
    ];
    
    // Event Listener für keydown
    window.addEventListener('keydown', (e) => {
      e.preventDefault(); // Verhindert Scrolling
      this.keys[e.code] = true;
    });
    
    // Event Listener für keyup
    window.addEventListener('keyup', (e) => {
      e.preventDefault();
      this.keys[e.code] = false;
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
        // Aussteigen
        if (player.role === 'driver') player.vehicle.driver = null;
        else if (player.role === 'gunner') player.vehicle.gunner = null;
        player.vehicle = null;
        player.role = null;
        player.x += Math.cos(player.angle) * 30;
        player.y += Math.sin(player.angle) * 30;
        document.getElementById(`vehicle${index+1}`).textContent = 'None';
      } else {
        // Nächstes Fahrzeug betreten
        const nearestVehicle = this.vehicles.find(v => 
          distance(player, v) < 50 && (!v.driver || !v.gunner));
        if (nearestVehicle) {
          if (!nearestVehicle.driver) {
            nearestVehicle.driver = player;
            player.vehicle = nearestVehicle;
            player.role = 'driver';
            document.getElementById(`vehicle${index+1}`).textContent = nearestVehicle.type;
          } else if (!nearestVehicle.gunner) {
            nearestVehicle.gunner = player;
            player.vehicle = nearestVehicle;
            player.role = 'gunner';
            document.getElementById(`vehicle${index+1}`).textContent = nearestVehicle.type;
          }
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
      } else if (player.role === 'gunner' && !v.driver) {
        v.gunner = null;
        v.driver = player;
        player.role = 'driver';
      }
      // Update vehicle status in HUD
      document.getElementById(`vehicle${index+1}`).textContent = v.type;
    }
  }

  updatePlayer(player, index) {
    const controls = this.getPlayerControls(index);
    
    // Fahrzeuginteraktion
    if (controls.action) {
      this.handleVehicleInteraction(player, index);
      this.keys[this.controls[index].action] = false; // Mehrfachauslösung verhindern
    }

    // Positionswechsel
    if (controls.switch) {
      this.handleSwitchPosition(player, index);
      this.keys[this.controls[index].switch] = false;
    }

    // Bewegung aktualisieren
    player.update(controls, this.map);

    // Update Position in HUD
    document.getElementById(`posX${index+1}`).textContent = Math.round(player.x);
    document.getElementById(`posY${index+1}`).textContent = Math.round(player.y);

    // Schießen
    if (controls.shoot && player.ammo > 0 && player.canShoot &&
        (!player.vehicle || (player.vehicle && player.role === 'gunner'))) {
      const shootAngle = player.vehicle ? 
        player.vehicle.angle + player.vehicle.turretAngle : 
        player.angle;
      
      // Bestimmen der Schadenshöhe basierend auf Waffe
      let damage = 10; // Standard Schaden
      if (player.weapon === 'Schrotflinte') damage = 20;
      else if (player.weapon === 'Maschinengewehr') damage = 5; // Mehrere Schüsse können erfolgen, aber limitierte Rate

      this.bullets.push({
        x: player.vehicle ? player.vehicle.x + Math.cos(shootAngle) * 30 : player.x + Math.cos(shootAngle) * 15,
        y: player.vehicle ? player.vehicle.y + Math.sin(shootAngle) * 30 : player.y + Math.sin(shootAngle) * 15,
        angle: shootAngle,
        speed: 15,
        damage: damage,
        owner: index,
        vehicle: player.vehicle // Reference to the vehicle if shooting from one
      });
      player.ammo--;
      document.getElementById(`ammo${index + 1}`).textContent = player.ammo;
      player.canShoot = false; // Verhindert weiteres Schießen bis Taste losgelassen wird
    }

    // Reset kannShoot Flag beim Loslassen der Schusstaste
    if (!controls.shoot && !player.canShoot) {
      player.canShoot = true;
    }
  }

  updateBullets() {
    for(let i = this.bullets.length -1; i >=0; i--){
      const bullet = this.bullets[i];
      bullet.x += Math.cos(bullet.angle) * bullet.speed;
      bullet.y += Math.sin(bullet.angle) * bullet.speed;
      
      // Kollision mit Karte
      const bulletEntity = { x: bullet.x, y: bullet.y };
      if (isColliding(bulletEntity, this.map)) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Kollision mit Spielern (im Versus-Modus auch andere Spieler)
      this.players.forEach((player, j) => {
        if (bullet.owner !== j && distance(bullet, player) < 20) {
          if (this.mode === 'Cooperative' || (this.mode === 'Versus' && j !== bullet.owner)) {
            player.health -= bullet.damage;
            document.getElementById(`health${j + 1}`).textContent = Math.max(player.health, 0);
            this.bullets.splice(i, 1);
            if (player.health <= 0) {
              if (this.mode === 'Versus') {
                this.endGame(`Player ${j + 1} wurde von Player ${bullet.owner + 1} getötet!`);
              } else {
                this.endGame(`Player ${j + 1} ist gestorben!`);
              }
              // Respawn Spieler
              this.respawnPlayer(j);
            }
          }
        }
      });

      // Kollision mit KI-Gegnern (nur im Kooperativen Modus)
      if (this.mode === 'Cooperative') {
        for(let j = this.kis.length -1; j >=0; j--){
          const ki = this.kis[j];
          if (bullet.owner < this.players.length && distance(bullet, ki) < 20) { // Bullet from player
            ki.health -= bullet.damage;
            this.bullets.splice(i, 1);
            if (ki.health <= 0) {
              this.kis.splice(j, 1);
            }
            break; // Exit loop since bullet is destroyed
          }
        }
      }

      // Kollision mit Fahrzeugen
      this.vehicles.forEach((vehicle, j) => {
        // Check if bullet owner is not the vehicle's owner
        let isOwnVehicle = false;
        if (bullet.vehicle && bullet.vehicle === vehicle) {
          isOwnVehicle = true;
        }
        if (!isOwnVehicle && distance(bullet, vehicle) < 30) {
          vehicle.health -= bullet.damage;
          // Update HUD für Spieler im Fahrzeug
          if (vehicle.driver) {
            const driverIndex = this.players.indexOf(vehicle.driver);
            if (driverIndex !== -1) {
              document.getElementById(`vehicle${driverIndex +1}`).textContent = vehicle.type;
            }
          }
          if (vehicle.gunner) {
            const gunnerIndex = this.players.indexOf(vehicle.gunner);
            if (gunnerIndex !== -1) {
              document.getElementById(`vehicle${gunnerIndex +1}`).textContent = vehicle.type;
            }
          }
          this.bullets.splice(i, 1);
          if (vehicle.health <= 0) {
            // Entferne zerstörtes Fahrzeug
            this.vehicles.splice(j, 1);
            // Entferne Fahrer und Gunners, falls vorhanden
            if (vehicle.driver) {
              vehicle.driver.vehicle = null;
              vehicle.driver.role = null;
              const driverIndex = this.players.indexOf(vehicle.driver);
              if (driverIndex !== -1) {
                document.getElementById(`vehicle${driverIndex +1}`).textContent = 'None';
              }
            }
            if (vehicle.gunner) {
              vehicle.gunner.vehicle = null;
              vehicle.gunner.role = null;
              const gunnerIndex = this.players.indexOf(vehicle.gunner);
              if (gunnerIndex !== -1) {
                document.getElementById(`vehicle${gunnerIndex +1}`).textContent = 'None';
              }
            }
          }
        }
      });

      // Kollision mit anderen Fahrzeugen (Überfahren)
      for(let j = 0; j < this.vehicles.length; j++) {
        for(let k = j + 1; k < this.vehicles.length; k++) {
          const vehicleA = this.vehicles[j];
          const vehicleB = this.vehicles[k];
          if (distance(vehicleA, vehicleB) < 40) { // TILE_SIZE = 40
            // Überfahrkollision: Schaden zufügen
            vehicleA.health -= 5;
            vehicleB.health -= 5;
            if (vehicleA.health <= 0) {
              // Entferne zerstörtes Fahrzeug
              this.vehicles.splice(j, 1);
              // Entferne Fahrer und Gunners, falls vorhanden
              if (vehicleA.driver) {
                vehicleA.driver.vehicle = null;
                vehicleA.driver.role = null;
                const driverIndex = this.players.indexOf(vehicleA.driver);
                if (driverIndex !== -1) {
                  document.getElementById(`vehicle${driverIndex +1}`).textContent = 'None';
                }
              }
              if (vehicleA.gunner) {
                vehicleA.gunner.vehicle = null;
                vehicleA.gunner.role = null;
                const gunnerIndex = this.players.indexOf(vehicleA.gunner);
                if (gunnerIndex !== -1) {
                  document.getElementById(`vehicle${gunnerIndex +1}`).textContent = 'None';
                }
              }
              k--; // Adjust index after removal
            }
            if (vehicleB.health <= 0) {
              // Entferne zerstörtes Fahrzeug
              this.vehicles.splice(k, 1);
              // Entferne Fahrer und Gunners, falls vorhanden
              if (vehicleB.driver) {
                vehicleB.driver.vehicle = null;
                vehicleB.driver.role = null;
                const driverIndex = this.players.indexOf(vehicleB.driver);
                if (driverIndex !== -1) {
                  document.getElementById(`vehicle${driverIndex +1}`).textContent = 'None';
                }
              }
              if (vehicleB.gunner) {
                vehicleB.gunner.vehicle = null;
                vehicleB.gunner.role = null;
                const gunnerIndex = this.players.indexOf(vehicleB.gunner);
                if (gunnerIndex !== -1) {
                  document.getElementById(`vehicle${gunnerIndex +1}`).textContent = 'None';
                }
              }
              j--; // Adjust index after removal
            }
          }
        }
      }
    }
  }

  drawEntities() {
    // Rendering wird in Renderer-Klasse gehandhabt
  }

  checkPowerUpCollisions() {
    this.players.forEach((player, i) => {
      this.powerUps.forEach((powerUp, index) => {
        if (distance(player, powerUp) < 20) {
          if (powerUp.type === 'health') {
            player.health = Math.min(100, player.health + 25);
          } else {
            player.ammo += 20;
          }
          this.powerUps.splice(index, 1);
          // Update HUD
          document.getElementById(`health${i+1}`).textContent = player.health;
          document.getElementById(`ammo${i+1}`).textContent = player.ammo;
          // Power-Up nach 10 Sekunden neu spawnen
          setTimeout(() => {
            let x, y, type;
            do {
              x = Math.random() * 100 * 40;
              y = Math.random() * 100 * 40;
              type = Math.random() < 0.5 ? 'health' : 'ammo';
            } while (isColliding({x, y}, this.map) || this.isPowerUpOverlapping(x, y, this.powerUps));
            this.powerUps.push({
              x: x,
              y: y,
              type: type
            });
          }, 10000);
        }
      });
    });

    // Power-Ups für KI-Gegner (nur im Kooperativen Modus)
    if (this.mode === 'Cooperative') {
      this.kis.forEach((ki, j) => {
        this.powerUps.forEach((powerUp, index) => {
          if (distance(ki, powerUp) < 20) {
            if (powerUp.type === 'health') {
              ki.health = Math.min(100, ki.health + 25);
            } else {
              ki.ammo += 20;
            }
            this.powerUps.splice(index, 1);
            // Power-Up nach 10 Sekunden neu spawnen
            setTimeout(() => {
              let x, y, type;
              do {
                x = Math.random() * 100 * 40;
                y = Math.random() * 100 * 40;
                type = Math.random() < 0.5 ? 'health' : 'ammo';
              } while (isColliding({x, y}, this.map) || this.isPowerUpOverlapping(x, y, this.powerUps));
              this.powerUps.push({
                x: x,
                y: y,
                type: type
              });
            }, 10000);
          }
        });
      });
    }
  }

  updateKIs() {
    this.kis.forEach(ki => {
      if (ki.health <= 0) return; // Tote KI überspringen
      // KI-Verhalten: Halte Abstand zu Spielern und bewege dich in Richtung
      const target = this.players.reduce((nearest, player) => {
        const dist = distance(ki, player);
        return dist < distance(ki, nearest) ? player : nearest;
      }, this.players[0]);

      const angleToTarget = Math.atan2(target.y - ki.y, target.x - ki.x);
      const distanceToTarget = distance(ki, target);

      // Halte einen Mindestabstand
      if (distanceToTarget > 200) { // Erhöhter Mindestabstand
        ki.angle = angleToTarget;
        ki.speed = ki.maxSpeed;
      } else {
        ki.speed = 0;
      }

      ki.move(this.map);

      // Verhindere, dass KI sich über Spieler bewegt
      if (distanceToTarget < 100) {
        ki.x -= Math.cos(angleToTarget) * ki.speed;
        ki.y -= Math.sin(angleToTarget) * ki.speed;
        ki.speed = 0;
      }

      // KI schießt, wenn nahe genug und Sichtfeld trifft
      if (distanceToTarget < 300 && ki.ammo > 0 && distanceToTarget > 50 &&
          isInSight(ki, target, ki.angle, Math.PI / 2, 300)) { // Sichtfeld geprüft
        this.bullets.push({
          x: ki.vehicle ? ki.vehicle.x + Math.cos(angleToTarget) * 30 : ki.x + Math.cos(angleToTarget) * 15,
          y: ki.vehicle ? ki.vehicle.y + Math.sin(angleToTarget) * 30 : ki.y + Math.sin(angleToTarget) * 15,
          angle: angleToTarget,
          speed: 15,
          damage: 10,
          owner: this.players.length + this.kis.indexOf(ki),
          vehicle: ki.vehicle
        });
        ki.ammo--;
      }

      // Fahrzeugkollisionen für KI
      if (ki.vehicle) {
        const v = ki.vehicle;
        if (isVehicleColliding(v, this.vehicles)) { // Korrigiert: game.vehicles → this.vehicles
          v.x -= Math.cos(v.angle) * v.speed;
          v.y -= Math.sin(v.angle) * v.speed;
          v.speed = 0;
        }
      }
    });
  }

  gameLoop() {
    if (this.gameOver) return;
    if (this.gameLoopRunning) return; // Prevent multiple loops
    this.gameLoopRunning = true;

    const loop = () => {
      if (this.gameOver) return;

      // Spielzustand aktualisieren
      this.players.forEach((p, i) => this.updatePlayer(p, i));
      this.vehicles.forEach(v => v.update(this.map));
      this.updateBullets();
      this.checkPowerUpCollisions();
      if (this.mode === 'Cooperative') {
        this.updateKIs();
      }

      // UI aktualisieren
      this.players.forEach((p, i) => {
        document.getElementById(`health${i+1}`).textContent = Math.max(p.health, 0);
        document.getElementById(`ammo${i+1}`).textContent = p.ammo;
        document.getElementById(`weapon${i+1}`).textContent = p.weapon;
        document.getElementById(`vehicle${i+1}`).textContent = p.vehicle ? p.vehicle.type : 'None';
        document.getElementById(`posX${i+1}`).textContent = Math.round(p.x);
        document.getElementById(`posY${i+1}`).textContent = Math.round(p.y);
      });

      // Rendern
      this.renderer.ctx1.clearRect(0, 0, window.innerWidth / 2, window.innerHeight);
      this.renderer.ctx2.clearRect(0, 0, window.innerWidth / 2, window.innerHeight);
      this.renderer.drawGame(this.renderer.ctx1, 0);
      this.renderer.drawGame(this.renderer.ctx2, 1);

      requestAnimationFrame(loop);
    };

    loop();
  }

  endGame(message) {
    this.gameOver = true;
    const gameOverScreen = document.getElementById('gameOverScreen');
    const gameOverMessage = document.getElementById('gameOverMessage');
    gameOverMessage.textContent = message;
    gameOverScreen.classList.remove('hidden');
  }

  respawnPlayer(index) {
    const player = this.players[index];
    player.health = 100;
    player.ammo = 30;
    player.weapon = 'Pistole'; // Reset Weapon
    // Setze Spieler zurück zum Startpunkt
    player.x = this.mode === 'Cooperative' ? 100 : (index === 0 ? 100 : 3900);
    player.y = this.mode === 'Cooperative' ? 100 : (index === 0 ? 100 : 3900);
    // Sicherstellen, dass Spieler nicht auf Hindernissen oder anderen Spielern spawnen
    while (isColliding(player, this.map) || this.isPlayerOverlapping(player)) {
      player.x = Math.random() * 100 * 40;
      player.y = Math.random() * 100 * 40;
    }
    // Update HUD
    document.getElementById(`health${index+1}`).textContent = player.health;
    document.getElementById(`ammo${index+1}`).textContent = player.ammo;
    document.getElementById(`weapon${index+1}`).textContent = player.weapon;
    document.getElementById(`posX${index+1}`).textContent = Math.round(player.x);
    document.getElementById(`posY${index+1}`).textContent = Math.round(player.y);
  }
}
