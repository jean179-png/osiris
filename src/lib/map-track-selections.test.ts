import { describe, expect, it } from 'vitest';
import {
  SHIP_TRACK_CAP,
  clearAllTracks,
  dockRows,
  emptyTrackSelection,
  ensureShipTracks,
  removeShipTracks,
  removeTrack,
  setShipTrackResult,
  setShipTrailDays,
  setShipTrailDaysForMany,
  setTransitTrack,
  toggleShipTrack,
} from './map-track-selections';

describe('map-track-selections', () => {
  it('toggles ship on then off', () => {
    let s = emptyTrackSelection();
    s = toggleShipTrack(s, { mmsi: '273610820', label: 'NORD' });
    expect(s.ships).toHaveLength(1);
    expect(s.ships[0]!.status).toBe('loading');
    expect(s.ships[0]!.trailDays).toBe(1);
    s = toggleShipTrack(s, { mmsi: '273610820', label: 'NORD' });
    expect(s.ships).toHaveLength(0);
  });

  it('setShipTrailDays updates length and reloads', () => {
    let s = toggleShipTrack(emptyTrackSelection(), { mmsi: '1', label: 'A' });
    s = setShipTrackResult(s, '1', {
      ok: true,
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    });
    s = setShipTrailDays(s, '1', 7);
    expect(s.ships[0]!.trailDays).toBe(7);
    expect(s.ships[0]!.status).toBe('loading');
  });

  it('FIFO drops oldest when exceeding SHIP_TRACK_CAP', () => {
    let s = emptyTrackSelection();
    for (let i = 0; i < SHIP_TRACK_CAP + 1; i++) {
      s = toggleShipTrack(s, { mmsi: String(100000000 + i), label: `S${i}` });
    }
    expect(s.ships).toHaveLength(SHIP_TRACK_CAP);
    expect(s.ships[0]!.id).toBe('100000001');
    expect(s.ships.at(-1)?.id).toBe(String(100000000 + SHIP_TRACK_CAP));
  });

  it('setShipTrackResult fills coordinates or marks error', () => {
    let s = toggleShipTrack(emptyTrackSelection(), { mmsi: '1', label: 'A' });
    s = setShipTrackResult(s, '1', {
      ok: true,
      coordinates: [
        [0, 0],
        [1, 1],
      ],
      meta: { points: 2 },
    });
    expect(s.ships[0]!.status).toBe('ready');
    expect(s.ships[0]!.coordinates).toHaveLength(2);
  });

  it('clearAllTracks and removeTrack clear dock rows', () => {
    let s = toggleShipTrack(emptyTrackSelection(), { mmsi: '1', label: 'A' });
    s = setTransitTrack(s, {
      kind: 'transit',
      id: 'mbta:t1',
      label: 'Red',
      status: 'ready',
    });
    expect(dockRows(s).length).toBe(2);
    s = removeTrack(s, 'ship', '1');
    expect(dockRows(s).map((r) => r.kind)).toEqual(['transit']);
    s = clearAllTracks(s);
    expect(dockRows(s)).toEqual([]);
  });

  it('SHIP_TRACK_CAP is 25', () => {
    expect(SHIP_TRACK_CAP).toBe(25);
  });

  it('ensureShipTracks adds new ships idempotently and FIFO-caps', () => {
    let s = ensureShipTracks(emptyTrackSelection(), [
      { mmsi: '1', label: 'A' },
      { mmsi: '2', label: 'B' },
    ]);
    expect(s.ships.map((x) => x.id)).toEqual(['1', '2']);
    s = ensureShipTracks(s, [{ mmsi: '1', label: 'A-again' }]);
    expect(s.ships).toHaveLength(2);
    expect(s.ships[0]!.label).toBe('A');
    const picks = Array.from({ length: SHIP_TRACK_CAP + 2 }, (_, i) => ({
      mmsi: String(100 + i),
      label: `S${i}`,
    }));
    s = ensureShipTracks(emptyTrackSelection(), picks);
    expect(s.ships).toHaveLength(SHIP_TRACK_CAP);
    expect(s.ships[0]!.id).toBe('102');
    expect(s.ships.at(-1)?.id).toBe(String(100 + SHIP_TRACK_CAP + 1));
  });

  it('setShipTrailDaysForMany and removeShipTracks batch', () => {
    let s = ensureShipTracks(emptyTrackSelection(), [
      { mmsi: '1', label: 'A' },
      { mmsi: '2', label: 'B' },
      { mmsi: '3', label: 'C' },
    ]);
    s = setShipTrailDaysForMany(s, ['1', '3'], 7);
    expect(s.ships.find((x) => x.id === '1')!.trailDays).toBe(7);
    expect(s.ships.find((x) => x.id === '1')!.status).toBe('loading');
    expect(s.ships.find((x) => x.id === '2')!.trailDays).toBe(1);
    s = removeShipTracks(s, ['1', '3']);
    expect(s.ships.map((x) => x.id)).toEqual(['2']);
  });
});
