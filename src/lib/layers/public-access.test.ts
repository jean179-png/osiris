import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FeatureCollection } from 'geojson';

vi.mock('./overpass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./overpass')>();
  return {
    ...actual,
    overpassQuery: vi.fn(),
  };
});

import { overpassQuery } from './overpass';
import {
  PUBLIC_ACCESS_MIN_ZOOM,
  publicAccessOsmQl,
  mapPublicAccessOsmToFc,
  buildBlmSmaUrl,
  mapBlmSmaGeoJsonToFc,
  fetchPublicAccess,
  mergePublicAccessFc,
} from './public-access';

const sampleBbox = { west: -105.3, south: 39.9, east: -105.2, north: 40.0 };
const europeBbox = { west: 2.2, south: 48.8, east: 2.4, north: 48.9 };

function closedRing(lat: number, lon: number) {
  return [
    { lat, lon },
    { lat: lat + 0.01, lon },
    { lat: lat + 0.01, lon: lon + 0.01 },
    { lat, lon },
  ];
}

function parkWay(id: number) {
  const lon = -105 + (id % 50) * 0.001;
  const lat = 40 + Math.floor(id / 50) * 0.001;
  return {
    type: 'way' as const,
    id,
    tags: { leisure: 'park', name: `Park ${id}` },
    geometry: closedRing(lat, lon),
  };
}

function blmFeature(id: number) {
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[-114, 38], [-113, 38], [-113, 39], [-114, 38]]],
    },
    properties: { ADMIN_UNIT_NAME: `Unit ${id}`, OBJECTID: id },
  };
}

function dummyFc(n: number): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: n }, (_, i) => ({
      type: 'Feature' as const,
      properties: { id: i },
      geometry: { type: 'Point' as const, coordinates: [0, 0] },
    })),
  };
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe('PUBLIC_ACCESS_MIN_ZOOM', () => {
  it('is 7', () => {
    expect(PUBLIC_ACCESS_MIN_ZOOM).toBe(7);
  });
});

describe('publicAccessOsmQl', () => {
  it('fills bbox with ways-only public land selectors', () => {
    const ql = publicAccessOsmQl(sampleBbox);
    expect(ql).toContain('39.9,-105.3,40,-105.2');
    expect(ql).toContain('way["leisure"~"^(park|nature_reserve)$"]');
    expect(ql).toContain('way["boundary"="protected_area"]');
    expect(ql).toContain('way["access"="yes"]["leisure"]');
    expect(ql).toContain('out geom;');
    expect(ql).not.toContain('relation[');
  });
});

describe('mapPublicAccessOsmToFc', () => {
  it('maps closed ways to polygons and skips private', () => {
    const fc = mapPublicAccessOsmToFc({
      elements: [
        {
          type: 'way',
          id: 10,
          tags: { leisure: 'park', name: 'City Park', operator: 'Denver' },
          geometry: closedRing(39.9, -105),
        },
        {
          type: 'way',
          id: 11,
          tags: { leisure: 'park', name: 'Private Yard', access: 'private' },
          geometry: closedRing(39.91, -105.1),
        },
        {
          type: 'way',
          id: 12,
          tags: { boundary: 'protected_area', name: 'Reserve' },
          geometry: closedRing(39.92, -105.2),
        },
        {
          type: 'way',
          id: 13,
          tags: { leisure: 'nature_reserve', name: 'Wild Area' },
          geometry: closedRing(39.93, -105.05),
        },
        {
          type: 'way',
          id: 14,
          tags: { leisure: 'recreation_ground', access: 'yes', name: 'Field' },
          geometry: closedRing(39.94, -105.06),
        },
        {
          type: 'way',
          id: 15,
          tags: { leisure: 'park', name: 'Open Line' },
          geometry: [
            { lat: 39.9, lon: -105 },
            { lat: 39.91, lon: -105 },
            { lat: 39.91, lon: -104.99 },
          ],
        },
        {
          type: 'relation',
          id: 99,
          tags: { leisure: 'park', name: 'Relation Park' },
          members: [],
        },
      ],
    });

    expect(fc.features).toHaveLength(4);
    expect(fc.features.map((f) => f.properties?.subkind)).toEqual([
      'park',
      'protected',
      'protected',
      'open_access',
    ]);
    expect(fc.features[0]!.properties?.kind).toBe('ground_public_access');
    expect(fc.features[0]!.properties?.name).toBe('City Park');
    expect(fc.features[0]!.properties?.agency).toBe('Denver');
    expect(fc.features[0]!.properties?.attribution).toBe('OpenStreetMap');
    expect(fc.features[0]!.geometry.type).toBe('Polygon');
    if (fc.features[0]!.geometry.type === 'Polygon') {
      expect(fc.features[0]!.geometry.coordinates[0]![0]).toEqual([-105, 39.9]);
    }
    expect(fc.features.map((f) => f.properties?.name)).not.toContain('Private Yard');
    expect(fc.features.map((f) => f.properties?.name)).not.toContain('Relation Park');
    expect(fc.features.map((f) => f.properties?.name)).not.toContain('Open Line');
  });

  it('skips access=no and military', () => {
    const fc = mapPublicAccessOsmToFc({
      elements: [
        {
          type: 'way',
          id: 21,
          tags: { leisure: 'park', access: 'no', name: 'Closed' },
          geometry: closedRing(39.9, -105),
        },
        {
          type: 'way',
          id: 22,
          tags: { leisure: 'park', military: 'base', name: 'Base' },
          geometry: closedRing(39.91, -105.1),
        },
        {
          type: 'way',
          id: 23,
          tags: { boundary: 'protected_area', landuse: 'military', name: 'Range' },
          geometry: closedRing(39.92, -105.2),
        },
      ],
    });
    expect(fc.features).toHaveLength(0);
  });

  it('caps at 2000 features', () => {
    const fc = mapPublicAccessOsmToFc({
      elements: Array.from({ length: 2001 }, (_, i) => parkWay(i + 1)),
    });
    expect(fc.features).toHaveLength(2000);
  });
});

describe('buildBlmSmaUrl', () => {
  it('queries the BLM-only SMA layer with an envelope GeoJSON request', () => {
    const url = buildBlmSmaUrl(sampleBbox);
    expect(url).toContain(
      'https://gis.blm.gov/natl/rest/services/lands/BLM_Natl_SMA_Cached_BLM_Only/MapServer/2/query',
    );
    expect(url).toContain('geometryType=esriGeometryEnvelope');
    expect(url).toContain('f=geojson');
    expect(url).toContain('resultRecordCount=2000');
    expect(url).toContain('outSR=4326');
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('outFields=*');
    expect(decoded).toContain('"xmin":-105.3');
    expect(decoded).toContain('"ymin":39.9');
    expect(decoded).toContain('"xmax":-105.2');
    expect(decoded).toContain('"ymax":40');
  });
});

describe('mapBlmSmaGeoJsonToFc', () => {
  it('maps polygons to blm subkind and skips non-polygons', () => {
    const fc = mapBlmSmaGeoJsonToFc({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[-114, 38], [-113.9, 38], [-113.9, 38.1], [-114, 38]]],
          },
          properties: { ADMIN_UNIT_NAME: 'Grand Staircase', OBJECTID: 7 },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: [[[[-112, 37], [-111, 37], [-111, 38], [-112, 37]]]],
          },
          properties: { Name: 'Fallback Unit' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-114, 38] },
          properties: { ADMIN_UNIT_NAME: 'Ignore Me' },
        },
      ],
    });
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]!.properties?.kind).toBe('ground_public_access');
    expect(fc.features[0]!.properties?.subkind).toBe('blm');
    expect(fc.features[0]!.properties?.name).toBe('Grand Staircase');
    expect(fc.features[0]!.properties?.agency).toBe('BLM');
    expect(fc.features[0]!.properties?.attribution).toBe('BLM');
    expect(fc.features[0]!.geometry.type).toBe('Polygon');
    expect(fc.features[1]!.properties?.name).toBe('Fallback Unit');
    expect(fc.features[1]!.geometry.type).toBe('MultiPolygon');
  });

  it('caps at 2000 features', () => {
    const fc = mapBlmSmaGeoJsonToFc({
      type: 'FeatureCollection',
      features: Array.from({ length: 2001 }, (_, i) => blmFeature(i + 1)),
    });
    expect(fc.features).toHaveLength(2000);
  });
});

describe('mergePublicAccessFc', () => {
  it('concatenates parts and caps at 4000', () => {
    const merged = mergePublicAccessFc([dummyFc(2500), dummyFc(2500)]);
    expect(merged.features).toHaveLength(4000);
  });
});

describe('fetchPublicAccess', () => {
  beforeEach(() => {
    vi.mocked(overpassQuery).mockReset();
  });

  it('returns empty FC when zoom is below PUBLIC_ACCESS_MIN_ZOOM', async () => {
    const fetchImpl = vi.fn();
    const fc = await fetchPublicAccess(sampleBbox, PUBLIC_ACCESS_MIN_ZOOM - 1, fetchImpl);
    expect(fc.features).toHaveLength(0);
    expect(overpassQuery).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('merges OSM and BLM inside the rough US box', async () => {
    vi.mocked(overpassQuery).mockResolvedValue({
      elements: [parkWay(1)],
    });
    const fetchImpl = vi.fn(async () => jsonResponse({
      type: 'FeatureCollection',
      features: [blmFeature(9)],
    }));
    const fc = await fetchPublicAccess(sampleBbox, PUBLIC_ACCESS_MIN_ZOOM, fetchImpl);
    expect(fc.features.map((f) => f.properties?.subkind)).toEqual(['park', 'blm']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('f=geojson');
  });

  it('skips BLM when the bbox misses the rough US box', async () => {
    vi.mocked(overpassQuery).mockResolvedValue({ elements: [parkWay(1)] });
    const fetchImpl = vi.fn();
    const fc = await fetchPublicAccess(europeBbox, PUBLIC_ACCESS_MIN_ZOOM, fetchImpl);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties?.subkind).toBe('park');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns OSM when BLM fails', async () => {
    vi.mocked(overpassQuery).mockResolvedValue({ elements: [parkWay(1)] });
    const fetchImpl = vi.fn(async () => jsonResponse({ error: true }, false));
    const fc = await fetchPublicAccess(sampleBbox, PUBLIC_ACCESS_MIN_ZOOM, fetchImpl);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties?.attribution).toBe('OpenStreetMap');
  });

  it('returns BLM when Overpass fails', async () => {
    vi.mocked(overpassQuery).mockRejectedValue(new Error('overpass timeout'));
    const fetchImpl = vi.fn(async () => jsonResponse({
      type: 'FeatureCollection',
      features: [blmFeature(3)],
    }));
    const fc = await fetchPublicAccess(sampleBbox, PUBLIC_ACCESS_MIN_ZOOM, fetchImpl);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties?.subkind).toBe('blm');
  });

  it('returns empty FC when both sources fail', async () => {
    vi.mocked(overpassQuery).mockRejectedValue(new Error('overpass timeout'));
    const fetchImpl = vi.fn(async () => {
      throw new Error('blm down');
    });
    const fc = await fetchPublicAccess(sampleBbox, PUBLIC_ACCESS_MIN_ZOOM, fetchImpl);
    expect(fc.features).toHaveLength(0);
  });
});
