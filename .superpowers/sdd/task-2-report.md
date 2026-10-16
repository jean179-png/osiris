# Task 2 report — USGS gauges API

## Done
- `src/lib/layers/gauges.ts` — `mapUsgsIvToFc` (cap 2000, kind `ground_gauges`)
- `src/app/api/layers/gauges/route.ts` — bbox parse → cachedFc (5m) → USGS NWIS IV
- `src/lib/layers/gauges.test.ts` — mapper + empty + bad coords

## Tests
`npm test -- src/lib/layers/gauges.test.ts` → 3 passed

## Commit
`c4a9ddf42e87420d229985ff1b8ad4ab735cf5bc`

## Deviations
- Brief mentioned 400/502 in coordinator prompt; plan route returns `emptyFc()` on bad bbox / upstream fail (implemented as plan).
- Manual smoke skipped (no long-lived dev server in this step); mapper covered by unit tests.
- Implementer ran in coordinator session after Task tool model-limit failure.
