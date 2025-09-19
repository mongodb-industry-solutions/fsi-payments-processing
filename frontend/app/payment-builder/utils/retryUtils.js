/**
 * Retry utility for API calls with exponential backoff
 */

export async function retryWithBackoff(
  fn,
  options = {}
) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = (error) => {
      // Retry on network errors or 5xx server errors
      if (!error.response) return true; // Network error
      const status = error.response?.status;
      return status >= 500 && status < 600;
    },
    onRetry = (attempt, delay, error) => {
      console.log(`Retry attempt ${attempt} after ${delay}ms delay. Error:`, error.message);
    }
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate next delay with exponential backoff
      const nextDelay = Math.min(delay * backoffFactor, maxDelay);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      const actualDelay = delay + jitter;

      // Notify about retry
      onRetry(attempt, actualDelay, error);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, actualDelay));

      // Update delay for next iteration
      delay = nextDelay;
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper for fetch requests
 */
export function createRetryFetch(options = {}) {
  return async (url, fetchOptions = {}) => {
    return retryWithBackoff(
      async () => {
        const response = await fetch(url, fetchOptions);

        // Throw error for non-2xx responses to trigger retry logic
        if (!response.ok) {
          const error = new Error(`HTTP error! status: ${response.status}`);
          error.response = response;
          throw error;
        }

        return response;
      },
      options
    );
  };
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout(promise, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitorTimeout = options.monitorTimeout || 30000; // 30 seconds

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.resetTimer = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await fn();

      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn('Circuit breaker opened due to excessive failures');
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}