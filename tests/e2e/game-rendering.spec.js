import { test, expect } from '@playwright/test';

/**
 * Minimal smoke test - just verify page loads without JS errors
 */
test.describe('Game Smoke Test', () => {
  test('page loads without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Just check the page loaded
    await expect(page.locator('body')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
