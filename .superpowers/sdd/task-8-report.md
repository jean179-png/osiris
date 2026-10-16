# Task 8 report — Historic map footprints

## Done
- `public/data/layers/historic-map-footprints.geojson` — 18 US city Sanborn/LOC footprint polygons (rough city bbox rectangles) with `{ title, city, year, locUrl, attribution: 'Library of Congress' }`
- `src/lib/layers/historic-maps.ts` — `featureBbox`, `bboxesOverlap`, `filterHistoricMapsByBbox` (no network)
- `src/app/api/layers/historic-maps/route.ts` — load local GeoJSON, filter by request bbox, return FC; soft-fail empty
- `src/lib/layers/historic-maps.test.ts` — overlap, envelope, filter unit tests

## Seed cities
NYC, Chicago, San Francisco, Los Angeles, Philadelphia, Boston, Washington DC, New Orleans, Seattle, Detroit, Atlanta, Denver, Providence, Baltimore, St. Louis, Portland OR, Houston, Minneapolis

## Tests
`npm test -- src/lib/layers/historic-maps.test.ts` → **PASS** (4 tests)

## Commit
`6b83353d43b6f083639e1288a0f934f2e751cceb`

## Deviations
- Added optional mapper helper + unit test under `src/lib/layers/` (brief allowed).
- Footprints are approximate downtown rectangles for v1, not digitized sheet extents.
- `locUrl` values use LOC Sanborn item URL pattern; not every ID was live-verified this pass.
