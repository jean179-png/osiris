import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import {
  PUBLIC_ACCESS_MIN_ZOOM,
  fetchPublicAccess,
} from '@/lib/layers/public-access';

const TTL_MS = 10 * 60_000;

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const z = Number(req.nextUrl.searchParams.get('z') ?? NaN);
  if (!Number.isFinite(z) || z < PUBLIC_ACCESS_MIN_ZOOM) return NextResponse.json(emptyFc());
  const fc = await cachedFc(bboxKey('public-access-v1', bbox), TTL_MS, () =>
    fetchPublicAccess(bbox, z),
  );
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
