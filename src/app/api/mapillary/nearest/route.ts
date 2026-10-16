import { NextRequest, NextResponse } from 'next/server';
import { googleStreetViewUrl, resolveNearestInView } from '@/lib/mapillary';

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }
  const lookAt = { lat, lng };
  const token = process.env.MAPILLARY_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        lookAt,
        googleUrl: googleStreetViewUrl(lookAt),
        error: 'MAPILLARY_ACCESS_TOKEN not configured',
      },
      { status: 503 },
    );
  }
  try {
    const result = await resolveNearestInView(lookAt, token);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        lookAt,
        googleUrl: googleStreetViewUrl(lookAt),
        error: 'Mapillary request failed',
      },
      { status: 502 },
    );
  }
}
