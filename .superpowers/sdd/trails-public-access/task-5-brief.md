### Task 5: Register ground keys + LayerPanel + page defaults

**Files:**
- Modify: `src/lib/ground-layers-client.ts` â€” add `trails`, `public_access` to keys / min zoom / API
- Modify: `src/lib/ground-layers-client.test.ts` â€” hyphenated `public-access` path; zoom cases
- Modify: `src/components/LayerPanel.tsx` â€” GROUND entries after `abandoned` or near freight:
  - `{ key: 'trails', label: 'Trails', description: 'Cycle Â· hike Â· foot Â· disused rail' }`
  - `{ key: 'public_access', label: 'Public Access Land', description: 'Parks Â· protected Â· BLM' }`
- Modify: `src/app/page.tsx` â€” `trails: false`, `public_access: false`

- [ ] **Step 1: Apply registry + UI defaults**
- [ ] **Step 2: Run** `npx vitest run src/lib/ground-layers-client.test.ts` â€” PASS
- [ ] **Step 3: Commit**

```bash
git add src/lib/ground-layers-client.ts src/lib/ground-layers-client.test.ts src/components/LayerPanel.tsx src/app/page.tsx
git commit -m "feat(ui): register Trails and Public Access Land layers"
```

---

