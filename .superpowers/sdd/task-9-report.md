# Task 9 report — Client fetch helper

## Done
- `src/lib/ground-layers-client.ts` — `GROUND_LAYER_KEYS`, `GROUND_MIN_ZOOM`, `GROUND_API`, `boundsToBboxParam` per plan; plus `GROUND_DEBOUNCE_MS` (400), `meetsGroundMinZoom`, `buildGroundLayerUrl` for pure debounce/minZoom/URL bits used by Task 11
- `src/lib/ground-layers-client.test.ts` — keys/maps, debounce ms, min-zoom gates, bbox param, URL builder

## Tests
`npm test -- src/lib/ground-layers-client.test.ts` → **PASS** (19 tests)

## Commit
`24406b77fabf8e473be2d25c170f3c66d2cdb3d2`

## Deviations
- Added `GROUND_DEBOUNCE_MS`, `meetsGroundMinZoom`, and `buildGroundLayerUrl` beyond the plan snippet so debounce/minZoom (and fetch URL shape) are unit-testable before OsirisMap wiring.
