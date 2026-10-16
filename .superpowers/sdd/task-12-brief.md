### Task 12: End-to-end verification

- [ ] **Step 1:** `npm test` — all new layer unit tests pass  
- [ ] **Step 2:** `npm run dev` — toggle each GROUND layer over:
  - Providence (nightlife, gauges if any, historic if seeded, 311 if registry hits)
  - Boston Harbor / Cape (wrecks)
  - Inland MA (wrecks empty)
  - UAP nationwide zoomed out (city precision note)
  - Transit city with working GTFS URL (moving dots)
- [ ] **Step 3:** Confirm defaults remain off on fresh load  
- [ ] **Step 4:** Commit series if not committed per task

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Shared bbox/cache | T1 |
| gauges | T2 |
| wrecks | T3 |
| uap + city precision | T4, T11 |
| nightlife Overpass | T5 |
| abandoned rail/industrial | T5 |
| gtfs + registry | T6 |
| civic_311 + vacant + registry | T7 |
| historic footprints only | T8 |
| LayerPanel GROUND | T10 |
| MapLibre wiring + debounce | T9, T11 |
| Default off | T10 |
| Soft-fail empty FC | T2–T8 |
| Attribution | T11 |
| Min zooms | T5, T7, T9, T11 |

## Placeholder scan

No TBD steps; live URL verification for GTFS/municipal seeds happens inside Tasks 6–7 with `disabled: true` escape for broken feeds.

## Type consistency

- Layer keys: `uap|wrecks|abandoned|nightlife|gtfs|gauges|civic_311|vacant|historic_maps`
- API paths use hyphens: `civic-311`, `historic-maps`
- Feature `properties.kind`: `ground_<key>` with `civic_311` → `ground_civic_311`
