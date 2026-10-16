import { describe, it, expect } from 'vitest';
import {
  gpsJamPercentBad,
  gpsJamLevel,
  parseGpsJamCsv,
  parseGpsJamManifest,
  latestManifestDate,
  h3ToPolygonCoords,
  gpsJamRowsToFeatureCollection,
} from './gpsjam';

describe('gpsJamPercentBad', () => {
  it('uses (bad-1)/(good+bad)*100', () => {
    expect(gpsJamPercentBad(90, 11)).toBeCloseTo((100 * 10) / 101, 5);
  });
  it('clamps when bad is 0 or 1', () => {
    expect(gpsJamPercentBad(10, 0)).toBe(0);
    expect(gpsJamPercentBad(10, 1)).toBe(0);
  });
});

describe('gpsJamLevel', () => {
  it('classifies medium and high', () => {
    expect(gpsJamLevel(1.5)).toBeNull();
    expect(gpsJamLevel(2)).toBe('medium');
    expect(gpsJamLevel(10)).toBe('medium');
    expect(gpsJamLevel(10.1)).toBe('high');
  });
});

describe('parseGpsJamCsv', () => {
  it('keeps medium/high and drops low-sample', () => {
    const csv = [
      'hex,count_good_aircraft,count_bad_aircraft',
      '8928308280fffff,100,1',
      '89283082807ffff,80,20',
      '89283082803ffff,1,1',
    ].join('\n');
    const rows = parseGpsJamCsv(csv);
    expect(rows.every((r) => r.level === 'medium' || r.level === 'high')).toBe(true);
    expect(rows.some((r) => r.h3 === '89283082807ffff')).toBe(true);
    expect(rows.some((r) => r.h3 === '8928308280fffff')).toBe(false);
  });
});

describe('manifest', () => {
  it('parses dates and returns latest', () => {
    const m = parseGpsJamManifest(
      'date,suspect,num_bad_aircraft_hexes,source\n2026-10-14,false,1,x\n2026-10-15,false,2,x\n',
    );
    expect(m).toEqual(['2026-10-14', '2026-10-15']);
    expect(latestManifestDate(m)).toBe('2026-10-15');
  });
});

describe('h3ToPolygonCoords', () => {
  it('returns a closed lng/lat ring', () => {
    const ring = h3ToPolygonCoords('8428309ffffffff');
    expect(ring.length).toBeGreaterThanOrEqual(4);
    const [lng, lat] = ring[0]!;
    expect(lng).toBeGreaterThanOrEqual(-180);
    expect(lng).toBeLessThanOrEqual(180);
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});

describe('gpsJamRowsToFeatureCollection', () => {
  it('builds one polygon feature per row', () => {
    const rows = parseGpsJamCsv(
      'hex,count_good_aircraft,count_bad_aircraft\n8428309ffffffff,80,20\n',
    );
    const fc = gpsJamRowsToFeatureCollection(rows, '2026-10-15');
    expect(fc.features).toHaveLength(rows.length);
    expect(fc.features[0]?.geometry.type).toBe('Polygon');
    expect(fc.features[0]?.properties?.date).toBe('2026-10-15');
  });
});
