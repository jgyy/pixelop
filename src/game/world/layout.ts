import type { AreaId } from "./ids";

/**
 * Where each region sits inside the one continuous world. Kept free of any
 * map-building code so the save schema (used server-side) stays light.
 *
 * The four mortal regions are spread across one wide mainland: the Crimson
 * Demon Valley in the far west, the bamboo forest, Willow Creek in the middle
 * and the Lotus Lake in the east. The old highway runs below them all, and
 * the southern lands beyond it hold the stone forest, the scarecrow fields
 * and the highlands. The Azure Cloud Sect floats above the village and
 * Heavenly Tribulation Peak floats above the sect, each reached by a sky
 * bridge.
 *
 * The world is laid out on an "authoring" grid (the hand-built region
 * templates and the landmarks are written in it) and then magnified
 * WORLD_SCALE times: every authoring tile becomes WORLD_SCALE × WORLD_SCALE
 * world tiles, while people, beasts, trees and lanterns keep their size.
 */
export const WORLD_SCALE = 2;

/** The authoring grid the world is laid out on. */
export const COARSE_W = 324;
export const COARSE_H = 232;
export const WORLD_W = COARSE_W * WORLD_SCALE;
export const WORLD_H = COARSE_H * WORLD_SCALE;

/** Top-left tile of each region's hand-built layout, on the authoring grid. */
export const COARSE_ORIGIN: Record<AreaId, [number, number]> = {
  valley: [16, 128],
  bamboo: [96, 112],
  village: [176, 98],
  lake: [258, 106],
  sect: [177, 34],
  peak: [182, 8],
};

/** Edge length of each hand-built region layout, in authoring tiles. */
export const TEMPLATE_SIZE: Record<AreaId, number> = { valley: 32, bamboo: 32, village: 32, lake: 32, sect: 30, peak: 24 };

/** Top-left tile of each region in world tiles. */
export const REGION_ORIGIN = Object.fromEntries(Object.entries(COARSE_ORIGIN).map(([id, [x, y]]) => [id, [x * WORLD_SCALE, y * WORLD_SCALE]])) as Record<AreaId, [number, number]>;
/** Edge length of each region in world tiles. */
export const REGION_SIZE = Object.fromEntries(Object.entries(TEMPLATE_SIZE).map(([id, n]) => [id, n * WORLD_SCALE])) as Record<AreaId, number>;

/**
 * The version 4 world (324 × 232 tiles, the authoring grid itself) that saves
 * made before the world doubled refer to.
 */
export const V4_WORLD_W = COARSE_W;
export const V4_WORLD_H = COARSE_H;

/**
 * The version 3 world (162 × 116 tiles) that even older saves refer to.
 * Only used to migrate old positions.
 */
export const LEGACY_WORLD_W = 162;
export const LEGACY_WORLD_H = 116;
export const LEGACY_REGION_ORIGIN: Record<AreaId, [number, number]> = {
  valley: [4, 66],
  bamboo: [44, 66],
  village: [84, 66],
  lake: [124, 66],
  sect: [85, 30],
  peak: [90, 4],
};

/** Convert region-local authoring coordinates (as the region templates are written) to world coordinates. */
export function toWorld(area: AreaId, x: number, y: number): [number, number] {
  const [ox, oy] = COARSE_ORIGIN[area];
  return [(x + ox) * WORLD_SCALE, (y + oy) * WORLD_SCALE];
}

/** Region-local authoring coordinates to authoring-grid coordinates (the world before it is magnified). */
export function toCoarse(area: AreaId, x: number, y: number): [number, number] {
  const [ox, oy] = COARSE_ORIGIN[area];
  return [x + ox, y + oy];
}

/** Inclusive-exclusive world rectangle [x0, y0, x1, y1] covered by a region. */
export function regionRect(area: AreaId, scale = WORLD_SCALE): [number, number, number, number] {
  const [ox, oy] = COARSE_ORIGIN[area];
  const n = TEMPLATE_SIZE[area];
  return [ox * scale, oy * scale, (ox + n) * scale, (oy + n) * scale];
}

/** Distance from a world point to a region's rectangle (0 inside); pass scale 1 for the authoring grid. */
export function rectDistance(area: AreaId, x: number, y: number, scale = WORLD_SCALE): number {
  const [x0, y0, x1, y1] = regionRect(area, scale);
  const dx = Math.max(x0 - x, 0, x - x1);
  const dy = Math.max(y0 - y, 0, y - y1);
  return Math.hypot(dx, dy);
}
