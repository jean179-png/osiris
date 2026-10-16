# GPS Jam Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LayerPanel **GPS Jam** shows gpsjam.org H3 medium/high interference hexes as MapLibre fills, with a Rain/Wind-style date bar.

**Architecture:** Pure CSV→level helpers (TDD) → H3 polygon GeoJSON (`h3-js`) → cached `/api/layers/gps-jam` → OsirisMap geojson fill + `GpsJamBar` date controls.

**Tech Stack:** Next.js route handler, `h3-js`, MapLibre GL, Vitest, TimeBox primitives (`BoxShell`, etc.).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-gps-jam-layer-design.md`
- Source: gpsjam.org only (no Wingbits); no API key
- Draw **medium + high only**; skip low/green and low-sample hexes (min 3 aircraft)
- Off by default; `gps_jam_controls` on by default (like rain/wind controls)
- Attribution: gpsjam.org / ADS-B Exchange

## File map

| File | Role |
| --- | --- |
| `src/lib/gpsjam.ts` | CSV parse, pct/level, filter, H3→polygon features |
| `src/lib/gpsjam.test.ts` | Unit tests |
| `src/app/api/layers/gps-jam/route.ts` | Proxy + cache |
| `src/components/GpsJamBar.tsx` | Date prev/next/latest bar |
| `src/components/LayerPanel.tsx` | Toggle + child controls |
| `src/app/page.tsx` | Default layer keys |
| `src/components/OsirisMap.tsx` | Fetch + fill layers + bar mount |

---

### Task 1: Parse + severity helpers (TDD)

**Files:**
- Create: `src/lib/gpsjam.ts`
- Create: `src/lib/gpsjam.test.ts`

**Interfaces:**
```ts
export type GpsJamLevel = 'medium' | 'high';

export type GpsJamHexRow = {
  h3: string;
  good: number;
  bad: number;
  total: number;
  pct: number; // 0–100
  level: GpsJamLevel;
};

/** gpsjam FAQ: 100 * (bad - 1) / (good + bad); clamp ≥ 0 */
export function gpsJamPercentBad(good: number, bad: number): number;

/** medium: pct ≥ 2 && pct ≤ 10; high: pct > 10; else null (low) */
export function gpsJamLevel(pct: number): GpsJamLevel | null;

export function parseGpsJamCsv(csv: string, opts?: { minAircraft?: number }): GpsJamHexRow[];
// default minAircraft = 3; skip rows that are low or below minAircraft

export function parseGpsJamManifest(csv: string): string[]; // YYYY-MM-DD ascending
export function latestManifestDate(dates: string[]): string | null;

export const GPSJAM_ATTRIBUTION =
  'GPS interference © <a href="https://gpsjam.org/">gpsjam.org</a> (ADS-B Exchange)';
```

- [x] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  gpsJamPercentBad,
  gpsJamLevel,
  parseGpsJamCsv,
  parseGpsJamManifest,
  latestManifestDate,
} from './gpsjam';

describe('gpsJamPercentBad', () => {
  it('uses (bad-1)/(good+bad)*100', () => {
    expect(gpsJamPercentBad(90, 11)).toBeCloseTo(100 * 10 / 101, 5);
  });
  it('clamps when bad is 0 or 1', () => {
    expect(gpsJamPercentBad(10, 0)).toBe(0);
    expect(gpsJamPercentBad(10, 1)).toBe(0);
  });
});

describe('gpsJamLevel', () => {
  it('classifies medium and high', () => {
    expect(gpsJamLevel(1.5)).toBeNull();
    expect(gpsJamLevel(2)).toBe('medium');
    expect(gpsJamLevel(10)).toBe('medium');
    expect(gpsJamLevel(10.1)).toBe('high');
  });
});

describe('parseGpsJamCsv', () => {
  it('keeps medium/high and drops low-sample', () => {
    const csv = [
      'hex,count_good_aircraft,count_bad_aircraft',
      '8928308280fffff,100,1',   // low
      '89283082807ffff,80,20',  // high-ish
      '89283082803ffff,1,1',    // low sample
    ].join('\n');
    const rows = parseGpsJamCsv(csv);
    expect(rows.every((r) => r.level === 'medium' || r.level === 'high')).toBe(true);
    expect(rows.some((r) => r.h3 === '89283082807ffff')).toBe(true);
    expect(rows.some((r) => r.h3 === '8928308280fffff')).toBe(false);
  });
});

describe('manifest', () => {
  it('parses dates and returns latest', () => {
    const m = parseGpsJamManifest('date,suspect,num_bad_aircraft_hexes,source\n2026-10-14,false,1,x\n2026-10-15,false,2,x\n');
    expect(m).toEqual(['2026-10-14', '2026-10-15']);
    expect(latestManifestDate(m)).toBe('2026-10-15');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/gpsjam.test.ts` — expect FAIL
- [ ] **Step 3: Implement** `src/lib/gpsjam.ts` (parse helpers only; H3 conversion in Task 2)
- [ ] **Step 4: Vitest PASS**
- [ ] **Step 5: Commit** `feat: gpsjam CSV parse and severity helpers`

---

### Task 2: H3 → GeoJSON + install h3-js

**Files:**
- Modify: `src/lib/gpsjam.ts`
- Modify: `src/lib/gpsjam.test.ts`
- Modify: `package.json` (add `h3-js`)

**Interfaces:**
```ts
import type { Feature, FeatureCollection, Polygon } from 'geojson';

export function h3ToPolygonCoords(h3Index: string): [number, number][]; // [lng,lat] closed ring

export function gpsJamRowsToFeatureCollection(
  rows: GpsJamHexRow[],
  date: string,
): FeatureCollection<Polygon>;
// each feature properties: { h3, level, pct, good, bad, total, date }
```

- [ ] **Step 1:** `npm install h3-js` (clear `NODE_ENV` if production; keep vitest)
- [ ] **Step 2: Failing test** — known H3 index produces closed ring ≥4 positions, lng in [-180,180], lat in [-90,90]; FC feature count matches rows
- [ ] **Step 3: Implement** using `cellToBoundary` from `h3-js` (lng/lat order for GeoJSON)
- [ ] **Step 4: Vitest PASS**
- [ ] **Step 5: Commit** `feat: gpsjam H3 hexes to GeoJSON polygons`

---

### Task 3: API route

**Files:**
- Create: `src/app/api/layers/gps-jam/route.ts`

**Behavior:**
- `GET /api/layers/gps-jam?date=YYYY-MM-DD` optional
- Fetch manifest via `httpJson`/`http` text helper (prefer existing `httpBuffer`/fetch pattern used by other layers — use `fetch` + text if no httpText; mirror storms’ try/catch)
- Resolve date; invalid date → 400; missing day CSV → 404/502
- `cachedFc('gpsjam:'+date, 60 * 60_000, …)` from `@/lib/layers/cache`
- Response JSON FeatureCollection + headers:
  - `Cache-Control: public, s-maxage=300`
  - `X-Gpsjam-Date: <date>`
  - `X-Attribution: …`
- On failure: empty FC or 502 (prefer empty FC soft-fail like storms so map stays quiet)

Also export or include in JSON meta optional: `{ type:'FeatureCollection', features, properties?: { date } }` — MapLibre ignores top-level extras; prefer putting `date` only on features. Client reads `X-Gpsjam-Date` for the bar.

- [ ] **Step 1: Implement route**
- [ ] **Step 2: Smoke** (optional): fetch latest CSV path resolves; or hit route when next is up
- [ ] **Step 3: Commit** `feat: proxy gpsjam.org H3 interference GeoJSON`

---

### Task 4: GpsJamBar

**Files:**
- Create: `src/components/GpsJamBar.tsx`

**Props:**
```ts
type Props = {
  date: string;                 // YYYY-MM-DD currently shown
  dates: string[];              // manifest list ascending
  controls: boolean;            // gps_jam_controls
  onDate: (d: string) => void;
  onOff?: () => void;           // turns gps_jam off
  loading?: boolean;
};
```

**Behavior:**
- If `!controls` return null
- Use `BoxShell` / `IconButton` / `TimeReadout` from `@/components/TimeBox` (same dock language as RainBar)
- Icon: `Radio` or `Navigation` from lucide
- Title `GPS Jam`, source `gpsjam.org`
- Chip shows the date
- Body: Prev / Next day (disabled at ends), “Latest” button, optional loading hint
- No play loop
- Persist last date in `localStorage` key `osiris.gpsjam.date` (optional but nice)

- [ ] **Step 1: Implement GpsJamBar**
- [ ] **Step 2: Commit** `feat: GpsJamBar date controls`

---

### Task 5: LayerPanel + page + OsirisMap

**Files:**
- Modify: `src/components/LayerPanel.tsx` — under AVIATION (after military):
  ```ts
  { key: 'gps_jam', label: 'GPS Jam', description: 'ADS-B accuracy · gpsjam.org', dataKey: '' },
  { key: 'gps_jam_controls', label: 'Time Controls', description: 'Pick day · daily CSV', dataKey: '', parent: 'gps_jam' },
  ```
- Modify: `src/app/page.tsx`:
  ```ts
  gps_jam: false,
  gps_jam_controls: true,
  ```
- Modify: `src/components/OsirisMap.tsx`:
  - Dedicated `useEffect` when `activeLayers.gps_jam`:
    - Source `gps-jam`, layers `gps-jam-fill`, `gps-jam-outline`
    - Fetch `/api/layers/gps-jam?date=${date}` (date state: latest until bar changes)
    - Fill paint: match on `level` — medium `#e6c200` opacity ~0.35, high `#e02020` opacity ~0.45
    - Outline: darker stroke, width 0.5–1
    - Click → popup with date, level, pct, good/bad, h3
    - Attribution on source
    - On off: visibility none or setData empty
  - Mount `GpsJamBar` in the weather dock area (same absolute stack as RainBar would use — if RainBar not yet mounted in this OsirisMap, place a small dock `div` bottom-left using `DOCK` from TimeBox, or sibling to existing chrome)
  - Load manifest once: `GET` can return date header; separately fetch `/api/layers/gps-jam` without date then read `X-Gpsjam-Date`, and/or add lightweight `GET /api/layers/gps-jam?manifest=1` returning `{ dates: string[], latest: string }` — **prefer** extending Task 3 route: `?manifest=1` → `{ dates, latest }` JSON (no GeoJSON) so the bar knows bounds without scraping CSV client-side

**Task 3 amendment (if not done):** support `?manifest=1` → `{ dates: string[], latest: string | null }`.

- [ ] **Step 1: Wire panel + defaults + map + bar**
- [ ] **Step 2: Manual** — toggle shows yellow/red hexes; date bar changes day
- [ ] **Step 3: Commit** `feat: GPS Jam layer (gpsjam.org H3)`
- [ ] **Step 4: Update spec status** to Implemented

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Off by default | 5 |
| Medium+high only | 1–3 |
| Date omit → latest | 3 |
| Date scrubber + controls child | 4–5 |
| H3 polygons + colors | 2, 5 |
| Popup stats | 5 |
| Cache ~1h | 3 |
| Attribution | 1, 3, 5 |
| Non-goals | omit |
