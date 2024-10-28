// main.js
import { Game } from './game.js';

let game;

// Start screen logic
document.getElementById('cooperativeBtn').addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'flex';
  game = new Game('Cooperative');
});

document.getElementById('versusBtn').addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'flex';
  game = new Game('Versus');
});

// Restart button logic
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'flex';
  game.resetGame();
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
