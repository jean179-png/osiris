import type { Feature, FeatureCollection, LineString, Position } from 'geojson';
import type { BBox } from './types';
import { fillBbox, overpassQuery } from './overpass';
import { featureOf, emptyFc, capFeatures } from './geojson';

export const TRAILS_MIN_ZOOM = 8;

const TRAILS_QL = `[out:json][timeout:25];
(
  way["highway"~"^(path|footway|cycleway|bridleway)$"]({{bbox}});
  way["route"~"^(hiking|foot|bicycle)$"]({{bbox}});
  way["railway"~"^(abandoned|disused)$"]({{bbox}});
);
out geom;
`;

export function trailsQl(bbox: BBox): string {
  return fillBbox(TRAILS_QL, bbox);
}

function wayLineGeometry(el: any): LineString | null {
  const geom = el?.geometry;
  if (!Array.isArray(geom) || geom.length < 2) return null;
  const coordinates: Position[] = [];
  for (const g of geom) {
    if (!Number.isFinite(g?.lat) || !Number.isFinite(g?.lon)) continue;
    coordinates.push([g.lon, g.lat]);
  }
  return coordinates.length < 2 ? null : { type: 'LineString', coordinates };
}

function denied(tags: Record<string, string>): boolean {
  if (tags.access === 'private' || tags.access === 'no') return true;
  if (tags.foot === 'no' && tags.bicycle === 'no') return true;
  return false;
}

export type TrailSubkind = 'cycle' | 'hike' | 'foot' | 'bridle' | 'rail_trail' | 'other';

export function trailSubkind(tags: Record<string, string>): TrailSubkind {
  const rw = tags.railway;
  if (rw === 'abandoned' || rw === 'disused') return 'rail_trail';
  const hw = tags.highway;
  if (hw === 'cycleway' || tags.route === 'bicycle') return 'cycle';
  if (hw === 'bridleway') return 'bridle';
  if (hw === 'footway' || tags.route === 'foot') return 'foot';
  if (tags.route === 'hiking' || tags.sac_scale) return 'hike';
  if (hw === 'path') return 'hike';
  return 'other';
}

export function mapTrailsToFc(data: any): FeatureCollection {
  const elements = data?.elements;
  if (!Array.isArray(elements)) return emptyFc();
  const features: Feature[] = [];
  for (const el of elements) {
    if (el?.type !== 'way') continue;
    const tags = (el?.tags ?? {}) as Record<string, string>;
    if (denied(tags)) continue;
    const line = wayLineGeometry(el);
    if (!line) continue;
    const id = el?.id ?? features.length;
    features.push(featureOf(`trail-${id}`, line, {
      kind: 'ground_trails',
      subkind: trailSubkind(tags),
      name: tags.name ?? tags['name:en'] ?? null,
      highway: tags.highway ?? null,
      railway: tags.railway ?? null,
      route: tags.route ?? null,
      osmId: id,
      attribution: 'OpenStreetMap',
    }));
  }
  return capFeatures({ type: 'FeatureCollection', features }, 4000);
}

export async function fetchTrails(bbox: BBox, zoom: number): Promise<FeatureCollection> {
  if (zoom < TRAILS_MIN_ZOOM) return emptyFc();
  try {
    return mapTrailsToFc(await overpassQuery(trailsQl(bbox)));
  } catch {
    return emptyFc();
  }
}
