import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { cultivationNeeded } from "../src/game/engine/realms";
import { newGame } from "../src/game/engine/state";
import { currentWar, syncWarFlags } from "../src/game/story/war";
import { battle, goto, mode, patch, skipScene, standBy, startNewGame, state, teleport, tileOf } from "./helpers";

/** Captures the README / PR screenshots. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.use({ viewport: { width: 1600, height: 900 } });
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });

async function sayUntil(page: Page, text: string, max = 30): Promise<void> {
  for (let i = 0; i < max; i++) {
    const t = await page.evaluate(() => document.querySelector("[data-testid=dialog]")?.textContent ?? "");
    if (t.includes(text)) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1600);
}

test("capture screenshots", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/");
  await page.waitForTimeout(4000);
  await shot(page, "00-title");

  await startNewGame(page, false);
  await page.waitForTimeout(2200);
  await shot(page, "01-opening");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Enter");
  await page.waitForTimeout(3600);
  await shot(page, "02-intro-cutscene");
  await skipScene(page);

  await standBy(page, "elder");
  await page.waitForTimeout(500);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "sworn brother");
  await shot(page, "03-elder-dialogue");
  await skipScene(page);

  await teleport(page, "sect", 18.5, 14.5);
  await page.keyboard.press("KeyF");
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(400);
  await shot(page, "04-sect-sword-flight");
  await page.keyboard.press("KeyF");

  await patch(page, { flags: { metElder: true, villageSaved: true, villageArrived: true, foxesCleared: true, bambooArrived: true }, realm: 0, stage: 2 });
  await page.keyboard.press("KeyM");
  await page.getByTestId("map-village").click();
  await page.waitForTimeout(1800);
  await shot(page, "05-world-map");
  await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await skipScene(page);
  await standBy(page, "zhou");
  await page.waitForTimeout(800);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "seven nights");
  await shot(page, "06-village");
  await skipScene(page);

  await standBy(page, "huli");
  await page.waitForTimeout(700);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "Three hundred years");
  await shot(page, "07-bamboo-fox-maiden");
  await skipScene(page);

  await patch(page, { realm: 1, stage: 1, hp: 330, qi: 160, skills: ["strike", "palm", "lotus", "swords"] });
  await battle(page, "fox");
  await page.waitForTimeout(1100);
  await page.getByTestId("skill-swords").click();
  await page.waitForTimeout(820);
  await shot(page, "08-battle-myriad-swords");
  await page.waitForFunction(() => window.__pixelop!.game.mode !== "battle" || !window.__pixelop!.game.battle?.busy, null, { timeout: 15_000 });
  await page.evaluate(() => window.__pixelop!.game.debugTeleport("lake", 16.5, 20.5));
  await page.waitForTimeout(1200);
  await shot(page, "09-moonlit-lake");

  await patch(page, { realm: 0, stage: 3, cultivation: cultivationNeeded(0, 3) - 2, skills: ["strike", "palm", "lotus"] });
  await standBy(page, "sect-shrine");
  await page.waitForTimeout(400);
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(2600);
  await shot(page, "10-meditation");
  await page.keyboard.press("KeyB");
  await page.waitForTimeout(3000);
  await shot(page, "11-heavenly-tribulation");
  await page.waitForFunction(() => window.__pixelop!.game.mode === "explore", null, { timeout: 20_000 });

  await patch(page, { realm: 2, stage: 2, hp: 600, qi: 250, skills: ["strike", "palm", "lotus", "swords", "thunder"], flags: { metElder: true, villageSaved: true, metZhou: true, foxesCleared: true, metHuli: true, metWen: true, serpentKingDefeated: true, valleyArrived: true } });
  await teleport(page, "valley", 21.5, 12.5);
  await page.waitForTimeout(1200);
  await shot(page, "12-demon-valley");
  await battle(page, "patriarch");
  await page.waitForTimeout(1100);
  await page.getByTestId("skill-thunder").click();
  await page.waitForTimeout(950);
  await shot(page, "13-boss-battle");
  await page.waitForFunction(() => !window.__pixelop!.game.battle?.busy, null, { timeout: 15_000 });

  await patch(page, { flags: { heartReturned: true, peakArrived: true } });
  await teleport(page, "peak", 12.5, 13.5);
  await page.waitForTimeout(1200);
  await shot(page, "14-tribulation-peak");
  if ((await mode(page)) === "scene") await skipScene(page);

  // the continuous world: sky bridge, the highway, a sealed border and the waterfall
  await patch(page, { flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, bambooArrived: true, lakeArrived: true, metHuli: true }, realm: 0, stage: 1 });
  await teleport(page, "sect", 15.2, 29.5);
  await page.waitForTimeout(1500);
  await shot(page, "16-sky-bridge");
  await teleport(page, "sect", 3.5, 132.5); // the old highway below Willow Creek
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(900);
  await shot(page, "17-highway-run");
  await page.keyboard.up("KeyS");
  await page.keyboard.up("KeyD");
  await page.keyboard.up("ShiftLeft");
  await teleport(page, "sect", -99.5, 132.5); // where the red mist seals the valley
  await page.waitForTimeout(1500);
  await shot(page, "18-demonic-seal");
  await teleport(page, "sect", 143.2, 92.6);
  await page.waitForTimeout(1500);
  await shot(page, "19-waterfall");
  if ((await mode(page)) === "scene") await skipScene(page);

  // the new landmarks of the grown world (positions are relative to the sect's corner)
  const visit = async (name: string, x: number, y: number, wait = 1600) => {
    await teleport(page, "sect", x, y);
    await page.waitForTimeout(wait);
    if ((await mode(page)) === "scene") await skipScene(page);
    await shot(page, name);
  };
  await patch(page, { realm: 2, stage: 0, hp: 600, qi: 300, flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, bambooArrived: true, lakeArrived: true, metHuli: true, foxesCleared: true, metWen: true, serpentKingDefeated: true, valleyArrived: true } });
  await visit("20-cloudrest-isle", 15.5, 45.5);
  await visit("21-cloudstep-isles", 39.5, 17.5);
  await visit("22-crossroads-teahouse", -28.5, 140.5);
  await standBy(page, "fang");
  await page.waitForTimeout(400);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "Cloud-mist tea");
  await shot(page, "23-auntie-fang");
  await skipScene(page);
  if ((await mode(page)) === "shop") await page.keyboard.press("Escape");
  await visit("24-watermill", 55.5, 80.5);
  await visit("25-ruined-temple", -72.5, 175.5);
  await visit("26-pagoda-fields", 10.5, 172.5);
  await visit("27-hot-spring", 73.5, 155.5);
  // the bandit camp after dark: the campfire glows
  await page.evaluate(() => (window.__pixelop!.game.clock = 175));
  await page.keyboard.press("KeyF");
  await visit("28-bandit-camp-night", 112.5, 176.5, 1200);
  await page.keyboard.press("KeyF");
  await visit("29-blood-moon-camp", -145.5, 169.5, 1200);
  await page.evaluate(() => (window.__pixelop!.game.clock = 20));
  await battle(page, "bandit");
  await page.waitForTimeout(1100);
  await page.getByTestId("skill-palm").click();
  await page.waitForTimeout(800);
  await shot(page, "30-bandit-battle");
  await page.waitForFunction(() => !window.__pixelop!.game.battle?.busy, null, { timeout: 15_000 });
  await teleport(page, "sect", 15.5, 45.5);
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(1500);
  await shot(page, "31-world-map-grown");
  await page.keyboard.press("Escape");

  await page.goto("/gallery");
  await page.waitForTimeout(4000);
  await shot(page, "15-gallery");
});

test("capture building interiors", async ({ page }) => {
  test.setTimeout(120_000);
  await startNewGame(page);
  await patch(page, { flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, bambooArrived: true }, realm: 0, stage: 2 });
  const enter = (id: string) => page.evaluate((id) => window.__pixelop!.game.debugEnter(id as never), id);
  const nextTo = (key: string, dx: number, dy: number) =>
    page.evaluate(
      ([key, dx, dy]) => {
        const g = window.__pixelop!.game;
        const a = g.world.actor(key as string)!;
        Object.assign(g.world.hero, { x: a.x + (dx as number), y: a.y + (dy as number) });
      },
      [key, dx, dy] as const,
    );

  // the door of the Hall of Clouds, then inside
  const [hi, hj] = await tileOf(page, "door-hall");
  await goto(page, hi + 0.5, hj + 0.5);
  await page.waitForTimeout(1200);
  await shot(page, "32-hall-door");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(1400);
  await shot(page, "33-hall-of-clouds");
  await nextTo("shen", 1, 0);
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "one of ours");
  await shot(page, "34-archivist-shen");
  await skipScene(page);
  await page.waitForTimeout(4800); // let the toasts fade

  await enter("cottage");
  await page.waitForTimeout(1500);
  await shot(page, "35-granny-hua-cottage");

  await enter("teahouse");
  await nextTo("qiao", -1, 0);
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "farm girl");
  await shot(page, "36-teahouse-storyteller");
  await skipScene(page);
  await page.waitForTimeout(4800);

  await enter("mill");
  await page.waitForTimeout(1500);
  await shot(page, "37-watermill-inside");

  await enter("pagoda");
  await nextTo("ming", 1, 0);
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "Little Qiu");
  await shot(page, "38-pagoda-of-seven-lamps");
  await skipScene(page);
});

test("capture the doubled world, its one-to-one buildings and Cloudmane", async ({ page }) => {
  test.setTimeout(180_000);
  await startNewGame(page);
  await patch(page, { realm: 1, stage: 1, hp: 400, qi: 200, flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, bambooArrived: true, lakeArrived: true, metHuli: true, rodeCloudmane: true } });
  const door = async (id: string) => {
    const [i, j] = await tileOf(page, `door-${id}`);
    await goto(page, i + 0.5, j + 0.5);
  };
  const settle = async (ms = 1500) => {
    await page.waitForTimeout(ms);
    if ((await mode(page)) === "scene") await skipScene(page);
  };

  // the same building from outside and in: the room's floor is the building's footprint
  for (const [id, out, inside] of [
    ["hall", "39-hall-outside", "40-hall-inside"],
    ["cottage", "41-cottage-outside", "42-cottage-inside"],
    ["teahouse", "43-teahouse-outside", "44-teahouse-inside"],
  ] as const) {
    await door(id);
    await settle(1800);
    await shot(page, out);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(1600);
    await shot(page, inside);
    await page.evaluate(() => {
      const g = window.__pixelop!.game;
      const d = g.world.def.interacts.find((x) => x.kind === "door")!;
      Object.assign(g.world.hero, { x: d.i + 0.5, y: d.j + 0.5 });
    });
    await page.waitForTimeout(200);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(600);
  }

  // whistle for Cloudmane on the old highway, then gallop east
  await teleport(page, "sect", -6, 131.6);
  await settle(1200);
  await page.evaluate(() => (window.__pixelop!.game.world.hero.dir = 3));
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(420);
  await shot(page, "45-cloudmane-arrives");
  await page.waitForTimeout(900);
  // east along the highway (world +x runs down-right along the screen's 2:1 diagonal), the joystick pushed all the way
  await page.evaluate(() => window.__pixelop!.game.setStick(0.894, 0.447));
  await page.waitForTimeout(1100);
  await shot(page, "46-gallop-highway");
  await page.evaluate(() => window.__pixelop!.game.setStick(0, 0));

  // riding among the wild herd on the highland pastures
  await page.evaluate(() => {
    const g = window.__pixelop!.game;
    const c = g.world.actor("horse-highlands-0")!;
    g.debugGoto(c.x - 2.5, c.y + 2.5);
    g.world.hero.dir = 3;
  });
  await page.keyboard.press("KeyR");
  await settle(2200);
  await shot(page, "47-wild-horses");

  // festival lanterns and a kite over Willow Creek's square, and the temple bell
  await teleport(page, "village", 17.5, 14.5);
  await settle(2000);
  await shot(page, "48-village-lanterns-kite");
  await visit(page, "49-temple-bell", -72.5, 172.5);

  // the doubled world on the map
  await teleport(page, "sect", 15.5, 45.5);
  await settle(600);
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(1500);
  await shot(page, "50-world-map-doubled");
  await page.keyboard.press("Escape");
});

async function visit(page: Page, name: string, x: number, y: number, wait = 1600): Promise<void> {
  await teleport(page, "sect", x, y);
  await page.waitForTimeout(wait);
  if ((await mode(page)) === "scene") await skipScene(page);
  await shot(page, name);
}

/** The Sword Tomb, the Moon-Gazing Pavilion, the orchard, the festival, and Lin Yue's wardrobe. */
test("capture side errands, attire and new landmarks", async ({ page }) => {
  test.setTimeout(240_000);
  await startNewGame(page);
  const flags = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true, lakeArrived: true, metWen: true, yunTeaching: true, huaTea: true };
  await patch(page, { flags, realm: 1, stage: 1 });
  const settle = async (ms = 1500) => {
    await page.waitForTimeout(ms);
    if ((await mode(page)) === "scene") await skipScene(page);
  };
  /** Clear old toasts so each shot shows only its own. */
  const quiet = () => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
  /** Time of day as a fraction of the cycle (0 noon, 0.5 midnight). */
  const timeOfDay = (k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
  const near = (key: string, dx: number, dy: number, dir = 3) =>
    page.evaluate(
      ([key, dx, dy, dir]) => {
        const g = window.__pixelop!.game;
        const n = g.world.def.npcs.find((x) => x.key === key)!;
        g.debugGoto(n.i + 0.5 + (dx as number), n.j + 0.5 + (dy as number));
        g.world.hero.dir = dir as number;
      },
      [key, dx, dy, dir] as const,
    );

  // the Sword Tomb at dusk, Smith Ou at his anvil
  await timeOfDay(0.3);
  await near("ou", -4, -4, 3);
  await settle(1800);
  await quiet();
  await shot(page, "51-sword-tomb");
  await standBy(page, "ou");
  await page.keyboard.press("KeyE");
  await sayUntil(page, "Dawnfrost");
  await shot(page, "52-smith-ou");
  await skipScene(page);

  // the scholar's shade writes by moonlight at the Moon-Gazing Pavilion
  await timeOfDay(0.48);
  await near("pei", 2, 2.5, 10);
  await settle(1800);
  await quiet();
  await shot(page, "53-moon-pavilion");
  await standBy(page, "pei");
  await page.keyboard.press("KeyE");
  await sayUntil(page, "never forgot");
  await shot(page, "54-scholar-pei");
  await skipScene(page);
  await standBy(page, "huli");
  await page.keyboard.press("KeyE");
  await skipScene(page);
  await standBy(page, "pei");
  await page.waitForTimeout(600);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "Wherever I am");
  await shot(page, "55-the-last-line");
  await skipScene(page);

  // the peach orchard in the afternoon
  await timeOfDay(0.18);
  await near("rong", 3, 3, 10);
  await settle(1800);
  await quiet();
  await shot(page, "56-peach-orchard");

  // the wardrobe: the cloud-silk robes on the Cloudstep Isles, the wayfarer's cloak at a gallop, the mail in battle
  await patch(page, { flags: { ...flags, peiMet: true, huliLetter: true, peiAtRest: true, "attire:foxfire": true, "attire:wayfarer": true, "attire:cloudsilk": true, "attire:mail": true }, counters: { attire: 3 } });
  await near("yun", 2, 2.5, 10);
  await settle(1600);
  await quiet();
  await shot(page, "57-attire-cloudsilk");
  await patch(page, { counters: { attire: 1 } });
  await teleport(page, "sect", -6, 131.6);
  await settle(800);
  await page.evaluate(() => (window.__pixelop!.game.world.hero.dir = 3));
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(1300);
  await page.evaluate(() => window.__pixelop!.game.setStick(0.894, 0.447));
  await page.waitForTimeout(900);
  await quiet();
  await shot(page, "58-attire-wayfarer-gallop");
  await page.evaluate(() => window.__pixelop!.game.setStick(0, 0));
  await page.keyboard.press("KeyR");
  await patch(page, { counters: { attire: 4 } });
  await battle(page, "bandit");
  await page.waitForTimeout(1600);
  await page.getByTestId("skill-strike").click();
  await page.waitForTimeout(500);
  await quiet();
  await shot(page, "59-attire-mail-battle");
  await page.evaluate(() => {
    const g = window.__pixelop!.game;
    g.battle = null;
    g.mode = "explore";
  });

  // Willow Creek's lantern festival: everyone in their best, fireworks over the square
  await patch(page, { flags: { ...flags, patriarchDefeated: true, heartReturned: true, "attire:foxfire": true }, counters: { attire: 2 } });
  await timeOfDay(0.45);
  await near("zhou", 1.5, 4.5, 10);
  await page.waitForTimeout(400);
  // Little Mei runs up to her
  await page.evaluate(() => {
    const g = window.__pixelop!.game;
    const m = g.world.actor("mei")!;
    const h = g.world.hero;
    Object.assign(m, { x: h.x - 1, y: h.y - 0.6, target: null, wander: 0 });
    h.dir = 10;
  });
  await page.waitForTimeout(200);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "festival dress");
  await quiet();
  await shot(page, "60-festival-dress");
  await skipScene(page);
  await page.waitForTimeout(400);
  // from the foxfire dress into the festival one, with a twirl
  await patch(page, { counters: { attire: 2 } });
  await page.waitForTimeout(200);
  await page.keyboard.press("KeyC");
  await page.waitForTimeout(300);
  await shot(page, "61-festival-twirl");
  await page.waitForTimeout(1600);
  await near("zhou", 1.5, 3.5, 10);
  await settle(2600);
  await quiet();
  await shot(page, "62-lantern-festival");
});

/** The world doubled again: the far south, the east over the Rainbow Bridge, and a busier town and sect. */
test("capture the doubled world, its new regions and folk", async ({ page }) => {
  test.setTimeout(300_000);
  await startNewGame(page);
  const flags = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true, lakeArrived: true, metWen: true, serpentKingDefeated: true, marshArrived: true, terracesArrived: true, desertArrived: true, harborArrived: true, frostArrived: true, rongGift: true };
  await patch(page, { flags, realm: 1, stage: 2 });
  const settle = async (ms = 1800) => {
    await page.waitForTimeout(ms);
    if ((await mode(page)) === "scene") await skipScene(page);
  };
  const quiet = () => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
  const timeOfDay = (k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
  const near = (key: string, dx: number, dy: number, dir = 3) =>
    page.evaluate(
      ([key, dx, dy, dir]) => {
        const g = window.__pixelop!.game;
        const n = g.world.def.npcs.find((x) => x.key === key)!;
        g.debugGoto(n.i + 0.5 + (dx as number), n.j + 0.5 + (dy as number));
        g.world.hero.dir = dir as number;
      },
      [key, dx, dy, dir] as const,
    );
  const talk = async (key: string, until: string, name: string) => {
    await standBy(page, key);
    await page.waitForTimeout(500);
    await page.keyboard.press("KeyE");
    await sayUntil(page, until);
    await shot(page, name);
    await skipScene(page);
  };
  const at = async (name: string, key: string, dx: number, dy: number, dir = 3, k = 0.15) => {
    await timeOfDay(k);
    await near(key, dx, dy, dir);
    await settle();
    await quiet();
    await shot(page, name);
  };

  // the whole of the new map, from the Rainbow Bridge
  await timeOfDay(0.1);
  const bridge = await page.evaluate(() => {
    const g = window.__pixelop!.game as unknown as { world: { world: { landmarks: { key: string; x: number; y: number }[] } } };
    return g.world.world.landmarks.find((l) => l.key === "rainbow")!;
  });
  await goto(page, bridge.x + 6.5, bridge.y + 0.5);
  await settle(2200);
  await quiet();
  await shot(page, "64-rainbow-bridge");
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(1500);
  await shot(page, "63-world-map-doubled-again");
  await page.keyboard.press("Escape");

  // Willow Creek's market road and the sect's terraces, busier than ever
  await at("65-willow-creek-market", "marketporter", 3, 3, 10);
  await at("66-sect-terraces", "pang", 3, 3.5, 10);
  await at("67-taiji-yard", "qiu", 2, 4, 9);
  await talk("qiu", "door that was never there", "68-elder-qiu-taiji");

  // the far south: the Mistmarsh, the tea terraces, the Yellow Sands
  await at("69-mistmarsh", "ye", 2.5, 3.5, 10, 0.32);
  await talk("ye", "frog", "70-granny-ye");
  await at("71-tea-terraces", "luyu", 2, -6, 2);
  await talk("luyu", "I pour all three", "72-tea-master-lu");
  await at("73-yellow-sands", "batu", 3, 2.5, 10, 0.24);

  // the east: the herders' camp, the harbour, the monastery in the snows
  await at("74-herders-camp", "herder", 3, 3, 10);
  await at("75-wavecrest-harbour", "su", 3, 3.5, 10);
  await talk("hai", "Sea-Swallow", "76-captain-hai");
  await patch(page, { flags: { ...flags, haiMet: true, haiPeach: true } });
  await talk("hai", "Sea-Swallow coat", "77-sea-swallow-coat");
  await at("78-frostveil-monastery", "xuan", 2.5, 5, 9);
  await talk("xuan", "let it go", "79-abbot-xuan");

  // the plum blossom shrine and the red cliffs
  await at("80-plum-blossom-shrine", "yan", 3, 3, 10);
  await timeOfDay(0.42);
  await goto(page, 524 * 2 + 4.5, 400 * 2 + 6.5);
  await settle();
  await quiet();
  await shot(page, "81-red-cliff-hideout");
});

test("capture the three sects, the caves beneath them, and the choices that change the land", async ({ page }) => {
  test.setTimeout(420_000);
  await startNewGame(page);
  let flags: Record<string, boolean> = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true, lakeArrived: true, metWen: true, serpentKingDefeated: true, marshArrived: true, terracesArrived: true, desertArrived: true, harborArrived: true, frostArrived: true, emberMineArrived: true, grottoArrived: true, veinArrived: true };
  const setFlags = async (more: Record<string, boolean>, extra: Record<string, unknown> = {}) => {
    flags = { ...flags, ...more };
    await patch(page, { flags, realm: 2, stage: 1, hp: 600, qi: 300, skills: ["strike", "palm", "lotus", "swords", "thunder"], ...extra });
  };
  await setFlags({});
  const settle = async (ms = 1800) => {
    await page.waitForTimeout(ms);
    if ((await mode(page)) === "scene") await skipScene(page);
  };
  const quiet = () => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
  const timeOfDay = (k: number) => page.evaluate((k) => window.__pixelop!.game.debugSetTime(k), k);
  const near = (key: string, dx: number, dy: number, dir = 3) =>
    page.evaluate(
      ([key, dx, dy, dir]) => {
        const g = window.__pixelop!.game;
        const n = [...g.world.def.npcs, ...g.world.def.interacts].find((x) => x.key === key)!;
        if (g.inside) g.world.placeHero(n.i + 0.5 + (dx as number), n.j + 0.5 + (dy as number), dir as number);
        else g.debugGoto(n.i + 0.5 + (dx as number), n.j + 0.5 + (dy as number));
        g.world.hero.dir = dir as number;
      },
      [key, dx, dy, dir] as const,
    );
  const at = async (name: string, key: string, dx: number, dy: number, dir = 3, k = 0.15) => {
    await timeOfDay(k);
    await near(key, dx, dy, dir);
    await settle();
    await quiet();
    await shot(page, name);
  };
  /** Talk (or read) until a question is put to her, photograph it, then answer it. */
  const ask = async (key: string, name: string, answer: number) => {
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
      if (await page.getByTestId("choice").isVisible()) await page.evaluate(() => window.__pixelop!.game.choose(0));
    }
  };
  const enter = async (id: string) => {
    await page.evaluate((id) => window.__pixelop!.game.debugEnter(id as never), id);
    await settle(1200);
  };
  const landmark = (key: string) =>
    page.evaluate((key) => {
      const g = window.__pixelop!.game as unknown as { world: { world: { landmarks: { key: string; x: number; y: number }[] } } };
      return g.world.world.landmarks.find((l) => l.key === key)!;
    }, key);

  // the mountains, from the foot of the Dragonspine (its cave mouth still buried)
  const spine = await landmark("dragonspine");
  await timeOfDay(0.12);
  await goto(page, spine.x - 8.5, spine.y + 14.5);
  await settle();
  await quiet();
  await shot(page, "82-dragonspine-buried");

  // the Scarlet Phoenix on its mesa: Yan Huo asks how she will answer
  await at("83-phoenix-mesa", "yanhuo", 2.5, 4.5, 9, 0.2);
  await ask("yanhuo", "84-yan-huo-choice", 0);
  await setFlags({ phxMet: true, phxMine: true });
  // down into the Ember Mine, where the miners cower and the wyrm sings
  await enter("emberMine");
  await at("85-ember-mine", "tie", 4, 4, 9);
  await ask("tie", "86-trapped-miners", 1);
  await battle(page, "emberwyrm");
  await page.waitForTimeout(1300);
  await page.getByTestId("skill-thunder").click();
  await page.waitForTimeout(900);
  await shot(page, "87-ember-wyrm-battle");
  await page.evaluate(() => {
    const g = window.__pixelop!.game as unknown as { battle: unknown; mode: string };
    g.battle = null;
    g.mode = "explore";
  });
  await setFlags({ minersFound: true, minersStay: true, wyrmDefeated: true, minersOut: true });
  await enter("emberMine");
  await ask("ember-vein", "88-burning-vein-choice", 1);
  await page.evaluate(() => window.__pixelop!.game.debugGoto(0, 0));
  // fed: the mesa's crown boils over and lava runs down the eastern cliffs
  await setFlags({ "phx:fed": true });
  const mesa = await landmark("phoenix");
  await timeOfDay(0.36);
  await goto(page, mesa.x + 8.5, mesa.y + 10.5);
  await settle(2400);
  await quiet();
  await shot(page, "89-mesa-ablaze");

  // Hundred Herb Valley, withered; the grotto beneath it; Ku Shen at the poisoned spring
  await at("90-herb-valley-withered", "baizhi", 3, 4, 9, 0.18);
  await setFlags({ herbAsk: true });
  await enter("grotto");
  await at("91-sunken-grotto", "kushen", 6, 4, 9);
  await ask("kushen", "92-ku-shen-choice", 1);
  await setFlags({ kuDealt: true, kuSpared: true });
  await ask("grotto-spring", "93-poisoned-spring-choice", 0);
  await setFlags({ "herb:purified": true, herbDone: true });
  await page.evaluate(() => window.__pixelop!.game.debugGoto(0, 0));
  await at("94-herb-valley-blooms", "baizhi", 3, 4, 9, 0.18);

  // the Sword Sea Pavilion on its crag, the thief, and the stair to the Sword Sea
  await at("95-sword-sea-pavilion", "lingfeng", 3, 5, 9, 0.1);
  await setFlags({ swdMet: true, swdClueTang: true, swdClueStair: true });
  await ask("wuyou", "96-jian-wuyou-choice", 1);
  await setFlags({ "swd:mercy": true, swdDone: true, swordStair: true });
  await at("97-stair-to-the-sword-sea", "wuyouSweep", 3, 3, 9, 0.1);

  // the conclave over the Dragon Vein
  await setFlags({ veinOpened: true });
  await enter("vein");
  await at("98-dragon-vein-caverns", "longlao", 3, 7, 9);
  await ask("longlao", "99-the-conclave", 3);
  await setFlags({ "vein:shared": true });
  await page.evaluate(() => window.__pixelop!.game.debugGoto(0, 0));
  // a spring now runs from the Dragonspine, for everyone
  await timeOfDay(0.12);
  await goto(page, spine.x + 6.5, spine.y + 2.5);
  await settle(2400);
  await quiet();
  await shot(page, "100-dragonspine-spring");

  // the new heights: up on the Dragonspine's summit, and among the frost peaks
  const summit = (cx: number, cy: number, r: number) =>
    page.evaluate(
      ([cx, cy, r]) => {
        const m = window.__pixelop!.game.world.def.map;
        let best: [number, number, number] = [cx, cy, -1];
        for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) if (m.standable(i, j) && m.height(i, j) > best[2]) best = [i, j, m.height(i, j)];
        return best;
      },
      [cx, cy, r] as const,
    );
  for (const [name, cx, cy, k] of [
    ["103-dragonspine-summit", 488, 500, 0.12],
    ["104-frost-peaks", 1120, 192, 0.08],
  ] as const) {
    const [i, j] = await summit(cx, cy, 40);
    await timeOfDay(k);
    // stand a little below the summit, so the mountain rises up the screen behind her
    await goto(page, i + 5.5, j + 5.5);
    await settle();
    await quiet();
    await shot(page, name);
  }

  // the journal
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(600);
  await shot(page, "101-journal");
  await page.keyboard.press("KeyJ");
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(1500);
  await shot(page, "102-world-map-mountains");
});

/** The turning year: seasons on the land, day and night, the almanac, the Wardens, the notices and the wardrobe. */
test("capture the turning year, the notices and the wardrobe", async ({ page }) => {
  test.setTimeout(300_000);
  await startNewGame(page);
  const flags = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true, lakeArrived: true, marshArrived: true, terracesArrived: true, harborArrived: true, desertArrived: true, huaTea: true, qingGift: true };
  await patch(page, { flags, realm: 1, stage: 1 });
  const quiet = () => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
  const when = (k: number, season: string) => page.evaluate(([k, s]) => window.__pixelop!.game.debugSetTime(k as number, s as never), [k, season] as const);
  const settle = async (ms = 1800) => {
    // long enough for the season's banner to fade
    await page.waitForTimeout(Math.max(ms, 4000));
    if ((await mode(page)) === "scene") await skipScene(page);
    await quiet();
  };
  const village = async (lx: number, ly: number) => {
    await teleport(page, "village", lx, ly);
    await page.evaluate(() => (window.__pixelop!.game.world.hero.dir = 3));
  };

  // the same square of Willow Creek through the year
  for (const [name, k, season] of [
    ["105-spring-village", 0.05, "spring"],
    ["106-summer-village", 0.08, "summer"],
    ["107-autumn-village", 0.06, "autumn"],
    ["108-winter-village", 0.04, "winter"],
  ] as const) {
    await when(k, season);
    await village(16, 15);
    await settle(2200);
    await shot(page, name);
  }
  // the hours: golden dawn, lanterns at night, a summer shower
  await when(0.76, "autumn");
  await village(15, 12);
  await settle(2200);
  await shot(page, "109-dawn-golden-hour");
  await when(0.5, "spring");
  await village(15, 12);
  await settle(3500);
  await shot(page, "110-night-lanterns");
  // a rainy summer afternoon
  await teleport(page, "terraces", 16, 18);
  await page.evaluate(() => window.__pixelop!.game.debugShower());
  await settle(2200);
  await shot(page, "111-summer-shower");

  // the almanac master and his sundial
  await when(0.1, "spring");
  await standBy(page, "almanac");
  await page.keyboard.press("KeyE");
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);
  await shot(page, "112-almanac-master");
  await skipScene(page);
  await standBy(page, "almanac-dial");
  await page.keyboard.press("KeyE");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  await shot(page, "113-sundial-almanac");
  await page.getByTestId("choice-3").click();
  await settle(600);

  // the Wardens: Lady Qingming at the plum shrine at dawn, Old Dongzhi at the hot spring in the night
  const toLandmark = (key: string, dx: number, dy: number) =>
    page.evaluate(
      ([key, dx, dy]) => {
        const g = window.__pixelop!.game;
        const w = (g.world as unknown as { world: { landmarks: { key: string; x: number; y: number }[]; map: { standable: (i: number, j: number) => boolean } } }).world;
        const l = w.landmarks.find((x) => x.key === key)!;
        for (let r = 0; r < 10; r++)
          for (const [a, b] of [
            [dx as number, dy as number],
            [(dx as number) + r, dy as number],
            [dx as number, (dy as number) + r],
            [(dx as number) - r, dy as number],
          ])
            if (w.map.standable(l.x + a, l.y + b)) return g.debugGoto(l.x + a + 0.5, l.y + b + 0.5);
      },
      [key, dx, dy] as const,
    );
  await patch(page, { flags: { ...flags, yearMet: true, "yr:swept": true } });
  await when(0.76, "spring");
  await toLandmark("plum", 3, 3);
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1500);
  await shot(page, "114-warden-of-spring");
  await skipScene(page);
  await patch(page, { flags: { ...flags, yearMet: true, "woke:spring": true, "woke:summer": true, "woke:autumn": true, "yr:tangyuan": true, "attire:springblossom": true } });
  await when(0.5, "winter");
  await toLandmark("spring", 3, 3);
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1500);
  await shot(page, "115-warden-of-winter");
  await skipScene(page);

  // a favour asked: the notice scroll, the choice, the journal
  await when(0.08, "autumn");
  await standBy(page, "abao");
  await page.waitForTimeout(1500);
  await shot(page, "116-notice-scrolls");
  await page.keyboard.press("KeyE");
  for (let i = 0; i < 20 && !(await page.getByTestId("choice").isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(600);
  await shot(page, "117-notice-offer");
  await page.getByTestId("choice-0").click();
  await settle(1200);
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(600);
  await shot(page, "118-journal-notices");
  await page.keyboard.press("KeyJ");

  // the wardrobe, and Lin Yue in the raiment of the four seasons in the snow
  await patch(page, { flags: { ...flags, yearMet: true, yearTurned: true, "attire:springblossom": true, "attire:summerlotus": true, "attire:autumnmaple": true, "attire:wintersnow": true, "attire:fourseasons": true, "attire:ranger": true, "attire:wayfarer": true } });
  await page.keyboard.press("KeyV");
  await page.waitForTimeout(600);
  await shot(page, "119-wardrobe");
  await page.getByTestId("wear-fourseasons").click();
  await page.keyboard.press("KeyV");
  await when(0.04, "winter");
  await village(17, 9);
  await settle(2200);
  await shot(page, "120-four-seasons-raiment");
  await patch(page, { counters: { ...(await state(page)).counters, attire: 14 } });
  await when(0.08, "winter");
  await teleport(page, "frost", 16, 16);
  await settle(2400);
  await shot(page, "121-snow-fox-cloak-frostveil");
  await patch(page, { counters: { ...(await state(page)).counters, attire: 13 } });
  await when(0.07, "autumn");
  await teleport(page, "bamboo", 14, 22);
  await settle(2400);
  await shot(page, "122-autumn-maple-robe");
});

/** The branching tale: three beginnings, Xue's altar, the Heart's fate, Elder Mo, the endings and the land they leave. */
test("capture the three beginnings, the Heart's fate and the endings", async ({ page }) => {
  test.setTimeout(300_000);
  const quiet = () => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
  const settle = async (ms = 2400) => {
    await page.waitForTimeout(ms);
    if ((await mode(page)) === "scene") await skipScene(page);
    await quiet();
  };
  const noon = () => page.evaluate(() => window.__pixelop!.game.debugSetTime(0.06, "spring"));
  const enterUntil = async (pred: () => Promise<boolean>, max = 40) => {
    for (let i = 0; i < max && !(await pred()); i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(900);
  };
  const choiceUp = () => page.getByTestId("choice").isVisible();
  const dialogHas = (t: string) => async () => ((await page.evaluate(() => document.querySelector("[data-testid=dialog]")?.textContent ?? "")) as string).includes(t);
  const wear = (id: string) => page.evaluate((id) => window.__pixelop!.game.wear(id), id);

  // the title screen asks where her tale begins
  await page.goto("/");
  await page.waitForTimeout(2500);
  await page.getByTestId("new-game").click();
  await page.waitForTimeout(2200);
  await shot(page, "123-origin-picker");

  // the foundling wakes in Willow Creek to Granny Hua
  await page.getByTestId("origin-foundling").click();
  await page.waitForFunction(() => !!window.__pixelop?.game);
  for (let i = 0; i < 4; i++) await page.keyboard.press("Enter");
  await enterUntil(dialogHas("persimmon"));
  await page.waitForTimeout(1200);
  await shot(page, "124-foundling-granny-hua");
  await skipScene(page);

  // the runaway at the sect gate, and what she gives Elder Mo
  await startNewGame(page, false, "defector");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Enter");
  await enterUntil(dialogHas("sharp"));
  await page.waitForTimeout(1200);
  await shot(page, "125-defector-at-the-gate");
  await skipScene(page);
  await noon();
  await standBy(page, "elder");
  await page.keyboard.press("KeyE");
  await enterUntil(choiceUp);
  await shot(page, "126-defector-swears-or-tells");
  await page.getByTestId("choice-1").click();
  await settle();

  // Xue's altar, from a disciple who knows where he came from: four answers, one without a fight
  await startNewGame(page);
  const base = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true, metWen: true, lakeArrived: true, serpentKingDefeated: true, valleyArrived: true, shenLore: true, ouMet: true, huaTea: true };
  await patch(page, { flags: base, realm: 1, stage: 2, skills: ["strike", "palm", "lotus", "swords"] });
  await noon();
  await standBy(page, "patriarch");
  await page.waitForTimeout(1800);
  // walk right up to him: touching him is what starts the confrontation
  await page.evaluate(() => {
    const g = window.__pixelop!.game;
    const x = g.world.actor("patriarch")!;
    Object.assign(g.world.hero, { x: x.x - 0.3, y: x.y + 0.3 });
  });
  await enterUntil(choiceUp);
  await shot(page, "127-xue-four-answers");
  await page.getByTestId("choice-3").click();
  await enterUntil(dialogHas("Take it"));
  await page.waitForTimeout(800);
  await shot(page, "128-xue-lays-down-the-heart");
  await enterUntil(choiceUp, 60);
  await shot(page, "129-the-hearts-fate");
  await page.getByTestId("choice-1").click();
  await enterUntil(async () => (await mode(page)) !== "scene", 60);
  await settle();
  await page.evaluate(() => (window.__pixelop!.game.world.hero.dir = 2));
  await page.waitForTimeout(1500);
  await shot(page, "130-the-lotus-takes-root");

  // Xue Ming at the Sword Tomb, oiling the swords of the fallen
  await standBy(page, "xueming");
  await page.waitForTimeout(1200);
  await page.keyboard.press("KeyE");
  await enterUntil(dialogHas("oil"));
  await shot(page, "131-xue-ming-at-the-sword-tomb");
  await skipScene(page);

  // the crimson road: the Heart drunk, the bamboo blighted, Elder Mo faced
  const crimson = { ...base, patriarchDefeated: true, "heart:devoured": true, "attire:bloodmoon": true, dawnfrost: true };
  await patch(page, { flags: crimson, realm: 3, stage: 1 });
  await wear("bloodmoon");
  await teleport(page, "bamboo", 15, 20);
  await page.evaluate(() => window.__pixelop!.game.toggleFly());
  await settle(3000);
  await page.evaluate(() => window.__pixelop!.game.toggleFly());
  await page.waitForTimeout(800);
  await shot(page, "132-blood-moon-over-the-bamboo");
  await teleport(page, "village", 16, 15);
  await settle(3000);
  await shot(page, "133-blood-moon-over-willow-creek");
  await noon();
  await standBy(page, "elder");
  await page.keyboard.press("KeyE");
  await enterUntil(async () => (await mode(page)) === "battle", 30);
  await page.waitForTimeout(2600);
  await shot(page, "134-elder-mo-battle");
  await patch(page, { flags: { ...crimson, moBroken: true } });
  await page.evaluate(() => window.__pixelop!.game.debugTeleport("sect", 14, 14));
  await settle(3000);
  await page.evaluate(() => (window.__pixelop!.game.world.hero.dir = 6));
  await page.waitForTimeout(900);
  await shot(page, "135-the-hall-of-clouds-scorched");

  // heaven's stair, and the choice at the very end
  const home = { ...base, patriarchDefeated: true, "heart:home": true, heartReturned: true, festivalSeen: true, peakArrived: true };
  await patch(page, { flags: home, realm: 4, stage: 3, cultivation: cultivationNeeded(4, 3) });
  await wear("jade");
  await standBy(page, "peak-altar");
  await page.keyboard.press("KeyE");
  await enterUntil(async () => (await mode(page)) === "meditate", 10);
  await page.keyboard.press("KeyB");
  await page.waitForFunction(() => window.__pixelop!.game.mode === "scene", undefined, { timeout: 40_000 });
  await enterUntil(choiceUp, 10);
  await shot(page, "136-heavens-stair");
  await page.getByTestId("choice-1").click();
  await enterUntil(async () => (await mode(page)) !== "scene", 20);
  await settle();
  await teleport(page, "peak", 12, 16);
  await settle(2500);
  await shot(page, "137-guardian-of-the-jianghu");

  // the shapes she may take now
  await patch(page, { flags: { ...home, ascended: true, "ending:guardian": true, peiAtRest: true, "attire:dragonform": true, "attire:xuerobe": true, "attire:lotusqueen": true, "attire:homespun": true, "attire:acolyte": true, "attire:teacher": true, "attire:bloodmoon": true, "attire:guardian": true } });
  await teleport(page, "bamboo", 16, 8);
  await settle(2500);
  await standBy(page, "huli");
  await page.keyboard.press("KeyE");
  await enterUntil(dialogHas("Nine tails"), 40);
  await shot(page, "138-nine-tailed-form");
  await skipScene(page);
  await page.keyboard.press("KeyV");
  await page.waitForTimeout(800);
  await shot(page, "139-wardrobe-forms");
  await page.keyboard.press("KeyV");
  await wear("dragonform");
  await teleport(page, "village", 17, 9);
  await settle(2500);
  await page.evaluate(() => (window.__pixelop!.game.world.hero.dir = 2));
  await page.waitForTimeout(900);
  await shot(page, "140-dragon-blood-form");
});

/** The War of the Iron Banner: the muster, the burning fronts, the camps and the refugees, a Dao dilemma, a captain's fate, and the land her Dao leaves. */
test("capture the War of the Iron Banner and the Dao", async ({ page }) => {
  test.setTimeout(300_000);
  const quiet = () => page.evaluate(() => ((window.__pixelop!.game as unknown as { toasts: unknown[] }).toasts = []));
  const settle = async (ms = 2400) => {
    await page.waitForTimeout(ms);
    if ((await mode(page)) === "scene") await skipScene(page);
    await quiet();
  };
  const noon = () => page.evaluate(() => window.__pixelop!.game.debugSetTime(0.06, "summer"));
  const enterUntil = async (pred: () => Promise<boolean>, max = 40) => {
    for (let i = 0; i < max && !(await pred()); i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(900);
  };
  const choiceUp = () => page.getByTestId("choice").isVisible();
  const dialogHas = (t: string) => async () => ((await page.evaluate(() => document.querySelector("[data-testid=dialog]")?.textContent ?? "")) as string).includes(t);
  const open = { metElder: true, villageSaved: true, villageArrived: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true, metWen: true, lakeArrived: true, serpentKingDefeated: true, marshArrived: true, terracesArrived: true, harborArrived: true, desertArrived: true, frostArrived: true, valleyArrived: true };
  /** Put the war at quest n, with the given Dao and realm, and let the land and the folk catch up. */
  const warAt = async (n: number, dao: Record<string, number> = {}, level: [number, number] = [1, 2], extra: Record<string, boolean> = {}) => {
    const g = syncWarFlags({ ...newGame(), flags: { ...open, ...extra }, counters: { war: n, ...Object.fromEntries(Object.entries(dao).map(([k, v]) => [`dao:${k}`, v])) } });
    await patch(page, { flags: g.flags, counters: g.counters, realm: level[0], stage: level[1], hp: 2000, qi: 900, skills: ["strike", "palm", "lotus", "swords", "thunder"] });
    await noon();
    return g;
  };
  /** Stand beside the first prop of a kind that a flag set shows, in a region. */
  const nearProp = (id: string, flags: Record<string, boolean>, region: string, dx = 2, dy = 3) =>
    page.evaluate(
      ([id, flags, region, dx, dy]) => {
        const g = window.__pixelop!.game;
        const p = g.world.def.props.find((q) => q.id === id && q.when?.(flags as Record<string, boolean>) && g.world.regionAt(q.i + 0.5, q.j + 0.5) === region);
        if (!p) throw new Error(`no ${id} in ${region}`);
        g.debugGoto(p.i + (dx as number) + 0.5, p.j + (dy as number) + 0.5);
      },
      [id, flags, region, dx, dy] as const,
    );
  const win = async () => {
    for (let i = 0; i < 40 && (await mode(page)) === "battle"; i++) {
      const thunder = page.getByTestId("skill-thunder");
      if (await thunder.isEnabled().catch(() => false)) await thunder.click().catch(() => undefined);
      await page.waitForTimeout(900);
    }
  };

  await startNewGame(page);
  await warAt(0);
  await teleport(page, "village", 16, 16);
  await settle();
  // General Yue raises her standard in Willow Creek
  await standBy(page, "yue-village");
  await page.waitForTimeout(600);
  await page.keyboard.press("KeyE");
  await enterUntil(dialogHas("Yue Wushuang"), 20);
  await shot(page, "141-general-yue-wushuang");
  await enterUntil(async () => (await mode(page)) !== "scene", 40);
  await settle(1800);
  await standBy(page, "bao-village");
  await settle(1800);
  await shot(page, "142-the-northern-army-camps-at-willow-creek");
  await nearProp("warfire", { "war:village": true }, "village", 2, 2);
  await settle(1800);
  await shot(page, "143-willow-creek-burns");

  // cultivation tells: a raider falters before a cultivator far above him
  await battle(page, "raider");
  await page.waitForTimeout(1600);
  await shot(page, "144-a-raider-falters-before-her-aura");
  await win();
  await settle();

  // a Dao dilemma
  const dg = await warAt(9);
  const asker = currentWar(dg)!.npc!;
  await standBy(page, asker);
  await page.waitForTimeout(600);
  await page.keyboard.press("KeyE");
  await enterUntil(choiceUp, 20);
  await shot(page, "145-a-dao-dilemma");
  await page.getByTestId("choice-0").click();
  await enterUntil(async () => (await mode(page)) !== "scene", 30);
  await settle();

  // the journal: the war's ten fronts, and the Dao heart
  await warAt(342, { mercy: 14, sword: 5, balance: 2 }, [1, 3], { "scar:village:mercy": true, "scar:bamboo:sword": true, "scar:lake:mercy": true });
  await settle(1200);
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(900);
  await shot(page, "146-journal-the-war-and-the-dao-heart");
  await page.keyboard.press("KeyJ");

  // those who know her speak of the Dao she walks
  await teleport(page, "sect", 15.5, 14.5);
  await settle();
  await standBy(page, "elder");
  await page.waitForTimeout(600);
  await page.keyboard.press("KeyE");
  await enterUntil(dialogHas("pain"), 20);
  await shot(page, "147-elder-mo-on-the-dao-of-compassion");
  await skipScene(page);

  // the refugee camp in Willow Creek while the marsh burns
  await teleport(page, "village", 16, 16);
  await settle();
  await standBy(page, "gu");
  await settle(2000);
  await shot(page, "148-the-refugee-camp-at-willow-creek");

  // the marsh at war, its camp and picket and the horde's banners
  await standBy(page, "spear-marsh-3");
  await settle(2200);
  await shot(page, "149-the-picket-line-in-the-mistmarsh");

  // a captain's fate
  await warAt(99, {}, [4, 3]);
  await battle(page, "borte");
  await page.waitForTimeout(1500);
  await win();
  await enterUntil(choiceUp, 30);
  await shot(page, "150-the-captains-fate");
  await page.getByTestId("choice-0").click();
  await enterUntil(async () => (await mode(page)) !== "scene", 40);
  await settle();
  await nearProp("peachtree", { "scar:village:mercy": true }, "village", 2, 2);
  await settle(2200);
  await shot(page, "151-willow-creek-healed-by-mercy");

  // what other Daos leave: steles for the sword, grey ash for slaughter
  await warAt(400, { sword: 30 }, [2, 3], { "scar:bamboo:sword": true, "scar:lake:slaughter": true, "scar:marsh:balance": true });
  await nearProp("warmemorial", { "scar:bamboo:sword": true }, "bamboo", 2, 2);
  await settle(2200);
  await shot(page, "152-the-bamboo-steles-of-the-sword");
  await nearProp("deadtree", { "scar:lake:slaughter": true }, "lake", 2, 2);
  await settle(2200);
  await shot(page, "153-the-lake-scarred-by-slaughter");

  // the siege of the Azure Cloud, and the Khan himself
  await warAt(999, { balance: 40 }, [4, 3], { "attire:bannergeneral": true });
  await page.evaluate(() => window.__pixelop!.game.wear("bannergeneral"));
  await teleport(page, "sect", 15.5, 14.5);
  await settle();
  await standBy(page, "yue-sect");
  await settle(2200);
  await shot(page, "154-the-siege-of-the-azure-cloud");
  await battle(page, "tuoba");
  await page.waitForTimeout(1800);
  await shot(page, "155-tuoba-hong-khan-of-the-iron-banner");
});
