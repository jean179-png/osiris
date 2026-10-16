import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, clearMaritimeSnapshot } from './route';

/* The route aggregates over the AISHub-fed ship map on globalThis, so the
   tests seed the cache directly rather than hitting data.aishub.net. */
interface Ship {
  id: number; mmsi: number; lat: number; lng: number;
  speed: number; type: string; name: string; timestamp: number;
  heading?: number; destination?: string; flag?: string;
}

import { shipsCache } from '@/lib/maritime-ais-cache';

const ships = () => shipsCache as Map<number, Ship>;

function addShip(mmsi: number, lat: number, lng: number) {
  ships().set(mmsi, {
    id: mmsi, mmsi, lat, lng, speed: 0, type: 'cargo',
    name: `SHIP-${mmsi}`, timestamp: Date.now(),
  });
}

function req(bbox?: string) {
  const url = bbox
    ? `http://localhost/api/maritime?bbox=${encodeURIComponent(bbox)}`
    : 'http://localhost/api/maritime';
  return new NextRequest(url);
}

describe('GET /api/maritime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    ships().clear();
    clearMaritimeSnapshot();
    // Do not hit live AIS during unit tests (Open Waters + optional AISHub).
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '',
        json: async () => ({ type: 'FeatureCollection', features: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('still counts the ships sitting off a port', async () => {
    addShip(1, 1.26, 103.84); // on top of Singapore
    const body = await (await GET(req())).json();

    const singapore = body.ports.find((p: { name: string }) => p.name === 'Singapore');
    expect(singapore.volume).toContain('LIVE: 1');
    expect(singapore.volume).toContain('WAITING: 1');
    expect(body.total_ships).toBe(1);
  });

  it('serves one snapshot to every caller inside the TTL', async () => {
    addShip(1, 1.26, 103.84);
    const first = await (await GET(req())).json();

    vi.advanceTimersByTime(4_000);
    addShip(2, 1.27, 103.85);
    const second = await (await GET(req())).json();

    // The aggregation did not run again — the second caller got the first
    // caller's bytes, which is the whole point under load.
    expect(second).toEqual(first);
    expect(second.total_ships).toBe(1);
  });

  it('rebuilds once the TTL has passed', async () => {
    addShip(1, 1.26, 103.84);
    expect((await (await GET(req())).json()).total_ships).toBe(1);

    vi.advanceTimersByTime(5_000);
    addShip(2, 1.27, 103.85);
    expect((await (await GET(req())).json()).total_ships).toBe(2);
  });

  it('filters ships to the requested viewport', async () => {
    addShip(1, 41.9, -71.4); // Narragansett
    addShip(2, 1.26, 103.84); // Singapore
    const body = await (await GET(req('-72,41,-70,43'))).json();
    expect(body.total_ships).toBe(1);
    expect(body.ships[0].mmsi).toBe(1);
  });

  it('lets the browser and any CDN reuse the response', async () => {
    const res = await GET(req());
    const cc = res.headers.get('cache-control') ?? '';

    expect(cc).toContain('s-maxage=5');
    expect(cc).toContain('max-age=5');
    expect(cc).not.toContain('no-store');
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
