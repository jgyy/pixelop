import type { Page } from "@playwright/test";
import type { GameState } from "../src/game/engine/state";
import type { EnemyId } from "../src/game/engine/enemies";
import type { AreaId } from "../src/game/world/ids";

/** Start a fresh game from the title screen, skip the opening, and wait for the runtime hook. */
export async function startNewGame(page: Page, skipIntro = true): Promise<void> {
  await page.goto("/");
  await page.getByTestId("new-game").click();
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
