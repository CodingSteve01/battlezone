/**
 * Character Generator (Browser)
 */

const CharacterGenerator = {
    classes: {
        scout: { helmet: 'beret', armor: 'light', weapon: 'smg', bodyWidth: 32 },
        assault: { helmet: 'tactical', armor: 'heavy', weapon: 'rifle', bodyWidth: 42 },
        medic: { helmet: 'cap', armor: 'medium', weapon: 'pistol', bodyWidth: 38, cross: true },
        sniper: { helmet: 'ghillie', armor: 'light', weapon: 'sniper', bodyWidth: 36 },
        commando: { helmet: 'balaclava', armor: 'light', weapon: 'knife', bodyWidth: 35 }
    },

    poses: {
        normal: { stance: 'standing', armL: -15, armR: 15 },
        cover: { stance: 'crouching', armL: -30, armR: 45 },
        attack: { stance: 'action', armL: -45, armR: 80 },
        dead: { stance: 'fallen', armL: 120, armR: -60 }
    },

    playerColors: [
        { name: 'green', primary: '#22c55e', secondary: '#16a34a' },
        { name: 'red', primary: '#ef4444', secondary: '#dc2626' },
        { name: 'blue', primary: '#3b82f6', secondary: '#2563eb' },
        { name: 'yellow', primary: '#eab308', secondary: '#ca8a04' }
    ],

    skinTones: ['#FFDBB4', '#E5C298', '#C69C6D', '#A67C52', '#8D5524'],

    generate(classType, pose, playerIndex, width = 256, height = 256) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);

        const classConfig = this.classes[classType] || this.classes.scout;
        const poseConfig = this.poses[pose] || this.poses.normal;
        const playerColor = this.playerColors[playerIndex % this.playerColors.length];

        const seed = classType.charCodeAt(0) * 10000 + pose.charCodeAt(0) * 100 + playerIndex;
        const rand = ColorUtils.seededRandom(seed);

        this.drawCharacter(ctx, classConfig, poseConfig, playerColor, rand, width, height);

        return canvas;
    },

    drawCharacter(ctx, classConfig, poseConfig, playerColor, rand, width, height) {
        const centerX = width / 2;
        const baseY = height - 18;

        ctx.save();

        // Apply fallen rotation
        if (poseConfig.stance === 'fallen') {
            ctx.translate(centerX, baseY - 50);
            ctx.rotate(Math.PI / 2);
            ctx.translate(-centerX, -(baseY - 50));
        }

        // Calculate positions based on stance
        let torsoY = baseY - 95;
        let headY = baseY - 148;
        let legSpread = 22;

        if (poseConfig.stance === 'crouching') {
            torsoY = baseY - 68;
            headY = baseY - 112;
            legSpread = 32;
        } else if (poseConfig.stance === 'action') {
            torsoY = baseY - 90;
            headY = baseY - 143;
            legSpread = 28;
        }

        const shoulderWidth = classConfig.armor === 'heavy' ? 42 : classConfig.armor === 'light' ? 30 : 36;
        const uniformColor = this.getUniformColor(rand);
        const skinTone = this.skinTones[Math.floor(rand() * this.skinTones.length)];

        // Draw shadow
        if (poseConfig.stance !== 'fallen') {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(centerX, baseY - 4, 45, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw legs
        this.drawLegs(ctx, centerX, torsoY, baseY, legSpread, uniformColor);

        // Draw body
        this.drawBody(ctx, centerX, torsoY, shoulderWidth, classConfig.bodyWidth, uniformColor, classConfig, playerColor);

        // Draw arms
        this.drawArms(ctx, centerX, torsoY, shoulderWidth, poseConfig, uniformColor);

        // Draw weapon
        this.drawWeapon(ctx, centerX, torsoY, shoulderWidth, poseConfig, classConfig);

        // Draw head
        this.drawHead(ctx, centerX, headY, skinTone, classConfig, uniformColor, playerColor, rand);

        // Draw team indicator
        if (poseConfig.stance !== 'fallen') {
            this.drawTeamIndicator(ctx, centerX, baseY, playerColor);
        }

        ctx.restore();
    },

    drawLegs(ctx, centerX, torsoY, baseY, legSpread, uniformColor) {
        const pantsColor = ColorUtils.darkenColor(uniformColor, 12);

        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.strokeStyle = pantsColor;

        // Left leg
        ctx.beginPath();
        ctx.moveTo(centerX - legSpread * 0.3, torsoY + 18);
        ctx.lineTo(centerX - legSpread, baseY - 4);
        ctx.stroke();

        // Right leg
        ctx.beginPath();
        ctx.moveTo(centerX + legSpread * 0.3, torsoY + 18);
        ctx.lineTo(centerX + legSpread, baseY - 4);
        ctx.stroke();

        // Boots
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.ellipse(centerX - legSpread, baseY - 4, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + legSpread, baseY - 4, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    drawBody(ctx, centerX, torsoY, shoulderWidth, bodyWidth, uniformColor, classConfig, playerColor) {
        // Torso
        ctx.fillStyle = uniformColor;
        ctx.beginPath();
        ctx.moveTo(centerX - shoulderWidth, torsoY - 28);
        ctx.lineTo(centerX + shoulderWidth, torsoY - 28);
        ctx.lineTo(centerX + bodyWidth * 0.75, torsoY + 28);
        ctx.lineTo(centerX - bodyWidth * 0.75, torsoY + 28);
        ctx.closePath();
        ctx.fill();

        // Vest/Armor
        if (classConfig.armor !== 'light') {
            const vestColor = classConfig.armor === 'heavy' ? '#3D3D3D' : '#4A4A4A';
            ctx.fillStyle = vestColor;
            ctx.beginPath();
            ctx.moveTo(centerX - shoulderWidth * 0.75, torsoY - 22);
            ctx.lineTo(centerX + shoulderWidth * 0.75, torsoY - 22);
            ctx.lineTo(centerX + bodyWidth * 0.55, torsoY + 18);
            ctx.lineTo(centerX - bodyWidth * 0.55, torsoY + 18);
            ctx.closePath();
            ctx.fill();

            // Armor plate
            ctx.fillStyle = '#2D2D2D';
            ctx.fillRect(centerX - 13, torsoY - 18, 26, 32);
        }

        // Medic cross
        if (classConfig.cross) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(centerX - 3, torsoY - 12, 6, 22);
            ctx.fillRect(centerX - 9, torsoY - 3, 18, 6);
        }

        // Team color patch
        ctx.fillStyle = playerColor.primary;
        ctx.beginPath();
        ctx.arc(centerX - shoulderWidth + 7, torsoY - 22, 7, 0, Math.PI * 2);
        ctx.fill();

        // Belt
        ctx.fillStyle = '#2D2D2D';
        ctx.fillRect(centerX - 28, torsoY + 13, 56, 7);

        // Pouches
        ctx.fillStyle = '#3D3D3D';
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(centerX - 22 + i * 16, torsoY + 16, 10, 12);
        }
    },

    drawArms(ctx, centerX, torsoY, shoulderWidth, poseConfig, uniformColor) {
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.strokeStyle = uniformColor;

        const armLength = 40;
        const leftRad = poseConfig.armL * Math.PI / 180;
        const rightRad = poseConfig.armR * Math.PI / 180;

        // Left arm
        const leftShoulderX = centerX - shoulderWidth + 4;
        const leftShoulderY = torsoY - 22;
        ctx.beginPath();
        ctx.moveTo(leftShoulderX, leftShoulderY);
        ctx.lineTo(leftShoulderX + Math.cos(leftRad) * armLength, leftShoulderY + Math.sin(leftRad) * armLength);
        ctx.stroke();

        // Right arm
        const rightShoulderX = centerX + shoulderWidth - 4;
        const rightShoulderY = torsoY - 22;
        ctx.beginPath();
        ctx.moveTo(rightShoulderX, rightShoulderY);
        ctx.lineTo(rightShoulderX + Math.cos(rightRad) * armLength, rightShoulderY + Math.sin(rightRad) * armLength);
        ctx.stroke();

        // Gloves
        ctx.fillStyle = '#2D2D2D';
        ctx.beginPath();
        ctx.arc(leftShoulderX + Math.cos(leftRad) * armLength, leftShoulderY + Math.sin(leftRad) * armLength, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rightShoulderX + Math.cos(rightRad) * armLength, rightShoulderY + Math.sin(rightRad) * armLength, 5, 0, Math.PI * 2);
        ctx.fill();
    },

    drawWeapon(ctx, centerX, torsoY, shoulderWidth, poseConfig, classConfig) {
        if (poseConfig.stance === 'fallen') return;

        const rightRad = poseConfig.armR * Math.PI / 180;
        const handX = centerX + shoulderWidth - 4 + Math.cos(rightRad) * 40;
        const handY = torsoY - 22 + Math.sin(rightRad) * 40;

        ctx.save();
        ctx.translate(handX, handY);
        ctx.rotate(rightRad + Math.PI / 4);

        ctx.fillStyle = '#1A1A1A';

        switch (classConfig.weapon) {
            case 'rifle':
                ctx.fillRect(-4, -22, 8, 45);
                ctx.fillRect(-7, -4, 14, 12);
                break;
            case 'smg':
                ctx.fillRect(-3, -12, 6, 30);
                ctx.fillRect(-5, 0, 10, 10);
                break;
            case 'sniper':
                ctx.fillRect(-3, -30, 6, 60);
                ctx.fillRect(-5, -8, 10, 7);
                ctx.fillStyle = '#555555';
                ctx.fillRect(-2, -26, 4, 12);
                break;
            case 'pistol':
                ctx.fillRect(-2.5, -6, 5, 18);
                ctx.fillRect(-4, 5, 8, 7);
                break;
            case 'knife':
                ctx.fillStyle = '#B0B0B0';
                ctx.fillRect(-1.5, -18, 3, 22);
                ctx.fillStyle = '#4A3728';
                ctx.fillRect(-2.5, 4, 5, 10);
                break;
        }

        ctx.restore();
    },

    drawHead(ctx, centerX, headY, skinTone, classConfig, uniformColor, playerColor, rand) {
        // Face
        ctx.fillStyle = skinTone;
        ctx.beginPath();
        ctx.ellipse(centerX, headY + 18, 16, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.ellipse(centerX - 5, headY + 16, 2.5, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + 5, headY + 16, 2.5, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Helmet/headgear
        switch (classConfig.helmet) {
            case 'tactical':
                ctx.fillStyle = uniformColor;
                ctx.beginPath();
                ctx.ellipse(centerX, headY + 4, 20, 16, 0, Math.PI, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(centerX - 20, headY + 4, 40, 8);
                ctx.fillStyle = '#1A1A1A';
                ctx.fillRect(centerX - 4, headY - 7, 8, 7);
                break;

            case 'beret':
                ctx.fillStyle = playerColor.primary;
                ctx.beginPath();
                ctx.ellipse(centerX + 4, headY + 1, 18, 10, 0.3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'cap':
                ctx.fillStyle = uniformColor;
                ctx.beginPath();
                ctx.ellipse(centerX, headY + 6, 18, 9, 0, Math.PI, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = ColorUtils.darkenColor(uniformColor, 18);
                ctx.beginPath();
                ctx.ellipse(centerX, headY + 6, 22, 5, 0, 0, Math.PI);
                ctx.fill();
                break;

            case 'ghillie':
                ctx.fillStyle = '#4A5D23';
                ctx.beginPath();
                ctx.ellipse(centerX, headY + 4, 22, 20, 0, 0, Math.PI * 2);
                ctx.fill();

                for (let i = 0; i < 15; i++) {
                    const angle = rand() * Math.PI * 2;
                    const len = 8 + rand() * 12;
                    ctx.strokeStyle = ['#4A5D23', '#3A4A1D', '#5C6B34'][Math.floor(rand() * 3)];
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(centerX + Math.cos(angle) * 18, headY + 4 + Math.sin(angle) * 16);
                    ctx.lineTo(centerX + Math.cos(angle) * (18 + len), headY + 4 + Math.sin(angle) * (16 + len * 0.4));
                    ctx.stroke();
                }
                break;

            case 'balaclava':
                ctx.fillStyle = '#1A1A1A';
                ctx.beginPath();
                ctx.ellipse(centerX, headY + 12, 18, 22, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = skinTone;
                ctx.beginPath();
                ctx.ellipse(centerX, headY + 16, 12, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    },

    drawTeamIndicator(ctx, centerX, baseY, playerColor) {
        ctx.save();
        ctx.globalAlpha = 0.7;

        const grad = ctx.createRadialGradient(centerX, baseY - 4, 0, centerX, baseY - 4, 38);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.6, playerColor.primary);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(centerX, baseY - 4, 38, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    getUniformColor(rand) {
        const h = 85 + rand() * 15;
        const s = 25 + rand() * 15;
        const l = 30 + rand() * 10;
        const [r, g, b] = ColorUtils.hslToRgb(h / 360, s / 100, l / 100);
        return ColorUtils.rgbToHex(r, g, b);
    }
};

window.CharacterGenerator = CharacterGenerator;
