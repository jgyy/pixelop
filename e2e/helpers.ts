import type { Page } from "@playwright/test";
import type { GameState } from "../src/game/engine/state";
import type { EnemyId } from "../src/game/engine/enemies";
import type { AreaId } from "../src/game/world/ids";

/** Start a fresh game from the title screen (from one of the three beginnings), skip the opening, and wait for the runtime hook. */
export async function startNewGame(page: Page, skipIntro = true, origin: "disciple" | "foundling" | "defector" = "disciple"): Promise<void> {
  await page.goto("/");
  await page.getByTestId("new-game").click();
  await page.getByTestId(`origin-${origin}`).click();
  await page.waitForFunction(() => !!window.__pixelop?.game);
  if (skipIntro) {
    await page.evaluate(() => window.__pixelop!.game.skipScene());
    await page.waitForFunction(() => window.__pixelop!.game.mode === "explore");
  }
}

export const patch = (page: Page, p: Partial<GameState>) => page.evaluate((p) => window.__pixelop!.game.debugPatch(p), p);
export const teleport = (page: Page, area: AreaId, x: number, y: number) => page.evaluate(([a, x, y]) => window.__pixelop!.game.debugTeleport(a as AreaId, x as number, y as number), [area, x, y] as const);
export const battle = (page: Page, enemy: EnemyId) => page.evaluate((e) => window.__pixelop!.game.debugBattle(e), enemy);
export const state = (page: Page) => page.evaluate(() => window.__pixelop!.game.state);
export const mode = (page: Page) => page.evaluate(() => window.__pixelop!.game.mode);
export const skipScene = (page: Page) => page.evaluate(() => window.__pixelop!.game.skipScene());

/** Jump to a point of the open world, in world tiles. */
export const goto = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => window.__pixelop!.game.debugGoto(x, y), [x, y] as const);

/** Stand on open ground right beside something in the current map (an NPC, a door, a chest…), found by its key. */
export const standBy = (page: Page, key: string) =>
  page.evaluate((key) => {
    const g = window.__pixelop!.game;
    const d = g.world.def;
    const x = [...d.npcs, ...d.enemies, ...d.interacts].find((n) => n.key === key);
    if (!x) throw new Error(`no ${key} here`);
    for (const [di, dj] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
    ])
      if (d.map.standable(x.i + di, x.j + dj)) {
        // inside a room or a cave, step across it rather than out to the open world
        if (g.inside) return g.world.placeHero(x.i + di + 0.5, x.j + dj + 0.5, 8);
        return g.debugGoto(x.i + di + 0.5, x.j + dj + 0.5);
      }
    throw new Error(`nowhere to stand by ${key}`);
  }, key);

/** Where something of the current map is, by its key. */
export const tileOf = (page: Page, key: string) =>
  page.evaluate((key) => {
    const d = window.__pixelop!.game.world.def;
    const x = [...d.npcs, ...d.enemies, ...d.interacts].find((n) => n.key === key)!;
    return [x.i, x.j] as [number, number];
  }, key);
