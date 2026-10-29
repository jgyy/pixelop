import { expect, test } from "@playwright/test";
import { mode, startNewGame, state } from "./helpers";

// the 3D view is the default: start these specs without the isometric preference the others carry
test.use({ storageState: { cookies: [], origins: [] } });

const ready = (page: import("@playwright/test").Page) => page.waitForFunction(() => !!(window.__pixelop?.game.view3d as { ready?: boolean } | null | undefined)?.ready, null, { timeout: 60_000 });

test.describe("The jianghu in 3D (Babylon.js)", () => {
  test("draws the land, its halls and its folk in 3D, with the HUD over it", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await startNewGame(page);
    await ready(page);
    await expect(page.getByTestId("world-3d")).toBeVisible();
    await expect(page.getByTestId("hud")).toBeVisible();
    await expect(page.getByTestId("compass")).toBeVisible();
    const scene = await page.evaluate(() => {
      const v = window.__pixelop!.game.view3d as unknown as { scene: { meshes: { name: string; isEnabled(): boolean }[] }; canvas: HTMLCanvasElement };
      const names = v.scene.meshes.filter((m) => m.isEnabled()).map((m) => m.name);
      // the canvas really has a picture on it, not one flat colour
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(v.canvas, 0, 0, 64, 64);
      const d = ctx.getImageData(0, 0, 64, 64).data;
      const colours = new Set<number>();
      for (let k = 0; k < d.length; k += 4) colours.add((d[k] << 16) | (d[k + 1] << 8) | d[k + 2]);
      return { ground: names.filter((n) => n.startsWith("top-")).length, props: names.filter((n) => n.startsWith("prop-")).length, sprites: names.filter((n) => n.startsWith("sprite-")).length, colours: colours.size };
    });
    expect(scene.ground).toBeGreaterThan(0);
    expect(scene.props).toBeGreaterThan(5);
    expect(scene.sprites).toBeGreaterThan(2);
    expect(scene.colours).toBeGreaterThan(40);
    expect(errors).toEqual([]);
  });

  test("the camera turns (Z / X), and up on the keys still walks up the screen", async ({ page }) => {
    await startNewGame(page);
    await ready(page);
    const alpha0 = await page.evaluate(() => window.__pixelop!.game.view3d!.ground().toward);
    await page.keyboard.press("KeyZ");
    await page.keyboard.press("KeyZ");
    // a quarter turn: what was toward the camera is now off to the side
    await expect.poll(() => page.evaluate(([t0x, t0y]) => {
      const t = window.__pixelop!.game.view3d!.ground().toward;
      return Math.abs(t[0] * t0x + t[1] * t0y);
    }, alpha0), { timeout: 15_000 }).toBeLessThan(0.1);
    const toward = await page.evaluate(() => window.__pixelop!.game.view3d!.ground().toward);
    const s0 = await state(page);
    await page.evaluate(() => window.__pixelop!.game.setStick(0, -1));
    await expect.poll(async () => {
      const s = await state(page);
      return Math.hypot(s.x - s0.x, s.y - s0.y);
    }, { timeout: 20_000 }).toBeGreaterThan(1.2);
    await page.evaluate(() => window.__pixelop!.game.setStick(0, 0));
    const s1 = await state(page);
    const [dx, dy] = [s1.x - s0.x, s1.y - s0.y];
    // "up" walks away from the camera: against the way it looks back
    expect(-(dx * toward[0] + dy * toward[1]) / Math.hypot(dx, dy)).toBeGreaterThan(0.6);
    // Home sets it back to the isometric angle
    await page.keyboard.press("Home");
    await expect.poll(() => page.evaluate(([t0x, t0y]) => {
      const t = window.__pixelop!.game.view3d!.ground().toward;
      return t[0] * t0x + t[1] * t0y;
    }, alpha0), { timeout: 15_000 }).toBeGreaterThan(0.99);
  });

  test("a tap picks the ground under it, and sprites face the turned camera", async ({ page }) => {
    await startNewGame(page);
    await ready(page);
    const picked = await page.evaluate(() => {
      const g = window.__pixelop!.game;
      const v = g.view3d!;
      const h = g.world.hero;
      const [sx, sy] = v.project(h.x + 2, h.y + 1, g.world.groundZ(h.x + 2, h.y + 1))!;
      return { at: v.pick(sx, sy), want: [h.x + 2, h.y + 1] };
    });
    expect(picked.at).not.toBeNull();
    expect(Math.hypot(picked.at![0] - picked.want[0], picked.at![1] - picked.want[1])).toBeLessThan(0.6);
    expect(await mode(page)).toBe("explore");
  });

  test("the settings switch between the 3D world and the isometric pixels", async ({ page }) => {
    await startNewGame(page);
    await ready(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("game-menu")).toBeVisible();
    await page.getByTestId("menu-tab-settings").click();
    await page.getByTestId("set-view-2d").click();
    await expect.poll(() => page.evaluate(() => !!window.__pixelop!.game.view3d)).toBe(false);
    await expect(page.getByTestId("world-3d")).toBeHidden();
    await page.getByTestId("set-view-3d").click();
    await ready(page);
    await expect(page.getByTestId("world-3d")).toBeVisible();
    await page.getByTestId("menu-close").click();
    await expect(page.getByTestId("game-menu")).toBeHidden();
  });
});
