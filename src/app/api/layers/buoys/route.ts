import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { mapNdbcLatestObs } from '@/lib/layers/buoys';
import { httpText } from '@/lib/httpJson';

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('buoys', bbox);
  const fc = await cachedFc(key, 10 * 60_000, async () => {
    try {
      const text = await httpText('https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt', {
        timeoutMs: 25_000,
        headers: { Accept: 'text/plain' },
      });
      return mapNdbcLatestObs(text, bbox);
    } catch {
      return emptyFc();
    }
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=120' } });
}
