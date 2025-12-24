#!/usr/bin/env node
/**
 * Asset Generation Script for Shadow Squad
 *
 * Uses Playwright to run the browser-based asset generator
 * and save the generated PNG files to the assets directory.
 *
 * Run: node scripts/generate-assets.js
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync as fsExists } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ASSETS_DIR = join(__dirname, '..', 'assets');
const TOOLS_DIR = join(__dirname, '..', 'tools');
const ICONS_DIR = join(__dirname, '..', 'icons');

function resolveChromiumExecutable() {
    // Playwright sometimes returns the x64 path even on ARM Macs; pick an existing one.
    const defaultPath = chromium.executablePath();
    const armPath = join(
        process.env.HOME || '',
        'Library',
        'Caches',
        'ms-playwright',
        'chromium-1200',
        'chrome-mac-arm64',
        'Google Chrome for Testing.app',
        'Contents',
        'MacOS',
        'Google Chrome for Testing'
    );

    if (fsExists(armPath)) return armPath;
    return defaultPath;
}

async function generateAssets() {
    console.log('🎨 Shadow Squad Asset Generator\n');

    // Ensure asset directories exist
    const dirs = ['terrain', 'units', 'details'];
    for (const dir of dirs) {
        const path = join(ASSETS_DIR, dir);
        if (!existsSync(path)) {
            mkdirSync(path, { recursive: true });
            console.log(`  Created directory: assets/${dir}`);
        }
    }

    console.log('\n📦 Starting browser-based generation...\n');

    // Launch browser with better error handling
    console.log('  Launching Chromium...');
    const browser = await chromium.launch({
        headless: true,
        executablePath: resolveChromiumExecutable(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-crash-reporter'
        ]
    });
    const page = await browser.newPage();

    // Enable console logging from the page
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`  [Browser Error] ${msg.text()}`);
        }
    });

    page.on('pageerror', err => {
        console.log(`  [Page Error] ${err.message}`);
    });

    // Load the asset generator HTML
    const htmlPath = `file://${join(TOOLS_DIR, 'asset-generator.html')}`;
    await page.goto(htmlPath);

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');

    // Generate terrain assets
    console.log('⏳ Generating terrain textures...');
    await page.click('#btn-terrain');
    await page.waitForFunction(() => !document.getElementById('btn-terrain').disabled, { timeout: 60000 });

    const terrainAssets = await page.evaluate(() => {
        const previews = document.querySelectorAll('#terrain-preview .preview-item');
        const assets = [];
        previews.forEach(preview => {
            const canvas = preview.querySelector('canvas');
            const name = preview.querySelector('.name').textContent;
            assets.push({
                name,
                dataUrl: canvas.toDataURL('image/png')
            });
        });
        return assets;
    });

    for (const asset of terrainAssets) {
        const base64Data = asset.dataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = join(ASSETS_DIR, 'terrain', asset.name);
        writeFileSync(filePath, buffer);
        console.log(`  ✓ assets/terrain/${asset.name}`);
    }

    // Generate unit assets
    console.log('\n⏳ Generating unit sprites...');
    await page.click('#btn-units');
    await page.waitForFunction(() => !document.getElementById('btn-units').disabled, { timeout: 120000 });

    const unitAssets = await page.evaluate(() => {
        const previews = document.querySelectorAll('#units-preview .preview-item');
        const assets = [];
        previews.forEach(preview => {
            const canvas = preview.querySelector('canvas');
            const name = preview.querySelector('.name').textContent;
            assets.push({
                name,
                dataUrl: canvas.toDataURL('image/png')
            });
        });
        return assets;
    });

    for (const asset of unitAssets) {
        const base64Data = asset.dataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = join(ASSETS_DIR, 'units', asset.name);
        writeFileSync(filePath, buffer);
        console.log(`  ✓ assets/units/${asset.name}`);
    }

    // Generate detail assets
    console.log('\n⏳ Generating terrain details...');
    await page.click('#btn-details');
    await page.waitForFunction(() => !document.getElementById('btn-details').disabled, { timeout: 120000 });

    const detailAssets = await page.evaluate(() => {
        const previews = document.querySelectorAll('#details-preview .preview-item');
        const assets = [];
        previews.forEach(preview => {
            const canvas = preview.querySelector('canvas');
            const name = preview.querySelector('.name').textContent;
            assets.push({
                name,
                dataUrl: canvas.toDataURL('image/png')
            });
        });
        return assets;
    });

    for (const asset of detailAssets) {
        const base64Data = asset.dataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = join(ASSETS_DIR, 'details', asset.name);
        writeFileSync(filePath, buffer);
        console.log(`  ✓ assets/details/${asset.name}`);
    }

    // Generate app icons from SVG
    console.log('\n⏳ Generating app icons...');
    const iconSizes = [120, 152, 180, 192, 512];

    // Read SVG file with Node.js to avoid CORS issues with file:// protocol
    const svgPath = join(ICONS_DIR, 'icon.svg');
    const svgText = readFileSync(svgPath, 'utf-8');

    for (const size of iconSizes) {
        const iconDataUrl = await page.evaluate(async ({ size, svgText }) => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            const img = new Image();
            const blob = new Blob([svgText], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });

            ctx.drawImage(img, 0, 0, size, size);
            URL.revokeObjectURL(url);

            return canvas.toDataURL('image/png');
        }, { size, svgText });

        const base64Data = iconDataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = join(ICONS_DIR, `icon-${size}.png`);
        writeFileSync(filePath, buffer);
        console.log(`  ✓ icons/icon-${size}.png`);
    }

    await browser.close();

    const totalAssets = terrainAssets.length + unitAssets.length + detailAssets.length + iconSizes.length;

    // Validate that we actually generated assets
    if (totalAssets === 0) {
        console.error('\n❌ No assets were generated! Check the asset-generator.html for errors.');
        process.exit(1);
    }

    // Expected counts
    const expectedTerrain = 50;  // 10 types × base + 4 variants
    const expectedUnits = 80;    // 5 classes × 4 players × 4 states (normal + selected + attack + cover)
    const expectedDetails = 23;  // 5 tree types × 3 variants + 4 bushes + 4 rocks

    console.log(`\n✅ Asset generation complete!`);
    console.log(`   Terrain textures: ${terrainAssets.length}/${expectedTerrain}`);
    console.log(`   Unit sprites: ${unitAssets.length}/${expectedUnits}`);
    console.log(`   Terrain details: ${detailAssets.length}/${expectedDetails}`);
    console.log(`   Total: ${totalAssets} PNG files in assets/`);

    // Warn if counts don't match expected
    if (terrainAssets.length < expectedTerrain) {
        console.warn(`\n⚠️ Warning: Expected ${expectedTerrain} terrain textures, got ${terrainAssets.length}`);
    }
    if (unitAssets.length < expectedUnits) {
        console.warn(`\n⚠️ Warning: Expected ${expectedUnits} unit sprites, got ${unitAssets.length}`);
    }
    if (detailAssets.length < expectedDetails) {
        console.warn(`\n⚠️ Warning: Expected ${expectedDetails} detail elements, got ${detailAssets.length}`);
    }
}

generateAssets().catch(err => {
    console.error('❌ Error generating assets:', err);
    console.error('\nTroubleshooting tips:');
    console.error('  1. Make sure Playwright is installed: npx playwright install chromium');
    console.error('  2. Try running with DEBUG=pw:api node scripts/generate-assets.js');
    console.error('  3. Open tools/asset-generator.html in a browser to test manually');
    process.exit(1);
});
