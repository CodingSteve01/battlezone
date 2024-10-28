// entities.js
// Core entity class for shared properties and basic movement
export class Entity {
    constructor(x, y, angle = 0, radius = 20) {
      this.x = x;
      this.y = y;
      this.angle = angle;
      this.speed = 0;
      this.turnSpeed = 0;
      this.radius = radius; // Added radius for scaling and collision
    }
  
    move(map) {
      const newAngle = this.angle + this.turnSpeed;
      const newX = this.x + Math.cos(newAngle) * this.speed;
      const newY = this.y + Math.sin(newAngle) * this.speed;
  
      // Temporary position for collision detection
      const tempEntity = { x: newX, y: newY, radius: this.radius };
      if (!isColliding(tempEntity, map)) {
        this.angle = newAngle;
        this.x = newX;
        this.y = newY;
      } else {
        // Reduce speed on collision
        this.speed *= 0.5;
      }
    }
  
    // Add water movement mechanics
    handleWaterMovement(map) {
      const tileX = Math.floor(this.x / 40);
      const tileY = Math.floor(this.y / 40);
      
      if (tileX >= 0 && tileX < 100 && tileY >= 0 && tileY < 100) {
        if (map[tileY][tileX] === 5) { // Water tile
          this.speed *= 0.7; // Slower in water
          return true;
        }
      }
      return false;
    }
  }
  
  export class Human extends Entity {
    constructor(x, y, color, isAI = false) {
      super(x, y, 0, 15); // Reduced radius for players
      this.type = 'human';
      this.color = color;
      this.health = 100;
      this.ammo = 30;
      this.weapon = 'Pistol';
      this.maxSpeed = 3;
      this.vehicle = null;
      this.role = null;
      this.canShoot = true;
      this.isAI = isAI;
      this.lastShootTime = 0;
      this.shootCooldown = 500; // Milliseconds between shots
      this.killCount = 0;
      
      // AI specific properties
      if (isAI) {
        this.targetUpdateInterval = 1000;
        this.lastTargetUpdate = 0;
        this.currentTarget = null;
        this.aiState = 'patrol'; // patrol, chase, attack, flee
        this.patrolPoints = this.generatePatrolPoints();
        this.currentPatrolIndex = 0;
      }
    }
  
    generatePatrolPoints() {
      // Generate random patrol points within the map
      const points = [];
      for (let i = 0; i < 5; i++) {
        points.push({
          x: Math.random() * 4000,
          y: Math.random() * 4000
        });
      }
      return points;
    }
  
    update(controls, map, currentTime) {
      if (this.isAI) {
        this.updateAI(map, currentTime);
      } else if (this.vehicle) {
        if (this.role === 'driver') {
          this.updateVehicleControls(controls, map);
        } else if (this.role === 'gunner') {
          this.updateGunnerControls(controls);
        }
      } else {
        this.updateHumanControls(controls, map);
      }
  
      // Handle water movement
      this.handleWaterMovement(map);
    }
  
    updateHumanControls(controls, map) {
      // Movement controls
      if (controls.forward) this.speed = Math.min(this.maxSpeed, this.speed + 0.2);
      if (controls.backward) this.speed = Math.max(-this.maxSpeed / 2, this.speed - 0.2);
      if (!controls.forward && !controls.backward) this.speed *= 0.9;
      if (controls.left) this.angle -= 0.05;
      if (controls.right) this.angle += 0.05;
  
      // Apply movement
      this.move(map);
    }
  
    updateVehicleControls(controls, map) {
      const v = this.vehicle;
      if (!v) return;
  
      // Vehicle movement
      if (controls.forward) v.speed = Math.min(v.maxSpeed, v.speed + v.acceleration);
      if (controls.backward) v.speed = Math.max(-v.maxSpeed / 2, v.speed - v.acceleration);
      if (!controls.forward && !controls.backward) v.speed *= v.friction;
      if (controls.left) v.turnSpeed = -v.turnRate;
      if (controls.right) v.turnSpeed = v.turnRate;
      if (!controls.left && !controls.right) v.turnSpeed = 0;
  
      // Apply vehicle movement
      v.move(map);
  
      // Vehicle collision handling
      if (isVehicleColliding(v, v.game.vehicles)) {
        v.x -= Math.cos(v.angle) * v.speed;
        v.y -= Math.sin(v.angle) * v.speed;
        v.speed = 0;
      }
    }
  
    updateGunnerControls(controls) {
      const v = this.vehicle;
      if (!v) return;
  
      // Turret rotation
      if (controls.left) v.turretAngle = Math.max(-Math.PI / 2, v.turretAngle - 0.05);
      if (controls.right) v.turretAngle = Math.min(Math.PI / 2, v.turretAngle + 0.05);
    }
  
    updateAI(map, currentTime) {
      if (currentTime - this.lastTargetUpdate > this.targetUpdateInterval) {
        this.updateAITarget();
        this.lastTargetUpdate = currentTime;
      }
  
      switch (this.aiState) {
        case 'patrol':
          this.performPatrol(map);
          break;
        case 'chase':
          this.performChase(map);
          break;
        case 'attack':
          this.performAttack(map);
          break;
        case 'flee':
          this.performFlee(map);
          break;
      }
    }
  
    updateAITarget() {
      // Find nearest player or vehicle
      const targets = [...this.game.players, ...this.game.vehicles];
      if (targets.length > 0) {
        this.currentTarget = targets.reduce((nearest, target) => {
          const dist = distance(this, target);
          return dist < distance(this, nearest) ? target : nearest;
        }, targets[0]);
  
        // Update AI state based on conditions
        const distanceToTarget = distance(this, this.currentTarget);
        if (this.health < 30) {
          this.aiState = 'flee';
        } else if (distanceToTarget < 200 && this.ammo > 0) {
          this.aiState = 'attack';
        } else if (distanceToTarget < 400) {
          this.aiState = 'chase';
        } else {
          this.aiState = 'patrol';
        }
      }
    }
  
    performPatrol(map) {
      if (this.patrolPoints.length === 0) return;
      const targetPoint = this.patrolPoints[this.currentPatrolIndex];
      
      const angleToPoint = Math.atan2(targetPoint.y - this.y, targetPoint.x - this.x);
      const angleDiff = normalizeAngle(angleToPoint - this.angle);
      
      if (Math.abs(angleDiff) > 0.1) {
        this.angle += Math.sign(angleDiff) * 0.05;
      } else {
        this.angle = angleToPoint;
        this.speed = this.maxSpeed * 0.5;
        if (distance(this, targetPoint) < 50) {
          this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
        }
      }
      
      this.move(map);
    }
  
    performChase(map) {
      if (!this.currentTarget) return;
  
      // Calculate angle to target
      const angleToTarget = Math.atan2(
        this.currentTarget.y - this.y,
        this.currentTarget.x - this.x
      );
  
      // Rotate towards target
      const angleDiff = normalizeAngle(angleToTarget - this.angle);
      this.angle += Math.sign(angleDiff) * 0.05;
  
      // Move towards target
      this.speed = this.maxSpeed;
      this.move(map);
    }
  
    performAttack(map) {
      if (!this.currentTarget) return;
  
      const distanceToTarget = distance(this, this.currentTarget);
      if (distanceToTarget < 300 && this.ammo > 0) {
        // Face target
        const angleToTarget = Math.atan2(
          this.currentTarget.y - this.y,
          this.currentTarget.x - this.x
        );
        this.angle = angleToTarget;
  
        // Shoot if conditions met
        if (this.canShoot) {
          // Shooting logic handled by game class
          this.canShoot = false;
          setTimeout(() => { this.canShoot = true; }, this.shootCooldown);
          this.game.createBullet(this, this.game.players.length + this.enemies.indexOf(this));
        }
      }
    }
  
    performFlee(map) {
      if (!this.currentTarget) return;
  
      // Calculate angle away from target
      const angleFromTarget = Math.atan2(
        this.y - this.currentTarget.y,
        this.x - this.currentTarget.x
      );
  
      // Rotate away from target
      const angleDiff = normalizeAngle(angleFromTarget - this.angle);
      this.angle += Math.sign(angleDiff) * 0.05;
  
      // Move away at max speed
      this.speed = this.maxSpeed;
      this.move(map);
    }
  }
  
  export class Vehicle extends Entity {
    constructor(x, y, type) {
      super(x, y, 0, 25); // Increased radius for vehicles
      this.type = type;
      this.health = 200;
      this.driver = null;
      this.gunner = null;
      this.turretAngle = 0;
      this.game = null;
      this.size = 50; // Adjusted size for scaling
  
      // Set vehicle-specific properties
      this.setupVehicleProperties(type);
    }
  
    setupVehicleProperties(type) {
      const properties = {
        tank: {
          maxSpeed: 2,
          acceleration: 0.1,
          turnRate: 0.02,
          friction: 0.95,
          color: '#556677',
          weaponOffset: 25,
          weapon: 'Tank Cannon',
          ammo: 20,
          armor: 2.0
        },
        jeep: {
          maxSpeed: 4,
          acceleration: 0.2,
          turnRate: 0.04,
          friction: 0.92,
          color: '#887766',
          weaponOffset: 20,
          weapon: 'Machine Gun',
          ammo: 100,
          armor: 0.7
        },
        apc: {
          maxSpeed: 3,
          acceleration: 0.15,
          turnRate: 0.03,
          friction: 0.93,
          color: '#ff8800',
          weaponOffset: 30,
          weapon: 'Machine Gun',
          ammo: 200,
          armor: 1.5
        },
        truck: {
          maxSpeed: 3,
          acceleration: 0.15,
          turnRate: 0.03,
          friction: 0.93,
          color: '#666666',
          weaponOffset: 30,
          weapon: 'Machine Gun',
          ammo: 50,
          armor: 1.0
        }
      };
  
      const vehicleProps = properties[type] || properties.jeep;
      Object.assign(this, vehicleProps);
    }
  
    update(map) {
      if (this.driver) {
        this.move(map);
        this.handleWaterMovement(map);
        
        // Update positions of occupants
        if (this.driver) {
          this.driver.x = this.x;
          this.driver.y = this.y;
        }
        if (this.gunner) {
          this.gunner.x = this.x;
          this.gunner.y = this.y;
        }
      }
    }
  
    takeDamage(amount) {
      // Apply armor reduction to damage
      const actualDamage = amount / this.armor;
      this.health -= actualDamage;
      return this.health <= 0;
    }
  }
  
  // Helper functions
  export function isColliding(entity, map) {
    const TILE_SIZE = 40;
    const MAP_SIZE = 100;
    const tileX = Math.floor(entity.x / TILE_SIZE);
    const tileY = Math.floor(entity.y / TILE_SIZE);
    
    if (tileX < 0 || tileX >= MAP_SIZE || tileY < 0 || tileY >= MAP_SIZE) return true;
    
    // Check surrounding tiles for better collision detection
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkX = tileX + dx;
        const checkY = tileY + dy;
        if (checkX >= 0 && checkX < MAP_SIZE && checkY >= 0 && checkY < MAP_SIZE) {
          const tile = map[checkY][checkX];
          if (tile !== 0 && tile !== 4 && tile !== 5) { // Not grass, road, or water
            // Check detailed collision with tile
            const tileLeft = checkX * TILE_SIZE;
            const tileTop = checkY * TILE_SIZE;
            if (circleRectCollision(entity, tileLeft, tileTop, TILE_SIZE, TILE_SIZE)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
  
  export function isVehicleColliding(vehicle, vehicles) {
    return vehicles.some(v => 
      v !== vehicle && 
      distance(v, vehicle) < (v.radius + vehicle.radius) &&
      !v.driver?.isAI // Don't collide with AI vehicles
    );
  }
  
  export function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  
  export function isInSight(entity, target, angle, fov, range) {
    const dist = distance(entity, target);
    if (dist > range) return false;
    
    const angleToTarget = Math.atan2(target.y - entity.y, target.x - entity.x);
    let angleDiff = Math.abs(normalizeAngle(angle - angleToTarget));
    return angleDiff < fov / 2;
  }
  
  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
  
  function circleRectCollision(circle, rectX, rectY, rectWidth, rectHeight) {
    const testX = Math.max(rectX, Math.min(circle.x, rectX + rectWidth));
    const testY = Math.max(rectY, Math.min(circle.y, rectY + rectHeight));
    
    const distX = circle.x - testX;
    const distY = circle.y - testY;
    
    return (distX * distX + distY * distY) < (circle.radius * circle.radius);
  }
