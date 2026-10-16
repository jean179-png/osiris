import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import {
  FREIGHT_RAIL_MIN_ZOOM,
  fetchFreightRail,
} from '@/lib/layers/freight-rail';

const TTL_MS = 10 * 60_000;

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());

  const zRaw = req.nextUrl.searchParams.get('z');
  const z = zRaw != null ? Number(zRaw) : NaN;
  if (!Number.isFinite(z) || z < FREIGHT_RAIL_MIN_ZOOM) {
    return NextResponse.json(emptyFc());
  }

  const key = bboxKey('freight-rail-v1', bbox);
  const fc = await cachedFc(key, TTL_MS, async () => fetchFreightRail(bbox, z));
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
