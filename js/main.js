// main.js
import { Game } from './game.js';

let game;

// Start screen logic
document.getElementById('singlePlayerBtn').addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'flex';
  document.getElementById('gameContainer').classList.add('single-player');
  game = new Game('SinglePlayer');
});

document.getElementById('cooperativeBtn').addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'flex';
  document.getElementById('gameContainer').classList.remove('single-player');
  game = new Game('Cooperative');
});

document.getElementById('versusBtn').addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'flex';
  document.getElementById('gameContainer').classList.remove('single-player');
  game = new Game('Versus');
});

// Restart button logic
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'flex';
  game.resetGame();
});

// Menu button logic
document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'none';
  document.getElementById('startScreen').classList.remove('hidden');
});

// Mode switching through mode display click
document.getElementById('modeDisplay').addEventListener('click', () => {
  if (game && !game.gameOver) {
    if (game.mode === 'SinglePlayer') {
      game.mode = 'Cooperative';
      document.getElementById('gameContainer').classList.remove('single-player');
    } else if (game.mode === 'Cooperative') {
      game.mode = 'Versus';
    } else {
      game.mode = 'SinglePlayer';
      document.getElementById('gameContainer').classList.add('single-player');
    }
    document.getElementById('modeDisplay').textContent = `Mode: ${game.mode}`;
    game.resetGame();
  }
});
