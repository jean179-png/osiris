import { describe, expect, it } from 'vitest';
import { flightsToGeoJsonFeatures } from './flights-geojson';

describe('flightsToGeoJsonFeatures', () => {
  it('preserves aircraft_category and exempts helis from decimation', () => {
    const arr = Array.from({ length: 20 }, (_, i) => ({
      lng: i,
      lat: i,
      callsign: `C${i}`,
      heading: 0,
      aircraft_category: i === 7 ? 'heli' : 'plane',
    }));
    const feats = flightsToGeoJsonFeatures(arr, 10);
    expect(feats.some((f) => f.properties?.aircraft_category === 'heli')).toBe(true);
    expect(feats.find((f) => f.properties?.aircraft_category === 'heli')?.properties?.callsign).toBe(
      'C7',
    );
  });
});
