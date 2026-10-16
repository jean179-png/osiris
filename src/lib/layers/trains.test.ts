import { describe, it, expect } from 'vitest';
import {
  mapTrainTracksToFc,
  resolveTrainVehicleUrl,
  trainsTracksQl,
  TRACKS_MIN_ZOOM,
} from './trains';
import type { GtfsAgency } from './gtfs';

describe('trainsTracksQl', () => {
  it('fills overpass bbox', () => {
    const ql = trainsTracksQl({ west: -75.2, south: 39.9, east: -75.1, north: 40.0 });
    expect(ql).toContain('39.9,-75.2,40,-75.1');
    expect(ql).toContain('railway"="rail"');
    expect(ql).toContain('passenger"~"^(yes|only)$"');
    expect(ql).toContain('light_rail');
  });
});

describe('mapTrainTracksToFc', () => {
  it('maps passenger ways and skips freight-only', () => {
    const fc = mapTrainTracksToFc({
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { railway: 'rail', usage: 'main', name: 'NEC' },
          geometry: [
            { lat: 39.95, lon: -75.15 },
            { lat: 39.96, lon: -75.14 },
          ],
        },
        {
          type: 'way',
          id: 3,
          tags: { railway: 'rail', usage: 'freight', name: 'Yard Lead' },
          geometry: [
            { lat: 40.0, lon: -75.0 },
            { lat: 40.01, lon: -75.01 },
          ],
        },
        { type: 'node', id: 2, lat: 39.95, lon: -75.15, tags: { railway: 'rail' } },
      ],
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.geometry.type).toBe('LineString');
    expect(fc.features[0]!.properties?.kind).toBe('ground_train_tracks');
  });
});

describe('resolveTrainVehicleUrl', () => {
  const base: GtfsAgency = {
    id: 'caltrain',
    name: 'Caltrain',
    vehicleUrl: 'https://api.511.org/transit/vehiclepositions?agency=CT',
    bbox: [-122.6, 37.0, -121.5, 37.9],
    apiKeyEnv: 'CALTRAIN_511_API_KEY',
  };

  it('returns null when api key env missing', () => {
    const prev = process.env.CALTRAIN_511_API_KEY;
    delete process.env.CALTRAIN_511_API_KEY;
    expect(resolveTrainVehicleUrl(base)).toBeNull();
    if (prev !== undefined) process.env.CALTRAIN_511_API_KEY = prev;
  });

  it('appends api_key when present', () => {
    process.env.CALTRAIN_511_API_KEY = 'test-key';
    expect(resolveTrainVehicleUrl(base)).toContain('api_key=test-key');
    delete process.env.CALTRAIN_511_API_KEY;
  });

  it('passes through urls without apiKeyEnv', () => {
    expect(
      resolveTrainVehicleUrl({
        id: 'amtrak',
        name: 'Amtrak',
        vehicleUrl: 'https://example.com/feed',
        bbox: [-125, 24, -66, 49],
      }),
    ).toBe('https://example.com/feed');
  });
});

describe('TRACKS_MIN_ZOOM', () => {
  it('is 7', () => {
    expect(TRACKS_MIN_ZOOM).toBe(7);
  });
});
