# Animated Wind Layer (nullschool-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LayerPanel **Wind** toggle draws nullschool-style animated particles from a coarse global 10 m UV wind field (Open-Meteo), with a product hook for future levels.

**Architecture:** Pure field math + particle step (TDD) → server builds/caches a UV grid from Open-Meteo speed/direction → canvas overlay advects particles and projects with `map.project` (mercator + globe). Same pattern as live-clouds (lazy create on toggle).

**Tech Stack:** Next.js route, Vitest, MapLibre GL, canvas 2D, Open-Meteo Forecast/GFS API (no key).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-animated-wind-layer-design.md`
- Product: `surface` only in v1; `WindProductId` union leaves room for more
- Off by default; pause when `document.hidden`
- No GPL wind libs; no forecast scrubber in v1
- Attribution: Open-Meteo (+ GFS)

---

### Task 1: Wind field types + UV math (TDD)

**Files:**
- Create: `src/lib/wind-field.ts`
- Create: `src/lib/wind-field.test.ts`

**Interfaces:**
- Produces:
  - `export type WindProductId = 'surface'`
  - `export type WindFieldGrid = { product: WindProductId; width: number; height: number; west: number; south: number; east: number; north: number; u: Float32Array; v: Float32Array; unit: 'm/s'; validTime: string | null; attribution: string }`
  - `speedDirToUV(speedMs: number, directionDeg: number): { u: number; v: number }` — meteorological “from” direction
  - `sampleUV(grid: WindFieldGrid, lng: number, lat: number): { u: number; v: number } | null` — bilinear; null if outside
  - `windSpeed(u: number, v: number): number`
  - `speedToRgba(speedMs: number): [number, number, number, number]` — cool→warm ramp

- [ ] **Step 1: Failing tests** for `speedDirToUV` (north wind → negative v), `sampleUV` corners/center, `speedToRgba` monotonic G channel or hue proxy
- [ ] **Step 2: Implement**
- [ ] **Step 3: `npx vitest run src/lib/wind-field.test.ts` PASS
- [ ] **Step 4: Commit** `feat: wind field UV types and sampling`

---

### Task 2: Open-Meteo grid fetch + API route

**Files:**
- Create: `src/lib/wind-openmeteo.ts`
- Create: `src/lib/wind-openmeteo.test.ts` (mock fetch; assert URL batches + mapping)
- Create: `src/app/api/layers/wind/route.ts`

**Data strategy (v1):**
- Coarse global mesh: **5°** step → lon −180…175, lat −85…85 → ~72 × 35 ≈ 2520 points too heavy; use **10°** step → ~36 × 18 = **648** points
- Batch Open-Meteo requests ≤ 50 lat/lng pairs per call:
  - `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&cell_selection=nearest`
- Convert each point with `speedDirToUV`; fill row-major `u`/`v` (lon varies fastest)
- In-memory module cache TTL **45 min** keyed by `product`
- `GET /api/layers/wind?product=surface` → JSON with `u`/`v` as number arrays (or base64 float32 later if size hurts)

**Interfaces:**
- `buildSurfaceGrid(fetchImpl?): Promise<WindFieldGrid>`
- Route: 400 on unknown product; 502 on upstream fail; never throw to client uncaught

- [ ] **Step 1: Tests** for mesh dimensions, batching, UV fill from mocked OM responses
- [ ] **Step 2: Implement lib + route**
- [ ] **Step 3: Vitest pass; optional live smoke with `RUN_LIVE_TESTS=1`
- [ ] **Step 4: Commit** `feat: Open-Meteo surface wind grid API`

---

### Task 3: Particle engine (TDD)

**Files:**
- Create: `src/lib/wind-particles.ts`
- Create: `src/lib/wind-particles.test.ts`

**Interfaces:**
- `type Particle = { lng: number; lat: number; age: number }`
- `createParticles(count: number, rng?: () => number): Particle[]`
- `stepParticles(particles: Particle[], grid: WindFieldGrid, dtSec: number, opts?: { maxAge?: number; speedScale?: number }): void`
  - Advect: `lng += u * scale * dt`, `lat += v * scale * dt` (scale converts m/s → deg/s approximately: `lat += (v * dt) / 111320`, `lng += (u * dt) / (111320 * cos(lat))`)
  - Respawn when age > maxAge or sampleUV null
- `particleCountForViewport(width: number, height: number, cap = 4000): number`

- [ ] **Step 1–4: TDD + commit** `feat: wind particle advection engine`

---

### Task 4: Canvas overlay + LayerPanel wiring

**Files:**
- Create: `src/lib/wind-overlay.ts` — `createWindOverlay(map: maplibregl.Map): { setGrid; start; stop; destroy }`
  - Canvas appended over map container; resize on map `resize`
  - rAF loop: fade canvas (`globalAlpha` trail), step particles, project each with `map.project`, draw 1–2 px strokes colored by `speedToRgba`
  - `document.visibilitychange` → pause/resume
- Modify: `src/components/LayerPanel.tsx` — `{ key: 'wind', label: 'Wind', description: 'Animated surface wind · Open-Meteo' }` near live_clouds / FIELD
- Modify: `src/app/page.tsx` — `wind: false` in defaults
- Modify: `src/components/OsirisMap.tsx` — useEffect like live_clouds: on `activeLayers.wind`, fetch `/api/layers/wind?product=surface`, `createWindOverlay`, start; cleanup on off/unmount

- [ ] **Step 1: Implement overlay**
- [ ] **Step 2: Wire panel + map**
- [ ] **Step 3: Manual** — toggle on: flowing particles; off: stop; tab hide: pause
- [ ] **Step 4: Commit** `feat: nullschool-style wind layer on map`

---

### Task 5 (optional): Pack + Desktop sync

- [ ] `npm run desktop:pack` + robocopy Desktop\Osiris when user wants portable

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Layer toggle off default | 4 |
| Open-Meteo surface UV | 2 |
| Product hook `surface` | 1–2 |
| Particle canvas + project | 3–4 |
| Pause when hidden | 4 |
| Attribution | 2 (field.attribution) + LayerPanel description |
| Non-goals | (omit) |
