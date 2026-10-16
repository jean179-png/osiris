# Desktop Task 3 review: Spawn Next, health wait, wire window + lifecycle

**Scope:** `ef252ef` → `2aa3510` (`feat(desktop): spawn Next standalone and bind BrowserWindow`)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None. Brief files present: `desktop/lib/spawn-next.mjs`, `desktop/lib/spawn-next.test.mjs`, `desktop/main.mjs` wired. |
| **Extra** | Child stdout logging and early-exit `failAndQuit` handlers — reasonable operational hardening, not out of scope. |
| **Misunderstood** | None. Env merge, spawn with real Node binary, health wait, loadURL, quit kill, and `OSIRIS_DESKTOP_DEV` skip match the brief. |

**Critical checks**

| Constraint | Status |
|------------|--------|
| `HOSTNAME` forced to `127.0.0.1` | **Pass** — `LOOPBACK` in main; `buildChildEnv` sets `HOSTNAME: host` / `PORT: String(port)` after spreading base + desktop env (overrides `0.0.0.0`). Unit test asserts override. |
| Child killed on quit | **Pass** — `killNextChild` on `before-quit`, `will-quit`, and `window-all-closed`. Unix: `SIGTERM` then `SIGKILL` after 2s. Windows: `taskkill /pid /T /F` with `child.kill()` fallback. |
| `OSIRIS_DESKTOP_DEV` skip path | **Pass** — when `=== '1'`, `bootDevShell` skips spawn/health and `loadURL`s `OSIRIS_DEV_URL` or `http://127.0.0.1:3000`. |
| `waitForHealth` before `loadURL` | **Pass** — production awaits `waitForHealth(http://127.0.0.1:${port}/api/health)` then `createMainWindow(appUrl)`. |
| Error dialog on failure | **Pass** — `failAndQuit` uses `dialog.showErrorBox`, kills child, `app.quit()`; wired from boot `catch`, child `error`, and early child `exit`. |

**Brief steps**

- Step 1/2: `buildChildEnv` / `startNextServer` match samples; main resolves packaged vs `OSIRIS_NODE`/`node`, free port → env → mkdir cache → spawn → health → window; lifecycle kill + error dialog present.
- Step 3: Re-ran `npx vitest run desktop/lib/spawn-next.test.mjs` at HEAD — **1 file, 1 test, PASS**.
- Step 4: Manual Electron smoke deferred (Electron deps Task 4); skip path is implemented for when deps land.
- Step 5: Commit message and parent SHA match the brief/report; only the three `desktop/` files in range.

## 2. Code quality: Approved with minor

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None. Loopback binding, health-before-load, quit teardown, and failure dialog are correct. |
| **Minor** | Default `nodeBinary = process.execPath` in `startNextServer` is unsafe if a future caller omits it (main always passes a real Node path — brief-identical). Electron manual smoke not run yet (honest in report; deps deferred to Task 4). |

## 3. Brief strengths

- Clear production vs `OSIRIS_DESKTOP_DEV` boot split.
- HOSTNAME/PORT forced after env merge so desktop `.env` cannot re-open bind to `0.0.0.0`.
- Quit path covers Windows process trees via `taskkill /T`.

## Verdict

**Ship for Desktop Task 3.** Spec met; all five critical lifecycle constraints verified; quality is plan-faithful with only default-execPath and deferred Electron smoke nits.
