import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { patch, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the 3D world and the game menu. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.use({ viewport: { width: 1600, height: 900 }, storageState: { cookies: [], origins: [] } });
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });

/** Wait for the ground about the camera to be painted, and for the camera to settle. */
async function settle(page: Page, ms = 2500): Promise<void> {
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !!(window.__pixelop?.game.view3d as { ready?: boolean } | null | undefined)?.ready, null, { timeout: 90_000 });
  await page.waitForTimeout(ms);
}

const camera = (page: Page, c: { alpha?: number; beta?: number; radius?: number }) =>
  page.evaluate((c) => {
    const v = window.__pixelop!.game.view3d as unknown as { want: { alpha: number; beta: number; radius: number } };
    Object.assign(v.want, { alpha: -Math.PI / 4, beta: 0.88, radius: 21 }, c);
  }, c);
const waypoint = (page: Page, id: string, dx = 0, dy = 0) =>
  page.evaluate(([id, dx, dy]) => {
    const g = window.__pixelop!.game;
    const [x, y] = g.world.world!.waypoints[id as "sect"];
    g.debugGoto(x + (dx as number), y + (dy as number));
  }, [id, dx, dy] as const);

test("capture 3D screenshots", async ({ page }) => {
  test.setTimeout(600_000);
  await startNewGame(page);
  await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
  await page.evaluate(() => window.__pixelop!.game.debugSetTime(0.95));

  await camera(page, { radius: 30 });
  await settle(page);
  await shot(page, "207-3d-the-azure-cloud-sect");

  await camera(page, { alpha: -Math.PI / 4 + Math.PI * 0.75, beta: 0.95, radius: 34 });
  await settle(page);
  await shot(page, "208-3d-the-camera-turns");

  await patch(page, { flags: { metElder: true, villageArrived: true } });
  await waypoint(page, "village", 4, -6);
  await camera(page, { alpha: -Math.PI / 4 + 0.5, radius: 26 });
  await settle(page);
  await shot(page, "209-3d-willow-creek");

  await page.evaluate(() => window.__pixelop!.game.debugSetTime(0.5));
  await settle(page, 1500);
  await shot(page, "210-3d-willow-creek-by-night");

  await page.evaluate(() => window.__pixelop!.game.debugSetTime(0.95));
  await page.evaluate(() => window.__pixelop!.game.debugEnter("hall"));
  await camera(page, { radius: 18 });
  await settle(page);
  await shot(page, "211-3d-inside-the-hall-of-clouds");

  await page.evaluate(() => window.__pixelop!.game.debugEnter("grotto"));
  await page.evaluate(() => window.__pixelop!.game.skipScene());
  await camera(page, { radius: 22, beta: 0.8 });
  await settle(page);
  await shot(page, "212-3d-the-sunken-grotto");

  await page.evaluate(() => window.__pixelop!.game.debugTeleport("frost", 20, 20));
  await page.evaluate(() => window.__pixelop!.game.debugSetTime(0.95, "winter"));
  await camera(page, { alpha: -Math.PI / 4 - 0.6, radius: 30 });
  await settle(page);
  await shot(page, "213-3d-frostveil-in-winter");

  await page.evaluate(() => window.__pixelop!.game.debugSetTime(0.95, "autumn"));
  await waypoint(page, "terraces");
  await camera(page, { alpha: -Math.PI / 4 + 1.1, radius: 32, beta: 0.8 });
  await settle(page);
  await shot(page, "214-3d-the-tea-terraces-in-autumn");

  await page.evaluate(() => window.__pixelop!.game.debugSetTime(0.95, "spring"));
  await waypoint(page, "sect");
  await patch(page, { realm: 2, stage: 1, kills: 41, pills: { heal: 5, qi: 3 }, counters: { "seen:fox": 1, "slain:fox": 7, "seen:wolf": 1, "slain:wolf": 3, "seen:bandit": 1, "slain:bandit": 2, "seen:serpentKing": 1, "slain:serpentKing": 1, "met:elder": 1, "met:qing": 1, "met:zhou": 1, "met:hua": 1, "met:huli": 1, "met:wen": 1, "met:abao": 1, "met:fang": 1 } });
  await camera(page, { radius: 24 });
  await settle(page, 1200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  await shot(page, "215-menu-status");
  for (const [tab, name] of [
    ["bag", "216-menu-bag"],
    ["bestiary", "217-menu-bestiary"],
    ["people", "218-menu-people"],
    ["places", "219-menu-places"],
    ["settings", "220-menu-settings"],
  ]) {
    await page.getByTestId(`menu-tab-${tab}`).click();
    await page.waitForTimeout(700);
    await shot(page, name);
  }
  await page.keyboard.press("Escape");
});
