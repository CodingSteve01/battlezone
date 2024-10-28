// entityRenderer.js
export class EntityRenderer {
    constructor(mainRenderer) {
      this.mainRenderer = mainRenderer;
      this.game = mainRenderer.game;
    }
  
    draw(ctx, viewBounds) {
      // Draw all entities (players, enemies, etc.)
      const entities = [...this.game.players, ...this.game.enemies];
      entities
        .filter(entity => this.isInView(entity, viewBounds))
        .sort((a, b) => a.y - b.y) // Depth sorting
        .forEach(entity => this.drawEntity(ctx, entity));
    }
  
    drawEntity(ctx, entity) {
      ctx.save();
      ctx.translate(entity.x, entity.y);
      ctx.rotate(entity.angle);
  
      // Draw shadow
      this.drawShadow(ctx, entity);
  
      // Draw body
      ctx.fillStyle = entity.color;
      ctx.beginPath();
      ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
      ctx.fill();
  
      // Draw equipment and effects
      if (entity.weapon) this.drawWeapon(ctx, entity);
      if (entity.armor) this.drawArmor(ctx, entity);
      if (entity.effects) this.drawEffects(ctx, entity);
  
      ctx.restore();
    }
  
    drawShadow(ctx, entity) {
      const shadowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, entity.radius);
      shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
      shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = shadowGradient;
      ctx.beginPath();
      ctx.ellipse(2, 2, entity.radius, entity.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  
    drawWeapon(ctx, entity) {
      // Implement weapon drawing logic...
    }
  
    drawArmor(ctx, entity) {
      // Implement armor drawing logic...
    }
  
    drawEffects(ctx, entity) {
      // Implement effects drawing logic...
    }
  
    isInView(entity, viewBounds) {
      return entity.x + entity.radius > viewBounds.left &&
             entity.x - entity.radius < viewBounds.right &&
             entity.y + entity.radius > viewBounds.top &&
             entity.y - entity.radius < viewBounds.bottom;
    }
  }
  