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
