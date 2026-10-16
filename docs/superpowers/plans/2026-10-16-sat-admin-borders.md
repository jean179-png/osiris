# SAT admin borders — Implementation Plan

**Goal:** GeoJSON line overlays for countries, US states, and Canadian provinces; default on in satellite view.

## Files

- `public/data/admin-borders.json` — bundled NE 110m countries + 50m US/CA admin-1 lines (~570 KB)
- `src/lib/admin-borders.ts` — load local JSON, CDN fallback merge
- `src/components/OsirisMap.tsx` — source + halo/line layers above imagery, under day/night
- `src/components/LayerPanel.tsx` — `admin_borders` under DISPLAY
- `src/app/page.tsx` — default off; sync on `mapStyle` dark ↔ satellite

## Behaviour

- Toggle `admin_borders` in Layer Panel (DISPLAY → Admin borders).
- SAT view turns layer on; MAP/dark turns it off (v1, no session sticky-off).
- Thin cyan/off-white stroke with dark halo; globe and mercator.

## Verify

- SAT: borders visible over imagery at z4–8.
- MAP: layer off by default and lines hidden.
- Manual toggle updates visibility without reload.
