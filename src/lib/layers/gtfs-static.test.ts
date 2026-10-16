import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildStaticIndex,
  buildStaticPack,
  coordsForShapeId,
  enrichVehiclesWithStatic,
  resolveTripShapeCoords,
  routeTypeLabel,
  splitCsvLine,
  stopPathForTrip,
  upcomingStopsForTrip,
  stopsAlongTrip,
  _resetStaticGtfsCacheForTests,
} from './gtfs-static';
import type { FeatureCollection } from 'geojson';

beforeEach(() => {
  _resetStaticGtfsCacheForTests();
});

describe('splitCsvLine', () => {
  it('splits plain and quoted fields', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    expect(splitCsvLine('a,"b""c",d')).toEqual(['a', 'b"c', 'd']);
  });
});

describe('routeTypeLabel', () => {
  it('maps GTFS route_type codes', () => {
    expect(routeTypeLabel(2)).toBe('Rail');
    expect(routeTypeLabel(3)).toBe('Bus');
    expect(routeTypeLabel(99)).toBe('Type 99');
    expect(routeTypeLabel(null)).toBeNull();
  });
});

describe('buildStaticIndex', () => {
  it('joins trip endpoints and route type', () => {
    const index = buildStaticIndex({
      routes: 'route_id,route_short_name,route_long_name,route_type\nR1,Red,Red Line,1\n',
      trips: 'route_id,trip_id,trip_headsign,shape_id\nR1,t1,Ashmont,shp1\n',
      stops: 'stop_id,stop_name\nA,Alewife\nB,Park Street\nC,Ashmont\n',
      stopTimes:
        'trip_id,stop_id,stop_sequence\nt1,A,1\nt1,B,2\nt1,C,10\n',
    });
    const ep = index.get('t1');
    expect(ep).toEqual({
      origin: 'Alewife',
      destination: 'Ashmont',
      headsign: 'Ashmont',
      routeId: 'R1',
      routeShortName: 'Red',
      routeLongName: 'Red Line',
      routeType: 1,
      routeTypeLabel: 'Subway',
      shapeId: 'shp1',
    });
  });
});

describe('resolveTripShapeCoords', () => {
  it('uses shapes.txt when present', () => {
    const pack = buildStaticPack({
      routes: 'route_id,route_short_name,route_long_name,route_type\nR1,Red,Red Line,1\n',
      trips: 'route_id,trip_id,trip_headsign,shape_id\nR1,t1,Ashmont,shp1\n',
      stops: 'stop_id,stop_name,stop_lat,stop_lon\nA,Alewife,42.4,-71.1\nC,Ashmont,42.3,-71.0\n',
      stopTimes: 'trip_id,stop_id,stop_sequence\nt1,A,1\nt1,C,2\n',
      shapes:
        'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nshp1,42.4,-71.1,1\nshp1,42.35,-71.05,2\nshp1,42.3,-71.0,3\n',
    });
    const resolved = resolveTripShapeCoords(pack, 't1', 'R1');
    expect(resolved?.source).toBe('shape');
    expect(resolved?.coords).toEqual([
      [-71.1, 42.4],
      [-71.05, 42.35],
      [-71.0, 42.3],
    ]);
    expect(coordsForShapeId(pack, 'shp1')?.length).toBe(3);
  });

  it('falls back to stop path when shape missing', () => {
    const pack = buildStaticPack({
      routes: 'route_id,route_short_name,route_long_name,route_type\nR1,Red,Red Line,1\n',
      trips: 'route_id,trip_id,trip_headsign\nR1,t1,Ashmont\n',
      stops: 'stop_id,stop_name,stop_lat,stop_lon\nA,Alewife,42.4,-71.1\nC,Ashmont,42.3,-71.0\n',
      stopTimes: 'trip_id,stop_id,stop_sequence\nt1,A,1\nt1,C,2\n',
      shapes: null,
    });
    const resolved = resolveTripShapeCoords(pack, 't1', null);
    expect(resolved?.source).toBe('stops');
    expect(resolved?.coords).toEqual([
      [-71.1, 42.4],
      [-71.0, 42.3],
    ]);
    expect(stopPathForTrip(pack, 't1')?.length).toBe(2);
  });

  it('falls back to route shape when trip id unknown', () => {
    const pack = buildStaticPack({
      routes: 'route_id,route_short_name,route_long_name,route_type\nR1,Red,Red Line,1\n',
      trips: 'route_id,trip_id,trip_headsign,shape_id\nR1,t1,Ashmont,shp1\n',
      stops: 'stop_id,stop_name,stop_lat,stop_lon\nA,Alewife,42.4,-71.1\n',
      stopTimes: null,
      shapes:
        'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nshp1,42.4,-71.1,1\nshp1,42.3,-71.0,2\n',
    });
    const resolved = resolveTripShapeCoords(pack, null, 'R1');
    expect(resolved?.shapeId).toBe('shp1');
    expect(resolved?.coords.length).toBe(2);
  });
});

describe('upcomingStopsForTrip', () => {
  it('returns stops after current sequence with times', () => {
    const pack = buildStaticPack({
      routes: 'route_id,route_short_name,route_long_name,route_type\nR1,Red,Red Line,1\n',
      trips: 'route_id,trip_id,trip_headsign,shape_id\nR1,t1,Ashmont,shp1\n',
      stops:
        'stop_id,stop_name,stop_lat,stop_lon\nA,Alewife,42.4,-71.1\nB,Park,42.35,-71.05\nC,Ashmont,42.3,-71.0\nD,End,42.25,-70.95\n',
      stopTimes:
        'trip_id,stop_id,stop_sequence,arrival_time,departure_time\nt1,A,1,08:00:00,08:00:00\nt1,B,2,08:10:00,08:11:00\nt1,C,3,08:20:00,08:20:00\nt1,D,4,08:30:00,08:30:00\n',
      shapes: null,
    });
    const rows = upcomingStopsForTrip(pack, 't1', { currentStopSequence: 2, limit: 3 });
    expect(rows.map((r) => r.stopId)).toEqual(['C', 'D']);
    expect(rows[0]!.name).toBe('Ashmont');
    expect(rows[0]!.departure).toMatch(/:/);
  });
});

describe('stopsAlongTrip', () => {
  it('marks current and next along the full trip', () => {
    const pack = buildStaticPack({
      routes: 'route_id,route_short_name,route_long_name,route_type\nR1,Red,Red Line,1\n',
      trips: 'route_id,trip_id,trip_headsign,shape_id\nR1,t1,Ashmont,shp1\n',
      stops:
        'stop_id,stop_name,stop_lat,stop_lon\nA,Alewife,42.4,-71.1\nB,Park,42.35,-71.05\nC,Ashmont,42.3,-71.0\nD,End,42.25,-70.95\n',
      stopTimes:
        'trip_id,stop_id,stop_sequence,arrival_time,departure_time\nt1,A,1,08:00:00,08:00:00\nt1,B,2,08:10:00,08:11:00\nt1,C,3,08:20:00,08:20:00\nt1,D,4,08:30:00,08:30:00\n',
      shapes: null,
    });
    const rows = stopsAlongTrip(pack, 't1', { currentStopId: 'B', limit: 10 });
    expect(rows.map((r) => r.stopId)).toEqual(['A', 'B', 'C', 'D']);
    expect(rows.find((r) => r.stopId === 'B')?.isCurrent).toBe(true);
    expect(rows.find((r) => r.stopId === 'C')?.isNext).toBe(true);
  });
});

describe('enrichVehiclesWithStatic', () => {
  it('attaches origin/destination to matching trip features', () => {
    const index = buildStaticIndex({
      routes: 'route_id,route_short_name,route_long_name,route_type\nR1,Red,Red Line,1\n',
      trips: 'route_id,trip_id,trip_headsign\nR1,t1,Ashmont\n',
      stops: 'stop_id,stop_name\nA,Alewife\nC,Ashmont\n',
      stopTimes: 'trip_id,stop_id,stop_sequence\nt1,A,1\nt1,C,2\n',
    });
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'mbta-1',
          geometry: { type: 'Point', coordinates: [-71, 42] },
          properties: { kind: 'ground_gtfs', tripId: 't1', routeId: null },
        },
        {
          type: 'Feature',
          id: 'track-1',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
          properties: { kind: 'ground_train_tracks' },
        },
      ],
    };
    const out = enrichVehiclesWithStatic(fc, index);
    expect(out.features[0]!.properties?.origin).toBe('Alewife');
    expect(out.features[0]!.properties?.destination).toBe('Ashmont');
    expect(out.features[0]!.properties?.routeTypeLabel).toBe('Subway');
    expect(out.features[0]!.properties?.routeId).toBe('R1');
    expect(out.features[1]!.properties?.origin).toBeUndefined();
  });
});
