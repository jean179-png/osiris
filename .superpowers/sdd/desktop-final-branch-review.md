# Final branch review — Osiris desktop Electron

**Repo:** `C:\pinokio\api\osiris`  
**Branch:** `feat/osiris-desktop`  
**Base:** `6cd4db1e228f57d892c457ce74fb4880f0ef0757`  
**HEAD:** `fa8edb98d8ac6f96231cd8c3f920c59b2fb25ab3`  
**Commits:** `6cd4db1..HEAD` (6 commits, Tasks 1–6)  
**Date:** 2026-10-15  
**Spec:** `docs/superpowers/specs/2026-10-15-osiris-desktop-electron-design.md`  
**Plan:** `docs/superpowers/plans/2026-10-15-osiris-desktop-electron.md`

## Verdict

**Ship: ✅**  
**Blocking issues: none**

Committed desktop work matches the approved design: loopback Next standalone under Electron, portable pack pipeline, hardened renderer prefs, userData env/caches, docs, and Windows pack smoke. Per-task reviews (T1–T5) are Spec ✅ / Quality Approved with minor; Task 6 E2E reported complete.

## Scope checked

| Area | Result |
|------|--------|
| Spec / plan / SDD progress | Design success criteria covered; Tasks 1–6 complete in `desktop-progress.md`; T1–T5 reviews Ship; T6 Windows pack + health |
| `git log base..HEAD` | helpers → vitest include → skeleton → spawn/lifecycle → pack scripts → docs |
| Diff vs base | **21 files**, desktop-only (+ `package.json` / lock / vitest / `.gitignore` / `docs/DESKTOP.md`); **no** `next.config` change |
| `desktop/main.mjs` | Port → userData env → cache mkdir → spawn Node → health → window; kill on quit; single-instance; DEV skip |
| Pack config | `electron-builder.yml` portable win/mac/linux + `extraResources` standalone/node; scripts `desktop:dev/stage/node/pack` |
| Unit tests | `npx vitest run desktop/lib` PASS (see note on staged duplicates) |

## Commit map

| SHA | Message | Task |
|-----|---------|------|
| `e614d8e` | feat(desktop): port, health, and env helpers | T1 |
| `ab73018` | chore(desktop): include desktop Vitest tests in config | T1 follow-up |
| `ef252ef` | feat(desktop): Electron main/preload skeleton and path helper | T2 |
| `2aa3510` | feat(desktop): spawn Next standalone and bind BrowserWindow | T3 |
| `6a043c5` | feat(desktop): electron-builder config and stage/pack scripts | T4 |
| `fa8edb9` | docs(desktop): portable app usage and env locations | T5 |

Task 6: verification only (no fix commit; clean after pack smoke).

## Spec coverage

| Spec / plan item | Status |
|------------------|--------|
| Free loopback port + spawn `node server.js` with `HOSTNAME=127.0.0.1` | ✅ `main.mjs` + `buildChildEnv` (overrides `0.0.0.0`) |
| Health poll `/api/health` + error dialog | ✅ `waitForHealth` then window; `failAndQuit` |
| Kill Next child on quit (incl. Windows tree) | ✅ `taskkill /T /F` / SIGTERM→SIGKILL |
| Single-instance lock | ✅ `requestSingleInstanceLock` + focus |
| `contextIsolation: true`, `nodeIntegration: false`, minimal preload | ✅ |
| userData `.env` (not baked in) | ✅ `loadDesktopEnv` |
| Writable caches under userData | ✅ CCTV + nominatim paths via `buildChildEnv`; layer cache is in-memory |
| Portable win / mac zip / linux AppImage | ✅ `electron-builder.yml` |
| `desktop:dev` / `desktop:pack` | ✅ |
| Vercel `output` untouched | ✅ empty diff for `next.config.ts`; still `VERCEL ? undefined : 'standalone'` |
| Docs + gitignore artifacts | ✅ `docs/DESKTOP.md`; ignore dist/standalone/node |
| No auto-update / signing (v1) | ✅ omitted by design |
| Unrelated CCTV/curiosities not in commits | ✅ branch file list desktop-scoped |

## Spot-check: `desktop/main.mjs`

- Production boot: `findFreePort(127.0.0.1)` → `loadDesktopEnv` → `cache` under userData → `startNextServer` with packaged `resources/node` or `OSIRIS_NODE`/`node` → health → `loadURL`.
- Dev: `OSIRIS_DESKTOP_DEV=1` skips spawn; loads `OSIRIS_DEV_URL` or `:3000`.
- Lifecycle: `before-quit` / `will-quit` / `window-all-closed` set `quitting` and kill child; darwin activate recreates window when URL known.
- Security prefs and single-instance match design §1 / §3.

## Spot-check: pack config

- `package.json` `"main": "desktop/main.mjs"`; `desktop:pack` = build → stage → download-node → electron-builder.
- `electron-builder.yml`: asar app shell; `extraResources` for `standalone` + `node`; portable/zip/AppImage targets as planned.
- `stage-standalone.mjs`: requires `server.js`; copies standalone + `.next/static` + `public`.
- Artifact present from Task 6: `desktop/dist/Osiris 0.1.0.exe` (~234 MB) + `win-unpacked/`; health observed on `127.0.0.1:49871`.

## Per-task review rollup

| Task | Spec | Quality | Blocking carry-forward |
|------|------|---------|------------------------|
| T1 helpers | ✅ | Approved w/ minor | none |
| T2 skeleton | ✅ | Approved w/ minor | none |
| T3 spawn/lifecycle | ✅ | Approved w/ minor | none |
| T4 pack | ✅ | Approved w/ minor | none |
| T5 docs | ✅ | Approved w/ minor | none |
| T6 E2E | complete (Windows) | — | none |

## Non-blocking (follow-ups)

1. Plan markdown checkboxes remain unchecked (process debt only).
2. macOS/Linux portable packs not smoke-run on this Windows host (targets configured).
3. Turbopack standalone staging may nest `desktop/` under `resources/standalone` (size bloat; Task 6 noted app still boots). Local staged tree also duplicates Vitest discovery under `desktop/resources/standalone/**` — exclude in vitest or clean stage before `desktop:lib` runs.
4. electron-builder warnings: missing `author`/`description`, default Electron icon.
5. Working tree has **unrelated uncommitted** CCTV/curiosities WIP — keep out of this branch’s merge; not part of `base..HEAD`.
6. Minor coverage nits from task reviews (env quote-stripping untested; stage does not preflight `.next/static`/`public`).

## Test evidence

```
npx vitest run desktop/lib
→ PASS (helpers + any staged copies if present)

Task 6 report:
- desktop:dev smoke OK
- desktop:pack exit 0 → Osiris 0.1.0.exe
- packaged /api/health 200 on 127.0.0.1:<ephemeral>
```
