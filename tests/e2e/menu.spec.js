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

    // The menu element has id="menu", not "main-menu"
    const menu = page.locator('#menu');
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

    // Single player button uses data-mode="single" attribute
    const singlePlayerBtn = page.locator('[data-mode="single"]');
    await expect(singlePlayerBtn).toBeVisible();

    await singlePlayerBtn.click();
    expect(errors).toEqual([]);

    // Verify button is selected after click
    await expect(singlePlayerBtn).toHaveClass(/selected/);
  });

  test('multiplayer button works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Multiplayer button uses data-mode="multi" attribute
    const multiplayerBtn = page.locator('[data-mode="multi"]');
    await expect(multiplayerBtn).toBeVisible();

    await multiplayerBtn.click();
    expect(errors).toEqual([]);

    // Verify button is selected after click
    await expect(multiplayerBtn).toHaveClass(/selected/);
  });

  test('map size buttons work', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test small map button
    const smallBtn = page.locator('[data-size="small"]');
    await expect(smallBtn).toBeVisible();
    await smallBtn.click();
    expect(errors).toEqual([]);

    // Verify button is selected after click
    await expect(smallBtn).toHaveClass(/selected/);
  });

  test('full game flow - start single player game', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Select single player using correct selector
    const singlePlayerBtn = page.locator('[data-mode="single"]');
    await expect(singlePlayerBtn).toBeVisible();
    await singlePlayerBtn.click();
    await page.waitForTimeout(300);

    // Click start
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    await page.waitForTimeout(500);

    // Team selection should appear
    const teamSelect = page.locator('#team-select');
    await expect(teamSelect).toBeVisible();

    // Verify no JS errors occurred during the flow
    if (errors.length > 0) {
      console.log('Errors found:', errors);
    }
    expect(errors).toEqual([]);
  });

  test('player count buttons work in multiplayer mode', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure multiplayer mode is selected (should be default)
    const multiplayerBtn = page.locator('[data-mode="multi"]');
    await multiplayerBtn.click();

    // Test player count buttons
    const threePlayerBtn = page.locator('[data-players="3"]');
    await expect(threePlayerBtn).toBeVisible();
    await threePlayerBtn.click();
    await expect(threePlayerBtn).toHaveClass(/selected/);

    const fourPlayerBtn = page.locator('[data-players="4"]');
    await expect(fourPlayerBtn).toBeVisible();
    await fourPlayerBtn.click();
    await expect(fourPlayerBtn).toHaveClass(/selected/);

    expect(errors).toEqual([]);
  });
});
