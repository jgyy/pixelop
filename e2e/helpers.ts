import type { Page } from "@playwright/test";
import type { GameState } from "../src/game/engine/state";
import type { EnemyId } from "../src/game/engine/enemies";

/** Start a fresh game from the title screen and wait for the runtime hook. */
export async function startNewGame(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("new-game").click();
  await page.getByTestId("hud").waitFor();
  await page.waitForFunction(() => !!window.__pixelop?.game);
}

export const patch = (page: Page, p: Partial<GameState>) => page.evaluate((p) => window.__pixelop!.game.debugPatch(p), p);
export const teleport = (page: Page, region: GameState["region"], x: number) =>
  page.evaluate(([r, x]) => window.__pixelop!.game.debugTeleport(r as GameState["region"], x as number), [region, x] as const);
export const battle = (page: Page, enemy: EnemyId) => page.evaluate((e) => window.__pixelop!.game.debugBattle(e), enemy);
export const state = (page: Page) => page.evaluate(() => window.__pixelop!.game.state);
export const mode = (page: Page) => page.evaluate(() => window.__pixelop!.game.mode);
