import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { goto, patch, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the Encircling Sea: the straits between the continents, the world's edge, the quarter-tile ground and the new moves. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const FLAGS = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, "heart:home": true, heartReturned: true };
const quiet = (page: Page) => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
const timeOfDay = (page: Page, k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
/** Stand on an authoring-grid tile of the open world (each is two world tiles across). */
const on = (page: Page, x: number, y: number) => goto(page, x * 2 + 0.5, y * 2 + 0.5);
/** Stand on the nearest open ground (world tiles) with the sea within a few steps of it, searching out from a point. */
const shore = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const g = window.__pixelop!.game;
      const m = g.world.def.map;
      const wet = (i: number, j: number) => m.kind(i, j) === "water" || m.kind(i, j) === "deep";
      for (let r = 0; r < 80; r++)
        for (let b = -r; b <= r; b++)
          for (let a = -r; a <= r; a++) {
            if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
            const [i, j] = [Math.floor(x as number) + a, Math.floor(y as number) + b];
            if (m.standable(i, j) && [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([p, q]) => m.standable(i + p, j + q)) && (wet(i - 3, j) || wet(i + 3, j) || wet(i, j + 3) || wet(i, j - 3))) {
              g.debugGoto(i + 0.5, j + 0.5);
              return;
            }
          }
    },
    [x, y] as const,
  );
/** Strike a pose and hold it: the move is started, then the clock is let run `t` seconds into it. */
const pose = (page: Page, anim: string, t: number) =>
  page.evaluate(
    ([anim, t]) => {
      const g = window.__pixelop!.game as unknown as { clock: number; world: { hero: { holdUntil?: number }; setAnim(a: unknown, anim: string, t: number, hold?: boolean): void } };
      g.world.setAnim(g.world.hero, anim as string, g.clock - (t as number), true);
      g.world.hero.holdUntil = g.clock + 30;
    },
    [anim, t] as const,
  );

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

  test("capture the straits, the edge of the world, the finer ground and the new moves in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS, realm: 3, stage: 0 });
    await timeOfDay(page, 0.16);

    // the Strait of the Rising Sun, where the road down from the maple woods crosses to the Yellow Sands on planks
    await on(page, 391, 342);
    await camera(page, { alpha: -Math.PI / 4 + 0.5, beta: 0.95, radius: 90 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "347-3d-the-strait-of-the-rising-sun");

    // the Reedwater Strait between the Mistmarsh and the plum hills, the southern road crossing it
    await on(page, 128, 294);
    await camera(page, { alpha: -Math.PI / 4 - 0.3, beta: 1.0, radius: 80 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "348-3d-the-reedwater-strait");

    // the western edge of the world: the Middle Continent's last shore, and the Encircling Sea out to the horizon
    await shore(page, 30 * 2, 330 * 2);
    await camera(page, { alpha: 0.15, beta: 1.25, radius: 60 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "349-3d-the-edge-of-the-world");

    // the ground in quarter-tile cells: a shore curving round, close up
    await shore(page, 60 * 2, 420 * 2);
    await camera(page, { alpha: -Math.PI / 4, beta: 0.9, radius: 26 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "350-3d-quarter-tile-shores");

    // out over the Reedwater Strait on her sword, skimming low
    await on(page, 118, 400);
    await page.evaluate(() => {
      const g = window.__pixelop!.game;
      g.world.hero.flying = true;
    });
    await pose(page, "skim", 0.2);
    await camera(page, { alpha: -Math.PI / 4 + 0.3, beta: 0.85, radius: 14 });
    await ready(page, 4000);
    await quiet(page);
    await shot(page, "351-3d-skimming-the-strait");
    await page.evaluate(() => {
      const g = window.__pixelop!.game;
      g.world.hero.flying = false;
    });

    // by the water: looking out to sea, and skipping a stone
    await shore(page, 60 * 2, 420 * 2);
    await pose(page, "seagaze", 0.9);
    await camera(page, { alpha: -Math.PI / 4 + 0.6, beta: 0.85, radius: 12 });
    await ready(page, 1500);
    await pose(page, "seagaze", 0.9);
    await quiet(page);
    await shot(page, "352-3d-looking-out-to-sea");
    await pose(page, "skipstone", 0.6);
    await page.waitForTimeout(200);
    await pose(page, "skipstone", 0.6);
    await quiet(page);
    await shot(page, "353-3d-skipping-a-stone");
  });
});
