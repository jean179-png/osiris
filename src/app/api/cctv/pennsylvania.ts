import { cachedSource } from '@/lib/sourceCache';
import { loadIbi511Cameras, type Ibi511Source } from './ibi511';

/**
 * OSIRIS — Pennsylvania CCTV Cameras (PennDOT / 511pa.org)
 * Source: https://511pa.org — the same IBI 511 stack Florida and Georgia run
 * ~1,565 cameras statewide — NO API KEY NEEDED.
 *
 * PennDOT's ArcGIS camera layer publishes internal `.pa.lcl` snapshot hosts
 * that cannot be reached from the public internet; the 511PA list endpoint
 * is the working feed. Snapshots are public at /map/Cctv/{id}.
 */
const PENNDOT: Ibi511Source = {
  base: 'https://511pa.org',
  idPrefix: 'penndot',
  source: 'PennDOT',
  snapshotOnly: true,
  state: 'Pennsylvania',
  bounds: { minLat: 39.7, maxLat: 42.3, minLng: -80.6, maxLng: -74.7 },
};

export const fetchPennsylvaniaCameras = cachedSource('pennsylvania', () => loadIbi511Cameras(PENNDOT));
