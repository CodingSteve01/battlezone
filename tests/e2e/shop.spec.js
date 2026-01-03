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

        // Verify shop grid container exists
        const gridContainer = page.locator('.shop-grid-container');
        await expect(gridContainer).toBeVisible();

        // Verify unit class groups are generated - should have 6 groups (one per unit class)
        const unitGroups = page.locator('.unit-class-group');
        await expect(unitGroups).toHaveCount(6, { timeout: 5000 });

        // Verify unit cards are generated - should have 18 cards (6 unit classes × 3 variants each)
        const unitCards = page.locator('.unit-card');
        await expect(unitCards).toHaveCount(18, { timeout: 5000 });

        // Verify each group header is visible
        const groupHeaders = page.locator('.unit-class-header');
        for (let i = 0; i < 6; i++) {
            await expect(groupHeaders.nth(i)).toBeVisible();
        }

        // Verify bottom bar with buttons
        const bottomBar = page.locator('.shop-bottom-bar');
        await expect(bottomBar).toBeVisible();

        const backBtn = page.locator('#team-back-btn');
        await expect(backBtn).toBeVisible();

        const confirmBtn = page.locator('#team-confirm-btn');
        await expect(confirmBtn).toBeVisible();
        await expect(confirmBtn).toBeDisabled(); // Should be disabled initially

        // No JavaScript errors should have occurred
        expect(errors, 'No JavaScript errors should occur').toEqual([]);
    });

    test('unit cards can be added via cart controls and budget updates', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));

        await navigateToShop(page);

        // Get initial budget text
        const budgetCurrent = page.locator('.budget-current');
        await expect(budgetCurrent).toHaveText('0');

        // Click cart add button on first unit card to add it
        const firstCard = page.locator('.unit-card').first();
        const addBtn = firstCard.locator('.cart-add');
        await addBtn.click();

        // Budget should have increased (not 0 anymore)
        await expect(budgetCurrent).not.toHaveText('0');

        // Card should show cart count of 1
        const cartCount = firstCard.locator('.cart-count');
        await expect(cartCount).toHaveText('1');

        // Team preview should show the selected unit (uses .team-slot.filled class)
        const teamPreview = page.locator('#team-preview-units');
        const filledSlots = teamPreview.locator('.team-slot.filled');
        await expect(filledSlots).toHaveCount(1, { timeout: 2000 });

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
