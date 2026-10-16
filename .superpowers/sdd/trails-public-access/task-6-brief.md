### Task 6: OsirisMap render + popups

**Files:**
- Modify: `src/components/OsirisMap.tsx`

**Colors:** `trails: '#66BB6A'`, `public_access: '#26A69A'`

**Layers:**
- `trails`: line only; optionally `line-color` by `['match', ['get', 'subkind'], ...]` (cycle `#43A047`, hike `#FFA726`, foot `#4FC3F7`, bridle `#8D6E63`, rail_trail `#C0A062`, other `#66BB6A`).
- `public_access`: fill (`fill-opacity` 0.2) + outline line; color match on `subkind` (blm `#D4A574`, park `#66BB6A`, protected `#26A69A`, â€¦).
- Add `ground-trails-line`, `ground-public_access-fill`, `ground-public_access-line` to hover cursor list and `groundPopupLayers`.
- Popup: trails â†’ name + subkind; public_access â†’ name + agency + subkind + short â€œPublic passage land â€” not a permit.â€
- Effect deps: `activeLayers.trails`, `activeLayers.public_access`.

- [ ] **Step 1: Wire sources (auto via GROUND_LAYER_KEYS loop) + paint branches**
- [ ] **Step 2: Manual smoke when pack/dev available â€” toggle both at z9 over Colorado / Utah**
- [ ] **Step 3: Commit**

```bash
git add src/components/OsirisMap.tsx
git commit -m "feat(map): render Trails lines and Public Access fills"
```

---

