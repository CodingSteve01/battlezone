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
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ASSETS_DIR = join(__dirname, '..', 'assets');
const TOOLS_DIR = join(__dirname, '..', 'tools');

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

    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

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

    await browser.close();

    const totalAssets = terrainAssets.length + unitAssets.length + detailAssets.length;
    console.log(`\n✅ Asset generation complete!`);
    console.log(`   Generated ${totalAssets} PNG files in assets/`);
}

generateAssets().catch(err => {
    console.error('❌ Error generating assets:', err);
    process.exit(1);
});
