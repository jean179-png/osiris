### Task 10: LayerPanel GROUND group + page defaults

**Files:**
- Modify: `src/components/LayerPanel.tsx` (import an icon e.g. `MapPinned` or `Landmark` from lucide-react; insert GROUND group before DISPLAY)
- Modify: `src/app/page.tsx` `activeLayers` useState — add nine keys `false`

```ts
// LayerPanel LAYER_GROUPS entry
{
  label: 'GROUND',
  fullLabel: 'GROUND TRUTH',
  icon: MapPinned,
  layers: [
    { key: 'uap', label: 'UAP / NUFORC', dataKey: '', description: 'City-level reports' },
    { key: 'wrecks', label: 'NOAA Wrecks', dataKey: '' },
    { key: 'abandoned', label: 'Abandoned Rail / Industrial', dataKey: '' },
    { key: 'nightlife', label: 'Nightlife + Plazas', dataKey: '' },
    { key: 'gtfs', label: 'Transit Vehicles', dataKey: '', description: 'GTFS realtime' },
    { key: 'gauges', label: 'USGS Water Gauges', dataKey: '' },
    { key: 'civic_311', label: '311 Requests', dataKey: '', description: 'US cities in view' },
    { key: 'vacant', label: 'Vacant Property', dataKey: '', description: 'US cities in view' },
    { key: 'historic_maps', label: 'Historic Map Index', dataKey: '', description: 'LOC footprints · no tiles' },
  ],
},
```

- [ ] **Step 1: Add defaults + group**
- [ ] **Step 2: Visual check** panel shows GROUND toggles off

---
