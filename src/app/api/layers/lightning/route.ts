import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { mapIemLsrGeoJson } from '@/lib/layers/lightning';
import { httpJson } from '@/lib/httpJson';

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('lightning', bbox);
  const fc = await cachedFc(key, 45_000, async () => {
    try {
      // Iowa Environmental Mesonet — recent lightning LSRs as GeoJSON
      const data = await httpJson<unknown>(
        'https://mesonet.agron.iastate.edu/geojson/lsr.php?hours=6&type=L',
        { timeoutMs: 20_000 },
      );
      return mapIemLsrGeoJson(data, bbox);
    } catch {
      return emptyFc();
    }
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=30' } });
}
