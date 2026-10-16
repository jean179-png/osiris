### Task 3: Public access OSM + BLM lib (TDD)

**Files:**
- Create: `src/lib/layers/public-access.ts`
- Create: `src/lib/layers/public-access.test.ts`

**Interfaces:**
- Produces: `PUBLIC_ACCESS_MIN_ZOOM = 7`, `publicAccessOsmQl(bbox)`, `mapPublicAccessOsmToFc(data)`, `buildBlmSmaUrl(bbox)`, `mapBlmSmaGeoJsonToFc(gj)`, `fetchPublicAccess(bbox, zoom)`, `mergePublicAccessFc(parts)`
- Feature props: `kind: 'ground_public_access'`, `subkind: 'park'|'protected'|'open_access'|'blm'|'federal'|'other'`, `name`, `agency`, `attribution`

**BLM endpoint (v1 BLM-only filter):**  
`https://gis.blm.gov/natl/rest/services/lands/BLM_Natl_SMA_Cached_BLM_Only/MapServer/2/query`  
Query: envelope geometry, `f=geojson`, `outFields=*`, `resultRecordCount=2000`, `outSR=4326`.

- [ ] **Step 1: Write failing tests** for QL contents, OSM polygon mapping (skip `access=private`), BLM URL contains `geometryType=esriGeometryEnvelope` and `f=geojson`, BLM FeatureCollection â†’ `subkind: 'blm'`.

- [ ] **Step 2: Run â€” expect FAIL**

Run: `npx vitest run src/lib/layers/public-access.test.ts`

- [ ] **Step 3: Implement**

OSM QL:

```
[out:json][timeout:25];
(
  way["leisure"~"^(park|nature_reserve)$"]({{bbox}});
  relation["leisure"~"^(park|nature_reserve)$"]({{bbox}});
  way["boundary"="protected_area"]({{bbox}});
  relation["boundary"="protected_area"]({{bbox}});
  way["access"="yes"]["leisure"]({{bbox}});
  relation["access"="yes"]["leisure"]({{bbox}});
);
out geom;
```

Map closed ways / multipolygon relations to Polygon/MultiPolygon (reuse abandoned-style geom walk for ways; for relations use `members` outer ways if Overpass returns full geom â€” prefer `out geom` on ways only for v1 if relations are fragile: **v1 query ways only** + `out geom` to keep mapper simple).

BLM: `fetch` GeoJSON, map each feature â†’ `kind: 'ground_public_access'`, `subkind: 'blm'`, `name` from `ADMIN_UNIT_NAME` or `Name`, `agency: 'BLM'`, `attribution: 'BLM'`.

`fetchPublicAccess`: if zoom < 7 return empty; `Promise.all` OSM + BLM (BLM only if bbox intersects roughly US: westâ‰¥-180, eastâ‰¤-50, southâ‰¥15, northâ‰¤72); merge with `capFeatures` 4000.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/layers/public-access.ts src/lib/layers/public-access.test.ts
git commit -m "feat(layers): public access OSM + BLM mappers"
```

---

