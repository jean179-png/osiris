import { describe, expect, it } from 'vitest';
import {
  LEYLINES_ORIGIN,
  WATKINS_LEYS,
  gridPath,
  gridUrl,
  parseGridFamily,
  watkinsUrl,
} from './leylines-catalog';

describe('leylines-catalog', () => {
  it('lists at least 26 Watkins leys with absolute URLs', () => {
    expect(WATKINS_LEYS.length).toBeGreaterThanOrEqual(26);
    const stone = WATKINS_LEYS.find((e) => e.slug === 'stonehenge-line');
    expect(stone).toBeTruthy();
    expect(watkinsUrl(stone!)).toBe(
      `${LEYLINES_ORIGIN}/api/line/leylines/lines/stonehenge-line/50/255,255,66`,
    );
    expect(WATKINS_LEYS.some((e) => e.slug === 'st-michael-line')).toBe(true);
    expect(WATKINS_LEYS.some((e) => e.slug === 'st-michael-apollo-axis')).toBe(true);
  });

  it('resolves gravity-wells grid path', () => {
    expect(gridPath('gravity-wells')).toContain('gravitywells/basic/lines/off');
    expect(gridUrl('gravity-wells').startsWith(LEYLINES_ORIGIN)).toBe(true);
  });

  it('parseGridFamily accepts gravity-wells and rejects junk', () => {
    expect(parseGridFamily(null)).toBeNull();
    expect(parseGridFamily('')).toBeNull();
    expect(parseGridFamily('gravity-wells')).toBe('gravity-wells');
    expect(parseGridFamily('hartmann')).toBeNull();
  });
});
