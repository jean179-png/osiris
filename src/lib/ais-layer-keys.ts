/** LayerPanel keys for AIS ship categories (Approach A). */
export const AIS_SHIP_LAYER_KEYS = [
  'ais_cargo',
  'ais_tanker',
  'ais_passenger',
  'ais_military',
  'ais_fishing',
  'ais_pleasure',
  'ais_special',
  'ais_other',
] as const;

export type AisShipLayerKey = (typeof AIS_SHIP_LAYER_KEYS)[number];

export const MARITIME_INFRA_KEY = 'maritime_infra' as const;

const KNOWN_TYPES = new Set([
  'cargo',
  'tanker',
  'passenger',
  'military',
  'fishing',
  'pleasure',
  'sailing',
  'special',
  'highspeed',
  'other',
]);

export function anyAisShipLayerOn(layers: Record<string, boolean> | null | undefined): boolean {
  if (!layers) return false;
  // Legacy single toggle
  if (layers.maritime) return true;
  return AIS_SHIP_LAYER_KEYS.some((k) => !!layers[k]);
}

export function maritimeInfraOn(layers: Record<string, boolean> | null | undefined): boolean {
  if (!layers) return false;
  if (layers.maritime) return true;
  return !!layers[MARITIME_INFRA_KEY];
}

export function shipMatchesAisLayer(type: string | null | undefined, key: AisShipLayerKey): boolean {
  const t = String(type || 'cargo').toLowerCase();
  switch (key) {
    case 'ais_cargo':
      return t === 'cargo';
    case 'ais_tanker':
      return t === 'tanker';
    case 'ais_passenger':
      return t === 'passenger';
    case 'ais_military':
      return t === 'military';
    case 'ais_fishing':
      return t === 'fishing';
    case 'ais_pleasure':
      return t === 'pleasure' || t === 'sailing';
    case 'ais_special':
      return t === 'special' || t === 'highspeed';
    case 'ais_other':
      return t === 'other' || !KNOWN_TYPES.has(t);
    default:
      return false;
  }
}

/** Whether a ship should render given current layer toggles. */
export function shipVisibleForLayers(
  type: string | null | undefined,
  layers: Record<string, boolean> | null | undefined,
): boolean {
  if (!layers) return false;
  if (layers.maritime) return true;
  return AIS_SHIP_LAYER_KEYS.some((k) => !!layers[k] && shipMatchesAisLayer(type, k));
}
