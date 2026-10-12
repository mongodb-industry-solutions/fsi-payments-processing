/**
 * Basic test data utilities for E2E tests
 */

/**
 * Basic test data for financial news application
 */
export const FinancialNewsTestData = {
  // Basic search queries for testing
  searchQueries: {
    valid: [
      'MongoDB',
      'technology',
      'artificial intelligence'
    ]
  },

  // Basic API request payloads
  apiPayloads: {
    scrapeArticles: {
      valid: { symbol: 'MDB' }
    },
    lookupArticles: {
      valid: { query: 'MongoDB', limit: 5 }
    }
  }
};

/**
 * Common selectors for UI testing
 */
export const CommonSelectors = {
  // Error states
  error: {
    message: '[data-testid="error-message"]',
    banner: '.error-banner'
  },

  // Success states
  success: {
    message: '[data-testid="success-message"]',
    banner: '.success-banner'
  },

  // Common form elements
  form: {
    submit: 'button[type="submit"]',
    input: 'input'
  }
};

/**
 * Wait utilities for tests
 */
export class WaitUtils {
  /**
   * Wait for a specified amount of time
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after the specified time
   */
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for network to be idle
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Promise that resolves when network is idle
   */
  static async waitForNetworkIdle(page, timeout = 30000) {
    return page.waitForLoadState('networkidle', { timeout });
  }
}
