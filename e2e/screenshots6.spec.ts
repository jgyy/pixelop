import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { battle, goto, mode, patch, skipScene, standBy, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the Hundred Peoples, their homes, and the doubled draw distance. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const S = 2;
const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const FLAGS = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true, lakeArrived: true, harborArrived: true, desertArrived: true, frostArrived: true, terracesArrived: true, marshArrived: true };

const quiet = (page: Page) => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
const timeOfDay = (page: Page, k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
async function step(page: Page): Promise<void> {
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(250);
  await page.keyboard.up("KeyD");
}
/** Talk until a question is put to her, photograph it, then answer it. */
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
  for (let i = 0; i < 6 && (await mode(page)) === "scene"; i++) await skipScene(page);
}
/** Jump the tale of the Hundred Peoples to a quest, at a realm, and let the homes catch up. */
async function tale(page: Page, n: number, realm: number, stage: number): Promise<void> {
  await patch(page, { flags: FLAGS, counters: { peoples: n, peoplesp: 0 }, realm, stage, hp: 2000, qi: 900 });
  await page.waitForTimeout(1200);
  await quiet(page);
}

/** Each people's home on the authoring grid, and how the camera looks at it. */
const HOMES: [string, number, number, { alpha: number; beta: number; radius: number }][] = [
  ["260-3d-moonfox-hollow-of-the-fox-folk", 380, 300, { alpha: -Math.PI / 4 + 0.4, beta: 0.9, radius: 34 }],
  ["261-3d-pearlsong-reef-of-the-merfolk", 612, 214, { alpha: -Math.PI / 4 - 0.3, beta: 0.92, radius: 34 }],
  ["262-3d-hollowstone-hold-of-the-stone-born", 300, 400, { alpha: -Math.PI / 4 + 0.2, beta: 0.9, radius: 34 }],
  ["263-3d-skyfeather-eyrie-of-the-feathered-folk", 160, 420, { alpha: -Math.PI / 4 + 0.6, beta: 1.0, radius: 36 }],
  ["264-3d-rimehorn-lodge-of-the-snow-folk", 400, 95, { alpha: -Math.PI / 4 - 0.4, beta: 0.9, radius: 34 }],
  ["265-3d-emberscale-hold-of-the-dragon-kin", 470, 420, { alpha: -Math.PI / 4 + 0.3, beta: 0.88, radius: 36 }],
  ["266-3d-the-bone-arch", 456, 432, { alpha: -Math.PI / 4 - 0.7, beta: 0.85, radius: 24 }],
];

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

  test("capture the homes of the Hundred Peoples, and the land drawn twice as far, in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS, realm: 2, stage: 0, counters: { peoples: 30, peoplesp: 0 } });
    await timeOfDay(page, 0.12);
    await step(page);

    // twice the draw distance: from the hills over Jinhe, the city, the strait and the City of Nine Tiers beyond
    await goto(page, 222 * S + 0.5, 470 * S + 0.5);
    await camera(page, { alpha: Math.PI / 2 - 0.1, beta: 1.12, radius: 92 });
    await ready(page, 9000);
    await quiet(page);
    await shot(page, "259-3d-twice-the-draw-distance");

    for (const [name, x, y, cam] of HOMES) {
      await goto(page, x * S + 0.5, (y + 1) * S + 0.5);
      await camera(page, cam);
      await ready(page, 4000);
      await quiet(page);
      await shot(page, name);
    }
  });
});

test.describe("in pixels", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("capture the tale of the Hundred Peoples", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await patch(page, { flags: FLAGS, realm: 0, stage: 2 });
    await timeOfDay(page, 0.15);
    await step(page);

    // the Concord Stone, and Envoy Shan
    await tale(page, 0, 0, 2);
    await talk(page, "pe-envoy", "hundred marks", "267-the-concord-stone");
    // one beat with a question for each people
    await tale(page, 20, 0, 2);
    await ask(page, "pe-fox-elder", "268-an-oath-in-moonfox-hollow", 0);
    await tale(page, 220, 1, 1);
    await ask(page, "pe-mer-elder", "269-the-tide-mother", 2);
    await tale(page, 420, 2, 0);
    await ask(page, "pe-stone-elder", "270-old-granite", 0);
    await tale(page, 620, 2, 3);
    await ask(page, "pe-feather-elder", "271-the-wind-speaker", 1);
    await tale(page, 820, 3, 2);
    await ask(page, "pe-snow-elder", "272-three-nights-a-guest", 2);
    await tale(page, 1020, 4, 1);
    await ask(page, "pe-dragon-elder", "273-the-matriarch-of-emberscale", 2);

    // the journal: the quest line, main and side, and the peoples as they stand for her
    await tale(page, 433, 2, 0);
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(900);
    await page.getByTestId("journal-peoples").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, "274-journal-the-hundred-peoples");
    await page.keyboard.press("KeyJ");

    // the fox-folk's trouble
    await battle(page, "huyan");
    await page.waitForTimeout(2500);
    await shot(page, "275-hu-yan-the-moon-eater");
  });
});
