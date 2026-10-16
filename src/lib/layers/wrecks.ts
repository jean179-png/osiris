import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from './types';
import { fillBbox, overpassQuery } from './overpass';
import { pointFeature, emptyFc, capFeatures } from './geojson';

function prop(
  props: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const k of keys) {
    if (props[k] != null && props[k] !== '') return props[k];
  }
  return undefined;
}

function mapProps(
  raw: Record<string, unknown>,
  attribution = 'NOAA',
): Record<string, unknown> {
  const featureType =
    prop(raw, 'featureType', 'FeatureType', 'vesslterms', 'VESSLTERMS') ?? null;
  const name =
    prop(raw, 'name', 'NAME', 'history', 'HISTORY', 'vesslterms', 'VESSLTERMS') ??
    'Wreck';
  return {
    kind: 'ground_wrecks',
    name: typeof name === 'string' ? name : String(name),
    featureType: featureType == null ? null : String(featureType),
    depth: prop(raw, 'depth', 'DEPTH') ?? null,
    chart: prop(raw, 'chart', 'CHART') ?? null,
    record: prop(raw, 'recrd', 'RECRD', 'record') ?? null,
    attribution,
  };
}

const OSM_WRECKS_QL = `[out:json][timeout:25];
(
  node["seamark:type"="wreck"]({{bbox}});
  node["historic"="wreck"]({{bbox}});
  node["waterway"="wreck"]({{bbox}});
  way["seamark:type"="wreck"]({{bbox}});
  way["historic"="wreck"]({{bbox}});
);
out center tags;
`;

/** OSM seamark/historic wrecks — used when NOAA ArcGIS is offline. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOsmWrecksToFc(data: any): FeatureCollection {
  const elements = data?.elements;
  if (!Array.isArray(elements)) return emptyFc();
  const features: Feature[] = [];
  for (const el of elements) {
    const tags = (el?.tags ?? {}) as Record<string, unknown>;
    let lng: number | undefined;
    let lat: number | undefined;
    if (el.type === 'node') {
      lng = Number(el.lon);
      lat = Number(el.lat);
    } else if (el.center) {
      lng = Number(el.center.lon);
      lat = Number(el.center.lat);
    }
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const name =
      prop(tags, 'name', 'seamark:name', 'wreck:name') ??
      prop(tags, 'seamark:type') ??
      'Wreck';
    features.push(
      pointFeature(`osm-wreck-${el.type}-${el.id}`, lng!, lat!, {
        kind: 'ground_wrecks',
        name: String(name),
        featureType: prop(tags, 'seamark:type', 'historic', 'waterway') ?? 'wreck',
        depth: prop(tags, 'depth', 'seamark:depth') ?? null,
        chart: null,
        record: el.id ?? null,
        attribution: 'OpenStreetMap',
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, 2000);
}

export async function fetchOsmWrecks(bbox: BBox): Promise<FeatureCollection> {
  const data = await overpassQuery(fillBbox(OSM_WRECKS_QL, bbox));
  return mapOsmWrecksToFc(data);
}

/** NOAA ArcGIS GeoJSON is loosely shaped; keep the mapper permissive. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapNoaaWrecksToFc(data: any): FeatureCollection {
  const incoming = data?.features;
  if (!Array.isArray(incoming)) return emptyFc();
  const features: Feature[] = [];
  for (const f of incoming) {
    const geom = f?.geometry;
    const raw = (f?.properties ?? {}) as Record<string, unknown>;
    const mapped = mapProps(raw, 'NOAA');
    const idBase =
      prop(raw, 'OBJECTID', 'objectid', 'OBJECTID_1', 'recrd', 'RECRD') ??
      features.length;

    if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
      const [lng, lat] = geom.coordinates;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        features.push(pointFeature(`wreck-${idBase}`, lng, lat, mapped));
      }
      continue;
    }

    if (geom?.type === 'MultiPoint' && Array.isArray(geom.coordinates)) {
      for (let i = 0; i < geom.coordinates.length; i++) {
        const coord = geom.coordinates[i];
        if (!Array.isArray(coord)) continue;
        const [lng, lat] = coord;
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        features.push(pointFeature(`wreck-${idBase}-${i}`, lng, lat, mapped));
      }
    }
  }
  return capFeatures({ type: 'FeatureCollection', features }, 2000);
}
