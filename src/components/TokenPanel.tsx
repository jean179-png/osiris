'use client';

import { useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import FloatingWindow from '@/components/FloatingWindow';

export default function TokenPanel() {
  const [isOpen, setIsOpen] = useState(false);

  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 800;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="pointer-events-auto glass-panel px-3 py-1.5 flex items-center gap-2 text-[9px] font-mono tracking-widest hover:opacity-80 transition-opacity border-[#14F195]/40 bg-[#14F195]/10 ml-3 shadow-[0_0_10px_rgba(20,241,149,0.1)]"
      >
        <TrendingUp className="w-3 h-3 text-[#14F195]" />
        <span className="text-[#14F195] font-bold">$OSIRIS</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <FloatingWindow
            storageKey="token-panel"
            aria-label="$OSIRIS live chart"
            zIndex={1010}
            minWidth={360}
            minHeight={320}
            defaultRect={{
              x: Math.max(16, Math.round(vpW * 0.1)),
              y: Math.max(16, Math.round(vpH * 0.08)),
              w: Math.min(960, Math.round(vpW * 0.8)),
              h: Math.min(720, Math.round(vpH * 0.78)),
            }}
            className="border border-[var(--border-primary)] bg-[#0A0A0A] shadow-2xl"
          >
            <div data-drag-handle className="flex cursor-grab items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] bg-black/40 shrink-0 active:cursor-grabbing">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-[#14F195]" />
                <h2 className="text-xs font-mono font-bold text-white tracking-widest uppercase">$OSIRIS LIVE CHART</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-4 h-4 text-[var(--text-muted)] hover:text-white" />
              </button>
            </div>
            <div className="relative flex-1 min-h-0 w-full">
              <iframe
                src="https://dexscreener.com/solana/G3rchnZ2WLsBDZSrVME4fTyzFP57F3yvvqWMxAy2b4ce?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"
                className="absolute inset-0 w-full h-full border-0"
                allow="clipboard-write"
              />
            </div>
          </FloatingWindow>
        </>
      )}
    </>
  );
}
