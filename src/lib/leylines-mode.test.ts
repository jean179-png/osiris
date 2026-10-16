import { describe, expect, it } from 'vitest';
import { parseLeylinesMode, showGrid, showWatkins } from './leylines-mode';

describe('leylines-mode', () => {
  it('defaults unknown/empty to both', () => {
    expect(parseLeylinesMode(null)).toBe('both');
    expect(parseLeylinesMode('')).toBe('both');
    expect(parseLeylinesMode('nope')).toBe('both');
  });

  it('accepts watkins|grid|both', () => {
    expect(parseLeylinesMode('watkins')).toBe('watkins');
    expect(parseLeylinesMode('grid')).toBe('grid');
    expect(parseLeylinesMode('both')).toBe('both');
  });

  it('showWatkins / showGrid respect mode', () => {
    expect(showWatkins('watkins')).toBe(true);
    expect(showGrid('watkins')).toBe(false);
    expect(showWatkins('grid')).toBe(false);
    expect(showGrid('grid')).toBe(true);
    expect(showWatkins('both')).toBe(true);
    expect(showGrid('both')).toBe(true);
  });
});
