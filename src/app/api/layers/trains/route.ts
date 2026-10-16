import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { mergeGtfsFc, type GtfsAgency } from '@/lib/layers/gtfs';
import {
  agenciesForBbox,
  fetchTrainAgencyVehicles,
  fetchTrainTracks,
  mergeTrainsFc,
} from '@/lib/layers/trains';

const REGISTRY_PATH = join(process.cwd(), 'public', 'data', 'layers', 'train-agencies.json');

async function loadRegistry(): Promise<GtfsAgency[]> {
  try {
    const raw = await readFile(REGISTRY_PATH, 'utf8');
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as GtfsAgency[]) : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const zRaw = Number(req.nextUrl.searchParams.get('z') ?? '0');
  const zoom = Number.isFinite(zRaw) ? zRaw : 0;

  const vehicleKey = bboxKey('trains-vehicles', bbox);
  const trackKey = bboxKey('trains-tracks-v2', bbox);

  const vehiclesFc = await cachedFc(vehicleKey, 15_000, async () => {
    const registry = await loadRegistry();
    const agencies = agenciesForBbox(registry, bbox);
    if (agencies.length === 0) return emptyFc();
    const parts = await Promise.all(agencies.map((a) => fetchTrainAgencyVehicles(a, bbox)));
    return mergeGtfsFc(parts);
  });

  const tracksFc = await cachedFc(trackKey, 10 * 60_000, async () => fetchTrainTracks(bbox, zoom));

  const fc = mergeTrainsFc(vehiclesFc, tracksFc);
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=10' } });
}
