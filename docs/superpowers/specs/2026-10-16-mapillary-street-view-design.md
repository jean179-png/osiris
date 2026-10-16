# Mapillary Street View (in-app) — design

**Date:** 2026-10-16  
**Status:** Implemented (inline; SDD subagents unavailable)  
**Provider:** Mapillary (in-app). Google Street View = external fallback link only.

## Goal

Let the operator peek street-level imagery at a map point via Mapillary, with snap constrained so the drop location is roughly **in view** from the chosen image.

## Entry points

1. **Right-click** the map → “Street view here” (look-at = click coords).
2. **LayerPanel** toggle **Street View** (pegman mode):
   - Off by default.
   - When on: show Mapillary coverage dots (zoom-aware density).
   - Click map (or drag/drop pegman) sets look-at point `P` and opens the viewer.

Both entry points share one floating viewer flow.

## In-view snap

Look-at target = `P` (lng/lat).

1. Query Mapillary images near `P` (search bbox ~150 m radius).
2. Keep candidates where:
   - `distance(image, P) ≤ 100 m`
   - absolute angular error between image `computed_compass_angle` (or equivalent) and `bearing(image → P) ≤ 55°`
3. Rank by distance, then angular error; pick best.
4. If none qualify → empty state in the panel + **Open Google Street View** (external browser at `P`).

No building-occlusion / true 3D visibility in v1.

## Viewer UI

- `FloatingWindow` hosting **MapillaryJS** for the selected image id.
- When possible, initialize viewer yaw so the look direction faces `P`.
- Map marker at `P`; optional thin line from image position → `P`.
- Attribution: Mapillary / contributors (and Google only on the fallback link).

## Coverage overlay

- Source: Mapillary image points or vector tiles via server proxy.
- Visible only while Street View layer is on.
- Subtle dots; denser at higher zoom; no popup required for every dot (click uses snap pipeline).

## API / secrets

- `MAPILLARY_ACCESS_TOKEN` server-side only (`.env` / `.env.example`).
- Client calls Osiris routes, e.g.:
  - `GET /api/mapillary/nearest?lng=&lat=` → best in-view image + pose, or `{ ok: false }`
  - Coverage fetch as needed for the layer (bbox + z)
- Never send the Mapillary token to the browser.

## Non-goals (v1)

- Google Street View embedded / billed in-app viewer
- Offline imagery cache
- Multi-image sequence tour UI beyond MapillaryJS defaults
- True occlusion (buildings, terrain)

## Verification

- Covered street: right-click / pegman opens panel with image facing roughly toward pin
- Image behind user or too far: rejected; empty + Google link
- Layer off: no coverage dots; right-click still works
- Token missing: graceful empty / config error, no client leak
