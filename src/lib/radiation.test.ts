import { describe, it, expect } from 'vitest';
import { cpmToNsvh, mapSafecastToStations, statusForNsvh } from './radiation';

describe('radiation helpers', () => {
  it('maps cpm and status', () => {
    expect(cpmToNsvh(30)).toBe(300);
    expect(statusForNsvh(100)).toBe('NORMAL');
    expect(statusForNsvh(400)).toBe('WARNING');
    expect(statusForNsvh(2000)).toBe('DANGER');
  });

  it('maps safecast rows', () => {
    const stations = mapSafecastToStations([
      { id: 1, value: 25, unit: 'cpm', latitude: 40, longitude: -75, location_name: 'Test' },
      { id: 2, value: 1, unit: 'usv', latitude: 41, longitude: -74 },
    ]);
    expect(stations[0]!.reading).toBe(250);
    expect(stations[0]!.network).toBe('Safecast');
    expect(stations[1]!.reading).toBe(1000);
    expect(stations[1]!.status).toBe('DANGER');
  });
});
