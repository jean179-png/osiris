# Task 3 review: NOAA wrecks API

**Scope:** `c4a9ddf` → `7db142f` (task-scoped gate)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None material for Steps 1–2. Required files present: `src/lib/layers/wrecks.ts`, `src/lib/layers/wrecks.test.ts`, `src/app/api/layers/wrecks/route.ts`. Route builds the brief’s ArcGIS MapServer/0 query (`where`, envelope `geometry`, `esriGeometryEnvelope`, `inSR=4326`, `esriSpatialRelIntersects`, `outFields=*`, `returnGeometry=true`, `f=geojson`, `resultRecordCount=2000`). Mapper emits `kind: 'ground_wrecks'`, `name`, `featureType`, `attribution: 'NOAA'`. Soft-fail empty FC, TTL `5 * 60_000`, and reuse of `parseBbox` / `bboxKey` / `cachedFc` / `capFeatures` match the brief. |
| **Extra** | Diff is exactly those three files (+222 lines). Mapper also passes through `depth` / `chart` / `record` (design-spec props) and accepts field-name aliases (`vesslterms`/`VESSLTERMS`, `history`/`HISTORY`, etc.) — justified in the report for NOAA casing variance. Route adds content-type guard + try/catch for HTML-with-200 NOAA errors (gauges route has neither; appropriate here). Tests add empty/null payload and non-point/bad-coord skips beyond the Point/MultiPoint happy path. |
| **Misunderstood** | None on the API contract. **Step 3 (smoke coastal MA vs inland empty)** was not run live: NOAA currently returns `200` + `text/html` (service-not-started / error page). Reviewer re-probed the same query URL and confirmed HTML. Soft-fail correctly yields empty FC. Coastal vs inland is only covered by a **fixture mapper** test that feeds one Point vs `features: []` — that does not exercise bbox, fetch, or the route. Documented deviation is honest; treat live smoke as an operator check once ArcGIS is up (same posture as Task 2’s unverified manual smoke). |

**Global constraints**

- **Soft-fail empty FeatureCollection:** Invalid/missing bbox → `emptyFc()` HTTP 200. Upstream `!res.ok`, non-JSON body, parse/timeout/fetch errors → `emptyFc()` inside the cache fetcher (or catch → empty). Supported.
- **Bbox required:** `parseBbox` gate present.
- **Vitest:** Pure mapper tests; `npm test -- src/lib/layers/wrecks.test.ts` → **5 passed** (re-run in review).
- **Unrelated dirty files:** Not in diff.
- **Commit:** Focused (`feat(layers): NOAA wrecks API and GeoJSON mapper`).

## 2. Code quality: Approved with minor

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None blocking for this task. Upstream outage is handled; empty FC is cached for the full 5m TTL on soft-fail success (same pattern as returning empty from gauges) — acceptable for layer TTL, but means recovery lags up to TTL. |
| **Minor** | (1) “Coastal MA / inland” test is tautological (hardcoded coastal feature vs empty array); rename or replace later with a mocked-fetch route test that asserts coastal MA bbox → mapped features and inland bbox → empty when NOAA is unavailable. (2) Happy-path test does not assert feature `id` (`wreck-42`) or `record`/`chart` passthrough. (3) Route has no dedicated unit test (acceptable per brief); soft-fail relies on hand-rolled try/catch + Task 1 `cachedFc`. (4) `mapNoaaWrecksToFc(data: any)` + eslint disable matches gauges’ permissive style. |

## 3. Brief strengths

- Clean split: pure `mapNoaaWrecksToFc` (Point + MultiPoint → points, cap 2000) vs thin Next route reusing Task 1 helpers.
- MultiPoint expands to one feature per coordinate with stable ids (`wreck-${idBase}-${i}`).
- Defensive NOAA handling (timeout 12s, User-Agent, non-JSON content-type → parse-or-empty) is stronger than gauges and matches the real upstream failure mode.
- Field aliasing and extra depth/chart/record props align with the design spec without breaking the brief’s required property set.
- Soft-fail behavior fits the ground-layers global contract (empty FC, no thrown route errors for expected upstream failure).

## Verdict

**Ship for Task 3.** Steps 1–2 meet the brief/plan at HEAD; Step 3 live smoke is blocked by NOAA ArcGIS HTML errors and is only stubbed via fixtures. Quality is solid with optional follow-ups (real mock-based coastal/inland route smoke when practical; richer property/id assertions). Re-run operator smoke (Boston Harbor / Cape vs inland MA) once the MapServer responds with GeoJSON.

---

Spec: ✅  
Quality: Approved with minor
