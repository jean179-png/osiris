import { describe, it, expect } from 'vitest';
import { createParticles, stepParticles, particleCountForViewport } from './wind-particles';
import type { WindFieldGrid } from './wind-field';

const grid: WindFieldGrid = {
  product: 'surface',
  width: 2,
  height: 2,
  west: -10,
  south: -10,
  east: 10,
  north: 10,
  u: new Float32Array([10, 10, 10, 10]),
  v: new Float32Array([0, 0, 0, 0]),
  unit: 'm/s',
  validTime: null,
  attribution: 'test',
};

describe('createParticles', () => {
  it('creates count particles', () => {
    expect(createParticles(5, () => 0.5)).toHaveLength(5);
  });
});

describe('stepParticles', () => {
  it('advects eastward under positive u', () => {
    const ps = [{ lng: 0, lat: 0, age: 0 }];
    stepParticles(ps, grid, 1, { speedScale: 1, maxAge: 100 });
    expect(ps[0]!.lng).toBeGreaterThan(0);
  });
});

describe('particleCountForViewport', () => {
  it('caps at max', () => {
    expect(particleCountForViewport(4000, 4000, 1000)).toBe(1000);
  });
});
