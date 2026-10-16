# Active tracks, transit direction/stops, and helicopter icons

Date: 2026-10-15  
Branch: `feat/osiris-desktop`  
Status: approved for planning

## Goal

Improve map selection UX for transit, flights, and AIS:

1. Trains/buses show travel direction on the selected route, mark upcoming stops, and show schedule in the popup when data exists.
2. Flights keep rendering; helicopters use a distinct rotor icon on the same aviation layers.
3. AIS tracks use full available Open Waters history; multiple ships can show tracks at once via click-toggle, managed from an Active tracks dock (Clear all / per-row remove). Empty map click does not clear tracks.

## Non-goals

- Worldwide GTFS agency expansion (separate pending work).
- Full GTFS-RT TripUpdates pipeline for live ETAs on every agency.
- Multi-flight track stacking beyond what’s needed to list one selected flight track in the dock.
- Redesigning LayerPanel toggles or adding a dedicated Helicopters layer.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Transit direction | Arrows along the selected route line + small heading cue on the vehicle |
| Ship track interaction | Click toggles that ship’s track on/off |
| Clear | Active tracks dock: per-row × and Clear all |
| Empty map click | Does **not** clear ship / transit / flight selection overlays |
| Helicopters | Different icon (rotor glyph), same commercial/private/jets/military layers |
| Architecture | Approach B — central Active tracks dock |

## Architecture

```
Map click (vehicle/ship/plane)
        │
        ▼
SelectionStore (client state)
  - ships: Map<mmsi, TrackEntry>
  - transit: TransitEntry | null
  - flight: FlightEntry | null
        │
        ├──► MapLibre sources/layers (lines, arrows, stops, heli icons)
        └──► ActiveTracksDock (list + clear)
```

`SelectionStore` can live as React state lifted in `page.tsx` / a small hook used by `OsirisMap` and the dock, or as module-level state owned by `OsirisMap` with a dock render prop/callback. Prefer a thin hook (`useMapTrackSelections`) co-located with map UI so LayerPanel stays unchanged.

### Units

1. **`useMapTrackSelections`** — add/toggle/remove/clear; soft cap for ships (8); exposes dock rows.
2. **`ActiveTracksDock`** — compact panel; visible only when ≥1 entry; Clear all + per-row remove.
3. **Transit overlay enrichment** — extend `gtfs-shape` response and/or client fetch to include upcoming stops + optional schedule rows; MapLibre line + symbol arrow + stop circles.
4. **Flight heli styling** — pass `aircraft_category` into GeoJSON; register heli icon; `icon-image` expression.
5. **AIS multi-track source** — `selected-ship-track` becomes multi-feature; fetch still `/api/maritime/vessel`; keep `fetchFullOpenWatersTrack`.

## 1. Transit (trains & buses)

### Direction

- Keep single selected transit route (one trip at a time in v1; listed in the dock).
- Render route as LineString on existing `transit-route` source (or rename to `selected-transit-route`).
- Add a symbol layer using a small arrow/chevron image with `symbol-placement: line`, spaced along the line, oriented with the line geometry (GTFS shapes are ordered in travel direction).
- Vehicle heading cue: replace or augment the orange/red circle with a small rotated chevron/triangle using `bearing` when present; if bearing is missing, omit the cue (do not invent heading from shape).

### Next stops

- On vehicle click, when shape is fetched, also load upcoming stops for that trip:
  - Prefer static `stop_times` + `stops` already available via agency zip enrichment paths.
  - If RT provides `stopId` / `currentStopSequence`, mark that stop as current and subsequent stops as upcoming (cap ~8 markers).
- Draw stop markers on a companion GeoJSON source (`transit-route-stops`).
- Label at higher zoom with stop name when available.

### Schedule in popup

- Extend ground transit popup to show, when available:
  - Direction (from `directionId` and/or headsign / destination).
  - Trip start (`startDate` / `startTime`) if present on the vehicle feature.
  - Upcoming stop rows: stop name + scheduled departure/arrival when static times exist.
- If no schedule data: omit the schedule block (no empty placeholders).
- Do not block popup open on schedule fetch; hydrate asynchronously if needed.

### API

- Extend `GET /api/layers/gtfs-shape` (or add `gtfs-trip-detail`) to return:
  - `route` FeatureCollection (existing)
  - `stops`: points with `name`, `sequence`, `arrival`/`departure` (ISO or GTFS clock times), `isNext` / `isCurrent`
- Soft-fail: shape without stops is OK; stops without times still draw markers.

### Clear / dock

- Selecting another transit vehicle replaces the previous transit entry (still one transit selection).
- Removing the transit row from the dock clears route + stops + heading cue overlay.
- Turning off both `gtfs` and `trains` layers also clears the transit selection.

## 2. Flights & helicopters

### Visibility

- Keep existing flights / private / jets / military sources and layers.
- Ensure `aircraft_category` (`heli` | `plane`) from `/api/flights` is copied into MapLibre feature properties (today it is dropped in `toFeatures`).
- Do not further reduce heli visibility: when decimating commercial traffic, prefer keeping helis (or exempt `aircraft_category === 'heli'` from commercial 1/10 decimation).

### Icon

- Register a distinct rotor/heli canvas icon per existing color buckets (or one heli glyph tinted via SDF if practical; otherwise four heli icons matching cyan/green/pink/red).
- Layer layout: `icon-image` expression — heli glyph when `aircraft_category == heli`, else existing plane icon.
- Rotation still uses `heading`.

### Flight track + dock

- Single selected flight track remains (click plane loads `/api/aircraft` track as today).
- Clicking another plane replaces the flight track entry in the dock.
- Empty map click does not clear the flight track; dock remove / Clear all does.
- Ship and flight selections no longer hard-clear each other on click (both can coexist; both appear in the dock).

## 3. AIS multi-track + full history

### Track length

- Continue using `fetchFullOpenWatersTrack` (up to 366 days / paging). No intentional shortening on the client.
- Popup may show track point count / first–last timestamps when the vessel API returns them.

### Multi-select

- `selected-ship-track` holds one LineString feature per active MMSI.
- Click ship: if MMSI already tracked → remove; else fetch and add.
- Soft cap: 8 ship tracks. On add beyond cap, drop the oldest (FIFO) and optionally toast/log once.
- Abort in-flight fetch for an MMSI if toggled off before completion.

### Clear behavior

| Action | Effect |
|---|---|
| Empty map click | Does not clear ship, transit, or flight overlays |
| Dock row × | Removes that entry only |
| Dock Clear all | Clears ships + transit + flight overlays |
| Popup close | Does not clear overlays |
| Maritime layer off | Clears all ship tracks |

### Dock rows for ships

- Label: vessel name if known, else MMSI.
- Subtitle optional: type / track point count while loading or after load.

## 4. Active tracks dock (UI)

- Compact floating panel fixed at **bottom-right** (above any status/footer chrome); must not cover the bottom-left view strip.
- Typed rows: Ship / Transit / Flight with a short label.
- Visible only when there is ≥1 entry.
- Controls: Clear all; per-row remove.
- Row click fits map bounds to that track/route when geometry exists.
- Style: match existing dark map chrome; no card clutter; minimal motion.

## Error handling

- Vessel/shape/aircraft fetch failure: remove pending row or mark error in dock; do not leave a stale empty line.
- Missing bearing / stops / schedule: degrade gracefully (arrows from shape still work; omit heading cue / schedule block).
- Heli without category: render as plane (current look).

## Testing

- Unit: selection store toggle/cap/clear; gtfs-shape stops payload helper; flights `toFeatures` preserves `aircraft_category` and heli exemption from decimation.
- Smoke: click two ships → two lines + dock; toggle one off; Clear all; transit click shows arrows + stops when agency static data present; heli icon appears for a known heli typecode fixture.

## Files likely touched

- `src/components/OsirisMap.tsx` — overlays, clear-on-empty-click removal, heli icons, multi ship tracks
- `src/components/ActiveTracksDock.tsx` — new
- `src/hooks/useMapTrackSelections.ts` (or similar) — new
- `src/app/api/layers/gtfs-shape/route.ts` + `src/lib/layers/gtfs-static.ts` — stops/schedule
- `src/app/api/flights/route.ts` — already classifies heli; client must consume
- `src/lib/openwaters-vessel.ts` / maritime vessel route — unchanged contract preferred
- Tests under `src/lib/*.test.ts` and any map selection unit tests

## Success criteria

- [ ] Selected train/bus route shows direction arrows along the line and a heading cue when bearing exists.
- [ ] Upcoming stops are marked on that route when static/RT data allows; popup shows schedule rows when times exist.
- [ ] Helicopters use a rotor icon on the same flight layers; planes unchanged otherwise.
- [ ] Multiple ship tracks can be active; click toggles; dock Clear all / × only clear; empty map click does not.
- [ ] Ship tracks use the full available OW history already implemented by `fetchFullOpenWatersTrack`.
