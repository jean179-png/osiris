# AIS Category Toggles — Implementation Plan

> **For agentic workers:** Execute task-by-task. Spec: `docs/superpowers/specs/2026-10-15-osiris-ais-category-toggles-design.md`

**Goal:** Replace monolithic `maritime` LayerPanel toggle with full AIS ship category toggles + ports/chokepoints.

**Architecture:** Shared `/api/maritime` fetch when any `ais_*` on; client filters by `type` via `ais-layer-keys.ts`.

## Tasks

### Task 1: `ais-layer-keys` helper + tests — DONE in same PR as impl

### Task 2: LayerPanel + page defaults/fetch

- MARITIME layers: 8× `ais_*` + `maritime_infra`
- Defaults: all ship cats + infra `true`
- Fetch/poll when `anyAisShipLayerOn || maritimeInfraOn`

### Task 3: OsirisMap filter, colors, visibility, track clear

- Filter `maritime_ships` with `shipVisibleForLayers`
- Color match for all types
- Vis: ships when any ais on; ports/chokes when infra on
- Clear ship tracks when no ais ship layers on

### Task 4: Verify + commit
