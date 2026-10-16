# Task 6 report — GTFS-RT + agency registry

## Done
- `public/data/layers/gtfs-agencies.json` — seed registry (MBTA + MTA NYCT Bus verified 200; RIPTA disabled / empty URL)
- `src/lib/layers/gtfs.ts` — `agenciesForBbox`, `decodeVehiclePositions` → Point features `kind:'ground_gtfs'`, `mergeGtfsFc`
- `src/app/api/layers/gtfs/route.ts` — load registry, intersect bbox, parallel fetch (8s timeout each), soft-fail per agency, TTL 10s via `cachedFc`
- Dependency: `gtfs-realtime-bindings@^2.2.0`
- `src/lib/layers/gtfs.test.ts` — encoded protobuf fixture + agency filter tests

## Tests
`npm test -- src/lib/layers/gtfs.test.ts` → **PASS** (8 tests)

## Commit
`1a1b8155b690b572a10b3b9c1732404b8731e960`

## Deviations
- Vehicle points are filtered to the request bbox after decode (agency selection alone can still return out-of-view vehicles).
- RIPTA left `disabled: true` with empty `vehicleUrl` (no public VehiclePositions URL filled).
