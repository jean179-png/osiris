import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

const OPENWATERS = 'https://ais.openwaters.io/v1/vessels';

export const AIS_NAV_STATUS: Record<number, string> = {
  0: 'Under way (engine)',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way (sailing)',
  9: 'Reserved (HSC)',
  10: 'Reserved (WIG)',
  11: 'Power-driven towing astern',
  12: 'Power-driven pushing/towing',
  13: 'Reserved',
  14: 'AIS-SART / MOB / EPIRB',
  15: 'Undefined',
};

export function normalizeMmsi(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 9) return null;
  return digits.padStart(9, '0').slice(-9);
}

export function navStatusLabel(code: unknown): string | null {
  if (code == null) return null;
  const n = typeof code === 'number' ? code : Number(code);
  if (!Number.isFinite(n)) return null;
  return AIS_NAV_STATUS[n] ?? String(n);
}

export type VesselParticulars = Record<string, string | number | null | undefined>;

export type VesselDetail = {
  mmsi: number;
  name: string | null;
  callsign: string | null;
  imo: number | null;
  flag: string | null;
  type: number | null;
  shipType: string | null;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  navStatus: number | null;
  navStatusLabel: string | null;
  destination: string | null;
  eta: string | null;
  draught: number | null;
  length: number | null;
  beam: number | null;
  near: string | null;
  seen: string | null;
  firstSeen: string | null;
  source: string | null;
  lat: number | null;
  lng: number | null;
  particulars: VesselParticulars | null;
  attribution: unknown;
};

export type VesselTrackResult = {
  coordinates: [number, number][];
  points: number;
  from: string | null;
  to: string | null;
  times: (string | null)[] | null;
  truncated: boolean;
};

/** Open Waters caps one track page at 200 points; a call may span 366 days. */
export const OW_TRACK_LIMIT = 200;
export const OW_TRACK_MAX_DAYS = 366;

/** Discrete trail windows for vessel popup slider (1d · 1w · 1m · 6m · all). */
export const VESSEL_TRACK_DAY_OPTIONS = [1, 7, 30, 183, 366] as const;
export type VesselTrackDays = (typeof VESSEL_TRACK_DAY_OPTIONS)[number];

/** Parse `days` query; invalid / missing → full history (366). */
export function parseVesselTrackDays(raw: string | null | undefined): VesselTrackDays {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return OW_TRACK_MAX_DAYS;
  if ((VESSEL_TRACK_DAY_OPTIONS as readonly number[]).includes(n)) {
    return n as VesselTrackDays;
  }
  return OW_TRACK_MAX_DAYS;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalize Open Waters GeoJSON Feature → VesselDetail. */
export function mapOpenWatersVesselFeature(data: unknown): VesselDetail | null {
  if (!data || typeof data !== 'object') return null;
  const f = data as Feature;
  const props = (f.properties ?? {}) as Record<string, unknown>;
  const mmsi = num(props.mmsi) ?? num(f.id);
  if (mmsi == null) return null;
  const coords =
    f.geometry && f.geometry.type === 'Point'
      ? (f.geometry as Point).coordinates
      : null;
  const particulars =
    props.particulars && typeof props.particulars === 'object'
      ? (props.particulars as VesselParticulars)
      : null;
  const shipType =
    (particulars?.ship_type != null ? String(particulars.ship_type) : null) ||
    null;
  return {
    mmsi,
    name: typeof props.name === 'string' ? props.name : null,
    callsign: typeof props.callsign === 'string' ? props.callsign : null,
    imo: num(props.imo),
    flag: typeof props.flag === 'string' ? props.flag : null,
    type: num(props.type),
    shipType,
    sog: num(props.sog),
    cog: num(props.cog),
    heading: num(props.heading),
    navStatus: num(props.nav_status),
    navStatusLabel: navStatusLabel(props.nav_status),
    destination: typeof props.destination === 'string' ? props.destination : null,
    eta: typeof props.eta === 'string' ? props.eta : null,
    draught: num(props.draught),
    length: num(props.length) ?? num(particulars?.length),
    beam: num(props.beam),
    near: typeof props.near === 'string' ? props.near : null,
    seen: typeof props.seen === 'string' ? props.seen : null,
    firstSeen: typeof props.first_seen === 'string' ? props.first_seen : null,
    source: typeof props.source === 'string' ? props.source : null,
    lat: coords ? num(coords[1]) : null,
    lng: coords ? num(coords[0]) : null,
    particulars,
    attribution: (data as { attribution?: unknown }).attribution ?? null,
  };
}

const EMPTY_TRACK: VesselTrackResult = {
  coordinates: [],
  points: 0,
  from: null,
  to: null,
  times: null,
  truncated: false,
};

/** Extract LineString coords from Open Waters track Feature. */
export function mapOpenWatersTrackFeature(data: unknown): VesselTrackResult {
  if (!data || typeof data !== 'object') return { ...EMPTY_TRACK };
  const f = data as Feature;
  const props = (f.properties ?? {}) as Record<string, unknown>;
  let coordinates: [number, number][] = [];
  if (f.geometry?.type === 'LineString') {
    coordinates = ((f.geometry as LineString).coordinates || [])
      .map((c) => [Number(c[0]), Number(c[1])] as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  } else if (f.geometry?.type === 'Point') {
    const c = (f.geometry as Point).coordinates;
    if (c && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      coordinates = [[c[0], c[1]]];
    }
  } else if ((data as { type?: string }).type === 'FeatureCollection') {
    // Some proxies wrap — take first LineString
    const fc = data as FeatureCollection;
    for (const feat of fc.features || []) {
      const mapped = mapOpenWatersTrackFeature(feat);
      if (mapped.coordinates.length) return mapped;
    }
  }
  const times = Array.isArray(props.times) ? (props.times as (string | null)[]) : null;
  return {
    coordinates,
    points: coordinates.length || (typeof props.points === 'number' ? props.points : 0),
    from: typeof props.from === 'string' ? props.from : null,
    to: typeof props.to === 'string' ? props.to : null,
    times,
    truncated: props.truncated === true,
  };
}

export function openWatersVesselUrl(mmsi: string): string {
  return `${OPENWATERS}/${encodeURIComponent(mmsi)}`;
}

export type OpenWatersTrackOpts = {
  /** RFC 3339 start; defaults to 24h before `to` on the API if omitted. */
  from?: string | null;
  /** RFC 3339 end; defaults to now. */
  to?: string | null;
  /** Max positions per page (API max 200). */
  limit?: number;
  /**
   * Sample interval (`5m`, `1h`, `0` = every fix). Omit for shape-simplified
   * tracks that cover long ranges with fewer points.
   */
  interval?: string | null;
};

/** Build `/vessels/{mmsi}/track` URL. Prefer no interval for full-history shape tracks. */
export function openWatersTrackUrl(mmsi: string, opts: OpenWatersTrackOpts = {}): string {
  const q = new URLSearchParams({
    format: 'geojson',
    limit: String(Math.min(OW_TRACK_LIMIT, Math.max(1, opts.limit ?? OW_TRACK_LIMIT))),
  });
  if (opts.from) q.set('from', opts.from);
  if (opts.to) q.set('to', opts.to);
  if (opts.interval != null && opts.interval !== '') q.set('interval', opts.interval);
  return `${OPENWATERS}/${encodeURIComponent(mmsi)}/track?${q}`;
}

/** Earliest `from` allowed for a given `to` (≤366-day API cap; optional shorter window). */
export function trackHistoryStart(
  to: Date,
  firstSeen?: string | null,
  maxDays: number = OW_TRACK_MAX_DAYS,
): Date {
  const days = Math.min(Math.max(1, Math.floor(maxDays)), OW_TRACK_MAX_DAYS);
  const maxSpanMs = days * 24 * 60 * 60 * 1000;
  const floor = new Date(to.getTime() - maxSpanMs);
  if (!firstSeen) return floor;
  const seen = new Date(firstSeen);
  if (!Number.isFinite(seen.getTime())) return floor;
  return seen > floor ? seen : floor;
}

function samePoint(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

function mergeTrackPages(older: [number, number][], newer: [number, number][]): [number, number][] {
  if (!older.length) return newer;
  if (!newer.length) return older;
  const junction = samePoint(older[older.length - 1]!, newer[0]!) ? newer.slice(1) : newer;
  return older.concat(junction);
}

/**
 * Pull the longest track Open Waters will give: from first_seen (≤366d) to now.
 * Uses shape simplification (no interval) so one page spans the full history.
 * When an interval page is truncated, pages backward to keep denser coverage.
 */
export async function fetchFullOpenWatersTrack(
  mmsi: string,
  opts: {
    firstSeen?: string | null;
    fetchJson: (url: string) => Promise<unknown | null>;
    maxPages?: number;
    /** Calendar days of history (clamped to OW_TRACK_MAX_DAYS). Default: full. */
    maxDays?: number;
  },
): Promise<VesselTrackResult> {
  const toDate = new Date();
  const historyStart = trackHistoryStart(toDate, opts.firstSeen, opts.maxDays ?? OW_TRACK_MAX_DAYS);
  const historyFrom = historyStart.toISOString();
  const historyTo = toDate.toISOString();

  // Full-span shape track first — covers all available history in ≤200 vertices.
  const shapeUrl = openWatersTrackUrl(mmsi, {
    from: historyFrom,
    to: historyTo,
    limit: OW_TRACK_LIMIT,
  });
  const shapeRaw = await opts.fetchJson(shapeUrl);
  const shape = shapeRaw ? mapOpenWatersTrackFeature(shapeRaw) : { ...EMPTY_TRACK };
  if (!shape.truncated || shape.coordinates.length === 0) {
    return {
      ...shape,
      from: shape.from ?? historyFrom,
      to: shape.to ?? historyTo,
      points: shape.coordinates.length,
    };
  }

  // Truncated under shape mode or dense traffic: walk backward with a coarse
  // interval so older legs are not dropped when the newest fill the limit.
  const maxPages = opts.maxPages ?? 24;
  let pageTo = historyTo;
  let coordinates: [number, number][] = [];
  let times: (string | null)[] | null = [];
  let coveredFrom: string | null = null;
  let coveredTo: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const url = openWatersTrackUrl(mmsi, {
      from: historyFrom,
      to: pageTo,
      limit: OW_TRACK_LIMIT,
      interval: '15m',
    });
    const raw = await opts.fetchJson(url);
    if (!raw) break;
    const pageTrack = mapOpenWatersTrackFeature(raw);
    if (!pageTrack.coordinates.length) break;

    coordinates = mergeTrackPages(pageTrack.coordinates, coordinates);
    if (pageTrack.times?.length) {
      const olderTimes: (string | null)[] = pageTrack.times;
      const newerTimes: (string | null)[] = times ?? [];
      const drop: (string | null)[] =
        olderTimes.length &&
        newerTimes.length &&
        olderTimes[olderTimes.length - 1] === newerTimes[0]
          ? newerTimes.slice(1)
          : newerTimes;
      times = olderTimes.concat(drop);
    }
    coveredFrom = pageTrack.from ?? coveredFrom ?? historyFrom;
    coveredTo = coveredTo ?? pageTrack.to ?? pageTo;

    if (!pageTrack.truncated) break;
    if (!pageTrack.from) break;
    const prevEnd = new Date(pageTrack.from).getTime() - 1000;
    if (!Number.isFinite(prevEnd) || prevEnd <= historyStart.getTime()) break;
    pageTo = new Date(prevEnd).toISOString();
  }

  // Prefer the longer of shape vs paged interval tracks.
  if (shape.coordinates.length >= coordinates.length) {
    return {
      ...shape,
      from: shape.from ?? historyFrom,
      to: shape.to ?? historyTo,
      points: shape.coordinates.length,
    };
  }

  return {
    coordinates,
    points: coordinates.length,
    from: coveredFrom,
    to: coveredTo,
    times: times?.length ? times : null,
    truncated: false,
  };
}
