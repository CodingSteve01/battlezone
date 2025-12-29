// ===== PARTICLE SYSTEM =====
// Modular particle effects for Shadow Squad
// Designed for performance (object pooling) and flexibility

import { state, getWorldScale } from './state.js';
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
        size: { min: 1, max: 2.5 },  // Smaller, more detailed
        lifetime: { min: 150, max: 350 },
        speed: { min: 60, max: 150 },
        gravity: 120,
        fadeOut: true,
        glow: true
    },

    // Sterne bei kritischen Treffern
    star: {
        color: '#ffffff',
        colorVariance: ['#ffffaa', '#aaffff', '#ffaaff'],
        size: { min: 2, max: 4 },  // Smaller stars
        lifetime: { min: 300, max: 600 },
        speed: { min: 30, max: 70 },
        gravity: -15, // Schweben nach oben
        fadeOut: true,
        glow: true,
        rotate: true
    },

    // Muzzle Flash (Schussblitz)
    muzzleFlash: {
        color: '#ffff88',
        colorVariance: ['#ffffff', '#ffaa44'],
        size: { min: 4, max: 8 },  // Smaller flash
        lifetime: { min: 40, max: 80 },
        speed: { min: 0, max: 15 },
        gravity: 0,
        fadeOut: true,
        glow: true,
        scale: { start: 1.2, end: 0.2 }
    },

    // Impact-Ring (Einschlag)
    impactRing: {
        color: 'rgba(255, 200, 100, 0.5)',
        size: { min: 3, max: 6 },  // Smaller ring start
        lifetime: { min: 150, max: 250 },
        speed: { min: 0, max: 0 },
        gravity: 0,
        fadeOut: true,
        expandRate: 60 // Ring expandiert (slightly slower)
    },

    // === BLUT-EFFEKTE (Nur wenn Gore aktiviert) ===

    blood: {
        color: '#cc2222',
        colorVariance: ['#aa1111', '#dd3333', '#881111'],
        size: { min: 1.5, max: 4 },  // Smaller droplets
        lifetime: { min: 250, max: 500 },
        speed: { min: 50, max: 120 },
        gravity: 200,
        fadeOut: true,
        glow: false,
        requiresGore: true // Nur mit Gore-Setting
    },

    bloodSplatter: {
        color: '#aa1111',
        size: { min: 4, max: 8 },  // Smaller splatter
        lifetime: { min: 600, max: 1200 },
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
        size: { min: 1.5, max: 3 },  // Smaller healing particles
        lifetime: { min: 500, max: 800 },
        speed: { min: 15, max: 45 },
        gravity: -30, // Schweben nach oben
        fadeOut: true,
        glow: true
    },

    healAura: {
        color: 'rgba(68, 255, 136, 0.3)',
        size: { min: 10, max: 18 },  // Smaller aura
        lifetime: { min: 350, max: 500 },
        speed: { min: 0, max: 0 },
        gravity: 0,
        fadeOut: true,
        expandRate: 35
    },

    // === BEWEGUNGS-EFFEKTE ===

    dust: {
        color: '#aa9977',
        colorVariance: ['#998866', '#bbaa88', '#ccbb99'],
        size: { min: 2, max: 5 },  // Smaller dust
        lifetime: { min: 300, max: 600 },
        speed: { min: 8, max: 30 },
        gravity: -8,
        fadeOut: true,
        glow: false
    },

    sprintTrail: {
        color: 'rgba(100, 200, 255, 0.4)',
        size: { min: 4, max: 8 },  // Smaller trail
        lifetime: { min: 150, max: 300 },
        speed: { min: 0, max: 8 },
        gravity: 0,
        fadeOut: true,
        glow: true
    },

    // === SPEZIAL-FÄHIGKEITEN ===

    cloak: {
        color: 'rgba(150, 100, 255, 0.5)',
        colorVariance: ['rgba(100, 50, 200, 0.4)', 'rgba(200, 150, 255, 0.4)'],
        size: { min: 2.5, max: 6 },  // Smaller cloak particles
        lifetime: { min: 400, max: 700 },
        speed: { min: 12, max: 30 },
        gravity: -25,
        fadeOut: true,
        glow: true
    },

    powershot: {
        color: '#ff6644',
        colorVariance: ['#ff4422', '#ffaa44', '#ffffff'],
        size: { min: 2, max: 5 },  // Smaller powershot
        lifetime: { min: 250, max: 500 },
        speed: { min: 40, max: 100 },
        gravity: 0,
        fadeOut: true,
        glow: true
    },

    // === UMGEBUNGS-EFFEKTE ===

    leaf: {
        color: '#55aa44',
        colorVariance: ['#448833', '#66bb55', '#779944'],
        size: { min: 2, max: 4 },  // Smaller leaves
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
        size: { min: 1, max: 2.5 },  // Smaller fireflies
        lifetime: { min: 3000, max: 6000 },
        speed: { min: 5, max: 15 },
        gravity: 0,
        fadeOut: false,
        glow: true,
        flicker: true, // Blinkend
        drift: true
    },

    // === PROJECTILE EFFECTS ===

    // Bullet tracer (fast moving projectile trail)
    tracer: {
        color: '#ffdd44',
        colorVariance: ['#ffaa00', '#ffffff', '#ffff88'],
        size: { min: 2, max: 4 },
        lifetime: { min: 80, max: 150 },
        speed: { min: 0, max: 10 },
        gravity: 0,
        fadeOut: true,
        glow: true,
        trail: true
    },

    // Bullet impact sparks (more dramatic)
    impactSpark: {
        color: '#ffaa44',
        colorVariance: ['#ff6600', '#ffdd88', '#ffffff'],
        size: { min: 1, max: 3 },
        lifetime: { min: 100, max: 250 },
        speed: { min: 80, max: 200 },
        gravity: 180,
        fadeOut: true,
        glow: true
    },

    // Smoke puff at impact
    smoke: {
        color: 'rgba(100, 100, 100, 0.5)',
        colorVariance: ['rgba(80, 80, 80, 0.4)', 'rgba(120, 120, 120, 0.5)'],
        size: { min: 4, max: 10 },
        lifetime: { min: 300, max: 600 },
        speed: { min: 10, max: 30 },
        gravity: -20,
        fadeOut: true,
        glow: false,
        expandRate: 15
    },

    // Energy pulse (for special attacks)
    energyPulse: {
        color: 'rgba(255, 100, 50, 0.6)',
        size: { min: 8, max: 15 },
        lifetime: { min: 200, max: 350 },
        speed: { min: 0, max: 0 },
        gravity: 0,
        fadeOut: true,
        glow: true,
        expandRate: 80
    },

    // Ground debris
    debris: {
        color: '#887766',
        colorVariance: ['#776655', '#998877', '#665544'],
        size: { min: 1.5, max: 3.5 },
        lifetime: { min: 200, max: 400 },
        speed: { min: 50, max: 120 },
        gravity: 250,
        fadeOut: true,
        glow: false
    },

    // Shell casing ejection
    shellCasing: {
        color: '#ccaa44',
        colorVariance: ['#bbaa33', '#ddbb55'],
        size: { min: 1.5, max: 2.5 },
        lifetime: { min: 400, max: 700 },
        speed: { min: 30, max: 60 },
        gravity: 150,
        fadeOut: true,
        glow: false,
        rotate: true
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
        const worldScale = getWorldScale();
        this.size = randomRange(config.size.min, config.size.max) * worldScale;
        this.startSize = this.size;

        // Farbe
        if (config.colorVariance && Math.random() > 0.5) {
            this.color = config.colorVariance[Math.floor(Math.random() * config.colorVariance.length)];
        } else {
            this.color = config.color;
        }

        // Geschwindigkeit
        const speed = randomRange(config.speed.min, config.speed.max) * worldScale;
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
            this.vy += config.gravity * getWorldScale() * dt;
        }

        // Drift (seitliches Schwingen)
        if (config.drift) {
            this.driftPhase += dt * 2;
            this.x += Math.sin(this.driftPhase) * 20 * getWorldScale() * dt;
        }

        // Rotation
        if (config.rotate) {
            this.rotation += this.rotationSpeed * dt;
        }

        // Ring-Expansion
        if (config.expandRate) {
            this.size += config.expandRate * getWorldScale() * dt;
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
            ctx.lineWidth = 2 * getWorldScale();
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
        ctx.lineWidth = 0.5 * getWorldScale();
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
     * Creates a projectile animation with tracer trail
     * The projectile travels from start to end position over duration
     * @param {number} startX - Starting X position
     * @param {number} startY - Starting Y position
     * @param {number} endX - End X position
     * @param {number} endY - End Y position
     * @param {string} unitClass - Type of unit attacking (affects visual style)
     * @param {boolean} isCrit - Whether this is a critical hit
     * @param {function} onImpact - Callback when projectile reaches target
     */
    projectileAttack(startX, startY, endX, endY, unitClass, isCrit, onImpact) {
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const direction = Math.atan2(dy, dx);

        // Duration based on distance (faster for closer targets)
        const duration = Math.min(400, Math.max(150, distance * 0.8));

        let currentStep = 0;
        const startTime = performance.now();

        // Projectile color based on unit class
        const projectileColors = {
            scout: '#44aaff',
            assault: '#ff6644',
            medic: '#44ff88',
            sniper: '#ffdd44',
            commando: '#ff44ff'
        };
        const color = projectileColors[unitClass] || '#ffdd44';

        // Shell casing ejected at muzzle
        const casingDir = direction + Math.PI / 2 + (Math.random() - 0.5) * 0.3;
        this.spawn('shellCasing', startX + Math.cos(casingDir) * 5, startY + Math.sin(casingDir) * 5, casingDir);

        // Animate projectile
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Current position with slight arc for assault
            const arcHeight = unitClass === 'assault' ? Math.sin(progress * Math.PI) * 8 : 0;
            const currentX = startX + dx * progress;
            const currentY = startY + dy * progress - arcHeight;

            // Spawn tracer particles along path
            if (currentStep % 2 === 0) {
                const tracerParticle = this.getParticle();
                if (tracerParticle.init('tracer', currentX, currentY, direction + Math.PI)) {
                    tracerParticle.color = color;
                    this.activeParticles.push(tracerParticle);
                }
            }

            currentStep++;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Impact reached - call callback and create impact effects
                if (onImpact) onImpact();
            }
        };

        // Start animation
        requestAnimationFrame(animate);
    }

    /**
     * Enhanced hit effect with more dramatic visuals
     */
    enhancedHitEffect(x, y, isCritical = false, direction = null, unitClass = null) {
        // Base impact spark burst (dramatic)
        const sparkCount = isCritical ? 20 : 12;
        this.burst('impactSpark', x, y, sparkCount, direction ? direction + Math.PI : null, Math.PI * 1.2);

        // Smoke puff
        this.burst('smoke', x, y, isCritical ? 4 : 2);

        // Ground debris
        this.burst('debris', x, y, isCritical ? 8 : 4, Math.PI * 0.5, Math.PI);

        // Energy pulse for critical hits
        if (isCritical) {
            this.spawn('energyPulse', x, y);
            this.burst('star', x, y, 6);
        }

        // Impact ring (always)
        this.spawn('impactRing', x, y);

        // Additional effects based on unit class
        if (unitClass === 'assault') {
            // Assault has explosive impact
            this.spawn('energyPulse', x, y);
            this.burst('spark', x, y, 8, null, Math.PI * 2);
        } else if (unitClass === 'sniper') {
            // Sniper has precise piercing effect
            this.burst('tracer', x, y, 4, direction ? direction + Math.PI : null, Math.PI * 0.2);
        }

        // Gore mode adds blood
        if (state.settings.gore) {
            this.burst('blood', x, y, isCritical ? 12 : 6, direction ? direction + Math.PI : null, Math.PI * 0.8);
            if (isCritical) {
                this.spawn('bloodSplatter', x, y + 20);
            }
        }
    }

    /**
     * Creates an enhanced muzzle flash with shell casing
     */
    enhancedMuzzleFlash(x, y, direction, unitClass = null) {
        // Main flash
        this.spawn('muzzleFlash', x, y, direction);

        // Extra sparks
        this.burst('spark', x, y, 5, direction, Math.PI * 0.4);

        // Small smoke puff
        this.spawn('smoke', x - Math.cos(direction) * 5, y - Math.sin(direction) * 5, direction + Math.PI);

        // Assault has bigger flash
        if (unitClass === 'assault') {
            this.spawn('muzzleFlash', x + Math.cos(direction) * 3, y + Math.sin(direction) * 3, direction);
            this.burst('powershot', x, y, 3, direction, Math.PI * 0.3);
        }
    }

    /**
     * Update aller Partikel
     */
    update() {
        const now = performance.now();
        let deltaTime = now - this.lastUpdate;
        this.lastUpdate = now;

        // Clamp deltaTime to avoid killing particles on first frame after long pause
        // Max 50ms = 20fps minimum, prevents particles from dying instantly
        deltaTime = Math.min(deltaTime, 50);

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
