// js/renderer.js
import { distance, isInSight, Human, Vehicle } from './entities.js';

export class Renderer {
  constructor(game) {
    this.game = game;
    this.setupCanvases();
  }

  setupCanvases() {
    this.canvas1 = document.getElementById('canvas1');
    this.canvas2 = document.getElementById('canvas2');
    this.ctx1 = this.canvas1.getContext('2d');
    this.ctx2 = this.canvas2.getContext('2d');
    this.canvas1.width = this.canvas2.width = window.innerWidth / 2;
    this.canvas1.height = this.canvas2.height = window.innerHeight;

    // Minikarten einrichten
    this.minimap1 = document.getElementById('minimap1');
    this.minimap2 = document.getElementById('minimap2');
    this.minimapCtx1 = this.minimap1.getContext('2d');
    this.minimapCtx2 = this.minimap2.getContext('2d');
    this.minimap1.width = this.minimap2.width = 150;
    this.minimap1.height = this.minimap2.height = 150;
  }

  drawEntity(ctx, entity) {
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.rotate(entity.angle);
    
    if (entity instanceof Human && !entity.vehicle) {
      // Mensch zeichnen
      ctx.fillStyle = entity.color;
      ctx.strokeStyle = '#000'; // Schwarzer Rand
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Waffe zeichnen
      ctx.fillStyle = '#000';
      ctx.fillRect(10, -2, 20, 4); // Waffe in Schussrichtung
    } else if (entity instanceof Vehicle) {
      // Fahrzeugkörper zeichnen
      ctx.fillStyle = entity.color;
      ctx.strokeStyle = '#000'; // Schwarzer Rand
      ctx.lineWidth = 2;
      switch(entity.type) {
        case 'tank':
          ctx.fillRect(-20, -15, 40, 30); // Panzer
          break;
        case 'jeep':
          ctx.fillRect(-15, -10, 30, 20); // Jeep
          break;
        case 'lkw':
          ctx.fillRect(-25, -15, 50, 30); // LKW
          break;
        case 'schuetzenpanzer':
          ctx.fillRect(-20, -15, 40, 30); // Schützenpanzer
          break;
        default:
          ctx.fillRect(-20, -15, 40, 30);
      }
      ctx.stroke();

      // Turm zeichnen
      ctx.save();
      ctx.rotate(entity.turretAngle);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, -5, entity.weapon === 'Maschinengewehr' ? entity.weaponOffset * 1.5 : entity.weaponOffset, 10); // Waffe
      ctx.restore();
    }
    
    // Lebensbalken zeichnen
    if (entity instanceof Human || entity instanceof Vehicle) {
      const maxBarWidth = 30;
      const barHeight = 4;
      const maxHealth = entity instanceof Vehicle ? 200 : 100;
      const healthRatio = entity.health / maxHealth;
      ctx.fillStyle = '#555';
      ctx.fillRect(-15, -25, maxBarWidth, barHeight);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(-15, -25, maxBarWidth * healthRatio, barHeight);
    }
    
    ctx.restore();
  }

  drawMinimap(ctx, player) {
    ctx.clearRect(0, 0, 150, 150);
    // Skalierungsfaktor für die Minikarte
    const scale = 150 / (100 * 40); // MAP_SIZE * TILE_SIZE = 100 * 40

    // Karte zeichnen
    for(let y = 0; y < 100; y++) { // MAP_SIZE = 100
      for(let x = 0; x < 100; x++) {
        const cell = this.game.map[y][x];
        if (cell === 1) ctx.fillStyle = '#888'; // Felsen
        else if (cell === 2) ctx.fillStyle = '#355'; // Bäume
        else if (cell === 3) ctx.fillStyle = '#555'; // Hindernisse
        else if (cell === 4) ctx.fillStyle = '#999'; // Straße
        else if (cell === 5) ctx.fillStyle = '#00f'; // Wasser
        else ctx.fillStyle = '#5f5'; // Gras
        ctx.fillRect(x * 40 * scale, y * 40 * scale, 40 * scale, 40 * scale); // TILE_SIZE = 40
      }
    }

    // Power-Ups zeichnen
    this.game.powerUps.forEach(p => {
      ctx.fillStyle = p.type === 'health' ? '#f00' : '#00f';
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Fahrzeuge zeichnen
    this.game.vehicles.forEach(v => {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(v.x * scale, v.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Spieler zeichnen
    this.game.players.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // KI-Gegner zeichnen (nur im Kooperativen Modus)
    if (this.game.mode === 'Cooperative') {
      this.game.kis.forEach(ki => {
        ctx.fillStyle = ki.color;
        ctx.beginPath();
        ctx.arc(ki.x * scale, ki.y * scale, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  drawGame(ctx, playerIndex) {
    const player = this.game.players[playerIndex];
    ctx.fillStyle = '#88aa88';
    ctx.fillRect(0, 0, window.innerWidth / 2, window.innerHeight);

    ctx.save();
    // Kamera-Transformation basierend auf Spielerposition
    ctx.translate(window.innerWidth / 4 - player.x, window.innerHeight / 2 - player.y);

    // Karte zeichnen
    this.game.map.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 1) {
          ctx.fillStyle = '#888'; // Felsen
          ctx.fillRect(x * 40, y * 40, 40, 40); // TILE_SIZE = 40
        } else if (cell === 2) {
          ctx.fillStyle = '#355'; // Bäume
          ctx.fillRect(x * 40, y * 40, 40, 40);
        } else if (cell === 3) {
          ctx.fillStyle = '#555'; // Hindernisse
          ctx.fillRect(x * 40, y * 40, 40, 40);
        } else if (cell === 4) {
          ctx.fillStyle = '#999'; // Straße
          ctx.fillRect(x * 40, y * 40, 40, 40);
        } else if (cell === 5) {
          ctx.fillStyle = '#00f'; // Wasser
          ctx.fillRect(x * 40, y * 40, 40, 40);
        } else {
          ctx.fillStyle = '#5f5'; // Gras
          ctx.fillRect(x * 40, y * 40, 40, 40);
        }
      });
    });

    // Power-Ups zeichnen
    this.game.powerUps.forEach(p => {
      ctx.fillStyle = p.type === 'health' ? '#ff8888' : '#8888ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    // Fahrzeuge zeichnen
    this.game.vehicles.forEach(v => {
      this.drawEntity(ctx, v);
    });

    // Kugeln zeichnen
    this.game.bullets.forEach(b => {
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Spieler zeichnen
    this.game.players.forEach(p => {
      if (p.vehicle) {
        this.drawEntity(ctx, p.vehicle);
      } else {
        this.drawEntity(ctx, p);
      }
    });

    // KI-Gegner zeichnen (nur im Kooperativen Modus)
    if (this.game.mode === 'Cooperative') {
      this.game.kis.forEach(ki => {
        if (ki.vehicle) {
          this.drawEntity(ctx, ki.vehicle);
        } else {
          this.drawEntity(ctx, ki);
        }
        // Sichtfeld der KI zeichnen (optional visuell anzeigen)
        ctx.save();
        ctx.translate(ki.x, ki.y);
        ctx.rotate(ki.angle);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 150, -Math.PI / 4, Math.PI / 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    }

    // Interaktionsnachrichten anzeigen
    this.game.players.forEach((p, i) => {
      if (i === playerIndex) {
        let message = '';
        if (this.game.mode === 'Cooperative') {
          const nearestVehicle = this.game.vehicles.find(v => 
            distance(p, v) < 50 && (!v.driver || !v.gunner));
          if (nearestVehicle && !p.vehicle) {
            message = `Drücke ${this.game.controls[i].action} zum Einsteigen`;
            document.getElementById(`message${i+1}`).style.display = 'block';
            document.getElementById(`message${i+1}`).textContent = message;
          } else if (p.vehicle) {
            message = `Drücke ${this.game.controls[i].action} zum Aussteigen`;
            document.getElementById(`message${i+1}`).style.display = 'block';
            document.getElementById(`message${i+1}`).textContent = message;
          } else {
            document.getElementById(`message${i+1}`).style.display = 'none';
          }
        } else if (this.game.mode === 'Versus') {
          // Im Versus-Modus könnten Interaktionen anders gehandhabt werden
          document.getElementById(`message${i+1}`).style.display = 'none';
        }
      }
    });

    ctx.restore();

    // Minikarte zeichnen
    if (playerIndex === 0) {
      this.drawMinimap(this.minimapCtx1, player);
    } else {
      this.drawMinimap(this.minimapCtx2, player);
    }

    // Sichtfeld der KI-Gegner zeichnen (nur im Kooperativen Modus)
    if (this.game.mode === 'Cooperative') {
      this.game.kis.forEach(ki => {
        if (isInSight(ki, player, ki.angle, Math.PI / 2, 200)) {
          // Logik, wenn KI den Spieler sieht
          // Beispielsweise Spieler als Ziel setzen
        }
      });
    }
  }
}
