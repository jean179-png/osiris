### Task 1: Pure helpers (port, health, env) + tests

**Files:**
- Create: `desktop/lib/port.mjs`
- Create: `desktop/lib/health.mjs`
- Create: `desktop/lib/env.mjs`
- Create: `desktop/lib/port.test.mjs`
- Create: `desktop/lib/health.test.mjs`
- Create: `desktop/lib/env.test.mjs`

**Interfaces:**
- Produces:
  - `findFreePort(host?: string): Promise<number>` — host defaults `'127.0.0.1'`
  - `waitForHealth(url: string, opts?: { timeoutMs?: number; intervalMs?: number; fetchFn?: typeof fetch }): Promise<void>`
  - `loadDesktopEnv(userDataPath: string): Record<string, string>` — reads `path.join(userDataPath, '.env')` if present; returns `{}` if missing; does not mutate `process.env` (caller merges)

- [ ] **Step 1: Write failing tests**

```js
// desktop/lib/port.test.mjs
import { describe, it, expect } from 'vitest';
import net from 'node:net';
import { findFreePort } from './port.mjs';

describe('findFreePort', () => {
  it('returns a port that can be bound on 127.0.0.1', async () => {
    const port = await findFreePort('127.0.0.1');
    expect(port).toBeGreaterThan(0);
    await new Promise((resolve, reject) => {
      const s = net.createServer();
      s.once('error', reject);
      s.listen(port, '127.0.0.1', () => s.close(() => resolve()));
    });
  });
});
```

```js
// desktop/lib/health.test.mjs
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
```

```js
// desktop/lib/env.test.mjs
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDesktopEnv } from './env.mjs';

describe('loadDesktopEnv', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'osiris-env-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns empty object when .env missing', () => {
    expect(loadDesktopEnv(dir)).toEqual({});
  });

  it('parses KEY=value lines and ignores comments', () => {
    writeFileSync(join(dir, '.env'), '# c\nFOO=bar\nBAZ=qux\n');
    expect(loadDesktopEnv(dir)).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run desktop/lib`

Expected: FAIL (modules missing)

- [ ] **Step 3: Implement helpers**

```js
// desktop/lib/port.mjs
import net from 'node:net';

export function findFreePort(host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, host, () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}
```

```js
// desktop/lib/health.mjs
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
```

```js
// desktop/lib/env.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Minimal KEY=VALUE parser (no export/quote expansion). */
export function loadDesktopEnv(userDataPath) {
  const file = join(userDataPath, '.env');
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run desktop/lib`

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add desktop/lib
git commit -m "feat(desktop): port, health, and env helpers"
```

---
