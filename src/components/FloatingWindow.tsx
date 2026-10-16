'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  clampRect,
  readStoredRect,
  resizeRect,
  writeStoredRect,
  type FloatRect,
  type ResizeEdge,
} from '@/lib/floating-window';

export interface FloatingWindowProps {
  children: ReactNode;
  /** Persist position/size under this key. */
  storageKey?: string;
  className?: string;
  style?: CSSProperties;
  /** Initial geometry when nothing is stored. */
  defaultRect?: Partial<FloatRect>;
  minWidth?: number;
  minHeight?: number;
  zIndex?: number;
  /**
   * CSS selector for the drag handle inside children (default: [data-drag-handle]).
   * Falls back to dragging the top 28px of the window if no handle matches.
   */
  dragHandle?: string;
  /** When false, only resize (no drag). */
  draggable?: boolean;
  /** When false, only drag (no resize). */
  resizable?: boolean;
  /** Lock resize to this width/height ratio (e.g. 16/9 for video). */
  aspectRatio?: number;
  /** Pixels the window may hang past a screen edge (flush placement). */
  edgeOverhang?: number;
  role?: string;
  'aria-label'?: string;
}

const EDGES: { edge: ResizeEdge; className: string; cursor: string }[] = [
  { edge: 'n', className: 'left-2 right-2 top-0 h-1.5', cursor: 'ns-resize' },
  { edge: 's', className: 'left-2 right-2 bottom-0 h-1.5', cursor: 'ns-resize' },
  { edge: 'e', className: 'top-2 bottom-2 right-0 w-1.5', cursor: 'ew-resize' },
  { edge: 'w', className: 'top-2 bottom-2 left-0 w-1.5', cursor: 'ew-resize' },
  { edge: 'ne', className: 'right-0 top-0 h-3 w-3', cursor: 'nesw-resize' },
  { edge: 'nw', className: 'left-0 top-0 h-3 w-3', cursor: 'nwse-resize' },
  { edge: 'se', className: 'right-0 bottom-0 h-3 w-3', cursor: 'nwse-resize' },
  { edge: 'sw', className: 'left-0 bottom-0 h-3 w-3', cursor: 'nesw-resize' },
];

function viewportSize() {
  if (typeof window === 'undefined') return { w: 1280, h: 800 };
  return { w: window.innerWidth, h: window.innerHeight };
}

function initialRect(
  storageKey: string | undefined,
  defaults: Partial<FloatRect> | undefined,
  minW: number,
  minH: number,
  overhang = 0,
  aspectRatio?: number,
): FloatRect {
  const vp = viewportSize();
  const stored = readStoredRect(storageKey);
  let base: FloatRect = {
    x: defaults?.x ?? Math.max(24, Math.round(vp.w * 0.08)),
    y: defaults?.y ?? Math.max(24, Math.round(vp.h * 0.1)),
    w: defaults?.w ?? Math.min(420, Math.round(vp.w * 0.36)),
    h: defaults?.h ?? Math.min(520, Math.round(vp.h * 0.55)),
  };
  if (stored) base = stored;
  if (aspectRatio && aspectRatio > 0) {
    base = { ...base, h: Math.max(minH, Math.round(base.w / aspectRatio)) };
  }
  return clampRect(base, vp, minW, minH, overhang);
}

/**
 * OSIRIS — draggable + resizable floating chrome for dialogs, tool panels, and OI panes.
 * Mark a child with `data-drag-handle` (or pass dragHandle) for the move affordance.
 */
export default function FloatingWindow({
  children,
  storageKey,
  className = '',
  style,
  defaultRect,
  minWidth = 260,
  minHeight = 160,
  zIndex = 400,
  dragHandle = '[data-drag-handle]',
  draggable = true,
  resizable = true,
  aspectRatio,
  edgeOverhang = 0,
  role = 'dialog',
  'aria-label': ariaLabel,
}: FloatingWindowProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<FloatRect>(() =>
    initialRect(storageKey, defaultRect, minWidth, minHeight, edgeOverhang, aspectRatio),
  );
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const persist = useCallback(
    (r: FloatRect) => {
      const next = clampRect(r, viewportSize(), minWidth, minHeight, edgeOverhang);
      setRect(next);
      writeStoredRect(storageKey, next);
    },
    [storageKey, minWidth, minHeight, edgeOverhang],
  );

  useEffect(() => {
    const onResize = () => persist(rectRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [persist]);

  const onDragPointerDown = (e: React.PointerEvent) => {
    if (!draggable || e.button !== 0) return;
    const t = e.target as HTMLElement | null;
    if (!t) return;
    if (t.closest('a, button, input, textarea, select, [data-no-drag]')) return;
    const root = rootRef.current;
    if (!root) return;
    const handle = t.closest(dragHandle);
    const inFallbackStrip = !handle && e.clientY - root.getBoundingClientRect().top <= 28;
    if (!handle && !inFallbackStrip) return;

    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...rectRef.current };
    const pid = e.pointerId;
    root.setPointerCapture(pid);

    const onMove = (ev: PointerEvent) => {
      persist({
        ...origin,
        x: origin.x + (ev.clientX - startX),
        y: origin.y + (ev.clientY - startY),
      });
    };
    const onUp = () => {
      root.releasePointerCapture(pid);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onResizePointerDown = (edge: ResizeEdge) => (e: React.PointerEvent) => {
    if (!resizable || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...rectRef.current };
    const pid = e.pointerId;
    root.setPointerCapture(pid);

    const onMove = (ev: PointerEvent) => {
      persist(
        resizeRect(
          origin,
          edge,
          ev.clientX - startX,
          ev.clientY - startY,
          minWidth,
          minHeight,
          aspectRatio,
        ),
      );
    };
    const onUp = () => {
      root.releasePointerCapture(pid);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const node = (
    <div
      ref={rootRef}
      role={role}
      aria-label={ariaLabel}
      className={`pointer-events-auto flex flex-col overflow-hidden ${className}`}
      style={{
        position: 'fixed',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex,
        touchAction: 'none',
        ...style,
      }}
      onPointerDown={onDragPointerDown}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      {resizable &&
        EDGES.map(({ edge, className: cn, cursor }) => (
          <div
            key={edge}
            role="presentation"
            aria-hidden
            data-no-drag
            className={`absolute z-10 ${cn}`}
            style={{ cursor }}
            onPointerDown={onResizePointerDown(edge)}
          />
        ))}
    </div>
  );

  /* Portal past framer-motion ancestors — their transforms break `position: fixed`. */
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
