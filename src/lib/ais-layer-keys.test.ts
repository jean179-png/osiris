import { describe, expect, it } from 'vitest';
import {
  anyAisShipLayerOn,
  maritimeInfraOn,
  shipMatchesAisLayer,
  shipVisibleForLayers,
} from './ais-layer-keys';

describe('ais-layer-keys', () => {
  it('matches pleasure/sailing and special/highspeed buckets', () => {
    expect(shipMatchesAisLayer('sailing', 'ais_pleasure')).toBe(true);
    expect(shipMatchesAisLayer('highspeed', 'ais_special')).toBe(true);
    expect(shipMatchesAisLayer('cargo', 'ais_tanker')).toBe(false);
  });

  it('filters ships by enabled toggles', () => {
    const layers = {
      ais_cargo: true,
      ais_tanker: false,
      ais_passenger: false,
      ais_military: false,
      ais_fishing: false,
      ais_pleasure: false,
      ais_special: false,
      ais_other: false,
    };
    expect(shipVisibleForLayers('cargo', layers)).toBe(true);
    expect(shipVisibleForLayers('tanker', layers)).toBe(false);
    expect(anyAisShipLayerOn(layers)).toBe(true);
    expect(maritimeInfraOn({ maritime_infra: true })).toBe(true);
  });
});
