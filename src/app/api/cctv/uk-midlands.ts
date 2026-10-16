import type { CctvCamera } from './types';

/**
 * OSIRIS — UK Midlands city life (Milton Keynes / Bedford / Leighton Buzzard)
 *
 * These towns do not publish open plaza or high-street CCTV. Motorway stills
 * are traffic, not street life, so they stay out. The only durable public
 * “people + place” feed found in the corridor is the Bedford Midland Main
 * Line railcam (Spotatrain links to the operator; no embed grant).
 *
 * Milton Keynes and Leighton Buzzard have no verified public city livestream
 * right now — better an empty map than a pin that opens somewhere else.
 */

const UK_MIDLANDS_CITY: CctvCamera[] = [
  {
    id: 'uk-bedford-railcam',
    lat: 52.1177, lng: -0.4786,
    name: 'Bedford - Midland Main Line (Railcam)',
    city: 'Bedford', country: 'United Kingdom',
    external_url: 'https://www.spotatrain.com/live-cams/uk-rc-bedford/',
    source: 'Railcam UK',
  },
];

export function midlandsCameras(): CctvCamera[] {
  return UK_MIDLANDS_CITY;
}

export async function fetchUkMidlandsCameras(): Promise<CctvCamera[]> {
  return midlandsCameras();
}
