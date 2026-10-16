'use client';

import { useState, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import FloatingWindow from '@/components/FloatingWindow';

const SHORTCUTS = [
  { key: 'F', desc: 'Toggle fullscreen' },
  { key: 'S', desc: 'Share current view' },
  { key: 'L', desc: 'Toggle layer panel' },
  { key: 'M', desc: 'Toggle markets panel' },
  { key: 'O', desc: 'Ask OI' },
  { key: 'I', desc: 'Toggle intel feed' },
  { key: 'R', desc: 'Reset to global view' },
  { key: '?', desc: 'Show this help' },
  { key: 'ESC', desc: 'Close panels / popups' },
];

export default function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) setIsOpen(p => !p);
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!isOpen) return null;

  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 800;

  return (
    <>
      <div
        className="fixed inset-0 z-[500] bg-[var(--bg-void)]/80 backdrop-blur-sm pointer-events-auto"
        onClick={() => setIsOpen(false)}
        aria-hidden
      />
      <FloatingWindow
        storageKey="keyboard-shortcuts"
        aria-label="Keyboard shortcuts"
        zIndex={510}
        minWidth={280}
        minHeight={280}
        defaultRect={{ x: Math.round(vpW / 2 - 160), y: Math.round(vpH / 2 - 200), w: 320, h: 400 }}
        className="glass-panel osiris-glow p-0"
      >
        <div data-drag-handle className="flex cursor-grab items-center justify-between px-6 pt-6 pb-2 active:cursor-grabbing">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[var(--gold-primary)]" />
            <span className="text-sm font-mono font-bold text-[var(--text-heading)] tracking-wider">SHORTCUTS</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 px-6 pb-4 overflow-y-auto styled-scrollbar flex-1 min-h-0">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[var(--text-secondary)]">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded text-[9px] font-mono font-bold text-[var(--gold-primary)] bg-[var(--bg-void)] border border-[var(--border-primary)]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <div className="px-6 pb-6 text-center text-[9px] font-mono text-[var(--text-muted)] tracking-widest shrink-0">
          PRESS [?] OR [ESC] TO CLOSE
        </div>
      </FloatingWindow>
    </>
  );
}
