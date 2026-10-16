export type LeylinesMode = 'watkins' | 'grid' | 'both';

export function parseLeylinesMode(raw: string | null | undefined): LeylinesMode {
  if (raw === 'watkins' || raw === 'grid' || raw === 'both') return raw;
  return 'both';
}

export function showWatkins(mode: LeylinesMode): boolean {
  return mode === 'watkins' || mode === 'both';
}

export function showGrid(mode: LeylinesMode): boolean {
  return mode === 'grid' || mode === 'both';
}
