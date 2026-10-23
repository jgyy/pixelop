import { fbm, hash2 } from "../pixel/noise";
import type { PropId } from "../art/props";
import type { AreaId } from "./ids";

/** The jianghu: a miniature isometric continent linking the six regions. */

export const MAP_W = 56;
export const MAP_H = 44;

export type Biome = "sea" | "shore" | "plain" | "meadow" | "forest" | "bamboo" | "mountain" | "snow" | "ash" | "lava" | "lake" | "river" | "road";

export interface MapNode {
  id: AreaId;
  x: number;
  y: number;
  icon: PropId;
  extra?: { icon: PropId; dx: number; dy: number }[];
}

export const NODES: Record<AreaId, MapNode> = {
  sect: { id: "sect", x: 44, y: 9, icon: "hall", extra: [{ icon: "pine", dx: -2, dy: 1 }, { icon: "cherry", dx: 1.5, dy: 1.5 }] },
  village: { id: "village", x: 27, y: 22, icon: "house", extra: [{ icon: "house", dx: 1.6, dy: -1.2 }, { icon: "maple", dx: -1.4, dy: 1 }] },
  bamboo: { id: "bamboo", x: 14, y: 31, icon: "spirittree", extra: [{ icon: "bamboo", dx: 1.5, dy: 0.5 }, { icon: "bamboo", dx: -1, dy: 1.5 }, { icon: "bamboo", dx: 0.5, dy: -1.6 }] },
  lake: { id: "lake", x: 38, y: 30, icon: "pavilion", extra: [{ icon: "willow", dx: 2, dy: 1 }] },
  valley: { id: "valley", x: 9, y: 13, icon: "bloodaltar", extra: [{ icon: "spikes", dx: 1.6, dy: 1 }, { icon: "deadtree", dx: -1.5, dy: 1.2 }] },
  peak: { id: "peak", x: 27, y: 5, icon: "dais", extra: [{ icon: "crystal", dx: 1.4, dy: -1 }, { icon: "crystal", dx: -1.2, dy: 1.2 }] },
};

export const EDGES: [AreaId, AreaId][] = [
  ["sect", "village"],
  ["village", "bamboo"],
  ["village", "lake"],
  ["bamboo", "valley"],
  ["lake", "bamboo"],
  ["sect", "peak"],
];

export function neighbours(id: AreaId): AreaId[] {
  return EDGES.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
}

/** Road polyline between two nodes (gentle bend through a midpoint). */
export function route(a: AreaId, b: AreaId): [number, number][] {
  const A = NODES[a];
  const B = NODES[b];
  const mx = (A.x + B.x) / 2 + (hash2(A.x, B.y, 3) - 0.5) * 6;
  const my = (A.y + B.y) / 2 + (hash2(B.x, A.y, 4) - 0.5) * 6;
  const pts: [number, number][] = [];
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    const x = (1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * mx + t * t * B.x;
    const y = (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * my + t * t * B.y;
    pts.push([x, y]);
  }
  return pts;
}

export interface MapCell {
  biome: Biome;
  h: number;
}

let terrain: MapCell[] | null = null;

const near = (x: number, y: number, cx: number, cy: number, r: number) => Math.max(0, 1 - Math.hypot(x - cx, y - cy) / r);

/** Heightmap + biomes, generated once. */
export function mapTerrain(): MapCell[] {
  if (terrain) return terrain;
  const cells: MapCell[] = [];
  const riverPts: [number, number][] = [];
  for (let k = 0; k <= 60; k++) {
    const t = k / 60;
    riverPts.push([22 + t * 30 + Math.sin(t * 9) * 3, 4 + t * 34 + Math.sin(t * 5) * 2]);
  }
  const roads = EDGES.flatMap(([a, b]) => route(a, b));
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const n = fbm(x * 0.09, y * 0.09, 17);
      let h = 1 + n * 2.2;
      h += near(x, y, 44, 9, 10) * 6 + near(x, y, 27, 4, 9) * 7 + near(x, y, 36, 6, 12) * 4 + near(x, y, 16, 6, 10) * 3;
      h += Math.max(0, 6 - y) * 0.5;
      const coast = x + y * 0.6 - (62 + (fbm(x * 0.15, y * 0.15, 3) - 0.5) * 8);
      let biome: Biome = "plain";
      if (coast > 0) {
        biome = coast > 2.5 ? "sea" : "shore";
        h = coast > 2.5 ? 0 : 1;
      } else if (near(x, y, 38, 31, 4.6) > 0) {
        biome = "lake";
        h = 0.6;
      } else if (riverPts.some(([rx, ry]) => Math.hypot(rx - x, ry - y) < 1.1) && h < 6) {
        biome = "river";
        h = Math.max(0.6, Math.floor(h) - 0.4);
      } else if (h > 7.2) biome = "snow";
      else if (h > 4.6) biome = "mountain";
      else if (Math.hypot(x - 10, y - 13) < 9 + fbm(x * 0.2, y * 0.2, 5) * 3) biome = hash2(x, y, 8) > 0.95 ? "lava" : "ash";
      else if (Math.hypot(x - 14, y - 31) < 8 + fbm(x * 0.2, y * 0.2, 6) * 3) biome = "bamboo";
      else if (fbm(x * 0.14, y * 0.14, 9) > 0.58) biome = "forest";
      else if (hash2(x, y, 2) > 0.7) biome = "meadow";
      if (biome !== "sea" && biome !== "lake" && biome !== "river" && biome !== "shore" && roads.some(([rx, ry]) => Math.hypot(rx - x - 0.5, ry - y - 0.5) < 0.6)) biome = "road";
      cells.push({ biome, h: biome === "lava" ? Math.max(0, Math.round(h) - 1) : Math.round(h) });
    }
  // flatten the ground under each settlement
  for (const node of Object.values(NODES))
    for (let y = node.y - 2; y <= node.y + 2; y++)
      for (let x = node.x - 2; x <= node.x + 2; x++) {
        const c = cells[y * MAP_W + x];
        if (c && c.biome !== "sea" && c.biome !== "lake") c.h = cells[node.y * MAP_W + node.x].h;
      }
  terrain = cells;
  return cells;
}
