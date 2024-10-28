// entities.js

export class Entity {
    constructor(x, y, angle = 0) {
      this.x = x;
      this.y = y;
      this.angle = angle;
      this.speed = 0;
      this.turnSpeed = 0;
      this.radius = 10;
      this.knockbackForce = 0;
      this.knockbackAngle = 0;
    }
  
    move(map) {
      // Apply any existing knockback
      if (this.knockbackForce > 0) {
        this.x += Math.cos(this.knockbackAngle) * this.knockbackForce;
        this.y += Math.sin(this.knockbackAngle) * this.knockbackForce;
        this.knockbackForce *= 0.8; // Reduce knockback force over time
        if (this.knockbackForce < 0.1) this.knockbackForce = 0;
      }

      const newAngle = this.angle + this.turnSpeed;
      const newX = this.x + Math.cos(newAngle) * this.speed;
      const newY = this.y + Math.sin(newAngle) * this.speed;
  
      const tempEntity = { x: newX, y: newY, radius: this.radius };
      if (!isColliding(tempEntity, map)) {
        this.angle = newAngle;
        this.x = newX;
        this.y = newY;
      } else {
        // Apply knockback on collision
        this.applyKnockback(5, this.angle + Math.PI);
        this.speed *= 0.5;
      }
    }

    applyKnockback(force, angle) {
      this.knockbackForce = force;
      this.knockbackAngle = angle;
    }
  }
  
  export class Human extends Entity {
    constructor(x, y, color, isEnemy = false) {
      super(x, y);
      this.type = 'human';
      this.color = color;
      this.maxHealth = isEnemy ? 100 : 200; // Players have more health
      this.health = this.maxHealth;
      this.ammo = 30;
      this.weapon = 'Pistole';
      this.maxSpeed = 3;
      this.vehicle = null;
      this.role = null;
      this.canShoot = true;
      this.isEnemy = isEnemy;

      // Equipment slots
      this.armor = null;
      this.camouflage = null;
      this.equipment = [];
      
      // AI properties
      this.state = 'patrol';
      this.targetPoint = null;
      this.lastStateChange = Date.now();
      this.patrolPoints = [];
      this.alertness = 0; // 0-100
      this.squad = null;
      this.lastKnownEnemyPosition = null;
      this.fleeThreshold = 30; // Health percentage to start fleeing
      this.visionRange = 300;
      this.visionAngle = Math.PI / 2;
    }

    getArmorValue() {
      return this.armor ? this.armor.protection : 0;
    }

    getCamouflageValue() {
      return this.camouflage ? this.camouflage.stealthBonus : 0;
    }
  
    takeDamage(damage) {
      const armorReduction = this.getArmorValue();
      const actualDamage = Math.max(1, damage - armorReduction);
      this.health -= actualDamage;
      
      if (this.isEnemy) {
        this.alertness = 100;
        if (this.health < this.maxHealth * (this.fleeThreshold / 100)) {
          this.state = 'flee';
        }
      }
      
      return this.health <= 0;
    }

    update(controls, map, currentTime, game) {
      if (this.isEnemy) {
        this.updateAI(currentTime, game);
      }
      
      if (this.vehicle) {
        if (this.role === 'driver') {
          this.updateVehicleControls(controls, map, game);
        } else if (this.role === 'gunner') {
          this.updateGunnerControls(controls);
        }
      } else {
        this.updateHumanControls(controls, map);
      }
    }

    updateAI(currentTime, game) {
      const timeSinceLastStateChange = currentTime - this.lastStateChange;

      // Check for player visibility
      const nearestPlayer = this.findNearestVisiblePlayer(game);

      if (nearestPlayer) {
        this.lastKnownEnemyPosition = { x: nearestPlayer.x, y: nearestPlayer.y };
        this.alertness = Math.min(100, this.alertness + 20);

        if (this.health < this.maxHealth * (this.fleeThreshold / 100)) {
          this.state = 'flee';
        } else {
          this.state = 'engage';
        }
      } else {
        this.alertness = Math.max(0, this.alertness - 0.1);
      }

      switch (this.state) {
        case 'patrol':
          this.updatePatrolState(currentTime);
          break;
        case 'engage':
          this.updateEngageState(nearestPlayer);
          break;
        case 'flee':
          this.updateFleeState(game);
          break;
        case 'investigate':
          this.updateInvestigateState();
          break;
      }

      // Squad communication
      if (this.squad && this.alertness > 50) {
        this.alertSquad();
      }
    }

    findNearestVisiblePlayer(game) {
      return game.players.reduce((nearest, player) => {
        if (player.health <= 0) return nearest;
        
        const dist = distance(this, player);
        const isVisible = this.canSeeTarget(player) && 
                         dist < this.visionRange * (1 - player.getCamouflageValue() / 100);
        
        return !nearest || (isVisible && dist < distance(this, nearest)) ? player : nearest;
      }, null);
    }

    canSeeTarget(target) {
      const angleToTarget = Math.atan2(target.y - this.y, target.x - this.x);
      let angleDiff = Math.abs(this.angle - angleToTarget);
      angleDiff = angleDiff > Math.PI ? 2 * Math.PI - angleDiff : angleDiff;
      return angleDiff < this.visionAngle / 2;
    }

    updatePatrolState(currentTime) {
      if (!this.targetPoint && this.patrolPoints.length > 0) {
        this.targetPoint = this.patrolPoints[Math.floor(Math.random() * this.patrolPoints.length)];
      }

      if (this.targetPoint) {
        const dist = distance(this, this.targetPoint);
        if (dist < 20) {
          this.targetPoint = null;
          this.lastStateChange = currentTime;
        } else {
          this.moveTowardsPoint(this.targetPoint);
        }
      }
    }

    updateEngageState(target) {
      if (!target) {
        if (this.lastKnownEnemyPosition) {
          this.state = 'investigate';
        } else {
          this.state = 'patrol';
        }
        return;
      }

      // Move to optimal combat distance
      const dist = distance(this, target);
      const optimalDistance = 150;
      
      if (dist > optimalDistance + 20) {
        this.moveTowardsPoint(target);
      } else if (dist < optimalDistance - 20) {
        this.moveAwayFromPoint(target);
      }

      // Face target
      const angleToTarget = Math.atan2(target.y - this.y, target.x - this.x);
      this.angle = angleToTarget;
    }

    updateFleeState(game) {
      // Find nearest cover or safe position
      const safePoint = this.findSafePoint(game);
      if (safePoint) {
        this.moveTowardsPoint(safePoint);
      } else {
        // If no safe point, move away from nearest player
        const nearestPlayer = this.findNearestVisiblePlayer(game);
        if (nearestPlayer) {
          this.moveAwayFromPoint(nearestPlayer);
        }
      }

      // Recover health over time when hidden
      if (this.alertness < 30) {
        this.health = Math.min(this.maxHealth, this.health + 0.1);
      }
    }

    updateInvestigateState() {
      if (!this.lastKnownEnemyPosition) {
        this.state = 'patrol';
        return;
      }

      const dist = distance(this, this.lastKnownEnemyPosition);
      if (dist < 20) {
        this.lastKnownEnemyPosition = null;
        this.state = 'patrol';
      } else {
        this.moveTowardsPoint(this.lastKnownEnemyPosition);
      }
    }

    moveTowardsPoint(point) {
      const angleToPoint = Math.atan2(point.y - this.y, point.x - this.x);
      this.angle = angleToPoint;
      this.speed = this.maxSpeed;
    }

    moveAwayFromPoint(point) {
      const angleFromPoint = Math.atan2(this.y - point.y, this.x - point.x);
      this.angle = angleFromPoint;
      this.speed = this.maxSpeed;
    }

    findSafePoint(game) {
      // Implementation to find nearest cover point (building, tree, etc.)
      return null; // Placeholder
    }

    alertSquad() {
      if (this.squad) {
        this.squad.forEach(member => {
          if (member !== this) {
            member.alertness = Math.max(member.alertness, 50);
            member.lastKnownEnemyPosition = this.lastKnownEnemyPosition;
          }
        });
      }
    }

    updateVehicleControls(controls, map, game) {
      const v = this.vehicle;
      if (!v) return;

      if (controls.forward) v.speed = Math.min(v.maxSpeed, v.speed + v.acceleration);
      if (controls.backward) v.speed = Math.max(-v.maxSpeed / 2, v.speed - v.acceleration);
      if (!controls.forward && !controls.backward) v.speed *= v.friction;
      if (controls.left) v.turnSpeed = -v.turnRate;
      if (controls.right) v.turnSpeed = v.turnRate;
      if (!controls.left && !controls.right) v.turnSpeed = 0;
      
      const oldX = v.x;
      const oldY = v.y;
      v.move(map);

      // Check for running over entities
      game.players.concat(game.enemies).forEach(entity => {
        if (entity !== this && !entity.vehicle && 
            distance(v, entity) < v.radius + entity.radius) {
          const damage = Math.abs(v.speed) * 20;
          entity.takeDamage(damage);
          entity.applyKnockback(Math.abs(v.speed) * 2, v.angle);
        }
      });
    }
  }
  
  export class Vehicle extends Entity {
    constructor(x, y, type) {
      super(x, y);
      this.type = type;
      this.maxHealth = 200;
      this.health = this.maxHealth;
      this.driver = null;
      this.gunner = null;
      this.turretAngle = 0;
      this.game = null;
      this.radius = 20;
  
      // Vehicle-specific properties
      switch(type) {
        case 'tank':
          this.maxSpeed = 2;
          this.acceleration = 0.1;
          this.turnRate = 0.02;
          this.friction = 0.95;
          this.color = '#556677';
          this.weaponOffset = 25;
          this.weapon = 'Kanone';
          this.ammo = 20;
          this.maxHealth = 300;
          this.health = this.maxHealth;
          break;
          
        case 'jeep':
          this.maxSpeed = 4;
          this.acceleration = 0.2;
          this.turnRate = 0.04;
          this.friction = 0.92;
          this.color = '#887766';
          this.weaponOffset = 20;
          this.weapon = 'Maschinengewehr';
          this.ammo = 50;
          break;
          
        case 'lkw':
          this.maxSpeed = 3;
          this.acceleration = 0.15;
          this.turnRate = 0.03;
          this.friction = 0.93;
          this.color = '#666666';
          this.weaponOffset = 30;
          this.weapon = 'Pistole';
          this.ammo = 30;
          break;
          
        case 'schuetzenpanzer':
          this.maxSpeed = 3;
          this.acceleration = 0.15;
          this.turnRate = 0.03;
          this.friction = 0.93;
          this.color = '#556677';
          this.weaponOffset = 30;
          this.weapon = 'Maschinengewehr';
          this.ammo = 100;
          this.maxHealth = 250;
          this.health = this.maxHealth;
          break;
      }
    }
  
    update(map) {
      if (this.knockbackForce > 0) {
        this.x += Math.cos(this.knockbackAngle) * this.knockbackForce;
        this.y += Math.sin(this.knockbackAngle) * this.knockbackForce;
        this.knockbackForce *= 0.8;
      }

      if (this.driver) {
        this.move(map);
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
  
    takeDamage(damage) {
      this.health -= damage;
      if (this.health <= 0) {
        if (this.driver) this.driver.vehicle = null;
        if (this.gunner) this.gunner.vehicle = null;
      }
      return this.health <= 0;
    }
  }

export function isColliding(entity, map) {
  const radius = entity.radius || 10;
  const checkPoints = [
    { x: entity.x - radius, y: entity.y - radius },
    { x: entity.x + radius, y: entity.y - radius },
    { x: entity.x - radius, y: entity.y + radius },
    { x: entity.x + radius, y: entity.y + radius },
    { x: entity.x, y: entity.y }
  ];

  return checkPoints.some(point => {
    const tileX = Math.floor(point.x / 40);
    const tileY = Math.floor(point.y / 40);
    
    if (tileX < 0 || tileX >= 100 || tileY < 0 || tileY >= 100) return true;
    
    const tile = map[tileY][tileX];
    // Allow movement on grass (0), roads (4), and shallow water (5)
    // Block movement on rocks (1), trees (2), walls (3), buildings (6), and deep water (7)
    return ![0, 4, 5].includes(tile);
  });
}
  
export function isVehicleColliding(vehicle, vehicles) {
  return vehicles.some(v => {
    if (v === vehicle) return false;
    
    const dist = distance(v, vehicle);
    if (dist < v.radius + vehicle.radius + 10) {
      // Apply knockback to both vehicles
      const angle = Math.atan2(v.y - vehicle.y, v.x - vehicle.x);
      const force = Math.abs(vehicle.speed) + Math.abs(v.speed);
      
      vehicle.applyKnockback(force, angle + Math.PI);
      v.applyKnockback(force, angle);
      
      return true;
    }
    return false;
  });
}
  
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
  
export function isInSight(entity, target, angle, fov, range) {
  const dist = distance(entity, target);
  if (dist > range) return false;
  
  // Check for line of sight obstructions
  const raySteps = Math.ceil(dist / 20); // Check every 20 units
  for (let i = 1; i < raySteps; i++) {
    const t = i / raySteps;
    const checkX = entity.x + (target.x - entity.x) * t;
    const checkY = entity.y + (target.y - entity.y) * t;
    const tileX = Math.floor(checkX / 40);
    const tileY = Math.floor(checkY / 40);
    
    if (tileX < 0 || tileX >= 100 || tileY < 0 || tileY >= 100) return false;
    
    // Check if tile blocks vision
    const tile = entity.game?.map[tileY][tileX];
    if (tile && [1, 2, 3, 6].includes(tile)) return false;
  }
  
  const angleToTarget = Math.atan2(target.y - entity.y, target.x - entity.x);
  let angleDifference = Math.abs(angle - angleToTarget);
  angleDifference = angleDifference > Math.PI ? 2 * Math.PI - angleDifference : angleDifference;
  
  // Apply stealth modifier if target has camouflage
  const stealthMod = target.getCamouflageValue ? target.getCamouflageValue() / 100 : 0;
  return angleDifference < fov / 2 * (1 - stealthMod);
}

// New classes for equipment system
export class Equipment {
  constructor(name, type, stats) {
    this.name = name;
    this.type = type;
    this.stats = stats;
  }
}

export class Weapon extends Equipment {
  constructor(name, stats) {
    super(name, 'weapon', stats);
    this.ammo = stats.maxAmmo;
    this.magazineSize = stats.magazineSize;
    this.reloadTime = stats.reloadTime;
    this.damage = stats.damage;
    this.range = stats.range;
    this.accuracy = stats.accuracy;
    this.fireRate = stats.fireRate;
    this.isReloading = false;
  }

  shoot() {
    if (this.ammo > 0 && !this.isReloading) {
      this.ammo--;
      return true;
    }
    return false;
  }

  reload() {
    if (!this.isReloading && this.ammo < this.magazineSize) {
      this.isReloading = true;
      setTimeout(() => {
        this.ammo = this.magazineSize;
        this.isReloading = false;
      }, this.reloadTime);
    }
  }
}

export class Armor extends Equipment {
  constructor(name, stats) {
    super(name, 'armor', stats);
    this.protection = stats.protection;
    this.mobility = stats.mobility;
    this.durability = stats.durability;
  }
}

export class Camouflage extends Equipment {
  constructor(name, stats) {
    super(name, 'camouflage', stats);
    this.stealthBonus = stats.stealthBonus;
    this.terrainBonus = stats.terrainBonus;
    this.mobilityPenalty = stats.mobilityPenalty;
  }
}

// Predefined equipment
export const WEAPONS = {
  pistol: new Weapon('Pistole', {
    damage: 20,
    range: 200,
    accuracy: 0.8,
    fireRate: 400,
    magazineSize: 12,
    maxAmmo: 48,
    reloadTime: 1500
  }),
  rifle: new Weapon('Gewehr', {
    damage: 35,
    range: 400,
    accuracy: 0.9,
    fireRate: 800,
    magazineSize: 30,
    maxAmmo: 90,
    reloadTime: 2000
  }),
  machineGun: new Weapon('Maschinengewehr', {
    damage: 25,
    range: 300,
    accuracy: 0.7,
    fireRate: 100,
    magazineSize: 100,
    maxAmmo: 300,
    reloadTime: 3000
  }),
  shotgun: new Weapon('Schrotflinte', {
    damage: 80,
    range: 100,
    accuracy: 0.6,
    fireRate: 800,
    magazineSize: 8,
    maxAmmo: 32,
    reloadTime: 2500
  }),
  sniper: new Weapon('Scharfschützengewehr', {
    damage: 100,
    range: 800,
    accuracy: 0.95,
    fireRate: 1200,
    magazineSize: 5,
    maxAmmo: 20,
    reloadTime: 2500
  })
};

export const ARMOR = {
  light: new Armor('Leichte Weste', {
    protection: 20,
    mobility: -5,
    durability: 100
  }),
  medium: new Armor('Mittlere Weste', {
    protection: 40,
    mobility: -15,
    durability: 150
  }),
  heavy: new Armor('Schwere Weste', {
    protection: 60,
    mobility: -30,
    durability: 200
  })
};

export const CAMOUFLAGE = {
  urban: new Camouflage('Urban Tarnung', {
    stealthBonus: 30,
    terrainBonus: ['city', 'building'],
    mobilityPenalty: -5
  }),
  woodland: new Camouflage('Wald Tarnung', {
    stealthBonus: 40,
    terrainBonus: ['forest', 'bush'],
    mobilityPenalty: -10
  }),
  desert: new Camouflage('Wüsten Tarnung', {
    stealthBonus: 35,
    terrainBonus: ['sand', 'rocks'],
    mobilityPenalty: -5
  }),
  ghillie: new Camouflage('Ghillie Anzug', {
    stealthBonus: 60,
    terrainBonus: ['forest', 'bush', 'grass'],
    mobilityPenalty: -20
  })
};