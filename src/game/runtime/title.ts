import type { Surface } from "../pixel/surface";
import { World } from "./world";

let world: World | null = null;

/** Attract-mode backdrop: a slow pan across the floating sect while Lin Yue meditates in the plaza. */
export function renderTitle(s: Surface, t: number): void {
  if (!world) {
    world = new World("sect", { x: 15.5, y: 14.5, dir: 1 }, { metElder: true }, [], new Set());
    world.hero.idleAnim = "meditate";
    world.setAnim(world.hero, "meditate", 0);
  }
  const k = Math.sin(t * 0.05);
  world.update(1 / 60, t, true);
  world.updateCamera(s.width, s.height, 0, [15.5 + k * 4, 13 - k * 3, 2]);
  world.camY -= Math.round(s.height * 0.12);
  world.render(s, t);
}
