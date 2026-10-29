import { expect, test } from "@playwright/test";
import { battle, mode, patch, startNewGame, state } from "./helpers";

test.describe("The game menu", () => {
  test("Esc opens it over a world that stands still, and every tab has something to show", async ({ page }) => {
    await startNewGame(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("game-menu")).toBeVisible();
    await expect(page.getByTestId("menu-status")).toContainText("Qi Condensation");
    // she does not walk off while the menu is up
    const s0 = await state(page);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyD");
    const s1 = await state(page);
    expect(Math.hypot(s1.x - s0.x, s1.y - s0.y)).toBeLessThan(0.05);
    for (const tab of ["skills", "bag", "bestiary", "people", "places", "settings", "controls"]) {
      await page.getByTestId(`menu-tab-${tab}`).click();
      await expect(page.getByTestId(`menu-${tab}`)).toBeVisible();
    }
    await page.getByTestId("menu-tab-places").click();
    await expect(page.getByTestId("place-sect")).toContainText("you are here");
    await expect(page.getByTestId("place-valley")).toContainText("Sealed");
    await page.getByTestId("menu-tab-skills").click();
    await expect(page.getByTestId("menu-skill-strike")).toContainText("Azure Sword Strike");
    // → pages through the tabs
    await page.getByTestId("menu-tab-status").click();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("menu-skills")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("game-menu")).toBeHidden();
    expect(await mode(page)).toBe("explore");
  });

  test("the bag uses pills, and the bestiary and the book of people fill as she meets them", async ({ page }) => {
    await startNewGame(page);
    await patch(page, { hp: 10, realm: 2, stage: 0, qi: 200 });
    await page.getByTestId("menu-button").click();
    await page.getByTestId("menu-tab-bag").click();
    const pills = (await state(page)).pills.heal;
    await page.getByTestId("menu-use-heal").click();
    await expect.poll(async () => (await state(page)).pills.heal).toBe(pills - 1);
    expect((await state(page)).hp).toBeGreaterThan(10);
    await page.getByTestId("menu-close").click();

    await battle(page, "fox");
    await expect(page.getByTestId("battle")).toContainText("Fox Spirit");
    const skill = page.getByTestId("skill-palm");
    for (let i = 0; i < 30 && (await mode(page)) === "battle"; i++) {
      if (await skill.isEnabled().catch(() => false)) await skill.click().catch(() => undefined);
      await page.waitForTimeout(400);
    }
    await expect.poll(() => page.evaluate(() => window.__pixelop!.game.state.counters["slain:fox"] ?? 0), { timeout: 15_000 }).toBe(1);
    for (let i = 0; i < 40 && (await mode(page)) === "scene"; i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(80);
    }
    await page.keyboard.press("Tab");
    await page.getByTestId("menu-tab-bestiary").click();
    await expect(page.getByTestId("beast-fox")).toContainText("Bested × 1");
    await page.keyboard.press("Escape");

    // speak with Elder Mo, and he joins the book of people
    await page.evaluate(() => {
      const g = window.__pixelop!.game;
      const e = g.world.def.npcs.find((n) => n.key === "elder")!;
      g.debugGoto(e.i + 1.5, e.j + 0.5);
    });
    await page.keyboard.press("KeyE");
    await expect(page.getByTestId("dialog")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__pixelop!.game.state.counters["met:elder"] ?? 0)).toBeGreaterThan(0);
  });
});
