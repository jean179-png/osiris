# Task 3 report: Spawn Next, health wait, wire window + lifecycle

## Commit

- **Branch:** `feat/osiris-desktop`
- **SHA:** `2aa35101f040fb89cf23b5074050acdc9b9b33c4`
- **Parent:** `ef252ef6758c7bc70fd9973cda35fe3e4ee8aa4f`
- **Message:** `feat(desktop): spawn Next standalone and bind BrowserWindow`
- **Files committed:** 3 (`desktop/lib/spawn-next.mjs`, `desktop/lib/spawn-next.test.mjs`, `desktop/main.mjs`)

## Implemented

| File | Role |
|------|------|
| `desktop/lib/spawn-next.mjs` | `buildChildEnv` forces `HOSTNAME`/`PORT`, injects cache + `OSIRIS_USER_DATA`; `startNextServer` spawns `node server.js` with piped stdio |
| `desktop/lib/spawn-next.test.mjs` | Unit test: loopback host/port override + cache path injection |
| `desktop/main.mjs` | Production boot: free port → loadDesktopEnv → mkdir cache → spawn → waitForHealth → `loadURL(http://127.0.0.1:port)`; `OSIRIS_DESKTOP_DEV=1` skips spawn and loads `OSIRIS_DEV_URL` or `http://127.0.0.1:3000`; kill child on quit (Windows `taskkill /T /F`); error dialog + quit on failure |

## Verification

**Command:** `npx vitest run desktop/lib/spawn-next.test.mjs`

**Result:** **PASS** — 1 file, 1 test

```
 ✓ desktop/lib/spawn-next.test.mjs (1 test)
```

**HOSTNAME:** Forced to `127.0.0.1` via `buildChildEnv` / `LOOPBACK` in main.

**Electron manual smoke:** Deferred — Electron not installed yet (Task 4). `OSIRIS_DESKTOP_DEV=1` path is wired for when deps land.

## Scope

- Task 4+ **not** started (no `npm install electron` / electron-builder).
- Only `desktop/` files committed; unrelated CCTV/curiosities WIP left unstaged.
- Report lives under `.superpowers/` (untracked); not part of the Task 3 commit.

## Status

| Item | Value |
|------|--------|
| Tests | **PASS** |
| Commit | **2aa3510** (`2aa35101f040fb89cf23b5074050acdc9b9b33c4`) |
| Report | `.superpowers/sdd/desktop-task-3-report.md` |
