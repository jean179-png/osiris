# Paleo / Sea Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LayerPanel **Paleo / Sea Level** with Meters mode (−120…+70 m DEM flood) and Ma mode (paleocoast GeoJSON), plus PaleoBar controls.

**Architecture:** Pure level/preset helpers (TDD) → Terrarium decode + flood pixel paint → canvas overlay on map → paleocoast catalog + proxy API → PaleoBar + LayerPanel/OsirisMap wiring.

**Tech Stack:** MapLibre, AWS Terrarium elevation tiles (same as `osiris-dem`), Heine paleoshoreline GeoJSON (proxied), Vitest, TimeBox/`PaleoBar`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-paleo-sea-level-design.md`
- Meters: **−120 … +70**; presets LGM / Today / All ice
- Ma: snap to catalog ages; one timestep loaded at a time
- Off by default; `paleo_sl_controls` on by default
- Simple flood only (no GIA / ice dynamics)
- Heine license is CC BY-NC-SA — attribute clearly; if packaging blocks NC, document fallback to another CC dataset in Task 4

## File map

| File | Role |
| --- | --- |
| `src/lib/paleo-sea-level.ts` | Ranges, presets, clamp, mode types |
| `src/lib/paleo-sea-level.test.ts` | Unit tests |
| `src/lib/terrarium-decode.ts` | Terrarium RGB → meters |
| `src/lib/terrarium-decode.test.ts` | Decode tests |
| `src/lib/paleo-flood-overlay.ts` | Canvas flood overlay (viewport Terrarium) |
| `src/lib/paleo-coasts.ts` | Age catalog + GeoJSON normalize |
| `src/lib/paleo-coasts.test.ts` | Catalog tests |
| `src/app/api/layers/paleo-coast/route.ts` | `?age=` / `?catalog=1` proxy |
| `src/components/PaleoBar.tsx` | Mode + slider + presets |
| `LayerPanel` / `page` / `OsirisMap` | Wire toggle + overlay + bar |

---

### Task 1: Level helpers (TDD)

**Files:**
- Create: `src/lib/paleo-sea-level.ts`
- Create: `src/lib/paleo-sea-level.test.ts`

**Interfaces:**
```ts
export type PaleoMode = 'meters' | 'ma';

export const PALEO_M_MIN = -120;
export const PALEO_M_MAX = 70;

export const PALEO_PRESETS = [
  { id: 'lgm', label: 'LGM', meters: -120 },
  { id: 'today', label: 'Today', meters: 0 },
  { id: 'all_ice', label: 'All ice', meters: 70 },
] as const;

export function clampSeaLevelMeters(m: number): number;
export function formatSeaLevelMeters(m: number): string; // e.g. "−120 m", "+70 m", "0 m"
export function snapSeaLevelMeters(m: number, step?: number): number; // default step 1
```

- [ ] **Step 1: Failing tests** for clamp, format, snap, presets in range
- [ ] **Step 2: Implement**
- [ ] **Step 3: Vitest PASS**
- [ ] **Step 4: Commit** `feat: paleo sea-level meter helpers`

---

### Task 2: Terrarium decode (TDD)

**Files:**
- Create: `src/lib/terrarium-decode.ts`
- Create: `src/lib/terrarium-decode.test.ts`

Terrarium (Mapzen) formula:  
`elevation = (R * 256 + G + B / 256) - 32768`

**Interfaces:**
```ts
/** Decode one pixel; channels 0–255. */
export function terrariumElev(r: number, g: number, b: number): number;

/** Decode ImageData / Uint8ClampedArray RGBA into Float32Array of meters (length = w*h). */
export function decodeTerrariumRgba(rgba: Uint8ClampedArray, width: number, height: number): Float32Array;

/** True if elev_m <= seaLevel_m (flooded). */
export function isFlooded(elevM: number, seaLevelM: number): boolean;
```

- [ ] **Step 1: Failing tests** — known RGB → known elev (e.g. sea level ~0, and a high mountain)
- [ ] **Step 2: Implement**
- [ ] **Step 3: Vitest PASS**
- [ ] **Step 4: Commit** `feat: Terrarium elevation decode for flood`

---

### Task 3: Flood canvas overlay

**Files:**
- Create: `src/lib/paleo-flood-overlay.ts`

**Behavior:**
- `createPaleoFloodOverlay(map: maplibregl.Map): { setLevel(m: number): void; setEnabled(on: boolean): void; destroy(): void }`
- When enabled: full-viewport canvas (`pointer-events: none`), sized to map container
- On `moveend` / resize / level change (debounced ~100–150 ms):  
  - Determine tile set at `min(floor(zoom), 8)` covering viewport  
  - Cap concurrent tile fetches (reuse pattern from `terrain-tiles.ts` queue or simple `Promise.all` with ≤8 tiles)  
  - Fetch `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`  
  - Draw to offscreen, decode, paint flooded pixels as `rgba(30, 90, 180, 0.45)` into canvas in screen space via `map.project` of tile corners (or drawImage warped — simplest: iterate pixels projecting each nth pixel for perf, or draw tile-aligned quads)
- Prefer **tile-aligned drawing**: for each tile, `map.project` four corners → drawImage of a flood-mask canvas for that tile (mask built by decoding Terrarium)
- Pause when `document.hidden` or disabled
- Attribution string constant for map source credit

**Pragmatic draw path (required):**
1. For each tile, create 256×256 ImageData: flooded → blue alpha, else transparent  
2. `drawImage` that tile onto the overlay using projected tile bounds (use `map.transform` / project SW–NE corners)

- [ ] **Step 1: Implement overlay module**
- [ ] **Step 2: Manual smoke** later with Task 6 (optional unit test for `isFlooded` already in Task 2)
- [ ] **Step 3: Commit** `feat: paleo DEM flood canvas overlay`

---

### Task 4: Paleocoast catalog + API

**Files:**
- Create: `src/lib/paleo-coasts.ts`
- Create: `src/lib/paleo-coasts.test.ts`
- Create: `src/app/api/layers/paleo-coast/route.ts`

**Catalog (v1):** curated list of ages pointing at Heine Golonka timestep GeoJSON raw URLs on GitHub (or vendored copies under `public/data/paleo/` if raw fetch is flaky). Example shape:

```ts
export type PaleoCoastEntry = { ageMa: number; label: string; url: string };

export const PALEO_COAST_CATALOG: PaleoCoastEntry[]; // sorted ascending ageMa

export function nearestPaleoAge(ages: number[], target: number): number;
export function paleoCoastAttribution(): string;
```

Start with **6–12** representative ages (e.g. 0, 20, 45, 65, 90, 120 Ma) that exist in the Heine Golonka geojson set — verify URLs during implementation; drop missing.

**API:**
- `GET /api/layers/paleo-coast?catalog=1` → `{ ages: number[], latest: number }` (latest = smallest Ma / present)
- `GET /api/layers/paleo-coast?age=65` → GeoJSON FeatureCollection (proxied + `cachedFc` 24h)
- Invalid age → 400; upstream fail → empty FC

- [ ] **Step 1: Catalog + nearestAge tests**
- [ ] **Step 2: Implement lib + route**
- [ ] **Step 3: Smoke one live GeoJSON fetch**
- [ ] **Step 4: Commit** `feat: paleocoast catalog and proxy API`

---

### Task 5: PaleoBar

**Files:**
- Create: `src/components/PaleoBar.tsx`

**Props:**
```ts
type Props = {
  mode: PaleoMode;
  meters: number;
  ageMa: number;
  ages: number[];
  controls: boolean;
  loading?: boolean;
  onMode: (m: PaleoMode) => void;
  onMeters: (m: number) => void;
  onAgeMa: (a: number) => void;
  onOff?: () => void;
};
```

- Use `BoxShell` / `IconButton` / `TextButton` / `Choice` from TimeBox  
- Mode Choice: METERS | MA  
- Meters: range input −120…70 + preset TextButtons (LGM / TODAY / ALL ICE)  
- Ma: prev/next age + range over catalog indices  
- Chip shows current readout  
- Persist open state; parent persists mode/values

- [ ] **Step 1: Implement PaleoBar**
- [ ] **Step 2: Commit** `feat: PaleoBar meters/Ma controls`

---

### Task 6: LayerPanel + page + OsirisMap

**Files:**
- Modify: `src/components/LayerPanel.tsx` — DISPLAY group (near day_night):
  ```ts
  { key: 'paleo_sl', label: 'Paleo / Sea Level', description: '−120…+70 m · paleocoasts', dataKey: '' },
  { key: 'paleo_sl_controls', label: 'Time Controls', description: 'Meters or Ma', dataKey: '', parent: 'paleo_sl' },
  ```
- Modify: `src/app/page.tsx`: `paleo_sl: false`, `paleo_sl_controls: true`
- Modify: `src/components/OsirisMap.tsx`:
  - State: mode, meters, ageMa, ages[], loading  
  - When `paleo_sl` on + mode meters: create/enable flood overlay; setLevel(meters)  
  - When mode Ma: destroy/disable flood; fetch `/api/layers/paleo-coast?age=` → geojson source `paleo-coast` line/fill  
  - Mount PaleoBar in `DOCK` (can stack with GpsJamBar)  
  - `onLayerOff?.('paleo_sl')`  
  - localStorage: `osiris.paleo.mode`, `osiris.paleo.meters`, `osiris.paleo.ageMa`

- [ ] **Step 1: Wire panel + map + bar**
- [ ] **Step 2: Manual** — meters flood moves with slider; Ma shows paleocoast  
- [ ] **Step 3: Commit** `feat: Paleo/Sea Level layer (DEM flood + Ma coasts)`
- [ ] **Step 4: Spec status → Implemented**

---

## Spec coverage

| Spec | Task |
| --- | --- |
| −120…+70 + presets | 1, 5–6 |
| DEM flood | 2–3, 6 |
| Ma paleocoasts | 4–6 |
| Mode switch + controls child | 5–6 |
| Off default | 6 |
| Attribution | 3–4, 6 |
| Non-goals | omit |
