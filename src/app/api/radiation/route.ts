import { NextResponse } from 'next/server';
import { mapSafecastToStations } from '@/lib/radiation';
import { httpJson } from '@/lib/httpJson';

export const dynamic = 'force-dynamic';

/** Sample hubs so we get global coverage without dumping the whole archive. */
const HUBS: [number, number][] = [
  [40.7, -74.0],
  [34.0, -118.2],
  [41.9, -87.6],
  [51.5, -0.1],
  [48.9, 2.3],
  [35.7, 139.7],
  [50.5, 30.5],
  [37.8, -122.4],
];

export async function GET() {
  try {
    const parts = await Promise.all(
      HUBS.map(async ([lat, lng]) => {
        try {
          const url = `https://api.safecast.org/measurements.json?distance=250000&latitude=${lat}&longitude=${lng}&per_page=80`;
          const rows = await httpJson<unknown>(url, { timeoutMs: 25_000 });
          return mapSafecastToStations(rows, 80);
        } catch {
          return [];
        }
      }),
    );
    const seen = new Set<string>();
    const stations = [];
    for (const list of parts) {
      for (const s of list) {
        const k = `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        stations.push(s);
      }
    }
    return NextResponse.json(
      { stations, total: stations.length, source: 'Safecast', timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=120' } },
    );
  } catch {
    return NextResponse.json({ stations: [], source: 'Safecast (error)' });
  }
}
