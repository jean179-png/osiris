'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigation, SkipBack, SkipForward } from 'lucide-react';
import {
  BoxShell,
  DAYS,
  IconButton,
  MONTHS,
  TextButton,
} from '@/components/TimeBox';

const STORE_OPEN = 'osiris.gpsjam.open';

type Props = {
  date: string;
  dates: string[];
  controls: boolean;
  onDate: (d: string) => void;
  onOff?: () => void;
  loading?: boolean;
};

function chipDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

/**
 * GPS Jam date box — pick a gpsjam.org daily CSV day (no play loop).
 */
export default function GpsJamBar({ date, dates, controls, onDate, onOff, loading }: Props) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORE_OPEN) !== '0';
    } catch {
      return true;
    }
  });
  const [tuning, setTuning] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_OPEN, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open]);

  const idx = useMemo(() => Math.max(0, dates.indexOf(date)), [dates, date]);
  const latest = dates.length ? dates[dates.length - 1]! : null;
  const atLatest = !!latest && date === latest;
  const canPrev = idx > 0;
  const canNext = idx >= 0 && idx < dates.length - 1;

  const step = useCallback(
    (dir: -1 | 1) => {
      const next = dates[idx + dir];
      if (next) onDate(next);
    },
    [dates, idx, onDate],
  );

  if (!controls) return null;

  return (
    <BoxShell
      icon={Navigation}
      title="GPS Jam"
      source="GPSJAM.ORG"
      open={open}
      playing={false}
      tuning={tuning}
      tuneLabel="Legend"
      onOpen={() => setOpen(true)}
      onFold={() => {
        setTuning(false);
        setOpen(false);
      }}
      onTune={() => setTuning((o) => !o)}
      onOff={onOff}
      chip={
        <>
          <span className="text-[10.5px] font-semibold tracking-wider text-[var(--gold-light)] tabular-nums">
            {date || '—'}
          </span>
          {atLatest && (
            <span className="text-[9px] tracking-wider text-[var(--gold-light)]">LATEST</span>
          )}
        </>
      }
      tune={
        <div className="flex flex-col gap-1.5 text-[9px] tracking-[0.14em] text-white/45">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#e6c200]/60" />
            <span>MEDIUM · 2–10% BAD NAV</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#e02020]/70" />
            <span>HIGH · &gt;10% BAD NAV</span>
          </div>
          <p className="text-white/30 leading-relaxed pt-1">
            ADS-B accuracy aggregates from gpsjam.org. Not proof of jamming.
          </p>
        </div>
      }
    >
      <div className="min-h-[34px]">
        <div className="text-[13px] leading-tight font-semibold tracking-wider text-[var(--gold-light)] tabular-nums">
          {date ? chipDate(date) : 'NO DATE'}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap text-[9px] tracking-[0.14em] tabular-nums">
          <span className="text-white/35">{date || '—'}</span>
          <span className={atLatest ? 'text-[var(--gold-light)]' : 'text-white/55'}>
            {atLatest ? 'LATEST DAY' : 'HISTORICAL'}
          </span>
          {loading && <span className="text-white/35 animate-pulse">LOADING</span>}
        </div>
      </div>

      <div className="mt-1 flex items-center gap-0.5">
        <IconButton label="Previous day" onClick={() => step(-1)} disabled={!canPrev}>
          <SkipBack className="w-3.5 h-3.5" strokeWidth={1.6} />
        </IconButton>
        <IconButton label="Next day" onClick={() => step(1)} disabled={!canNext}>
          <SkipForward className="w-3.5 h-3.5" strokeWidth={1.6} />
        </IconButton>
        <div className="ml-auto flex items-center gap-0.5">
          {!atLatest && latest && (
            <TextButton onClick={() => onDate(latest)}>LATEST</TextButton>
          )}
        </div>
      </div>
    </BoxShell>
  );
}
