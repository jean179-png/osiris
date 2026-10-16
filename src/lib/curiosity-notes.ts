/**
 * OSIRIS — investigator notes on Curiosities Atlas pins.
 *
 * The Drive KML has no names. Notes live in this browser so a session of
 * field work survives a refresh. Keyed by the stable pin index `i` from
 * curiosities.bin (float32 order).
 */

export interface CuriosityNote {
  /** Pin index in curiosities.bin */
  i: number;
  lat: number;
  lng: number;
  /** Short map label */
  label: string;
  /** Free-form investigation notes */
  notes: string;
  updatedAt: number;
}

export const CURIOSITY_NOTES_KEY = 'osiris.curiosities.notes.v1';

type Store = Record<string, CuriosityNote>;

function keyOf(i: number): string {
  return String(i);
}

function storage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

function parseStore(parsed: unknown): Store {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Store = {};
  for (const [k, v] of Object.entries(parsed as Store)) {
    if (!v || typeof v !== 'object') continue;
    if (!Number.isFinite(v.i) || !Number.isFinite(v.lat) || !Number.isFinite(v.lng)) continue;
    out[k] = {
      i: v.i,
      lat: v.lat,
      lng: v.lng,
      label: typeof v.label === 'string' ? v.label : '',
      notes: typeof v.notes === 'string' ? v.notes : '',
      updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
    };
  }
  return out;
}

export function loadCuriosityNotes(): Store {
  const ls = storage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(CURIOSITY_NOTES_KEY);
    if (!raw) return {};
    return parseStore(JSON.parse(raw));
  } catch {
    return {};
  }
}

export interface CuriositySeedNote {
  i: number;
  lat: number;
  lng: number;
  label: string;
  notes: string;
}

/**
 * Apply the shared seed catalog. Never overwrites a pin the user edited
 * (updatedAt > 0) or cleared (tombstone). Re-applies catalog text when the
 * existing entry is still a seed stub (updatedAt === 0). Drops seed stubs
 * that are no longer in the catalog (e.g. after tightening match radius).
 */
export function mergeCuriositySeed(
  store: Store,
  seed: CuriositySeedNote[],
): Store {
  const seedByI = new Map<number, CuriositySeedNote>();
  for (const s of seed) {
    if (!Number.isFinite(s.i) || !Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
    const label = typeof s.label === 'string' ? s.label.trim() : '';
    const notes = typeof s.notes === 'string' ? s.notes.trim() : '';
    if (!label && !notes) continue;
    seedByI.set(s.i, { ...s, label, notes });
  }

  let next: Store | null = null;
  const ensure = (): Store => {
    if (!next) next = { ...store };
    return next;
  };

  // Remove obsolete seed stubs (not user edits / tombstones).
  for (const [k, existing] of Object.entries(store)) {
    if (existing.updatedAt !== 0) continue;
    if (seedByI.has(existing.i)) continue;
    delete ensure()[k];
  }

  for (const s of seedByI.values()) {
    const k = keyOf(s.i);
    const existing = (next ?? store)[k];
    // User edit or clear tombstone — leave alone.
    if (existing && existing.updatedAt > 0) continue;
    if (
      existing &&
      existing.updatedAt === 0 &&
      existing.label === s.label &&
      existing.notes === s.notes
    ) {
      continue;
    }
    ensure()[k] = {
      i: s.i,
      lat: s.lat,
      lng: s.lng,
      label: s.label,
      notes: s.notes,
      updatedAt: 0, // seed marker — user edits get Date.now()
    };
  }
  return next ?? store;
}

/** Fetch `/data/curiosity-notes-seed.json` and merge under local notes. */
export async function loadCuriosityNotesWithSeed(
  seedUrl = '/data/curiosity-notes-seed.json',
): Promise<Store> {
  const local = loadCuriosityNotes();
  try {
    const r = await fetch(seedUrl);
    if (!r.ok) return local;
    const body = (await r.json()) as { notes?: CuriositySeedNote[] };
    const notes = Array.isArray(body?.notes) ? body.notes : [];
    return mergeCuriositySeed(local, notes);
  } catch {
    return local;
  }
}

export function saveCuriosityNotes(store: Store): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(CURIOSITY_NOTES_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function getCuriosityNote(store: Store, i: number): CuriosityNote | null {
  return store[keyOf(i)] ?? null;
}

/**
 * Upsert a note. Empty label+notes writes a tombstone so a cleared seed
 * pin is not re-filled from the catalog on the next load.
 */
export function upsertCuriosityNote(
  store: Store,
  input: { i: number; lat: number; lng: number; label: string; notes: string },
): Store {
  const next = { ...store };
  const label = input.label.trim();
  const notes = input.notes.trim();
  const k = keyOf(input.i);
  next[k] = {
    i: input.i,
    lat: input.lat,
    lng: input.lng,
    label,
    notes,
    updatedAt: Date.now(),
  };
  return next;
}

export function listCuriosityNotes(store: Store): CuriosityNote[] {
  return Object.values(store)
    .filter((n) => n.label.trim() || n.notes.trim())
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Annotated pins as a FeatureCollection for the notes overlay source. */
export function notesToGeoJSON(store: Store): GeoJSON.FeatureCollection {
  const features = listCuriosityNotes(store).map((n) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [n.lng, n.lat] as [number, number] },
    properties: {
      i: n.i,
      label: n.label || 'Noted',
      notes: n.notes,
      has_note: true,
    },
  }));
  return { type: 'FeatureCollection', features };
}

export function notesToExportGeoJSON(store: Store): GeoJSON.FeatureCollection {
  const features = listCuriosityNotes(store).map((n) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [n.lng, n.lat] as [number, number] },
    properties: {
      i: n.i,
      label: n.label,
      notes: n.notes,
      updated: new Date(n.updatedAt).toISOString(),
      source: 'osiris-curiosities-notes',
    },
  }));
  return { type: 'FeatureCollection', features };
}
