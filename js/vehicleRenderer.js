// vehicleRenderer.js
export class VehicleRenderer {
    constructor(mainRenderer) {
      this.mainRenderer = mainRenderer;
      this.game = mainRenderer.game;
    }
  
    draw(ctx, viewBounds) {
      // Draw all vehicles in view
      this.game.vehicles
        .filter(vehicle => this.isInView(vehicle, viewBounds))
        .sort((a, b) => a.y - b.y)
        .forEach(vehicle => this.drawVehicle(ctx, vehicle));
    }
  
    drawVehicle(ctx, vehicle) {
      ctx.save();
      ctx.translate(vehicle.x, vehicle.y);
      ctx.rotate(vehicle.angle);
  
      // Draw shadow
      this.drawShadow(ctx, vehicle);
  
      // Draw vehicle base
      switch(vehicle.type) {
        case 'tank':
          this.drawTank(ctx, vehicle);
          break;
        case 'jeep':
          this.drawJeep(ctx, vehicle);
          break;
        // Add more vehicle types...
        default:
          this.drawDefaultVehicle(ctx, vehicle);
      }
  
      ctx.restore();
    }
  
    drawShadow(ctx, vehicle) {
      const shadowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, vehicle.radius);
      shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
      shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = shadowGradient;
      ctx.beginPath();
      ctx.ellipse(2, 2, vehicle.radius, vehicle.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  
    drawTank(ctx, vehicle) {
      // Draw tracks
      ctx.fillStyle = this.mainRenderer.patterns.metal;
      ctx.fillRect(-20, -15, 40, 5);
      ctx.fillRect(-20, 10, 40, 5);
  
      // Draw hull
      const hullGradient = ctx.createLinearGradient(-15, -10, 15, 10);
      hullGradient.addColorStop(0, '#445566');
      hullGradient.addColorStop(1, '#334455');
      ctx.fillStyle = hullGradient;
      ctx.fillRect(-15, -10, 30, 20);
  
      // Draw turret
      ctx.save();
      ctx.rotate(vehicle.turretAngle);
      
      // Turret base
      const turretGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
      turretGradient.addColorStop(0, '#556677');
      turretGradient.addColorStop(1, '#445566');
      ctx.fillStyle = turretGradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Main gun
      ctx.fillStyle = '#334455';
      ctx.fillRect(0, -3, 25, 6);
      
      // Muzzle brake
      ctx.fillStyle = '#223344';
      ctx.fillRect(25, -4, 5, 8);
      
      ctx.restore();
      
      // Details
      this.drawTankDetails(ctx, vehicle);
      
      // Damage effects
      if (vehicle.health < vehicle.maxHealth) {
        this.drawDamageEffects(ctx, vehicle);
      }
    }
  
    drawTankDetails(ctx, vehicle) {
      // Rivets
      ctx.fillStyle = '#223344';
      const rivetPositions = [
        {x: -12, y: -8}, {x: -12, y: 8},
        {x: 0, y: -8}, {x: 0, y: 8},
        {x: 12, y: -8}, {x: 12, y: 8}
      ];
      
      rivetPositions.forEach(pos => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
  
      // Armor plates
      ctx.strokeStyle = '#334455';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-15, -10);
      ctx.lineTo(15, -10);
      ctx.lineTo(15, 10);
      ctx.lineTo(-15, 10);
      ctx.closePath();
      ctx.stroke();
    }
  
    drawJeep(ctx, vehicle) {
      // Wheels
      ctx.fillStyle = '#222';
      const wheelPositions = [
        {x: -12, y: -10}, {x: 12, y: -10},
        {x: -12, y: 10}, {x: 12, y: 10}
      ];
      
      wheelPositions.forEach(pos => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Wheel hub
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222'; // Reset fillStyle for next wheel
      });
  
      // Main body
      const bodyGradient = ctx.createLinearGradient(-15, -8, 15, 8);
      bodyGradient.addColorStop(0, vehicle.color);
      bodyGradient.addColorStop(1, this.darkenColor(vehicle.color, 20));
      ctx.fillStyle = bodyGradient;
      ctx.fillRect(-15, -8, 30, 16);
  
      // Windshield
      ctx.fillStyle = 'rgba(155, 155, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(-4, -12);
      ctx.lineTo(4, -12);
      ctx.lineTo(8, -8);
      ctx.closePath();
      ctx.fill();
  
      // Roll cage
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(-8, -14);
      ctx.lineTo(8, -14);
      ctx.lineTo(8, -8);
      ctx.stroke();
    }
  
    drawDefaultVehicle(ctx, vehicle) {
      // Fallback for undefined vehicle types
      ctx.fillStyle = '#888';
      ctx.fillRect(-10, -10, 20, 20);
    }
  
    drawDamageEffects(ctx, vehicle) {
      const damageLevel = 1 - (vehicle.health / vehicle.maxHealth);
      
      // Scorch marks
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      for (let i = 0; i < damageLevel * 8; i++) {
        const x = (Math.random() - 0.5) * 30;
        const y = (Math.random() - 0.5) * 20;
        const size = Math.random() * 4 + 2;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
  
      // Smoke for heavily damaged vehicles
      if (damageLevel > 0.6) {
        this.drawSmoke(ctx, vehicle, damageLevel);
      }
    }
  
    drawSmoke(ctx, vehicle, intensity) {
      const time = Date.now() / 1000;
      const particleCount = Math.floor(intensity * 8);
      
      for (let i = 0; i < particleCount; i++) {
        const offset = Math.sin(time * 2 + i) * 3;
        const alpha = (0.3 - (i * 0.03)) * intensity;
        const size = 3 + i + Math.sin(time * 3 + i) * 2;
        
        const gradient = ctx.createRadialGradient(
          offset, -i * 4, 0,
          offset, -i * 4, size
        );
        gradient.addColorStop(0, `rgba(80, 80, 80, ${alpha})`);
        gradient.addColorStop(1, 'rgba(80, 80, 80, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(offset, -i * 4, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  
    darkenColor(color, amount) {
      const hex = color.replace('#', '');
      const num = parseInt(hex, 16);
      const r = Math.max(0, (num >> 16) - amount);
      const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
      const b = Math.max(0, (num & 0x0000FF) - amount);
      return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    }
  
    isInView(vehicle, viewBounds) {
      const margin = Math.max(vehicle.radius, 30);
      return vehicle.x + margin > viewBounds.left &&
             vehicle.x - margin < viewBounds.right &&
             vehicle.y + margin > viewBounds.top &&
             vehicle.y - margin < viewBounds.bottom;
    }
  }
  