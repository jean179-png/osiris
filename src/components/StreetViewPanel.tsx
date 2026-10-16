'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import FloatingWindow from '@/components/FloatingWindow';
import 'mapillary-js/dist/mapillary.css';

export type StreetViewLookAt = { lat: number; lng: number };

type NearestOk = {
  ok: true;
  image: { id: string; lng: number; lat: number; compassAngle: number };
  lookAt: StreetViewLookAt;
  yawTowardLookAt: number;
};

type NearestMiss = {
  ok: false;
  lookAt: StreetViewLookAt;
  googleUrl: string;
  error?: string;
};

type NearestResult = NearestOk | NearestMiss;

interface StreetViewPanelProps {
  lookAt: StreetViewLookAt | null;
  onClose: () => void;
  /** Optional: notify map of chosen image pose for pin→image line. */
  onResolved?: (result: NearestResult | null) => void;
}

export default function StreetViewPanel({ lookAt, onClose, onResolved }: StreetViewPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NearestResult | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!lookAt) {
      setResult(null);
      onResolved?.(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setResult(null);
    fetch(`/api/mapillary/nearest?lat=${encodeURIComponent(String(lookAt.lat))}&lng=${encodeURIComponent(String(lookAt.lng))}`)
      .then(async (r) => {
        const body = (await r.json()) as NearestResult & { error?: string };
        if (cancelled) return;
        setResult(body);
        onResolved?.(body);
      })
      .catch(() => {
        if (cancelled) return;
        const miss: NearestMiss = {
          ok: false,
          lookAt,
          googleUrl: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lookAt.lat},${lookAt.lng}`,
          error: 'request failed',
        };
        setResult(miss);
        onResolved?.(miss);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lookAt?.lat, lookAt?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    viewerRef.current?.remove();
    viewerRef.current = null;
    if (!result || !result.ok || !mountRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN;
    if (!token) return;

    let cancelled = false;
    void import('mapillary-js').then(({ Viewer }) => {
      if (cancelled || !mountRef.current) return;
      mountRef.current.innerHTML = '';
      const viewer = new Viewer({
        accessToken: token,
        container: mountRef.current,
        imageId: result.image.id,
        component: { cover: false },
      });
      viewerRef.current = viewer;
    }).catch(() => {
      /* embed fallback renders below */
    });

    return () => {
      cancelled = true;
      viewerRef.current?.remove();
      viewerRef.current = null;
    };
  }, [result]);

  if (!lookAt) return null;

  const clientToken = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN;
  const useEmbed = result?.ok && !clientToken;
  const googleFallback =
    result && !result.ok
      ? result.googleUrl
      : `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lookAt.lat},${lookAt.lng}`;

  return (
    <FloatingWindow
      storageKey="street-view"
      aria-label="Street view"
      defaultRect={{ x: 72, y: 96, w: 440, h: 360 }}
      minWidth={320}
      minHeight={240}
      zIndex={60}
    >
      <div className="flex h-full flex-col bg-[#0c0e1a] text-[#E8E6E0] border border-teal-500/30 rounded-md overflow-hidden">
        <div
          data-drag-handle
          className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 cursor-move select-none"
        >
          <div className="text-[10px] font-semibold tracking-[0.14em] text-teal-300">STREET VIEW · MAPILLARY</div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-[#8A8880]"
            aria-label="Close street view"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-3 py-1.5 text-[9px] text-[#5C5A54] font-mono">
          {lookAt.lat.toFixed(5)}°, {lookAt.lng.toFixed(5)}°
        </div>
        <div className="relative flex-1 min-h-0 bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] tracking-widest text-[#5C5A54]">
              FINDING IN-VIEW IMAGE…
            </div>
          )}
          {!loading && result?.ok && clientToken && (
            <div ref={mountRef} className="absolute inset-0" />
          )}
          {!loading && useEmbed && (
            <iframe
              title="Mapillary"
              src={`https://www.mapillary.com/embed?image_key=${encodeURIComponent(result.image.id)}&style=photo`}
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
            />
          )}
          {!loading && result && !result.ok && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="text-[11px] text-[#8A8880]">
                {result.error === 'MAPILLARY_ACCESS_TOKEN not configured'
                  ? 'Mapillary token not configured.'
                  : 'No Mapillary coverage in view here.'}
              </div>
              <a
                href={googleFallback}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] tracking-wider text-teal-300 border border-teal-500/40 px-3 py-1.5 rounded hover:bg-teal-500/10"
              >
                Open Google Street View <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
        {result?.ok && (
          <div className="px-3 py-1.5 text-[8px] text-[#5C5A54] border-t border-white/5 flex justify-between gap-2">
            <span>© Mapillary contributors</span>
            <a
              href={googleFallback}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-500/80 hover:underline"
            >
              Google fallback
            </a>
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
