# Task 8 review: Historic map footprints

**Scope:** `149cc94` → `6b83353` (task-scoped gate)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None. Required files present: `public/data/layers/historic-map-footprints.geojson`, `src/app/api/layers/historic-maps/route.ts`. Extra (brief-allowed): `src/lib/layers/historic-maps.ts`, `src/lib/layers/historic-maps.test.ts`. Step 1: 18 US city Sanborn/LOC footprint polygons (in ~10–20 band) with `{ title, city, year, locUrl, attribution: 'Library of Congress' }`; closed Polygon rings; rough downtown rectangles as allowed for v1. Step 2: route loads local GeoJSON, filters by request bbox via feature-bbox overlap, returns FC; no upstream network. |
| **Extra** | Diff is exactly those four paths (+517 lines). Module-level in-memory cache of the seed FC; `Cache-Control: public, s-maxage=3600` (fits design “static file / long TTL”); soft-fail on missing/invalid file → `emptyFc()`. |
| **Misunderstood** | None. Design doc mentions `historic-map-footprints.json`; plan/brief require `.geojson` — implementation follows the brief. Approximate rectangles (not digitized sheet extents) match Step 1 explicitly. |

**Seed (18 cities)**

NYC, Chicago, SF, LA, Philadelphia, Boston, Washington DC, New Orleans, Seattle, Detroit, Atlanta, Denver, Providence, Baltimore, St. Louis, Portland OR, Houston, Minneapolis — all have required props and closed bbox rectangles. Spot HEAD/GET to `loc.gov` from this environment returned 403 (bot gate); URLs follow the LOC Sanborn item pattern as reported. Live ID verification remains an open data-quality note, not a spec miss for v1.

**Global constraints**

- **Soft-fail empty FeatureCollection:** Invalid/missing bbox → `emptyFc()` HTTP 200. File read/parse/shape failure → empty. Supported.
- **Bbox required:** `parseBbox` gate present (same 40° span cap as sibling layer routes).
- **No upstream network:** Local `readFile` only.
- **Vitest:** Overlap, envelope, filter (+ null input); `npm test -- src/lib/layers/historic-maps.test.ts` → **4 passed** (re-run in review).
- **Unrelated dirty files:** Not in diff.
- **Commit:** Focused (`feat(layers): historic map footprints API with LOC seed GeoJSON`).

## 2. Code quality: Approved with minor

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None. |
| **Minor** | (1) `locUrl` IDs not live-verified this pass (documented in report); worth a quick browser pass before client click-through UX. (2) `bboxesOverlap` uses strict inequalities (edge-only touch = no hit); fine for city rectangles, but worth knowing if viewports align exactly on a footprint edge. (3) No dedicated route unit test (same posture as other layer routes); helper coverage is adequate for Task 8. (4) Process-lifetime `cached` never reloads if the GeoJSON file changes without restart — acceptable for static seed. |

## 3. Brief strengths

- Clean split: seed GeoJSON → pure `featureBbox` / `bboxesOverlap` / `filterHistoricMapsByBbox` → thin Next route reusing Task 1 `parseBbox` / `emptyFc`.
- Filter logic is network-free and easy to test; fixtures lock Providence-in / SF-out and empty-FC soft paths.
- Property schema matches the brief and design (`title`, `city`, `year`, `locUrl` + required attribution).
- Long CDN cache header matches a static index layer (`historic_maps` min zoom 0 in the upcoming client task).

## Verdict

**Ship for Task 8.** Steps 1–2 meet the brief at HEAD; helper + tests are justified extras. Quality is solid with optional follow-ups (verify a sample of LOC item IDs; optional edge-inclusive overlap if product wants touch hits).

---

Spec: ✅  
Quality: Approved with minor
