# Task 10 report — LayerPanel GROUND group + page defaults

## Done
- `src/components/LayerPanel.tsx` — imported `MapPinned`; inserted GROUND / GROUND TRUTH group before DISPLAY with nine layers (`uap`, `wrecks`, `abandoned`, `nightlife`, `gtfs`, `gauges`, `civic_311`, `vacant`, `historic_maps`)
- `src/app/page.tsx` — added nine `activeLayers` keys, all `false`

## Preserved WIP (same commit)
- Curiosities Atlas row in THREAT + `curiosities: false` default
- Existing `STARTUP_CITY` / `STARTUP_ZOOM` landing changes already in working tree (not reverted)

## Not touched
- `OsirisMap.tsx` (Task 11)
- CCTV and other unrelated files (left unstaged)

## Commit
`5ca9c660e4c7572ebf3aab01f3e5c8b38a8a1f31`

## Deviations
- None vs Task 10 scope; commit also includes pre-existing WIP in the two allowed files so it was not discarded.
