import { propDef, type PropId } from "../art/props";
import type { HumanId } from "../art/characters";
import { placementTiles, type Interactable, type NpcPlacement, type PropPlacement } from "./areas";
import { TILE_KINDS, type TileKind, type TileMap } from "./tilemap";

/**
 * The grand halls of the sects: buildings of three storeys and well over a
 * thousand tiles of floor, raised in the open world itself rather than in a
 * room of their own. Nothing is loaded when she walks in. The building's
 * footprint in the one world map simply changes what it shows:
 *
 *   - from outside, the shell: plastered walls the height of every storey,
 *     lattice windows, and a stepped roof of glazed tiles;
 *   - once she is through the door, the storey she stands on: its floor,
 *     the back walls at full height and the front walls cut down to a sill,
 *     so the camera looks into the hall as into a doll's house, while the
 *     storeys above (and the roof) are lifted away.
 *
 * The stairs are real stairs, a level a step, and they are the same tiles in
 * the storey below and the storey above, so walking up them is seamless: near
 * the top the floor above takes the place of the floor below, and near the
 * bottom the other way round. The folk, furniture and things to read of each
 * storey are only there while she is on it (story flags `hall:<key>:<n>`).
 */

/** Height levels from one floor to the next (and the run of a stair, one level a step). */
export const STOREY = 6;

/** What a footprint holds in one of its states: tile kinds, heights and what blocks. */
export interface HallLayer {
  kinds: Uint8Array;
  heights: Int8Array;
  blocked: Uint8Array;
}

export interface HallNpc extends NpcPlacement {
  storey: number;
}

export interface GrandHall {
  key: string;
  name: string;
  hanzi: string;
  subtitle: string;
  /** The footprint in world tiles, [i0, j0, i1, j1] inclusive. */
  rect: [number, number, number, number];
  /** Floor height of each storey. */
  floorZ: number[];
  /** What each storey is called. */
  storeys: string[];
  /** Each storey as the footprint shows it while she is on it. */
  layers: HallLayer[];
  /** The building seen from outside. */
  shell: HallLayer;
  /** World tile index → the storey a stair there rises from. */
  stairs: Map<number, number>;
  /** The doorway tiles (inside the footprint, on its front face). */
  door: [number, number][];
  /** Unit vector from the door into the hall. */
  inward: [number, number];
  npcs: HallNpc[];
  props: PropPlacement[];
  interacts: Interactable[];
  /** Floor tiles of each storey (world tiles), for tests and for finding her a place to stand. */
  area: number[];
}

/** The flag that is on while she stands on storey n of a hall. */
export const storeyFlag = (key: string, n: number) => `hall:${key}:${n}`;
/** The flag that is on while she is anywhere inside a hall. */
export const insideFlag = (key: string) => `hall:${key}`;

const K = (k: TileKind) => TILE_KINDS.indexOf(k);
const WALL_K = K("wall");
const WINDOW_K = K("window");
const ROOF_K = K("roof");

/** Is a hall tile (local u, v) on the front faces, which the camera looks in through? */
const front = (w: number, h: number, u: number, v: number) => u === w - 1 || v === h - 1;

/**
 * One storey being furnished, in hall-local coordinates: u runs east (world
 * i) and v south (world j) from the hall's north-west corner. The back walls
 * stand along u = 0 and v = 0.
 */
export class Floor {
  readonly layer: HallLayer;
  readonly z: number;
  constructor(
    readonly b: HallBuilder,
    readonly n: number,
    readonly floorKind: TileKind,
  ) {
    const floor = floorKind;
    const { w, h } = b;
    this.z = b.z0 + n * STOREY;
    this.layer = { kinds: new Uint8Array(w * h).fill(K(floor)), heights: new Int8Array(w * h).fill(this.z), blocked: new Uint8Array(w * h) };
    for (let v = 0; v < h; v++)
      for (let u = 0; u < w; u++) {
        if (u !== 0 && v !== 0 && !front(w, h, u, v)) continue;
        // the back walls rise a full storey (a lattice window every few tiles); the front walls are cut down to a sill
        const back = u === 0 || v === 0;
        const win = back && (u + v) % 4 === 2 && !(u === 0 && v === 0);
        this.set(u, v, win ? "window" : "wall", back ? STOREY : 1);
      }
  }

  private idx(u: number, v: number): number {
    return v * this.b.w + u;
  }

  inside(u: number, v: number): boolean {
    return u >= 0 && v >= 0 && u < this.b.w && v < this.b.h;
  }

  /** A tile `dh` levels above this storey's floor. */
  set(u: number, v: number, kind?: TileKind, dh?: number, block?: boolean): this {
    if (!this.inside(u, v)) return this;
    const k = this.idx(u, v);
    if (kind !== undefined) this.layer.kinds[k] = K(kind);
    if (dh !== undefined) this.layer.heights[k] = this.z + dh;
    if (block !== undefined) this.layer.blocked[k] = block ? 1 : 0;
    return this;
  }

  kind(u: number, v: number): TileKind {
    return this.inside(u, v) ? TILE_KINDS[this.layer.kinds[this.idx(u, v)]] : "void";
  }

  rect(u0: number, v0: number, u1: number, v1: number, kind: TileKind, dh?: number): this {
    for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) this.set(u, v, kind, dh);
    return this;
  }

  /** A low partition (a wainscot you can see over) along column u, from v0 to v1, leaving gaps where asked. */
  wallAlongV(u: number, v0: number, v1: number, gaps: number[] = [], dh = 2): this {
    for (let v = v0; v <= v1; v++) if (!gaps.includes(v)) this.set(u, v, "wall", dh, false);
    return this;
  }

  /** A low partition along row v, from u0 to u1. */
  wallAlongU(v: number, u0: number, u1: number, gaps: number[] = [], dh = 2): this {
    for (let u = u0; u <= u1; u++) if (!gaps.includes(u)) this.set(u, v, "wall", dh, false);
    return this;
  }

  /** Open a gap in the front sill (the door onto the street, on the ground floor). */
  doorway(tiles: [number, number][]): this {
    for (const [u, v] of tiles) this.set(u, v, this.floorKind, 0, false);
    return this;
  }

  private when = () => {
    const f = storeyFlag(this.b.key, this.n);
    return (flags: Record<string, boolean>) => !!flags[f];
  };

  /** A piece of furniture; blocking ones block their tiles on this storey only. */
  prop(id: PropId, u: number, v: number): this {
    const p: PropPlacement = { id, i: this.b.i0 + u, j: this.b.j0 + v, z: this.z, when: this.when() };
    this.b.props.push(p);
    if (propDef(id).blocks) {
      const [i0, j0, i1, j1] = placementTiles(p);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.set(i - this.b.i0, j - this.b.j0, undefined, undefined, true);
    }
    return this;
  }

  /** Several of a prop at once. */
  props(id: PropId, at: [number, number][]): this {
    for (const [u, v] of at) this.prop(id, u, v);
    return this;
  }

  /** Someone who lives or works on this storey (a route, in local tiles, has them walk it). */
  npc(key: string, name: string, char: HumanId, u: number, v: number, dir: number, opts: { anim?: NpcPlacement["anim"]; wander?: number; route?: [number, number][]; when?: (f: Record<string, boolean>) => boolean } = {}): this {
    const here = this.when();
    const extra = opts.when;
    this.b.npcs.push({
      key,
      name,
      char,
      i: this.b.i0 + u,
      j: this.b.j0 + v,
      dir,
      storey: this.n,
      ...(opts.anim && { anim: opts.anim }),
      ...(opts.wander && { wander: opts.wander }),
      ...(opts.route && { route: opts.route.map(([a, c]) => [this.b.i0 + a, this.b.j0 + c] as [number, number]) }),
      when: extra ? (f) => here(f) && extra(f) : here,
    });
    return this;
  }

  /** Something to read, look at or open. */
  thing(it: Omit<Interactable, "i" | "j" | "when"> & { u: number; v: number }): this {
    const { u, v, ...rest } = it;
    this.b.interacts.push({ ...rest, i: this.b.i0 + u, j: this.b.j0 + v, when: this.when() });
    return this;
  }

  /**
   * A stair up to the next storey, two tiles wide, climbing one level a step
   * from (u, v) in the direction (du, dv) for STOREY steps. It is laid on this
   * storey and the one above alike.
   */
  stairUp(above: Floor, u: number, v: number, du: number, dv: number): this {
    // the two lanes run side by side, across the direction of travel
    const [su, sv] = [Math.abs(dv), Math.abs(du)];
    for (let s = 0; s < STOREY; s++)
      for (let lane = 0; lane < 2; lane++) {
        const [a, c] = [u + du * s + su * lane, v + dv * s + sv * lane];
        this.set(a, c, "stairs", s + 1, false);
        above.set(a, c, "stairs", s + 1 - STOREY, false);
        this.b.stairs.set((this.b.j0 + c) * this.b.mapW + this.b.i0 + a, this.n);
      }
    for (let lane = 0; lane < 2; lane++) {
      // on this storey the stair stops against a wall at its head; above, its foot is a landing a step down
      const [ha, hc] = [u + du * STOREY + su * lane, v + dv * STOREY + sv * lane];
      this.set(ha, hc, "wall", STOREY + 1, false);
      const [fa, fc] = [u - du + su * lane, v - dv + sv * lane];
      above.set(fa, fc, "wall", 1, false);
      // and a rail on each side of the stairwell above, so nobody walks off the edge of the floor into it
      for (let s = 0; s < STOREY - 1; s++)
        for (const side of [-1, 2]) {
          const [ra, rc] = [u + du * s + su * side, v + dv * s + sv * side];
          if (above.kind(ra, rc) !== "stairs") above.set(ra, rc, "wall", 1, false);
        }
    }
    return this;
  }
}

/** Collects a hall's storeys and what is in them. */
export class HallBuilder {
  readonly floors: Floor[] = [];
  readonly props: PropPlacement[] = [];
  readonly npcs: HallNpc[] = [];
  readonly interacts: Interactable[] = [];
  readonly stairs = new Map<number, number>();
  constructor(
    readonly key: string,
    readonly mapW: number,
    readonly i0: number,
    readonly j0: number,
    readonly w: number,
    readonly h: number,
    /** Height of the ground floor (a step up from the ground outside). */
    readonly z0: number,
  ) {}

  floor(kind: TileKind): Floor {
    const f = new Floor(this, this.floors.length, kind);
    this.floors.push(f);
    return f;
  }

  /** The building as seen from outside: walls the height of every storey, and a stepped roof of glazed tiles. */
  shell(door: [number, number][]): HallLayer {
    const { w, h } = this;
    const top = this.z0 + this.floors.length * STOREY;
    const layer: HallLayer = { kinds: new Uint8Array(w * h).fill(ROOF_K), heights: new Int8Array(w * h), blocked: new Uint8Array(w * h) };
    for (let v = 0; v < h; v++)
      for (let u = 0; u < w; u++) {
        const k = v * w + u;
        const d = Math.min(u, v, w - 1 - u, h - 1 - v);
        if (d === 0) {
          layer.kinds[k] = (u + v) % 3 === 1 && !(u === 0 && v === 0) ? WINDOW_K : WALL_K;
          layer.heights[k] = top;
        } else layer.heights[k] = Math.min(126, top + 1 + Math.floor((d - 1) * 0.7));
      }
    // the doorway, and the porch a step inside it, at the ground floor's height
    for (const [u, v] of door) {
      const g = this.floors[0].layer;
      for (const [a, c] of [
        [u, v],
        [u - (u === w - 1 ? 1 : 0), v - (v === h - 1 ? 1 : 0)],
      ]) {
        const k = c * w + a;
        layer.kinds[k] = g.kinds[k];
        layer.heights[k] = this.z0;
      }
    }
    return layer;
  }
}

/** Write one of a hall's states into the world map. Returns the indices of the tiles that changed. */
export function applyHallLayer(m: TileMap, hall: GrandHall, layer: HallLayer): number[] {
  const [i0, j0, i1, j1] = hall.rect;
  const w = i1 - i0 + 1;
  const changed: number[] = [];
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const k = (j - j0) * w + (i - i0);
      const idx = j * m.w + i;
      if (m.kinds[idx] === layer.kinds[k] && m.heights[idx] === layer.heights[k] && m.blocked[idx] === layer.blocked[k]) continue;
      m.kinds[idx] = layer.kinds[k];
      m.heights[idx] = layer.heights[k];
      m.blocked[idx] = layer.blocked[k];
      changed.push(idx);
    }
  return changed;
}

/** Is world point (x, y) inside a hall's footprint? */
export const inHall = (hall: GrandHall, x: number, y: number) => x >= hall.rect[0] && y >= hall.rect[1] && x < hall.rect[2] + 1 && y < hall.rect[3] + 1;

/** The tallest a hall rises, roof and all. */
export function hallMaxHeight(hall: GrandHall): number {
  let h = -99;
  for (const l of [hall.shell, ...hall.layers]) for (let k = 0; k < l.heights.length; k++) h = Math.max(h, l.heights[k]);
  return h;
}

/** Turn a builder into a hall. */
export function finishHall(b: HallBuilder, meta: { name: string; hanzi: string; subtitle: string; storeys: string[]; door: [number, number][]; inward: [number, number] }): GrandHall {
  for (const f of b.floors.slice(0, 1)) f.doorway(meta.door);
  const shell = b.shell(meta.door);
  const area: number[] = [];
  for (const f of b.floors) {
    let n = 0;
    for (let k = 0; k < f.layer.kinds.length; k++) if (f.layer.kinds[k] !== WALL_K && f.layer.kinds[k] !== WINDOW_K && !f.layer.blocked[k]) n++;
    area.push(n);
  }
  return {
    key: b.key,
    name: meta.name,
    hanzi: meta.hanzi,
    subtitle: meta.subtitle,
    rect: [b.i0, b.j0, b.i0 + b.w - 1, b.j0 + b.h - 1],
    floorZ: b.floors.map((f) => f.z),
    storeys: meta.storeys,
    layers: b.floors.map((f) => f.layer),
    shell,
    stairs: b.stairs,
    door: meta.door.map(([u, v]) => [b.i0 + u, b.j0 + v]),
    inward: meta.inward,
    npcs: b.npcs,
    props: b.props,
    interacts: b.interacts,
    area,
  };
}
