import dns from 'node:dns';
import https from 'node:https';
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFullOpenWatersTrack,
  mapOpenWatersVesselFeature,
  normalizeMmsi,
  openWatersVesselUrl,
  parseVesselTrackDays,
} from '@/lib/openwaters-vessel';

export const maxDuration = 60;

type Family = 4 | 6;

function httpsJson(
  url: string,
  timeoutMs: number,
  opts: { token?: string | null; family?: Family } = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      Accept: 'application/geo+json, application/json',
      'User-Agent': 'osiris-maritime/1.0 (+https://github.com/simplifaisoul/osiris)',
    };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

    const req = https.get(
      url,
      {
        headers,
        timeout: timeoutMs,
        // Omit family for dual-stack (IP-bound Open Waters personal tokens on IPv6).
        ...(opts.family ? { family: opts.family } : {}),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('error', reject);
        res.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            if (!body.trim()) {
              reject(new Error('empty body'));
              return;
            }
            resolve(JSON.parse(body) as unknown);
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Upstream timed out')));
    req.on('error', reject);
  });
}

/**
 * Personal Open Waters tokens are often CIDR-bound to the minting address
 * (frequently IPv6). Prefer that stack when a token is set; fall back to
 * anonymous IPv4 if auth fails.
 */
async function fetchOwJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const token = process.env.OPENWATERS_AIS_TOKEN || null;
  if (token) {
    try {
      // Temporarily prefer AAAA so CIDR-bound personal tokens match.
      try {
        dns.setDefaultResultOrder('ipv6first');
      } catch { /* older Node */ }
      return await httpsJson(url, timeoutMs, { token, family: 6 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/HTTP 401|HTTP 403/.test(msg)) {
        // try dual-stack with token before giving up on auth
        try {
          return await httpsJson(url, timeoutMs, { token });
        } catch {
          /* fall through to anonymous */
        }
      }
    } finally {
      try {
        dns.setDefaultResultOrder('ipv4first');
      } catch { /* older Node */ }
    }
  }
  try {
    return await httpsJson(url, timeoutMs, { family: 4 });
  } catch {
    return null;
  }
}

/**
 * GET /api/maritime/vessel?mmsi=215167000&days=1
 * Proxies Open Waters vessel detail + AIS track for the requested window
 * (1 / 7 / 30 / 183 / 366 days; default 366 = full available history).
 */
export async function GET(req: NextRequest) {
  const mmsi = normalizeMmsi(req.nextUrl.searchParams.get('mmsi'));
  if (!mmsi) {
    return NextResponse.json({ error: 'mmsi required (7–9 digits)' }, { status: 400 });
  }
  const days = parseVesselTrackDays(req.nextUrl.searchParams.get('days'));

  const detailRaw = await fetchOwJson(openWatersVesselUrl(mmsi), 15_000);
  const vessel = detailRaw ? mapOpenWatersVesselFeature(detailRaw) : null;

  const track = await fetchFullOpenWatersTrack(mmsi, {
    firstSeen: vessel?.firstSeen ?? null,
    fetchJson: (url) => fetchOwJson(url, 25_000),
    maxDays: days,
  });

  if (!vessel && track.points === 0) {
    return NextResponse.json({ error: 'Vessel not found', mmsi }, { status: 404 });
  }

  return NextResponse.json(
    {
      mmsi: Number(mmsi),
      vessel,
      track: track.coordinates,
      trackMeta: {
        points: track.points,
        from: track.from,
        to: track.to,
        truncated: track.truncated,
        days,
      },
      source: 'Open Waters AIS',
    },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  );
}
