import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * OSIRIS — Netherlands CCTV Cameras (Rijkswaterstaat + city live cams)
 * Source: https://api.rwsverkeersinfo.nl/api/cameras
 * ~26 operator-controlled HD motorway cameras — NO API KEY NEEDED.
 *
 * Replaces opendata.ndw.nu/cameras.json. NDW retired that dataset and it has
 * been answering 404 into a silent catch ever since, so the layer carried no
 * Dutch cameras at all rather than reporting a dead source.
 *
 * Harbour / city public webcams live in public-webcams-nl (~200). Amsterdam
 * Skyline stills are added here so the capital is visible on the traffic
 * region itself, not only when the public-webcam layer is requested.
 */

function proxied(url: string): string {
  return `/api/cctv/proxy?url=${encodeURIComponent(url)}`;
}

function skyline(id: number): string {
  return proxied(`https://cdn.skylinewebcams.com/live${id}.jpg`);
}

const AMSTERDAM_LIVE: CctvCamera[] = [
  {
    id: 'sky-nl-amsterdam-center',
    lat: 52.3730, lng: 4.8930,
    name: "Amsterdam - City Center",
    city: 'Amsterdam', country: 'Netherlands',
    feed_url: skyline(5798),
    external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/city-center.html',
    source: 'SkylineWebcams',
  },
  {
    id: 'sky-nl-amsterdam-canals',
    lat: 52.3676, lng: 4.9041,
    name: "Amsterdam - Canals",
    city: 'Amsterdam', country: 'Netherlands',
    feed_url: skyline(3577),
    external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/canals.html',
    source: 'SkylineWebcams',
  },
];

/**
 * City-life pins for densify targets. Delfzijl harbour cams already live in
 * public-webcams-nl. Haarlem's historic Grote Markt cam is offline; Ventusky
 * publishes an hourly city-skyline still (resolved per request so the region
 * cache does not freeze a clock-hour path). Delft has no public Markt cam —
 * the RWS A13 pin in this region is the open live view nearest the city.
 */
function haarlemCityLife(): CctvCamera[] {
  return [
    {
      id: 'nl-haarlem-city-view',
      lat: 52.3810, lng: 4.6370,
      name: 'Haarlem - City skyline',
      city: 'Haarlem', country: 'Netherlands',
      feed_url: '/api/cctv/ventusky-frame?id=932984225',
      external_url: 'https://www.ventusky.com/webcam-932984225',
      source: 'Ventusky',
    },
  ];
}

const CAMERAS_JSON = 'https://api.rwsverkeersinfo.nl/api/cameras';

/** Netherlands bounding box — RWS publishes mainland motorways only. */
const NL_BOUNDS = { minLat: 50.7, maxLat: 53.7, minLng: 3.3, maxLng: 7.3 };

/**
 * The frames are hotlink-protected: asked without a Referer, stream.inmoves.nl
 * answers 401 with a zero-length PNG, so the browser cannot load `static_url`
 * itself. The proxy sends `Referer: https://<host>/`, which the origin accepts,
 * and returns the real JPEG.
 */

/** One record of the RWS feed. Coordinates arrive as strings. */
interface RwsCamera {
  id?: number | string;
  latitude?: string;
  longitude?: string;
  road?: string;
  near?: string;
  location_description?: string;
  /** Embeddable player page — a document, not a frame. */
  stream_url?: string;
  /** Single JPEG frame, behind the Referer check. */
  static_url?: string;
}

/** Parse the RWS camera feed. Exported for tests. */
export function parseRwsCameras(payload: unknown): CctvCamera[] {
  if (!Array.isArray(payload)) return [];

  const cams: CctvCamera[] = [];
  const seen = new Set<string>();

  for (const cam of payload as RwsCamera[]) {
    const id = String(cam?.id ?? '');
    const lat = parseFloat(cam?.latitude ?? '');
    const lng = parseFloat(cam?.longitude ?? '');

    if (!id || seen.has(id)) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < NL_BOUNDS.minLat || lat > NL_BOUNDS.maxLat) continue;
    if (lng < NL_BOUNDS.minLng || lng > NL_BOUNDS.maxLng) continue;
    // Without a frame or a page to open, a pin has nothing to show.
    if (!cam.static_url && !cam.stream_url) continue;
    seen.add(id);

    const near = cam.near?.trim() || '';
    const road = cam.road?.trim() || '';

    cams.push({
      id: `nl-rws-${id}`,
      lat,
      lng,
      name: [road, near].filter(Boolean).join(' — ') || cam.location_description?.trim() || `RWS Camera ${id}`,
      city: near || 'Netherlands',
      country: 'Netherlands',
      ...(cam.static_url ? { feed_url: proxied(cam.static_url) } : {}),
      ...(cam.stream_url ? { external_url: cam.stream_url } : {}),
      source: 'Rijkswaterstaat',
    });
  }

  return cams;
}

export async function fetchNetherlandsCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(CAMERAS_JSON, {
    signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`RWS HTTP ${res.status}`);

  const cams = [
    ...parseRwsCameras(await res.json()),
    ...AMSTERDAM_LIVE,
    ...haarlemCityLife(),
  ];
  console.log(`[OSIRIS] Netherlands cameras — Rijkswaterstaat+city: ${cams.length}`);
  return cams;
}
