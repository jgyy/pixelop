import { describe, expect, it } from "vitest";
import { getScene, renderSceneFrame, SCENE_IDS, SCREEN_H, SCREEN_W, TILE_W, wrapX } from "@/game/scenes";

describe("scenes", () => {
  it.each(SCENE_IDS)("%s renders a full opaque frame", (id) => {
    const frame = renderSceneFrame(id, 1.5, 100);
    expect(frame.width).toBe(SCREEN_W);
    expect(frame.height).toBe(SCREEN_H);
    expect(frame.opaqueCount()).toBe(SCREEN_W * SCREEN_H);
  });

  it.each(SCENE_IDS)("%s is deterministic for a given time and animates over time", (id) => {
    const a = renderSceneFrame(id, 2, 0);
    const b = renderSceneFrame(id, 2, 0);
    const c = renderSceneFrame(id, 2.7, 0);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    expect(Buffer.from(a.data).equals(Buffer.from(c.data))).toBe(false);
  });

  it("builds tile-width parallax layers in back-to-front order", () => {
    for (const id of SCENE_IDS) {
      const s = getScene(id);
      expect(s.ground.buffer.width).toBe(TILE_W);
      const pars = s.layers.map((l) => l.parallax);
      expect([...pars].sort((x, y) => x - y)).toEqual(pars);
      expect(pars.every((p) => p > 0 && p < 1)).toBe(true);
    }
  });

  it("wraps parallax positions into the screen span", () => {
    for (const cam of [0, 333, 10_000]) {
      const x = wrapX(50, 0.5, cam);
      expect(x).toBeGreaterThanOrEqual(-32);
      expect(x).toBeLessThan(SCREEN_W + 32);
    }
  });
});
