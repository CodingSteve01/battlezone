import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }]
      ]
    : [['list'], ['html', { open: 'on-failure' }]],

  // Output directory for screenshots and traces
  outputDir: 'test-results',

  use: {
    baseURL: 'http://localhost:5173',

    // Capture screenshot on failure
    screenshot: 'on',

    // Record trace on first retry (helps debug flaky tests)
    trace: 'on-first-retry',

    // Record video on failure
    video: 'on-first-retry',

    // Viewport size for consistent screenshots
    viewport: { width: 1280, height: 720 },
  },

  // Test timeout
  timeout: 120000, // 2 minutes per test (AI games can take time)
  expect: {
    timeout: 10000, // 10 seconds for expect assertions
  },

  // Projects for different browsers (desktop only for now)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Web server configuration - use Vite for consistent behavior
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000, // 60 seconds to start server
  },
});
