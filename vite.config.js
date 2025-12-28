import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';

// Helper to copy directory recursively
function copyDir(src, dest) {
    if (!existsSync(src)) return;
    mkdirSync(dest, { recursive: true });
    for (const file of readdirSync(src)) {
        const srcPath = resolve(src, file);
        const destPath = resolve(dest, file);
        if (statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

// Helper to get build hash from environment or generate one
function getBuildHash() {
    // Use commit hash from environment (set by CI) or generate timestamp-based hash
    return process.env.VITE_COMMIT_HASH || Date.now().toString(36);
}

export default defineConfig({
    // Base path for GitHub Pages deployment
    base: './',

    // Build configuration
    build: {
        outDir: 'dist',
        assetsDir: 'bundled',
        // Generate source maps for debugging
        sourcemap: false,
        // Minify for production
        minify: 'esbuild',
        // Copy static assets that aren't imported
        copyPublicDir: true,
        // Asset handling with content hashes for cache busting
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html')
            },
            output: {
                // Content hash in filenames for aggressive caching
                entryFileNames: 'js/[name]-[hash].js',
                chunkFileNames: 'js/[name]-[hash].js',
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name.split('.');
                    const ext = info[info.length - 1];
                    if (/css/i.test(ext)) {
                        return `css/[name]-[hash][extname]`;
                    }
                    return `bundled/[name]-[hash][extname]`;
                }
            }
        },
        // Increase chunk size warning limit for game assets
        chunkSizeWarningLimit: 1500
    },

    // Plugin to copy generated assets after build
    plugins: [
        {
            name: 'copy-game-assets',
            closeBundle() {
                // Copy generated game assets (terrain, units, details)
                copyDir('assets', 'dist/assets');
                // Copy manifest and icons
                if (existsSync('manifest.webmanifest')) {
                    copyFileSync('manifest.webmanifest', 'dist/manifest.webmanifest');
                }
                if (existsSync('icons')) {
                    copyDir('icons', 'dist/icons');
                }
                // Copy and process service worker with build hash
                if (existsSync('sw.js')) {
                    const buildHash = getBuildHash();
                    let swContent = readFileSync('sw.js', 'utf-8');
                    swContent = swContent.replace(/__BUILD_HASH__/g, buildHash);
                    writeFileSync('dist/sw.js', swContent);
                    console.log(`[vite] Service worker updated with hash: ${buildHash}`);
                }
            }
        }
    ],

    // Development server configuration
    server: {
        port: 3000,
        open: true,
        // Hot Module Replacement
        hmr: true
    },

    // Preview server (for testing production build)
    preview: {
        port: 4173
    },

    // Resolve aliases for cleaner imports
    resolve: {
        alias: {
            '@': resolve(__dirname, 'js'),
            '@assets': resolve(__dirname, 'assets')
        }
    },

    // Define global constants (accessible via import.meta.env)
    define: {
        __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
        __VERSION__: JSON.stringify(process.env.npm_package_version || 'dev')
    },

    // Public directory for static assets that shouldn't be processed
    publicDir: false
});
