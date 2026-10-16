import { describe, it, expect } from 'vitest';
import {
  PALEO_M_MIN,
  PALEO_M_MAX,
  PALEO_PRESETS,
  clampSeaLevelMeters,
  formatSeaLevelMeters,
  snapSeaLevelMeters,
} from './paleo-sea-level';

describe('paleo-sea-level', () => {
  it('exports meter range and presets inside range', () => {
    expect(PALEO_M_MIN).toBe(-120);
    expect(PALEO_M_MAX).toBe(70);
    for (const p of PALEO_PRESETS) {
      expect(p.meters).toBeGreaterThanOrEqual(PALEO_M_MIN);
      expect(p.meters).toBeLessThanOrEqual(PALEO_M_MAX);
    }
  });

  it('clamps to −120…+70', () => {
    expect(clampSeaLevelMeters(-200)).toBe(-120);
    expect(clampSeaLevelMeters(100)).toBe(70);
    expect(clampSeaLevelMeters(12.4)).toBe(12.4);
  });

  it('formats with sign', () => {
    expect(formatSeaLevelMeters(-120)).toBe('−120 m');
    expect(formatSeaLevelMeters(0)).toBe('0 m');
    expect(formatSeaLevelMeters(70)).toBe('+70 m');
  });

  it('snaps to step', () => {
    expect(snapSeaLevelMeters(12.4, 1)).toBe(12);
    expect(snapSeaLevelMeters(12.6, 1)).toBe(13);
    expect(snapSeaLevelMeters(-118.2, 5)).toBe(-120);
  });
});
