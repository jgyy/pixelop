import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { goto, mode, patch, skipScene, standBy, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the City of Nine Tiers, the bigger town and city, the storeyed buildings and her standing. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const S = 2;
const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const FLAGS = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true, lakeArrived: true, harborArrived: true, desertArrived: true, frostArrived: true, terracesArrived: true, marshArrived: true };

const quiet = (page: Page) => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
const timeOfDay = (page: Page, k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
const enter = (page: Page, id: string) => page.evaluate((id) => window.__pixelop!.game.debugEnter(id as never), id);
/** Stand a few steps from someone or something of the current map, facing a way. */
const near = (page: Page, key: string, dx: number, dy: number, dir = 3) =>
  page.evaluate(
    ([key, dx, dy, dir]) => {
      const g = window.__pixelop!.game;
      const n = [...g.world.def.npcs, ...g.world.def.interacts, ...g.world.def.enemies].find((x) => x.key === key)!;
      if (g.inside) g.world.placeHero(n.i + 0.5 + (dx as number), n.j + 0.5 + (dy as number), dir as number);
      else g.debugGoto(n.i + 0.5 + (dx as number), n.j + 0.5 + (dy as number));
      g.world.hero.dir = dir as number;
    },
    [key, dx, dy, dir] as const,
  );
async function step(page: Page): Promise<void> {
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(250);
  await page.keyboard.up("KeyD");
}
async function settle(page: Page, ms = 1800): Promise<void> {
  await page.waitForTimeout(ms);
  if ((await mode(page)) === "scene") await skipScene(page);
}
/** Talk (or read) until a question is put to her, photograph it, then answer it. */
async function ask(page: Page, key: string, name: string, answer: number): Promise<void> {
  await standBy(page, key);
  await page.waitForTimeout(500);
  await page.keyboard.press("KeyE");
  for (let i = 0; i < 40 && !(await page.getByTestId("choice").isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(600);
  await shot(page, name);
  await page.evaluate((k) => window.__pixelop!.game.choose(k), answer);
  for (let i = 0; i < 6 && (await mode(page)) === "scene"; i++) {
    await skipScene(page);
    await page.waitForTimeout(150);
  }
}
/** Talk to someone until a line containing `text` is on screen, and photograph it. */
async function talk(page: Page, key: string, text: string, name: string): Promise<void> {
  await standBy(page, key);
  await page.waitForTimeout(500);
  await page.keyboard.press("KeyE");
  for (let i = 0; i < 40; i++) {
    const t = await page.evaluate(() => document.querySelector("[data-testid=dialog]")?.textContent ?? "");
    if (t.includes(text)) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1400);
  await shot(page, name);
  await skipScene(page);
}
/** Jump the tale of the Nine Tiers to a quest, at a realm (overall level), and let the city catch up. */
async function tale(page: Page, n: number, realm: number, stage: number): Promise<void> {
  await patch(page, { flags: FLAGS, counters: { tiers: n, tiersp: 0 }, realm, stage, hp: 2000, qi: 900 });
  await page.waitForTimeout(1200);
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

  test("capture the City of Nine Tiers, and the town and the city twice the size, in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS, realm: 4, stage: 3 });
    await timeOfDay(page, 0.12);
    await step(page);

    // the city from the foot of its avenue, every tier climbing toward the summit
    await goto(page, 222 * S + 0.5, 584 * S + 0.5);
    await camera(page, { alpha: Math.PI / 2 - 0.25, beta: 0.9, radius: 78 });
    await ready(page, 4000);
    await quiet(page);
    await shot(page, "237-3d-the-city-of-nine-tiers");

    // the Nine-Arch Bridge across the strait of cloud
    await goto(page, 222 * S + 0.5, 553 * S + 0.5);
    await camera(page, { alpha: -Math.PI / 4 - 0.6, beta: 0.9, radius: 46 });
    await ready(page, 3000);
    await quiet(page);
    await shot(page, "238-3d-the-nine-arch-bridge");

    // the gates up the avenue, their wardens, and a seal of gold light on every stair her realm has not yet earned
    await patch(page, { realm: 1, stage: 0 });
    await page.waitForTimeout(1200);
    await goto(page, 222 * S + 0.5, 577 * S + 0.5);
    await camera(page, { alpha: Math.PI / 2 + 0.5, beta: 0.85, radius: 34 });
    await ready(page, 3000);
    await quiet(page);
    await shot(page, "239-3d-the-stair-and-its-gates");

    // Heaven's Step, and the Sovereign's palace
    await patch(page, { realm: 4, stage: 3 });
    await page.waitForTimeout(1200);
    await goto(page, 222 * S + 0.5, 603 * S + 0.5);
    await camera(page, { alpha: Math.PI / 2 - 0.4, beta: 0.85, radius: 36 });
    await ready(page, 3000);
    await quiet(page);
    await shot(page, "240-3d-heavens-step");

    // Jinhe, twice the size: the new walls a ring out, and its storeyed quarters
    await goto(page, 222 * S + 0.5, 486 * S + 0.5);
    await camera(page, { alpha: -Math.PI / 4 + 0.3, beta: 0.95, radius: 56 });
    await ready(page, 3500);
    await quiet(page);
    await shot(page, "241-3d-jinhe-twice-the-size");

    await goto(page, 207 * S + 0.5, 497 * S + 0.5);
    await camera(page, { alpha: -Math.PI / 4 - 0.5, beta: 0.9, radius: 26 });
    await ready(page, 3000);
    await quiet(page);
    await shot(page, "242-3d-the-pavilion-of-nine-fragrances");

    // Willow Creek's East Ward
    await goto(page, 226 * S + 0.5, 144 * S + 0.5);
    await camera(page, { alpha: -Math.PI / 4 + 0.2, beta: 0.95, radius: 40 });
    await ready(page, 3500);
    await quiet(page);
    await shot(page, "243-3d-willow-creeks-east-ward");

    await goto(page, 231 * S + 0.5, 143 * S + 0.5);
    await camera(page, { alpha: -Math.PI / 4 - 0.9, beta: 0.85, radius: 24 });
    await ready(page, 3000);
    await quiet(page);
    await shot(page, "244-3d-the-willow-inn");

    // and an Ancestor walking the ward: the mortals go down on their knees as she passes
    await patch(page, { realm: 3, stage: 0 });
    await page.waitForTimeout(800);
    await goto(page, 214 * S + 0.5, 145 * S + 0.5);
    await camera(page, { alpha: (3 * Math.PI) / 4, beta: 0.4, radius: 20 });
    await ready(page, 600);
    await goto(page, 216 * S + 0.5, 144.4 * S);
    await page.waitForTimeout(1500);
    await quiet(page);
    await shot(page, "253-3d-the-ward-kneels-to-an-ancestor");
  });
});

test.describe("in pixels", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("capture the tale of the Nine Tiers, her standing and the storeyed rooms", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await patch(page, { flags: FLAGS, realm: 0, stage: 2 });
    await timeOfDay(page, 0.15);
    await step(page);

    // the herald's census at Jinhe's south gate
    await standBy(page, "tj-herald");
    await page.waitForTimeout(500);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(3200);
    await shot(page, "245-the-census-of-the-stair");
    for (let i = 0; i < 6 && (await mode(page)) === "scene"; i++) await skipScene(page);
    // the Weighing
    await tale(page, 9, 0, 2);
    await talk(page, "tj-weigher", "tablet", "246-the-weighing-hall");
    // Ah Lou and the overseer
    await tale(page, 18, 0, 2);
    await ask(page, "tj-ahlou-0", "247-ah-lou-and-the-overseer", 0);
    // the seal on the Copper Stair turns back a Qi Condensation tablet
    await goto(page, 222 * S + 0.5, 572 * S + 0.5);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__pixelop!.game.setStick(-0.8, 0.4));
    await page.waitForTimeout(2600);
    await page.evaluate(() => window.__pixelop!.game.setStick(0, 0));
    await page.waitForTimeout(500);
    await shot(page, "248-the-seal-on-the-copper-stair");
    await quiet(page);

    // the Jade Tier: Su Wan and the red thread
    await tale(page, 345, 2, 0);
    await ask(page, "tj-suwan", "249-a-letter-each-way", 2);
    // the Violet Tier: a feather's testimony
    await tale(page, 536, 3, 0);
    await ask(page, "tj-peilan", "250-to-stand-on-the-pan", 0);
    // the Thunder Tier: Ah Lou sings at the gate
    await tale(page, 876, 4, 2);
    await talk(page, "tj-ahlou-8", "my song", "251-a-song-she-used-to-sing");
    // Heaven's Step: the Sovereign
    await tale(page, 909, 4, 2);
    await talk(page, "tj-gao", "never taken", "252-the-sovereign-of-the-stair");

    // Madam Liu of Willow Creek's East Ward, who never looked at the foundling, kneels to the Ancestor
    await patch(page, { realm: 3, stage: 0 });
    await timeOfDay(page, 0.2);
    await talk(page, "ew-liuwife", "kneel", "254-madam-liu-kneels");

    // up the Willow Inn's stair to the top floor the village kept for its own golden core
    await enter(page, "willowinn");
    await settle(page, 1200);
    await standBy(page, "willowinn-stair");
    await page.keyboard.press("KeyE");
    await settle(page, 1800);
    await near(page, "wi-zhou", 1.4, 1.2, 12);
    await quiet(page);
    await page.waitForTimeout(3200);
    await shot(page, "255-the-willow-inns-top-floor");
    await page.evaluate(() => window.__pixelop!.game.debugGoto(222 * 2 + 0.5, 500 * 2 + 0.5));
    await settle(page, 800);

    // the Pavilion of Nine Fragrances: turned away at Qi Condensation, welcome upstairs at Foundation
    await patch(page, { realm: 0, stage: 3 });
    await enter(page, "fragrance");
    await settle(page, 1200);
    await standBy(page, "fragrance-stair");
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(1500);
    await shot(page, "256-not-up-there-miss");
    await skipScene(page);
    await patch(page, { realm: 1, stage: 1 });
    await standBy(page, "fragrance-stair");
    await page.keyboard.press("KeyE");
    await settle(page, 1800);
    await near(page, "fr-lady", -1.4, 1.2, 4);
    await quiet(page);
    await page.waitForTimeout(3200);
    await quiet(page);
    await page.waitForTimeout(300);
    await shot(page, "257-the-upper-floor");
    await page.evaluate(() => window.__pixelop!.game.debugGoto(222 * 2 + 0.5, 500 * 2 + 0.5));
    await settle(page, 800);

    // the journal: her standing, and the tiers as they stand for her
    await tale(page, 420, 2, 2);
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(900);
    await page.getByTestId("journal-standing").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, "258-journal-standing-and-the-tiers");
    await page.keyboard.press("KeyJ");
  });
});
