/**
 * NASA GIBS VIIRS night lights — URL helpers for Black Marble WMTS.
 * Clients hit /api/tiles/gibs/night-lights/{z}/{x}/{y}?product=composite.
 */

export type NightLightsProduct = 'composite' | 'daily';

/** GIBS GoogleMapsCompatible_Level8 matrix max. */
export const NIGHT_LIGHTS_MAX_ZOOM = 8;

export const GIBS_NIGHT_LIGHTS_ATTRIBUTION =
  'Imagery © NASA GIBS / ESDIS (VIIRS Black Marble)';

/**
 * Upstream GIBS tile URL. GIBS uses {z}/{y}/{x} (not XYZ x/y order).
 * `daily` is reserved for a future DNB product — returns null in v1.
 */
export function gibsNightLightsUpstreamUrl(
  product: NightLightsProduct,
  z: number,
  x: number,
  y: number,
): string | null {
  if (product === 'daily') return null;
  return (
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble' +
    `/default/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`
  );
}

/** Accept composite (default); accept daily for typed hook; reject unknown. */
export function parseNightLightsProduct(raw: string | null): NightLightsProduct | null {
  if (raw == null || raw === '' || raw === 'composite') return 'composite';
  if (raw === 'daily') return 'daily';
  return null;
}
