# Trails & Public Access Land — design

**Date:** 2026-10-16  
**Status:** Approved  
**Structure:** B — two Layer Panel toggles  
**Data:** OSM (Overpass) trails + access polygons; BLM Surface Management Agency for US federal public land

## Goal

Show where people can walk or bike: trail networks (including disused railway corridors used as paths) and public-passage land (parks, open-access areas, BLM, and similar). Infrastructure / land display only — no live users or vehicles.

## Layer panel

| Key | Label | Description |
|-----|--------|-------------|
| `trails` | Trails | Cycle · hike · foot · bridle · disused rail paths |
| `public_access` | Public Access Land | Parks · protected · open access · BLM |

- Group: **GROUND** (alongside Abandoned Rail / Freight Rail).
- Both **off** by default.
- Independent toggles; either can run alone.

## Trails (`trails`)

### Geometry

Viewport Overpass LineStrings when `z >= 8`:

- `highway` in `path`, `footway`, `cycleway`, `bridleway`
- Relation members / ways tagged `route=hiking` or `route=bicycle` (ways in bbox with those tags, or `network` hiking/cycling where practical)
- Disused / abandoned rail that functions as a corridor: `railway` in `abandoned`, `disused` (lines only; overlap with existing Abandoned Rail layer is acceptable — Trails emphasizes continuous path geometry)

Exclude private / no-access where tagged: skip `access=private|no`, `foot=no` + `bicycle=no`.

### Feature properties

`kind: 'ground_trails'`, plus `subkind` (`cycle` | `hike` | `foot` | `bridle` | `rail_trail` | `other`), `name`, `highway` / `railway` / `route`, `osmId`, `attribution: 'OpenStreetMap'`.

### Map style

- Line layer only (no dots).
- Color by `subkind` (e.g. cycle green, hike amber, foot soft cyan, bridle brown, rail-trail muted gold).
- Width ~1.5–2.5; opacity ~0.8.
- Cap features per viewport (e.g. 4000) like other Overpass layers.

### API

`GET /api/layers/trails?bbox=&z=` → FeatureCollection.  
Cache ~10 minutes. Soft-fail → empty FC.

## Public Access Land (`public_access`)

### Geometry

Polygons (MultiPolygon ok) when `z >= 7`:

**OSM (worldwide)**

- `leisure=park` / `leisure=nature_reserve`
- `boundary=protected_area` (where access is not explicitly forbidden)
- `access=yes` or `foot=yes` / `bicycle=yes` on landuse/leisure areas suitable for passage (avoid private gardens, military)
- Skip `access=private|no`, `military=*`, clearly closed reserves when tagged `access=no`

**BLM / federal SMA (US)**

- Query [BLM National SMA](https://gis.blm.gov/natl/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer) (or BLM-only cached sibling) as GeoJSON for the viewport.
- Prefer BLM-administered polygons; optionally include other federal agencies commonly open to recreation (USFS, NPS, FWS) when the SMA attribute identifies them — v1 at minimum **BLM**; expand agency filter if query cost allows.
- Soft-fail if ArcGIS is down; still return OSM polygons.

### Feature properties

`kind: 'ground_public_access'`, `subkind` (`park` | `protected` | `open_access` | `blm` | `federal` | `other`), `name`, `agency` / `operator` when known, `attribution` (`OpenStreetMap` or `BLM`).

### Map style

- Fill opacity ~0.15–0.25 + thin outline.
- Distinct fill tint per `subkind` (e.g. BLM sand/tan, park green, protected teal).
- Cap / simplify as needed so Overpass + SMA stay responsive (record limit on SMA query; simplify OSM if required).

### API

`GET /api/layers/public-access?bbox=&z=` → FeatureCollection merging OSM + BLM parts.  
Cache ~10–15 minutes. Soft-fail per source.

## Client wiring

- Add both keys to `GROUND_LAYER_KEYS`, `GROUND_MIN_ZOOM`, `GROUND_API`, `GROUND_COLORS`.
- `page.tsx` defaults `false`; LayerPanel GROUND entries.
- OsirisMap: line layer for `trails`; fill + line outline for `public_access`.
- Popups: name + subkind + operator/agency + attribution; trails note “path geometry”; public access note “public passage land — not a permit”.

## Non-goals (v1)

- Live pedestrians / cyclists / GPX uploads  
- Full UK right-to-roam / every national cadastre  
- Legal advice or “you may enter here” guarantees (OSM + SMA are imperfect)  
- Replacing the existing **Abandoned Rail** layer  
- Category chips inside each toggle (can add later like AIS)

## Testing

- Unit: Overpass QL builders + mappers (include / exclude access tags); SMA GeoJSON → features.
- Manual: mid-zoom US West shows BLM fills + trail lines; urban park polygons; toggle independence; empty at low zoom.

## Implementation order

1. `trails` lib + `/api/layers/trails` + map/panel wire  
2. `public_access` OSM polygons + API/map/panel  
3. BLM SMA merge into `public_access`  
4. Portable rebuild + Desktop sync  
