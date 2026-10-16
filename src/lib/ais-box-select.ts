export const AIS_GROUP_SELECT_CAP = 25;

export type ScreenRect = { x1: number; y1: number; x2: number; y2: number };

/** Normalize so left≤right, top≤bottom. */
export function normalizeScreenRect(r: ScreenRect): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  return {
    left: Math.min(r.x1, r.x2),
    top: Math.min(r.y1, r.y2),
    right: Math.max(r.x1, r.x2),
    bottom: Math.max(r.y1, r.y2),
  };
}

export function pointInScreenRect(
  x: number,
  y: number,
  r: ReturnType<typeof normalizeScreenRect>,
): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/** Min drag distance (px) before treating as a box (avoid Shift+click). */
export const AIS_BOX_MIN_PX = 8;

export function isMeaningfulBox(r: ScreenRect, minPx: number = AIS_BOX_MIN_PX): boolean {
  const n = normalizeScreenRect(r);
  return n.right - n.left >= minPx && n.bottom - n.top >= minPx;
}

export type AisPick = { mmsi: string; label: string };

/** From MapLibre feature-like props; mmsi digits only. */
export function pickFromShipProps(props: Record<string, unknown> | null | undefined): AisPick | null {
  if (!props) return null;
  const mmsi = String(props.mmsi ?? '').replace(/\D/g, '');
  if (!mmsi) return null;
  const label = String(props.name ?? props.label ?? mmsi) || mmsi;
  return { mmsi, label };
}

/** Dedupe by mmsi, preserve order, slice to cap. */
export function capAisPicks(picks: AisPick[], cap: number = AIS_GROUP_SELECT_CAP): AisPick[] {
  const seen = new Set<string>();
  const out: AisPick[] = [];
  for (const p of picks) {
    if (!p.mmsi || seen.has(p.mmsi)) continue;
    seen.add(p.mmsi);
    out.push(p);
    if (out.length >= cap) break;
  }
  return out;
}
