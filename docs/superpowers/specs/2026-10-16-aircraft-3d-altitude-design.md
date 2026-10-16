# Aircraft relative altitude (3D elevation)

**Date:** 2026-10-16  
**Status:** Approved  
**Approach:** B — MapLibre symbol layers + GeoJSON stems, zoom/pitch-aware exaggeration

## Goal

Show aircraft at a true elevated position above the map (not flat icons), with relative height readable when the camera is pitched in. Stems appear only when they help.

## Context

- Flight feeds already expose `alt` in metres (baro) via `/api/flights`.
- `flightsToGeoJsonFeatures` already puts `alt` on feature properties; geometry is still `[lng, lat]` only.
- Icons are MapLibre `symbol` layers (`fl-commercial`, `fl-private`, `fl-jets`, `fl-military`).
- Satellites use a separate custom WebGL layer with compressed space altitudes; aircraft stay in the atmospheric band and must not reuse satellite elevation maths.

## Behaviour

1. **Elevated icons**  
   Each airborne feature is drawn at a display height derived from `alt`. Exaggeration is **zoom- and pitch-aware**: near-nadir / world zoom stays flatter; pitched-in regional views lift more so cruise vs low altitude separates.

2. **Stems**  
   A `flight-stems` (or per-source) line layer draws ground → icon for airborne craft. Visible only when pitch and zoom make height readable (thresholds tuned in implementation; hide when flat or too zoomed out).

3. **Grounded / unknown**  
   `grounded`, missing, or near-zero `alt` stay on the surface; no stem.

4. **Categories**  
   Applies to all flight layers that use `flightsToGeoJsonFeatures` (commercial, private, jets, military), including helicopters.

5. **Interaction**  
   Existing click popups, watch buttons, and heading icons stay. Hit-testing must still resolve the aircraft (prefer querying elevated symbols or the same feature id).

## Non-goals

- Literal 1:1 metre scale at globe zoom (unreadable next to Earth).
- Custom WebGL flight renderer (satellite-style).
- Changing ADS-B classification or decimation rules.

## Data / helpers

- Extend GeoJSON build so coordinates carry display elevation (or MapLibre elevation paint equivalent on MapLibre 6.7).
- Pure helper(s) e.g. `flightDisplayElevation(altM, { zoom, pitch })` + `flightStemsVisible(zoom, pitch)` with unit tests.
- Stem GeoJSON: LineString from `[lng, lat, 0]` to `[lng, lat, displayElev]`.

## Testing

- Unit tests for exaggeration (higher alt → higher display elev; grounded → 0; pitch/zoom gates).
- Smoke: flights layer on, pitch up, stems appear; pitch flat, stems hide.

## Implementation order

This spec ships before SAT borders.
