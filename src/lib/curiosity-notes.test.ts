import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCuriosityNote,
  listCuriosityNotes,
  loadCuriosityNotes,
  mergeCuriositySeed,
  notesToGeoJSON,
  saveCuriosityNotes,
  upsertCuriosityNote,
  CURIOSITY_NOTES_KEY,
} from './curiosity-notes';

describe('curiosity notes', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
    });
  });

  it('round-trips a note through localStorage', () => {
    let store = upsertCuriosityNote({}, {
      i: 42, lat: 41.98, lng: -71.33, label: 'Depot', notes: 'Checked dusk',
    });
    saveCuriosityNotes(store);
    store = loadCuriosityNotes();
    expect(getCuriosityNote(store, 42)?.label).toBe('Depot');
    expect(localStorage.getItem(CURIOSITY_NOTES_KEY)).toContain('Depot');
  });

  it('drops empty notes', () => {
    let store = upsertCuriosityNote({}, {
      i: 1, lat: 1, lng: 2, label: 'X', notes: 'y',
    });
    store = upsertCuriosityNote(store, { i: 1, lat: 1, lng: 2, label: '  ', notes: '' });
    expect(listCuriosityNotes(store)).toHaveLength(0);
  });

  it('builds overlay geojson from notes', () => {
    const store = upsertCuriosityNote({}, {
      i: 7, lat: 52.1, lng: 4.3, label: 'Market', notes: '',
    });
    const fc = notesToGeoJSON(store);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.label).toBe('Market');
  });

  it('merges seed notes without overwriting user edits or clears', () => {
    const seed = [
      { i: 10, lat: 1, lng: 2, label: 'Seed A', notes: 'from catalog' },
      { i: 11, lat: 3, lng: 4, label: 'Seed B', notes: 'also catalog' },
    ];
    let store = upsertCuriosityNote({}, {
      i: 10, lat: 1, lng: 2, label: 'Mine', notes: 'kept',
    });
    store = upsertCuriosityNote(store, {
      i: 11, lat: 3, lng: 4, label: '', notes: '',
    });
    store = mergeCuriositySeed(store, seed);
    expect(getCuriosityNote(store, 10)?.label).toBe('Mine');
    expect(listCuriosityNotes(store).find((n) => n.i === 11)).toBeUndefined();
    store = mergeCuriositySeed({}, seed);
    expect(getCuriosityNote(store, 10)?.label).toBe('Seed A');
    expect(getCuriosityNote(store, 11)?.label).toBe('Seed B');
  });

  it('refreshes seed stubs when the catalog text changes', () => {
    let store = mergeCuriositySeed({}, [
      { i: 5, lat: 1, lng: 2, label: 'Old', notes: 'v1' },
    ]);
    expect(getCuriosityNote(store, 5)?.updatedAt).toBe(0);
    store = mergeCuriositySeed(store, [
      { i: 5, lat: 1, lng: 2, label: 'New', notes: 'v2' },
    ]);
    expect(getCuriosityNote(store, 5)?.label).toBe('New');
    expect(getCuriosityNote(store, 5)?.notes).toBe('v2');
  });

  it('drops seed stubs removed from the catalog', () => {
    let store = mergeCuriositySeed({}, [
      { i: 5, lat: 1, lng: 2, label: 'Gone', notes: 'approx' },
      { i: 6, lat: 3, lng: 4, label: 'Keep', notes: 'exact' },
    ]);
    store = mergeCuriositySeed(store, [
      { i: 6, lat: 3, lng: 4, label: 'Keep', notes: 'exact' },
    ]);
    expect(getCuriosityNote(store, 5)).toBeNull();
    expect(getCuriosityNote(store, 6)?.label).toBe('Keep');
  });
});
