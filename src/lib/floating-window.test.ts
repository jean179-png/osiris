import { describe, expect, it } from 'vitest';
import { clampRect, defaultSpaceCamRect, resizeRect } from './floating-window';

describe('clampRect', () => {
  it('keeps the window inside the viewport', () => {
    expect(clampRect({ x: -40, y: -10, w: 200, h: 100 }, { w: 800, h: 600 }, 120, 80)).toEqual({
      x: 0,
      y: 0,
      w: 200,
      h: 100,
    });
  });

  it('enforces minimum size', () => {
    const r = clampRect({ x: 0, y: 0, w: 40, h: 20 }, { w: 800, h: 600 }, 160, 100);
    expect(r.w).toBe(160);
    expect(r.h).toBe(100);
  });

  it('allows a small overhang so panels can sit flush on an edge', () => {
    const r = clampRect({ x: -4, y: 500, w: 200, h: 100 }, { w: 800, h: 600 }, 120, 80, 8);
    expect(r.x).toBe(-4);
    expect(r.y).toBe(500);
  });
});

describe('resizeRect', () => {
  it('grows from the SE corner', () => {
    expect(resizeRect({ x: 10, y: 10, w: 200, h: 100 }, 'se', 30, 20, 80, 60)).toEqual({
      x: 10,
      y: 10,
      w: 230,
      h: 120,
    });
  });

  it('moves origin when resizing from NW', () => {
    const r = resizeRect({ x: 100, y: 100, w: 200, h: 100 }, 'nw', 40, 20, 80, 60);
    expect(r.w).toBe(160);
    expect(r.h).toBe(80);
    expect(r.x).toBe(140);
    expect(r.y).toBe(120);
  });

  it('locks 16:9 when aspectRatio is set', () => {
    const r = resizeRect({ x: 10, y: 10, w: 320, h: 180 }, 'e', 80, 0, 160, 90, 16 / 9);
    expect(r.w).toBe(400);
    expect(r.h).toBe(225);
  });
});

describe('defaultSpaceCamRect', () => {
  it('is 16:9 and sits near the bottom edge', () => {
    const r = defaultSpaceCamRect({ w: 1280, h: 800 });
    expect(r.w / r.h).toBeCloseTo(16 / 9, 1);
    expect(r.y + r.h).toBeLessThanOrEqual(800);
    expect(r.y + r.h).toBeGreaterThan(800 - 24);
  });
});
