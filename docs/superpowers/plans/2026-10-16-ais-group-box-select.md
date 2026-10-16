# AIS Group Box-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shift+drag box-selects up to 25 AIS ships onto Active tracks and opens a group popup with a shared trail-length slider.

**Architecture:** Pure geometry/MMSI helpers (TDD) → raise ship track cap → Shift+drag rubber-band on OsirisMap → query AIS layers → batch add tracks + group popup HTML/slider wired to existing vessel fetch.

**Tech Stack:** MapLibre GL, existing `map-track-selections` + `/api/maritime/vessel?days=`, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-ais-group-box-select-design.md`
- Shift+drag only; pan without Shift unchanged
- Cap **25** MMSIs per box; empty box no-op
- Shared slider stops: 1 / 7 / 30 / 183 / 366 (same as single-ship)
- Single-ship popup behavior unchanged

## File map

| File | Role |
| --- | --- |
| `src/lib/ais-box-select.ts` | Rect helpers, MMSI extract, cap |
| `src/lib/ais-box-select.test.ts` | Unit tests |
| `src/lib/map-track-selections.ts` | Raise `SHIP_TRACK_CAP` to 25; `ensureShipTracks` / `setShipTrailDaysForMany` |
| `src/lib/map-track-selections.test.ts` | Cap + batch helpers |
| `src/components/OsirisMap.tsx` | Shift+drag UI, query, group popup |

---

### Task 1: Box-select helpers (TDD)

**Files:**
- Create: `src/lib/ais-box-select.ts`
- Create: `src/lib/ais-box-select.test.ts`

**Interfaces:**
```ts
export const AIS_GROUP_SELECT_CAP = 25;

export type ScreenRect = { x1: number; y1: number; x2: number; y2: number }; // client/map pixels

/** Normalize so left≤right, top≤bottom. */
export function normalizeScreenRect(r: ScreenRect): { left: number; top: number; right: number; bottom: number };

export function pointInScreenRect(x: number, y: number, r: ReturnType<typeof normalizeScreenRect>): boolean;

/** Min drag distance (px) before treating as a box (avoid Shift+click). */
export const AIS_BOX_MIN_PX = 8;

export function isMeaningfulBox(r: ScreenRect, minPx?: number): boolean;

export type AisPick = { mmsi: string; label: string };

/** From MapLibre feature-like props; mmsi digits only. */
export function pickFromShipProps(props: Record<string, unknown> | null | undefined): AisPick | null;

/** Dedupe by mmsi, preserve order, slice to cap. */
export function capAisPicks(picks: AisPick[], cap?: number): AisPick[];
```

- [ ] **Step 1: Failing tests**
- [ ] **Step 2: Implement**
- [ ] **Step 3: Vitest PASS**
- [ ] **Step 4: Commit** `feat: AIS box-select geometry and MMSI helpers`

---

### Task 2: Track selection batch helpers

**Files:**
- Modify: `src/lib/map-track-selections.ts`
- Modify: `src/lib/map-track-selections.test.ts` (or create if missing coverage)

**Changes:**
- Set `SHIP_TRACK_CAP = 25` (was 8) so group select can fill the dock.
- Add:
```ts
/** Ensure each pick is in ships (loading, trailDays 1 if new). Drop oldest if over cap. */
export function ensureShipTracks(
  state: TrackSelectionState,
  picks: { mmsi: string; label: string }[],
): TrackSelectionState;

/** Set trailDays + loading on every listed mmsi that is already tracked. */
export function setShipTrailDaysForMany(
  state: TrackSelectionState,
  mmsis: string[],
  days: number,
): TrackSelectionState;

/** Remove all listed mmsis. */
export function removeShipTracks(
  state: TrackSelectionState,
  mmsis: string[],
): TrackSelectionState;
```

- [ ] **Step 1: Tests** for cap 25, ensureShipTracks idempotent, setShipTrailDaysForMany, removeShipTracks
- [ ] **Step 2: Implement**
- [ ] **Step 3: Vitest PASS**
- [ ] **Step 4: Commit** `feat: batch ship track ensure/trail days (cap 25)`

---

### Task 3: Shift+drag rubber-band + query on OsirisMap

**Files:**
- Modify: `src/components/OsirisMap.tsx`

**Behavior (map init or dedicated effect with mapReady):**
1. On `keydown` Shift: allow box mode; on `mousedown` with Shift: `map.dragPan.disable()`, record start point in map container coords.  
2. On `mousemove`: update overlay div absolute rect (gold/white dashed border, `pointer-events: none`).  
3. On `mouseup` / `mouseleave`:  
   - re-enable `dragPan`  
   - if not meaningful box → abort  
   - `queryRenderedFeatures` with bbox in **map points** (use `map.project` / container offset carefully — MapLibre accepts `[[x,y],[x,y]]` in CSS pixels relative to map canvas)  
   - layers: all present of `['ship-dots', …]` — also include any AIS category layers that render ships if distinct; **minimum `ship-dots`** when visible  
   - map features → `pickFromShipProps` → `capAisPicks`  
4. If picks empty → done. Else `setTrackSel(ensureShipTracks(…))` and kick fetch for each **new** loading ship (reuse existing `fetch(/api/maritime/vessel?mmsi=&days=)` helper path; extract a local `fetchShipTrail(mmsi, days)` function if not already shared).  
5. Open **group popup** (Task 4).

**Overlay:** a single `div` sibling inside map container, hidden when idle.

- [ ] **Step 1: Implement gesture + query + ensure tracks + fetch**
- [ ] **Step 2: Manual** — Shift+drag selects ships; without Shift, pan works
- [ ] **Step 3: Commit** `feat: Shift+drag AIS box select onto Active tracks`

---

### Task 4: Group popup + shared trail slider

**Files:**
- Modify: `src/components/OsirisMap.tsx` (same popup helper as ship popups)

**Popup HTML:**
- Title: `{N} vessels`
- List up to ~5 labels, then `+k more`
- Slider / stepped control identical stops to single-ship trail UI (`1d|1w|1m|6m|all`)
- On change: `setTrackSel(setShipTrailDaysForMany(…, days))` then refetch each MMSI with that `days`
- Button **Clear group**: `removeShipTracks` for group MMSIs; close popup
- Store `groupMmsisRef` while popup open for highlight (optional: `filter` on ship-dots to emphasize group)
- Escape / map click empty closes popup only (don’t clear tracks unless Clear group)

Wire slider with `popup.getElement()` + `input` listener (same pattern as single-ship trail slider around existing ship-dots click handler ~3045).

- [ ] **Step 1: Implement group popup + shared slider + clear**
- [ ] **Step 2: Manual** — slider updates all trails; Clear group removes dock rows
- [ ] **Step 3: Commit** `feat: AIS group popup with shared trail slider`
- [ ] **Step 4: Spec status → Implemented**

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Shift+drag box | 3 |
| Cap 25 + Active tracks | 1–3 |
| Group popup + shared slider | 4 |
| Empty box no-op | 3 |
| Single-ship unchanged | 4 (no change to path) |
| Clear group | 4 |
| Non-goals | omit |
