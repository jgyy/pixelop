import { describe, expect, it } from "vitest";
import { TileMap } from "@/game/world/tilemap";
import { FINE, fineKind, fineHeight, fineView } from "@/game/world/refine";
import { World } from "@/game/runtime/world";
import { getWorld } from "@/game/world/continent";
import { getInterior, INTERIOR_IDS } from "@/game/world/interiors";

describe("the fine grid", () => {
  it("splits every tile into cells half its size", () => {
    expect(FINE).toBe(2);
    const m = new TileMap(10, 10, "grass", 1);
    const v = fineView(m);
    expect([v.w, v.h]).toEqual([20, 20]);
    for (let fj = 0; fj < 20; fj++) for (let fi = 0; fi < 20; fi++) expect(v.kind(fi, fj)).toBe("grass");
  });

  it("rounds a square pond's corners off, and leaves its straight sides straight", () => {
    const m = new TileMap(10, 10, "grass", 0);
    m.rect(3, 3, 6, 6, "water", 0);
    // the pond's top-left tile loses its outer corner to the grass
    expect(fineKind(m, 6, 6)).toBe("grass");
    expect(fineKind(m, 7, 7)).toBe("water");
    // along a straight side nothing changes
    expect(fineKind(m, 8, 6)).toBe("water");
    expect(fineKind(m, 9, 6)).toBe("water");
  });

  it("turns a staircase of tiles into a diagonal of half-size steps", () => {
    const m = new TileMap(12, 12, "grass", 0);
    // a sandy staircase: every tile below the diagonal
    m.each((i, j) => i < j && m.set(i, j, "sand"));
    let mixed = 0;
    for (let n = 1; n < 10; n++) {
      // the grass tile just above the diagonal takes a sandy corner where the step was
      if (fineKind(m, n * 2, n * 2 + 1) === "sand") mixed++;
    }
    expect(mixed).toBeGreaterThan(5);
  });

  it("never makes a new cliff, never lets water eat a road, and leaves rooms and footings square", () => {
    const m = new TileMap(10, 10, "grass", 0);
    m.rect(4, 4, 6, 6, "plaza", 3);
    // three levels is too far to round across
    expect(fineHeight(m, 8, 8)).toBe(3);
    const road = new TileMap(10, 10, "water", 0);
    road.rect(0, 4, 9, 4, "wood", 0);
    road.rect(4, 0, 4, 9, "wood", 0);
    for (let fj = 0; fj < 20; fj++) for (let fi = 0; fi < 20; fi++) if (road.kind(fi >> 1, fj >> 1) === "wood") expect(fineKind(road, fi, fj)).toBe("wood");
    const room = new TileMap(8, 8, "rug", 0);
    room.rect(0, 0, 7, 0, "wall", 4);
    room.rect(0, 0, 0, 7, "wall", 4);
    expect(fineKind(room, 2, 2)).toBe("rug");
    const pond = new TileMap(10, 10, "grass", 0);
    pond.rect(3, 3, 6, 6, "water", 0);
    expect(fineKind(pond, 6, 6, (i, j) => i === 3 && j === 3)).toBe("water");
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
