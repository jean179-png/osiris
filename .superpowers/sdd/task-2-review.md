# Task 2 review: USGS gauges API (first live layer)

**Scope:** `87b4e33` → `c4a9ddf` (task-scoped gate)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None material. Required files present: `src/lib/layers/gauges.ts`, `src/lib/layers/gauges.test.ts`, `src/app/api/layers/gauges/route.ts`. Mapper test covers the brief’s happy path; route wires `parseBbox` → `bboxKey('gauges', …)` → `cachedFc(…, 5 * 60_000)` → USGS IV fetch → `mapUsgsIvToFc`. Response headers and empty-FC soft paths match the plan. |
| **Extra** | Diff is exactly those three files (+101 lines). Tests add two justified edge cases beyond the brief (missing/`null` payload; non-finite coordinates). Mapper adds `Feature[]` typing and an eslint disable for permissive `any` input — aligned with the plan’s loose USGS shape. |
| **Misunderstood** | None. Feature properties (`kind: 'ground_gauges'`, site fields, value/unit/parameter/observedAt, USGS url + attribution), cap of 2000, parameterCds `00060,00065`, timeout 12s, User-Agent, and `Cache-Control: public, s-maxage=60` match the plan verbatim. |

**Global constraints**

- **Soft-fail empty FeatureCollection:** Invalid/missing bbox → `emptyFc()` HTTP 200. Upstream `!res.ok` → `emptyFc()` inside the cache fetcher. Fetch/timeout/JSON failures reject into `cachedFc`’s catch (stale or empty FC). Supported.
- **Bbox required:** `parseBbox` gate present.
- **Vitest:** Pure mapper tests only, as specified; `npm test -- src/lib/layers/gauges.test.ts` → **3 passed**.
- **Manual smoke (Step 4):** Not verified in this review (no live `npm run dev` hit). Implementation matches the smoke URL contract.
- **Unrelated dirty files:** Not in diff.

## 2. Code quality: Approved with minor

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None blocking for this task. |
| **Minor** | (1) Feature ids are `usgs-${siteCode}` while the route requests both discharge and stage (`00060,00065`). USGS often returns two `timeSeries` rows per site → two features with the same `id` (different `parameter`/`value`). Plan-specified; MapLibre/id-keyed clients may collide. Prefer `usgs-${code}-${paramCd}` or similar when wiring the map. (2) Happy-path test only asserts `siteName` / length — does not lock geometry, `kind`, value, unit, or url. (3) Route has no dedicated unit test (acceptable per brief); soft-fail path relies on `cachedFc` from Task 1. |

## 3. Brief strengths

- Clean split: pure `mapUsgsIvToFc` vs thin Next route; reuses Task 1 helpers without reinventing cache/bbox/geojson.
- Mapper skips non-finite coords and empty/`null` series safely; `capFeatures(..., 2000)` bounds payload size.
- Extra edge-case tests improve confidence beyond the minimal brief case without scope creep.
- Soft-fail behavior fits the ground-layers global contract (empty FC, no thrown route errors for expected upstream failure).
- Commit message and file set are focused (`feat(layers): USGS NWIS gauges API and GeoJSON mapper`).

## Verdict

**Ship for Task 2.** Meets the brief/plan at HEAD; quality is solid with optional follow-ups (parameter-aware feature ids, richer property assertions). Manual smoke remains an operator check.

---

Spec: ✅  
Quality: Approved with minor
