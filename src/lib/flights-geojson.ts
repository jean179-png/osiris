type FlightLike = {
  lng?: number;
  lat?: number;
  callsign?: string;
  heading?: number;
  alt?: number;
  grounded?: boolean;
  model?: string;
  speed_knots?: number;
  registration?: string;
  icao24?: string;
  aircraft_category?: string;
};

/** Build MapLibre features; helis are never dropped by decimation. */
export function flightsToGeoJsonFeatures(
  arr: FlightLike[] | null | undefined,
  decimate: number = 1,
): GeoJSON.Feature[] {
  const list = arr || [];
  const filtered =
    decimate > 1
      ? list.filter((f, i) => f.aircraft_category === 'heli' || i % decimate === 0)
      : list;
  return filtered.map((f) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [Number(f.lng), Number(f.lat)] },
    properties: {
      callsign: f.callsign,
      heading: f.heading || 0,
      alt: f.alt,
      grounded: f.grounded,
      model: f.model,
      speed_knots: f.speed_knots,
      registration: f.registration,
      icao24: f.icao24,
      aircraft_category: f.aircraft_category === 'heli' ? 'heli' : 'plane',
    },
  }));
}
