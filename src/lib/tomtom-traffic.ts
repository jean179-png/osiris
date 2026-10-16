/**
 * TomTom Traffic helpers — flow tile URLs and incident → GeoJSON mapping.
 * Key stays on the server; clients hit /api/tiles/tomtom-flow/{z}/{x}/{y}.
 */

import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from '@/lib/layers/types';
import { emptyFc, pointFeature, capFeatures } from '@/lib/layers/geojson';

export const TOMTOM_FLOW_ATTRIBUTION =
  'Traffic © TomTom (https://www.tomtom.com)';

/** Free-tier bbox cap for Incident Details (~10,000 km²). */
export const TOMTOM_INCIDENT_MAX_KM2 = 9_500;

const ICON_LABEL: Record<number, string> = {
  0: 'Incident',
  1: 'Accident',
  2: 'Fog',
  3: 'Dangerous conditions',
  4: 'Rain',
  5: 'Ice',
  6: 'Traffic jam',
  7: 'Lane closed',
  8: 'Road closed',
  9: 'Road works',
  10: 'Wind',
  11: 'Flooding',
  14: 'Broken-down vehicle',
};

export function tomtomApiKey(): string | null {
  const k = process.env.TOMTOM_API_KEY?.trim();
  return k || null;
}

/** Approx spherical rectangle area in km². */
export function bboxAreaKm2(bbox: BBox): number {
  const midLat = ((bbox.south + bbox.north) / 2) * (Math.PI / 180);
  const dy = Math.abs(bbox.north - bbox.south) * 111.32;
  const dx = Math.abs(bbox.east - bbox.west) * 111.32 * Math.max(0.01, Math.cos(midLat));
  return dx * dy;
}

/**
 * Shrink a viewport to ≤ maxKm2 around its center (TomTom incident Details limit).
 */
export function shrinkBboxToMaxArea(bbox: BBox, maxKm2 = TOMTOM_INCIDENT_MAX_KM2): BBox {
  if (bboxAreaKm2(bbox) <= maxKm2) return bbox;
  const midLat = (bbox.south + bbox.north) / 2;
  const midLng = (bbox.west + bbox.east) / 2;
  const cos = Math.max(0.2, Math.cos(midLat * (Math.PI / 180)));
  // Square-ish box: sideKm = sqrt(maxKm2)
  const sideKm = Math.sqrt(maxKm2);
  const halfLat = sideKm / 2 / 111.32;
  const halfLng = sideKm / 2 / (111.32 * cos);
  return {
    west: midLng - halfLng,
    south: midLat - halfLat,
    east: midLng + halfLng,
    north: midLat + halfLat,
  };
}

export function tomtomFlowTileUrl(z: number, x: number, y: number, key: string): string {
  // relative0-dark suits Osiris dark basemap (congestion relative to free-flow).
  return `https://api.tomtom.com/traffic/map/4/tile/flow/relative0-dark/${z}/${x}/${y}.png?key=${encodeURIComponent(key)}`;
}

export function tomtomIncidentDetailsUrl(bbox: BBox, key: string): string {
  const box = shrinkBboxToMaxArea(bbox);
  const bboxParam = `${box.west},${box.south},${box.east},${box.north}`;
  const fields =
    '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description},from,to,roadNumbers,delay,length}}}';
  const q = new URLSearchParams({
    key,
    bbox: bboxParam,
    fields,
    language: 'en-US',
    timeValidityFilter: 'present',
  });
  return `https://api.tomtom.com/traffic/services/5/incidentDetails?${q}`;
}

function midpoint(coords: number[][]): { lng: number; lat: number } | null {
  if (!coords.length) return null;
  const mid = coords[Math.floor(coords.length / 2)]!;
  const lng = Number(mid[0]);
  const lat = Number(mid[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng, lat };
}

function severityFromMagnitude(m: unknown): string {
  const n = typeof m === 'number' ? m : Number(m);
  if (n >= 3) return 'major';
  if (n === 2) return 'moderate';
  if (n === 1) return 'minor';
  return 'unknown';
}

/**
 * Map TomTom Incident Details payload to ground-layer point features.
 * LineString incidents become a midpoint pin (existing road_incidents layer is points-only).
 */
export function mapTomTomIncidents(data: unknown, bbox: BBox, max = 1500): FeatureCollection {
  const list = (data as { incidents?: unknown[] })?.incidents;
  if (!Array.isArray(list)) return emptyFc();

  const features: Feature[] = [];
  for (const item of list) {
    const f = item as {
      type?: string;
      geometry?: { type?: string; coordinates?: unknown };
      properties?: Record<string, unknown>;
    };
    const props = f.properties || {};
    const geom = f.geometry;
    let lng = NaN;
    let lat = NaN;
    if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
      lng = Number((geom.coordinates as number[])[0]);
      lat = Number((geom.coordinates as number[])[1]);
    } else if (geom?.type === 'LineString' && Array.isArray(geom.coordinates)) {
      const mid = midpoint(geom.coordinates as number[][]);
      if (mid) {
        lng = mid.lng;
        lat = mid.lat;
      }
    }
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < bbox.west || lng > bbox.east || lat < bbox.south || lat > bbox.north) continue;

    const icon = Number(props.iconCategory);
    const label = ICON_LABEL[icon] || 'Incident';
    const events = Array.isArray(props.events) ? props.events : [];
    const eventDesc = events
      .map((e) => (e && typeof e === 'object' ? String((e as { description?: string }).description || '') : ''))
      .filter(Boolean)
      .join('; ');
    const from = props.from != null ? String(props.from) : '';
    const to = props.to != null ? String(props.to) : '';
    const roads = Array.isArray(props.roadNumbers)
      ? (props.roadNumbers as unknown[]).map(String).filter(Boolean).join(', ')
      : '';
    const title = eventDesc || label;
    const description = [from && to ? `${from} → ${to}` : from || to, roads]
      .filter(Boolean)
      .join(' · ') || null;

    features.push(
      pointFeature(String(props.id || `tomtom-${features.length}`), lng, lat, {
        kind: 'ground_road_incidents',
        name: title.slice(0, 160),
        title: title.slice(0, 160),
        description,
        severity: severityFromMagnitude(props.magnitudeOfDelay),
        road: roads || null,
        attribution: 'TomTom',
        delay: typeof props.delay === 'number' ? props.delay : null,
      }),
    );
    if (features.length >= max) break;
  }
  return capFeatures({ type: 'FeatureCollection', features }, max);
}
