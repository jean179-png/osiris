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
