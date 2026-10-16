import { NextResponse } from 'next/server';
import { httpJson } from '@/lib/httpJson';

/**
 * OSIRIS — Earthquake Data API
 * Fetches real-time seismic events from USGS (last 24h, M2.5+)
 * No API key required. Uses httpJson — Next undici fetch fails USGS intermittently.
 */

type UsgsFc = {
  features?: Array<{
    id?: string;
    geometry?: { coordinates?: number[] };
    properties?: Record<string, unknown>;
  }>;
};

export async function GET() {
  try {
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
    const data = await httpJson<UsgsFc>(url, { timeoutMs: 30_000 });
    const features = data.features || [];

    const earthquakes = features.map((f) => {
      const coords = f.geometry?.coordinates || [0, 0, 0];
      const props = f.properties || {};
      return {
        id: f.id,
        lat: coords[1],
        lng: coords[0],
        depth: coords[2],
        magnitude: props.mag,
        place: props.place,
        time: props.time,
        url: props.url,
        tsunami: props.tsunami,
        type: props.type,
        felt: props.felt,
        alert: props.alert,
      };
    });

    return NextResponse.json({
      earthquakes,
      total: earthquakes.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Earthquake fetch error:', error);
    return NextResponse.json({ earthquakes: [], error: 'Failed to fetch earthquake data', detail: msg }, { status: 500 });
  }
}

