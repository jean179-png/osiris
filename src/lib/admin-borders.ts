import type { FeatureCollection } from 'geojson';

const LOCAL_URL = '/data/admin-borders.json';

const CDN = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson';

const REMOTE = {
  countries: `${CDN}/ne_110m_admin_0_boundary_lines_land.geojson`,
  admin1: `${CDN}/ne_50m_admin_1_states_provinces_lines.geojson`,
} as const;

let cached: FeatureCollection | null = null;
let inflight: Promise<FeatureCollection> | null = null;

function mergeRemote(countries: FeatureCollection, admin1: FeatureCollection): FeatureCollection {
  const usca = admin1.features.filter(f => {
    const adm0 = f.properties?.ADM0_A3;
    return adm0 === 'USA' || adm0 === 'CAN';
  });
  return {
    type: 'FeatureCollection',
    features: [...countries.features, ...usca],
  };
}

async function fetchJson(url: string): Promise<FeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`admin borders fetch failed: ${url} (${res.status})`);
  return res.json() as Promise<FeatureCollection>;
}

async function loadRemote(): Promise<FeatureCollection> {
  const [countries, admin1] = await Promise.all([
    fetchJson(REMOTE.countries),
    fetchJson(REMOTE.admin1),
  ]);
  return mergeRemote(countries, admin1);
}

/** Simplified country + US state + Canadian province lines (Natural Earth–derived). */
export async function loadAdminBordersGeoJson(): Promise<FeatureCollection> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      cached = await fetchJson(LOCAL_URL);
      return cached;
    } catch {
      cached = await loadRemote();
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Test hook — clears in-memory cache between tests. */
export function clearAdminBordersCacheForTests(): void {
  cached = null;
  inflight = null;
}
