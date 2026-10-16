'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Radio, Maximize2, X, Crosshair } from 'lucide-react';
import FloatingWindow from '@/components/FloatingWindow';
import { ISS_FOLLOW_STREAM_LAG_MS, clampIssStreamLagMs } from '@/lib/iss-follow';

export interface SpaceCamProps {
  /** MAP SYNC — lock the globe to the active ISS camera view. */
  mapSync?: boolean;
  onMapSyncChange?: (on: boolean) => void;
  /** Active feed id (`sen-4k` | `iss-earth` | `iss-overview`) for MAP SYNC framing. */
  onFeedChange?: (feedId: string) => void;
  /** YouTube/Sen stream lag behind TLE-now (ms). */
  streamLagMs?: number;
  onStreamLagChange?: (ms: number) => void;
  /** Stamp live map pitch/zoom/lag as the ISS track default. */
  onSaveViewDefault?: () => void;
  /** Brief confirmation after a successful save. */
  viewSavedAt?: number | null;
  /** Fired when docked chrome visibility changes (for outer window frame). */
  onChromeVisibleChange?: (visible: boolean) => void;
}

/**
 * OSIRIS — LIVE FROM SPACE
 *
 * 24/7 downlink from cameras mounted outside the International Space Station.
 *
 * The feed list is deliberately short. Every candidate was checked against
 * three conditions, not one: the video must be OK (not UNPLAYABLE), it must be
 * live right now, and it must be embeddable. Eleven well-known "24/7 ISS"
 * streams were tested and only these three passed — the official NASA ISS
 * video ids are all UNPLAYABLE now, and several popular mirrors are live but
 * refuse embedding, which renders as an error box inside the panel rather than
 * as a missing feed. That is why the list is not longer.
 *
 * Sen leads because it is the camera operator rather than a mirror: those are
 * its own 4K cameras mounted on the ISS. The other two are re-broadcasts and
 * share a channel, so they are one failure away from going dark together.
 */

interface SpaceFeed {
  id: string;
  label: string;
  detail: string;
  videoId: string;
}

const FEEDS: SpaceFeed[] = [
  {
    id: 'sen-4k',
    label: '4K EARTH',
    detail: "Sen · 4K cameras mounted on the ISS",
    videoId: 'fO9e9jnhYK8',
  },
  {
    id: 'iss-earth',
    label: 'EARTH VIEW',
    detail: 'ISS external camera · nadir',
    videoId: 'tj4knR4r1UU',
  },
  {
    id: 'iss-overview',
    label: 'OVERVIEW CAM',
    detail: 'ISS overview camera · wide',
    videoId: 'OKQEMp2555A',
  },
];

// The ISS orbits at roughly 408 km and circles the planet about every 93
// minutes, which is the only "location" this camera has.
const ORBIT_ALT_KM = 408;

/** Idle before chrome fades — long enough to hit MAP SYNC / lag without fighting. */
const CHROME_IDLE_MS = 2800;

/**
 * YouTube picks its resolution from the *rendered size of the player*, not from
 * anything in the embed URL — the old `vq` and `hd` parameters are ignored. In
 * the 320px-wide rail this panel lives in, that means a 320x180 player and a
 * correctly-chosen 144p stream. Sen publishes up to 2160p, so the only way to
 * actually see it is to give the player a big viewport, which is what the
 * expanded view is for.
 *
 * The overlay is portalled to document.body: the tool rail is inside a
 * translated ancestor, and a transform makes position:fixed resolve against
 * that ancestor instead of the viewport, so rendering it in place would trap it
 * in the sidebar.
 */
function buildEmbedSrc(videoId: string, big: boolean): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    modestbranding: '1',
    rel: '0',
  });
  // Only meaningful in the expanded player; harmless in the docked one.
  if (big) params.set('vq', 'hd1080');
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function useAutoHideChrome(enabled: boolean, idleMs: number = CHROME_IDLE_MS) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimer();
    if (!enabled || pinned.current) return;
    timer.current = setTimeout(() => setVisible(false), idleMs);
  }, [clearTimer, enabled, idleMs]);

  const show = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const pin = useCallback((on: boolean) => {
    pinned.current = on;
    if (on) {
      clearTimer();
      setVisible(true);
    } else {
      scheduleHide();
    }
  }, [clearTimer, scheduleHide]);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setVisible(true);
      return;
    }
    scheduleHide();
    return clearTimer;
  }, [enabled, scheduleHide, clearTimer]);

  return { visible, show, pin, scheduleHide };
}

export default function SpaceCam({
  mapSync = false,
  onMapSyncChange,
  onFeedChange,
  streamLagMs = ISS_FOLLOW_STREAM_LAG_MS,
  onStreamLagChange,
  onSaveViewDefault,
  viewSavedAt = null,
  onChromeVisibleChange,
}: SpaceCamProps) {
  const [active, setActive] = useState(FEEDS[0]);
  const [expanded, setExpanded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const lagSec = Math.round(clampIssStreamLagMs(streamLagMs) / 1000);

  const dock = useAutoHideChrome(true);
  const expand = useAutoHideChrome(expanded);

  useEffect(() => {
    onChromeVisibleChange?.(dock.visible);
  }, [dock.visible, onChromeVisibleChange]);

  useEffect(() => {
    if (viewSavedAt == null) return;
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(t);
  }, [viewSavedAt]);

  useEffect(() => {
    onFeedChange?.(active.id);
  }, [active.id, onFeedChange]);

  // Escape closes the expanded view — it covers the whole map.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const chromeCls = (visible: boolean) =>
    `transition-opacity duration-300 ${
      visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`;

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col overflow-hidden bg-black transition-[border-radius,box-shadow] duration-300 ${
        dock.visible
          ? 'rounded-xl border border-[var(--border-primary)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
          : 'rounded-none border border-transparent shadow-none'
      }`}
      onPointerMove={dock.show}
      onPointerEnter={dock.show}
      onPointerLeave={() => dock.scheduleHide()}
    >
      {/* Video fills the frame; chrome draws on top and fades away. */}
      <div className="relative min-h-0 flex-1 bg-black">
        <iframe
          key={active.videoId}
          src={buildEmbedSrc(active.videoId, false)}
          title={`ISS live — ${active.label}`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
        {/* Cross-origin iframe eats pointer events — wake strip restores chrome. */}
        {!dock.visible && (
          <div
            className="absolute inset-0 z-[4]"
            onPointerMove={dock.show}
            onPointerEnter={dock.show}
            aria-hidden
          />
        )}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`absolute bottom-2 right-2 z-[2] px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono tracking-wider text-[#00E5FF] transition-opacity ${
            dock.visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          EXPAND FOR HD ↗
        </button>
      </div>

      <div
        data-drag-handle
        className={`absolute inset-x-0 top-0 z-[3] flex cursor-grab items-center gap-2 bg-gradient-to-b from-black/85 via-black/55 to-transparent px-3 pb-6 pt-2 active:cursor-grabbing ${chromeCls(dock.visible)}`}
      >
        <Radio className="h-3.5 w-3.5 text-[#00E5FF]" />
        <span className="text-[11px] font-mono font-bold tracking-widest text-[#00E5FF]">
          LIVE FROM SPACE
        </span>
        <span className="ml-auto flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3D3D]" />
          <span className="text-[9px] font-mono tracking-wider text-white/70">24/7</span>
        </span>
        <button
          type="button"
          onClick={() => onMapSyncChange?.(!mapSync)}
          title={mapSync ? 'Stop matching the map to the active ISS camera' : 'Match map to the active ISS camera (zoom stays yours after lock)'}
          aria-pressed={mapSync}
          className={`ml-1 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono tracking-wider transition-colors ${
            mapSync
              ? 'border-[#00E5FF]/50 bg-[#00E5FF]/15 text-[#00E5FF]'
              : 'border-transparent text-white/60 hover:bg-white/10 hover:text-[#00E5FF]'
          }`}
        >
          <Crosshair className="h-3 w-3" />
          MAP SYNC
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Expand — a bigger player is what makes YouTube serve HD"
          className="ml-1 rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-[#00E5FF]"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-t from-black/90 via-black/65 to-transparent px-2 pb-2 pt-8 ${chromeCls(dock.visible)}`}
        onPointerDown={() => dock.pin(true)}
        onPointerUp={() => dock.pin(false)}
      >
        {FEEDS.length > 1 && (
          <div className="mb-1.5 flex gap-1">
            {FEEDS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActive(f)}
                className={`flex-1 rounded border px-2 py-1.5 text-[9px] font-mono tracking-wider transition-colors ${
                  active.id === f.id
                    ? 'border-[#00E5FF]/40 bg-[#00E5FF]/15 text-[#00E5FF]'
                    : 'border-transparent text-white/55 hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="truncate text-[10px] font-mono text-white/80">{active.detail}</div>
            <div className="text-[9px] font-mono text-white/50">
              ALT ~{ORBIT_ALT_KM} KM · ORBIT ~93 MIN
            </div>
          </div>
          <a
            href={`https://www.youtube.com/watch?v=${active.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 rounded border border-white/20 px-2 py-1 text-[9px] font-mono text-white/60 transition-colors hover:border-[#00E5FF]/40 hover:text-[#00E5FF]"
          >
            SOURCE <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>

        {mapSync && (
          <div className="mt-2 flex flex-col gap-2 border-t border-white/10 px-1 pt-2">
            <label className="min-w-0" title="YouTube live trails TLE-now — trail the map so land matches the frame">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[9px] font-mono tracking-wider text-white/55">STREAM LAG</span>
                <span className="text-[9px] font-mono tabular-nums text-[#00E5FF]">{lagSec}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={120}
                step={5}
                value={lagSec}
                onChange={(e) => onStreamLagChange?.(clampIssStreamLagMs(Number(e.target.value) * 1000))}
                onPointerDown={() => dock.pin(true)}
                onPointerUp={() => dock.pin(false)}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#00E5FF]"
                aria-label="Stream lag seconds"
              />
            </label>
            <button
              type="button"
              onClick={() => onSaveViewDefault?.()}
              title="Save current tilt, zoom, and stream lag as the default for ISS MAP SYNC"
              className={`w-full rounded border px-2 py-1.5 text-[9px] font-mono tracking-wider transition-colors ${
                savedFlash
                  ? 'border-[#00E5FF]/60 bg-[#00E5FF]/20 text-[#00E5FF]'
                  : 'border-white/20 text-white/70 hover:border-[#00E5FF]/40 hover:text-[#00E5FF]'
              }`}
            >
              {savedFlash ? 'VIEW SAVED AS DEFAULT' : 'SAVE VIEW AS DEFAULT'}
            </button>
          </div>
        )}
      </div>

      {expanded && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[8990] bg-black/95 backdrop-blur-sm" onClick={() => setExpanded(false)} aria-hidden />
          <FloatingWindow
            storageKey="space-cam-expanded-16x9"
            aria-label="Live from Space expanded"
            zIndex={9000}
            minWidth={480}
            minHeight={270}
            aspectRatio={16 / 9}
            edgeOverhang={8}
            defaultRect={{
              x: Math.max(16, Math.round(window.innerWidth * 0.05)),
              y: Math.max(16, Math.round(window.innerHeight * 0.08)),
              w: Math.min(1280, Math.round(window.innerWidth * 0.72)),
              h: Math.round(Math.min(1280, Math.round(window.innerWidth * 0.72)) * 9 / 16),
            }}
            className={`overflow-hidden bg-black transition-[border-color,box-shadow] duration-300 ${
              expand.visible
                ? 'border border-[var(--border-primary)] shadow-2xl'
                : 'border border-transparent shadow-none'
            }`}
          >
            <div
              className="relative flex h-full min-h-0 flex-1 flex-col bg-black"
              onPointerMove={expand.show}
              onPointerEnter={expand.show}
              onPointerLeave={() => expand.scheduleHide()}
            >
              <div className="relative min-h-0 flex-1 bg-black">
                <iframe
                  key={`big-${active.videoId}`}
                  src={buildEmbedSrc(active.videoId, true)}
                  title={`ISS live expanded — ${active.label}`}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
                {!expand.visible && (
                  <div
                    className="absolute inset-0 z-[4]"
                    onPointerMove={expand.show}
                    onPointerEnter={expand.show}
                    aria-hidden
                  />
                )}
              </div>

              <div
                data-drag-handle
                className={`absolute inset-x-0 top-0 z-[3] flex cursor-grab items-center gap-2 bg-gradient-to-b from-black/90 via-black/55 to-transparent px-3 pb-8 pt-2 active:cursor-grabbing ${chromeCls(expand.visible)}`}
              >
                <Radio className="h-4 w-4 text-[#00E5FF]" />
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#00E5FF]">
                  LIVE FROM SPACE
                </span>
                <span className="truncate text-[11px] font-mono text-white/55">· {active.detail}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3D3D]" />
                  <span className="text-[10px] font-mono tracking-wider text-white/55">24/7</span>
                </span>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  title="Close (Esc)"
                  className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                className={`absolute inset-x-0 bottom-0 z-[3] flex items-center gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-2 pt-8 ${chromeCls(expand.visible)}`}
              >
                {FEEDS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActive(f)}
                    className={`rounded border px-3 py-1.5 text-[11px] font-mono tracking-wider transition-colors ${
                      active.id === f.id
                        ? 'border-[#00E5FF]/40 bg-[#00E5FF]/15 text-[#00E5FF]'
                        : 'border-white/10 text-white/55 hover:bg-white/10'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <span className="ml-auto text-[10px] font-mono text-white/45">
                  ALT ~{ORBIT_ALT_KM} KM · ORBIT ~93 MIN · ESC TO CLOSE
                </span>
              </div>
            </div>
          </FloatingWindow>
        </>,
        document.body,
      )}
    </div>
  );
}
