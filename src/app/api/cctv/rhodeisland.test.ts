import { describe, it, expect } from 'vitest';
import { mapRecord, normalizeRidotImageUrl, fetchRhodeIslandCameras } from './rhodeisland';

describe('normalizeRidotImageUrl', () => {
  it('upgrades http and encodes spaces in the path', () => {
    expect(
      normalizeRidotImageUrl('http://www.dot.ri.gov/img/travel/camimages/95_42.4_N_CAM - Broadway (Pawt).jpg'),
    ).toBe('https://www.dot.ri.gov/img/travel/camimages/95_42.4_N_CAM%20-%20Broadway%20(Pawt).jpg');
  });

  it('rejects non-RIDOT hosts', () => {
    expect(normalizeRidotImageUrl('https://example.com/cam.jpg')).toBeNull();
  });
});

describe('mapRecord', () => {
  it('maps an enabled Providence-area camera', () => {
    expect(mapRecord({
      attributes: {
        EquipmentID: 24,
        Description: '95_42.4_N_CAM - Broadway (Pawt)',
        Latitude: 41.88116,
        Longitude: -71.37709,
        Direction: 'NB',
        CCVEWebURL: 'https://www.dot.ri.gov/img/travel/camimages/95_42.4_N_CAM - Broadway (Pawt).jpg',
      },
    })).toEqual({
      id: 'ridot-24',
      lat: 41.88116,
      lng: -71.37709,
      name: '95_42.4_N_CAM - Broadway (Pawt)',
      city: 'Rhode Island',
      country: 'US',
      feed_url: '/api/cctv/proxy?url=' + encodeURIComponent(
        'https://www.dot.ri.gov/img/travel/camimages/95_42.4_N_CAM%20-%20Broadway%20(Pawt).jpg',
      ),
      source: 'RIDOT',
    });
  });

  it('skips cameras outside Rhode Island or without an image', () => {
    expect(mapRecord({
      attributes: {
        EquipmentID: 1,
        Description: 'Out of state',
        Latitude: 42.5,
        Longitude: -71.1,
        CCVEWebURL: 'https://www.dot.ri.gov/img/travel/camimages/x.jpg',
      },
    })).toBeNull();
    expect(mapRecord({
      attributes: {
        EquipmentID: 2,
        Description: 'No image',
        Latitude: 41.8,
        Longitude: -71.4,
        CCVEWebURL: null,
      },
    })).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchRhodeIslandCameras (live)', () => {
  liveIt('fetches a useful set of RIDOT cameras', async () => {
    const cams = await fetchRhodeIslandCameras();
    expect(cams.length).toBeGreaterThan(50);
    expect(new Set(cams.map((c) => c.id)).size).toBe(cams.length);
    for (const cam of cams) {
      expect(cam.id).toMatch(/^ridot-/);
      expect(cam.source).toBe('RIDOT');
      expect(cam.feed_url).toMatch(/^\/api\/cctv\/proxy\?url=/);
    }
  }, 30_000);
});
