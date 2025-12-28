import { test, expect } from '@playwright/test';

/**
 * Game Rendering Tests
 *
 * These tests specifically check for rendering issues like black screens,
 * which are hard to debug on mobile devices without DevTools access.
 *
 * Screenshots are captured at key points and uploaded as CI artifacts.
 */

test.describe('Game Rendering', () => {
  // Collect all errors across tests for debugging
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });
  });

  test('game canvas renders correctly after starting single player game', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Screenshot: Initial menu
    await page.screenshot({ path: 'test-results/render-01-menu.png', fullPage: true });

    // Select single player mode
    const singlePlayerBtn = page.locator('[data-mode="single"]');
    await singlePlayerBtn.click();
    await page.waitForTimeout(200);

    // Select small map for faster loading
    const smallMapBtn = page.locator('[data-size="small"]');
    await smallMapBtn.click();
    await page.waitForTimeout(200);

    // Screenshot: Before start
    await page.screenshot({ path: 'test-results/render-02-before-start.png', fullPage: true });

    // Click start button
    const startBtn = page.locator('#start-btn');
    await startBtn.click();

    // Wait for team selection
    const teamSelect = page.locator('#team-select');
    await expect(teamSelect).toBeVisible({ timeout: 5000 });

    // Screenshot: Team selection
    await page.screenshot({ path: 'test-results/render-03-team-select.png', fullPage: true });

    // Select a team (click first team option)
    const teamOption = page.locator('.team-option').first();
    await teamOption.click();
    await page.waitForTimeout(200);

    // Click confirm to start game
    const confirmBtn = page.locator('#confirm-team-btn');
    await confirmBtn.click();

    // Wait for game to initialize
    await page.waitForTimeout(2000);

    // Screenshot: Game started
    await page.screenshot({ path: 'test-results/render-04-game-started.png', fullPage: true });

    // Check canvas is visible and has content
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Analyze canvas content
    const canvasAnalysis = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas');
      if (!canvas) return { error: 'Canvas not found' };

      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'Cannot get 2D context' };

      const width = canvas.width;
      const height = canvas.height;

      if (width === 0 || height === 0) {
        return { error: `Canvas has zero dimensions: ${width}x${height}` };
      }

      // Sample pixels at multiple locations
      const samples = [];
      const samplePoints = [
        { x: width * 0.25, y: height * 0.25, name: 'top-left' },
        { x: width * 0.75, y: height * 0.25, name: 'top-right' },
        { x: width * 0.5, y: height * 0.5, name: 'center' },
        { x: width * 0.25, y: height * 0.75, name: 'bottom-left' },
        { x: width * 0.75, y: height * 0.75, name: 'bottom-right' },
      ];

      let totalBrightness = 0;
      let blackPixelCount = 0;

      for (const point of samplePoints) {
        const imageData = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1);
        const [r, g, b, a] = imageData.data;
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;

        const isBlack = r < 15 && g < 15 && b < 15;
        if (isBlack) blackPixelCount++;

        samples.push({
          name: point.name,
          r, g, b, a,
          brightness,
          isBlack
        });
      }

      const avgBrightness = totalBrightness / samplePoints.length;
      const isBlackScreen = blackPixelCount >= 4; // 4 out of 5 samples are black

      return {
        dimensions: { width, height },
        samples,
        avgBrightness,
        blackPixelCount,
        totalSamples: samplePoints.length,
        isBlackScreen,
        verdict: isBlackScreen ? 'BLACK SCREEN DETECTED' : 'Screen has content'
      };
    });

    console.log('Canvas Analysis:', JSON.stringify(canvasAnalysis, null, 2));

    // Screenshot: Final state
    await page.screenshot({ path: 'test-results/render-05-final.png', fullPage: true });

    // Report any errors
    if (pageErrors.length > 0) {
      console.log('\n=== Page Errors ===');
      pageErrors.forEach((err, i) => console.log(`${i + 1}. ${err.message}`));
    }

    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach((err, i) => console.log(`${i + 1}. ${err.text}`));
    }

    // Assertions
    expect(canvasAnalysis.error, 'Canvas should be valid').toBeUndefined();
    expect(canvasAnalysis.isBlackScreen, `Black screen detected! Analysis: ${JSON.stringify(canvasAnalysis)}`).toBe(false);
    expect(pageErrors, 'No page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console errors should occur').toEqual([]);
  });

  test('AI vs AI spectator mode renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set up AI vs AI
    const player1Toggle = page.locator('.ai-config-item:first-child .type-toggle');
    const player1Text = await player1Toggle.textContent();
    if (player1Text?.includes('Mensch')) {
      await player1Toggle.click();
      await page.waitForTimeout(100);
    }

    // Small map for faster test
    await page.locator('[data-size="small"]').click();

    // Screenshot: AI vs AI config
    await page.screenshot({ path: 'test-results/spectator-01-config.png', fullPage: true });

    // Start game
    await page.locator('#start-btn').click();

    // Wait for game to start (team selection should be skipped)
    await page.waitForTimeout(3000);

    // Screenshot: Game started
    await page.screenshot({ path: 'test-results/spectator-02-started.png', fullPage: true });

    // Check canvas
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Monitor rendering for 10 seconds
    const renderChecks = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(2000);

      const check = await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return { valid: false, reason: 'No canvas' };

        const ctx = canvas.getContext('2d');
        if (!ctx) return { valid: false, reason: 'No context' };

        // Sample center pixel
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const imageData = ctx.getImageData(centerX, centerY, 1, 1);
        const [r, g, b] = imageData.data;
        const isBlack = r < 15 && g < 15 && b < 15;

        return {
          valid: true,
          dimensions: `${canvas.width}x${canvas.height}`,
          centerColor: { r, g, b },
          isBlack
        };
      });

      renderChecks.push(check);
      console.log(`Render check ${i + 1}:`, JSON.stringify(check));

      // Take periodic screenshot
      if (check.isBlack) {
        await page.screenshot({ path: `test-results/spectator-BLACK-${i + 1}.png`, fullPage: true });
      }
    }

    // Screenshot: Final state
    await page.screenshot({ path: 'test-results/spectator-03-final.png', fullPage: true });

    // Check that we didn't have persistent black screens
    const consecutiveBlackScreens = renderChecks.reduce((max, check, i) => {
      if (check.isBlack) {
        const streak = renderChecks.slice(i).findIndex(c => !c.isBlack);
        return Math.max(max, streak === -1 ? renderChecks.length - i : streak);
      }
      return max;
    }, 0);

    console.log(`Max consecutive black screen checks: ${consecutiveBlackScreens}`);

    // Assertions
    expect(pageErrors).toEqual([]);
    expect(consecutiveBlackScreens, 'Should not have 3+ consecutive black screen checks').toBeLessThan(3);
  });

  test('game UI elements render correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Start a single player game
    await page.locator('[data-mode="single"]').click();
    await page.locator('[data-size="small"]').click();
    await page.locator('#start-btn').click();

    // Wait for team selection and select a team
    const teamSelect = page.locator('#team-select');
    await expect(teamSelect).toBeVisible({ timeout: 5000 });
    await page.locator('.team-option').first().click();
    await page.locator('#confirm-team-btn').click();

    // Wait for game UI
    await page.waitForTimeout(2000);

    // Check all critical UI elements are visible
    const uiChecks = await page.evaluate(() => {
      const elements = {
        canvas: document.getElementById('game-canvas'),
        roundNum: document.getElementById('round-num'),
        currentPlayer: document.getElementById('current-player'),
        actionBar: document.querySelector('.action-bar'),
        minimap: document.querySelector('.minimap-container')
      };

      const results = {};
      for (const [name, el] of Object.entries(elements)) {
        if (!el) {
          results[name] = { exists: false };
        } else {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          results[name] = {
            exists: true,
            visible: style.display !== 'none' && style.visibility !== 'hidden',
            dimensions: `${rect.width}x${rect.height}`,
            position: `${rect.left},${rect.top}`
          };
        }
      }
      return results;
    });

    console.log('UI Element Check:', JSON.stringify(uiChecks, null, 2));

    // Screenshot: UI elements
    await page.screenshot({ path: 'test-results/ui-elements.png', fullPage: true });

    // Assertions
    expect(uiChecks.canvas?.exists, 'Canvas should exist').toBe(true);
    expect(uiChecks.canvas?.visible, 'Canvas should be visible').toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test('minimap renders with correct colors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Start single player game
    await page.locator('[data-mode="single"]').click();
    await page.locator('[data-size="medium"]').click(); // Medium map for better minimap
    await page.locator('#start-btn').click();

    await page.locator('.team-option').first().click();
    await page.locator('#confirm-team-btn').click();

    await page.waitForTimeout(3000);

    // Check minimap canvas
    const minimapAnalysis = await page.evaluate(() => {
      const minimap = document.querySelector('.minimap-canvas');
      if (!minimap) return { error: 'Minimap canvas not found' };

      const ctx = minimap.getContext('2d');
      if (!ctx) return { error: 'Cannot get minimap context' };

      const width = minimap.width;
      const height = minimap.height;

      if (width === 0 || height === 0) {
        return { error: `Minimap has zero dimensions: ${width}x${height}` };
      }

      // Sample multiple points on minimap
      const samples = [];
      const colorCounts = { black: 0, colored: 0 };

      for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 10))) {
        for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 10))) {
          const imageData = ctx.getImageData(x, y, 1, 1);
          const [r, g, b, a] = imageData.data;

          // Check if pixel is effectively black/transparent
          if ((r < 20 && g < 20 && b < 20) || a < 50) {
            colorCounts.black++;
          } else {
            colorCounts.colored++;
            // Collect first few colored samples
            if (samples.length < 5) {
              samples.push({ x, y, r, g, b, a });
            }
          }
        }
      }

      const totalSamples = colorCounts.black + colorCounts.colored;
      const coloredRatio = colorCounts.colored / totalSamples;

      return {
        dimensions: { width, height },
        totalSamples,
        colorCounts,
        coloredRatio,
        sampleColors: samples,
        hasContent: coloredRatio > 0.1 // At least 10% should be colored
      };
    });

    console.log('Minimap Analysis:', JSON.stringify(minimapAnalysis, null, 2));

    // Screenshot: Minimap
    await page.screenshot({ path: 'test-results/minimap.png', fullPage: true });

    // Assertions
    expect(minimapAnalysis.error, 'Minimap should be valid').toBeUndefined();
    expect(minimapAnalysis.hasContent, 'Minimap should have colored content').toBe(true);
    expect(pageErrors).toEqual([]);
  });
});
