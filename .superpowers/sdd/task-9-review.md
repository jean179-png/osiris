# Task 9 review: Client fetch helper

**Scope:** `6b83353` → `24406b7` (task-scoped gate)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None. Required files present: `src/lib/ground-layers-client.ts`, `src/lib/ground-layers-client.test.ts`. Brief snippet exports all present: `GROUND_LAYER_KEYS` (9 keys), `GroundLayerKey`, `GROUND_MIN_ZOOM`, `GROUND_API`, `boundsToBboxParam` (west,south,east,north). Min-zoom map and hyphenated paths (`civic-311`, `historic-maps`) match the plan. |
| **Extra** | Diff is exactly those two paths (+120 lines). `GROUND_DEBOUNCE_MS` (400), `meetsGroundMinZoom`, `buildGroundLayerUrl` — documented in the report. Justified: brief test note asks for “debounce/minZoom pure bits”; URL builder matches Task 11 pseudocode (`encodeURIComponent(bbox)` + `Math.floor(z)`). Design debounce ~400ms. |
| **Misunderstood** | None. No AbortController/`fetch` wrapper here; plan leaves wiring + fetch effect to Task 11. Module is the shared keys/maps/pure helpers Task 11 will import. |

**Global constraints**

- **Vitest:** Keys/maps, debounce ms, min-zoom gates (boundary table), bbox param, URL builder; `npm test -- src/lib/ground-layers-client.test.ts` → **19 passed** (re-run in review).
- **Unrelated dirty files:** Not in diff.
- **Commit:** Focused (`feat(layers): ground layers client keys, min-zoom, and bbox helpers`).

## 2. Code quality: Approved

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None. |
| **Minor** | (1) Exact per-key `GROUND_MIN_ZOOM` literals are implied by `meetsGroundMinZoom` cases rather than a single table equality assert — coverage is still strong for gated layers. (2) Debounce is a named constant only (no timer helper); fine for this task; Task 11 will own `setTimeout(..., GROUND_DEBOUNCE_MS)`. |

## 3. Brief strengths

- Typed key union + `Record<GroundLayerKey, …>` keeps panel toggles, min-zoom gates, and API paths aligned.
- Pure helpers are easy to unit-test before MapLibre wiring.
- URL shape matches the design (`GET /api/layers/<id>?bbox=…&z=`) and Task 11 fetch pseudocode.
- Deviations are small, documented, and forward-compatible with Task 11.

## Verdict

**Ship for Task 9.** Brief exports and debounce/minZoom test surface are met at HEAD; extras are appropriate pure bits for Task 11. Quality is clean with optional test-hardening only.

---

Spec: ✅  
Quality: Approved
