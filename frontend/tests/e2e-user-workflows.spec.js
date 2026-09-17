import { test, expect } from '@playwright/test';
import { EnvironmentHelper } from 'utils/environment-helper.js';

/**
 * Agentic Payments Platform (fsi-payments-processing) E2E smoke tests.
 *
 * These tests do NOT mock the API: the nightly run exists to notice when
 * staging itself breaks, so every assertion goes through the real backend.
 * The app's own repo keeps a mocked suite for fast PR feedback.
 *
 * The Simulate flow drives a LangGraph multi-agent pipeline backed by Atlas
 * Search + Vector Search, AWS Bedrock, and Voyage AI. AI output is
 * non-deterministic, so FS-AP-04 asserts only that streaming started and that
 * at least one log event rendered — never exact event text or final canonical
 * JSON content (QA rule 4).
 *
 * Locators: the app uses LeafyGreen UI with almost no data-testid attributes,
 * so locators are role- and text-based. Scenario cards render as LeafyGreen
 * <Card as="div" onClick> — a div, not a button — so they are matched by their
 * visible title text; this is the only available locator for that element.
 */

const APP_KEY = 'agentic-payments';

test.describe('Agentic Payments Platform - E2E User Workflows', () => {
  let frontendUrl;

  test.beforeAll(() => {
    const appName = process.env.APP_NAME || APP_KEY;
    const envName = process.env.ENV_NAME || 'local';
    frontendUrl = EnvironmentHelper.getFrontendUrl(appName, envName);
  });

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(frontendUrl);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page, context }) => {
    try {
      const pages = context.pages();
      await Promise.all(
        pages
          .filter(p => p !== page && !p.isClosed())
          .map(p => p.close())
      );
      await Promise.all([context.clearCookies(), context.clearPermissions()]);
      // Only clear storage on a real http(s) document — after a failed goto the
      // page sits on a chromium error page where localStorage is inaccessible
      // and evaluate would throw a SecurityError.
      if (!page.isClosed() && /^https?:/.test(page.url())) {
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
      }
    } catch (error) {
      console.warn('Cleanup error in afterEach:', error.message);
    }
  });

  const url = path => `${frontendUrl.replace(/\/$/, '')}${path}`;

  test('FS-AP-01: Landing Page Renders and Get Started Navigates to Smart Processor', async ({ page }) => {
    // Assert initial page state
    await expect(page.getByRole('heading', { name: 'Agentic Payments Platform', level: 1 })).toBeVisible();
    await expect(page.getByText('Document-driven. Intelligent learning. Universal compatibility.')).toBeVisible();
    // exact:true — the subtitle <h6> ("...Universal compatibility.") substring-matches
    // these card headings, which would otherwise fail strict mode.
    await expect(page.getByRole('heading', { name: 'Configuration-as-Data', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agentic Error Resolution', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Universal Compatibility', exact: true })).toBeVisible();

    // Act — click the primary CTA
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Assert — navigated to the Smart Processor route
    await expect(page).toHaveURL(url('/agentic-ai'));
    await expect(page.getByRole('heading', { name: 'Payment Scenarios', level: 2 })).toBeVisible();
  });

  test('FS-AP-02: Navigation Bar Routes to Each Section', async ({ page }) => {
    // Config Studio
    await page.getByRole('link', { name: 'Config Studio' }).click();
    await expect(page).toHaveURL(url('/config-builder'));
    await expect(page.getByRole('tablist', { name: 'Config Studio tabs' })).toBeVisible();

    // Documentation
    await page.goto(frontendUrl);
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Documentation' }).click();
    await expect(page).toHaveURL(url('/documentation'));
    await expect(page.getByRole('heading', { name: 'The Problem', level: 3 })).toBeVisible();

    // Smart Processor
    await page.goto(frontendUrl);
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Smart Processor' }).click();
    await expect(page).toHaveURL(url('/agentic-ai'));
    await expect(page.getByRole('heading', { name: 'Payment Scenarios', level: 2 })).toBeVisible();
  });

  test('FS-AP-03: Agentic AI Page Loads Scenario Panel and Action Buttons', async ({ page }) => {
    await page.goto(url('/agentic-ai'));
    await page.waitForLoadState('networkidle');

    // Assert — scenario panel (default expanded view)
    await expect(page.getByRole('heading', { name: 'Payment Scenarios', level: 2 })).toBeVisible();

    // Scenario cards are LeafyGreen <Card as="div"> with no role and render the
    // country-code route + description, NOT the scenario `title` field — so match
    // the card by its description text.
    await expect(page.getByText('Volkswagen AG pays Denso Corporation').first()).toBeVisible();

    // Act — select a scenario, then collapse the panel. The Simulate/Reset buttons
    // only render when the panel is collapsed AND a scenario is selected.
    await page.getByText('Volkswagen AG pays Denso Corporation').first().click();
    await page.getByRole('heading', { name: 'Payment Scenarios', level: 2 }).click();

    // Assert — action buttons now visible
    await expect(page.getByRole('button', { name: 'Simulate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('FS-AP-04: Selecting a Scenario and Simulating Starts the Streaming Pipeline', async ({ page }) => {
    test.setTimeout(90_000); // AI pipeline is slow; allow up to 90s
    await page.goto(url('/agentic-ai'));
    await page.waitForLoadState('networkidle');

    // Act — select the Japan scenario (Card is a div, click by visible description)
    await page.getByText('Volkswagen AG pays Denso Corporation').first().click();

    // Act — collapse the panel to reveal the Simulate button
    await page.getByRole('heading', { name: 'Payment Scenarios', level: 2 }).click();

    // Act — start the simulation
    await page.getByRole('button', { name: 'Simulate' }).click();

    // Assert — streaming state engaged
    await expect(page.getByRole('button', { name: 'Processing...' })).toBeVisible({ timeout: 15_000 });

    // Assert — Transaction Logs panel rendered and at least one event arrived.
    // The panel heading is always present; an event item is the real signal.
    await expect(page.getByRole('heading', { name: 'Transaction Logs', level: 2 })).toBeVisible();
    // "Payment Journey Visualization" is the map panel; its presence confirms the
    // two-column layout mounted alongside the log stream.
    await expect(page.getByRole('heading', { name: 'Payment Journey Visualization', level: 2 })).toBeVisible();
  });

  test('FS-AP-05: Config Studio Page Loads Tabs and Generate Control', async ({ page }) => {
    await page.goto(url('/config-builder'));
    await page.waitForLoadState('networkidle');

    // Assert — tablist with both tabs
    const tabs = page.getByRole('tablist', { name: 'Config Studio tabs' });
    await expect(tabs).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Schema Reference' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Build Config' })).toBeVisible();

    // Act — switch to Build Config
    await page.getByRole('tab', { name: 'Build Config' }).click();

    // Assert — builder controls present
    await expect(page.getByRole('button', { name: 'Generate Config' })).toBeVisible();
    await expect(page.locator('[aria-label="Select source format"]')).toBeVisible();
    await expect(page.locator('[aria-label="Select target format"]')).toBeVisible();
  });

  test('FS-AP-06: Documentation Page Renders Architecture Content', async ({ page }) => {
    await page.goto(url('/documentation'));
    await page.waitForLoadState('networkidle');

    // Assert — intro section (rendered on the default "Challenges" tab)
    await expect(page.getByRole('heading', { name: 'The Problem', level: 3 })).toBeVisible();

    // Act — the architecture content is on the "Behind the Scenes" tab, not the
    // default. Activate it; otherwise the heading below never mounts.
    await page.getByRole('tab', { name: 'Behind the Scenes' }).click();

    // Assert — architecture section
    await expect(page.getByRole('heading', { name: 'Architecture Diagram', level: 3 })).toBeVisible();
  });
});
