# Osiris desktop app (Electron) — design

**Date:** 2026-10-15  
**Status:** Approved (conversation §§1–3)  
**Goal:** Ship Osiris as a self-contained desktop app on Windows, macOS, and Linux via portable builds (no auto-update in v1).

## Context

Osiris is a Next.js 16 app with many `/api/*` routes (CCTV, ground layers, OI, etc.). A desktop product must run that server locally and present it in a native window. The web/Vercel deployment path stays unchanged.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Shape | Full local app (Next runs on-device) |
| Platforms | Windows + macOS + Linux |
| Distribution | Portable artifacts only (no auto-update) |
| Shell | Electron + Next `standalone` + electron-builder |

## §1 Runtime architecture

1. Electron **main** process selects a free TCP port on loopback.
2. Main spawns the packaged Next standalone server: `node server.js` with `HOSTNAME=127.0.0.1` and `PORT=<chosen>`.
3. Main polls `http://127.0.0.1:<port>/api/health` until ready (timeout + clear error dialog on failure).
4. Main opens a `BrowserWindow` pointed at that origin.
5. Window close / app quit kills the Next child process tree.
6. Single-instance lock: a second launch focuses the existing window.
7. UI/feature parity with the web app for v1; no map/layer redesign for desktop.

Optional API keys and feature flags load from a user-editable env file under the OS user data directory (not compiled into the binary). Missing keys behave like the web app without those secrets.

## §2 Build and packaging

### Layout

- `desktop/` (or `electron/`) holds Electron **main** and **preload** only.
- Application source remains the existing Next tree (`src/`, `public/`, etc.).

### Pipeline

1. `next build` with standalone output (already: `output: 'standalone'` when `VERCEL` is unset).
2. Stage into Electron resources:
   - `.next/standalone` (incl. traced `node_modules`)
   - `.next/static` → standalone `/.next/static`
   - `public/` as required by standalone layout
   - Extra traced assets (e.g. onnxruntime wasm via existing `outputFileTracingIncludes`)
3. `electron-builder` portable targets:
   - **Windows:** portable `.exe` and/or zip
   - **macOS:** zip (unsigned OK for v1; Gatekeeper may warn)
   - **Linux:** AppImage

### Scripts

- `desktop:dev` — Electron + `next dev` (or equivalent) for iteration
- `desktop:pack` — production build + portable artifacts

### CI (optional for v1)

GitHub Actions matrix to produce the three OS artifacts. No update feed.

### Non-goals for packaging

Do not alter Vercel’s path: keep `output: process.env.VERCEL ? undefined : 'standalone'`.

## §3 Security, env, and scope

### Security

- Bind Next to **127.0.0.1** only (not `0.0.0.0`).
- Renderer: `contextIsolation: true`, `nodeIntegration: false`.
- Preload stays minimal (no broad Node bridge).

### Env and data dirs

- Load optional secrets from e.g. `%APPDATA%/Osiris/.env` (macOS/Linux: standard Electron `userData` path).
- Document which env vars unlock which features (OI, AIS, chain intel, etc.).
- Writable caches (CCTV snapshot, nominatim, layer cache files) use userData / cache directories, not the install directory.

### Out of scope (v1)

- Auto-update / update server
- Code signing and Apple notarization
- Offline map tile packs
- App Store / Microsoft Store listings
- Pinokio launcher integration
- Rewriting Next API routes into Electron IPC

## Success criteria

- Double-click (or run) portable build opens Osiris in a desktop window without a separate terminal.
- Ground layers, CCTV, and other `/api` routes work against localhost the same as `next start`.
- Quit leaves no orphaned Node/Next process.
- Web/Vercel deploy path still builds.

## Open follow-ups (post-v1)

- Code signing / notarization for Gatekeeper and SmartScreen
- electron-updater or similar
- First-run wizard for optional API keys
