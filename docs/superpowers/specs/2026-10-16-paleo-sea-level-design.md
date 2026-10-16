# Paleo / Sea Level layer — design

**Date:** 2026-10-16  
**Status:** Implemented  
**Approach:** Live DEM flood (−120…+70 m) + Heine-style paleocoast GeoJSON (Ma); one layer, mode switch

## Goal

LayerPanel **Paleo / Sea Level** lets the reader scrub relative sea level in meters (LGM lowstand through full ice melt) or snap to discrete geological paleoshorelines (Ma), over the Osiris map.

## Entry

- Key: `paleo_sl` — main toggle  
- Child: `paleo_sl_controls` — Time Controls (on by default with parent)  
- **Off by default**  
- Placement: near DISPLAY / Day–Night (global visual overlay)

## Control bar (PaleoBar)

- Shown when `paleo_sl` is on and `paleo_sl_controls` is on  
- Mode toggle: **Meters** | **Ma**  
- Continuous slider for the active mode  
- Readout: e.g. `−120 m · LGM`, `0 m · today`, `+70 m · all ice`, or `65 Ma`  
- Presets (meters): LGM (−120), Today (0), All ice (+70)  
- No play-loop animation in v1  
- Persist last mode + value in `localStorage` (`osiris.paleo.*`)

## Meters mode

- Range: **−120 m … +70 m** (full ice melt ceiling ≈ +70 m)  
- Step: ~1–5 m while scrubbing (implementation may snap for performance)  
- Render: elevations ≤ selected level drawn as translucent water; optional shoreline contour  
- Data: Osiris DEM / `osiris-dem` terrain tiles (or equivalent global ETOPO-class grid), coarse at world view, refined for viewport  
- Not a full ice-sheet / GIA model — static bathymetry + topography flood only  
- Attribution: DEM provider + “simple flood, not ice dynamics”

## Ma mode

- Source: Heine et al. global paleoshorelines (Golonka timesteps preferred) or equivalent CC dataset  
- Slider snaps to available ages; label `N Ma`  
- Render: MapLibre line (and fill if polygons) for paleocoast / land  
- Load one timestep GeoJSON (or vector tile) at a time; cache recently used ages  
- Attribution: Heine / Yeo / Müller (or chosen dataset) + license note

## Non-goals (v1)

- Glacial isostatic adjustment or regional uplift  
- Ice-sheet extent polygons  
- Animated scrub across Ma ages  
- Climate-certificate / property-level flood claims  
- Meter steps outside −120…+70

## Verification

- Toggle on (meters): flood tint updates with slider; −120 and +70 presets work  
- Switch to Ma: paleocoast appears for selected age; snap between ages  
- Controls off: last mode/value still drawn; bar hidden  
- Toggle off: overlay cleared  
- DEM/paleo miss: quiet empty/partial layer; map stays usable  
- Attribution visible in map credits or bar
