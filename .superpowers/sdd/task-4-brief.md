### Task 4: UAP / NUFORC API

**Files:**
- Create: `src/lib/layers/uap.ts`
- Create: `src/app/api/layers/uap/route.ts`
- Test: `src/lib/layers/uap.test.ts`

**Interfaces:**
- Produces: `GET /api/layers/uap?bbox=`

- [ ] **Step 1: Fetch** `https://theuapatlas.com/api/export?format=json&from=2015&to=2026&limit=5000&offset=0` (page if needed), filter points inside bbox client-side on server, set `precision: 'city'` and `attribution: 'NUFORC via The UAP Atlas'`. Cap 2000. TTL 30m. Cache full export separately under key `uap:export:v1` for 30m then filter by bbox in memory.

- [ ] **Step 2: Test filter-by-bbox helper** with fixture rows.

---
