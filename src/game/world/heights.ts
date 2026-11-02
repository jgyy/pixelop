import { fbm, hash2 } from "../pixel/noise";
import type { PropId } from "../art/props";
import type { AnimId, HumanId } from "../art/characters";
import type { Critter, EnemySpawn, Interactable, NpcPlacement, PropPlacement } from "./areas";
import { LIQUID, type TileKind, type TileMap } from "./tilemap";
import { inSea } from "./isles";

/**
 * 南岳 The Southern Heights: a new land below the Stairlands, where the
 * jianghu stops lying flat and stands up.
 *
 * - 悬城 Xuancheng, the Hanging City: a whole city cut into one mountain,
 *   six ring terraces six levels apart round a summit thirty-eight levels up,
 *   joined by stairs that never sit above one another, so every climb is a
 *   walk round the mountain. A spring on the summit falls down its south face
 *   from terrace to terrace, with a plank bridge over it on every one, and
 *   rope hoists creak baskets up and down the cliffs.
 * - 千柱林 The Thousand-Pillar Forest: sandstone pillars sixteen to forty levels
 *   tall. Four of them carry a long stair up their flank, and stone bridges
 *   run from those to their neighbours, so whole groves can be walked in the
 *   air. The rest are only to be looked up at.
 * - 崖港 Yagang, the Cliff Port: a harbour town stepping down a sea cliff in
 *   five terraces to a quay on the Sea of Pearls, where the junks put in.
 *
 * Everything here is on the authoring grid. buildWorld reserves the ground
 * first (`reserveHeights`, so the coast and the slope smoothing leave it be),
 * raises it once the wilds are smoothed (`raiseHeights`), and then furnishes
 * it (`furnishHeights`).
 */

/** The new land's outline: a broad island below the Stairlands, joined to them by a neck of land. */
export function heightsLand(i: number, j: number): boolean {
  if (j < 640 || j > 793 || i < 6 || i > 300) return false;
  if (inSea(i, j)) return false;
  const n = (fbm(i * 0.03, j * 0.03, 701) - 0.5) * 0.3 + (fbm(i * 0.1, j * 0.1, 702) - 0.5) * 0.08;
  const body = Math.hypot((i - 150) / 136, (j - 728) / 64) < 1 + n;
  const neck = i >= 172 && i <= 262 && j <= 690 + n * 30;
  const city = Math.hypot(i - CITY.c[0], j - CITY.c[1]) < CITY.R + 6;
  const port = i >= PORT_X0 - 6 && i <= PORT.quay + 2 && j >= PORT.y0 - 8 && j <= PORT.y1 + 8;
  return body || neck || city || port;
}

// ------------------------------------------------------------------ the Hanging City
/** The Hanging City: centre, outer radius, terrace width and rise, and how many terraces. */
export const CITY = { c: [178, 722] as [number, number], R: 50, W: 7, RISE: 6, RINGS: 6, base: 2 };
/** The summit plateau's radius, and its height. */
export const SUMMIT_R = CITY.R - CITY.W * CITY.RINGS;
export const SUMMIT_H = CITY.base + CITY.RISE * CITY.RINGS;
/** The stair from terrace k up to terrace k + 1 climbs at this angle (north first, then round by turns). */
export const stairAngle = (k: number) => -Math.PI / 2 + k * 2.2;
/** The summit spring falls down the south face. */
export const FALLS_ANGLE = Math.PI / 2;

const angDiff = (a: number, b: number) => Math.abs(((((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

/** Which terrace a radius lies on (0 = the outermost, RINGS = the summit), or -1 outside the city. */
export function ringAt(r: number): number {
  if (r >= CITY.R) return -1;
  if (r < SUMMIT_R) return CITY.RINGS;
  return Math.floor((CITY.R - r) / CITY.W);
}
export const ringHeight = (k: number) => CITY.base + CITY.RISE * k;
/** The inner and outer radius of terrace k. */
export const ringSpan = (k: number): [number, number] => [CITY.R - (k + 1) * CITY.W, CITY.R - k * CITY.W];

/** The city's ground at a tile: kind and height (null outside it). */
export function cityGround(i: number, j: number): { kind: TileKind; h: number } | null {
  const [cx, cy] = CITY.c;
  const dx = i + 0.5 - cx;
  const dy = j + 0.5 - cy;
  const r = Math.hypot(dx, dy);
  const k = ringAt(r);
  if (k < 0) return null;
  const a = Math.atan2(dy, dx);
  const [r0, r1] = ringSpan(k);
  // the stair arriving from the terrace below cuts into this one's outer edge, a level a tile
  if (k > 0) {
    const s = stairAngle(k - 1);
    if (Math.abs(r * Math.sin(a - s)) < 1.2 && Math.cos(a - s) > 0 && r >= r1 - CITY.RISE) {
      const up = Math.min(CITY.RISE, Math.floor(r1 - r) + 1);
      return { kind: "stairs", h: ringHeight(k - 1) + up };
    }
  }
  if (k === CITY.RINGS) {
    if (r < 2.2) return { kind: "water", h: SUMMIT_H };
    return { kind: r < SUMMIT_R - 1.5 ? "marble" : "plaza", h: SUMMIT_H };
  }
  // the falls: water stepping down the south face, with a plank bridge across the middle of each terrace
  const lateral = Math.abs(r * Math.sin(a - FALLS_ANGLE));
  if (lateral < 1.3 && Math.cos(a - FALLS_ANGLE) > 0) {
    const mid = Math.abs(r - (r0 + r1) / 2) < 1;
    return mid ? { kind: "wood", h: ringHeight(k) } : { kind: "water", h: ringHeight(k) };
  }
  // paved lanes round the outer edge of each terrace, beaten earth and gardens toward the cliff behind
  const lane = r1 - r < 2.2;
  const garden = r - r0 < 1.2 && hash2(i, j, 711) > 0.55;
  return { kind: lane ? "plaza" : garden ? "meadow" : hash2(i, j, 712) > 0.8 ? "dirt" : "plaza", h: ringHeight(k) };
}

// ------------------------------------------------------------------ the Cliff Port
/** The Cliff Port: its quay's x, the rows it spans, and five terraces six tiles deep and three levels apart. */
export const PORT = { quay: 262, y0: 700, y1: 750, T: 5, W: 6, RISE: 5 };
export const portHeight = (t: number) => 1 + PORT.RISE * t;
/** The port's landward edge (the foot of its top terrace's cliff). */
export const PORT_X0 = PORT.quay - PORT.T * PORT.W;
const portX0 = () => PORT_X0;

/** The port's ground at a tile (null outside it). */
export function portGround(i: number, j: number): { kind: TileKind; h: number } | null {
  if (j < PORT.y0 || j > PORT.y1 || i < portX0() || i > PORT.quay) return null;
  const t = Math.min(PORT.T - 1, Math.floor((PORT.quay - i) / PORT.W));
  // the stair up from terrace t - 1 cuts into this terrace's seaward edge, at the north end and the south end by turns
  if (t > 0) {
    const edge = PORT.quay - t * PORT.W;
    const sy = t % 2 ? PORT.y1 - 3 : PORT.y0 + 3;
    if (Math.abs(j - sy) <= 1 && edge - i < PORT.RISE) return { kind: "stairs", h: portHeight(t - 1) + (edge - i) + 1 };
  }
  if (t === 0) return { kind: i >= PORT.quay - 1 ? "wood" : "plaza", h: portHeight(0) };
  return { kind: PORT.quay - t * PORT.W - i < 2 ? "plaza" : hash2(i, j, 721) > 0.75 ? "dirt" : "plaza", h: portHeight(t) };
}

// ------------------------------------------------------------------ the Thousand-Pillar Forest
export interface Pillar {
  c: [number, number];
  r: number;
  /** Height of its top. */
  h: number;
  /** A grove of pillars walked in the air: those in one share a height, and the first carries the stair. */
  grove: number;
  climb: boolean;
}

/** Where the forest stands. */
export const FOREST: [number, number, number, number] = [26, 684, 120, 780];
/** The four groves walked in the air: the pillar that carries the stair, its height and its name. */
export const GROVES: { c: [number, number]; h: number; r: number; name: string; hanzi: string }[] = [
  { c: [46, 704], h: 18, r: 3.6, name: "the Grove of the First Step", hanzi: "初阶林" },
  { c: [96, 700], h: 24, r: 3.6, name: "the Monkey Bridges", hanzi: "猴桥" },
  { c: [52, 756], h: 30, r: 3.8, name: "the Hanging Gardens", hanzi: "悬圃" },
  { c: [94, 752], h: 40, r: 4.2, name: "the Pillar That Holds Up Heaven", hanzi: "擎天柱" },
];

let pillarCache: Pillar[] | null = null;
/** Every pillar of the forest (deterministic): the four grove pillars, their neighbours, and the lone ones. */
export function pillars(): Pillar[] {
  if (pillarCache) return pillarCache;
  const out: Pillar[] = GROVES.map((g, n) => ({ c: g.c, r: g.r, h: g.h, grove: n, climb: true }));
  const [x0, y0, x1, y1] = FOREST;
  for (let y = y0 + 4; y <= y1 - 4; y += 8)
    for (let x = x0 + 4; x <= x1 - 4; x += 8) {
      const c: [number, number] = [Math.round(x + (hash2(x, y, 731) - 0.5) * 6), Math.round(y + (hash2(x, y, 732) - 0.5) * 6)];
      const r = 1.4 + hash2(x, y, 733) * 1.2;
      // never crowding another pillar, nor in the way of a grove's stair (which runs out from its pillar on the side away from the forest's heart)
      if (out.some((p) => Math.hypot(p.c[0] - c[0], p.c[1] - c[1]) < p.r + r + 3.2)) continue;
      if (hash2(x, y, 734) < 0.18) continue;
      // and never on the road through the forest
      if (nearRoad(c, r + 3)) continue;
      // and only on the land (the forest's edge runs along the coast)
      if (![0, 1, 2, 3, 4, 5, 6, 7].every((k) => heightsLand(Math.round(c[0] + Math.cos(k * 0.785) * (r + 2)), Math.round(c[1] + Math.sin(k * 0.785) * (r + 2))))) continue;
      // the nearest grove pillar within reach of a bridge takes it in, at its own height
      let grove = -1;
      let best = 15;
      GROVES.forEach((g, n) => {
        const d = Math.hypot(g.c[0] - c[0], g.c[1] - c[1]);
        if (d < best && out.filter((p) => p.grove === n).length < 4) {
          best = d;
          grove = n;
        }
      });
      out.push({ c, r: grove >= 0 ? Math.max(r, 2) : r, h: grove >= 0 ? GROVES[grove].h : 16 + Math.round(hash2(x, y, 735) * 26), grove, climb: false });
    }
  pillarCache = out;
  return out;
}

/** The stone bridges between each grove's pillars (each joins a pillar to the nearest one already joined). */
export function groveBridges(): { a: Pillar; b: Pillar; h: number }[] {
  const ps = pillars();
  const out: { a: Pillar; b: Pillar; h: number }[] = [];
  GROVES.forEach((g, n) => {
    const members = ps.filter((p) => p.grove === n);
    const joined = [members[0]];
    for (const p of members.slice(1)) {
      let near = joined[0];
      for (const q of joined) if (Math.hypot(q.c[0] - p.c[0], q.c[1] - p.c[1]) < Math.hypot(near.c[0] - p.c[0], near.c[1] - p.c[1])) near = q;
      out.push({ a: near, b: p, h: g.h });
      joined.push(p);
    }
  });
  return out;
}

/** Is a point within d of the road west through the forest? */
function nearRoad(c: [number, number], d: number): boolean {
  const pts = HEIGHTS_ROADS[2];
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1];
    const [bx, by] = pts[k];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const t = Math.max(0, Math.min(1, ((c[0] - ax) * (bx - ax) + (c[1] - ay) * (by - ay)) / (L * L)));
    if (Math.hypot(c[0] - (ax + (bx - ax) * t), c[1] - (ay + (by - ay) * t)) < d) return true;
  }
  return false;
}

/** Tiles within half a width of a segment. */
function segTiles(a: [number, number], b: [number, number], width: number, fn: (i: number, j: number) => void): void {
  const seen = new Set<number>();
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(len * 3));
  for (let s = 0; s <= steps; s++) {
    const x = a[0] + ((b[0] - a[0]) * s) / steps;
    const y = a[1] + ((b[1] - a[1]) * s) / steps;
    for (let j = Math.floor(y - width); j <= Math.ceil(y + width); j++)
      for (let i = Math.floor(x - width); i <= Math.ceil(x + width); i++) {
        if (Math.hypot(i + 0.5 - x, j + 0.5 - y) > width / 2 + 0.25 || seen.has(j * 4096 + i)) continue;
        seen.add(j * 4096 + i);
        fn(i, j);
      }
  }
}

// ------------------------------------------------------------------ building it
type Fix = (i: number, j: number, v: 1 | 2) => void;

/**
 * Before the coast is carved and the wild slopes smoothed: level the city's
 * and the port's footing at the land's own low height and claim every
 * pillar's ground, so nothing else moves them.
 */
export function reserveHeights(m: TileMap, fix: Fix): void {
  const [cx, cy] = CITY.c;
  const R = CITY.R + 3;
  for (let j = cy - R; j <= cy + R; j++)
    for (let i = cx - R; i <= cx + R; i++) {
      if (Math.hypot(i + 0.5 - cx, j + 0.5 - cy) > R || m.kind(i, j) === "void") continue;
      m.set(i, j, "dirt", CITY.base);
      fix(i, j, 1);
    }
  for (let j = PORT.y0 - 2; j <= PORT.y1 + 2; j++)
    for (let i = portX0() - 2; i <= PORT.quay; i++) {
      if (m.kind(i, j) === "void") continue;
      m.set(i, j, "plaza", 1);
      fix(i, j, 1);
    }
  for (const p of pillars()) {
    const base = Math.max(1, Math.min(4, m.height(p.c[0], p.c[1])));
    disc(p.c, p.r + 0.6, (i, j) => {
      if (m.kind(i, j) === "void") return;
      m.set(i, j, "moss", base);
      fix(i, j, 1);
    });
  }
}

function disc(c: [number, number], r: number, fn: (i: number, j: number) => void): void {
  for (let j = Math.floor(c[1] - r - 1); j <= Math.ceil(c[1] + r + 1); j++)
    for (let i = Math.floor(c[0] - r - 1); i <= Math.ceil(c[0] + r + 1); i++) if (Math.hypot(i + 0.5 - c[0], j + 0.5 - c[1]) <= r) fn(i, j);
}

/** The long stair up each grove pillar: from its rim out over open ground, a level a tile, until it meets the ground. */
export interface SkyStair {
  grove: number;
  pts: [number, number][];
}

/**
 * Once the wilds are smoothed: raise the city's terraces, the port's steps
 * and the pillars, run the stone bridges between the grove pillars, and lay
 * each grove's long stair. Returns the stairs (for the folk who climb them).
 */
export function raiseHeights(m: TileMap, fix: Fix): SkyStair[] {
  const [cx, cy] = CITY.c;
  for (let j = cy - CITY.R; j <= cy + CITY.R; j++)
    for (let i = cx - CITY.R; i <= cx + CITY.R; i++) {
      const g = cityGround(i, j);
      if (!g || m.kind(i, j) === "void") continue;
      m.set(i, j, g.kind, g.h);
      fix(i, j, LIQUID[g.kind] ? 2 : 1);
    }
  // the summit spring's falls end in a pool at the city's foot, and run off south
  disc([cx, cy + CITY.R + 2.5], 2.6, (i, j) => {
    if (m.kind(i, j) === "void") return;
    m.set(i, j, "water", 0);
    fix(i, j, 2);
  });
  for (let j = PORT.y0 - 2; j <= PORT.y1 + 2; j++)
    for (let i = portX0() - 2; i <= PORT.quay; i++) {
      const g = portGround(i, j);
      if (!g || m.kind(i, j) === "void") continue;
      m.set(i, j, g.kind, g.h);
      fix(i, j, 1);
    }
  // the harbour: water from the quay out to the open sea, with three piers into it
  for (let j = PORT.y0; j <= PORT.y1; j++) {
    for (let i = PORT.quay + 1; i < PORT.quay + 60 && !inSea(i, j); i++) {
      m.set(i, j, "water", 0);
      fix(i, j, 2);
    }
  }
  for (const py of [PORT.y0 + 9, PORT.y0 + 25, PORT.y0 + 41])
    for (let i = PORT.quay + 1; i <= PORT.quay + 9; i++)
      for (const j of [py, py + 1]) {
        m.set(i, j, "wood", 1);
        fix(i, j, 2);
      }
  // the pillars
  for (const p of pillars())
    disc(p.c, p.r, (i, j) => {
      if (m.kind(i, j) === "void") return;
      const rim = Math.hypot(i + 0.5 - p.c[0], j + 0.5 - p.c[1]) > p.r - 0.9;
      m.set(i, j, p.grove >= 0 ? (rim ? "grass" : hash2(i, j, 741) > 0.6 ? "meadow" : "moss") : rim ? "redrock" : "moss", p.h);
      fix(i, j, 1);
    });
  for (const b of groveBridges())
    segTiles(b.a.c, b.b.c, 2, (i, j) => {
      if (m.kind(i, j) === "void" || m.height(i, j) > b.h) return;
      m.set(i, j, m.height(i, j) === b.h && m.kind(i, j) !== "plaza" ? m.kind(i, j) : "plaza", b.h);
      fix(i, j, 1);
    });
  // each grove's stair runs out from its pillar over open ground, a level a tile, down to wherever it meets the land
  const stairs: SkyStair[] = [];
  const ps = pillars();
  const busy = (i: number, j: number, own: Pillar) => ps.some((p) => p !== own && Math.hypot(i + 0.5 - p.c[0], j + 0.5 - p.c[1]) < p.r + 0.8);
  GROVES.forEach((g, n) => {
    const own = ps[n];
    const tries = Array.from({ length: 16 }, (_, k) => (k / 16) * Math.PI * 2);
    let done = false;
    for (const a of tries) {
      if (done) break;
      const [dx, dy] = [Math.cos(a), Math.sin(a)];
      const tiles: [number, number, number][] = [];
      let ok = false;
      for (let s = 1; s < 56; s++) {
        const x = own.c[0] + dx * (own.r + s - 0.5);
        const y = own.c[1] + dy * (own.r + s - 0.5);
        const h = g.h - s;
        let bad = false;
        let meet = false;
        segTiles([x, y], [x, y], 2, (i, j) => {
          if (Math.hypot(i + 0.5 - own.c[0], j + 0.5 - own.c[1]) <= own.r) return;
          if (m.kind(i, j) === "void" || LIQUID[m.kind(i, j)] || busy(i, j, own) || (s > 2 && bridgeAt(i, j))) bad = true;
          tiles.push([i, j, h]);
        });
        // it ends where the ground under its middle comes up to meet it
        if (!bad && m.kind(Math.floor(x), Math.floor(y)) !== "void" && m.height(Math.floor(x), Math.floor(y)) >= h - 1 && !busy(Math.floor(x), Math.floor(y), own)) meet = true;
        if (bad) {
          break;
        }
        if (meet || h <= 1) {
          ok = true;
          break;
        }
      }
      if (!ok) continue;
      for (const [i, j, h] of tiles) {
        m.set(i, j, "stairs", Math.max(h, m.height(i, j)));
        fix(i, j, 1);
      }
      const end = tiles[tiles.length - 1];
      stairs.push({ grove: n, pts: [[Math.round(own.c[0] + dx * (own.r - 1.5)), Math.round(own.c[1] + dy * (own.r - 1.5))], [end[0], end[1]]] });
      done = true;
    }
  });
  return stairs;
}

let bridgeSet: Set<number> | null = null;
function bridgeAt(i: number, j: number): boolean {
  if (!bridgeSet) {
    bridgeSet = new Set();
    for (const b of groveBridges()) segTiles(b.a.c, b.b.c, 3, (x, y) => bridgeSet!.add(y * 4096 + x));
  }
  return bridgeSet.has(j * 4096 + i);
}

// ------------------------------------------------------------------ furnishing it
export interface HeightsLayout {
  props: PropPlacement[];
  npcs: NpcPlacement[];
  enemies: EnemySpawn[];
  interacts: Interactable[];
  critters: Critter[];
  landmarks: { key: string; name: string; hanzi: string; icon: PropId; x: number; y: number }[];
}

/** The Hanging City's folk at their work on each terrace: who, and the jobs they go round. */
export const CITY_TRADES: { char: HumanId; name: string; jobs: AnimId[] }[] = [
  { char: "porter", name: "a porter", jobs: ["carry", "bear", "pant"] },
  { char: "villagerF", name: "a terrace gardener", jobs: ["plant", "water", "harvest"] },
  { char: "smith", name: "a cliff smith", jobs: ["hammer", "bellows", "quench"] },
  { char: "cook", name: "a noodle-seller", jobs: ["wok", "chopveg", "knead"] },
  { char: "herbalist", name: "a herb-drier", jobs: ["grind", "pillroll", "gather"] },
  { char: "scholar", name: "a cliff scribe", jobs: ["write", "read", "luopan"] },
  { char: "villagerM", name: "a hoist-hand", jobs: ["haul", "carry", "look"] },
  { char: "medic", name: "a bone-setter", jobs: ["acupuncture", "pulse", "grind"] },
  { char: "monk", name: "a lantern monk", jobs: ["sweep", "chant", "talismantoss"] },
  { char: "lady", name: "a terrace lady", jobs: ["fanning", "lean", "look"] },
];

/** The Cliff Port's folk at their work. */
export const PORT_FOLK: { char: HumanId; name: string; jobs: AnimId[] }[] = [
  { char: "porter", name: "a stevedore", jobs: ["carry", "haul", "bear"] },
  { char: "fishwife", name: "a fishwife", jobs: ["castnet", "chopveg", "haggle"] },
  { char: "boatwoman", name: "a boatwoman", jobs: ["row", "haul", "look"] },
  { char: "merchant", name: "a sea merchant", jobs: ["abacus", "weigh", "appraise"] },
  { char: "smith", name: "a ship's carpenter", jobs: ["hammer", "carve", "quench"] },
];

/** Who walks the Hanging City's stairs and the forest's long stairs: [look, name] by stair. */
export const stairWalker = (k: number): [HumanId, string] => (k % 2 ? ["villagerM", "a water-carrier"] : ["porter", "a porter on the stair"]);
export const pillarClimber = (grove: number): [HumanId, string] => (grove % 2 ? ["herbalist", "a herb-gatherer"] : ["villagerF", "a herb-gatherer"]);

/** Who keeps the high places. */
export const HEIGHTS_CAST = {
  lord: { key: "xc-lord", name: "Lady Xuan of the Hanging City", char: "nobleF" as HumanId },
  hermit: { key: "pf-hermit", name: "the Hermit Who Holds Up Heaven", char: "hermit" as HumanId },
  harbourmaster: { key: "yg-master", name: "Harbourmaster Lu of Yagang", char: "captain" as HumanId },
};

/**
 * The high places' buildings, folk, beasts and signs, on the authoring grid.
 * `free(i, j)` says whether a tile is open ground nothing else has claimed.
 */
export function furnishHeights(m: TileMap, stairs: SkyStair[], free: (i: number, j: number) => boolean): HeightsLayout {
  const out: HeightsLayout = { props: [], npcs: [], enemies: [], interacts: [], critters: [], landmarks: [] };
  const used = new Set<number>();
  const take = (i: number, j: number) => used.add(j * 4096 + i);
  const open = (i: number, j: number) => free(i, j) && !used.has(j * 4096 + i) && !LIQUID[m.kind(i, j)] && m.kind(i, j) !== "void" && m.kind(i, j) !== "stairs" && m.kind(i, j) !== "wood";
  /** Is a square of tiles round (i, j) all open and level with it? */
  const level = (i: number, j: number, r: number) => {
    const h = m.height(i, j);
    for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (!open(i + a, j + b) || m.height(i + a, j + b) !== h) return false;
    return true;
  };
  const place = (id: PropId, i: number, j: number, r = 0, claim = r) => {
    if (!level(i, j, r)) return false;
    out.props.push({ id, i, j });
    for (let b = -claim; b <= claim; b++) for (let a = -claim; a <= claim; a++) take(i + a, j + b);
    return true;
  };
  const [cx, cy] = CITY.c;
  const polar = (r: number, a: number): [number, number] => [Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r)];
  const clearOfStairs = (k: number, a: number, r: number) => {
    const margin = 4.5 / r;
    if (angDiff(a, FALLS_ANGLE) < margin) return false;
    if (k < CITY.RINGS && angDiff(a, stairAngle(k)) < margin) return false;
    if (k > 0 && angDiff(a, stairAngle(k - 1)) < margin) return false;
    return true;
  };

  // the Hanging City: houses with their backs to the cliff on every terrace, lanterns and hoists along each terrace's edge
  let folk = 0;
  for (let k = 0; k < CITY.RINGS; k++) {
    const [r0, r1] = ringSpan(k);
    const rh = r0 + 2;
    const n = Math.floor((Math.PI * 2 * rh) / 7.5);
    for (let s = 0; s < n; s++) {
      const a = (s / n) * Math.PI * 2 + k * 0.37;
      if (!clearOfStairs(k, a, rh)) continue;
      const [i, j] = polar(rh, a);
      const pick = hash2(k, s, 751);
      const id: PropId = pick < 0.3 ? "towerinn" : pick < 0.55 ? "teahouse" : pick < 0.7 ? "pavilion" : pick < 0.85 ? "drumtower" : "house";
      if (!place(id, i, j, 1, 2)) place(hash2(k, s, 752) < 0.5 ? "stall" : "laundry", i, j);
    }
    // the cliff's edge: lanterns, a hoist every so often, prayer flags and wind chimes
    const re = r1 - 0.8;
    const ne = Math.floor((Math.PI * 2 * re) / 5);
    for (let s = 0; s < ne; s++) {
      const a = (s / ne) * Math.PI * 2 + k * 0.21;
      if (!clearOfStairs(k, a, re)) continue;
      const [i, j] = polar(re, a);
      const id: PropId = k > 0 && s % 5 === 2 ? "hoist" : s % 3 === 0 ? "redlantern" : s % 3 === 1 ? (k % 2 ? "prayerflags" : "windchime") : "lantern";
      place(id, i, j);
    }
    // its folk, each going round a few stations along the lane
    const nf = 4 + k;
    for (let s = 0; s < nf; s++) {
      const a = (s / nf) * Math.PI * 2 + 0.9 + k * 0.5;
      const rl = r1 - 1.6;
      const stations: { at: [number, number]; anim: AnimId }[] = [];
      const ti = (s + k * 3) % CITY_TRADES.length;
      const t = CITY_TRADES[ti];
      for (let q = 0; q < 3; q++) {
        const aa = a + q * (2.6 / rl);
        const [i, j] = polar(rl, aa);
        if (!clearOfStairs(k, aa, rl) || !open(i, j)) continue;
        stations.push({ at: [i, j], anim: t.jobs[q] });
      }
      if (!stations.length) continue;
      for (const st of stations) take(...st.at);
      out.npcs.push({ key: `xc-folk-${ti}-${folk++}`, name: t.name, char: t.char, i: stations[0].at[0], j: stations[0].at[1], dir: Math.floor(hash2(k, s, 753) * 16), ...(stations.length > 1 ? { jobs: stations } : { anim: stations[0].anim }) });
    }
    // porters toiling up the stair to the next terrace and back down
    if (k < CITY.RINGS) {
      const sa = stairAngle(k);
      const lo = polar(r0 + 1.5, sa);
      const hi = polar(r0 - CITY.RISE - 0.5, sa);
      const [char, name] = stairWalker(k);
      out.npcs.push({ key: `xc-stair-${k}`, name, char, i: lo[0], j: lo[1], dir: 0, route: [lo, hi] });
    }
  }
  // the summit: the Pagoda of the Hanging City round its spring, a bell, a censer, the city's lady and its shrine
  place("pagoda", cx - 5, cy - 3, 1, 2);
  place("bell", cx + 4, cy - 4, 0, 1);
  place("censer", cx + 4, cy + 3, 0, 1);
  for (const [a, b] of [
    [-2, 4],
    [2, 4],
    [-5, 2],
    [5, 0],
  ] as [number, number][])
    place("lanterns", cx + a, cy + b);
  out.npcs.push({ key: HEIGHTS_CAST.lord.key, name: HEIGHTS_CAST.lord.name, char: HEIGHTS_CAST.lord.char, i: cx, j: cy + 5, dir: 2, anim: "fanning" });
  take(cx, cy + 5);
  out.interacts.push({ key: "xc-shrine", kind: "shrine", i: cx + 1, j: cy - 5 });
  out.props.push({ id: "shrine", i: cx + 1, j: cy - 5 });
  take(cx + 1, cy - 5);
  const gate = polar(CITY.R - 2, -Math.PI / 2 - 0.12);
  out.interacts.push({ key: "xc-sign", kind: "sign", i: gate[0], j: gate[1], text: "XUANCHENG · 悬城, THE HANGING CITY. Six terraces and a summit, thirty-eight levels up. The stairs are never above one another: to climb is to walk round the mountain. Mind the hoists." });
  out.props.push({ id: "sign", i: gate[0], j: gate[1] });
  take(...gate);
  out.landmarks.push({ key: "xuancheng", name: "Xuancheng, the Hanging City", hanzi: "悬城", icon: "pagoda", x: cx, y: cy });

  // the Thousand-Pillar Forest: pines on every pillar top, the grove pillars furnished, cranes and gibbons' keepers
  for (const p of pillars()) {
    const top = (dx: number, dy: number) => [Math.floor(p.c[0] + dx), Math.floor(p.c[1] + dy)] as [number, number];
    const t1 = top(-p.r * 0.4, -p.r * 0.2);
    if (open(...t1)) place(p.grove >= 0 ? "pine" : hash2(p.c[0], p.c[1], 761) < 0.5 ? "pine" : "snowpine", ...t1);
    if (p.r > 2.6) {
      const t2 = top(p.r * 0.4, p.r * 0.3);
      if (open(...t2)) place(hash2(p.c[0], p.c[1], 762) < 0.5 ? "pine" : "rock", ...t2);
    }
  }
  GROVES.forEach((g, n) => {
    const [x, y] = g.c;
    if (n === 3) {
      place("pavilion", x - 1, y - 1, 1, 1);
      out.npcs.push({ key: HEIGHTS_CAST.hermit.key, name: HEIGHTS_CAST.hermit.name, char: HEIGHTS_CAST.hermit.char, i: x + 1, j: y + 2, dir: 2, anim: "cloudride" });
      take(x + 1, y + 2);
      out.interacts.push({ key: "pf-chest", kind: "chest", i: x + 2, j: y - 1 });
      out.props.push({ id: "chest", i: x + 2, j: y - 1 });
      take(x + 2, y - 1);
    } else {
      const it: Interactable = n === 0 ? { key: "pf-sign", kind: "sign", i: x + 1, j: y + 1, text: `${g.hanzi} · ${g.name.replace(/^the /, "The ")}. Eighteen levels up a stair cut into the stone, and the Thousand-Pillar Forest under your feet. From here the stone bridges lead on.` } : { key: `pf-herb-${n}`, kind: "herb", i: x + 1, j: y + 1 };
      out.interacts.push(it);
      out.props.push({ id: n === 0 ? "sign" : "herb", i: x + 1, j: y + 1 });
      take(x + 1, y + 1);
      out.critters.push({ key: `pf-crane-${n}`, char: "crane", i: x - 1, j: y });
    }
  });
  // herb-gatherers on the long stairs, going up and coming down all day
  for (const s of stairs) {
    const [a, b] = s.pts;
    const [char, name] = pillarClimber(s.grove);
    out.npcs.push({ key: `pf-climber-${s.grove}`, name, char, i: b[0], j: b[1], dir: 0, route: [b, a] });
  }
  const [fx0, fy0, fx1, fy1] = FOREST;
  out.landmarks.push({ key: "pillars", name: "The Thousand-Pillar Forest", hanzi: "千柱林", icon: "karst", x: Math.round((fx0 + fx1) / 2), y: Math.round((fy0 + fy1) / 2) });
  // the forest's beasts: grey wolves between the pillars
  ([[36, 728], [78, 726], [110, 768], [70, 690]] as [number, number][]).forEach(([x, y], n) => {
    for (let r = 0; r < 6; r++) {
      const i = x + r;
      if (open(i, y)) {
        out.enemies.push({ key: `pf-wolf-${n}`, enemy: "wolf", i, j: y, range: 3 });
        take(i, y);
        break;
      }
    }
  });

  // the Cliff Port: warehouses and houses on every step, the lighthouse on the top, junks at the piers
  for (let t = 0; t < PORT.T; t++) {
    const xm = PORT.quay - t * PORT.W - (t === 0 ? 3 : 4);
    for (let y = PORT.y0 + 6; y <= PORT.y1 - 6; y += 7) {
      const pick = hash2(t, y, 771);
      const id: PropId = t === 0 ? (pick < 0.5 ? "barrels" : pick < 0.8 ? "fishrack" : "stall") : pick < 0.4 ? "towerinn" : pick < 0.7 ? "teahouse" : pick < 0.85 ? "pavilion" : "stall";
      if (!place(id, xm, y, t === 0 ? 0 : 1, t === 0 ? 0 : 2)) place("redlantern", xm, y);
    }
    for (let y = PORT.y0 + 2; y <= PORT.y1 - 2; y += 5) place(t === 0 ? "lantern" : t % 2 ? "redlantern" : "windchime", PORT.quay - t * PORT.W - 1, y);
  }
  place("lighthouse", portX0() + 2, PORT.y0 + 2, 0, 1);
  for (const py of [PORT.y0 + 9, PORT.y0 + 41]) out.props.push({ id: "ship", i: PORT.quay + 7, j: py + 3 });
  out.props.push({ id: "sampan", i: PORT.quay + 4, j: PORT.y0 + 28 });
  out.props.push({ id: "boat", i: PORT.quay + 3, j: PORT.y0 + 20 });
  let pf = 0;
  for (let t = 0; t < PORT.T; t++)
    for (let q = 0; q < 2; q++) {
      const fi = (t + q * 2) % PORT_FOLK.length;
      const f = PORT_FOLK[fi];
      const x = PORT.quay - t * PORT.W - 2;
      const ys = [PORT.y0 + 12 + q * 18, PORT.y0 + 16 + q * 18];
      const stations = ys.map((y, z) => ({ at: [x, y] as [number, number], anim: f.jobs[z] })).filter((s) => open(...s.at));
      if (!stations.length) continue;
      for (const s of stations) take(...s.at);
      out.npcs.push({ key: `yg-folk-${fi}-${pf++}`, name: f.name, char: f.char, i: stations[0].at[0], j: stations[0].at[1], dir: 6, ...(stations.length > 1 ? { jobs: stations } : { anim: stations[0].anim }) });
    }
  const hm: [number, number] = [PORT.quay - 1, PORT.y0 + 30];
  out.npcs.push({ key: HEIGHTS_CAST.harbourmaster.key, name: HEIGHTS_CAST.harbourmaster.name, char: HEIGHTS_CAST.harbourmaster.char, i: hm[0], j: hm[1], dir: 4, anim: "look" });
  take(...hm);
  out.interacts.push({ key: "yg-sign", kind: "sign", i: PORT.quay - 2, j: PORT.y0 - 1, text: "YAGANG · 崖港, THE CLIFF PORT. Five steps down the cliff to the quay. Junks for Hailing, Pearlgate and the isles put in and sail with the tide; mind the stevedores." });
  out.props.push({ id: "sign", i: PORT.quay - 2, j: PORT.y0 - 1 });
  out.landmarks.push({ key: "yagang", name: "Yagang, the Cliff Port", hanzi: "崖港", icon: "lighthouse", x: PORT.quay - 12, y: Math.round((PORT.y0 + PORT.y1) / 2) });
  return out;
}

/** The roads into the Southern Heights (authoring grid): from the Stairlands to the Hanging City's gate, on to the port and west to the forest. */
export const HEIGHTS_ROADS: [number, number][][] = [
  [[222, 652], [214, 662], [198, 668], [CITY.c[0] + 4, CITY.c[1] - CITY.R - 2]],
  [[CITY.c[0] + 34, CITY.c[1] - 38], [226, 684], [250, 692], [PORT.quay - 3, PORT.y0 - 3]],
  [[CITY.c[0] - 40, CITY.c[1] - 30], [124, 696], [112, 714], [96, 722], [70, 724], [40, 732]],
];
