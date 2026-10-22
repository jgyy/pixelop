import { describe, expect, it } from "vitest";
import { facingBasis, Raster, spline, WORLD_BASIS, type Mat } from "@/game/iso/raster";
import { isoX, isoY, screenDirToWorld, screenToWorld } from "@/game/iso/projection";
import { ramp } from "@/game/art/palette";
import { fbm, hash2, vnoise } from "@/game/pixel/noise";

const mat: Mat = { ramp: ramp("#808080"), outline: "#000000" };

describe("isometric projection", () => {
  it("round-trips screen and world coordinates", () => {
    const [x, y] = screenToWorld(isoX(3.25, 7.5), isoY(3.25, 7.5, 2), 2);
    expect(x).toBeCloseTo(3.25);
    expect(y).toBeCloseTo(7.5);
  });
  it("maps screen-up input to the world's north-west diagonal", () => {
    const [x, y] = screenDirToWorld(0, -1);
    expect(x).toBeCloseTo(-Math.SQRT1_2);
    expect(y).toBeCloseTo(-Math.SQRT1_2);
  });
});

describe("ray caster", () => {
  it("projects spheres to round, shaded, outlined discs", () => {
    const r = new Raster(32, 32, 16, 16);
    r.sphere([0, 0, 0], 8, mat);
    const b = r.finish();
    expect(b.alphaAt(16, 16)).toBe(255);
    expect(b.alphaAt(1, 1)).toBe(0);
    // lit from the upper left: that side is brighter than the lower right
    const lum = (x: number, y: number) => b.getRGBA(x, y).slice(0, 3).reduce((a, c) => a + c, 0);
    expect(lum(12, 12)).toBeGreaterThan(lum(20, 20));
    // silhouette outline uses the material outline colour
    expect(b.getRGBA(16, 7)).toEqual([0, 0, 0, 255]);
  });

  it("resolves overlapping solids with the depth buffer", () => {
    const r = new Raster(40, 40, 20, 24);
    r.sphere([0, 0, 0], 6, { ramp: ramp("#ff0000") });
    r.sphere([0, 6, 0], 4, { ramp: ramp("#0000ff") }); // closer to the viewer
    const [x, y] = r.screen([0, 6, 0]).map(Math.round);
    const [cr, , cb] = r.buf.getRGBA(x, y);
    expect(cb).toBeGreaterThan(cr);
  });

  it("only shows face decals on the side facing the camera", () => {
    for (const [facing, visible] of [
      [0, true],
      [Math.PI, false],
    ] as const) {
      const r = new Raster(32, 32, 16, 16, facingBasis(facing));
      r.sphere([0, 0, 0], 6, mat);
      expect(r.facePoint([0, 6, 0], [0, 1, 0]).visible).toBe(visible);
    }
  });

  it("casts convex solids (boxes, prisms, roofs) with flat faces", () => {
    const r = new Raster(80, 80, 40, 60, WORLD_BASIS);
    r.box([-8, -8, 0], [8, 8, 12], mat);
    r.prism(0, 0, 4, 12, 20, 8, mat);
    r.hipRoof(0, 0, 10, 10, 20, 3, 1, 28, mat);
    r.cone(0, 0, 3, 28, 0.5, 34, 6, mat);
    expect(r.finish().opaqueCount()).toBeGreaterThan(400);
  });

  it("splines pass through their control points", () => {
    const pts = spline([
      [0, 0, 0],
      [5, 5, 0],
      [10, 0, 0],
    ]);
    expect(pts[0]).toEqual([0, 0, 0]);
    expect(pts[pts.length - 1]).toEqual([10, 0, 0]);
    expect(pts.some(([x, y]) => x === 5 && y === 5)).toBe(true);
  });
});

describe("noise", () => {
  it("is deterministic and bounded", () => {
    expect(hash2(3, 4, 5)).toBe(hash2(3, 4, 5));
    for (let i = 0; i < 50; i++) {
      const v = vnoise(i * 0.37, i * 0.71, 2);
      const f = fbm(i * 0.21, i * 0.13, 9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });
});
