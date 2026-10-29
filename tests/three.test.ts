import { describe, expect, it } from "vitest";
import { TILE_U, LEVEL_U } from "@/game/iso/raster";
import { PROP_IDS, propDef } from "@/game/art/props";
import { wallSwatch, groundTexture } from "@/game/art/tiles";
import { MeshRaster } from "@/game/three/meshRaster";
import { propHeight, propModel } from "@/game/three/propModels";
import { buildChunk, CHUNK, LEVEL, mapWindow, TEXELS, windowMap } from "@/game/three/terrain";
import { dirInView, ISO_GROUND, turnToView } from "@/game/runtime/view";
import { TileMap, TILE_KINDS } from "@/game/world/tilemap";
import { dirFrom } from "@/game/runtime/world";

const ramp = ["#ffffff", "#808080", "#404040", "#000000"] as const;
const mat = { ramp };

describe("the mesh raster: the props' solids as triangles", () => {
  it("records a box as its six faces (cut into pixel cells), in tiles, with the map's y running along −Z", () => {
    const tiny = new MeshRaster();
    tiny.box([0, 0, 0], [1, 1, 1], mat);
    expect(tiny.geo.indices.length / 3).toBe(12);
    const r = new MeshRaster();
    r.box([0, 0, 0], [TILE_U, TILE_U, LEVEL_U], mat);
    const g = r.geo;
    // the cells cover the box's whole surface, no more and no less
    let area = 0;
    for (let k = 0; k < g.indices.length; k += 3) {
      const [a, b, c] = [0, 1, 2].map((o) => g.positions.slice(g.indices[k + o] * 3, g.indices[k + o] * 3 + 3));
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    }
    expect(area).toBeCloseTo(2 + 4 * LEVEL, 3);
    const xs = g.positions.filter((_, k) => k % 3 === 0);
    const ys = g.positions.filter((_, k) => k % 3 === 1);
    const zs = g.positions.filter((_, k) => k % 3 === 2);
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(1);
    // one level is the art's own proportion of a tile
    expect(Math.max(...ys)).toBeCloseTo(LEVEL);
    expect(Math.min(...zs)).toBeCloseTo(-1);
    expect(Math.max(...zs)).toBeCloseTo(0);
    // the base tone of the ramp, and rigid (no sway)
    expect(g.colors.slice(0, 4)).toEqual([128 / 255, 128 / 255, 128 / 255, 0]);
  });

  it("finds the corners of a hip roof from its planes", () => {
    const r = new MeshRaster();
    r.hipRoof(0, 0, 10, 6, 0, 4, 0, 5, mat);
    const ys = r.geo.positions.filter((_, k) => k % 3 === 1);
    // from the eaves up to the ridge
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(5 / TILE_U);
    const xs = r.geo.positions.filter((_, k) => k % 3 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20 / TILE_U);
    expect(r.geo.indices.length).toBeGreaterThan(0);
  });

  it("cuts away what a shader leaves out", () => {
    const r = new MeshRaster();
    r.box([0, 0, 0], [20, 20, 20], { ramp, shader: (s) => (s.p[2] > 10 ? null : "#ff0000") });
    const ys = r.geo.positions.filter((_, k) => k % 3 === 1);
    expect(ys.length).toBeGreaterThan(0);
    // nothing of the upper half survives but the edges of cells straddling it
    expect(Math.max(...ys)).toBeLessThanOrEqual(12 / TILE_U + 1e-9);
  });

  it("closes spheres and sweeps into whole surfaces", () => {
    const r = new MeshRaster();
    r.sphere([0, 0, 10], 5, mat);
    const n = r.geo.indices.length;
    expect(n).toBeGreaterThan(30);
    r.sweep(
      [
        [0, 0, 0],
        [0, 0, 20],
        [5, 0, 30],
      ],
      [2, 1],
      mat,
    );
    expect(r.geo.indices.length).toBeGreaterThan(n);
    // every normal is a unit vector
    for (let k = 0; k < r.geo.normals.length; k += 3) expect(Math.hypot(r.geo.normals[k], r.geo.normals[k + 1], r.geo.normals[k + 2])).toBeCloseTo(1, 3);
  });
});

describe("prop models", () => {
  it("gives every prop in the game a model that stands on its footing", () => {
    for (const id of PROP_IDS) {
      const g = propModel(id);
      expect(g.indices.length, id).toBeGreaterThan(0);
      expect(g.positions.every(Number.isFinite), id).toBe(true);
      expect(Math.max(...g.indices), id).toBeLessThan(g.positions.length / 3);
      const ys = g.positions.filter((_, k) => k % 3 === 1);
      expect(Math.min(...ys), id).toBeGreaterThan(-3);
    }
  });

  it("is tall where the art is tall: the pagoda towers over a lantern", () => {
    expect(propHeight("pagoda")).toBeGreaterThan(propHeight("lantern") * 2);
    expect(propHeight("hall")).toBeGreaterThan(2);
  });

  it("sways trees in the wind but leaves halls still", () => {
    const pine = propModel("pine");
    const hall = propModel("hall");
    expect(Math.max(...pine.colors.filter((_, k) => k % 4 === 3))).toBeGreaterThan(0.9);
    expect(Math.max(...hall.colors.filter((_, k) => k % 4 === 3))).toBe(0);
  });

  it("lays snow on roofs in winter, and turns the leaves in autumn", () => {
    const summer = propModel("hall", 0, "summer");
    const winter = propModel("hall", 0, "winter");
    const white = (g: typeof summer) => g.colors.filter((_, k) => k % 4 === 0).filter((r, k) => r > 0.9 && g.colors[k * 4 + 2] > 0.95).length;
    expect(white(winter)).toBeGreaterThan(white(summer));
    const spring = propModel("cherry", 0, "spring");
    const autumn = propModel("cherry", 0, "autumn");
    expect(autumn.colors).not.toEqual(spring.colors);
    // the shape is shared, only the colours differ
    expect(autumn.positions).toBe(propModel("cherry").positions);
  });

  it("keeps every animation frame the art has", () => {
    for (const id of ["waterwheel", "campfire", "chest"] as const) expect(propModel(id, propDef(id).frames - 1).indices.length).toBeGreaterThan(0);
  });
});

describe("terrain chunks", () => {
  const map = new TileMap(40, 40, "grass", 0);
  map.rect(4, 4, 8, 8, "plaza", 3);
  map.rect(12, 4, 14, 6, "water", 0);
  map.rect(20, 20, 22, 22, "void", 0);
  const opts = { base: 0, floating: false, rocky: false, season: () => null };

  it("paints a top for every solid tile and a texture to cover them", () => {
    const c = buildChunk(map, 0, 0, opts);
    const water = 9;
    const voids = 9;
    expect(c.top.indices.length / 6).toBe(CHUNK * CHUNK - water - voids);
    expect(c.size).toBe(CHUNK * TEXELS);
    expect(c.tex.length).toBe(c.size * c.size * 4);
    // painted, opaque texels where the ground is
    expect(c.tex[3]).toBe(255);
    expect(c.liquid.indices.length / 6).toBe(water);
    expect(c.liquid.cells!.every((k) => k === 0)).toBe(true);
  });

  it("raises cliff walls where the land steps down, three levels tall at the plaza", () => {
    const c = buildChunk(map, 0, 0, opts);
    // the plaza's rim (5 × 4 sides), plus the banks of the water and the edge of the hole
    expect(c.walls.indices.length / 6).toBeGreaterThanOrEqual(20);
    const ys = c.walls.positions.filter((_, k) => k % 3 === 1);
    expect(Math.max(...ys)).toBeCloseTo(3 * LEVEL);
    // walls take their swatch from their own kind's cell of the atlas
    expect(c.walls.cells!).toContain(TILE_KINDS.indexOf("plaza"));
  });

  it("paints the same chunk through a window of the map as from the map itself (as the worker does)", () => {
    const direct = buildChunk(map, 0, 0, opts);
    const win = mapWindow(map, 0, 0, () => null);
    const viaWorker = buildChunk(windowMap(win), 0, 0, opts);
    expect(viaWorker.top.positions).toEqual(direct.top.positions);
    expect(viaWorker.walls.positions).toEqual(direct.walls.positions);
    expect(Buffer.from(viaWorker.tex).equals(Buffer.from(direct.tex))).toBe(true);
  });

  it("carries the season through the window", () => {
    const win = mapWindow(map, 0, 0, (i) => (i < 10 ? "winter" : null));
    const w = windowMap(win);
    expect(w.season(3, 3)).toBe("winter");
    expect(w.season(15, 3)).toBeNull();
    const snowy = buildChunk(w, 0, 0, { ...opts, season: w.season });
    expect(Buffer.from(snowy.tex).equals(Buffer.from(buildChunk(map, 0, 0, opts).tex))).toBe(false);
  });

  it("has a wall swatch and a ground texture for every kind", () => {
    for (const k of TILE_KINDS) {
      const sw = wallSwatch(k);
      expect([sw.width, sw.height]).toEqual([16, 32]);
      if (k !== "void" && k !== "water" && k !== "deep" && k !== "lava" && k !== "paddy") expect(groundTexture(k)!(1.5, 2.5)).toMatch(/^#/);
    }
  });
});

describe("the camera's ground axes", () => {
  it("changes nothing under the isometric camera", () => {
    for (const v of [
      [1, 0],
      [0, 1],
      [0.6, -0.8],
    ] as [number, number][]) {
      const t = turnToView(v, ISO_GROUND);
      expect(t[0]).toBeCloseTo(v[0]);
      expect(t[1]).toBeCloseTo(v[1]);
    }
    for (let d = 0; d < 16; d++) expect(dirInView(d, ISO_GROUND)).toBe(d);
  });

  it('walks "up the screen" along the camera however it is turned', () => {
    // camera turned a quarter round: what was "toward the viewer" is now "screen left"
    const g = { toward: ISO_GROUND.right.map((x) => -x) as [number, number], right: ISO_GROUND.toward };
    const down = turnToView([ISO_GROUND.toward[0], ISO_GROUND.toward[1]], g);
    expect(down[0]).toBeCloseTo(g.toward[0]);
    expect(down[1]).toBeCloseTo(g.toward[1]);
  });

  it("shows a figure's back once the camera has gone round behind her", () => {
    const behind = { toward: ISO_GROUND.toward.map((x) => -x) as [number, number], right: ISO_GROUND.right.map((x) => -x) as [number, number] };
    // facing the iso viewer (0) she now shows her back (8) to the turned camera
    expect(dirInView(0, behind)).toBe(8);
    expect(dirInView(dirFrom(1, 1), behind)).toBe((dirFrom(1, 1) + 8) % 16);
  });
});
