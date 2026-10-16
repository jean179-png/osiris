### Task 5: Docs + `.gitignore` for desktop artifacts

**Files:**
- Create: `docs/DESKTOP.md`
- Modify: `.gitignore` — add `desktop/dist/`, `desktop/resources/standalone/`, `desktop/resources/node/`

**Content for DESKTOP.md (required sections):**

1. Prerequisites (Node 22+)
2. Dev: terminal A `npm run dev`; terminal B `npm run desktop:dev`
3. Pack current OS: `npm run desktop:pack` → artifacts in `desktop/dist/`
4. Optional `.env` location: Electron userData `Osiris/.env` (list common keys: `AIS_API_KEY`, `OI_*`, `ETHERSCAN_API_KEY`, `HELIUS_API_KEY`, `SDK_INGEST_KEY` — note features degrade without them)
5. Security note: server listens on 127.0.0.1 only
6. Unsigned macOS / SmartScreen caveats for v1

- [ ] **Step 1: Write docs + gitignore**
- [ ] **Step 2: Commit**

```bash
git add docs/DESKTOP.md .gitignore
git commit -m "docs(desktop): portable app usage and env locations"
```

---
