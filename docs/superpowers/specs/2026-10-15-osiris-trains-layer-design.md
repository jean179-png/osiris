# Osiris Trains layer — design

**Date:** 2026-10-15  
**Status:** Approved  
**Goal:** Dedicated GROUND **Trains** layer with live Amtrak (nationwide), SEPTA Regional Rail, and Caltrain vehicles, plus visible rail tracks in the viewport.

## Decisions

| Topic | Choice |
|-------|--------|
| Layer key | `trains` (separate from `gtfs` transit) |
| Vehicles | GTFS-RT VehiclePositions via registry |
| Tracks | Overpass active rail in viewport (min zoom 8); GTFS shapes deferred |
| Soft-fail | Empty FC per agency / Overpass failure |
| Caltrain | Requires `CALTRAIN_511_API_KEY` env; skipped if missing |

## Feeds

| id | name | vehicleUrl | bbox |
|----|------|------------|------|
| amtrak | Amtrak | `https://asm-backend.transitdocs.com/gtfs/amtrak` | continental US |
| septa-rail | SEPTA Regional Rail | `https://www3.septa.org/gtfsrt/septarail-pa-us/Vehicle/rtVehiclePosition.pb` | Philly region |
| caltrain | Caltrain | `https://api.511.org/transit/vehiclepositions?agency=CT` | Bay Area; `api_key` query |

## API

`GET /api/layers/trains?bbox=&z=` → FeatureCollection mixing:

- Point features `kind: 'ground_trains'` (reuse GTFS decode, different kind/attribution)
- LineString features `kind: 'ground_train_tracks'` from Overpass when `z >= 8`

TTL: vehicles 15s; tracks 10m (shared `cachedFc` keys).

## Client

- `GROUND_LAYER_KEYS` += `trains`
- LayerPanel GROUND: **Trains** (Amtrak · SEPTA · Caltrain)
- OsirisMap: source `ground-trains`, circle layer for points, line layer for tracks; poll ~20s like gtfs
