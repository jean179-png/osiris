/**
 * Paleo / Sea Level — meter range, presets, formatting.
 */

export type PaleoMode = 'meters' | 'ma';

export const PALEO_M_MIN = -120;
export const PALEO_M_MAX = 70;

export const PALEO_PRESETS = [
  { id: 'lgm', label: 'LGM', meters: -120 },
  { id: 'today', label: 'Today', meters: 0 },
  { id: 'all_ice', label: 'All ice', meters: 70 },
] as const;

export function clampSeaLevelMeters(m: number): number {
  if (!Number.isFinite(m)) return 0;
  return Math.min(PALEO_M_MAX, Math.max(PALEO_M_MIN, m));
}

export function snapSeaLevelMeters(m: number, step = 1): number {
  const s = step > 0 ? step : 1;
  const clamped = clampSeaLevelMeters(m);
  return clampSeaLevelMeters(Math.round(clamped / s) * s);
}

/** Unicode minus for negatives; + for positive; bare 0. */
export function formatSeaLevelMeters(m: number): string {
  const v = snapSeaLevelMeters(m, 1);
  if (v === 0) return '0 m';
  if (v < 0) return `−${Math.abs(v)} m`;
  return `+${v} m`;
}
