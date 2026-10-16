import { describe, it, expect } from 'vitest';
import { mapSondeHubToBalloons } from './balloons';

describe('mapSondeHubToBalloons', () => {
  it('takes latest frame per serial', () => {
    const rows = mapSondeHubToBalloons({
      X1: {
        '2026-01-01T00:00:00.000Z': { lat: 1, lon: 2, alt: 100, vel_h: 1, vel_v: 0.5, temp: -40, type: 'RS41' },
        '2026-01-01T01:00:00.000Z': { lat: 10, lon: 20, alt: 20000, vel_h: 10, vel_v: -5, temp: -55, subtype: 'RS41', serial: 'X1' },
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.lat).toBe(10);
    expect(rows[0]!.altitude).toBe(20000);
    expect(rows[0]!.status).toBe('descending');
  });

  it('returns empty for bad input', () => {
    expect(mapSondeHubToBalloons(null)).toEqual([]);
  });
});
