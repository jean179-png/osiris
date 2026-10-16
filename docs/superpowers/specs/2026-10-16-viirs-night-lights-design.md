# VIIRS Night Lights — design

**Date:** 2026-10-16  
**Status:** Implemented  
**Approach:** NASA GIBS WMTS raster in MapLibre; Black Marble composite for v1; daily product hook later

## Goal

LayerPanel **Night Lights** shows VIIRS nighttime lights over the Osiris map: annual Black Marble composite by default, with a typed hook for a future daily DNB mode.

## Entry

- Key: `night_lights`
- Label: Night Lights
- **Off by default**
- Placement: near Live Clouds / DISPLAY

## Data / tiles

- Source: NASA GIBS Web Mercator WMTS
- v1 product **`composite`**: `VIIRS_Black_Marble` (GoogleMapsCompatible_Level8)
- Osiris proxies tiles: `/api/tiles/gibs/{product}/{z}/{x}/{y}` → upstream GIBS URL (CORS + short cache)
- No API key required

## Render

- MapLibre `raster` source + layer when toggle is on
- Opacity ~0.75–0.9 on dark basemap; still readable on SAT
- `maxzoom` 8 (GIBS matrix set)
- Remove/hide layer when toggled off

## Product hooks

- `NightLightsProduct = 'composite' | 'daily'`
- v1 UI: single toggle (always `composite`)
- Later: daily GIBS DNB (or equivalent) + date param (default yesterday UTC)

## Attribution

- NASA GIBS / ESDIS — Black Marble / VIIRS DNB

## Non-goals (v1)

- Date scrubber or daily product UI
- Full GIBS layer catalog
- Bundling tile archives in the portable build

## Verification

- Toggle on: city lights mosaic visible globally at z0–8
- Toggle off: layer gone
- Works in MAP and SAT
- Proxy miss returns non-crashing empty/error tiles
