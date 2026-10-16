import { NextRequest, NextResponse } from 'next/server';
import { httpBuffer } from '@/lib/httpJson';
import { tomtomApiKey, tomtomFlowTileUrl, TOMTOM_FLOW_ATTRIBUTION } from '@/lib/tomtom-traffic';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

type Ctx = { params: Promise<{ z: string; x: string; y: string }> };

/**
 * GET /api/tiles/tomtom-flow/{z}/{x}/{y}
 * Proxies TomTom raster flow tiles so TOMTOM_API_KEY never reaches the browser.
 * Uses Node https (httpBuffer) — undici fetch often fails to TomTom from Next.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const key = tomtomApiKey();
  if (!key) {
    return NextResponse.json(
      { error: 'TOMTOM_API_KEY not configured' },
      { status: 503 },
    );
  }

  const { z: zs, x: xs, y: ys } = await ctx.params;
  const z = Number(zs);
  const x = Number(xs);
  const y = Number(ys);
  if (
    !Number.isInteger(z) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    z < 0 ||
    z > 22 ||
    x < 0 ||
    y < 0 ||
    x >= 2 ** z ||
    y >= 2 ** z
  ) {
    return NextResponse.json({ error: 'Invalid tile coordinates' }, { status: 400 });
  }

  try {
    const buf = await httpBuffer(tomtomFlowTileUrl(z, x, y, key), {
      timeoutMs: 12_000,
      headers: { Accept: 'image/png' },
    });
    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'Access-Control-Allow-Origin': '*',
        'X-Attribution': TOMTOM_FLOW_ATTRIBUTION,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const forbidden = /HTTP 403/.test(msg);
    return NextResponse.json(
      { error: forbidden ? 'TomTom rejected the key for traffic tiles' : 'TomTom tile fetch failed' },
      { status: forbidden ? 403 : 502 },
    );
  }
}
