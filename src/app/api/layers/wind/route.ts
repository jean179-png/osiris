import { NextRequest, NextResponse } from 'next/server';
import { buildSurfaceGrid, windGridToJson } from '@/lib/wind-openmeteo';
import type { WindProductId } from '@/lib/wind-field';

export async function GET(req: NextRequest) {
  const product = (req.nextUrl.searchParams.get('product') || 'surface') as WindProductId;
  if (product !== 'surface') {
    return NextResponse.json({ error: `unsupported product: ${product}` }, { status: 400 });
  }
  try {
    const grid = await buildSurfaceGrid();
    return NextResponse.json(windGridToJson(grid), {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'upstream failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
