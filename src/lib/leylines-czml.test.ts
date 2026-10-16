import { describe, expect, it } from 'vitest';
import { czmlPolylinesToFeatureCollection } from './leylines-czml';

describe('leylines-czml', () => {
  it('converts cartographicDegrees polylines', () => {
    const fc = czmlPolylinesToFeatureCollection(
      [
        { id: 'doc' },
        {
          id: '87p',
          name: 'Stonehenge Ley 1',
          polyline: {
            positions: {
              cartographicDegrees: [-2.05409, 51.0553, 0, -1.93272, 51.1215, 0],
            },
          },
        },
      ],
      { source: 'watkins', slug: 'stonehenge-line' },
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties).toMatchObject({
      name: 'Stonehenge Ley 1',
      source: 'watkins',
      slug: 'stonehenge-line',
    });
    expect(fc.features[0]!.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [-2.05409, 51.0553],
        [-1.93272, 51.1215],
      ],
    });
  });

  it('skips empty / invalid packets', () => {
    expect(czmlPolylinesToFeatureCollection(null).features).toEqual([]);
    expect(czmlPolylinesToFeatureCollection([]).features).toEqual([]);
    expect(
      czmlPolylinesToFeatureCollection([
        { polyline: { positions: { cartographicDegrees: [1, 2, 0] } } },
      ]).features,
    ).toEqual([]);
  });

  it('merges multiple polylines', () => {
    const fc = czmlPolylinesToFeatureCollection([
      {
        name: 'A',
        polyline: {
          positions: { cartographicDegrees: [0, 0, 0, 1, 1, 0] },
        },
      },
      {
        name: 'B',
        polyline: {
          positions: { cartographicDegrees: [2, 2, 0, 3, 3, 0] },
        },
      },
    ]);
    expect(fc.features.map((f) => f.properties?.name)).toEqual(['A', 'B']);
  });
});
