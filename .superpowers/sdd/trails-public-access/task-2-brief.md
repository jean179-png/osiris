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

