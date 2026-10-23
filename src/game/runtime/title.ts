import type { Surface } from "../pixel/surface";
import { getWorld } from "../world/continent";
import { toWorld } from "../world/layout";
import { World } from "./world";

let world: World | null = null;

/** Attract-mode backdrop: a slow pan across the floating sect while Lin Yue meditates in the plaza. */
export function renderTitle(s: Surface, t: number): void {
  if (!world) {
    const [x, y] = toWorld("sect", 15.5, 14.5);
    world = new World(getWorld(), { x, y, dir: 1 }, { metElder: true }, []);
    world.hero.idleAnim = "meditate";
    world.setAnim(world.hero, "meditate", 0);
  }
  const k = Math.sin(t * 0.05);
  world.update(1 / 60, t, true);
  const [fx, fy] = toWorld("sect", 15.5 + k * 4, 13 - k * 3);
  world.updateCamera(s.width, s.height, 0, [fx, fy, 2]);
  world.camY -= Math.round(s.height * 0.12);
  world.render(s, t);
}
