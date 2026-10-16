/** Geometry helpers for FloatingWindow — clamp + inflate from a resize edge. */

export type FloatRect = { x: number; y: number; w: number; h: number };

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * Keep the window on-screen. `overhang` lets a few pixels hang past an edge
 * so video panels can sit flush against the desk edge.
 */
export function clampRect(
  r: FloatRect,
  viewport: { w: number; h: number },
  minW: number,
  minH: number,
  overhang = 0,
): FloatRect {
  const w = Math.min(Math.max(minW, r.w), Math.max(minW, viewport.w + overhang * 2));
  const h = Math.min(Math.max(minH, r.h), Math.max(minH, viewport.h + overhang * 2));
  const x = Math.min(Math.max(-overhang, r.x), Math.max(-overhang, viewport.w - w + overhang)) || 0;
  const y = Math.min(Math.max(-overhang, r.y), Math.max(-overhang, viewport.h - h + overhang)) || 0;
  return { x, y, w, h };
}

/** Apply a pointer delta to a rect from a given resize edge. */
export function resizeRect(
  origin: FloatRect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  minW: number,
  minH: number,
  /** When set (e.g. 16/9), lock height to width / ratio. */
  aspectRatio?: number,
): FloatRect {
  let { x, y, w, h } = origin;
  if (aspectRatio && aspectRatio > 0) {
    // Drive size from the dominant axis of the drag so corners feel natural.
    const fromX = edge.includes('e') || edge.includes('w');
    const fromY = edge.includes('n') || edge.includes('s');
    if (fromX && !fromY) {
      if (edge.includes('e')) w = Math.max(minW, origin.w + dx);
      if (edge.includes('w')) {
        w = Math.max(minW, origin.w - dx);
        x = origin.x + (origin.w - w);
      }
      h = Math.max(minH, Math.round(w / aspectRatio));
    } else if (fromY && !fromX) {
      if (edge.includes('s')) h = Math.max(minH, origin.h + dy);
      if (edge.includes('n')) {
        h = Math.max(minH, origin.h - dy);
        y = origin.y + (origin.h - h);
      }
      w = Math.max(minW, Math.round(h * aspectRatio));
    } else if (Math.abs(dx) >= Math.abs(dy)) {
      if (edge.includes('e')) w = Math.max(minW, origin.w + dx);
      if (edge.includes('w')) {
        w = Math.max(minW, origin.w - dx);
        x = origin.x + (origin.w - w);
      }
      h = Math.max(minH, Math.round(w / aspectRatio));
      if (edge.includes('n')) y = origin.y + (origin.h - h);
    } else {
      if (edge.includes('s')) h = Math.max(minH, origin.h + dy);
      if (edge.includes('n')) {
        h = Math.max(minH, origin.h - dy);
        y = origin.y + (origin.h - h);
      }
      w = Math.max(minW, Math.round(h * aspectRatio));
      if (edge.includes('w')) x = origin.x + (origin.w - w);
    }
    return { x, y, w, h };
  }
  if (edge.includes('e')) w = Math.max(minW, origin.w + dx);
  if (edge.includes('s')) h = Math.max(minH, origin.h + dy);
  if (edge.includes('w')) {
    w = Math.max(minW, origin.w - dx);
    x = origin.x + (origin.w - w);
  }
  if (edge.includes('n')) {
    h = Math.max(minH, origin.h - dy);
    y = origin.y + (origin.h - h);
  }
  return { x, y, w, h };
}

/** Default 16:9 placement for the ISS live feed — compact, near a screen edge. */
export function defaultSpaceCamRect(
  viewport?: { w: number; h: number },
): FloatRect {
  const vp = viewport ?? (typeof window !== 'undefined'
    ? { w: window.innerWidth, h: window.innerHeight }
    : { w: 1280, h: 800 });
  const w = Math.min(560, Math.max(320, Math.round(vp.w * 0.36)));
  const h = Math.round((w * 9) / 16);
  return {
    x: Math.max(8, 72),
    y: Math.max(8, vp.h - h - 16),
    w,
    h,
  };
}

export function readStoredRect(key: string | undefined): FloatRect | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`osiris-float:${key}`);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<FloatRect>;
    if (![j.x, j.y, j.w, j.h].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return { x: j.x!, y: j.y!, w: j.w!, h: j.h! };
  } catch {
    return null;
  }
}

export function writeStoredRect(key: string | undefined, r: FloatRect): void {
  if (!key || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`osiris-float:${key}`, JSON.stringify(r));
  } catch {
    /* quota / private mode */
  }
}

/** Default placement for right-rail tool panels (desktop). */
export function defaultRightRailRect(
  w = 320,
  h = 520,
  viewport?: { w: number; h: number },
): FloatRect {
  const vp = viewport ?? (typeof window !== 'undefined'
    ? { w: window.innerWidth, h: window.innerHeight }
    : { w: 1280, h: 800 });
  return {
    x: Math.max(24, vp.w - w - 64),
    y: Math.max(72, Math.round(vp.h * 0.16)),
    w,
    h,
  };
}
