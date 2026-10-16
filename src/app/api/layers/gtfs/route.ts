import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { httpBuffer } from '@/lib/httpJson';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import {
  agenciesForBbox,
  decodeVehiclePositions,
  mergeGtfsFc,
  type GtfsAgency,
} from '@/lib/layers/gtfs';
import { enrichAgencyVehicles } from '@/lib/layers/gtfs-static';
import { resolveTrainVehicleUrl, trainFetchHeaders } from '@/lib/layers/trains';
import type { BBox } from '@/lib/layers/types';

const REGISTRY_PATH = join(process.cwd(), 'public', 'data', 'layers', 'gtfs-agencies.json');

async function loadRegistry(): Promise<GtfsAgency[]> {
  try {
    const raw = await readFile(REGISTRY_PATH, 'utf8');
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as GtfsAgency[]) : [];
  } catch {
    return [];
  }
}

async function fetchAgencyFc(agency: GtfsAgency, bbox: BBox) {
  const url = resolveTrainVehicleUrl(agency);
  if (!url) return emptyFc();
  try {
    const buf = await httpBuffer(url, {
      timeoutMs: 15_000,
      headers: trainFetchHeaders(agency),
    });
    const fc = decodeVehiclePositions(buf, agency, bbox);
    return enrichAgencyVehicles(fc, agency);
  } catch {
    return emptyFc();
  }
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('gtfs', bbox);
  const fc = await cachedFc(key, 10_000, async () => {
    const registry = await loadRegistry();
    const agencies = agenciesForBbox(registry, bbox);
    if (agencies.length === 0) return emptyFc();
    const parts = await Promise.all(agencies.map((a) => fetchAgencyFc(a, bbox)));
    return mergeGtfsFc(parts);
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=10' } });
}
