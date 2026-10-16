import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { emptyFc } from '@/lib/layers/geojson';
import type { GtfsAgency } from '@/lib/layers/gtfs';
import { tripShapeFeatureCollection } from '@/lib/layers/gtfs-static';

const REGISTRY_PATHS = [
  join(process.cwd(), 'public', 'data', 'layers', 'train-agencies.json'),
  join(process.cwd(), 'public', 'data', 'layers', 'gtfs-agencies.json'),
];

async function findAgency(id: string): Promise<GtfsAgency | null> {
  for (const path of REGISTRY_PATHS) {
    try {
      const raw = await readFile(path, 'utf8');
      const data = JSON.parse(raw) as unknown;
      if (!Array.isArray(data)) continue;
      const hit = (data as GtfsAgency[]).find((a) => a?.id === id && !a.disabled);
      if (hit?.staticGtfsUrl) return hit;
    } catch {
      /* try next registry */
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const agencyId = req.nextUrl.searchParams.get('agency')?.trim() ?? '';
  const tripId = req.nextUrl.searchParams.get('tripId')?.trim() || null;
  const routeId = req.nextUrl.searchParams.get('routeId')?.trim() || null;
  const stopId = req.nextUrl.searchParams.get('stopId')?.trim() || null;
  const stopSequenceRaw = req.nextUrl.searchParams.get('stopSequence');
  const stopSequence =
    stopSequenceRaw != null && stopSequenceRaw !== ''
      ? Number(stopSequenceRaw)
      : null;
  if (!agencyId || (!tripId && !routeId)) {
    return NextResponse.json(emptyFc());
  }
  const agency = await findAgency(agencyId);
  if (!agency) return NextResponse.json(emptyFc());

  const fc = await tripShapeFeatureCollection(agency, tripId, routeId, {
    currentStopId: stopId,
    currentStopSequence: Number.isFinite(stopSequence) ? stopSequence : null,
  });
  return NextResponse.json(fc, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
