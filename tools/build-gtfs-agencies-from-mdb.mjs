/**
 * Build gtfs-agencies.json from Mobility Database catalogs.csv
 * Keep keyless GTFS-RT vehicle-position feeds with a known bbox.
 *
 * Usage: node tools/build-gtfs-agencies-from-mdb.mjs [catalogs.csv]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const csvPath = process.argv[2] || join(root, 'mobility-catalogs.csv');
const outPath = join(root, 'public', 'data', 'layers', 'gtfs-agencies.json');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        q = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      q = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x)) rows.push(row);
      row = [];
      cell = '';
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const h = rows[0];
const idx = Object.fromEntries(h.map((k, i) => [k, i]));

/** Hand-curated extras known to work without Mobility DB auth flags. */
const EXTRA = [
  {
    id: 'mbta',
    name: 'MBTA',
    vehicleUrl: 'https://cdn.mbta.com/realtime/VehiclePositions.pb',
    alertUrl: 'https://cdn.mbta.com/realtime/Alerts.pb',
    staticGtfsUrl: 'https://cdn.mbta.com/MBTA_GTFS.zip',
    bbox: [-71.9, 41.5, -69.9, 42.9],
  },
  {
    id: 'mta-bus',
    name: 'MTA NYCT Bus',
    vehicleUrl: 'https://gtfsrt.prod.obanyc.com/vehiclePositions',
    staticGtfsUrl: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_b.zip',
    bbox: [-74.3, 40.4, -73.6, 41.0],
  },
];

const byId = new Map(EXTRA.map((a) => [a.id, a]));

for (const r of rows.slice(1)) {
  if ((r[idx['data_type']] || '') !== 'gtfs_rt') continue;
  const et = (r[idx['entity_type']] || '').toLowerCase();
  const url = r[idx['urls.direct_download']] || '';
  const isVp =
    et === 'vp' ||
    et.includes('vehicle') ||
    /VehiclePositions|vehicle_positions|vehiclepositions|gtfrealtime_VehiclePositions/i.test(
      url,
    );
  if (!isVp) continue;
  const auth = Number(r[idx['urls.authentication_type']] || 0);
  if (auth > 0) continue;
  if (!/^https?:\/\//i.test(url)) continue;
  const status = (r[idx['status']] || '').toLowerCase();
  if (status === 'inactive' || status === 'deprecated') continue;

  const south = Number(r[idx['location.bounding_box.minimum_latitude']]);
  const north = Number(r[idx['location.bounding_box.maximum_latitude']]);
  const west = Number(r[idx['location.bounding_box.minimum_longitude']]);
  const east = Number(r[idx['location.bounding_box.maximum_longitude']]);
  if (![south, north, west, east].every(Number.isFinite)) continue;
  // Skip absurd / missing global boxes
  if (east - west > 80 || north - south > 40) continue;
  if (east - west < 0.01 || north - south < 0.01) continue;

  const mdbId = r[idx['mdb_source_id']];
  const provider = r[idx['provider']] || r[idx['name']] || `MDB ${mdbId}`;
  const id = `mdb-${mdbId}` || slug(provider);
  if (byId.has(id)) continue;
  // Prefer https
  const vehicleUrl = url.replace(/^http:\/\//i, 'https://');
  byId.set(id, {
    id,
    name: String(provider).slice(0, 80),
    vehicleUrl,
    bbox: [west, south, east, north],
  });
}

const agencies = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(outPath, JSON.stringify(agencies, null, 2) + '\n');
console.log(`Wrote ${agencies.length} agencies → ${outPath}`);
