import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./overpass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./overpass')>();
  return {
    ...actual,
    overpassQuery: vi.fn(),
  };
});

import { overpassQuery } from './overpass';
import {
  trailsQl,
  mapTrailsToFc,
  TRAILS_MIN_ZOOM,
  fetchTrails,
} from './trails';

const sampleBbox = { west: -105.3, south: 39.9, east: -105.2, north: 40.0 };

function trailWay(id: number) {
  return {
    type: 'way' as const,
    id,
    tags: { highway: 'path' },
    geometry: [
      { lat: 40, lon: -105 + id * 0.00001 },
      { lat: 40.01, lon: -105.01 + id * 0.00001 },
    ],
  };
}

describe('TRAILS_MIN_ZOOM', () => {
  it('is 8', () => expect(TRAILS_MIN_ZOOM).toBe(8));
});

describe('trailsQl', () => {
  it('fills bbox and path selectors', () => {
    const ql = trailsQl(sampleBbox);
    expect(ql).toContain('39.9,-105.3,40,-105.2');
    expect(ql).toContain('highway"~"^(path|footway|cycleway|bridleway)$"');
    expect(ql).toContain('railway"~"^(abandoned|disused)$"');
  });
});

describe('mapTrailsToFc', () => {
  it('maps ways, assigns subkind, skips private', () => {
    const fc = mapTrailsToFc({
      elements: [
        {
          type: 'way', id: 1,
          tags: { highway: 'cycleway', name: 'Creek Path' },
          geometry: [{ lat: 40, lon: -105.25 }, { lat: 40.01, lon: -105.24 }],
        },
        {
          type: 'way', id: 2,
          tags: { highway: 'path', access: 'private' },
          geometry: [{ lat: 40, lon: -105 }, { lat: 40.01, lon: -105.01 }],
        },
        {
          type: 'way', id: 3,
          tags: { railway: 'abandoned', name: 'Old Grade' },
          geometry: [{ lat: 39.95, lon: -105.2 }, { lat: 39.96, lon: -105.19 }],
        },
      ],
    });
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]!.properties?.subkind).toBe('cycle');
    expect(fc.features[1]!.properties?.subkind).toBe('rail_trail');
    expect(fc.features[0]!.properties?.kind).toBe('ground_trails');
    expect(fc.features[0]!.properties?.attribution).toBe('OpenStreetMap');
  });

  it('caps at 4000 features', () => {
    const elements = Array.from({ length: 4001 }, (_, i) => trailWay(i + 1));
    const fc = mapTrailsToFc({ elements });
    expect(fc.features).toHaveLength(4000);
  });
});

describe('fetchTrails', () => {
  beforeEach(() => {
    vi.mocked(overpassQuery).mockReset();
  });

  it('returns empty FC when zoom is below TRAILS_MIN_ZOOM', async () => {
    const fc = await fetchTrails(sampleBbox, TRAILS_MIN_ZOOM - 1);
    expect(fc.features).toHaveLength(0);
    expect(overpassQuery).not.toHaveBeenCalled();
  });

  it('returns empty FC when overpass fails', async () => {
    vi.mocked(overpassQuery).mockRejectedValue(new Error('overpass timeout'));
    const fc = await fetchTrails(sampleBbox, TRAILS_MIN_ZOOM);
    expect(fc.features).toHaveLength(0);
    expect(overpassQuery).toHaveBeenCalledTimes(1);
  });
});
