# Task 5 Report: Register ground keys + LayerPanel + page defaults

## Status

**DONE**

## Summary

Registered `trails` and `public_access` in `ground-layers-client` (min zoom 8 / 7, API paths `/api/layers/trails` and `/api/layers/public-access`). Added GROUND toggles in `LayerPanel` after Abandoned Rail, and default-off entries in `page.tsx` `activeLayers`. Preserved existing `freight_rail` registry entries.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/ground-layers-client.ts` | Keys, `GROUND_MIN_ZOOM`, `GROUND_API` for `trails`, `public_access` |
| `src/lib/ground-layers-client.test.ts` | Hyphenated `public-access` path; zoom gate cases for both layers |
| `src/components/LayerPanel.tsx` | GROUND entries: Trails, Public Access Land |
| `src/app/page.tsx` | `trails: false`, `public_access: false` |

## Registry

| Key | Min zoom | API |
|-----|----------|-----|
| `trails` | 8 | `/api/layers/trails` |
| `public_access` | 7 | `/api/layers/public-access` |

## Tests

```text
npx vitest run src/lib/ground-layers-client.test.ts
```

**Working directory:** `C:\pinokio\api\osiris`

**Output:**

```text
 ✓ src/lib/ground-layers-client.test.ts (24 tests) 4ms

 Test Files  1 passed (1)
      Tests  24 passed (24)
```

**Exit code:** 0

## Commit

- **SHA:** `6e3e394`
- **Subject:** `feat(ui): register Trails and Public Access Land layers`
- **Branch:** `feat/osiris-desktop`

## Self-Review

### Alignment with brief

- All four files updated; commit message matches brief.
- LayerPanel labels/descriptions match spec.
- `freight_rail` unchanged in client registry.

### Follow-ups (later tasks)

- OsirisMap rendering, colors, popups (Task 6).
- End-to-end toggle behavior with viewport fetch (Task 7).

### Concerns

None blocking.
