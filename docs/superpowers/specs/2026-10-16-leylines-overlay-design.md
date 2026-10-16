# Leylines overlay — design

**Date:** 2026-10-16  
**Status:** Implemented  
**Approach:** A — server proxy to maps.leylines.net (CZML → GeoJSON) + LayerPanel mode Watkins | Grid | Both, with attribution

## Goal

Add a **Leylines** map overlay combining:

1. **Watkins-style** classic alignments (allowlisted lines from Leylines Map `api/line/…`).  
2. **Esoteric energy grid** (allowlisted `api/createGrid/…` family — default Gravity Wells basic).

One LayerPanel parent toggle plus a mode control: **Watkins | Grid | Both**. Data is fetched via Osiris API proxies (not vendored wholesale). Attribution is always shown when the layer is on.

## Sources & attribution

- Primary viewer / API host: [Leylines Map](https://maps.leylines.net/) ([leylines.net](https://www.leylines.net/maps/)).  
- Catalog reference: `https://maps.leylines.net/init/leylines-stripped.json`.  
- Watkins allowlist v1: UK leys under “Leys from leyhunters.co.uk” plus notable regional lines (e.g. St. Michael Line, Apollo–St.Michael Axis) as listed in that catalog’s `api/line/leylines/lines/{slug}/…` entries.  
- Grid v1: Gravity Wells basic yellow lines without POIs —  
  `api/createGrid/0.0/0.0/0.0/diamond/gravitywells/basic/lines/off`.  
- User direction: reuse is allowed when **attributed**. UI credit when layer on:  
  `Leylines Map · leylines.net` (and note leyhunters.co.uk for Watkins where applicable).

## UX

- LayerPanel: **Leylines** (default off).  
- Child control (Paleo-style): mode **Watkins | Grid | Both** (default **Both** or **Watkins** — prefer **Both**).  
- Map: gold/amber line paint for Watkins; thinner, lower-opacity cyan/violet for Grid.  
- Click optional in v1 (line name from feature properties if present); not required.  
- Failures: empty geometry, map remains usable.

## Architecture

```
LayerPanel (leylines + mode)
    → OsirisMap visibility + fetch
        → GET /api/layers/leylines/watkins
        → GET /api/layers/leylines/grid?family=gravity-wells
            → maps.leylines.net api/line | api/createGrid (CZML)
            → convert → GeoJSON FeatureCollection (cache ~24h)
```

### Client

- Sources: `leylines-watkins`, `leylines-grid` (GeoJSON).  
- Layers: line layers gated by `activeLayers.leylines` and mode.  
- `LeylinesBar` (or equivalent child under TimeBox/Paleo pattern) for mode + attribution text.

### Server

- Allowlist tables in `src/lib/leylines-catalog.ts` (slugs, grid families, attribution strings).  
- `src/lib/leylines-czml.ts`: extract polylines/cartographic positions from CZML → LineString features.  
- Routes return GeoJSON; short HTTP cache; upstream errors → empty FC or `{ error }` without throwing to the client UI.

## Verification

- Toggle Leylines → Both: Watkins + Grid lines appear; attribution visible.  
- Mode Watkins-only / Grid-only hides the other.  
- With layer off, no requests (or cancelled).  
- Vitest: CZML parse, mode clamp, allowlist; route test with mocked upstream.  
- Offline upstream: empty overlay, no crash.

## Non-goals (v1)

- Full 580-item Leylines Map catalog  
- Bulk POI dumps  
- Shipping harvested static GeoJSON in-repo  
- Meter-scale Hartmann/Curry grids  
- Iframe embed of maps.leylines.net  
