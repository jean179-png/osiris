import type { CctvCamera } from './types';
import { youtubeEmbedUrl } from '@/lib/youtube';

/**
 * OSIRIS — Czechia / Prague city life
 *
 * ŘSD's public camera catalogue is not openly fetchable without an NDIC
 * subscription. Prague is covered by curated city views: live plaza / station
 * YouTube streams, the Grand Hotel Praha EarthCam of Old Town Square, and
 * SkylineWebcams stills overlooking the centre.
 */

function skyline(id: number): string {
  return `/api/cctv/proxy?url=${encodeURIComponent(`https://cdn.skylinewebcams.com/live${id}.jpg`)}`;
}

function ytEmbed(videoId: string): string {
  return youtubeEmbedUrl(videoId);
}

const CZECHIA_CAMERAS: CctvCamera[] = [
  {
    id: 'cz-prague-oldtown-earthcam',
    lat: 50.0875, lng: 14.4210,
    name: 'Prague - Old Town Square (Astronomical Clock)',
    city: 'Prague', country: 'Czechia',
    stream_url:
      'https://www.earthcam.com/js/embed.php?type=h264&vid=4162.flv&w=auto&company=GrandHotelPraha&timezone=Europe/Prague&metar=LKPR&ecn=1',
    stream_type: 'iframe',
    external_url: 'https://www.grandhotelpraha.cz/en/live-cam/',
    source: 'Grand Hotel Praha / EarthCam',
  },
  {
    id: 'cz-prague-camstreamer',
    lat: 50.0868, lng: 14.4202,
    name: 'Prague - City Live (CamStreamer)',
    city: 'Prague', country: 'Czechia',
    stream_url: ytEmbed('kvYMIaXclIE'),
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/channel/UCs8QCDKYww0gFmZkJ3JHiBQ/live',
    source: 'YouTube Live',
  },
  {
    id: 'cz-prague-main-station',
    lat: 50.0831, lng: 14.4352,
    name: 'Prague - Main Station',
    city: 'Prague', country: 'Czechia',
    stream_url: ytEmbed('tmlE1ct0cYk'),
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/watch?v=tmlE1ct0cYk',
    source: 'YouTube Live',
  },
  {
    id: 'sky-cz-prague-astro',
    lat: 50.0870, lng: 14.4208,
    name: 'Prague - Astronomical Clock / Old Town Square',
    city: 'Prague', country: 'Czechia',
    feed_url: skyline(732),
    external_url: 'https://www.skylinewebcams.com/en/webcam/czech-republic/prague/prague/prague.html',
    source: 'SkylineWebcams',
  },
  {
    id: 'sky-cz-prague-panorama',
    lat: 50.0865, lng: 14.4110,
    name: 'Prague - City Panorama',
    city: 'Prague', country: 'Czechia',
    feed_url: skyline(3938),
    external_url: 'https://www.skylinewebcams.com/en/webcam/czech-republic/prague/prague/panorama.html',
    source: 'SkylineWebcams',
  },
  {
    id: 'sky-cz-prague-bridge-life',
    lat: 50.0863, lng: 14.4115,
    name: 'Prague - Charles Bridge area',
    city: 'Prague', country: 'Czechia',
    feed_url: skyline(5733),
    external_url: 'https://www.skylinewebcams.com/en/webcam/czech-republic/prague/prague/old-town-bridge-tower.html',
    source: 'SkylineWebcams',
  },
];

export async function fetchCzechiaCameras(): Promise<CctvCamera[]> {
  return CZECHIA_CAMERAS;
}
