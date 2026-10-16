import { NextRequest, NextResponse } from 'next/server';
import { httpText } from '@/lib/httpJson';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import {
  GPSJAM_ATTRIBUTION,
  gpsJamRowsToFeatureCollection,
  latestManifestDate,
  parseGpsJamCsv,
  parseGpsJamManifest,
} from '@/lib/gpsjam';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BASE = 'https://gpsjam.org/data';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function fetchManifestDates(): Promise<string[]> {
  const csv = await httpText(`${BASE}/manifest.csv`, { timeoutMs: 20_000 });
  return parseGpsJamManifest(csv);
}

/**
 * GET /api/layers/gps-jam?date=YYYY-MM-DD
 * GET /api/layers/gps-jam?manifest=1  → { dates, latest }
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('manifest') === '1') {
    try {
      const dates = await fetchManifestDates();
      return NextResponse.json(
        { dates, latest: latestManifestDate(dates) },
        { headers: { 'Cache-Control': 'public, s-maxage=300' } },
      );
    } catch (err) {
      console.warn('[gps-jam] manifest', err instanceof Error ? err.message : err);
      return NextResponse.json({ dates: [], latest: null }, { status: 502 });
    }
  }

  let date = req.nextUrl.searchParams.get('date');
  if (date != null && date !== '' && !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  try {
    if (!date) {
      const dates = await fetchManifestDates();
      date = latestManifestDate(dates);
      if (!date) {
        return NextResponse.json(emptyFc(), {
          headers: {
            'Cache-Control': 'public, s-maxage=60',
            'X-Attribution': GPSJAM_ATTRIBUTION,
          },
        });
      }
    }

    const fc = await cachedFc(`gpsjam:${date}`, 60 * 60_000, async () => {
      const csv = await httpText(`${BASE}/${date}-h3_4.csv`, { timeoutMs: 30_000 });
      const rows = parseGpsJamCsv(csv);
      return gpsJamRowsToFeatureCollection(rows, date!);
    });

    return NextResponse.json(fc, {
      headers: {
        'Cache-Control': 'public, s-maxage=300',
        'X-Gpsjam-Date': date,
        'X-Attribution': GPSJAM_ATTRIBUTION,
      },
    });
  } catch (err) {
    console.warn('[gps-jam]', err instanceof Error ? err.message : err);
    return NextResponse.json(emptyFc(), {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60',
        'X-Attribution': GPSJAM_ATTRIBUTION,
      },
    });
  }
}
