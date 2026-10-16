# Osiris Ground Layers Design

**Date:** 2026-10-14  
**Status:** Approved for planning (pending final user review of this spec)  
**Scope:** Add nine new MapLibre layers via thin proxy APIs + viewport fetch

## Goals

- Extend Osiris with investigative “ground truth” layers alongside CCTV / Curiosities.
- Prefer live upstream data proxied through Next.js API routes (same pattern as existing layers).
- Global coverage where the source allows; US-only for municipal 311 / vacant property and historic map index.
- All new toggles default **off**; empty/error states fail soft.

## Non-goals (v1)

- Full Sanborn / historic **raster tile** overlays (footprint index only).
- Exhaustive coverage of every US city’s 311 portal.
- Client-direct calls to Overpass / NOAA / UAP (CORS and rate-limit risk).
- Offline bulk bins for these layers (except small static registries).

## Decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| Architecture | Thin proxy APIs + viewport bbox fetch |
| Geographic default | Global where possible; US-only municipal + historic index |
| Sanborn | Historic sheet footprints + LOC links only |
| Municipal / 311 / vacant | Viewport-driven curated endpoint registry |

## UI

New LayerPanel group **GROUND** (label may be FIELD if GROUND conflicts):

| Key | Label |
|-----|--------|
| `uap` | UAP / NUFORC |
| `wrecks` | NOAA Wrecks |
| `abandoned` | Abandoned Rail / Industrial |
| `nightlife` | Nightlife + Plazas |
| `gtfs` | Transit vehicles (GTFS-RT) |
| `gauges` | USGS Water Gauges |
| `civic_311` | 311 Requests |
| `vacant` | Vacant Property |
| `historic_maps` | Historic Map Index |

Default: all off. Click uses existing entity popup pattern; attribution in footer.

## Architecture

```
Map moveend / layer ON
  → debounce (~400ms)
  → GET /api/layers/<id>?bbox=w,s,e,n[&z=]
  → GeoJSON FeatureCollection
  → MapLibre GeoJSONSource.setData
```

Shared server helpers (new module under `src/lib/layers/`):

- Parse/validate bbox
- In-memory TTL cache keyed by layer + rounded bbox
- Upstream fetch with timeout + abort
- Normalize to FeatureCollection
- Soft-fail empty FC on error

Client helpers:

- Bbox from map `getBounds()`
- AbortController per layer
- Keep last good FC while refreshing
- Min-zoom gates (see below)

## Per-layer sources

### `uap` — UAP / NUFORC

- **Upstream:** [UAP Atlas](https://theuapatlas.com/data) `/api/export` (NUFORC-derived; no narrative text).
- **Geometry:** Point (often **city-level**; popup must say so).
- **Props:** date, shape, city, country, sourceUrl, precision.
- **Scope:** Global; server filters by bbox; cap ~2000 features per view.
- **Cache TTL:** ~30 minutes.

### `wrecks` — NOAA wrecks & obstructions

- **Upstream:** NOAA ArcGIS `public_wrecks` / Wrecks_And_Obstructions (GeoJSON query by bbox).
- **Geometry:** Point.
- **Props:** name/feature type, depth, chart id, source.
- **Scope:** US coastal + territories (source coverage).
- **Min zoom:** 6.
- **Cache TTL:** ~5 minutes.

### `abandoned` — Abandoned rail / industrial

- **Upstream:**
  - OpenStreetMap via Overpass: `railway=abandoned|disused`, selected industrial ruins / disused tags.
  - Optional US EPA brownfields / SEMS points when a free queryable endpoint is available.
- **Geometry:** LineString (rail) + Point (sites).
- **Props:** name, kind (`rail` | `industrial`), osmId / epaId, source.
- **Scope:** OSM global; EPA subset US-only.
- **Min zoom:** 10.
- **Cache TTL:** 5–15 minutes.

### `nightlife` — Overpass nightlife + plazas

- **Upstream:** Overpass amenities `bar|pub|nightclub|biergarten` and plaza-like features (`place=square`, `leisure=park` with plaza tags, pedestrian squares as practical).
- **Geometry:** Point.
- **Props:** name, amenity/leisure, osmId.
- **Scope:** Global; bbox required.
- **Min zoom:** 10 (prefer denser at ≥11).
- **Cache TTL:** 5–15 minutes.

### `gtfs` — GTFS realtime

- **Upstream:** Curated agency registry (`public/data/layers/gtfs-agencies.json`) → each agency’s GTFS-RT vehicle positions feed.
- **Geometry:** Point (moving).
- **Props:** agencyId, route, vehicleId, bearing, timestamp.
- **Scope:** Global agencies with public RT URLs in registry (starts with major metros; grows).
- **Poll:** ~20s while layer on; pause when document hidden.
- **Cache TTL:** 0–15 seconds.

### `gauges` — USGS water gauges

- **Upstream:** USGS Waterservices / Instantaneous Values API (sites in bbox with recent stage/discharge).
- **Geometry:** Point.
- **Props:** siteName, siteCode, value, unit, parameter, observedAt, url.
- **Scope:** Primarily US (API coverage).
- **Min zoom:** 5.
- **Cache TTL:** ~5 minutes.

### `civic_311` — Municipal 311

- **Upstream:** Curated registry (`public/data/layers/municipal-endpoints.json`) of Socrata/ArcGIS 311 datasets; select cities whose bbox intersects view.
- **Geometry:** Point.
- **Props:** category, status, openedAt, address, city, sourceUrl.
- **Scope:** US-only; registry starts with high-quality open portals.
- **Min zoom:** 10.
- **Cache TTL:** 2–5 minutes.

### `vacant` — Vacant property

- **Upstream:** Same municipal registry, `vacant` dataset entries when present.
- **Geometry:** Point (polygon → centroid if needed).
- **Props:** address, status, city, sourceUrl.
- **Scope:** US-only; skip cities without a vacant feed.
- **Min zoom:** 10.
- **Cache TTL:** 2–5 minutes.

### `historic_maps` — Historic map index (not tiles)

- **Upstream:** Static footprint index (`public/data/layers/historic-map-footprints.json`) built from LOC Sanborn (and similar) sheet extents where known.
- **Geometry:** Polygon footprints.
- **Props:** city, year, title, locUrl.
- **Behavior:** Click opens LOC (or source URL); **no raster tiles in v1**.
- **Scope:** US index.
- **Cache TTL:** static file / long TTL.

## API surface

```
GET /api/layers/uap?bbox=w,s,e,n
GET /api/layers/wrecks?bbox=...
GET /api/layers/abandoned?bbox=...&z=
GET /api/layers/nightlife?bbox=...&z=
GET /api/layers/gtfs?bbox=...
GET /api/layers/gauges?bbox=...
GET /api/layers/civic-311?bbox=...
GET /api/layers/vacant?bbox=...
GET /api/layers/historic-maps?bbox=...
```

Response: GeoJSON FeatureCollection. On upstream failure: empty FC (HTTP 200 preferred for map simplicity) + optional `X-Osiris-Layer-Warning` header.

## MapLibre integration

For each layer:

1. `map.addSource('<id>', { type: 'geojson', data: EMPTY_FC })` (cluster where dense: uap, nightlife, 311).
2. Circle/line/fill layers with distinct colors from existing palette tokens.
3. `useEffect` tied to `activeLayers.<id>` + map bounds.
4. Click handlers → existing popup / `onEntityClick` path with `kind: 'ground_<id>'`.

## Registries (static v1 seeds)

| File | Purpose |
|------|---------|
| `public/data/layers/gtfs-agencies.json` | agencyId, name, gtfsRtVehicleUrl, bbox hint |
| `public/data/layers/municipal-endpoints.json` | city, bbox, 311 url/type, vacant url/type |
| `public/data/layers/historic-map-footprints.geojson` | polygons + LOC urls |

Seed registries with a useful starter set (major transit agencies; Boston/Providence/NYC/Chicago/SF-class open data; notable Sanborn city footprints). Expand incrementally.

## Attribution

Popup footer must credit:

- NUFORC via The UAP Atlas  
- NOAA  
- © OpenStreetMap contributors  
- USGS  
- City open-data portal name  
- Library of Congress (historic index)

## Testing

- Unit: bbox parse, cache key, GeoJSON normalize, registry bbox intersect.
- Integration (optional live): one happy-path fetch per layer behind `RUN_LIVE_TESTS`.
- Manual: toggle each layer over Providence / Boston / coastal MA; confirm empty inland wrecks; confirm UAP precision note.

## Implementation order (suggested)

1. Shared `src/lib/layers/*` + one example route (`gauges` or `wrecks`)
2. LayerPanel GROUND group + map wiring skeleton
3. wrecks, gauges, uap  
4. nightlife, abandoned (Overpass)  
5. gtfs + agency registry  
6. civic_311 + vacant + municipal registry  
7. historic_maps footprints  

## Open follow-ups (post-v1)

- Sanborn / historic raster tiles where free georeferenced tiles exist  
- Grow municipal + GTFS registries  
- International gauge sources beyond USGS  

## Spec self-review

- [x] No placeholder “TBD” sources for v1 layers (historic tiles explicitly out of scope)  
- [x] Consistent bbox + soft-fail contract  
- [x] US vs global scope stated per layer  
- [x] Does not contradict existing LayerPanel / MapLibre patterns  
- [x] Nine user-requested layers all accounted for  
