# Osiris Desktop (Electron) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package Osiris as a portable Electron desktop app (Windows / macOS / Linux) that runs the Next.js standalone server on loopback and shows it in a BrowserWindow.

**Architecture:** Electron main picks a free port, loads optional env from userData, forks the Next `standalone` `server.js` bound to `127.0.0.1`, waits for `/api/health`, then opens a window. electron-builder ships portable artifacts with the staged standalone tree as an extraResource.

**Tech Stack:** Electron 35+, electron-builder, Next.js 16 standalone (existing), Vitest, Node.js child/utilityProcess.

**Spec:** `docs/superpowers/specs/2026-10-15-osiris-desktop-electron-design.md`

## Global Constraints

- Bind Next to `127.0.0.1` only (never `0.0.0.0`).
- Renderer: `contextIsolation: true`, `nodeIntegration: false`; minimal preload.
- Portable builds only (no auto-update, no code signing required for v1).
- Do not change Vercel behavior: keep `output: process.env.VERCEL ? undefined : 'standalone'` in `next.config.ts`.
- Single-instance lock; quit must kill the Next child.
- Optional secrets from userData `.env`, not baked into the binary.
- Caches writable under Electron `userData` / cache paths when running as desktop.
- Frequent commits; do not commit unrelated CCTV/curiosities WIP.

## File map

| Path | Role |
|------|------|
| `desktop/main.mjs` | Electron main: port, env, spawn Next, window, lifecycle |
| `desktop/preload.mjs` | Minimal contextBridge (empty or version string only) |
| `desktop/lib/port.mjs` | `findFreePort()` |
| `desktop/lib/health.mjs` | `waitForHealth(url, opts)` |
| `desktop/lib/env.mjs` | `loadDesktopEnv(userDataPath)` |
| `desktop/lib/paths.mjs` | Resolve standalone dir (dev vs packaged) |
| `desktop/lib/*.test.mjs` | Vitest tests for pure helpers |
| `desktop/stage-standalone.mjs` | Copy standalone + static + public into `desktop/resources/standalone` |
| `desktop/electron-builder.yml` | Portable targets + extraResources |
| `docs/DESKTOP.md` | User-facing run/pack/env docs |
| `package.json` | Scripts + electron / electron-builder deps |

---

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

### Task 2: Path resolution + Electron main/preload skeleton

**Files:**
- Create: `desktop/lib/paths.mjs`
- Create: `desktop/lib/paths.test.mjs`
- Create: `desktop/main.mjs`
- Create: `desktop/preload.mjs`

**Interfaces:**
- Consumes: `findFreePort`, `waitForHealth`, `loadDesktopEnv`
- Produces:
  - `resolveStandaloneDir(app): string` — packaged: `join(process.resourcesPath, 'standalone')`; unpackaged: `join(app.getAppPath(), '..', '.next', 'standalone')` only used in pack path; for `desktop:dev` main will not require standalone
  - Main entry exports nothing; side-effect app

- [ ] **Step 1: Test paths helper**

```js
// desktop/lib/paths.test.mjs
import { describe, it, expect } from 'vitest';
import { resolveStandaloneDir } from './paths.mjs';

describe('resolveStandaloneDir', () => {
  it('uses resourcesPath/standalone when packaged', () => {
    const dir = resolveStandaloneDir({
      isPackaged: true,
      resourcesPath: 'C:\\App\\resources',
      getAppPath: () => 'C:\\App\\app.asar',
    });
    expect(dir.replace(/\\/g, '/')).toMatch(/resources\/standalone$/);
  });
});
```

- [ ] **Step 2: Implement paths + skeleton main/preload**

```js
// desktop/lib/paths.mjs
import { join } from 'node:path';

export function resolveStandaloneDir(appLike) {
  if (appLike.isPackaged) {
    return join(appLike.resourcesPath, 'standalone');
  }
  // Dev production-smoke: repo .next/standalone
  return join(appLike.getAppPath(), '..', '.next', 'standalone');
}
```

```js
// desktop/preload.mjs
import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('osirisDesktop', { isDesktop: true });
```

```js
// desktop/main.mjs — skeleton: single-instance, create empty window after ready
// Full spawn logic in Task 3. For this task: import helpers, register
// requestSingleInstanceLock, set name 'Osiris', quit on window-all-closed
// (except darwin optional), and create BrowserWindow with:
// webPreferences: { preload: join(__dirname, 'preload.mjs'), contextIsolation: true, nodeIntegration: false }
// loadURL can be about:blank until Task 3.
```

Implement the skeleton with clear `TODO(task3)` markers only for the spawn/loadURL body — actually **do not leave TODOs**: for Task 2, `loadURL('data:text/html,<h1>Osiris desktop shell</h1>')` so the window opens without Next.

- [ ] **Step 3: Run path tests PASS**

Run: `npx vitest run desktop/lib/paths.test.mjs`

- [ ] **Step 4: Commit**

```bash
git add desktop/
git commit -m "feat(desktop): Electron main/preload skeleton and path helper"
```

---

### Task 3: Spawn Next, health wait, wire window + lifecycle

**Files:**
- Modify: `desktop/main.mjs`
- Create: `desktop/lib/spawn-next.mjs`
- Create: `desktop/lib/spawn-next.test.mjs` (pure: buildEnv merge unit test only)

**Interfaces:**
- Produces:
  - `buildChildEnv(baseEnv, desktopEnv, { host, port, userData, cacheDir }): NodeJS.ProcessEnv`
  - `startNextServer({ standaloneDir, env }): ChildProcess` — `fork`/`spawn` `node server.js` with `cwd: standaloneDir`, `env`, `stdio: 'pipe'`
  - Main: on ready → free port → merge env → start server → `waitForHealth` → `loadURL(http://127.0.0.1:port)` → on quit `child.kill`

- [ ] **Step 1: Test env merge**

```js
// desktop/lib/spawn-next.test.mjs
import { describe, it, expect } from 'vitest';
import { buildChildEnv } from './spawn-next.mjs';

describe('buildChildEnv', () => {
  it('forces loopback host/port and injects cache paths', () => {
    const env = buildChildEnv(
      { PATH: '/usr/bin', HOSTNAME: '0.0.0.0' },
      { AIS_API_KEY: 'x' },
      {
        host: '127.0.0.1',
        port: 41234,
        userData: '/tmp/osiris-data',
        cacheDir: '/tmp/osiris-cache',
      },
    );
    expect(env.HOSTNAME).toBe('127.0.0.1');
    expect(env.PORT).toBe('41234');
    expect(env.AIS_API_KEY).toBe('x');
    expect(env.OSIRIS_CCTV_SNAPSHOT).toContain('osiris-cache');
    expect(env.OSIRIS_NOMINATIM_CACHE).toContain('osiris-cache');
  });
});
```

- [ ] **Step 2: Implement spawn-next + wire main**

```js
// desktop/lib/spawn-next.mjs
import { spawn } from 'node:child_process';
import { join } from 'node:path';

export function buildChildEnv(baseEnv, desktopEnv, { host, port, userData, cacheDir }) {
  return {
    ...baseEnv,
    ...desktopEnv,
    NODE_ENV: 'production',
    HOSTNAME: host,
    PORT: String(port),
    OSIRIS_CCTV_SNAPSHOT: join(cacheDir, 'cctv-catalog.json'),
    OSIRIS_NOMINATIM_CACHE: join(cacheDir, 'nominatim.json'),
    // Keep userData available for future features
    OSIRIS_USER_DATA: userData,
  };
}

export function startNextServer({ standaloneDir, env, nodeBinary = process.execPath }) {
  // When running under Electron, process.execPath is Electron — do NOT use it for Next.
  // Caller must pass a real Node binary path (see main.mjs).
  const serverJs = join(standaloneDir, 'server.js');
  return spawn(nodeBinary, [serverJs], {
    cwd: standaloneDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}
```

In `desktop/main.mjs`:

1. Import `app`, `BrowserWindow`, `dialog` from `electron`; helpers from `./lib/*`.
2. Resolve Node binary:
   - Packaged: `join(process.resourcesPath, 'node', process.platform === 'win32' ? 'node.exe' : 'node')`
   - Unpackaged pack-smoke: `process.env.OSIRIS_NODE || 'node'` (PATH)
3. Flow: `findFreePort` → `loadDesktopEnv(app.getPath('userData'))` → `mkdir` cache → `buildChildEnv` → `startNextServer` → log child stderr → `waitForHealth(\`http://127.0.0.1:${port}/api/health\`)` → create window → `loadURL`.
4. On failure: `dialog.showErrorBox` and `app.quit()`.
5. `app.on('before-quit' / 'will-quit')` and window close: kill child (`tree-kill` optional; prefer `child.kill('SIGTERM')` then `SIGKILL` after 2s). On Windows use `taskkill /pid /T /F` fallback if needed.
6. `desktop:dev` mode: if `process.env.OSIRIS_DESKTOP_DEV === '1'`, **skip** spawn and `loadURL(process.env.OSIRIS_DEV_URL || 'http://127.0.0.1:3000')` (Next started separately).

- [ ] **Step 3: Unit test PASS**

Run: `npx vitest run desktop/lib/spawn-next.test.mjs`

- [ ] **Step 4: Manual smoke (dev shell)**

Run Next already on 3000, then:

```bash
set OSIRIS_DESKTOP_DEV=1
npx electron desktop/main.mjs
```

Expected: window loads local Osiris (or shell if Next down — prefer Next up).

- [ ] **Step 5: Commit**

```bash
git add desktop/
git commit -m "feat(desktop): spawn Next standalone and bind BrowserWindow"
```

---

### Task 4: package.json scripts, Electron deps, stage + builder config

**Files:**
- Modify: `package.json`
- Create: `desktop/stage-standalone.mjs`
- Create: `desktop/electron-builder.yml`
- Create: `desktop/download-node.mjs` (fetch platform Node binary into `desktop/resources/node` for packing)

**Interfaces:**
- Scripts:
  - `desktop:dev` — concurrently or sequential: document “run `npm run dev` in one terminal; `npm run desktop:dev` in another” **or** use `concurrently` if already acceptable dependency. Prefer **no new heavy deps**: document two-terminal; script only launches Electron with `OSIRIS_DESKTOP_DEV=1`.
  - `desktop:stage` — `node desktop/stage-standalone.mjs`
  - `desktop:pack` — `npm run build && npm run desktop:stage && electron-builder --config desktop/electron-builder.yml`
- Staging copies (mirror Dockerfile):
  - from `.next/standalone` → `desktop/resources/standalone`
  - from `.next/static` → `desktop/resources/standalone/.next/static`
  - from `public` → `desktop/resources/standalone/public`

- [ ] **Step 1: Add dependencies**

```bash
npm install --save-dev electron electron-builder
```

Pin Electron to a current stable major (document exact version in commit).

- [ ] **Step 2: Implement stage-standalone.mjs**

```js
// desktop/stage-standalone.mjs
import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const standalone = join(root, '.next', 'standalone');
const staticDir = join(root, '.next', 'static');
const publicDir = join(root, 'public');
const out = join(root, 'desktop', 'resources', 'standalone');

if (!existsSync(join(standalone, 'server.js'))) {
  console.error('Missing .next/standalone/server.js — run npm run build first');
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(join(root, 'desktop', 'resources'), { recursive: true });
cpSync(standalone, out, { recursive: true });
cpSync(staticDir, join(out, '.next', 'static'), { recursive: true });
cpSync(publicDir, join(out, 'public'), { recursive: true });
console.log('Staged standalone →', out);
```

- [ ] **Step 3: download-node.mjs**

Download official Node.js binary matching engines (Node 22 LTS) for `process.platform`/`process.arch` into `desktop/resources/node/`, executable bit on unix. Fail with clear message if download fails. Used by `desktop:pack` before electron-builder.

- [ ] **Step 4: electron-builder.yml**

```yaml
appId: org.osiris.desktop
productName: Osiris
directories:
  output: desktop/dist
  buildResources: desktop/build
files:
  - desktop/main.mjs
  - desktop/preload.mjs
  - desktop/lib/**/*
extraResources:
  - from: desktop/resources/standalone
    to: standalone
  - from: desktop/resources/node
    to: node
win:
  target:
    - target: portable
      arch: [x64]
mac:
  target:
    - target: zip
      arch: [x64, arm64]
linux:
  target:
    - target: AppImage
      arch: [x64]
asar: true
```

Main field: set `"main": "desktop/main.mjs"` in package.json for electron-builder, **or** set `electron-builder.yml` `extraMetadata.main`. Prefer package.json:

```json
"main": "desktop/main.mjs",
"scripts": {
  "desktop:dev": "cross-env OSIRIS_DESKTOP_DEV=1 electron .",
  "desktop:stage": "node desktop/stage-standalone.mjs",
  "desktop:node": "node desktop/download-node.mjs",
  "desktop:pack": "npm run build && npm run desktop:stage && npm run desktop:node && electron-builder --config desktop/electron-builder.yml"
}
```

If `cross-env` is undesirable on Windows PowerShell, use a tiny `desktop/dev.mjs` that sets `process.env.OSIRIS_DESKTOP_DEV=1` and spawns electron — **prefer `desktop/dev.mjs`** to avoid cross-env.

```js
// desktop/dev.mjs
import { spawn } from 'node:child_process';
import { join } from 'node:path';
process.env.OSIRIS_DESKTOP_DEV = '1';
const electron = join(import.meta.dirname, '..', 'node_modules', 'electron', 'cli.js');
spawn(process.execPath, [electron, join(import.meta.dirname, '..')], { stdio: 'inherit', env: process.env })
  .on('exit', (c) => process.exit(c ?? 0));
```

Script: `"desktop:dev": "node desktop/dev.mjs"`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json desktop/
git commit -m "feat(desktop): electron-builder config and stage/pack scripts"
```

---

### Task 5: Docs + `.gitignore` for desktop artifacts

**Files:**
- Create: `docs/DESKTOP.md`
- Modify: `.gitignore` — add `desktop/dist/`, `desktop/resources/standalone/`, `desktop/resources/node/`

**Content for DESKTOP.md (required sections):**

1. Prerequisites (Node 22+)
2. Dev: terminal A `npm run dev`; terminal B `npm run desktop:dev`
3. Pack current OS: `npm run desktop:pack` → artifacts in `desktop/dist/`
4. Optional `.env` location: Electron userData `Osiris/.env` (list common keys: `AIS_API_KEY`, `OI_*`, `ETHERSCAN_API_KEY`, `HELIUS_API_KEY`, `SDK_INGEST_KEY` — note features degrade without them)
5. Security note: server listens on 127.0.0.1 only
6. Unsigned macOS / SmartScreen caveats for v1

- [ ] **Step 1: Write docs + gitignore**
- [ ] **Step 2: Commit**

```bash
git add docs/DESKTOP.md .gitignore
git commit -m "docs(desktop): portable app usage and env locations"
```

---

### Task 6: End-to-end verification

**Files:** none required (verification only); fix bugs in prior files if found.

- [ ] **Step 1: Unit tests**

Run: `npx vitest run desktop/lib`

Expected: all pass

- [ ] **Step 2: Dev window**

Run: `npm run dev` + `npm run desktop:dev`

Expected: map UI loads; GROUND toggles work if on that branch

- [ ] **Step 3: Production pack (Windows host)**

Run: `npm run desktop:pack`

Expected: portable exe/zip under `desktop/dist/`; launching it shows Osiris; Task Manager shows child Node; quitting kills child; `http://127.0.0.1:<port>` not bound to `0.0.0.0` (check child env / netstat Local Address 127.0.0.1)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A desktop package.json
git commit -m "fix(desktop): address pack/runtime verification issues"
```

(Skip empty commit if clean.)

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Electron + standalone + loopback | T3 |
| Health wait + error dialog | T3 |
| Single-instance + kill on quit | T3 |
| Portable win/mac/linux targets | T4 |
| `desktop:dev` / `desktop:pack` | T4 |
| userData `.env` | T1, T3 |
| Cache dirs under user cache | T3 `buildChildEnv` |
| contextIsolation / no nodeIntegration | T2 |
| Vercel standalone untouched | T4 (no next.config change) |
| Docs | T5 |
| No auto-update / signing | T4/T5 (omitted) |

## Placeholder scan

None intentional. Node binary download must implement a real URL pattern for Node 22 distro tarballs/zips (nodejs.org).

## Type consistency

- Helpers live under `desktop/lib/*.mjs` (ESM).
- Env injection keys: `HOSTNAME`, `PORT`, `OSIRIS_CCTV_SNAPSHOT`, `OSIRIS_NOMINATIM_CACHE`, `OSIRIS_USER_DATA`.
- Dev flag: `OSIRIS_DESKTOP_DEV=1`.
