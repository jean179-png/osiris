import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  angularDeltaDegrees,
  pickInViewImage,
} from './mapillary-inview';

describe('angularDeltaDegrees', () => {
  it('wraps across 0', () => {
    expect(angularDeltaDegrees(10, 350)).toBeCloseTo(20, 5);
  });
});

describe('pickInViewImage', () => {
  const P = { lng: -71.0589, lat: 42.3601 };

  it('rejects image looking away even if close', () => {
    // Image north of P, compassAngle 0 (north) → looking away from P (south)
    const img = { id: '1', lng: -71.0589, lat: 42.3605, compassAngle: 0 };
    expect(pickInViewImage(P, [img])).toBeNull();
  });

  it('picks closer in-view image over farther', () => {
    const near = { id: 'near', lng: -71.0589, lat: 42.3603, compassAngle: 180 };
    const far = { id: 'far', lng: -71.0589, lat: 42.3608, compassAngle: 180 };
    expect(pickInViewImage(P, [far, near])?.id).toBe('near');
  });

  it('rejects beyond 100 m', () => {
    const far = { id: 'far', lng: -71.0589, lat: 42.3620, compassAngle: 180 };
    expect(haversineMeters(far, P)).toBeGreaterThan(100);
    expect(pickInViewImage(P, [far])).toBeNull();
  });
});
