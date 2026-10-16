### Task 7: Municipal registry + 311 + vacant

**Files:**
- Create: `public/data/layers/municipal-endpoints.json`
- Create: `src/lib/layers/municipal.ts`
- Create: `src/app/api/layers/civic-311/route.ts`
- Create: `src/app/api/layers/vacant/route.ts`
- Test: `src/lib/layers/municipal.test.ts`

**Registry shape:**

```json
[
  {
    "id": "boston",
    "name": "Boston",
    "bbox": [-71.2,42.2,-70.9,42.4],
    "threeOneOne": { "type": "socrata", "url": "https://data.boston.gov/resource/....json", "latField": "latitude", "lngField": "longitude", "limit": 1000 },
    "vacant": { "type": "arcgis", "url": "https://services.arcgis.com/.../FeatureServer/0/query", "latField": "y", "lngField": "x" }
  }
]
```

Seed 4–8 cities with verified public endpoints (Boston, NYC, Chicago, SF, Providence if available). Omit `vacant` when unavailable.

- [ ] **Step 1: `citiesForBbox(registry, bbox)`** intersect test.

- [ ] **Step 2: Fetch adapters** for Socrata `$where` / ArcGIS geometry envelope; normalize to points `kind:'ground_civic_311'|'ground_vacant'`. Min zoom 10. TTL 3m.

- [ ] **Step 3: Routes** soft-fail per city; merge survivors.

---
