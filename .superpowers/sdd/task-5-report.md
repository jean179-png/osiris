# Task 5 report — Overpass helper + nightlife + abandoned

## Done
- `src/lib/layers/overpass.ts` — `overpassQuery` POST to overpass-api.de then kumi fallback; 25s timeout; User-Agent `osiris-layers/1.0`; `bboxToOverpass` / `fillBbox` helpers
- `src/lib/layers/nightlife.ts` — QL template + `mapNightlifeElementsToFc` → Point features `kind:'ground_nightlife'`
- `src/lib/layers/abandoned.ts` — QL template + `mapAbandonedElementsToFc` → LineString (way geom) or center Point; `kind:'ground_abandoned'`, `subkind:'rail'|'industrial'`
- `src/app/api/layers/nightlife/route.ts` — bbox + min zoom 10; TTL 10m via `cachedFc`; soft-fail empty FC
- `src/app/api/layers/abandoned/route.ts` — same min zoom / TTL / soft-fail pattern
- `src/lib/layers/overpass.test.ts` — OSM element → feature fixtures (no live Overpass)

## Tests
`npm test -- src/lib/layers/overpass.test.ts` → **PASS** (10 tests)

## Commit
`e528b06b98e2ddd46814967e6a079bdf781b03ad`

## Deviations
- Missing or non-finite `z` returns empty FC (same as `z < 10`), so zoom is required for a fetch.
- Industrial vs rail: `subkind:'rail'` when `railway` is `abandoned|disused`; otherwise `industrial`.
