import { NextRequest, NextResponse } from 'next/server';
import { httpJson } from '@/lib/httpJson';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import {
  LEYLINES_ATTRIBUTION,
  gridUrl,
  parseGridFamily,
  type GridFamily,
} from '@/lib/leylines-catalog';
import { czmlPolylinesToFeatureCollection } from '@/lib/leylines-czml';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TTL_MS = 24 * 60 * 60_000;

/** GET /api/layers/leylines/grid?family=gravity-wells */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('family');
  if (raw != null && raw !== '' && parseGridFamily(raw) == null) {
    return NextResponse.json({ error: 'Invalid family' }, { status: 400 });
  }
  const family: GridFamily = parseGridFamily(raw) ?? 'gravity-wells';

  try {
    const fc = await cachedFc(`leylines:grid:${family}`, TTL_MS, async () => {
      const czml = await httpJson<unknown>(gridUrl(family), { timeoutMs: 30_000 });
      return czmlPolylinesToFeatureCollection(czml, {
        name: 'Gravity Wells',
        source: 'grid',
        slug: family,
      });
    });
    return NextResponse.json(fc, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600',
        'X-Attribution': LEYLINES_ATTRIBUTION,
      },
    });
  } catch (err) {
    console.warn('[leylines/grid]', err instanceof Error ? err.message : err);
    return NextResponse.json(emptyFc(), {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60',
        'X-Attribution': LEYLINES_ATTRIBUTION,
      },
    });
  }
}
