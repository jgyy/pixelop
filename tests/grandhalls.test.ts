import { describe, expect, it } from "vitest";
import { getWorld } from "@/game/world/continent";
import { inHall, STOREY, storeyFlag, type GrandHall } from "@/game/world/grandhalls";
import { TILE_KINDS } from "@/game/world/tilemap";
import { World } from "@/game/runtime/world";
import { Game } from "@/game/runtime/Game";
import { newGame } from "@/game/engine/state";
import { hasNews, npcScript } from "@/game/story/story";
import { regionAt } from "@/game/world/continent";

const w = getWorld();
const halls = w.halls;
const hall = (key: string) => halls.find((h) => h.key === key)!;
const width = (h: GrandHall) => h.rect[2] - h.rect[0] + 1;
const local = (h: GrandHall, i: number, j: number) => (j - h.rect[1]) * width(h) + (i - h.rect[0]);
const SOLID = new Set(["wall", "window", "roof", "void"]);
const floorAt = (h: GrandHall, n: number, i: number, j: number) => {
  const k = local(h, i, j);
  const l = h.layers[n];
  return !l.blocked[k] && !SOLID.has(TILE_KINDS[l.kinds[k]]);
};

/** Everywhere on a hall's storeys she can walk to from its door: storey → set of local tile indices. */
function reach(h: GrandHall): Set<number>[] {
  const W = width(h);
  const H = h.rect[3] - h.rect[1] + 1;
  const seen = h.layers.map(() => new Set<number>());
  const [di, dj] = h.door[0];
  const q: [number, number][] = [[0, local(h, di, dj)]];
  seen[0].add(q[0][1]);
  for (let n = 0; n < q.length; n++) {
    const [s, k] = q[n];
    const l = h.layers[s];
    const u = k % W;
    const v = (k - u) / W;
    const visit = (s2: number, k2: number) => {
      if (!seen[s2].has(k2)) {
        seen[s2].add(k2);
        q.push([s2, k2]);
      }
    };
    for (const [du, dv] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const [a, c] = [u + du, v + dv];
      if (a < 0 || c < 0 || a >= W || c >= H) continue;
      const k2 = c * W + a;
      if (l.blocked[k2] || SOLID.has(TILE_KINDS[l.kinds[k2]]) || Math.abs(l.heights[k2] - l.heights[k]) > 1) continue;
      visit(s, k2);
    }
    // the stairs hand her from one storey to the next
    const from = h.stairs.get((h.rect[1] + v) * w.map.w + h.rect[0] + u);
    if (from === undefined) continue;
    if (s === from && l.heights[k] >= h.floorZ[from] + STOREY - 1) visit(from + 1, k);
    if (s === from + 1 && l.heights[k] <= h.floorZ[from] + 1) visit(from, k);
  }
  return seen;
}

describe("the sects' grand halls", () => {
  it("raises two halls of three storeys, each with well over a thousand tiles of floor", () => {
    expect(halls.map((h) => h.key).sort()).toEqual(["cangjing", "wanlun"]);
    for (const h of halls) {
      expect(h.layers).toHaveLength(3);
      expect(h.storeys).toHaveLength(3);
      const total = h.area.reduce((a, b) => a + b, 0);
      expect(total, h.key).toBeGreaterThan(1000);
      for (const a of h.area) expect(a, h.key).toBeGreaterThan(300);
      // each storey stands a full storey above the one below
      for (let n = 1; n < 3; n++) expect(h.floorZ[n] - h.floorZ[n - 1]).toBe(STOREY);
    }
  });

  it("stands in the sects: the pavilion by the Azure Cloud, the debating hall by the Ten Halls", () => {
    const [i0, j0, i1, j1] = hall("cangjing").rect;
    expect(regionAt(w, (i0 + i1) / 2, (j0 + j1) / 2)).toBe("sect");
    expect(w.landmarks.some((l) => l.key === "cangjing")).toBe(true);
    expect(w.landmarks.some((l) => l.key === "wanlun")).toBe(true);
  });

  it("shows its shell from outside: walls the height of every storey and a roof, with only the doorway open", () => {
    const fresh = new World(w, { x: w.waypoints.sect[0], y: w.waypoints.sect[1], dir: 0 }, {}, []);
    expect(fresh.hallHere).toBeNull();
    for (const h of halls) {
      const doors = new Set(h.door.map(([i, j]) => j * w.map.w + i));
      let roof = 0;
      for (let j = h.rect[1]; j <= h.rect[3]; j++)
        for (let i = h.rect[0]; i <= h.rect[2]; i++) {
          const k = w.map.kind(i, j);
          if (k === "roof") roof++;
          if (doors.has(j * w.map.w + i)) expect(w.map.standable(i, j), `${h.key} door`).toBe(true);
        }
      expect(roof).toBeGreaterThan(width(h) * 10);
      // the walls rise past the top storey's floor
      expect(w.map.height(h.rect[0], h.rect[1])).toBeGreaterThanOrEqual(h.floorZ[2] + STOREY);
      // and the step outside the door is open ground a level below the ground floor
      const [di, dj] = h.door[0];
      const [oi, oj] = [di - h.inward[0], dj - h.inward[1]];
      expect(w.map.standable(oi, oj), `${h.key} doorstep`).toBe(true);
      expect(Math.abs(w.map.height(oi, oj) - h.floorZ[0])).toBeLessThanOrEqual(1);
    }
  });

  it("lets her walk from the door to every storey, every soul and everything to read in it", () => {
    for (const h of halls) {
      const seen = reach(h);
      for (let n = 0; n < 3; n++) expect(seen[n].size, `${h.key} storey ${n}`).toBeGreaterThan(h.area[n] * 0.6);
      const near = (n: number, i: number, j: number) => {
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (inHall(h, i + di, j + dj) && seen[n].has(local(h, i + di, j + dj))) return true;
        return false;
      };
      for (const p of h.npcs) {
        expect(floorAt(h, p.storey, p.i, p.j), `${p.key} stands on the floor`).toBe(true);
        expect(near(p.storey, p.i, p.j), `${p.key} can be reached`).toBe(true);
        for (const [i, j] of p.route ?? []) expect(floorAt(h, p.storey, i, j), `${p.key} walks the floor at ${i},${j}`).toBe(true);
      }
      for (const it of h.interacts) {
        const n = [0, 1, 2].find((s) => it.when!({ [storeyFlag(h.key, s)]: true }))!;
        expect(near(n, it.i, it.j), `${it.key} can be reached`).toBe(true);
      }
      const keys = [...w.npcs, ...w.interacts, ...h.npcs, ...h.interacts].map((x) => x.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("gives every soul in the halls something to say, and keeps some of them walking their rounds", () => {
    const g = newGame();
    for (const h of halls) {
      for (const n of h.npcs) expect(npcScript(n.key, g)[0], n.key).not.toEqual({ say: "narrator", text: "…" });
      expect(h.npcs.filter((n) => n.route).length, h.key).toBeGreaterThanOrEqual(4);
    }
  });
});

/** Walk the heroine to a world tile along the floor she is on, a step at a time, letting the world catch up each step. */
function walkTo(world: World, ti: number, tj: number, max = 4000): void {
  const h = world.hero;
  const m = world.def.map;
  for (let n = 0; n < max; n++) {
    const [i, j] = [Math.floor(h.x), Math.floor(h.y)];
    if (i === ti && j === tj && Math.hypot(h.x - ti - 0.5, h.y - tj - 0.5) < 0.1) return;
    // breadth first from the goal back to her, over the map as it now stands
    const prev = new Map<number, number>();
    const goal = tj * m.w + ti;
    const start = j * m.w + i;
    const q = [goal];
    prev.set(goal, -1);
    for (let k = 0; k < q.length && !prev.has(start); k++) {
      const c = q[k];
      const [ci, cj] = [c % m.w, Math.floor(c / m.w)];
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const [a, b] = [ci + di, cj + dj];
        const k2 = b * m.w + a;
        if (prev.has(k2) || !m.standable(a, b) || Math.abs(m.height(a, b) - m.height(ci, cj)) > 1) continue;
        prev.set(k2, c);
        q.push(k2);
      }
    }
    if (!prev.has(start)) throw new Error(`no way from ${i},${j} to ${ti},${tj}`);
    const next = prev.get(start)!;
    const [ni, nj] = next < 0 ? [ti, tj] : [next % m.w, Math.floor(next / m.w)];
    const [dx, dy] = [ni + 0.5 - h.x, nj + 0.5 - h.y];
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, 0.12);
    world.move(h, (dx / (d || 1)) * step, (dy / (d || 1)) * step);
    world.update(1 / 30, n / 30, true, false);
  }
  throw new Error(`did not reach ${ti},${tj}`);
}

describe("walking through a grand hall", () => {
  it("opens onto the ground floor at the door, climbs storey by storey, and closes up again behind her", () => {
    const h = hall("cangjing");
    const [di, dj] = h.door[0];
    const world = new World(w, { x: di + 0.5, y: dj + 2.5, dir: 0 }, {}, []);
    // nobody stands in her way for this walk
    const clear = () => (world.actors = world.actors.filter((a) => a === world.hero));
    clear();
    expect(world.hallHere).toBeNull();
    walkTo(world, di, dj - 1);
    expect(world.hallHere?.storey).toBe(0);
    expect(world.envFlags[storeyFlag("cangjing", 0)]).toBe(true);
    // the ground floor's folk are here, and nobody from upstairs
    expect(world.actors.some((a) => a.key === "gh-wen")).toBe(true);
    expect(world.actors.some((a) => a.key === "gh-copy1")).toBe(false);
    expect(world.def.map.kind(h.rect[0] + 12, h.rect[1] + 10)).not.toBe("roof");
    clear();
    // up the east stair to the stacks
    walkTo(world, h.rect[0] + 21, h.rect[1] + 13);
    expect(world.hallHere?.storey).toBe(1);
    expect(world.hero.z).toBeCloseTo(h.floorZ[1], 0);
    expect(world.actors.some((a) => a.key === "gh-copy1")).toBe(true);
    expect(world.actors.some((a) => a.key === "gh-wen")).toBe(false);
    clear();
    // up the west stair to the gallery under the roof
    walkTo(world, h.rect[0] + 8, h.rect[1] + 19);
    expect(world.hallHere?.storey).toBe(2);
    clear();
    // and all the way back down and out of the door
    walkTo(world, h.rect[0] + 2, h.rect[1] + 19);
    expect(world.hallHere?.storey).toBe(1);
    walkTo(world, h.rect[0] + 1, h.rect[1] + 19);
    clear();
    walkTo(world, h.rect[0] + 21, h.rect[1] + 19);
    expect(world.hallHere?.storey).toBe(0);
    walkTo(world, h.rect[0] + 21, h.rect[1] + 20);
    clear();
    walkTo(world, di, dj + 2);
    expect(world.hallHere).toBeNull();
    expect(world.def.map.kind(h.rect[0] + 12, h.rect[1] + 10)).toBe("roof");
  });

  it("opens on the right storey when she is put down inside, and the game names the floor", () => {
    const game = new Game(newGame(), { seed: 1 });
    const h = hall("wanlun");
    game.debugGoto(h.rect[0] + 13.5, h.rect[1] + 10.5);
    game.debugSkipTime(0.2);
    expect(game.world.hallHere?.hall.key).toBe("wanlun");
    expect(game.world.hallHere?.storey).toBe(0);
    expect(game.snapshot().banner?.title).toBe(h.name);
    // and a fast-travel out closes it up again
    game.debugGoto(...w.waypoints.sect);
    game.debugSkipTime(0.2);
    expect(game.world.hallHere).toBeNull();
    expect(w.map.kind(h.rect[0] + 13, h.rect[1] + 10)).toBe("roof");
  });
});

describe("the halls' moving quests", () => {
  const talk = (game: Game, key: string) => {
    const steps = npcScript(key, game.state);
    let s = game.state;
    for (const st of steps) if ("mutate" in st && st.mutate) s = st.mutate(s);
    game.debugPatch({ flags: s.flags, stones: s.stones, pills: s.pills });
  };

  it("sends her after three borrowers, one on each floor of the pavilion, and rewards their return", () => {
    const game = new Game(newGame(), { seed: 1 });
    expect(hasNews("gh-wen", game.state)).toBe(true);
    talk(game, "gh-wen");
    expect(game.state.flags["cj:asked"]).toBe(true);
    for (const k of ["gh-borrow1", "gh-borrow2", "gh-borrow3"]) {
      expect(hasNews(k, game.state), k).toBe(true);
      talk(game, k);
      expect(hasNews(k, game.state), k).toBe(false);
    }
    const before = game.state.stones;
    expect(hasNews("gh-wen", game.state)).toBe(true);
    talk(game, "gh-wen");
    expect(game.state.flags["cj:done"]).toBe(true);
    expect(game.state.stones).toBeGreaterThan(before);
  });

  it("relays a question up the debating hall and its answer back down", () => {
    const game = new Game(newGame(), { seed: 1 });
    talk(game, "gh-pan");
    expect(game.state.flags["wl:asked"]).toBe(true);
    // the furnace master will not answer before the debater has
    expect(hasNews("gh-rong", game.state)).toBe(false);
    talk(game, "gh-ji");
    expect(game.state.flags["wl:ji"]).toBe(true);
    expect(hasNews("gh-rong", game.state)).toBe(true);
    talk(game, "gh-rong");
    talk(game, "gh-pan");
    expect(game.state.flags["wl:done"]).toBe(true);
  });
});
