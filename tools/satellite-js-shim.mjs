/**
 * JS-only satellite.js surface for webpack packs.
 * The package main re-exports WASM runtimes that need Node `module` /
 * `worker_threads`; orbit propagation only needs the classic SGP4 paths.
 */
export { twoline2satrec } from '../node_modules/satellite.js/dist/io.js';
export { propagate, gstime } from '../node_modules/satellite.js/dist/propagation.js';
export {
  eciToGeodetic,
  degreesLat,
  degreesLong,
} from '../node_modules/satellite.js/dist/transforms.js';
