import { test, expect } from '@playwright/test';

test.describe('AI vs AI Spectator Mode', () => {
  test('AI vs AI game runs without black screen or errors for 60 seconds', async ({ page }) => {
    const errors = [];
    const consoleMessages = [];
    const warnings = [];

    // Collect all console messages
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        errors.push(text);
        console.log(`[ERROR] ${text}`);
      } else if (msg.type() === 'warning') {
        warnings.push(text);
        console.log(`[WARN] ${text}`);
      } else {
        consoleMessages.push(text);
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Load the page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('Page loaded');

    // Set up AI vs AI: Set both players to AI
    // First, we need to configure the AI config grid
    // Player 2 is already AI by default, we need to make Player 1 also AI
    const player1Toggle = page.locator('.ai-config-item:first-child .type-toggle');
    await expect(player1Toggle).toBeVisible();

    // Check if Player 1 is human (default) and toggle to AI
    const player1Text = await player1Toggle.textContent();
    if (player1Text?.includes('Mensch')) {
      await player1Toggle.click();
      await page.waitForTimeout(100);
      console.log('Toggled Player 1 to AI');
    }

    // Verify both players are AI
    const player2Toggle = page.locator('.ai-config-item:nth-child(2) .type-toggle');
    const player2Text = await player2Toggle.textContent();
    console.log(`Player 1: ${await player1Toggle.textContent()}, Player 2: ${player2Text}`);

    // Select small map for faster game
    const smallMapBtn = page.locator('[data-size="small"]');
    await smallMapBtn.click();
    await page.waitForTimeout(100);
    console.log('Selected small map');

    // Take screenshot of menu config
    await page.screenshot({ path: 'test-results/ai-vs-ai-01-menu.png' });

    // Click start button
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    console.log('Clicked start button');

    // Wait for team selection to be skipped (both AI) and game to start
    await page.waitForTimeout(2000);

    // Take screenshot after game starts
    await page.screenshot({ path: 'test-results/ai-vs-ai-02-game-start.png' });

    // Check that game canvas is visible and rendering
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Function to check if canvas is black
    async function isCanvasBlack() {
      return await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return { isBlack: true, reason: 'Canvas not found' };

        const ctx = canvas.getContext('2d');
        if (!ctx) return { isBlack: true, reason: 'No 2D context' };

        if (canvas.width === 0 || canvas.height === 0) {
          return { isBlack: true, reason: `Canvas has zero dimensions: ${canvas.width}x${canvas.height}` };
        }

        // Sample multiple points on the canvas
        const samplePoints = [
          { x: canvas.width / 2, y: canvas.height / 2 },
          { x: canvas.width / 4, y: canvas.height / 4 },
          { x: (canvas.width * 3) / 4, y: (canvas.height * 3) / 4 },
          { x: canvas.width / 4, y: (canvas.height * 3) / 4 },
          { x: (canvas.width * 3) / 4, y: canvas.height / 4 },
        ];

        let blackPixels = 0;
        let totalSamples = samplePoints.length;

        for (const point of samplePoints) {
          const imageData = ctx.getImageData(point.x, point.y, 1, 1);
          const [r, g, b, a] = imageData.data;

          // Check if pixel is essentially black (very dark or fully transparent)
          if ((r < 20 && g < 20 && b < 20) || a === 0) {
            blackPixels++;
          }
        }

        const isBlack = blackPixels >= (totalSamples * 0.8); // 80% or more black = black screen
        return {
          isBlack,
          blackPixels,
          totalSamples,
          reason: isBlack ? `${blackPixels}/${totalSamples} pixels are black` : 'Screen has content'
        };
      });
    }

    // Function to get game state for debugging
    async function getGameState() {
      return await page.evaluate(() => {
        // Access the game state module
        return {
          // Try to access state directly from window if exposed
          currentScreen: document.querySelector('.screen.active')?.id || 'none',
          menuVisible: document.getElementById('menu')?.style.display !== 'none' && !document.getElementById('menu')?.classList.contains('hidden'),
          gameAreaVisible: document.getElementById('game-area')?.style.display !== 'none',
          canvasDimensions: {
            width: document.getElementById('game-canvas')?.width || 0,
            height: document.getElementById('game-canvas')?.height || 0
          },
          aiThinkingVisible: !!document.querySelector('.ai-thinking'),
          aiThoughtVisible: !!document.querySelector('.ai-thought-bubble'),
          turnScreenVisible: document.getElementById('turn-screen')?.classList.contains('active') || false,
          gameOverVisible: document.getElementById('gameover')?.classList.contains('active') || false
        };
      });
    }

    // Monitor the game for 60 seconds, checking every 2 seconds
    const testDuration = 60000; // 60 seconds
    const checkInterval = 2000; // Check every 2 seconds
    const maxChecks = testDuration / checkInterval;
    let checksPerformed = 0;
    let blackScreenDetected = false;
    let blackScreenTime = 0;
    let gameEnded = false;

    console.log('Starting game monitoring for 60 seconds...');

    for (let i = 0; i < maxChecks; i++) {
      await page.waitForTimeout(checkInterval);
      checksPerformed++;

      const gameState = await getGameState();
      const blackCheck = await isCanvasBlack();

      console.log(`Check ${checksPerformed}: Canvas ${blackCheck.isBlack ? 'BLACK' : 'OK'} | ${blackCheck.reason}`);
      console.log(`  State: screen=${gameState.currentScreen}, aiThinking=${gameState.aiThinkingVisible}, dimensions=${gameState.canvasDimensions.width}x${gameState.canvasDimensions.height}`);

      // Check if game ended normally
      if (gameState.gameOverVisible) {
        console.log('Game ended normally - game over screen visible');
        gameEnded = true;
        await page.screenshot({ path: `test-results/ai-vs-ai-gameover.png` });
        break;
      }

      // Detect black screen
      if (blackCheck.isBlack && !gameState.aiThinkingVisible && !gameState.turnScreenVisible && gameState.canvasDimensions.width > 0) {
        blackScreenTime += checkInterval;

        // Take screenshot on first detection
        if (!blackScreenDetected) {
          console.log(`BLACK SCREEN DETECTED at check ${checksPerformed}!`);
          await page.screenshot({ path: `test-results/ai-vs-ai-BLACK-SCREEN-${checksPerformed}.png` });
          blackScreenDetected = true;
        }

        // If black screen persists for more than 6 seconds, it's a real issue
        if (blackScreenTime >= 6000) {
          console.log(`Black screen persisted for ${blackScreenTime}ms - test failing`);
          break;
        }
      } else {
        // Reset black screen timer if screen recovers
        if (blackScreenTime > 0) {
          console.log(`Screen recovered after ${blackScreenTime}ms`);
        }
        blackScreenTime = 0;
      }

      // Take periodic screenshots
      if (checksPerformed % 10 === 0) {
        await page.screenshot({ path: `test-results/ai-vs-ai-progress-${checksPerformed}.png` });
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/ai-vs-ai-final.png' });

    // Report findings
    console.log('\n=== Test Summary ===');
    console.log(`Checks performed: ${checksPerformed}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Black screen detected: ${blackScreenDetected}`);
    console.log(`Black screen duration: ${blackScreenTime}ms`);
    console.log(`Game ended normally: ${gameEnded}`);

    if (errors.length > 0) {
      console.log('\n=== Errors ===');
      errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
    }

    if (warnings.length > 0) {
      console.log('\n=== Warnings ===');
      warnings.slice(0, 10).forEach((warn, i) => console.log(`${i + 1}. ${warn}`));
    }

    // Assertions
    expect(errors, 'Expected no JavaScript errors').toEqual([]);
    expect(blackScreenTime, 'Black screen should not persist for more than 6 seconds').toBeLessThan(6000);
  });

  test('AI vs AI game canvas remains valid during gameplay', async ({ page }) => {
    const errors = [];

    page.on('pageerror', error => {
      errors.push(error.message);
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log(`[ERROR] ${msg.text()}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set up AI vs AI
    const player1Toggle = page.locator('.ai-config-item:first-child .type-toggle');
    const player1Text = await player1Toggle.textContent();
    if (player1Text?.includes('Mensch')) {
      await player1Toggle.click();
    }

    // Use small map
    await page.locator('[data-size="small"]').click();

    // Start game
    await page.locator('#start-btn').click();
    await page.waitForTimeout(2000);

    // Monitor canvas validity for 30 seconds
    let invalidCanvasDetected = false;

    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(2000);

      const canvasCheck = await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return { valid: false, reason: 'Canvas element not found' };

        const ctx = canvas.getContext('2d');
        if (!ctx) return { valid: false, reason: 'Cannot get 2D context' };

        if (canvas.width <= 0 || canvas.height <= 0) {
          return { valid: false, reason: `Invalid dimensions: ${canvas.width}x${canvas.height}` };
        }

        // Check if canvas is properly attached to DOM
        if (!document.body.contains(canvas)) {
          return { valid: false, reason: 'Canvas not in DOM' };
        }

        return { valid: true, width: canvas.width, height: canvas.height };
      });

      console.log(`Canvas check ${i + 1}: ${canvasCheck.valid ? 'VALID' : 'INVALID'} - ${canvasCheck.reason || `${canvasCheck.width}x${canvasCheck.height}`}`);

      if (!canvasCheck.valid) {
        invalidCanvasDetected = true;
        await page.screenshot({ path: `test-results/invalid-canvas-${i}.png` });
        break;
      }

      // Check for game over
      const isGameOver = await page.evaluate(() => {
        return document.getElementById('gameover')?.classList.contains('active') || false;
      });

      if (isGameOver) {
        console.log('Game ended normally');
        break;
      }
    }

    expect(errors).toEqual([]);
    expect(invalidCanvasDetected).toBe(false);
  });
});
