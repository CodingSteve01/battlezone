// ===== PARTICLE SYSTEM =====
// Modular particle effects for Shadow Squad
// Designed for performance (object pooling) and flexibility

import { state } from './state.js';
import { hexToPixel } from './hexMath.js';

// ===== CONFIGURATION =====

/**
 * Particle type definitions
 * Each type defines visual properties and behavior
 */
export const PARTICLE_TYPES = {
    // === COMBAT EFFECTS (Kinderfreundlich) ===

    // Funken bei Treffern (Standard, immer sichtbar)
    spark: {
        color: '#ffdd44',
        colorVariance: ['#ffaa00', '#ffff66', '#ffffff'],
        size: { min: 2, max: 5 },
        lifetime: { min: 200, max: 400 },
        speed: { min: 80, max: 200 },
        gravity: 150,
        fadeOut: true,
        glow: true
    },

    // Sterne bei kritischen Treffern
    star: {
        color: '#ffffff',
        colorVariance: ['#ffffaa', '#aaffff', '#ffaaff'],
        size: { min: 4, max: 8 },
        lifetime: { min: 400, max: 700 },
        speed: { min: 40, max: 100 },
        gravity: -20, // Schweben nach oben
        fadeOut: true,
        glow: true,
        rotate: true
    },

    // Muzzle Flash (Schussblitz)
    muzzleFlash: {
        color: '#ffff88',
        colorVariance: ['#ffffff', '#ffaa44'],
        size: { min: 8, max: 15 },
        lifetime: { min: 50, max: 100 },
        speed: { min: 0, max: 20 },
        gravity: 0,
        fadeOut: true,
        glow: true,
        scale: { start: 1.5, end: 0.3 }
    },

    // Impact-Ring (Einschlag)
    impactRing: {
        color: 'rgba(255, 200, 100, 0.6)',
        size: { min: 5, max: 10 },
        lifetime: { min: 200, max: 300 },
        speed: { min: 0, max: 0 },
        gravity: 0,
        fadeOut: true,
        expandRate: 80 // Ring expandiert
    },

    // === BLUT-EFFEKTE (Nur wenn Gore aktiviert) ===

    blood: {
        color: '#cc2222',
        colorVariance: ['#aa1111', '#dd3333', '#881111'],
        size: { min: 3, max: 7 },
        lifetime: { min: 300, max: 600 },
        speed: { min: 60, max: 150 },
        gravity: 250,
        fadeOut: true,
        glow: false,
        requiresGore: true // Nur mit Gore-Setting
    },

    bloodSplatter: {
        color: '#aa1111',
        size: { min: 8, max: 15 },
        lifetime: { min: 800, max: 1500 },
        speed: { min: 0, max: 0 },
        gravity: 0,
        fadeOut: true,
        glow: false,
        ground: true, // Bleibt am Boden
        requiresGore: true
    },

    // === HEILUNGS-EFFEKTE ===

    heal: {
        color: '#44ff88',
        colorVariance: ['#22dd66', '#66ffaa', '#88ffcc'],
        size: { min: 3, max: 6 },
        lifetime: { min: 600, max: 1000 },
        speed: { min: 20, max: 60 },
        gravity: -40, // Schweben nach oben
        fadeOut: true,
        glow: true
    },

    healAura: {
        color: 'rgba(68, 255, 136, 0.4)',
        size: { min: 20, max: 30 },
        lifetime: { min: 400, max: 600 },
        speed: { min: 0, max: 0 },
        gravity: 0,
        fadeOut: true,
        expandRate: 50
    },

    // === BEWEGUNGS-EFFEKTE ===

    dust: {
        color: '#aa9977',
        colorVariance: ['#998866', '#bbaa88', '#ccbb99'],
        size: { min: 4, max: 10 },
        lifetime: { min: 400, max: 800 },
        speed: { min: 10, max: 40 },
        gravity: -10,
        fadeOut: true,
        glow: false
    },

    sprintTrail: {
        color: 'rgba(100, 200, 255, 0.5)',
        size: { min: 8, max: 15 },
        lifetime: { min: 200, max: 400 },
        speed: { min: 0, max: 10 },
        gravity: 0,
        fadeOut: true,
        glow: true
    },

    // === SPEZIAL-FÄHIGKEITEN ===

    cloak: {
        color: 'rgba(150, 100, 255, 0.6)',
        colorVariance: ['rgba(100, 50, 200, 0.5)', 'rgba(200, 150, 255, 0.5)'],
        size: { min: 5, max: 12 },
        lifetime: { min: 500, max: 900 },
        speed: { min: 15, max: 40 },
        gravity: -30,
        fadeOut: true,
        glow: true
    },

    powershot: {
        color: '#ff6644',
        colorVariance: ['#ff4422', '#ffaa44', '#ffffff'],
        size: { min: 4, max: 10 },
        lifetime: { min: 300, max: 600 },
        speed: { min: 50, max: 120 },
        gravity: 0,
        fadeOut: true,
        glow: true
    },

    // === UMGEBUNGS-EFFEKTE ===

    leaf: {
        color: '#55aa44',
        colorVariance: ['#448833', '#66bb55', '#779944'],
        size: { min: 3, max: 6 },
        lifetime: { min: 2000, max: 4000 },
        speed: { min: 5, max: 20 },
        gravity: 15,
        fadeOut: true,
        glow: false,
        rotate: true,
        drift: true // Seitliches Schwingen
    },

    firefly: {
        color: '#aaffaa',
        colorVariance: ['#88ff88', '#ccffcc'],
        size: { min: 2, max: 4 },
        lifetime: { min: 3000, max: 6000 },
        speed: { min: 5, max: 15 },
        gravity: 0,
        fadeOut: false,
        glow: true,
        flicker: true, // Blinkend
        drift: true
    }
};

// ===== PARTICLE CLASS =====

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.active = false;
        this.type = null;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.size = 0;
        this.startSize = 0;
        this.color = '';
        this.lifetime = 0;
        this.maxLifetime = 0;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.alpha = 1;
        this.scale = 1;
    }

    init(type, x, y, direction = null) {
        const config = PARTICLE_TYPES[type];
        if (!config) return false;

        // Gore-Check
        if (config.requiresGore && !state.settings.gore) {
            return false;
        }

        this.active = true;
        this.type = type;
        this.config = config;
        this.x = x;
        this.y = y;

        // Größe
        this.size = randomRange(config.size.min, config.size.max);
        this.startSize = this.size;

        // Farbe
        if (config.colorVariance && Math.random() > 0.5) {
            this.color = config.colorVariance[Math.floor(Math.random() * config.colorVariance.length)];
        } else {
            this.color = config.color;
        }

        // Geschwindigkeit
        const speed = randomRange(config.speed.min, config.speed.max);
        let angle;
        if (direction !== null) {
            // Richtung mit Streuung
            angle = direction + (Math.random() - 0.5) * Math.PI * 0.5;
        } else {
            // Zufällige Richtung
            angle = Math.random() * Math.PI * 2;
        }
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Lebensdauer
        this.maxLifetime = randomRange(config.lifetime.min, config.lifetime.max);
        this.lifetime = this.maxLifetime;

        // Rotation
        if (config.rotate) {
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 5;
        }

        // Scale Animation
        if (config.scale) {
            this.scaleStart = config.scale.start;
            this.scaleEnd = config.scale.end;
        }

        this.alpha = 1;
        this.driftPhase = Math.random() * Math.PI * 2;
        this.flickerPhase = Math.random() * Math.PI * 2;

        return true;
    }

    update(deltaTime) {
        if (!this.active) return;

        const dt = deltaTime / 1000; // in Sekunden
        const config = this.config;

        // Physik
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Schwerkraft
        if (config.gravity) {
            this.vy += config.gravity * dt;
        }

        // Drift (seitliches Schwingen)
        if (config.drift) {
            this.driftPhase += dt * 2;
            this.x += Math.sin(this.driftPhase) * 20 * dt;
        }

        // Rotation
        if (config.rotate) {
            this.rotation += this.rotationSpeed * dt;
        }

        // Ring-Expansion
        if (config.expandRate) {
            this.size += config.expandRate * dt;
        }

        // Scale Animation
        if (config.scale) {
            const progress = 1 - (this.lifetime / this.maxLifetime);
            this.scale = this.scaleStart + (this.scaleEnd - this.scaleStart) * progress;
        }

        // Flackern
        if (config.flicker) {
            this.flickerPhase += dt * 8;
            this.alpha = 0.4 + Math.sin(this.flickerPhase) * 0.6;
        }

        // Lebensdauer
        this.lifetime -= deltaTime;

        // Fade out
        if (config.fadeOut && this.lifetime < this.maxLifetime * 0.3) {
            this.alpha = Math.max(0, this.lifetime / (this.maxLifetime * 0.3));
        }

        // Deaktivieren wenn abgelaufen
        if (this.lifetime <= 0) {
            this.active = false;
        }
    }

    draw(ctx, offsetX, offsetY) {
        if (!this.active || this.alpha <= 0) return;

        const config = this.config;
        const screenX = this.x + offsetX;
        const screenY = this.y + offsetY;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        // Glow-Effekt
        if (config.glow) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.size * 2;
        }

        // Transformation
        ctx.translate(screenX, screenY);
        if (config.rotate) {
            ctx.rotate(this.rotation);
        }
        if (config.scale) {
            ctx.scale(this.scale, this.scale);
        }

        // Zeichnen
        ctx.fillStyle = this.color;

        if (config.expandRate) {
            // Ring
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === 'star') {
            // Stern
            this.drawStar(ctx, 0, 0, 5, this.size, this.size * 0.4);
        } else if (this.type === 'leaf') {
            // Blatt
            this.drawLeaf(ctx, 0, 0, this.size);
        } else {
            // Kreis (Standard)
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
            rot += step;
        }

        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }

    drawLeaf(ctx, cx, cy, size) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.4, size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Blattader
        ctx.strokeStyle = 'rgba(0, 50, 0, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx, cy + size);
        ctx.stroke();
    }
}

// ===== PARTICLE MANAGER =====

class ParticleManager {
    constructor(poolSize = 500) {
        this.pool = [];
        this.activeParticles = [];
        this.lastUpdate = performance.now();

        // Object Pool initialisieren
        for (let i = 0; i < poolSize; i++) {
            this.pool.push(new Particle());
        }

        // Boden-Partikel (bleiben länger)
        this.groundParticles = [];
    }

    /**
     * Holt einen Partikel aus dem Pool
     */
    getParticle() {
        // Suche inaktiven Partikel
        for (const particle of this.pool) {
            if (!particle.active) {
                return particle;
            }
        }

        // Pool erschöpft - ältesten aktiven recyceln
        if (this.activeParticles.length > 0) {
            const oldest = this.activeParticles.shift();
            oldest.reset();
            return oldest;
        }

        // Fallback: neuen erstellen
        const newParticle = new Particle();
        this.pool.push(newParticle);
        return newParticle;
    }

    /**
     * Spawnt einen einzelnen Partikel
     */
    spawn(type, x, y, direction = null) {
        const particle = this.getParticle();
        if (particle.init(type, x, y, direction)) {
            this.activeParticles.push(particle);

            // Boden-Partikel separat tracken
            if (PARTICLE_TYPES[type]?.ground) {
                this.groundParticles.push(particle);
            }
        }
    }

    /**
     * Get particle count multiplier based on quality setting
     * Used to reduce particle count on lower-end devices
     */
    getQualityMultiplier() {
        const quality = state.settings.particleQuality || 'high';
        switch (quality) {
            case 'low': return 0.3;
            case 'medium': return 0.6;
            case 'high': return 1.0;
            default: return 1.0;
        }
    }

    /**
     * Spawnt mehrere Partikel als Burst
     */
    burst(type, x, y, count, direction = null, spread = Math.PI * 2) {
        // Adjust count based on quality setting for performance
        const adjustedCount = Math.max(1, Math.round(count * this.getQualityMultiplier()));

        for (let i = 0; i < adjustedCount; i++) {
            let dir = direction;
            if (direction !== null) {
                dir = direction + (Math.random() - 0.5) * spread;
            }
            this.spawn(type, x, y, dir);
        }
    }

    /**
     * Spawnt Partikel auf einem Hex-Feld
     */
    spawnAtHex(type, q, r, count = 1, direction = null) {
        const pos = hexToPixel(q, r, state.hexSize);
        if (count === 1) {
            this.spawn(type, pos.x, pos.y, direction);
        } else {
            this.burst(type, pos.x, pos.y, count, direction);
        }
    }

    /**
     * Erstellt einen Treffer-Effekt (kinderfreundlich oder mit Gore)
     */
    hitEffect(x, y, isCritical = false, direction = null) {
        if (state.settings.gore) {
            // Gore-Modus: Blut
            this.burst('blood', x, y, isCritical ? 12 : 6, direction, Math.PI * 0.8);
            if (isCritical) {
                this.spawn('bloodSplatter', x, y + 20);
            }
        } else {
            // Kinderfreundlich: Funken und Sterne
            this.burst('spark', x, y, isCritical ? 15 : 8, direction, Math.PI);
            if (isCritical) {
                this.burst('star', x, y, 5);
            }
        }

        // Impact-Ring (immer)
        this.spawn('impactRing', x, y);
    }

    /**
     * Erstellt einen Muzzle-Flash-Effekt
     */
    muzzleFlash(x, y, direction) {
        console.log(`[Particles] muzzleFlash at (${x}, ${y}), active: ${this.activeParticles.length}`);
        this.spawn('muzzleFlash', x, y, direction);
        this.burst('spark', x, y, 3, direction, Math.PI * 0.3);
    }

    /**
     * Erstellt einen Heilungs-Effekt
     */
    healEffect(x, y) {
        this.burst('heal', x, y, 15);
        this.spawn('healAura', x, y);
    }

    /**
     * Erstellt einen Sprint-Effekt
     */
    sprintEffect(x, y) {
        this.burst('dust', x, y + 15, 5, Math.PI, Math.PI * 0.5);
        this.spawn('sprintTrail', x, y);
    }

    /**
     * Erstellt einen Cloak-Effekt
     */
    cloakEffect(x, y) {
        this.burst('cloak', x, y, 20);
    }

    /**
     * Erstellt einen Powershot-Effekt
     */
    powershotEffect(x, y, direction) {
        this.burst('powershot', x, y, 25, direction, Math.PI * 0.4);
        this.burst('spark', x, y, 10, direction, Math.PI * 0.3);
    }

    /**
     * Update aller Partikel
     */
    update() {
        const now = performance.now();
        const deltaTime = now - this.lastUpdate;
        this.lastUpdate = now;

        // Aktive Partikel updaten
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const particle = this.activeParticles[i];
            particle.update(deltaTime);

            if (!particle.active) {
                this.activeParticles.splice(i, 1);
            }
        }

        // Boden-Partikel aufräumen
        this.groundParticles = this.groundParticles.filter(p => p.active);
    }

    /**
     * Zeichnet alle Partikel
     */
    draw(ctx, offsetX, offsetY) {
        // Debug: Log every 2 seconds
        if (this.activeParticles.length > 0 && (!this._lastDebugLog || Date.now() - this._lastDebugLog > 2000)) {
            console.log(`[Particles] Drawing ${this.activeParticles.length} particles, offset: (${offsetX}, ${offsetY})`);
            this._lastDebugLog = Date.now();
        }

        // Boden-Partikel zuerst (unter allem)
        for (const particle of this.groundParticles) {
            particle.draw(ctx, offsetX, offsetY);
        }

        // Dann normale Partikel
        for (const particle of this.activeParticles) {
            if (!PARTICLE_TYPES[particle.type]?.ground) {
                particle.draw(ctx, offsetX, offsetY);
            }
        }
    }

    /**
     * Anzahl aktiver Partikel (für Debug/Performance)
     */
    getActiveCount() {
        return this.activeParticles.length;
    }

    /**
     * Alle Partikel löschen
     */
    clear() {
        for (const particle of this.activeParticles) {
            particle.reset();
        }
        this.activeParticles = [];
        this.groundParticles = [];
    }
}

// ===== HILFSFUNKTIONEN =====

function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

// ===== SINGLETON EXPORT =====

export const particles = new ParticleManager();

// Convenience-Funktionen für direkten Import
export function spawnParticle(type, x, y, direction = null) {
    particles.spawn(type, x, y, direction);
}

export function burstParticles(type, x, y, count, direction = null) {
    particles.burst(type, x, y, count, direction);
}

export function spawnAtHex(type, q, r, count = 1) {
    particles.spawnAtHex(type, q, r, count);
}

export function hitEffect(x, y, isCritical = false, direction = null) {
    particles.hitEffect(x, y, isCritical, direction);
}

export function healEffect(x, y) {
    particles.healEffect(x, y);
}

export function updateParticles() {
    particles.update();
}

export function drawParticles(ctx, offsetX, offsetY) {
    particles.draw(ctx, offsetX, offsetY);
}

export function clearParticles() {
    particles.clear();
}
