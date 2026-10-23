import { describe, expect, it } from "vitest";
import { AREA_IDS, getArea } from "@/game/world/areas";
import { LIQUID } from "@/game/world/tilemap";
import { flightPath, mapTerrain, MAP_H, MAP_W, NODES } from "@/game/world/overworld";
import { FLOATS, getWorld, regionAt } from "@/game/world/continent";
import { REGION_ORIGIN, toWorld, WORLD_H, WORLD_W } from "@/game/world/layout";
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

describe("the continuous world", () => {
  const w = getWorld();
  const m = w.map;

  /** Every tile reachable on foot from the sect, with every seal lifted. */
  const walkable = (() => {
    const seen = new Set<number>();
    const [sx, sy] = w.waypoints.sect;
    const q = [Math.floor(sy) * m.w + Math.floor(sx)];
    seen.add(q[0]);
    while (q.length) {
      const idx = q.shift()!;
      const i = idx % m.w;
      const j = Math.floor(idx / m.w);
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = (j + dj) * m.w + i + di;
        if (seen.has(n) || !m.standable(i + di, j + dj)) continue;
        if (Math.abs(m.height(i + di, j + dj) - m.height(i, j)) > 1) continue;
        seen.add(n);
        q.push(n);
      }
    }
    return seen;
  })();
  const near = (i: number, j: number) => [-1, 0, 1].some((dj) => [-1, 0, 1].some((di) => walkable.has((j + dj) * m.w + i + di)));

  it("is one map holding all six regions, with every region reachable on foot", () => {
    expect(m.w).toBe(WORLD_W);
    expect(m.h).toBe(WORLD_H);
    expect(walkable.size).toBeGreaterThan(5000);
    for (const id of AREA_IDS) {
      const [x, y] = w.waypoints[id];
      expect(walkable.has(Math.floor(y) * m.w + Math.floor(x)), `${id} waypoint`).toBe(true);
      expect(regionAt(w, x, y)).toBe(id);
      const [lx, ly] = getArea(id).arrive;
      expect(toWorld(id, lx, ly)).toEqual([x, y]);
    }
  });

  it("keeps every NPC, encounter, critter and interactable on open, reachable ground", () => {
    for (const n of w.npcs) {
      expect(m.standable(n.i, n.j), `${n.key} stands on open ground`).toBe(true);
      expect(near(n.i, n.j), `${n.key} can be reached`).toBe(true);
    }
    for (const e of w.enemies) {
      expect(ENEMIES[e.enemy]).toBeDefined();
      expect(m.standable(e.i, e.j), `${e.key} spawns on open ground`).toBe(true);
      expect(near(e.i, e.j), `${e.key} can be reached`).toBe(true);
    }
    for (const it of w.interacts) expect(near(it.i, it.j), `${it.key} can be reached`).toBe(true);
    for (const c of w.critters ?? []) expect(m.kind(c.i, c.j), c.key).not.toBe("void");
    const keys = [...w.npcs, ...w.enemies, ...w.interacts].map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("stamps each hand-built region at its place in the world", () => {
    for (const id of AREA_IDS) {
      const a = getArea(id);
      const [ox, oy] = REGION_ORIGIN[id];
      let same = 0;
      let total = 0;
      a.map.each((i, j) => {
        if (a.map.kind(i, j) === "void") return;
        total++;
        if (m.kind(ox + i, oy + j) === a.map.kind(i, j)) same++;
      });
      // only the highway, rivers and bridges carve through a region
      expect(same / total, id).toBeGreaterThan(0.93);
    }
  });

  it("joins the sky islands to the mainland with bridges and lets rivers fall off the edge", () => {
    const bridge = (i: number, j0: number, j1: number) => {
      for (let j = j0; j <= j1; j++) expect(walkable.has(j * m.w + i), `bridge tile ${i},${j}`).toBe(true);
    };
    const [gx, gy] = toWorld("sect", 15, 27);
    bridge(gx, gy, toWorld("village", 16, 4)[1]); // sect gate → Cloudrest Isle → village
    bridge(gx + 2, toWorld("sect", 0, -5)[1], toWorld("sect", 0, 3)[1]); // behind the Hall of Clouds → peak
    // the plank walkways out to the Cloudstep Isles
    const yun = w.npcs.find((n) => n.key === "yun")!;
    expect(near(yun.i, yun.j)).toBe(true);
    expect(regionAt(w, yun.i, yun.j)).toBe("sect");
    let falls = 0;
    m.each((i, j) => {
      if (LIQUID[m.kind(i, j)] && (m.kind(i + 1, j) === "void" || m.kind(i, j + 1) === "void")) falls++;
    });
    expect(falls).toBeGreaterThan(0);
  });

  it("is twice the size of the old world, with its landmarks on open land", () => {
    expect(WORLD_W).toBe(162 * 2);
    expect(WORLD_H).toBe(116 * 2);
    expect(walkable.size).toBeGreaterThan(30000);
    expect(w.landmarks.length).toBeGreaterThanOrEqual(8);
    for (const l of w.landmarks) {
      expect(m.kind(Math.floor(l.x), Math.floor(l.y)), l.name).not.toBe("void");
      let open = false;
      for (let dj = -6; dj <= 6 && !open; dj++) for (let di = -6; di <= 6 && !open; di++) open = walkable.has((Math.floor(l.y) + dj) * m.w + Math.floor(l.x) + di);
      expect(open, `${l.name} can be walked to`).toBe(true);
    }
    // the new people, beasts and treasures of the wilds
    for (const key of ["fang", "tang", "kong", "yun", "han", "wu"]) expect(w.npcs.some((n) => n.key === key), key).toBe(true);
    expect(w.enemies.filter((e) => e.enemy === "bandit").length).toBeGreaterThanOrEqual(3);
    expect(w.interacts.filter((i) => i.kind === "chest").length).toBeGreaterThanOrEqual(14);
    expect(w.interacts.filter((i) => i.kind === "shrine").length).toBeGreaterThanOrEqual(8);
    for (const id of ["waterwheel", "pagoda", "teahouse", "campfire", "tent", "karst", "scarecrow", "ruin", "steam"]) expect(w.props.some((p) => p.id === id), id).toBe(true);
  });

  it("never stands props in rivers, on the highway or over the void", () => {
    for (const p of w.props) {
      const k = m.kind(p.i, p.j);
      expect(k, `${p.id} at ${p.i},${p.j}`).not.toBe("void");
      if (!FLOATS.has(p.id)) expect(LIQUID[k], `${p.id} at ${p.i},${p.j}`).toBeUndefined();
    }
  });
});

describe("world map", () => {
  it("places every region's landmark on the land of the miniature", () => {
    const t = mapTerrain();
    expect(t).toHaveLength(MAP_W * MAP_H);
    for (const n of Object.values(NODES)) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThan(MAP_W);
      expect(n.y).toBeLessThan(MAP_H);
      expect(t[n.y * MAP_W + n.x].biome, n.id).not.toBe("void");
    }
    expect(t[NODES.sect.y * MAP_W + NODES.sect.x].sky).toBe(true);
    expect(t[NODES.village.y * MAP_W + NODES.village.x].sky).toBe(false);
  });

  it("is drawn from the real world's terrain", () => {
    const biomes = new Set(mapTerrain().map((c) => c.biome));
    for (const b of ["void", "road", "river", "lake", "snow", "bamboo", "ash", "lava", "forest", "plain", "mountain", "meadow"]) expect(biomes.has(b as never), b).toBe(true);
  });

  it("flies in an arc that starts and ends on the given points", () => {
    const p = flightPath([NODES.village.x, NODES.village.y], [NODES.valley.x, NODES.valley.y]);
    expect(p[0]).toEqual([NODES.village.x, NODES.village.y]);
    expect(p[p.length - 1][0]).toBeCloseTo(NODES.valley.x);
    expect(p[p.length - 1][1]).toBeCloseTo(NODES.valley.y);
  });
});
