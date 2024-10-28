// terrainRenderer.js
export class TerrainRenderer {
    constructor(mainRenderer) {
      this.mainRenderer = mainRenderer;
      this.game = mainRenderer.game;
      this.tileSize = 40;
      
      // Ensure game and map exist before updating buffer
      if (this.game && this.game.map) {
        this.updateTerrainBuffer();
      } else {
        console.warn('Game or map not initialized in TerrainRenderer');
      }
    }
  
    updateTerrainBuffer() {
      // Safety check for required properties
      if (!this.mainRenderer.terrainBufferCtx || !this.game.map) {
        console.warn('Missing required properties for terrain rendering');
        return;
      }

      const ctx = this.mainRenderer.terrainBufferCtx;
      const map = this.game.map;
      
      // Clear the buffer first
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Draw all static terrain to the buffer
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          this.drawTerrainTile(ctx, x * this.tileSize, y * this.tileSize, map[y][x]);
        }
      }
    }
  
    draw(ctx, viewBounds) {
      // Safety check for terrain buffer
      if (!this.mainRenderer.terrainBuffer) {
        console.warn('Terrain buffer not initialized');
        return;
      }

      // Calculate visible portion of the map
      const sourceX = Math.max(0, Math.floor(viewBounds.left / this.tileSize) * this.tileSize);
      const sourceY = Math.max(0, Math.floor(viewBounds.top / this.tileSize) * this.tileSize);
      const sourceWidth = Math.min(
        this.mainRenderer.terrainBuffer.width - sourceX,
        Math.ceil((viewBounds.right - viewBounds.left) / this.tileSize) * this.tileSize
      );
      const sourceHeight = Math.min(
        this.mainRenderer.terrainBuffer.height - sourceY,
        Math.ceil((viewBounds.bottom - viewBounds.top) / this.tileSize) * this.tileSize
      );

      // Only draw if we have valid dimensions
      if (sourceWidth > 0 && sourceHeight > 0) {
        ctx.drawImage(
          this.mainRenderer.terrainBuffer,
          sourceX, sourceY, sourceWidth, sourceHeight,
          sourceX, sourceY, sourceWidth, sourceHeight
        );
      }
  
      // Draw dynamic terrain elements
      this.drawDynamicElements(ctx, viewBounds);
    }
  
    drawTerrainTile(ctx, x, y, tileType) {
      // Ensure we have patterns initialized
      if (!this.mainRenderer.patterns) {
        console.warn('Terrain patterns not initialized');
        return;
      }

      switch(tileType) {
        case 0: // Grass
          ctx.fillStyle = this.mainRenderer.patterns.grass || '#3a5a3a';
          break;
        case 1: // Rock
          ctx.fillStyle = '#666666';
          break;
        case 2: // Trees
          ctx.fillStyle = '#355';
          break;
        case 3: // Walls
          ctx.fillStyle = '#555';
          break;
        case 4: // Road
          ctx.fillStyle = '#999';
          break;
        case 5: // Water
          ctx.fillStyle = '#4444AA';
          break;
        default:
          ctx.fillStyle = '#000';
      }
      
      ctx.fillRect(x, y, this.tileSize, this.tileSize);
    }
  
    drawDynamicElements(ctx, viewBounds) {
      // Implement dynamic terrain elements if needed
    }
}