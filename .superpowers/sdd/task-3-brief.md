### Task 3: NOAA wrecks API

**Files:**
- Create: `src/lib/layers/wrecks.ts`
- Create: `src/app/api/layers/wrecks/route.ts`
- Test: `src/lib/layers/wrecks.test.ts`

**Interfaces:**
- Produces: `GET /api/layers/wrecks?bbox=`

- [ ] **Step 1: Implement query against NOAA ArcGIS**

Use FeatureServer/MapServer query:

`https://gis.charttools.noaa.gov/arcgis/rest/services/public_wrecks/Wrecks_And_Obstructions/MapServer/0/query?where=1%3D1&geometry=west,south,east,north&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&f=geojson&resultRecordCount=2000`

Map properties to `{ kind:'ground_wrecks', name, featureType, attribution:'NOAA' }`. Soft-fail empty FC. TTL 5m. Reuse `parseBbox` / `cachedFc` / `capFeatures`.

- [ ] **Step 2: Unit-test a small fixture mapper** for geometry Point/MultiPoint → features.

- [ ] **Step 3: Smoke coastal MA bbox** vs inland empty.

---
