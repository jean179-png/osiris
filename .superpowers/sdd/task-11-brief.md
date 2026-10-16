### Task 11: OsirisMap sources, layers, fetch, popups

**Files:**
- Modify: `src/components/OsirisMap.tsx`

- [ ] **Step 1: Register sources** next to curiosities:

For each ground key: `map.addSource('ground-<key>', { type: 'geojson', data: EMPTY_FC, cluster: key is uap|nightlife|civic_311 })`.

- [ ] **Step 2: Add paint layers** — circles for points, line for abandoned rail, fill+line for historic polygons. Distinct hues from CSS vars (avoid purple glow clichés; use cyan/amber/slate already in theme).

- [ ] **Step 3: Fetch effect**

```ts
// Pseudocode structure to implement
useEffect(() => {
  if (!mapReady || !mapRef.current) return;
  const map = mapRef.current;
  const aborters = new Map<string, AbortController>();
  const refresh = () => {
    const z = map.getZoom();
    const bbox = boundsToBboxParam(map.getBounds());
    for (const key of GROUND_LAYER_KEYS) {
      const on = !!(activeLayers as any)[key];
      const src = map.getSource(`ground-${key}`) as maplibregl.GeoJSONSource | undefined;
      if (!on) { src?.setData(EMPTY_FC as never); continue; }
      if (z < GROUND_MIN_ZOOM[key]) { src?.setData(EMPTY_FC as never); continue; }
      aborters.get(key)?.abort();
      const ac = new AbortController();
      aborters.set(key, ac);
      const url = `${GROUND_API[key]}?bbox=${encodeURIComponent(bbox)}&z=${Math.floor(z)}`;
      fetch(url, { signal: ac.signal })
        .then((r) => r.json())
        .then((fc) => { if (!ac.signal.aborted) src?.setData(fc); })
        .catch(() => { /* aborted or fail: keep last */ });
    }
  };
  let t: ReturnType<typeof setTimeout> | undefined;
  const onMove = () => { clearTimeout(t); t = setTimeout(refresh, 400); };
  map.on('moveend', onMove);
  refresh();
  const gtfsTimer = setInterval(() => {
    if ((activeLayers as any).gtfs) refresh(); // or refresh only gtfs
  }, 20_000);
  const onVis = () => { if (document.hidden) return; };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    map.off('moveend', onMove);
    clearTimeout(t);
    clearInterval(gtfsTimer);
    document.removeEventListener('visibilitychange', onVis);
    aborters.forEach((a) => a.abort());
  };
}, [mapReady, activeLayers.uap, activeLayers.wrecks, /* ...all nine */]);
```

- [ ] **Step 4: Click handlers** for `ground-*` layers → popup HTML with name, kind, attribution, and for UAP the line `Approximate location (city-level).` Historic maps: button/link `locUrl`.

- [ ] **Step 5: Include ground layer ids** in any hover cursor / bring-to-front arrays that already list `curiosities-dots`.

---
