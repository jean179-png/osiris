# Task 4 Report: Public access API route

## Status

**DONE**

## Summary

Added Next.js App Router GET handler at `src/app/api/layers/public-access/route.ts`. Mirrors `trails/route.ts` and `freight-rail/route.ts`: parse `bbox` and `z`, return `emptyFc()` when invalid or below `PUBLIC_ACCESS_MIN_ZOOM`, otherwise `cachedFc` with key `public-access-v1` and 10-minute TTL, `Cache-Control: public, s-maxage=60`.

## Files Created

| File | Purpose |
|------|---------|
| `src/app/api/layers/public-access/route.ts` | `/api/layers/public-access` viewport GeoJSON feed |

## Route behavior

| Query | Behavior |
|-------|----------|
| missing/invalid `bbox` | `emptyFc()` JSON |
| missing/invalid `z` or `z < PUBLIC_ACCESS_MIN_ZOOM` (7) | `emptyFc()` JSON |
| valid `bbox` + `z >= 7` | Cached `fetchPublicAccess(bbox, z)` FeatureCollection |

## Tests

Brief specifies no unit tests for this task.

**Smoke import:**

```text
npx tsx -e "import { GET } from './src/app/api/layers/public-access/route.ts'; console.log(typeof GET);"
```

**Working directory:** `C:\pinokio\api\osiris`

**Output:**

```text
function
```

**Exit code:** 0

## Commit

- **SHA:** `bd66961`
- **Subject:** `feat(api): /api/layers/public-access viewport feed`
- **Branch:** `feat/osiris-desktop`

## Self-Review

### Alignment with brief

- Implementation matches brief: `fetchPublicAccess`, `PUBLIC_ACCESS_MIN_ZOOM`, cache key `public-access-v1`, TTL, headers.

### Alignment with `trails/route.ts` / `freight-rail/route.ts`

- Same helper stack: `parseBbox`, `bboxKey`, `cachedFc`, `emptyFc`.
- Same response caching header pattern.
- Zoom gate style matches trails (inline `Number(... ?? NaN)`).

### Gaps / follow-ups (out of scope for Task 4)

- No route integration tests (consistent with other layer routes).
- Client wiring remains for later tasks.

### Linter

`ReadLints` on `route.ts`: no issues reported.

## Concerns

None blocking.
