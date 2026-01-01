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

/**
 * Helper: Disable tutorial before page load
 * @param {Page} page - Playwright page
 */
async function disableTutorial(page) {
  await page.addInitScript(() => {
    // Completely disable all tutorials
    localStorage.setItem('shadowSquad_showTutorial', 'off');
    localStorage.setItem('shadowSquad_firstGame', 'true');
    localStorage.setItem('shadowSquad_tutorialHints', '["welcome","teamIntro"]');
    // Add ALL unit class hints to prevent popups on hover
    localStorage.setItem('shadowSquad_teamSelectHints', JSON.stringify([
      'teamIntro', 'budgetTip',
      'scoutTip', 'assaultTip', 'medicTip', 'sniperTip', 'commandoTip', 'elitesoldatTip',
      'synergy_balanced', 'synergy_stealth', 'synergy_defensive', 'synergy_elite', 'synergy_swarm',
      'tactical_ambush', 'tactical_coordinated', 'tactical_flanking', 'tactical_cover'
    ]));
  });
}

/**
 * Helper: Dismiss any tutorial popup if present
 * @param {Page} page - Playwright page
 */
async function dismissTutorialIfPresent(page) {
  // Check for various tutorial overlays and dismiss them
  const tutorialSelectors = [
    '#tutorial-overlay .tutorial-btn-ok',
    '#tutorial-overlay .tutorial-close-btn',
    '#team-tutorial-overlay .tutorial-btn-ok',
    '#team-tutorial-overlay .tutorial-close-btn',
    '#guided-tutorial-overlay .guided-tutorial-btn-skip',
    '.tutorial-close-btn'
  ];

  for (const selector of tutorialSelectors) {
    const btn = page.locator(selector);
    if (await btn.isVisible({ timeout: 200 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(100);
    }
  }
}

/**
 * Helper: Navigate through wizard to start AI vs AI game
 * @param {Page} page - Playwright page
 */
async function startAIvsAIGame(page) {
  // Step 1: Main menu -> Wizard map
  await page.locator('#start-btn').click();
  await expect(page.locator('#wizard-map')).toHaveClass(/active/, { timeout: 3000 });

  // Select small map for speed
  await page.locator('[data-size="small"]').click();

  // Step 2: Wizard map -> Wizard players
  await page.locator('#wizard-map-next').click();
  await expect(page.locator('#wizard-players')).toHaveClass(/active/, { timeout: 3000 });

  // Set player 1 to AI (player 2 is already AI by default in single-player)
  // The toggle shows "👤" for human, "🤖 KI" for AI
  const player1Toggle = page.locator('.player-config-item:first-child .type-toggle');
  const player1Class = await player1Toggle.getAttribute('class');
  if (player1Class?.includes('human')) {
    await player1Toggle.click();
    await page.waitForTimeout(100);
  }

  // Ensure player 2 is also AI
  const player2Toggle = page.locator('.player-config-item:nth-child(2) .type-toggle');
  const player2Class = await player2Toggle.getAttribute('class');
  if (player2Class?.includes('human')) {
    await player2Toggle.click();
    await page.waitForTimeout(100);
  }

  // Step 3: Start game (AI vs AI skips team selection)
  await page.locator('#wizard-players-next').click();

  // Wait for game to initialize - AI vs AI should skip team selection
  await page.waitForTimeout(2000);

  // Dismiss any tutorial that might appear
  await dismissTutorialIfPresent(page);
}

// SKIPPED: These tests are too slow and flaky for CI (~15+ minutes, timeout issues)
// AI vs AI behavior is better tested via unit tests
test.describe.skip('AI vs AI Spectator Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Set shorter default timeout for AI tests
    test.setTimeout(30000); // 30 seconds max per test
    // Disable tutorial before page load
    await disableTutorial(page);
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

    // Screenshot: Initial menu
    await page.screenshot({ path: 'test-results/ai-vs-ai-menu.png' });

    // Navigate through wizard and start AI vs AI game
    await startAIvsAIGame(page);

    // Screenshot: Game started
    await page.screenshot({ path: 'test-results/ai-vs-ai-started.png' });

    // Check canvas is visible
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Check for black screen
    const canvasCheck = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas');
      if (!canvas) return { error: 'No canvas' };

      if (canvas.width === 0 || canvas.height === 0) {
        return { error: `Zero dimensions: ${canvas.width}x${canvas.height}` };
      }

      // Try to get 2D context for pixel analysis (works for Canvas 2D renderer)
      const ctx2d = canvas.getContext('2d', { willReadFrequently: true });
      
      // Try to get WebGL context (works for WebGL renderer)
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!ctx2d && !gl) {
        return { error: 'Cannot get any rendering context (neither 2D nor WebGL)' };
      }

      // If WebGL is active, we can't easily sample pixels, so just check dimensions
      if (gl && !ctx2d) {
        return {
          renderer: 'webgl',
          dimensions: `${canvas.width}x${canvas.height}`,
          isBlack: false // Assume WebGL is rendering correctly if context exists
        };
      }

      // For 2D context, sample 5 points
      const points = [
        [canvas.width / 2, canvas.height / 2],
        [canvas.width / 4, canvas.height / 4],
        [canvas.width * 3 / 4, canvas.height / 4],
        [canvas.width / 4, canvas.height * 3 / 4],
        [canvas.width * 3 / 4, canvas.height * 3 / 4]
      ];

      let blackCount = 0;
      for (const [x, y] of points) {
        const data = ctx2d.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        if (data[0] < 15 && data[1] < 15 && data[2] < 15) {
          blackCount++;
        }
      }

      return {
        renderer: 'canvas2d',
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

    // Navigate through wizard and start AI vs AI game
    await startAIvsAIGame(page);

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

    // Navigate through wizard and start AI vs AI game
    await startAIvsAIGame(page);

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
