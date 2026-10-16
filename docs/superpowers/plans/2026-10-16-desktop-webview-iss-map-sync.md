# Desktop webview news + ISS map sync — Implementation Plan

> **For agentic workers:** implement task-by-task; commit after each green task.

**Goal:** Play embed-blocked news in Electron webview; SpaceCam MAP SYNC follows ISS nadir view without canceling on zoom.

**Tech:** Electron webviewTag, MapLibre easeTo, existing satellites feed / orbit helpers.

## File map

- `desktop/main.mjs` — `webviewTag: true`
- `src/app/page.tsx` — webview overlay; wire ISS sync state/camera restore
- `src/components/SpaceCam.tsx` — MAP SYNC toggle; `onMapSyncChange`
- `src/components/OsirisMap.tsx` — `issFollow` prop: recenter/pitch/bearing, preserve zoom
- `src/lib/iss-follow.ts` (+ test) — bearing from consecutive ISS positions
- `src/types/desktop.d.ts` — `window.osirisDesktop`

## Task 1: ISS follow helpers + test

Bearing from prev→curr lat/lng; default pitch 75.

## Task 2: Electron webview + live feed overlay

## Task 3: SpaceCam toggle + OsirisMap issFollow (zoom-safe)

## Task 4: Commit + push
