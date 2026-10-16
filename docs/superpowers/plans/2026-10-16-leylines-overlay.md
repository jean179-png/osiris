# Leylines Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LayerPanel Leylines toggle with Watkins | Grid | Both, proxying maps.leylines.net CZML → GeoJSON with attribution.

**Architecture:** Pure CZML→GeoJSON + allowlist helpers (TDD) → Next API routes with 24h cache → LeylinesBar mode control → OsirisMap GeoJSON line layers.

**Tech Stack:** Next.js route handlers, MapLibre GL, Vitest, `cachedFc` / `emptyFc` / `httpText` patterns from gps-jam.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-leylines-overlay-design.md`
- Upstream base: `https://maps.leylines.net`
- Attribution when on: `Leylines Map · leylines.net` (+ leyhunters.co.uk for Watkins)
- Mode: `watkins` | `grid` | `both` (default `both`)
- Grid v1 family: Gravity Wells basic — `api/createGrid/0.0/0.0/0.0/diamond/gravitywells/basic/lines/off`
- Watkins v1: all leyhunters.co.uk slugs + `st-michael-line` + `st-michael-apollo-axis` (exclude UFO / Syria / Moeller / Gaille / Externsteine unless already in that set)
- Do not vendor harvested GeoJSON into `public/`
- Upstream failure → empty FeatureCollection, no UI crash

## File map

| File | Role |
| --- | --- |
| `src/lib/leylines-mode.ts` | Mode type + clamp |
| `src/lib/leylines-mode.test.ts` | Mode tests |
| `src/lib/leylines-czml.ts` | CZML polyline → GeoJSON |
| `src/lib/leylines-czml.test.ts` | CZML tests |
| `src/lib/leylines-catalog.ts` | Allowlists, URLs, attribution |
| `src/lib/leylines-catalog.test.ts` | Catalog tests |
| `src/app/api/layers/leylines/watkins/route.ts` | Watkins proxy |
| `src/app/api/layers/leylines/grid/route.ts` | Grid proxy |
| `src/components/LeylinesBar.tsx` | Mode + attribution UI |
| `src/components/LayerPanel.tsx` | Leylines + controls entries |
| `src/app/page.tsx` | Default layer keys |
| `src/components/OsirisMap.tsx` | Fetch + paint layers |

---

### Task 1: Mode + CZML → GeoJSON (TDD)

**Files:**
- Create: `src/lib/leylines-mode.ts`
- Create: `src/lib/leylines-mode.test.ts`
- Create: `src/lib/leylines-czml.ts`
- Create: `src/lib/leylines-czml.test.ts`

**Interfaces:**
```ts
export type LeylinesMode = 'watkins' | 'grid' | 'both';
export function parseLeylinesMode(raw: string | null | undefined): LeylinesMode; // default 'both'
export function showWatkins(mode: LeylinesMode): boolean;
export function showGrid(mode: LeylinesMode): boolean;

export type LeyLineProps = { name: string; source?: string; slug?: string };
export function czmlPolylinesToFeatureCollection(
  czml: unknown,
  baseProps?: Partial<LeyLineProps>,
): GeoJSON.FeatureCollection;
```

CZML packets use `polyline.positions.cartographicDegrees` as `[lon, lat, height, lon, lat, height, …]`. Skip packets without polyline or &lt; 2 vertices. Feature `properties.name` from packet `name` or `id`.

- [ ] **Step 1: Failing tests** for mode defaults/clamp and CZML two-point + multi-packet + empty
- [ ] **Step 2: Implement**
- [ ] **Step 3: Vitest PASS** — `npx vitest run src/lib/leylines-mode.test.ts src/lib/leylines-czml.test.ts`
- [ ] **Step 4: Commit** `feat: Leylines mode helpers and CZML→GeoJSON`

---

### Task 2: Catalog allowlist

**Files:**
- Create: `src/lib/leylines-catalog.ts`
- Create: `src/lib/leylines-catalog.test.ts`

**Interfaces:**
```ts
export const LEYLINES_ORIGIN = 'https://maps.leylines.net';
export const LEYLINES_ATTRIBUTION = 'Leylines Map · leylines.net';
export const LEYLINES_WATKINS_ATTRIBUTION =
  'Leylines Map · leylines.net · leyhunters.co.uk';

export type WatkinsLeyEntry = {
  slug: string;
  name: string;
  /** path after origin, starts with api/line/... */
  path: string;
};

/** UK leyhunters set + St. Michael Line + Apollo–St.Michael Axis */
export const WATKINS_LEYS: WatkinsLeyEntry[];

export type GridFamily = 'gravity-wells';
export function gridPath(family: GridFamily): string;
export function parseGridFamily(raw: string | null | undefined): GridFamily | null;

export function watkinsUrl(entry: WatkinsLeyEntry): string;
export function gridUrl(family: GridFamily): string;
```

`WATKINS_LEYS` must include these slugs (paths use catalog widths from maps.leylines.net):

`arbor-low-line`, `avebury-line`, `bradgate-line`, `cambridge-line`, `canterbury-line`, `cerne-abbas-line`, `devils-arrows-line`, `glastonbury-line`, `long-man-line`, `maiden-castle-line`, `mayburgh-line`, `men-an-tol-line`, `montgomery-line`, `old-sarum-line`, `rollright-line`, `rudston-line`, `silbury-hill-line`, `st-pauls-cathedral-line`, `stonehenge-line`, `strand-line`, `uffington-line`, `walterstone-line`, `weston-beacon-line`, `winchester-line` — each path `api/line/leylines/lines/{slug}/50/255,255,66`.

Plus:
- `st-michael-line` → `api/line/leylines/lines/st-michael-line/10000/255,255,66`
- `st-michael-apollo-axis` → `api/line/leylines/lines/st-michael-apollo-axis/10000/255,255,66`

`gridPath('gravity-wells')` → `api/createGrid/0.0/0.0/0.0/diamond/gravitywells/basic/lines/off`.

- [ ] **Step 1: Tests** — count ≥ 26 Watkins entries; URLs absolute; parseGridFamily
- [ ] **Step 2: Implement**
- [ ] **Step 3: Vitest PASS**
- [ ] **Step 4: Commit** `feat: Leylines catalog allowlist and attribution`

---

### Task 3: API routes

**Files:**
- Create: `src/app/api/layers/leylines/watkins/route.ts`
- Create: `src/app/api/layers/leylines/grid/route.ts`

**Pattern:** Mirror `src/app/api/layers/gps-jam/route.ts` — `httpText` or `fetch` JSON, `cachedFc`, `emptyFc`, `X-Attribution` header.

**Watkins `GET`:**
1. `cachedFc('leylines:watkins:v1', 24 * 60 * 60_000, …)`
2. For each `WATKINS_LEYS` entry, `fetch(`${LEYLINES_ORIGIN}/${entry.path}`)` with ~20s timeout; parse JSON; `czmlPolylinesToFeatureCollection(czml, { name: entry.name, slug: entry.slug, source: 'watkins' })`
3. Merge features; skip failed entries (log warn)
4. Return FC + `Cache-Control: public, s-maxage=3600` + `X-Attribution: LEYLINES_WATKINS_ATTRIBUTION`

**Grid `GET`:**
1. `family = parseGridFamily(searchParams.get('family')) ?? 'gravity-wells'`
2. If `parseGridFamily` got invalid non-empty string → 400 `{ error: 'Invalid family' }`
3. `cachedFc(\`leylines:grid:${family}\`, 24h, …)` → fetch `gridUrl(family)` → CZML → FC with `source: 'grid'`
4. Attribution header `LEYLINES_ATTRIBUTION`

`export const dynamic = 'force-dynamic';` `maxDuration = 60` for watkins (many fetches).

- [ ] **Step 1: Implement both routes**
- [ ] **Step 2: Manual or thin test** — optional mock; at least typecheck routes compile
- [ ] **Step 3: Commit** `feat: Leylines Watkins and grid API proxies`

---

### Task 4: LeylinesBar + LayerPanel + page defaults

**Files:**
- Create: `src/components/LeylinesBar.tsx`
- Modify: `src/components/LayerPanel.tsx` — add near paleo/gps jam:
  - `{ key: 'leylines', label: 'Leylines', description: 'Watkins · energy grid · leylines.net', dataKey: '' }`
  - `{ key: 'leylines_controls', label: 'Mode', description: 'Watkins · Grid · Both', dataKey: '', parent: 'leylines' }`
- Modify: `src/app/page.tsx` — `leylines: false`, `leylines_controls: true`

**LeylinesBar props:**
```ts
type Props = {
  mode: LeylinesMode;
  controls: boolean;
  loading?: boolean;
  onMode: (m: LeylinesMode) => void;
  onOff?: () => void;
};
```

Use `TimeBox` `BoxShell` / `Choice` like PaleoBar. Title `Leylines`, source chip from attribution short form `LEYLINES`. Three choices: Watkins / Grid / Both. Persist mode in `localStorage` key `osiris.leylines.mode`.

- [ ] **Step 1: Implement Bar + panel + defaults**
- [ ] **Step 2: Commit** `feat: Leylines LayerPanel and mode bar`

---

### Task 5: OsirisMap wiring

**Files:**
- Modify: `src/components/OsirisMap.tsx`

**Behavior:**
1. State: `leylinesMode` (from localStorage / default `both`), `leylinesLoading`.
2. On map load (or style ready): add sources `leylines-watkins`, `leylines-grid` empty FC; line layers:
   - Watkins: `line-color: #E8C547`, width 2, opacity 0.85
   - Grid: `line-color: #5C9EAD`, width 1, opacity 0.45
3. When `activeLayers.leylines` turns on: fetch `/api/layers/leylines/watkins` and/or `/api/layers/leylines/grid` per mode (abort previous); setGeo; setVis by `showWatkins` / `showGrid`.
4. Mode change: update visibility; fetch missing source if empty.
5. Layer off: hide layers; abort; optional clear data.
6. Render `LeylinesBar` beside GpsJam/Paleo when `activeLayers.leylines` (controls child).
7. Add attribution to map attribution control or bar `source` text when on.

- [ ] **Step 1: Implement fetch + layers + bar**
- [ ] **Step 2: Manual** — toggle Both / Watkins / Grid; attribution visible; off clears
- [ ] **Step 3: Spec status → Implemented**
- [ ] **Step 4: Commit** `feat: Leylines overlay on OsirisMap`

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Mode Watkins \| Grid \| Both | 1, 4, 5 |
| Proxy + CZML→GeoJSON | 1, 3 |
| Allowlist Watkins + Gravity Wells | 2, 3 |
| Attribution | 2, 3, 4, 5 |
| Empty on failure | 3, 5 |
| Non-goals | omit |
