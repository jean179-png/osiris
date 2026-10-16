'use client';

import { useEffect, useState } from 'react';
import { Waves, SkipBack, SkipForward } from 'lucide-react';
import {
  BoxShell,
  Choice,
  IconButton,
  TextButton,
} from '@/components/TimeBox';
import {
  PALEO_M_MAX,
  PALEO_M_MIN,
  PALEO_PRESETS,
  formatSeaLevelMeters,
  type PaleoMode,
} from '@/lib/paleo-sea-level';

const STORE_OPEN = 'osiris.paleo.open';

type Props = {
  mode: PaleoMode;
  meters: number;
  ageMa: number;
  ages: number[];
  controls: boolean;
  loading?: boolean;
  onMode: (m: PaleoMode) => void;
  onMeters: (m: number) => void;
  onAgeMa: (a: number) => void;
  onOff?: () => void;
};

export default function PaleoBar({
  mode,
  meters,
  ageMa,
  ages,
  controls,
  loading,
  onMode,
  onMeters,
  onAgeMa,
  onOff,
}: Props) {
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

  if (!controls) return null;

  const ageIdx = Math.max(0, ages.indexOf(ageMa));
  const chip =
    mode === 'meters' ? formatSeaLevelMeters(meters) : `${ageMa} Ma`;

  return (
    <BoxShell
      icon={Waves}
      title="Paleo / SL"
      source={mode === 'meters' ? 'TERRARIUM' : 'HEINE'}
      open={open}
      playing={false}
      tuning={tuning}
      tuneLabel="About"
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
            {chip}
          </span>
          {loading && (
            <span className="text-[9px] tracking-wider text-white/35 animate-pulse">…</span>
          )}
        </>
      }
      tune={
        <p className="text-[9px] tracking-[0.12em] text-white/40 leading-relaxed">
          Meters: simple DEM flood (−120 LGM → +70 all ice). Ma: Heine Golonka paleocoasts
          (CC BY-NC-SA). Not ice-sheet physics.
        </p>
      }
    >
      <div className="min-h-[34px]">
        <div className="text-[13px] leading-tight font-semibold tracking-wider text-[var(--gold-light)] tabular-nums">
          {mode === 'meters' ? formatSeaLevelMeters(meters) : `${ageMa} Ma`}
        </div>
        <div className="mt-0.5 text-[9px] tracking-[0.14em] text-white/45">
          {mode === 'meters' ? 'RELATIVE SEA LEVEL' : 'PALEOCOAST AGE'}
          {loading ? ' · LOADING' : ''}
        </div>
      </div>

      <div className="mt-2">
        <Choice
          label="Mode"
          value={mode}
          options={[
            { value: 'meters', label: 'METERS' },
            { value: 'ma', label: 'MA' },
          ]}
          onChange={(v) => onMode(v as PaleoMode)}
        />
      </div>

      {mode === 'meters' ? (
        <>
          <input
            type="range"
            min={PALEO_M_MIN}
            max={PALEO_M_MAX}
            step={1}
            value={meters}
            onChange={(e) => onMeters(Number(e.target.value))}
            aria-label="Sea level meters"
            className="mt-2 w-full accent-[var(--gold-primary)]"
          />
          <div className="mt-1 flex items-center gap-0.5 flex-wrap">
            {PALEO_PRESETS.map((p) => (
              <TextButton key={p.id} onClick={() => onMeters(p.meters)}>
                {p.label.toUpperCase()}
              </TextButton>
            ))}
          </div>
        </>
      ) : (
        <>
          <input
            type="range"
            min={0}
            max={Math.max(0, ages.length - 1)}
            step={1}
            value={ageIdx}
            onChange={(e) => {
              const a = ages[Number(e.target.value)];
              if (a != null) onAgeMa(a);
            }}
            aria-label="Paleocoast age"
            className="mt-2 w-full accent-[var(--gold-primary)]"
            disabled={!ages.length}
          />
          <div className="mt-1 flex items-center gap-0.5">
            <IconButton
              label="Younger"
              onClick={() => {
                if (ageIdx > 0) onAgeMa(ages[ageIdx - 1]!);
              }}
              disabled={ageIdx <= 0}
            >
              <SkipBack className="w-3.5 h-3.5" strokeWidth={1.6} />
            </IconButton>
            <IconButton
              label="Older"
              onClick={() => {
                if (ageIdx < ages.length - 1) onAgeMa(ages[ageIdx + 1]!);
              }}
              disabled={ageIdx >= ages.length - 1}
            >
              <SkipForward className="w-3.5 h-3.5" strokeWidth={1.6} />
            </IconButton>
          </div>
        </>
      )}
    </BoxShell>
  );
}
