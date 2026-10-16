import { stealthFetch } from '@/lib/stealthFetch';
import type { CctvCamera } from './types';

/**
 * Shared loader for CARS Program traveler-info camera catalogues
 * (Mass511, 511NY, and siblings). One JSON list, no developer key.
 */

export interface CarsProgramView {
  name?: string | null;
  type?: string | null;
  url?: string | null;
  videoPreviewUrl?: string | null;
}

export interface CarsProgramCamera {
  id: number;
  public?: boolean;
  name?: string | null;
  location?: {
    latitude?: number;
    longitude?: number;
    cityReference?: string | null;
    routeId?: string | null;
  } | null;
  cameraOwner?: { name?: string | null } | null;
  views?: CarsProgramView[] | null;
}

export interface CarsProgramSource {
  /** Full cameras list URL, e.g. https://matg.carsprogram.org/cameras_v1/api/cameras */
  listUrl: string;
  idPrefix: string;
  /** Fallback agency label when cameraOwner is missing. */
  source: string;
  state: string;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

const IMAGE_URL = /\.(jpe?g|png|gif|webp)(\?|$)/i;

/** Pull a place name out of `in Charlton` / `near Rochester`. */
export function cityFromReference(ref: string | null | undefined, fallback: string): string {
  const trimmed = ref?.trim();
  if (!trimmed) return fallback;
  const cleaned = trimmed.replace(/^(in|near|at)\s+/i, '').trim();
  return cleaned || fallback;
}

function isImageUrl(url: string): boolean {
  return IMAGE_URL.test(url) || /\/image(\?|$)/i.test(url);
}

/** Prefer a still the browser can show; keep HLS when advertised. */
export function pickView(views: CarsProgramView[] | null | undefined): {
  snapshot?: string;
  stream?: string;
} {
  if (!views?.length) return {};
  for (const view of views) {
    const preview = view.videoPreviewUrl?.trim();
    if (preview) {
      const stream = view.url?.trim();
      return {
        snapshot: preview,
        stream: stream && /\.m3u8(\?|$)/i.test(stream) ? stream : undefined,
      };
    }
  }
  for (const view of views) {
    const url = view.url?.trim();
    if (!url) continue;
    if (view.type === 'STILL_IMAGE' || isImageUrl(url)) return { snapshot: url };
    if (/\.m3u8(\?|$)/i.test(url)) return { stream: url };
  }
  return {};
}

/** Map one catalogue row, or null if it should be skipped. */
export function mapCarsProgramCamera(rec: CarsProgramCamera, cfg: CarsProgramSource): CctvCamera | null {
  if (!rec || typeof rec.id !== 'number') return null;
  if (rec.public === false) return null;

  const lat = rec.location?.latitude;
  const lng = rec.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const b = cfg.bounds;
  if (lat! < b.minLat || lat! > b.maxLat || lng! < b.minLng || lng! > b.maxLng) return null;

  const { snapshot, stream } = pickView(rec.views);
  if (!snapshot && !stream) return null;

  const owner = rec.cameraOwner?.name?.trim();
  const name = rec.name?.trim() || `${cfg.source} Camera ${rec.id}`;

  return {
    id: `${cfg.idPrefix}-${rec.id}`,
    lat: lat!,
    lng: lng!,
    name,
    city: cityFromReference(rec.location?.cityReference, cfg.state),
    country: 'US',
    ...(snapshot ? { feed_url: snapshot } : {}),
    ...(stream ? { stream_url: stream, stream_type: 'hls' as const } : {}),
    source: owner || cfg.source,
  };
}

export async function loadCarsProgramCameras(cfg: CarsProgramSource): Promise<CctvCamera[]> {
  const res = await stealthFetch(cfg.listUrl, {
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${cfg.source} HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`${cfg.source} returned a non-array payload`);

  const cams: CctvCamera[] = [];
  const seen = new Set<string>();
  for (const rec of data as CarsProgramCamera[]) {
    const cam = mapCarsProgramCamera(rec, cfg);
    if (!cam || seen.has(cam.id)) continue;
    seen.add(cam.id);
    cams.push(cam);
  }

  console.log(`[OSIRIS] ${cfg.source} cameras — CARS Program: ${cams.length}`);
  return cams;
}
