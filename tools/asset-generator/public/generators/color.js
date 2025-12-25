/**
 * Color Utilities (Browser)
 */

const ColorUtils = {
    seededRandom(seed) {
        let s = seed;
        return function() {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    },

    hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    },

    rgbToHex(r, g, b) {
        return '#' + [r, g, b]
            .map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
            .join('');
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 0, 0];
    },

    blendColors(color1, color2, factor) {
        const [r1, g1, b1] = this.hexToRgb(color1);
        const [r2, g2, b2] = this.hexToRgb(color2);
        return this.rgbToHex(
            Math.round(r1 + (r2 - r1) * factor),
            Math.round(g1 + (g2 - g1) * factor),
            Math.round(b1 + (b2 - b1) * factor)
        );
    },

    lightenColor(hex, amount) {
        const [r, g, b] = this.hexToRgb(hex);
        return this.rgbToHex(
            Math.min(255, r + amount),
            Math.min(255, g + amount),
            Math.min(255, b + amount)
        );
    },

    darkenColor(hex, amount) {
        const [r, g, b] = this.hexToRgb(hex);
        return this.rgbToHex(
            Math.max(0, r - amount),
            Math.max(0, g - amount),
            Math.max(0, b - amount)
        );
    }
};

window.ColorUtils = ColorUtils;
