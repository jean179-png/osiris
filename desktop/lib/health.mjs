export async function waitForHealth(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 250;
  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const start = Date.now();
  let lastErr = 'not ready';
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(intervalMs * 4) });
      if (res && res.ok) return;
      lastErr = `status ${res?.status}`;
    } catch (e) {
      lastErr = e?.message || String(e);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Osiris health check timed out (${url}): ${lastErr}`);
}
