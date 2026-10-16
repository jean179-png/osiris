# AIS group box-select + shared trail slider — design

**Date:** 2026-10-16  
**Status:** Implemented  
**Approach:** Shift+drag MapLibre box query → Active tracks (cap 25) → group popup with shared trail days slider

## Goal

Let the operator Shift+drag a rectangle over AIS vessels, add them to Active tracks (up to 25), and control trail length for the whole group from one popup slider (same day stops as the single-ship trail slider).

## Interaction

1. **Shift + pointer drag** draws a rubber-band rectangle; map pan is disabled for that gesture while Shift is held.  
2. On pointer up, query **rendered** features on AIS ship layers that are currently visible.  
3. Collect unique MMSIs (from feature properties); **cap at 25** (stable order: first found in query result).  
4. Each MMSI is added to Active tracks via existing track-toggle/fetch path (already-tracked ships remain and join the group).  
5. Open a **group popup** anchored near the box center (or first ship).  
6. Empty selection → no popup, no track changes.  
7. Dismiss group popup with Escape or click empty map; tracks stay in the dock until cleared.

## Group popup

- Header: `N vessels` and a short name/MMSI list (truncate with “+k more”).  
- Shared trail slider stops: **1d · 1w · 1m · 6m · all** (same mapping as single-ship: `1|7|30|183|366`).  
- Changing the slider sets `trailDays` on **every** ship in the group and re-fetches each track (`GET /api/maritime/vessel?mmsi=&days=`).  
- Default for newly added ships remains **1 day** (existing single-ship default).  
- Optional control: **Clear group** — remove all group MMSIs from Active tracks and close popup.  
- Single-ship popup and per-MMSI slider behavior unchanged when opening one vessel.

## Highlighting

- While the group popup is open, selected ships may show a light highlight (ring or filter) so the set is visible; cleared when the group is dismissed.

## Non-goals (v1)

- Additive multi-box selection (union without replace)  
- Freehand lasso  
- Selecting non-AIS entities (flights, etc.)  
- Raising the cap above 25  
- Persisting group membership across reloads  

## Verification

- Shift+drag over several AIS ships → dock gains ≤25 tracks; group popup opens with shared slider  
- Slider to 1w → all group trails refetch and redraw  
- Empty box → nothing happens  
- Without Shift, drag still pans the map  
- Single-ship trail slider still works independently
