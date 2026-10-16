# Animated wind layer (nullschool-style) — design

**Date:** 2026-10-16  
**Status:** Implemented  
**Approach:** Custom particle canvas + Open-Meteo UV grid; surface first, product hooks for later

## Goal

A LayerPanel **Wind** toggle that draws earth.nullschool-style animated wind particles over the Osiris MapLibre map (mercator and globe), using live model wind at 10 m for v1.

## Entry

- LayerPanel key: `wind` (FIELD / weather group)
- **Off by default**
- On → fetch UV field + start particle loop; Off → cancel rAF, hide/destroy canvas

## Data

- Osiris API proxies Open-Meteo (no client key required for public API usage)
- Product query: `product=surface` (10 m wind) in v1
- Response: compact global (or near-global) UV grid at coarse resolution (~0.5–1°)
- Server cache: 30–60 minutes
- Future products reuse the same response shape: `{ product, width, height, west, south, east, north, u[], v[], unit, validTime, attribution }`

## Render

- Full-viewport canvas overlay (`pointer-events: none`), sized to the map container
- Particles advected with bilinear sampling of the UV field
- Color by wind speed (cool → warm ramp, nullschool-like)
- Each frame: sample field in geographic space, project with `map.project` (supports globe)
- Pause when `document.hidden` or layer off
- Particle count scales with viewport area; hard cap for performance

## Product hooks (v1 types only)

- Type/registry for `WindProductId = 'surface' | …` (later: `850hPa`, `500hPa`, ocean currents, etc.)
- No product-picker UI in v1 beyond the single Wind toggle

## Attribution

- Map/layer credit: Open-Meteo + underlying model (e.g. GFS)

## Non-goals (v1)

- Forecast time scrubber / multi-hour animation
- Temperature, humidity, or other scalar overlays
- Third-party GPL wind libraries or embedding nullschool
- Perfect coastal masking

## Verification

- Toggle on: particles flow; color varies with speed
- Toggle off: animation stops; no leftover overlay
- Works in MAP and SAT; mercator and globe
- Hidden tab: animation paused
- API miss / empty: layer stays quiet without crashing the map
