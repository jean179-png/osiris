import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from './types';
import { pointFeature, emptyFc, capFeatures } from './geojson';

/** IEM Local Storm Report lightning rows (CSV-ish fields after parse). */
export type LsrLightningRow = {
  lat: number;
  lng: number;
  valid?: string;
  magnitude?: string | null;
  city?: string | null;
  remark?: string | null;
};

function inBbox(lng: number, lat: number, bbox: BBox): boolean {
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

export function mapLightningRows(rows: LsrLightningRow[], bbox: BBox, max = 2000): FeatureCollection {
  const features: Feature[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
    if (!inBbox(row.lng, row.lat, bbox)) continue;
    const id = `ltn-${row.lng.toFixed(3)}-${row.lat.toFixed(3)}-${row.valid || features.length}`;
    features.push(
      pointFeature(id, row.lng, row.lat, {
        kind: 'ground_lightning',
        name: row.city || 'Lightning',
        title: 'Lightning strike',
        magnitude: row.magnitude ?? null,
        remark: row.remark ?? null,
        observedAt: row.valid ?? null,
        attribution: 'IEM / NWS LSR',
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, max);
}

/** Parse IEM LSR GeoJSON FeatureCollection. */
export function mapIemLsrGeoJson(data: unknown, bbox: BBox): FeatureCollection {
  const featuresIn = (data as { features?: unknown[] })?.features;
  if (!Array.isArray(featuresIn)) return emptyFc();
  const rows: LsrLightningRow[] = [];
  for (const f of featuresIn) {
    const feat = f as {
      geometry?: { type?: string; coordinates?: number[] };
      properties?: Record<string, unknown>;
    };
    const coords = feat.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const typ = String(feat.properties?.typetext || feat.properties?.type || '').toLowerCase();
    if (typ && !typ.includes('lightning') && typ !== 'l') continue;
    rows.push({
      lng: Number(coords[0]),
      lat: Number(coords[1]),
      valid: feat.properties?.valid ? String(feat.properties.valid) : null,
      magnitude: feat.properties?.magnitude != null ? String(feat.properties.magnitude) : null,
      city: feat.properties?.city ? String(feat.properties.city) : null,
      remark: feat.properties?.remark ? String(feat.properties.remark) : null,
    } as LsrLightningRow);
  }
  return mapLightningRows(rows, bbox);
}
