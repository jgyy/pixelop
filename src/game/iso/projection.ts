/** Isometric projection shared by terrain, sprites and the camera. World units are tiles; z is in height levels. */
export const TILE_W = 32;
export const TILE_H = 16;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;
/** Screen pixels per terrain height level. */
export const LEVEL_H = 8;

export const isoX = (x: number, y: number) => (x - y) * HALF_W;
export const isoY = (x: number, y: number, z = 0) => (x + y) * HALF_H - z * LEVEL_H;

/** Inverse of the projection at a known height. */
export function screenToWorld(sx: number, sy: number, z = 0): [number, number] {
  const a = sx / HALF_W;
  const b = (sy + z * LEVEL_H) / HALF_H;
  return [(a + b) / 2, (b - a) / 2];
}

/**
 * Convert a screen-space input direction (e.g. arrow keys) into a world
 * direction, so "up" walks up the screen regardless of the iso grid.
 */
export function screenDirToWorld(sx: number, sy: number): [number, number] {
  const a = sx / HALF_W;
  const b = (sy * 2) / HALF_H / 2;
  const x = (a + b) / 2;
  const y = (b - a) / 2;
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}
