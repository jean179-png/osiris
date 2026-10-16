import { NextRequest, NextResponse } from 'next/server';
import { httpBuffer } from '@/lib/httpJson';

const MAX_ATTEMPTS = 3;

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket')
  );
}

async function fetchTile(targetUrl: string): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Node https — Next undici fetch to cartocdn hangs / 500s from the server runtime.
      return await httpBuffer(targetUrl, {
        timeoutMs: 20_000,
        headers: { Accept: '*/*', 'User-Agent': 'Osiris-Tile-Proxy/1.0' },
      });
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) throw error;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
  throw lastError;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Only allow cartocdn.com domains to prevent open proxy abuse
    const targetUrl = new URL(url);
    const host = targetUrl.hostname.toLowerCase();
    if (host !== 'cartocdn.com' && !host.endsWith('.cartocdn.com')) {
      return NextResponse.json({ error: 'Forbidden domain' }, { status: 403 });
    }

    const data = await fetchTile(targetUrl.toString());

    return new NextResponse(Buffer.from(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.mapbox-vector-tile',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Tile proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
