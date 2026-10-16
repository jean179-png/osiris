/**
 * Heine Golonka paleoshoreline catalog (Ma) — ages available as GeoJSON timesteps.
 */

export type PaleoCoastEntry = {
  ageMa: number;
  label: string;
  /** Raw GitHub path under the Heine repo (proxied by API). */
  file: string;
};

const BASE =
  'Golonka_Paleoshorelines/Golonka_Timesteps_geojson/Global_Paleoshorelines_Golonka_FROMAGE__';

/** All Golonka FROMAGE timesteps present in the Heine repo. */
export const PALEO_COAST_CATALOG: PaleoCoastEntry[] = [
  { ageMa: 12.8, label: '12.8 Ma', file: `${BASE}12.8.geojson` },
  { ageMa: 22.0, label: '22 Ma', file: `${BASE}22.0.geojson` },
  { ageMa: 30.2, label: '30.2 Ma', file: `${BASE}30.2.geojson` },
  { ageMa: 36.6, label: '36.6 Ma', file: `${BASE}36.6.geojson` },
  { ageMa: 48.5, label: '48.5 Ma', file: `${BASE}48.5.geojson` },
  { ageMa: 58.4, label: '58.4 Ma', file: `${BASE}58.4.geojson` },
  { ageMa: 83.8, label: '83.8 Ma', file: `${BASE}83.8.geojson` },
  { ageMa: 98.0, label: '98 Ma', file: `${BASE}98.0.geojson` },
  { ageMa: 123.0, label: '123 Ma', file: `${BASE}123.0.geojson` },
  { ageMa: 139.0, label: '139 Ma', file: `${BASE}139.0.geojson` },
  { ageMa: 147.8, label: '147.8 Ma', file: `${BASE}147.8.geojson` },
];

export const PALEO_COAST_RAW_BASE =
  'https://raw.githubusercontent.com/chhei/Heine_AJES_15_GlobalPaleoshorelines/master/';

export function paleoCoastAges(): number[] {
  return PALEO_COAST_CATALOG.map((e) => e.ageMa);
}

export function nearestPaleoAge(ages: number[], target: number): number {
  if (!ages.length) return target;
  let best = ages[0]!;
  let bestD = Math.abs(best - target);
  for (const a of ages) {
    const d = Math.abs(a - target);
    if (d < bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

export function paleoCoastEntry(ageMa: number): PaleoCoastEntry | null {
  const ages = paleoCoastAges();
  const nearest = nearestPaleoAge(ages, ageMa);
  return PALEO_COAST_CATALOG.find((e) => e.ageMa === nearest) ?? null;
}

export function paleoCoastUpstreamUrl(ageMa: number): string | null {
  const e = paleoCoastEntry(ageMa);
  if (!e) return null;
  return PALEO_COAST_RAW_BASE + e.file;
}

export function paleoCoastAttribution(): string {
  return (
    'Paleoshorelines © Heine, Yeo & Müller 2015 (Golonka model) · ' +
    '<a href="https://github.com/chhei/Heine_AJES_15_GlobalPaleoshorelines">CC BY-NC-SA 4.0</a>'
  );
}
