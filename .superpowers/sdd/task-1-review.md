# Task 1 review: Shared layer lib

**Scope:** `8d9baa2` → `87b4e33` (task-scoped gate)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None material. All required files under `src/lib/layers/`, all listed APIs present (`parseBbox`, `roundBbox`, `bboxKey`, `cachedFc`, `emptyFc`, `pointFeature`, `capFeatures`; `featureOf` as in brief Step 3). Vitest files match brief structure; bbox/cache tests cover the brief scenarios. |
| **Extra** | None. Diff touches only the six layer files. |
| **Misunderstood** | None in **final** HEAD. The follow-up commit correctly restored `Math.floor` on `west` and expanded the `roundBbox` test (west `-71.13`, south/east/north expansion). That resolves the inconsistency in the brief’s Step 1 test (`-71.12`) vs Step 3 implementation (`floor` on west). |

**Global constraints**

- **Soft-fail empty FeatureCollection:** `cachedFc` catch path and placeholder entries use an empty `FeatureCollection`; `emptyFc()` exists for callers and tests. Supported; not exercised by tests (see quality notes).
- **Focused `src/lib/layers/`:** Yes.
- **Vitest patterns:** Standard `describe` / `it` / `expect` / `vi.fn`; test reset via `_resetLayerCacheForTests`.
- **Unrelated dirty files:** Not in diff.

## 2. Code quality: Approved (Minor)

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None blocking for this task. Cache error soft-fail is implemented but untested; worth a small test when routes depend on it. |
| **Minor** | `cache.ts` inlines `{ type: 'FeatureCollection', features: [] }` instead of importing `emptyFc()` (brief did the same; small DRY drift risk). No tests for `bboxKey`, span cap, or boundary validation beyond the brief’s parse cases. `store.get(key)!.fc` in the catch handler assumes the entry was just set (safe for normal use). |

## 3. Brief strengths

- Clean separation: `types`, bbox parsing/keys, GeoJSON builders, and TTL/inflight cache in focused modules.
- `parseBbox` includes inversion, world bounds, finite-number checks, and 40° span cap as specified.
- `roundBbox` uses outward expansion (floor west/south, ceil east/north), appropriate for stable, slightly enlarged cache keys.
- `cachedFc` dedupes inflight work and respects TTL on success; failure path logs, short negative cache, and returns stale or empty FC for soft-fail downstream.
- TDD flow documented (RED → implement → GREEN); second commit shows deliberate correction rather than papering over a spec/test mismatch.
- `capFeatures` avoids copying when under limit; `pointFeature` / `featureOf` normalize `id` in properties per brief.

## Verdict

**Ship for Task 1.** Meets the brief and global constraints at HEAD; quality is solid with optional follow-ups (shared `emptyFc` in cache, soft-fail cache test, extra bbox edge tests).
