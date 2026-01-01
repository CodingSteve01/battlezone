import { test, expect } from '@playwright/test';

/**
 * Minimal menu test - verify page loads and menu is visible
 */
test.describe('Menu', () => {
  test('page loads and menu is visible', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check menu element exists
    const menu = page.locator('#menu');
    await expect(menu).toBeVisible({ timeout: 5000 });

    expect(errors).toEqual([]);
  });
});
