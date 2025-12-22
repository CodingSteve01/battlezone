import { test, expect } from '@playwright/test';

test.describe('Menu Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Collect all console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console error: ${msg.text()}`);
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', error => {
      console.log(`Page error: ${error.message}`);
    });
  });

  test('page loads without JavaScript errors', async ({ page }) => {
    const errors = [];

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait a bit for any async initialization
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });

  test('main menu is visible on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const menu = page.locator('#main-menu');
    await expect(menu).toBeVisible();
  });

  test('start button is clickable and responsive', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();

    // Click the button
    await startBtn.click();

    // Check no errors occurred
    expect(errors).toEqual([]);

    // Menu should be hidden or team selection should appear
    await page.waitForTimeout(500);
  });

  test('single player button works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const singlePlayerBtn = page.locator('#single-player-btn');
    await expect(singlePlayerBtn).toBeVisible();

    await singlePlayerBtn.click();
    expect(errors).toEqual([]);
  });

  test('multiplayer button works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const multiplayerBtn = page.locator('#multiplayer-btn');
    await expect(multiplayerBtn).toBeVisible();

    await multiplayerBtn.click();
    expect(errors).toEqual([]);
  });

  test('map size buttons work', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test small map button
    const smallBtn = page.locator('[data-size="small"]');
    if (await smallBtn.isVisible()) {
      await smallBtn.click();
      expect(errors).toEqual([]);
    }
  });

  test('full game flow - start single player game', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Select single player
    const singlePlayerBtn = page.locator('#single-player-btn');
    if (await singlePlayerBtn.isVisible()) {
      await singlePlayerBtn.click();
      await page.waitForTimeout(300);
    }

    // Click start
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    await page.waitForTimeout(500);

    // Verify no JS errors occurred during the flow
    if (errors.length > 0) {
      console.log('Errors found:', errors);
    }
    expect(errors).toEqual([]);
  });
});
