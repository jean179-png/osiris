### Task 8: Historic map footprints

**Files:**
- Create: `public/data/layers/historic-map-footprints.geojson`
- Create: `src/app/api/layers/historic-maps/route.ts`

- [ ] **Step 1: Seed GeoJSON** with ~10–20 US city Sanborn/LOC footprint polygons (rough city bbox rectangles OK for v1) with properties `{ title, city, year, locUrl, attribution:'Library of Congress' }`.

- [ ] **Step 2: Route** filters features intersecting bbox (simple bbox-overlap on feature bbox); return FC. No upstream network required.

---
