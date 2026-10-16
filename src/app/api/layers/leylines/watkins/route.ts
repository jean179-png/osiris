import { NextResponse } from 'next/server';
import type { FeatureCollection } from 'geojson';
import { httpJson } from '@/lib/httpJson';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import {
  LEYLINES_WATKINS_ATTRIBUTION,
  WATKINS_LEYS,
  watkinsUrl,
} from '@/lib/leylines-catalog';
import { czmlPolylinesToFeatureCollection } from '@/lib/leylines-czml';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TTL_MS = 24 * 60 * 60_000;

async function fetchWatkinsFc(): Promise<FeatureCollection> {
  const features: FeatureCollection['features'] = [];
  await Promise.all(
    WATKINS_LEYS.map(async (entry) => {
      try {
        const czml = await httpJson<unknown>(watkinsUrl(entry), { timeoutMs: 20_000 });
        const fc = czmlPolylinesToFeatureCollection(czml, {
          name: entry.name,
          slug: entry.slug,
          source: 'watkins',
        });
        for (const f of fc.features) {
          if (f.properties && !f.properties.name) f.properties.name = entry.name;
          features.push(f);
        }
      } catch (err) {
        console.warn(
          '[leylines/watkins]',
          entry.slug,
          err instanceof Error ? err.message : err,
        );
      }
    }),
  );
  return { type: 'FeatureCollection', features };
}

/** GET /api/layers/leylines/watkins */
export async function GET() {
  try {
    const fc = await cachedFc('leylines:watkins:v1', TTL_MS, fetchWatkinsFc);
    return NextResponse.json(fc, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600',
        'X-Attribution': LEYLINES_WATKINS_ATTRIBUTION,
      },
    });
  } catch (err) {
    console.warn('[leylines/watkins]', err instanceof Error ? err.message : err);
    return NextResponse.json(emptyFc(), {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60',
        'X-Attribution': LEYLINES_WATKINS_ATTRIBUTION,
      },
    });
  }
}
