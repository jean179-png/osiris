import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const token = process.env.MAPILLARY_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'MAPILLARY_ACCESS_TOKEN not configured' }, { status: 503 });
  }
  const { z, x, y } = await ctx.params;
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(String(y).replace(/\.pbf$/i, ''));
  if (![zi, xi, yi].every(Number.isFinite)) {
    return NextResponse.json({ error: 'bad tile coords' }, { status: 400 });
  }
  const url =
    `https://tiles.mapillary.com/maps/vtp/mly1_public/2/${zi}/${xi}/${yi}` +
    `?access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status === 404 ? 404 : 502 });
    }
    const buf = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || 'application/vnd.mapbox-vector-tile';
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
