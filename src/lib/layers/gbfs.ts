import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from './types';
import { httpJson } from '@/lib/httpJson';
import { pointFeature, emptyFc, capFeatures } from './geojson';
import { agencyBboxIntersects, type AgencyBBox } from './gtfs';

export interface GbfsSystem {
  id: string;
  name: string;
  autoDiscoveryUrl: string;
  bbox: AgencyBBox;
  disabled?: boolean;
}

type GbfsFeed = { name: string; url: string };
type GbfsDiscovery = {
  data?: { feeds?: GbfsFeed[]; en?: { feeds?: GbfsFeed[] }; [k: string]: unknown };
};

function feedsFromDiscovery(json: GbfsDiscovery): GbfsFeed[] {
  const d = json?.data;
  if (!d) return [];
  if (Array.isArray(d.feeds)) return d.feeds;
  if (d.en && Array.isArray(d.en.feeds)) return d.en.feeds;
  for (const v of Object.values(d)) {
    if (v && typeof v === 'object' && Array.isArray((v as { feeds?: GbfsFeed[] }).feeds)) {
      return (v as { feeds: GbfsFeed[] }).feeds;
    }
  }
  return [];
}

export function systemsForBbox(registry: GbfsSystem[], bbox: BBox): GbfsSystem[] {
  return registry.filter(
    (s) =>
      !s.disabled &&
      typeof s.autoDiscoveryUrl === 'string' &&
      Array.isArray(s.bbox) &&
      s.bbox.length === 4 &&
      agencyBboxIntersects(s.bbox, bbox),
  );
}

function inBbox(lng: number, lat: number, bbox: BBox): boolean {
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

export function mapFreeBikeStatus(
  data: unknown,
  system: Pick<GbfsSystem, 'id' | 'name'>,
  bbox: BBox,
): FeatureCollection {
  const bikes = (data as { data?: { bikes?: unknown[] } })?.data?.bikes;
  if (!Array.isArray(bikes)) return emptyFc();
  const features: Feature[] = [];
  for (const b of bikes) {
    const row = b as {
      bike_id?: string;
      lat?: number;
      lon?: number;
      is_reserved?: boolean;
      is_disabled?: boolean;
      vehicle_type_id?: string;
    };
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!inBbox(lng, lat, bbox)) continue;
    if (row.is_disabled) continue;
    const id = `${system.id}-${row.bike_id || features.length}`;
    features.push(
      pointFeature(id, lng, lat, {
        kind: 'ground_gbfs',
        agencyId: system.id,
        agencyName: system.name,
        name: row.bike_id || system.name,
        vehicleId: row.bike_id ?? null,
        vehicleType: row.vehicle_type_id ?? 'bike',
        reserved: !!row.is_reserved,
        attribution: system.name,
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, 3000);
}

export function mapStationStatus(
  stationStatus: unknown,
  stationInfo: unknown,
  system: Pick<GbfsSystem, 'id' | 'name'>,
  bbox: BBox,
): FeatureCollection {
  const infoRows = (stationInfo as { data?: { stations?: unknown[] } })?.data?.stations;
  const statusRows = (stationStatus as { data?: { stations?: unknown[] } })?.data?.stations;
  if (!Array.isArray(infoRows) || !Array.isArray(statusRows)) return emptyFc();
  const infoById = new Map<string, { lat: number; lng: number; name: string }>();
  for (const s of infoRows) {
    const row = s as { station_id?: string; name?: string; lat?: number; lon?: number };
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!row.station_id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    infoById.set(row.station_id, { lat, lng, name: row.name || row.station_id });
  }
  const features: Feature[] = [];
  for (const s of statusRows) {
    const row = s as {
      station_id?: string;
      num_bikes_available?: number;
      num_docks_available?: number;
      is_renting?: boolean;
    };
    if (!row.station_id) continue;
    const info = infoById.get(row.station_id);
    if (!info) continue;
    if (!inBbox(info.lng, info.lat, bbox)) continue;
    const bikes = Number(row.num_bikes_available) || 0;
    features.push(
      pointFeature(`${system.id}-st-${row.station_id}`, info.lng, info.lat, {
        kind: 'ground_gbfs',
        agencyId: system.id,
        agencyName: system.name,
        name: info.name,
        vehicleType: 'station',
        bikesAvailable: bikes,
        docksAvailable: Number(row.num_docks_available) || 0,
        renting: row.is_renting !== false,
        attribution: system.name,
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, 2000);
}

export async function fetchGbfsSystem(
  system: GbfsSystem,
  bbox: BBox,
): Promise<FeatureCollection> {
  try {
    const discovery = await httpJson<GbfsDiscovery>(system.autoDiscoveryUrl, { timeoutMs: 10_000 });
    const feeds = feedsFromDiscovery(discovery);
    const freeBike = feeds.find((f) => f.name === 'free_bike_status');
    const stationStatus = feeds.find((f) => f.name === 'station_status');
    const stationInfo = feeds.find((f) => f.name === 'station_information');

    if (freeBike?.url) {
      try {
        const data = await httpJson<unknown>(freeBike.url, { timeoutMs: 10_000 });
        const fc = mapFreeBikeStatus(data, system, bbox);
        if (fc.features.length > 0) return fc;
      } catch {
        /* try stations */
      }
    }

    if (stationStatus?.url && stationInfo?.url) {
      const [st, info] = await Promise.all([
        httpJson<unknown>(stationStatus.url, { timeoutMs: 10_000 }),
        httpJson<unknown>(stationInfo.url, { timeoutMs: 10_000 }),
      ]);
      return mapStationStatus(st, info, system, bbox);
    }
    return emptyFc();
  } catch {
    return emptyFc();
  }
}
