# Task 3 Report: Public access OSM + BLM lib (TDD)

## Status

**DONE**

## Summary

Added `src/lib/layers/public-access.ts` and `public-access.test.ts`. OSM v1 queries ways only with `out geom` and maps closed ways to polygons. BLM uses the cached BLM-only SMA layer 2 envelope query (`f=geojson`, `resultRecordCount=2000`). `fetchPublicAccess` soft-fails each source and merges them, capped at 4000 features. BLM is requested only when the bbox intersects the rough US box.

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/layers/public-access.ts` | OSM QL/mapper, BLM URL/mapper, fetch, merge |
| `src/lib/layers/public-access.test.ts` | Vitest coverage for QL, polygons, URL, BLM mapping, caps, soft-fail |

## Public API

- `PUBLIC_ACCESS_MIN_ZOOM = 7`
- `publicAccessOsmQl(bbox)` — ways only: `leisure=park|nature_reserve`, `boundary=protected_area`, `access=yes` + `leisure`; `out geom`
- `mapPublicAccessOsmToFc(data)` — closed ways to `Polygon`; cap 2000
- `buildBlmSmaUrl(bbox)` — ArcGIS envelope, `f=geojson`, `outFields=*`, `outSR=4326`, `resultRecordCount=2000`
- `mapBlmSmaGeoJsonToFc(gj)` — `Polygon` / `MultiPolygon` only; cap 2000
- `fetchPublicAccess(bbox, zoom, fetchImpl?)` — zoom gate, `Promise.all` OSM + BLM, soft-fail per source
- `mergePublicAccessFc(parts)` — concatenate, cap 4000

Feature properties: `kind: 'ground_public_access'`, `subkind` (`park` | `protected` | `open_access` | `blm` | `federal` | `other`), `name`, `agency`, `attribution` (`OpenStreetMap` or `BLM`). OSM also sets `osmId`. `federal` is in the union for later agency expansion and is not emitted in v1.

OSM subkind: `boundary=protected_area` or `leisure=nature_reserve` → `protected`; `leisure=park` → `park`; other `access=yes` leisure → `open_access`. Skips `access=private|no`, `military=*`, and `landuse=military`. Skips unclosed ways and relations.

## BLM endpoint check

Primary URL (not a 404):

`https://gis.blm.gov/natl/rest/services/lands/BLM_Natl_SMA_Cached_BLM_Only/MapServer/2/query`

| Check | Result |
|-------|--------|
| MapServer metadata | HTTP 200. Layer 2 is "Bureau of Land Management (BLM)", polygon, `capabilities` include Query, `maxRecordCount` 2000. Field used for name: `ADMIN_UNIT_NAME`. |
| Envelope + `f=geojson` via `URLSearchParams` | HTTP 200 `FeatureCollection` with `MultiPolygon` |
| Pre-encoded geometry in a raw curl | HTTP 200 body `{"error":{"code":400,"message":"Failed to execute query."}}`. That was a bad query string, not a missing service. |

Alternate not used. If this cached layer later 404s, BLM polygons are layer 7 on `BLM_Natl_SMA_LimitedScale` (`.../MapServer/7/query`).

## TDD Evidence

### RED (Step 2) — module missing

**Command:**

```text
npx vitest run src/lib/layers/public-access.test.ts
```

**Working directory:** `C:\pinokio\api\osiris`

**Output:**

```text
 RUN  v2.1.9 C:/pinokio/api/osiris

 ❯ src/lib/layers/public-access.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/lib/layers/public-access.test.ts [ src/lib/layers/public-access.test.ts ]
Error: Failed to load url ./public-access (resolved id: ./public-access) in C:/pinokio/api/osiris/src/lib/layers/public-access.test.ts. Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

**Exit code:** 1

Failure reason: `./public-access` did not exist yet. Tests had not been collected.

### GREEN (Step 4)

**Command:**

```text
npx vitest run src/lib/layers/public-access.test.ts
```

**Output:**

```text
 RUN  v2.1.9 C:/pinokio/api/osiris

 ✓ src/lib/layers/public-access.test.ts (15 tests) 16ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
```

**Exit code:** 0

**ESLint:** `npx eslint src/lib/layers/public-access.ts src/lib/layers/public-access.test.ts` — exit 0, no findings.

## Commit

- **SHA:** `5470bf8` (`5470bf88cbe368adbf5b699ae902752250a86b77`)
- **Subject:** `feat(layers): public access OSM + BLM mappers`
- **Branch:** `feat/osiris-desktop`
- **Files:** `src/lib/layers/public-access.ts`, `src/lib/layers/public-access.test.ts` only

## Self-Review

### Alignment with brief

- Ways-only QL + `out geom` (relations left out on purpose).
- Closed-way polygon mapper; private / no / military skipped.
- BLM URL contains `geometryType=esriGeometryEnvelope` and `f=geojson`.
- BLM features use `subkind: 'blm'`, name from `ADMIN_UNIT_NAME` or `Name`, `agency: 'BLM'`, `attribution: 'BLM'`.
- Zoom below 7 returns an empty FeatureCollection and does not call Overpass or BLM.
- OSM and BLM run together. Each failure becomes an empty collection. Merge cap is 4000. Mapper caps are 2000 each (plan global constraint).
- Optional `fetchImpl` matches `fetchMunicipalEndpoint` so tests do not hit the network.

### Alignment with sibling layers

- OSM side follows `trails.ts` / `freight-rail.ts`: `fillBbox`, mocked `overpassQuery`, `featureOf`, `emptyFc`, `capFeatures`.
- BLM URL follows `buildArcgisUrl` in `municipal.ts` (envelope JSON, `esriGeometryEnvelope`, `inSR`, `spatialRel`, `outSR`), with `f=geojson` and `resultRecordCount=2000`.

## Concerns

- v1 drops multipolygon relations, so some large parks and protected areas that exist only as relations will not appear.
- The rough US gate is an intersection with west -180, east -50, south 15, north 72. That includes southern Canada and northern Mexico, and it misses Pacific territories such as Guam and American Samoa.
- ArcGIS returns full SMA polygons that intersect the envelope. A small viewport can still receive a large multipolygon.
- On a live sample, `ADMIN_UNIT_NAME` was the string "Bureau of Land Management", so many features may share that name.
- `federal` is not produced until a later agency filter.
- BLM uses global `fetch`, same as municipal ArcGIS. Overpass still goes through `overpassQuery` / `stealthFetch`.
