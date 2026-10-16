# Final branch review — Osiris ground layers

**Repo:** `C:\pinokio\api\osiris`  
**Branch:** `feat/osiris-ground-layers`  
**Base:** `8d9baa2`  
**HEAD:** `6cd4db1` (GTFS Next bindings fix)  
**Commits:** `8d9baa2..HEAD` (14 commits, Tasks 1–12)  
**Date:** 2026-10-15

## Verdict

**Ship: ✅**  
**Blocking issues: none**

All nine GROUND layers are present end-to-end (API → client helpers → LayerPanel → OsirisMap sources/paint/fetch/popups). Defaults are off. Soft-fail to empty FeatureCollection is consistent. SSRF surface is bbox (+ static registry URLs), which is in-policy.

## Scope checked

| Area | Result |
|------|--------|
| Spec / plan / SDD progress | Spec goals met; Tasks 1–12 marked complete in `progress.md`; per-task reviews Spec ✅ |
| `git log 8d9baa2..HEAD` | Shared lib → gauges → wrecks → uap → Overpass → GTFS → municipal → historic → client → panel → map → GTFS Next fix |
| `src/lib/layers/*` | 9 routes’ mappers + bbox/cache/geojson/overpass; **52** unit tests pass |
| `src/app/api/layers/*` | All 9 routes present |
| `ground-layers-client` | Keys, min-zoom, API paths, debounce 400ms, URL builder |
| LayerPanel GROUND | Nine toggles, group before DISPLAY |
| `page.tsx` `activeLayers` | All nine `false` |
| OsirisMap | Sources, paint, debounced fetch, GTFS poll, UAP + LOC popups, hover ids |

## Layer completeness

| Key | API | Panel | Default off | Map source/layer | Fetch |
|-----|-----|-------|-------------|------------------|-------|
| `uap` | `/api/layers/uap` | ✅ | ✅ | cluster + dots | ✅ |
| `wrecks` | `/api/layers/wrecks` | ✅ | ✅ | dots | ✅ (min z 6 client) |
| `abandoned` | `/api/layers/abandoned` | ✅ | ✅ | line + dots | ✅ (min z 10) |
| `nightlife` | `/api/layers/nightlife` | ✅ | ✅ | cluster + dots | ✅ (min z 10) |
| `gtfs` | `/api/layers/gtfs` | ✅ | ✅ | dots | ✅ + 20s poll / visibility |
| `gauges` | `/api/layers/gauges` | ✅ | ✅ | dots | ✅ (min z 5 client) |
| `civic_311` | `/api/layers/civic-311` | ✅ | ✅ | cluster + dots | ✅ (min z 10) |
| `vacant` | `/api/layers/vacant` | ✅ | ✅ | dots | ✅ (min z 10) |
| `historic_maps` | `/api/layers/historic-maps` | ✅ | ✅ | fill + line | ✅ |

No missing v1 layer relative to the design table.

## Soft-fail

- Invalid / oversize bbox (`parseBbox` null, including span > 40°) → HTTP 200 + `emptyFc()`.
- Upstream errors: routes / `cachedFc` / per-agency / per-city catch → empty FC (or stale on cache error).
- Client: abort or fetch/parse failure → keep last good FC; toggle off / below min-zoom → `EMPTY_FC`.
- No soft-fail regression found that would crash the map or return hard 500 for expected upstream failure.

## Default-on

- All nine ground keys explicitly `false` in `page.tsx`.
- LayerPanel does not force them on.
- Off path clears GeoJSON sources (no reliance on leftover data staying visible).

## Security

- User-controlled input is `bbox` / `z` only.
- Upstream hosts are fixed (USGS, NOAA, UAP Atlas, Overpass) or loaded from committed registries (`gtfs-agencies.json`, `municipal-endpoints.json`).
- No open URL proxy from query params. **SSRF-via-bbox-only is OK** per review brief.
- Popups use `htmlEsc` / `urlSafe` for titles and `locUrl`.

## Non-blocking (follow-ups)

1. Soft-fail empty FC is cached for the layer TTL (recovery lag until expiry) — consistent across layers; known from task reviews.
2. NOAA wrecks upstream has been observed returning HTML; soft-fail yields empty until the service recovers.
3. Municipal registry omits Boston (adapter mismatch); RIPTA GTFS entry disabled placeholder.
4. USGS gauges can emit duplicate feature `id`s when both discharge and stage return (mapper uses `usgs-${siteCode}`).
5. Ground paint layers are not in the shared `setVis` effect; off-state uses `EMPTY_FC` only (matches plan; fine).
6. Client fetch does not check `r.ok` before `r.json()` (keep-last on failure still applies).
7. Optional EPA brownfields not implemented (design: optional).
8. Plan markdown checkboxes remain unchecked (process debt only).

## Test evidence

```
npm test -- --run src/lib/layers
→ 9 files, 52 tests passed
```

GTFS Next fix (`6cd4db1`): `serverExternalPackages` includes `gtfs-realtime-bindings`; import normalizes CJS default/namespace.

## Ship gate

| Gate | Pass? |
|------|-------|
| Missing layers | No |
| Soft-fail regressions | No |
| Default-on bugs | No |
| SSRF beyond bbox/registry | No |
| Obvious ship-blockers | No |

---

**Ship: ✅**  
**Blocking issues: none**
