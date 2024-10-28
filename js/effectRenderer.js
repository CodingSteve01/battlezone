// effectRenderer.js
export class EffectRenderer {
    constructor(mainRenderer) {
      this.mainRenderer = mainRenderer;
      this.game = mainRenderer.game;
      this.particles = [];
      this.explosions = [];
    }
  
    draw(ctx, viewBounds) {
      // Draw bullets
      this.drawBullets(ctx, viewBounds);
      
      // Draw explosions
      this.drawExplosions(ctx, viewBounds);
      
      // Draw particles
      this.drawParticles(ctx, viewBounds);
      
      // Draw weather effects
      this.drawWeatherEffects(ctx, viewBounds);
    }
  
    drawBullets(ctx, viewBounds) {
      this.game.bullets
        .filter(bullet => this.isInView(bullet, viewBounds))
        .forEach(bullet => {
          ctx.save();
          ctx.translate(bullet.x, bullet.y);
          ctx.rotate(bullet.angle);
  
          // Bullet trail
          const gradient = ctx.createLinearGradient(-12, 0, 0, 0);
          gradient.addColorStop(0, 'rgba(255, 200, 0, 0)');
          gradient.addColorStop(1, 'rgba(255, 200, 0, 0.3)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(-12, -1, 12, 2);
  
          // Bullet core
          ctx.fillStyle = '#FFF';
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI * 2);
          ctx.fill();
  
          // Glow effect
          const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 4);
          glowGradient.addColorStop(0, 'rgba(255, 200, 0, 0.3)');
          glowGradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
          
          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
  
          ctx.restore();
      });
    }
  
    drawExplosions(ctx, viewBounds) {
      this.game.explosions
        .filter(exp => this.isInView(exp, viewBounds))
        .forEach(explosion => {
          const progress = explosion.frame / explosion.maxFrames;
          const radius = explosion.radius * (1 - progress);
  
          // Inner explosion
          const innerGradient = ctx.createRadialGradient(
            explosion.x, explosion.y, 0,
            explosion.x, explosion.y, radius
          );
          innerGradient.addColorStop(0, 'rgba(255, 200, 0, 0.8)');
          innerGradient.addColorStop(0.4, 'rgba(255, 100, 0, 0.6)');
          innerGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
          
          ctx.fillStyle = innerGradient;
          ctx.beginPath();
          ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
          ctx.fill();
  
          // Shockwave
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - progress)})`;
          ctx.lineWidth = 2 * (1 - progress);
          ctx.beginPath();
          ctx.arc(explosion.x, explosion.y, radius * 1.5, 0, Math.PI * 2);
          ctx.stroke();
  
          // Debris particles
          if (progress < 0.7) {
            this.drawExplosionDebris(ctx, explosion, progress);
          }
  
          // Update explosion frame
          explosion.frame++;
          if (explosion.frame > explosion.maxFrames) {
            // Remove explosion from the game
            const index = this.game.explosions.indexOf(explosion);
            if (index > -1) this.game.explosions.splice(index, 1);
          }
      });
    }
  
    drawExplosionDebris(ctx, explosion, progress) {
      const particleCount = 12;
      const baseAngle = Date.now() / 1000; // Rotation over time
      
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + baseAngle;
        const distance = explosion.radius * (0.3 + progress * 0.7);
        const x = explosion.x + Math.cos(angle) * distance;
        const y = explosion.y + Math.sin(angle) * distance;
        
        ctx.fillStyle = `rgba(100, 100, 100, ${0.7 * (1 - progress)})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  
    drawParticles(ctx, viewBounds) {
      // Implement particle effects if needed
    }
  
    drawWeatherEffects(ctx, viewBounds) {
      if (this.game.weather.rain) {
        this.drawRain(ctx, viewBounds);
      }
      if (this.game.weather.fog) {
        this.drawFog(ctx, viewBounds);
      }
    }
  
    drawRain(ctx, viewBounds) {
      ctx.strokeStyle = 'rgba(155, 155, 255, 0.3)';
      ctx.lineWidth = 1;
      
      // Update and draw rain drops
      this.game.weather.raindrops.forEach(drop => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.speed * 0.5, drop.y + drop.speed);
        ctx.stroke();
  
        // Update drop position
        drop.x += drop.speed * 0.5;
        drop.y += drop.speed;
  
        // Reset drop when it goes off screen
        if (drop.y > viewBounds.bottom) {
          drop.y = viewBounds.top;
          drop.x = viewBounds.left + Math.random() * (viewBounds.right - viewBounds.left);
        }
      });
    }
  
    drawFog(ctx, viewBounds) {
      const gradient = ctx.createRadialGradient(
        viewBounds.left + (viewBounds.right - viewBounds.left) / 2,
        viewBounds.top + (viewBounds.bottom - viewBounds.top) / 2,
        0,
        viewBounds.left + (viewBounds.right - viewBounds.left) / 2,
        viewBounds.top + (viewBounds.bottom - viewBounds.top) / 2,
        (viewBounds.right - viewBounds.left) / 2
      );
      
      gradient.addColorStop(0, `rgba(200, 200, 200, ${this.game.weather.fogDensity * 0.5})`);
      gradient.addColorStop(1, `rgba(200, 200, 200, ${this.game.weather.fogDensity})`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(viewBounds.left, viewBounds.top,
                  viewBounds.right - viewBounds.left,
                  viewBounds.bottom - viewBounds.top);
    }
  
    isInView(object, viewBounds) {
      const margin = object.radius || 10;
      return object.x + margin > viewBounds.left &&
             object.x - margin < viewBounds.right &&
             object.y + margin > viewBounds.top &&
             object.y - margin < viewBounds.bottom;
    }
  }
  