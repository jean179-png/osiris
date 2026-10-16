import type { OsirisShip } from '@/lib/aishub';
import { getOsirisShipType } from '@/lib/aishub';

const OPENWATERS_VESSELS = 'https://ais.openwaters.io/v1/vessels';

export type OpenWatersBBox = {
  latmin: number;
  latmax: number;
  lonmin: number;
  lonmax: number;
};

/** Anonymous tier caps area at 100 square degrees. */
export function openWatersAreaDeg2(bbox: OpenWatersBBox): number {
  return Math.max(0, bbox.latmax - bbox.latmin) * Math.max(0, bbox.lonmax - bbox.lonmin);
}

/** `bbox=minLat,minLon,maxLat,maxLon` per Open Waters docs. */
export function buildOpenWatersVesselsUrl(bbox: OpenWatersBBox, maxAgeMoving = '30m'): string {
  const q = new URLSearchParams({
    bbox: `${bbox.latmin},${bbox.lonmin},${bbox.latmax},${bbox.lonmax}`,
    max_age_moving: maxAgeMoving,
    kind: 'vessel',
  });
  return `${OPENWATERS_VESSELS}?${q}`;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

type OwFeature = {
  id?: number | string;
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
};

/** Map Open Waters GeoJSON FeatureCollection → Osiris ships. */
export function mapOpenWatersFc(data: unknown, now = Date.now()): OsirisShip[] {
  if (!data || typeof data !== 'object') return [];
  const features = (data as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const out: OsirisShip[] = [];
  for (const raw of features) {
    const f = raw as OwFeature;
    const props = f.properties ?? {};
    if (props.kind != null && props.kind !== 'vessel') continue;
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lng = num(coords[0]);
    const lat = num(coords[1]);
    const mmsi = num(props.mmsi) ?? num(f.id);
    if (mmsi == null || lat == null || lng == null) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const sog = num(props.sog) ?? 0;
    let heading = num(props.heading);
    if (heading == null || heading >= 511) heading = num(props.cog) ?? 0;
    const typeCode = num(props.type) ?? 0;
    const seen = typeof props.seen === 'string' ? Date.parse(props.seen) : NaN;
    out.push({
      id: mmsi,
      mmsi,
      lat,
      lng,
      speed: sog,
      heading,
      name: (typeof props.name === 'string' ? props.name : '').trim() || `MMSI ${mmsi}`,
      destination: (typeof props.destination === 'string' ? props.destination : '').trim(),
      type: getOsirisShipType(typeCode),
      flag: (typeof props.flag === 'string' ? props.flag : '').trim(),
      timestamp: Number.isFinite(seen) ? seen : now,
    });
  }
  return out;
}

export async function fetchOpenWatersVessels(
  bbox: OpenWatersBBox,
  opts?: { timeoutMs?: number; token?: string | null },
): Promise<OsirisShip[]> {
  const token = opts?.token ?? process.env.OPENWATERS_AIS_TOKEN ?? null;
  // Anonymous ≤100°²; personal tokens commonly allow 400°².
  const maxArea = token ? 400 : 100;
  if (openWatersAreaDeg2(bbox) > maxArea) {
    throw new Error(`Open Waters bbox exceeds ${maxArea}°²`);
  }

  const doFetch = async (useToken: string | null) => {
    const headers: Record<string, string> = {
      Accept: 'application/geo+json, application/json',
      'User-Agent': 'osiris-maritime/1.0 (+https://github.com/simplifaisoul/osiris)',
    };
    if (useToken) headers.Authorization = `Bearer ${useToken}`;
    const res = await fetch(buildOpenWatersVesselsUrl(bbox), {
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 20_000),
      headers,
      cache: 'no-store',
    });
    return res;
  };

  let res = await doFetch(token);
  // IP-bound personal tokens return 401 from the wrong stack — fall back anonymous.
  if ((res.status === 401 || res.status === 403) && token) {
    res = await doFetch(null);
  }
  if (!res.ok) throw new Error(`Open Waters HTTP ${res.status}`);
  const data: unknown = await res.json();
  return mapOpenWatersFc(data);
}
