import { test, expect } from '@playwright/test';

/**
 * Game Rendering Tests
 *
 * These tests specifically check for rendering issues like black screens,
 * which are hard to debug on mobile devices without DevTools access.
 *
 * Screenshots are captured at key points and uploaded as CI artifacts.
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
 * Helper: Navigate through wizard to start a game
 * @param {Page} page - Playwright page
 * @param {Object} options - Configuration options
 * @param {boolean} options.allAI - Set all players to AI (spectator mode)
 * @param {string} options.mapSize - Map size: 'small', 'medium', 'large'
 */
async function navigateToGame(page, options = {}) {
  const { allAI = false, mapSize = 'small' } = options;

  // Step 1: Main menu -> Wizard map
  await page.locator('#start-btn').click();
  await expect(page.locator('#wizard-map')).toHaveClass(/active/, { timeout: 3000 });

  // Select map size
  await page.locator(`[data-size="${mapSize}"]`).click();

  // Step 2: Wizard map -> Wizard players
  await page.locator('#wizard-map-next').click();
  await expect(page.locator('#wizard-players')).toHaveClass(/active/, { timeout: 3000 });

  // Configure AI if needed
  if (allAI) {
    // Set both players to AI
    // The toggle has class 'human' or 'ai', not text content
    const player1Toggle = page.locator('.player-config-item:first-child .type-toggle');
    const player1Class = await player1Toggle.getAttribute('class');
    if (player1Class?.includes('human')) {
      await player1Toggle.click();
      await page.waitForTimeout(100);
    }

    const player2Toggle = page.locator('.player-config-item:nth-child(2) .type-toggle');
    const player2Class = await player2Toggle.getAttribute('class');
    if (player2Class?.includes('human')) {
      await player2Toggle.click();
      await page.waitForTimeout(100);
    }
  }

  // Step 3: Wizard players -> Team selection (or game if all AI)
  await page.locator('#wizard-players-next').click();

  if (allAI) {
    // AI vs AI skips team selection, wait for game to start
    await page.waitForTimeout(2000);
    await dismissTutorialIfPresent(page);
  } else {
    // Wait for team selection
    const teamSelect = page.locator('#team-select');
    await expect(teamSelect).toBeVisible({ timeout: 5000 });
    await dismissTutorialIfPresent(page);
  }
}

/**
 * Helper: Complete team selection and start game
 * Need to select 3 units to fill the team
 */
async function completeTeamSelection(page) {
  // Dismiss any tutorial popup first
  await dismissTutorialIfPresent(page);

  // Select 3 unit cards (required for team)
  for (let i = 0; i < 3; i++) {
    const unitCards = page.locator('.unit-card:not(.selected)');
    const cardCount = await unitCards.count();
    if (cardCount > 0) {
      await unitCards.first().click();
      await page.waitForTimeout(200);
    }
  }

  // Click confirm button (it's #team-confirm-btn not #confirm-team-btn)
  const confirmBtn = page.locator('#team-confirm-btn');
  await expect(confirmBtn).toBeEnabled({ timeout: 3000 });
  await confirmBtn.click();

  // Wait for turn screen or game to start
  await page.waitForTimeout(1000);

  // If turn screen appears, click ready
  const readyBtn = page.locator('#ready-btn');
  if (await readyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await readyBtn.click();
  }

  // Wait for game to initialize
  await page.waitForTimeout(2000);
  await dismissTutorialIfPresent(page);
}

test.describe('Game Rendering', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    test.setTimeout(30000);
    pageErrors = [];
    consoleErrors = [];

    // Disable tutorial before page load
    await disableTutorial(page);

    page.on('pageerror', error => {
      pageErrors.push({ message: error.message, stack: error.stack });
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text() });
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });
  });

  test('game canvas renders correctly after starting game', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Screenshot: Initial menu
    await page.screenshot({ path: 'test-results/render-01-menu.png', fullPage: true });

    // Navigate through wizard
    await navigateToGame(page, { mapSize: 'small' });

    // Screenshot: Team selection
    await page.screenshot({ path: 'test-results/render-02-team-select.png', fullPage: true });

    // Complete team selection
    await completeTeamSelection(page);

    // Screenshot: Game started
    await page.screenshot({ path: 'test-results/render-03-game-started.png', fullPage: true });

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
      const samplePoints = [
        { x: width * 0.25, y: height * 0.25 },
        { x: width * 0.75, y: height * 0.25 },
        { x: width * 0.5, y: height * 0.5 },
        { x: width * 0.25, y: height * 0.75 },
        { x: width * 0.75, y: height * 0.75 },
      ];

      let blackPixelCount = 0;
      for (const point of samplePoints) {
        const imageData = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1);
        const [r, g, b] = imageData.data;
        if (r < 15 && g < 15 && b < 15) blackPixelCount++;
      }

      return {
        dimensions: { width, height },
        blackPixelCount,
        totalSamples: samplePoints.length,
        isBlackScreen: blackPixelCount >= 4
      };
    });

    console.log('Canvas Analysis:', JSON.stringify(canvasAnalysis, null, 2));

    // Screenshot: Final state
    await page.screenshot({ path: 'test-results/render-04-final.png', fullPage: true });

    // Assertions
    expect(canvasAnalysis.error, 'Canvas should be valid').toBeUndefined();
    expect(canvasAnalysis.isBlackScreen, 'Screen should not be black').toBe(false);
    expect(pageErrors).toEqual([]);
  });

  test('AI vs AI spectator mode renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Screenshot: Initial menu
    await page.screenshot({ path: 'test-results/spectator-01-menu.png', fullPage: true });

    // Navigate with all AI players
    await navigateToGame(page, { allAI: true, mapSize: 'small' });

    // Screenshot: Game started
    await page.screenshot({ path: 'test-results/spectator-02-started.png', fullPage: true });

    // Check canvas
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Quick rendering check (6 seconds)
    const renderChecks = [];
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(2000);

      const check = await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return { valid: false, reason: 'No canvas' };

        const ctx = canvas.getContext('2d');
        if (!ctx) return { valid: false, reason: 'No context' };

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const imageData = ctx.getImageData(centerX, centerY, 1, 1);
        const [r, g, b] = imageData.data;
        const isBlack = r < 15 && g < 15 && b < 15;

        return { valid: true, isBlack };
      });

      renderChecks.push(check);
      console.log(`Render check ${i + 1}:`, JSON.stringify(check));

      if (check.isBlack) {
        await page.screenshot({ path: `test-results/spectator-BLACK-${i + 1}.png`, fullPage: true });
      }
    }

    // Screenshot: Final state
    await page.screenshot({ path: 'test-results/spectator-03-final.png', fullPage: true });

    // Check that we didn't have persistent black screens
    const blackCount = renderChecks.filter(c => c.isBlack).length;
    console.log(`Black screen checks: ${blackCount}/${renderChecks.length}`);

    expect(pageErrors).toEqual([]);
    expect(blackCount, 'Should not have all black screen checks').toBeLessThan(3);
  });

  test('game UI elements render correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate and start game
    await navigateToGame(page, { mapSize: 'small' });
    await completeTeamSelection(page);

    // Check all critical UI elements are visible
    const uiChecks = await page.evaluate(() => {
      const elements = {
        canvas: document.getElementById('game-canvas'),
        roundNum: document.getElementById('round-num'),
        actionBar: document.querySelector('.action-bar')
      };

      const results = {};
      for (const [name, el] of Object.entries(elements)) {
        if (!el) {
          results[name] = { exists: false };
        } else {
          const rect = el.getBoundingClientRect();
          results[name] = {
            exists: true,
            visible: rect.width > 0 && rect.height > 0
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

  test('canvas resize should not throw setTransform errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const errors = [];
    page.on('pageerror', error => {
      errors.push({ message: error.message, stack: error.stack });
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate and start game
    await navigateToGame(page, { mapSize: 'small' });
    await completeTeamSelection(page);

    // Wait for initial render
    await page.waitForTimeout(1000);

    // Resize viewport multiple times to trigger resizeCanvas
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Screenshot after resize
    await page.screenshot({ path: 'test-results/resize-test.png', fullPage: true });

    // Check for setTransform errors
    const setTransformErrors = errors.filter(e => 
      e.message.includes('setTransform') || 
      e.message.includes('null is not an object') ||
      e.message.includes('Cannot read property')
    );

    console.log('Resize test errors:', JSON.stringify(errors, null, 2));
    expect(setTransformErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
