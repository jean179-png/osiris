### Task 9: Client fetch helper

**Files:**
- Create: `src/lib/ground-layers-client.ts`
- Test: `src/lib/ground-layers-client.test.ts` (debounce/minZoom pure bits)

```ts
export const GROUND_LAYER_KEYS = [
  'uap','wrecks','abandoned','nightlife','gtfs','gauges','civic_311','vacant','historic_maps',
] as const;
export type GroundLayerKey = typeof GROUND_LAYER_KEYS[number];

export const GROUND_MIN_ZOOM: Record<GroundLayerKey, number> = {
  uap: 0, wrecks: 6, abandoned: 10, nightlife: 10, gtfs: 0,
  gauges: 5, civic_311: 10, vacant: 10, historic_maps: 0,
};

export const GROUND_API: Record<GroundLayerKey, string> = {
  uap: '/api/layers/uap',
  wrecks: '/api/layers/wrecks',
  abandoned: '/api/layers/abandoned',
  nightlife: '/api/layers/nightlife',
  gtfs: '/api/layers/gtfs',
  gauges: '/api/layers/gauges',
  civic_311: '/api/layers/civic-311',
  vacant: '/api/layers/vacant',
  historic_maps: '/api/layers/historic-maps',
};

export function boundsToBboxParam(b: { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number }): string {
  return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
}
```

---
