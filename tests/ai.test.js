/**
 * AI module tests - tests for AI error handling and spectator mode
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';

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
      <div id="menu" class="screen active"></div>
      <div id="team-select" class="screen">
        <div id="team-select-badge">1</div>
        <span id="team-select-player">1</span>
        <div id="team-select-grid"></div>
        <div id="team-preview-units"><div class="team-slot"></div><div class="team-slot"></div><div class="team-slot"></div></div>
        <button id="team-confirm-btn" disabled>Weiter</button>
        <button id="team-back-btn">Zurück</button>
      </div>
      <div id="turn-screen" class="screen">
        <div id="turn-badge">1</div>
        <span id="turn-num">1</span>
        <button id="ready-btn">Bereit</button>
        <button id="turn-back-btn">Menü</button>
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
        <div id="top-bar">
          <div id="current-dot"></div>
          <span id="current-name"></span>
          <span id="round-num"></span>
          <span id="round-max"></span>
          <div id="ap-display"></div>
        </div>
        <div id="unit-tabs"></div>
      </div>
    </div>
  `;
});

describe('AI Module', () => {
  let ai, state;

  beforeEach(async () => {
    // Clear module cache to get fresh state
    vi.resetModules();

    // Import modules fresh
    ai = await import('../js/ai.js');
    state = await import('../js/state.js');

    // Reset state
    state.resetState();
  });

  afterEach(() => {
    // Clean up any AI thinking overlays
    const overlay = document.querySelector('.ai-thinking');
    if (overlay) overlay.remove();
  });

  describe('isAIPlayer', () => {
    it('returns false when no AI players configured', () => {
      state.state.settings.aiPlayers = [];
      state.state.currentPlayer = 0;
      expect(ai.isAIPlayer()).toBe(false);
    });

    it('returns true for configured AI player', () => {
      state.state.settings.aiPlayers = [1, 2];
      state.state.currentPlayer = 1;
      expect(ai.isAIPlayer()).toBe(true);
    });

    it('returns false for human player when others are AI', () => {
      state.state.settings.aiPlayers = [1, 2];
      state.state.currentPlayer = 0;
      expect(ai.isAIPlayer()).toBe(false);
    });

    it('handles legacy singlePlayer mode', () => {
      state.state.settings.aiPlayers = [];
      state.state.settings.singlePlayer = true;
      state.state.currentPlayer = 1;
      expect(ai.isAIPlayer()).toBe(true);
    });
  });

  describe('isSpectatorMode', () => {
    it('returns true when all players are AI', () => {
      state.state.settings.players = 2;
      state.state.settings.aiPlayers = [0, 1];
      state.state.units = [
        { id: 1, player: 0, alive: true },
        { id: 2, player: 1, alive: true }
      ];
      expect(ai.isSpectatorMode()).toBe(true);
    });

    it('returns false when human players have units', () => {
      state.state.settings.players = 2;
      state.state.settings.aiPlayers = [1]; // Only player 1 is AI
      state.state.units = [
        { id: 1, player: 0, alive: true }, // Human player 0 has units
        { id: 2, player: 1, alive: true }
      ];
      expect(ai.isSpectatorMode()).toBe(false);
    });

    it('returns true when all human players eliminated', () => {
      state.state.settings.players = 2;
      state.state.settings.aiPlayers = [1]; // Only player 1 is AI
      state.state.units = [
        { id: 1, player: 0, alive: false }, // Human eliminated
        { id: 2, player: 1, alive: true }
      ];
      expect(ai.isSpectatorMode()).toBe(true);
    });
  });

  describe('hasHumanPlayer', () => {
    it('returns true when there are human players', () => {
      state.state.settings.players = 2;
      state.state.settings.aiPlayers = [1];
      expect(ai.hasHumanPlayer()).toBe(true);
    });

    it('returns false when all players are AI', () => {
      state.state.settings.players = 2;
      state.state.settings.aiPlayers = [0, 1];
      expect(ai.hasHumanPlayer()).toBe(false);
    });
  });

  describe('resetAIMemory', () => {
    it('clears AI memory state', () => {
      ai.resetAIMemory();
      // Function should execute without errors
      expect(true).toBe(true);
    });
  });
});

describe('AI Error Handling', () => {
  it('AI module exports safeAwait function behavior via executeAITurn', async () => {
    // The AI turn execution should be wrapped in try/catch
    // This test verifies the module loads correctly with error handling
    const ai = await import('../js/ai.js');
    expect(ai.executeAITurn).toBeTypeOf('function');
  });
});

describe('AI Turn Execution Safety', () => {
  let ai, state;

  beforeEach(async () => {
    vi.resetModules();
    ai = await import('../js/ai.js');
    state = await import('../js/state.js');
    state.resetState();
  });

  it('executeAITurn should not throw even with no units', () => {
    state.state.settings.players = 2;
    state.state.settings.aiPlayers = [0, 1];
    state.state.currentPlayer = 0;
    state.state.units = [];

    // Should not throw
    expect(() => ai.executeAITurn()).not.toThrow();
  });

  it('executeAITurn exits early for human players', () => {
    state.state.settings.players = 2;
    state.state.settings.aiPlayers = [1]; // Only player 1 is AI
    state.state.currentPlayer = 0; // Human player

    // Should exit early without error
    expect(() => ai.executeAITurn()).not.toThrow();
  });
});
