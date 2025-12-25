/**
 * High-Detail Tactical Character Generator
 * Creates realistic military/tactical soldier sprites
 *
 * Features:
 * - Proper human anatomy and proportions
 * - Detailed military gear and equipment
 * - Class-specific appearances (sniper ghillie, medic gear, etc.)
 * - Multi-layer shading and depth
 * - Player color integration
 */

const CharacterGenerator = {
    // Class configurations with detailed gear specs
    classes: {
        scout: {
            helmet: 'beret',
            armor: 'light',
            weapon: 'smg',
            bodyBuild: 'lean',
            gear: ['radio', 'binoculars'],
            camouflage: 'woodland'
        },
        assault: {
            helmet: 'tactical',
            armor: 'heavy',
            weapon: 'rifle',
            bodyBuild: 'heavy',
            gear: ['grenades', 'ammo_pouches'],
            camouflage: 'digital'
        },
        medic: {
            helmet: 'cap',
            armor: 'medium',
            weapon: 'pistol',
            bodyBuild: 'medium',
            gear: ['medkit', 'bandages'],
            camouflage: 'woodland',
            cross: true
        },
        sniper: {
            helmet: 'ghillie',
            armor: 'ghillie',
            weapon: 'sniper',
            bodyBuild: 'lean',
            gear: ['scope', 'rangefinder'],
            camouflage: 'ghillie'
        },
        commando: {
            helmet: 'balaclava',
            armor: 'stealth',
            weapon: 'knife',
            bodyBuild: 'athletic',
            gear: ['garrote', 'throwing_knives'],
            camouflage: 'black'
        }
    },

    poses: {
        // More natural poses with relaxed arm positions
        normal: { stance: 'standing', bodyTilt: 0, legSpread: 22, armAngle: 15, shoulderDrop: 5 },
        cover: { stance: 'crouching', bodyTilt: 8, legSpread: 40, armAngle: 35, shoulderDrop: 10 },
        attack: { stance: 'action', bodyTilt: -5, legSpread: 28, armAngle: 55, shoulderDrop: 3 },
        dead: { stance: 'fallen', bodyTilt: 90, legSpread: 15, armAngle: -30, shoulderDrop: 0 }
    },

    playerColors: [
        { name: 'green', primary: '#22c55e', secondary: '#16a34a', highlight: '#4ade80' },
        { name: 'red', primary: '#ef4444', secondary: '#dc2626', highlight: '#f87171' },
        { name: 'blue', primary: '#3b82f6', secondary: '#2563eb', highlight: '#60a5fa' },
        { name: 'yellow', primary: '#eab308', secondary: '#ca8a04', highlight: '#facc15' }
    ],

    skinTones: [
        { base: '#FFDBB4', shadow: '#E5C298', highlight: '#FFE8CC' },
        { base: '#E5C298', shadow: '#C69C6D', highlight: '#F5D4B0' },
        { base: '#C69C6D', shadow: '#A67C52', highlight: '#D8B088' },
        { base: '#A67C52', shadow: '#8D5524', highlight: '#B88C62' },
        { base: '#8D5524', shadow: '#704020', highlight: '#A06A38' }
    ],

    uniformColors: {
        woodland: { base: '#4a5a3a', light: '#5a6a4a', dark: '#3a4a2a' },
        digital: { base: '#5a6a5a', light: '#6a7a6a', dark: '#4a5a4a' },
        ghillie: { base: '#4a5d23', light: '#5c6b34', dark: '#3a4a1d' },
        black: { base: '#2a2a2a', light: '#3a3a3a', dark: '#1a1a1a' },
        desert: { base: '#c4a878', light: '#d4b888', dark: '#b49868' }
    },

    generate(classType, pose, playerIndex, width = 130, height = 130, options = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Enable anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Default: no team indicator for standalone sprite generation
        const showTeamIndicator = options.showTeamIndicator === true;

        const classConfig = this.classes[classType] || this.classes.scout;
        const poseConfig = this.poses[pose] || this.poses.normal;
        const playerColor = this.playerColors[playerIndex % this.playerColors.length];

        const seed = classType.charCodeAt(0) * 10000 + pose.charCodeAt(0) * 100 + playerIndex;
        const rand = this.seededRandom(seed);

        // Pick consistent skin tone based on seed
        const skinTone = this.skinTones[Math.floor(rand() * this.skinTones.length)];
        const uniform = this.uniformColors[classConfig.camouflage] || this.uniformColors.woodland;

        this.drawCharacter(ctx, classConfig, poseConfig, playerColor, skinTone, uniform, rand, width, height, showTeamIndicator);

        return canvas;
    },

    seededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    },

    drawCharacter(ctx, classConfig, poseConfig, playerColor, skinTone, uniform, rand, width, height, showTeamIndicator = false) {
        const centerX = width / 2;
        const groundY = height - 12;

        ctx.save();

        // Handle fallen pose rotation
        if (poseConfig.stance === 'fallen') {
            ctx.translate(centerX, groundY - 40);
            ctx.rotate(Math.PI / 2);
            ctx.translate(-centerX, -(groundY - 40));
        }

        // Calculate body positions based on stance
        const scale = poseConfig.stance === 'crouching' ? 0.75 : 1;
        const bodyY = groundY - (poseConfig.stance === 'crouching' ? 55 : 70);

        // Draw shadow first
        if (poseConfig.stance !== 'fallen') {
            this.drawShadow(ctx, centerX, groundY, poseConfig);
        }

        // Draw body parts in correct order (back to front)
        this.drawLegs(ctx, centerX, bodyY, groundY, poseConfig, uniform, classConfig);
        this.drawTorso(ctx, centerX, bodyY, poseConfig, uniform, classConfig, playerColor);
        this.drawArms(ctx, centerX, bodyY, poseConfig, uniform, skinTone, classConfig);
        this.drawWeapon(ctx, centerX, bodyY, poseConfig, classConfig);
        this.drawHead(ctx, centerX, bodyY, poseConfig, skinTone, uniform, classConfig, playerColor, rand);

        // Draw team indicator ring (only if explicitly requested)
        if (showTeamIndicator && poseConfig.stance !== 'fallen') {
            this.drawTeamIndicator(ctx, centerX, groundY, playerColor);
        }

        ctx.restore();
    },

    drawShadow(ctx, centerX, groundY, poseConfig) {
        ctx.save();
        ctx.globalAlpha = 0.35;

        // Wider shadow to match wider body
        const shadowWidth = poseConfig.stance === 'crouching' ? 42 : 38;
        const shadowHeight = poseConfig.stance === 'crouching' ? 14 : 12;

        const gradient = ctx.createRadialGradient(
            centerX, groundY - 2, 0,
            centerX, groundY - 2, shadowWidth
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(centerX, groundY - 2, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    drawLegs(ctx, centerX, bodyY, groundY, poseConfig, uniform, classConfig) {
        // Top-down perspective: legs are foreshortened, we see thigh tops and boot tops
        const legSpread = poseConfig.legSpread;
        const isCrouching = poseConfig.stance === 'crouching';

        // In top-down view, the "length" we see is mostly the foreshortened vertical distance
        const visibleLegLength = isCrouching ? 20 : 30;

        // Thigh width varies by build - increased for more substantial look
        const thighWidth = classConfig.bodyBuild === 'heavy' ? 14 :
                          classConfig.bodyBuild === 'lean' ? 10 : 12;

        // Lower leg (calf) width
        const calfWidth = thighWidth * 0.8;

        // Left leg (drawn first, slightly behind)
        this.drawLegTopDown(ctx, centerX - legSpread * 0.4, bodyY + 12,
                           -legSpread * 0.5, visibleLegLength,
                           thighWidth, calfWidth, uniform, isCrouching, false);

        // Right leg (slightly in front due to perspective)
        this.drawLegTopDown(ctx, centerX + legSpread * 0.4, bodyY + 12,
                           legSpread * 0.5, visibleLegLength,
                           thighWidth, calfWidth, uniform, isCrouching, true);

        // Boots with top-down perspective
        const bootLeftX = centerX - legSpread * 0.9;
        const bootRightX = centerX + legSpread * 0.9;
        const bootY = groundY - 6;

        this.drawBootTopDown(ctx, bootLeftX, bootY, false, isCrouching);
        this.drawBootTopDown(ctx, bootRightX, bootY, true, isCrouching);

        // Knee pads for heavy armor (visible from above)
        if (classConfig.armor === 'heavy') {
            const kneeY = isCrouching ? bodyY + 24 : bodyY + 28;
            const kneeOffsetX = legSpread * 0.55;

            // Left knee pad (top view - oval shape)
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.ellipse(centerX - kneeOffsetX, kneeY, 7, 8, -0.2, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.ellipse(centerX - kneeOffsetX - 1, kneeY - 1, 3.5, 4, -0.2, 0, Math.PI * 2);
            ctx.fill();

            // Right knee pad
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.ellipse(centerX + kneeOffsetX, kneeY, 7, 8, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.ellipse(centerX + kneeOffsetX + 1, kneeY - 1, 3.5, 4, 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    drawLegTopDown(ctx, hipX, hipY, spreadX, length, thighW, calfW, uniform, isCrouching, isRight) {
        // Top-down view: legs appear as foreshortened cylinders, we see the top surfaces
        const kneeY = hipY + length * 0.55;
        const ankleY = hipY + length;
        const kneeX = hipX + spreadX * 0.6;
        const ankleX = hipX + spreadX;

        ctx.save();

        // Thigh - draw as a tapered shape viewed from above
        // Create gradient for 3D shading
        const thighGrad = ctx.createLinearGradient(
            hipX - thighW, hipY,
            hipX + thighW, kneeY
        );
        thighGrad.addColorStop(0, uniform.light);
        thighGrad.addColorStop(0.3, uniform.base);
        thighGrad.addColorStop(0.7, uniform.base);
        thighGrad.addColorStop(1, uniform.dark);

        ctx.fillStyle = thighGrad;
        ctx.beginPath();
        // Hip attachment (wide)
        ctx.moveTo(hipX - thighW * 0.8, hipY);
        ctx.lineTo(hipX + thighW * 0.8, hipY);
        // Taper to knee
        ctx.quadraticCurveTo(
            hipX + spreadX * 0.3 + thighW * 0.7, hipY + length * 0.3,
            kneeX + thighW * 0.6, kneeY
        );
        ctx.lineTo(kneeX - thighW * 0.6, kneeY);
        ctx.quadraticCurveTo(
            hipX + spreadX * 0.3 - thighW * 0.7, hipY + length * 0.3,
            hipX - thighW * 0.8, hipY
        );
        ctx.closePath();
        ctx.fill();

        // Thigh top surface (the part we see from above) - lighter
        ctx.fillStyle = uniform.light;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.ellipse(hipX, hipY + 2, thighW * 0.7, thighW * 0.35,
                   isRight ? 0.15 : -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Lower leg / calf
        const calfGrad = ctx.createLinearGradient(
            kneeX - calfW, kneeY,
            ankleX + calfW, ankleY
        );
        calfGrad.addColorStop(0, uniform.base);
        calfGrad.addColorStop(0.5, uniform.base);
        calfGrad.addColorStop(1, uniform.dark);

        ctx.fillStyle = calfGrad;
        ctx.beginPath();
        ctx.moveTo(kneeX - calfW * 0.7, kneeY);
        ctx.lineTo(kneeX + calfW * 0.7, kneeY);
        // Taper to ankle
        ctx.quadraticCurveTo(
            kneeX + spreadX * 0.25 + calfW * 0.5, kneeY + length * 0.25,
            ankleX + calfW * 0.4, ankleY
        );
        ctx.lineTo(ankleX - calfW * 0.4, ankleY);
        ctx.quadraticCurveTo(
            kneeX + spreadX * 0.25 - calfW * 0.5, kneeY + length * 0.25,
            kneeX - calfW * 0.7, kneeY
        );
        ctx.closePath();
        ctx.fill();

        // Crouching adds more visible foreshortening - show bent knee angle
        if (isCrouching) {
            // Knee joint visible from above as a darker area
            ctx.fillStyle = uniform.dark;
            ctx.beginPath();
            ctx.ellipse(kneeX, kneeY, calfW * 0.65, calfW * 0.4,
                       isRight ? 0.2 : -0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Pants seam/crease detail
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(hipX + (isRight ? 1 : -1), hipY + 3);
        ctx.quadraticCurveTo(
            kneeX + (isRight ? 1 : -1), kneeY - 3,
            ankleX + (isRight ? 1 : -1), ankleY - 3
        );
        ctx.stroke();

        ctx.restore();
    },

    drawBootTopDown(ctx, x, y, isRight, isCrouching) {
        // Top-down boot view - we see the top of the boot and toe pointing forward/outward
        const bootLength = isCrouching ? 12 : 14;
        const bootWidth = 9;
        const toeAngle = isRight ? 0.2 : -0.2; // Toes point slightly outward

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(toeAngle);

        // Boot sole (shadow underneath)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(1, 2, bootWidth - 1, bootLength * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main boot body - viewed from above, it's an elongated oval
        const bootGrad = ctx.createLinearGradient(-bootWidth, 0, bootWidth, 0);
        bootGrad.addColorStop(0, '#1a1a1a');
        bootGrad.addColorStop(0.3, '#2a2a2a');
        bootGrad.addColorStop(0.7, '#2a2a2a');
        bootGrad.addColorStop(1, '#1a1a1a');

        ctx.fillStyle = bootGrad;
        ctx.beginPath();
        // Boot shape - heel at back (positive y), toe at front (negative y)
        ctx.moveTo(-bootWidth * 0.5, bootLength * 0.35); // heel left
        ctx.lineTo(bootWidth * 0.5, bootLength * 0.35);  // heel right
        ctx.quadraticCurveTo(bootWidth * 0.7, 0, bootWidth * 0.45, -bootLength * 0.4);
        ctx.quadraticCurveTo(0, -bootLength * 0.55, -bootWidth * 0.45, -bootLength * 0.4);
        ctx.quadraticCurveTo(-bootWidth * 0.7, 0, -bootWidth * 0.5, bootLength * 0.35);
        ctx.closePath();
        ctx.fill();

        // Boot top surface (the part we're looking down at) - leather texture
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.ellipse(0, -bootLength * 0.1, bootWidth * 0.55, bootLength * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ankle opening (dark hole where leg goes in)
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.ellipse(0, bootLength * 0.15, bootWidth * 0.35, bootLength * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boot cap / toe reinforcement
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(0, -bootLength * 0.35, bootWidth * 0.4, bootLength * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Highlight on boot top
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.ellipse(-bootWidth * 0.15, -bootLength * 0.15, bootWidth * 0.25, bootLength * 0.15, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Lace area detail (eyelets visible from above)
        ctx.fillStyle = '#1a1a1a';
        for (let i = 0; i < 3; i++) {
            const laceY = bootLength * 0.05 - i * bootLength * 0.12;
            ctx.beginPath();
            ctx.arc(-bootWidth * 0.15, laceY, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(bootWidth * 0.15, laceY, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Laces
        ctx.strokeStyle = '#3a3020';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) {
            const laceY = bootLength * 0.05 - i * bootLength * 0.12;
            ctx.beginPath();
            ctx.moveTo(-bootWidth * 0.15, laceY);
            ctx.lineTo(bootWidth * 0.15, laceY);
            ctx.stroke();
        }

        ctx.restore();
    },

    drawTorso(ctx, centerX, bodyY, poseConfig, uniform, classConfig, playerColor) {
        const tilt = poseConfig.bodyTilt * Math.PI / 180;

        ctx.save();
        ctx.translate(centerX, bodyY);
        ctx.rotate(tilt);

        // Wider body for more substantial human look
        const bodyWidth = classConfig.bodyBuild === 'heavy' ? 28 :
                         classConfig.bodyBuild === 'lean' ? 22 : 25;
        const shoulderWidth = bodyWidth * 1.15; // Broader shoulders
        const waistWidth = bodyWidth * 0.85;    // Tapered waist

        // Draw torso with proper human shape - broad shoulders, tapered waist
        const torsoGradient = ctx.createLinearGradient(-shoulderWidth, -28, shoulderWidth, 18);
        torsoGradient.addColorStop(0, uniform.light);
        torsoGradient.addColorStop(0.25, uniform.base);
        torsoGradient.addColorStop(0.75, uniform.base);
        torsoGradient.addColorStop(1, uniform.dark);

        ctx.fillStyle = torsoGradient;
        ctx.beginPath();
        // Shoulders (wide)
        ctx.moveTo(-shoulderWidth, -24);
        ctx.lineTo(shoulderWidth, -24);
        // Right side - taper to waist
        ctx.quadraticCurveTo(shoulderWidth + 2, -5, waistWidth, 18);
        // Bottom
        ctx.lineTo(-waistWidth, 18);
        // Left side - taper from waist to shoulder
        ctx.quadraticCurveTo(-shoulderWidth - 2, -5, -shoulderWidth, -24);
        ctx.closePath();
        ctx.fill();

        // Chest depth/muscle definition
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.beginPath();
        ctx.moveTo(-bodyWidth * 0.6, -18);
        ctx.quadraticCurveTo(0, -10, bodyWidth * 0.6, -18);
        ctx.lineTo(bodyWidth * 0.5, -5);
        ctx.quadraticCurveTo(0, 0, -bodyWidth * 0.5, -5);
        ctx.closePath();
        ctx.fill();

        // Side muscle definition
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.beginPath();
        ctx.ellipse(-bodyWidth * 0.7, -5, 4, 12, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(bodyWidth * 0.7, -5, 4, 12, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Armor/vest overlay
        if (classConfig.armor === 'heavy' || classConfig.armor === 'medium') {
            this.drawVest(ctx, bodyWidth, classConfig, playerColor);
        } else if (classConfig.armor === 'stealth') {
            this.drawStealthGear(ctx, bodyWidth);
        } else if (classConfig.armor === 'ghillie') {
            this.drawGhillieTorso(ctx, bodyWidth);
        }

        // Medic cross
        if (classConfig.cross) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 2;
            ctx.fillRect(-2, -12, 4, 16);
            ctx.fillRect(-6, -6, 12, 4);
            ctx.shadowBlur = 0;
        }

        // Team color shoulder patch
        ctx.fillStyle = playerColor.primary;
        ctx.strokeStyle = playerColor.secondary;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-bodyWidth + 4, -18, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Belt with pouches
        this.drawBelt(ctx, bodyWidth, classConfig);

        ctx.restore();
    },

    drawVest(ctx, bodyWidth, classConfig, playerColor) {
        const vestColor = classConfig.armor === 'heavy' ? '#3a3a3a' : '#4a4a4a';
        const vestWidth = bodyWidth * 0.82;
        const shoulderWidth = bodyWidth * 1.15;

        // Main vest following body shape
        ctx.fillStyle = vestColor;
        ctx.beginPath();
        ctx.moveTo(-vestWidth, -20);
        ctx.lineTo(vestWidth, -20);
        ctx.quadraticCurveTo(vestWidth + 1, -2, vestWidth * 0.85, 12);
        ctx.lineTo(-vestWidth * 0.85, 12);
        ctx.quadraticCurveTo(-vestWidth - 1, -2, -vestWidth, -20);
        ctx.closePath();
        ctx.fill();

        // Shoulder straps
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.moveTo(-vestWidth - 3, -20);
        ctx.lineTo(-vestWidth + 3, -20);
        ctx.lineTo(-vestWidth * 0.6, -24);
        ctx.lineTo(-vestWidth - 1, -24);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(vestWidth - 3, -20);
        ctx.lineTo(vestWidth + 3, -20);
        ctx.lineTo(vestWidth * 0.6, -24);
        ctx.lineTo(vestWidth + 1, -24);
        ctx.closePath();
        ctx.fill();

        // MOLLE webbing pattern
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 0.6;
        for (let i = 0; i < 4; i++) {
            const y = -14 + i * 7;
            ctx.beginPath();
            ctx.moveTo(-vestWidth * 0.75, y);
            ctx.lineTo(vestWidth * 0.75, y);
            ctx.stroke();
        }

        // Armor plate highlight
        if (classConfig.armor === 'heavy') {
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(-12, -17, 24, 28);
            ctx.fillStyle = '#5a5a5a';
            ctx.fillRect(-10, -15, 20, 2);
            // Plate carrier texture
            ctx.strokeStyle = 'rgba(80,80,80,0.3)';
            ctx.lineWidth = 0.4;
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.moveTo(-10, -13 + i * 4);
                ctx.lineTo(10, -13 + i * 4);
                ctx.stroke();
            }
        }

        // Magazine pouches
        ctx.fillStyle = '#3a3a3a';
        for (let i = -1; i <= 1; i++) {
            ctx.fillRect(i * 9 - 3.5, 2, 7, 11);
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(i * 9 - 3.5, 2, 7, 11);
            // Pouch flap
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(i * 9 - 3.5, 2, 7, 3);
            ctx.fillStyle = '#3a3a3a';
        }
    },

    drawStealthGear(ctx, bodyWidth) {
        // Minimal tactical gear
        ctx.fillStyle = '#1a1a1a';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(-bodyWidth * 0.5, -10, bodyWidth, 20);
        ctx.globalAlpha = 1;

        // Straps
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-bodyWidth * 0.7, -20);
        ctx.lineTo(-bodyWidth * 0.3, 15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bodyWidth * 0.7, -20);
        ctx.lineTo(bodyWidth * 0.3, 15);
        ctx.stroke();
    },

    drawGhillieTorso(ctx, bodyWidth) {
        // Ghillie strands on torso
        const colors = ['#4a5d23', '#3a4a1d', '#5c6b34', '#6a7a44'];

        for (let i = 0; i < 30; i++) {
            const x = (Math.random() - 0.5) * bodyWidth * 2;
            const y = -20 + Math.random() * 35;
            const length = 5 + Math.random() * 10;
            const angle = (Math.random() - 0.5) * 0.5;

            ctx.strokeStyle = colors[Math.floor(Math.random() * colors.length)];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.sin(angle) * length, y + Math.cos(angle) * length);
            ctx.stroke();
        }
    },

    drawBelt(ctx, bodyWidth, classConfig) {
        // Belt
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-bodyWidth * 0.9, 12, bodyWidth * 1.8, 5);

        // Belt buckle
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(-3, 12, 6, 5);

        // Side pouches
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(-bodyWidth * 0.85, 14, 8, 8);
        ctx.fillRect(bodyWidth * 0.85 - 8, 14, 8, 8);

        // Holster for pistol carriers
        if (classConfig.weapon === 'pistol' || classConfig.gear.includes('pistol')) {
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(bodyWidth * 0.5, 14, 6, 12);
        }
    },

    drawArms(ctx, centerX, bodyY, poseConfig, uniform, skinTone, classConfig) {
        const armAngle = poseConfig.armAngle * Math.PI / 180;
        const shoulderDrop = poseConfig.shoulderDrop || 0;

        // Wider body dimensions to match new torso
        const bodyWidth = classConfig.bodyBuild === 'heavy' ? 28 :
                         classConfig.bodyBuild === 'lean' ? 22 : 25;
        const shoulderWidth = bodyWidth * 1.15;

        // Arm proportions based on build
        const upperArmLength = classConfig.bodyBuild === 'heavy' ? 20 : 18;
        const forearmLength = classConfig.bodyBuild === 'heavy' ? 18 : 16;
        const armWidth = classConfig.bodyBuild === 'heavy' ? 10 :
                        classConfig.bodyBuild === 'lean' ? 7 : 8;

        // Left arm (background) - more relaxed position
        this.drawArmFilled(ctx, centerX - shoulderWidth + 3, bodyY - 22 + shoulderDrop,
                    Math.PI / 2 - armAngle * 0.25, upperArmLength, forearmLength, armWidth,
                    uniform, skinTone, false, classConfig);

        // Right arm (foreground, holding weapon)
        this.drawArmFilled(ctx, centerX + shoulderWidth - 3, bodyY - 22 + shoulderDrop,
                    Math.PI / 2 + armAngle * 0.7, upperArmLength, forearmLength, armWidth,
                    uniform, skinTone, true, classConfig);
    },

    drawArmFilled(ctx, shoulderX, shoulderY, angle, upperLen, foreLen, armWidth, uniform, skinTone, isRight, classConfig) {
        // Calculate joint positions
        const elbowX = shoulderX + Math.cos(angle) * upperLen;
        const elbowY = shoulderY + Math.sin(angle) * upperLen;
        // Elbow bends more naturally
        const elbowBend = isRight ? 0.45 : -0.35;
        const elbowAngle = angle + elbowBend;
        const handX = elbowX + Math.cos(elbowAngle) * foreLen;
        const handY = elbowY + Math.sin(elbowAngle) * foreLen;

        // Perpendicular angle for arm width
        const perpAngle = angle + Math.PI / 2;
        const elbowPerpAngle = elbowAngle + Math.PI / 2;

        ctx.save();

        // === UPPER ARM (as filled shape) ===
        const upperWidth = armWidth;
        const elbowWidth = armWidth * 0.85;

        // Upper arm gradient
        const upperGradient = ctx.createLinearGradient(
            shoulderX - Math.cos(perpAngle) * upperWidth,
            shoulderY - Math.sin(perpAngle) * upperWidth,
            shoulderX + Math.cos(perpAngle) * upperWidth,
            shoulderY + Math.sin(perpAngle) * upperWidth
        );
        upperGradient.addColorStop(0, uniform.dark);
        upperGradient.addColorStop(0.3, uniform.base);
        upperGradient.addColorStop(0.7, uniform.light);
        upperGradient.addColorStop(1, uniform.base);

        ctx.fillStyle = upperGradient;
        ctx.beginPath();
        // Shoulder (wide, rounded)
        ctx.moveTo(
            shoulderX - Math.cos(perpAngle) * upperWidth,
            shoulderY - Math.sin(perpAngle) * upperWidth
        );
        ctx.lineTo(
            shoulderX + Math.cos(perpAngle) * upperWidth,
            shoulderY + Math.sin(perpAngle) * upperWidth
        );
        // Taper to elbow
        ctx.lineTo(
            elbowX + Math.cos(perpAngle) * elbowWidth,
            elbowY + Math.sin(perpAngle) * elbowWidth
        );
        ctx.lineTo(
            elbowX - Math.cos(perpAngle) * elbowWidth,
            elbowY - Math.sin(perpAngle) * elbowWidth
        );
        ctx.closePath();
        ctx.fill();

        // Shoulder cap (rounded muscle)
        ctx.fillStyle = uniform.base;
        ctx.beginPath();
        ctx.ellipse(shoulderX, shoulderY, upperWidth, upperWidth * 0.7, angle, 0, Math.PI * 2);
        ctx.fill();

        // Deltoid highlight
        ctx.fillStyle = uniform.light;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(
            shoulderX - Math.cos(perpAngle) * upperWidth * 0.3,
            shoulderY - Math.sin(perpAngle) * upperWidth * 0.3,
            upperWidth * 0.5, upperWidth * 0.4, angle, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.globalAlpha = 1;

        // Bicep/tricep definition
        const bicepCenterX = shoulderX + Math.cos(angle) * upperLen * 0.45;
        const bicepCenterY = shoulderY + Math.sin(angle) * upperLen * 0.45;
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.beginPath();
        ctx.ellipse(
            bicepCenterX + Math.cos(perpAngle) * upperWidth * 0.3,
            bicepCenterY + Math.sin(perpAngle) * upperWidth * 0.3,
            upperLen * 0.25, upperWidth * 0.4, angle, 0, Math.PI * 2
        );
        ctx.fill();

        // === ELBOW JOINT ===
        ctx.fillStyle = uniform.dark;
        ctx.beginPath();
        ctx.ellipse(elbowX, elbowY, elbowWidth * 0.9, elbowWidth * 0.7, angle, 0, Math.PI * 2);
        ctx.fill();

        // Elbow pad for heavy armor
        if (classConfig.armor === 'heavy') {
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.ellipse(elbowX, elbowY, elbowWidth + 2, elbowWidth * 0.8, angle, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.ellipse(elbowX, elbowY, elbowWidth, elbowWidth * 0.5, angle, 0, Math.PI * 2);
            ctx.fill();
        }

        // === FOREARM (as filled shape) ===
        const forearmWidth = armWidth * 0.8;
        const wristWidth = armWidth * 0.6;

        // Forearm gradient
        const foreGradient = ctx.createLinearGradient(
            elbowX - Math.cos(elbowPerpAngle) * forearmWidth,
            elbowY - Math.sin(elbowPerpAngle) * forearmWidth,
            elbowX + Math.cos(elbowPerpAngle) * forearmWidth,
            elbowY + Math.sin(elbowPerpAngle) * forearmWidth
        );
        foreGradient.addColorStop(0, uniform.dark);
        foreGradient.addColorStop(0.3, uniform.base);
        foreGradient.addColorStop(0.7, uniform.light);
        foreGradient.addColorStop(1, uniform.base);

        ctx.fillStyle = foreGradient;
        ctx.beginPath();
        // Elbow end
        ctx.moveTo(
            elbowX - Math.cos(elbowPerpAngle) * forearmWidth,
            elbowY - Math.sin(elbowPerpAngle) * forearmWidth
        );
        ctx.lineTo(
            elbowX + Math.cos(elbowPerpAngle) * forearmWidth,
            elbowY + Math.sin(elbowPerpAngle) * forearmWidth
        );
        // Taper to wrist
        ctx.lineTo(
            handX + Math.cos(elbowPerpAngle) * wristWidth,
            handY + Math.sin(elbowPerpAngle) * wristWidth
        );
        ctx.lineTo(
            handX - Math.cos(elbowPerpAngle) * wristWidth,
            handY - Math.sin(elbowPerpAngle) * wristWidth
        );
        ctx.closePath();
        ctx.fill();

        // Forearm muscle definition
        const forearmMidX = elbowX + Math.cos(elbowAngle) * foreLen * 0.35;
        const forearmMidY = elbowY + Math.sin(elbowAngle) * foreLen * 0.35;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.ellipse(
            forearmMidX - Math.cos(elbowPerpAngle) * forearmWidth * 0.2,
            forearmMidY - Math.sin(elbowPerpAngle) * forearmWidth * 0.2,
            foreLen * 0.2, forearmWidth * 0.5, elbowAngle, 0, Math.PI * 2
        );
        ctx.fill();

        // === GLOVED HAND ===
        const handSize = armWidth * 0.8;

        // Glove base
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.ellipse(handX, handY, handSize, handSize * 0.8, elbowAngle, 0, Math.PI * 2);
        ctx.fill();

        // Glove highlight
        ctx.fillStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.ellipse(
            handX - Math.cos(elbowAngle + Math.PI/4) * handSize * 0.3,
            handY - Math.sin(elbowAngle + Math.PI/4) * handSize * 0.3,
            handSize * 0.5, handSize * 0.4, elbowAngle, 0, Math.PI * 2
        );
        ctx.fill();

        // Finger hints
        ctx.fillStyle = '#252525';
        for (let i = -1; i <= 1; i++) {
            const fingerAngle = elbowAngle + i * 0.25;
            const fingerX = handX + Math.cos(fingerAngle) * handSize * 0.7;
            const fingerY = handY + Math.sin(fingerAngle) * handSize * 0.7;
            ctx.beginPath();
            ctx.ellipse(fingerX, fingerY, handSize * 0.25, handSize * 0.2, fingerAngle, 0, Math.PI * 2);
            ctx.fill();
        }

        // Wrist cuff detail
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(
            handX - Math.cos(elbowAngle) * handSize * 0.5,
            handY - Math.sin(elbowAngle) * handSize * 0.5,
            wristWidth * 1.1, wristWidth * 0.6, elbowAngle, 0, Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
    },

    drawWeapon(ctx, centerX, bodyY, poseConfig, classConfig) {
        if (poseConfig.stance === 'fallen') return;

        // Match the new wider body dimensions
        const bodyWidth = classConfig.bodyBuild === 'heavy' ? 28 :
                         classConfig.bodyBuild === 'lean' ? 22 : 25;
        const shoulderWidth = bodyWidth * 1.15;
        const armAngle = poseConfig.armAngle * Math.PI / 180;
        const shoulderDrop = poseConfig.shoulderDrop || 0;

        // Arm lengths matching drawArmFilled
        const upperArmLength = classConfig.bodyBuild === 'heavy' ? 20 : 18;
        const forearmLength = classConfig.bodyBuild === 'heavy' ? 18 : 16;

        // Calculate hand position (matching drawArmFilled calculations for right arm)
        const shoulderX = centerX + shoulderWidth - 3;
        const shoulderY = bodyY - 22 + shoulderDrop;
        const angle = Math.PI / 2 + armAngle * 0.7;
        const elbowX = shoulderX + Math.cos(angle) * upperArmLength;
        const elbowY = shoulderY + Math.sin(angle) * upperArmLength;
        const elbowAngle = angle + 0.45; // Same elbowBend as in drawArmFilled
        const handX = elbowX + Math.cos(elbowAngle) * forearmLength;
        const handY = elbowY + Math.sin(elbowAngle) * forearmLength;

        ctx.save();
        ctx.translate(handX, handY);
        ctx.rotate(elbowAngle + Math.PI / 4);

        switch (classConfig.weapon) {
            case 'rifle':
                this.drawRifle(ctx);
                break;
            case 'smg':
                this.drawSMG(ctx);
                break;
            case 'sniper':
                this.drawSniperRifle(ctx);
                break;
            case 'pistol':
                this.drawPistol(ctx);
                break;
            case 'knife':
                this.drawKnife(ctx);
                break;
        }

        ctx.restore();
    },

    drawRifle(ctx) {
        // Stock
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-3, 12, 6, 16);

        // Receiver
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-4, -5, 8, 20);

        // Barrel
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-2, -22, 4, 20);

        // Magazine
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(-5, 2, 4, 12);

        // Sight
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-2, -8, 4, 4);

        // Grip
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(-5, 8, 4, 8);
    },

    drawSMG(ctx) {
        // Body
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-3, -10, 6, 22);

        // Magazine
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-4, 4, 4, 10);

        // Grip
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(-4, 8, 4, 7);

        // Stock (folded)
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(1, 8, 3, 8);
    },

    drawSniperRifle(ctx) {
        // Stock
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(-3, 15, 6, 20);

        // Receiver
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-3, -8, 6, 25);

        // Barrel
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-2, -30, 4, 25);

        // Scope
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-3, -20, 6, 14);
        ctx.fillStyle = '#4a7a9a';
        ctx.beginPath();
        ctx.arc(0, -20, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -8, 2, 0, Math.PI * 2);
        ctx.fill();

        // Bipod
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-2, -25);
        ctx.lineTo(-6, -35);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(2, -25);
        ctx.lineTo(6, -35);
        ctx.stroke();

        // Magazine
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-4, 0, 4, 8);
    },

    drawPistol(ctx) {
        // Slide
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-2, -8, 4, 12);

        // Grip
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(-3, 2, 6, 10);

        // Trigger guard
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-1, 4, 3, 0, Math.PI);
        ctx.stroke();
    },

    drawKnife(ctx) {
        // Blade
        ctx.fillStyle = '#c0c0c0';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(2, -4);
        ctx.lineTo(-2, -4);
        ctx.closePath();
        ctx.fill();

        // Blade edge highlight
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(-1, -4);
        ctx.stroke();

        // Guard
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-4, -4, 8, 3);

        // Handle
        ctx.fillStyle = '#4a3728';
        ctx.fillRect(-2, -1, 4, 12);

        // Handle wrap
        ctx.strokeStyle = '#3a2718';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-2, 1 + i * 3);
            ctx.lineTo(2, 1 + i * 3);
            ctx.stroke();
        }
    },

    drawHead(ctx, centerX, bodyY, poseConfig, skinTone, uniform, classConfig, playerColor, rand) {
        const headY = bodyY - (poseConfig.stance === 'crouching' ? 32 : 38);

        ctx.save();

        // Generate unique face characteristics based on random seed
        const faceWidth = 10 + rand() * 3;      // 10-13 (varied face width)
        const faceHeight = 12 + rand() * 3;     // 12-15 (varied face height)
        const jawSquare = rand() * 0.4;         // 0-0.4 (how square the jaw is)
        const cheekBones = rand() * 0.3;        // 0-0.3 (cheekbone prominence)
        const chinLength = 0.8 + rand() * 0.4;  // 0.8-1.2 (chin length)
        const browRidge = rand() * 0.5;         // 0-0.5 (brow prominence)
        const noseWidth = 2 + rand() * 2;       // 2-4 (nose width)
        const noseLength = 3 + rand() * 2;      // 3-5 (nose length)
        const lipThickness = 0.5 + rand() * 1;  // 0.5-1.5 (lip thickness)
        const eyeSpacing = 3 + rand() * 2;      // 3-5 (eye separation)
        const hasFacialHair = rand() > 0.6;     // 40% chance of facial hair
        const facialHairType = Math.floor(rand() * 3); // 0: stubble, 1: beard, 2: mustache

        // Wider neck with shading to match broader shoulders
        const neckWidth = 7;
        const neckGradient = ctx.createLinearGradient(centerX - neckWidth, headY + 14, centerX + neckWidth, headY + 22);
        neckGradient.addColorStop(0, skinTone.shadow);
        neckGradient.addColorStop(0.3, skinTone.base);
        neckGradient.addColorStop(0.7, skinTone.base);
        neckGradient.addColorStop(1, skinTone.shadow);
        ctx.fillStyle = neckGradient;
        ctx.fillRect(centerX - neckWidth, headY + 13, neckWidth * 2, 11);

        // Neck muscle definition (trapezius visible from above)
        ctx.fillStyle = skinTone.shadow;
        ctx.beginPath();
        ctx.moveTo(centerX - neckWidth - 3, headY + 20);
        ctx.quadraticCurveTo(centerX - neckWidth, headY + 16, centerX - neckWidth + 2, headY + 14);
        ctx.lineTo(centerX - neckWidth, headY + 14);
        ctx.lineTo(centerX - neckWidth - 3, headY + 22);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(centerX + neckWidth + 3, headY + 20);
        ctx.quadraticCurveTo(centerX + neckWidth, headY + 16, centerX + neckWidth - 2, headY + 14);
        ctx.lineTo(centerX + neckWidth, headY + 14);
        ctx.lineTo(centerX + neckWidth + 3, headY + 22);
        ctx.closePath();
        ctx.fill();

        // Neck shadow detail
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(centerX, headY + 14, 5, 2.5, 0, 0, Math.PI);
        ctx.fill();

        // Draw face with unique shape (not a simple ellipse)
        ctx.beginPath();
        // Start at top of head
        const topY = headY - faceHeight * 0.3;
        const chinY = headY + faceHeight * chinLength;

        // Right side of face (drawing clockwise)
        ctx.moveTo(centerX, topY);
        // Top-right curve (forehead)
        ctx.bezierCurveTo(
            centerX + faceWidth * 0.8, topY,
            centerX + faceWidth, headY - faceHeight * 0.1,
            centerX + faceWidth, headY + faceHeight * 0.1  // temple
        );
        // Cheekbone area
        ctx.bezierCurveTo(
            centerX + faceWidth * (1 + cheekBones), headY + faceHeight * 0.3,
            centerX + faceWidth * (1 + cheekBones * 0.5), headY + faceHeight * 0.5,
            centerX + faceWidth * (0.8 - jawSquare * 0.3), headY + faceHeight * 0.7  // jaw
        );
        // Jaw to chin
        ctx.bezierCurveTo(
            centerX + faceWidth * (0.6 - jawSquare * 0.2), headY + faceHeight * 0.9,
            centerX + faceWidth * 0.3, chinY,
            centerX, chinY  // chin point
        );
        // Left side (mirror)
        ctx.bezierCurveTo(
            centerX - faceWidth * 0.3, chinY,
            centerX - faceWidth * (0.6 - jawSquare * 0.2), headY + faceHeight * 0.9,
            centerX - faceWidth * (0.8 - jawSquare * 0.3), headY + faceHeight * 0.7
        );
        ctx.bezierCurveTo(
            centerX - faceWidth * (1 + cheekBones * 0.5), headY + faceHeight * 0.5,
            centerX - faceWidth * (1 + cheekBones), headY + faceHeight * 0.3,
            centerX - faceWidth, headY + faceHeight * 0.1
        );
        ctx.bezierCurveTo(
            centerX - faceWidth, headY - faceHeight * 0.1,
            centerX - faceWidth * 0.8, topY,
            centerX, topY
        );
        ctx.closePath();

        // Multi-layer face shading
        const faceGradient = ctx.createRadialGradient(
            centerX - 3, headY - 2, 0,
            centerX + 2, headY + 6, faceWidth * 1.5
        );
        faceGradient.addColorStop(0, skinTone.highlight);
        faceGradient.addColorStop(0.35, skinTone.base);
        faceGradient.addColorStop(0.7, skinTone.base);
        faceGradient.addColorStop(1, skinTone.shadow);
        ctx.fillStyle = faceGradient;
        ctx.fill();

        // Forehead highlight
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.ellipse(centerX - 1, headY - faceHeight * 0.15, faceWidth * 0.5, faceHeight * 0.2, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Cheekbone highlights
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.ellipse(centerX - faceWidth * 0.6, headY + 2, 3, 2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + faceWidth * 0.6, headY + 2, 3, 2, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Nose bridge shadow
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.ellipse(centerX + noseWidth * 0.3, headY + 2, noseWidth * 0.4, noseLength * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Under-eye shadows
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.beginPath();
        ctx.ellipse(centerX - eyeSpacing, headY + 6, 3, 1.5, 0, 0, Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + eyeSpacing, headY + 6, 3, 1.5, 0, 0, Math.PI);
        ctx.fill();

        // Jaw shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.moveTo(centerX - faceWidth * 0.7, headY + faceHeight * 0.6);
        ctx.quadraticCurveTo(centerX, chinY + 2, centerX + faceWidth * 0.7, headY + faceHeight * 0.6);
        ctx.lineTo(centerX + faceWidth * 0.5, headY + faceHeight * 0.8);
        ctx.quadraticCurveTo(centerX, chinY - 1, centerX - faceWidth * 0.5, headY + faceHeight * 0.8);
        ctx.closePath();
        ctx.fill();

        // Draw helmet/headgear (may cover parts of face)
        switch (classConfig.helmet) {
            case 'tactical':
                this.drawTacticalHelmet(ctx, centerX, headY, uniform, playerColor, faceWidth, faceHeight);
                break;
            case 'beret':
                this.drawBeret(ctx, centerX, headY, playerColor, faceWidth);
                break;
            case 'cap':
                this.drawCap(ctx, centerX, headY, uniform, faceWidth);
                break;
            case 'ghillie':
                this.drawGhillieHood(ctx, centerX, headY, rand, faceWidth, faceHeight);
                break;
            case 'balaclava':
                this.drawBalaclava(ctx, centerX, headY, skinTone, faceWidth, faceHeight);
                break;
        }

        // Detailed facial features (unless covered by balaclava or ghillie)
        if (classConfig.helmet !== 'balaclava' && classConfig.helmet !== 'ghillie') {
            // Eyebrows with variation
            const browY = headY + 1 - browRidge * 3;
            ctx.strokeStyle = 'rgba(40,30,20,0.6)';
            ctx.lineWidth = 1.5 + rand() * 0.5;
            ctx.lineCap = 'round';

            // Left eyebrow
            ctx.beginPath();
            ctx.moveTo(centerX - eyeSpacing - 3, browY + rand() * 1);
            ctx.quadraticCurveTo(centerX - eyeSpacing, browY - 1, centerX - eyeSpacing + 3, browY + 0.5);
            ctx.stroke();

            // Right eyebrow
            ctx.beginPath();
            ctx.moveTo(centerX + eyeSpacing - 3, browY + 0.5);
            ctx.quadraticCurveTo(centerX + eyeSpacing, browY - 1, centerX + eyeSpacing + 3, browY + rand() * 1);
            ctx.stroke();

            // Eye sockets (subtle depth)
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            ctx.beginPath();
            ctx.ellipse(centerX - eyeSpacing, headY + 4, 4, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(centerX + eyeSpacing, headY + 4, 4, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eyes with more detail
            const eyeY = headY + 4;

            // Eye whites
            ctx.fillStyle = '#f0ede8';
            ctx.beginPath();
            ctx.ellipse(centerX - eyeSpacing, eyeY, 2.5, 1.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(centerX + eyeSpacing, eyeY, 2.5, 1.8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Iris
            const irisColor = ['#4a3520', '#3a5040', '#4a5060', '#2a2520'][Math.floor(rand() * 4)];
            ctx.fillStyle = irisColor;
            ctx.beginPath();
            ctx.ellipse(centerX - eyeSpacing + 0.3, eyeY, 1.5, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(centerX + eyeSpacing + 0.3, eyeY, 1.5, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Pupils
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath();
            ctx.arc(centerX - eyeSpacing + 0.3, eyeY, 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX + eyeSpacing + 0.3, eyeY, 0.8, 0, Math.PI * 2);
            ctx.fill();

            // Eye highlights
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(centerX - eyeSpacing - 0.3, eyeY - 0.5, 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX + eyeSpacing - 0.3, eyeY - 0.5, 0.6, 0, Math.PI * 2);
            ctx.fill();

            // Eyelids (upper)
            ctx.strokeStyle = skinTone.shadow;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(centerX - eyeSpacing, eyeY, 2.5, Math.PI + 0.3, -0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(centerX + eyeSpacing, eyeY, 2.5, Math.PI + 0.3, -0.3);
            ctx.stroke();

            // Nose
            const noseY = headY + 6;
            // Nose bridge
            ctx.fillStyle = 'rgba(0,0,0,0.04)';
            ctx.beginPath();
            ctx.moveTo(centerX - 1, headY + 1);
            ctx.lineTo(centerX + 1, headY + 1);
            ctx.lineTo(centerX + noseWidth * 0.4, noseY + noseLength * 0.6);
            ctx.lineTo(centerX - noseWidth * 0.3, noseY + noseLength * 0.6);
            ctx.closePath();
            ctx.fill();

            // Nose tip highlight
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.ellipse(centerX, noseY + noseLength * 0.3, noseWidth * 0.35, noseLength * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();

            // Nostrils
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(centerX - noseWidth * 0.35, noseY + noseLength * 0.5, 1, 0.8, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(centerX + noseWidth * 0.35, noseY + noseLength * 0.5, 1, 0.8, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Nose bottom shadow
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.beginPath();
            ctx.ellipse(centerX, noseY + noseLength * 0.7, noseWidth * 0.6, 1, 0, 0, Math.PI);
            ctx.fill();

            // Mouth / lips
            const mouthY = headY + faceHeight * 0.55;

            // Upper lip
            ctx.fillStyle = 'rgba(140,80,70,0.3)';
            ctx.beginPath();
            ctx.moveTo(centerX - 3, mouthY);
            ctx.quadraticCurveTo(centerX - 1.5, mouthY - lipThickness * 0.8, centerX, mouthY - lipThickness * 0.3);
            ctx.quadraticCurveTo(centerX + 1.5, mouthY - lipThickness * 0.8, centerX + 3, mouthY);
            ctx.quadraticCurveTo(centerX, mouthY + lipThickness * 0.3, centerX - 3, mouthY);
            ctx.fill();

            // Mouth line
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(centerX - 3, mouthY);
            ctx.quadraticCurveTo(centerX, mouthY + 0.3, centerX + 3, mouthY);
            ctx.stroke();

            // Lower lip highlight
            ctx.fillStyle = 'rgba(255,200,180,0.15)';
            ctx.beginPath();
            ctx.ellipse(centerX, mouthY + lipThickness * 0.5, 2, lipThickness * 0.4, 0, 0, Math.PI);
            ctx.fill();

            // Philtrum (groove above lip)
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centerX - 0.8, noseY + noseLength * 0.6);
            ctx.lineTo(centerX - 0.5, mouthY - 1);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(centerX + 0.8, noseY + noseLength * 0.6);
            ctx.lineTo(centerX + 0.5, mouthY - 1);
            ctx.stroke();

            // Chin detail
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.ellipse(centerX, chinY - 3, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Facial hair (if applicable)
            if (hasFacialHair) {
                this.drawFacialHair(ctx, centerX, headY, faceWidth, faceHeight, chinY, mouthY, facialHairType, rand);
            }

            // Wrinkles/expression lines for some characters
            if (rand() > 0.5) {
                ctx.strokeStyle = 'rgba(0,0,0,0.04)';
                ctx.lineWidth = 0.5;

                // Forehead lines
                if (rand() > 0.6) {
                    for (let i = 0; i < 2; i++) {
                        ctx.beginPath();
                        ctx.moveTo(centerX - faceWidth * 0.4, headY - faceHeight * 0.2 + i * 2);
                        ctx.quadraticCurveTo(centerX, headY - faceHeight * 0.25 + i * 2, centerX + faceWidth * 0.4, headY - faceHeight * 0.2 + i * 2);
                        ctx.stroke();
                    }
                }

                // Crow's feet
                if (rand() > 0.7) {
                    ctx.lineWidth = 0.4;
                    for (let side = -1; side <= 1; side += 2) {
                        for (let i = 0; i < 2; i++) {
                            ctx.beginPath();
                            ctx.moveTo(centerX + side * (eyeSpacing + 3), eyeY + i - 1);
                            ctx.lineTo(centerX + side * (eyeSpacing + 5), eyeY + i * 1.5 - 1.5);
                            ctx.stroke();
                        }
                    }
                }
            }
        }

        ctx.restore();
    },

    drawFacialHair(ctx, centerX, headY, faceWidth, faceHeight, chinY, mouthY, type, rand) {
        ctx.fillStyle = 'rgba(30,25,20,0.4)';
        ctx.strokeStyle = 'rgba(30,25,20,0.3)';

        if (type === 0) {
            // Stubble - many tiny dots
            ctx.fillStyle = 'rgba(30,25,20,0.25)';
            for (let i = 0; i < 60; i++) {
                const angle = rand() * Math.PI;
                const dist = rand() * faceWidth * 0.8;
                const x = centerX + Math.cos(angle) * dist * (rand() > 0.5 ? 1 : -1);
                const y = mouthY + 2 + rand() * (chinY - mouthY - 4);
                if (y < chinY - 1) {
                    ctx.beginPath();
                    ctx.arc(x, y, 0.3 + rand() * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else if (type === 1) {
            // Short beard
            ctx.beginPath();
            ctx.moveTo(centerX - faceWidth * 0.6, mouthY + 3);
            ctx.quadraticCurveTo(centerX - faceWidth * 0.4, chinY - 2, centerX, chinY + 1);
            ctx.quadraticCurveTo(centerX + faceWidth * 0.4, chinY - 2, centerX + faceWidth * 0.6, mouthY + 3);
            ctx.lineTo(centerX + faceWidth * 0.5, mouthY + 1);
            ctx.quadraticCurveTo(centerX, mouthY + 3, centerX - faceWidth * 0.5, mouthY + 1);
            ctx.closePath();
            ctx.fill();

            // Beard texture
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 15; i++) {
                const x = centerX + (rand() - 0.5) * faceWidth * 0.8;
                const y = mouthY + 2 + rand() * (chinY - mouthY - 2);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + (rand() - 0.5) * 2, y + 2 + rand() * 2);
                ctx.stroke();
            }
        } else {
            // Mustache
            ctx.beginPath();
            ctx.moveTo(centerX - 4, mouthY - 1);
            ctx.quadraticCurveTo(centerX - 2, mouthY - 2, centerX, mouthY - 1.5);
            ctx.quadraticCurveTo(centerX + 2, mouthY - 2, centerX + 4, mouthY - 1);
            ctx.quadraticCurveTo(centerX + 3, mouthY + 0.5, centerX, mouthY);
            ctx.quadraticCurveTo(centerX - 3, mouthY + 0.5, centerX - 4, mouthY - 1);
            ctx.fill();
        }
    },

    drawTacticalHelmet(ctx, centerX, headY, uniform, playerColor, faceWidth = 11, faceHeight = 13) {
        const helmetWidth = faceWidth + 4;
        const helmetHeight = faceHeight * 0.8;

        // Helmet shell with more detail
        const helmetGradient = ctx.createLinearGradient(
            centerX - helmetWidth, headY - helmetHeight,
            centerX + helmetWidth, headY + 5
        );
        helmetGradient.addColorStop(0, uniform.light);
        helmetGradient.addColorStop(0.3, uniform.base);
        helmetGradient.addColorStop(0.7, uniform.base);
        helmetGradient.addColorStop(1, uniform.dark);

        ctx.fillStyle = helmetGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, headY - 3, helmetWidth, helmetHeight, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(centerX - helmetWidth, headY - 3, helmetWidth * 2, 6);

        // Helmet surface detail - subtle panels
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(centerX - helmetWidth * 0.3, headY - helmetHeight * 0.8);
        ctx.lineTo(centerX - helmetWidth * 0.4, headY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX + helmetWidth * 0.3, headY - helmetHeight * 0.8);
        ctx.lineTo(centerX + helmetWidth * 0.4, headY);
        ctx.stroke();

        // Helmet rim with depth
        ctx.fillStyle = uniform.dark;
        ctx.fillRect(centerX - helmetWidth + 1, headY + 1, helmetWidth * 2 - 2, 3);

        // Rim highlight
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(centerX - helmetWidth + 2, headY + 1, helmetWidth * 2 - 4, 1);

        // NVG mount with detail
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(centerX - 4, headY - helmetHeight - 2, 8, 6);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(centerX - 3, headY - helmetHeight - 1, 6, 4);

        // NVG mount screws
        ctx.fillStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.arc(centerX - 2, headY - helmetHeight, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 2, headY - helmetHeight, 1, 0, Math.PI * 2);
        ctx.fill();

        // Side rail
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(centerX + helmetWidth - 3, headY - 6, 4, 8);

        // Velcro patch area with texture
        ctx.fillStyle = uniform.dark;
        ctx.fillRect(centerX + 4, headY - 8, 7, 5);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.3;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(centerX + 5, headY - 7 + i * 2);
            ctx.lineTo(centerX + 10, headY - 7 + i * 2);
            ctx.stroke();
        }

        // Team color stripe with highlight
        ctx.fillStyle = playerColor.primary;
        ctx.fillRect(centerX - helmetWidth + 2, headY - 8, 3, 6);
        ctx.fillStyle = playerColor.highlight;
        ctx.fillRect(centerX - helmetWidth + 2, headY - 8, 1, 6);

        // Chin strap hints
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX - helmetWidth + 2, headY + 3);
        ctx.lineTo(centerX - helmetWidth + 4, headY + 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX + helmetWidth - 2, headY + 3);
        ctx.lineTo(centerX + helmetWidth - 4, headY + 8);
        ctx.stroke();
    },

    drawBeret(ctx, centerX, headY, playerColor, faceWidth = 11) {
        const beretWidth = faceWidth + 3;

        // Beret shape with better shading
        const beretGradient = ctx.createRadialGradient(
            centerX + 4, headY - 6, 0,
            centerX, headY - 2, beretWidth + 2
        );
        beretGradient.addColorStop(0, playerColor.highlight);
        beretGradient.addColorStop(0.4, playerColor.primary);
        beretGradient.addColorStop(0.8, playerColor.primary);
        beretGradient.addColorStop(1, playerColor.secondary);

        ctx.fillStyle = beretGradient;
        ctx.beginPath();
        ctx.ellipse(centerX + 3, headY - 5, beretWidth, 8, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Beret fold detail
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - beretWidth * 0.4, headY - 4);
        ctx.quadraticCurveTo(centerX + 2, headY - 8, centerX + beretWidth * 0.6, headY - 3);
        ctx.stroke();

        // Beret edge highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(centerX + 3, headY - 5, beretWidth - 1, Math.PI * 0.8, Math.PI * 1.5);
        ctx.stroke();

        // Beret badge/flash with detail
        ctx.fillStyle = '#c0c0c0';
        ctx.beginPath();
        ctx.arc(centerX - faceWidth + 4, headY - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Badge highlight
        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.arc(centerX - faceWidth + 3.5, headY - 3.5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Badge emblem (small star or symbol)
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.moveTo(centerX - faceWidth + 4, headY - 4.5);
        ctx.lineTo(centerX - faceWidth + 4.8, headY - 2.5);
        ctx.lineTo(centerX - faceWidth + 3.2, headY - 2.5);
        ctx.closePath();
        ctx.fill();
    },

    drawCap(ctx, centerX, headY, uniform, faceWidth = 11) {
        const capWidth = faceWidth + 3;

        // Cap crown with gradient
        const crownGradient = ctx.createLinearGradient(centerX - capWidth, headY - 10, centerX + capWidth, headY);
        crownGradient.addColorStop(0, uniform.light);
        crownGradient.addColorStop(0.5, uniform.base);
        crownGradient.addColorStop(1, uniform.dark);

        ctx.fillStyle = crownGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, headY - 4, capWidth, 8, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        // Cap panel stitching
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.5;
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(centerX + i * 4, headY - 11);
            ctx.lineTo(centerX + i * 3, headY - 4);
            ctx.stroke();
        }

        // Button on top
        ctx.fillStyle = uniform.dark;
        ctx.beginPath();
        ctx.arc(centerX, headY - 11, 2, 0, Math.PI * 2);
        ctx.fill();

        // Cap brim with depth
        const brimGradient = ctx.createLinearGradient(centerX, headY - 2, centerX, headY + 4);
        brimGradient.addColorStop(0, uniform.base);
        brimGradient.addColorStop(1, uniform.dark);

        ctx.fillStyle = brimGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, headY - 1, capWidth + 3, 5, 0, 0, Math.PI);
        ctx.fill();

        // Brim edge
        ctx.strokeStyle = uniform.dark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(centerX, headY - 1, capWidth + 3, 5, 0, 0, Math.PI);
        ctx.stroke();

        // Brim top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.ellipse(centerX, headY - 1, capWidth + 1, 2, 0, 0, Math.PI);
        ctx.fill();
    },

    drawGhillieHood(ctx, centerX, headY, rand, faceWidth = 11, faceHeight = 13) {
        const hoodWidth = faceWidth + 6;
        const hoodHeight = faceHeight + 5;

        // Base hood with gradient
        const hoodGradient = ctx.createRadialGradient(
            centerX - 2, headY - 4, 0,
            centerX, headY + 2, hoodWidth
        );
        hoodGradient.addColorStop(0, '#5c6b34');
        hoodGradient.addColorStop(0.5, '#4a5d23');
        hoodGradient.addColorStop(1, '#3a4a1d');

        ctx.fillStyle = hoodGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, headY, hoodWidth, hoodHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ghillie strands - more varied
        const colors = ['#4a5d23', '#3a4a1d', '#5c6b34', '#6a7a44', '#3a3a2a', '#5a6a34', '#4a5a24'];

        // Multiple layers of strands
        for (let layer = 0; layer < 3; layer++) {
            const strandCount = 20 + layer * 10;
            for (let i = 0; i < strandCount; i++) {
                const angle = rand() * Math.PI * 2;
                const dist = (10 + rand() * 10) * (0.8 + layer * 0.15);
                const x = centerX + Math.cos(angle) * (dist * 0.85);
                const y = headY + Math.sin(angle) * dist * 0.95;
                const length = 4 + rand() * 8 + layer * 3;
                const strandAngle = angle + (rand() - 0.5) * 1.0;
                const thickness = 0.8 + rand() * (1 + layer * 0.3);

                ctx.strokeStyle = colors[Math.floor(rand() * colors.length)];
                ctx.lineWidth = thickness;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x, y);

                // Curved strands
                const midX = x + Math.cos(strandAngle) * length * 0.5 + (rand() - 0.5) * 3;
                const midY = y + Math.sin(strandAngle) * length * 0.5;
                const endX = x + Math.cos(strandAngle) * length;
                const endY = y + Math.sin(strandAngle) * length;

                ctx.quadraticCurveTo(midX, midY, endX, endY);
                ctx.stroke();
            }
        }

        // Face opening with depth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(centerX, headY + 4, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner face opening
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(centerX, headY + 4, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes visible through opening
        ctx.fillStyle = '#f0ede8';
        ctx.beginPath();
        ctx.ellipse(centerX - 3, headY + 4, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + 3, headY + 4, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(centerX - 3, headY + 4, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 3, headY + 4, 1, 0, Math.PI * 2);
        ctx.fill();
    },

    drawBalaclava(ctx, centerX, headY, skinTone, faceWidth = 11, faceHeight = 13) {
        const maskWidth = faceWidth + 3;
        const maskHeight = faceHeight + 4;

        // Balaclava covering head with gradient
        const maskGradient = ctx.createRadialGradient(
            centerX - 3, headY, 0,
            centerX + 2, headY + 6, maskWidth + 5
        );
        maskGradient.addColorStop(0, '#2a2a2a');
        maskGradient.addColorStop(0.5, '#1a1a1a');
        maskGradient.addColorStop(1, '#0a0a0a');

        ctx.fillStyle = maskGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, headY + 4, maskWidth, maskHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        // Knit texture
        ctx.strokeStyle = 'rgba(40,40,40,0.3)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(centerX - maskWidth * 0.8, headY - maskHeight * 0.4 + i * 3);
            ctx.quadraticCurveTo(centerX, headY - maskHeight * 0.5 + i * 3, centerX + maskWidth * 0.8, headY - maskHeight * 0.4 + i * 3);
            ctx.stroke();
        }

        // Eye opening with depth
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(centerX, headY + 3, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Skin showing through
        const skinGradient = ctx.createRadialGradient(centerX - 2, headY + 2, 0, centerX, headY + 3, 9);
        skinGradient.addColorStop(0, skinTone.highlight);
        skinGradient.addColorStop(0.5, skinTone.base);
        skinGradient.addColorStop(1, skinTone.shadow);

        ctx.fillStyle = skinGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, headY + 3, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye sockets
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.beginPath();
        ctx.ellipse(centerX - 4, headY + 3, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + 4, headY + 3, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye whites
        ctx.fillStyle = '#f0ede8';
        ctx.beginPath();
        ctx.ellipse(centerX - 4, headY + 3, 2.5, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + 4, headY + 3, 2.5, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Irises
        ctx.fillStyle = '#3a3520';
        ctx.beginPath();
        ctx.ellipse(centerX - 4 + 0.3, headY + 3, 1.5, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + 4 + 0.3, headY + 3, 1.5, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(centerX - 4 + 0.3, headY + 3, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 4 + 0.3, headY + 3, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Eye highlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX - 4 - 0.3, headY + 2.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 4 - 0.3, headY + 2.5, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Brow wrinkles through mask
        ctx.strokeStyle = 'rgba(50,50,50,0.2)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(centerX - 6, headY);
        ctx.quadraticCurveTo(centerX, headY - 0.5, centerX + 6, headY);
        ctx.stroke();

        // Nose bridge hint
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.moveTo(centerX - 1, headY + 2);
        ctx.lineTo(centerX + 1, headY + 2);
        ctx.lineTo(centerX + 1.5, headY + 6);
        ctx.lineTo(centerX - 1.5, headY + 6);
        ctx.closePath();
        ctx.fill();
    },

    drawTeamIndicator(ctx, centerX, groundY, playerColor) {
        ctx.save();

        // Glowing ring effect
        const ringGradient = ctx.createRadialGradient(
            centerX, groundY - 3, 15,
            centerX, groundY - 3, 32
        );
        ringGradient.addColorStop(0, 'transparent');
        ringGradient.addColorStop(0.4, playerColor.primary + '80');
        ringGradient.addColorStop(0.7, playerColor.primary + '40');
        ringGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = ringGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, groundY - 3, 32, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner ring
        ctx.strokeStyle = playerColor.primary;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.ellipse(centerX, groundY - 3, 22, 6, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
};

window.CharacterGenerator = CharacterGenerator;
