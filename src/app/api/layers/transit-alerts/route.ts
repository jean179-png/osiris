import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { agenciesForBbox, mergeGtfsFc, type GtfsAgency } from '@/lib/layers/gtfs';
import { fetchAgencyAlerts } from '@/lib/layers/gtfs-alerts';

const PATHS = [
  join(process.cwd(), 'public', 'data', 'layers', 'train-agencies.json'),
  join(process.cwd(), 'public', 'data', 'layers', 'gtfs-agencies.json'),
];

async function loadAgencies(): Promise<GtfsAgency[]> {
  const all: GtfsAgency[] = [];
  for (const path of PATHS) {
    try {
      const raw = await readFile(path, 'utf8');
      const data = JSON.parse(raw) as unknown;
      if (Array.isArray(data)) all.push(...(data as GtfsAgency[]));
    } catch {
      /* skip */
    }
  }
  return all.filter((a) => !!a.alertUrl && !a.disabled);
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('transit-alerts', bbox);
  const fc = await cachedFc(key, 45_000, async () => {
    const registry = await loadAgencies();
    // Also include MBTA alerts from the bus registry vehicle host pattern.
    const withAlerts = registry.filter((a) => a.alertUrl);
    const agencies = agenciesForBbox(withAlerts, bbox);
    if (agencies.length === 0) return emptyFc();
    const parts = await Promise.all(agencies.map((a) => fetchAgencyAlerts(a, bbox)));
    return mergeGtfsFc(parts, 500);
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=30' } });
}
