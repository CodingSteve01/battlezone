// js/main.js
import { Game } from './game.js';

// Variable zur Speicherung der Spielinstanz
let game;

// Startbildschirm-Logik
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

// Neustart-Button-Logik
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'flex';
  game.resetGame();
});

// Moduswechsel durch Klick auf Mode Display
document.getElementById('modeDisplay').addEventListener('click', () => {
  if (game && !game.gameOver) {
    game.mode = game.mode === 'Cooperative' ? 'Versus' : 'Cooperative';
    document.getElementById('modeDisplay').textContent = `Mode: ${game.mode}`;
    game.resetGame();
  }
});
