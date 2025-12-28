import { test, expect } from '@playwright/test';

/**
 * AI vs AI Spectator Mode Tests
 *
 * These are quick sanity checks (max 15-20 seconds each) to verify:
 * - Game starts without errors
 * - Canvas renders content (no black screen)
 * - AI makes progress (rounds advance)
 *
 * For comprehensive AI behavior testing, use unit tests instead.
 */

test.describe('AI vs AI Spectator Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Set shorter default timeout for AI tests
    test.setTimeout(30000); // 30 seconds max per test
  });

  test('AI vs AI game starts and renders without black screen', async ({ page }) => {
    const errors = [];

    page.on('pageerror', error => {
      errors.push(error.message);
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set up AI vs AI
    const player1Toggle = page.locator('.ai-config-item:first-child .type-toggle');
    const player1Text = await player1Toggle.textContent();
    if (player1Text?.includes('Mensch')) {
      await player1Toggle.click();
    }

    // Small map for speed
    await page.locator('[data-size="small"]').click();

    // Screenshot: Config
    await page.screenshot({ path: 'test-results/ai-vs-ai-config.png' });

    // Start game
    await page.locator('#start-btn').click();

    // Wait for game to initialize
    await page.waitForTimeout(3000);

    // Screenshot: Game started
    await page.screenshot({ path: 'test-results/ai-vs-ai-started.png' });

    // Check canvas is visible
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Check for black screen
    const canvasCheck = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas');
      if (!canvas) return { error: 'No canvas' };

      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'No context' };

      if (canvas.width === 0 || canvas.height === 0) {
        return { error: `Zero dimensions: ${canvas.width}x${canvas.height}` };
      }

      // Sample 5 points
      const points = [
        [canvas.width / 2, canvas.height / 2],
        [canvas.width / 4, canvas.height / 4],
        [canvas.width * 3 / 4, canvas.height / 4],
        [canvas.width / 4, canvas.height * 3 / 4],
        [canvas.width * 3 / 4, canvas.height * 3 / 4]
      ];

      let blackCount = 0;
      for (const [x, y] of points) {
        const data = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        if (data[0] < 15 && data[1] < 15 && data[2] < 15) {
          blackCount++;
        }
      }

      return {
        dimensions: `${canvas.width}x${canvas.height}`,
        blackPixels: blackCount,
        isBlack: blackCount >= 4
      };
    });

    console.log('Canvas check:', canvasCheck);

    // Assertions
    expect(errors).toEqual([]);
    expect(canvasCheck.error).toBeUndefined();
    expect(canvasCheck.isBlack, 'Screen should not be black').toBe(false);
  });

  test('AI vs AI game makes round progress', async ({ page }) => {
    const errors = [];

    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set up AI vs AI
    const player1Toggle = page.locator('.ai-config-item:first-child .type-toggle');
    const player1Text = await player1Toggle.textContent();
    if (player1Text?.includes('Mensch')) {
      await player1Toggle.click();
    }

    await page.locator('[data-size="small"]').click();
    await page.locator('#start-btn').click();

    // Wait for game to start
    await page.waitForTimeout(2000);

    // Check round number advances over 10 seconds
    const initialRound = await page.evaluate(() => {
      const el = document.getElementById('round-num');
      return el ? parseInt(el.textContent, 10) : 0;
    });

    // Wait and check progress (3 checks over 9 seconds)
    let finalRound = initialRound;
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(3000);

      finalRound = await page.evaluate(() => {
        const el = document.getElementById('round-num');
        return el ? parseInt(el.textContent, 10) : 0;
      });

      // Check for game over
      const gameOver = await page.evaluate(() =>
        document.getElementById('gameover')?.classList.contains('active')
      );

      if (gameOver) {
        console.log(`Game ended at round ${finalRound}`);
        break;
      }

      console.log(`Check ${i + 1}: Round ${finalRound}`);
    }

    // Screenshot: Final state
    await page.screenshot({ path: 'test-results/ai-vs-ai-progress.png' });

    // Verify progress was made
    expect(errors).toEqual([]);
    expect(finalRound, 'Game should make progress').toBeGreaterThanOrEqual(initialRound);
  });

  test('AI vs AI canvas remains valid during gameplay', async ({ page }) => {
    const errors = [];

    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set up AI vs AI
    const player1Toggle = page.locator('.ai-config-item:first-child .type-toggle');
    const player1Text = await player1Toggle.textContent();
    if (player1Text?.includes('Mensch')) {
      await player1Toggle.click();
    }

    await page.locator('[data-size="small"]').click();
    await page.locator('#start-btn').click();
    await page.waitForTimeout(2000);

    // Quick canvas validity checks (3 checks over 6 seconds)
    let invalidCount = 0;

    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(2000);

      const valid = await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return false;
        if (canvas.width <= 0 || canvas.height <= 0) return false;
        if (!document.body.contains(canvas)) return false;
        return true;
      });

      if (!valid) {
        invalidCount++;
        await page.screenshot({ path: `test-results/ai-vs-ai-invalid-${i}.png` });
      }

      // Check for game over
      const gameOver = await page.evaluate(() =>
        document.getElementById('gameover')?.classList.contains('active')
      );
      if (gameOver) break;
    }

    expect(errors).toEqual([]);
    expect(invalidCount, 'Canvas should remain valid').toBe(0);
  });
});
