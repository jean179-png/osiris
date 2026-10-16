# Task 6 Report: OsirisMap render + popups

## Status

**DONE**

## Summary

Trails render as a line layer with `subkind` colors. Public access land renders as a fill (opacity 0.2) plus outline, tinted by `subkind`. Both are on the hover cursor list and ground popup layers. Popups show trail name + subkind, and public-access name + agency + subkind plus “Public passage land — not a permit.” Viewport refresh deps include `activeLayers.trails` and `activeLayers.public_access`. Sources stay on the existing `GROUND_LAYER_KEYS` loop.

`GROUND_COLORS` now has `trails` (`#66BB6A`), `public_access` (`#26A69A`), and `freight_rail` (`#FF8F00`), which was missing from the committed record.

## Files Modified

| File | Change |
|------|--------|
| `src/components/OsirisMap.tsx` | Colors, trail line paint, public-access fill + outline, hover, popups, effect deps |

## Styles

| Layer | Paint |
|-------|--------|
| `ground-trails-line` | `match` on `subkind`: cycle `#43A047`, hike `#FFA726`, foot `#4FC3F7`, bridle `#8D6E63`, rail_trail `#C0A062`, fallback `#66BB6A` |
| `ground-public_access-fill` | `fill-opacity` 0.2; `match` blm `#D4A574`, park `#66BB6A`, protected `#26A69A`, else layer color |
| `ground-public_access-line` | Same color match, width 1.5, opacity 0.85 |

`open_access`, `federal`, and `other` use the public-access fallback `#26A69A`. No geometry filter, so Polygon and MultiPolygon both draw.

## Tests

`npx tsc --noEmit --pretty false --incremental false` (working directory `C:\pinokio\api\osiris`).

On the committed map file, `OsirisMap.tsx` reported no errors from the new paint or `GROUND_COLORS`. A later working-tree check reports only:

```text
src/components/OsirisMap.tsx(66,41): error TS2307: Cannot find module '@/lib/flight-altitude'
```

That import is in the commit and matches `HEAD`’s `src/lib/flight-altitude.ts`. The module is deleted only in the uncommitted working tree (pre-existing). Other `tsc` failures (`.next/types` route extras, `public-access.test.ts` empty tuple) are outside this task.

Manual smoke (toggle both layers at z9 over Colorado / Utah) was not run. Nothing was listening on `127.0.0.1:3000`.

## Commit

- **SHA:** `12a726d`
- **Subject:** `feat(map): render Trails lines and Public Access fills`
- **Branch:** `feat/osiris-desktop`

The commit is only the trail / public-access map work plus the missing `freight_rail` color. It does not include the pre-existing uncommitted flight-stem removal or freight-rail line/popup wiring. Those edits were put back in the working tree after the commit so they were not dropped.

## Self-Review

### Alignment with brief

- Only `src/components/OsirisMap.tsx` was committed.
- Trail line and public-access fill + outline follow the abandoned / trains line-layer loop.
- Hover list and `groundPopupLayers` include `ground-trails-line`, `ground-public_access-fill`, and `ground-public_access-line`.
- Effect deps include `activeLayers.trails` and `activeLayers.public_access`.
- Commit message matches the brief.

### Concerns

- No live map smoke. Dev server was down; desktop pack is Task 7.
- Public-access `open_access`, `federal`, and `other` share the teal fallback. The brief specified colors only for blm, park, and protected.
- The design note “path geometry” on trail popups was not added. The brief asks for name + subkind only.
- Working tree `OsirisMap.tsx` is still dirty with earlier local edits (flight stems removed, freight-rail line/popup/deps). Those are not in `12a726d`.
