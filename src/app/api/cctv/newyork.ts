import { cachedSource } from '@/lib/sourceCache';
import { loadCarsProgramCameras, type CarsProgramSource } from './carsprogram';

/**
 * OSIRIS — New York CCTV Cameras (NYSDOT 511NY + NYC DOT)
 * Source: https://nysdottg.carsprogram.org/cameras_v1/api/cameras
 * ~2,700 public cameras — NO API KEY NEEDED.
 *
 * The documented 511NY developer REST API wants a reviewed key. The same
 * catalogue the 511NY web map loads from CARS Program does not: one JSON
 * list covering NYSDOT highway cams (HLS + preview) and NYC DOT stills.
 */
const NY511: CarsProgramSource = {
  listUrl: 'https://nysdottg.carsprogram.org/cameras_v1/api/cameras',
  idPrefix: 'ny511',
  source: '511NY',
  state: 'New York',
  bounds: { minLat: 40.4, maxLat: 45.05, minLng: -79.8, maxLng: -71.75 },
};

export const fetchNewYorkCameras = cachedSource('newyork', () => loadCarsProgramCameras(NY511));
