/**
 * Module loading test - catches import errors that would break the game
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  measureText: vi.fn(() => ({ width: 10 })),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn()
  })),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn()
  })),
  clip: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  rect: vi.fn(),
  roundRect: vi.fn(),
  ellipse: vi.fn(),
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
  font: '',
  textAlign: 'left',
  textBaseline: 'alphabetic',
  lineWidth: 1,
  strokeStyle: '',
  fillStyle: '',
  globalAlpha: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  shadowColor: '',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
}));

// Mock AudioContext
window.AudioContext = vi.fn(() => ({
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
  })),
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 0, setValueAtTime: vi.fn() },
    type: 'sine'
  })),
  createBiquadFilter: vi.fn(() => ({
    connect: vi.fn(),
    frequency: { value: 0 },
    Q: { value: 0 },
    type: 'lowpass'
  })),
  resume: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  destination: {},
  currentTime: 0,
  state: 'running'
}));

describe('Module Loading', () => {
  it('loads state.js without errors', async () => {
    const module = await import('../js/state.js');
    expect(module.state).toBeDefined();
    expect(module.resetState).toBeTypeOf('function');
    expect(module.getHex).toBeTypeOf('function');
  });

  it('loads config.js without errors', async () => {
    const module = await import('../js/config.js');
    expect(module.CONFIG).toBeDefined();
    expect(module.TERRAIN).toBeDefined();
    expect(module.UNIT_CLASSES).toBeDefined();
  });

  it('loads fogOfWar.js without errors', async () => {
    const module = await import('../js/fogOfWar.js');
    expect(module.updateVisibility).toBeTypeOf('function');
    expect(module.updateVisibilityForPlayer).toBeTypeOf('function');
    expect(module.isUnitVisible).toBeTypeOf('function');
    expect(module.isUnitVisibleToViewer).toBeTypeOf('function');
  });

  it('loads ai.js without errors', async () => {
    const module = await import('../js/ai.js');
    expect(module.isAIPlayer).toBeTypeOf('function');
    expect(module.executeAITurn).toBeTypeOf('function');
    expect(module.resetAIMemory).toBeTypeOf('function');
  });

  it('loads main.js without errors', async () => {
    // Create required DOM elements
    document.body.innerHTML = `
      <canvas id="game-canvas"></canvas>
      <div id="main-menu"></div>
      <button id="start-btn"></button>
      <button id="single-player-btn"></button>
      <button id="multiplayer-btn"></button>
      <div id="team-select"></div>
      <div id="turn-screen"></div>
      <div id="gameover"></div>
    `;

    const module = await import('../js/main.js');
    expect(module.startGame).toBeTypeOf('function');
  });

  it('loads pixiRenderer.js without errors', async () => {
    const module = await import('../js/pixiRenderer.js');
    expect(module.initRenderer).toBeTypeOf('function');
    expect(module.render).toBeTypeOf('function');
    expect(module.resizeCanvas).toBeTypeOf('function');
  });
});
