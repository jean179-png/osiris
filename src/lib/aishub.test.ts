import { describe, it, expect } from 'vitest';
import {
  buildAishubUrl,
  extractAishubRows,
  getOsirisShipType,
  isMmsiQuery,
  mapAishubResponse,
  mapAishubVessel,
  searchShips,
  shipToSearchHit,
} from './aishub';

describe('aishub', () => {
  it('classifies ship types', () => {
    expect(getOsirisShipType(80)).toBe('tanker');
    expect(getOsirisShipType(70)).toBe('cargo');
    expect(getOsirisShipType(35)).toBe('military');
    expect(getOsirisShipType(36)).toBe('sailing');
    expect(getOsirisShipType(37)).toBe('pleasure');
    expect(getOsirisShipType(30)).toBe('fishing');
  });

  it('extracts rows from [header, vessels] payload', () => {
    const rows = extractAishubRows([
      { ERROR: false },
      [{ MMSI: 1, LATITUDE: 1.2, LONGITUDE: 103.8, NAME: 'A', SOG: 5, TYPE: 70 }],
    ]);
    expect(rows).toHaveLength(1);
  });

  it('maps a vessel row', () => {
    const ship = mapAishubVessel({
      MMSI: 244750030,
      LATITUDE: 51.9,
      LONGITUDE: 4.5,
      SOG: 12.3,
      HEADING: 511,
      COG: 90,
      NAME: 'TEST SHIP',
      DEST: 'ROTTERDAM',
      TYPE: 80,
      FLAG: 'NL',
    });
    expect(ship?.type).toBe('tanker');
    expect(ship?.heading).toBe(90);
    expect(ship?.destination).toBe('ROTTERDAM');
  });

  it('maps full response', () => {
    const ships = mapAishubResponse([
      { ERROR: false },
      [
        { MMSI: 1, LATITUDE: 1, LONGITUDE: 2, NAME: 'X', TYPE: 70 },
        { MMSI: 2, LATITUDE: 99, LONGITUDE: 2 }, // invalid lat skipped via abs>90
      ],
    ]);
    expect(ships).toHaveLength(1);
  });

  it('builds ws.php url', () => {
    const url = buildAishubUrl('user1', { latmin: 1, latmax: 2, lonmin: 3, lonmax: 4 }, 15);
    expect(url).toContain('username=user1');
    expect(url).toContain('latmin=1');
    expect(url).toContain('output=json');
  });

  it('searches ships by name and mmsi', () => {
    expect(isMmsiQuery('244750030')).toBe(true);
    expect(isMmsiQuery('MMSI 244750030')).toBe(true);
    expect(isMmsiQuery('ever given')).toBe(false);
    const ships = [
      { id: 1, mmsi: 111, lat: 1, lng: 2, speed: 0, heading: 0, name: 'EVER GIVEN', destination: 'ROTTERDAM', type: 'cargo', flag: '', timestamp: 1 },
      { id: 2, mmsi: 244750030, lat: 3, lng: 4, speed: 12, heading: 90, name: 'TEST', destination: '', type: 'tanker', flag: 'NL', timestamp: 1 },
    ];
    expect(searchShips(ships, 'ever').map((s) => s.mmsi)).toEqual([111]);
    expect(searchShips(ships, '244750030')[0]!.name).toBe('TEST');
    expect(searchShips(ships, 'MMSI 244750030')[0]!.name).toBe('TEST');
    expect(shipToSearchHit(ships[0]!).kind).toBe('ship');
  });

  it('normalizes M/Y names and resolves famous yachts', async () => {
    const { normalizeVesselName, resolveFamousYachtMmsi } = await import('./aishub');
    expect(normalizeVesselName('M/Y NORD')).toBe('nord');
    expect(resolveFamousYachtMmsi('M/Y NORD')).toBe('273610820');
    expect(resolveFamousYachtMmsi('nord')).toBe('273610820');
  });
});
