import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from './types';
import { pointFeature, emptyFc, capFeatures } from './geojson';

function inBbox(lng: number, lat: number, bbox: BBox): boolean {
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

function numOrNull(v: string): number | null {
  if (!v || v === 'MM' || v === '999' || v === '99.0' || v === '99.00') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse NOAA NDBC latest_obs.txt (fixed-ish whitespace columns).
 * Header: #STN ... LAT LON ... WDIR WSPD GST WVHT ... ATMP WTMP ...
 */
export function mapNdbcLatestObs(text: string, bbox: BBox, max = 2500): FeatureCollection {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  const features: Feature[] = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 15) continue;
    const id = parts[0]!;
    const lat = Number(parts[1]);
    const lng = Number(parts[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!inBbox(lng, lat, bbox)) continue;
    // STN LAT LON YYYY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES PTDY ATMP WTMP …
    const windDir = numOrNull(parts[8] ?? '');
    const windSpd = numOrNull(parts[9] ?? '');
    const gust = numOrNull(parts[10] ?? '');
    const waveHt = numOrNull(parts[11] ?? '');
    const airTemp = numOrNull(parts[17] ?? '');
    const waterTemp = numOrNull(parts[18] ?? '');
    features.push(
      pointFeature(`buoy-${id}`, lng, lat, {
        kind: 'ground_buoys',
        name: id,
        title: `Buoy ${id}`,
        windDir,
        windSpd,
        gust,
        waveHt,
        airTemp,
        waterTemp,
        attribution: 'NOAA NDBC',
      }),
    );
    if (features.length >= max) break;
  }
  return capFeatures({ type: 'FeatureCollection', features }, max);
}

export function emptyBuoys(): FeatureCollection {
  return emptyFc();
}
