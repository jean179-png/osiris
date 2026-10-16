# Review package Task 2
BASE: 9feebd7
HEAD: 5d9ffba714ea7708a3a2c3ce3bf8e56136b0e48e

## Commits
5d9ffba feat(api): /api/layers/trails viewport feed

## Stat
 src/app/api/layers/trails/route.ts | 16 ++++++++++++++++
 1 file changed, 16 insertions(+)

## Diff
```diff
diff --git a/src/app/api/layers/trails/route.ts b/src/app/api/layers/trails/route.ts
new file mode 100644
index 0000000..a944d00
--- /dev/null
+++ b/src/app/api/layers/trails/route.ts
@@ -0,0 +1,16 @@
+import { NextRequest, NextResponse } from 'next/server';
+import { parseBbox, bboxKey } from '@/lib/layers/bbox';
+import { cachedFc } from '@/lib/layers/cache';
+import { emptyFc } from '@/lib/layers/geojson';
+import { TRAILS_MIN_ZOOM, fetchTrails } from '@/lib/layers/trails';
+
+const TTL_MS = 10 * 60_000;
+
+export async function GET(req: NextRequest) {
+  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
+  if (!bbox) return NextResponse.json(emptyFc());
+  const z = Number(req.nextUrl.searchParams.get('z') ?? NaN);
+  if (!Number.isFinite(z) || z < TRAILS_MIN_ZOOM) return NextResponse.json(emptyFc());
+  const fc = await cachedFc(bboxKey('trails-v1', bbox), TTL_MS, () => fetchTrails(bbox, z));
+  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
+}
```
