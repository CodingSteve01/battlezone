/**
 * Shoreline Overlay Generator (Browser)
 * Creates directional overlay tiles for water/swamp edges.
 */

const ShorelineGenerator = {
    types: {
        water: {
            edgeColor: '#d8c08c',
            edgeShadow: '#b79962',
            foamColor: 'rgba(255, 255, 255, 0.35)'
        },
        swamp: {
            edgeColor: '#6d5b46',
            edgeShadow: '#4d3b2f',
            foamColor: 'rgba(180, 160, 130, 0.25)'
        }
    },

    generate(subtype, direction, variant, width = 256, height = 222) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);

        const config = this.types[subtype] || this.types.water;
        const seed = direction * 100 + variant * 13 + subtype.length * 7;
        const rand = ColorUtils.seededRandom(seed);

        const centerX = width / 2;
        const centerY = height / 2;
        const size = width / 2;

        const corners = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * (60 * i);
            corners.push({
                x: centerX + Math.cos(angle) * size,
                y: centerY + Math.sin(angle) * size
            });
        }

        const a = corners[direction];
        const b = corners[(direction + 1) % 6];

        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const toCenter = { x: centerX - mid.x, y: centerY - mid.y };
        const length = Math.hypot(toCenter.x, toCenter.y) || 1;
        const normal = { x: toCenter.x / length, y: toCenter.y / length };

        const bandWidth = size * 0.22;
        const innerA = { x: a.x + normal.x * bandWidth, y: a.y + normal.y * bandWidth };
        const innerB = { x: b.x + normal.x * bandWidth, y: b.y + normal.y * bandWidth };

        const gradient = ctx.createLinearGradient(
            mid.x, mid.y,
            mid.x + normal.x * bandWidth,
            mid.y + normal.y * bandWidth
        );
        gradient.addColorStop(0, config.edgeColor);
        gradient.addColorStop(0.45, config.edgeShadow);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(innerB.x, innerB.y);
        ctx.lineTo(innerA.x, innerA.y);
        ctx.closePath();
        ctx.fill();

        // Foam or wet rim
        ctx.strokeStyle = config.foamColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(
            a.x + normal.x * (bandWidth * 0.2),
            a.y + normal.y * (bandWidth * 0.2)
        );
        ctx.lineTo(
            b.x + normal.x * (bandWidth * 0.2),
            b.y + normal.y * (bandWidth * 0.2)
        );
        ctx.stroke();

        // Small grit texture
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        for (let i = 0; i < 25; i++) {
            const t = rand();
            const edgeX = a.x + (b.x - a.x) * t + normal.x * (rand() * bandWidth * 0.6);
            const edgeY = a.y + (b.y - a.y) * t + normal.y * (rand() * bandWidth * 0.6);
            const radius = 0.6 + rand() * 1.4;
            ctx.beginPath();
            ctx.ellipse(edgeX, edgeY, radius, radius * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        return canvas;
    }
};
