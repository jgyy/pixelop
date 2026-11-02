import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { goto, mode, patch, standBy, startNewGame } from "./helpers";
import { contentionQuests } from "../src/game/story/contention";

/** Captures the README / PR screenshots of the Contention of the Daos: Fusang and its places, a Dao debate, the Powers page and the journal, and the new moves. Run with `npm run screenshots`. */
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
      const g = window.__pixelop!.game as unknown as { clock: number; world: { hero: { holdUntil?: number }; setAnim(a: unknown, anim: string, t: number, hold?: boolean): void } };
      g.world.setAnim(g.world.hero, anim as string, g.clock - (t as number), true);
      g.world.hero.holdUntil = g.clock + 30;
    },
    [anim, t] as const,
  );
/** Put the Contention at quest n, with her realm at Nascent Soul and a little of every Great Dao understood. */
const contentionAt = (page: Page, n: number) =>
  page.evaluate((n) => {
    const g = window.__pixelop!.game;
    const counters: Record<string, number> = { ...g.state.counters, cn: n, cnp: 0, "dao:balance": 14, "dao:sword": 4, "dao:doubt": 7, "pw:synod": 2, "pw:unfettered": 3, "pw:yan": -4, "pw:concord": 5, "pw:shu": 3 };
    for (const d of ["water", "wood", "wind", "fire", "earth", "metal", "thunder", "ice", "lifedeath", "void"]) counters[`wu:${d}`] = 12;
    const flags: Record<string, boolean> = { ...g.state.flags };
    for (const t of ["yan~ironbanner", "orthodox~synod", "talisman~synod", "qi~synod", "liang~goldcrane", "wei~synod"]) flags[`tie:${t}:known`] = true;
    g.debugPatch({ counters, flags, realm: 3, stage: 2 });
  }, n);

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

  test("capture Fusang, the Dawn Causeway, the ragged coasts and the new moves in 3D", async ({ page }) => {
    test.setTimeout(900_000);
    await startNewGame(page);
    await page.waitForFunction(() => !!window.__pixelop!.game.view3d, null, { timeout: 60_000 });
    await patch(page, { flags: FLAGS, realm: 3, stage: 0 });
    await timeOfDay(page, 0.2);

    // the City of Ten Seats: the Synod's square, ten seats under ten parasols, and the envoys of the powers about it
    await on(page, 712, 276);
    await camera(page, { alpha: -Math.PI / 4 + 0.2, beta: 0.85, radius: 48 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "358-3d-the-city-of-ten-seats");

    // the Valley of Sunrise, its pilgrims and the Fusang tree
    await timeOfDay(page, 0.06);
    await on(page, 728, 156);
    await camera(page, { alpha: -Math.PI / 4 - 0.4, beta: 0.95, radius: 42 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "359-3d-the-valley-of-sunrise");
    await timeOfDay(page, 0.22);

    // the Dawn Causeway over the Strait of Dawn
    await on(page, 664, 219);
    await camera(page, { alpha: -Math.PI / 4 + 0.6, beta: 0.95, radius: 80 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "360-3d-the-dawn-causeway");

    // Wuji, the free port of the Unfettered
    await on(page, 700, 470);
    await camera(page, { alpha: -Math.PI / 4, beta: 0.9, radius: 46 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "361-3d-wuji-the-free-port");

    // the Hall of Writs on its marble crag
    await on(page, 728, 376);
    await camera(page, { alpha: -Math.PI / 4 + 0.3, beta: 0.95, radius: 40 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "362-3d-the-hall-of-writs");

    // a bay bitten out of what used to be a ruled shore: the Western Continent's coast
    await on(page, 40, 470);
    await camera(page, { alpha: -Math.PI / 4 - 0.2, beta: 1.15, radius: 110 });
    await ready(page, 8000);
    await quiet(page);
    await shot(page, "363-3d-a-ragged-coast");

    // the Witness's moves, in the Synod's square
    await on(page, 706, 280);
    await camera(page, { alpha: -Math.PI / 4 + 0.5, beta: 0.85, radius: 12 });
    await ready(page, 3000);
    for (const [anim, t, name] of [
      ["mudra", 0.9, "364-3d-forming-a-daos-seals"],
      ["daovow", 0.85, "365-3d-swearing-on-her-dao"],
      ["envoy", 0.6, "366-3d-presenting-credentials"],
    ] as const) {
      await pose(page, anim, t);
      await page.waitForTimeout(250);
      await pose(page, anim, t);
      await quiet(page);
      await shot(page, name);
    }
  });
});

test.describe("in pixels", () => {
  const enterUntil = async (page: Page, until: () => Promise<boolean>, n = 40) => {
    for (let i = 0; i < n && !(await until()); i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(160);
    }
  };

  test("capture a Dao debate, the Powers page, the journal and the world map", async ({ page }) => {
    test.setTimeout(600_000);
    await startNewGame(page);
    await patch(page, { flags: FLAGS, realm: 3, stage: 2 });
    await timeOfDay(page, 0.3);

    // a Dao debate in the square: a Seat-holder argues the Writ, the grey books answer, and she may speak her own reading
    const q = contentionQuests().find((x) => x.kind === "debate" && x.book === 2 && x.npc!.startsWith("cn-seat-"))!;
    await contentionAt(page, q.id);
    await page.waitForTimeout(800);
    await standBy(page, q.npc!);
    await page.waitForTimeout(900);
    await page.keyboard.press("KeyE");
    await enterUntil(page, () => page.getByTestId("choice").isVisible());
    await quiet(page);
    await shot(page, "367-a-dao-debate");
    for (let i = 0; i < 60 && (await mode(page)) === "scene"; i++) {
      if (await page.getByTestId("choice").isVisible()) await page.getByTestId("choice-2").click({ timeout: 3000 }).catch(() => page.keyboard.press("Enter"));
      else await page.keyboard.press("Enter");
      await page.waitForTimeout(140);
    }

    // the Powers page: the web of every power, how each receives her, and what lies between them
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.getByTestId("menu-tab-powers").click();
    await page.getByTestId("power-yan").click();
    await page.waitForTimeout(400);
    await shot(page, "368-the-powers-of-the-world");
    await page.getByTestId("power-synod").click();
    await page.waitForTimeout(300);
    await shot(page, "369-the-synod-of-ten-seats");
    await page.getByTestId("menu-tab-status").click();
    await page.waitForTimeout(300);
    await shot(page, "370-a-wavering-dao-heart");
    await page.getByTestId("menu-close").click();
    await page.waitForTimeout(400);

    // the journal
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(600);
    await page.getByTestId("journal-contention").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot(page, "371-journal-the-contention-of-the-daos");
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(400);

    // the world map: five continents
    await page.keyboard.press("KeyM");
    await page.waitForTimeout(1500);
    await shot(page, "372-world-map-five-continents");
    await page.keyboard.press("KeyM");
  });
});
