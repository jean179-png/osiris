# Task 5 review: Overpass nightlife + abandoned

**Scope:** `9558582` → `e528b06` (task-scoped gate)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None. Required files present: `src/lib/layers/overpass.ts`, `nightlife.ts`, `abandoned.ts`, `src/app/api/layers/nightlife/route.ts`, `abandoned/route.ts`, `src/lib/layers/overpass.test.ts`. Step 1: `overpassQuery` POSTs `data=` form body to `overpass-api.de` then `overpass.kumi.systems`, `AbortSignal.timeout(25_000)`, User-Agent `osiris-layers/1.0`. Step 2: nightlife QL matches the brief (amenity bar/pub/nightclub/biergarten, place=square, highway=pedestrian area=yes; `out center body`); maps Points `kind:'ground_nightlife'`; route min zoom 10 + TTL `10 * 60_000`. Step 3: abandoned QL matches (rail ways/nodes abandoned\|disused, abandoned:industrial, industrial+disused; `out center body geom`); ways → LineString when geometry ≥2 verts else center Point; `kind:'ground_abandoned'`, `subkind:'rail'|'industrial'`; same min zoom / TTL. Step 4: fixture mapper tests only (no live Overpass). |
| **Extra** | Diff is exactly those six files (+434 lines). Helpers `bboxToOverpass` / `fillBbox`; feature props (name, amenity/place/highway or railway/industrial, osmId, osmType, attribution); `capFeatures(..., 2000)`; soft-fail empty FC on Overpass throw; response `Cache-Control: public, s-maxage=60`. |
| **Misunderstood** | None on the API contract. Documented deviation is sound: missing or non-finite `z` returns empty FC (same as `z < 10`), so zoom is required for a fetch — stricter than the brief’s literal `z < 10` wording, and appropriate for Overpass cost. Subkind rule (`rail` when railway is abandoned\|disused, else `industrial`) matches the QL result set. |

**Global constraints**

- **Soft-fail empty FeatureCollection:** Invalid/missing bbox → `emptyFc()` HTTP 200. Missing/`z < 10` → empty. Overpass failure → catch inside `cachedFc` fetcher → `emptyFc()`. Supported.
- **Bbox required:** `parseBbox` gate present on both routes.
- **Vitest:** OSM element → feature fixtures + QL bbox substitution; `npm test -- src/lib/layers/overpass.test.ts` → **10 passed** (re-run in review).
- **Unrelated dirty files:** Not in diff.
- **Commit:** Focused (`feat(layers): Overpass nightlife and abandoned rail APIs`).

## 2. Code quality: Approved with minor

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None blocking for this task. |
| **Minor** | (1) No mocked-fetch coverage of `overpassQuery` primary→fallback or timeout (acceptable: brief Step 4 scopes mapping fixtures only). (2) Duplicate `elementPoint` in nightlife vs abandoned — fine for this task; extract later if a third Overpass layer appears. (3) Routes have no dedicated unit tests (same posture as gauges/wrecks/uap); min-zoom / soft-fail rely on thin route + Task 1 `cachedFc`. (4) Nightlife tests omit the pedestrian-area amenity case; abandoned tests omit a rail *node* Point path (ways + industrial nodes are covered). (5) Soft-fail empty FC is cached for the full 10m TTL (same pattern as other layers). |

## 3. Brief strengths

- Correct Overpass bbox order (`south,west,north,east`) and shared `fillBbox` for both QL templates.
- Clean split: shared `overpassQuery` vs pure mappers vs thin Next routes reusing Task 1 `parseBbox` / `bboxKey` / `cachedFc` / `emptyFc` / `pointFeature` / `featureOf` / `capFeatures`.
- Abandoned way handling matches the brief precisely: LineString from `geometry`, else center Point.
- Fixture tests lock kinds, subkinds, LineString coordinates, and empty/bad-coord guards without hitting live Overpass.
- Soft-fail + min zoom 10 fit the ground-layers cost/contract model.

## Verdict

**Ship for Task 5.** Steps 1–4 meet the brief at HEAD; the zoom-required deviation is documented and acceptable. Quality is solid with optional follow-ups (mocked Overpass failover; route min-zoom test; pedestrian / rail-node fixtures).

---

Spec: ✅  
Quality: Approved with minor
