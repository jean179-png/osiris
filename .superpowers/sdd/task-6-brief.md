### Task 6: GTFS-RT + agency registry

**Files:**
- Create: `public/data/layers/gtfs-agencies.json`
- Create: `src/lib/layers/gtfs.ts`
- Create: `src/app/api/layers/gtfs/route.ts`
- Test: `src/lib/layers/gtfs.test.ts`
- Dependency: add `gtfs-realtime-bindings` (or `@bufbuild/protobuf` feed decode) in `package.json`

**Seed registry** (starter):

```json
[
  { "id": "mbta", "name": "MBTA", "vehicleUrl": "https://cdn.mbta.com/realtime/VehiclePositions.pb", "bbox": [-71.9,41.5,-69.9,42.9] },
  { "id": "mta-bus", "name": "MTA NYCT Bus", "vehicleUrl": "https://gtfsrt.prod.obanyc.com/vehiclePositions", "bbox": [-74.3,40.4,-73.6,41.0] },
  { "id": "riptide", "name": "RIPTA", "vehicleUrl": "", "bbox": [-71.9,41.3,-71.1,42.0], "disabled": true }
]
```

Fill working public vehicle URLs during implementation; skip disabled.

- [ ] **Step 1: Install** `gtfs-realtime-bindings` and decode VehiclePosition entities to points.

- [ ] **Step 2: Route** loads registry, picks agencies intersecting bbox, fetches PB in parallel (timeout 8s each), merges FC `kind:'ground_gtfs'`. TTL 10s via `cachedFc`.

- [ ] **Step 3: Test** decode with a tiny fixture buffer or mocked entity list mapper.

---
