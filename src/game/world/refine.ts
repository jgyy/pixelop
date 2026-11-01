import { LIQUID, TILE_KINDS, type TileKind } from "./tilemap";

/**
 * The fine grid: every tile of the world is split into FINE × FINE cells half
 * its size, so the land is shaped (and walked) in squares half as big as the
 * tiles the world is authored in.
 *
 * The cells are not stored. Each is worked out from its tile and the four
 * tiles beside it, the way the Scale2x pixel-art upscaler works: a corner of a
 * tile takes after its two neighbours when they agree and the shape there is
 * a real diagonal edge. So shores, cliff tops, snow lines, paths and the
 * borders between biomes come out in steps half as tall and wide as before,
 * with the staircases rounded off, while a straight edge stays straight.
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
export const FINE = 2;

const K = TILE_KINDS;
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

/** A packed tile from any map-like source (outside the map is void). */
function keyAt(m: CoarseLike, i: number, j: number): number {
  const k = m.kind(i, j);
  return pack(K.indexOf(k), k === "void" ? 0 : m.height(i, j));
}

/**
 * The packed kind and height of fine cell (fi, fj): corner `q` of tile
 * (⌊fi / 2⌋, ⌊fj / 2⌋), q = 0 top-left, 1 top-right, 2 bottom-left,
 * 3 bottom-right (in the tile map's own i/j).
 */
export function fineKey(m: CoarseLike, fi: number, fj: number, square?: (i: number, j: number) => boolean): number {
  const i = Math.floor(fi / FINE);
  const j = Math.floor(fj / FINE);
  const P = keyAt(m, i, j);
  const pk = kindOf(P);
  if (SQUARE[pk] || square?.(i, j)) return P;
  const q = (fi - i * FINE) + 2 * (fj - j * FINE);
  // A above, B right, C left, D below (beyond the map's edge, a tile is taken to go on as itself)
  const A = j > 0 ? keyAt(m, i, j - 1) : P;
  const B = i + 1 < m.w ? keyAt(m, i + 1, j) : P;
  const C = i > 0 ? keyAt(m, i - 1, j) : P;
  const D = j + 1 < m.h ? keyAt(m, i, j + 1) : P;
  let v = P;
  if (q === 0 && C === A && C !== D && A !== B) v = A;
  else if (q === 1 && A === B && A !== C && B !== D) v = B;
  else if (q === 2 && D === C && D !== B && C !== A) v = C;
  else if (q === 3 && B === D && B !== A && D !== C) v = D;
  if (v === P) return P;
  const vk = kindOf(v);
  if (SQUARE[vk]) return P;
  // (the void has no height to compare: land may round off into it, and fill a corner of it, freely)
  if (vk !== VOID && pk !== VOID && Math.abs(heightOf(v) - heightOf(P)) > 1) return P;
  // the ways people walk are never eaten by water or the void
  if (PATH[pk] && WET[vk]) return P;
  return v;
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
