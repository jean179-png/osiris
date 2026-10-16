# Task 2 Report: Trails API route

## Status

**DONE**

## Summary

Added Next.js App Router GET handler at `src/app/api/layers/trails/route.ts`. Mirrors `freight-rail/route.ts`: parse `bbox` and `z`, return `emptyFc()` when invalid or below `TRAILS_MIN_ZOOM`, otherwise `cachedFc` with key `trails-v1` and 10-minute TTL, `Cache-Control: public, s-maxage=60`.

## Files Created

| File | Purpose |
|------|---------|
| `src/app/api/layers/trails/route.ts` | `/api/layers/trails` viewport GeoJSON feed |

## Route behavior

| Query | Behavior |
|-------|----------|
| missing/invalid `bbox` | `emptyFc()` JSON |
| missing/invalid `z` or `z < TRAILS_MIN_ZOOM` (8) | `emptyFc()` JSON |
| valid `bbox` + `z >= 8` | Cached `fetchTrails(bbox, z)` FeatureCollection |

## Tests

Brief specifies no unit tests for this task.

**Smoke import:**

```text
npx tsx -e "import { GET } from './src/app/api/layers/trails/route.ts'; console.log(typeof GET);"
```

**Working directory:** `C:\pinokio\api\osiris`

**Output:**

```text
function
```

**Exit code:** 0

## Commit

- **SHA:** `5d9ffba`
- **Subject:** `feat(api): /api/layers/trails viewport feed`
- **Branch:** `feat/osiris-desktop`

## Self-Review

### Alignment with brief

- Implementation matches brief verbatim (imports, TTL, cache key `trails-v1`, zoom gate, headers).

### Alignment with `freight-rail/route.ts`

- Same helper stack: `parseBbox`, `bboxKey`, `cachedFc`, `emptyFc`.
- Same response caching header pattern.
- Minor stylistic difference: brief uses inline `Number(req.nextUrl.searchParams.get('z') ?? NaN)` vs freight-rail’s `zRaw` split; functionally equivalent.

### Gaps / follow-ups (out of scope for Task 2)

- No route integration tests (consistent with other layer routes).
- Client wiring (`ground-layers-client`, LayerPanel, map layers) remains for later tasks.

### Linter

`ReadLints` on `route.ts`: no issues reported.

## Concerns

None blocking.
