import { expect, test, type Page } from "@playwright/test";
import { battle, goto, mode, patch, standBy, startNewGame, state, teleport, tileOf } from "./helpers";

async function finishDialogue(page: Page, timeout = 20_000): Promise<void> {
  const end = Date.now() + timeout;
  while (Date.now() < end && (await mode(page)) === "scene") {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(80);
  }
}

test.describe("Jade Lotus Ascension", () => {
  test("title screen fills the viewport and the API is healthy", async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Jade Lotus Ascension/ })).toBeVisible();
    await expect(page.getByTestId("new-game")).toBeEnabled();
    const box = await page.locator("canvas").first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(1280);
    expect(box!.height).toBeGreaterThanOrEqual(800);
    const health = await request.get("/api/health");
    expect(health.ok()).toBe(true);
    expect(await health.json()).toMatchObject({ ok: true });
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test("the opening narration plays and the heroine walks the isometric sect", async ({ page }) => {
    await startNewGame(page, false);
    await expect(page.getByTestId("narration")).toContainText("Azure Cloud Sect");
    await page.getByTestId("skip").click();
    await expect.poll(() => mode(page)).toBe("explore");
    await expect(page.getByTestId("realm")).toHaveText(/Qi Condensation · Early/);
    await expect(page.getByTestId("quest")).toContainText("Elder Mo");
    const s0 = await state(page);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(700);
    await page.keyboard.up("KeyD");
    const s1 = await state(page);
    expect(Math.hypot(s1.x - s0.x, s1.y - s0.y)).toBeGreaterThan(0.8);
  });

  test("Elder Mo's briefing advances the story and unlocks the world map", async ({ page }) => {
    await startNewGame(page);
    await standBy(page, "elder");
    await expect(page.getByTestId("prompt")).toContainText("Elder Mo");
    await page.keyboard.press("KeyE");
    await expect(page.getByTestId("dialog")).toContainText("You heard the bells");
    await expect(page.getByTestId("portrait")).toBeVisible();
    await finishDialogue(page);
    expect((await state(page)).flags.metElder).toBe(true);
    await expect(page.getByTestId("quest")).toContainText("Willow Creek");

    await page.keyboard.press("KeyM");
    await expect(page.getByTestId("worldmap")).toBeVisible();
    await expect(page.getByTestId("map-bamboo")).toBeDisabled();
    await page.getByTestId("map-village").click();
    await expect.poll(() => page.evaluate(() => window.__pixelop!.game.worldMap?.travelling ?? false)).toBe(false);
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).area).toBe("village");
  });

  test("one continuous world: walk down the sky bridge from the sect into the village", async ({ page }) => {
    await startNewGame(page);
    await patch(page, { flags: { metElder: true, villageArrived: true } });
    await teleport(page, "sect", 15.5, 25.5);
    await page.evaluate(() => window.__pixelop!.game.setStick(-0.8, 0.4));
    await expect.poll(async () => (await state(page)).area, { timeout: 40_000 }).toBe("village");
    await page.evaluate(() => window.__pixelop!.game.setStick(0, 0));
    await expect(page.getByText("Willow Creek Village").first()).toBeVisible();
  });

  test("whistle for Cloudmane and gallop: faster than the flying sword", async ({ page }) => {
    await startNewGame(page);
    await patch(page, { flags: { metElder: true } });
    await page.getByTestId("ride").click();
    await expect(page.getByTestId("ride")).toContainText("Dismount");
    await expect.poll(() => page.evaluate(() => window.__pixelop!.game.world.hero.char)).toBe("rider");
    const s0 = await state(page);
    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(600);
    await page.keyboard.up("KeyS");
    await page.keyboard.up("ShiftLeft");
    const s1 = await state(page);
    expect(Math.hypot(s1.x - s0.x, s1.y - s0.y)).toBeGreaterThan(4);
    await page.keyboard.press("KeyR");
    await expect(page.getByTestId("ride")).toContainText("Ride");
  });

  test("a battle can be fought and won", async ({ page }) => {
    await startNewGame(page);
    await patch(page, { realm: 2, stage: 0, hp: 400, qi: 200 });
    await battle(page, "fox");
    await expect(page.getByTestId("battle")).toContainText("Fox Spirit");
    const skill = page.getByTestId("skill-palm");
    for (let i = 0; i < 30 && (await mode(page)) === "battle"; i++) {
      if (await skill.isEnabled().catch(() => false)) await skill.click().catch(() => undefined);
      await page.waitForTimeout(400);
    }
    await expect.poll(() => page.evaluate(() => window.__pixelop!.game.state.kills), { timeout: 15_000 }).toBe(1);
  });

  test("the grown world: tea and pills at the crossroads teahouse", async ({ page }) => {
    await startNewGame(page);
    await patch(page, { hp: 10, flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, bambooArrived: true } });
    // the crossroads lie far south of the sect, below the old highway
    await standBy(page, "fang");
    await expect(page.getByText("Crossroads Teahouse").first()).toBeVisible();
    await page.keyboard.press("KeyE");
    await expect(page.getByTestId("dialog")).toContainText("Fang", { timeout: 5_000 });
    // Enter mid-line shows the whole line at once, and it stays shown (it used to re-type over the skip)
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await expect(page.getByTestId("dialog").locator(".ghost")).toHaveText("");
    await expect(page.getByTestId("dialog")).toContainText("Everyone who walks the highway stops at Fang's sooner or later.");
    for (let i = 0; i < 20 && (await mode(page)) === "scene"; i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
    }
    await expect(page.getByTestId("shop")).toBeVisible();
    expect((await state(page)).flags.fangTea).toBe(true);
    await page.getByTestId("shop-close").click();
    await expect.poll(() => mode(page)).toBe("explore");
  });

  test("step inside the crossroads teahouse, hear the storyteller, and walk back out", async ({ page }) => {
    await startNewGame(page);
    await patch(page, { flags: { metElder: true } });
    // the teahouse door, on the step in front of its open front
    const [di, dj] = await tileOf(page, "door-teahouse");
    await goto(page, di + 0.5, dj + 0.5);
    await expect(page.getByTestId("prompt")).toContainText("Enter the Crossroads Teahouse");
    await page.keyboard.press("KeyE");
    await expect(page.getByTestId("place")).toContainText("Crossroads Teahouse");
    await expect.poll(() => page.evaluate(() => window.__pixelop!.game.inside)).toBe("teahouse");
    await page.evaluate(() => {
      const g = window.__pixelop!.game;
      const qiao = g.world.actor("qiao")!;
      Object.assign(g.world.hero, { x: qiao.x - 1, y: qiao.y });
    });
    await expect(page.getByTestId("prompt")).toContainText("Storyteller Qiao");
    await page.keyboard.press("KeyE");
    await expect(page.getByTestId("dialog")).toContainText("Qiao");
    await finishDialogue(page);
    expect((await state(page)).flags.qiaoTale).toBe(true);
    const [ei, ej] = await tileOf(page, "teahouse-exit");
    await page.evaluate(([x, y]) => Object.assign(window.__pixelop!.game.world.hero, { x, y }), [ei + 0.5, ej + 0.5]);
    await expect(page.getByTestId("prompt")).toContainText("Step outside");
    await page.keyboard.press("KeyE");
    await expect.poll(() => page.evaluate(() => window.__pixelop!.game.inside)).toBeNull();
    await expect(page.getByTestId("place")).not.toContainText("Teahouse");
  });

  test("progress is saved server-side and can be continued", async ({ page }) => {
    await startNewGame(page);
    await patch(page, { stones: 4242 });
    await page.getByTestId("save").click();
    await expect(page.getByTestId("save-status")).toContainText("Saved");
    await page.reload();
    const cont = page.getByTestId("continue");
    await expect(cont).toBeEnabled();
    await cont.click();
    await expect(page.getByTestId("stones")).toContainText("4242");
    await page.goto("/");
    await expect(page.getByTestId("leaderboard")).toContainText("Lin Yue");
  });

  test("a side errand shows under the quest, and C changes her attire", async ({ page }) => {
    await startNewGame(page);
    await patch(page, { flags: { metElder: true, peiMet: true, "attire:wayfarer": true } });
    await expect(page.getByTestId("errand")).toContainText("Hu Li");
    await expect(page.getByTestId("attire")).toBeVisible();
    await page.keyboard.press("KeyC");
    await expect.poll(async () => (await state(page)).counters.attire).toBe(1);
    await expect(page.getByTestId("attire")).toHaveAttribute("title", "Wayfarer's Cloak");
    // browser shortcuts are left to the browser
    await page.keyboard.press("Control+KeyC");
    await page.keyboard.press("Control+KeyF");
    expect((await state(page)).counters.attire).toBe(1);
    expect(await page.evaluate(() => window.__pixelop!.game.flying)).toBe(false);
  });

  test("the gallery animates every character, prop and region", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/gallery");
    await expect(page.getByRole("heading", { name: "Pixel Art Gallery" })).toBeVisible();
    await expect(page.locator("[data-testid^=sheet-]")).toHaveCount(40);
    await expect(page.getByTestId("scene")).toHaveCount(12);
    expect(await page.getByTestId("prop").count()).toBeGreaterThanOrEqual(50);
    expect(await page.getByTestId("anim").count()).toBeGreaterThanOrEqual(80);
    await page.waitForTimeout(1500);
    const painted = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("[data-testid=scene] canvas")!;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n / (c.width * c.height);
    });
    expect(painted).toBeGreaterThan(0.99);
  });
});
