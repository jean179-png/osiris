import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mapGraphImagesToPoses,
  resolveNearestInView,
} from './mapillary';

describe('mapGraphImagesToPoses', () => {
  it('maps computed geometry and compass; skips bad rows', () => {
    const poses = mapGraphImagesToPoses({
      data: [
        {
          id: 'a',
          computed_geometry: { type: 'Point', coordinates: [-71.06, 42.36] },
          computed_compass_angle: 90,
        },
        { id: 'b', geometry: { type: 'Point', coordinates: [-71.07, 42.37] }, compass_angle: 45 },
        { id: 'bad' },
      ],
    });
    expect(poses).toHaveLength(2);
    expect(poses[0]).toEqual({ id: 'a', lng: -71.06, lat: 42.36, compassAngle: 90 });
    expect(poses[1]).toEqual({ id: 'b', lng: -71.07, lat: 42.37, compassAngle: 45 });
  });
});

describe('resolveNearestInView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns googleUrl when graph has no usable images', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      })),
    );
    const target = { lng: -71.0589, lat: 42.3601 };
    const r = await resolveNearestInView(target, 'tok');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.googleUrl).toContain('map_action=pano');
    expect(r.lookAt).toEqual(target);
  });

  it('returns best in-view image and yawTowardLookAt', async () => {
    const target = { lng: -71.0589, lat: 42.3601 };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'near',
              computed_geometry: { type: 'Point', coordinates: [-71.0589, 42.3603] },
              computed_compass_angle: 180,
            },
          ],
        }),
      })),
    );
    const r = await resolveNearestInView(target, 'tok');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.image.id).toBe('near');
    expect(r.yawTowardLookAt).toBeGreaterThanOrEqual(0);
    expect(r.yawTowardLookAt).toBeLessThan(360);
  });
});
