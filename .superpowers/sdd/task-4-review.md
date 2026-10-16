# Task 4 review: UAP / NUFORC API

**Scope:** `7db142f` → `9558582` (task-scoped gate)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None. Required files present: `src/lib/layers/uap.ts`, `src/lib/layers/uap.test.ts`, `src/app/api/layers/uap/route.ts`. Step 1: pages `https://theuapatlas.com/api/export?format=json&from=2015&to=2026` with `limit=5000` / `offset`, caches full export under `uap:export:v1` for 30m (`EXPORT_TTL_MS = 30 * 60_000`), filters by bbox in memory, sets `precision: 'city'` and `attribution: 'NUFORC via The UAP Atlas'`, caps at 2000. Step 2: `filterUapRecordsByBbox` covered with fixture rows. Route: `GET /api/layers/uap?bbox=` via `parseBbox` → `getUapForBbox`. |
| **Extra** | Diff is exactly those three files (+252 lines). `mapUapRecordsToFc`, bad-coord skips, null/empty input guards, and a 2000-cap unit test beyond the minimal filter case. Route sets `Cache-Control: public, s-maxage=1800` (aligned with 30m TTL). Soft-fail empty FC on invalid bbox and upstream failure. |
| **Misunderstood** | None on the API contract. Documented deviations are sound: (1) `city` null when upstream omits it while `precision` stays `'city'`; (2) full export cached as GeoJSON FC via `cachedFc` rather than a raw-record store — still key `uap:export:v1`, then in-memory bbox filter; (3) no per-bbox cache — matches the brief’s “cache full export … then filter by bbox in memory.” |

**Global constraints**

- **Soft-fail empty FeatureCollection:** Invalid/missing bbox → `emptyFc()` HTTP 200. Fetch/HTTP/parse failures → `cachedFc` stale-or-empty (short TTL on miss) and/or `getUapForBbox` catch → `emptyFc()`. Supported.
- **Bbox required:** `parseBbox` gate present.
- **Vitest:** Filter helper + mapper tests; `npm test -- src/lib/layers/uap.test.ts` → **7 passed** (re-run in review).
- **Unrelated dirty files:** Not in diff.
- **Commit:** Focused (`feat(layers): UAP/NUFORC Atlas export API with bbox filter`).

## 2. Code quality: Approved with minor

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None blocking for this task. |
| **Minor** | (1) Production path filters a cached FeatureCollection via `filterFcByBbox`, while tests exercise `filterUapRecordsByBbox` on raw rows — shared `pointInBbox` / `recordToFeature`, but the live filter path is untested directly. (2) No mocked-fetch coverage of pagination (`total` / multi-page) or `getUapForBbox` soft-fail (acceptable per brief’s Step 2 scope). (3) Outer try/catch around `getCachedExportFc` is mostly redundant with `cachedFc`’s own catch; harmless. (4) Route has no dedicated unit test (same posture as gauges/wrecks). |

## 3. Brief strengths

- Correct cache shape for this source: one shared export key, bbox filter in memory, response-level `s-maxage=1800`.
- Pagination loop with `limit`/`offset`/`total` and early break on short page is clear and matches the brief URL.
- Thin Next route reuses Task 1 `parseBbox` / `emptyFc`; layer module reuses `cachedFc`, `pointFeature`, `capFeatures`.
- Fixture tests lock kind, precision, attribution, geometry filter, bad coords, and the 2000 cap.
- Soft-fail behavior fits the ground-layers global contract.

## Verdict

**Ship for Task 4.** Steps 1–2 meet the brief at HEAD; deviations are documented and acceptable. Quality is solid with optional follow-ups (assert `filterFcByBbox` or a mocked multi-page export once practical).

---

Spec: ✅  
Quality: Approved with minor
