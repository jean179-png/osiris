import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from './types';
import { pointFeature, emptyFc, capFeatures } from './geojson';

function inBbox(lng: number, lat: number, bbox: BBox): boolean {
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

export type RoadIncidentRow = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description?: string | null;
  severity?: string | null;
  road?: string | null;
  source: string;
};

export function mapRoadIncidents(rows: RoadIncidentRow[], bbox: BBox, max = 1500): FeatureCollection {
  const features: Feature[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
    if (!inBbox(row.lng, row.lat, bbox)) continue;
    features.push(
      pointFeature(row.id, row.lng, row.lat, {
        kind: 'ground_road_incidents',
        name: row.title,
        title: row.title,
        description: row.description ?? null,
        severity: row.severity ?? null,
        road: row.road ?? null,
        attribution: row.source,
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, max);
}

/** Parse common IBI/511-style incident JSON arrays. */
export function mapIbiIncidents(data: unknown, source: string, bbox: BBox): FeatureCollection {
  const list = Array.isArray(data)
    ? data
    : (data as { incidents?: unknown[]; features?: unknown[] })?.incidents
      ?? (data as { features?: unknown[] })?.features
      ?? [];
  if (!Array.isArray(list)) return emptyFc();
  const rows: RoadIncidentRow[] = [];
  for (const item of list) {
    const r = item as Record<string, unknown>;
    const geom = r.geometry as { coordinates?: number[] } | undefined;
    const props = (r.properties as Record<string, unknown>) || r;
    let lat = Number(props.latitude ?? props.lat ?? props.Latitude);
    let lng = Number(props.longitude ?? props.lng ?? props.lon ?? props.Longitude);
    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && Array.isArray(geom?.coordinates)) {
      lng = Number(geom!.coordinates![0]);
      lat = Number(geom!.coordinates![1]);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const title = String(
      props.fullDesc ?? props.description ?? props.headline ?? props.type ?? props.eventType ?? 'Incident',
    );
    rows.push({
      id: `${source}-${props.id ?? props.ID ?? rows.length}`,
      lat,
      lng,
      title: title.slice(0, 160),
      description: props.fullDesc ? String(props.fullDesc) : props.description ? String(props.description) : null,
      severity: props.severity != null ? String(props.severity) : props.impact != null ? String(props.impact) : null,
      road: props.roadwayName != null ? String(props.roadwayName) : props.road != null ? String(props.road) : null,
      source,
    });
  }
  return mapRoadIncidents(rows, bbox);
}
