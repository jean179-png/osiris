### Task 1: Wind field types + UV math (TDD)

**Files:**
- Create: `src/lib/wind-field.ts`
- Create: `src/lib/wind-field.test.ts`

**Interfaces:**
- Produces:
  - `export type WindProductId = 'surface'`
  - `export type WindFieldGrid = { product: WindProductId; width: number; height: number; west: number; south: number; east: number; north: number; u: Float32Array; v: Float32Array; unit: 'm/s'; validTime: string | null; attribution: string }`
  - `speedDirToUV(speedMs: number, directionDeg: number): { u: number; v: number }` — meteorological “from” direction
  - `sampleUV(grid: WindFieldGrid, lng: number, lat: number): { u: number; v: number } | null` — bilinear; null if outside
  - `windSpeed(u: number, v: number): number`
  - `speedToRgba(speedMs: number): [number, number, number, number]` — cool→warm ramp

- [ ] **Step 1: Failing tests** for `speedDirToUV` (north wind → negative v), `sampleUV` corners/center, `speedToRgba` monotonic G channel or hue proxy
- [ ] **Step 2: Implement**
- [ ] **Step 3: `npx vitest run src/lib/wind-field.test.ts` PASS
- [ ] **Step 4: Commit** `feat: wind field UV types and sampling`

---

