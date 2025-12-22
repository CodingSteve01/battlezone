/**
 * Integration test - verifies that the game initializes correctly
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Setup canvas mock
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
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  clip: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  rect: vi.fn(),
  roundRect: vi.fn(),
  ellipse: vi.fn(),
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
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

// Setup required DOM elements before any module imports
beforeAll(() => {
  document.body.innerHTML = `
    <div id="app">
      <div id="menu" class="screen active">
        <button class="option-btn mode-btn selected" data-mode="multi">Mehrspieler</button>
        <button class="option-btn mode-btn" data-mode="single">Einzelspieler</button>
        <button class="option-btn selected" data-players="2">2 Spieler</button>
        <button class="option-btn" data-players="3">3 Spieler</button>
        <button class="option-btn" data-players="4">4 Spieler</button>
        <button class="option-btn" data-size="small">S</button>
        <button class="option-btn selected" data-size="medium">M</button>
        <button class="option-btn" data-size="large">L</button>
        <input type="range" id="volume-slider" min="0" max="100" value="70">
        <button id="mute-btn">🔊</button>
        <button class="start-btn" id="start-btn">Start</button>
        <button id="help-toggle">?</button>
        <div id="help-panel"></div>
        <div id="players-section"></div>
      </div>
      <div id="team-select" class="screen">
        <button id="team-back-btn">← Zurück</button>
        <div id="team-select-badge">1</div>
        <span id="team-select-player">1</span>
        <div id="team-select-grid"></div>
        <div id="team-preview-units"></div>
        <button id="team-confirm-btn" disabled>Weiter</button>
      </div>
      <div id="turn-screen" class="screen">
        <button id="turn-back-btn">← Menü</button>
        <div id="turn-badge">1</div>
        <span id="turn-num">1</span>
        <button id="ready-btn">Bereit</button>
      </div>
      <div id="gameover" class="screen">
        <span id="winner-text"></span>
        <button id="menu-btn">Menü</button>
        <button id="rematch-btn">Nochmal</button>
      </div>
      <div id="game-area">
        <div class="canvas-container">
          <canvas id="game-canvas"></canvas>
        </div>
      </div>
    </div>
  `;
});

describe('Game Integration', () => {
  it('initializes main.js without errors', async () => {
    const main = await import('../js/main.js');
    expect(main.startGame).toBeTypeOf('function');
  });

  it('state module exports required functions', async () => {
    const state = await import('../js/state.js');
    expect(state.state).toBeDefined();
    expect(state.resetState).toBeTypeOf('function');
    expect(state.getHex).toBeTypeOf('function');
    expect(state.getPlayerUnits).toBeTypeOf('function');
    expect(state.isHexVisible).toBeTypeOf('function');
    expect(state.isHexVisibleToPlayer).toBeTypeOf('function');
    expect(state.isHexVisibleToViewer).toBeTypeOf('function');
  });

  it('fogOfWar module exports required functions', async () => {
    const fogOfWar = await import('../js/fogOfWar.js');
    expect(fogOfWar.updateVisibility).toBeTypeOf('function');
    expect(fogOfWar.updateVisibilityForPlayer).toBeTypeOf('function');
    expect(fogOfWar.isUnitVisible).toBeTypeOf('function');
    expect(fogOfWar.isUnitVisibleToViewer).toBeTypeOf('function');
    expect(fogOfWar.isUnitVisibleToPlayer).toBeTypeOf('function');
    expect(fogOfWar.getFogLevel).toBeTypeOf('function');
  });

  it('AI module exports required functions', async () => {
    const ai = await import('../js/ai.js');
    expect(ai.isAIPlayer).toBeTypeOf('function');
    expect(ai.executeAITurn).toBeTypeOf('function');
    expect(ai.resetAIMemory).toBeTypeOf('function');
  });

  it('config module has required game settings', async () => {
    const config = await import('../js/config.js');
    expect(config.CONFIG).toBeDefined();
    expect(config.TERRAIN).toBeDefined();
    expect(config.UNIT_CLASSES).toBeDefined();
    expect(config.CONFIG.VISION_RANGE).toBeTypeOf('number');
    expect(Object.keys(config.UNIT_CLASSES).length).toBeGreaterThan(0);
  });

  it('turns module exports required functions', async () => {
    const turns = await import('../js/turns.js');
    expect(turns.startTurn).toBeTypeOf('function');
    expect(turns.endTurn).toBeTypeOf('function');
    expect(turns.endGame).toBeTypeOf('function');
  });

  it('combat module exports required functions', async () => {
    const combat = await import('../js/combat.js');
    expect(combat.executeAttack).toBeTypeOf('function');
    expect(combat.useSpecialAbility).toBeTypeOf('function');
    expect(combat.calculateHitChance).toBeTypeOf('function');
    expect(combat.hasLineOfSight).toBeTypeOf('function');
  });
});
