import type { AreaId } from "./ids";

/**
 * Where each region sits inside the one continuous world. Kept free of any
 * map-building code so the save schema (used server-side) stays light.
 *
 * The four mortal regions lie side by side on one mainland, joined by the old
 * highway along their southern edge. The Azure Cloud Sect floats above the
 * village and Heavenly Tribulation Peak floats above the sect, each reached
 * by a sky bridge.
 */
export const WORLD_W = 162;
export const WORLD_H = 116;

/** Top-left tile of each region's hand-built layout, in world tiles. */
export const REGION_ORIGIN: Record<AreaId, [number, number]> = {
  valley: [4, 66],
  bamboo: [44, 66],
  village: [84, 66],
  lake: [124, 66],
  sect: [85, 30],
  peak: [90, 4],
};

export const REGION_SIZE: Record<AreaId, number> = { valley: 32, bamboo: 32, village: 32, lake: 32, sect: 30, peak: 24 };

/** Convert region-local tile coordinates to world coordinates. */
export function toWorld(area: AreaId, x: number, y: number): [number, number] {
  const [ox, oy] = REGION_ORIGIN[area];
  return [x + ox, y + oy];
}

/** Inclusive-exclusive world rectangle [x0, y0, x1, y1] covered by a region. */
export function regionRect(area: AreaId): [number, number, number, number] {
  const [ox, oy] = REGION_ORIGIN[area];
  const n = REGION_SIZE[area];
  return [ox, oy, ox + n, oy + n];
}

/** Distance from a point to a region's rectangle (0 inside). */
export function rectDistance(area: AreaId, x: number, y: number): number {
  const [x0, y0, x1, y1] = regionRect(area);
  const dx = Math.max(x0 - x, 0, x - x1);
  const dy = Math.max(y0 - y, 0, y - y1);
  return Math.hypot(dx, dy);
}
