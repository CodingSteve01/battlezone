import { test, expect } from '@playwright/test';

/**
 * Menu and Wizard Navigation Tests
 *
 * Tests the game's wizard flow:
 * 1. Main Menu (#menu) - Click start
 * 2. Map Setup (#wizard-map) - Select size, click next
 * 3. Player Setup (#wizard-players) - Configure players/AI, click next
 * 4. Team Selection (#team-select) - Select units (or auto for AI)
 */

test.describe('Menu Navigation', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(30000);

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console error: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.log(`Page error: ${error.message}`);
    });
  });

  test('page loads without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  test('main menu is visible on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const menu = page.locator('#menu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveClass(/active/);
  });

  test('start button navigates to wizard-map', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();

    await startBtn.click();

    // Should now be on wizard-map
    const wizardMap = page.locator('#wizard-map');
    await expect(wizardMap).toHaveClass(/active/, { timeout: 3000 });

    expect(errors).toEqual([]);
  });

  test('map size selection works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to wizard-map
    await page.locator('#start-btn').click();
    await expect(page.locator('#wizard-map')).toHaveClass(/active/);

    // Select small map
    const smallBtn = page.locator('[data-size="small"]');
    await smallBtn.click();
    await expect(smallBtn).toHaveClass(/selected/);

    // Select large map
    const largeBtn = page.locator('[data-size="large"]');
    await largeBtn.click();
    await expect(largeBtn).toHaveClass(/selected/);
    await expect(smallBtn).not.toHaveClass(/selected/);

    expect(errors).toEqual([]);
  });

  test('wizard navigation to player setup', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate through wizard
    await page.locator('#start-btn').click();
    await expect(page.locator('#wizard-map')).toHaveClass(/active/);

    await page.locator('#wizard-map-next').click();
    await expect(page.locator('#wizard-players')).toHaveClass(/active/, { timeout: 3000 });

    expect(errors).toEqual([]);
  });

  test('player count selection works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to player setup
    await page.locator('#start-btn').click();
    await page.locator('#wizard-map-next').click();
    await expect(page.locator('#wizard-players')).toHaveClass(/active/);

    // Select 3 players
    const threePlayerBtn = page.locator('[data-players="3"]');
    await threePlayerBtn.click();
    await expect(threePlayerBtn).toHaveClass(/selected/);

    // Select 4 players
    const fourPlayerBtn = page.locator('[data-players="4"]');
    await fourPlayerBtn.click();
    await expect(fourPlayerBtn).toHaveClass(/selected/);

    expect(errors).toEqual([]);
  });

  test('full wizard flow to team selection', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 1: Main menu -> Wizard map
    await page.locator('#start-btn').click();
    await expect(page.locator('#wizard-map')).toHaveClass(/active/);

    // Step 2: Wizard map -> Wizard players
    await page.locator('[data-size="small"]').click();
    await page.locator('#wizard-map-next').click();
    await expect(page.locator('#wizard-players')).toHaveClass(/active/);

    // Step 3: Wizard players -> Team selection
    await page.locator('#wizard-players-next').click();

    // Should reach team selection
    const teamSelect = page.locator('#team-select');
    await expect(teamSelect).toBeVisible({ timeout: 5000 });

    expect(errors).toEqual([]);
  });

  test('back navigation works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate forward
    await page.locator('#start-btn').click();
    await page.locator('#wizard-map-next').click();
    await expect(page.locator('#wizard-players')).toHaveClass(/active/);

    // Navigate back
    await page.locator('#wizard-players-back').click();
    await expect(page.locator('#wizard-map')).toHaveClass(/active/);

    await page.locator('#wizard-map-back').click();
    await expect(page.locator('#menu')).toHaveClass(/active/);

    expect(errors).toEqual([]);
  });
});
