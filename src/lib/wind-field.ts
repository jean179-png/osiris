/** Product ids — v1 ships `surface` only; more levels later. */
export type WindProductId = 'surface';

export type WindFieldGrid = {
  product: WindProductId;
  width: number;
  height: number;
  west: number;
  south: number;
  east: number;
  north: number;
  /** Row-major, lon varies fastest. */
  u: Float32Array;
  v: Float32Array;
  unit: 'm/s';
  validTime: string | null;
  attribution: string;
};

/**
 * Meteorological convention: direction is where the wind blows FROM (degrees).
 * u = eastward, v = northward components (m/s).
 */
export function speedDirToUV(speedMs: number, directionDeg: number): { u: number; v: number } {
  const rad = (directionDeg * Math.PI) / 180;
  return {
    u: -speedMs * Math.sin(rad),
    v: -speedMs * Math.cos(rad),
  };
}

export function windSpeed(u: number, v: number): number {
  return Math.hypot(u, v);
}

/** Cool → warm nullschool-ish ramp for particle strokes. */
export function speedToRgba(speedMs: number): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, speedMs / 30));
  const r = Math.round(40 + t * 200);
  const g = Math.round(120 + t * 80);
  const b = Math.round(220 - t * 180);
  return [r, g, b, 220];
}

export function sampleUV(
  grid: WindFieldGrid,
  lng: number,
  lat: number,
): { u: number; v: number } | null {
  const { width: w, height: h, west, south, east, north } = grid;
  if (w < 1 || h < 1) return null;
  if (lng < west || lng > east || lat < south || lat > north) return null;
  const fx = w === 1 ? 0 : ((lng - west) / (east - west)) * (w - 1);
  const fy = h === 1 ? 0 : ((lat - south) / (north - south)) * (h - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const idx = (x: number, y: number) => y * w + x;
  const u00 = grid.u[idx(x0, y0)]!;
  const u10 = grid.u[idx(x1, y0)]!;
  const u01 = grid.u[idx(x0, y1)]!;
  const u11 = grid.u[idx(x1, y1)]!;
  const v00 = grid.v[idx(x0, y0)]!;
  const v10 = grid.v[idx(x1, y0)]!;
  const v01 = grid.v[idx(x0, y1)]!;
  const v11 = grid.v[idx(x1, y1)]!;
  const u = u00 * (1 - tx) * (1 - ty) + u10 * tx * (1 - ty) + u01 * (1 - tx) * ty + u11 * tx * ty;
  const v = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
  return { u, v };
}
