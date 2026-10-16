export type LngLat = { lng: number; lat: number };
export type MapillaryImagePose = {
  id: string;
  lng: number;
  lat: number;
  compassAngle: number;
};

const R = 6371000;

export function haversineMeters(a: LngLat, b: LngLat): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const la1 = toR(a.lat);
  const la2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(from: LngLat, to: LngLat): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const φ1 = toR(from.lat);
  const φ2 = toR(to.lat);
  const Δλ = toR(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function angularDeltaDegrees(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function pickInViewImage(
  target: LngLat,
  images: MapillaryImagePose[],
  opts?: { maxMeters?: number; maxBearingDeg?: number },
): MapillaryImagePose | null {
  const maxMeters = opts?.maxMeters ?? 100;
  const maxBearingDeg = opts?.maxBearingDeg ?? 55;
  const scored: { img: MapillaryImagePose; dist: number; ang: number }[] = [];
  for (const img of images) {
    const dist = haversineMeters(img, target);
    if (dist > maxMeters) continue;
    const brg = bearingDegrees(img, target);
    const ang = angularDeltaDegrees(img.compassAngle, brg);
    if (ang > maxBearingDeg) continue;
    scored.push({ img, dist, ang });
  }
  scored.sort((a, b) => a.dist - b.dist || a.ang - b.ang);
  return scored[0]?.img ?? null;
}

/** ~half-box in degrees for Mapillary /images bbox queries. */
export function bboxAround(target: LngLat, meters = 100): [number, number, number, number] {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((target.lat * Math.PI) / 180) || 1);
  return [
    target.lng - dLng,
    target.lat - dLat,
    target.lng + dLng,
    target.lat + dLat,
  ];
}

export function googleStreetViewUrl(target: LngLat): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${target.lat},${target.lng}`;
}
