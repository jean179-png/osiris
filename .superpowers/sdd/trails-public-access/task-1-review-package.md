# Review package Task 1 (re-review)
BASE: 9655e85
HEAD: 9feebd773857ce7ea464fb293c370a37ea54b792

## Commits
9feebd7 fix(layers): cover fetchTrails zoom/fail and trails cap
7b20937 feat(layers): OSM trails Overpass mapper

## Stat
 src/lib/layers/trails.test.ts | 98 +++++++++++++++++++++++++++++++++++++++++++
 src/lib/layers/trails.ts      | 84 +++++++++++++++++++++++++++++++++++++
 2 files changed, 182 insertions(+)

## Diff
```diff
diff --git a/src/lib/layers/trails.test.ts b/src/lib/layers/trails.test.ts
new file mode 100644
index 0000000..b83445a
--- /dev/null
+++ b/src/lib/layers/trails.test.ts
@@ -0,0 +1,98 @@
+import { vi, describe, it, expect, beforeEach } from 'vitest';
+
+vi.mock('./overpass', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('./overpass')>();
+  return {
+    ...actual,
+    overpassQuery: vi.fn(),
+  };
+});
+
+import { overpassQuery } from './overpass';
+import {
+  trailsQl,
+  mapTrailsToFc,
+  TRAILS_MIN_ZOOM,
+  fetchTrails,
+} from './trails';
+
+const sampleBbox = { west: -105.3, south: 39.9, east: -105.2, north: 40.0 };
+
+function trailWay(id: number) {
+  return {
+    type: 'way' as const,
+    id,
+    tags: { highway: 'path' },
+    geometry: [
+      { lat: 40, lon: -105 + id * 0.00001 },
+      { lat: 40.01, lon: -105.01 + id * 0.00001 },
+    ],
+  };
+}
+
+describe('TRAILS_MIN_ZOOM', () => {
+  it('is 8', () => expect(TRAILS_MIN_ZOOM).toBe(8));
+});
+
+describe('trailsQl', () => {
+  it('fills bbox and path selectors', () => {
+    const ql = trailsQl(sampleBbox);
+    expect(ql).toContain('39.9,-105.3,40,-105.2');
+    expect(ql).toContain('highway"~"^(path|footway|cycleway|bridleway)$"');
+    expect(ql).toContain('railway"~"^(abandoned|disused)$"');
+  });
+});
+
+describe('mapTrailsToFc', () => {
+  it('maps ways, assigns subkind, skips private', () => {
+    const fc = mapTrailsToFc({
+      elements: [
+        {
+          type: 'way', id: 1,
+          tags: { highway: 'cycleway', name: 'Creek Path' },
+          geometry: [{ lat: 40, lon: -105.25 }, { lat: 40.01, lon: -105.24 }],
+        },
+        {
+          type: 'way', id: 2,
+          tags: { highway: 'path', access: 'private' },
+          geometry: [{ lat: 40, lon: -105 }, { lat: 40.01, lon: -105.01 }],
+        },
+        {
+          type: 'way', id: 3,
+          tags: { railway: 'abandoned', name: 'Old Grade' },
+          geometry: [{ lat: 39.95, lon: -105.2 }, { lat: 39.96, lon: -105.19 }],
+        },
+      ],
+    });
+    expect(fc.features).toHaveLength(2);
+    expect(fc.features[0]!.properties?.subkind).toBe('cycle');
+    expect(fc.features[1]!.properties?.subkind).toBe('rail_trail');
+    expect(fc.features[0]!.properties?.kind).toBe('ground_trails');
+    expect(fc.features[0]!.properties?.attribution).toBe('OpenStreetMap');
+  });
+
+  it('caps at 4000 features', () => {
+    const elements = Array.from({ length: 4001 }, (_, i) => trailWay(i + 1));
+    const fc = mapTrailsToFc({ elements });
+    expect(fc.features).toHaveLength(4000);
+  });
+});
+
+describe('fetchTrails', () => {
+  beforeEach(() => {
+    vi.mocked(overpassQuery).mockReset();
+  });
+
+  it('returns empty FC when zoom is below TRAILS_MIN_ZOOM', async () => {
+    const fc = await fetchTrails(sampleBbox, TRAILS_MIN_ZOOM - 1);
+    expect(fc.features).toHaveLength(0);
+    expect(overpassQuery).not.toHaveBeenCalled();
+  });
+
+  it('returns empty FC when overpass fails', async () => {
+    vi.mocked(overpassQuery).mockRejectedValue(new Error('overpass timeout'));
+    const fc = await fetchTrails(sampleBbox, TRAILS_MIN_ZOOM);
+    expect(fc.features).toHaveLength(0);
+    expect(overpassQuery).toHaveBeenCalledTimes(1);
+  });
+});
diff --git a/src/lib/layers/trails.ts b/src/lib/layers/trails.ts
new file mode 100644
index 0000000..6a932bc
--- /dev/null
+++ b/src/lib/layers/trails.ts
@@ -0,0 +1,84 @@
+import type { Feature, FeatureCollection, LineString, Position } from 'geojson';
+import type { BBox } from './types';
+import { fillBbox, overpassQuery } from './overpass';
+import { featureOf, emptyFc, capFeatures } from './geojson';
+
+export const TRAILS_MIN_ZOOM = 8;
+
+const TRAILS_QL = `[out:json][timeout:25];
+(
+  way["highway"~"^(path|footway|cycleway|bridleway)$"]({{bbox}});
+  way["route"~"^(hiking|foot|bicycle)$"]({{bbox}});
+  way["railway"~"^(abandoned|disused)$"]({{bbox}});
+);
+out geom;
+`;
+
+export function trailsQl(bbox: BBox): string {
+  return fillBbox(TRAILS_QL, bbox);
+}
+
+function wayLineGeometry(el: any): LineString | null {
+  const geom = el?.geometry;
+  if (!Array.isArray(geom) || geom.length < 2) return null;
+  const coordinates: Position[] = [];
+  for (const g of geom) {
+    if (!Number.isFinite(g?.lat) || !Number.isFinite(g?.lon)) continue;
+    coordinates.push([g.lon, g.lat]);
+  }
+  return coordinates.length < 2 ? null : { type: 'LineString', coordinates };
+}
+
+function denied(tags: Record<string, string>): boolean {
+  if (tags.access === 'private' || tags.access === 'no') return true;
+  if (tags.foot === 'no' && tags.bicycle === 'no') return true;
+  return false;
+}
+
+export type TrailSubkind = 'cycle' | 'hike' | 'foot' | 'bridle' | 'rail_trail' | 'other';
+
+export function trailSubkind(tags: Record<string, string>): TrailSubkind {
+  const rw = tags.railway;
+  if (rw === 'abandoned' || rw === 'disused') return 'rail_trail';
+  const hw = tags.highway;
+  if (hw === 'cycleway' || tags.route === 'bicycle') return 'cycle';
+  if (hw === 'bridleway') return 'bridle';
+  if (hw === 'footway' || tags.route === 'foot') return 'foot';
+  if (tags.route === 'hiking' || tags.sac_scale) return 'hike';
+  if (hw === 'path') return 'hike';
+  return 'other';
+}
+
+export function mapTrailsToFc(data: any): FeatureCollection {
+  const elements = data?.elements;
+  if (!Array.isArray(elements)) return emptyFc();
+  const features: Feature[] = [];
+  for (const el of elements) {
+    if (el?.type !== 'way') continue;
+    const tags = (el?.tags ?? {}) as Record<string, string>;
+    if (denied(tags)) continue;
+    const line = wayLineGeometry(el);
+    if (!line) continue;
+    const id = el?.id ?? features.length;
+    features.push(featureOf(`trail-${id}`, line, {
+      kind: 'ground_trails',
+      subkind: trailSubkind(tags),
+      name: tags.name ?? tags['name:en'] ?? null,
+      highway: tags.highway ?? null,
+      railway: tags.railway ?? null,
+      route: tags.route ?? null,
+      osmId: id,
+      attribution: 'OpenStreetMap',
+    }));
+  }
+  return capFeatures({ type: 'FeatureCollection', features }, 4000);
+}
+
+export async function fetchTrails(bbox: BBox, zoom: number): Promise<FeatureCollection> {
+  if (zoom < TRAILS_MIN_ZOOM) return emptyFc();
+  try {
+    return mapTrailsToFc(await overpassQuery(trailsQl(bbox)));
+  } catch {
+    return emptyFc();
+  }
+}
```
