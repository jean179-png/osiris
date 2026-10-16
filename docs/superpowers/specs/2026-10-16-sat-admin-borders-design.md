# Admin borders on satellite basemap

**Date:** 2026-10-16  
**Status:** Approved  
**Approach:** A — GeoJSON line overlays (countries + US states + Canadian provinces)

## Goal

On satellite imagery, show national borders, US state borders, and Canadian province borders so political boundaries remain readable without labels cluttering the globe.

## Behaviour

1. **Layer toggle**  
   A Layer Panel key (e.g. `admin_borders`) controls visibility.

2. **Default with style**  
   - When map style switches to **satellite**: turn the layer **on** (unless the operator has explicitly turned it off this session — optional sticky; v1 may simply default on for satellite).  
   - When map style is **dark** (or non-satellite): turn the layer **off**.

3. **Geometry**  
   Three line sets, one source or three siblings:
   - Sovereign country boundaries (coastlines + land borders)
   - United States states
   - Canadian provinces / territories  

   Source: static GeoJSON (bundled under `public/data/` or fetched from a trusted CDN such as Natural Earth–derived simplified lines). Prefer simplified coastlines suitable for z3–z10.

4. **Style**  
   Thin, semi-opaque stroke (e.g. light cyan / off-white) with slight halo or opacity so lines read on both desert and ocean imagery. No fill. No labels in v1.

5. **Projection**  
   Works in globe and mercator; lines follow the basemap like other GeoJSON overlays.

## Non-goals

- County / municipality boundaries  
- Disputed-area special casing beyond what the source file already encodes  
- Baking borders into the ArcGIS/World Imagery style JSON  
- Vector-tile admin stack (can revisit if GeoJSON size or simplification is insufficient)

## Layer panel

- Place under DISPLAY (or an equivalent map-chrome group) as “Borders” / “Admin borders”.
- Description: “Countries, US states, Canadian provinces — default on in SAT view.”

## Testing

- Toggle on/off updates map layer visibility.
- Switching to SAT enables borders; switching to MAP/dark disables (per default rule).
- Smoke: US/Canada/international land borders visible over imagery at mid zoom.

## Implementation order

After aircraft 3D altitude.
