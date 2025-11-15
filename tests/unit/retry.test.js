import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { retryWithBackoff } from '../lib/retry.js';

vi.mock('axios');
vi.mock('../lib/logger.js', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}));

describe('retry logic with exponential backoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds on first attempt', async () => {
    const mockFn = vi.fn().mockResolvedValueOnce({ data: 'success' });
    const result = await retryWithBackoff(mockFn, 4, 100);
    expect(result.data).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error (502) and eventually succeeds', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('502 Bad Gateway'), { response: { status: 502 } })
      .mockRejectedValueOnce(new Error('502 Bad Gateway'), { response: { status: 502 } })
      .mockResolvedValueOnce({ data: 'success' });

    // Create a proper error with response
    const err502 = new Error('502 Bad Gateway');
    err502.response = { status: 502 };

    mockFn.mockRejectedValueOnce(err502);
    mockFn.mockRejectedValueOnce(err502);
    mockFn.mockResolvedValueOnce({ data: 'success' });

    const result = await retryWithBackoff(mockFn, 4, 50);
    expect(result.data).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('throws after max attempts', async () => {
    const err502 = new Error('502 Bad Gateway');
    err502.response = { status: 502 };
    const mockFn = vi.fn().mockRejectedValue(err502);

    await expect(retryWithBackoff(mockFn, 2, 10)).rejects.toThrow();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-transient error (400)', async () => {
    const err400 = new Error('400 Bad Request');
    err400.response = { status: 400 };
    const mockFn = vi.fn().mockRejectedValue(err400);

    await expect(retryWithBackoff(mockFn, 4, 100)).rejects.toThrow();
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
