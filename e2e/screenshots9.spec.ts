import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { goto, patch, standBy, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the fine grid, the taller land, the six courts and their sects, and the Hundred Arts. Run with `npm run screenshots`. */
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

  test("capture the fine grid, the taller land, the courts and the sects in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS, realm: 1, stage: 0 });
    await timeOfDay(page, 0.14);

    // the same coast and camera as 297, now on the fine grid
    await on(page, 612, 300);
    await camera(page, { alpha: -Math.PI / 4 - 0.5, beta: 1.12, radius: 70 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "307-3d-the-coast-on-the-fine-grid");

    // close in on a shore: its steps are half a tile now, the staircases rounded off
    await on(page, 614, 296);
    await camera(page, { alpha: -Math.PI / 4 - 0.5, beta: 1.0, radius: 26 });
    await ready(page, 4000);
    await quiet(page);
    await shot(page, "308-3d-half-tile-steps");

    // the taller land: hills over the Golden River country
    await on(page, 118, 488);
    await camera(page, { alpha: -Math.PI / 4 + 0.4, beta: 1.15, radius: 80 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "309-3d-the-taller-hills");

    // Liangdu, the Granary Throne: the throne under its canopy, the palace hall, the square full of townsfolk
    await on(page, 83, 498);
    await camera(page, { alpha: -Math.PI / 4, beta: 0.95, radius: 40 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "310-3d-liangdu-the-granary-throne");

    // Jinling-by-the-Tide
    await on(page, 500, 476);
    await camera(page, { alpha: -Math.PI / 4 + 0.5, beta: 0.95, radius: 44 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "311-3d-jinling-by-the-tide");

    // Pingcheng under the Snows
    await on(page, 576, 146);
    await camera(page, { alpha: -Math.PI / 4 - 0.3, beta: 0.95, radius: 44 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "312-3d-pingcheng-under-the-snows");

    // the Golden Crane Sect on its levelled terrace
    await on(page, 60, 474);
    await camera(page, { alpha: -Math.PI / 4 + 0.2, beta: 0.95, radius: 34 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "313-3d-the-golden-crane-sect");

    // Longcheng of the Sands at dusk
    await timeOfDay(page, 0.48);
    await on(page, 548, 410);
    await camera(page, { alpha: -Math.PI / 4 - 0.2, beta: 0.95, radius: 44 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "314-3d-longcheng-of-the-sands");
  });
});

test.describe("in pixels", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("capture an emperor, a master, the journal, the menu and the map", async ({ page }) => {
    test.setTimeout(300_000);
    await startNewGame(page);
    await patch(page, { flags: FLAGS, realm: 0, stage: 3 });
    await timeOfDay(page, 0.15);

    // the isometric view of Liangdu's square
    await on(page, 84, 504);
    await page.waitForTimeout(2500);
    await quiet(page);
    await shot(page, "315-liangdu-pixels");

    // Emperor Xuande summons her
    await standBy(page, "ct-0-emperor");
    await page.waitForTimeout(800);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(1200);
    for (let k = 0; k < 2; k++) {
      await page.keyboard.press("KeyE");
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(2500);
    await shot(page, "316-emperor-xuande");
    await page.evaluate(() => window.__pixelop!.game.skipScene());

    // Mother Yao offers to take her on
    await patch(page, { flags: FLAGS, realm: 2, stage: 1, counters: { courts: 461 } });
    await standBy(page, "ct-2-master");
    await page.waitForTimeout(800);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(3000);
    await quiet(page);
    await shot(page, "317-mother-yao-takes-an-apprentice");
    // say yes (a question stops a skip), then let the lesson play out
    for (let k = 0; k < 6; k++) {
      await page.keyboard.press("Digit1");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => window.__pixelop!.game.skipScene());
    await page.waitForTimeout(500);

    // the journal: the ninth thread and the arts she knows
    await patch(page, { flags: { ...FLAGS, "craft:farming": true, "craft:refining": true, "craft:healing": true }, realm: 2, stage: 1, counters: { courts: 461, "craft:farming": 14, "craft:refining": 5, "craft:healing": 2 } });
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(900);
    await page.getByTestId("journal-courts").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, "318-journal-the-thrones-and-the-crafts");
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(500);

    // the world map: six capitals and six sects
    await page.keyboard.press("KeyM");
    await page.getByTestId("worldmap").waitFor();
    await page.waitForTimeout(2500);
    await shot(page, "319-world-map-the-six-courts");
    await page.keyboard.press("KeyM");
  });
});
