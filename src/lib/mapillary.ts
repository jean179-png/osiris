import {
  bboxAround,
  bearingDegrees,
  googleStreetViewUrl,
  pickInViewImage,
  type LngLat,
  type MapillaryImagePose,
} from './mapillary-inview';

const GRAPH = 'https://graph.mapillary.com/images';
const FIELDS = 'id,computed_geometry,geometry,computed_compass_angle,compass_angle';

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map Mapillary Graph /images JSON → poses (skips incomplete rows). */
export function mapGraphImagesToPoses(body: unknown): MapillaryImagePose[] {
  if (!body || typeof body !== 'object') return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const out: MapillaryImagePose[] = [];
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = r.id != null ? String(r.id) : '';
    if (!id) continue;
    const geom =
      (r.computed_geometry as { coordinates?: unknown } | undefined) ??
      (r.geometry as { coordinates?: unknown } | undefined);
    const coords = geom?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lng = num(coords[0]);
    const lat = num(coords[1]);
    if (lng == null || lat == null) continue;
    const compass =
      num(r.computed_compass_angle) ?? num(r.compass_angle);
    if (compass == null) continue;
    out.push({ id, lng, lat, compassAngle: compass });
  }
  return out;
}

export async function fetchMapillaryImagesNear(
  target: LngLat,
  token: string,
): Promise<MapillaryImagePose[]> {
  const [w, s, e, n] = bboxAround(target, 100);
  const url =
    `${GRAPH}?access_token=${encodeURIComponent(token)}` +
    `&fields=${encodeURIComponent(FIELDS)}` +
    `&bbox=${w},${s},${e},${n}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const body = await res.json();
  return mapGraphImagesToPoses(body);
}

export type NearestInViewOk = {
  ok: true;
  image: MapillaryImagePose;
  lookAt: LngLat;
  yawTowardLookAt: number;
};

export type NearestInViewMiss = {
  ok: false;
  lookAt: LngLat;
  googleUrl: string;
};

export async function resolveNearestInView(
  target: LngLat,
  token: string,
): Promise<NearestInViewOk | NearestInViewMiss> {
  const images = await fetchMapillaryImagesNear(target, token);
  const best = pickInViewImage(target, images);
  if (!best) {
    return { ok: false, lookAt: target, googleUrl: googleStreetViewUrl(target) };
  }
  return {
    ok: true,
    image: best,
    lookAt: target,
    yawTowardLookAt: bearingDegrees(best, target),
  };
}

export { googleStreetViewUrl };
