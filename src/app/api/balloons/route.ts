import { NextResponse } from 'next/server';
import { mapSondeHubToBalloons } from '@/lib/balloons';
import { httpJson } from '@/lib/httpJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // SondeHub only accepts: 3d, 1d, 12h, 6h, 3h, 1h, 30m, 1m, 15s, 0
    // Use httpJson — Next undici fetch fails these hosts with "fetch failed".
    const data = await httpJson<unknown>(
      'https://api.v2.sondehub.org/sondes/telemetry?duration=1h',
      { timeoutMs: 30_000 },
    );
    if (typeof data === 'string') {
      return NextResponse.json({ balloons: [], source: 'SondeHub (error)' });
    }
    const balloons = mapSondeHubToBalloons(data);
    return NextResponse.json(
      { balloons, total: balloons.length, source: 'SondeHub', timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=60' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error';
    console.warn('[balloons]', msg);
    return NextResponse.json({ balloons: [], source: 'SondeHub (error)', error: msg });
  }
}
