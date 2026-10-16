import { describe, expect, it } from 'vitest';
import {
  AIS_BOX_MIN_PX,
  AIS_GROUP_SELECT_CAP,
  capAisPicks,
  isMeaningfulBox,
  normalizeScreenRect,
  pickFromShipProps,
  pointInScreenRect,
} from './ais-box-select';

describe('ais-box-select', () => {
  it('normalizeScreenRect sorts corners', () => {
    expect(normalizeScreenRect({ x1: 10, y1: 20, x2: 5, y2: 8 })).toEqual({
      left: 5,
      top: 8,
      right: 10,
      bottom: 20,
    });
  });

  it('pointInScreenRect includes edges', () => {
    const r = normalizeScreenRect({ x1: 0, y1: 0, x2: 10, y2: 10 });
    expect(pointInScreenRect(0, 0, r)).toBe(true);
    expect(pointInScreenRect(10, 10, r)).toBe(true);
    expect(pointInScreenRect(11, 5, r)).toBe(false);
  });

  it('isMeaningfulBox rejects tiny Shift+click drags', () => {
    expect(isMeaningfulBox({ x1: 0, y1: 0, x2: 3, y2: 3 })).toBe(false);
    expect(isMeaningfulBox({ x1: 0, y1: 0, x2: AIS_BOX_MIN_PX, y2: AIS_BOX_MIN_PX })).toBe(true);
  });

  it('pickFromShipProps extracts digits-only mmsi and label', () => {
    expect(pickFromShipProps({ mmsi: '273-610-820', name: 'NORD' })).toEqual({
      mmsi: '273610820',
      label: 'NORD',
    });
    expect(pickFromShipProps({ mmsi: '', name: 'X' })).toBeNull();
    expect(pickFromShipProps(null)).toBeNull();
  });

  it('capAisPicks dedupes and slices to AIS_GROUP_SELECT_CAP', () => {
    const picks = Array.from({ length: AIS_GROUP_SELECT_CAP + 3 }, (_, i) => ({
      mmsi: String(100000000 + (i % (AIS_GROUP_SELECT_CAP + 1))),
      label: `S${i}`,
    }));
    // first AIS_GROUP_SELECT_CAP+1 unique, then duplicates of early ids
    const capped = capAisPicks(picks);
    expect(capped).toHaveLength(AIS_GROUP_SELECT_CAP);
    expect(capped[0]!.mmsi).toBe('100000000');
    expect(new Set(capped.map((p) => p.mmsi)).size).toBe(AIS_GROUP_SELECT_CAP);
  });
});
