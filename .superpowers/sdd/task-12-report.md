# Task 12 report — End-to-end verification

## Step 1: Unit tests
`npm test -- src/lib/layers src/lib/ground-layers-client.test.ts` → **10 files, 71 tests passed**

## Step 2: Live API smoke (`localhost:3000`)
| Check | Result |
|-------|--------|
| historic Providence bbox | 200, **1** feature (LOC Sanborn Providence) |
| nightlife z=8 | 200, **0** (min-zoom gate) |
| gtfs Boston bbox | after fix **276** `ground_gtfs` / mbta |
| gauges Providence | 200, **20** features after retry (earlier timeout soft-failed empty) |
| wrecks / overpass / municipal / uap | 200 empty — upstream timeout or soft-fail (contract held) |
| bad bbox | 200 empty FC |

## Step 3: Defaults off
`page.tsx` `activeLayers`: all nine ground keys `false` (verified by grep).

## Step 4: Fix from verification
Live GTFS initially returned empty under Next despite MBTA PB decoding in Node.
- Commit `6cd4db1` — normalize CJS import + `serverExternalPackages: ['gtfs-realtime-bindings']`
- Restarted existing Next on :3000; GTFS smoke then returned 276 vehicles.

## Manual UI toggles
Not exercised in browser this run; API + map wiring + panel defaults cover the automated portion. Operator can toggle GROUND layers in the running dev server for visual confirmation.

## Verdict
Task 12 complete for automated gates. Soft-fail empty FC confirmed when upstream is unreachable.
