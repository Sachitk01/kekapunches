// lib/retry.js - Exponential backoff + jitter retry logic
import { info, error } from './logger.js';

export async function retryWithBackoff(fn, maxAttempts = 4, baseMsDelay = 500) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const statusCode = err.response?.status;
      const isRetryable =
        !err.response ||
        statusCode === 429 ||
        statusCode === 502 ||
        statusCode === 503 ||
        statusCode === 504 ||
        statusCode >= 500;

      if (attempt === maxAttempts || !isRetryable) {
        error('Retry exhausted', { attempt, statusCode, message: err.message });
        throw err;
      }

      const backoffMs = baseMsDelay * Math.pow(2, attempt - 1);
      const jitterMs = Math.random() * 300 - 150;
      const delayMs = Math.max(0, backoffMs + jitterMs);
      info('Retry attempt', { attempt, statusCode, delayMs });
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}
