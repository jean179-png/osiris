# VIIRS Night Lights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LayerPanel **Night Lights** shows NASA GIBS VIIRS Black Marble (annual composite) as a MapLibre raster overlay; typed hook for future daily DNB.

**Architecture:** Small product→GIBS URL helper (TDD) → tile proxy route → OsirisMap raster source toggled like live traffic. No keys.

**Tech Stack:** Next.js route handler, MapLibre GL raster, Vitest, NASA GIBS WMTS.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-viirs-night-lights-design.md`
- v1 product: `composite` only (Black Marble)
- Off by default; maxzoom 8; GIBS attribution
- No daily UI / date scrubber in v1

---

### Task 1: GIBS URL helper (TDD)

**Files:**
- Create: `src/lib/gibs-night-lights.ts`
- Create: `src/lib/gibs-night-lights.test.ts`

**Interfaces:**
- `export type NightLightsProduct = 'composite' | 'daily'`
- `export const NIGHT_LIGHTS_MAX_ZOOM = 8`
- `gibsNightLightsUpstreamUrl(product: NightLightsProduct, z: number, x: number, y: number): string | null`
  - `composite` → `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`
  - `daily` → return `null` in v1 (unsupported) OR document placeholder URL for later (prefer `null` + route 400)
- `parseNightLightsProduct(raw: string | null): NightLightsProduct | null` — default/accept `composite`; reject unknown

- [x] **Step 1: Failing tests** for URL shape (z/y/x order), product parse
- [x] **Step 2: Implement**
- [x] **Step 3: Vitest PASS**
- [x] **Step 4: Commit** `feat: GIBS night lights URL helpers`

---

### Task 2: Tile proxy route

**Files:**
- Create: `src/app/api/tiles/gibs/night-lights/[z]/[x]/[y]/route.ts`

**Behavior:**
- Query `?product=composite` (default composite)
- Validate z/x/y integers; z > 8 → 404
- `fetch` upstream with 15s timeout; forward body + content-type
- `Cache-Control: public, max-age=86400`
- 400 unknown product; 502 upstream fail

- [x] **Step 1: Implement route**
- [x] **Step 2: Smoke** (optional live fetch one tile)
- [x] **Step 3: Commit** `feat: proxy NASA GIBS night lights tiles`

---

### Task 3: LayerPanel + OsirisMap raster

**Files:**
- Modify: `src/components/LayerPanel.tsx` — `{ key: 'night_lights', label: 'Night Lights', description: 'VIIRS Black Marble · NASA GIBS' }`
- Modify: `src/app/page.tsx` — `night_lights: false`
- Modify: `src/components/OsirisMap.tsx` — useEffect like `live_traffic`:
  - Source id `gibs-night-lights`, layer `gibs-night-lights-layer`
  - tiles: `['/api/tiles/gibs/night-lights/{z}/{x}/{y}?product=composite']`
  - `maxzoom: 8`, `tileSize: 256`
  - paint `raster-opacity: 0.85`
  - attribution NASA GIBS
  - visibility toggle with layer on/off

- [x] **Step 1: Wire panel + map**
- [x] **Step 2: Manual** — toggle shows city lights globally
- [x] **Step 3: Commit** `feat: Night Lights layer (VIIRS Black Marble)`
- [x] **Step 4: Update spec status** to Implemented

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Toggle off default | 3 |
| Black Marble composite | 1–2 |
| Proxy + cache | 2 |
| maxzoom 8 | 1–3 |
| Product hook daily later | 1 (`daily` → null/400) |
| Attribution | 3 |
| Non-goals | omit |
