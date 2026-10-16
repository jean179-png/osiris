# Task 7 report — Municipal registry + 311 + vacant

## Done
- `public/data/layers/municipal-endpoints.json` — 6 verified cities (NYC, Chicago, SF, Philadelphia, Austin, LA)
- `src/lib/layers/municipal.ts` — `citiesForBbox`, Socrata `$where` / ArcGIS envelope adapters → `ground_civic_311` | `ground_vacant`, soft-fail fetch, merge
- `src/app/api/layers/civic-311/route.ts` — min zoom 10, TTL 3m, soft-fail per city, merge
- `src/app/api/layers/vacant/route.ts` — same; only cities with `vacant` endpoint
- `src/lib/layers/municipal.test.ts` — bbox intersect, mappers, URL builders, merge

## Registry notes
| City | 311 | Vacant |
|------|-----|--------|
| NYC | Socrata `erm2-nwe9` | omitted |
| Chicago | Socrata `v6vf-nfxy` | Socrata `yama-9had` (historical vacant/abandoned building SRs) |
| San Francisco | Socrata `vw6y-z8j6` | omitted |
| Philadelphia | ArcGIS `public_cases_fc` | ArcGIS `Vacant_Indicators_Points` |
| Austin | Socrata `xwdj-i9he` | omitted |
| Los Angeles | Socrata `rq3b-xjk8` | omitted |

## Tests
`npm test -- src/lib/layers/municipal.test.ts` → **PASS** (11 tests)

## Commit
`149cc94525a6ca856740a8e45722e0003a9630b4`

## Deviations
- **Boston** omitted: Analyze Boston 311 is CSV/Open311 (key-gated), not public Socrata/ArcGIS compatible with the Task 7 adapters.
- **Providence** omitted: no usable public 311/vacant Socrata or ArcGIS endpoint found on `data.providenceri.gov`.
- Seeded Austin, LA, and Philadelphia (verified) to keep 4–8 cities with working adapters.
- Missing or non-finite `z` returns empty FC (same as `z < 10`), matching nightlife/abandoned zoom gating.
