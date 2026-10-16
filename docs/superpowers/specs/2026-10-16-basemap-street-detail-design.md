# Basemap street detail at lower zooms

**Date:** 2026-10-16  
**Status:** Implemented  
**Scope:** CARTO Dark Matter local style snapshot used by Osiris map view

## Problem

At metro and city zooms, the map feels sparse: secondary/tertiary roads and local streets appear later than useful for orientation while exploring ground layers (transit, rail, trails, incidents).

## Decision

**Approach A:** Edit `public/dark-matter-style.json` road / tunnel / bridge / roadname `minzoom` values so arterial and local streets (and their labels) appear ~1–2 zoom levels earlier. Do not change tile sources or swap basemaps.

## Zoom targets

| Class | Line layers (today → proposed) | Label layers (today → proposed) |
| --- | --- | --- |
| Secondary / tertiary | z11–13 → z9–11 | z15 → z13 |
| Minor | z13–15 → z11–13 | z16 → z14 |
| Service | z15 → z13–14 | with minor → z14 |
| Path / track | z15 → z14 (later than minor) | n/a |
| Primary | fill z10 → z8 (case already early) | z14 → z12 |
| Motorway / trunk | unchanged (already early) | z13 → z12 |

Tunnel and bridge mates of each class receive the same `minzoom` shift so underpasses and overpasses stay visually consistent with surface roads.

## Non-goals

- No new basemap provider or style swap
- No runtime `setLayerZoomRange` patching in `OsirisMap`
- No change to ground overlay layers (GTFS, rail, trails, etc.)
- No intentional thickening of line widths (detail via earlier visibility only)

## Risks

- Mid-zoom views draw more line features (slightly denser GPU work)
- Vector tiles may omit some minor geometries at very low zooms; layers that appear earlier still depend on tile content

## Verification

- Dark map at ~z9–11: secondary/tertiary corridors visible
- Same map at ~z11–13: minor street grid visible; service slightly later
- Labels readable without clutter overload at those zooms
- Motorway/trunk appearance unchanged vs current style at z5–8
