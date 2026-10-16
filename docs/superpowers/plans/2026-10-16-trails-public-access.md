# Trails & Public Access Land Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two ground layers — `trails` (OSM path lines) and `public_access` (OSM parks/protected + US BLM SMA fills) — off by default, viewport-fetched.

**Architecture:** Mirror `freight-rail` / `abandoned`: Overpass QL + mapper lib, Next route with `cachedFc`, register in `ground-layers-client`, wire LayerPanel + page defaults + OsirisMap line/fill layers. BLM via ArcGIS envelope query (GeoJSON), merged server-side into `public_access`.

**Tech Stack:** Next.js App Router, Overpass, MapLibre GeoJSON sources, Vitest, BLM National SMA MapServer.

**Spec:** `docs/superpowers/specs/2026-10-16-trails-public-access-design.md`

## Global Constraints

- Keys: `trails`, `public_access` (API path `/api/layers/public-access`).
- Min zoom: trails `8`, public_access `7`.
- Soft-fail per source → empty FC; never throw to client.
- Cap trails ≤ 4000 features; public_access OSM ≤ 2000 + BLM ≤ 2000.
- Attribution: OSM → `OpenStreetMap`; BLM → `BLM`.
- No live people/vehicles; not legal advice (popup disclaimer on public_access).
- Do not remove or replace existing `abandoned` layer.

## File map

| File | Role |
|------|------|
| `src/lib/layers/trails.ts` | Overpass QL, map ways → `ground_trails` LineStrings |
| `src/lib/layers/trails.test.ts` | QL + mapper unit tests |
| `src/app/api/layers/trails/route.ts` | `GET ?bbox=&z=` |
| `src/lib/layers/public-access.ts` | OSM polygons QL/mapper + BLM URL/fetch/map + merge |
| `src/lib/layers/public-access.test.ts` | OSM + BLM mapper / URL tests |
| `src/app/api/layers/public-access/route.ts` | `GET ?bbox=&z=` merge OSM+BLM |
| `src/lib/ground-layers-client.ts` | keys, min zoom, API paths |
| `src/lib/ground-layers-client.test.ts` | registry assertions |
| `src/components/LayerPanel.tsx` | GROUND entries |
| `src/app/page.tsx` | defaults `false` |
| `src/components/OsirisMap.tsx` | colors, line/fill layers, hover/popup lists, effect deps |

---

### Task 1: Trails Overpass lib (TDD)

**Files:**
- Create: `src/lib/layers/trails.ts`
- Create: `src/lib/layers/trails.test.ts`

**Interfaces:**
- Produces: `TRAILS_MIN_ZOOM = 8`, `trailsQl(bbox: BBox): string`, `mapTrailsToFc(data: unknown): FeatureCollection`, `fetchTrails(bbox: BBox, zoom: number): Promise<FeatureCollection>`
- Feature props: `kind: 'ground_trails'`, `subkind: 'cycle'|'hike'|'foot'|'bridle'|'rail_trail'|'other'`, `name`, `highway`, `railway`, `route`, `osmId`, `attribution: 'OpenStreetMap'`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { trailsQl, mapTrailsToFc, TRAILS_MIN_ZOOM } from './trails';

describe('TRAILS_MIN_ZOOM', () => {
  it('is 8', () => expect(TRAILS_MIN_ZOOM).toBe(8));
});

describe('trailsQl', () => {
  it('fills bbox and path selectors', () => {
    const ql = trailsQl({ west: -105.3, south: 39.9, east: -105.2, north: 40.0 });
    expect(ql).toContain('39.9,-105.3,40,-105.2');
    expect(ql).toContain('highway"~"^(path|footway|cycleway|bridleway)$"');
    expect(ql).toContain('railway"~"^(abandoned|disused)$"');
  });
});

describe('mapTrailsToFc', () => {
  it('maps ways, assigns subkind, skips private', () => {
    const fc = mapTrailsToFc({
      elements: [
        {
          type: 'way', id: 1,
          tags: { highway: 'cycleway', name: 'Creek Path' },
          geometry: [{ lat: 40, lon: -105.25 }, { lat: 40.01, lon: -105.24 }],
        },
        {
          type: 'way', id: 2,
          tags: { highway: 'path', access: 'private' },
          geometry: [{ lat: 40, lon: -105 }, { lat: 40.01, lon: -105.01 }],
        },
        {
          type: 'way', id: 3,
          tags: { railway: 'abandoned', name: 'Old Grade' },
          geometry: [{ lat: 39.95, lon: -105.2 }, { lat: 39.96, lon: -105.19 }],
        },
      ],
    });
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]!.properties?.subkind).toBe('cycle');
    expect(fc.features[1]!.properties?.subkind).toBe('rail_trail');
    expect(fc.features[0]!.properties?.kind).toBe('ground_trails');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `npx vitest run src/lib/layers/trails.test.ts`

- [ ] **Step 3: Implement `trails.ts`**

```ts
import type { Feature, FeatureCollection, LineString, Position } from 'geojson';
import type { BBox } from './types';
import { fillBbox, overpassQuery } from './overpass';
import { featureOf, emptyFc, capFeatures } from './geojson';

export const TRAILS_MIN_ZOOM = 8;

const TRAILS_QL = `[out:json][timeout:25];
(
  way["highway"~"^(path|footway|cycleway|bridleway)$"]({{bbox}});
  way["route"~"^(hiking|foot|bicycle)$"]({{bbox}});
  way["railway"~"^(abandoned|disused)$"]({{bbox}});
);
out geom;
`;

export function trailsQl(bbox: BBox): string {
  return fillBbox(TRAILS_QL, bbox);
}

function wayLineGeometry(el: any): LineString | null {
  const geom = el?.geometry;
  if (!Array.isArray(geom) || geom.length < 2) return null;
  const coordinates: Position[] = [];
  for (const g of geom) {
    if (!Number.isFinite(g?.lat) || !Number.isFinite(g?.lon)) continue;
    coordinates.push([g.lon, g.lat]);
  }
  return coordinates.length < 2 ? null : { type: 'LineString', coordinates };
}

function denied(tags: Record<string, string>): boolean {
  if (tags.access === 'private' || tags.access === 'no') return true;
  if (tags.foot === 'no' && tags.bicycle === 'no') return true;
  return false;
}

export type TrailSubkind = 'cycle' | 'hike' | 'foot' | 'bridle' | 'rail_trail' | 'other';

export function trailSubkind(tags: Record<string, string>): TrailSubkind {
  const rw = tags.railway;
  if (rw === 'abandoned' || rw === 'disused') return 'rail_trail';
  const hw = tags.highway;
  if (hw === 'cycleway' || tags.route === 'bicycle') return 'cycle';
  if (hw === 'bridleway') return 'bridle';
  if (hw === 'footway' || tags.route === 'foot') return 'foot';
  if (tags.route === 'hiking' || tags.sac_scale) return 'hike';
  if (hw === 'path') return 'hike';
  return 'other';
}

export function mapTrailsToFc(data: any): FeatureCollection {
  const elements = data?.elements;
  if (!Array.isArray(elements)) return emptyFc();
  const features: Feature[] = [];
  for (const el of elements) {
    if (el?.type !== 'way') continue;
    const tags = (el?.tags ?? {}) as Record<string, string>;
    if (denied(tags)) continue;
    const line = wayLineGeometry(el);
    if (!line) continue;
    const id = el?.id ?? features.length;
    features.push(featureOf(`trail-${id}`, line, {
      kind: 'ground_trails',
      subkind: trailSubkind(tags),
      name: tags.name ?? tags['name:en'] ?? null,
      highway: tags.highway ?? null,
      railway: tags.railway ?? null,
      route: tags.route ?? null,
      osmId: id,
      attribution: 'OpenStreetMap',
    }));
  }
  return capFeatures({ type: 'FeatureCollection', features }, 4000);
}

export async function fetchTrails(bbox: BBox, zoom: number): Promise<FeatureCollection> {
  if (zoom < TRAILS_MIN_ZOOM) return emptyFc();
  try {
    return mapTrailsToFc(await overpassQuery(trailsQl(bbox)));
  } catch {
    return emptyFc();
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/layers/trails.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/layers/trails.ts src/lib/layers/trails.test.ts
git commit -m "feat(layers): OSM trails Overpass mapper"
```

---

### Task 2: Trails API route

**Files:**
- Create: `src/app/api/layers/trails/route.ts`
- Consumes: `fetchTrails`, `TRAILS_MIN_ZOOM` from `@/lib/layers/trails`

- [ ] **Step 1: Implement route** (pattern = `freight-rail/route.ts`)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { TRAILS_MIN_ZOOM, fetchTrails } from '@/lib/layers/trails';

const TTL_MS = 10 * 60_000;

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const z = Number(req.nextUrl.searchParams.get('z') ?? NaN);
  if (!Number.isFinite(z) || z < TRAILS_MIN_ZOOM) return NextResponse.json(emptyFc());
  const fc = await cachedFc(bboxKey('trails-v1', bbox), TTL_MS, () => fetchTrails(bbox, z));
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/layers/trails/route.ts
git commit -m "feat(api): /api/layers/trails viewport feed"
```

---

### Task 3: Public access OSM + BLM lib (TDD)

**Files:**
- Create: `src/lib/layers/public-access.ts`
- Create: `src/lib/layers/public-access.test.ts`

**Interfaces:**
- Produces: `PUBLIC_ACCESS_MIN_ZOOM = 7`, `publicAccessOsmQl(bbox)`, `mapPublicAccessOsmToFc(data)`, `buildBlmSmaUrl(bbox)`, `mapBlmSmaGeoJsonToFc(gj)`, `fetchPublicAccess(bbox, zoom)`, `mergePublicAccessFc(parts)`
- Feature props: `kind: 'ground_public_access'`, `subkind: 'park'|'protected'|'open_access'|'blm'|'federal'|'other'`, `name`, `agency`, `attribution`

**BLM endpoint (v1 BLM-only filter):**  
`https://gis.blm.gov/natl/rest/services/lands/BLM_Natl_SMA_Cached_BLM_Only/MapServer/2/query`  
Query: envelope geometry, `f=geojson`, `outFields=*`, `resultRecordCount=2000`, `outSR=4326`.

- [ ] **Step 1: Write failing tests** for QL contents, OSM polygon mapping (skip `access=private`), BLM URL contains `geometryType=esriGeometryEnvelope` and `f=geojson`, BLM FeatureCollection → `subkind: 'blm'`.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/layers/public-access.test.ts`

- [ ] **Step 3: Implement**

OSM QL:

```
[out:json][timeout:25];
(
  way["leisure"~"^(park|nature_reserve)$"]({{bbox}});
  relation["leisure"~"^(park|nature_reserve)$"]({{bbox}});
  way["boundary"="protected_area"]({{bbox}});
  relation["boundary"="protected_area"]({{bbox}});
  way["access"="yes"]["leisure"]({{bbox}});
  relation["access"="yes"]["leisure"]({{bbox}});
);
out geom;
```

Map closed ways / multipolygon relations to Polygon/MultiPolygon (reuse abandoned-style geom walk for ways; for relations use `members` outer ways if Overpass returns full geom — prefer `out geom` on ways only for v1 if relations are fragile: **v1 query ways only** + `out geom` to keep mapper simple).

BLM: `fetch` GeoJSON, map each feature → `kind: 'ground_public_access'`, `subkind: 'blm'`, `name` from `ADMIN_UNIT_NAME` or `Name`, `agency: 'BLM'`, `attribution: 'BLM'`.

`fetchPublicAccess`: if zoom < 7 return empty; `Promise.all` OSM + BLM (BLM only if bbox intersects roughly US: west≥-180, east≤-50, south≥15, north≤72); merge with `capFeatures` 4000.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/layers/public-access.ts src/lib/layers/public-access.test.ts
git commit -m "feat(layers): public access OSM + BLM mappers"
```

---

### Task 4: Public access API route

**Files:**
- Create: `src/app/api/layers/public-access/route.ts`

- [ ] **Step 1: Implement** like trails route calling `fetchPublicAccess`, zoom gate `PUBLIC_ACCESS_MIN_ZOOM`, cache key `public-access-v1`.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/layers/public-access/route.ts
git commit -m "feat(api): /api/layers/public-access viewport feed"
```

---

### Task 5: Register ground keys + LayerPanel + page defaults

**Files:**
- Modify: `src/lib/ground-layers-client.ts` — add `trails`, `public_access` to keys / min zoom / API
- Modify: `src/lib/ground-layers-client.test.ts` — hyphenated `public-access` path; zoom cases
- Modify: `src/components/LayerPanel.tsx` — GROUND entries after `abandoned` or near freight:
  - `{ key: 'trails', label: 'Trails', description: 'Cycle · hike · foot · disused rail' }`
  - `{ key: 'public_access', label: 'Public Access Land', description: 'Parks · protected · BLM' }`
- Modify: `src/app/page.tsx` — `trails: false`, `public_access: false`

- [ ] **Step 1: Apply registry + UI defaults**
- [ ] **Step 2: Run** `npx vitest run src/lib/ground-layers-client.test.ts` — PASS
- [ ] **Step 3: Commit**

```bash
git add src/lib/ground-layers-client.ts src/lib/ground-layers-client.test.ts src/components/LayerPanel.tsx src/app/page.tsx
git commit -m "feat(ui): register Trails and Public Access Land layers"
```

---

### Task 6: OsirisMap render + popups

**Files:**
- Modify: `src/components/OsirisMap.tsx`

**Colors:** `trails: '#66BB6A'`, `public_access: '#26A69A'`

**Layers:**
- `trails`: line only; optionally `line-color` by `['match', ['get', 'subkind'], ...]` (cycle `#43A047`, hike `#FFA726`, foot `#4FC3F7`, bridle `#8D6E63`, rail_trail `#C0A062`, other `#66BB6A`).
- `public_access`: fill (`fill-opacity` 0.2) + outline line; color match on `subkind` (blm `#D4A574`, park `#66BB6A`, protected `#26A69A`, …).
- Add `ground-trails-line`, `ground-public_access-fill`, `ground-public_access-line` to hover cursor list and `groundPopupLayers`.
- Popup: trails → name + subkind; public_access → name + agency + subkind + short “Public passage land — not a permit.”
- Effect deps: `activeLayers.trails`, `activeLayers.public_access`.

- [ ] **Step 1: Wire sources (auto via GROUND_LAYER_KEYS loop) + paint branches**
- [ ] **Step 2: Manual smoke when pack/dev available — toggle both at z9 over Colorado / Utah**
- [ ] **Step 3: Commit**

```bash
git add src/components/OsirisMap.tsx
git commit -m "feat(map): render Trails lines and Public Access fills"
```

---

### Task 7: Portable + Desktop sync

- [ ] **Step 1:** `npm run desktop:pack` (webpack build)
- [ ] **Step 2:** Robocopy `desktop/dist/win-unpacked` → `C:\Users\Home\Desktop\Osiris`
- [ ] **Step 3:** Keep portable `desktop/dist/Osiris 0.1.0.exe`; optionally remove `win-unpacked` after sync to save disk

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Two toggles `trails` / `public_access` | 5 |
| OSM trail highways + abandoned rail | 1 |
| Skip private / no foot+bike | 1 |
| Zoom ≥ 8 trails / ≥ 7 land | 1–4 |
| OSM parks / protected | 3 |
| BLM SMA | 3–4 |
| Soft-fail | 1–4 |
| Map styles + popups | 6 |
| Off by default | 5 |
| Non-goals (no live users, keep abandoned) | respected |

## Placeholder scan

None intentional; BLM layer id `2` on Cached_BLM_Only verified against BLM service docs — if query 404s, fall back to LimitedScale identify layer and retest URL in Task 3.
