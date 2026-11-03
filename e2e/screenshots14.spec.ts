import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { goto, patch, standBy, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the rim of the world, the Three Isles, the Underworld chart, the new moves and the autoplay bot. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const FLAGS = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, harborArrived: true, "heart:home": true, heartReturned: true };
const quiet = (page: Page) => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
const timeOfDay = (page: Page, k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
/** Stand on an authoring-grid tile of the open world (each is two world tiles across). */
const on = (page: Page, x: number, y: number) => goto(page, x * 2 + 0.5, y * 2 + 0.5);
/** Strike a pose and hold it: the move is started, then the clock is let run `t` seconds into it. */
const pose = (page: Page, anim: string, t: number) =>
  page.evaluate(
    ([anim, t]) => {
      const g = window.__pixelop!.game as unknown as { clock: number; world: { hero: { holdUntil?: number; dir: number }; setAnim(a: unknown, anim: string, t: number, hold?: boolean): void } };
      g.world.setAnim(g.world.hero, anim as string, g.clock - (t as number), true);
      g.world.hero.holdUntil = g.clock + 30;
    },
    [anim, t] as const,
  );
const face = (page: Page, dir: number) => page.evaluate((d) => (window.__pixelop!.game.world.hero.dir = d), dir);

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

  test("capture the rim of the world, the Three Isles of the Immortals, Guixu and the new moves in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS, realm: 3, stage: 0 });
    await timeOfDay(page, 0.2);

    // the Golden Terraces of Penglai on the isle's heights
    await on(page, 838, 214);
    await camera(page, { alpha: -Math.PI / 4 + 0.3, beta: 0.86, radius: 46 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "375-3d-penglai-the-golden-terraces");

    // the Garden of Peaches
    await on(page, 856, 270);
    await camera(page, { alpha: -Math.PI / 4 - 0.3, beta: 0.9, radius: 34 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "376-3d-the-garden-of-peaches");

    // the White Jade Causeway from Fusang out over the sea
    await on(page, 790, 214);
    await camera(page, { alpha: -Math.PI / 4 + 0.7, beta: 0.98, radius: 84 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "377-3d-the-white-jade-causeway");

    // Fangzhang's Pool of a Hundred Years, and Yingzhou in its mist
    await on(page, 852, 432);
    await camera(page, { alpha: -Math.PI / 4, beta: 0.9, radius: 38 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "378-3d-fangzhang-the-pool-of-a-hundred-years");
    await timeOfDay(page, 0.06);
    await on(page, 826, 602);
    await camera(page, { alpha: -Math.PI / 4 - 0.4, beta: 0.95, radius: 40 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "379-3d-yingzhou-of-the-ocean-mist");
    await timeOfDay(page, 0.22);

    // the Last Lamp at the lip of Guixu, the sea pouring over into the clouds
    await on(page, 806, 742);
    await camera(page, { alpha: -Math.PI / 4 - 0.9, beta: 1.02, radius: 70 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "380-3d-the-last-lamp-at-the-lip-of-guixu");

    // the rim of the world off Penglai's northern cape: no ruled edge, the sea just runs out
    await on(page, 846, 146);
    await camera(page, { alpha: -Math.PI / 4 - 1.6, beta: 1.08, radius: 96 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "381-3d-the-rim-of-the-world");

    // the new moves: at the lip of the world, on the isles, and down in the deep
    await on(page, 806, 742);
    await camera(page, { alpha: -Math.PI / 4 - 0.4, beta: 0.85, radius: 12 });
    await ready(page, 3000);
    await face(page, 6);
    for (const [anim, t, name] of [
      ["rimgaze", 0.9, "382-3d-looking-over-the-lip"],
      ["turtlebow", 0.8, "383-3d-a-bow-to-the-turtle"],
    ] as const) {
      await pose(page, anim, t);
      await page.waitForTimeout(250);
      await pose(page, anim, t);
      await quiet(page);
      await shot(page, name);
    }
    await on(page, 838, 210);
    await camera(page, { alpha: -Math.PI / 4 + 0.3, beta: 0.85, radius: 12 });
    await ready(page, 3000);
    for (const [anim, t, name] of [
      ["cranestance", 0.9, "384-3d-the-crane-stance"],
      ["elixirbreath", 0.8, "385-3d-breathing-the-elixirs-steam"],
      ["peachpick", 0.55, "386-3d-picking-a-peach"],
      ["poolsip", 1.0, "387-3d-a-sip-of-a-hundred-years"],
    ] as const) {
      await pose(page, anim, t);
      await page.waitForTimeout(250);
      await pose(page, anim, t);
      await quiet(page);
      await shot(page, name);
    }
    await page.evaluate(() => window.__pixelop!.game.debugEnter("grotto"));
    await camera(page, { alpha: -Math.PI / 4, beta: 0.85, radius: 13 });
    await ready(page, 3000);
    await pose(page, "torchraise", 0.5);
    await page.waitForTimeout(250);
    await pose(page, "torchraise", 0.5);
    await quiet(page);
    await shot(page, "388-3d-raising-a-torch-in-the-deep");
  });
});

test.describe("in pixels", () => {
  test("capture the Overworld and Underworld charts, a deep from the chart, the isles in pixels and the autoplay bot", async ({ page }) => {
    test.setTimeout(600_000);
    await startNewGame(page);
    await patch(page, { flags: FLAGS, realm: 3, stage: 2 });
    await timeOfDay(page, 0.3);

    // the world map, over Fusang's east shore: the Three Isles, the jade causeways, and the falls at the rim
    await on(page, 760, 230);
    await page.keyboard.press("KeyM");
    await page.waitForTimeout(1800);
    await quiet(page);
    await shot(page, "389-world-map-the-rim-and-the-three-isles");
    // and the whole world at a glance (Z): a ragged, rounded rim, no rectangle left
    await page.keyboard.press("KeyZ");
    await page.waitForTimeout(2500);
    await quiet(page);
    await shot(page, "389b-world-map-the-whole-world");
    await page.keyboard.press("KeyZ");

    // turned over: the Underworld chart, its deeps aglow and the dragon veins between them
    await page.keyboard.press("KeyU");
    await page.waitForTimeout(600);
    await quiet(page);
    await page.getByTestId("deep-drowned").click();
    for (let i = 0; i < 80 && (await page.evaluate(() => window.__pixelop!.game.worldMap?.travelling ?? false)); i++) await page.waitForTimeout(100);
    await page.waitForTimeout(800);
    await quiet(page);
    await shot(page, "390-world-map-the-underworld");
    await page.getByTestId("deep-grotto").click();
    for (let i = 0; i < 80 && (await page.evaluate(() => window.__pixelop!.game.worldMap?.travelling ?? false)); i++) await page.waitForTimeout(100);
    await page.waitForTimeout(800);
    await quiet(page);
    await shot(page, "391-world-map-the-underworld-west");
    await page.keyboard.press("KeyZ");
    await page.waitForTimeout(2500);
    await quiet(page);
    await shot(page, "391b-world-map-the-whole-underworld");
    await page.keyboard.press("KeyM");
    await page.waitForTimeout(500);

    // on Penglai, among the immortals, the jade motes in the grass
    await standBy(page, "im-anqi");
    await page.waitForTimeout(1500);
    await quiet(page);
    await shot(page, "392-penglai-in-pixels");

    // the autoplay bot at the keys (F9): it reads, walks, talks and fights on its own, and says what it is doing
    await standBy(page, "im-crane");
    await page.keyboard.press("F9");
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250);
      if ((await page.evaluate(() => window.__pixelop!.game.mode)) === "scene") break;
    }
    await page.waitForTimeout(600);
    await shot(page, "393-the-autoplay-bot");
    await page.keyboard.press("F9");
  });
});
