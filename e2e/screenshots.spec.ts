import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { cultivationNeeded } from "../src/game/engine/realms";
import { battle, mode, patch, skipScene, startNewGame, teleport } from "./helpers";

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

  await teleport(page, "sect", 15.5, 10.6);
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
  await teleport(page, "village", 16.5, 11.6);
  await page.waitForTimeout(800);
  await page.keyboard.press("KeyE");
  await sayUntil(page, "seven nights");
  await shot(page, "06-village");
  await skipScene(page);

  await teleport(page, "bamboo", 16.5, 7.7);
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
  await teleport(page, "sect", 7.5, 13.6);
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
  await teleport(page, "village", -12, 37.2);
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(900);
  await shot(page, "17-highway-run");
  await page.keyboard.up("KeyS");
  await page.keyboard.up("KeyD");
  await page.keyboard.up("ShiftLeft");
  await teleport(page, "bamboo", -1.5, 37.3);
  await page.waitForTimeout(1500);
  await shot(page, "18-demonic-seal");
  await teleport(page, "lake", 29.5, 22.5);
  await page.waitForTimeout(1500);
  await shot(page, "19-waterfall");
  if ((await mode(page)) === "scene") await skipScene(page);

  await page.goto("/gallery");
  await page.waitForTimeout(4000);
  await shot(page, "15-gallery");
});
