import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { battle, mode, patch, skipScene, standBy, startNewGame, teleport } from "./helpers";

/** Captures the README / PR screenshots of the tall trees, the houses' new detail, the busier towns and the four new deeps. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const FLAGS = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true, lakeArrived: true, harborArrived: true, desertArrived: true, frostArrived: true };

const quiet = (page: Page) => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
const timeOfDay = (page: Page, k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
const enter = (page: Page, id: string) => page.evaluate((id) => window.__pixelop!.game.debugEnter(id as never), id);
const waypoint = (page: Page, id: string, dx = 0, dy = 0) =>
  page.evaluate(([id, dx, dy]) => {
    const g = window.__pixelop!.game;
    const [x, y] = g.world.world!.waypoints[id as "sect"];
    g.debugGoto(x + (dx as number), y + (dy as number));
  }, [id, dx, dy] as const);
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
/** Stand among the thickest crowd of a region, folk and their neighbours both. */
const crowded = (page: Page, region: string) =>
  page.evaluate((region) => {
    const g = window.__pixelop!.game;
    const folk = g.world.actors.filter((a) => a.kind === "npc" && g.world.regionAt(a.x, a.y) === region);
    let best = folk[0];
    let most = 0;
    for (const a of folk) {
      const n = folk.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 7).length;
      if (n > most) [best, most] = [a, n];
    }
    g.debugGoto(best.x + 1.5, best.y + 1.5);
  }, region);
/** Walk a step so the first-steps hint goes away. */
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
  for (let i = 0; i < 30; i++) {
    const t = await page.evaluate(() => document.querySelector("[data-testid=dialog]")?.textContent ?? "");
    if (t.includes(text)) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1400);
  await shot(page, name);
  await skipScene(page);
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
    await page.waitForFunction(() => !!(window.__pixelop?.game.view3d as { ready?: boolean } | null | undefined)?.ready, null, { timeout: 90_000 });
    await page.waitForTimeout(ms);
  };

  test("capture the tall trees and the houses in 3D", async ({ page }) => {
    test.setTimeout(600_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS });
    await timeOfDay(page, 0.95);
    await step(page);

    await waypoint(page, "village", 4, -6);
    await camera(page, { alpha: -Math.PI / 4 + 0.4, beta: 1.0, radius: 30 });
    await ready(page);
    await quiet(page);
    await shot(page, "221-3d-willow-creek-under-tall-willows");

    await crowded(page, "village");
    await camera(page, { alpha: -Math.PI / 4 - 0.3, beta: 0.95, radius: 24 });
    await ready(page, 1500);
    await quiet(page);
    await shot(page, "222-3d-willow-creek-twice-as-busy");

    await waypoint(page, "bamboo");
    await camera(page, { alpha: -Math.PI / 4 + 1.2, beta: 1.05, radius: 26 });
    await ready(page);
    await quiet(page);
    await shot(page, "223-3d-the-bamboo-towers-over-her");

    await waypoint(page, "sect");
    await camera(page, { alpha: -Math.PI / 4, beta: 0.85, radius: 34 });
    await ready(page);
    await quiet(page);
    await shot(page, "224-3d-the-sect-gate-under-tall-pines");

    await patch(page, { flags: { ...FLAGS, iceAsk: true } });
    await enter(page, "icesoul");
    await settle(page, 600);
    await camera(page, { radius: 24, beta: 0.8 });
    await ready(page);
    await quiet(page);
    await shot(page, "225-3d-the-icesoul-hollow");
  });
});

test.describe("in pixels", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("capture the busier jianghu and the four new deeps", async ({ page }) => {
    test.setTimeout(600_000);
    await startNewGame(page);
    let flags: Record<string, boolean> = { ...FLAGS };
    const setFlags = async (more: Record<string, boolean>) => {
      flags = { ...flags, ...more };
      await patch(page, { flags, realm: 3, stage: 1, hp: 900, qi: 400, skills: ["strike", "palm", "lotus", "swords", "thunder"] });
    };
    await setFlags({});

    // Willow Creek's market road, twice as busy, under willows as tall as the houses
    await timeOfDay(page, 0.1);
    await crowded(page, "village");
    await step(page);
    await settle(page, 4500);
    await quiet(page);
    await shot(page, "226-willow-creek-twice-as-busy");

    // Wavecrest Harbour's folk and their neighbours
    await crowded(page, "harbor");
    await settle(page);
    await quiet(page);
    await shot(page, "227-wavecrest-harbour-crowds");

    // the Icesoul Hollow under Frostveil
    await timeOfDay(page, 0.2);
    await near(page, "mingjing", 2, 2, 11);
    await settle(page);
    await talk(page, "mingjing", "listen to the ice", "228-novice-ming-jing");
    await setFlags({ iceAsk: true });
    await enter(page, "icesoul");
    await settle(page, 1200);
    await near(page, "heng", 3, 2, 10);
    await settle(page);
    await quiet(page);
    await page.waitForTimeout(400);
    await shot(page, "229-brother-heng-in-the-icesoul-hollow");
    await near(page, "ice-wyrm", 4, 2, 10);
    await battle(page, "rimewyrm");
    await page.waitForTimeout(2600);
    await shot(page, "230-the-rime-wyrm");
    await teleport(page, "desert", 16, 16);
    await settle(page, 800);

    // the Tomb Beneath the Sands
    await setFlags({ tombAsk: true, tombStele1: true, tombStele2: true, tombStele3: true, duneDefeated: true });
    await enter(page, "sandtomb");
    await settle(page, 1200);
    await near(page, "tomb-coffin", 5, 3, 10);
    await settle(page);
    await quiet(page);
    await shot(page, "231-the-tomb-beneath-the-sands");
    await ask(page, "tomb-coffin", "232-queen-ayalas-coffin", 1);

    // the Tidevoice Cave
    await setFlags({ tideAsk: true });
    await enter(page, "tidecave");
    await settle(page, 1200);
    await near(page, "shui", 3, -2, 9);
    await settle(page);
    await quiet(page);
    await shot(page, "233-little-shui-in-the-tidevoice-cave");
    await setFlags({ shuiFound: true, pearlDefeated: true });
    await ask(page, "tide-pearl-pool", "234-the-serpents-pearl", 0);

    // the Bamboo Root Caverns
    await setFlags({ patriarchDefeated: true, vixenAsk: true, gouFound: true });
    await enter(page, "bambooroots");
    await settle(page, 1200);
    await near(page, "roots-vixen", 5, 2, 10);
    await settle(page);
    await quiet(page);
    await shot(page, "235-the-bamboo-root-caverns");
    await setFlags({ vixenDefeated: true });
    await ask(page, "roots-den", "236-the-last-fox-of-the-blood-moon", 0);
  });
});
