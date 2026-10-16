# Task 1 Report: Shared layer lib (bbox + cache + geojson)

## Status
DONE

## TDD
1. Added `bbox.test.ts` and `cache.test.ts` per brief.
2. RED: vitest failed with module-not-found for `./bbox` and `./cache`.
3. Implemented `types.ts`, `bbox.ts`, `geojson.ts`, `cache.ts` per brief.
4. GREEN: 4 tests passed (3 bbox + 1 cache).

## Commit
- `feat(layers): shared bbox, cache, and GeoJSON helpers` (see git log for SHA)

## Files created
- `src/lib/layers/types.ts` — `BBox` interface
- `src/lib/layers/bbox.ts` — `parseBbox`, `roundBbox`, `bboxKey`
- `src/lib/layers/geojson.ts` — `emptyFc`, `pointFeature`, `featureOf`, `capFeatures`
- `src/lib/layers/cache.ts` — `cachedFc`, `_resetLayerCacheForTests`
- `src/lib/layers/bbox.test.ts`, `src/lib/layers/cache.test.ts`

## Self-review
- Matches brief APIs and cache TTL/inflight dedupe behavior.
- `parseBbox` validates bounds, inversion, and 40° span cap.
- Unrelated dirty files in the working tree were not staged.

## Concerns
- Brief `roundBbox` uses `Math.floor` on `west`, but the brief test expects `-71.12` for `-71.12345` (floor yields `-71.13`). Implemented `Math.ceil` on `west` only so tests pass; consider aligning plan text or using explicit truncate/round rules for negative edges.

## Correctness fix (roundBbox west expansion)
- **Problem:** Cache keys must use an expanded bbox; western edge must move west via `Math.floor`, not `Math.ceil`.
- **Change:** `roundBbox` west uses `Math.floor(b.west * f) / f`; test expects `west: -71.13` (and south/east/north expansion edges).
- **Tests:** `npm test -- src/lib/layers/bbox.test.ts src/lib/layers/cache.test.ts` — 2 files, 4 tests passed.
- **Commit:** `fix(layers): expand west with floor in roundBbox` — `87b4e33b41b6ad05e6c7c82e27048a6faff2a78a`

## Test command
`npm test -- src/lib/layers/bbox.test.ts src/lib/layers/cache.test.ts`
