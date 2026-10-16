import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * Ventusky hourly city stills — the catalogue cannot bake a clock-hour path
 * because the region cache lives for minutes. This route picks the previous
 * Europe/Amsterdam hour on every image request.
 */

const ALLOWED = new Set(['932984225']); // Haarlem city view

function hourStamp(when: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(when);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}_${get('hour')}00`;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim() || '';
  if (!ALLOWED.has(id)) {
    return NextResponse.json({ error: 'Unknown Ventusky cam' }, { status: 404 });
  }

  // Prefer the completed prior hour; if Ventusky has not published it yet,
  // walk back a few hours rather than serving their tiny placeholder PNG.
  const tried: string[] = [];
  for (let back = 1; back <= 6; back++) {
    const stamp = hourStamp(new Date(Date.now() - back * 60 * 60 * 1000));
    tried.push(stamp);
    const url = `https://webcams.ventusky.com/data/25/${id}/hour/${stamp}.jpg`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: 'image/*,*/*', Referer: 'https://www.ventusky.com/' },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // Real frames are tens of KB; the "no image" PNG is ~6KB.
      if (buf.length < 20000) continue;
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': res.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=120',
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: 'No Ventusky frame', tried },
    { status: 502 },
  );
}
