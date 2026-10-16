# Task 10 review: LayerPanel GROUND group + page defaults (re-review)

**Scope:** `24406b7` → `072aa6b` (task-scoped gate; prior HEAD `5ca9c66` + fix `072aa6b`)

## 1. Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Missing** | None for Task 10. `MapPinned` imported; GROUND / GROUND TRUTH group inserted immediately before DISPLAY; nine layers match the brief (`uap`, `wrecks`, `abandoned`, `nightlife`, `gtfs`, `gauges`, `civic_311`, `vacant`, `historic_maps`) with labels, empty `dataKey`, and descriptions as specified. `page.tsx` `activeLayers` adds the same nine keys, all `false`. Keys align with Task 9 `GROUND_LAYER_KEYS`. |
| **Extra** | Curiosities Atlas row in THREAT + `curiosities: false` default — allowed WIP bundling; GROUND is complete. Landing rewrite in `page.tsx` (`STARTUP_CITY` / `STARTUP_ZOOM`) plus committed exports in `landing-cities.ts` (+ tests) — out of Task 10 core scope but now self-contained. |
| **Misunderstood** | None for GROUND. Panel group + off-by-default keys are exactly what the brief asks; map wiring correctly left to Task 11 / `OsirisMap.tsx`. |

**Global constraints**

- **Files:** Task range touches `LayerPanel.tsx`, `page.tsx`, `landing-cities.ts`, `landing-cities.test.ts`. Unrelated dirty CCTV/curiosities paths remain uncommitted and out of scope.
- **Visual check:** Not re-run in this review (no UI session); structure places GROUND before DISPLAY with nine toggles defaulting off via `activeLayers`.
- **Commits:** `5ca9c66` GROUND + defaults; `072aa6b` closes the `STARTUP_*` export gap.

## 2. Code quality: Approved

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | **Resolved.** Prior review: `page.tsx` imported `STARTUP_CITY` / `STARTUP_ZOOM` but `5ca9c66` `landing-cities.ts` did not export them (exports lived only in the working tree). Fix commit `072aa6b` adds committed `export const STARTUP_CITY` and `STARTUP_ZOOM` (North Attleboro, zoom 11.5) plus tests. Verified: `HEAD:src/lib/landing-cities.ts` exports both; `HEAD:src/app/page.tsx` imports and uses them; clean checkout of `072aa6b` resolves the symbols. |
| **Minor** | (1) Bundled curiosities panel row is fine per gate notes; no map wiring here. (2) Middle-dot in descriptions is correct in file content. |

## 3. Brief strengths

- GROUND group matches the brief snippet one-for-one (order, keys, labels, descriptions, `MapPinned`, placement before DISPLAY).
- Defaults are consistently `false` for all nine ground keys (and curiosities).
- No premature `OsirisMap` / fetch wiring — correct Task 10 / 11 boundary.
- Landing WIP is now commit-complete: import/export pair ships together.

## Verdict

**Task 10 is complete.** Spec ✅. Prior Important landing export gap is fixed at `072aa6b`. Proceed to Task 11.

---

Spec: ✅  
Quality: Approved
