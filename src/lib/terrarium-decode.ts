/**
 * Mapzen Terrarium DEM decode — elevation meters from RGB.
 * height = (R * 256 + G + B / 256) - 32768
 */

export function terrariumElev(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export function decodeTerrariumRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = terrariumElev(rgba[p]!, rgba[p + 1]!, rgba[p + 2]!);
  }
  return out;
}

export function isFlooded(elevM: number, seaLevelM: number): boolean {
  return elevM <= seaLevelM;
}

/** Build RGBA flood mask: flooded → blue tint, else transparent. */
export function paintFloodMask(
  elev: Float32Array,
  seaLevelM: number,
  outRgba: Uint8ClampedArray,
): void {
  const n = elev.length;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (isFlooded(elev[i]!, seaLevelM)) {
      outRgba[p] = 30;
      outRgba[p + 1] = 90;
      outRgba[p + 2] = 180;
      outRgba[p + 3] = 115;
    } else {
      outRgba[p] = 0;
      outRgba[p + 1] = 0;
      outRgba[p + 2] = 0;
      outRgba[p + 3] = 0;
    }
  }
}

export const TERRARIUM_ATTRIBUTION =
  'Elevation © <a href="https://github.com/tilezen/joerd">Mapzen / AWS Terrain Tiles</a> (Terrarium)';
