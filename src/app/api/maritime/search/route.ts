import { NextRequest, NextResponse } from 'next/server';
import { searchMaritimeShips, type SearchBBox, type SearchScope } from '@/lib/maritime-ais-cache';

export const dynamic = 'force-dynamic';

const VESSEL_CLASSES = new Set([
  'all',
  'yacht',
  'passenger',
  'cargo',
  'tanker',
  'fishing',
  'military',
  'highspeed',
]);

function parseBbox(raw: string | null): SearchBBox | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts as [number, number, number, number];
  if (!(west < east && south < north)) return null;
  return { west, south, east, north };
}

/** GET /api/maritime/search?q=&lat=&lng=&bbox=&class=yacht&scope=viewport|all */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const classRaw = (req.nextUrl.searchParams.get('class') || 'all').toLowerCase();
  const vesselClass = VESSEL_CLASSES.has(classRaw) ? classRaw : 'all';
  const scopeRaw = (req.nextUrl.searchParams.get('scope') || 'viewport').toLowerCase();
  const scope: SearchScope = scopeRaw === 'all' ? 'all' : 'viewport';
  const browse = q.length < 2;
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  const near =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));

  if (browse && scope === 'viewport' && !near && !bbox) {
    return NextResponse.json({ results: [], total: 0, source: 'ais', scope });
  }
  if (browse && q.length === 1) {
    return NextResponse.json({ results: [], total: 0, source: 'ais', scope });
  }

  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '8');
  const limit = Number.isFinite(limitRaw) ? Math.min(30, Math.max(1, limitRaw)) : 8;
  try {
    const results = await searchMaritimeShips(
      q,
      limit,
      near,
      vesselClass === 'all' ? (browse ? 'all' : null) : vesselClass,
      scope,
      bbox,
    );
    return NextResponse.json(
      { results, total: results.length, source: 'ais', class: vesselClass, scope },
      { headers: { 'Cache-Control': 'public, s-maxage=5' } },
    );
  } catch {
    return NextResponse.json({ results: [], total: 0, source: 'ais', scope });
  }
}
