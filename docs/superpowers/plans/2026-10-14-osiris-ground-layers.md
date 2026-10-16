# Osiris Ground Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nine viewport-fetched GROUND layers (UAP, NOAA wrecks, abandoned rail/industrial, nightlife/plazas, GTFS-RT, USGS gauges, municipal 311, vacant property, historic map footprints) to Osiris via thin `/api/layers/*` proxies.

**Architecture:** Shared bbox/cache helpers under `src/lib/layers/`; one Next route per layer returning GeoJSON FeatureCollection; MapLibre sources wired like Curiosities/CCTV; LayerPanel group **GROUND**; all toggles default off; fetch on layer ON + debounced `moveend`.

**Tech Stack:** Next.js App Router, MapLibre GL, Vitest, Overpass API, NOAA ArcGIS, UAP Atlas API, USGS Waterservices, GTFS-RT protobuf (decode via `gtfs-realtime-bindings` or minimal protobuf parse), Socrata/ArcGIS municipal feeds.

**Spec:** `docs/superpowers/specs/2026-10-14-osiris-ground-layers-design.md`

## Global Constraints

- Soft-fail: upstream errors return empty FeatureCollection (HTTP 200), never crash the map.
- Bbox query param required: `bbox=west,south,east,north` (WGS84).
- New layers default **off** in `page.tsx` `activeLayers`.
- UAP popups must state city-level precision.
- Historic maps: footprints + LOC URL only (no raster tiles).
- Municipal 311 / vacant: US-only, viewport registry intersect.
- Prefer OSM/NOAA/USGS attribution in popup footer.
- Follow existing Osiris patterns (`AbortSignal.timeout`, LayerPanel `LAYER_GROUPS`, MapLibre `EMPTY_FC`).
- Run tests with `npm test -- <path>`; commits only when user requests (or per task if user said to commit during execution).

---

## File map

| Path | Role |
|------|------|
| `src/lib/layers/bbox.ts` | Parse/validate/round bbox |
| `src/lib/layers/cache.ts` | TTL + inflight dedupe for GeoJSON |
| `src/lib/layers/geojson.ts` | Empty FC, feature builders, caps |
| `src/lib/layers/overpass.ts` | Overpass POST helper |
| `src/lib/layers/types.ts` | Shared types |
| `src/lib/layers/*.test.ts` | Unit tests |
| `src/app/api/layers/<name>/route.ts` | Nine route handlers |
| `public/data/layers/gtfs-agencies.json` | GTFS-RT registry |
| `public/data/layers/municipal-endpoints.json` | 311/vacant registry |
| `public/data/layers/historic-map-footprints.geojson` | Sanborn/LOC footprints |
| `src/components/LayerPanel.tsx` | GROUND group |
| `src/app/page.tsx` | `activeLayers` defaults |
| `src/components/OsirisMap.tsx` | Sources, layers, fetch effects, clicks |
| `src/lib/ground-layers-client.ts` | Client bbox debounce + fetch helper |

---

### Task 1: Shared layer lib (bbox + cache + geojson)

**Files:**
- Create: `src/lib/layers/types.ts`
- Create: `src/lib/layers/bbox.ts`
- Create: `src/lib/layers/cache.ts`
- Create: `src/lib/layers/geojson.ts`
- Test: `src/lib/layers/bbox.test.ts`
- Test: `src/lib/layers/cache.test.ts`

**Interfaces:**
- Produces: `parseBbox(raw: string | null): BBox | null`, `roundBbox(b: BBox, decimals?: number): BBox`, `bboxKey(layer: string, b: BBox): string`, `cachedFc(key, ttlMs, fetcher): Promise<FeatureCollection>`, `emptyFc()`, `pointFeature(id, lng, lat, props)`, `capFeatures(fc, max)`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/layers/bbox.test.ts
import { describe, it, expect } from 'vitest';
import { parseBbox, roundBbox } from './bbox';

describe('parseBbox', () => {
  it('parses west,south,east,north', () => {
    expect(parseBbox('-71.5,41.7,-71.2,42.0')).toEqual({
      west: -71.5, south: 41.7, east: -71.2, north: 42.0,
    });
  });
  it('rejects inverted or out-of-range', () => {
    expect(parseBbox('1,2,0,3')).toBeNull();
    expect(parseBbox('')).toBeNull();
    expect(parseBbox(null)).toBeNull();
  });
});

describe('roundBbox', () => {
  it('rounds for cache keys', () => {
    const r = roundBbox({ west: -71.12345, south: 41.98765, east: -71.1, north: 42.0 }, 2);
    expect(r.west).toBe(-71.12);
  });
});
```

```ts
// src/lib/layers/cache.test.ts
import { describe, it, expect, vi } from 'vitest';
import { cachedFc, _resetLayerCacheForTests } from './cache';
import { emptyFc } from './geojson';

describe('cachedFc', () => {
  it('dedupes inflight and serves TTL', async () => {
    _resetLayerCacheForTests();
    let n = 0;
    const fetcher = vi.fn(async () => { n++; return emptyFc(); });
    const a = cachedFc('t', 60_000, fetcher);
    const b = cachedFc('t', 60_000, fetcher);
    await Promise.all([a, b]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await cachedFc('t', 60_000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/lib/layers/bbox.test.ts src/lib/layers/cache.test.ts`  
Expected: FAIL module not found

- [ ] **Step 3: Implement**

```ts
// src/lib/layers/types.ts
export interface BBox { west: number; south: number; east: number; north: number; }
```

```ts
// src/lib/layers/bbox.ts
import type { BBox } from './types';

export function parseBbox(raw: string | null): BBox | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  if (west < -180 || east > 180 || south < -90 || north > 90) return null;
  // Cap span to avoid world-sized Overpass bombs
  if (east - west > 40 || north - south > 40) return null;
  return { west, south, east, north };
}

export function roundBbox(b: BBox, decimals = 2): BBox {
  const f = 10 ** decimals;
  return {
    west: Math.floor(b.west * f) / f,
    south: Math.floor(b.south * f) / f,
    east: Math.ceil(b.east * f) / f,
    north: Math.ceil(b.north * f) / f,
  };
}

export function bboxKey(layer: string, b: BBox): string {
  const r = roundBbox(b);
  return `${layer}:${r.west},${r.south},${r.east},${r.north}`;
}
```

```ts
// src/lib/layers/geojson.ts
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export function emptyFc(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export function pointFeature(
  id: string | number,
  lng: number,
  lat: number,
  properties: Record<string, unknown>,
): Feature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { ...properties, id },
  };
}

export function featureOf(
  id: string | number,
  geometry: Geometry,
  properties: Record<string, unknown>,
): Feature {
  return { type: 'Feature', id, geometry, properties: { ...properties, id } };
}

export function capFeatures(fc: FeatureCollection, max: number): FeatureCollection {
  if (fc.features.length <= max) return fc;
  return { type: 'FeatureCollection', features: fc.features.slice(0, max) };
}
```

```ts
// src/lib/layers/cache.ts
import type { FeatureCollection } from 'geojson';

type Entry = { fc: FeatureCollection; expiresAt: number; inflight: Promise<FeatureCollection> | null };
const store = new Map<string, Entry>();

export function _resetLayerCacheForTests(): void { store.clear(); }

export async function cachedFc(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<FeatureCollection>,
): Promise<FeatureCollection> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now < hit.expiresAt) return hit.fc;
  if (hit?.inflight) return hit.inflight;
  const inflight = fetcher()
    .then((fc) => {
      store.set(key, { fc, expiresAt: Date.now() + ttlMs, inflight: null });
      return fc;
    })
    .catch((err) => {
      const stale = store.get(key)?.fc;
      store.set(key, { fc: stale ?? { type: 'FeatureCollection', features: [] }, expiresAt: Date.now() + Math.min(ttlMs, 30_000), inflight: null });
      console.warn('[layers-cache]', key, err);
      return store.get(key)!.fc;
    });
  store.set(key, { fc: hit?.fc ?? { type: 'FeatureCollection', features: [] }, expiresAt: 0, inflight });
  return inflight;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/lib/layers/bbox.test.ts src/lib/layers/cache.test.ts`

- [ ] **Step 5: Commit** (when user/execution allows)

```bash
git add src/lib/layers && git commit -m "feat(layers): shared bbox, cache, and GeoJSON helpers"
```

---

### Task 2: USGS gauges API (first live layer)

**Files:**
- Create: `src/app/api/layers/gauges/route.ts`
- Test: `src/lib/layers/gauges.test.ts` (pure mapper)

**Interfaces:**
- Consumes: `parseBbox`, `bboxKey`, `cachedFc`, `pointFeature`, `capFeatures`, `emptyFc`
- Produces: `GET /api/layers/gauges?bbox=` → FeatureCollection

- [ ] **Step 1: Write mapper test**

```ts
import { describe, it, expect } from 'vitest';
import { mapUsgsIvToFc } from './gauges';

describe('mapUsgsIvToFc', () => {
  it('maps timeSeries to points', () => {
    const fc = mapUsgsIvToFc({
      value: { timeSeries: [{
        sourceInfo: {
          siteName: 'Test River',
          siteCode: [{ value: '01100000' }],
          geoLocation: { geogLocation: { latitude: 41.9, longitude: -71.3 } },
        },
        variable: { variableName: 'Streamflow', unit: { unitCode: 'ft3/s' } },
        values: [{ value: [{ value: '12.3', dateTime: '2026-10-14T12:00:00Z' }] }],
      }] },
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.siteName).toBe('Test River');
  });
});
```

- [ ] **Step 2: Implement mapper + route**

```ts
// src/lib/layers/gauges.ts
import { pointFeature, emptyFc, capFeatures } from './geojson';
import type { FeatureCollection } from 'geojson';

export function mapUsgsIvToFc(data: any): FeatureCollection {
  const series = data?.value?.timeSeries;
  if (!Array.isArray(series)) return emptyFc();
  const features = [];
  for (const s of series) {
    const lat = s?.sourceInfo?.geoLocation?.geogLocation?.latitude;
    const lng = s?.sourceInfo?.geoLocation?.geogLocation?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const code = s?.sourceInfo?.siteCode?.[0]?.value ?? String(features.length);
    const v = s?.values?.[0]?.value?.[0];
    features.push(pointFeature(`usgs-${code}`, lng, lat, {
      kind: 'ground_gauges',
      siteName: s?.sourceInfo?.siteName ?? code,
      siteCode: code,
      value: v?.value ?? null,
      unit: s?.variable?.unit?.unitCode ?? null,
      parameter: s?.variable?.variableName ?? null,
      observedAt: v?.dateTime ?? null,
      url: `https://waterdata.usgs.gov/monitoring-location/${code}/`,
      attribution: 'USGS',
    }));
  }
  return capFeatures({ type: 'FeatureCollection', features }, 2000);
}
```

```ts
// src/app/api/layers/gauges/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { mapUsgsIvToFc } from '@/lib/layers/gauges';

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('gauges', bbox);
  const fc = await cachedFc(key, 5 * 60_000, async () => {
    const b = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${b}&parameterCd=00060,00065&siteStatus=active`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': 'osiris-layers/1.0' } });
    if (!res.ok) return emptyFc();
    return mapUsgsIvToFc(await res.json());
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
```

- [ ] **Step 3: Run tests PASS**

Run: `npm test -- src/lib/layers/gauges.test.ts`

- [ ] **Step 4: Manual smoke**

Run: hit `http://localhost:3000/api/layers/gauges?bbox=-71.5,41.7,-71.0,42.1` while `npm run dev` — expect FeatureCollection JSON.

---

### Task 3: NOAA wrecks API

**Files:**
- Create: `src/lib/layers/wrecks.ts`
- Create: `src/app/api/layers/wrecks/route.ts`
- Test: `src/lib/layers/wrecks.test.ts`

**Interfaces:**
- Produces: `GET /api/layers/wrecks?bbox=`

- [ ] **Step 1: Implement query against NOAA ArcGIS**

Use FeatureServer/MapServer query:

`https://gis.charttools.noaa.gov/arcgis/rest/services/public_wrecks/Wrecks_And_Obstructions/MapServer/0/query?where=1%3D1&geometry=west,south,east,north&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&f=geojson&resultRecordCount=2000`

Map properties to `{ kind:'ground_wrecks', name, featureType, attribution:'NOAA' }`. Soft-fail empty FC. TTL 5m. Reuse `parseBbox` / `cachedFc` / `capFeatures`.

- [ ] **Step 2: Unit-test a small fixture mapper** for geometry Point/MultiPoint → features.

- [ ] **Step 3: Smoke coastal MA bbox** vs inland empty.

---

### Task 4: UAP / NUFORC API

**Files:**
- Create: `src/lib/layers/uap.ts`
- Create: `src/app/api/layers/uap/route.ts`
- Test: `src/lib/layers/uap.test.ts`

**Interfaces:**
- Produces: `GET /api/layers/uap?bbox=`

- [ ] **Step 1: Fetch** `https://theuapatlas.com/api/export?format=json&from=2015&to=2026&limit=5000&offset=0` (page if needed), filter points inside bbox client-side on server, set `precision: 'city'` and `attribution: 'NUFORC via The UAP Atlas'`. Cap 2000. TTL 30m. Cache full export separately under key `uap:export:v1` for 30m then filter by bbox in memory.

- [ ] **Step 2: Test filter-by-bbox helper** with fixture rows.

---

### Task 5: Overpass helper + nightlife + abandoned

**Files:**
- Create: `src/lib/layers/overpass.ts`
- Create: `src/lib/layers/nightlife.ts`
- Create: `src/lib/layers/abandoned.ts`
- Create: `src/app/api/layers/nightlife/route.ts`
- Create: `src/app/api/layers/abandoned/route.ts`
- Test: `src/lib/layers/overpass.test.ts`

**Interfaces:**
- Produces: `overpassQuery(ql: string): Promise<any>`, nightlife/abandoned routes

- [ ] **Step 1: `overpassQuery`** POST to `https://overpass-api.de/api/interpreter` (fallback `https://overpass.kumi.systems/api/interpreter`) with timeout 25s, User-Agent `osiris-layers/1.0`.

- [ ] **Step 2: Nightlife QL** (bbox vars):

```
[out:json][timeout:25];
(
  node["amenity"~"^(bar|pub|nightclub|biergarten)$"]({{bbox}});
  node["place"="square"]({{bbox}});
  node["highway"="pedestrian"]["area"="yes"]({{bbox}});
);
out center body;
```

Map to points `kind:'ground_nightlife'`. Min zoom enforced in route: if `z` query &lt; 10 return empty. TTL 10m.

- [ ] **Step 3: Abandoned QL**:

```
[out:json][timeout:25];
(
  way["railway"~"^(abandoned|disused)$"]({{bbox}});
  node["railway"~"^(abandoned|disused)$"]({{bbox}});
  node["abandoned:industrial"]({{bbox}});
  node["industrial"]["disused"="yes"]({{bbox}});
);
out center body geom;
```

Ways → LineString when geometry present else center Point. `kind:'ground_abandoned'`, `subkind:'rail'|'industrial'`. Min zoom 10. TTL 10m.

- [ ] **Step 4: Tests** for OSM element → feature mapping with fixtures (no live Overpass in unit tests).

---

### Task 6: GTFS-RT + agency registry

**Files:**
- Create: `public/data/layers/gtfs-agencies.json`
- Create: `src/lib/layers/gtfs.ts`
- Create: `src/app/api/layers/gtfs/route.ts`
- Test: `src/lib/layers/gtfs.test.ts`
- Dependency: add `gtfs-realtime-bindings` (or `@bufbuild/protobuf` feed decode) in `package.json`

**Seed registry** (starter):

```json
[
  { "id": "mbta", "name": "MBTA", "vehicleUrl": "https://cdn.mbta.com/realtime/VehiclePositions.pb", "bbox": [-71.9,41.5,-69.9,42.9] },
  { "id": "mta-bus", "name": "MTA NYCT Bus", "vehicleUrl": "https://gtfsrt.prod.obanyc.com/vehiclePositions", "bbox": [-74.3,40.4,-73.6,41.0] },
  { "id": "riptide", "name": "RIPTA", "vehicleUrl": "", "bbox": [-71.9,41.3,-71.1,42.0], "disabled": true }
]
```

Fill working public vehicle URLs during implementation; skip disabled.

- [ ] **Step 1: Install** `gtfs-realtime-bindings` and decode VehiclePosition entities to points.

- [ ] **Step 2: Route** loads registry, picks agencies intersecting bbox, fetches PB in parallel (timeout 8s each), merges FC `kind:'ground_gtfs'`. TTL 10s via `cachedFc`.

- [ ] **Step 3: Test** decode with a tiny fixture buffer or mocked entity list mapper.

---

### Task 7: Municipal registry + 311 + vacant

**Files:**
- Create: `public/data/layers/municipal-endpoints.json`
- Create: `src/lib/layers/municipal.ts`
- Create: `src/app/api/layers/civic-311/route.ts`
- Create: `src/app/api/layers/vacant/route.ts`
- Test: `src/lib/layers/municipal.test.ts`

**Registry shape:**

```json
[
  {
    "id": "boston",
    "name": "Boston",
    "bbox": [-71.2,42.2,-70.9,42.4],
    "threeOneOne": { "type": "socrata", "url": "https://data.boston.gov/resource/....json", "latField": "latitude", "lngField": "longitude", "limit": 1000 },
    "vacant": { "type": "arcgis", "url": "https://services.arcgis.com/.../FeatureServer/0/query", "latField": "y", "lngField": "x" }
  }
]
```

Seed 4–8 cities with verified public endpoints (Boston, NYC, Chicago, SF, Providence if available). Omit `vacant` when unavailable.

- [ ] **Step 1: `citiesForBbox(registry, bbox)`** intersect test.

- [ ] **Step 2: Fetch adapters** for Socrata `$where` / ArcGIS geometry envelope; normalize to points `kind:'ground_civic_311'|'ground_vacant'`. Min zoom 10. TTL 3m.

- [ ] **Step 3: Routes** soft-fail per city; merge survivors.

---

### Task 8: Historic map footprints

**Files:**
- Create: `public/data/layers/historic-map-footprints.geojson`
- Create: `src/app/api/layers/historic-maps/route.ts`

- [ ] **Step 1: Seed GeoJSON** with ~10–20 US city Sanborn/LOC footprint polygons (rough city bbox rectangles OK for v1) with properties `{ title, city, year, locUrl, attribution:'Library of Congress' }`.

- [ ] **Step 2: Route** filters features intersecting bbox (simple bbox-overlap on feature bbox); return FC. No upstream network required.

---

### Task 9: Client fetch helper

**Files:**
- Create: `src/lib/ground-layers-client.ts`
- Test: `src/lib/ground-layers-client.test.ts` (debounce/minZoom pure bits)

```ts
export const GROUND_LAYER_KEYS = [
  'uap','wrecks','abandoned','nightlife','gtfs','gauges','civic_311','vacant','historic_maps',
] as const;
export type GroundLayerKey = typeof GROUND_LAYER_KEYS[number];

export const GROUND_MIN_ZOOM: Record<GroundLayerKey, number> = {
  uap: 0, wrecks: 6, abandoned: 10, nightlife: 10, gtfs: 0,
  gauges: 5, civic_311: 10, vacant: 10, historic_maps: 0,
};

export const GROUND_API: Record<GroundLayerKey, string> = {
  uap: '/api/layers/uap',
  wrecks: '/api/layers/wrecks',
  abandoned: '/api/layers/abandoned',
  nightlife: '/api/layers/nightlife',
  gtfs: '/api/layers/gtfs',
  gauges: '/api/layers/gauges',
  civic_311: '/api/layers/civic-311',
  vacant: '/api/layers/vacant',
  historic_maps: '/api/layers/historic-maps',
};

export function boundsToBboxParam(b: { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number }): string {
  return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
}
```

---

### Task 10: LayerPanel GROUND group + page defaults

**Files:**
- Modify: `src/components/LayerPanel.tsx` (import an icon e.g. `MapPinned` or `Landmark` from lucide-react; insert GROUND group before DISPLAY)
- Modify: `src/app/page.tsx` `activeLayers` useState — add nine keys `false`

```ts
// LayerPanel LAYER_GROUPS entry
{
  label: 'GROUND',
  fullLabel: 'GROUND TRUTH',
  icon: MapPinned,
  layers: [
    { key: 'uap', label: 'UAP / NUFORC', dataKey: '', description: 'City-level reports' },
    { key: 'wrecks', label: 'NOAA Wrecks', dataKey: '' },
    { key: 'abandoned', label: 'Abandoned Rail / Industrial', dataKey: '' },
    { key: 'nightlife', label: 'Nightlife + Plazas', dataKey: '' },
    { key: 'gtfs', label: 'Transit Vehicles', dataKey: '', description: 'GTFS realtime' },
    { key: 'gauges', label: 'USGS Water Gauges', dataKey: '' },
    { key: 'civic_311', label: '311 Requests', dataKey: '', description: 'US cities in view' },
    { key: 'vacant', label: 'Vacant Property', dataKey: '', description: 'US cities in view' },
    { key: 'historic_maps', label: 'Historic Map Index', dataKey: '', description: 'LOC footprints · no tiles' },
  ],
},
```

- [ ] **Step 1: Add defaults + group**
- [ ] **Step 2: Visual check** panel shows GROUND toggles off

---

### Task 11: OsirisMap sources, layers, fetch, popups

**Files:**
- Modify: `src/components/OsirisMap.tsx`

- [ ] **Step 1: Register sources** next to curiosities:

For each ground key: `map.addSource('ground-<key>', { type: 'geojson', data: EMPTY_FC, cluster: key is uap|nightlife|civic_311 })`.

- [ ] **Step 2: Add paint layers** — circles for points, line for abandoned rail, fill+line for historic polygons. Distinct hues from CSS vars (avoid purple glow clichés; use cyan/amber/slate already in theme).

- [ ] **Step 3: Fetch effect**

```ts
// Pseudocode structure to implement
useEffect(() => {
  if (!mapReady || !mapRef.current) return;
  const map = mapRef.current;
  const aborters = new Map<string, AbortController>();
  const refresh = () => {
    const z = map.getZoom();
    const bbox = boundsToBboxParam(map.getBounds());
    for (const key of GROUND_LAYER_KEYS) {
      const on = !!(activeLayers as any)[key];
      const src = map.getSource(`ground-${key}`) as maplibregl.GeoJSONSource | undefined;
      if (!on) { src?.setData(EMPTY_FC as never); continue; }
      if (z < GROUND_MIN_ZOOM[key]) { src?.setData(EMPTY_FC as never); continue; }
      aborters.get(key)?.abort();
      const ac = new AbortController();
      aborters.set(key, ac);
      const url = `${GROUND_API[key]}?bbox=${encodeURIComponent(bbox)}&z=${Math.floor(z)}`;
      fetch(url, { signal: ac.signal })
        .then((r) => r.json())
        .then((fc) => { if (!ac.signal.aborted) src?.setData(fc); })
        .catch(() => { /* aborted or fail: keep last */ });
    }
  };
  let t: ReturnType<typeof setTimeout> | undefined;
  const onMove = () => { clearTimeout(t); t = setTimeout(refresh, 400); };
  map.on('moveend', onMove);
  refresh();
  const gtfsTimer = setInterval(() => {
    if ((activeLayers as any).gtfs) refresh(); // or refresh only gtfs
  }, 20_000);
  const onVis = () => { if (document.hidden) return; };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    map.off('moveend', onMove);
    clearTimeout(t);
    clearInterval(gtfsTimer);
    document.removeEventListener('visibilitychange', onVis);
    aborters.forEach((a) => a.abort());
  };
}, [mapReady, activeLayers.uap, activeLayers.wrecks, /* ...all nine */]);
```

- [ ] **Step 4: Click handlers** for `ground-*` layers → popup HTML with name, kind, attribution, and for UAP the line `Approximate location (city-level).` Historic maps: button/link `locUrl`.

- [ ] **Step 5: Include ground layer ids** in any hover cursor / bring-to-front arrays that already list `curiosities-dots`.

---

### Task 12: End-to-end verification

- [ ] **Step 1:** `npm test` — all new layer unit tests pass  
- [ ] **Step 2:** `npm run dev` — toggle each GROUND layer over:
  - Providence (nightlife, gauges if any, historic if seeded, 311 if registry hits)
  - Boston Harbor / Cape (wrecks)
  - Inland MA (wrecks empty)
  - UAP nationwide zoomed out (city precision note)
  - Transit city with working GTFS URL (moving dots)
- [ ] **Step 3:** Confirm defaults remain off on fresh load  
- [ ] **Step 4:** Commit series if not committed per task

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Shared bbox/cache | T1 |
| gauges | T2 |
| wrecks | T3 |
| uap + city precision | T4, T11 |
| nightlife Overpass | T5 |
| abandoned rail/industrial | T5 |
| gtfs + registry | T6 |
| civic_311 + vacant + registry | T7 |
| historic footprints only | T8 |
| LayerPanel GROUND | T10 |
| MapLibre wiring + debounce | T9, T11 |
| Default off | T10 |
| Soft-fail empty FC | T2–T8 |
| Attribution | T11 |
| Min zooms | T5, T7, T9, T11 |

## Placeholder scan

No TBD steps; live URL verification for GTFS/municipal seeds happens inside Tasks 6–7 with `disabled: true` escape for broken feeds.

## Type consistency

- Layer keys: `uap|wrecks|abandoned|nightlife|gtfs|gauges|civic_311|vacant|historic_maps`
- API paths use hyphens: `civic-311`, `historic-maps`
- Feature `properties.kind`: `ground_<key>` with `civic_311` → `ground_civic_311`
