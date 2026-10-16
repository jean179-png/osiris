import type { Feature, FeatureCollection, Position } from 'geojson';
import { featureOf, emptyFc, pointFeature, capFeatures } from './geojson';

type NhcStorm = {
  id?: string;
  name?: string;
  basin?: string;
  classification?: string;
  intensity?: string | number;
  pressure?: string | number;
  latitude?: string | number;
  longitude?: string | number;
  latitudeNumeric?: number;
  longitudeNumeric?: number;
  movementDir?: string | number;
  movementSpeed?: string | number;
  lastUpdate?: string;
};

function parseLat(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^([\d.]+)\s*([NSns])?$/);
  if (!m) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  let lat = Number(m[1]);
  if ((m[2] || '').toUpperCase() === 'S') lat = -lat;
  return lat;
}

function parseLng(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^([\d.]+)\s*([EWew])?$/);
  if (!m) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  let lng = Number(m[1]);
  if ((m[2] || '').toUpperCase() === 'W') lng = -lng;
  return lng;
}

export function mapNhcCurrentStorms(data: unknown): FeatureCollection {
  const storms = (data as { activeStorms?: NhcStorm[] })?.activeStorms
    ?? (data as { storms?: NhcStorm[] })?.storms
    ?? (Array.isArray(data) ? data : []);
  if (!Array.isArray(storms)) return emptyFc();
  const features: Feature[] = [];
  for (const s of storms as NhcStorm[]) {
    const lat =
      typeof s.latitudeNumeric === 'number' && Number.isFinite(s.latitudeNumeric)
        ? s.latitudeNumeric
        : parseLat(s.latitude);
    const lng =
      typeof s.longitudeNumeric === 'number' && Number.isFinite(s.longitudeNumeric)
        ? s.longitudeNumeric
        : parseLng(s.longitude);
    if (lat == null || lng == null) continue;
    const id = s.id || `storm-${features.length}`;
    features.push(
      pointFeature(id, lng, lat, {
        kind: 'ground_storms',
        name: s.name || id,
        title: s.name || id,
        classification: s.classification ?? null,
        intensity: s.intensity != null ? String(s.intensity) : null,
        pressure: s.pressure != null ? String(s.pressure) : null,
        movementDir: s.movementDir != null ? String(s.movementDir) : null,
        movementSpeed: s.movementSpeed != null ? String(s.movementSpeed) : null,
        lastUpdate: s.lastUpdate ?? null,
        attribution: 'NOAA NHC',
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, 50);
}

/** Merge optional track LineStrings / cone Polygons from NHC GIS-style GeoJSON. */
export function mergeStormGeoJson(
  points: FeatureCollection,
  extras: unknown,
): FeatureCollection {
  const extraFeatures = (extras as { features?: Feature[] })?.features;
  if (!Array.isArray(extraFeatures) || extraFeatures.length === 0) return points;
  const mapped: Feature[] = [];
  for (const f of extraFeatures) {
    if (!f?.geometry) continue;
    mapped.push(
      featureOf(
        f.id ?? `storm-extra-${mapped.length}`,
        f.geometry,
        {
          ...(f.properties || {}),
          kind: 'ground_storms',
          attribution: 'NOAA NHC',
        },
      ),
    );
  }
  return capFeatures(
    { type: 'FeatureCollection', features: [...points.features, ...mapped] },
    200,
  );
}

export type { Position };
