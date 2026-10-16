# AIS maritime category LayerPanel toggles

Date: 2026-10-15  
Branch: `feat/osiris-desktop`  
Status: approved for planning (queued)

## Goal

Break the single **Marine AIS / Naval** LayerPanel toggle into independent ship-type toggles (flight-layer pattern), plus a separate ports/chokepoints toggle.

## Non-goals

- Changing Open Waters / AISHub fetch volume (still one bbox feed when any ship category is on).
- New vessel classification beyond existing `getOsirisShipType` labels.
- Changing Active tracks dock / multi-ship track behavior.

## Decisions (locked)

| Topic | Choice |
|---|---|
| UI | LayerPanel sub-toggles (like commercial / private / jets / military) |
| Category set | Full AIS set |
| Architecture | Approach A — independent toggles + shared fetch; client filters by `type` |
| Defaults | All ship categories **on**; ports/chokepoints **on** (parity with today’s single `maritime: true`) |

## LayerPanel → MARITIME

| Key | Label | Feature filter |
|---|---|---|
| `ais_cargo` | Cargo | `type === 'cargo'` |
| `ais_tanker` | Tanker | `type === 'tanker'` |
| `ais_passenger` | Passenger | `type === 'passenger'` |
| `ais_military` | Military | `type === 'military'` |
| `ais_fishing` | Fishing | `type === 'fishing'` |
| `ais_pleasure` | Pleasure / Yacht | `type` in `pleasure`, `sailing` |
| `ais_special` | Special / HSC | `type` in `special`, `highspeed` |
| `ais_other` | Other | `type === 'other'` (and any unknown fallback) |
| `maritime_infra` | Ports & chokepoints | ports + chokepoint sources only |

Remove or deprecate the monolithic `maritime` layer key from the panel (migrate existing `activeLayers.maritime` to “any ais_* or maritime_infra”).

## Data flow

```
any ais_* on ──► fetch /api/maritime?bbox=… (unchanged)
                    │
                    ▼
              maritime_ships[]
                    │
                    ▼
         filter by enabled ais_* keys → maritime-ships GeoJSON

maritime_infra on ──► ports + choke sources (same payload fields)
```

- Poll interval / bbox logic stays as today when any ship category is enabled.
- When all `ais_*` off: clear ship source; abort ship tracks only if maritime ships layer group is fully off (same as today’s `activeLayers.maritime` false clearing tracks).
- When `maritime_infra` off: clear ports + choke sources.

## Map styling

Extend `ship-dots` / `ship-label` color match for all types:

| type | color |
|---|---|
| military | `#D32F2F` |
| tanker | `#E65100` |
| cargo | `#26C6DA` |
| passenger | `#7E57C2` |
| fishing | `#66BB6A` |
| pleasure / sailing | `#EC407A` |
| special / highspeed | `#FFA726` |
| other / default | `#B0BEC5` |

## Files likely touched

- `src/components/LayerPanel.tsx` — MARITIME group entries
- `src/app/page.tsx` — `activeLayers` defaults; fetch when any `ais_*`; migrate `maritime`
- `src/components/OsirisMap.tsx` — filter ships by category; visibility; track clear condition; colors
- Assist / saved-layer focus code that references `maritime` (grep and update)

## Success criteria

- [ ] Eight ship category toggles + Ports & chokepoints in MARITIME group
- [ ] Toggling off Cargo hides cargo ships only; other types remain
- [ ] AIS still fetches once for the viewport when any ship category is on
- [ ] Ports/chokes independent of ship categories
- [ ] Defaults match previous “maritime on” density
- [ ] Search / tracks / popups still work for visible ships

## Queued after

Implementation plan → code. Also queued separately: transit route arrow orientation + stop markers bugfix.
