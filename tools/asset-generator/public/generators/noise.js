/**
 * Simplex Noise Implementation (Browser)
 * Based on Stefan Gustavson's implementation
 */

class SimplexNoise {
    constructor(seed = Math.random() * 10000) {
        this.p = new Uint8Array(256);
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);

        // Initialize permutation table with seed
        const random = this.seededRandom(seed);
        for (let i = 0; i < 256; i++) {
            this.p[i] = i;
        }

        // Shuffle
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }

        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }

    seededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    noise2D(x, y) {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;

        const grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];

        const dot2 = (g, x, y) => g[0] * x + g[1] * y;

        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;

        const X0 = i - t;
        const Y0 = j - t;
        const x0 = x - X0;
        const y0 = y - Y0;

        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; }
        else { i1 = 0; j1 = 1; }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;

        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.permMod12[ii + this.perm[jj]];
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
        const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        let n0 = t0 < 0 ? 0 : Math.pow(t0, 4) * dot2(grad3[gi0], x0, y0);

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        let n1 = t1 < 0 ? 0 : Math.pow(t1, 4) * dot2(grad3[gi1], x1, y1);

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        let n2 = t2 < 0 ? 0 : Math.pow(t2, 4) * dot2(grad3[gi2], x2, y2);

        return 70 * (n0 + n1 + n2);
    }
}

window.SimplexNoise = SimplexNoise;
