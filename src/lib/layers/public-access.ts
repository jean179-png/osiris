import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import type { BBox } from './types';
import { fillBbox, overpassQuery } from './overpass';
import { featureOf, emptyFc, capFeatures } from './geojson';

export const PUBLIC_ACCESS_MIN_ZOOM = 7;

const OSM_CAP = 2000;
const BLM_CAP = 2000;
const MERGE_CAP = 4000;

/**
 * v1: ways only + `out geom`. Multipolygon relations are omitted because
 * Overpass `out geom` on relations is fragile for this mapper.
 */
const PUBLIC_ACCESS_QL = `[out:json][timeout:25];
(
  way["leisure"~"^(park|nature_reserve)$"]({{bbox}});
  way["boundary"="protected_area"]({{bbox}});
  way["access"="yes"]["leisure"]({{bbox}});
);
out geom;
`;

/**
 * BLM-only SMA polygons. Probed 2026-10-16: layer 2 query returns HTTP 200
 * GeoJSON (not 404). LimitedScale layer 7 is the documented alternate if this
 * cached endpoint later disappears.
 */
const BLM_SMA_QUERY =
  'https://gis.blm.gov/natl/rest/services/lands/BLM_Natl_SMA_Cached_BLM_Only/MapServer/2/query';

/** Rough US extent from the plan: west -180, east -50, south 15, north 72. */
const US_ROUGH = { west: -180, south: 15, east: -50, north: 72 };

export type PublicAccessSubkind =
  | 'park'
  | 'protected'
  | 'open_access'
  | 'blm'
  | 'federal'
  | 'other';

export function publicAccessOsmQl(bbox: BBox): string {
  return fillBbox(PUBLIC_ACCESS_QL, bbox);
}

function wayPolygon(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el: any,
): Polygon | null {
  const geom = el?.geometry;
  if (!Array.isArray(geom) || geom.length < 4) return null;
  const ring: Position[] = [];
  for (const g of geom) {
    const lat = g?.lat;
    const lon = g?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    ring.push([lon, lat]);
  }
  if (ring.length < 4) return null;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) return null;
  return { type: 'Polygon', coordinates: [ring] };
}

function denied(tags: Record<string, string>): boolean {
  if (tags.access === 'private' || tags.access === 'no') return true;
  if (tags.military) return true;
  if (tags.landuse === 'military') return true;
  return false;
}

function osmSubkind(tags: Record<string, string>): PublicAccessSubkind {
  if (tags.boundary === 'protected_area' || tags.leisure === 'nature_reserve') return 'protected';
  if (tags.leisure === 'park') return 'park';
  if (tags.access === 'yes') return 'open_access';
  return 'other';
}

/** Map Overpass ways to ground_public_access polygons. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPublicAccessOsmToFc(data: any): FeatureCollection {
  const elements = data?.elements;
  if (!Array.isArray(elements)) return emptyFc();
  const features: Feature[] = [];
  for (const el of elements) {
    if (el?.type !== 'way') continue;
    const tags = (el?.tags ?? {}) as Record<string, string>;
    if (denied(tags)) continue;
    const polygon = wayPolygon(el);
    if (!polygon) continue;
    const id = el?.id ?? features.length;
    features.push(featureOf(`public-access-osm-${id}`, polygon, {
      kind: 'ground_public_access',
      subkind: osmSubkind(tags),
      name: tags.name ?? tags['name:en'] ?? null,
      agency: tags.operator ?? null,
      osmId: id,
      attribution: 'OpenStreetMap',
    }));
  }
  return capFeatures({ type: 'FeatureCollection', features }, OSM_CAP);
}

export function buildBlmSmaUrl(bbox: BBox): string {
  const u = new URL(BLM_SMA_QUERY);
  const envelope = JSON.stringify({
    xmin: bbox.west,
    ymin: bbox.south,
    xmax: bbox.east,
    ymax: bbox.north,
    spatialReference: { wkid: 4326 },
  });
  u.searchParams.set('where', '1=1');
  u.searchParams.set('geometry', envelope);
  u.searchParams.set('geometryType', 'esriGeometryEnvelope');
  u.searchParams.set('inSR', '4326');
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  u.searchParams.set('outFields', '*');
  u.searchParams.set('returnGeometry', 'true');
  u.searchParams.set('outSR', '4326');
  u.searchParams.set('resultRecordCount', '2000');
  u.searchParams.set('f', 'geojson');
  return u.toString();
}

function blmName(props: Record<string, unknown>): string | null {
  const admin = props.ADMIN_UNIT_NAME;
  if (typeof admin === 'string' && admin.trim()) return admin;
  const name = props.Name;
  if (typeof name === 'string' && name.trim()) return name;
  return null;
}

function isAreaGeometry(
  geom: { type?: string; coordinates?: unknown } | null | undefined,
): geom is Polygon | MultiPolygon {
  if (!geom) return false;
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return false;
  return Array.isArray(geom.coordinates) && geom.coordinates.length > 0;
}

/** Map BLM SMA GeoJSON to ground_public_access polygons. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBlmSmaGeoJsonToFc(gj: any): FeatureCollection {
  const raw = gj?.features;
  if (!Array.isArray(raw)) return emptyFc();
  const features: Feature[] = [];
  for (const feat of raw) {
    const geom = feat?.geometry;
    if (!isAreaGeometry(geom)) continue;
    const props = (feat?.properties ?? {}) as Record<string, unknown>;
    const id = props.OBJECTID ?? feat?.id ?? features.length;
    features.push(featureOf(`public-access-blm-${id}`, geom, {
      kind: 'ground_public_access',
      subkind: 'blm',
      name: blmName(props),
      agency: 'BLM',
      attribution: 'BLM',
    }));
  }
  return capFeatures({ type: 'FeatureCollection', features }, BLM_CAP);
}

function intersectsRoughUs(bbox: BBox): boolean {
  return (
    bbox.west < US_ROUGH.east &&
    bbox.east > US_ROUGH.west &&
    bbox.south < US_ROUGH.north &&
    bbox.north > US_ROUGH.south
  );
}

async function fetchBlmSma(
  bbox: BBox,
  fetchImpl: typeof fetch,
): Promise<FeatureCollection> {
  try {
    const res = await fetchImpl(buildBlmSmaUrl(bbox), {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'osiris-layers/1.0', Accept: 'application/json' },
    });
    if (!res.ok) return emptyFc();
    return mapBlmSmaGeoJsonToFc(await res.json());
  } catch {
    return emptyFc();
  }
}

export function mergePublicAccessFc(parts: FeatureCollection[], max = MERGE_CAP): FeatureCollection {
  const features: Feature[] = [];
  for (const part of parts) {
    if (Array.isArray(part?.features)) features.push(...part.features);
  }
  return capFeatures({ type: 'FeatureCollection', features }, max);
}

export async function fetchPublicAccess(
  bbox: BBox,
  zoom: number,
  fetchImpl: typeof fetch = fetch,
): Promise<FeatureCollection> {
  if (zoom < PUBLIC_ACCESS_MIN_ZOOM) return emptyFc();
  const osm = (async () => {
    try {
      return mapPublicAccessOsmToFc(await overpassQuery(publicAccessOsmQl(bbox)));
    } catch {
      return emptyFc();
    }
  })();
  const blm = intersectsRoughUs(bbox)
    ? fetchBlmSma(bbox, fetchImpl)
    : Promise.resolve(emptyFc());
  const [osmFc, blmFc] = await Promise.all([osm, blm]);
  return mergePublicAccessFc([osmFc, blmFc]);
}
