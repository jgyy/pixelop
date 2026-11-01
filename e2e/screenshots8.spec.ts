import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { goto, patch, standBy, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the reshaped world, the Sea of Pearls and the Nine Springs. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const FLAGS = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true };
const quiet = (page: Page) => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
const timeOfDay = (page: Page, k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
/** Stand on an authoring-grid tile of the open world (each is two world tiles across). */
const on = (page: Page, x: number, y: number) => goto(page, x * 2 + 0.5, y * 2 + 0.5);

test.describe("in 3D", () => {
  test.use({ viewport: { width: 1600, height: 900 }, storageState: { cookies: [], origins: [] } });
  const camera = (page: Page, c: { alpha?: number; beta?: number; radius?: number }) =>
    page.evaluate((c) => {
      const v = window.__pixelop!.game.view3d as unknown as { want: { alpha: number; beta: number; radius: number } };
      Object.assign(v.want, { alpha: -Math.PI / 4, beta: 0.88, radius: 21 }, c);
    }, c);
  const ready = async (page: Page, ms = 2500) => {
    await page.waitForTimeout(400);
    await page.waitForFunction(() => !!(window.__pixelop?.game.view3d as { ready?: boolean } | null | undefined)?.ready, null, { timeout: 120_000 });
    await page.waitForTimeout(ms);
  };

  test("capture the sea, its isles, the new coast and the underworld in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS, realm: 1, stage: 0 });
    await timeOfDay(page, 0.14);

    // Pearlgate: its round earthen houses, eight-sided tower and beehive huts
    await on(page, 532, 604);
    await camera(page, { alpha: -Math.PI / 4 + 0.35, beta: 0.95, radius: 48 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "292-3d-pearlgate-round-houses");

    // out on the bridges between the isles
    await on(page, 538, 644);
    await camera(page, { alpha: -Math.PI / 4 - 0.3, beta: 1.05, radius: 60 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "293-3d-the-bridges-of-the-sea");

    // the crescent hall on Crescent Isle
    await on(page, 540, 684);
    await camera(page, { alpha: -Math.PI / 4 + 0.6, beta: 0.95, radius: 42 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "294-3d-crescent-isle");

    // Ghost Gate Isle, where the stair goes down
    await on(page, 404, 716);
    await timeOfDay(page, 0.55);
    await camera(page, { alpha: -Math.PI / 4, beta: 0.95, radius: 44 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "295-3d-ghost-gate-isle");

    // Penglai's eight-sided tower
    await timeOfDay(page, 0.2);
    await on(page, 352, 656);
    await camera(page, { alpha: -Math.PI / 4 + 0.2, beta: 0.95, radius: 40 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "296-3d-penglai");

    // the new coast: the old straight shore eaten back into bays and headlands
    await on(page, 612, 300);
    await camera(page, { alpha: -Math.PI / 4 - 0.5, beta: 1.12, radius: 70 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "297-3d-the-new-coast");

    // down the stair: the Nine Springs, the Ghost Market and the Naihe Bridge
    await page.evaluate(() => window.__pixelop!.game.debugEnter("underworld"));
    await page.evaluate(() => window.__pixelop!.game.world.placeHero(68.5, 52.5, 8));
    await camera(page, { radius: 30, beta: 0.85 });
    await ready(page, 5000);
    await quiet(page);
    await shot(page, "298-3d-the-ghost-market");

    await page.evaluate(() => window.__pixelop!.game.world.placeHero(72.5, 76.5, 8));
    await camera(page, { radius: 28, beta: 0.9, alpha: -Math.PI / 4 + 0.4 });
    await ready(page, 5000);
    await quiet(page);
    await shot(page, "299-3d-the-naihe-bridge");

    // a room that is not a box: the pagoda's octagonal floor
    await page.evaluate(() => window.__pixelop!.game.debugEnter("pagoda"));
    await camera(page, { radius: 18 });
    await ready(page, 4000);
    await quiet(page);
    await shot(page, "300-3d-an-octagonal-room");
  });
});

test.describe("in pixels", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("capture the world map, Meng Po and the journal", async ({ page }) => {
    test.setTimeout(300_000);
    await startNewGame(page);
    await patch(page, { flags: FLAGS, realm: 1, stage: 0 });
    await timeOfDay(page, 0.15);

    // the isometric view of Pearlgate
    await on(page, 532, 604);
    await page.waitForTimeout(2500);
    await quiet(page);
    await shot(page, "301-pearlgate-pixels");

    // the world map, over the sea
    await page.keyboard.press("KeyM");
    await page.getByTestId("worldmap").waitFor();
    await page.waitForTimeout(2500);
    await shot(page, "302-world-map-the-sea-of-pearls");
    await page.keyboard.press("KeyM");
    await page.waitForTimeout(500);

    // Meng Po at her pot, in the fifth book
    await patch(page, { flags: FLAGS, realm: 3, stage: 2, counters: { seas: 800 } });
    await page.evaluate(() => window.__pixelop!.game.debugEnter("underworld"));
    await standBy(page, "sp-4-patron");
    await page.waitForTimeout(800);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(1200);
    // past the narration to Meng Po's own words
    for (let k = 0; k < 3; k++) {
      await page.keyboard.press("KeyE");
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(2500);
    await shot(page, "303-meng-po");
    await page.evaluate(() => window.__pixelop!.game.skipScene());

    // the journal: the eighth thread
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(900);
    await page.getByTestId("journal-seas").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, "304-journal-the-sea-of-pearls");
    await page.keyboard.press("KeyJ");
  });
});
