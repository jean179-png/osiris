import { describe, expect, it } from 'vitest';
import {
  clampIssStreamLagMs,
  groundTrackBearing,
  issFollowFromPositions,
  issFollowProfile,
  issFollowZoomForFrame,
  resolveIssFollowLockView,
  ISS_FOLLOW_DEFAULT_ZOOM,
  ISS_FOLLOW_PITCH,
  ISS_FOLLOW_STREAM_LAG_MS,
  ISS_NORAD_ID,
} from './iss-follow';

describe('groundTrackBearing', () => {
  it('is ~0° for due north', () => {
    expect(groundTrackBearing({ lat: 40, lng: -70 }, { lat: 41, lng: -70 })).toBeCloseTo(0, 0);
  });

  it('is ~90° for due east at equator', () => {
    expect(groundTrackBearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 0);
  });
});

describe('issFollowFromPositions', () => {
  it('carries altitude and ground-track bearing', () => {
    const t = issFollowFromPositions(
      { lat: 40, lng: -70, altKm: 408 },
      { lat: 40.1, lng: -69.9 },
    );
    expect(t.altKm).toBe(408);
    expect(t.bearing).toBeGreaterThan(0);
    expect(t.bearing).toBeLessThan(90);
  });
});

describe('issFollowProfile', () => {
  it('frames Sen 4K EARTH as near-nadir, not horizon', () => {
    const p = issFollowProfile('sen-4k');
    expect(p.pitch).toBeLessThan(20);
    expect(p.trackUp).toBe(true);
    expect(p.fovDeg).toBeLessThan(45);
  });

  it('frames EARTH VIEW as horizon / track-up', () => {
    const p = issFollowProfile('iss-earth');
    expect(p.pitch).toBeGreaterThan(50);
    expect(p.trackUp).toBe(true);
  });
});

describe('constants', () => {
  it('targets the ISS NORAD id and a near-nadir default pitch', () => {
    expect(ISS_NORAD_ID).toBe('25544');
    expect(ISS_FOLLOW_PITCH).toBeLessThan(20);
  });

  it('defaults stream lag to the tuned Sen embed delay', () => {
    expect(ISS_FOLLOW_STREAM_LAG_MS).toBe(35_000);
    expect(clampIssStreamLagMs(-1)).toBe(0);
    expect(clampIssStreamLagMs(999_999)).toBe(120_000);
  });
});

describe('resolveIssFollowLockView', () => {
  it('falls back to operator-tuned nadir framing when nothing is saved', () => {
    const locked = resolveIssFollowLockView({
      feedId: 'sen-4k',
      altKm: 408,
      latitude: 0,
    });
    expect(locked.pitch).toBe(0);
    expect(locked.zoom).toBe(7.5);
    expect(locked.lagMs).toBe(ISS_FOLLOW_STREAM_LAG_MS);
  });
});

describe('issFollowZoomForFrame', () => {
  it('keeps Sen nadir inside the soft zoom band', () => {
    const z = issFollowZoomForFrame(408, { feedId: 'sen-4k', latitude: 0 });
    expect(z).toBeGreaterThanOrEqual(6.5);
    expect(z).toBeLessThanOrEqual(8.5);
    expect(ISS_FOLLOW_DEFAULT_ZOOM).toBe(7.5);
  });

  it('zooms in when the camera is lower', () => {
    const band = { zoomMin: 4, zoomMax: 12, feedId: 'sen-4k' as const };
    expect(issFollowZoomForFrame(200, band)).toBeGreaterThan(
      issFollowZoomForFrame(500, band),
    );
  });

  it('uses a wider frame for overview than for nadir', () => {
    expect(issFollowZoomForFrame(408, { feedId: 'iss-overview' })).toBeLessThan(
      issFollowZoomForFrame(408, { feedId: 'sen-4k' }),
    );
  });
});
