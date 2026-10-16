# Task 1 Report: Trails Overpass lib (TDD)

## Status

**DONE**

## Summary

Added OSM trails Overpass query builder and GeoJSON mapper at `src/lib/layers/trails.ts`, with unit tests in `trails.test.ts`. Mirrors `freight-rail.ts` patterns: `fillBbox`, `overpassQuery`, `featureOf`, `emptyFc`, `capFeatures(4000)`.

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/layers/trails.ts` | `TRAILS_MIN_ZOOM`, `trailsQl`, `trailSubkind`, `mapTrailsToFc`, `fetchTrails` |
| `src/lib/layers/trails.test.ts` | Vitest coverage for min zoom, QL bbox/selectors, mapper subkind + private skip |

## Public API

- `TRAILS_MIN_ZOOM = 8`
- `trailsQl(bbox: BBox): string`
- `trailSubkind(tags): TrailSubkind`
- `mapTrailsToFc(data: unknown): FeatureCollection`
- `fetchTrails(bbox, zoom): Promise<FeatureCollection>` — returns `emptyFc()` when zoom &lt; 8 or Overpass fails

Feature properties: `kind: 'ground_trails'`, `subkind`, `name`, `highway`, `railway`, `route`, `osmId`, `attribution: 'OpenStreetMap'`.

## TDD Evidence

### RED (Step 2) — module missing

**Command:**

```text
npx vitest run src/lib/layers/trails.test.ts
```

**Working directory:** `C:\pinokio\api\osiris`

**Output:**

```text
 RUN  v2.1.9 C:/pinokio/api/osiris

 ❯ src/lib/layers/trails.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/lib/layers/trails.test.ts [ src/lib/layers/trails.test.ts ]
Error: Failed to load url ./trails (resolved id: ./trails) in C:/pinokio/api/osiris/src/lib/layers/trails.test.ts. Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

**Exit code:** 1

### GREEN (Step 4) — implementation complete

**Command:**

```text
npx vitest run src/lib/layers/trails.test.ts
```

**Output:**

```text
 RUN  v2.1.9 C:/pinokio/api/osiris

 ✓ src/lib/layers/trails.test.ts (3 tests) 2ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

**Exit code:** 0

## Commit

- **SHA:** `7b20937`
- **Subject:** `feat(layers): OSM trails Overpass mapper`
- **Branch:** `feat/osiris-desktop`

## Self-Review

### Alignment with brief

- Test file matches plan verbatim (3 describes, 3 tests).
- Implementation matches plan verbatim (QL template, denied access rules, subkind logic, cap 4000).

### Alignment with `freight-rail.ts`

- Same import stack and helper usage.
- Same `wayLineGeometry` / way-only loop / `featureOf` id prefix pattern (`trail-${id}`).
- Same async fetch pattern: zoom gate, try/catch → `emptyFc()`.

### Gaps / follow-ups (out of scope for Task 1)

- **`fetchTrails` untested** — brief tests only QL + mapper; consider tests for zoom gate and error swallowing in a later task (freight-rail also omits fetch tests).
- **`any` types** — brief uses `any` on Overpass elements; `freight-rail.ts` adds eslint-disable comments; optional consistency pass.
- **No API route or client wiring** — intentional per task scope.

### Linter

`ReadLints` on both new files: no issues reported.

## Concerns

None blocking. Minor: no unit tests for `fetchTrails` or `trailSubkind` edge cases beyond what `mapTrailsToFc` exercises.

---

## Review follow-up (fetchTrails + cap tests)

**Commit:** `9feebd7` — `fix(layers): cover fetchTrails zoom/fail and trails cap`

**Changes:** Extended `trails.test.ts` with partial `vi.mock('./overpass')` (preserves real `fillBbox`); `trailWay()` helper; tests for zoom gate, overpass rejection, 4000 cap, and `attribution` on mapped features.

**Command:**

```text
npx vitest run src/lib/layers/trails.test.ts
```

**Output:**

```text
 RUN  v2.1.9 C:/pinokio/api/osiris

 ✓ src/lib/layers/trails.test.ts (6 tests) 7ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

**Exit code:** 0
