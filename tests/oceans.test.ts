import { describe, expect, it } from "vitest";
import { getWorld } from "@/game/world/continent";
import { LIQUID } from "@/game/world/tilemap";
import { COARSE_H, COARSE_W, WORLD_SCALE } from "@/game/world/layout";
import { beyondRim, CONTINENTS, EDGE, EDGE_LIMIT, inEdge, inSky, pastEdge, STRAITS, straitAt } from "@/game/world/oceans";
import { oceanFrame } from "@/game/three/terrain";
import { World } from "@/game/runtime/world";

const S = WORLD_SCALE;

describe("the Encircling Sea", () => {
  const w = getWorld();
  const m = w.map;

  it("turns the cloud below the land to sea, keeping only the cloud the sect floats on", () => {
    let sea = 0;
    let cloud = 0;
    for (let j = 0; j < m.h; j += 4)
      for (let i = 0; i < m.w; i += 4) {
        const k = m.kind(i, j);
        if (k === "void") {
          cloud++;
          // what cloud is left lies under the sect's own, or past the rim of the world where the sea falls away
          expect(inSky(Math.floor(i / S), Math.floor(j / S)) || beyondRim(Math.floor(i / S), Math.floor(j / S)), `cloud at ${i},${j}`).toBe(true);
        } else if (k === "deep" || k === "water") sea++;
      }
    // (the sky past the rim runs all round the world now, but the sea still outweighs it)
    expect(sea).toBeGreaterThan(cloud * 1.5);
    expect(cloud).toBeGreaterThan(0);
  });

  it("runs deep water all round the world's edge, and turns everyone back before it", () => {
    // the edge is deep water, or past the rim, where the sea has fallen away into the clouds
    const edge = (i: number, j: number) => {
      const k = m.kind(i * S, j * S);
      return k === "deep" || (k === "void" && beyondRim(i, j));
    };
    for (let i = 0; i < COARSE_W; i += 3)
      for (const j of [0, 1, COARSE_H - 2, COARSE_H - 1]) {
        expect(edge(i, j), `${i},${j}`).toBe(true);
        expect(inEdge(i, j)).toBe(true);
      }
    for (let j = 0; j < COARSE_H; j += 3) for (const i of [0, COARSE_W - 1]) expect(edge(i, j), `${i},${j}`).toBe(true);
    // the limit lies inside the deep band
    expect(EDGE_LIMIT).toBeLessThan(EDGE * S);
    expect(pastEdge(EDGE_LIMIT - 1, 400)).toBe(true);
    expect(pastEdge(400, m.h - EDGE_LIMIT + 1)).toBe(true);
    expect(pastEdge(400, 400)).toBe(false);
  });

  it("parts the land into continents with straits, the roads crossing them on planks", () => {
    // the land (bridges left out) that each continent's heart can be walked to without crossing water
    const comp = new Int32Array(m.w * m.h).fill(-1);
    const land = (n: number) => {
      const k = m.kind(n % m.w, Math.floor(n / m.w));
      return k !== "void" && !LIQUID[k] && k !== "wood";
    };
    const fill = (start: number, id: number) => {
      const q = [start];
      comp[start] = id;
      for (let qi = 0; qi < q.length; qi++) {
        const n = q[qi];
        const i = n % m.w;
        for (const nb of [i > 0 ? n - 1 : -1, i < m.w - 1 ? n + 1 : -1, n - m.w, n + m.w]) {
          if (nb < 0 || nb >= comp.length || comp[nb] >= 0 || !land(nb)) continue;
          comp[nb] = id;
          q.push(nb);
        }
      }
      return q.length;
    };
    const ids = CONTINENTS.map((c, k) => {
      const n = c.c[1] * S * m.w + c.c[0] * S;
      expect(land(n), c.key).toBe(true);
      if (comp[n] < 0) expect(fill(n, k), c.key).toBeGreaterThan(30000);
      return comp[n];
    });
    expect(new Set(ids).size).toBe(CONTINENTS.length);
    // each strait is water most of the way, with plank bridges where the roads cross it
    for (const s of STRAITS) {
      let wet = 0;
      let planks = 0;
      let total = 0;
      for (let p = 1; p < s.pts.length; p++) {
        const [x0, y0] = s.pts[p - 1];
        const [x1, y1] = s.pts[p];
        for (let t = 0; t < 1; t += 0.05) {
          const [i, j] = [Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)];
          if (i < 0 || j < 0 || i >= COARSE_W || j >= COARSE_H || !straitAt(i, j)) continue;
          total++;
          const k = m.kind(i * S, j * S);
          if (LIQUID[k]) wet++;
          if (k === "wood") planks++;
        }
      }
      expect(wet / total, s.key).toBeGreaterThan(0.85);
      expect(planks, s.key).toBeGreaterThan(0);
    }
  });

  it("frames the map with sea out to the horizon in 3D", () => {
    const f = oceanFrame(100, 80, 50);
    expect(f.indices.length / 6).toBe(4);
    expect(f.cells!.every((c) => c === 1)).toBe(true);
    const xs = f.positions.filter((_, k) => k % 3 === 0);
    expect(Math.min(...xs)).toBe(-50);
    expect(Math.max(...xs)).toBe(150);
  });

  it("will not let her fly past the edge of the world", () => {
    const world = new World(w, { x: 400.5, y: 400.5, dir: 0 }, {}, []);
    const h = world.hero;
    h.flying = true;
    [h.x, h.y] = [EDGE_LIMIT + 0.6, 400.5];
    h.z = 0;
    for (let n = 0; n < 20; n++) world.move(h, -0.1, 0);
    expect(h.x).toBeGreaterThanOrEqual(EDGE_LIMIT);
    expect(world.bumpedEdge).toBe(true);
  });
});
