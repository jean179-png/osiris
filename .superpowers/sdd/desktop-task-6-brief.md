### Task 6: End-to-end verification

**Files:** none required (verification only); fix bugs in prior files if found.

- [ ] **Step 1: Unit tests**

Run: `npx vitest run desktop/lib`

Expected: all pass

- [ ] **Step 2: Dev window**

Run: `npm run dev` + `npm run desktop:dev`

Expected: map UI loads; GROUND toggles work if on that branch

- [ ] **Step 3: Production pack (Windows host)**

Run: `npm run desktop:pack`

Expected: portable exe/zip under `desktop/dist/`; launching it shows Osiris; Task Manager shows child Node; quitting kills child; `http://127.0.0.1:<port>` not bound to `0.0.0.0` (check child env / netstat Local Address 127.0.0.1)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A desktop package.json
git commit -m "fix(desktop): address pack/runtime verification issues"
```

(Skip empty commit if clean.)

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Electron + standalone + loopback | T3 |
| Health wait + error dialog | T3 |
| Single-instance + kill on quit | T3 |
| Portable win/mac/linux targets | T4 |
| `desktop:dev` / `desktop:pack` | T4 |
| userData `.env` | T1, T3 |
| Cache dirs under user cache | T3 `buildChildEnv` |
| contextIsolation / no nodeIntegration | T2 |
| Vercel standalone untouched | T4 (no next.config change) |
| Docs | T5 |
| No auto-update / signing | T4/T5 (omitted) |

## Placeholder scan

None intentional. Node binary download must implement a real URL pattern for Node 22 distro tarballs/zips (nodejs.org).

## Type consistency

- Helpers live under `desktop/lib/*.mjs` (ESM).
- Env injection keys: `HOSTNAME`, `PORT`, `OSIRIS_CCTV_SNAPSHOT`, `OSIRIS_NOMINATIM_CACHE`, `OSIRIS_USER_DATA`.
- Dev flag: `OSIRIS_DESKTOP_DEV=1`.
