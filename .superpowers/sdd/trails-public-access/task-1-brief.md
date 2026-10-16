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

- [ ] **Step 2: Run tests â€” expect FAIL (module missing)**

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

- [ ] **Step 4: Run tests â€” expect PASS**

Run: `npx vitest run src/lib/layers/trails.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/layers/trails.ts src/lib/layers/trails.test.ts
git commit -m "feat(layers): OSM trails Overpass mapper"
```

---

