import { NextRequest, NextResponse } from 'next/server';
import { httpJson } from '@/lib/httpJson';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import {
  paleoCoastAges,
  paleoCoastAttribution,
  paleoCoastUpstreamUrl,
  nearestPaleoAge,
} from '@/lib/paleo-coasts';
import type { FeatureCollection } from 'geojson';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/layers/paleo-coast?catalog=1
 * GET /api/layers/paleo-coast?age=58.4
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('catalog') === '1') {
    const ages = paleoCoastAges();
    return NextResponse.json(
      { ages, latest: ages[0] ?? null },
      { headers: { 'Cache-Control': 'public, s-maxage=86400' } },
    );
  }

  const raw = req.nextUrl.searchParams.get('age');
  const ages = paleoCoastAges();
  const age = raw != null && raw !== '' ? Number(raw) : ages[0];
  if (!Number.isFinite(age)) {
    return NextResponse.json({ error: 'Invalid age' }, { status: 400 });
  }
  const snapped = nearestPaleoAge(ages, age);
  const url = paleoCoastUpstreamUrl(snapped);
  if (!url) {
    return NextResponse.json({ error: 'Unknown age' }, { status: 400 });
  }

  try {
    const fc = await cachedFc(`paleo-coast:${snapped}`, 24 * 60 * 60_000, async () => {
      const data = await httpJson<FeatureCollection>(url, { timeoutMs: 45_000 });
      if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        return emptyFc();
      }
      return data;
    });
    return NextResponse.json(fc, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600',
        'X-Paleo-Age-Ma': String(snapped),
        'X-Attribution': paleoCoastAttribution(),
      },
    });
  } catch (err) {
    console.warn('[paleo-coast]', err instanceof Error ? err.message : err);
    return NextResponse.json(emptyFc(), {
      headers: {
        'Cache-Control': 'public, s-maxage=60',
        'X-Attribution': paleoCoastAttribution(),
      },
    });
  }
}
