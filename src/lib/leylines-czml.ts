import type { Feature, FeatureCollection, LineString, Position } from 'geojson';

export type LeyLineProps = { name: string; source?: string; slug?: string };

function cartographicDegreesToLine(
  degrees: unknown,
): Position[] | null {
  if (!Array.isArray(degrees) || degrees.length < 6) return null;
  const coords: Position[] = [];
  for (let i = 0; i + 2 < degrees.length; i += 3) {
    const lon = Number(degrees[i]);
    const lat = Number(degrees[i + 1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    coords.push([lon, lat]);
  }
  return coords.length >= 2 ? coords : null;
}

/**
 * Extract CZML polyline packets into a GeoJSON FeatureCollection.
 * Positions are Cesium `cartographicDegrees`: lon, lat, height triples.
 */
export function czmlPolylinesToFeatureCollection(
  czml: unknown,
  baseProps?: Partial<LeyLineProps>,
): FeatureCollection {
  const packets = Array.isArray(czml) ? czml : czml && typeof czml === 'object' ? [czml] : [];
  const features: Feature<LineString>[] = [];

  for (const packet of packets) {
    if (!packet || typeof packet !== 'object') continue;
    const p = packet as {
      id?: string;
      name?: string;
      polyline?: { positions?: { cartographicDegrees?: unknown } };
    };
    const degrees = p.polyline?.positions?.cartographicDegrees;
    const coords = cartographicDegreesToLine(degrees);
    if (!coords) continue;
    const name = String(p.name || p.id || baseProps?.name || 'ley');
    features.push({
      type: 'Feature',
      properties: {
        name,
        ...(baseProps?.source ? { source: baseProps.source } : {}),
        ...(baseProps?.slug ? { slug: baseProps.slug } : {}),
      },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }

  return { type: 'FeatureCollection', features };
}
