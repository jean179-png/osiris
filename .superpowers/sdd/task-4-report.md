# Task 4 report — UAP / NUFORC API

## Done
- `src/lib/layers/uap.ts` — page `/api/export` (limit 5000), cache full FC under `uap:export:v1` (30m), `filterUapRecordsByBbox` / `getUapForBbox`, `precision:'city'`, attribution `NUFORC via The UAP Atlas`, kind `ground_uap`, cap 2000
- `src/app/api/layers/uap/route.ts` — bbox parse → `getUapForBbox`; soft-fail empty FC; `Cache-Control` s-maxage=1800
- `src/lib/layers/uap.test.ts` — filter-by-bbox fixtures, props/attribution, bad coords, 2000 cap

## Tests
`npm test -- src/lib/layers/uap.test.ts` → **PASS** (7 tests)

## Commit
`9558582eeb80fa6c31d71b11a4c69a800a9addc6`

## Deviations
- Upstream export rows omit `city` in the live sample; mapper sets `city` when present else `null`. `precision` always `'city'` per plan.
- Full export cached as GeoJSON via existing `cachedFc` (key `uap:export:v1`) rather than a separate raw-record store; bbox filter runs in memory on that FC.
- No per-bbox `cachedFc` wrapper: export TTL covers cold fetch; in-memory filter is cheap.
