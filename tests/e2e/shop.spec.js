import { test, expect } from '@playwright/test';

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

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Wait for menu to be visible
        const menu = page.locator('#menu');
        await expect(menu).toBeVisible({ timeout: 5000 });

        // Click start button to go to wizard
        const startBtn = page.locator('#start-btn');
        await expect(startBtn).toBeVisible();
        await startBtn.click();

        // Wait for map wizard screen
        const wizardMap = page.locator('#wizard-map');
        await expect(wizardMap).toBeVisible({ timeout: 3000 });

        // Click next to go to players screen
        const wizardMapNext = page.locator('#wizard-map-next');
        await expect(wizardMapNext).toBeVisible();
        await wizardMapNext.click();

        // Wait for players wizard screen
        const wizardPlayers = page.locator('#wizard-players');
        await expect(wizardPlayers).toBeVisible({ timeout: 3000 });

        // Click next to go to team selection (shop)
        const wizardPlayersNext = page.locator('#wizard-players-next');
        await expect(wizardPlayersNext).toBeVisible();
        await wizardPlayersNext.click();

        // Wait for team selection screen (shop)
        const teamSelect = page.locator('#team-select');
        await expect(teamSelect).toBeVisible({ timeout: 3000 });

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

        // Verify unit cards are generated - should have 6 unit classes
        const unitCards = page.locator('.unit-card');
        await expect(unitCards).toHaveCount(6, { timeout: 5000 });

        // Verify each unit card is visible
        for (let i = 0; i < 6; i++) {
            await expect(unitCards.nth(i)).toBeVisible();
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

    test('unit cards can be selected and budget updates', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Navigate to shop
        await page.locator('#start-btn').click();
        await page.locator('#wizard-map-next').click();
        await page.locator('#wizard-players-next').click();

        // Wait for shop
        await expect(page.locator('#team-select')).toBeVisible({ timeout: 3000 });

        // Get initial budget text
        const budgetCurrent = page.locator('.budget-current');
        await expect(budgetCurrent).toHaveText('0');

        // Click first unit card to select it
        const firstCard = page.locator('.unit-card').first();
        await firstCard.click();

        // Budget should have increased (not 0 anymore)
        await expect(budgetCurrent).not.toHaveText('0');

        // Card should be marked as selected
        await expect(firstCard).toHaveClass(/selected/);

        // Team preview should show the selected unit
        const teamPreview = page.locator('#team-preview-units');
        const previewSlots = teamPreview.locator('.team-preview-slot');
        await expect(previewSlots).toHaveCount(1, { timeout: 2000 });

        expect(errors).toEqual([]);
    });

    test('shop player badge has correct background color', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Navigate to shop
        await page.locator('#start-btn').click();
        await page.locator('#wizard-map-next').click();
        await page.locator('#wizard-players-next').click();

        // Wait for shop
        await expect(page.locator('#team-select')).toBeVisible({ timeout: 3000 });

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
