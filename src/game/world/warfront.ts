import { fbm, hash2 } from "../pixel/noise";
import type { PropId } from "../art/props";
import type { EnemySpawn, NpcPlacement, PropPlacement } from "./areas";
import type { AreaId } from "./ids";
import { PatchPainter, type TerrainPatch } from "./terrain";
import { LIQUID, type TileKind, type TileMap } from "./tilemap";
import { FRONT_IDS, frontFoes, frontBoss, WAR_FOLK, warRoster, type FrontId, type WarNpc } from "./war";

/**
 * Lays the War of the Iron Banner over the finished world: for every front,
 * the Northern Army's camp and picket line, the horde's raiders roaming the
 * outskirts, the fields it burns, and the marks it leaves once the front is
 * won (by the Dao she walked when she won it); Willow Creek's refugee camp
 * gathers the folk each burning front drives from home.
 *
 * Everything is placed by walking out from each region's arrival point over
 * open ground, so whatever the war stands up is always on land she can
 * reach on foot.
 */
export interface WarContext {
  map: TileMap;
  waypoints: Record<AreaId, [number, number]>;
  /** Open, unblocked and not taken by anyone else. */
  free: (i: number, j: number) => boolean;
  /** Claim a tile (and its neighbours) so nothing else is put there. */
  claim: (i: number, j: number) => void;
  /** A road or plaza tile (no fires or tents on the highway). */
  road: (i: number, j: number) => boolean;
}

export interface WarLayout {
  npcs: NpcPlacement[];
  enemies: EnemySpawn[];
  props: PropPlacement[];
  patches: TerrainPatch[];
}

const SCORCHED: Partial<Record<TileKind, true>> = { grass: true, meadow: true, leaf: true, paddy: true, moss: true, snow: true };

/** Open tiles reachable on foot from a start, nearest first, with how far each is. */
function walkOut(m: TileMap, sx: number, sy: number, reach: number): { i: number; j: number; d: number }[] {
  const out: { i: number; j: number; d: number }[] = [];
  const seen = new Set<number>();
  const q: [number, number, number][] = [[Math.floor(sx), Math.floor(sy), 0]];
  seen.add(q[0][1] * m.w + q[0][0]);
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

export function layWar(ctx: WarContext): WarLayout {
  const { map: m, free, claim, road } = ctx;
  const out: WarLayout = { npcs: [], enemies: [], props: [], patches: [] };
  const propAt = new Set<number>();

  /** The open tile in a band of distances that a hash prefers, spaced from what is already placed. */
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
  const stand = (n: WarNpc, tiles: { i: number; j: number; d: number }[], d0: number, d1: number, seed: number) => {
    const t = pick(tiles, d0, d1, seed) ?? pick(tiles, 1, 60, seed);
    if (!t) return;
    claim(t.i, t.j);
    out.npcs.push({ key: n.key, name: n.name, char: n.char, i: t.i, j: t.j, dir: Math.floor(hash2(t.i, t.j, seed + 1) * 16), anim: n.anim, wander: n.patrol ? 2.5 : 0, when: n.when });
  };
  const place = (id: PropId, tiles: { i: number; j: number; d: number }[], d0: number, d1: number, seed: number, when: PropPlacement["when"]) => {
    const t = pick(tiles, d0, d1, seed, (i, j) => free(i, j) && !road(i, j) && !propAt.has(j * m.w + i) && !LIQUID[m.kind(i, j)] && m.kind(i + 1, j) !== "void" && m.kind(i, j + 1) !== "void");
    if (!t) return;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) propAt.add((t.j + dj) * m.w + t.i + di);
    out.props.push({ id, i: t.i, j: t.j, when });
  };

  // where Willow Creek takes in the folk the war drives out (the sect takes in Willow Creek's own)
  const refuge = (front: FrontId) => (front === "village" ? walkOut(m, ...ctx.waypoints.sect, 26) : walkOut(m, ...ctx.waypoints.village, 30));
  const villageRefuge = refuge("bamboo");
  const sectRefuge = refuge("village");

  FRONT_IDS.forEach((front, c) => {
    const [wx, wy] = ctx.waypoints[front];
    const around = walkOut(m, wx, wy, 70);
    const seed = 400 + c * 37;
    const burning = (f: Record<string, boolean>) => !!f[`war:${front}`];
    const camped = (f: Record<string, boolean>) => !!f[`camp:${front}`] && !!f["war:begun"];
    const freed = (f: Record<string, boolean>) => !!f[`freed:${front}`];
    const scar = (dao: string) => (f: Record<string, boolean>) => !!f[`scar:${front}:${dao}`];

    // the camp: a ring of tents round a fire, officers among them; the picket further out
    const centre = pick(around, 12, 22, seed) ?? { i: Math.floor(wx), j: Math.floor(wy) };
    const camp = walkOut(m, centre.i + 0.5, centre.j + 0.5, 12);
    const roster = warRoster(front);
    roster.filter((n) => n.post === "camp").forEach((n, k) => stand(n, camp, 2, 7, seed + 10 + k));
    roster.filter((n) => n.post === "picket").forEach((n, k) => stand(n, around, 24, 34, seed + 20 + k));
    roster.filter((n) => n.post === "home").forEach((n, k) => stand(n, around, 5, 12, seed + 30 + k));
    roster.filter((n) => n.post === "refuge").forEach((n, k) => stand(n, front === "village" ? sectRefuge : villageRefuge, 7, 22, seed + 40 + k));

    // the horde's raiders on the outskirts, and its captain once he comes out to fight
    frontFoes(front).forEach((enemy, k) => {
      const t = pick(around, 30, 52, seed + 50 + k);
      if (!t) return;
      claim(t.i, t.j);
      out.enemies.push({ key: `war-${front}-${k}`, enemy, i: t.i, j: t.j, range: 3, when: burning });
    });
    const bt = pick(around, 26, 40, seed + 60) ?? pick(around, 8, 60, seed + 60);
    if (bt) {
      claim(bt.i, bt.j);
      out.enemies.push({ key: `siege-${front}`, enemy: frontBoss(front), i: bt.i, j: bt.j, range: 0, when: (f) => !!f[`siege:${front}`] });
    }

    // the camp's tents, standards, weapon racks and cook-fire; barricades on the picket line
    (["wartent", "wartent", "wartent", "warbanner", "warbanner", "weaponrack", "campfire"] as PropId[]).forEach((id, k) => place(id, camp, 3, 10, seed + 70 + k, camped));
    for (let k = 0; k < 3; k++) place("barricade", around, 22, 32, seed + 80 + k, camped);
    // what the horde leaves burning: wreckage, farmhouses, its own black banners, crows, and siege engines at the later fronts
    for (let k = 0; k < 8; k++) place("warfire", around, 14, 50, seed + 90 + k, burning);
    for (let k = 0; k < 3; k++) place("burnthouse", around, 18, 46, seed + 100 + k, burning);
    for (let k = 0; k < 3; k++) place("wolfbanner", around, 32, 56, seed + 110 + k, burning);
    for (let k = 0; k < 2; k++) place("crows", around, 20, 50, seed + 120 + k, burning);
    if (c >= 3) place("catapult", around, 36, 58, seed + 130, burning);
    // once it is won: a cairn for the fallen, and what her Dao makes of the battlefield
    place("cairn", camp, 2, 8, seed + 140, freed);
    for (let k = 0; k < 2; k++) place("warmemorial", around, 10, 30, seed + 150 + k, scar("sword"));
    for (let k = 0; k < 5; k++) place(k % 2 ? "cherry" : "peachtree", around, 10, 44, seed + 160 + k, scar("mercy"));
    for (let k = 0; k < 2; k++) place("butterflies", around, 8, 36, seed + 170 + k, scar("mercy"));
    for (let k = 0; k < 3; k++) place("cairn", around, 12, 40, seed + 180 + k, scar("balance"));
    for (let k = 0; k < 4; k++) place("bones", around, 14, 48, seed + 190 + k, scar("slaughter"));
    for (let k = 0; k < 3; k++) place("deadtree", around, 14, 48, seed + 200 + k, scar("slaughter"));
    place("crows", around, 20, 50, seed + 210, scar("slaughter"));
    place("burnthouse", around, 18, 46, seed + 220, scar("slaughter"));

    // the land itself: scorched fields while it burns; ash that never quite greens over on a slaughterer's victory; wild flowers on a merciful one
    const R = 54;
    const scorch = new PatchPainter(m);
    scorch.disc(wx, wy, R, (i, j) => {
      const k = m.kind(i, j);
      if (!SCORCHED[k] || road(i, j) || fbm(i * 0.12, j * 0.12, seed) < 0.44) return undefined;
      return { kind: fbm(i * 0.4, j * 0.4, seed + 1) > 0.56 ? "ash" : "dirt" };
    }, 8, seed + 2);
    out.patches.push(scorch.build(`war-${front}`, burning));
    const ashes = new PatchPainter(m);
    ashes.disc(wx, wy, R * 0.8, (i, j) => {
      const k = m.kind(i, j);
      if (!SCORCHED[k] || road(i, j) || fbm(i * 0.12, j * 0.12, seed) < 0.52) return undefined;
      return { kind: fbm(i * 0.4, j * 0.4, seed + 3) > 0.5 ? "ash" : "redrock" };
    }, 6, seed + 4);
    out.patches.push(ashes.build(`scar-${front}-slaughter`, scar("slaughter")));
    const bloom = new PatchPainter(m);
    bloom.disc(wx, wy, R * 0.8, (i, j) => (m.kind(i, j) === "grass" && fbm(i * 0.2, j * 0.2, seed + 5) > 0.5 ? { kind: "meadow" } : undefined), 6, seed + 6);
    out.patches.push(bloom.build(`scar-${front}-mercy`, scar("mercy")));
  });
  WAR_FOLK.forEach((n, k) => stand(n, villageRefuge, 6, 18, 777 + k));
  return out;
}
