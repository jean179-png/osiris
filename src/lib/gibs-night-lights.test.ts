import { describe, it, expect } from 'vitest';
import {
  NIGHT_LIGHTS_MAX_ZOOM,
  gibsNightLightsUpstreamUrl,
  parseNightLightsProduct,
} from './gibs-night-lights';

describe('gibs-night-lights', () => {
  it('exports max zoom 8 for Black Marble Level8', () => {
    expect(NIGHT_LIGHTS_MAX_ZOOM).toBe(8);
  });

  it('builds composite GIBS URLs with z/y/x order', () => {
    const url = gibsNightLightsUpstreamUrl('composite', 4, 5, 6);
    expect(url).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/default/GoogleMapsCompatible_Level8/4/6/5.png',
    );
  });

  it('returns null for daily product in v1', () => {
    expect(gibsNightLightsUpstreamUrl('daily', 3, 1, 2)).toBeNull();
  });

  it('parses composite product and defaults empty/null to composite', () => {
    expect(parseNightLightsProduct('composite')).toBe('composite');
    expect(parseNightLightsProduct(null)).toBe('composite');
    expect(parseNightLightsProduct('')).toBe('composite');
  });

  it('rejects unknown products', () => {
    expect(parseNightLightsProduct('daily')).toBe('daily');
    expect(parseNightLightsProduct('bogus')).toBeNull();
  });
});
