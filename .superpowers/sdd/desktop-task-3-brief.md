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
