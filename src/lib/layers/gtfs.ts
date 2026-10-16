import * as GtfsRealtimeBindingsMod from 'gtfs-realtime-bindings';
import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from './types';
import { pointFeature, emptyFc, capFeatures } from './geojson';

/** Next/webpack may expose CJS as `.default` or namespace; normalize once. */
const GtfsRealtimeBindings =
  (GtfsRealtimeBindingsMod as { default?: typeof GtfsRealtimeBindingsMod }).default ??
  GtfsRealtimeBindingsMod;

export type AgencyBBox = [west: number, south: number, east: number, north: number];

export interface GtfsAgency {
  id: string;
  name: string;
  vehicleUrl: string;
  bbox: AgencyBBox;
  disabled?: boolean;
  /** If set, agency is skipped unless `process.env[apiKeyEnv]` is non-empty; appended as `api_key` query. */
  apiKeyEnv?: string;
  /** Optional static GTFS zip URL for trip origin/destination + route type join. */
  staticGtfsUrl?: string;
  /** Optional GTFS-RT ServiceAlerts protobuf URL. */
  alertUrl?: string;
}

export function agencyBboxIntersects(agencyBbox: AgencyBBox, bbox: BBox): boolean {
  const [west, south, east, north] = agencyBbox;
  return west < bbox.east && east > bbox.west && south < bbox.north && north > bbox.south;
}

export function agenciesForBbox(registry: GtfsAgency[], bbox: BBox): GtfsAgency[] {
  return registry.filter(
    (a) =>
      !a.disabled &&
      typeof a.vehicleUrl === 'string' &&
      a.vehicleUrl.length > 0 &&
      Array.isArray(a.bbox) &&
      a.bbox.length === 4 &&
      agencyBboxIntersects(a.bbox, bbox),
  );
}

function inBbox(lng: number, lat: number, bbox: BBox | null | undefined): boolean {
  if (!bbox) return true;
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

const CURRENT_STATUS: Record<number, string> = {
  0: 'Incoming',
  1: 'Stopped',
  2: 'In transit',
};

const OCCUPANCY: Record<number, string> = {
  0: 'Empty',
  1: 'Many seats',
  2: 'Few seats',
  3: 'Standing room',
  4: 'Crushed',
  5: 'Full',
  6: 'Not accepting',
  7: 'No data available',
  8: 'Not boardable',
};

function enumLabel(map: Record<number, string>, value: unknown): string | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return map[n] ?? String(n);
}

/** Decode a GTFS-RT FeedMessage buffer into point features. */
export function decodeVehiclePositions(
  buffer: Uint8Array,
  agency: Pick<GtfsAgency, 'id' | 'name'>,
  bbox?: BBox | null,
  kind = 'ground_gtfs',
): FeatureCollection {
  let feed: ReturnType<typeof GtfsRealtimeBindings.transit_realtime.FeedMessage.decode>;
  try {
    feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);
  } catch {
    return emptyFc();
  }
  const features: Feature[] = [];
  for (const entity of feed.entity ?? []) {
    const vehicle = entity.vehicle;
    const pos = vehicle?.position;
    const lat = pos?.latitude;
    const lng = pos?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!inBbox(lng as number, lat as number, bbox)) continue;
    const vehicleId = vehicle?.vehicle?.id ?? entity.id ?? String(features.length);
    const id = `${agency.id}-${vehicleId}`;
    const trip = vehicle?.trip;
    const currentStatus = enumLabel(CURRENT_STATUS, vehicle?.currentStatus);
    const occupancyStatus = enumLabel(OCCUPANCY, vehicle?.occupancyStatus);
    features.push(
      pointFeature(id, lng as number, lat as number, {
        kind,
        agencyId: agency.id,
        agencyName: agency.name,
        vehicleId,
        label: vehicle?.vehicle?.label ?? null,
        routeId: trip?.routeId ?? null,
        tripId: trip?.tripId ?? null,
        directionId: trip?.directionId != null ? Number(trip.directionId) : null,
        startDate: trip?.startDate ?? null,
        startTime: trip?.startTime ?? null,
        stopId: vehicle?.stopId ?? null,
        currentStopSequence:
          vehicle?.currentStopSequence != null ? Number(vehicle.currentStopSequence) : null,
        currentStatus,
        occupancyStatus,
        bearing: Number.isFinite(pos?.bearing) ? pos?.bearing : null,
        speed: Number.isFinite(pos?.speed) ? pos?.speed : null,
        observedAt: vehicle?.timestamp != null ? Number(vehicle.timestamp) : null,
        attribution: agency.name,
      }),
    );
  }
  return { type: 'FeatureCollection', features };
}

export function mergeGtfsFc(parts: FeatureCollection[], max = 5000): FeatureCollection {
  const features: Feature[] = [];
  for (const part of parts) {
    if (Array.isArray(part?.features)) features.push(...part.features);
  }
  return capFeatures({ type: 'FeatureCollection', features }, max);
}
