# GPS Jam layer — design

**Date:** 2026-10-16  
**Status:** Implemented  
**Approach:** Server GeoJSON proxy from gpsjam.org H3 CSV; yellow/red hex fills; date bar like Rain/Wind

## Goal

LayerPanel **GPS Jam** shows likely GPS/GNSS interference zones derived from aircraft-reported navigation accuracy (gpsjam.org / ADS-B), as H3 res-4 hex polygons on the Osiris map.

## Entry

- Key: `gps_jam` — main toggle  
- Child: `gps_jam_controls` — Time Controls (on by default with parent, Rain/Wind pattern)  
- **Off by default**  
- Placement: near Aviation / flights (interference is ADS-B–derived)

## Data

- Source: [gpsjam.org](https://gpsjam.org/) daily CSV — no API key  
- Manifest: `https://gpsjam.org/data/manifest.csv` (latest date = last row)  
- Day file: `https://gpsjam.org/data/{YYYY-MM-DD}-h3_4.csv`  
  Columns: `hex`, `count_good_aircraft`, `count_bad_aircraft`  
- Metric (gpsjam FAQ): percent bad with small-sample bias; **medium** ≈ 2–10%, **high** > 10%  
- Osiris proxy: `GET /api/layers/gps-jam?date=YYYY-MM-DD`  
  - Omit `date` → resolve latest complete day from manifest  
  - Filter: **medium + high only** (skip low/green); skip low-sample hexes (min ~3 aircraft)  
  - Convert H3 indexes → polygon rings (`h3-js`) → GeoJSON FeatureCollection  
  - Properties: `h3`, `level`, `pct`, `good`, `bad`, `total`, `date`  
- Server cache: ~1 hour per date  
- Attribution: gpsjam.org / ADS-B Exchange (and airplanes.live as noted by gpsjam)

## Controls

- Bottom **GpsJamBar** when `gps_jam` is on and `gps_jam_controls` is on  
- Prev / next day within manifest range, date readout, jump to latest  
- No play loop (daily cadence only)  
- Changing date re-fetches `/api/layers/gps-jam?date=…` and replaces the map source

## Render

- MapLibre `geojson` source + `fill` (+ light `line` outline)  
- Colors: yellow (medium), red (high); semi-transparent on dark basemap  
- Click popup: date, level, % bad, good/bad counts, hex id  
- Hide/clear when layer off

## Non-goals (v1)

- Drawing low/green hexes  
- Sub-daily or live streaming updates  
- Wingbits (or other paid) GPS APIs  
- 3D extrusion / heatmap-only mode  
- Historical animation scrub across many days at once

## Verification

- Toggle on: yellow/red hexes appear globally where gpsjam reports medium/high  
- Controls on: date bar changes day and refreshes hexes; jump-to-latest works  
- Controls off: latest (or last chosen) day still shows; no bar  
- Toggle off: hexes gone  
- API/upstream failure: quiet empty layer, map stays usable  
- Attribution visible in map credits or popup
