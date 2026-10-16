/** Assert Dark Matter road minzooms match earlier-detail targets. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const style = JSON.parse(readFileSync(join(root, 'public', 'dark-matter-style.json'), 'utf8'));

const expected = {
  tunnel_sec_case: 9,
  road_sec_case_noramp: 9,
  bridge_sec_case: 9,
  tunnel_sec_fill: 11,
  road_sec_fill_noramp: 11,
  bridge_sec_fill: 11,
  tunnel_minor_case: 11,
  road_minor_case: 11,
  bridge_minor_case: 11,
  tunnel_minor_fill: 13,
  road_minor_fill: 13,
  bridge_minor_fill: 13,
  tunnel_service_case: 13,
  road_service_case: 13,
  bridge_service_case: 13,
  tunnel_service_fill: 13,
  road_service_fill: 13,
  bridge_service_fill: 13,
  tunnel_path: 14,
  road_path: 14,
  bridge_path: 14,
  road_pri_fill_noramp: 8,
  tunnel_pri_fill: 8,
  bridge_pri_fill: 8,
  roadname_minor: 14,
  roadname_sec: 13,
  roadname_pri: 12,
  roadname_major: 12,
};

const byId = Object.fromEntries(style.layers.map((l) => [l.id, l]));
const fails = [];
for (const [id, mz] of Object.entries(expected)) {
  const layer = byId[id];
  if (!layer) {
    fails.push(`missing layer ${id}`);
    continue;
  }
  if (layer.minzoom !== mz) {
    fails.push(`${id}: minzoom=${layer.minzoom} expected ${mz}`);
  }
}

// Motorway/trunk surface cases must stay early (unchanged baseline).
for (const id of ['road_mot_case_noramp', 'road_trunk_case_noramp']) {
  if (byId[id]?.minzoom !== 5) {
    fails.push(`${id}: expected motorway/trunk case minzoom 5`);
  }
}

if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log(`ok: ${Object.keys(expected).length} street minzooms`);
