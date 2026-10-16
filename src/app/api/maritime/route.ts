import { NextRequest, NextResponse } from 'next/server';
import { buildAishubUrl, mapAishubResponse, type OsirisShip } from '@/lib/aishub';
import { fetchOpenWatersVessels, type OpenWatersBBox } from '@/lib/openwaters-ais';
import { parseBbox } from '@/lib/layers/bbox';
import {
  aishubUsername as getAishubUsername,
  getAishubInflight,
  getAishubLastFetch,
  getOpenwatersInflight,
  getOpenwatersLastFetch,
  getOpenwatersLastViewKey,
  nextOpenwatersBoxIndex,
  setAishubInflight,
  setAishubLastFetch,
  setOpenwatersInflight,
  setOpenwatersLastFetch,
  setOpenwatersLastViewKey,
  shipsCache,
  upsertShips,
} from '@/lib/maritime-ais-cache';

/**
 * OSIRIS — Maritime Intelligence
 * Live AIS via Open Waters (keyless GeoJSON, https://openwaters.io/ais/) + optional
 * AISHub webservice. Env: OPENWATERS_AIS_TOKEN (optional higher limits),
 * AISHUB_USERNAME / AIS_API_KEY (optional AISHub member poll ≤1/min).
 */

const PORTS = [
  // ── Top Container Ports ──
  { name: 'Shanghai', country: 'CN', lat: 31.23, lng: 121.47, type: 'container', volume: '47.3M TEU', rank: 1 },
  { name: 'Singapore', country: 'SG', lat: 1.26, lng: 103.84, type: 'container', volume: '37.2M TEU', rank: 2 },
  { name: 'Ningbo-Zhoushan', country: 'CN', lat: 29.87, lng: 121.55, type: 'container', volume: '33.3M TEU', rank: 3 },
  { name: 'Shenzhen', country: 'CN', lat: 22.54, lng: 114.05, type: 'container', volume: '30.0M TEU', rank: 4 },
  { name: 'Guangzhou', country: 'CN', lat: 23.08, lng: 113.32, type: 'container', volume: '24.2M TEU', rank: 5 },
  { name: 'Busan', country: 'KR', lat: 35.10, lng: 129.04, type: 'container', volume: '22.7M TEU', rank: 6 },
  { name: 'Qingdao', country: 'CN', lat: 36.07, lng: 120.38, type: 'container', volume: '22.0M TEU', rank: 7 },
  { name: 'Rotterdam', country: 'NL', lat: 51.90, lng: 4.50, type: 'container', volume: '14.5M TEU', rank: 8 },
  { name: 'Tokyo', country: 'JP', lat: 35.61, lng: 139.79, type: 'container', volume: '4.5M TEU' },
  { name: 'Yokohama', country: 'JP', lat: 35.45, lng: 139.66, type: 'container', volume: '2.9M TEU' },
  { name: 'Kobe', country: 'JP', lat: 34.67, lng: 135.21, type: 'container', volume: '2.8M TEU' },
  { name: 'Nagoya', country: 'JP', lat: 35.08, lng: 136.87, type: 'container', volume: '2.6M TEU' },
  { name: 'Osaka', country: 'JP', lat: 34.63, lng: 135.41, type: 'container', volume: '2.1M TEU' },
  { name: 'Hakata (Fukuoka)', country: 'JP', lat: 33.60, lng: 130.40, type: 'container', volume: '0.9M TEU' },
  { name: 'Kitakyushu', country: 'JP', lat: 33.91, lng: 130.93, type: 'container', volume: '0.5M TEU' },
  { name: 'Shimizu', country: 'JP', lat: 35.00, lng: 138.50, type: 'container', volume: '0.5M TEU' },
  { name: 'Tomakomai', country: 'JP', lat: 42.63, lng: 141.63, type: 'container', volume: '0.4M TEU' },
  { name: 'Niigata', country: 'JP', lat: 37.95, lng: 139.06, type: 'container', volume: '0.2M TEU' },
  { name: 'Sendai', country: 'JP', lat: 38.27, lng: 141.02, type: 'container', volume: '0.2M TEU' },
  { name: 'Mizushima', country: 'JP', lat: 34.50, lng: 133.72, type: 'energy', volume: 'Industrial' },
  { name: 'Yokkaichi', country: 'JP', lat: 34.95, lng: 136.65, type: 'energy', volume: 'Industrial' },
  { name: 'Dubai (Jebel Ali)', country: 'AE', lat: 25.01, lng: 55.06, type: 'container', volume: '14.0M TEU', rank: 9 },
  { name: 'Port Klang', country: 'MY', lat: 2.99, lng: 101.39, type: 'container', volume: '13.2M TEU', rank: 10 },
  { name: 'Antwerp', country: 'BE', lat: 51.30, lng: 4.40, type: 'container', volume: '12.0M TEU', rank: 11 },
  { name: 'Xiamen', country: 'CN', lat: 24.48, lng: 118.09, type: 'container', volume: '11.4M TEU', rank: 12 },
  { name: 'Hamburg', country: 'DE', lat: 53.55, lng: 9.97, type: 'container', volume: '8.7M TEU', rank: 14 },
  { name: 'Los Angeles', country: 'US', lat: 33.74, lng: -118.27, type: 'container', volume: '9.9M TEU', rank: 13 },
  { name: 'Long Beach', country: 'US', lat: 33.75, lng: -118.19, type: 'container', volume: '8.0M TEU', rank: 15 },
  { name: 'Tanjung Pelepas', country: 'MY', lat: 1.36, lng: 103.55, type: 'container', volume: '9.8M TEU', rank: 16 },
  { name: 'Savannah', country: 'US', lat: 32.08, lng: -81.09, type: 'container', volume: '5.6M TEU', rank: 20 },
  { name: 'Felixstowe', country: 'GB', lat: 51.96, lng: 1.35, type: 'container', volume: '3.8M TEU', rank: 25 },
  { name: 'Santos', country: 'BR', lat: -23.95, lng: -46.31, type: 'container', volume: '4.2M TEU', rank: 22 },
  { name: 'Colombo', country: 'LK', lat: 6.94, lng: 79.84, type: 'container', volume: '7.2M TEU', rank: 17 },

  // ── Energy/Oil Ports ──
  { name: 'Ras Tanura', country: 'SA', lat: 26.64, lng: 50.16, type: 'energy', volume: '6.5M bpd' },
  { name: 'Fujairah', country: 'AE', lat: 25.14, lng: 56.35, type: 'energy', volume: '3.5M bpd' },
  { name: 'Novorossiysk', country: 'RU', lat: 44.72, lng: 37.77, type: 'energy', volume: '2.8M bpd' },
  { name: 'Houston Ship Channel', country: 'US', lat: 29.73, lng: -95.27, type: 'energy', volume: '2.5M bpd' },
  { name: 'Kharg Island', country: 'IR', lat: 29.24, lng: 50.33, type: 'energy', volume: '2.0M bpd' },
  { name: 'Primorsk', country: 'RU', lat: 60.35, lng: 28.70, type: 'energy', volume: '1.6M bpd' },

  // ── Major Naval Bases ──
  { name: 'Norfolk Naval Station', country: 'US', lat: 36.95, lng: -76.33, type: 'naval', fleet: 'US Atlantic Fleet' },
  { name: 'San Diego Naval Base', country: 'US', lat: 32.69, lng: -117.15, type: 'naval', fleet: 'US Pacific Fleet' },
  { name: 'Pearl Harbor', country: 'US', lat: 21.35, lng: -157.97, type: 'naval', fleet: 'US Pacific Fleet' },
  { name: 'Yokosuka', country: 'JP', lat: 35.28, lng: 139.67, type: 'naval', fleet: 'US 7th Fleet' },
  { name: 'Severomorsk', country: 'RU', lat: 69.07, lng: 33.42, type: 'naval', fleet: 'Russian Northern Fleet' },
  { name: 'Tartus', country: 'SY', lat: 34.89, lng: 35.89, type: 'naval', fleet: 'Russian Mediterranean' },
  { name: 'Zhanjiang', country: 'CN', lat: 21.20, lng: 110.39, type: 'naval', fleet: 'PLA Navy South Sea Fleet' },
  { name: 'Qingdao Naval', country: 'CN', lat: 36.09, lng: 120.43, type: 'naval', fleet: 'PLA Navy North Sea Fleet' },
  { name: 'Portsmouth', country: 'GB', lat: 50.80, lng: -1.11, type: 'naval', fleet: 'Royal Navy' },
  { name: 'Toulon', country: 'FR', lat: 43.12, lng: 5.93, type: 'naval', fleet: 'French Navy Mediterranean' },
  { name: 'Changi Naval Base', country: 'SG', lat: 1.33, lng: 104.01, type: 'naval', fleet: 'Republic of Singapore Navy' },
  { name: 'Visakhapatnam', country: 'IN', lat: 17.69, lng: 83.30, type: 'naval', fleet: 'Indian Navy Eastern Command' },
  { name: 'Mumbai Naval', country: 'IN', lat: 18.93, lng: 72.84, type: 'naval', fleet: 'Indian Navy Western Command' },
];

const CHOKEPOINTS = [
  { name: 'Strait of Hormuz', lat: 26.57, lng: 56.25, traffic: '21M bpd oil', risk: 'HIGH' },
  { name: 'Strait of Malacca', lat: 2.50, lng: 101.50, traffic: '16M bpd oil', risk: 'MODERATE' },
  { name: 'Suez Canal', lat: 30.43, lng: 32.34, traffic: '12% world trade', risk: 'ELEVATED' },
  { name: 'Bab el-Mandeb', lat: 12.58, lng: 43.33, traffic: '6.2M bpd oil', risk: 'CRITICAL' },
  { name: 'Panama Canal', lat: 9.08, lng: -79.68, traffic: '5% world trade', risk: 'LOW' },
  { name: 'Turkish Straits', lat: 41.12, lng: 29.07, traffic: '3M bpd oil', risk: 'MODERATE' },
  { name: 'Danish Straits', lat: 55.70, lng: 12.60, traffic: '3.2M bpd oil', risk: 'LOW' },
  { name: 'Cape of Good Hope', lat: -34.36, lng: 18.47, traffic: 'Alt route Suez', risk: 'LOW' },
  { name: 'Taiwan Strait', lat: 24.00, lng: 119.00, traffic: '88% large ships', risk: 'ELEVATED' },
  { name: 'Lombok Strait', lat: -8.47, lng: 115.72, traffic: 'Alt Malacca', risk: 'LOW' },
];

/** High-traffic corridors — each box stays under Open Waters' 100°² anonymous cap. */
const AIS_BOXES: { latmin: number; latmax: number; lonmin: number; lonmax: number }[] = [
  { latmin: 1.0, latmax: 3.0, lonmin: 103.0, lonmax: 104.5 }, // Singapore / Malacca
  { latmin: 25.0, latmax: 27.5, lonmin: 54.0, lonmax: 57.5 }, // Hormuz
  { latmin: 27.0, latmax: 32.0, lonmin: 32.0, lonmax: 33.5 }, // Suez
  { latmin: 12.0, latmax: 14.0, lonmin: 42.5, lonmax: 44.0 }, // Bab el-Mandeb
  { latmin: 8.0, latmax: 10.0, lonmin: -80.5, lonmax: -79.0 }, // Panama
  { latmin: 22.0, latmax: 26.0, lonmin: 118.0, lonmax: 121.0 }, // Taiwan Strait
  { latmin: 50.0, latmax: 53.0, lonmin: 0.0, lonmax: 5.0 }, // Channel / Rotterdam
  { latmin: 33.0, latmax: 34.5, lonmin: -119.0, lonmax: -117.0 }, // LA/LB
  { latmin: 34.8, latmax: 35.7, lonmin: 139.5, lonmax: 140.2 }, // Tokyo Bay
  { latmin: 29.5, latmax: 30.0, lonmin: -95.5, lonmax: -94.5 }, // Houston
  { latmin: 40.5, latmax: 42.5, lonmin: -72.0, lonmax: -69.5 }, // Southern New England
];

function clampOwBbox(b: OpenWatersBBox): OpenWatersBBox {
  // Anonymous ≤100°²; personal token claim is typically 400°².
  const maxArea = process.env.OPENWATERS_AIS_TOKEN ? 400 : 100;
  const latSpan = Math.max(0.01, b.latmax - b.latmin);
  const lonSpan = Math.max(0.01, b.lonmax - b.lonmin);
  const area = latSpan * lonSpan;
  if (area <= maxArea) return b;
  const scale = Math.sqrt(maxArea / area);
  const latMid = (b.latmin + b.latmax) / 2;
  const lonMid = (b.lonmin + b.lonmax) / 2;
  const halfLat = (latSpan * scale) / 2;
  const halfLon = (lonSpan * scale) / 2;
  return {
    latmin: latMid - halfLat,
    latmax: latMid + halfLat,
    lonmin: lonMid - halfLon,
    lonmax: lonMid + halfLon,
  };
}

function viewKey(b: OpenWatersBBox): string {
  const r = (n: number) => Math.round(n * 20) / 20; // ~0.05° buckets
  return `${r(b.latmin)},${r(b.lonmin)},${r(b.latmax)},${r(b.lonmax)}`;
}

/** Open Waters — prefer map viewport, else rotate corridors (~12s). */
async function refreshOpenWatersShips(view?: OpenWatersBBox | null): Promise<void> {
  const now = Date.now();
  const key = view ? viewKey(clampOwBbox(view)) : '';
  const viewChanged = Boolean(view && key !== getOpenwatersLastViewKey());
  // Always fetch when the camera moves to a new bucket; otherwise throttle.
  const minGap = view ? 8_000 : 12_000;
  if (!viewChanged && now - getOpenwatersLastFetch() < minGap) return;
  const inflight = getOpenwatersInflight();
  if (inflight) return inflight;

  const job = (async () => {
    setOpenwatersLastFetch(Date.now());
    if (key) setOpenwatersLastViewKey(key);
    const bbox = view
      ? clampOwBbox(view)
      : AIS_BOXES[nextOpenwatersBoxIndex(AIS_BOXES.length)]!;
    try {
      const ships = await fetchOpenWatersVessels(bbox);
      if (ships.length) upsertShips(ships);
    } catch (err) {
      console.warn('[maritime] Open Waters fetch failed', err);
    } finally {
      setOpenwatersInflight(null);
    }
  })();

  setOpenwatersInflight(job);
  return job;
}

function shipsInView(view: OpenWatersBBox, pad = 0.2): OsirisShip[] {
  const latmin = view.latmin - pad;
  const latmax = view.latmax + pad;
  const lonmin = view.lonmin - pad;
  const lonmax = view.lonmax + pad;
  const out: OsirisShip[] = [];
  for (const ship of shipsCache.values()) {
    if (ship.lat >= latmin && ship.lat <= latmax && ship.lng >= lonmin && ship.lng <= lonmax) {
      out.push(ship);
    }
  }
  return out;
}

/** Optional AISHub member poll ≤1/min. */
async function refreshAishubShips(): Promise<void> {
  const username = getAishubUsername();
  if (!username) return;

  const now = Date.now();
  if (now - getAishubLastFetch() < 60_000) return;
  const inflight = getAishubInflight();
  if (inflight) return inflight;

  const job = (async () => {
    setAishubLastFetch(Date.now());
    const boxIndex = Math.floor(Date.now() / 60_000) % AIS_BOXES.length;
    const bbox = AIS_BOXES[boxIndex]!;
    try {
      const url = buildAishubUrl(username, bbox, 30);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(45_000),
        headers: { 'User-Agent': 'osiris-maritime/1.0', Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const text = await res.text();
      if (!text.trim()) return; // rate-limit empty body
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }
      upsertShips(mapAishubResponse(data));
    } catch (err) {
      console.warn('[maritime] AISHub fetch failed', err);
    } finally {
      setAishubInflight(null);
    }
  })();

  setAishubInflight(job);
  return job;
}

/* ── Response snapshot cache ──────────────────────────────────────────────
   The AIS websocket writes into shipsCache continuously, so a GET is pure
   aggregation over whatever that map happens to hold. Rebuilding it per
   request is what pins the CPU once the maritime layer gets popular: 58 ports
   and 10 chokepoints scanned against up to 20,000 ships is ~1.4M distance
   calculations, and the reply then serialises every one of those ships — a
   multi-megabyte JSON.stringify. At ~30 req/s that whole job runs thirty
   times a second to produce a byte-identical answer.

   Building it once per SNAPSHOT_TTL_MS and handing every caller the same
   pre-serialised string makes the cost independent of how many people are
   watching. The window sits well under the 10s the client polls at, so
   nothing reaches the map staler than it already was. */
const SNAPSHOT_TTL_MS = 5_000;

const globalForSnapshot = globalThis as unknown as {
  maritimeSnapshot?: { body: string; builtAt: number };
};

function buildSnapshot(now: number, shipList?: OsirisShip[]): string {
  // Clean up stale ships (older than 10 minutes)
  for (const [mmsi, ship] of shipsCache.entries()) {
    if (now - ship.timestamp > 10 * 60 * 1000) {
      shipsCache.delete(mmsi);
    }
  }

  const ships = shipList ?? Array.from(shipsCache.values());

  // Dynamically calculate live traffic (Fast approximation of Haversine)
  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dx = (lng1 - lng2) * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
    const dy = lat1 - lat2;
    return Math.sqrt(dx * dx + dy * dy) * 111.32;
  };

  const dynamicPorts = PORTS.map(port => {
    let nearbyCount = 0;
    let waitingCount = 0;

    for (let i = 0; i < ships.length; i++) {
      if (getDistanceKm(port.lat, port.lng, ships[i].lat, ships[i].lng) < 50) {
        nearbyCount++;
        // If speed is less than 0.5 knots, consider it anchored/waiting
        if (ships[i].speed < 0.5 && ships[i].type !== 'military') {
          waitingCount++;
        }
      }
    }

    // Heuristic: More than 40% waiting indicates congestion
    const congestionRatio = nearbyCount > 0 ? waitingCount / nearbyCount : 0;
    let congestionStatus = 'NORMAL';
    let estDwellTime = '1-2 Days';
    
    if (congestionRatio > 0.6 || waitingCount > 30) {
      congestionStatus = 'SEVERE';
      estDwellTime = '7+ Days';
    } else if (congestionRatio > 0.4 || waitingCount > 15) {
      congestionStatus = 'CONGESTED';
      estDwellTime = '3-5 Days';
    }

    return {
      ...port,
      volume: `${port.volume} | LIVE: ${nearbyCount} (WAITING: ${waitingCount})`,
      congestion: congestionStatus,
      dwell_time: estDwellTime
    };
  });

  const dynamicChokepoints = CHOKEPOINTS.map(choke => {
    let nearbyCount = 0;
    for (let i = 0; i < ships.length; i++) {
      if (getDistanceKm(choke.lat, choke.lng, ships[i].lat, ships[i].lng) < 100) nearbyCount++;
    }
    
    // Dynamically adjust risk based on live ship concentration
    let dynamicRisk = choke.risk;
    if (nearbyCount > 50) dynamicRisk = 'CRITICAL';
    else if (nearbyCount > 20 && dynamicRisk !== 'CRITICAL') dynamicRisk = 'HIGH';
    else if (nearbyCount > 5 && dynamicRisk === 'LOW') dynamicRisk = 'ELEVATED';

    return {
      ...choke,
      traffic: `${choke.traffic} | LIVE SHIPS: ${nearbyCount}`,
      risk: dynamicRisk
    };
  });

  return JSON.stringify({
    ports: dynamicPorts,
    chokepoints: dynamicChokepoints,
    ships: ships,
    total_ports: dynamicPorts.length,
    total_chokepoints: dynamicChokepoints.length,
    total_ships: ships.length,
    timestamp: new Date(now).toISOString(),
  });
}

/** Test seam — forces the next GET to rebuild. */
export function clearMaritimeSnapshot(): void {
  delete globalForSnapshot.maritimeSnapshot;
}

export async function GET(req: NextRequest) {
  const parsed = parseBbox(req.nextUrl.searchParams.get('bbox'));
  // parseBbox rejects spans >40°; for maritime we still want a looser viewport.
  let view: OpenWatersBBox | null = null;
  if (parsed) {
    view = {
      latmin: parsed.south,
      latmax: parsed.north,
      lonmin: parsed.west,
      lonmax: parsed.east,
    };
  } else {
    const raw = req.nextUrl.searchParams.get('bbox');
    if (raw) {
      const parts = raw.split(',').map((s) => Number(s.trim()));
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [west, south, east, north] = parts;
        if (west < east && south < north) {
          view = { latmin: south, latmax: north, lonmin: west, lonmax: east };
        }
      }
    }
  }

  await Promise.all([refreshOpenWatersShips(view), refreshAishubShips()]);

  const now = Date.now();
  // Viewport: return ships in/near the frame (after fetching that box).
  if (view) {
    const body = buildSnapshot(now, shipsInView(view));
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3, s-maxage=3, stale-while-revalidate=10',
      },
    });
  }

  const cached = globalForSnapshot.maritimeSnapshot;

  const snapshot = cached && now - cached.builtAt < SNAPSHOT_TTL_MS
    ? cached
    : { body: buildSnapshot(now), builtAt: now };
  globalForSnapshot.maritimeSnapshot = snapshot;

  const maxAgeSeconds = Math.floor(SNAPSHOT_TTL_MS / 1000);

  return new NextResponse(snapshot.body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=15`,
    },
  });
}
