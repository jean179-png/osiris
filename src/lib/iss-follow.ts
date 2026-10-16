/**
 * ISS map-sync helpers: ground-track bearing and follow camera defaults.
 *
 * Sen SpaceTV-1 has three cameras. MAP SYNC framing must match the active feed:
 *   - 4K EARTH (nadir): ~240×180 km straight down
 *   - EARTH VIEW / OVERVIEW: horizon / wide limb looks
 *
 * MapLibre pitch 0 = nadir (look straight down). Pitch ~75 = near horizon.
 * The old lock used pitch 75 for every feed and called it "nadir-ish" — that
 * was inverted, and FOV 68° was roughly 2× too wide for Sen's nadir scene.
 */

export const ISS_NORAD_ID = '25544';

/** @deprecated Prefer issFollowProfile(feedId).pitch — kept for tests/callers. */
export const ISS_FOLLOW_PITCH = 0;

/**
 * @deprecated Prefer profile fovDeg. Midpoint of the old constant; nadir uses ~33°.
 */
export const ISS_FOLLOW_CAMERA_FOV_DEG = 33;

/** Fallback when altitude is unknown — ~408 km station height. */
export const ISS_FOLLOW_ALT_KM = 408;

/** First-lock ease into the frame (then rAF jumpTo takes over). */
export const ISS_FOLLOW_LOCK_MS = 1200;

/** How often to refresh the TLE while MAP SYNC stays on. */
export const ISS_FOLLOW_TLE_REFRESH_MS = 10 * 60_000;

/**
 * YouTube / Sen “live” is not TLE-now. Embeds commonly trail 30–120s;
 * at ~7.7 km/s that is hundreds of km on the ground. MAP SYNC samples the
 * orbit this far in the past so land lines up with what the player is showing.
 * Operator can trim via SpaceCam. Default ~35s matches the tuned Sen embed.
 */
export const ISS_FOLLOW_STREAM_LAG_MS = 35_000;

/**
 * Factory MAP SYNC framing for Sen 4K EARTH / nadir:
 * pitch 0 = vertical down, zoom 7.5, lag 35s.
 */
export const ISS_FOLLOW_DEFAULT_VIEW = {
  pitch: 0,
  zoom: 7.5,
  lagMs: ISS_FOLLOW_STREAM_LAG_MS,
} as const;

const VIEW_PREFS_KEY = 'osiris-iss-follow-view-v2';

/** Operator lock framing for MAP SYNC — pitch/zoom/lag survive reloads. */
export interface IssFollowViewPrefs {
  pitch: number;
  zoom: number;
  lagMs: number;
  feedId?: string;
}

/** Clamp for the lag control (0 = true TLE now; max ~2 min of trail). */
export function clampIssStreamLagMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(120_000, Math.round(ms));
}

export function clampIssFollowPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return issFollowProfile('sen-4k').pitch;
  return Math.min(85, Math.max(0, pitch));
}

export function clampIssFollowZoom(zoom: number, feedId?: IssCamFeedId | null): number {
  const p = issFollowProfile(feedId);
  if (!Number.isFinite(zoom)) return (p.zoomMin + p.zoomMax) / 2;
  // Allow operator to go a bit outside the soft FOV band.
  return Math.min(p.zoomMax + 1.5, Math.max(Math.max(3, p.zoomMin - 1.5), zoom));
}

export function readIssFollowViewPrefs(): IssFollowViewPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VIEW_PREFS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<IssFollowViewPrefs>;
    if (typeof j.pitch !== 'number' || typeof j.zoom !== 'number') return null;
    return {
      pitch: clampIssFollowPitch(j.pitch),
      zoom: clampIssFollowZoom(j.zoom, j.feedId),
      lagMs: clampIssStreamLagMs(
        typeof j.lagMs === 'number' ? j.lagMs : ISS_FOLLOW_STREAM_LAG_MS,
      ),
      feedId: typeof j.feedId === 'string' ? j.feedId : undefined,
    };
  } catch {
    return null;
  }
}

/** Persist the operator’s current MAP SYNC framing as the default lock. */
export function writeIssFollowViewPrefs(partial: Partial<IssFollowViewPrefs>): IssFollowViewPrefs {
  const prev = readIssFollowViewPrefs();
  const feedId = partial.feedId ?? prev?.feedId ?? 'sen-4k';
  const factory =
    feedId === 'sen-4k' || feedId === undefined
      ? ISS_FOLLOW_DEFAULT_VIEW
      : {
          pitch: issFollowProfile(feedId).pitch,
          zoom: issFollowZoomForFrame(ISS_FOLLOW_ALT_KM, { feedId }),
          lagMs: ISS_FOLLOW_STREAM_LAG_MS,
        };
  const next: IssFollowViewPrefs = {
    pitch: clampIssFollowPitch(partial.pitch ?? prev?.pitch ?? factory.pitch),
    zoom: clampIssFollowZoom(partial.zoom ?? prev?.zoom ?? factory.zoom, feedId),
    lagMs: clampIssStreamLagMs(partial.lagMs ?? prev?.lagMs ?? factory.lagMs),
    feedId,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }
  return next;
}

/** Pitch/zoom/lag for the next lock — saved prefs win over feed profile. */
export function resolveIssFollowLockView(opts: {
  feedId?: IssCamFeedId | null;
  altKm?: number;
  latitude?: number;
  viewportCssWidth?: number;
  /** Live map values — used only to seed prefs when none are saved yet. */
  current?: { pitch?: number; zoom?: number; lagMs?: number };
}): { pitch: number; zoom: number; lagMs: number } {
  const existing = readIssFollowViewPrefs();
  if (!existing && opts.current) {
    const seeded = writeIssFollowViewPrefs({
      pitch: opts.current.pitch,
      zoom: opts.current.zoom,
      lagMs: opts.current.lagMs,
      feedId: opts.feedId ?? undefined,
    });
    return { pitch: seeded.pitch, zoom: seeded.zoom, lagMs: seeded.lagMs };
  }
  const saved = existing;
  const profile = issFollowProfile(opts.feedId);
  const useNadirFactory = !opts.feedId || opts.feedId === 'sen-4k';
  const zoom =
    saved?.zoom ??
    (useNadirFactory
      ? ISS_FOLLOW_DEFAULT_VIEW.zoom
      : issFollowZoomForFrame(opts.altKm ?? ISS_FOLLOW_ALT_KM, {
          feedId: opts.feedId,
          latitude: opts.latitude,
          viewportCssWidth: opts.viewportCssWidth,
        }));
  return {
    pitch: saved?.pitch ?? (useNadirFactory ? ISS_FOLLOW_DEFAULT_VIEW.pitch : profile.pitch),
    zoom,
    lagMs: saved?.lagMs ?? ISS_FOLLOW_DEFAULT_VIEW.lagMs,
  };
}

/** SpaceCam feed ids (see SpaceCam FEEDS). */
export type IssCamFeedId = 'sen-4k' | 'iss-earth' | 'iss-overview' | string;

export interface IssFollowProfile {
  /** MapLibre pitch: 0 = nadir. */
  pitch: number;
  /** Horizontal FOV used to pick first-lock zoom. */
  fovDeg: number;
  /** Soft zoom clamp [min, max] for that camera. */
  zoomMin: number;
  zoomMax: number;
  /** When true, rotate the map with the ground track (video “forward”). */
  trackUp: boolean;
}

const NADIR: IssFollowProfile = {
  // Sen nadir: pitch 0 = vertical down. Soft zoom band centered on the
  // operator-tuned default (7.5). Track-up keeps ground streaming with the video.
  pitch: ISS_FOLLOW_DEFAULT_VIEW.pitch,
  fovDeg: 33,
  zoomMin: 6.5,
  zoomMax: 8.5,
  trackUp: true,
};

const HORIZON: IssFollowProfile = {
  pitch: 68,
  fovDeg: 72,
  zoomMin: 6.2,
  zoomMax: 8.0,
  trackUp: true,
};

const OVERVIEW: IssFollowProfile = {
  pitch: 55,
  fovDeg: 85,
  zoomMin: 5.8,
  zoomMax: 7.6,
  trackUp: true,
};

/** Camera profile for the active SpaceCam feed. */
export function issFollowProfile(feedId?: IssCamFeedId | null): IssFollowProfile {
  switch (feedId) {
    case 'iss-earth':
      return HORIZON;
    case 'iss-overview':
      return OVERVIEW;
    case 'sen-4k':
    default:
      return NADIR;
  }
}

/**
 * MapLibre zoom whose viewport width ≈ the ground swath of an ISS camera.
 *
 * Web Mercator meters/pixel at z0 ≈ 156543; ground width ≈ 2 · h · tan(FOV/2).
 */
export function issFollowZoomForFrame(
  altKm: number = ISS_FOLLOW_ALT_KM,
  opts?: {
    fovDeg?: number;
    viewportCssWidth?: number;
    latitude?: number;
    zoomMin?: number;
    zoomMax?: number;
    feedId?: IssCamFeedId | null;
  },
): number {
  const profile = issFollowProfile(opts?.feedId);
  const fovDeg = opts?.fovDeg ?? profile.fovDeg;
  const viewportCssWidth = opts?.viewportCssWidth ?? 960;
  const lat = opts?.latitude ?? 0;
  const zoomMin = opts?.zoomMin ?? profile.zoomMin;
  const zoomMax = opts?.zoomMax ?? profile.zoomMax;
  const h = Number.isFinite(altKm) && altKm > 80 ? altKm : ISS_FOLLOW_ALT_KM;
  const half = ((fovDeg / 2) * Math.PI) / 180;
  const groundWidthM = 2 * h * 1000 * Math.tan(half);
  const mPerPxZ0 = 156543.03392 * Math.cos((lat * Math.PI) / 180);
  if (!(groundWidthM > 0) || !(mPerPxZ0 > 0)) return (zoomMin + zoomMax) / 2;
  const z = Math.log2((viewportCssWidth * mPerPxZ0) / groundWidthM);
  return Math.min(zoomMax, Math.max(zoomMin, Math.round(z * 10) / 10));
}

/** Nominal first-lock zoom for Sen nadir — operator-tuned default. */
export const ISS_FOLLOW_DEFAULT_ZOOM = ISS_FOLLOW_DEFAULT_VIEW.zoom;

/**
 * Initial bearing (degrees clockwise from north) of the great-circle from A→B.
 */
export function groundTrackBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

export interface IssFollowTarget {
  lat: number;
  lng: number;
  altKm: number;
  bearing: number;
}

/** Bearing from a short forward sample (default 20s along-track). */
export function issFollowFromPositions(
  now: { lat: number; lng: number; altKm: number },
  ahead: { lat: number; lng: number },
): IssFollowTarget {
  return {
    lat: now.lat,
    lng: now.lng,
    altKm: now.altKm,
    bearing: groundTrackBearing(now, ahead),
  };
}
