import type { Feature, FeatureCollection, LineString, Position } from 'geojson';
import type { BBox } from './types';
import { fillBbox, overpassQuery } from './overpass';
import { featureOf, emptyFc, capFeatures } from './geojson';

/** Viewport zoom gate — Overpass chokes on continent-scale mainline queries. */
export const FREIGHT_RAIL_MIN_ZOOM = 7;

/**
 * OSM freight / industrial rail corridors (no live trains).
 * - usage=freight|industrial — freight-dedicated
 * - service=spur|yard|siding — industrial sidings
 * - usage=main|branch — Class I / CN / CP mainlines (freight-primary in US/CA;
 *   shared Amtrak/VIA trackage rights still appear)
 * - goods=yes — explicitly goods-carrying
 */
const FREIGHT_RAIL_QL = `[out:json][timeout:25];
(
  way["railway"="rail"]["usage"~"^(freight|industrial)$"]({{bbox}});
  way["railway"="rail"]["service"~"^(spur|yard|siding)$"]({{bbox}});
  way["railway"="rail"]["usage"~"^(main|branch)$"]({{bbox}});
  way["railway"="rail"]["goods"="yes"]({{bbox}});
);
out geom;
`;

export function freightRailQl(bbox: BBox): string {
  return fillBbox(FREIGHT_RAIL_QL, bbox);
}

function wayLineGeometry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el: any,
): LineString | null {
  const geom = el?.geometry;
  if (!Array.isArray(geom) || geom.length < 2) return null;
  const coordinates: Position[] = [];
  for (const g of geom) {
    const lat = g?.lat;
    const lon = g?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    coordinates.push([lon, lat]);
  }
  if (coordinates.length < 2) return null;
  return { type: 'LineString', coordinates };
}

function skipTourismOrPassengerOnly(tags: Record<string, string>): boolean {
  if (tags.usage === 'tourism') return true;
  if (tags.passenger === 'only') return true;
  return false;
}

/** Map Overpass ways to ground_freight_rail LineStrings. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapFreightRailToFc(data: any): FeatureCollection {
  const elements = data?.elements;
  if (!Array.isArray(elements)) return emptyFc();
  const features: Feature[] = [];
  for (const el of elements) {
    if (el?.type !== 'way') continue;
    const tags = (el?.tags ?? {}) as Record<string, string>;
    if (skipTourismOrPassengerOnly(tags)) continue;
    const line = wayLineGeometry(el);
    if (!line) continue;
    const id = el?.id ?? features.length;
    features.push(
      featureOf(`freight-rail-${id}`, line, {
        kind: 'ground_freight_rail',
        name: tags.name ?? tags['name:en'] ?? tags.operator ?? null,
        railway: tags.railway ?? null,
        usage: tags.usage ?? null,
        service: tags.service ?? null,
        operator: tags.operator ?? null,
        goods: tags.goods ?? null,
        osmId: id,
        attribution: 'OpenStreetMap',
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, 4000);
}

export async function fetchFreightRail(bbox: BBox, zoom: number): Promise<FeatureCollection> {
  if (zoom < FREIGHT_RAIL_MIN_ZOOM) return emptyFc();
  try {
    const data = await overpassQuery(freightRailQl(bbox));
    return mapFreightRailToFc(data);
  } catch {
    return emptyFc();
  }
}
