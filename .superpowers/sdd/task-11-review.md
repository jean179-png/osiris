# Task 11 review: OsirisMap GROUND sources, layers, fetch, popups

**Scope:** `072aa6b` → `c5b9a6e` (`src/components/OsirisMap.tsx` only in the task commit; +565/−8)

## 1. Spec compliance: ✅

| Step | Status | Notes |
|------|--------|--------|
| **1 Register sources** | ✅ | Loop over `GROUND_LAYER_KEYS` adds `ground-<key>` GeoJSON sources next to curiosities. Cluster on `uap` \| `nightlife` \| `civic_311` (`GROUND_CLUSTER_KEYS`, `clusterMaxZoom: 12`, `clusterRadius: 42`). |
| **2 Paint layers** | ✅ | Circles for points; `ground-abandoned-line` + `ground-abandoned-dots` (geometry filters); historic `fill` + cyan outline. `GROUND_COLORS` uses cyan / amber / slate (no purple glow). |
| **3 Fetch effect** | ✅ | `moveend` debounce via `GROUND_DEBOUNCE_MS` (400); per-key AbortController; min-zoom → `EMPTY_FC`; `buildGroundLayerUrl` + `boundsToBboxParam`; GTFS 20s poll + visibility resume. Deps list all nine keys: `uap`, `wrecks`, `abandoned`, `nightlife`, `gtfs`, `gauges`, `civic_311`, `vacant`, `historic_maps`. |
| **4 Click / popups** | ✅ | Handlers on all feature layers; cluster expand for the three clustered sources. Popup shows name/kind/attribution; UAP line `Approximate location (city-level).`; historic `locUrl` → Library of Congress link when present. |
| **5 Hover / front arrays** | ✅ | Ground layer ids appended to the generic hover-cursor array alongside `curiosities-dots` / curiosities clusters. No separate bring-to-front array listing `curiosities-dots` beyond that hover list; Step 5 satisfied. |

**Global constraints**

- **Files:** Task commit touches only `OsirisMap.tsx` as required.
- **Bundled WIP:** Curiosities atlas sources/layers/notes/fetch and related `setVis` land in the same commit (report: preserved, not discarded). Out of Task 11 core but consistent with prior SDD WIP notes.
- **Verification:** Report claims `tsc --noEmit` exit 0; no live map toggle (Task 12).

**Important-gate checks (brief + review instructions)**

| Gate | Result |
|------|--------|
| Fetch effect deps miss keys? | **No** — all nine `activeLayers.*` deps present (`OsirisMap.tsx` ~2754–2765). |
| Sources never added? | **No** — all nine via `GROUND_LAYER_KEYS` (~497–509). |
| Popups missing UAP / historic notes? | **No** — UAP city-level note + historic `locUrl` link (~1902–1903). |

## 2. Code quality: Approved

| Severity | Item |
|----------|------|
| **Critical** | None. |
| **Important** | None. Gates above are clean. |
| **Minor** | (1) Ground paint layers are not wired into the `setVis` visibility effect (curiosities are); off-state relies on `EMPTY_FC` only, which matches the brief’s fetch pseudocode and is functionally fine. (2) `ground-*-cluster-count` omitted from hover cursor (same pattern as curiosities cluster-count). (3) Fetch does not check `r.ok` before `r.json()` — failed HTTP may set odd payloads; brief allows keep-last on catch. (4) Commit also includes curiosities + local style / startup-lng deltas already in the dirty tree — acceptable per report, not Task 11 scope. |

## 3. Brief strengths

- Uses shared `ground-layers-client` helpers (`GROUND_LAYER_KEYS`, min zoom, debounce, bbox, URL builder) instead of duplicating API paths.
- Fetch cleanup aborts in-flight requests; GTFS poll skips when `document.hidden` and refreshes on visibility — stronger than the brief’s empty `onVis` stub.
- Popup key parsing from layer id (`abandoned-line` / `historic_maps-fill` / `civic_311-dots`) is correct; UAP note also keys off `keyFromLayer === 'uap'`.
- Cluster expand mirrors curiosities UX for the three dense layers.

## Verdict

**Task 11 is complete.** Spec ✅. No Important gaps on sources, fetch deps, or UAP/historic popups. Proceed to Task 12 verification.

---

Spec: ✅  
Quality: Approved
