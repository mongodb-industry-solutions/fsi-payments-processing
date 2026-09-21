import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 3 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ['json', { outputFile: 'test-results/test-results.json' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? 'off' : 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: process.env.CI ? 'off' : 'retain-on-failure',
  },

  /* Configure projects for basic connectivity testing */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            ...(process.env.CI ? [
              '--no-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--memory-pressure-off',
              '--disable-background-timer-throttling',
              '--disable-features=TranslateUI',
              '--disable-ipc-flooding-protection'
            ] : [])
          ]
        }
      },
    },
  ],

  /* Run the production build before tests. Locally reuses a server you
     already started (npm run dev / start); in CI it boots `next start`
     against the build the pipeline just produced, then tears it down. */
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  /* Output directory for test artifacts */
  outputDir: 'test-results/',

  /* Global test timeout */
  timeout: 30 * 1000,

  /* Global timeout for the entire run (all projects, hooks, and retries). */
  globalTimeout: 60 * 60 * 1000,
});
