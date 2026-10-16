import { describe, it, expect } from 'vitest';
import {
  buildOpenWatersVesselsUrl,
  mapOpenWatersFc,
  openWatersAreaDeg2,
} from './openwaters-ais';

describe('openwaters-ais', () => {
  it('builds bbox query', () => {
    const url = buildOpenWatersVesselsUrl({
      latmin: 41.2,
      lonmin: -71.5,
      latmax: 42,
      lonmax: -70.8,
    });
    expect(url).toContain('bbox=41.2%2C-71.5%2C42%2C-70.8');
    expect(url).toContain('kind=vessel');
  });

  it('measures area in square degrees', () => {
    expect(
      openWatersAreaDeg2({ latmin: 0, latmax: 10, lonmin: 0, lonmax: 10 }),
    ).toBe(100);
  });

  it('maps GeoJSON vessels', () => {
    const ships = mapOpenWatersFc(
      {
        type: 'FeatureCollection',
        features: [
          {
            id: 368168720,
            geometry: { type: 'Point', coordinates: [-70.63, 41.68] },
            properties: {
              mmsi: 368168720,
              kind: 'vessel',
              name: 'CERULEAN',
              type: 80,
              sog: 12,
              heading: 511,
              cog: 90,
              flag: 'US',
              seen: '2026-08-20T19:12:31Z',
            },
          },
          {
            geometry: { type: 'Point', coordinates: [1, 2] },
            properties: { mmsi: 1, kind: 'aton' },
          },
        ],
      },
      1_700_000_000_000,
    );
    expect(ships).toHaveLength(1);
    expect(ships[0]!.type).toBe('tanker');
    expect(ships[0]!.heading).toBe(90);
    expect(ships[0]!.name).toBe('CERULEAN');
  });
});
