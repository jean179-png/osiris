import { describe, it, expect } from 'vitest';
import { mapIbi511Record, type Ibi511Record, type Ibi511Source } from './ibi511';
import { fetchPennsylvaniaCameras } from './pennsylvania';

const PENNDOT: Ibi511Source = {
  base: 'https://511pa.org',
  idPrefix: 'penndot',
  source: 'PennDOT',
  snapshotOnly: true,
  state: 'Pennsylvania',
  bounds: { minLat: 39.7, maxLat: 42.3, minLng: -80.6, maxLng: -74.7 },
};

const sample: Ibi511Record = {
  id: 4129,
  roadway: 'I-81',
  direction: 'Westbound',
  location: 'I-81 at Exit 67',
  county: 'Dauphin',
  latLng: { geography: { wellKnownText: 'POINT (-76.88 40.27)' } },
  images: [{
    imageUrl: '/map/Cctv/6178',
    videoUrl: 'https://example.com/chan.m3u8',
    isVideoAuthRequired: true,
    blocked: false,
    disabled: false,
  }],
};

describe('pennsylvania mapping', () => {
  it('maps a 511PA row to a snapshot-only camera', () => {
    expect(mapIbi511Record(sample, PENNDOT)).toEqual({
      id: 'penndot-4129',
      lat: 40.27,
      lng: -76.88,
      name: 'I-81 at Exit 67',
      city: 'Dauphin County',
      country: 'US',
      feed_url: 'https://511pa.org/map/Cctv/6178',
      source: 'PennDOT',
    });
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchPennsylvaniaCameras (live)', () => {
  liveIt('fetches a large set of well-formed Pennsylvania cameras', async () => {
    const cams = await fetchPennsylvaniaCameras();
    expect(cams.length).toBeGreaterThan(1000);
    expect(new Set(cams.map((c) => c.id)).size).toBe(cams.length);
    for (const cam of cams) {
      expect(cam.id).toMatch(/^penndot-\d+$/);
      expect(cam.source).toBe('PennDOT');
      expect(cam.feed_url).toMatch(/^https:\/\/511pa\.org\/map\/Cctv\//);
    }
  }, 60_000);
});
