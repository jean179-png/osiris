# Mapillary Street View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In-app Mapillary street peek at a map point, with in-view snap (≤100 m, ≤55° bearing cone), LayerPanel coverage + right-click entry, Google Street View as external fallback only.

**Architecture:** Pure geo + ranking helpers (TDD). Server routes hold `MAPILLARY_ACCESS_TOKEN` and call `graph.mapillary.com` / tile proxy. Client opens a `FloatingWindow` with MapillaryJS (client token via `NEXT_PUBLIC_MAPILLARY_TOKEN`) or embed fallback. Map context menu + `street_view` layer share one open-viewer callback.

**Tech Stack:** Next.js route handlers, Vitest, MapLibre GL, MapillaryJS, FloatingWindow, LayerPanel.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-mapillary-street-view-design.md`
- In-view: distance ≤ 100 m AND |compass − bearing(image→P)| ≤ 55°
- Server token never returned to the client in API JSON
- Google = external link only
- Street View layer off by default
- Mapillary `/images` radius search max is 50 m — use **bbox** (~100 m half-width) for nearest search instead

---

### Task 1: In-view geo helpers (TDD)

**Files:**
- Create: `src/lib/mapillary-inview.ts`
- Create: `src/lib/mapillary-inview.test.ts`

**Interfaces:**
- Produces:
  - `haversineMeters(a: LngLat, b: LngLat): number`
  - `bearingDegrees(from: LngLat, to: LngLat): number` (0–360)
  - `angularDeltaDegrees(a: number, b: number): number` (0–180)
  - `pickInViewImage(target: LngLat, images: MapillaryImagePose[], opts?: { maxMeters?: number; maxBearingDeg?: number }): MapillaryImagePose | null`
  - `type LngLat = { lng: number; lat: number }`
  - `type MapillaryImagePose = { id: string; lng: number; lat: number; compassAngle: number }`
- Defaults: `maxMeters = 100`, `maxBearingDeg = 55`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  bearingDegrees,
  angularDeltaDegrees,
  pickInViewImage,
} from './mapillary-inview';

describe('angularDeltaDegrees', () => {
  it('wraps across 0', () => {
    expect(angularDeltaDegrees(10, 350)).toBeCloseTo(20, 5);
  });
});

describe('pickInViewImage', () => {
  const P = { lng: -71.0589, lat: 42.3601 };

  it('rejects image looking away even if close', () => {
    const away = {
      id: '1',
      lng: -71.0589,
      lat: 42.3605, // ~44 m north
      compassAngle: 180, // facing south, away from P if image is north of P... 
      // Image north of P: bearing image→P is ~180 (south). compass 180 = facing P.
      // Use compass 0 (facing north) so looking away from P.
    };
    // Fix: image north of P, compassAngle 0 (north) → looking away from P (south)
    const img = { id: '1', lng: -71.0589, lat: 42.3605, compassAngle: 0 };
    expect(pickInViewImage(P, [img])).toBeNull();
  });

  it('picks closer in-view image over farther', () => {
    const near = { id: 'near', lng: -71.0589, lat: 42.3603, compassAngle: 180 };
    const far = { id: 'far', lng: -71.0589, lat: 42.3608, compassAngle: 180 };
    expect(pickInViewImage(P, [far, near])?.id).toBe('near');
  });

  it('rejects beyond 100 m', () => {
    const far = { id: 'far', lng: -71.0589, lat: 42.3620, compassAngle: 180 };
    expect(haversineMeters(far, P)).toBeGreaterThan(100);
    expect(pickInViewImage(P, [far])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/mapillary-inview.test.ts
```

- [ ] **Step 3: Implement `mapillary-inview.ts`**

```ts
export type LngLat = { lng: number; lat: number };
export type MapillaryImagePose = {
  id: string;
  lng: number;
  lat: number;
  compassAngle: number;
};

const R = 6371000;

export function haversineMeters(a: LngLat, b: LngLat): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const la1 = toR(a.lat);
  const la2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(from: LngLat, to: LngLat): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const φ1 = toR(from.lat);
  const φ2 = toR(to.lat);
  const Δλ = toR(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function angularDeltaDegrees(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

export function pickInViewImage(
  target: LngLat,
  images: MapillaryImagePose[],
  opts?: { maxMeters?: number; maxBearingDeg?: number },
): MapillaryImagePose | null {
  const maxMeters = opts?.maxMeters ?? 100;
  const maxBearingDeg = opts?.maxBearingDeg ?? 55;
  const scored: { img: MapillaryImagePose; dist: number; ang: number }[] = [];
  for (const img of images) {
    const dist = haversineMeters(img, target);
    if (dist > maxMeters) continue;
    const brg = bearingDegrees(img, target);
    const ang = angularDeltaDegrees(img.compassAngle, brg);
    if (ang > maxBearingDeg) continue;
    scored.push({ img, dist, ang });
  }
  scored.sort((a, b) => a.dist - b.dist || a.ang - b.ang);
  return scored[0]?.img ?? null;
}

/** ~100 m half-box in degrees (bbox for Mapillary /images). */
export function bboxAround(target: LngLat, meters = 100): [number, number, number, number] {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((target.lat * Math.PI) / 180));
  return [
    target.lng - dLng,
    target.lat - dLat,
    target.lng + dLng,
    target.lat + dLat,
  ];
}

export function googleStreetViewUrl(target: LngLat): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${target.lat},${target.lng}`;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/mapillary-inview.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/mapillary-inview.ts src/lib/mapillary-inview.test.ts
git commit -m "feat: Mapillary in-view snap geo helpers"
```

---

### Task 2: Mapillary fetch + nearest API

**Files:**
- Create: `src/lib/mapillary.ts`
- Create: `src/lib/mapillary.test.ts`
- Create: `src/app/api/mapillary/nearest/route.ts`
- Modify: `.env.example` — add `MAPILLARY_ACCESS_TOKEN` and `NEXT_PUBLIC_MAPILLARY_TOKEN` notes

**Interfaces:**
- Produces:
  - `fetchMapillaryImagesNear(target: LngLat, token: string): Promise<MapillaryImagePose[]>`
  - `resolveNearestInView(target: LngLat, token: string): Promise<{ ok: true; image: MapillaryImagePose; lookAt: LngLat; yawTowardLookAt: number } | { ok: false; lookAt: LngLat; googleUrl: string }>`
- Consumes: `pickInViewImage`, `bboxAround`, `bearingDegrees`, `googleStreetViewUrl` from Task 1
- Mapillary call: `GET https://graph.mapillary.com/images?bbox=W,S,E,N&fields=id,computed_geometry,computed_compass_angle,compass_angle&access_token=`
- Prefer `computed_compass_angle`, fallback `compass_angle`
- Geometry: `computed_geometry.coordinates` as `[lng, lat]`

- [ ] **Step 1: Unit-test mapping of Graph JSON → poses + resolve with mocked fetch**

```ts
// mapillary.test.ts — mapGraphImagesToPoses filters bad rows; resolveNearestInView returns googleUrl when empty
```

- [ ] **Step 2: Implement `mapillary.ts` + route**

```ts
// route.ts
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }
  const token = process.env.MAPILLARY_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, lookAt: { lat, lng }, googleUrl: googleStreetViewUrl({ lat, lng }), error: 'MAPILLARY_ACCESS_TOKEN not configured' },
      { status: 503 },
    );
  }
  const result = await resolveNearestInView({ lat, lng }, token);
  return NextResponse.json(result);
}
```

Do **not** include `access_token` in the JSON body.

- [ ] **Step 3: Run** `npx vitest run src/lib/mapillary-inview.test.ts src/lib/mapillary.test.ts`
- [ ] **Step 4: Commit** `feat: Mapillary nearest in-view API`

---

### Task 3: Coverage tile proxy + LayerPanel key

**Files:**
- Create: `src/app/api/mapillary/tiles/[z]/[x]/[y]/route.ts` — proxy `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=`
- Modify: `src/components/LayerPanel.tsx` — add `{ key: 'street_view', label: 'Street View', ... }` under Ground / Places-adjacent group
- Modify: `src/app/page.tsx` — `street_view: false` in default `activeLayers`
- Modify: `src/components/OsirisMap.tsx` — when `activeLayers.street_view`, add vector source `mapillary-coverage` pointing at `/api/mapillary/tiles/{z}/{x}/{y}` with `source-layer` from Mapillary public tiles (`image` — verify against Mapillary tile docs; common layer id `image`), circle layer for coverage dots; `minzoom` ~12

**Interfaces:**
- Tile route returns upstream body + `Content-Type` from Mapillary; 503 if no token
- Coverage layer visibility toggled with `street_view`

- [ ] **Step 1: Implement tile proxy**
- [ ] **Step 2: Register layer key + map source/layer**
- [ ] **Step 3: Smoke** — with token, toggle layer at z14 over a known covered city; dots appear. Without token, 503 and empty.
- [ ] **Step 4: Commit** `feat: Mapillary coverage layer + tile proxy`

---

### Task 4: StreetViewPanel + MapillaryJS

**Files:**
- Create: `src/components/StreetViewPanel.tsx`
- Modify: `package.json` — add dependency `mapillary-js`
- Modify: `src/app/page.tsx` — state `streetViewTarget: { lat, lng } | null`; render panel; open callback

**Interfaces:**
- Props: `{ lookAt: { lat: number; lng: number } | null; onClose: () => void }`
- On `lookAt` set: `fetch(/api/mapillary/nearest?lat=&lng=)` then:
  - if `ok`: mount MapillaryJS Viewer with `imageId`, set bearing toward lookAt using `yawTowardLookAt` / viewer API
  - else: empty copy + `<a href={googleUrl} target="_blank">Open Google Street View</a>`
- Client token: `process.env.NEXT_PUBLIC_MAPILLARY_TOKEN` — if missing, use iframe embed `https://www.mapillary.com/embed?image_key=${id}&style=photo` instead of MapillaryJS
- Use `FloatingWindow` (`storageKey="street-view"`, similar size to CameraViewer)

- [ ] **Step 1: `npm install mapillary-js`**
- [ ] **Step 2: Implement StreetViewPanel**
- [ ] **Step 3: Wire page state**
- [ ] **Step 4: Commit** `feat: StreetViewPanel Mapillary viewer`

---

### Task 5: Context menu + pegman click + map markers

**Files:**
- Modify: `src/components/OsirisMap.tsx`
  - Replace silent single-right-click wait with a **context menu** at cursor: “Street view here”, “Region dossier”
  - “Street view here” → `onStreetView?.(coords)`
  - “Region dossier” → existing `onRightClick` dossier path (preserve double-right as dossier shortcut too)
  - When `street_view` layer on: map click (empty map) → `onStreetView?.(coords)` (do not steal entity clicks)
  - GeoJSON source `street-view-pin`: point at look-at; optional line from image → look-at when nearest returns `ok` (pass image lng/lat up via callback or second state)
- Modify: `src/app/page.tsx` — `onStreetView={(c) => setStreetViewTarget(c)}`

- [ ] **Step 1: Context menu DOM** (fixed position, dismiss on click outside / Esc)
- [ ] **Step 2: Pegman / layer click → open street view**
- [ ] **Step 3: Pin + optional ray line**
- [ ] **Step 4: Manual check** — covered street opens viewer facing pin; empty area shows Google link; dossier still reachable
- [ ] **Step 5: Commit** `feat: street view context menu and pegman entry`

---

### Task 6: Pack + Desktop sync (optional if user wants portable)

- [ ] Kill Osiris processes; `npm run desktop:pack`; robocopy `desktop/dist/win-unpacked` → `Desktop\Osiris`

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Right-click Street view | 5 |
| Layer toggle + coverage dots | 3 |
| Click/pegman sets P | 5 |
| 100 m / 55° snap | 1–2 |
| Empty + Google link | 2, 4 |
| FloatingWindow + MapillaryJS | 4 |
| Marker + line | 5 |
| Token server-side for search/tiles | 2–3 |
| Off by default | 3 |
| No Google in-app / no occlusion | (non-goals) |
