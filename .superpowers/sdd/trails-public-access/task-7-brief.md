### Task 7: Portable + Desktop sync

- [ ] **Step 1:** `npm run desktop:pack` (webpack build)
- [ ] **Step 2:** Robocopy `desktop/dist/win-unpacked` â†’ `C:\Users\Home\Desktop\Osiris`
- [ ] **Step 3:** Keep portable `desktop/dist/Osiris 0.1.0.exe`; optionally remove `win-unpacked` after sync to save disk

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Two toggles `trails` / `public_access` | 5 |
| OSM trail highways + abandoned rail | 1 |
| Skip private / no foot+bike | 1 |
| Zoom â‰¥ 8 trails / â‰¥ 7 land | 1â€“4 |
| OSM parks / protected | 3 |
| BLM SMA | 3â€“4 |
| Soft-fail | 1â€“4 |
| Map styles + popups | 6 |
| Off by default | 5 |
| Non-goals (no live users, keep abandoned) | respected |

## Placeholder scan

None intentional; BLM layer id `2` on Cached_BLM_Only verified against BLM service docs â€” if query 404s, fall back to LimitedScale identify layer and retest URL in Task 3.
