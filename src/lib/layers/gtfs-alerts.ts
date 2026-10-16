import * as GtfsRealtimeBindingsMod from 'gtfs-realtime-bindings';
import type { Feature, FeatureCollection } from 'geojson';
import type { GtfsAgency } from './gtfs';
import { pointFeature, emptyFc, capFeatures } from './geojson';
import type { BBox } from './types';
import { resolveTrainAlertUrl, trainFetchHeaders } from './trains';

const GtfsRealtimeBindings =
  (GtfsRealtimeBindingsMod as { default?: typeof GtfsRealtimeBindingsMod }).default ??
  GtfsRealtimeBindingsMod;

const SEVERITY: Record<number, string> = {
  1: 'Info',
  2: 'Warning',
  3: 'Severe',
};

function agencyCentroid(agency: Pick<GtfsAgency, 'bbox'>): [number, number] {
  const [w, s, e, n] = agency.bbox;
  return [(w + e) / 2, (s + n) / 2];
}

function inBbox(lng: number, lat: number, bbox: BBox | null | undefined): boolean {
  if (!bbox) return true;
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

/** Decode GTFS-RT Alerts into point features at agency centroid (stop geometry optional later). */
export function decodeServiceAlerts(
  buffer: Uint8Array,
  agency: Pick<GtfsAgency, 'id' | 'name' | 'bbox'>,
  bbox?: BBox | null,
): FeatureCollection {
  let feed: ReturnType<typeof GtfsRealtimeBindings.transit_realtime.FeedMessage.decode>;
  try {
    feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);
  } catch {
    return emptyFc();
  }
  const [lng, lat] = agencyCentroid(agency);
  if (!inBbox(lng, lat, bbox)) return emptyFc();

  const features: Feature[] = [];
  for (const entity of feed.entity ?? []) {
    const alert = entity.alert;
    if (!alert) continue;
    const header =
      alert.headerText?.translation?.[0]?.text ??
      alert.descriptionText?.translation?.[0]?.text ??
      'Service alert';
    const description = alert.descriptionText?.translation?.[0]?.text ?? null;
    const url = alert.url?.translation?.[0]?.text ?? null;
    const severity =
      SEVERITY[Number(alert.severityLevel)] ??
      (alert.effect != null ? String(alert.effect) : null);
    const routeIds = (alert.informedEntity ?? [])
      .map((e) => e.routeId)
      .filter((id): id is string => !!id);
    const tripIds = (alert.informedEntity ?? [])
      .map((e) => e.trip?.tripId)
      .filter((id): id is string => !!id);
    const id = `${agency.id}-alert-${entity.id || features.length}`;
    // Jitter so stacked alerts don't sit on one pixel.
    const jLng = lng + ((features.length * 0.013) % 0.08) - 0.04;
    const jLat = lat + ((features.length * 0.017) % 0.08) - 0.04;
    features.push(
      pointFeature(id, jLng, jLat, {
        kind: 'ground_transit_alerts',
        agencyId: agency.id,
        agencyName: agency.name,
        title: header,
        name: header,
        description,
        severity,
        url,
        routeIds: routeIds.slice(0, 8).join(', ') || null,
        tripIds: tripIds.slice(0, 8).join(', ') || null,
        attribution: agency.name,
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, 200);
}

export async function fetchAgencyAlerts(
  agency: GtfsAgency,
  bbox: BBox,
): Promise<FeatureCollection> {
  const url = resolveTrainAlertUrl(agency);
  if (!url) return emptyFc();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: trainFetchHeaders(agency),
    });
    if (!res.ok) return emptyFc();
    const buf = new Uint8Array(await res.arrayBuffer());
    return decodeServiceAlerts(buf, agency, bbox);
  } catch {
    return emptyFc();
  }
}
