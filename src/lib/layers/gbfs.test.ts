import { describe, it, expect } from 'vitest';
import { mapFreeBikeStatus, mapStationStatus, systemsForBbox } from './gbfs';

describe('systemsForBbox', () => {
  it('filters by bbox', () => {
    const hits = systemsForBbox(
      [
        {
          id: 'nyc',
          name: 'NYC',
          autoDiscoveryUrl: 'https://example.com',
          bbox: [-74.1, 40.5, -73.8, 40.9],
        },
        {
          id: 'chi',
          name: 'CHI',
          autoDiscoveryUrl: 'https://example.com',
          bbox: [-88, 41, -87, 42],
        },
      ],
      { west: -74.05, south: 40.7, east: -73.9, north: 40.8 },
    );
    expect(hits.map((s) => s.id)).toEqual(['nyc']);
  });
});

describe('mapFreeBikeStatus', () => {
  it('maps bikes in bbox', () => {
    const fc = mapFreeBikeStatus(
      {
        data: {
          bikes: [
            { bike_id: 'b1', lat: 40.75, lon: -73.98, is_disabled: false },
            { bike_id: 'b2', lat: 41, lon: -87, is_disabled: false },
          ],
        },
      },
      { id: 'nyc', name: 'Citi' },
      { west: -74.1, south: 40.5, east: -73.8, north: 40.9 },
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties?.kind).toBe('ground_gbfs');
  });
});

describe('mapStationStatus', () => {
  it('joins station info + status', () => {
    const fc = mapStationStatus(
      { data: { stations: [{ station_id: 's1', num_bikes_available: 3, num_docks_available: 7 }] } },
      { data: { stations: [{ station_id: 's1', name: 'Main', lat: 40.75, lon: -73.98 }] } },
      { id: 'nyc', name: 'Citi' },
      { west: -74.1, south: 40.5, east: -73.8, north: 40.9 },
    );
    expect(fc.features[0]!.properties?.bikesAvailable).toBe(3);
    expect(fc.features[0]!.properties?.name).toBe('Main');
  });
});
