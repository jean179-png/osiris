import { describe, it, expect } from 'vitest';
import {
  freightRailQl,
  mapFreightRailToFc,
  FREIGHT_RAIL_MIN_ZOOM,
} from './freight-rail';

describe('FREIGHT_RAIL_MIN_ZOOM', () => {
  it('is 7', () => {
    expect(FREIGHT_RAIL_MIN_ZOOM).toBe(7);
  });
});

describe('freightRailQl', () => {
  it('fills overpass bbox and freight selectors', () => {
    const ql = freightRailQl({ west: -75.2, south: 39.9, east: -75.1, north: 40.0 });
    expect(ql).toContain('39.9,-75.2,40,-75.1');
    expect(ql).toContain('usage"~"^(freight|industrial)$"');
    expect(ql).toContain('service"~"^(spur|yard|siding)$"');
    expect(ql).toContain('usage"~"^(main|branch)$"');
    expect(ql).toContain('goods"="yes"');
  });
});

describe('mapFreightRailToFc', () => {
  it('maps freight ways and skips tourism / passenger-only', () => {
    const fc = mapFreightRailToFc({
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { railway: 'rail', usage: 'freight', name: 'BNSF Spur', operator: 'BNSF' },
          geometry: [
            { lat: 39.95, lon: -75.15 },
            { lat: 39.96, lon: -75.14 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { railway: 'rail', usage: 'tourism', name: 'Scenic' },
          geometry: [
            { lat: 40.0, lon: -75.0 },
            { lat: 40.1, lon: -75.1 },
          ],
        },
        {
          type: 'way',
          id: 3,
          tags: { railway: 'rail', usage: 'main', passenger: 'only' },
          geometry: [
            { lat: 41.0, lon: -74.0 },
            { lat: 41.1, lon: -74.1 },
          ],
        },
        { type: 'node', id: 9, lat: 39.95, lon: -75.15, tags: { railway: 'rail' } },
      ],
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.geometry.type).toBe('LineString');
    expect(fc.features[0]!.properties?.kind).toBe('ground_freight_rail');
    expect(fc.features[0]!.properties?.operator).toBe('BNSF');
  });
});
