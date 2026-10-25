import { fbm } from "../pixel/noise";
import { TILE_KINDS, type TileKind, type TileMap } from "./tilemap";

/**
 * The land answers the story. A terrain patch is a set of tile changes (new
 * ground, new heights, rubble cleared or heaped up) that holds only while a
 * condition on the story flags holds: lava that cools once the Patriarch
 * falls, a hillside that slides away to bare a cave mouth, a marsh drained
 * or cleansed by the heroine's choice. Patches are written over the shared
 * tile map and taken back off again (a new game, an older save), so the map
 * always matches the save being played.
 */
export interface TerrainPatch {
  key: string;
  when: (flags: Record<string, boolean>) => boolean;
  /** Tile indices (j * w + i) and what each becomes. 255 / -128 leave the kind / height alone. */
  idx: Int32Array;
  kinds: Uint8Array;
  heights: Int8Array;
  /** 0 clear, 1 block, 255 leave alone. */
  blocks: Uint8Array;
}

const KEEP_KIND = 255;
const KEEP_HEIGHT = -128;
const KEEP_BLOCK = 255;

/** Records tile changes with the same shape tools a TileMap has, without touching the map. */
export class PatchPainter {
  private readonly cells = new Map<number, { kind?: TileKind; height?: number; block?: boolean }>();
  constructor(readonly map: TileMap) {}

  /** What the tile will be once the patch is on (pending changes first, then the map). */
  kind(i: number, j: number): TileKind {
    return this.cells.get(j * this.map.w + i)?.kind ?? this.map.kind(i, j);
  }

  height(i: number, j: number): number {
    return this.cells.get(j * this.map.w + i)?.height ?? this.map.height(i, j);
  }

  set(i: number, j: number, kind?: TileKind, height?: number, block?: boolean): this {
    if (!this.map.inside(i, j)) return this;
    const k = j * this.map.w + i;
    const c = this.cells.get(k) ?? {};
    if (kind !== undefined) c.kind = kind;
    if (height !== undefined) c.height = height;
    if (block !== undefined) c.block = block;
    this.cells.set(k, c);
    return this;
  }

  /** Change every tile of a (noisy) disc that `fn` returns something for. */
  disc(ci: number, cj: number, r: number, fn: (i: number, j: number, d: number) => { kind?: TileKind; height?: number; block?: boolean } | void, rough = 0, seed = 1): this {
    for (let j = Math.floor(cj - r - 2); j <= Math.ceil(cj + r + 2); j++)
      for (let i = Math.floor(ci - r - 2); i <= Math.ceil(ci + r + 2); i++) {
        const d = Math.hypot(i - ci, j - cj);
        const rr = r + (rough ? (fbm(i * 0.35, j * 0.35, seed) - 0.5) * rough * 2 : 0);
        if (d > rr || this.map.kind(i, j) === "void") continue;
        const v = fn(i, j, d / Math.max(0.01, rr));
        if (v) this.set(i, j, v.kind, v.height, v.block);
      }
    return this;
  }

  /** Change every tile within width / 2 of a polyline. */
  path(points: [number, number][], width: number, fn: (i: number, j: number, u: number) => { kind?: TileKind; height?: number; block?: boolean } | void): this {
    const seen = new Set<number>();
    let total = 0;
    for (let p = 1; p < points.length; p++) total += Math.hypot(points[p][0] - points[p - 1][0], points[p][1] - points[p - 1][1]);
    let run = 0;
    for (let p = 1; p < points.length; p++) {
      const [x0, y0] = points[p - 1];
      const [x1, y1] = points[p];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(len * 3));
      for (let s = 0; s <= steps; s++) {
        const cx = x0 + ((x1 - x0) * s) / steps;
        const cy = y0 + ((y1 - y0) * s) / steps;
        const u = total ? (run + (len * s) / steps) / total : 0;
        for (let j = Math.floor(cy - width); j <= Math.ceil(cy + width); j++)
          for (let i = Math.floor(cx - width); i <= Math.ceil(cx + width); i++) {
            const k = j * this.map.w + i;
            if (seen.has(k) || Math.hypot(i - cx, j - cy) > width / 2 + 0.2 || !this.map.inside(i, j)) continue;
            seen.add(k);
            const v = fn(i, j, u);
            if (v) this.set(i, j, v.kind, v.height, v.block);
          }
      }
      run += len;
    }
    return this;
  }

  build(key: string, when: TerrainPatch["when"]): TerrainPatch {
    const n = this.cells.size;
    const patch: TerrainPatch = { key, when, idx: new Int32Array(n), kinds: new Uint8Array(n).fill(KEEP_KIND), heights: new Int8Array(n).fill(KEEP_HEIGHT), blocks: new Uint8Array(n).fill(KEEP_BLOCK) };
    let k = 0;
    for (const [idx, c] of this.cells) {
      patch.idx[k] = idx;
      if (c.kind !== undefined) patch.kinds[k] = TILE_KINDS.indexOf(c.kind);
      if (c.height !== undefined) patch.heights[k] = c.height;
      if (c.block !== undefined) patch.blocks[k] = c.block ? 1 : 0;
      k++;
    }
    return patch;
  }
}

/** What a map looked like under each patch that is on, so it can be taken back off. */
interface Applied {
  sig: string;
  undo: { idx: Int32Array; kinds: Uint8Array; heights: Int8Array; blocked: Uint8Array }[];
}
const applied = new WeakMap<TileMap, Applied>();

/**
 * Bring a map's patches in line with the story flags. Returns the indices of
 * the tiles that changed (empty when nothing did), so painted tiles can be
 * thrown away and the change shown.
 */
export function applyPatches(map: TileMap, patches: readonly TerrainPatch[] | undefined, flags: Record<string, boolean>): number[] {
  if (!patches?.length) return [];
  const on = patches.filter((p) => p.when(flags));
  const sig = on.map((p) => p.key).join("|");
  const state = applied.get(map) ?? { sig: "", undo: [] };
  if (state.sig === sig) return [];
  const changed = new Set<number>();
  // take everything back off, newest first, then lay the patches that hold back on in order
  for (let u = state.undo.length - 1; u >= 0; u--) {
    const d = state.undo[u];
    for (let k = 0; k < d.idx.length; k++) {
      const i = d.idx[k];
      map.kinds[i] = d.kinds[k];
      map.heights[i] = d.heights[k];
      map.blocked[i] = d.blocked[k];
      changed.add(i);
    }
  }
  const undo: Applied["undo"] = [];
  for (const p of on) {
    const n = p.idx.length;
    const d = { idx: p.idx, kinds: new Uint8Array(n), heights: new Int8Array(n), blocked: new Uint8Array(n) };
    for (let k = 0; k < n; k++) {
      const i = p.idx[k];
      d.kinds[k] = map.kinds[i];
      d.heights[k] = map.heights[i];
      d.blocked[k] = map.blocked[i];
      if (p.kinds[k] !== KEEP_KIND) map.kinds[i] = p.kinds[k];
      if (p.heights[k] !== KEEP_HEIGHT) map.heights[i] = p.heights[k];
      if (p.blocks[k] !== KEEP_BLOCK) map.blocked[i] = p.blocks[k];
      changed.add(i);
    }
    undo.push(d);
  }
  applied.set(map, { sig, undo });
  return [...changed];
}

/** The tallest height any patch can raise a tile to. */
export function patchMaxHeight(patches: readonly TerrainPatch[] | undefined): number {
  let h = -99;
  for (const p of patches ?? []) for (let k = 0; k < p.heights.length; k++) if (p.heights[k] !== KEEP_HEIGHT) h = Math.max(h, p.heights[k]);
  return h;
}
