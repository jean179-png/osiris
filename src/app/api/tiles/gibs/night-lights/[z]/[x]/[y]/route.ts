import { NextRequest, NextResponse } from 'next/server';
import { httpBuffer } from '@/lib/httpJson';
import {
  GIBS_NIGHT_LIGHTS_ATTRIBUTION,
  NIGHT_LIGHTS_MAX_ZOOM,
  gibsNightLightsUpstreamUrl,
  parseNightLightsProduct,
} from '@/lib/gibs-night-lights';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

type Ctx = { params: Promise<{ z: string; x: string; y: string }> };

/**
 * GET /api/tiles/gibs/night-lights/{z}/{x}/{y}?product=composite
 * Proxies NASA GIBS VIIRS Black Marble WMTS tiles (no API key).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const product = parseNightLightsProduct(req.nextUrl.searchParams.get('product'));
  if (!product) {
    return NextResponse.json({ error: 'Unknown night lights product' }, { status: 400 });
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
    x < 0 ||
    y < 0 ||
    (Number.isInteger(z) && z <= NIGHT_LIGHTS_MAX_ZOOM && (x >= 2 ** z || y >= 2 ** z))
  ) {
    return NextResponse.json({ error: 'Invalid tile coordinates' }, { status: 400 });
  }
  if (z > NIGHT_LIGHTS_MAX_ZOOM) {
    return NextResponse.json({ error: 'Zoom exceeds GIBS Level8 max' }, { status: 404 });
  }

  const url = gibsNightLightsUpstreamUrl(product, z, x, y);
  if (!url) {
    return NextResponse.json(
      { error: `Night lights product "${product}" is not available yet` },
      { status: 400 },
    );
  }

  try {
    const buf = await httpBuffer(url, {
      timeoutMs: 15_000,
      headers: { Accept: 'image/png' },
    });
    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'X-Attribution': GIBS_NIGHT_LIGHTS_ATTRIBUTION,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[OSIRIS] GIBS night lights tile fail:', msg);
    return NextResponse.json({ error: 'GIBS tile fetch failed' }, { status: 502 });
  }
}
