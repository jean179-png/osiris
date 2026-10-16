# Task 3 report — NOAA wrecks API

## Done
- `src/lib/layers/wrecks.ts` — `mapNoaaWrecksToFc` (Point + MultiPoint → points, cap 2000, kind `ground_wrecks`)
- `src/app/api/layers/wrecks/route.ts` — bbox parse → cachedFc (5m) → NOAA ArcGIS GeoJSON query; soft-fail empty FC
- `src/lib/layers/wrecks.test.ts` — Point/MultiPoint mapper, empty/bad geom, coastal vs inland fixture smoke

## Tests
`npm test -- src/lib/layers/wrecks.test.ts` → **PASS** (5 tests)

## Commit
`7db142ffd39fa15ae07537115310b1393178ee6c`

## Deviations
- Live NOAA smoke skipped: ArcGIS returns service-not-started / HTML error (soft-fail path covers this). Coastal vs inland covered via fixture mapper test.
- Mapper accepts common field aliases (`vesslterms`/`VESSLTERMS`, `history`, `depth`, `chart`, `recrd`) because public_wrecks field casing varies across mirrors.
