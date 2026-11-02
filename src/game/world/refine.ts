import { LIQUID, TILE_KINDS, type TileKind } from "./tilemap";

/**
 * The fine grid: every tile of the world is split into FINE × FINE cells a
 * quarter of its size, so the land is shaped (and walked) in squares a
 * quarter as big as the tiles the world is authored in.
 *
 * The cells are not stored. Each is worked out from its tile and the tiles
 * round it, the way the Scale4x pixel-art upscaler works (Scale2x, twice):
 * a tile is first split into four half-size cells, each corner taking after
 * its two neighbours when they agree and the shape there is a real diagonal
 * edge; then each of those cells is split the same way again, against its
 * own half-size neighbours. So shores, cliff tops, snow lines, paths and the
 * borders between biomes come out in steps a quarter as tall and wide as the
 * tiles, with the staircases rounded off into near-curves, while a straight
 * edge stays straight.
 *
 * Because the cells are a pure function of the tile map, anything the story
 * does to the land (lava breaking out, a marsh drained) shows in the fine
 * grid at once, with nothing to rebuild.
 *
 * Some things are never rounded: the tiles under a building or a tree (so
 * they keep their footings), the walls, windows and rugs of rooms and the
 * roofs of the grand halls (so rooms stay square), and corners that would
 * climb or drop more than a level (so no new cliffs appear). Roads, bridges,
 * stairs and plazas are never eaten by water or the void.
 */

/** Cells along each side of a tile. */
export const FINE = 4;
/** Each pass of the upscaler halves the cells; FINE is 2 to the power of this. */
const PASSES = 2;

const K = TILE_KINDS;
const KIND_INDEX = new Map<string, number>(K.map((k, n) => [k, n]));
const VOID = K.indexOf("void");
const WET = K.map((k) => k === "void" || !!LIQUID[k]);
/** Kinds that are never rounded, nor round anything else (rooms and roofs). */
const SQUARE = K.map((k) => k === "wall" || k === "window" || k === "rug" || k === "roof");
/** Kinds that water and the void never eat into (the ways people walk). */
const PATH = K.map((k) => k === "wood" || k === "plaza" || k === "stairs" || k === "dirt" || k === "rails" || k === "marble");

/** What the fine grid needs of a tile map. */
export interface CoarseLike {
  readonly w: number;
  readonly h: number;
  kind(i: number, j: number): TileKind;
  height(i: number, j: number): number;
}

/** A tile packed as one number (kind and height), so neighbours compare in one go. */
const pack = (kind: number, h: number) => kind * 256 + (h + 64);
const kindOf = (v: number) => (v / 256) | 0;
const heightOf = (v: number) => (v % 256) - 64;

/** A tile map's own arrays, when it has them (read straight, without going through kind() and height()). */
interface Raw {
  readonly w: number;
  readonly h: number;
  readonly kinds: Uint8Array;
  readonly heights: Int8Array;
}
const isRaw = (m: CoarseLike): m is CoarseLike & Raw => (m as Partial<Raw>).kinds instanceof Uint8Array && (m as Partial<Raw>).heights instanceof Int8Array;

/** A packed tile from any map-like source (outside the map is void). */
function keyAt(m: CoarseLike, i: number, j: number): number {
  if (isRaw(m)) {
    if (i < 0 || j < 0 || i >= m.w || j >= m.h) return pack(VOID, 0);
    const n = j * m.w + i;
    const k = m.kinds[n];
    return pack(k, k === VOID ? 0 : m.heights[n]);
  }
  const k = m.kind(i, j);
  return pack(KIND_INDEX.get(k)!, k === "void" ? 0 : m.height(i, j));
}

/**
 * One pass of the upscaler: what corner `q` (0 top-left, 1 top-right, 2
 * bottom-left, 3 bottom-right) of cell P becomes, given the cells above (A),
 * right (B), left (C) and below (D) it.
 */
function corner(P: number, A: number, B: number, C: number, D: number, q: number): number {
  let v = P;
  if (q === 0 && C === A && C !== D && A !== B) v = A;
  else if (q === 1 && A === B && A !== C && B !== D) v = B;
  else if (q === 2 && D === C && D !== B && C !== A) v = C;
  else if (q === 3 && B === D && B !== A && D !== C) v = D;
  if (v === P) return P;
  const pk = kindOf(P);
  const vk = kindOf(v);
  if (SQUARE[vk]) return P;
  // (the void has no height to compare: land may round off into it, and fill a corner of it, freely)
  if (vk !== VOID && pk !== VOID && Math.abs(heightOf(v) - heightOf(P)) > 1) return P;
  // the ways people walk are never eaten by water or the void
  if (PATH[pk] && WET[vk]) return P;
  return v;
}

/** The cell (a, b) after `pass` passes of the upscaler (pass 0 is the tile map itself). */
function passKey(m: CoarseLike, a: number, b: number, pass: number, square?: (i: number, j: number) => boolean): number {
  if (pass === 0) return keyAt(m, a, b);
  const pa = a >> 1;
  const pb = b >> 1;
  const P = passKey(m, pa, pb, pass - 1, square);
  if (SQUARE[kindOf(P)] || square?.(a >> pass, b >> pass)) return P;
  // the cells of the pass before, along each side (beyond the map's edge, a cell is taken to go on as itself)
  const span = 1 << (pass - 1);
  const cw = m.w * span;
  const ch = m.h * span;
  const A = pb > 0 ? passKey(m, pa, pb - 1, pass - 1, square) : P;
  const B = pa + 1 < cw ? passKey(m, pa + 1, pb, pass - 1, square) : P;
  const C = pa > 0 ? passKey(m, pa - 1, pb, pass - 1, square) : P;
  const D = pb + 1 < ch ? passKey(m, pa, pb + 1, pass - 1, square) : P;
  return corner(P, A, B, C, D, (a & 1) + 2 * (b & 1));
}

/**
 * The packed kind and height of fine cell (fi, fj), a cell of tile
 * (⌊fi / FINE⌋, ⌊fj / FINE⌋) in the tile map's own i/j.
 */
export function fineKey(m: CoarseLike, fi: number, fj: number, square?: (i: number, j: number) => boolean): number {
  return passKey(m, fi, fj, PASSES, square);
}

/**
 * The packed keys of a rectangle of fine cells [f0, f0 + w) × [g0, g0 + h),
 * row by row, the same as fineKey gives one at a time, but working out each
 * cell of the half-way pass only once (for painting a chunk of terrain).
 */
export function fineKeys(m: CoarseLike, f0: number, g0: number, w: number, h: number, smooth = true, square?: (i: number, j: number) => boolean): Int32Array {
  const out = new Int32Array(w * h);
  if (!smooth) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = keyAt(m, Math.floor((f0 + x) / FINE), Math.floor((g0 + y) / FINE));
    return out;
  }
  // the half-way cells this rectangle draws on, with a ring of one round them
  const a0 = Math.floor(f0 / 2) - 1;
  const b0 = Math.floor(g0 / 2) - 1;
  const hw = Math.floor((f0 + w - 1) / 2) + 2 - a0;
  const hh = Math.floor((g0 + h - 1) / 2) + 2 - b0;
  const half = new Int32Array(hw * hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) half[y * hw + x] = passKey(m, a0 + x, b0 + y, 1, square);
  const cw = m.w * 2;
  const ch = m.h * 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const fi = f0 + x;
      const fj = g0 + y;
      const pa = fi >> 1;
      const pb = fj >> 1;
      const at = (a: number, b: number) => half[(b - b0) * hw + (a - a0)];
      const P = at(pa, pb);
      if (SQUARE[kindOf(P)] || square?.(fi >> PASSES, fj >> PASSES)) {
        out[y * w + x] = P;
        continue;
      }
      const A = pb > 0 ? at(pa, pb - 1) : P;
      const B = pa + 1 < cw ? at(pa + 1, pb) : P;
      const C = pa > 0 ? at(pa - 1, pb) : P;
      const D = pb + 1 < ch ? at(pa, pb + 1) : P;
      out[y * w + x] = corner(P, A, B, C, D, (fi & 1) + 2 * (fj & 1));
    }
  return out;
}

/** The kind of fine cell (fi, fj). */
export const fineKind = (m: CoarseLike, fi: number, fj: number, square?: (i: number, j: number) => boolean): TileKind => K[kindOf(fineKey(m, fi, fj, square))];
/** The height of fine cell (fi, fj). */
export const fineHeight = (m: CoarseLike, fi: number, fj: number, square?: (i: number, j: number) => boolean): number => heightOf(fineKey(m, fi, fj, square));

export const unpackKind = (v: number): TileKind => K[kindOf(v)];
export const unpackHeight = heightOf;

/**
 * A fine-grid view of a tile map, in the same shape as the map itself
 * (kind, height, inside), so anything that walks or draws a map can walk or
 * draw the fine grid instead. Coordinates are in fine cells.
 */
export interface FineView {
  readonly w: number;
  readonly h: number;
  inside(fi: number, fj: number): boolean;
  kind(fi: number, fj: number): TileKind;
  height(fi: number, fj: number): number;
  /** The packed kind and height, for comparing cells cheaply. */
  key(fi: number, fj: number): number;
}

/** View a tile map through the fine grid; with `smooth` off, every cell is just its tile (rooms, arenas). */
export function fineView(m: CoarseLike & { inside(i: number, j: number): boolean }, smooth = true, square?: (i: number, j: number) => boolean): FineView {
  const key = smooth ? (fi: number, fj: number) => fineKey(m, fi, fj, square) : (fi: number, fj: number) => keyAt(m, Math.floor(fi / FINE), Math.floor(fj / FINE));
  return {
    w: m.w * FINE,
    h: m.h * FINE,
    inside: (fi, fj) => m.inside(Math.floor(fi / FINE), Math.floor(fj / FINE)),
    kind: (fi, fj) => K[kindOf(key(fi, fj))],
    height: (fi, fj) => heightOf(key(fi, fj)),
    key,
  };
}

/** Is a fine cell's kind one a walker can stand on (before props and flying are considered)? */
export function fineFloor(kind: TileKind, flying: boolean): boolean {
  if (kind === "void" || kind === "wall" || kind === "window" || kind === "rockwall" || kind === "roof") return false;
  if (LIQUID[kind] && !flying) return false;
  return true;
}
