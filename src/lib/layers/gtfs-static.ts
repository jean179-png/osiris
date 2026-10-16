import JSZip from 'jszip';
import type { Feature, FeatureCollection, Position } from 'geojson';
import type { GtfsAgency } from './gtfs';
import { emptyFc, featureOf } from './geojson';

const STATIC_TTL_MS = 12 * 60 * 60_000;
const FETCH_TIMEOUT_MS = 45_000;

export interface TripEndpoints {
  origin: string | null;
  destination: string | null;
  headsign: string | null;
  routeId: string | null;
  routeShortName: string | null;
  routeLongName: string | null;
  routeType: number | null;
  routeTypeLabel: string | null;
  shapeId: string | null;
}

export type StaticGtfsIndex = Map<string, TripEndpoints>;

export type StaticGtfsPack = {
  index: StaticGtfsIndex;
  tripToShape: Map<string, string>;
  routeToShape: Map<string, string>;
  /** Raw shapes.txt for lazy per-shape parse. */
  shapesText: string | null;
  /** Parsed shape_id → coordinates (lng, lat), filled on demand. */
  shapeCoords: Map<string, Position[]>;
  /** stop_id → [lng, lat] for stop-sequence fallback paths. */
  stopCoords: Map<string, Position>;
  /** Raw stop_times.txt for fallback path build. */
  stopTimesText: string | null;
  /** tripId → stop-sequence path, filled on demand. */
  stopPaths: Map<string, Position[]>;
  /** stop_id → display name. */
  stopNames: Map<string, string>;
};

export type TripStopRow = {
  stopId: string;
  name: string;
  sequence: number;
  lng: number;
  lat: number;
  arrival: string | null;
  departure: string | null;
};

type CacheEntry = {
  pack: StaticGtfsPack;
  expiresAt: number;
  inflight: Promise<StaticGtfsPack | null> | null;
};

const cache = new Map<string, CacheEntry>();

const ROUTE_TYPE_LABELS: Record<number, string> = {
  0: 'Tram',
  1: 'Subway',
  2: 'Rail',
  3: 'Bus',
  4: 'Ferry',
  5: 'Cable car',
  6: 'Gondola',
  7: 'Funicular',
  11: 'Trolleybus',
  12: 'Monorail',
};

export function routeTypeLabel(type: number | null | undefined): string | null {
  if (type == null || !Number.isFinite(type)) return null;
  return ROUTE_TYPE_LABELS[type] ?? `Type ${type}`;
}

/** Minimal CSV splitter that respects double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headers: string[] = [];
  const rows: string[][] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const cols = splitCsvLine(line);
    if (headers.length === 0) {
      headers.push(...cols.map((h) => h.trim()));
      continue;
    }
    rows.push(cols);
  }
  return { headers, rows };
}

function colIndex(headers: string[], name: string): number {
  return headers.findIndex((h) => h === name);
}

function cell(row: string[], i: number): string {
  if (i < 0 || i >= row.length) return '';
  return (row[i] ?? '').trim();
}

async function zipText(zip: JSZip, fileName: string): Promise<string | null> {
  const direct = zip.file(fileName);
  if (direct) return direct.async('string');
  const re = new RegExp(`(^|/)${fileName.replace('.', '\\.')}$`, 'i');
  const match = zip.file(re)?.[0];
  if (match) return match.async('string');
  return null;
}

function emptyPack(): StaticGtfsPack {
  return {
    index: new Map(),
    tripToShape: new Map(),
    routeToShape: new Map(),
    shapesText: null,
    shapeCoords: new Map(),
    stopCoords: new Map(),
    stopTimesText: null,
    stopPaths: new Map(),
    stopNames: new Map(),
  };
}

/** Build tripId → endpoints (+ shape ids) from static GTFS tables. */
export function buildStaticIndex(files: {
  trips?: string | null;
  stopTimes?: string | null;
  stops?: string | null;
  routes?: string | null;
}): StaticGtfsIndex {
  return buildStaticPack({ ...files, shapes: null }).index;
}

export function buildStaticPack(files: {
  trips?: string | null;
  stopTimes?: string | null;
  stops?: string | null;
  routes?: string | null;
  shapes?: string | null;
}): StaticGtfsPack {
  const pack = emptyPack();
  pack.shapesText = files.shapes ?? null;
  pack.stopTimesText = files.stopTimes ?? null;

  const routes = new Map<
    string,
    { short: string | null; long: string | null; type: number | null }
  >();
  const tripMeta = new Map<
    string,
    { routeId: string | null; headsign: string | null; shapeId: string | null }
  >();
  const ends = new Map<
    string,
    { firstSeq: number; lastSeq: number; firstStop: string; lastStop: string }
  >();

  if (files.stops) {
    const { headers, rows } = parseCsv(files.stops);
    const iId = colIndex(headers, 'stop_id');
    const iName = colIndex(headers, 'stop_name');
    const iLat = colIndex(headers, 'stop_lat');
    const iLon = colIndex(headers, 'stop_lon');
    for (const row of rows) {
      const id = cell(row, iId);
      if (!id) continue;
      pack.stopNames.set(id, cell(row, iName) || id);
      const lat = Number(cell(row, iLat));
      const lon = Number(cell(row, iLon));
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        pack.stopCoords.set(id, [lon, lat]);
      }
    }
  }

  if (files.routes) {
    const { headers, rows } = parseCsv(files.routes);
    const iId = colIndex(headers, 'route_id');
    const iShort = colIndex(headers, 'route_short_name');
    const iLong = colIndex(headers, 'route_long_name');
    const iType = colIndex(headers, 'route_type');
    for (const row of rows) {
      const id = cell(row, iId);
      if (!id) continue;
      const typeRaw = cell(row, iType);
      const type = typeRaw === '' ? null : Number(typeRaw);
      routes.set(id, {
        short: cell(row, iShort) || null,
        long: cell(row, iLong) || null,
        type: Number.isFinite(type) ? type : null,
      });
    }
  }

  if (files.trips) {
    const { headers, rows } = parseCsv(files.trips);
    const iTrip = colIndex(headers, 'trip_id');
    const iRoute = colIndex(headers, 'route_id');
    const iHead = colIndex(headers, 'trip_headsign');
    const iShape = colIndex(headers, 'shape_id');
    for (const row of rows) {
      const tripId = cell(row, iTrip);
      if (!tripId) continue;
      const routeId = cell(row, iRoute) || null;
      const shapeId = cell(row, iShape) || null;
      tripMeta.set(tripId, {
        routeId,
        headsign: cell(row, iHead) || null,
        shapeId,
      });
      if (shapeId) {
        pack.tripToShape.set(tripId, shapeId);
        if (routeId && !pack.routeToShape.has(routeId)) {
          pack.routeToShape.set(routeId, shapeId);
        }
      }
    }
  }

  if (files.stopTimes) {
    const { headers, rows } = parseCsv(files.stopTimes);
    const iTrip = colIndex(headers, 'trip_id');
    const iStop = colIndex(headers, 'stop_id');
    const iSeq = colIndex(headers, 'stop_sequence');
    for (const row of rows) {
      const tripId = cell(row, iTrip);
      const stopId = cell(row, iStop);
      const seq = Number(cell(row, iSeq));
      if (!tripId || !stopId || !Number.isFinite(seq)) continue;
      const prev = ends.get(tripId);
      if (!prev) {
        ends.set(tripId, { firstSeq: seq, lastSeq: seq, firstStop: stopId, lastStop: stopId });
      } else if (seq < prev.firstSeq) {
        prev.firstSeq = seq;
        prev.firstStop = stopId;
      } else if (seq > prev.lastSeq) {
        prev.lastSeq = seq;
        prev.lastStop = stopId;
      }
    }
  }

  const tripIds = new Set<string>([...tripMeta.keys(), ...ends.keys()]);
  for (const tripId of tripIds) {
    const meta = tripMeta.get(tripId);
    const end = ends.get(tripId);
    const routeId = meta?.routeId ?? null;
    const route = routeId ? routes.get(routeId) : undefined;
    const origin = end ? pack.stopNames.get(end.firstStop) ?? end.firstStop : null;
    const destination = end ? pack.stopNames.get(end.lastStop) ?? end.lastStop : null;
    pack.index.set(tripId, {
      origin,
      destination,
      headsign: meta?.headsign ?? null,
      routeId,
      routeShortName: route?.short ?? null,
      routeLongName: route?.long ?? null,
      routeType: route?.type ?? null,
      routeTypeLabel: routeTypeLabel(route?.type ?? null),
      shapeId: meta?.shapeId ?? pack.tripToShape.get(tripId) ?? null,
    });
  }

  return pack;
}

/** Extract one shape_id's coordinates from shapes.txt (cached on the pack). */
export function coordsForShapeId(pack: StaticGtfsPack, shapeId: string): Position[] | null {
  const hit = pack.shapeCoords.get(shapeId);
  if (hit) return hit.length >= 2 ? hit : null;
  if (!pack.shapesText) return null;

  const lines = pack.shapesText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) return null;
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const iId = colIndex(headers, 'shape_id');
  const iLat = colIndex(headers, 'shape_pt_lat');
  const iLon = colIndex(headers, 'shape_pt_lon');
  const iSeq = colIndex(headers, 'shape_pt_sequence');
  if (iId < 0 || iLat < 0 || iLon < 0) return null;

  const pts: { seq: number; coord: Position }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const row = splitCsvLine(line);
    if (cell(row, iId) !== shapeId) continue;
    const lat = Number(cell(row, iLat));
    const lon = Number(cell(row, iLon));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const seq = iSeq >= 0 ? Number(cell(row, iSeq)) : pts.length;
    pts.push({ seq: Number.isFinite(seq) ? seq : pts.length, coord: [lon, lat] });
  }
  pts.sort((a, b) => a.seq - b.seq);
  const coords = pts.map((p) => p.coord);
  pack.shapeCoords.set(shapeId, coords);
  return coords.length >= 2 ? coords : null;
}

/** Fallback polyline: ordered stop coordinates for a trip. */
export function stopPathForTrip(pack: StaticGtfsPack, tripId: string): Position[] | null {
  const hit = pack.stopPaths.get(tripId);
  if (hit) return hit.length >= 2 ? hit : null;
  if (!pack.stopTimesText || pack.stopCoords.size === 0) return null;

  const lines = pack.stopTimesText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) return null;
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const iTrip = colIndex(headers, 'trip_id');
  const iStop = colIndex(headers, 'stop_id');
  const iSeq = colIndex(headers, 'stop_sequence');
  const pts: { seq: number; coord: Position }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const row = splitCsvLine(line);
    if (cell(row, iTrip) !== tripId) continue;
    const stopId = cell(row, iStop);
    const coord = pack.stopCoords.get(stopId);
    if (!coord) continue;
    const seq = Number(cell(row, iSeq));
    pts.push({ seq: Number.isFinite(seq) ? seq : pts.length, coord });
  }
  pts.sort((a, b) => a.seq - b.seq);
  const coords = pts.map((p) => p.coord);
  pack.stopPaths.set(tripId, coords);
  return coords.length >= 2 ? coords : null;
}

export function resolveTripShapeCoords(
  pack: StaticGtfsPack,
  tripId?: string | null,
  routeId?: string | null,
): { coords: Position[]; shapeId: string | null; source: 'shape' | 'stops' } | null {
  const shapeId =
    (tripId && pack.tripToShape.get(tripId)) ||
    (routeId && pack.routeToShape.get(routeId)) ||
    null;
  if (shapeId) {
    const coords = coordsForShapeId(pack, shapeId);
    if (coords) return { coords, shapeId, source: 'shape' };
  }
  if (tripId) {
    const coords = stopPathForTrip(pack, tripId);
    if (coords) return { coords, shapeId: null, source: 'stops' };
  }
  return null;
}

export async function loadStaticPackFromBuffer(buffer: ArrayBuffer): Promise<StaticGtfsPack> {
  const zip = await JSZip.loadAsync(buffer);
  const [trips, stopTimes, stops, routes, shapes] = await Promise.all([
    zipText(zip, 'trips.txt'),
    zipText(zip, 'stop_times.txt'),
    zipText(zip, 'stops.txt'),
    zipText(zip, 'routes.txt'),
    zipText(zip, 'shapes.txt'),
  ]);
  return buildStaticPack({ trips, stopTimes, stops, routes, shapes });
}

export async function loadStaticIndexFromBuffer(buffer: ArrayBuffer): Promise<StaticGtfsIndex> {
  return (await loadStaticPackFromBuffer(buffer)).index;
}

export function _resetStaticGtfsCacheForTests(): void {
  cache.clear();
}

async function fetchAndPack(url: string): Promise<StaticGtfsPack | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'osiris-layers/1.0',
        Accept: 'application/zip, application/octet-stream, */*',
      },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return await loadStaticPackFromBuffer(buf);
  } catch (err) {
    console.warn('[gtfs-static]', url, err);
    return null;
  }
}

/** Cached static GTFS pack for an agency URL. Soft-fails to null. */
export async function getStaticGtfsPack(
  agency: Pick<GtfsAgency, 'id' | 'staticGtfsUrl'>,
): Promise<StaticGtfsPack | null> {
  const url = agency.staticGtfsUrl;
  if (!url) return null;
  const key = agency.id;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now < hit.expiresAt) return hit.pack;
  if (hit?.inflight) return hit.inflight;

  const inflight = fetchAndPack(url).then((pack) => {
    if (pack && pack.index.size > 0) {
      cache.set(key, { pack, expiresAt: Date.now() + STATIC_TTL_MS, inflight: null });
      return pack;
    }
    cache.set(key, {
      pack: emptyPack(),
      expiresAt: Date.now() + 5 * 60_000,
      inflight: null,
    });
    return null;
  });

  cache.set(key, {
    pack: hit?.pack ?? emptyPack(),
    expiresAt: 0,
    inflight,
  });
  return inflight;
}

export async function getStaticGtfsIndex(
  agency: Pick<GtfsAgency, 'id' | 'staticGtfsUrl'>,
): Promise<StaticGtfsIndex | null> {
  const pack = await getStaticGtfsPack(agency);
  return pack?.index ?? null;
}

export function lookupTrip(
  index: StaticGtfsIndex | null | undefined,
  tripId: string | null | undefined,
): TripEndpoints | null {
  if (!index || !tripId) return null;
  return index.get(tripId) ?? null;
}

/** Merge static trip O/D + route type onto vehicle point features. */
export function enrichVehiclesWithStatic(
  fc: FeatureCollection,
  index: StaticGtfsIndex | null,
): FeatureCollection {
  if (!index || index.size === 0) return fc;
  const features: Feature[] = fc.features.map((f) => {
    const p = f.properties ?? {};
    if (p.kind === 'ground_train_tracks') return f;
    const tripId = typeof p.tripId === 'string' ? p.tripId : null;
    const ep = lookupTrip(index, tripId);
    if (!ep) return f;
    return {
      ...f,
      properties: {
        ...p,
        origin: ep.origin,
        destination: ep.destination ?? ep.headsign,
        headsign: ep.headsign,
        routeShortName: ep.routeShortName ?? p.routeShortName ?? null,
        routeLongName: ep.routeLongName ?? null,
        routeType: ep.routeType,
        routeTypeLabel: ep.routeTypeLabel,
        shapeId: ep.shapeId,
        routeId: p.routeId || ep.routeId,
      },
    };
  });
  return { type: 'FeatureCollection', features };
}

/** Prefer a ready cache; wait briefly on cold start so O/D can land without stalling RT. */
export async function enrichAgencyVehicles(
  fc: FeatureCollection,
  agency: Pick<GtfsAgency, 'id' | 'staticGtfsUrl'>,
  waitMs = 2_500,
): Promise<FeatureCollection> {
  if (!agency.staticGtfsUrl) return fc;
  const key = agency.id;
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt && hit.pack.index.size > 0) {
    return enrichVehiclesWithStatic(fc, hit.pack.index);
  }
  const pending = getStaticGtfsPack(agency);
  const pack = await Promise.race([
    pending,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]);
  return enrichVehiclesWithStatic(fc, pack?.index ?? null);
}

type ParsedStopTime = {
  stopId: string;
  sequence: number;
  arrival: string | null;
  departure: string | null;
};

function parseStopTimesForTrip(pack: StaticGtfsPack, tripId: string): ParsedStopTime[] {
  if (!tripId || !pack.stopTimesText) return [];
  const lines = pack.stopTimesText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const iTrip = colIndex(headers, 'trip_id');
  const iStop = colIndex(headers, 'stop_id');
  const iSeq = colIndex(headers, 'stop_sequence');
  const iArr = colIndex(headers, 'arrival_time');
  const iDep = colIndex(headers, 'departure_time');
  if (iTrip < 0 || iStop < 0 || iSeq < 0) return [];

  const rows: ParsedStopTime[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const row = splitCsvLine(line);
    if (cell(row, iTrip) !== tripId) continue;
    const stopId = cell(row, iStop);
    const seq = Number(cell(row, iSeq));
    if (!stopId || !Number.isFinite(seq)) continue;
    rows.push({
      stopId,
      sequence: seq,
      arrival: iArr >= 0 ? cell(row, iArr) || null : null,
      departure: iDep >= 0 ? cell(row, iDep) || null : null,
    });
  }
  rows.sort((a, b) => a.sequence - b.sequence);
  return rows;
}

function resolveStopTimeRows(pack: StaticGtfsPack, tripId: string): ParsedStopTime[] {
  const exact = parseStopTimesForTrip(pack, tripId);
  if (exact.length) return exact;
  // Some RT feeds prefix trip ids; try suffix / bare match once.
  if (!pack.stopTimesText) return [];
  const lines = pack.stopTimesText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const iTrip = colIndex(headers, 'trip_id');
  if (iTrip < 0) return [];
  const candidates = new Set<string>();
  for (let i = 1; i < lines.length && candidates.size < 5; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const id = cell(splitCsvLine(line), iTrip);
    if (!id) continue;
    if (id === tripId || id.endsWith(tripId) || tripId.endsWith(id)) candidates.add(id);
  }
  for (const id of candidates) {
    if (id === tripId) continue;
    const rows = parseStopTimesForTrip(pack, id);
    if (rows.length) return rows;
  }
  return [];
}

function toTripStopRow(pack: StaticGtfsPack, r: ParsedStopTime): TripStopRow | null {
  const coord = pack.stopCoords.get(r.stopId);
  if (!coord) return null;
  return {
    stopId: r.stopId,
    name: pack.stopNames.get(r.stopId) || r.stopId,
    sequence: r.sequence,
    lng: coord[0],
    lat: coord[1],
    arrival: r.arrival,
    departure: r.departure,
  };
}

/** Upcoming stops after current sequence/id (capped). Parses stop_times on demand. */
export function upcomingStopsForTrip(
  pack: StaticGtfsPack,
  tripId: string,
  opts?: {
    currentStopSequence?: number | null;
    currentStopId?: string | null;
    limit?: number;
  },
): TripStopRow[] {
  const rows = resolveStopTimeRows(pack, tripId);
  if (!rows.length) return [];
  const limit = Math.max(1, Math.min(opts?.limit ?? 8, 20));

  let startIdx = 0;
  if (opts?.currentStopSequence != null && Number.isFinite(opts.currentStopSequence)) {
    const seq = Number(opts.currentStopSequence);
    startIdx = rows.findIndex((r) => r.sequence > seq);
    if (startIdx < 0) startIdx = rows.length;
  } else if (opts?.currentStopId) {
    const at = rows.findIndex((r) => r.stopId === opts.currentStopId);
    startIdx = at >= 0 ? at + 1 : 0;
  }

  const out: TripStopRow[] = [];
  for (let i = startIdx; i < rows.length && out.length < limit; i++) {
    const row = toTripStopRow(pack, rows[i]!);
    if (row) out.push(row);
  }
  return out;
}

export type TripStopMarker = TripStopRow & { isCurrent: boolean; isNext: boolean };

/** All (or windowed) stops on a trip for map markers. */
export function stopsAlongTrip(
  pack: StaticGtfsPack,
  tripId: string,
  opts?: {
    currentStopSequence?: number | null;
    currentStopId?: string | null;
    limit?: number;
  },
): TripStopMarker[] {
  const rows = resolveStopTimeRows(pack, tripId);
  if (!rows.length) return [];
  const limit = Math.max(1, Math.min(opts?.limit ?? 40, 80));

  let currentIdx = -1;
  if (opts?.currentStopId) {
    currentIdx = rows.findIndex((r) => r.stopId === opts.currentStopId);
  }
  if (currentIdx < 0 && opts?.currentStopSequence != null && Number.isFinite(opts.currentStopSequence)) {
    const seq = Number(opts.currentStopSequence);
    currentIdx = rows.findIndex((r) => r.sequence >= seq);
    if (currentIdx < 0) currentIdx = rows.length - 1;
  }

  let slice = rows;
  if (rows.length > limit) {
    if (currentIdx >= 0) {
      const half = Math.floor(limit / 2);
      let start = Math.max(0, currentIdx - half);
      let end = Math.min(rows.length, start + limit);
      start = Math.max(0, end - limit);
      slice = rows.slice(start, end);
    } else {
      const step = rows.length / limit;
      slice = Array.from({ length: limit }, (_, i) => rows[Math.min(rows.length - 1, Math.floor(i * step))]!);
    }
  }

  const nextIdx =
    currentIdx >= 0 && currentIdx + 1 < rows.length
      ? currentIdx + 1
      : currentIdx < 0
        ? 0
        : -1;
  const nextStopId = nextIdx >= 0 ? rows[nextIdx]!.stopId : null;
  const currentStopId = currentIdx >= 0 ? rows[currentIdx]!.stopId : null;

  const out: TripStopMarker[] = [];
  for (const r of slice) {
    const row = toTripStopRow(pack, r);
    if (!row) continue;
    out.push({
      ...row,
      isCurrent: currentStopId != null && row.stopId === currentStopId,
      isNext: nextStopId != null && row.stopId === nextStopId,
    });
  }
  return out;
}

/** Build a LineString FeatureCollection for a trip/route shape (+ optional stop points). */
export async function tripShapeFeatureCollection(
  agency: Pick<GtfsAgency, 'id' | 'name' | 'staticGtfsUrl'>,
  tripId?: string | null,
  routeId?: string | null,
  opts?: {
    currentStopSequence?: number | null;
    currentStopId?: string | null;
    stopLimit?: number;
  },
): Promise<FeatureCollection> {
  if (!tripId && !routeId) return emptyFc();
  const pack = await getStaticGtfsPack(agency);
  if (!pack) return emptyFc();
  const resolved = resolveTripShapeCoords(pack, tripId, routeId);
  if (!resolved) return emptyFc();
  const ep = tripId ? pack.index.get(tripId) : undefined;
  const features: Feature[] = [
    featureOf(
      `shape-${agency.id}-${tripId || routeId}`,
      { type: 'LineString', coordinates: resolved.coords },
      {
        kind: 'ground_transit_route',
        agencyId: agency.id,
        agencyName: agency.name,
        tripId: tripId ?? null,
        routeId: routeId ?? ep?.routeId ?? null,
        shapeId: resolved.shapeId,
        shapeSource: resolved.source,
        origin: ep?.origin ?? null,
        destination: ep?.destination ?? ep?.headsign ?? null,
        attribution: agency.name,
      },
    ),
  ];

  if (tripId) {
    const stops = stopsAlongTrip(pack, tripId, {
      currentStopSequence: opts?.currentStopSequence,
      currentStopId: opts?.currentStopId,
      limit: opts?.stopLimit ?? 40,
    });
    stops.forEach((row) => {
      features.push(
        featureOf(
          `stop-${agency.id}-${tripId}-${row.stopId}-${row.sequence}`,
          { type: 'Point', coordinates: [row.lng, row.lat] },
          {
            kind: 'ground_transit_stop',
            agencyId: agency.id,
            tripId,
            stopId: row.stopId,
            name: row.name,
            sequence: row.sequence,
            arrival: row.arrival,
            departure: row.departure,
            isCurrent: row.isCurrent,
            isNext: row.isNext,
            attribution: agency.name,
          },
        ),
      );
    });
  }

  return { type: 'FeatureCollection', features };
}
