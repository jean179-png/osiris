import { sampleUV, type WindFieldGrid } from './wind-field';

export type Particle = { lng: number; lat: number; age: number };

export function createParticles(count: number, rng: () => number = Math.random): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      lng: -180 + rng() * 360,
      lat: -85 + rng() * 170,
      age: rng() * 100,
    });
  }
  return out;
}

function respawn(p: Particle, rng: () => number) {
  p.lng = -180 + rng() * 360;
  p.lat = -85 + rng() * 170;
  p.age = 0;
}

/**
 * Advect particles in geographic space using UV (m/s).
 * speedScale multiplies advection (visual only).
 */
export function stepParticles(
  particles: Particle[],
  grid: WindFieldGrid,
  dtSec: number,
  opts?: { maxAge?: number; speedScale?: number; rng?: () => number },
): void {
  const maxAge = opts?.maxAge ?? 90;
  const speedScale = opts?.speedScale ?? 1;
  const rng = opts?.rng ?? Math.random;
  for (const p of particles) {
    p.age += dtSec;
    const uv = sampleUV(grid, p.lng, p.lat);
    if (!uv || p.age > maxAge) {
      respawn(p, rng);
      continue;
    }
    const cosLat = Math.cos((p.lat * Math.PI) / 180) || 1e-6;
    p.lat += ((uv.v * speedScale * dtSec) / 111_320) * 8;
    p.lng += ((uv.u * speedScale * dtSec) / (111_320 * cosLat)) * 8;
    if (p.lng > 180) p.lng -= 360;
    if (p.lng < -180) p.lng += 360;
    if (p.lat > 85 || p.lat < -85) respawn(p, rng);
  }
}

export function particleCountForViewport(width: number, height: number, cap = 4000): number {
  const n = Math.floor((width * height) / 900);
  return Math.max(200, Math.min(cap, n));
}
