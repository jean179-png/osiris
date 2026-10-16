import { describe, it, expect } from 'vitest';
import {
  mapOpenWatersTrackFeature,
  mapOpenWatersVesselFeature,
  navStatusLabel,
  normalizeMmsi,
  openWatersTrackUrl,
  parseVesselTrackDays,
  trackHistoryStart,
} from './openwaters-vessel';

describe('openwaters-vessel', () => {
  it('normalizes MMSI', () => {
    expect(normalizeMmsi('215167000')).toBe('215167000');
    expect(normalizeMmsi(368168720)).toBe('368168720');
    expect(normalizeMmsi('abc')).toBeNull();
  });

  it('labels nav status', () => {
    expect(navStatusLabel(5)).toBe('Moored');
    expect(navStatusLabel(0)).toBe('Under way (engine)');
  });

  it('maps vessel feature', () => {
    const v = mapOpenWatersVesselFeature({
      type: 'Feature',
      id: 215167000,
      geometry: { type: 'Point', coordinates: [103.78, 1.25] },
      properties: {
        mmsi: 215167000,
        name: 'ANL WANGARATTA',
        callsign: '9HA4991',
        imo: 9334167,
        flag: 'MT',
        type: 72,
        sog: 0,
        nav_status: 5,
        destination: 'SGSIN',
        particulars: { ship_type: 'container ship' },
      },
    });
    expect(v?.name).toBe('ANL WANGARATTA');
    expect(v?.navStatusLabel).toBe('Moored');
    expect(v?.shipType).toBe('container ship');
    expect(v?.lat).toBeCloseTo(1.25);
  });

  it('maps track linestring', () => {
    const t = mapOpenWatersTrackFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
      },
      properties: { from: 'a', to: 'b', points: 3, truncated: true },
    });
    expect(t.points).toBe(3);
    expect(t.coordinates[0]).toEqual([1, 2]);
    expect(t.truncated).toBe(true);
  });

  it('builds full-history track urls without a short default window', () => {
    const url = openWatersTrackUrl('273610820', {
      from: '2025-01-01T00:00:00.000Z',
      to: '2026-01-01T00:00:00.000Z',
    });
    expect(url).toContain('from=2025-01-01');
    expect(url).toContain('to=2026-01-01');
    expect(url).toContain('limit=200');
    expect(url).not.toContain('interval=');
  });

  it('caps history start at 366 days', () => {
    const to = new Date('2026-10-15T00:00:00Z');
    const start = trackHistoryStart(to, '2020-01-01T00:00:00Z');
    expect(start.toISOString()).toBe('2025-10-14T00:00:00.000Z');
  });

  it('honours a shorter maxDays window', () => {
    const to = new Date('2026-10-15T00:00:00Z');
    const start = trackHistoryStart(to, null, 1);
    expect(start.toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });
});

describe('parseVesselTrackDays', () => {
  it('accepts discrete stops and defaults to full history', () => {
    expect(parseVesselTrackDays('1')).toBe(1);
    expect(parseVesselTrackDays('7')).toBe(7);
    expect(parseVesselTrackDays('30')).toBe(30);
    expect(parseVesselTrackDays('183')).toBe(183);
    expect(parseVesselTrackDays('366')).toBe(366);
    expect(parseVesselTrackDays(null)).toBe(366);
    expect(parseVesselTrackDays('99')).toBe(366);
  });
});
