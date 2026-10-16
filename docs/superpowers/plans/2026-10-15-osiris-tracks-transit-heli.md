# Active Tracks Dock, Transit Direction/Stops, Helicopter Icons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Active tracks dock for multi-ship (toggle) + transit + flight selections, draw transit route direction arrows and upcoming stops with schedule in the popup when available, and render helicopters with a distinct rotor icon on existing flight layers.

**Architecture:** A pure selection store (`map-track-selections.ts`) owns ship/transit/flight entries (toggle, FIFO cap 8 ships, clear). `ActiveTracksDock` renders that state. `OsirisMap` syncs MapLibre sources from the store, stops clearing overlays on empty map click, enriches `gtfs-shape` with stop points + times, and switches flight `icon-image` by `aircraft_category`.

**Tech Stack:** Next.js 16, MapLibre GL, React, Vitest, existing GTFS static zip helpers, Open Waters vessel track API.

**Spec:** `docs/superpowers/specs/2026-10-15-osiris-tracks-transit-heli-design.md`

## Global Constraints

- Empty map click must **not** clear ship, transit, or flight selection overlays.
- Ship tracks: click **toggles**; Clear all / per-row × only via Active tracks dock.
- Soft cap **8** ship tracks; FIFO drop oldest on overflow.
- Transit: one selected route at a time; direction arrows along line + heading cue when bearing exists.
- Helicopters: distinct rotor icon, **same** aviation layers (no new Helicopters layer).
- Keep `fetchFullOpenWatersTrack` contract; do not shorten tracks client-side.
- Ship and flight selections must **coexist** (no longer clear each other on click).
- Frequent commits; do not commit probe JSONs, `.env` secrets, or curiosities binaries.
- Match existing dark map chrome; dock bottom-right; do not cover bottom-left view strip.

## File map

| Path | Role |
|------|------|
| `src/lib/map-track-selections.ts` | Pure selection store helpers (toggle/cap/clear/rows) |
| `src/lib/map-track-selections.test.ts` | Unit tests for store |
| `src/lib/flights-geojson.ts` | `flightsToGeoJsonFeatures` with heli preserve + category |
| `src/lib/flights-geojson.test.ts` | Decimation / category tests |
| `src/lib/layers/gtfs-static.ts` | `tripStopsForTrip` / extend shape FC with stop points |
| `src/lib/layers/gtfs-static.test.ts` | Stop/schedule helpers |
| `src/app/api/layers/gtfs-shape/route.ts` | Pass through enriched FC (route + stops) |
| `src/components/ActiveTracksDock.tsx` | Dock UI |
| `src/components/OsirisMap.tsx` | Wire store, multi-track, arrows, stops, heli icons, clear behavior |
| `src/app/page.tsx` | Mount dock if not rendered inside OsirisMap |

---

### Task 1: Selection store (pure) + tests

**Files:**
- Create: `src/lib/map-track-selections.ts`
- Create: `src/lib/map-track-selections.test.ts`

**Interfaces:**
- Produces:
```ts
export type TrackKind = 'ship' | 'transit' | 'flight';

export type ShipTrackEntry = {
  kind: 'ship';
  id: string; // mmsi
  label: string;
  status: 'loading' | 'ready' | 'error';
  coordinates?: [number, number][];
  meta?: { points?: number; from?: string | null; to?: string | null };
};

export type TransitTrackEntry = {
  kind: 'transit';
  id: string; // `${agencyId}:${tripId||routeId}`
  label: string;
  status: 'loading' | 'ready' | 'error';
  color?: string;
};

export type FlightTrackEntry = {
  kind: 'flight';
  id: string; // icao24 or callsign
  label: string;
  status: 'loading' | 'ready' | 'error';
};

export type TrackEntry = ShipTrackEntry | TransitTrackEntry | FlightTrackEntry;

export type TrackSelectionState = {
  ships: ShipTrackEntry[]; // order = oldest → newest
  transit: TransitTrackEntry | null;
  flight: FlightTrackEntry | null;
};

export const SHIP_TRACK_CAP = 8;

export function emptyTrackSelection(): TrackSelectionState;

/** Toggle ship by mmsi. If present → remove. If absent → append loading entry (FIFO drop if > cap). */
export function toggleShipTrack(
  state: TrackSelectionState,
  input: { mmsi: string; label: string },
): TrackSelectionState;

export function setShipTrackResult(
  state: TrackSelectionState,
  mmsi: string,
  result:
    | { ok: true; coordinates: [number, number][]; label?: string; meta?: ShipTrackEntry['meta'] }
    | { ok: false },
): TrackSelectionState;

export function setTransitTrack(
  state: TrackSelectionState,
  entry: TransitTrackEntry | null,
): TrackSelectionState;

export function setFlightTrack(
  state: TrackSelectionState,
  entry: FlightTrackEntry | null,
): TrackSelectionState;

export function removeTrack(
  state: TrackSelectionState,
  kind: TrackKind,
  id: string,
): TrackSelectionState;

export function clearAllTracks(state: TrackSelectionState): TrackSelectionState;

export function dockRows(state: TrackSelectionState): Array<{
  kind: TrackKind;
  id: string;
  label: string;
  status: 'loading' | 'ready' | 'error';
}>;
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  SHIP_TRACK_CAP,
  clearAllTracks,
  dockRows,
  emptyTrackSelection,
  removeTrack,
  setShipTrackResult,
  setTransitTrack,
  toggleShipTrack,
} from './map-track-selections';

describe('map-track-selections', () => {
  it('toggles ship on then off', () => {
    let s = emptyTrackSelection();
    s = toggleShipTrack(s, { mmsi: '273610820', label: 'NORD' });
    expect(s.ships).toHaveLength(1);
    expect(s.ships[0].status).toBe('loading');
    s = toggleShipTrack(s, { mmsi: '273610820', label: 'NORD' });
    expect(s.ships).toHaveLength(0);
  });

  it('FIFO drops oldest when exceeding SHIP_TRACK_CAP', () => {
    let s = emptyTrackSelection();
    for (let i = 0; i < SHIP_TRACK_CAP + 1; i++) {
      s = toggleShipTrack(s, { mmsi: String(100000000 + i), label: `S${i}` });
    }
    expect(s.ships).toHaveLength(SHIP_TRACK_CAP);
    expect(s.ships[0].id).toBe('100000001');
    expect(s.ships.at(-1)?.id).toBe(String(100000000 + SHIP_TRACK_CAP));
  });

  it('setShipTrackResult fills coordinates or marks error', () => {
    let s = toggleShipTrack(emptyTrackSelection(), { mmsi: '1', label: 'A' });
    s = setShipTrackResult(s, '1', {
      ok: true,
      coordinates: [[0, 0], [1, 1]],
      meta: { points: 2 },
    });
    expect(s.ships[0].status).toBe('ready');
    expect(s.ships[0].coordinates).toHaveLength(2);
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/map-track-selections.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `map-track-selections.ts`**

Implement exactly the interfaces above. `toggleShipTrack` must not mutate input. When adding and `ships.length >= SHIP_TRACK_CAP`, drop `ships[0]` before push. `setShipTrackResult` no-ops if mmsi missing. `dockRows` order: ships (oldest→newest), then transit, then flight.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/map-track-selections.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/map-track-selections.ts src/lib/map-track-selections.test.ts
git commit -m "feat(map): pure track selection store with ship toggle cap"
```

---

### Task 2: ActiveTracksDock UI

**Files:**
- Create: `src/components/ActiveTracksDock.tsx`

**Interfaces:**
- Consumes: `dockRows` row shape from Task 1
- Produces: React component

```tsx
export type ActiveTracksDockProps = {
  rows: Array<{
    kind: 'ship' | 'transit' | 'flight';
    id: string;
    label: string;
    status: 'loading' | 'ready' | 'error';
  }>;
  onRemove: (kind: 'ship' | 'transit' | 'flight', id: string) => void;
  onClearAll: () => void;
  onFocus?: (kind: 'ship' | 'transit' | 'flight', id: string) => void;
};
```

- [ ] **Step 1: Implement component**

```tsx
'use client';

import { X } from 'lucide-react';

const KIND_LABEL: Record<string, string> = {
  ship: 'SHIP',
  transit: 'TRANSIT',
  flight: 'FLIGHT',
};

export function ActiveTracksDock({ rows, onRemove, onClearAll, onFocus }: ActiveTracksDockProps) {
  if (!rows.length) return null;
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 56,
        zIndex: 40,
        width: 260,
        maxHeight: 280,
        overflow: 'auto',
        background: 'rgba(12,12,10,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 6,
        padding: 8,
        fontFamily: 'ui-monospace, monospace',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#8A8880', fontSize: 9, letterSpacing: '0.12em' }}>ACTIVE TRACKS</span>
        <button
          type="button"
          onClick={onClearAll}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#E8E6E0',
            fontSize: 9,
            letterSpacing: '0.08em',
            padding: '3px 8px',
            cursor: 'pointer',
          }}
        >
          CLEAR ALL
        </button>
      </div>
      {rows.map((row) => (
        <div
          key={`${row.kind}:${row.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 10,
            color: '#E8E6E0',
          }}
        >
          <button
            type="button"
            onClick={() => onFocus?.(row.kind, row.id)}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: onFocus ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            <span style={{ color: '#5C5A54', marginRight: 6 }}>{KIND_LABEL[row.kind]}</span>
            {row.label}
            {row.status !== 'ready' ? (
              <span style={{ color: '#8A8880', marginLeft: 6 }}>{row.status.toUpperCase()}</span>
            ) : null}
          </button>
          <button
            type="button"
            aria-label={`Remove ${row.label}`}
            onClick={() => onRemove(row.kind, row.id)}
            style={{ background: 'transparent', border: 'none', color: '#8A8880', cursor: 'pointer', padding: 2 }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

If `lucide-react` is not already used in nearby components, use a plain `×` character instead of the `X` icon.

- [ ] **Step 2: Commit**

```bash
git add src/components/ActiveTracksDock.tsx
git commit -m "feat(map): ActiveTracksDock UI for selection clear/remove"
```

---

### Task 3: Wire selection store into OsirisMap (ships multi-track + dock + clear rules)

**Files:**
- Modify: `src/components/OsirisMap.tsx` (ship click ~2322–2433; empty-map clear ~1682–1688; flight click clear-ship ~1486–1488; sources sync)
- Modify: export or render `ActiveTracksDock` from OsirisMap (preferred: render as sibling overlay inside the map container div)

**Interfaces:**
- Consumes: Task 1 store + Task 2 dock
- Produces: multi-feature `selected-ship-track`; dock visible when `dockRows(state).length > 0`

- [ ] **Step 1: Add React state + sync effect**

Near other `useState` in `OsirisMap`:

```ts
const [trackSel, setTrackSel] = useState(emptyTrackSelection);
```

Effect: whenever `trackSel.ships` changes and map is ready, rebuild GeoJSON:

```ts
useEffect(() => {
  if (!mapReady) return;
  const src = mapRef.current?.getSource('selected-ship-track') as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  const features = trackSel.ships
    .filter((s) => s.status === 'ready' && s.coordinates && s.coordinates.length >= 2)
    .map((s) => ({
      type: 'Feature' as const,
      properties: { mmsi: s.id, name: s.label, points: s.meta?.points ?? s.coordinates!.length },
      geometry: { type: 'LineString' as const, coordinates: s.coordinates! },
    }));
  src.setData({ type: 'FeatureCollection', features });
}, [mapReady, trackSel.ships]);
```

Render `<ActiveTracksDock rows={dockRows(trackSel)} onRemove={...} onClearAll={...} onFocus={...} />` inside the map wrapper (position relative).

`onClearAll`: `setTrackSel(clearAllTracks(...))` and also clear `transit-route`, `transit-route-stops` (Task 5), `selected-flight-track` sources to `EMPTY_FC`.

`onRemove('ship', id)`: `removeTrack`; for transit/flight also clear those sources.

`onFocus('ship', id)`: `map.fitBounds` from that ship’s coordinates (padding 40); skip if <2 points.

- [ ] **Step 2: Change ship click to toggle (no cross-clear flight)**

Replace the ship-click body that currently calls `clearShipTrack()` + clears flight track with:

```ts
map.on('click', 'ship-dots', (e) => {
  if (!e.features?.length) return;
  const p = e.features[0].properties as any;
  const coords = (e.features[0].geometry as any).coordinates;
  const mmsi = String(p.mmsi || '').replace(/\D/g, '');
  // keep popup as today for detail...
  if (!mmsi) { /* existing no-mmsi popup path */ return; }

  setTrackSel((prev) => {
    const exists = prev.ships.some((s) => s.id === mmsi);
    if (exists) return toggleShipTrack(prev, { mmsi, label: String(p.name || mmsi) });
    return toggleShipTrack(prev, { mmsi, label: String(p.name || mmsi) });
  });

  // After toggle-on path only: fetch vessel. Use functional update check:
  setTrackSel((prev) => {
    const entry = prev.ships.find((s) => s.id === mmsi);
    if (!entry || entry.status !== 'loading') return prev; // toggled off
    // kick fetch outside — see below
    return prev;
  });
});
```

Cleaner pattern: compute next state once:

```ts
setTrackSel((prev) => {
  const next = toggleShipTrack(prev, { mmsi, label: String(p.name || mmsi) });
  const nowOn = next.ships.some((s) => s.id === mmsi && s.status === 'loading');
  if (nowOn) {
    const ac = new AbortController();
    shipTrackAborts.set(mmsi, ac);
    void fetch(`/api/maritime/vessel?mmsi=${encodeURIComponent(mmsi)}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const track = Array.isArray(d?.track) ? (d.track as [number, number][]) : [];
        setTrackSel((cur) =>
          setShipTrackResult(
            cur,
            mmsi,
            track.length >= 2
              ? {
                  ok: true,
                  coordinates: track,
                  label: d?.vessel?.name || p.name || mmsi,
                  meta: {
                    points: track.length,
                    from: d?.trackMeta?.from ?? null,
                    to: d?.trackMeta?.to ?? null,
                  },
                }
              : { ok: false },
          ),
        );
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setTrackSel((cur) => setShipTrackResult(cur, mmsi, { ok: false }));
      });
  } else {
    shipTrackAborts.get(mmsi)?.abort();
    shipTrackAborts.delete(mmsi);
  }
  return next;
});
```

Keep the existing popup HTML for AIS detail (still fetch detail for popup), but **do not** call `shipTrackSrc.setData` directly anymore — only via the store sync effect.

Module-level or ref: `const shipTrackAborts = useRef(new Map<string, AbortController>())`.

- [ ] **Step 3: Stop empty-map and cross-clear**

In the generic map click handler (~1682), **remove** these two lines:

```ts
(map.getSource('selected-flight-track') ...)?.setData(EMPTY_FC);
(map.getSource('selected-ship-track') ...)?.setData(EMPTY_FC);
```

In flight click handler, **remove** clearing of `selected-ship-track`. When setting a flight track, update `setTrackSel(s => setFlightTrack(s, { kind:'flight', id, label, status:'loading'|'ready' }))` and clear flight only via dock / `setFlightTrack(null)`.

When maritime layer turns off (`activeLayers.maritime` false), `setTrackSel(s => ({ ...s, ships: [] }))`.

- [ ] **Step 4: Manual smoke (dev)**

Run: `npm run dev` — enable maritime, click two ships → two lines + dock; click one again → one line; Clear all → empty; empty map click → tracks remain.

- [ ] **Step 5: Commit**

```bash
git add src/components/OsirisMap.tsx src/components/ActiveTracksDock.tsx
git commit -m "feat(map): multi ship tracks with Active tracks dock; empty click keeps tracks"
```

---

### Task 4: GTFS upcoming stops + schedule in shape API

**Files:**
- Modify: `src/lib/layers/gtfs-static.ts`
- Modify: `src/lib/layers/gtfs-static.test.ts`
- Modify: `src/app/api/layers/gtfs-shape/route.ts` (only if response shape needs query params: `stopId`, `stopSequence`)

**Interfaces:**
- Produces:

```ts
export type TripStopRow = {
  stopId: string;
  name: string;
  sequence: number;
  lng: number;
  lat: number;
  arrival: string | null;   // GTFS clock "HH:MM:SS" or null
  departure: string | null;
};

/** Upcoming stops after currentStopSequence (or after stopId match), capped. */
export function upcomingStopsForTrip(
  pack: StaticGtfsPack,
  tripId: string,
  opts?: { currentStopSequence?: number | null; currentStopId?: string | null; limit?: number },
): TripStopRow[];

/** Extend tripShapeFeatureCollection to append Point features kind=ground_transit_stop. */
```

Parse `arrival_time` / `departure_time` when building stop_times (extend the existing stop_times loop or a parallel structure `pack.tripStopTimes: Map<tripId, Array<{stopId, seq, arrival, departure}>>`). Prefer adding `tripStopTimes` during `buildStaticPack` so we don’t re-scan raw CSV on every request.

- [ ] **Step 1: Write failing tests** in `gtfs-static.test.ts`

Build a minimal pack (follow existing test fixtures in that file) with 4 stop_times and assert:

```ts
const rows = upcomingStopsForTrip(pack, 'trip1', { currentStopSequence: 2, limit: 3 });
expect(rows.map((r) => r.stopId)).toEqual(['s3', 's4']);
expect(rows[0].name).toBeTruthy();
expect(rows[0].departure).toMatch(/:/);
```

Also assert `tripShapeFeatureCollection` includes at least one Point with `kind: 'ground_transit_stop'` when `tripId` is set and stop times exist. Accept optional query-driven filter via new optional args on `tripShapeFeatureCollection(agency, tripId, routeId, opts?)`.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/layers/gtfs-static.test.ts`

- [ ] **Step 3: Implement pack fields + helpers + extend `tripShapeFeatureCollection`**

Append stop features:

```ts
properties: {
  kind: 'ground_transit_stop',
  agencyId: agency.id,
  tripId,
  stopId: row.stopId,
  name: row.name,
  sequence: row.sequence,
  arrival: row.arrival,
  departure: row.departure,
  isCurrent: false,
  isNext: index === 0,
}
```

If `opts.currentStopId` matches a stop, mark `isCurrent: true` on that feature and start upcoming after it.

Cap: `limit` default **8**.

Route API: accept optional `stopId` and `stopSequence` search params and pass into `tripShapeFeatureCollection`.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/layers/gtfs-static.ts src/lib/layers/gtfs-static.test.ts src/app/api/layers/gtfs-shape/route.ts
git commit -m "feat(gtfs): upcoming stops and schedule times on trip shape"
```

---

### Task 5: Transit map layers (arrows, stops, heading) + popup schedule + dock row

**Files:**
- Modify: `src/components/OsirisMap.tsx` (sources ~484; transit layers ~1189; ground click ~2157–2221; heading on gtfs/trains dots)

**Interfaces:**
- Consumes: enriched gtfs-shape FC from Task 4; selection store transit entry from Task 1

- [ ] **Step 1: Add sources/layers on map init**

Add source `transit-route-stops` (GeoJSON EMPTY_FC).

After `transit-route-line`, add:

1. Symbol layer `transit-route-arrows`:
   - source `transit-route`
   - filter LineString / or no filter if source only has lines in that source
   - layout: `symbol-placement: 'line'`, `symbol-spacing: 56`, `icon-image: 'transit-arrow'`, `icon-allow-overlap: true`, `icon-ignore-placement: true`
2. Circle layer `transit-route-stops-dots` on `transit-route-stops`
3. Optional symbol labels `transit-route-stops-label` at zoom >= 11: `text-field: ['get','name']`

Create icon `transit-arrow` (small chevron canvas, color `#FF9500`) and `transit-heading` (triangle) via existing canvas `addImage` pattern near `createIcon`.

Split fetch result:

```ts
const lineFeats = fc.features.filter((f) => f.geometry?.type === 'LineString');
const stopFeats = fc.features.filter((f) => f.properties?.kind === 'ground_transit_stop');
routeSrc.setData({ type: 'FeatureCollection', features: lineFeats.map(...) });
stopsSrc.setData({ type: 'FeatureCollection', features: stopFeats });
```

Pass `stopId` / `currentStopSequence` on the shape query when present on the vehicle feature.

- [ ] **Step 2: Heading cue on vehicles**

For `ground-gtfs-dots` / `ground-trains-dots`, either:

- Add companion symbol layers `ground-gtfs-heading` / `ground-trains-heading` with `icon-image: 'transit-heading'`, `icon-rotate: ['get','bearing']`, filter `['!=', ['get','bearing'], null]` — if bearing can be missing use `['has','bearing']`, or
- Keep circles and overlay the heading symbol on top.

Do **not** invent bearing from the shape.

- [ ] **Step 3: Popup schedule block**

Extend `transitBody` to include:

```ts
${row('DIRECTION', p.directionId != null ? `Dir ${p.directionId}` : (p.headsign || p.destination))}
${row('TRIP START', [p.startDate, p.startTime].filter(Boolean).join(' ') || null)}
```

After shape fetch resolves, if stop features have times, update popup schedule via a small HTML block **or** store `lastTransitSchedule` in a ref and re-open is optional — simpler: append schedule rows into the popup DOM if still open:

Build string from stopFeats:

```ts
const sched = stopFeats.slice(0, 8).map((f) => {
  const n = f.properties?.name || f.properties?.stopId;
  const t = f.properties?.departure || f.properties?.arrival || '';
  return `<div style="display:flex;justify-content:space-between;gap:8px;"><span>${htmlEsc(n)}</span><span style="color:#8A8880;">${htmlEsc(t)}</span></div>`;
}).join('');
```

Insert under transit body when `sched` non-empty. If no times, show stop names only under “NEXT STOPS”; if neither names nor times, omit block.

- [ ] **Step 4: Dock transit entry**

On transit vehicle click (when fetching shape):

```ts
setTrackSel((s) =>
  setTransitTrack(s, {
    kind: 'transit',
    id: `${agencyId}:${tripId || routeId}`,
    label: String(p.routeShortName || p.label || tripId || routeId),
    status: 'loading',
    color,
  }),
);
```

On success → `status: 'ready'`; on failure → `status: 'error'` then optionally remove. Dock remove transit → `clearTransitRoute()` + empty stops source + `setTransitTrack(null)`.

Selecting a new transit vehicle **replaces** the previous transit entry (store setter already replaces).

- [ ] **Step 5: Commit**

```bash
git add src/components/OsirisMap.tsx
git commit -m "feat(transit): route arrows, stop markers, heading cue, schedule popup"
```

---

### Task 6: Helicopter icons on flight layers

**Files:**
- Create: `src/lib/flights-geojson.ts`
- Create: `src/lib/flights-geojson.test.ts`
- Modify: `src/components/OsirisMap.tsx` (`createIcon` / new `createHeliIcon`, flight layer `icon-image`, `toFeatures` usage ~2677–2693)

**Interfaces:**
- Produces:

```ts
export function flightsToGeoJsonFeatures(
  arr: Array<Record<string, unknown>> | null | undefined,
  decimate: number = 1,
): GeoJSON.Feature[];
```

Rules:

- Include `aircraft_category: f.aircraft_category === 'heli' ? 'heli' : 'plane'` in properties (plus existing fields).
- If `decimate > 1`, keep feature when `aircraft_category === 'heli'` **or** index `% decimate === 0`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { flightsToGeoJsonFeatures } from './flights-geojson';

describe('flightsToGeoJsonFeatures', () => {
  it('preserves aircraft_category and exempts helis from decimation', () => {
    const arr = Array.from({ length: 20 }, (_, i) => ({
      lng: i, lat: i, callsign: `C${i}`, heading: 0,
      aircraft_category: i === 7 ? 'heli' : 'plane',
    }));
    const feats = flightsToGeoJsonFeatures(arr, 10);
    expect(feats.some((f) => f.properties?.aircraft_category === 'heli')).toBe(true);
    expect(feats.find((f) => f.properties?.aircraft_category === 'heli')?.properties?.callsign).toBe('C7');
  });
});
```

- [ ] **Step 2: Run — FAIL; implement; PASS**

- [ ] **Step 3: Heli canvas icon + layer expression**

Add `createHeliIcon(map, id, color, size)` drawing a simple top-down rotor (fuselage oval + main rotor line + tail). Register:

```ts
createHeliIcon(map, 'heli-cyan', flightCom, 24);
// green, pink, red, grey similarly
```

Update flightLayers:

```ts
layout: {
  'icon-image': [
    'case',
    ['==', ['get', 'aircraft_category'], 'heli'],
    l.icon.replace('plane-', 'heli-'),
    l.icon,
  ],
  // ... existing rotate/size
}
```

Replace inline `toFeatures` with `flightsToGeoJsonFeatures`.

Ensure palette/theme icon refresh also updates heli icons if `updateMapIcon` is used for planes.

Wire flight track selection into `setFlightTrack` (dock) without clearing ships.

- [ ] **Step 4: Commit**

```bash
git add src/lib/flights-geojson.ts src/lib/flights-geojson.test.ts src/components/OsirisMap.tsx
git commit -m "feat(flights): heli rotor icons and preserve category through GeoJSON"
```

---

### Task 7: Integration smoke + regression tests

**Files:**
- Modify only if fixes needed from smoke

- [ ] **Step 1: Run unit suite for touched modules**

```bash
npx vitest run src/lib/map-track-selections.test.ts src/lib/flights-geojson.test.ts src/lib/layers/gtfs-static.test.ts
```

Expected: all PASS

- [ ] **Step 2: Dev smoke checklist**

1. Transit (gtfs or trains): click vehicle → route arrows, stop dots, dock TRANSIT row, popup direction/schedule when agency static zip has times.
2. Maritime: 2+ ship tracks, toggle off, Clear all, empty click keeps tracks.
3. Flights: heli type (or mock) shows rotor icon; plane unchanged; flight + ship tracks coexist in dock.
4. Bottom-left view strip still visible; dock is bottom-right.

- [ ] **Step 3: Commit any fixes; push fork when user asks**

```bash
git status -sb
# push only if requested: git push fork HEAD
```

---

## Spec coverage self-check

| Spec requirement | Task |
|---|---|
| Route direction arrows + vehicle heading cue | 5 |
| Upcoming stops on route | 4, 5 |
| Schedule in popup when available | 4, 5 |
| Heli distinct icon, same layers | 6 |
| Full OW AIS history | 3 (unchanged API) |
| Multi ship tracks, click toggle | 1, 3 |
| Clear all / per-row via dock | 2, 3 |
| Empty map click does not clear | 3 |
| Soft cap 8 FIFO | 1 |
| Ship + flight coexist | 3, 6 |
| Dock bottom-right; fit bounds on row click | 2, 3 |
| Maritime layer off clears ships | 3 |

## Placeholder / consistency scan

- No TBD/TODO left in steps.
- Store function names consistent across Tasks 1–3 (`toggleShipTrack`, `setShipTrackResult`, `clearAllTracks`, `dockRows`).
- Stop feature `kind: 'ground_transit_stop'` consistent in Tasks 4–5.
- Heli property name `aircraft_category` matches flights API.
