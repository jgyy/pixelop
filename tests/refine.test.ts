import { describe, expect, it } from "vitest";
import { TileMap } from "@/game/world/tilemap";
import { FINE, fineKeys, fineKind, fineHeight, fineView } from "@/game/world/refine";
import { World } from "@/game/runtime/world";
import { getWorld } from "@/game/world/continent";
import { getInterior, INTERIOR_IDS } from "@/game/world/interiors";

describe("the fine grid", () => {
  it("splits every tile into cells a quarter its size", () => {
    expect(FINE).toBe(4);
    const m = new TileMap(10, 10, "grass", 1);
    const v = fineView(m);
    expect([v.w, v.h]).toEqual([40, 40]);
    for (let fj = 0; fj < 40; fj++) for (let fi = 0; fi < 40; fi++) expect(v.kind(fi, fj)).toBe("grass");
  });

  it("rounds a square pond's corners off in a curve, and leaves its straight sides straight", () => {
    const m = new TileMap(10, 10, "grass", 0);
    m.rect(3, 3, 6, 6, "water", 0);
    // the pond's top-left tile (cells 12–15) loses its outer corner to the grass…
    expect(fineKind(m, 12, 12)).toBe("grass");
    expect(fineKind(m, 13, 12)).toBe("grass");
    expect(fineKind(m, 12, 13)).toBe("grass");
    // …but the second pass gives a sixteenth of it back on the inside, and takes one on either side: a curve, not a notch
    expect(fineKind(m, 13, 13)).toBe("water");
    expect(fineKind(m, 14, 12)).toBe("grass");
    expect(fineKind(m, 12, 14)).toBe("grass");
    expect(fineKind(m, 15, 15)).toBe("water");
    // along a straight side nothing changes
    expect(fineKind(m, 16, 12)).toBe("water");
    expect(fineKind(m, 19, 12)).toBe("water");
  });

  it("turns a staircase of tiles into a diagonal of quarter-size steps", () => {
    const m = new TileMap(12, 12, "grass", 0);
    // a sandy staircase: every tile below the diagonal
    m.each((i, j) => i < j && m.set(i, j, "sand"));
    let mixed = 0;
    for (let n = 1; n < 10; n++) {
      // the grass tile just above the diagonal takes a sandy corner where the step was
      if (fineKind(m, n * 4, n * 4 + 3) === "sand") mixed++;
    }
    expect(mixed).toBeGreaterThan(5);
    // and the steps come out a quarter tile each: walking down the diagonal, the edge moves a cell at a time
    const edge = (fj: number) => {
      let fi = 0;
      while (fi < 48 && fineKind(m, fi, fj) === "sand") fi++;
      return fi;
    };
    for (let fj = 8; fj < 36; fj++) expect(Math.abs(edge(fj + 1) - edge(fj))).toBeLessThanOrEqual(2);
  });

  it("never makes a new cliff, never lets water eat a road, and leaves rooms and footings square", () => {
    const m = new TileMap(10, 10, "grass", 0);
    m.rect(4, 4, 6, 6, "plaza", 3);
    // three levels is too far to round across
    expect(fineHeight(m, 16, 16)).toBe(3);
    expect(fineHeight(m, 17, 17)).toBe(3);
    const road = new TileMap(10, 10, "water", 0);
    road.rect(0, 4, 9, 4, "wood", 0);
    road.rect(4, 0, 4, 9, "wood", 0);
    for (let fj = 0; fj < 40; fj++) for (let fi = 0; fi < 40; fi++) if (road.kind(fi >> 2, fj >> 2) === "wood") expect(fineKind(road, fi, fj)).toBe("wood");
    const room = new TileMap(8, 8, "rug", 0);
    room.rect(0, 0, 7, 0, "wall", 4);
    room.rect(0, 0, 0, 7, "wall", 4);
    expect(fineKind(room, 4, 4)).toBe("rug");
    expect(fineKind(room, 3, 3)).toBe("wall");
    const pond = new TileMap(10, 10, "grass", 0);
    pond.rect(3, 3, 6, 6, "water", 0);
    for (let fj = 12; fj < 16; fj++) for (let fi = 12; fi < 16; fi++) expect(fineKind(pond, fi, fj, (i, j) => i === 3 && j === 3)).toBe("water");
  });

  it("works out a whole rectangle of cells the same as one at a time", () => {
    const m = new TileMap(16, 16, "grass", 1);
    m.disc(8, 8, 4.5, "water", 0, 1.2, 3);
    m.rect(2, 2, 4, 5, "sand", 2);
    m.rect(10, 1, 14, 3, "plaza", 4);
    const v = fineView(m);
    const keys = fineKeys(m, -2, 3, 70, 50);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 70; x++) expect(keys[y * 70 + x]).toBe(v.key(x - 2, y + 3));
  });

  it("gives the open world and its caves rounded land and keeps every room square", () => {
    const w = new World(getWorld(), { x: 384.5, y: 90.5, dir: 0 }, {}, []);
    expect(w.smooth).toBe(true);
    expect(w.fine.w).toBe(w.def.map.w * FINE);
    const room = new World(getInterior(INTERIOR_IDS[0]), { x: 4.5, y: 4.5, dir: 0 }, {}, []);
    expect(room.smooth).toBe(false);
  });

  it("keeps every soul of the world on ground they can stand on, cell by cell", () => {
    const def = getWorld();
    const w = new World(def, { x: 384.5, y: 90.5, dir: 0 }, {}, []);
    let bad = 0;
    for (const n of def.npcs) if (!w.standableAt(n.i + 0.5, n.j + 0.5) && def.map.standable(n.i, n.j)) bad++;
    expect(bad).toBe(0);
  });
});
