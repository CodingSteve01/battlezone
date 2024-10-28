// renderer.js
import { TerrainRenderer } from './terrainRenderer.js';
import { EntityRenderer } from './entityRenderer.js';
import { VehicleRenderer } from './vehicleRenderer.js';
import { EffectRenderer } from './effectRenderer.js';
import { UIRenderer } from './uiRenderer.js';

export class Renderer {
  constructor(game) {
    this.game = game;
    this.renderers = {
      terrain: new TerrainRenderer(this),
      entity: new EntityRenderer(this),
      vehicle: new VehicleRenderer(this),
      effect: new EffectRenderer(this),
      ui: new UIRenderer(this)
    };
    this.setupCanvases();
    this.initializeSharedPatterns();
  }

  setupCanvases() {
    // Main game canvases
    this.canvas1 = document.createElement('canvas');
    this.canvas2 = document.createElement('canvas');
    this.ctx1 = this.canvas1.getContext('2d');
    this.ctx2 = this.canvas2.getContext('2d');

    // Buffer canvas for static elements
    this.terrainBuffer = document.createElement('canvas');
    this.terrainBufferCtx = this.terrainBuffer.getContext('2d');

    // Attach canvases to DOM
    document.querySelector('.player-screen').appendChild(this.canvas1);
    document.querySelector('.player-screen:nth-child(2)')?.appendChild(this.canvas2);

    this.resizeCanvases();
    window.addEventListener('resize', () => this.resizeCanvases());
  }

  resizeCanvases() {
    const screen1 = document.querySelector('.player-screen');
    const screen2 = document.querySelector('.player-screen:nth-child(2)');
    
    const setCanvasSize = (canvas, screen) => {
      const scale = window.devicePixelRatio || 1;
      canvas.width = screen.clientWidth * scale;
      canvas.height = screen.clientHeight * scale;
      canvas.style.width = screen.clientWidth + 'px';
      canvas.style.height = screen.clientHeight + 'px';
      canvas.getContext('2d').scale(scale, scale);
    };

    setCanvasSize(this.canvas1, screen1);
    if (screen2) setCanvasSize(this.canvas2, screen2);
    
    // Update terrain buffer size
    this.terrainBuffer.width = 4000;
    this.terrainBuffer.height = 4000;
  }

  initializeSharedPatterns() {
    // Create reusable patterns for common textures
    this.patterns = {
      grass: this.createGrassPattern(),
      dirt: this.createDirtPattern(),
      sand: this.createSandPattern(),
      metal: this.createMetalPattern()
    };
  }

  createGrassPattern() {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const ctx = patternCanvas.getContext('2d');

    // Base color
    ctx.fillStyle = '#3a5a3a';
    ctx.fillRect(0, 0, 20, 20);

    // Add grass detail
    ctx.strokeStyle = '#2d462d';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const x = Math.random() * 20;
      const y = Math.random() * 20;
      const length = Math.random() * 4 + 2;
      const angle = Math.random() * Math.PI;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, length);
      ctx.stroke();
      ctx.restore();
    }

    return this.ctx1.createPattern(patternCanvas, 'repeat');
  }

  createDirtPattern() {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const ctx = patternCanvas.getContext('2d');

    // Base color
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, 20, 20);

    // Add texture
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(${139 + Math.random() * 20}, ${69 + Math.random() * 20}, ${19 + Math.random() * 20}, 0.5)`;
      ctx.beginPath();
      ctx.arc(Math.random() * 20, Math.random() * 20, Math.random() * 2 + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    return this.ctx1.createPattern(patternCanvas, 'repeat');
  }

  createMetalPattern() {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const ctx = patternCanvas.getContext('2d');

    // Base metal color
    ctx.fillStyle = '#777';
    ctx.fillRect(0, 0, 20, 20);

    // Add scratches
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * 20;
      const y = Math.random() * 20;
      const length = Math.random() * 8 + 4;
      const angle = Math.random() * Math.PI;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(length, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Add highlights
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.arc(Math.random() * 20, Math.random() * 20, Math.random() * 2 + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    return this.ctx1.createPattern(patternCanvas, 'repeat');
  }

  createSandPattern() {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const ctx = patternCanvas.getContext('2d');

    // Base sand color
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(0, 0, 20, 20);

    // Add grain texture
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(${218 + Math.random() * 20}, ${165 + Math.random() * 20}, ${32 + Math.random() * 20}, 0.3)`;
      ctx.beginPath();
      ctx.arc(Math.random() * 20, Math.random() * 20, Math.random() + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    return this.ctx1.createPattern(patternCanvas, 'repeat');
  }

  draw() {
    // Clear main canvases
    this.ctx1.clearRect(0, 0, this.canvas1.width, this.canvas1.height);
    this.ctx2?.clearRect(0, 0, this.canvas2.width, this.canvas2.height);

    // Draw for each active viewport
    this.drawViewport(this.ctx1, this.game.players[0]);
    if (this.ctx2 && this.game.players[1]) {
      this.drawViewport(this.ctx2, this.game.players[1]);
    }
  }

  drawViewport(ctx, player) {
    if (!player || player.health <= 0) return;

    ctx.save();

    // Center the viewport on the player
    const cameraX = player.x - ctx.canvas.width / 2;
    const cameraY = player.y - ctx.canvas.height / 2;
    ctx.translate(-cameraX, -cameraY);

    // Calculate visible area
    const viewBounds = {
      left: cameraX - 100,
      right: cameraX + ctx.canvas.width + 100,
      top: cameraY - 100,
      bottom: cameraY + ctx.canvas.height + 100
    };

    // Draw layers in order
    this.renderers.terrain.draw(ctx, viewBounds);
    this.renderers.entity.draw(ctx, viewBounds);
    this.renderers.vehicle.draw(ctx, viewBounds);
    this.renderers.effect.draw(ctx, viewBounds);

    ctx.restore();

    // Draw UI elements (in screen space)
    this.renderers.ui.draw(ctx, player);
  }
}
