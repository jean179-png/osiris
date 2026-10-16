export type TrackKind = 'ship' | 'transit' | 'flight';

export type ShipTrackEntry = {
  kind: 'ship';
  id: string;
  label: string;
  status: 'loading' | 'ready' | 'error';
  /** AIS trail window in days (1 / 7 / 30 / 183 / 366). Default 1. */
  trailDays?: number;
  coordinates?: [number, number][];
  meta?: { points?: number; from?: string | null; to?: string | null; days?: number };
};

export type TransitTrackEntry = {
  kind: 'transit';
  id: string;
  label: string;
  status: 'loading' | 'ready' | 'error';
  color?: string;
};

export type FlightTrackEntry = {
  kind: 'flight';
  id: string;
  label: string;
  status: 'loading' | 'ready' | 'error';
};

export type TrackEntry = ShipTrackEntry | TransitTrackEntry | FlightTrackEntry;

export type TrackSelectionState = {
  ships: ShipTrackEntry[];
  transit: TransitTrackEntry | null;
  flight: FlightTrackEntry | null;
};

export const SHIP_TRACK_CAP = 25;

export function emptyTrackSelection(): TrackSelectionState {
  return { ships: [], transit: null, flight: null };
}

export function toggleShipTrack(
  state: TrackSelectionState,
  input: { mmsi: string; label: string },
): TrackSelectionState {
  const mmsi = String(input.mmsi || '').replace(/\D/g, '');
  if (!mmsi) return state;
  const idx = state.ships.findIndex((s) => s.id === mmsi);
  if (idx >= 0) {
    return { ...state, ships: state.ships.filter((s) => s.id !== mmsi) };
  }
  let ships = [...state.ships];
  if (ships.length >= SHIP_TRACK_CAP) ships = ships.slice(1);
  ships.push({
    kind: 'ship',
    id: mmsi,
    label: input.label || mmsi,
    status: 'loading',
    trailDays: 1,
  });
  return { ...state, ships };
}

/** Update trail length for an active ship and mark loading for refetch. */
export function setShipTrailDays(
  state: TrackSelectionState,
  mmsi: string,
  days: number,
): TrackSelectionState {
  const id = String(mmsi || '').replace(/\D/g, '');
  const ships = state.ships.map((s) =>
    s.id === id ? { ...s, trailDays: days, status: 'loading' as const } : s,
  );
  if (!ships.some((s) => s.id === id)) return state;
  return { ...state, ships };
}

/** Ensure each pick is in ships (loading, trailDays 1 if new). Drop oldest if over cap. */
export function ensureShipTracks(
  state: TrackSelectionState,
  picks: { mmsi: string; label: string }[],
): TrackSelectionState {
  let ships = [...state.ships];
  for (const pick of picks) {
    const mmsi = String(pick.mmsi || '').replace(/\D/g, '');
    if (!mmsi) continue;
    if (ships.some((s) => s.id === mmsi)) continue;
    if (ships.length >= SHIP_TRACK_CAP) ships = ships.slice(1);
    ships.push({
      kind: 'ship',
      id: mmsi,
      label: pick.label || mmsi,
      status: 'loading',
      trailDays: 1,
    });
  }
  return { ...state, ships };
}

/** Set trailDays + loading on every listed mmsi that is already tracked. */
export function setShipTrailDaysForMany(
  state: TrackSelectionState,
  mmsis: string[],
  days: number,
): TrackSelectionState {
  const ids = new Set(
    mmsis.map((m) => String(m || '').replace(/\D/g, '')).filter(Boolean),
  );
  if (ids.size === 0) return state;
  let changed = false;
  const ships = state.ships.map((s) => {
    if (!ids.has(s.id)) return s;
    changed = true;
    return { ...s, trailDays: days, status: 'loading' as const };
  });
  return changed ? { ...state, ships } : state;
}

/** Remove all listed mmsis. */
export function removeShipTracks(
  state: TrackSelectionState,
  mmsis: string[],
): TrackSelectionState {
  const ids = new Set(
    mmsis.map((m) => String(m || '').replace(/\D/g, '')).filter(Boolean),
  );
  if (ids.size === 0) return state;
  const ships = state.ships.filter((s) => !ids.has(s.id));
  if (ships.length === state.ships.length) return state;
  return { ...state, ships };
}

export function setShipTrackResult(
  state: TrackSelectionState,
  mmsi: string,
  result:
    | {
        ok: true;
        coordinates: [number, number][];
        label?: string;
        meta?: ShipTrackEntry['meta'];
      }
    | { ok: false },
): TrackSelectionState {
  const id = String(mmsi || '').replace(/\D/g, '');
  const ships = state.ships.map((s) => {
    if (s.id !== id) return s;
    if (!result.ok) return { ...s, status: 'error' as const, coordinates: undefined };
    return {
      ...s,
      status: 'ready' as const,
      coordinates: result.coordinates,
      label: result.label || s.label,
      trailDays: result.meta?.days ?? s.trailDays ?? 1,
      meta: result.meta,
    };
  });
  if (!ships.some((s) => s.id === id)) return state;
  return { ...state, ships };
}

export function setTransitTrack(
  state: TrackSelectionState,
  entry: TransitTrackEntry | null,
): TrackSelectionState {
  return { ...state, transit: entry };
}

export function setFlightTrack(
  state: TrackSelectionState,
  entry: FlightTrackEntry | null,
): TrackSelectionState {
  return { ...state, flight: entry };
}

export function removeTrack(
  state: TrackSelectionState,
  kind: TrackKind,
  id: string,
): TrackSelectionState {
  if (kind === 'ship') {
    return { ...state, ships: state.ships.filter((s) => s.id !== id) };
  }
  if (kind === 'transit') {
    return state.transit?.id === id ? { ...state, transit: null } : state;
  }
  return state.flight?.id === id ? { ...state, flight: null } : state;
}

export function clearAllTracks(_state: TrackSelectionState): TrackSelectionState {
  return emptyTrackSelection();
}

export function dockRows(state: TrackSelectionState): Array<{
  kind: TrackKind;
  id: string;
  label: string;
  status: 'loading' | 'ready' | 'error';
}> {
  const rows: Array<{
    kind: TrackKind;
    id: string;
    label: string;
    status: 'loading' | 'ready' | 'error';
  }> = state.ships.map((s) => ({
    kind: 'ship' as const,
    id: s.id,
    label: s.label,
    status: s.status,
  }));
  if (state.transit) {
    rows.push({
      kind: 'transit',
      id: state.transit.id,
      label: state.transit.label,
      status: state.transit.status,
    });
  }
  if (state.flight) {
    rows.push({
      kind: 'flight',
      id: state.flight.id,
      label: state.flight.label,
      status: state.flight.status,
    });
  }
  return rows;
}
