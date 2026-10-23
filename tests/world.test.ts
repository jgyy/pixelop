import { describe, expect, it } from "vitest";
import { AREA_IDS, getArea } from "@/game/world/areas";
import { LIQUID } from "@/game/world/tilemap";
import { EDGES, mapTerrain, MAP_H, MAP_W, neighbours, NODES, route } from "@/game/world/overworld";
import { ENEMIES } from "@/game/engine/enemies";

/** Tiles reachable on foot from a start tile (steps of at most one level). */
function reachable(id: (typeof AREA_IDS)[number], from: [number, number], flying = false): Set<string> {
  const { map } = getArea(id);
  const seen = new Set<string>();
  const q: [number, number][] = [[Math.floor(from[0]), Math.floor(from[1])]];
  seen.add(q[0].join(","));
  while (q.length) {
    const [i, j] = q.shift()!;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di;
      const nj = j + dj;
      const k = `${ni},${nj}`;
      if (seen.has(k) || !map.standable(ni, nj, flying)) continue;
      if (Math.abs(map.height(ni, nj) - map.height(i, j)) > (flying ? 2 : 1)) continue;
      seen.add(k);
      q.push([ni, nj]);
    }
  }
  return seen;
}

const adjacentReachable = (r: Set<string>, i: number, j: number, reach = 1) => {
  for (let dj = -reach; dj <= reach; dj++) for (let di = -reach; di <= reach; di++) if (r.has(`${i + di},${j + dj}`)) return true;
  return false;
};

describe("areas", () => {
  for (const id of AREA_IDS) {
    it(`${id}: arrival, NPCs, encounters and interactables are reachable on foot`, () => {
      const a = getArea(id);
      const m = a.map;
      expect(m.standable(Math.floor(a.arrive[0]), Math.floor(a.arrive[1]))).toBe(true);
      const r = reachable(id, a.arrive);
      expect(r.size).toBeGreaterThan(80);
      for (const n of a.npcs) {
        expect(m.standable(n.i, n.j), `${n.key} stands on open ground`).toBe(true);
        expect(adjacentReachable(r, n.i, n.j), `${n.key} can be reached`).toBe(true);
      }
      for (const e of a.enemies) {
        expect(ENEMIES[e.enemy]).toBeDefined();
        expect(m.standable(e.i, e.j), `${e.key} spawns on open ground`).toBe(true);
        expect(adjacentReachable(r, e.i, e.j), `${e.key} can be reached`).toBe(true);
      }
      for (const it of a.interacts) expect(adjacentReachable(r, it.i, it.j), `${it.key} can be reached`).toBe(true);
      expect(a.interacts.filter((x) => x.kind === "exit")).toHaveLength(1);
      // liquids are never walkable, and no prop blocks the arrival tile
      m.each((i, j) => {
        if (LIQUID[m.kind(i, j)]) expect(m.standable(i, j)).toBe(false);
      });
    });
  }
});

describe("world map", () => {
  it("connects every region", () => {
    const seen = new Set(["sect"]);
    const q = ["sect"];
    while (q.length)
      for (const n of neighbours(q.shift() as never))
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
    expect(seen.size).toBe(AREA_IDS.length);
  });

  it("routes start and end at their nodes and stay on the map", () => {
    for (const [a, b] of EDGES) {
      const r = route(a, b);
      expect(r[0]).toEqual([NODES[a].x, NODES[a].y]);
      expect(r[r.length - 1]).toEqual([NODES[b].x, NODES[b].y]);
      for (const [x, y] of r) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(MAP_W);
        expect(y).toBeLessThan(MAP_H);
      }
    }
  });

  it("generates terrain with sea, mountains and settlements on dry land", () => {
    const t = mapTerrain();
    expect(t).toHaveLength(MAP_W * MAP_H);
    const biomes = new Set(t.map((c) => c.biome));
    for (const b of ["sea", "mountain", "snow", "bamboo", "ash", "lake", "road"]) expect(biomes.has(b as never)).toBe(true);
    for (const n of Object.values(NODES)) expect(t[n.y * MAP_W + n.x].biome).not.toBe("sea");
  });
});
