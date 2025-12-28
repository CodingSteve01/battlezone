#!/usr/bin/env node

/**
 * Headless Asset Generator Script
 *
 * Uses Playwright to run the asset generator in headless mode
 * and save the generated sprite sheets to assets/spritesheets/
 *
 * Usage:
 *   node scripts/generate-assets.js
 *   node scripts/generate-assets.js --headed  # For debugging
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const GENERATOR_PORT = 3456;
const TIMEOUT = 120000; // 2 minutes for generation

async function startAssetServer() {
    console.log('Starting asset generator server...');

    const serverProcess = spawn('node', ['bin/cli.js', '--port', GENERATOR_PORT.toString(), '--no-open'], {
        cwd: path.join(projectRoot, 'tools', 'asset-generator'),
        stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server start timeout')), 30000);

        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('[Server]', output.trim());
            if (output.includes('Server running')) {
                clearTimeout(timeout);
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error('[Server Error]', data.toString().trim());
        });

        serverProcess.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });

    return serverProcess;
}

async function generateAssets(headed = false) {
    let server = null;
    let browser = null;

    try {
        // Install dependencies for asset generator if needed
        const generatorPath = path.join(projectRoot, 'tools', 'asset-generator');
        if (!fs.existsSync(path.join(generatorPath, 'node_modules'))) {
            console.log('Installing asset generator dependencies...');
            const { execSync } = await import('child_process');
            execSync('npm install', { cwd: generatorPath, stdio: 'inherit' });
        }

        // Start the asset server
        server = await startAssetServer();

        // Launch browser
        console.log('Launching browser...');
        browser = await chromium.launch({
            headless: !headed,
            args: ['--disable-web-security'] // Allow file access for canvas
        });

        const page = await browser.newPage();

        // Navigate to the generator
        const url = `http://localhost:${GENERATOR_PORT}`;
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle' });

        // Wait for the page to be ready
        await page.waitForSelector('#status', { timeout: 10000 });
        console.log('Asset generator loaded');

        // Click "Generate All" button
        console.log('Generating all assets...');
        await page.click('button:has-text("Generate All")');

        // Wait for generation to complete
        await page.waitForFunction(
            () => {
                const status = document.getElementById('status');
                return status && status.textContent.includes('All assets generated');
            },
            { timeout: TIMEOUT }
        );
        console.log('Assets generated successfully');

        // Wait for sprite sheets tab to be populated
        await page.waitForTimeout(1000);

        // Save all assets to the assets folder
        console.log('Saving assets to assets/spritesheets/...');

        // Click all "Save to Assets" buttons
        const saveButtons = await page.$$('button:has-text("Save to Assets")');
        console.log(`Found ${saveButtons.length} sprite sheets to save`);

        for (const button of saveButtons) {
            await button.click();
            await page.waitForTimeout(500); // Wait between saves
        }

        // Wait for all saves to complete
        await page.waitForTimeout(2000);

        // Verify the assets were saved
        const assetsDir = path.join(projectRoot, 'assets', 'spritesheets');
        const files = fs.readdirSync(assetsDir);
        console.log('\nSaved files:');
        for (const file of files) {
            const stats = fs.statSync(path.join(assetsDir, file));
            console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        }

        console.log('\nAsset generation complete!');

    } catch (error) {
        console.error('Asset generation failed:', error.message);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
        if (server) {
            server.kill();
        }
    }
}

// Parse arguments
const args = process.argv.slice(2);
const headed = args.includes('--headed');

generateAssets(headed);
