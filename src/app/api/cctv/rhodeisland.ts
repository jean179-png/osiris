import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';
import { cachedSource } from '@/lib/sourceCache';

/**
 * OSIRIS — Rhode Island CCTV Cameras (RIDOT)
 * Source: https://gisprod.dot.ri.gov/scp/rest/services/TMC_ITS_Assets/FeatureServer/2
 * ~140 statewide highway cameras — NO API KEY NEEDED.
 *
 * Fills Providence, Pawtucket, Warwick and the I-95 corridor that MassDOT
 * does not cover. Snapshots are public JPEGs on www.dot.ri.gov; filenames
 * contain spaces, so the feed URL is proxied and path-encoded.
 */

const LAYER =
  'https://gisprod.dot.ri.gov/scp/rest/services/TMC_ITS_Assets/FeatureServer/2/query'
  + '?where=Enabled%3D1&outFields=EquipmentID,Description,Latitude,Longitude,Direction,CCVEWebURL'
  + '&returnGeometry=true&outSR=4326&f=json';

const RI_BOUNDS = { minLat: 41.1, maxLat: 42.05, minLng: -72.0, maxLng: -71.05 };

export interface RidotRecord {
  attributes?: {
    EquipmentID?: number | string | null;
    Description?: string | null;
    Latitude?: number | null;
    Longitude?: number | null;
    Direction?: string | null;
    CCVEWebURL?: string | null;
  } | null;
}

/** Encode spaces and punctuation in the RIDOT JPEG path; force https. */
export function normalizeRidotImageUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withScheme = trimmed.replace(/^http:\/\//i, 'https://');
    const url = new URL(withScheme);
    if (!/(^|\.)dot\.ri\.gov$/i.test(url.hostname)) return null;
    // Pathname may contain unencoded spaces from the ArcGIS field.
    url.pathname = url.pathname
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment.replace(/\+/g, ' '))))
      .join('/');
    return url.toString();
  } catch {
    return null;
  }
}

function proxied(url: string): string {
  return `/api/cctv/proxy?url=${encodeURIComponent(url)}`;
}

/** Map one ArcGIS feature, or null if unusable. Exported for tests. */
export function mapRecord(rec: RidotRecord): CctvCamera | null {
  const a = rec?.attributes;
  if (!a) return null;

  const id = a.EquipmentID;
  if (id === null || id === undefined || id === '') return null;

  const lat = Number(a.Latitude);
  const lng = Number(a.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < RI_BOUNDS.minLat || lat > RI_BOUNDS.maxLat) return null;
  if (lng < RI_BOUNDS.minLng || lng > RI_BOUNDS.maxLng) return null;

  const image = a.CCVEWebURL ? normalizeRidotImageUrl(a.CCVEWebURL) : null;
  if (!image) return null;

  const name = (a.Description || '').trim() || `RIDOT Camera ${id}`;

  return {
    id: `ridot-${id}`,
    lat,
    lng,
    name,
    city: 'Rhode Island',
    country: 'US',
    feed_url: proxied(image),
    source: 'RIDOT',
  };
}

/**
 * Downtown / harbour life cams for the Providence–Attleboro corridor.
 * RIDOT is highway stills; these are the public place livestreams nearby.
 * Westerly and Newport are the durable RI downtown/harbour YouTube lives
 * (Providence AMP cam is WPRI-walled; no open downtown Providence feed).
 */
const RI_CITY_LIFE: CctvCamera[] = [
  {
    id: 'ri-westerly-downtown',
    lat: 41.3776, lng: -71.8273,
    name: 'Westerly - Downtown',
    city: 'Westerly', country: 'US',
    external_url: 'https://www.youtube.com/@XCMediaDesign/live',
    source: 'YouTube Live',
  },
  {
    id: 'ri-newport-harbor',
    lat: 41.4830, lng: -71.3142,
    name: 'Newport - Harbor (Sightsailing)',
    city: 'Newport', country: 'US',
    stream_url:
      'https://www.youtube-nocookie.com/embed/yvJlIBJ5m1o?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/watch?v=yvJlIBJ5m1o',
    source: 'YouTube Live',
  },
];

async function loadRhodeIslandCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(LAYER, {
    // gisprod.dot.ri.gov is often slow to accept the TLS handshake from this host.
    signal: AbortSignal.timeout(45000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`RIDOT HTTP ${res.status}`);

  const data = await res.json();
  const features = Array.isArray(data?.features) ? data.features : [];

  const cams: CctvCamera[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const cam = mapRecord(feature);
    if (!cam || seen.has(cam.id)) continue;
    seen.add(cam.id);
    cams.push(cam);
  }

  for (const cam of RI_CITY_LIFE) {
    if (seen.has(cam.id)) continue;
    seen.add(cam.id);
    cams.push(cam);
  }

  console.log(`[OSIRIS] Rhode Island cameras — RIDOT+city: ${cams.length}`);
  return cams;
}

export const fetchRhodeIslandCameras = cachedSource('rhodeisland', loadRhodeIslandCameras);
