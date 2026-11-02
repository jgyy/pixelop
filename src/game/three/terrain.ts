import { mix, parseColor, shade } from "../pixel/color";
import { LEVEL_U, TILE_U } from "../iso/raster";
import { groundTexture } from "../art/tiles";
import { groundTurns, seasonTexel } from "../art/seasons";
import { LIQUID, TILE_KINDS, type TileKind, type TileMap } from "../world/tilemap";
import type { Season } from "../world/calendar";
import { FINE, fineKeys, unpackHeight, unpackKind } from "../world/refine";

/**
 * Terrain for the 3D view, built a chunk at a time from the same tile map the
 * game walks on: a textured top for every solid tile (painted texel by texel
 * from the very ground textures the isometric columns use), animated liquid
 * surfaces, and cliff walls wherever the land steps down.
 */

/** Tiles along a chunk's side. */
export const CHUNK = 32;
/** Texels per tile on a chunk's ground texture. */
export const TEXELS = 16;
/** Height of one terrain level in tiles (the art's own proportion). */
export const LEVEL = LEVEL_U / TILE_U;

export interface Mesh {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  /** Per vertex: the wall swatch (walls) or the liquid kind (liquids). */
  cells?: number[];
}

export interface Chunk {
  ci: number;
  cj: number;
  top: Mesh;
  /** RGBA, `size` × `size` texels: the chunk's ground as painted. */
  tex: Uint8Array;
  size: number;
  liquid: Mesh;
  walls: Mesh;
}

export interface ChunkOpts {
  /** Lowest level the land's walls reach down to (beneath it, open sky or nothing). */
  base: number;
  /** Floating islands: walls that face the void hang far down as rocky undersides. */
  floating: boolean;
  /** Underground: every cliff is raw rock. */
  rocky: boolean;
  /** The season the year shows at a tile, or null where it does not reach. */
  season: (i: number, j: number) => Season | null;
  /** Round the land off on the fine grid (the open world and the caves; rooms stay square). */
  smooth?: boolean;
}

/** Liquid kinds as the liquid shader numbers them. */
export const LIQUID_CODE: Partial<Record<TileKind, number>> = { water: 0, deep: 1, lava: 2, paddy: 3 };
/** Wall swatches as the wall shader finds them in its atlas (a rocky variant follows the plain ones). */
export const WALL_KINDS = TILE_KINDS;

/** What a chunk needs of the tile map (the worker hands it a window onto the real one). */
export type GroundMap = Pick<TileMap, "kind" | "height" | "inside" | "w" | "h"> & { isBlocked?(i: number, j: number): boolean };

/** A window of a tile map, copied out so it can cross to a worker (one tile of border all round). */
export interface MapWindow {
  i0: number;
  j0: number;
  w: number;
  h: number;
  mapW: number;
  mapH: number;
  kinds: Uint8Array;
  heights: Int8Array;
  /** Season code per tile: 0 where the year does not reach, else 1 + index in SEASON_CODES. */
  seasons: Uint8Array;
  /** Tiles a prop stands on (kept square on the fine grid). */
  blocked: Uint8Array;
}

/** Tiles of border a window carries round its chunk (the fine grid looks two tiles out to round a cell's neighbour). */
const BORDER = 2;

export const SEASON_CODES: Season[] = ["spring", "summer", "autumn", "winter"];

/** Copy out the window of the map a chunk (and its border) covers. */
export function mapWindow(map: TileMap, ci: number, cj: number, season: (i: number, j: number) => Season | null): MapWindow {
  const i0 = ci * CHUNK - BORDER;
  const j0 = cj * CHUNK - BORDER;
  const w = CHUNK + BORDER * 2;
  const h = CHUNK + BORDER * 2;
  const kinds = new Uint8Array(w * h);
  const heights = new Int8Array(w * h);
  const seasons = new Uint8Array(w * h);
  const blocked = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [i, j] = [i0 + x, j0 + y];
      if (!map.inside(i, j)) continue;
      kinds[y * w + x] = map.kinds[j * map.w + i];
      heights[y * w + x] = map.heights[j * map.w + i];
      blocked[y * w + x] = map.blocked[j * map.w + i];
      const s = season(i, j);
      seasons[y * w + x] = s ? 1 + SEASON_CODES.indexOf(s) : 0;
    }
  return { i0, j0, w, h, mapW: map.w, mapH: map.h, kinds, heights, seasons, blocked };
}

/** The tile map as seen through a window (void beyond its edge). */
export function windowMap(win: MapWindow): GroundMap & { season: (i: number, j: number) => Season | null } {
  const at = (i: number, j: number) => {
    const x = i - win.i0;
    const y = j - win.j0;
    return x >= 0 && y >= 0 && x < win.w && y < win.h ? y * win.w + x : -1;
  };
  return {
    w: win.mapW,
    h: win.mapH,
    inside: (i, j) => i >= 0 && j >= 0 && i < win.mapW && j < win.mapH,
    isBlocked: (i, j) => {
      const k = at(i, j);
      return k >= 0 && win.blocked[k] === 1;
    },
    kind: (i, j) => {
      const k = at(i, j);
      return k < 0 ? "void" : TILE_KINDS[win.kinds[k]];
    },
    height: (i, j) => {
      const k = at(i, j);
      return k < 0 ? -99 : win.heights[k];
    },
    season: (i, j) => {
      const k = at(i, j);
      return k < 0 || !win.seasons[k] ? null : SEASON_CODES[win.seasons[k] - 1];
    },
  };
}

const emptyMesh = (cells = false): Mesh => ({ positions: [], normals: [], uvs: [], indices: [], ...(cells ? { cells: [] } : {}) });

function quad(m: Mesh, p: number[][], n: number[], uv: number[][], cell?: number): void {
  const k = m.positions.length / 3;
  for (let v = 0; v < 4; v++) {
    m.positions.push(...p[v]);
    m.normals.push(...n);
    m.uvs.push(...uv[v]);
    if (cell !== undefined) m.cells!.push(cell);
  }
  m.indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
}

/** A packed fine cell's walkable surface level (liquids lie a quarter level low; void is a long way down). */
function cellSurface(v: number): number {
  const k = unpackKind(v);
  return k === "void" ? -99 : unpackHeight(v) - (LIQUID[k] ? 0.25 : 0);
}

/** Fine cells along a chunk's side, and texels along a fine cell's. */
const CELLS = CHUNK * FINE;
const CELL_TEXELS = TEXELS / FINE;

/**
 * A chunk of ground, built on the fine grid (see world/refine.ts): cells a
 * quarter of a tile across, each with its own kind and height, so shores,
 * cliff tops and the borders between kinds of ground step in quarter-size
 * squares. Cells that agree are laid as one quad (a whole tile where all of
 * its cells agree, as most of the land does, else a quarter of it, else cell
 * by cell); walls are raised along every cell edge where the land drops.
 */
export function buildChunk(map: GroundMap, ci: number, cj: number, opts: ChunkOpts): Chunk {
  const size = CHUNK * TEXELS;
  const tex = new Uint8Array(size * size * 4);
  const top = emptyMesh();
  const liquid = emptyMesh(true);
  const walls = emptyMesh(true);
  const f0 = ci * CELLS;
  const g0 = cj * CELLS;
  // the chunk's cells and a ring of one round them, packed, so each is worked out once
  const W = CELLS + 2;
  const keys = fineKeys(map, f0 - 1, g0 - 1, W, W, opts.smooth ?? true, map.isBlocked ? (i, j) => map.isBlocked!(i, j) : undefined);
  const keyAt = (fi: number, fj: number) => keys[(fj - g0 + 1) * W + (fi - f0 + 1)];
  const U = 1 / FINE;
  /** Split a square of cells until each piece is all one kind and height: [fi, fj, cells across]. */
  const split = (fi: number, fj: number, n: number, out: [number, number, number][]) => {
    const k = keyAt(fi, fj);
    let same = true;
    for (let b = 0; b < n && same; b++) for (let a = 0; a < n && same; a++) same = keyAt(fi + a, fj + b) === k;
    if (same || n === 1) {
      out.push([fi, fj, n]);
      return;
    }
    const h = n / 2;
    split(fi, fj, h, out);
    split(fi + h, fj, h, out);
    split(fi, fj + h, h, out);
    split(fi + h, fj + h, h, out);
  };
  for (let dj = 0; dj < CHUNK; dj++)
    for (let di = 0; di < CHUNK; di++) {
      const i = ci * CHUNK + di;
      const j = cj * CHUNK + dj;
      if (!map.inside(i, j)) continue;
      const season = opts.season(i, j);
      const spans: [number, number, number][] = [];
      split(i * FINE, j * FINE, FINE, spans);
      for (const [fi, fj, n] of spans) {
        const v = keyAt(fi, fj);
        const kind = unpackKind(v);
        if (kind === "void") continue;
        const h = cellSurface(v);
        const y = h * LEVEL;
        const [x0, x1, z0, z1] = [fi * U, (fi + n) * U, -fj * U, -(fj + n) * U];
        const corners = [
          [x0, y, z0],
          [x1, y, z0],
          [x1, y, z1],
          [x0, y, z1],
        ];
        const code = LIQUID_CODE[kind];
        if (code !== undefined) {
          quad(
            liquid,
            corners,
            [0, 1, 0],
            [
              [x0, -z0],
              [x1, -z0],
              [x1, -z1],
              [x0, -z1],
            ],
            code,
          );
        } else {
          const lu = fi - f0;
          const lv = fj - g0;
          const u0 = lu / CELLS;
          const u1 = (lu + n) / CELLS;
          const v0 = lv / CELLS;
          const v1 = (lv + n) / CELLS;
          quad(
            top,
            corners,
            [0, 1, 0],
            [
              [u0, v0],
              [u1, v0],
              [u1, v1],
              [u0, v1],
            ],
          );
          for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) paintTop(keyAt, fi + a, fj + b, kind, tex, lu + a, lv + b, size, season);
        }
        // cliff walls down to each lower neighbour, a cell edge at a time
        for (let s = 0; s < n; s++) {
          // [neighbour i, j, the edge's two ends, its outward normal, which cell along the edge it is]
          const edges: [number, number, number[][], number[], number][] = [
            [fi + n, fj + s, [[x1, -(fj + s) * U], [x1, -(fj + s + 1) * U]], [1, 0, 0], fj + s],
            [fi - 1, fj + s, [[x0, -(fj + s + 1) * U], [x0, -(fj + s) * U]], [-1, 0, 0], fj + s],
            [fi + s, fj + n, [[(fi + s + 1) * U, z1], [(fi + s) * U, z1]], [0, 0, -1], fi + s],
            [fi + s, fj - 1, [[(fi + s) * U, z0], [(fi + s + 1) * U, z0]], [0, 0, 1], fi + s],
          ];
          for (const [ni, nj, edge, nrm, along] of edges) {
            const nv = keyAt(ni, nj);
            const void_ = unpackKind(nv) === "void";
            const below = void_ ? opts.base - (opts.floating ? 6 : 0) : cellSurface(nv);
            if (below >= h - 0.01) continue;
            const yb = Math.max(below, opts.base - (opts.floating ? 6 : 1)) * LEVEL;
            const [[ax, az], [bx, bz]] = edge;
            // swatch v: 4 levels per swatch, measured down from the top of the land; u: half a swatch per cell
            const depth = (h - yb / LEVEL) / 4;
            const cell = TILE_KINDS.indexOf(kind) + (opts.rocky && !LIQUID[kind] && kind !== "rockwall" && kind !== "rails" ? TILE_KINDS.length : 0);
            const ua = (along % FINE) / FINE;
            quad(
              walls,
              [
                [ax, y, az],
                [bx, y, bz],
                [bx, yb, bz],
                [ax, yb, az],
              ],
              nrm,
              [
                [ua, 0],
                [ua + U, 0],
                [ua + U, depth],
                [ua, depth],
              ],
              cell,
            );
          }
        }
      }
    }
  return { ci, cj, top, tex, size, liquid, walls };
}

/**
 * The Encircling Sea beyond the map's edge: four broad sheets of deep water
 * framing the map, at the sea's own level, so the open world's sea runs on to
 * the horizon instead of stopping at the last chunk. `reach` is how far out
 * they go (tiles).
 */
export function oceanFrame(w: number, h: number, reach: number): Mesh {
  const m = emptyMesh(true);
  const y = -0.25 * LEVEL;
  const sheet = (x0: number, j0: number, x1: number, j1: number) =>
    quad(
      m,
      [
        [x0, y, -j0],
        [x1, y, -j0],
        [x1, y, -j1],
        [x0, y, -j1],
      ],
      [0, 1, 0],
      [
        [x0, j0],
        [x1, j0],
        [x1, j1],
        [x0, j1],
      ],
      LIQUID_CODE.deep,
    );
  sheet(-reach, -reach, 0, h + reach);
  sheet(w, -reach, w + reach, h + reach);
  sheet(0, -reach, w, 0);
  sheet(0, h, w, h + reach);
  return m;
}

const RGB = new Map<string, readonly [number, number, number]>();
const rgb = (c: string) => {
  let v = RGB.get(c);
  if (!v) {
    const [r, g, b] = parseColor(c);
    RGB.set(c, (v = [r, g, b]));
  }
  return v;
};

/** Paint one fine cell's texels into the chunk texture, lit at the rims where the land drops and shaded where it rises. */
function paintTop(keyAt: (fi: number, fj: number) => number, fi: number, fj: number, kind: TileKind, tex: Uint8Array, lu: number, lv: number, size: number, season: Season | null): void {
  const fn = groundTexture(kind);
  if (!fn) return;
  const turns = season && groundTurns(kind, season) ? season : null;
  const hs = cellSurface(keyAt(fi, fj));
  const nb = [cellSurface(keyAt(fi + 1, fj)), cellSurface(keyAt(fi, fj + 1)), cellSurface(keyAt(fi - 1, fj)), cellSurface(keyAt(fi, fj - 1))];
  const drop = nb.map((n) => n < hs);
  const rise = nb.map((n) => n > hs);
  const T = CELL_TEXELS;
  for (let py = 0; py < T; py++)
    for (let px = 0; px < T; px++) {
      // texture coordinates stay in tiles, so the ground's pattern runs on unbroken across the cells
      const x = (fi + (px + 0.5) / T) / FINE;
      const y = (fj + (py + 0.5) / T) / FINE;
      let c = fn(x, y);
      const edge = [px === T - 1, py === T - 1, px === 0, py === 0];
      if (edge.some((e, k) => e && drop[k])) c = mix(c, "#fff6d8", 0.3);
      else if (edge.some((e, k) => e && rise[k])) c = shade(c, 0.72);
      let [r, g, bl] = rgb(c);
      if (turns) {
        const s = seasonTexel(r, g, bl, kind, turns, x, y);
        if (s) [r, g, bl] = s;
      }
      const o = ((lv * T + py) * size + lu * T + px) * 4;
      tex[o] = r;
      tex[o + 1] = g;
      tex[o + 2] = bl;
      tex[o + 3] = 255;
    }
}
