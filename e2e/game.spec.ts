import { expect, test } from "@playwright/test";
import { battle, mode, patch, startNewGame, state, teleport } from "./helpers";

test.describe("Jade Lotus Ascension", () => {
  test("title screen renders and the API is healthy", async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Jade Lotus Ascension/ })).toBeVisible();
    await expect(page.getByTestId("new-game")).toBeEnabled();
    const health = await request.get("/api/health");
    expect(health.ok()).toBe(true);
    expect(await health.json()).toMatchObject({ ok: true });
    expect(errors).toEqual([]);
  });

  test("the heroine walks, jumps and talks to the elder", async ({ page }) => {
    await startNewGame(page);
    await expect(page.getByTestId("realm")).toHaveText(/Qi Condensation · Early/);
    const x0 = (await state(page)).x;
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(800);
    await page.keyboard.up("ArrowRight");
    expect((await state(page)).x).toBeGreaterThan(x0 + 20);
    await page.keyboard.press("Space");

    await teleport(page, "sect", 330);
    await expect(page.getByTestId("prompt")).toContainText("Elder Mo");
    await page.keyboard.press("KeyE");
    await expect(page.getByTestId("dialog")).toContainText("Blood Moon Sect");
    for (let i = 0; i < 6 && (await page.getByTestId("dialog").count()); i++) await page.keyboard.press("Enter");
    await expect(page.getByTestId("dialog")).toHaveCount(0);
    expect((await state(page)).flags.metElder).toBe(true);
  });

  test("a battle can be fought and won", async ({ page }) => {
    await startNewGame(page);
    await patch(page, { realm: 2, stage: 0, hp: 400, qi: 200 });
    await battle(page, "fox");
    await expect(page.getByTestId("battle")).toContainText("Fox Spirit");
    const skill = page.getByTestId("skill-palm");
    for (let i = 0; i < 20 && (await mode(page)) === "battle"; i++) {
      if (await skill.isEnabled().catch(() => false)) await skill.click();
      await page.waitForTimeout(500);
    }
    await expect.poll(() => mode(page), { timeout: 15_000 }).toBe("explore");
    expect((await state(page)).kills).toBe(1);
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

  test("the gallery animates every sprite and backdrop", async ({ page }) => {
    await page.goto("/gallery");
    await expect(page.getByRole("heading", { name: "Pixel Art Gallery" })).toBeVisible();
    await expect(page.locator("[data-testid^=sheet-]")).toHaveCount(16);
    await expect(page.getByTestId("scene")).toHaveCount(5);
    expect(await page.getByTestId("anim").count()).toBeGreaterThanOrEqual(40);
    await page.waitForTimeout(500);
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
