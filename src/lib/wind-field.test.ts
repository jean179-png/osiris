import { describe, it, expect } from 'vitest';
import {
  speedDirToUV,
  sampleUV,
  windSpeed,
  speedToRgba,
  type WindFieldGrid,
} from './wind-field';

describe('speedDirToUV', () => {
  it('maps north wind (from N) to negative v', () => {
    const { u, v } = speedDirToUV(10, 0);
    expect(u).toBeCloseTo(0, 5);
    expect(v).toBeCloseTo(-10, 5);
  });

  it('maps east wind (from E) to negative u', () => {
    const { u, v } = speedDirToUV(10, 90);
    expect(u).toBeCloseTo(-10, 5);
    expect(v).toBeCloseTo(0, 5);
  });
});

describe('sampleUV', () => {
  const grid: WindFieldGrid = {
    product: 'surface',
    width: 2,
    height: 2,
    west: 0,
    south: 0,
    east: 10,
    north: 10,
    u: new Float32Array([0, 10, 0, 10]),
    v: new Float32Array([0, 0, 5, 5]),
    unit: 'm/s',
    validTime: null,
    attribution: 'test',
  };

  it('returns null outside bounds', () => {
    expect(sampleUV(grid, -1, 5)).toBeNull();
  });

  it('samples southwest corner', () => {
    const s = sampleUV(grid, 0, 0);
    expect(s).not.toBeNull();
    expect(s!.u).toBeCloseTo(0, 5);
    expect(s!.v).toBeCloseTo(0, 5);
  });

  it('interpolates center', () => {
    const s = sampleUV(grid, 5, 5);
    expect(s).not.toBeNull();
    expect(s!.u).toBeCloseTo(5, 5);
    expect(s!.v).toBeCloseTo(2.5, 5);
  });
});

describe('windSpeed + speedToRgba', () => {
  it('computes magnitude', () => {
    expect(windSpeed(3, 4)).toBeCloseTo(5, 5);
  });

  it('returns warmer color at higher speed', () => {
    const calm = speedToRgba(1);
    const gale = speedToRgba(25);
    expect(gale[0] + gale[1]).toBeGreaterThan(calm[0] + calm[1]);
  });
});
