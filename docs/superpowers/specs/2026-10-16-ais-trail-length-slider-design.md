# AIS vessel trail length slider — design

**Date:** 2026-10-16  
**Status:** Approved  
**Default:** 1 day

## Goal

On marine vessel popups, let the operator choose how far back the AIS track goes: **1 day · 1 week · 1 month · 6 months · all**, without toggling the track off.

## Behaviour

1. When a ship track is turned **on** (existing click-toggle), fetch with **`days=1`** by default.
2. Popup shows a discrete **slider** (or stepped range) under the track status with stops: `1d | 1w | 1m | 6m | all`.
3. Changing the slider **re-fetches** that MMSI’s track for the new window and updates the map line + status (point count + date span). Track stays on.
4. Chosen length is remembered **per MMSI** while that ship remains in the Active tracks dock; removing the track clears the preference (next add starts at 1 day again).

## API

`GET /api/maritime/vessel?mmsi=&days=`

| `days` | Meaning |
|--------|---------|
| `1` | Last 1 calendar day |
| `7` | Last 1 week |
| `30` | Last 1 month |
| `183` | Last ~6 months |
| `366` or omitted | Full available history (Open Waters cap) |

Server clamps history start with existing `trackHistoryStart` / `firstSeen` / `OW_TRACK_MAX_DAYS` (366). Invalid `days` → treat as `366`.

## Non-goals

- Continuous arbitrary day picker  
- Persisting length across app restarts  
- Changing multi-ship dock UX beyond storing length for refetch  

## Testing

- Unit: parse/clamp `days`; `trackHistoryStart` with maxDays override.  
- Manual: open vessel → track loads ~1d; slide to 1w/all → line updates; toggle off clears.
