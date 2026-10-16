# Task 2 report: path helper + Electron skeleton

## Commit

- **Branch:** `feat/osiris-desktop`
- **SHA:** `ef252ef6758c7bc70fd9973cda35fe3e4ee8aa4f`
- **Parent:** `ab73018fff07c2acb13add4eee2e27c8ce6c7b94`
- **Message:** `feat(desktop): Electron main/preload skeleton and path helper`
- **Files committed:** 4 (`desktop/lib/paths.mjs`, `desktop/lib/paths.test.mjs`, `desktop/main.mjs`, `desktop/preload.mjs`)

## Implemented

| File | Role |
|------|------|
| `desktop/lib/paths.mjs` | `resolveStandaloneDir(appLike)` — packaged → `resourcesPath/standalone`; dev smoke → `../.next/standalone` |
| `desktop/lib/paths.test.mjs` | Packaged path assertion (plan brief) |
| `desktop/main.mjs` | Single-instance lock, app name `Osiris`, `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, preload; `loadURL` data-URL shell; imports Task 1 helpers for Task 3 wiring (no Next spawn yet) |
| `desktop/preload.mjs` | `contextBridge.exposeInMainWorld('osirisDesktop', { isDesktop: true })` |

## Verification

**Command:** `npx vitest run desktop/lib/paths.test.mjs`

**Result:** **PASS** — 1 file, 1 test

```
 ✓ desktop/lib/paths.test.mjs (1 test)
```

**Electron:** Not installed in this task (runtime-only `electron` import in main/preload). Manual `npx electron desktop/main.mjs` deferred to Task 3+ when deps/scripts land.

## Scope

- Task 3+ **not** started.
- No unrelated dirty files committed (CCTV/curiosities WIP left unstaged).
- Report file lives under `.superpowers/` (untracked); not part of the Task 2 commit.

## Status

| Item | Value |
|------|--------|
| Tests | **PASS** |
| Commit | **ef252ef** |
| Report | `.superpowers/sdd/desktop-task-2-report.md` |
