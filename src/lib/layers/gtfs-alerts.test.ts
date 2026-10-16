import { describe, it, expect } from 'vitest';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { decodeServiceAlerts } from './gtfs-alerts';

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

function encodeAlert(): Uint8Array {
  const msg = FeedMessage.create({
    header: { gtfsRealtimeVersion: '2.0', timestamp: 1 },
    entity: [
      {
        id: 'a1',
        alert: {
          headerText: { translation: [{ text: 'Delay on Red', language: 'en' }] },
          descriptionText: { translation: [{ text: 'Trains running 10 min late', language: 'en' }] },
          severityLevel: 2,
          informedEntity: [{ routeId: 'Red' }],
        },
      },
    ],
  });
  return FeedMessage.encode(msg).finish();
}

describe('decodeServiceAlerts', () => {
  it('maps alerts to points near agency centroid', () => {
    const fc = decodeServiceAlerts(encodeAlert(), {
      id: 'mbta',
      name: 'MBTA',
      bbox: [-71.9, 41.5, -69.9, 42.9],
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties?.kind).toBe('ground_transit_alerts');
    expect(fc.features[0]!.properties?.title).toBe('Delay on Red');
    expect(fc.features[0]!.properties?.routeIds).toBe('Red');
  });
});
