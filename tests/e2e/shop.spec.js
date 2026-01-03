import { test, expect } from '@playwright/test';

/**
 * Helper function to wait for app initialization
 * The app sets data-app-ready="true" on body when fully initialized
 */
async function waitForAppReady(page) {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Wait for app to be fully initialized (event handlers set up)
    await page.waitForSelector('body[data-app-ready="true"]', { timeout: 10000 });
}

/**
 * Helper function to navigate to shop screen
 */
async function navigateToShop(page) {
    await waitForAppReady(page);

    // Wait for menu to be visible
    const menu = page.locator('#menu');
    await expect(menu).toBeVisible({ timeout: 5000 });

    // Click start button to go to wizard
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Wait for map wizard screen
    const wizardMap = page.locator('#wizard-map');
    await expect(wizardMap).toBeVisible({ timeout: 5000 });

    // Click next to go to players screen
    const wizardMapNext = page.locator('#wizard-map-next');
    await expect(wizardMapNext).toBeVisible();
    await wizardMapNext.click();

    // Wait for players wizard screen
    const wizardPlayers = page.locator('#wizard-players');
    await expect(wizardPlayers).toBeVisible({ timeout: 5000 });

    // Click next to go to team selection (shop)
    const wizardPlayersNext = page.locator('#wizard-players-next');
    await expect(wizardPlayersNext).toBeVisible();
    await wizardPlayersNext.click();

    // Wait for shop screen
    await expect(page.locator('#team-select')).toBeVisible({ timeout: 5000 });
}

/**
 * Shop/Team Selection screen tests
 * Verifies the shop loads correctly without console errors
 */
test.describe('Shop Screen', () => {
    test('shop screen loads with unit cards and no console errors', async ({ page }) => {
        const errors = [];
        const warnings = [];

        // Capture all console errors and warnings
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            } else if (msg.type() === 'warning') {
                warnings.push(msg.text());
            }
        });

        await navigateToShop(page);

        // Verify shop header is visible
        const shopHeader = page.locator('.shop-header');
        await expect(shopHeader).toBeVisible();

        // Verify player badge is visible and has correct content
        const badge = page.locator('#team-select-badge');
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText('1');

        // Verify budget display
        const budget = page.locator('#shop-budget');
        await expect(budget).toBeVisible();

        // Verify category step is visible (Step 1: Class selection)
        const stepClasses = page.locator('#shop-step-classes');
        await expect(stepClasses).toBeVisible();

        // Verify 6 category cards are generated (one per unit class)
        const categoryCards = page.locator('.category-card');
        await expect(categoryCards).toHaveCount(6, { timeout: 5000 });

        // Verify cart panel with buttons
        const cartPanel = page.locator('.shop-cart-panel');
        await expect(cartPanel).toBeVisible();

        const backBtn = page.locator('#team-back-btn');
        await expect(backBtn).toBeVisible();

        const confirmBtn = page.locator('#team-confirm-btn');
        await expect(confirmBtn).toBeVisible();
        await expect(confirmBtn).toBeDisabled(); // Should be disabled initially

        // No JavaScript errors should have occurred
        expect(errors, 'No JavaScript errors should occur').toEqual([]);
    });

    test('clicking category shows variants and can add units', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));

        await navigateToShop(page);

        // Get initial budget text
        const budgetCurrent = page.locator('.budget-current');
        await expect(budgetCurrent).toHaveText('0');

        // Click first category card to see variants
        const firstCategory = page.locator('.category-card').first();
        await firstCategory.click();

        // Verify variants step is now visible
        const stepVariants = page.locator('#shop-step-variants');
        await expect(stepVariants).toBeVisible({ timeout: 2000 });

        // Verify variant cards are shown (3 variants per class)
        const variantCards = page.locator('.variant-card-full');
        await expect(variantCards).toHaveCount(3, { timeout: 2000 });

        // Click add button on first variant
        const firstVariant = variantCards.first();
        const addBtn = firstVariant.locator('[data-action="add"]');
        await addBtn.click();

        // Budget should have increased (not 0 anymore)
        await expect(budgetCurrent).not.toHaveText('0');

        // Variant should show count of 1
        const variantCount = firstVariant.locator('.variant-cart-count');
        await expect(variantCount).toHaveText('1');

        // Cart count badge should show 1/6
        const cartCountBadge = page.locator('#cart-count-badge');
        await expect(cartCountBadge).toHaveText('1/6');

        expect(errors).toEqual([]);
    });

    test('shop player badge has correct background color', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));

        await navigateToShop(page);

        // Check badge has a background color (not transparent)
        const badge = page.locator('#team-select-badge');
        const bgColor = await badge.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.backgroundColor;
        });

        // Should have a visible background color (not transparent/none)
        expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(bgColor).not.toBe('transparent');

        expect(errors).toEqual([]);
    });
});
