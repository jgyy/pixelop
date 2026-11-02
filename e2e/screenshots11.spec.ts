import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { battle, goto, patch, standBy, startNewGame } from "./helpers";

/** Captures the README / PR screenshots of the Southern Heights: the Hanging City, the Thousand-Pillar Forest, the Cliff Port, ships and fliers, and the new techniques. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const FLAGS = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, "heart:home": true, heartReturned: true };
const quiet = (page: Page) => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
const timeOfDay = (page: Page, k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
/** Stand on an authoring-grid tile of the open world (each is two world tiles across). */
const on = (page: Page, x: number, y: number) => goto(page, x * 2 + 0.5, y * 2 + 0.5);
/** The Hanging City's heart, the forest's tallest grove and the Cliff Port's quay, on the authoring grid. */
const CITY: [number, number] = [178, 722];
const GROVE: [number, number] = [52, 756];
const QUAY: [number, number] = [262, 725];

/**
 * Bring travellers round their loops to a point (world tiles): each is set at the place on its loop nearest the point,
 * `spread` tiles apart along it, so a junk is passing the quay or the cloud-ship is overhead when the shutter goes.
 */
const bring = (page: Page, prefix: string, x: number, y: number, spread = 0) =>
  page.evaluate(
    ([prefix, x, y, spread]) => {
      const g = window.__pixelop!.game as unknown as { clock: number; world: { actors: { key: string; voyage?: { route: [number, number][]; lengths: number[]; speed: number; phase: number } }[] } };
      g.world.actors
        .filter((a) => a.voyage && a.key.startsWith(prefix as string))
        .forEach((a, n) => {
          const v = a.voyage!;
          const total = v.lengths[v.lengths.length - 1];
          let best = 0;
          let bd = Infinity;
          for (let s = 0; s < total; s += 0.5) {
            let k = 0;
            while (k < v.route.length - 1 && v.lengths[k + 1] <= s) k++;
            const p = v.route[k];
            const q = v.route[(k + 1) % v.route.length];
            const u = (s - v.lengths[k]) / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1);
            const d = Math.hypot(p[0] + (q[0] - p[0]) * u - (x as number), p[1] + (q[1] - p[1]) * u - (y as number));
            if (d < bd) {
              bd = d;
              best = s;
            }
          }
          const want = best + n * (spread as number);
          v.phase = ((((want - g.clock * v.speed) / total) % 1) + 1) % 1;
        });
    },
    [prefix, x, y, spread] as const,
  );

/** Bring travellers to a point a given way off from where she stands (world tiles). */
const bringNear = async (page: Page, prefix: string, dx: number, dy: number, spread = 0) => {
  const [x, y] = await page.evaluate(() => [window.__pixelop!.game.world.hero.x, window.__pixelop!.game.world.hero.y]);
  await bring(page, prefix, x + dx, y + dy, spread);
};

/** Stand on the shore nearest a traveller's loop, where it passes close to land. */
const standByLane = (page: Page, key: string) =>
  page.evaluate((key) => {
    const g = window.__pixelop!.game;
    const v = g.world.actors.find((a) => a.key === key)!.voyage!;
    const m = g.world.def.map;
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let k = 0; k < v.route.length; k++) {
      const [x, y] = v.route[k];
      for (let r = 1; r < 14 && !(best && bd <= r); r++)
        for (let b = -r; b <= r; b++)
          for (let a = -r; a <= r; a++) {
            const i = Math.floor(x) + a;
            const j = Math.floor(y) + b;
            if (Math.max(Math.abs(a), Math.abs(b)) === r && m.standable(i, j) && r < bd) {
              bd = r;
              best = [i + 0.5, j + 0.5];
            }
          }
    }
    if (best) g.debugGoto(best[0], best[1]);
  }, key);

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

  test("capture the Hanging City, the pillars, the Cliff Port, the ships and the fliers in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS, realm: 3, stage: 0 });
    await timeOfDay(page, 0.14);

    // the Hanging City from the south-east: six terraces round one mountain, thirty-eight levels to the summit, sword-riders circling
    await on(page, CITY[0] + 44, CITY[1] + 44);
    await bringNear(page, "voy-sword-xuancheng", -14, -14, 12);
    await camera(page, { alpha: -Math.PI / 4, beta: 1.0, radius: 120 });
    await ready(page, 9000);
    await quiet(page);
    await shot(page, "332-3d-the-hanging-city");

    // on the third terrace: the cliff of the next one rising behind the houses, hoists, lanterns and the folk at work
    await on(page, CITY[0] + 24, CITY[1] + 24);
    await camera(page, { alpha: -Math.PI / 4 + 0.25, beta: 0.88, radius: 44 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "333-3d-a-terrace-of-the-hanging-city");

    // the summit, thirty-eight levels up: the pagoda, the spring, and the falls going over the edge, an immortal riding his cloud past
    await on(page, CITY[0] + 4, CITY[1] + 5);
    await bringNear(page, "voy-immortal-xuancheng", 3, -3);
    await camera(page, { alpha: -Math.PI / 4 + 2.2, beta: 0.98, radius: 50 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "334-3d-the-summit-of-the-hanging-city");

    // the Thousand-Pillar Forest, with cranes wheeling over it
    await on(page, 114, 772);
    await bringNear(page, "voy-cranes-pillars", -20, -20, 8);
    await camera(page, { alpha: -Math.PI / 4, beta: 1.02, radius: 100 });
    await ready(page, 9000);
    await quiet(page);
    await shot(page, "335-3d-the-thousand-pillar-forest");

    // up in a grove: the stone bridges between the pillar tops, thirty levels over the forest floor
    await on(page, GROVE[0] + 1, GROVE[1] + 2);
    await camera(page, { alpha: -Math.PI / 4 - 0.4, beta: 0.95, radius: 52 });
    await ready(page, 6000);
    await quiet(page);
    await shot(page, "336-3d-a-grove-in-the-air");

    // Yagang, the Cliff Port: five steps down to the quay, and the junks and skiffs putting in
    await on(page, QUAY[0] + 8, 709);
    await bringNear(page, "voy-ferry", 10, 6);
    await bringNear(page, "voy-pearlrun", 14, 24, 40);
    await bringNear(page, "voy-skiff-yagang", 6, -6, 12);
    await camera(page, { alpha: -Math.PI / 4 + 0.15, beta: 0.95, radius: 64 });
    await ready(page, 4000);
    await quiet(page);
    await shot(page, "337-3d-yagang-the-cliff-port");

    // junks under sail on the Sea of Pearls
    await standByLane(page, "voy-pearlrun-0");
    await bringNear(page, "voy-pearlrun", 4, 4, 18);
    await bringNear(page, "voy-skiff", 12, 10, 9);
    await camera(page, { alpha: -Math.PI / 4 - 0.6, beta: 0.98, radius: 60 });
    await ready(page, 4000);
    await quiet(page);
    await shot(page, "338-3d-junks-on-the-sea-of-pearls");

    // sword-riders and the cloud-ship over Willow Creek
    await on(page, 196, 112);
    await bringNear(page, "voy-sword-willow", -2, -6, 7);
    await bringNear(page, "voy-cloudship", 4, -10);
    await camera(page, { alpha: -Math.PI / 4 + 0.3, beta: 1.0, radius: 56 });
    await ready(page, 3000);
    await quiet(page);
    await shot(page, "339-3d-sword-riders-and-the-cloud-ship");
  });
});

test.describe("in pixels", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("capture the hermit's lesson, the new techniques and the map", async ({ page }) => {
    test.setTimeout(400_000);
    await startNewGame(page);
    await timeOfDay(page, 0.16);
    await patch(page, { flags: FLAGS, realm: 4, stage: 0, hp: 9000, qi: 9000, skills: ["strike", "palm", "lotus", "swords", "thunder", "whirlwind", "dragon", "phoenix", "starfall"] });

    // the hermit on the Pillar That Holds Up Heaven
    await patch(page, { skills: ["strike", "palm", "lotus", "swords", "thunder", "dragon", "phoenix"] });
    await standBy(page, "pf-hermit");
    await page.waitForTimeout(800);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(1500);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(1800);
    await quiet(page);
    await shot(page, "341-the-hermit-teaches-the-whirlwind");
    await page.evaluate(() => window.__pixelop!.game.skipScene());
    await page.waitForTimeout(600);

    // the new techniques in battle: each caught in the middle of its move
    await patch(page, { hp: 9000, qi: 9000, skills: ["strike", "palm", "lotus", "swords", "thunder", "whirlwind", "dragon", "phoenix", "starfall"] });
    for (const [key, name, at] of [
      ["KeyW", "342-battle-azure-dragon-sword-qi", 650],
      ["KeyE", "343-battle-vermilion-phoenix-ascends", 900],
      ["KeyR", "344-battle-starfall-lotus-rain", 700],
      ["KeyQ", "345-battle-cloudstep-whirlwind", 520],
    ] as const) {
      await battle(page, "frostfang");
      await page.waitForTimeout(1800);
      await page.keyboard.press(key);
      await page.waitForTimeout(at);
      await shot(page, name);
      await page.evaluate(() => window.__pixelop!.game.debugGoto(178 * 2, 670 * 2));
      await page.waitForTimeout(600);
    }

    // the world map: the Southern Heights below the Stairlands
    await on(page, CITY[0], CITY[1] - 60);
    await page.keyboard.press("KeyM");
    await page.getByTestId("worldmap").waitFor();
    await page.waitForTimeout(2500);
    await shot(page, "346-world-map-the-southern-heights");
    await page.keyboard.press("KeyM");
  });
});
