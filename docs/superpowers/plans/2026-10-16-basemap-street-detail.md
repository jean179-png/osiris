# Basemap Street Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show secondary/tertiary and minor streets (plus labels) ~1–2 zoom levels earlier on the dark basemap.

**Architecture:** Patch `minzoom` on transportation line and roadname layers inside the local CARTO Dark Matter snapshot. Tunnel/bridge mates use the same shifts. No runtime MapLibre patching; no tile source change.

**Tech Stack:** MapLibre GL style JSON (`public/dark-matter-style.json`), Node one-liner or script for verification.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-basemap-street-detail-design.md`
- Motorway / trunk line `minzoom` unchanged
- Path/track appear later than minor streets
- Do not change line widths or paint

---

### Task 1: Apply minzoom shifts

**Files:**
- Modify: `public/dark-matter-style.json`
- Test: Node assertion script (inline) against expected minzooms

**Target minzooms (apply to surface + tunnel + bridge mates):**

| Layer id pattern | New minzoom |
| --- | --- |
| `*_sec_*` / `*_sec_*` secondary/tertiary case | 9 |
| `road_sec_fill_noramp`, `tunnel_sec_fill`, `bridge_sec_fill` | 11 |
| `*_minor_case` | 11 |
| `*_minor_fill` | 13 |
| `*_service_case`, `*_service_fill` | 13 |
| `*_path` / `road_path` | 14 |
| `road_pri_fill_noramp` | 8 |
| `roadname_sec` | 13 |
| `roadname_minor` | 14 |
| `roadname_pri` | 12 |
| `roadname_major` | 12 |

Exact current ids (from inventory):

- Secondary case: `tunnel_sec_case` 11→9, `road_sec_case_noramp` 11→9, `bridge_sec_case` 11→9
- Secondary fill: `tunnel_sec_fill` 13→11, `road_sec_fill_noramp` 13→11, `bridge_sec_fill` 13→11
- Minor case: `tunnel_minor_case` / `road_minor_case` / `bridge_minor_case` 13→11
- Minor fill: `tunnel_minor_fill` / `road_minor_fill` / `bridge_minor_fill` 15→13
- Service case/fill: all `*_service_*` 15→13
- Path: `tunnel_path` / `road_path` / `bridge_path` 15→14
- Primary fill: `road_pri_fill_noramp` 10→8 (tunnel/bridge pri fill already 11; leave or also →8? Spec says primary fill z10→z8 for surface; leave tunnel/bridge pri fill at 11 or drop to 8 — prefer drop `tunnel_pri_fill` / `bridge_pri_fill` 11→8 for consistency)
- Labels: `roadname_minor` 16→14, `roadname_sec` 15→13, `roadname_pri` 14→12, `roadname_major` 13→12

- [x] **Step 1: Write check** `tools/check-street-minzoom.mjs`
- [x] **Step 2: Patch `dark-matter-style.json` minzooms**
- [x] **Step 3: Run check; confirm pass**
- [ ] **Step 4: Commit** `style: show basemap streets earlier at mid zooms`

### Task 2: Manual verify (optional before pack)

- [ ] Dark map ~z10: secondary corridors visible
- [ ] ~z12: minor grid visible
- [ ] Motorway/trunk look unchanged at z6–8
