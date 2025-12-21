/**
 * Visual Effects (Particles, Explosions, etc.)
 */

import { gameState } from './state.js';
import { toIso } from './map.js';

export function createMuzzleFlash(x, y) {
    const pos = toIso(x, y);
    const flash = new PIXI.Graphics();
    flash.beginFill(0xffff00);
    flash.drawCircle(0, 0, 15);
    flash.endFill();
    flash.x = pos.x;
    flash.y = pos.y - 20;
    flash.alpha = 1;
    gameState.containers.effects.addChild(flash);

    let frame = 0;
    const animate = () => {
        frame++;
        flash.alpha = 1 - frame / 10;
        flash.scale.set(1 + frame * 0.1);
        if (frame < 10) {
            requestAnimationFrame(animate);
        } else {
            gameState.containers.effects.removeChild(flash);
        }
    };
    animate();
}

export function createHitEffect(x, y) {
    const pos = toIso(x, y);
    const particles = [];

    for (let i = 0; i < 8; i++) {
        const p = new PIXI.Graphics();
        p.beginFill(0xff4444);
        p.drawCircle(0, 0, 3);
        p.endFill();
        p.x = pos.x;
        p.y = pos.y - 20;
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = (Math.random() - 0.5) * 8 - 3;
        gameState.containers.effects.addChild(p);
        particles.push(p);
    }

    let frame = 0;
    const animate = () => {
        frame++;
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.alpha = 1 - frame / 20;
        });
        if (frame < 20) {
            requestAnimationFrame(animate);
        } else {
            particles.forEach(p => gameState.containers.effects.removeChild(p));
        }
    };
    animate();
}

export function createMissEffect(x, y) {
    const pos = toIso(x, y);
    const text = new PIXI.Text('MISS', {
        fontFamily: 'Orbitron',
        fontSize: 14,
        fill: 0xffffff,
        fontWeight: 'bold'
    });
    text.anchor.set(0.5);
    text.x = pos.x;
    text.y = pos.y - 30;
    gameState.containers.effects.addChild(text);

    let frame = 0;
    const animate = () => {
        frame++;
        text.y -= 1;
        text.alpha = 1 - frame / 30;
        if (frame < 30) {
            requestAnimationFrame(animate);
        } else {
            gameState.containers.effects.removeChild(text);
        }
    };
    animate();
}

export function createExplosion(x, y) {
    const pos = toIso(x, y);

    // Central flash
    const flash = new PIXI.Graphics();
    flash.beginFill(0xff6600);
    flash.drawCircle(0, 0, 30);
    flash.endFill();
    flash.x = pos.x;
    flash.y = pos.y;
    gameState.containers.effects.addChild(flash);

    // Particles
    const particles = [];
    for (let i = 0; i < 20; i++) {
        const p = new PIXI.Graphics();
        p.beginFill(Math.random() > 0.5 ? 0xff6600 : 0xffaa00);
        p.drawCircle(0, 0, Math.random() * 5 + 2);
        p.endFill();
        p.x = pos.x;
        p.y = pos.y;
        p.vx = (Math.random() - 0.5) * 15;
        p.vy = (Math.random() - 0.5) * 15 - 5;
        gameState.containers.effects.addChild(p);
        particles.push(p);
    }

    let frame = 0;
    const animate = () => {
        frame++;
        flash.alpha = 1 - frame / 15;
        flash.scale.set(1 + frame * 0.15);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.4;
            p.alpha = 1 - frame / 30;
        });

        if (frame < 30) {
            requestAnimationFrame(animate);
        } else {
            gameState.containers.effects.removeChild(flash);
            particles.forEach(p => gameState.containers.effects.removeChild(p));
        }
    };
    animate();
}

export function createDamageNumber(x, y, damage) {
    const pos = toIso(x, y);
    const text = new PIXI.Text(`-${damage}`, {
        fontFamily: 'Orbitron',
        fontSize: 16,
        fill: 0xff4444,
        fontWeight: 'bold'
    });
    text.anchor.set(0.5);
    text.x = pos.x;
    text.y = pos.y - 40;
    gameState.containers.effects.addChild(text);

    let frame = 0;
    const animate = () => {
        frame++;
        text.y -= 1.5;
        text.alpha = 1 - frame / 40;
        if (frame < 40) {
            requestAnimationFrame(animate);
        } else {
            gameState.containers.effects.removeChild(text);
        }
    };
    animate();
}
