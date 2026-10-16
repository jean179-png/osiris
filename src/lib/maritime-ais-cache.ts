import {
  buildAishubUrl,
  extractMmsiFromQuery,
  isMmsiQuery,
  mapAishubResponse,
  resolveFamousYachtMmsi,
  searchShips,
  shipMatchesVesselClass,
  shipToSearchHit,
  type AisSearchHit,
  type OsirisShip,
  getOsirisShipType,
} from '@/lib/aishub';
import { fetchOpenWatersVessels, type OpenWatersBBox } from '@/lib/openwaters-ais';
import {
  mapOpenWatersVesselFeature,
  openWatersVesselUrl,
} from '@/lib/openwaters-vessel';

export type SearchScope = 'viewport' | 'all';

export type SearchBBox = { west: number; south: number; east: number; north: number };

const globalForAis = globalThis as unknown as {
  shipsCache: Map<number, OsirisShip>;
  aishubLastFetch: number;
  aishubInflight: Promise<void> | null;
  openwatersLastFetch: number;
  openwatersInflight: Promise<void> | null;
  openwatersBoxIndex: number;
  openwatersLastViewKey: string;
  openwatersSearchLastFetch: number;
};

if (!globalForAis.shipsCache) {
  globalForAis.shipsCache = new Map();
  globalForAis.aishubLastFetch = 0;
  globalForAis.aishubInflight = null;
}
if (globalForAis.openwatersLastFetch == null) globalForAis.openwatersLastFetch = 0;
if (globalForAis.openwatersInflight === undefined) globalForAis.openwatersInflight = null;
if (globalForAis.openwatersBoxIndex == null) globalForAis.openwatersBoxIndex = 0;
if (globalForAis.openwatersLastViewKey == null) globalForAis.openwatersLastViewKey = '';
if (globalForAis.openwatersSearchLastFetch == null) globalForAis.openwatersSearchLastFetch = 0;

export const shipsCache = globalForAis.shipsCache;

export function aishubUsername(): string | null {
  return process.env.AISHUB_USERNAME || process.env.AIS_API_KEY || null;
}

export function getAishubLastFetch(): number {
  return globalForAis.aishubLastFetch;
}

export function setAishubLastFetch(ts: number): void {
  globalForAis.aishubLastFetch = ts;
}

export function getAishubInflight(): Promise<void> | null {
  return globalForAis.aishubInflight;
}

export function setAishubInflight(p: Promise<void> | null): void {
  globalForAis.aishubInflight = p;
}

export function getOpenwatersLastFetch(): number {
  return globalForAis.openwatersLastFetch ?? 0;
}

export function setOpenwatersLastFetch(ts: number): void {
  globalForAis.openwatersLastFetch = ts;
}

export function getOpenwatersInflight(): Promise<void> | null {
  return globalForAis.openwatersInflight ?? null;
}

export function setOpenwatersInflight(p: Promise<void> | null): void {
  globalForAis.openwatersInflight = p;
}

export function nextOpenwatersBoxIndex(len: number): number {
  if (len <= 0) return 0;
  const i = (globalForAis.openwatersBoxIndex ?? 0) % len;
  globalForAis.openwatersBoxIndex = i + 1;
  return i;
}

export function getOpenwatersLastViewKey(): string {
  return globalForAis.openwatersLastViewKey ?? '';
}

export function setOpenwatersLastViewKey(key: string): void {
  globalForAis.openwatersLastViewKey = key;
}

export function upsertShips(ships: OsirisShip[], ts = Date.now()): void {
  for (const ship of ships) {
    shipsCache.set(ship.mmsi, { ...ship, timestamp: ts });
  }
  while (shipsCache.size > 20_000) {
    const firstKey = shipsCache.keys().next().value;
    if (firstKey == null) break;
    shipsCache.delete(firstKey);
  }
}

export function getCachedShips(): OsirisShip[] {
  return Array.from(shipsCache.values());
}

function searchBoxAround(near: { lat: number; lng: number }, halfDeg = 1.4): OpenWatersBBox {
  // ~7.8°² — under anonymous Open Waters 100°² cap.
  return {
    latmin: Math.max(-85, near.lat - halfDeg),
    latmax: Math.min(85, near.lat + halfDeg),
    lonmin: Math.max(-180, near.lng - halfDeg),
    lonmax: Math.min(180, near.lng + halfDeg),
  };
}

async function fillCacheFromOpenWaters(bbox: OpenWatersBBox): Promise<void> {
  const now = Date.now();
  // Avoid hammering OW on every keystroke.
  if (now - (globalForAis.openwatersSearchLastFetch ?? 0) < 4_000) return;
  globalForAis.openwatersSearchLastFetch = now;
  try {
    const ships = await fetchOpenWatersVessels(bbox);
    if (ships.length) upsertShips(ships);
  } catch (err) {
    console.warn('[maritime] Open Waters search fill failed', err);
  }
}

function shipInBbox(ship: OsirisShip, bbox: SearchBBox, pad = 0.05): boolean {
  return (
    ship.lat >= bbox.south - pad &&
    ship.lat <= bbox.north + pad &&
    ship.lng >= bbox.west - pad &&
    ship.lng <= bbox.east + pad
  );
}

function bboxFromNear(near: { lat: number; lng: number }, halfDeg = 1.4): SearchBBox {
  const b = searchBoxAround(near, halfDeg);
  return { west: b.lonmin, south: b.latmin, east: b.lonmax, north: b.latmax };
}

function owTypeFromDetail(detail: { type: number | null; shipType: string | null }): string {
  const label = (detail.shipType || '').toLowerCase();
  if (/yacht|pleasure|sailing/.test(label)) return 'pleasure';
  return getOsirisShipType(detail.type ?? 0);
}

async function fetchOpenWatersVesselJson(mmsi: string): Promise<unknown | null> {
  const token = process.env.OPENWATERS_AIS_TOKEN ?? null;
  const url = openWatersVesselUrl(mmsi);
  const doFetch = async (useToken: string | null) => {
    const headers: Record<string, string> = {
      Accept: 'application/geo+json, application/json',
      'User-Agent': 'osiris-maritime/1.0 (+https://github.com/simplifaisoul/osiris)',
    };
    if (useToken) headers.Authorization = `Bearer ${useToken}`;
    return fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers,
      cache: 'no-store',
    });
  };

  let res = await doFetch(token);
  // IP-bound personal tokens 401 from the wrong stack — fall back anonymous.
  if ((res.status === 401 || res.status === 403) && token) {
    res = await doFetch(null);
  }
  if (!res.ok) return null;
  return res.json();
}

async function lookupOpenWatersMmsi(mmsi: string): Promise<OsirisShip | null> {
  try {
    const raw = await fetchOpenWatersVesselJson(mmsi);
    if (!raw) return null;
    const detail = mapOpenWatersVesselFeature(raw);
    if (!detail || detail.lat == null || detail.lng == null) return null;
    const ship: OsirisShip = {
      id: detail.mmsi,
      mmsi: detail.mmsi,
      lat: detail.lat,
      lng: detail.lng,
      speed: detail.sog ?? 0,
      heading: detail.heading ?? detail.cog ?? 0,
      name: (detail.name || '').trim() || `MMSI ${detail.mmsi}`,
      destination: (detail.destination || '').trim(),
      type: owTypeFromDetail(detail),
      flag: (detail.flag || '').trim(),
      timestamp: Date.now(),
    };
    upsertShips([ship]);
    return ship;
  } catch (err) {
    console.warn('[maritime] Open Waters MMSI lookup failed', err);
    return null;
  }
}

async function lookupAishubMmsi(mmsi: string, q: string, limit: number, near: { lat: number; lng: number } | null, vesselClass?: string | null): Promise<AisSearchHit[]> {
  const username = aishubUsername();
  if (
    !username ||
    Date.now() - globalForAis.aishubLastFetch < 60_000 ||
    globalForAis.aishubInflight
  ) {
    return [];
  }
  globalForAis.aishubLastFetch = Date.now();
  try {
    const url = buildAishubUrl(username, undefined, 60, mmsi);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'osiris-maritime/1.0', Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.trim()) return [];
    const ships = mapAishubResponse(JSON.parse(text));
    upsertShips(ships);
    return searchShips(ships, q, limit, near, vesselClass).map(shipToSearchHit);
  } catch (err) {
    console.warn('[maritime] AISHub MMSI lookup failed', err);
    return [];
  }
}

/**
 * Search live AIS cache by name / MMSI / destination / vessel class.
 * scope=viewport → only ships in/near the map frame (fills Open Waters for that box).
 * scope=all → full cache + MMSI / famous-yacht Open Waters lookup (e.g. M/Y NORD in Bali).
 */
export async function searchMaritimeShips(
  query: string,
  limit = 8,
  near?: { lat: number; lng: number } | null,
  vesselClass?: string | null,
  scope: SearchScope = 'viewport',
  bbox?: SearchBBox | null,
): Promise<AisSearchHit[]> {
  const q = query.trim();
  const browse = q.length < 2;
  const view =
    bbox &&
    Number.isFinite(bbox.west) &&
    Number.isFinite(bbox.south) &&
    Number.isFinite(bbox.east) &&
    Number.isFinite(bbox.north)
      ? bbox
      : near
        ? bboxFromNear(near, 1.6)
        : null;

  if (browse && scope === 'viewport' && !(view || near)) return [];
  if (browse && scope === 'all' && !near && !vesselClass) return [];

  const mmsi = extractMmsiFromQuery(q);
  // Viewport ranks by map center but hard-filters to the frame; All ranks by
  // center when known but keeps distant matches (megayachts overseas).
  const rankNear = near ?? null;
  // Famous megayachts (and bare MMSI queries) resolve via Open Waters even in
  // viewport scope — they are almost never inside the current map frame.
  const famousNameMmsi = !browse ? resolveFamousYachtMmsi(q) : null;
  const famousMmsi = !browse ? (mmsi || famousNameMmsi) : null;

  // Resolve known megayachts / MMSI first so "M/Y NORD" is not buried under NORDI*.
  if (famousMmsi) {
    const ow = await lookupOpenWatersMmsi(famousMmsi);
    if (ow) {
      const ok =
        !vesselClass ||
        vesselClass === 'all' ||
        shipMatchesVesselClass(ow, vesselClass) ||
        !!famousNameMmsi;
      if (ok) {
        const rest = searchShips(shipsCache.values(), q, limit, rankNear, vesselClass)
          .filter((s) => s.mmsi !== ow.mmsi)
          .slice(0, Math.max(0, limit - 1))
          .map(shipToSearchHit);
        return [shipToSearchHit(ow), ...rest];
      }
    }
  }

  const run = (pool?: Iterable<OsirisShip>) => {
    const source = pool ?? shipsCache.values();
    let ships = searchShips(source, q, scope === 'viewport' ? limit * 3 : limit, rankNear, vesselClass);
    if (scope === 'viewport' && view) {
      ships = ships.filter((s) => shipInBbox(s, view));
    }
    return ships.slice(0, limit).map(shipToSearchHit);
  };

  let hits = run();

  // Viewport / cold cache: pull Open Waters for the visible (or near) box.
  if (
    hits.length < Math.min(3, limit) &&
    (scope === 'viewport' || shipsCache.size < 80) &&
    (view || near)
  ) {
    const fillNear = near ?? (view
      ? { lat: (view.south + view.north) / 2, lng: (view.west + view.east) / 2 }
      : null);
    if (fillNear) {
      const half = vesselClass === 'yacht' || browse ? 2.2 : 1.4;
      await fillCacheFromOpenWaters(searchBoxAround(fillNear, half));
      hits = run();
    }
  }

  if (hits.length === 0 && near && scope === 'viewport' && shipsCache.size < 80) {
    await fillCacheFromOpenWaters(searchBoxAround(near, process.env.OPENWATERS_AIS_TOKEN ? 4 : 2));
    hits = run();
  }

  if (hits.length === 0 && famousMmsi) {
    const aishubHits = await lookupAishubMmsi(famousMmsi, q, limit, rankNear, vesselClass);
    if (aishubHits.length) return aishubHits;
  }

  if (hits.length === 0 && mmsi) {
    const ow = await lookupOpenWatersMmsi(mmsi);
    if (ow) {
      if (scope === 'viewport' && view && !shipInBbox(ow, view)) {
        // Found globally but outside the frame — only return in All scope.
      } else if (
        !vesselClass ||
        vesselClass === 'all' ||
        shipMatchesVesselClass(ow, vesselClass)
      ) {
        return [shipToSearchHit(ow)];
      }
    }
    const aishubHits = await lookupAishubMmsi(mmsi, q, limit, rankNear, vesselClass);
    if (aishubHits.length) {
      return scope === 'viewport' && view
        ? aishubHits.filter((h) =>
            h.lat >= view.south - 0.05 &&
            h.lat <= view.north + 0.05 &&
            h.lng >= view.west - 0.05 &&
            h.lng <= view.east + 0.05,
          )
        : aishubHits;
    }
  }

  return hits;
}

// Re-export for callers that still check the old name.
export { isMmsiQuery };
