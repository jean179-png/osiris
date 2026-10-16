import { cachedSource } from '@/lib/sourceCache';
import { loadCarsProgramCameras, type CarsProgramSource } from './carsprogram';

/**
 * OSIRIS — Massachusetts CCTV Cameras (MassDOT / Mass511)
 * Source: https://matg.carsprogram.org/cameras_v1/api/cameras
 * ~300 public cameras — NO API KEY NEEDED.
 *
 * Mass.gov's TrafficLand partner API wants a commercial signup; the Mass511
 * CARS catalogue already publishes the same cameras with public JPEG
 * previews on public.carsprogram.org. That is what this reads.
 */
const MASSDOT: CarsProgramSource = {
  listUrl: 'https://matg.carsprogram.org/cameras_v1/api/cameras',
  idPrefix: 'massdot',
  source: 'MassDOT',
  state: 'Massachusetts',
  bounds: { minLat: 41.2, maxLat: 42.95, minLng: -73.55, maxLng: -69.85 },
};

export const fetchMassachusettsCameras = cachedSource('massachusetts', () => loadCarsProgramCameras(MASSDOT));
