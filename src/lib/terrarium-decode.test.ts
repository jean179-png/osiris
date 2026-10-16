import { describe, it, expect } from 'vitest';
import {
  terrariumElev,
  decodeTerrariumRgba,
  isFlooded,
  paintFloodMask,
} from './terrarium-decode';

describe('terrariumElev', () => {
  it('decodes sea-level-ish and high terrain', () => {
    // R=128,G=0,B=0 → 128*256 - 32768 = 0
    expect(terrariumElev(128, 0, 0)).toBe(0);
    // R=128,G=100,B=0 → 100 m
    expect(terrariumElev(128, 100, 0)).toBe(100);
    // Below sea: R=127 → 127*256 - 32768 = -256
    expect(terrariumElev(127, 0, 0)).toBe(-256);
  });
});

describe('decodeTerrariumRgba + flood', () => {
  it('decodes RGBA buffer and paints flood mask', () => {
    const rgba = new Uint8ClampedArray([
      128, 0, 0, 255, // 0 m
      128, 50, 0, 255, // 50 m
    ]);
    const elev = decodeTerrariumRgba(rgba, 2, 1);
    expect(elev[0]).toBe(0);
    expect(elev[1]).toBe(50);
    expect(isFlooded(0, 10)).toBe(true);
    expect(isFlooded(50, 10)).toBe(false);

    const mask = new Uint8ClampedArray(8);
    paintFloodMask(elev, 10, mask);
    expect(mask[3]).toBeGreaterThan(0); // flooded pixel alpha
    expect(mask[7]).toBe(0); // dry
  });
});
