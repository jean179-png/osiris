import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { mergeGtfsFc } from '@/lib/layers/gtfs';
import { fetchGbfsSystem, systemsForBbox, type GbfsSystem } from '@/lib/layers/gbfs';

const REGISTRY_PATH = join(process.cwd(), 'public', 'data', 'layers', 'gbfs-systems.json');

async function loadRegistry(): Promise<GbfsSystem[]> {
  try {
    const raw = await readFile(REGISTRY_PATH, 'utf8');
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as GbfsSystem[]) : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('gbfs', bbox);
  const fc = await cachedFc(key, 30_000, async () => {
    const registry = await loadRegistry();
    const systems = systemsForBbox(registry, bbox);
    if (systems.length === 0) return emptyFc();
    const parts = await Promise.all(systems.map((s) => fetchGbfsSystem(s, bbox)));
    return mergeGtfsFc(parts, 5000);
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=15' } });
}
