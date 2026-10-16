/** AISHub human-readable vessel row (format=1). */
export type AishubVessel = {
  MMSI?: number | string;
  TIME?: string;
  LONGITUDE?: number | string;
  LATITUDE?: number | string;
  COG?: number | string;
  SOG?: number | string;
  HEADING?: number | string;
  NAVSTAT?: number | string;
  IMO?: number | string;
  NAME?: string;
  CALLSIGN?: string;
  TYPE?: number | string;
  DEST?: string;
  FLAG?: string;
  DRAUGHT?: number | string;
};

export type OsirisShip = {
  id: number;
  mmsi: number;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  name: string;
  destination: string;
  type: string;
  flag: string;
  timestamp: number;
};

export function getOsirisShipType(typeCode: number): string {
  if (!typeCode) return 'cargo';
  if (typeCode >= 90 && typeCode <= 99) return 'other';
  if (typeCode >= 80 && typeCode <= 89) return 'tanker';
  if (typeCode >= 70 && typeCode <= 79) return 'cargo';
  if (typeCode >= 60 && typeCode <= 69) return 'passenger';
  if (typeCode >= 40 && typeCode <= 49) return 'highspeed';
  // ITU-R M.1371 special craft (30–39) — do not collapse to fishing.
  if (typeCode === 30) return 'fishing';
  if (typeCode === 35) return 'military';
  if (typeCode === 36) return 'sailing';
  if (typeCode === 37) return 'pleasure';
  if (typeCode >= 30 && typeCode <= 39) return 'special';
  return 'cargo';
}

/** Search / browse vessel class (maps to one or more AIS types). */
export type VesselClass =
  | 'all'
  | 'yacht'
  | 'passenger'
  | 'cargo'
  | 'tanker'
  | 'fishing'
  | 'military'
  | 'highspeed';

const YACHT_NAME_RE = /\b(mega\s*yacht|megayacht|motor\s*yacht|superyacht|yacht|m\/y|my\s)\b/i;
const VESSEL_PREFIX_RE = /^(m\/y|m\.y\.|my|f\/v|fv|s\/y|s\.y\.|sy|r\/v|rv)\s+/i;

/** Strip M/Y / F/V style prefixes and punctuation for name compare. */
export function normalizeVesselName(s: string): string {
  return s
    .toLowerCase()
    .replace(VESSEL_PREFIX_RE, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Well-known megayachts that broadcast AIS type 90 (“other”) and sit far from
 * the map — resolve by name → MMSI so Open Waters can still find them.
 */
export const FAMOUS_YACHT_MMSI: Record<string, string> = {
  nord: '273610820',
  dilbar: '319094900',
  eclipse: '319010900',
  'sailing yacht a': '319111124',
  'flying fox': '319142300',
  scheherazade: '319178100',
  'rev ocean': '257088650',
  'al lusail': '466473000',
  octopus: '319764000',
  'rising sun': '319869000',
};

export function resolveFamousYachtMmsi(query: string): string | null {
  const key = normalizeVesselName(query);
  if (!key || key.length < 2) return null;
  if (FAMOUS_YACHT_MMSI[key]) return FAMOUS_YACHT_MMSI[key]!;
  // Allow "m/y nord", "yacht nord", "nord yacht"
  const bare = key.replace(/\b(yacht|mega yacht|megayacht|motor yacht|superyacht)\b/g, '').trim();
  if (bare && FAMOUS_YACHT_MMSI[bare]) return FAMOUS_YACHT_MMSI[bare]!;
  return null;
}

/** Whether a ship belongs to a search vessel class (e.g. megayachts ≈ pleasure/sailing). */
export function shipMatchesVesselClass(ship: OsirisShip, vesselClass?: string | null): boolean {
  if (!vesselClass || vesselClass === 'all') return true;
  const t = (ship.type || '').toLowerCase();
  if (vesselClass === 'yacht') {
    // Type 90 “other” is how many giga-yachts (NORD, Dilbar…) identify on AIS.
    return (
      t === 'pleasure' ||
      t === 'sailing' ||
      t === 'other' ||
      YACHT_NAME_RE.test(ship.name || '') ||
      !!resolveFamousYachtMmsi(ship.name || '')
    );
  }
  return t === vesselClass;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Unpack AISHub JSON body → vessel rows (handles [header, rows] or bare array). */
export function extractAishubRows(data: unknown): AishubVessel[] {
  if (!Array.isArray(data)) return [];
  if (data.length >= 2 && Array.isArray(data[1])) {
    return data[1] as AishubVessel[];
  }
  if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'MMSI' in (data[0] as object)) {
    return data as AishubVessel[];
  }
  return [];
}

export function mapAishubVessel(row: AishubVessel, now = Date.now()): OsirisShip | null {
  const mmsi = num(row.MMSI);
  const lat = num(row.LATITUDE);
  const lng = num(row.LONGITUDE);
  if (mmsi == null || lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const sog = num(row.SOG) ?? 0;
  let heading = num(row.HEADING);
  if (heading == null || heading >= 511) heading = num(row.COG) ?? 0;
  const typeCode = num(row.TYPE) ?? 0;
  return {
    id: mmsi,
    mmsi,
    lat,
    lng,
    speed: sog,
    heading,
    name: (row.NAME || '').trim() || `MMSI ${mmsi}`,
    destination: (row.DEST || '').trim(),
    type: getOsirisShipType(typeCode),
    flag: (row.FLAG || '').trim(),
    timestamp: now,
  };
}

export function mapAishubResponse(data: unknown, now = Date.now()): OsirisShip[] {
  const out: OsirisShip[] = [];
  for (const row of extractAishubRows(data)) {
    const ship = mapAishubVessel(row, now);
    if (ship) out.push(ship);
  }
  return out;
}

/** Build AISHub ws.php URL. Username is the member id from aishub.net. */
export function buildAishubUrl(
  username: string,
  bbox?: { latmin: number; latmax: number; lonmin: number; lonmax: number },
  intervalMin = 20,
  mmsi?: number | string,
): string {
  const q = new URLSearchParams({
    username,
    format: '1',
    output: 'json',
    compress: '0',
    interval: String(intervalMin),
  });
  if (bbox) {
    q.set('latmin', String(bbox.latmin));
    q.set('latmax', String(bbox.latmax));
    q.set('lonmin', String(bbox.lonmin));
    q.set('lonmax', String(bbox.lonmax));
  }
  if (mmsi != null && String(mmsi).trim()) q.set('mmsi', String(mmsi).trim());
  return `https://data.aishub.net/ws.php?${q}`;
}

/** True when the query is an MMSI (7–9 digits), optionally prefixed with "MMSI". */
export function isMmsiQuery(q: string): boolean {
  return extractMmsiFromQuery(q) != null;
}

/** Pull a 7–9 digit MMSI from "244750030", "MMSI 244750030", "mmsi:244750030", etc. */
export function extractMmsiFromQuery(q: string): string | null {
  const raw = q.trim();
  if (!raw) return null;
  if (/^\d{7,9}$/.test(raw)) return raw;
  const prefixed = raw.match(/^mmsi[:\s#-]*(\d{7,9})$/i);
  if (prefixed?.[1]) return prefixed[1];
  const embedded = raw.match(/\bmmsi[:\s#-]*(\d{7,9})\b/i);
  return embedded?.[1] ?? null;
}

/**
 * Rank ships in memory by name / MMSI / destination / callsign-ish match.
 * Exact MMSI wins; then name prefix; then substring.
 */
export function searchShips(
  ships: Iterable<OsirisShip>,
  query: string,
  limit = 8,
  near?: { lat: number; lng: number } | null,
  vesselClass?: string | null,
): OsirisShip[] {
  const raw = query.trim();
  const browse = raw.length < 2;
  const mmsiQ = extractMmsiFromQuery(raw);
  const stripped = raw.replace(/^(?:mmsi|imo)[:\s#-]*/i, '').trim();
  const qRaw = (mmsiQ ?? (stripped || raw)).toLowerCase();
  const q = normalizeVesselName(qRaw);
  // Browse nearby vessels of a class with an empty query; otherwise need ≥2 chars.
  if (!browse && q.length < 2 && !mmsiQ) return [];
  if (browse && !vesselClass && !near) return [];

  const scored: { ship: OsirisShip; score: number; dist: number }[] = [];
  for (const ship of ships) {
    const nameRaw = (ship.name || '').toLowerCase();
    const name = normalizeVesselName(ship.name || '');
    const dest = normalizeVesselName(ship.destination || '');
    const mmsi = String(ship.mmsi);

    let score = 0;
    const nameTokens = name.split(/\s+/).filter(Boolean);
    if (browse) {
      if (!shipMatchesVesselClass(ship, vesselClass)) continue;
      score = 10;
      if (vesselClass === 'yacht' && (YACHT_NAME_RE.test(ship.name || '') || ship.type === 'other')) score = 40;
    } else if (mmsiQ && (mmsi === mmsiQ || mmsi.endsWith(mmsiQ) || mmsiQ.endsWith(mmsi))) score = 100;
    else if (mmsi === qRaw || mmsi === q) score = 100;
    else if (mmsi.startsWith(qRaw) || mmsi.startsWith(q)) score = 80;
    else if (name === q || nameTokens.includes(q)) score = 90;
    else if (name.startsWith(`${q} `) || nameRaw.startsWith(`${qRaw} `)) score = 70;
    else if (name.includes(q) || nameRaw.includes(qRaw)) score = 50;
    else if (dest.includes(q)) score = 30;
    else continue;

    // Named yacht search: only keep off-type craft when they look like yachts
    // (type 90 / M/Y name), never cargo/fishing that merely share a token.
    if (!browse && vesselClass && vesselClass !== 'all' && !shipMatchesVesselClass(ship, vesselClass)) {
      const yachtLike =
        vesselClass === 'yacht' &&
        score >= 90 &&
        (ship.type === 'other' || YACHT_NAME_RE.test(ship.name || ''));
      if (!yachtLike) continue;
    }

    const dist = near
      ? (ship.lat - near.lat) ** 2 + (ship.lng - near.lng) ** 2
      : 0;
    scored.push({ ship, score, dist });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.dist - b.dist ||
      a.ship.name.localeCompare(b.ship.name),
  );
  return scored.slice(0, limit).map((s) => s.ship);
}

export type AisSearchHit = {
  name: string;
  context: string;
  lat: number;
  lng: number;
  kind: 'ship';
  mmsi: number;
  type: string;
  destination: string;
  speed: number;
};

export function shipToSearchHit(ship: OsirisShip): AisSearchHit {
  const bits = [
    `MMSI ${ship.mmsi}`,
    ship.type,
    ship.destination ? `→ ${ship.destination}` : null,
    Number.isFinite(ship.speed) ? `${ship.speed.toFixed(1)} kn` : null,
  ].filter(Boolean);
  return {
    name: ship.name || `MMSI ${ship.mmsi}`,
    context: bits.join(' · '),
    lat: ship.lat,
    lng: ship.lng,
    kind: 'ship',
    mmsi: ship.mmsi,
    type: ship.type,
    destination: ship.destination,
    speed: ship.speed,
  };
}
