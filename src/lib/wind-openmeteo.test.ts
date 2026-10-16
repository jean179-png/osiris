import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  surfaceMesh,
  chunkCoords,
  mapOpenMeteoBatchToUV,
  buildSurfaceGrid,
} from './wind-openmeteo';

describe('surfaceMesh', () => {
  it('builds 10° global mesh dimensions', () => {
    const m = surfaceMesh();
    expect(m.width).toBe(36);
    expect(m.height).toBe(18);
    expect(m.lons).toHaveLength(36);
    expect(m.lats).toHaveLength(18);
  });
});

describe('chunkCoords', () => {
  it('batches into chunks of 50', () => {
    const pts = Array.from({ length: 120 }, (_, i) => ({ lat: i, lng: i }));
    const chunks = chunkCoords(pts, 50);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(50);
    expect(chunks[2]).toHaveLength(20);
  });
});

describe('mapOpenMeteoBatchToUV', () => {
  it('fills u/v from speed/direction arrays', () => {
    const u = new Float32Array(2);
    const v = new Float32Array(2);
    mapOpenMeteoBatchToUV(
      {
        latitude: [0, 10],
        longitude: [0, 10],
        current: {
          wind_speed_10m: [10, 0],
          wind_direction_10m: [0, 90],
          time: '2026-01-01T00:00',
        },
      },
      [{ lat: 0, lng: 0, index: 0 }, { lat: 10, lng: 10, index: 1 }],
      u,
      v,
    );
    expect(v[0]).toBeCloseTo(-10, 4);
    expect(u[1]).toBeCloseTo(0, 4);
  });
});

describe('buildSurfaceGrid', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('assembles a grid from mocked forecast batches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = new URL(url);
        const lats = u.searchParams.get('latitude')!.split(',').map(Number);
        const lngs = u.searchParams.get('longitude')!.split(',').map(Number);
        return {
          ok: true,
          json: async () => ({
            latitude: lats,
            longitude: lngs,
            current: {
              time: '2026-01-01T12:00',
              wind_speed_10m: lats.map(() => 5),
              wind_direction_10m: lats.map(() => 180),
            },
          }),
        };
      }),
    );
    const grid = await buildSurfaceGrid({ bypassCache: true });
    expect(grid.product).toBe('surface');
    expect(grid.u.length).toBe(grid.width * grid.height);
    expect(grid.attribution.toLowerCase()).toContain('open-meteo');
  });
});
