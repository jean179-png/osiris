export const GROUND_LAYER_KEYS = [
  'uap',
  'abandoned',
  'trails',
  'public_access',
  'nightlife',
  'gtfs',
  'trains',
  'freight_rail',
  'transit_alerts',
  'gbfs',
  'gauges',
  'civic_311',
  'vacant',
  'historic_maps',
  'lightning',
  'buoys',
  'storms',
  'aprs',
  'road_incidents',
] as const;
export type GroundLayerKey = typeof GROUND_LAYER_KEYS[number];

export const GROUND_MIN_ZOOM: Record<GroundLayerKey, number> = {
  uap: 0,
  abandoned: 10,
  trails: 8,
  public_access: 7,
  nightlife: 10,
  gtfs: 0,
  trains: 0,
  freight_rail: 7,
  transit_alerts: 0,
  gbfs: 10,
  gauges: 5,
  civic_311: 10,
  vacant: 10,
  historic_maps: 0,
  lightning: 0,
  buoys: 3,
  storms: 0,
  aprs: 5,
  road_incidents: 7,
};

export const GROUND_API: Record<GroundLayerKey, string> = {
  uap: '/api/layers/uap',
  abandoned: '/api/layers/abandoned',
  trails: '/api/layers/trails',
  public_access: '/api/layers/public-access',
  nightlife: '/api/layers/nightlife',
  gtfs: '/api/layers/gtfs',
  trains: '/api/layers/trains',
  freight_rail: '/api/layers/freight-rail',
  transit_alerts: '/api/layers/transit-alerts',
  gbfs: '/api/layers/gbfs',
  gauges: '/api/layers/gauges',
  civic_311: '/api/layers/civic-311',
  vacant: '/api/layers/vacant',
  historic_maps: '/api/layers/historic-maps',
  lightning: '/api/layers/lightning',
  buoys: '/api/layers/buoys',
  storms: '/api/layers/storms',
  aprs: '/api/layers/aprs',
  road_incidents: '/api/layers/road-incidents',
};

/** Debounce for map `moveend` ground-layer refreshes (ms). */
export const GROUND_DEBOUNCE_MS = 400;

export function boundsToBboxParam(b: {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
}): string {
  return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
}

/** True when zoom is at or above the layer's min zoom gate. */
export function meetsGroundMinZoom(key: GroundLayerKey, zoom: number): boolean {
  return zoom >= GROUND_MIN_ZOOM[key];
}

/** Build the GeoJSON fetch URL for a ground layer. */
export function buildGroundLayerUrl(key: GroundLayerKey, bbox: string, zoom: number): string {
  return `${GROUND_API[key]}?bbox=${encodeURIComponent(bbox)}&z=${Math.floor(zoom)}`;
}
