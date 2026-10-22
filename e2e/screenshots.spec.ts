import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { cultivationNeeded } from "../src/game/engine/realms";
import { battle, patch, startNewGame, teleport } from "./helpers";

/** Captures the README / PR screenshots. Run with `npm run screenshots`. */
const DIR = "docs/screenshots";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs screenshots");
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

const shot = (page: Page, name: string) => page.getByTestId(name === "title" ? "title-screen" : "game-stage").screenshot({ path: `${DIR}/${name}.png` });

test("capture screenshots", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.waitForTimeout(2500);
  await shot(page, "title");

  await startNewGame(page);
  await teleport(page, "sect", 330);
  await page.waitForTimeout(400);
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(700);
  await shot(page, "01-sect-elder-dialog");
  for (let i = 0; i < 6 && (await page.getByTestId("dialog").count()); i++) await page.keyboard.press("Enter");

  await teleport(page, "sect", 520);
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await shot(page, "02-alchemy-shop");
  await page.keyboard.press("Escape");

  await teleport(page, "bamboo", 300);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await shot(page, "03-bamboo-forest");

  await patch(page, { realm: 1, stage: 1, hp: 330, qi: 120 });
  await battle(page, "fox");
  await page.waitForTimeout(900);
  await page.getByTestId("skill-swords").click();
  await page.waitForTimeout(820);
  await page.screenshot({ path: `${DIR}/04-battle-myriad-swords.png` });
  await page.waitForTimeout(2500);

  await teleport(page, "lake", 640);
  await page.keyboard.press("KeyF");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(700);
  await page.keyboard.up("ArrowRight");
  await shot(page, "05-lotus-lake-flying");
  await page.keyboard.press("KeyF");

  await patch(page, { realm: 0, stage: 3, cultivation: cultivationNeeded(0, 3) - 1 });
  await teleport(page, "lake", 1000);
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(2200);
  await shot(page, "06-meditation");
  await page.keyboard.press("KeyB");
  await page.waitForTimeout(3100);
  await shot(page, "07-heavenly-tribulation");
  await page.waitForTimeout(3000);
  await shot(page, "08-breakthrough");
  await page.waitForTimeout(3000);

  await patch(page, { realm: 2, stage: 2, hp: 600, qi: 250 });
  await teleport(page, "demon", 1700);
  await page.waitForTimeout(500);
  await shot(page, "09-demon-valley");
  await battle(page, "patriarch");
  await page.waitForTimeout(900);
  await page.getByTestId("skill-palm").click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/10-boss-battle.png` });

  await page.goto("/gallery");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DIR}/11-gallery.png` });
});
