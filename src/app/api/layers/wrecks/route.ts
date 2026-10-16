import { NextRequest, NextResponse } from 'next/server';
import { httpJson } from '@/lib/httpJson';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { fetchOsmWrecks, mapNoaaWrecksToFc } from '@/lib/layers/wrecks';

const NOAA_HOSTS = [
  'https://gis.charttools.noaa.gov/arcgis/rest/services/public_wrecks/Wrecks_And_Obstructions/MapServer/0/query',
] as const;

function noaaQueryUrl(base: string, geometry: string): string {
  return (
    base +
    '?' +
    new URLSearchParams({
      where: '1=1',
      geometry,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      f: 'geojson',
      resultRecordCount: '2000',
    }).toString()
  );
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('wrecks', bbox);
  const fc = await cachedFc(key, 5 * 60_000, async () => {
    const geometry = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;

    // NOAA ArcGIS is the preferred source — but the public_wrecks MapServer
    // is often "not started" or returns HTML. Fall through to OSM seamarks.
    for (const host of NOAA_HOSTS) {
      try {
        const data = await httpJson<Record<string, unknown>>(noaaQueryUrl(host, geometry), {
          timeoutMs: 12_000,
          headers: { Accept: 'application/json,application/geo+json' },
        });
        if (data && typeof data === 'object' && 'error' in data) continue;
        const mapped = mapNoaaWrecksToFc(data);
        if (mapped.features.length > 0) return mapped;
      } catch {
        /* try next / OSM */
      }
    }

    try {
      return await fetchOsmWrecks(bbox);
    } catch (err) {
      console.warn('[wrecks] OSM fallback failed', err instanceof Error ? err.message : err);
      return emptyFc();
    }
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
