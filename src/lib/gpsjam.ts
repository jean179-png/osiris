/**
 * gpsjam.org H3 interference helpers — CSV parse, severity, GeoJSON.
 * Clients hit /api/layers/gps-jam (server caches upstream).
 */

import { cellToBoundary } from 'h3-js';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

export type GpsJamLevel = 'medium' | 'high';

export type GpsJamHexRow = {
  h3: string;
  good: number;
  bad: number;
  total: number;
  pct: number;
  level: GpsJamLevel;
};

export const GPSJAM_ATTRIBUTION =
  'GPS interference © <a href="https://gpsjam.org/">gpsjam.org</a> (ADS-B Exchange)';

export const GPSJAM_MIN_AIRCRAFT = 3;

/** gpsjam FAQ: 100 * (bad - 1) / (good + bad); clamp ≥ 0 */
export function gpsJamPercentBad(good: number, bad: number): number {
  const total = good + bad;
  if (total <= 0 || bad <= 1) return 0;
  return (100 * (bad - 1)) / total;
}

/** medium: pct ∈ [2, 10]; high: pct > 10; else null (low) */
export function gpsJamLevel(pct: number): GpsJamLevel | null {
  if (pct > 10) return 'high';
  if (pct >= 2) return 'medium';
  return null;
}

export function parseGpsJamCsv(
  csv: string,
  opts?: { minAircraft?: number },
): GpsJamHexRow[] {
  const minAircraft = opts?.minAircraft ?? GPSJAM_MIN_AIRCRAFT;
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const out: GpsJamHexRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const parts = line.split(',');
    const h3 = parts[0]?.trim();
    const good = Number(parts[1]);
    const bad = Number(parts[2]);
    if (!h3 || !Number.isFinite(good) || !Number.isFinite(bad)) continue;
    const total = good + bad;
    if (total < minAircraft) continue;
    const pct = gpsJamPercentBad(good, bad);
    const level = gpsJamLevel(pct);
    if (!level) continue;
    out.push({ h3, good, bad, total, pct, level });
  }
  return out;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseGpsJamManifest(csv: string): string[] {
  const lines = csv.trim().split(/\r?\n/);
  const dates: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const date = lines[i]!.split(',')[0]?.trim();
    if (date && DATE_RE.test(date)) dates.push(date);
  }
  return dates;
}

export function latestManifestDate(dates: string[]): string | null {
  if (!dates.length) return null;
  return dates[dates.length - 1]!;
}

/** Closed GeoJSON ring [lng, lat][] from an H3 index. */
export function h3ToPolygonCoords(h3Index: string): [number, number][] {
  const boundary = cellToBoundary(h3Index); // [lat, lng][]
  const ring: [number, number][] = boundary.map(([lat, lng]) => [lng, lat]);
  if (ring.length && (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1])) {
    ring.push([...ring[0]!]);
  }
  return ring;
}

export function gpsJamRowsToFeatureCollection(
  rows: GpsJamHexRow[],
  date: string,
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  for (const row of rows) {
    try {
      const coords = h3ToPolygonCoords(row.h3);
      if (coords.length < 4) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {
          h3: row.h3,
          level: row.level,
          pct: Math.round(row.pct * 10) / 10,
          good: row.good,
          bad: row.bad,
          total: row.total,
          date,
        },
      });
    } catch {
      /* invalid h3 — skip */
    }
  }
  return { type: 'FeatureCollection', features };
}
