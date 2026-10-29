import { mix, parseColor, shade } from "../pixel/color";
import { LEVEL_U, TILE_U } from "../iso/raster";
import { groundTexture } from "../art/tiles";
import { groundTurns, seasonTexel } from "../art/seasons";
import { LIQUID, TILE_KINDS, type TileKind, type TileMap } from "../world/tilemap";
import type { Season } from "../world/calendar";

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
}

/** Liquid kinds as the liquid shader numbers them. */
export const LIQUID_CODE: Partial<Record<TileKind, number>> = { water: 0, deep: 1, lava: 2, paddy: 3 };
/** Wall swatches as the wall shader finds them in its atlas (a rocky variant follows the plain ones). */
export const WALL_KINDS = TILE_KINDS;

/** What a chunk needs of the tile map (the worker hands it a window onto the real one). */
export type GroundMap = Pick<TileMap, "kind" | "height" | "inside">;

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
}

export const SEASON_CODES: Season[] = ["spring", "summer", "autumn", "winter"];

/** Copy out the window of the map a chunk (and its border) covers. */
export function mapWindow(map: TileMap, ci: number, cj: number, season: (i: number, j: number) => Season | null): MapWindow {
  const i0 = ci * CHUNK - 1;
  const j0 = cj * CHUNK - 1;
  const w = CHUNK + 2;
  const h = CHUNK + 2;
  const kinds = new Uint8Array(w * h);
  const heights = new Int8Array(w * h);
  const seasons = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [i, j] = [i0 + x, j0 + y];
      if (!map.inside(i, j)) continue;
      kinds[y * w + x] = map.kinds[j * map.w + i];
      heights[y * w + x] = map.heights[j * map.w + i];
      const s = season(i, j);
      seasons[y * w + x] = s ? 1 + SEASON_CODES.indexOf(s) : 0;
    }
  return { i0, j0, w, h, mapW: map.w, mapH: map.h, kinds, heights, seasons };
}

/** The tile map as seen through a window (void beyond its edge). */
export function windowMap(win: MapWindow): GroundMap & { season: (i: number, j: number) => Season | null } {
  const at = (i: number, j: number) => {
    const x = i - win.i0;
    const y = j - win.j0;
    return x >= 0 && y >= 0 && x < win.w && y < win.h ? y * win.w + x : -1;
  };
  return {
    inside: (i, j) => i >= 0 && j >= 0 && i < win.mapW && j < win.mapH,
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

/** A tile's walkable surface level (liquids lie a quarter level low; void is a long way down). */
function surface(map: GroundMap, i: number, j: number): number {
  const k = map.kind(i, j);
  return k === "void" ? -99 : map.height(i, j) - (LIQUID[k] ? 0.25 : 0);
}

export function buildChunk(map: GroundMap, ci: number, cj: number, opts: ChunkOpts): Chunk {
  const size = CHUNK * TEXELS;
  const tex = new Uint8Array(size * size * 4);
  const top = emptyMesh();
  const liquid = emptyMesh(true);
  const walls = emptyMesh(true);
  const i0 = ci * CHUNK;
  const j0 = cj * CHUNK;
  for (let dj = 0; dj < CHUNK; dj++)
    for (let di = 0; di < CHUNK; di++) {
      const i = i0 + di;
      const j = j0 + dj;
      if (!map.inside(i, j)) continue;
      const kind = map.kind(i, j);
      if (kind === "void") continue;
      const h = surface(map, i, j);
      const y = h * LEVEL;
      // the map's y runs along −Z in the 3D view
      const [x0, x1, z0, z1] = [i, i + 1, -j, -(j + 1)];
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
            [i, j],
            [i + 1, j],
            [i + 1, j + 1],
            [i, j + 1],
          ],
          code,
        );
      } else {
        const u0 = di / CHUNK;
        const u1 = (di + 1) / CHUNK;
        const v0 = dj / CHUNK;
        const v1 = (dj + 1) / CHUNK;
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
        paintTop(map, i, j, kind, tex, di, dj, size, opts.season(i, j));
      }
      // cliff walls down to each lower neighbour
      for (const [ni, nj, edge] of [
        [i + 1, j, [[x1, z0], [x1, z1]]],
        [i - 1, j, [[x0, z1], [x0, z0]]],
        [i, j + 1, [[x1, z1], [x0, z1]]],
        [i, j - 1, [[x0, z0], [x1, z0]]],
      ] as [number, number, number[][]][]) {
        const nk = map.kind(ni, nj);
        const void_ = nk === "void";
        const below = void_ ? opts.base - (opts.floating ? 6 : 0) : surface(map, ni, nj);
        if (below >= h - 0.01) continue;
        const yb = Math.max(below, opts.base - (opts.floating ? 6 : 1)) * LEVEL;
        const [[ax, az], [bx, bz]] = edge;
        const n = [Math.sign(ni - i), 0, -Math.sign(nj - j)];
        // swatch v: 4 levels per swatch, measured down from the top of the land
        const depth = (h - yb / LEVEL) / 4;
        const cell = TILE_KINDS.indexOf(kind) + (opts.rocky && !LIQUID[kind] && kind !== "rockwall" && kind !== "rails" ? TILE_KINDS.length : 0);
        quad(
          walls,
          [
            [ax, y, az],
            [bx, y, bz],
            [bx, yb, bz],
            [ax, yb, az],
          ],
          n,
          [
            [0, 0],
            [1, 0],
            [1, depth],
            [0, depth],
          ],
          cell,
        );
      }
    }
  return { ci, cj, top, tex, size, liquid, walls };
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

/** Paint one tile's 16 × 16 texels into the chunk texture, lit at the rims where the land drops and shaded where it rises. */
function paintTop(map: GroundMap, i: number, j: number, kind: TileKind, tex: Uint8Array, di: number, dj: number, size: number, season: Season | null): void {
  const fn = groundTexture(kind);
  if (!fn) return;
  const turns = season && groundTurns(kind, season) ? season : null;
  const hs = surface(map, i, j);
  const drop = [surface(map, i + 1, j) < hs, surface(map, i, j + 1) < hs, surface(map, i - 1, j) < hs, surface(map, i, j - 1) < hs];
  const rise = [surface(map, i + 1, j) > hs, surface(map, i, j + 1) > hs, surface(map, i - 1, j) > hs, surface(map, i, j - 1) > hs];
  for (let py = 0; py < TEXELS; py++)
    for (let px = 0; px < TEXELS; px++) {
      const a = (px + 0.5) / TEXELS;
      const b = (py + 0.5) / TEXELS;
      let c = fn(i + a, j + b);
      const edge = [a > 0.93, b > 0.93, a < 0.07, b < 0.07];
      if (edge.some((e, k) => e && drop[k])) c = mix(c, "#fff6d8", 0.3);
      else if ([a > 0.88, b > 0.88, a < 0.12, b < 0.12].some((e, k) => e && rise[k])) c = shade(c, 0.72);
      let [r, g, bl] = rgb(c);
      if (turns) {
        const s = seasonTexel(r, g, bl, kind, turns, i + a, j + b);
        if (s) [r, g, bl] = s;
      }
      const o = ((dj * TEXELS + py) * size + di * TEXELS + px) * 4;
      tex[o] = r;
      tex[o + 1] = g;
      tex[o + 2] = bl;
      tex[o + 3] = 255;
    }
}
