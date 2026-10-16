import { describe, it, expect, vi } from 'vitest';
import { waitForHealth } from './health.mjs';

describe('waitForHealth', () => {
  it('resolves when fetch eventually returns ok', async () => {
    let n = 0;
    const fetchFn = vi.fn(async () => {
      n += 1;
      if (n < 3) return { ok: false, status: 503 };
      return { ok: true, status: 200 };
    });
    await waitForHealth('http://127.0.0.1:9/api/health', {
      timeoutMs: 2000,
      intervalMs: 10,
      fetchFn,
    });
    expect(fetchFn.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects on timeout', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 503 }));
    await expect(
      waitForHealth('http://127.0.0.1:9/api/health', {
        timeoutMs: 50,
        intervalMs: 10,
        fetchFn,
      }),
    ).rejects.toThrow(/health/i);
  });
});
