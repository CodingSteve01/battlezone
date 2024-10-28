// js/entities.js
export class Entity {
    constructor(x, y, angle = 0) {
      this.x = x;
      this.y = y;
      this.angle = angle;
      this.speed = 0;
      this.turnSpeed = 0;
    }
  
    move(map) {
      const newAngle = this.angle + this.turnSpeed;
      const newX = this.x + Math.cos(newAngle) * this.speed;
      const newY = this.y + Math.sin(newAngle) * this.speed;
  
      // Temporäre Position für Kollisionserkennung
      const tempEntity = { x: newX, y: newY };
      if (!isColliding(tempEntity, map)) {
        this.angle = newAngle;
        this.x = newX;
        this.y = newY;
      } else {
        // Bei Kollision Geschwindigkeit abbremsen
        this.speed *= 0.5;
      }
    }
  }
  
  export class Human extends Entity {
    constructor(x, y, color) {
      super(x, y);
      this.type = 'human';
      this.color = color;
      this.health = 100;
      this.ammo = 30;
      this.weapon = 'Pistole'; // Neue Eigenschaft für Weapon
      this.maxSpeed = 3;
      this.vehicle = null;
      this.role = null; // 'driver' oder 'gunner'
      this.canShoot = true; // Flag für Einzel-Schuss
    }
  
    update(controls, map) {
      if (this.vehicle) {
        if (this.role === 'driver') {
          this.updateVehicleControls(controls, map);
        } else if (this.role === 'gunner') {
          this.updateGunnerControls(controls);
        }
      } else {
        this.updateHumanControls(controls, map);
      }
    }
  
    updateHumanControls(controls, map) {
      if (controls.forward) this.speed = Math.min(this.maxSpeed, this.speed + 0.2);
      if (controls.backward) this.speed = Math.max(-this.maxSpeed / 2, this.speed - 0.2);
      if (!controls.forward && !controls.backward) this.speed *= 0.9;
      if (controls.left) this.angle -= 0.05;
      if (controls.right) this.angle += 0.05;
      this.move(map);
    }
  
    updateVehicleControls(controls, map) {
      const v = this.vehicle;
      if (controls.forward) v.speed = Math.min(v.maxSpeed, v.speed + v.acceleration);
      if (controls.backward) v.speed = Math.max(-v.maxSpeed / 2, v.speed - v.acceleration);
      if (!controls.forward && !controls.backward) v.speed *= v.friction;
      if (controls.left) v.turnSpeed = -v.turnRate;
      if (controls.right) v.turnSpeed = v.turnRate;
      if (!controls.left && !controls.right) v.turnSpeed = 0;
      v.move(map);
  
      // Fahrzeugkollisionen überprüfen
      if (isVehicleColliding(v, v.game.vehicles)) { // Korrigiert: game.vehicles → v.game.vehicles
        // Rückgängig machen der letzten Bewegung bei Kollision
        v.x -= Math.cos(v.angle) * v.speed;
        v.y -= Math.sin(v.angle) * v.speed;
        v.speed = 0;
      }
    }
  
    updateGunnerControls(controls) {
      const v = this.vehicle;
      if (controls.left) v.turretAngle = Math.max(-Math.PI / 2, v.turretAngle - 0.05);
      if (controls.right) v.turretAngle = Math.min(Math.PI / 2, v.turretAngle + 0.05);
    }
  }
  
  export class Vehicle extends Entity {
    constructor(x, y, type) {
      super(x, y);
      this.type = type;
      this.health = 200;
      // Neue Eigenschaft für Fahrzeug-Waffen
      this.weapon = type === 'tank' || type === 'schuetzenpanzer' ? 'Maschinengewehr' : 'Kanone';
      this.ammo = type === 'tank' ? 20 : type === 'schuetzenpanzer' ? 30 : 50;
      this.driver = null;
      this.gunner = null;
      this.turretAngle = 0;
      this.game = null; // Reference to the game instance
  
      // Fahrzeug-spezifische Eigenschaften
      switch(type) {
        case 'tank':
          this.maxSpeed = 2;
          this.acceleration = 0.1;
          this.turnRate = 0.02;
          this.friction = 0.95;
          this.color = '#556677';
          this.weaponOffset = 25;
          break;
        case 'jeep':
          this.maxSpeed = 4;
          this.acceleration = 0.2;
          this.turnRate = 0.04;
          this.friction = 0.92;
          this.color = '#887766';
          this.weaponOffset = 20;
          break;
        case 'lkw':
          this.maxSpeed = 3;
          this.acceleration = 0.15;
          this.turnRate = 0.03;
          this.friction = 0.93;
          this.color = '#666666';
          this.weaponOffset = 30;
          break;
        case 'schuetzenpanzer':
          this.maxSpeed = 3;
          this.acceleration = 0.15;
          this.turnRate = 0.03;
          this.friction = 0.93;
          this.color = '#ff8800';
          this.weaponOffset = 30;
          break;
        default:
          this.maxSpeed = 3;
          this.acceleration = 0.15;
          this.turnRate = 0.03;
          this.friction = 0.93;
          this.color = '#888888';
          this.weaponOffset = 25;
      }
    }
  
    update(map) {
      if (this.driver) {
        this.move(map);
        // Position der Insassen aktualisieren
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
  }
  
  // Hilfsfunktionen für Kollisionen und Abstände
  export function isColliding(entity, map) {
    const TILE_SIZE = 40;
    const MAP_SIZE = 100;
    const tileX = Math.floor(entity.x / TILE_SIZE);
    const tileY = Math.floor(entity.y / TILE_SIZE);
    if (tileX < 0 || tileX >= MAP_SIZE || tileY < 0 || tileY >= MAP_SIZE) return true; // Außen der Karte
    return map[tileY][tileX] !== 0 && map[tileY][tileX] !== 4 && map[tileY][tileX] !== 5; // 0 = Gras, 4 = Straße, 5 = Wasser
  }
  
  export function isVehicleColliding(vehicle, vehicles) {
    return vehicles.some(v => v !== vehicle && Math.hypot(v.x - vehicle.x, v.y - vehicle.y) < 40);
  }
  
  export function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  
  export function isInSight(entity, target, angle, fov, range) {
    const dist = distance(entity, target);
    if (dist > range) return false;
    const angleToTarget = Math.atan2(target.y - entity.y, target.x - entity.x);
    let angleDifference = Math.abs(angle - angleToTarget);
    angleDifference = angleDifference > Math.PI ? 2 * Math.PI - angleDifference : angleDifference;
    return angleDifference < fov / 2;
  }
  