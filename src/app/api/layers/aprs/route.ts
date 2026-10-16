import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc, pointFeature, capFeatures } from '@/lib/layers/geojson';
import type { FeatureCollection } from 'geojson';

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = process.env.APRS_FI_API_KEY;
  if (!key) return NextResponse.json(emptyFc());

  const cacheKey = bboxKey('aprs', bbox);
  const fc = await cachedFc(cacheKey, 60_000, async () => {
    try {
      const q = new URLSearchParams({
        name: 'osiris',
        what: 'loc',
        apikey: key,
        format: 'json',
        b: String(bbox.north),
        w: String(bbox.west),
        s: String(bbox.south),
        e: String(bbox.east),
      });
      const res = await fetch(`https://api.aprs.fi/api/get?${q}`, {
        signal: AbortSignal.timeout(12_000),
        headers: { 'User-Agent': 'osiris-layers/1.0', Accept: 'application/json' },
      });
      if (!res.ok) return emptyFc();
      const data = (await res.json()) as {
        entries?: {
          name?: string;
          lat?: string;
          lng?: string;
          comment?: string;
          speed?: string;
          altitude?: string;
          symbol?: string;
        }[];
      };
      const features = [];
      for (const e of data.entries ?? []) {
        const lat = Number(e.lat);
        const lng = Number(e.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        features.push(
          pointFeature(`aprs-${e.name || features.length}`, lng, lat, {
            kind: 'ground_aprs',
            name: e.name || 'APRS',
            title: e.name || 'APRS',
            comment: e.comment ?? null,
            speed: e.speed != null ? Number(e.speed) : null,
            altitude: e.altitude != null ? Number(e.altitude) : null,
            attribution: 'aprs.fi',
          }),
        );
      }
      return capFeatures({ type: 'FeatureCollection', features } as FeatureCollection, 2000);
    } catch {
      return emptyFc();
    }
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=30' } });
}
