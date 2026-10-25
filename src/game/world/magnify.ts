import { hash2 } from "../pixel/noise";
import { footTiles, originFor, type PropId } from "../art/props";
import { placementTiles, type PropPlacement } from "./areas";
import { WORLD_SCALE } from "./layout";
import { LIQUID, TileMap, TILE_KINDS } from "./tilemap";

/**
 * Magnifying the authoring grid into the world: each authoring tile becomes
 * WORLD_SCALE × WORLD_SCALE world tiles. The terrain is upscaled with Scale2x
 * (the pixel-art upscaler), so coastlines, paths and lawns come out with
 * smooth diagonals instead of blocky staircases, and placements move to the
 * matching world tiles. People, beasts and most props keep their size;
 * buildings grow with the land they stand on.
 */

const S = WORLD_SCALE;

/** Buildings and other structures that grow with the land, and by how much. */
export const STRUCTURE_SCALE: Partial<Record<PropId, number>> = {
  gate: 2,
  pavilion: 2,
  swordtomb: 2,
  forge: 2,
  dais: 2,
  bloodaltar: 2,
  pagoda: 2,
  teahouse: 2,
  tent: 2,
  waterwheel: 2,
  ruin: 2,
  hall: 2,
  house: 3,
  lanterns: 2,
  bell: 2,
  stupa: 2,
  lighthouse: 2,
  ship: 2,
  stilthouse: 3,
};

/** Props of the wild that are scattered more thickly once the land doubles (a second one shares the tile block). */
const NATURE = new Set<PropId>(["pine", "cherry", "maple", "bamboo", "willow", "deadtree", "rock", "boulder", "tallgrass", "reeds", "bones", "spikes", "crystal", "karst", "haystack", "peachtree", "teabush", "snowpine", "palm"]);
/** What may spring up beside each kind of nature prop. */
const COMPANION: Partial<Record<PropId, PropId[]>> = {
  pine: ["pine", "rock", "tallgrass"],
  cherry: ["tallgrass", "cherry"],
  peachtree: ["tallgrass", "peachtree", "peachtree"],
  maple: ["maple", "tallgrass"],
  bamboo: ["bamboo", "bamboo", "tallgrass"],
  willow: ["reeds", "tallgrass"],
  deadtree: ["bones", "rock"],
  boulder: ["rock"],
  crystal: ["rock"],
  karst: ["rock", "tallgrass"],
  haystack: ["tallgrass"],
  teabush: ["teabush", "teabush", "tallgrass"],
  snowpine: ["snowpine", "rock"],
  palm: ["palm", "tallgrass", "rock"],
};

/** The world tile blocks an authoring tile turns into: [top-left, top-right, bottom-left, bottom-right]. */
const SUB: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

/**
 * Scale2x a tile map (kinds and heights together). A corner takes its
 * neighbours' tile when the two neighbours agree and the shape is a real
 * diagonal edge, which rounds off staircases. Corners never sink or rise by
 * more than a level, and protected tiles (roads, bridges) are never eaten
 * by water or the void.
 */
export function magnifyMap(m: TileMap, protect?: (i: number, j: number) => boolean): TileMap {
  const out = new TileMap(m.w * S, m.h * S, "void", 0);
  // each tile's kind and height packed into one key, so neighbours compare in one go
  const keys = new Int32Array(m.w * m.h);
  for (let n = 0; n < keys.length; n++) keys[n] = m.kinds[n] * 256 + (m.heights[n] + 64);
  const VOID = TILE_KINDS.indexOf("void");
  const wet = TILE_KINDS.map((k) => k === "void" || !!LIQUID[k]);
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      const idx = j * m.w + i;
      const P = keys[idx];
      const hP = m.heights[idx];
      const A = j > 0 ? keys[idx - m.w] : P;
      const B = i + 1 < m.w ? keys[idx + 1] : P;
      const C = i > 0 ? keys[idx - 1] : P;
      const D = j + 1 < m.h ? keys[idx + m.w] : P;
      const guarded = protect?.(i, j) ?? false;
      const ok = (v: number) => {
        if (v === P) return true;
        const kind = (v / 256) | 0;
        const h = (v % 256) - 64;
        if (Math.abs(h - hP) > 1) return false;
        if (guarded && (kind === VOID || wet[kind])) return false;
        return true;
      };
      const pick = (cond: boolean, v: number) => (cond && ok(v) ? v : P);
      const e0 = pick(C === A && C !== D && A !== B, A);
      const e1 = pick(A === B && A !== C && B !== D, B);
      const e2 = pick(D === C && D !== B && C !== A, C);
      const e3 = pick(B === D && B !== A && D !== C, D);
      // Scale2x only does 2×; larger scales repeat the corner quadrants
      for (let dj = 0; dj < S; dj++)
        for (let di = 0; di < S; di++) {
          const v = dj < S / 2 ? (di < S / 2 ? e0 : e1) : di < S / 2 ? e2 : e3;
          const o = (j * S + dj) * out.w + i * S + di;
          out.kinds[o] = (v / 256) | 0;
          out.heights[o] = (v % 256) - 64;
        }
    }
  return out;
}

/**
 * The world tile a point placement on authoring tile (i, j) moves to: the
 * first corner of its block that kept the authoring tile's own ground (so a
 * chest by the shore never ends up in the water).
 */
export function pointTile(coarse: TileMap, fine: TileMap, i: number, j: number, jitter = false): [number, number] {
  const k = coarse.kind(i, j);
  const h = coarse.height(i, j);
  const start = jitter ? Math.floor(hash2(i, j, 211) * 4) : 0;
  for (let n = 0; n < 4; n++) {
    const [di, dj] = SUB[(start + n) % 4];
    const fi = i * S + di;
    const fj = j * S + dj;
    if (fine.kind(fi, fj) === k && fine.height(fi, fj) === h) return [fi, fj];
  }
  return [i * S, j * S];
}

/** Move a prop placement from the authoring grid into the world, k times its size (structures). */
export function magnifyProp(p: PropPlacement, coarse: TileMap, fine: TileMap, k = STRUCTURE_SCALE[p.id] ?? 1): PropPlacement {
  const [i0, j0, i1, j1] = placementTiles(p);
  if (k === 1 && i0 === i1 && j0 === j1) {
    const [i, j] = pointTile(coarse, fine, p.i, p.j, NATURE.has(p.id));
    return { id: p.id, i, j };
  }
  return magnifyBuilding(p, k);
}

/** A structure on the authoring grid, grown k times and centred on the world block it stood on. */
export function magnifyBuilding(p: PropPlacement, k: number): PropPlacement {
  const [i0, j0, i1, j1] = placementTiles(p);
  const at = originFor(p.id, ((i0 + i1 + 1) / 2) * S, ((j0 + j1 + 1) / 2) * S, k);
  return { id: p.id, i: Math.floor(at[0]), j: Math.floor(at[1]), k, at };
}

/** A companion prop (a second pine, a rock under a maple) for a nature prop, in another corner of its block. */
export function companionOf(p: PropPlacement, placed: PropPlacement, coarse: TileMap, fine: TileMap, chance = 0.55): PropPlacement | null {
  if (!NATURE.has(p.id) || hash2(p.i, p.j, 212) > chance) return null;
  const pool = COMPANION[p.id] ?? [p.id];
  const id = pool[Math.floor(hash2(p.i, p.j, 213) * pool.length)];
  const k = coarse.kind(p.i, p.j);
  const start = Math.floor(hash2(p.i, p.j, 214) * 4);
  for (let n = 0; n < 4; n++) {
    const [di, dj] = SUB[(start + n) % 4];
    const fi = p.i * S + di;
    const fj = p.j * S + dj;
    if ((fi !== placed.i || fj !== placed.j) && fine.kind(fi, fj) === k) return { id, i: fi, j: fj };
  }
  return null;
}

/** World tiles covered by a magnified building, as the room inside it must match. */
export function buildingTiles(p: PropPlacement): [number, number, number, number] {
  const [x, y] = p.at ?? [p.i + 0.5, p.j + 0.5];
  return footTiles(p.id, x, y, p.k ?? 1);
}
