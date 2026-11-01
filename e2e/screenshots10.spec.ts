import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { goto, patch, standBy, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the Founding: her sect raised in the basin, its close-ups, the gods, and the capitals' facilities. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const FLAGS = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, "heart:home": true, heartReturned: true };
const quiet = (page: Page) => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
const timeOfDay = (page: Page, k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
/** Stand on an authoring-grid tile of the open world (each is two world tiles across). */
const on = (page: Page, x: number, y: number) => goto(page, x * 2 + 0.5, y * 2 + 0.5);
/** The basin, on the authoring grid. */
const BASIN: [number, number] = [342, 410];

/** Talk to someone and wait for the close-up to come up (pressing on through any lines before it). */
async function toCloseUp(page: Page, key: string) {
  await standBy(page, key);
  await page.waitForTimeout(800);
  await page.keyboard.press("KeyE");
  for (let k = 0; k < 12; k++) {
    await page.waitForTimeout(900);
    if (await page.getByTestId("closeup").count()) break;
    await page.keyboard.press("KeyE");
  }
  await page.waitForTimeout(3500);
  await quiet(page);
}

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

  test("capture the basin bare, half built and founded, and a capital's facilities in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await timeOfDay(page, 0.16);

    // the Withered Lotus Basin as she finds it: old paving, dead reeds, ruins, and a little god on his shrine
    await patch(page, { flags: FLAGS, realm: 1, stage: 0, counters: { fd: 0 } });
    await on(page, BASIN[0], BASIN[1] + 4);
    await camera(page, { alpha: -Math.PI / 4 + 0.3, beta: 0.95, radius: 46 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "320-3d-the-withered-lotus-basin");

    // the sect half built: the gate, the hall, the quarters, the yard and the Pill Chamber, with disciples and elders at work
    await patch(page, { flags: FLAGS, realm: 2, stage: 2, counters: { fd: 470 } });
    await on(page, BASIN[0] + 2, BASIN[1]);
    await camera(page, { alpha: -Math.PI / 4 - 0.2, beta: 0.92, radius: 44 });
    await ready(page, 7000);
    await quiet(page);
    await shot(page, "321-3d-the-sect-half-built");

    // close in on the work: the practice yard, the forge and the refectory
    await on(page, BASIN[0] + 9, BASIN[1] + 1);
    await camera(page, { alpha: -Math.PI / 4 + 0.6, beta: 0.86, radius: 24 });
    await ready(page, 5000);
    await quiet(page);
    await shot(page, "322-3d-the-sect-at-work");

    // founded: every hall standing, the spring running, the gods on the Altar of Heaven
    await patch(page, { flags: FLAGS, realm: 4, stage: 0, counters: { fd: 1000 } });
    await timeOfDay(page, 0.44);
    await on(page, BASIN[0], BASIN[1] - 6);
    await camera(page, { alpha: -Math.PI / 4, beta: 0.95, radius: 50 });
    await ready(page, 7000);
    await quiet(page);
    await shot(page, "323-3d-the-sect-founded");

    // the market town outside the gate
    await on(page, BASIN[0], BASIN[1] + 20);
    await camera(page, { alpha: -Math.PI / 4 + 0.4, beta: 0.95, radius: 40 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "324-3d-the-market-town");

    // Liangdu's new facilities: the granary, the mill, the kiln, the school, the City God's temple, all of them busy
    await timeOfDay(page, 0.16);
    await on(page, 72, 504);
    await camera(page, { alpha: -Math.PI / 4 - 0.4, beta: 0.95, radius: 42 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "325-3d-liangdu-at-work");
  });
});

test.describe("in pixels", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("capture the close-ups, the gods, the journal and the map", async ({ page }) => {
    test.setTimeout(400_000);
    await startNewGame(page);
    await timeOfDay(page, 0.18);

    // the first close-up: Grandfather Earth on his shrine
    await patch(page, { flags: FLAGS, realm: 1, stage: 0, counters: { fd: 0 } });
    await toCloseUp(page, "fd-earthgod");
    await shot(page, "326-closeup-grandfather-earth");
    await page.evaluate(() => window.__pixelop!.game.skipScene());

    // someone at the gate: a recruit's close-up
    await patch(page, { flags: { ...FLAGS, "fd:name:mercy": true }, realm: 1, stage: 1, counters: { fd: 47 } });
    await page.waitForTimeout(800);
    await toCloseUp(page, "fd-steward");
    await shot(page, "327-closeup-at-the-gate");
    await page.evaluate(() => window.__pixelop!.game.skipScene());
    await page.waitForTimeout(500);

    // the Jade Emperor comes down to the Altar of Heaven
    await patch(page, { flags: { ...FLAGS, "fd:name:mercy": true }, realm: 3, stage: 2, counters: { fd: 740 } });
    await page.waitForTimeout(1200);
    await toCloseUp(page, "fd-god-jade");
    await shot(page, "328-closeup-the-jade-emperor");
    // answer his question (a question stops a skip), then let the scene play out
    for (let k = 0; k < 6; k++) {
      await page.evaluate(() => window.__pixelop!.game.skipScene());
      await page.keyboard.press("Digit1");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => window.__pixelop!.game.skipScene());
    await page.waitForTimeout(500);

    // the journal: the Founding and her sect
    await patch(page, { flags: { ...FLAGS, "fd:name:mercy": true }, realm: 3, stage: 2, counters: { fd: 760 } });
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(900);
    await page.getByTestId("journal-sect").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, "329-journal-the-founding-and-her-sect");
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(500);

    // the basin in pixels, the gods among the halls
    await on(page, BASIN[0], BASIN[1] - 8);
    await page.waitForTimeout(2500);
    await quiet(page);
    await shot(page, "330-the-basin-in-pixels");

    // the world map: the basin in the Yellow Sands
    await page.keyboard.press("KeyM");
    await page.getByTestId("worldmap").waitFor();
    await page.waitForTimeout(2500);
    await shot(page, "331-world-map-the-withered-lotus-basin");
    await page.keyboard.press("KeyM");
  });
});
