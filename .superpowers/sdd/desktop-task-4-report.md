# Task 4 report: Electron deps, stage/pack scripts, builder config

## Commit

- **Branch:** `feat/osiris-desktop`
- **SHA:** `6a043c5a5d6b149390aeda0c2bc92ba39ec31e95`
- **Parent:** `2aa35101f040fb89cf23b5074050acdc9b9b33c4` (BASE_SHA)
- **Message:** `feat(desktop): electron-builder config and stage/pack scripts`
- **Pinned deps:** `electron@44.7.2`, `electron-builder@26.15.3`
- **Files committed (6):**
  - `package.json` (`main`, desktop scripts)
  - `package-lock.json`
  - `desktop/dev.mjs`
  - `desktop/download-node.mjs`
  - `desktop/electron-builder.yml`
  - `desktop/stage-standalone.mjs`

## Implemented

| File | Role |
|------|------|
| `package.json` | `"main": "desktop/main.mjs"`; `desktop:dev` / `desktop:stage` / `desktop:node` / `desktop:pack` |
| `desktop/dev.mjs` | Sets `OSIRIS_DESKTOP_DEV=1` and spawns Electron (no cross-env) |
| `desktop/stage-standalone.mjs` | Copies `.next/standalone` + static + public → `desktop/resources/standalone` |
| `desktop/download-node.mjs` | Fetches Node **22.20.0** (override via `NODE_VERSION`) into `desktop/resources/node/` |
| `desktop/electron-builder.yml` | Portable win x64 / mac zip / linux AppImage; extraResources for standalone + node |

## Verification

### 1. Stage without build (expected fail)

**Command:** `npm run desktop:stage`

**Result:** exit **1**

```
Missing .next/standalone/server.js — run npm run build first
```

### 2. Download Node for win32

**Command:** `npm run desktop:node`

**Result:** exit **0**

```
Fetching Node 22.20.0 for win32/x64
URL: https://nodejs.org/dist/v22.20.0/node-v22.20.0-win-x64.zip
Node binary staged → ...\desktop\resources\node\node.exe
```

**Binary check:** `desktop/resources/node/node.exe -v` → `v22.20.0`

### 3. Skipped

- Full `npm run desktop:pack` (slow Next build) — not run per task brief.

### 4. Untouched

- `next.config.ts` / Vercel standalone logic — **not modified**
- Task 5+ (docs/gitignore) — **not started**
- Unrelated CCTV/curiosities WIP — left unstaged
- `desktop/resources/node/` download artifact — **not committed** (Task 5 will gitignore)

## Status

| Item | Value |
|------|--------|
| Stage fail-clear | **PASS** |
| download-node win32 | **PASS** (`v22.20.0`) |
| desktop:pack | **SKIPPED** (intentional) |
| Commit | **6a043c5** (`6a043c5a5d6b149390aeda0c2bc92ba39ec31e95`) |
| Report | `.superpowers/sdd/desktop-task-4-report.md` |
