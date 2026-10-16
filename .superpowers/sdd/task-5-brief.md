### Task 5: Overpass helper + nightlife + abandoned

**Files:**
- Create: `src/lib/layers/overpass.ts`
- Create: `src/lib/layers/nightlife.ts`
- Create: `src/lib/layers/abandoned.ts`
- Create: `src/app/api/layers/nightlife/route.ts`
- Create: `src/app/api/layers/abandoned/route.ts`
- Test: `src/lib/layers/overpass.test.ts`

**Interfaces:**
- Produces: `overpassQuery(ql: string): Promise<any>`, nightlife/abandoned routes

- [ ] **Step 1: `overpassQuery`** POST to `https://overpass-api.de/api/interpreter` (fallback `https://overpass.kumi.systems/api/interpreter`) with timeout 25s, User-Agent `osiris-layers/1.0`.

- [ ] **Step 2: Nightlife QL** (bbox vars):

```
[out:json][timeout:25];
(
  node["amenity"~"^(bar|pub|nightclub|biergarten)$"]({{bbox}});
  node["place"="square"]({{bbox}});
  node["highway"="pedestrian"]["area"="yes"]({{bbox}});
);
out center body;
```

Map to points `kind:'ground_nightlife'`. Min zoom enforced in route: if `z` query &lt; 10 return empty. TTL 10m.

- [ ] **Step 3: Abandoned QL**:

```
[out:json][timeout:25];
(
  way["railway"~"^(abandoned|disused)$"]({{bbox}});
  node["railway"~"^(abandoned|disused)$"]({{bbox}});
  node["abandoned:industrial"]({{bbox}});
  node["industrial"]["disused"="yes"]({{bbox}});
);
out center body geom;
```

Ways → LineString when geometry present else center Point. `kind:'ground_abandoned'`, `subkind:'rail'|'industrial'`. Min zoom 10. TTL 10m.

- [ ] **Step 4: Tests** for OSM element → feature mapping with fixtures (no live Overpass in unit tests).

---
