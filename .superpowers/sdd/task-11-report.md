# Task 11 report — OsirisMap GROUND sources, layers, fetch, popups

## Done
- `src/components/OsirisMap.tsx`
  - Sources `ground-<key>` for all nine `GROUND_LAYER_KEYS`; cluster on `uap` | `nightlife` | `civic_311`
  - Paint: circles for points; `ground-abandoned-line` + dots; historic fill + cyan outline
  - Cyan / amber / slate hues (`GROUND_COLORS`)
  - Fetch effect: `moveend` debounce `GROUND_DEBOUNCE_MS` (400), min-zoom empty FC, AbortController per key, GTFS 20s poll + visibility resume
  - Click → popup (name/kind/attribution); UAP city-level note; historic `locUrl` LOC link; cluster expand
  - Ground layer ids added to hover cursor array next to `curiosities-dots`

## Preserved WIP
- Curiosities atlas sources/layers/notes editor/fetch left intact; ground wiring added alongside

## Not touched
- CCTV and other unrelated dirty/untracked files (left unstaged)
- Task 12 verification

## Commit
`c5b9a6e89ac57712568644103a489a3ad4448958`

## Verification
- `npx tsc --noEmit -p tsconfig.json` exit 0
- Static review against Task 11 steps 1–5 + `ground-layers-client` helpers
- No live map toggle (Task 12)

## Deviations
- None vs Task 11 scope; commit includes pre-existing curiosities WIP already in `OsirisMap.tsx` so it was not discarded
