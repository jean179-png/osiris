import { describe, it, expect } from 'vitest';
import {
  cityFromReference,
  mapCarsProgramCamera,
  pickView,
  type CarsProgramCamera,
  type CarsProgramSource,
} from './carsprogram';

const MASSDOT: CarsProgramSource = {
  listUrl: 'https://matg.carsprogram.org/cameras_v1/api/cameras',
  idPrefix: 'massdot',
  source: 'MassDOT',
  state: 'Massachusetts',
  bounds: { minLat: 41.2, maxLat: 42.95, minLng: -73.55, maxLng: -69.85 },
};

const sample: CarsProgramCamera = {
  id: 13312,
  public: true,
  name: 'I-90-WB-MM79.4-Charlton-@ MSP C10 West side',
  location: {
    latitude: 42.13533132967122,
    longitude: -72.04123524036876,
    cityReference: 'in Charlton',
    routeId: 'I-90',
  },
  cameraOwner: { name: 'MASSDOT' },
  views: [{
    name: 'WEST',
    type: 'MJPEG',
    url: 'https://api.trafficland.com/v2.2/json/stream/432525?system=castlerock&key=test',
    videoPreviewUrl: 'https://public.carsprogram.org/cameras/MA/432525-fullJpeg.jpg',
  }],
};

describe('cityFromReference', () => {
  it('strips in/near/at prefixes', () => {
    expect(cityFromReference('in Charlton', 'Massachusetts')).toBe('Charlton');
    expect(cityFromReference('near Rochester', 'New York')).toBe('Rochester');
  });

  it('falls back when empty', () => {
    expect(cityFromReference(null, 'Massachusetts')).toBe('Massachusetts');
  });
});

describe('pickView', () => {
  it('prefers videoPreviewUrl and keeps HLS streams', () => {
    expect(pickView([{
      type: 'WMP',
      url: 'https://example.com/live/playlist.m3u8',
      videoPreviewUrl: 'https://public.carsprogram.org/cameras/NY/cam.png',
    }])).toEqual({
      snapshot: 'https://public.carsprogram.org/cameras/NY/cam.png',
      stream: 'https://example.com/live/playlist.m3u8',
    });
  });

  it('uses STILL_IMAGE url when no preview is published', () => {
    expect(pickView([{
      type: 'STILL_IMAGE',
      url: 'https://public.carsprogram.org/cameras/MA/432468-fullJpeg.jpg',
    }])).toEqual({
      snapshot: 'https://public.carsprogram.org/cameras/MA/432468-fullJpeg.jpg',
    });
  });
});

describe('mapCarsProgramCamera', () => {
  it('maps a MassDOT row with preview', () => {
    expect(mapCarsProgramCamera(sample, MASSDOT)).toEqual({
      id: 'massdot-13312',
      lat: 42.13533132967122,
      lng: -72.04123524036876,
      name: 'I-90-WB-MM79.4-Charlton-@ MSP C10 West side',
      city: 'Charlton',
      country: 'US',
      feed_url: 'https://public.carsprogram.org/cameras/MA/432525-fullJpeg.jpg',
      source: 'MASSDOT',
    });
  });

  it('skips non-public or out-of-bounds rows', () => {
    expect(mapCarsProgramCamera({ ...sample, public: false }, MASSDOT)).toBeNull();
    expect(mapCarsProgramCamera({
      ...sample,
      location: { ...sample.location!, latitude: 40.7, longitude: -74.0 },
    }, MASSDOT)).toBeNull();
  });

  it('skips rows with no usable view', () => {
    expect(mapCarsProgramCamera({ ...sample, views: [] }, MASSDOT)).toBeNull();
  });
});
