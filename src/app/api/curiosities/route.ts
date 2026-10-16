import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * OSIRIS — Curiosities atlas
 *
 * Source: Google Drive KML
 *   COMBINED__HAUNTED_WEIRD_TREASURE_ABANDONED_FURRIES
 *   https://drive.google.com/file/d/1ji3tp5Mi-0JG85jfIaV966xpkU8PLhcg/view
 *
 * Served from a prebuilt gzipped GeoJSON (~196k nameless points) so each
 * request is a file read, not a rebuild.
 */

const GZ = join(process.cwd(), 'public', 'data', 'curiosities.geojson.gz');
const META = join(process.cwd(), 'public', 'data', 'curiosities.meta.json');

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('meta') === '1') {
      const meta = JSON.parse(await readFile(META, 'utf8'));
      return NextResponse.json(meta);
    }

    const gzip = await readFile(GZ);
    const acceptsGzip = (req.headers.get('accept-encoding') || '').includes('gzip');

    if (acceptsGzip) {
      return new NextResponse(new Uint8Array(gzip), {
        status: 200,
        headers: {
          'Content-Type': 'application/geo+json',
          'Content-Encoding': 'gzip',
          'Cache-Control': 'public, max-age=86400',
          'X-Osiris-Points': '196064',
        },
      });
    }

    const { gunzipSync } = await import('node:zlib');
    const json = gunzipSync(gzip);
    return new NextResponse(new Uint8Array(json), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json',
        'Cache-Control': 'public, max-age=86400',
        'X-Osiris-Points': '196064',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
