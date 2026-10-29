/**
 * What the game asks of the 3D view when one is drawing the world: where a
 * map point lands on the pixel canvas laid over it, how the camera is turned
 * (so "up" on the keys walks up the screen however it faces), and what map
 * point lies under a tap.
 */
export interface View3D {
  /** Pixel-canvas position of map point (x, y) at height z (levels), or null if behind the camera. */
  project(x: number, y: number, z: number): [number, number] | null;
  /** Pixel-canvas pixels one tile spans at the camera's focus. */
  tileScale(): number;
  /**
   * The camera's ground axes in map coordinates: `toward` points from what it
   * looks at back toward the camera, `right` to the right of the screen.
   */
  ground(): { toward: [number, number]; right: [number, number] };
  /** The map point under a pixel-canvas position, if it falls on the land. */
  pick(sx: number, sy: number): [number, number] | null;
}

/** The isometric view's own ground axes, which the 3D camera starts from. */
export const ISO_GROUND = { toward: [Math.SQRT1_2, Math.SQRT1_2] as [number, number], right: [Math.SQRT1_2, -Math.SQRT1_2] as [number, number] };

/** Turn a map vector worked out for the isometric view into the same screen direction under a turned camera. */
export function turnToView(v: [number, number], g: { toward: [number, number]; right: [number, number] }): [number, number] {
  const t = v[0] * ISO_GROUND.toward[0] + v[1] * ISO_GROUND.toward[1];
  const r = v[0] * ISO_GROUND.right[0] + v[1] * ISO_GROUND.right[1];
  return [t * g.toward[0] + r * g.right[0], t * g.toward[1] + r * g.right[1]];
}

/** The sprite direction (of 16) that shows a figure facing map direction `dir` to a turned camera. */
export function dirInView(dir: number, g: { toward: [number, number]; right: [number, number] }): number {
  // a direction's angle is measured from "toward the viewer" round to "screen right" (see dirFromWorld)
  const a = (((dir % 16) + 16) % 16) * (Math.PI / 8);
  const { toward: T, right: R } = ISO_GROUND;
  const f = [Math.cos(a) * T[0] + Math.sin(a) * R[0], Math.cos(a) * T[1] + Math.sin(a) * R[1]];
  const at = f[0] * g.toward[0] + f[1] * g.toward[1];
  const ar = f[0] * g.right[0] + f[1] * g.right[1];
  return ((Math.round(Math.atan2(ar, at) / (Math.PI / 8)) % 16) + 16) % 16;
}
