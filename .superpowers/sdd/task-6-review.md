# Task 6 review: GTFS-RT + agency registry

**Scope:** `e528b06` → `1a1b815` (task-scoped gate)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None. Required files present: `public/data/layers/gtfs-agencies.json`, `src/lib/layers/gtfs.ts`, `src/app/api/layers/gtfs/route.ts`, `src/lib/layers/gtfs.test.ts`. Dependency: `gtfs-realtime-bindings@^2.2.0` in `package.json` (+ lockfile). Step 1: decode via `FeedMessage.decode` → Point features `kind:'ground_gtfs'`. Step 2: load registry, `agenciesForBbox` (skip disabled / empty URL), parallel fetch with `AbortSignal.timeout(8_000)`, merge FC, TTL `10_000` via `cachedFc`. Step 3: encoded protobuf fixture + agency filter tests. |
| **Extra** | Diff is those five paths (+ package-lock). Post-decode request-bbox filter; soft-fail per agency → `emptyFc()`; `mergeGtfsFc` + `capFeatures(..., 5000)`; feature props (agencyId/name, vehicleId, label, routeId, tripId, bearing, speed, observedAt, attribution); response `Cache-Control: public, s-maxage=10`. |
| **Misunderstood** | None on the API contract. Documented deviations are sound: (1) vehicles filtered to request bbox after decode (agency bbox alone can include out-of-view points); (2) RIPTA left `disabled: true` with empty URL — brief allows skip disabled / fill URLs when available. Seed MBTA + MTA URLs match the starter registry. |

**Global constraints**

- **Soft-fail empty FeatureCollection:** Invalid/missing bbox → `emptyFc()` HTTP 200. Registry read/parse failure → `[]` → empty. Per-agency fetch/HTTP/decode failure → catch → `emptyFc()` for that agency; others still merge. Supported.
- **Bbox required:** `parseBbox` gate present.
- **Vitest:** Protobuf encode fixture → mapper + bbox filter + agency selection; `npm test -- src/lib/layers/gtfs.test.ts` → **8 passed** (re-run in review).
- **Unrelated dirty files:** Not in diff (task files + dep only).
- **Commit:** Focused (`feat(layers): GTFS-RT vehicle positions with agency registry`).

## 2. Code quality: Approved with minor

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None blocking for this task. |
| **Minor** | (1) `gtfs-realtime-bindings` pulls `protobufjs-cli` and a large lockfile surface (jsdoc, deprecated `glob`/`inflight`, etc.); engines note `node >= 22` for that package — acceptable given the brief’s dependency choice, but heavy for decode-only use. (2) No mocked-fetch coverage of the route’s parallel fetch / 8s timeout / per-agency soft-fail (brief Step 3 scopes decode + mapper; same posture as other layer routes). (3) Soft-fail empty FC for an agency (or all) is still cached under the bbox key for the full 10s TTL. (4) RIPTA remains a placeholder; fine per brief, but no live RIPTA URL yet. |

## 3. Brief strengths

- Clean split: registry JSON → pure agency filter / decode / merge → thin Next route reusing Task 1 `parseBbox` / `bboxKey` / `cachedFc` / `emptyFc` / `pointFeature` / `capFeatures`.
- Parallel agency fetches with independent soft-fail match the multi-source ground-layers model.
- Real protobuf round-trip fixture (encode → decode) locks `ground_gtfs` kind, coords, and bbox clipping without live feeds.
- 10s TTL + `s-maxage=10` fit realtime vehicle freshness.
- Disabled / empty-URL agencies correctly excluded from fetches.

## Verdict

**Ship for Task 6.** Steps 1–3 meet the brief at HEAD; deviations are documented and acceptable. Quality is solid with optional follow-ups (lighter decode path if lockfile weight matters; mocked route fetch; fill RIPTA when a public VehiclePositions URL exists).

---

Spec: ✅  
Quality: Approved with minor
