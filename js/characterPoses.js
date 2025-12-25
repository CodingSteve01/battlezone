// ===== CHARACTER POSE SYSTEM =====
// Different poses for unit status: idle, crouch, attack, move, alert, wounded

/**
 * Unit status/pose constants
 */
export const UNIT_POSE = {
    IDLE: 'idle',
    CROUCH: 'crouch',      // In cover, ducking
    ATTACK: 'attack',       // Shooting/attacking
    MOVE: 'move',           // Walking animation frame
    ALERT: 'alert',         // Spotted enemy, raised weapon
    WOUNDED: 'wounded',     // Low HP, limping
    STEALTH: 'stealth'      // Sneaking (commando/sniper)
};

/**
 * Pose transformations applied to body parts
 * Each pose defines offsets and rotations for different body parts
 */
const POSE_TRANSFORMS = {
    [UNIT_POSE.IDLE]: {
        body: { y: 0, rotation: 0 },
        head: { y: 0, rotation: 0 },
        leftArm: { y: 0, rotation: 0, x: 0 },
        rightArm: { y: 0, rotation: 0, x: 0 },
        leftLeg: { y: 0, rotation: 0 },
        rightLeg: { y: 0, rotation: 0 },
        weaponAngle: 0
    },
    [UNIT_POSE.CROUCH]: {
        body: { y: 12, rotation: 0.1 },
        head: { y: 8, rotation: -0.1 },
        leftArm: { y: 8, rotation: 0.3, x: -3 },
        rightArm: { y: 8, rotation: -0.2, x: 3 },
        leftLeg: { y: 4, rotation: 0.8, spread: 8 },
        rightLeg: { y: 4, rotation: -0.8, spread: -8 },
        weaponAngle: -0.3,
        scale: { y: 0.75 }  // Compressed vertically
    },
    [UNIT_POSE.ATTACK]: {
        body: { y: 2, rotation: -0.15 },
        head: { y: 0, rotation: 0.1 },
        leftArm: { y: -2, rotation: -0.5, x: -5 },
        rightArm: { y: -4, rotation: 0.8, x: 8, extended: true },
        leftLeg: { y: 0, rotation: 0.1 },
        rightLeg: { y: 0, rotation: -0.2 },
        weaponAngle: 0.2,
        muzzleFlash: true
    },
    [UNIT_POSE.MOVE]: {
        body: { y: -2, rotation: 0.05 },
        head: { y: -2, rotation: 0 },
        leftArm: { y: 2, rotation: 0.4, x: 2 },
        rightArm: { y: -2, rotation: -0.4, x: -2 },
        leftLeg: { y: -3, rotation: -0.5, extended: true },
        rightLeg: { y: 3, rotation: 0.5 },
        weaponAngle: 0.1
    },
    [UNIT_POSE.ALERT]: {
        body: { y: -3, rotation: -0.1 },
        head: { y: -4, rotation: 0.15 },
        leftArm: { y: -4, rotation: -0.6, x: -4 },
        rightArm: { y: -6, rotation: 0.5, x: 6 },
        leftLeg: { y: 0, rotation: 0.15, spread: 4 },
        rightLeg: { y: 0, rotation: -0.15, spread: -4 },
        weaponAngle: 0.4,
        eyeGlow: true
    },
    [UNIT_POSE.WOUNDED]: {
        body: { y: 6, rotation: 0.2 },
        head: { y: 4, rotation: 0.15 },
        leftArm: { y: 4, rotation: 0.5, x: -2 },
        rightArm: { y: 2, rotation: 0.3, x: 1 },
        leftLeg: { y: 2, rotation: 0.3, limp: true },
        rightLeg: { y: 0, rotation: 0 },
        weaponAngle: 0.5
    },
    [UNIT_POSE.STEALTH]: {
        body: { y: 8, rotation: 0.2 },
        head: { y: 5, rotation: -0.1 },
        leftArm: { y: 5, rotation: 0.4, x: -4 },
        rightArm: { y: 5, rotation: -0.3, x: 4 },
        leftLeg: { y: 2, rotation: 0.4, spread: 6 },
        rightLeg: { y: 2, rotation: -0.4, spread: -6 },
        weaponAngle: -0.2,
        shadowAlpha: 0.3  // More transparent
    }
};

/**
 * Get pose transform for a given status
 */
export function getPoseTransform(status) {
    return POSE_TRANSFORMS[status] || POSE_TRANSFORMS[UNIT_POSE.IDLE];
}

/**
 * Draw character with pose-aware body parts
 * This is a helper that applies transforms to standard drawing
 */
export function applyPoseTransform(ctx, pose, bodyPart, callback) {
    const transform = pose[bodyPart] || { y: 0, rotation: 0, x: 0 };

    ctx.save();
    ctx.translate(transform.x || 0, transform.y || 0);
    ctx.rotate(transform.rotation || 0);

    callback(transform);

    ctx.restore();
}

/**
 * Draw muzzle flash effect for attack pose
 */
export function drawMuzzleFlash(ctx, x, y, size) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 200, 100, 0.9)');
    gradient.addColorStop(0.5, 'rgba(255, 150, 50, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Flash spikes
    ctx.strokeStyle = 'rgba(255, 255, 150, 0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const len = size * (0.8 + Math.random() * 0.4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
    }
}

/**
 * Draw alert eye glow effect
 */
export function drawAlertEyes(ctx, x, y, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, `${color}88`);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw wound effect (blood drips)
 */
export function drawWoundEffect(ctx, x, y, severity) {
    ctx.fillStyle = 'rgba(180, 40, 40, 0.7)';
    for (let i = 0; i < severity; i++) {
        const dx = (Math.random() - 0.5) * 20;
        const dy = Math.random() * 15;
        const size = 2 + Math.random() * 3;
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, size, size * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw stealth shimmer effect
 */
export function drawStealthShimmer(ctx, x, y, width, height) {
    ctx.save();
    ctx.globalAlpha = 0.15;

    // Distortion lines
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.5)';
    ctx.lineWidth = 1;

    for (let i = 0; i < 8; i++) {
        const yOffset = (i / 8) * height - height / 2;
        ctx.beginPath();
        ctx.moveTo(x - width / 2, y + yOffset);

        // Wavy distortion
        for (let j = 0; j <= 10; j++) {
            const xPos = x - width / 2 + (j / 10) * width;
            const wave = Math.sin(j * 0.8 + i * 0.5) * 3;
            ctx.lineTo(xPos, y + yOffset + wave);
        }
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Determine unit pose based on game state
 */
export function determineUnitPose(unit, isAttacking, isMoving, inCover) {
    if (!unit) return UNIT_POSE.IDLE;

    // Priority order for pose determination
    if (unit.cloaked || unit.stealthed) {
        return UNIT_POSE.STEALTH;
    }

    if (isAttacking) {
        return UNIT_POSE.ATTACK;
    }

    if (isMoving) {
        return UNIT_POSE.MOVE;
    }

    if (inCover) {
        return UNIT_POSE.CROUCH;
    }

    if (unit.hp < unit.maxHp * 0.3) {
        return UNIT_POSE.WOUNDED;
    }

    // Check if enemy nearby (alert state)
    // This would need to be passed in from game state
    if (unit.alert) {
        return UNIT_POSE.ALERT;
    }

    return UNIT_POSE.IDLE;
}

/**
 * Animation interpolation between poses
 */
export function interpolatePoses(fromPose, toPose, progress) {
    const result = {};

    for (const part of ['body', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
        const from = fromPose[part] || { y: 0, rotation: 0, x: 0 };
        const to = toPose[part] || { y: 0, rotation: 0, x: 0 };

        result[part] = {
            y: from.y + (to.y - from.y) * progress,
            rotation: from.rotation + (to.rotation - from.rotation) * progress,
            x: (from.x || 0) + ((to.x || 0) - (from.x || 0)) * progress
        };
    }

    result.weaponAngle = (fromPose.weaponAngle || 0) +
        ((toPose.weaponAngle || 0) - (fromPose.weaponAngle || 0)) * progress;

    return result;
}
