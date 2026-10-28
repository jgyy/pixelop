import { hash2 } from "../pixel/noise";
import type { PropId } from "../art/props";
import type { Landmark } from "./continent";
import type { EnemySpawn, NpcPlacement, PropPlacement } from "./areas";
import { LIQUID, type TileMap } from "./tilemap";
import { echoOf, ROAD_DAOS, ROAD_SITES, steleKey } from "./road";
import type { HollowId } from "../engine/enemies";
import type { WarContext } from "./warfront";

/**
 * Lays the Founder's Road over the finished world: at each of the ten places
 * the founder carved a Great Dao into stone, the stele itself (whole, emptied
 * or mended), the grey whirl of a land whose Dao has been eaten, Daoist
 * Qingxu waiting with his brushes while the book is hers to walk, the
 * hollowed who drift round it, and the Echo that comes for the mended verse.
 *
 * Like the war, everything is placed by walking out over open ground from
 * the stele, so whatever the Road stands up she can always reach on foot.
 */
export interface RoadLayout {
  npcs: NpcPlacement[];
  enemies: EnemySpawn[];
  props: PropPlacement[];
  /** The steles, as landmarks (world tiles). */
  landmarks: Landmark[];
}

type Ctx = Pick<WarContext, "map" | "free" | "claim" | "road">;

/** Open tiles reachable on foot from a start, nearest first, with how far each is. */
function walkOut(m: TileMap, sx: number, sy: number, reach: number): { i: number; j: number; d: number }[] {
  const out: { i: number; j: number; d: number }[] = [];
  const seen = new Set<number>([sy * m.w + sx]);
  const q: [number, number, number][] = [[sx, sy, 0]];
  for (let n = 0; n < q.length; n++) {
    const [i, j, d] = q[n];
    out.push({ i, j, d });
    if (d >= reach) continue;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di;
      const nj = j + dj;
      const k = nj * m.w + ni;
      if (seen.has(k) || !m.standable(ni, nj) || Math.abs(m.height(ni, nj) - m.height(i, j)) > 1) continue;
      seen.add(k);
      q.push([ni, nj, d + 1]);
    }
  }
  return out;
}

/** The nearest standable tile to a point (searching outward in rings). */
function nearestStandable(m: TileMap, x: number, y: number): [number, number] | null {
  for (let r = 0; r < 40; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = Math.floor(x) + di;
        const j = Math.floor(y) + dj;
        if (m.standable(i, j)) return [i, j];
      }
  return null;
}

const HOLLOW_OF = (book: number): HollowId => (book < 3 ? "hollowshade" : book < 7 ? "hollowmonk" : "hollowsage");

export function layRoad(ctx: Ctx, scale: number): RoadLayout {
  const { map: m, free, claim, road } = ctx;
  const out: RoadLayout = { npcs: [], enemies: [], props: [], landmarks: [] };
  const propAt = new Set<number>();
  const pick = (tiles: { i: number; j: number; d: number }[], d0: number, d1: number, seed: number, ok: (i: number, j: number) => boolean = free) => {
    let best: { i: number; j: number } | null = null;
    let bh = -1;
    for (const t of tiles) {
      if (t.d < d0 || t.d > d1 || !ok(t.i, t.j)) continue;
      const h = hash2(t.i, t.j, seed);
      if (h > bh) {
        bh = h;
        best = t;
      }
    }
    return best;
  };
  const place = (id: PropId, tiles: { i: number; j: number; d: number }[], d0: number, d1: number, seed: number, when: PropPlacement["when"]) => {
    const t = pick(tiles, d0, d1, seed, (i, j) => free(i, j) && !road(i, j) && !propAt.has(j * m.w + i) && !LIQUID[m.kind(i, j)]);
    if (!t) return null;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) propAt.add((t.j + dj) * m.w + t.i + di);
    out.props.push({ id, i: t.i, j: t.j, when, ...(id === "daostele" ? { k: 2 } : {}) });
    return t;
  };

  ROAD_DAOS.forEach((dao, book) => {
    const site = ROAD_SITES[book];
    const start = nearestStandable(m, site.at[0] * scale + scale / 2, site.at[1] * scale + scale / 2);
    if (!start) return;
    const around = walkOut(m, start[0], start[1], 40);
    const seed = 900 + book * 41;
    const hollowed = (f: Record<string, boolean>) => (!!f[`hollowed:${dao}`] && !f[`restored:${dao}`]) || !!f[`devoured:${dao}`];
    const whole = (f: Record<string, boolean>) => !hollowed(f);
    // the stele: whole (before the Dao-Eater's passing is known, and once mended), or emptied
    const st = place("daostele", around, 0, 6, seed, whole) ?? { i: start[0], j: start[1] };
    out.props.push({ id: "eatenstele", i: st.i, j: st.j, k: 2, when: hollowed });
    claim(st.i, st.j);
    out.landmarks.push({ key: steleKey(book), name: site.name, hanzi: site.hanzi, icon: "daostele", x: st.i + 0.5, y: st.j + 0.5 });
    // the land round it with its Dao eaten out: grey whirls of motes
    for (let k = 0; k < 4; k++) place("qiwhirl", around, 4, 18, seed + 10 + k, hollowed);
    // Qingxu waits beside it while the book is hers to walk
    const kt = pick(around, 4, 8, seed + 20) ?? pick(around, 2, 14, seed + 20);
    if (kt) {
      claim(kt.i, kt.j);
      out.npcs.push({ key: `keeper-${dao}`, name: "Daoist Qingxu", char: "keeper", i: kt.i, j: kt.j, dir: Math.floor(hash2(kt.i, kt.j, seed) * 16), anim: "read", when: (f) => !!f[`roadat:${dao}`] });
    }
    // the hollowed drift round the stele while the land is empty of its Dao
    for (let k = 0; k < 3; k++) {
      const t = pick(around, 12, 30, seed + 30 + k);
      if (!t) continue;
      claim(t.i, t.j);
      out.enemies.push({ key: `hollow-${dao}-${k}`, enemy: HOLLOW_OF(book), i: t.i, j: t.j, range: 3, when: (f) => !!f[`hollowed:${dao}`] && !f[`restored:${dao}`] });
    }
    // and the Echo comes for the mended verse
    const et = pick(around, 6, 14, seed + 40) ?? pick(around, 3, 30, seed + 40);
    if (et) {
      claim(et.i, et.j);
      out.enemies.push({ key: `echo-${dao}`, enemy: echoOf(book), i: et.i, j: et.j, range: 0, when: (f) => !!f[`echo:${dao}`] });
    }
  });
  return out;
}
