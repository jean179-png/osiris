import { speedDirToUV, type WindFieldGrid, type WindProductId } from './wind-field';

const STEP = 10;
const BATCH = 50;
const TTL_MS = 45 * 60_000;
const ATTRIBUTION = 'Open-Meteo · GFS';

export type MeshPoint = { lat: number; lng: number; index: number };

export function surfaceMesh(): {
  width: number;
  height: number;
  west: number;
  south: number;
  east: number;
  north: number;
  lons: number[];
  lats: number[];
  points: MeshPoint[];
} {
  const lons: number[] = [];
  for (let lng = -180; lng < 180; lng += STEP) lons.push(lng);
  const lats: number[] = [];
  for (let lat = -85; lat <= 85; lat += STEP) lats.push(lat);
  const width = lons.length;
  const height = lats.length;
  const points: MeshPoint[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      points.push({ lat: lats[y]!, lng: lons[x]!, index: y * width + x });
    }
  }
  return {
    width,
    height,
    west: lons[0]!,
    south: lats[0]!,
    east: lons[lons.length - 1]!,
    north: lats[lats.length - 1]!,
    lons,
    lats,
    points,
  };
}

export function chunkCoords<T>(items: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function asArray(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(Number);
  if (typeof v === 'number') return [v];
  return [];
}

/** Apply one Open-Meteo multi-location current response into u/v buffers. */
export function mapOpenMeteoBatchToUV(
  body: unknown,
  points: MeshPoint[],
  u: Float32Array,
  v: Float32Array,
): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const current = (b.current ?? {}) as Record<string, unknown>;
  const speeds = asArray(current.wind_speed_10m);
  const dirs = asArray(current.wind_direction_10m);
  const n = Math.min(points.length, speeds.length, dirs.length);
  for (let i = 0; i < n; i++) {
    const { u: uu, v: vv } = speedDirToUV(speeds[i]!, dirs[i]!);
    const idx = points[i]!.index;
    u[idx] = uu;
    v[idx] = vv;
  }
  const time = current.time != null ? String(current.time) : null;
  return time;
}

type CacheEntry = { at: number; grid: WindFieldGrid };
let cache: CacheEntry | null = null;

export async function buildSurfaceGrid(opts?: {
  bypassCache?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<WindFieldGrid> {
  if (!opts?.bypassCache && cache && Date.now() - cache.at < TTL_MS) {
    return cache.grid;
  }
  const fetchFn = opts?.fetchImpl ?? fetch;
  const mesh = surfaceMesh();
  const u = new Float32Array(mesh.width * mesh.height);
  const v = new Float32Array(mesh.width * mesh.height);
  let validTime: string | null = null;
  const chunks = chunkCoords(mesh.points, BATCH);
  for (const chunk of chunks) {
    const lat = chunk.map((p) => p.lat).join(',');
    const lng = chunk.map((p) => p.lng).join(',');
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&cell_selection=nearest`;
    const res = await fetchFn(url, { signal: AbortSignal.timeout(25_000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const body = await res.json();
    const t = mapOpenMeteoBatchToUV(body, chunk, u, v);
    if (t) validTime = t;
  }
  const grid: WindFieldGrid = {
    product: 'surface' satisfies WindProductId,
    width: mesh.width,
    height: mesh.height,
    west: mesh.west,
    south: mesh.south,
    east: mesh.east,
    north: mesh.north,
    u,
    v,
    unit: 'm/s',
    validTime,
    attribution: ATTRIBUTION,
  };
  cache = { at: Date.now(), grid };
  return grid;
}

export function windGridToJson(grid: WindFieldGrid) {
  return {
    product: grid.product,
    width: grid.width,
    height: grid.height,
    west: grid.west,
    south: grid.south,
    east: grid.east,
    north: grid.north,
    u: Array.from(grid.u),
    v: Array.from(grid.v),
    unit: grid.unit,
    validTime: grid.validTime,
    attribution: grid.attribution,
  };
}

export function windGridFromJson(j: ReturnType<typeof windGridToJson>): WindFieldGrid {
  return {
    ...j,
    u: Float32Array.from(j.u),
    v: Float32Array.from(j.v),
  };
}
