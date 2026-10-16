import { NextResponse } from 'next/server';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { mapNhcCurrentStorms } from '@/lib/layers/storms';
import { httpJson } from '@/lib/httpJson';

export async function GET() {
  const fc = await cachedFc('nhc-storms', 10 * 60_000, async () => {
    try {
      const data = await httpJson<unknown>('https://www.nhc.noaa.gov/CurrentStorms.json', {
        timeoutMs: 15_000,
      });
      return mapNhcCurrentStorms(data);
    } catch (err) {
      console.warn('[storms]', err instanceof Error ? err.message : err);
      return emptyFc();
    }
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=120' } });
}
