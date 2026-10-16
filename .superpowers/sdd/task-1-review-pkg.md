# Review package Task 1
BASE: 8d9baa2c144625547317e433fb7e9cf29c9f4d69
HEAD: 87b4e33b41b6ad05e6c7c82e27048a6faff2a78a

## Log
87b4e33 fix(layers): expand west with floor in roundBbox
14fc328 feat(layers): shared bbox, cache, and GeoJSON helpers


## Stat
 src/lib/layers/bbox.test.ts  | 26 ++++++++++++++++++++++++++
 src/lib/layers/bbox.ts       | 28 ++++++++++++++++++++++++++++
 src/lib/layers/cache.test.ts | 18 ++++++++++++++++++
 src/lib/layers/cache.ts      | 30 ++++++++++++++++++++++++++++++
 src/lib/layers/geojson.ts    | 32 ++++++++++++++++++++++++++++++++
 src/lib/layers/types.ts      |  1 +
 6 files changed, 135 insertions(+)


## Diff
```diff
diff --git a/src/lib/layers/bbox.test.ts b/src/lib/layers/bbox.test.ts
new file mode 100644
index 0000000..eec1c84
--- /dev/null
+++ b/src/lib/layers/bbox.test.ts
@@ -0,0 +1,26 @@
+// src/lib/layers/bbox.test.ts
+import { describe, it, expect } from 'vitest';
+import { parseBbox, roundBbox } from './bbox';
+
+describe('parseBbox', () => {
+  it('parses west,south,east,north', () => {
+    expect(parseBbox('-71.5,41.7,-71.2,42.0')).toEqual({
+      west: -71.5, south: 41.7, east: -71.2, north: 42.0,
+    });
+  });
+  it('rejects inverted or out-of-range', () => {
+    expect(parseBbox('1,2,0,3')).toBeNull();
+    expect(parseBbox('')).toBeNull();
+    expect(parseBbox(null)).toBeNull();
+  });
+});
+
+describe('roundBbox', () => {
+  it('rounds for cache keys', () => {
+    const r = roundBbox({ west: -71.12345, south: 41.98765, east: -71.1, north: 42.0 }, 2);
+    expect(r.west).toBe(-71.13);
+    expect(r.south).toBe(41.98);
+    expect(r.east).toBe(-71.09);
+    expect(r.north).toBe(42);
+  });
+});
diff --git a/src/lib/layers/bbox.ts b/src/lib/layers/bbox.ts
new file mode 100644
index 0000000..cf5b6c5
--- /dev/null
+++ b/src/lib/layers/bbox.ts
@@ -0,0 +1,28 @@
+import type { BBox } from './types';
+
+export function parseBbox(raw: string | null): BBox | null {
+  if (!raw) return null;
+  const parts = raw.split(',').map((s) => Number(s.trim()));
+  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
+  const [west, south, east, north] = parts;
+  if (west >= east || south >= north) return null;
+  if (west < -180 || east > 180 || south < -90 || north > 90) return null;
+  // Cap span to avoid world-sized Overpass bombs
+  if (east - west > 40 || north - south > 40) return null;
+  return { west, south, east, north };
+}
+
+export function roundBbox(b: BBox, decimals = 2): BBox {
+  const f = 10 ** decimals;
+  return {
+    west: Math.floor(b.west * f) / f,
+    south: Math.floor(b.south * f) / f,
+    east: Math.ceil(b.east * f) / f,
+    north: Math.ceil(b.north * f) / f,
+  };
+}
+
+export function bboxKey(layer: string, b: BBox): string {
+  const r = roundBbox(b);
+  return `${layer}:${r.west},${r.south},${r.east},${r.north}`;
+}
diff --git a/src/lib/layers/cache.test.ts b/src/lib/layers/cache.test.ts
new file mode 100644
index 0000000..972c27e
--- /dev/null
+++ b/src/lib/layers/cache.test.ts
@@ -0,0 +1,18 @@
+// src/lib/layers/cache.test.ts
+import { describe, it, expect, vi } from 'vitest';
+import { cachedFc, _resetLayerCacheForTests } from './cache';
+import { emptyFc } from './geojson';
+
+describe('cachedFc', () => {
+  it('dedupes inflight and serves TTL', async () => {
+    _resetLayerCacheForTests();
+    let n = 0;
+    const fetcher = vi.fn(async () => { n++; return emptyFc(); });
+    const a = cachedFc('t', 60_000, fetcher);
+    const b = cachedFc('t', 60_000, fetcher);
+    await Promise.all([a, b]);
+    expect(fetcher).toHaveBeenCalledTimes(1);
+    await cachedFc('t', 60_000, fetcher);
+    expect(fetcher).toHaveBeenCalledTimes(1);
+  });
+});
diff --git a/src/lib/layers/cache.ts b/src/lib/layers/cache.ts
new file mode 100644
index 0000000..f73d50f
--- /dev/null
+++ b/src/lib/layers/cache.ts
@@ -0,0 +1,30 @@
+import type { FeatureCollection } from 'geojson';
+
+type Entry = { fc: FeatureCollection; expiresAt: number; inflight: Promise<FeatureCollection> | null };
+const store = new Map<string, Entry>();
+
+export function _resetLayerCacheForTests(): void { store.clear(); }
+
+export async function cachedFc(
+  key: string,
+  ttlMs: number,
+  fetcher: () => Promise<FeatureCollection>,
+): Promise<FeatureCollection> {
+  const now = Date.now();
+  const hit = store.get(key);
+  if (hit && now < hit.expiresAt) return hit.fc;
+  if (hit?.inflight) return hit.inflight;
+  const inflight = fetcher()
+    .then((fc) => {
+      store.set(key, { fc, expiresAt: Date.now() + ttlMs, inflight: null });
+      return fc;
+    })
+    .catch((err) => {
+      const stale = store.get(key)?.fc;
+      store.set(key, { fc: stale ?? { type: 'FeatureCollection', features: [] }, expiresAt: Date.now() + Math.min(ttlMs, 30_000), inflight: null });
+      console.warn('[layers-cache]', key, err);
+      return store.get(key)!.fc;
+    });
+  store.set(key, { fc: hit?.fc ?? { type: 'FeatureCollection', features: [] }, expiresAt: 0, inflight });
+  return inflight;
+}
diff --git a/src/lib/layers/geojson.ts b/src/lib/layers/geojson.ts
new file mode 100644
index 0000000..85ca765
--- /dev/null
+++ b/src/lib/layers/geojson.ts
@@ -0,0 +1,32 @@
+import type { Feature, FeatureCollection, Geometry } from 'geojson';
+
+export function emptyFc(): FeatureCollection {
+  return { type: 'FeatureCollection', features: [] };
+}
+
+export function pointFeature(
+  id: string | number,
+  lng: number,
+  lat: number,
+  properties: Record<string, unknown>,
+): Feature {
+  return {
+    type: 'Feature',
+    id,
+    geometry: { type: 'Point', coordinates: [lng, lat] },
+    properties: { ...properties, id },
+  };
+}
+
+export function featureOf(
+  id: string | number,
+  geometry: Geometry,
+  properties: Record<string, unknown>,
+): Feature {
+  return { type: 'Feature', id, geometry, properties: { ...properties, id } };
+}
+
+export function capFeatures(fc: FeatureCollection, max: number): FeatureCollection {
+  if (fc.features.length <= max) return fc;
+  return { type: 'FeatureCollection', features: fc.features.slice(0, max) };
+}
diff --git a/src/lib/layers/types.ts b/src/lib/layers/types.ts
new file mode 100644
index 0000000..1cacbe1
--- /dev/null
+++ b/src/lib/layers/types.ts
@@ -0,0 +1 @@
+export interface BBox { west: number; south: number; east: number; north: number; }

```
