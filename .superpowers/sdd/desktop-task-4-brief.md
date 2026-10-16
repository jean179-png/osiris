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
