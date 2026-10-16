import { NextRequest, NextResponse } from 'next/server';
import { httpJson } from '@/lib/httpJson';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { mergeGtfsFc } from '@/lib/layers/gtfs';
import { mapIbiIncidents } from '@/lib/layers/road-incidents';
import type { BBox } from '@/lib/layers/types';
import type { FeatureCollection } from 'geojson';
import {
  mapTomTomIncidents,
  tomtomApiKey,
  tomtomIncidentDetailsUrl,
} from '@/lib/tomtom-traffic';

export const dynamic = 'force-dynamic';

type Source = { id: string; url: string; bbox: BBox };

/** Open 511 / DOT incident endpoints (soft-fail individually). */
const SOURCES: Source[] = [
  {
    id: 'fl511',
    url: 'https://fl511.com/api/v2/get/event',
    bbox: { west: -87.6, south: 24.4, east: -79.8, north: 31.1 },
  },
  {
    id: 'va511',
    url: 'https://www.511virginia.org/data/geojson/icons.travelerWarnings.geojson',
    bbox: { west: -83.7, south: 36.5, east: -75.2, north: 39.5 },
  },
  {
    id: 'ia511',
    url: 'https://lb.511ia.org/ialb/incidents.json',
    bbox: { west: -96.7, south: 40.3, east: -90.1, north: 43.6 },
  },
  {
    id: 'mn511',
    url: 'https://lb.511mn.org/mnlb/incidents.json',
    bbox: { west: -97.3, south: 43.4, east: -89.4, north: 49.4 },
  },
  {
    id: 'ne511',
    url: 'https://lb.511.nebraska.gov/nelb/incidents.json',
    bbox: { west: -104.1, south: 39.9, east: -95.3, north: 43.1 },
  },
];

function intersects(a: BBox, b: BBox): boolean {
  return a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;
}

async function fetchSource(src: Source, bbox: BBox): Promise<FeatureCollection> {
  if (!intersects(src.bbox, bbox)) return emptyFc();
  try {
    const res = await fetch(src.url, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'osiris-layers/1.0', Accept: 'application/json, application/geo+json, */*' },
    });
    if (!res.ok) return emptyFc();
    return mapIbiIncidents(await res.json(), src.id, bbox);
  } catch {
    return emptyFc();
  }
}

async function fetchTomTom(bbox: BBox): Promise<FeatureCollection> {
  const key = tomtomApiKey();
  if (!key) return emptyFc();
  try {
    // Node https — undici fetch to TomTom often fails from the Next runtime.
    const data = await httpJson<unknown>(tomtomIncidentDetailsUrl(bbox, key), {
      timeoutMs: 18_000,
      headers: { Accept: 'application/json' },
    });
    return mapTomTomIncidents(data, bbox, 2000);
  } catch {
    return emptyFc();
  }
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('road-incidents', bbox);
  const fc = await cachedFc(key, 60_000, async () => {
    const parts = await Promise.all([
      ...SOURCES.map((s) => fetchSource(s, bbox)),
      fetchTomTom(bbox),
    ]);
    return mergeGtfsFc(parts, 2500);
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=30' } });
}
