import type { Map as MlMap } from 'maplibre-gl';
import { sampleUV, speedToRgba, windSpeed, type WindFieldGrid } from './wind-field';
import {
  createParticles,
  particleCountForViewport,
  stepParticles,
  type Particle,
} from './wind-particles';
import { windGridFromJson } from './wind-openmeteo';

export type WindOverlay = {
  setGrid: (grid: WindFieldGrid | null) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
};

export function createWindOverlay(map: MlMap): WindOverlay {
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
  const parent = map.getContainer();
  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }
  parent.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  let grid: WindFieldGrid | null = null;
  let particles: Particle[] = [];
  let raf = 0;
  let running = false;
  let lastTs = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (grid) {
      const n = particleCountForViewport(w, h);
      if (Math.abs(particles.length - n) > 50) particles = createParticles(n);
    }
  };

  const frame = (ts: number) => {
    if (!running || document.hidden) return;
    raf = requestAnimationFrame(frame);
    if (!grid) return;
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    stepParticles(particles, grid, dt, { speedScale: 1.2, maxAge: 80 });

    const w = parent.clientWidth;
    const h = parent.clientHeight;
    ctx.fillStyle = 'rgba(12,14,26,0.12)';
    ctx.fillRect(0, 0, w, h);

    for (const p of particles) {
      const sample = sampleUV(grid, p.lng, p.lat);
      if (!sample) continue;
      const pt = map.project([p.lng, p.lat]);
      if (pt.x < -20 || pt.y < -20 || pt.x > w + 20 || pt.y > h + 20) continue;
      const spd = windSpeed(sample.u, sample.v);
      const [r, g, b, a] = speedToRgba(spd);
      const len = 1.5 + Math.min(6, spd * 0.25);
      const cosLat = Math.cos((p.lat * Math.PI) / 180) || 1e-6;
      const dLng = (sample.u / (111_320 * cosLat)) * len * 400;
      const dLat = (sample.v / 111_320) * len * 400;
      const tip = map.project([p.lng + dLng, p.lat + dLat]);
      ctx.strokeStyle = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }
  };

  const onVis = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTs = 0;
    } else if (running) {
      lastTs = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  map.on('resize', resize);
  document.addEventListener('visibilitychange', onVis);
  resize();

  return {
    setGrid(next) {
      grid = next;
      resize();
      if (next && particles.length === 0) {
        particles = createParticles(
          particleCountForViewport(parent.clientWidth, parent.clientHeight),
        );
      }
    },
    start() {
      if (running) return;
      running = true;
      lastTs = 0;
      if (!document.hidden) raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTs = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      resize();
    },
    destroy() {
      this.stop();
      map.off('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      canvas.remove();
      grid = null;
      particles = [];
    },
  };
}

export async function fetchWindGrid(product = 'surface'): Promise<WindFieldGrid> {
  const res = await fetch(`/api/layers/wind?product=${encodeURIComponent(product)}`);
  if (!res.ok) throw new Error(`wind ${res.status}`);
  const j = await res.json();
  return windGridFromJson(j);
}
