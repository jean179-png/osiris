import { describe, it, expect } from 'vitest';
import {
  bboxAreaKm2,
  mapTomTomIncidents,
  shrinkBboxToMaxArea,
  tomtomFlowTileUrl,
} from './tomtom-traffic';

describe('tomtom-traffic', () => {
  it('builds dark relative flow tile urls', () => {
    const url = tomtomFlowTileUrl(10, 301, 385, 'test-key');
    expect(url).toContain('/tile/flow/relative0-dark/10/301/385.png');
    expect(url).toContain('key=test-key');
  });

  it('shrinks oversized bboxes under the incident area cap', () => {
    const huge = { west: -80, south: 30, east: -70, north: 45 };
    expect(bboxAreaKm2(huge)).toBeGreaterThan(9500);
    const small = shrinkBboxToMaxArea(huge);
    expect(bboxAreaKm2(small)).toBeLessThanOrEqual(9500);
  });

  it('maps LineString incidents to midpoint points', () => {
    const fc = mapTomTomIncidents(
      {
        incidents: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [-71.2, 42.3],
                [-71.15, 42.32],
                [-71.1, 42.34],
              ],
            },
            properties: {
              id: 'tti-1',
              iconCategory: 6,
              magnitudeOfDelay: 3,
              events: [{ description: 'Stopped traffic' }],
              from: 'A',
              to: 'B',
              roadNumbers: ['MA-9'],
            },
          },
        ],
      },
      { west: -72, south: 42, east: -70, north: 43 },
    );
    expect(fc.features).toHaveLength(1);
    const f = fc.features[0]!;
    expect(f.geometry.type).toBe('Point');
    expect(f.properties?.title).toBe('Stopped traffic');
    expect(f.properties?.severity).toBe('major');
    expect(f.properties?.attribution).toBe('TomTom');
  });
});
