import { describe, it, expect } from 'vitest';
import {
  PALEO_COAST_CATALOG,
  nearestPaleoAge,
  paleoCoastAges,
  paleoCoastEntry,
  paleoCoastUpstreamUrl,
} from './paleo-coasts';

describe('paleo-coasts', () => {
  it('has sorted unique ages', () => {
    const ages = paleoCoastAges();
    expect(ages.length).toBe(PALEO_COAST_CATALOG.length);
    for (let i = 1; i < ages.length; i++) {
      expect(ages[i]!).toBeGreaterThan(ages[i - 1]!);
    }
  });

  it('nearestPaleoAge picks closest', () => {
    const ages = [12.8, 22, 65, 98];
    expect(nearestPaleoAge(ages, 20)).toBe(22);
    expect(nearestPaleoAge(ages, 70)).toBe(65);
  });

  it('builds upstream URL for known age', () => {
    const url = paleoCoastUpstreamUrl(65);
    expect(url).toContain('FROMAGE__');
    expect(url).toContain('.geojson');
    expect(paleoCoastEntry(65)?.ageMa).toBe(58.4);
  });
});
