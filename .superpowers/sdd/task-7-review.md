# Task 7 review: Municipal registry + 311 + vacant

**Scope:** `1a1b815` → `149cc94` (task-scoped gate)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None. Required files present: `public/data/layers/municipal-endpoints.json`, `src/lib/layers/municipal.ts`, `src/app/api/layers/civic-311/route.ts`, `src/app/api/layers/vacant/route.ts`, `src/lib/layers/municipal.test.ts`. Step 1: `citiesForBbox` / `cityBboxIntersects` with disabled skip + tests. Step 2: Socrata `$where` lat/lng between + `$limit`; ArcGIS envelope (`esriGeometryEnvelope`, `inSR`/`outSR` 4326); mappers → `ground_civic_311` / `ground_vacant`; routes min zoom 10, TTL `3 * 60_000`. Step 3: parallel per-city fetch, soft-fail → `emptyFc()`, `mergeMunicipalFc` (+ `capFeatures` 5000). |
| **Extra** | Diff is exactly those five paths (+757 lines). Feature props (category, status, openedAt, address, city/cityId, sourceUrl, attribution); ArcGIS ring centroid fallback; Socrata `location` object fallback; post-fetch request-bbox clip; response `Cache-Control: public, s-maxage=60`. Seed substitutes Philadelphia, Austin, LA for unavailable preferred cities. |
| **Misunderstood** | None on the API contract. Documented deviations are sound for Task 7 adapter scope (see Boston/Providence below). Missing/non-finite `z` → empty FC (same as `z < 10`) matches nightlife/abandoned zoom gating. |

**Boston / Providence (plan seed list)**

Plan: seed 4–8 verified public endpoints *(Boston, NYC, Chicago, SF, Providence if available)*; design limits upstream to **Socrata/ArcGIS** registry entries; Step 2 adapters are only `$where` / ArcGIS envelope.

| City | Finding | Verdict |
|------|---------|---------|
| **Boston** | `data.boston.gov` is **CKAN**, not Socrata (`/resource/*.json` → 404). 311 package is CSV + **CKAN DataStore** (`datastore_search` works with `latitude`/`longitude`). Public **Open311** GET also works (`https://311.boston.gov/open311/v2/requests.json`, lat/long present). Neither is `type: socrata \| arcgis`. No suitable Boston ArcGIS FeatureServer found for live 311. Plan example URL `https://data.boston.gov/resource/....json` is incorrect for this portal. | **Acceptable omit** for Task 7. Not Important: adding Boston would require a new CKAN/Open311 adapter outside the brief. |
| **Providence** | `data.providenceri.gov` is Socrata, but catalog has **no domain-local 311/vacant** dataset (311 search hits federate Chicago/NYC/etc.). | **Acceptable omit** (“if available”). |

Report wording is slightly imprecise (“Open311 key-gated”): unauthenticated Open311 list GET succeeds; CSV/DataStore is public. The **omit decision** remains correct under Socrata/ArcGIS-only adapters. Seed of **6** cities includes NYC, Chicago, SF plus Philly/Austin/LA; all live-probed OK in review (Socrata `$where` + Philly ArcGIS with `outSR=4326`).

**Global constraints**

- **Soft-fail empty FeatureCollection:** Invalid/missing bbox → `emptyFc()` HTTP 200. Bad/missing `z` → empty. Registry read/parse failure → `[]` → empty. Per-city fetch/HTTP/parse failure → catch → `emptyFc()` for that city; survivors still merge. Supported.
- **Bbox required:** `parseBbox` gate on both routes.
- **Vitest:** Intersect, mappers, URL builders, merge; `npm test -- src/lib/layers/municipal.test.ts` → **11 passed** (re-run in review).
- **Unrelated dirty files:** Not in diff.
- **Commit:** Focused (`feat(layers): municipal 311 and vacant property registry APIs`).

## 2. Code quality: Approved with minor

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None blocking for this task. Boston omission is **not** Important given adapter scope (see above). |
| **Minor** | (1) Report understates Boston: CKAN DataStore + Open311 are public JSON; still incompatible with Task 7 adapters — clarify for operators. (2) No mocked-fetch coverage of `fetchMunicipalEndpoint` soft-fail / timeout (brief scopes unit tests to intersect/mappers/URL builders). (3) Routes have no dedicated unit tests (same posture as other layer routes); `loadRegistry` duplicated in civic-311 vs vacant. (4) Soft-fail empty FC for a city (or all) is still cached under the bbox key for the full 3m TTL. (5) Optional follow-up (out of Task 7): CKAN DataStore or Open311 adapter to seed Boston without inventing a fake Socrata URL. |

## 3. Brief strengths

- Clean split: registry JSON → pure bbox filter / URL builders / mappers / merge → thin Next routes reusing Task 1 `parseBbox` / `bboxKey` / `cachedFc` / `emptyFc` / `pointFeature` / `capFeatures`.
- Both adapter types exercised in registry (Socrata majority + Philly ArcGIS 311/vacant) with correct field maps; Philly vacant needs `outSR=4326` (set) to avoid Web Mercator points.
- Parallel city fetches with independent soft-fail match the multi-source ground-layers model.
- Fixture tests lock kinds, coords, bbox clip, URL query shape, and merge without live portals.
- Min zoom 10 + 3m TTL fit the design’s 2–5 minute civic cache band.

## Verdict

**Ship for Task 7.** Steps 1–3 meet the brief/plan at HEAD; Boston/Providence omissions are justified for Socrata/ArcGIS-only adapters (Boston’s real feeds are CKAN/Open311, not the plan’s mistaken `/resource/` shape). Quality is solid with optional follow-ups (report wording; mocked fetch; future Boston adapter).

---

Spec: ✅  
Quality: Approved with minor
