/**
 * Game Actions (Move, Shoot, Grenade, etc.)
 */

import { CONFIG } from './config.js';
import { gameState } from './state.js';
import { hasLineOfSight, isInCover, getAttackAngle } from './map.js';
import { updateFacing, damagePlayer } from './player.js';
import { createMuzzleFlash, createHitEffect, createMissEffect, createExplosion } from './effects.js';
import { showToast, updateUI } from './ui.js';
import { renderPlayers } from './renderer.js';
import { checkWin } from './turns.js';

export function tryMove(player, targetX, targetY) {
    if (player.ap < 1) {
        showToast('Keine AP!');
        return false;
    }

    const dist = Math.abs(targetX - player.x) + Math.abs(targetY - player.y);
    if (dist !== 1) {
        showToast('Nur 1 Feld!');
        return false;
    }

    const tile = gameState.getTile(targetX, targetY);
    if (!tile || !tile.walkable || tile.occupied) {
        showToast('Blockiert!');
        return false;
    }

    // Check overwatch
    if (checkOverwatch(player, targetX, targetY)) {
        return false;
    }

    // Execute move
    gameState.map[player.y][player.x].occupied = null;
    updateFacing(player, targetX, targetY);
    player.x = targetX;
    player.y = targetY;
    gameState.map[targetY][targetX].occupied = player;
    player.ap -= 1;

    renderPlayers();
    updateUI();
    checkWin();
    return true;
}

export function tryShoot(player, targetX, targetY) {
    if (player.ap < 1) {
        showToast('Keine AP!');
        return false;
    }
    if (player.ammo < 1) {
        showToast('Keine Munition!');
        return false;
    }

    const tile = gameState.getTile(targetX, targetY);
    const target = tile?.occupied;

    if (!target || target.id === player.id) {
        showToast('Kein Ziel!');
        return false;
    }

    const dist = Math.sqrt(Math.pow(targetX - player.x, 2) + Math.pow(targetY - player.y, 2));
    if (dist > CONFIG.VISION_RANGE) {
        showToast('Zu weit!');
        return false;
    }

    if (!hasLineOfSight(player.x, player.y, targetX, targetY)) {
        showToast('Kein Sichtfeld!');
        return false;
    }

    // Execute shot
    player.ammo -= 1;
    player.ap -= 1;

    // Calculate hit chance and damage
    let hitChance = CONFIG.BASE_HIT_CHANCE;
    let damage = CONFIG.BASE_DAMAGE;

    // Cover bonus for target
    if (isInCover(target, player)) {
        hitChance -= 0.25;
    }

    // Height advantage
    const playerHeight = gameState.map[player.y][player.x].height;
    const targetHeight = gameState.map[targetY][targetX].height;
    if (playerHeight > targetHeight) {
        hitChance += CONFIG.HEIGHT_ACCURACY;
    }

    // Flanking bonus
    const angle = getAttackAngle(player, target);
    if (angle === 'back') {
        damage *= CONFIG.BACK_BONUS;
        hitChance += 0.15;
    } else if (angle === 'flank') {
        damage *= CONFIG.FLANK_BONUS;
        hitChance += 0.1;
    }

    // Sneaking target harder to hit
    if (target.sneaking) {
        hitChance -= CONFIG.SNEAK_HIT_PENALTY;
    }

    createMuzzleFlash(player.x, player.y);

    // Roll for hit
    if (Math.random() < hitChance) {
        const died = damagePlayer(target, damage);
        showToast(`Treffer! ${Math.floor(damage)} Schaden`);
        createHitEffect(targetX, targetY);

        if (died) {
            player.kills++;
            showToast(`Spieler ${target.id + 1} eliminiert!`);
        }
    } else {
        showToast('Verfehlt!');
        createMissEffect(targetX, targetY);
    }

    renderPlayers();
    updateUI();
    checkWin();
    return true;
}

export function tryGrenade(player, targetX, targetY) {
    if (player.ap < 2) {
        showToast('Braucht 2 AP!');
        return false;
    }
    if (player.grenades < 1) {
        showToast('Keine Granaten!');
        return false;
    }

    const dist = Math.sqrt(Math.pow(targetX - player.x, 2) + Math.pow(targetY - player.y, 2));
    if (dist > CONFIG.VISION_RANGE) {
        showToast('Zu weit!');
        return false;
    }

    // Execute grenade throw
    player.grenades -= 1;
    player.ap -= 2;

    createExplosion(targetX, targetY);

    // Damage in radius
    gameState.players.forEach(target => {
        if (!target.alive) return;
        const d = Math.sqrt(Math.pow(targetX - target.x, 2) + Math.pow(targetY - target.y, 2));
        if (d <= CONFIG.GRENADE_RADIUS) {
            const damage = CONFIG.GRENADE_DAMAGE * (1 - d / (CONFIG.GRENADE_RADIUS + 1));
            const died = damagePlayer(target, damage);

            if (died && target.id !== player.id) {
                player.kills++;
                showToast(`Spieler ${target.id + 1} eliminiert!`);
            }
        }
    });

    renderPlayers();
    updateUI();
    checkWin();
    return true;
}

export function tryOverwatch(player) {
    if (player.ap < 2) {
        showToast('Braucht 2 AP!');
        return false;
    }
    if (player.ammo < 1) {
        showToast('Keine Munition!');
        return false;
    }

    player.overwatch = true;
    player.ap -= 2;
    gameState.overwatchers.push(player);

    showToast('Überwatch aktiv!');
    renderPlayers();
    updateUI();
    return true;
}

export function tryReload(player) {
    if (player.ap < 1) {
        showToast('Keine AP!');
        return false;
    }
    if (player.ammo >= CONFIG.MAX_AMMO) {
        showToast('Voll!');
        return false;
    }

    player.ammo = CONFIG.MAX_AMMO;
    player.ap -= 1;

    showToast('Nachgeladen!');
    updateUI();
    return true;
}

export function toggleSneak(player) {
    player.sneaking = !player.sneaking;
    showToast(player.sneaking ? 'Geduckt' : 'Aufgestanden');
    renderPlayers();
    updateUI();
}

function checkOverwatch(movingPlayer, newX, newY) {
    for (const watcher of gameState.overwatchers) {
        if (watcher.id === movingPlayer.id) continue;
        if (!watcher.alive || watcher.ammo < 1) continue;

        const dist = Math.sqrt(Math.pow(newX - watcher.x, 2) + Math.pow(newY - watcher.y, 2));
        if (dist <= CONFIG.VISION_RANGE && hasLineOfSight(watcher.x, watcher.y, newX, newY)) {
            watcher.ammo -= 1;
            watcher.overwatch = false;

            createMuzzleFlash(watcher.x, watcher.y);

            if (Math.random() < CONFIG.OVERWATCH_HIT_CHANCE) {
                const damage = CONFIG.BASE_DAMAGE * 0.8;
                const died = damagePlayer(movingPlayer, damage);
                showToast(`Überwatch! ${Math.floor(damage)} Schaden an Spieler ${movingPlayer.id + 1}`);
                createHitEffect(movingPlayer.x, movingPlayer.y);

                if (died) {
                    watcher.kills++;
                    showToast(`Spieler ${movingPlayer.id + 1} eliminiert!`);
                    renderPlayers();
                    updateUI();
                    checkWin();
                    return true;
                }
            } else {
                showToast('Überwatch verfehlt!');
                createMissEffect(newX, newY);
            }

            renderPlayers();
            updateUI();
        }
    }

    // Remove used overwatchers
    gameState.overwatchers = gameState.overwatchers.filter(w => w.overwatch);
    return false;
}
