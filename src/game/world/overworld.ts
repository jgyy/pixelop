import type { PropId } from "../art/props";
import { AREA_IDS, type AreaId } from "./ids";
import { toWorld, WORLD_H, WORLD_SCALE, WORLD_W } from "./layout";
import { getWorld } from "./continent";
import { LIQUID } from "./tilemap";

/**
 * The world map: a miniature of the real continuous world (one map cell per
 * 9×9 tiles), with each region's landmark marked as a sword-flight destination.
 */

export const MAP_SCALE = (9 * WORLD_SCALE) / 2;
export const MAP_W = Math.ceil(WORLD_W / MAP_SCALE);
export const MAP_H = Math.ceil(WORLD_H / MAP_SCALE);

export type Biome = "void" | "sea" | "shore" | "plain" | "meadow" | "forest" | "bamboo" | "mountain" | "snow" | "ash" | "redrock" | "lava" | "lake" | "river" | "road";

export interface MapNode {
  id: AreaId;
  x: number;
  y: number;
  icon: PropId;
  extra?: { icon: PropId; dx: number; dy: number }[];
}

/** Each region's landmark (region-local tile), where its icon stands on the map. */
const LANDMARK: Record<AreaId, [number, number]> = { sect: [15, 8], village: [16, 10], bamboo: [16, 4], lake: [15, 12], valley: [25, 5], peak: [12, 10], marsh: [16, 15], terraces: [16, 4], desert: [18, 18], harbor: [25, 6], frost: [16, 6] };

const node = (id: AreaId, icon: PropId, extra: MapNode["extra"]): MapNode => ({
  id,
  x: Math.round(toWorld(id, ...LANDMARK[id])[0] / MAP_SCALE),
  y: Math.round(toWorld(id, ...LANDMARK[id])[1] / MAP_SCALE),
  icon,
  extra,
});

export const NODES: Record<AreaId, MapNode> = {
  sect: node("sect", "hall", [{ icon: "pine", dx: -2, dy: 1 }, { icon: "cherry", dx: 1.5, dy: 1.5 }]),
  village: node("village", "house", [{ icon: "house", dx: 1.6, dy: -1.2 }, { icon: "maple", dx: -1.4, dy: 1 }]),
  bamboo: node("bamboo", "spirittree", [{ icon: "bamboo", dx: 1.5, dy: 0.5 }, { icon: "bamboo", dx: -1, dy: 1.5 }, { icon: "bamboo", dx: 0.5, dy: -1.6 }]),
  lake: node("lake", "pavilion", [{ icon: "willow", dx: 2, dy: 1 }]),
  valley: node("valley", "bloodaltar", [{ icon: "spikes", dx: 1.6, dy: 1 }, { icon: "deadtree", dx: -1.5, dy: 1.2 }]),
  peak: node("peak", "dais", [{ icon: "crystal", dx: 1.4, dy: -1 }, { icon: "crystal", dx: -1.2, dy: 1.2 }]),
  marsh: node("marsh", "stilthouse", [{ icon: "willow", dx: 1.6, dy: 0.8 }, { icon: "reeds", dx: -1.4, dy: 1.2 }]),
  terraces: node("terraces", "pavilion", [{ icon: "teabush", dx: 1.4, dy: 1.2 }, { icon: "teabush", dx: -1.2, dy: 1.6 }, { icon: "cherry", dx: -1.8, dy: -0.6 }]),
  desert: node("desert", "palm", [{ icon: "tent", dx: -1.6, dy: 0.6 }, { icon: "stupa", dx: 1.8, dy: -1.4 }]),
  harbor: node("harbor", "lighthouse", [{ icon: "ship", dx: 1.4, dy: 1.6 }, { icon: "house", dx: -1.8, dy: 1 }]),
  frost: node("frost", "hall", [{ icon: "snowpine", dx: -1.8, dy: 1 }, { icon: "stupa", dx: 1.6, dy: 0.6 }]),
};

/** Landmarks out in the wilds, in map cells (not flight destinations). */
export function mapLandmarks(): { name: string; icon: PropId; x: number; y: number }[] {
  return getWorld().landmarks.map((l) => ({ name: l.name, icon: l.icon, x: l.x / MAP_SCALE, y: l.y / MAP_SCALE }));
}

/** Sword-flight path between two map points: a gentle arc. */
export function flightPath(from: [number, number], to: [number, number]): [number, number][] {
  const [ax, ay] = from;
  const [bx, by] = to;
  const l = Math.hypot(bx - ax, by - ay);
  const mx = (ax + bx) / 2 - ((by - ay) / (l || 1)) * l * 0.12;
  const my = (ay + by) / 2 + ((bx - ax) / (l || 1)) * l * 0.12;
  const pts: [number, number][] = [];
  const n = Math.max(2, Math.ceil(l));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push([(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by]);
  }
  return pts;
}

export interface MapCell {
  biome: Biome;
  h: number;
  /** Sky islands float high above the mortal lands. */
  sky: boolean;
}

let terrain: MapCell[] | null = null;

const TREES = new Set<PropId>(["pine", "cherry", "maple", "willow", "deadtree", "spirittree"]);

/** Downsample the continuous world into map cells (generated once). */
export function mapTerrain(): MapCell[] {
  if (terrain) return terrain;
  const w = getWorld();
  const m = w.map;
  const trees = new Set<number>();
  const bamboo = new Set<number>();
  for (const p of w.props) {
    const c = Math.floor(p.j / MAP_SCALE) * MAP_W + Math.floor(p.i / MAP_SCALE);
    if (p.id === "bamboo") bamboo.add(c);
    else if (TREES.has(p.id)) trees.add(c);
  }
  const cells: MapCell[] = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const counts = new Map<string, number>();
      let solid = 0;
      let h = 0;
      let sky = false;
      for (let dj = 0; dj < MAP_SCALE; dj++)
        for (let di = 0; di < MAP_SCALE; di++) {
          const i = x * MAP_SCALE + di;
          const j = y * MAP_SCALE + dj;
          const k = m.kind(i, j);
          if (k === "void") continue;
          solid++;
          h = Math.max(h, m.height(i, j));
          counts.set(k, (counts.get(k) ?? 0) + 1);
          const r = AREA_IDS[w.regionOf[j * m.w + i]];
          if (r === "sect" || r === "peak") sky = true;
        }
      if (solid < (MAP_SCALE * MAP_SCALE) / 3) {
        cells.push({ biome: "void", h: 0, sky: false });
        continue;
      }
      const kind = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const c = y * MAP_W + x;
      const wet = [...counts.keys()].some((k) => LIQUID[k as keyof typeof LIQUID]);
      let biome: Biome;
      switch (kind) {
        case "water":
          biome = "river";
          break;
        case "deep":
          biome = "lake";
          break;
        case "lava":
          biome = "lava";
          break;
        case "sand":
          biome = "shore";
          break;
        case "dirt":
        case "plaza":
        case "stairs":
        case "wood":
          biome = "road";
          break;
        case "marble":
        case "snow":
          biome = "snow";
          break;
        case "grass":
        case "moss":
          biome = bamboo.has(c) ? "bamboo" : h >= 4 ? "mountain" : trees.has(c) ? "forest" : kind === "moss" ? "forest" : "plain";
          break;
        case "ash":
          biome = "ash";
          break;
        case "redrock":
          biome = "redrock";
          break;
        case "leaf":
          biome = bamboo.has(c) ? "bamboo" : "forest";
          break;
        case "meadow":
        case "paddy":
          biome = trees.has(c) ? "forest" : "meadow";
          break;
        default:
          biome = bamboo.has(c) ? "bamboo" : trees.has(c) ? "forest" : "plain";
      }
      if (wet && biome !== "road" && (counts.get("water") ?? 0) >= (MAP_SCALE * MAP_SCALE) / 3) biome = "river";
      // roads are narrower than a map cell: a cell with a good stripe of road through it shows the road, so they read unbroken
      const paved = (counts.get("dirt") ?? 0) + (counts.get("plaza") ?? 0) + (counts.get("wood") ?? 0) + (counts.get("stairs") ?? 0);
      if (biome !== "river" && biome !== "lake" && paved >= MAP_SCALE * MAP_SCALE * 0.22) biome = "road";
      cells.push({ biome, h: Math.round(h * 1.5) + (sky ? 7 : 0), sky });
    }
  terrain = cells;
  return cells;
}
