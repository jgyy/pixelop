import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { goto, patch, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the sects' grand halls. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const FLAGS = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true };
const quiet = (page: Page) => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
const timeOfDay = (page: Page, k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);

/** The Pavilion of Drifting Scriptures' north-west corner, and the Hall of Ten Thousand Debates'. */
const PAVILION: [number, number] = [455, 126];
const DEBATES: [number, number] = [286, 968];
/** Stand at a hall-local tile (u, v). */
const at = (page: Page, [i0, j0]: [number, number], u: number, v: number) => goto(page, i0 + u + 0.5, j0 + v + 0.5);
const storey = (page: Page) => page.evaluate(() => window.__pixelop!.game.world.hallHere?.storey ?? -1);

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

  test("capture the grand halls, outside and storey by storey, in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS, realm: 1, stage: 0 });
    await timeOfDay(page, 0.14);

    // the Pavilion of Drifting Scriptures on its isle, closed up, from the plank walk
    await at(page, PAVILION, 12, 28);
    await camera(page, { alpha: -Math.PI / 4 + 0.25, beta: 1.0, radius: 52 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "283-3d-pavilion-of-drifting-scriptures");

    // through the door: the roof and the floors above lift away, and the lecture hall is open to the camera
    await at(page, PAVILION, 12, 21);
    await camera(page, { radius: 34, beta: 0.95 });
    await ready(page, 5000);
    await quiet(page);
    await shot(page, "284-3d-pavilion-lecture-hall");

    // up the east stair to the stacks
    await at(page, PAVILION, 21, 14);
    await page.waitForFunction(() => window.__pixelop!.game.world.hallHere?.storey === 1, null, { timeout: 10_000 });
    await at(page, PAVILION, 21, 12);
    await camera(page, { radius: 34, beta: 0.95 });
    await ready(page, 5000);
    await quiet(page);
    await shot(page, "285-3d-pavilion-the-stacks");

    // and up the west stair to the starwatch gallery under the roof
    await at(page, PAVILION, 7, 19);
    await page.waitForFunction(() => window.__pixelop!.game.world.hallHere?.storey === 2, null, { timeout: 10_000 });
    await at(page, PAVILION, 9, 19);
    await camera(page, { radius: 34, beta: 0.95 });
    await ready(page, 5000);
    await quiet(page);
    await shot(page, "286-3d-pavilion-starwatch-gallery");

    // the Hall of Ten Thousand Debates outside the Ten Halls' south gate
    await at(page, DEBATES, 34, 12);
    await camera(page, { alpha: -Math.PI / 4 - 0.2, beta: 1.0, radius: 56 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "287-3d-hall-of-ten-thousand-debates");

    await at(page, DEBATES, 22, 13);
    await camera(page, { radius: 36, beta: 0.95 });
    await ready(page, 5000);
    await quiet(page);
    await shot(page, "288-3d-debates-refectory");

    await at(page, DEBATES, 24, 15);
    await page.waitForFunction(() => window.__pixelop!.game.world.hallHere?.storey === 1, null, { timeout: 10_000 });
    await at(page, DEBATES, 22, 11);
    await camera(page, { radius: 36, beta: 0.95 });
    await ready(page, 5000);
    await quiet(page);
    await shot(page, "289-3d-debates-debating-floor");

    await at(page, DEBATES, 3, 15);
    await page.waitForFunction(() => window.__pixelop!.game.world.hallHere?.storey === 2, null, { timeout: 10_000 });
    await at(page, DEBATES, 6, 12);
    await camera(page, { radius: 36, beta: 0.95 });
    await ready(page, 5000);
    await quiet(page);
    await shot(page, "290-3d-debates-furnace-loft");
    console.log("storey at the end:", await storey(page));
  });
});

test.describe("in pixels", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("capture a grand hall in the isometric view", async ({ page }) => {
    test.setTimeout(300_000);
    await startNewGame(page);
    await patch(page, { flags: FLAGS });
    await timeOfDay(page, 0.15);
    await at(page, DEBATES, 20, 13);
    await page.waitForTimeout(2500);
    await quiet(page);
    await shot(page, "291-debates-refectory-pixels");
  });
});
