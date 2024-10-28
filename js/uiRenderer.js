// uiRenderer.js
export class UIRenderer {
    constructor(mainRenderer) {
      this.mainRenderer = mainRenderer;
      this.game = mainRenderer.game;
    }
  
    draw(ctx, player) {
      // Reset transform for UI elements
      ctx.setTransform(1, 0, 0, 1, 0, 0);
  
      // Draw all UI elements
      this.drawHealthBar(ctx, player);
      this.drawAmmoCounter(ctx, player);
      this.drawMinimap(ctx, player);
  
      // Draw vehicle info if in vehicle
      if (player.vehicle) {
        this.drawVehicleInfo(ctx, player);
      }
  
      // Optionally draw game stats, objectives, notifications, and debug info
      this.drawGameStats(ctx);
      this.drawObjectives(ctx);
      this.drawNotifications(ctx);
      this.drawDebugInfo(ctx, player);
    }
  
    drawHealthBar(ctx, player) {
      const width = 200;
      const height = 20;
      const x = 20;
      const y = 20;
  
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x, y, width, height);
        
      // Health bar
      const healthPercent = player.health / player.maxHealth;
      const healthGradient = ctx.createLinearGradient(x, y, x + width, y);
      healthGradient.addColorStop(0, `rgb(${255 * (1-healthPercent)}, ${255 * healthPercent}, 0)`);
      healthGradient.addColorStop(1, `rgb(${200 * (1-healthPercent)}, ${200 * healthPercent}, 0)`);
      
      ctx.fillStyle = healthGradient;
      ctx.fillRect(x, y, width * healthPercent, height);
  
      // Health border
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
  
      // Health text
      ctx.fillStyle = '#FFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(player.health)} / ${player.maxHealth}`, x + width/2, y + height - 4);
    }
  
    drawAmmoCounter(ctx, player) {
      const x = 20;
      const y = 50;
      const size = 40;
  
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
      ctx.fill();
  
      // Ammo count
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(player.ammo.toString(), x + size/2, y + size/2);
  
      // Weapon icon
      this.drawWeaponIcon(ctx, player.weapon, x + size + 10, y + size/2 - 10);
    }
  
    drawWeaponIcon(ctx, weaponType, x, y) {
      ctx.save();
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
  
      switch(weaponType) {
        case 'Pistole':
          // Simple pistol icon
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 15, y);
          ctx.lineTo(x + 15, y + 8);
          ctx.lineTo(x + 8, y + 8);
          ctx.lineTo(x + 8, y + 12);
          ctx.stroke();
          break;
  
        case 'Maschinengewehr':
          // Machine gun icon
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 25, y);
          ctx.moveTo(x + 20, y - 3);
          ctx.lineTo(x + 25, y);
          ctx.lineTo(x + 20, y + 3);
          ctx.moveTo(x + 5, y);
          ctx.lineTo(x + 5, y + 10);
          ctx.stroke();
          break;
  
        case 'Schrotflinte':
          // Shotgun icon
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 20, y);
          ctx.moveTo(x + 15, y - 2);
          ctx.lineTo(x + 20, y - 2);
          ctx.moveTo(x + 15, y + 2);
          ctx.lineTo(x + 20, y + 2);
          ctx.stroke();
          break;
  
        default:
          // Default weapon icon
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 10, y + 5);
          ctx.lineTo(x, y + 10);
          ctx.stroke();
          break;
      }
  
      ctx.restore();
    }
  
    drawMinimap(ctx, player) {
      const size = 150;
      const margin = 20;
      const x = ctx.canvas.width - size - margin;
      const y = ctx.canvas.height - size - margin;
  
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x, y, size, size);
  
      // Map border
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, size, size);
  
      // Scale factors for minimap
      const mapWidth = this.game.map[0].length * 40;
      const mapHeight = this.game.map.length * 40;
      const scaleX = size / mapWidth;
      const scaleY = size / mapHeight;
  
      // Draw terrain
      for(let i = 0; i < this.game.map.length; i++) {
        for(let j = 0; j < this.game.map[i].length; j++) {
          const tileX = x + j * 40 * scaleX;
          const tileY = y + i * 40 * scaleY;
          const tileSize = 40 * scaleX;
  
          switch(this.game.map[i][j]) {
            case 1: // Walls
              ctx.fillStyle = '#555';
              ctx.fillRect(tileX, tileY, tileSize, tileSize);
              break;
            case 4: // Roads
              ctx.fillStyle = '#333';
              ctx.fillRect(tileX, tileY, tileSize, tileSize);
              break;
            case 5: // Water
              ctx.fillStyle = '#4444AA';
              ctx.fillRect(tileX, tileY, tileSize, tileSize);
              break;
            default:
              // Transparent for other tiles
              break;
          }
        }
      }
  
      // Draw entities
      this.drawMinimapEntities(ctx, x, y, scaleX, scaleY);
    }
  
    drawMinimapEntities(ctx, mapX, mapY, scaleX, scaleY) {
      // Draw vehicles
      this.game.vehicles.forEach(vehicle => {
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(
          mapX + vehicle.x * scaleX,
          mapY + vehicle.y * scaleY,
          3, 0, Math.PI * 2
        );
        ctx.fill();
      });
  
      // Draw enemies
      this.game.enemies.forEach(enemy => {
        ctx.fillStyle = '#F00';
        ctx.beginPath();
        ctx.arc(
          mapX + enemy.x * scaleX,
          mapY + enemy.y * scaleY,
          2, 0, Math.PI * 2
        );
        ctx.fill();
      });
  
      // Draw players
      this.game.players.forEach(player => {
        if (player.health <= 0) return;
  
        // Vision cone
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(mapX + player.x * scaleX, mapY + player.y * scaleY);
        ctx.arc(
          mapX + player.x * scaleX,
          mapY + player.y * scaleY,
          20 * scaleX, // Adjusted for scale
          player.angle - Math.PI/4,
          player.angle + Math.PI/4
        );
        ctx.closePath();
        ctx.fill();
  
        // Player dot
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(
          mapX + player.x * scaleX,
          mapY + player.y * scaleY,
          3, 0, Math.PI * 2
        );
        ctx.fill();
      });
    }
  
    drawVehicleInfo(ctx, player) {
      const vehicle = player.vehicle;
      const x = 20;
      const y = 100;
      const width = 180;
      const height = 60;
  
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x, y, width, height);
  
      // Vehicle icon
      this.drawVehicleIcon(ctx, vehicle.type, x + 10, y + height/2);
  
      // Vehicle info
      ctx.fillStyle = '#FFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`${vehicle.type}`, x + 50, y + 20);
      ctx.fillText(`Role: ${player.role}`, x + 50, y + 40);
  
      // Vehicle health
      const healthPercent = vehicle.health / vehicle.maxHealth;
      ctx.fillStyle = `rgb(${255 * (1-healthPercent)}, ${255 * healthPercent}, 0)`;
      ctx.fillRect(x + 10, y + height - 8, (width - 20) * healthPercent, 4);
      ctx.strokeStyle = '#FFF';
      ctx.strokeRect(x + 10, y + height - 8, width - 20, 4);
    }
  
    drawVehicleIcon(ctx, type, x, y) {
      ctx.save();
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
  
      switch(type) {
        case 'tank':
          // Simple tank icon
          ctx.strokeRect(x, y - 8, 20, 16);
          ctx.beginPath();
          ctx.arc(x + 12, y, 8, 0, Math.PI * 2);
          ctx.moveTo(x + 12, y);
          ctx.lineTo(x + 25, y);
          ctx.stroke();
          break;
  
        case 'jeep':
          // Simple jeep icon
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 20, y);
          ctx.lineTo(x + 15, y - 8);
          ctx.lineTo(x + 5, y - 8);
          ctx.closePath();
          ctx.stroke();
          break;
  
        case 'lkw':
          // Truck icon
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 10, y);
          ctx.lineTo(x + 10, y - 8);
          ctx.lineTo(x + 25, y - 8);
          ctx.lineTo(x + 25, y);
          ctx.lineTo(x + 30, y);
          ctx.stroke();
          // Wheels
          ctx.beginPath();
          ctx.arc(x + 5, y + 3, 2, 0, Math.PI * 2);
          ctx.arc(x + 15, y + 3, 2, 0, Math.PI * 2);
          ctx.arc(x + 25, y + 3, 2, 0, Math.PI * 2);
          ctx.fill();
          break;
  
        case 'schuetzenpanzer':
          // APC icon
          ctx.strokeRect(x, y - 6, 25, 12);
          // Tracks pattern
          for(let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x + i * 5, y - 8);
            ctx.lineTo(x + i * 5, y + 6);
            ctx.stroke();
          }
          // Turret
          ctx.beginPath();
          ctx.arc(x + 15, y, 6, 0, Math.PI * 2);
          ctx.moveTo(x + 15, y);
          ctx.lineTo(x + 25, y);
          ctx.stroke();
          break;
  
        default:
          // Default vehicle icon
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 15, y);
          ctx.lineTo(x + 15, y + 10);
          ctx.lineTo(x, y + 10);
          ctx.closePath();
          ctx.stroke();
          break;
      }
  
      ctx.restore();
    }
  
    drawGameStats(ctx) {
      const x = ctx.canvas.width - 200;
      const y = 20;
      const stats = this.game.getGameStats();
  
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x - 10, y - 10, 190, 80);
  
      ctx.fillStyle = '#FFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`Score: ${stats.score}`, x + 170, y + 10);
      ctx.fillText(`Wave: ${stats.wave}`, x + 170, y + 30);
      ctx.fillText(`Enemies: ${stats.enemiesRemaining}`, x + 170, y + 50);
      
      if (stats.timeLimit) {
        const timeLeft = Math.max(0, Math.ceil(stats.timeLimit - stats.elapsedTime));
        ctx.fillStyle = timeLeft < 30 ? '#FF4444' : '#FFF';
        ctx.fillText(`Time: ${timeLeft}s`, x + 170, y + 70);
      }
    }
  
    drawObjectives(ctx) {
      const objectives = this.game.getObjectives();
      if (!objectives.length) return;
  
      const x = 20;
      const y = ctx.canvas.height - 150;
  
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x, y, 250, 30 + objectives.length * 25);
  
      // Title
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Objectives:', x + 10, y + 20);
  
      // Objectives list
      ctx.font = '14px Arial';
      objectives.forEach((objective, index) => {
        const checkmark = objective.completed ? '✓' : '○';
        ctx.fillStyle = objective.completed ? '#88FF88' : '#FFF';
        ctx.fillText(`${checkmark} ${objective.description}`, x + 10, y + 45 + index * 25);
      });
    }
  
    drawNotifications(ctx) {
      const notifications = this.game.getNotifications();
      if (!notifications.length) return;
  
      ctx.save();
      ctx.translate(ctx.canvas.width / 2, 100);
  
      notifications.forEach((notification, index) => {
        const alpha = Math.min(1, notification.duration / 1000);
        const y = index * 30;
  
        if (notification.type === 'achievement') {
          this.drawAchievementNotification(ctx, notification, y, alpha);
        } else {
          this.drawStandardNotification(ctx, notification, y, alpha);
        }
      });
  
      ctx.restore();
    }
  
    drawAchievementNotification(ctx, achievement, y, alpha) {
      const width = 300;
      const height = 50;
      const x = -width / 2;
  
      // Background with glow
      ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
      ctx.fillRect(x, y, width, height);
      ctx.shadowBlur = 0;
  
      // Achievement icon
      ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 25, y + height/2, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`;
      ctx.fill();
  
      // Star in the icon
      const starPoints = 5;
      const outerRadius = 10;
      const innerRadius = 4;
      ctx.beginPath();
      for(let i = 0; i < starPoints * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / starPoints;
        const starX = x + 25 + radius * Math.cos(angle);
        const starY = y + height/2 + radius * Math.sin(angle);
        if(i === 0) ctx.moveTo(starX, starY);
        else ctx.lineTo(starX, starY);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.fill();
  
      // Text
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Achievement Unlocked!', x + 50, y + 20);
      
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = '12px Arial';
      ctx.fillText(achievement.text, x + 50, y + 40);
    }
  
    drawStandardNotification(ctx, notification, y, alpha) {
      const width = 200;
      const height = 30;
      const x = -width / 2;
  
      // Background
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
      ctx.fillRect(x, y, width, height);
  
      // Colored border based on notification type
      ctx.strokeStyle = this.getNotificationColor(notification.type, alpha);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
  
      // Text
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(notification.text, x + width/2, y + 20);
    }
  
    getNotificationColor(type, alpha) {
      switch(type) {
        case 'success':
          return `rgba(0, 255, 0, ${alpha})`;
        case 'warning':
          return `rgba(255, 255, 0, ${alpha})`;
        case 'danger':
          return `rgba(255, 0, 0, ${alpha})`;
        default:
          return `rgba(255, 255, 255, ${alpha})`;
      }
    }
  
    drawGameStats(ctx) {
      const x = ctx.canvas.width - 200;
      const y = 20;
      const stats = this.game.getGameStats();
  
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x - 10, y - 10, 190, 80);
  
      ctx.fillStyle = '#FFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`Score: ${stats.score}`, x + 170, y + 10);
      ctx.fillText(`Wave: ${stats.wave}`, x + 170, y + 30);
      ctx.fillText(`Enemies: ${stats.enemiesRemaining}`, x + 170, y + 50);
      
      if (stats.timeLimit) {
        const timeLeft = Math.max(0, Math.ceil(stats.timeLimit - stats.elapsedTime));
        ctx.fillStyle = timeLeft < 30 ? '#FF4444' : '#FFF';
        ctx.fillText(`Time: ${timeLeft}s`, x + 170, y + 70);
      }
    }
  
    drawObjectives(ctx) {
      const objectives = this.game.getObjectives();
      if (!objectives.length) return;
  
      const x = 20;
      const y = ctx.canvas.height - 150;
  
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x, y, 250, 30 + objectives.length * 25);
  
      // Title
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Objectives:', x + 10, y + 20);
  
      // Objectives list
      ctx.font = '14px Arial';
      objectives.forEach((objective, index) => {
        const checkmark = objective.completed ? '✓' : '○';
        ctx.fillStyle = objective.completed ? '#88FF88' : '#FFF';
        ctx.fillText(`${checkmark} ${objective.description}`, x + 10, y + 45 + index * 25);
      });
    }
  
    drawNotifications(ctx) {
      const notifications = this.game.getNotifications();
      if (!notifications.length) return;
  
      ctx.save();
      ctx.translate(ctx.canvas.width / 2, 100);
  
      notifications.forEach((notification, index) => {
        const alpha = Math.min(1, notification.duration / 1000);
        const y = index * 30;
  
        if (notification.type === 'achievement') {
          this.drawAchievementNotification(ctx, notification, y, alpha);
        } else {
          this.drawStandardNotification(ctx, notification, y, alpha);
        }
      });
  
      ctx.restore();
    }
  
    drawAchievementNotification(ctx, achievement, y, alpha) {
      const width = 300;
      const height = 50;
      const x = -width / 2;
  
      // Background with glow
      ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
      ctx.fillRect(x, y, width, height);
      ctx.shadowBlur = 0;
  
      // Achievement icon
      ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 25, y + height/2, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`;
      ctx.fill();
  
      // Star in the icon
      const starPoints = 5;
      const outerRadius = 10;
      const innerRadius = 4;
      ctx.beginPath();
      for(let i = 0; i < starPoints * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / starPoints;
        const starX = x + 25 + radius * Math.cos(angle);
        const starY = y + height/2 + radius * Math.sin(angle);
        if(i === 0) ctx.moveTo(starX, starY);
        else ctx.lineTo(starX, starY);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.fill();
  
      // Text
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Achievement Unlocked!', x + 50, y + 20);
      
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = '12px Arial';
      ctx.fillText(achievement.text, x + 50, y + 40);
    }
  
    drawStandardNotification(ctx, notification, y, alpha) {
      const width = 200;
      const height = 30;
      const x = -width / 2;
  
      // Background
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
      ctx.fillRect(x, y, width, height);
  
      // Colored border based on notification type
      ctx.strokeStyle = this.getNotificationColor(notification.type, alpha);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
  
      // Text
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(notification.text, x + width/2, y + 20);
    }
  
    getNotificationColor(type, alpha) {
      switch(type) {
        case 'success':
          return `rgba(0, 255, 0, ${alpha})`;
        case 'warning':
          return `rgba(255, 255, 0, ${alpha})`;
        case 'danger':
          return `rgba(255, 0, 0, ${alpha})`;
        default:
          return `rgba(255, 255, 255, ${alpha})`;
      }
    }
  
    drawDebugInfo(ctx, player) {
      if (!this.game.debugMode) return;
  
      const x = 10;
      const y = ctx.canvas.height - 100;
      const info = [
        `FPS: ${this.game.getFPS()}`,
        `Entities: ${this.game.getEntityCount()}`,
        `Position: (${Math.round(player.x)}, ${Math.round(player.y)})`,
        `Angle: ${Math.round(player.angle * 180 / Math.PI)}°`,
        `Speed: ${Math.round(player.speed * 100) / 100}`
      ];
  
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x, y, 200, 90);
  
      ctx.fillStyle = '#FFF';
      ctx.font = '12px Consolas, monospace';
      ctx.textAlign = 'left';
      info.forEach((text, index) => {
        ctx.fillText(text, x + 10, y + 20 + index * 15);
      });
    }
  }
  