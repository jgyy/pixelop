import { fbm, hash2 } from "../pixel/noise";
import { propDef, type PropId } from "../art/props";
import { placementTiles, type Critter, type EnemySpawn, type Interactable, type NpcPlacement, type PropPlacement, type Weather } from "./areas";
import type { InteriorDef } from "./interiors";
import { flockmates, packmates } from "./crowds";
import { PatchPainter, type TerrainPatch } from "./terrain";
import { LIQUID, TileMap, type TileKind } from "./tilemap";

/**
 * The jianghu underground. Each cave is a map of its own beneath a mouth in
 * the open world, run by the same World runtime as the rooms indoors, but
 * drawn as a cutaway of living rock: chambers and tunnels at many heights,
 * rock walls behind them, and cliffs dropping into the dark in front.
 * Underground rivers spill off the edges, lava runs in channels, crystals
 * and mushrooms are the only light besides her own.
 */

export const CAVE_IDS = ["emberMine", "grotto", "vein", "icesoul", "sandtomb", "tidecave", "bambooroots"] as const;
export type CaveId = (typeof CAVE_IDS)[number];

/** Where a cave's mouth stands, on the authoring grid of the open world (the world tile is twice that). */
export const CAVE_MOUTH: Record<CaveId, { at: [number, number]; prop: PropId }> = {
  emberMine: { at: [571, 382], prop: "minemouth" },
  grotto: { at: [45, 387], prop: "cavemouth" },
  vein: { at: [220, 262], prop: "cavemouth" },
  icesoul: { at: [492, 84], prop: "cavemouth" },
  sandtomb: { at: [351, 349], prop: "cavemouth" },
  tidecave: { at: [598, 236], prop: "cavemouth" },
  bambooroots: { at: [98, 136], prop: "cavemouth" },
};

/**
 * The Blood Moon has set: Patriarch Xue is beaten and its red moon does not
 * rise again for Lin Yue herself (see crimsonPath in story/heart.ts).
 */
const moonSet = (f: Record<string, boolean>) => !!f.patriarchDefeated && !(f["heart:devoured"] && !f.purged);

/**
 * Who waits outside each of the four newer deeps (and who comes home out of
 * them), in world tiles beside its mouth.
 */
export function deepFolk(): NpcPlacement[] {
  const at = (id: CaveId, dx: number, dy: number): [number, number] => [CAVE_MOUTH[id].at[0] * 2 + dx, CAVE_MOUTH[id].at[1] * 2 + dy];
  const put = (id: CaveId, dx: number, dy: number, n: Omit<NpcPlacement, "i" | "j">): NpcPlacement => {
    const [i, j] = at(id, dx, dy);
    return { ...n, i, j };
  };
  return [
    put("icesoul", 3, 1, { key: "mingjing", name: "Novice Ming Jing", char: "novice", dir: 12, anim: "chant", when: (f) => !f.iceDone }),
    put("icesoul", 3, 1, { key: "mingjing2", name: "Novice Ming Jing", char: "novice", dir: 12, when: (f) => !!f.iceDone }),
    put("icesoul", 3, -1, { key: "heng2", name: "Brother Heng", char: "monk", dir: 10, anim: "warmhands", when: (f) => !!f.iceDone }),
    put("sandtomb", 3, 1, { key: "ouyang", name: "Scholar Ouyang", char: "scholar", dir: 12, anim: "dig" }),
    put("tidecave", 3, 1, { key: "amu", name: "Fishwife Ah Mu", char: "fishwife", dir: 12 }),
    put("tidecave", 3, -1, { key: "shui2", name: "Little Shui", char: "boy", dir: 14, when: (f) => !!f.shuiSaved }),
    put("bambooroots", 3, 1, { key: "aqiao", name: "Huntress Ah Qiao", char: "villagerF", dir: 12, when: (f) => moonSet(f) || !!f.vixenAsk }),
    put("bambooroots", 3, -1, { key: "agou2", name: "Ah Gou", char: "boy", dir: 14, anim: "slingshot", when: (f) => !!f.gouSaved }),
  ];
}

interface Chamber {
  c: [number, number];
  r: number;
  h: number;
  kind?: TileKind;
}

interface Tunnel {
  a: number;
  b: number;
  width: number;
  kind?: TileKind;
  /** Bend points between the two chambers. */
  via?: [number, number][];
}

interface CaveSpec {
  key: CaveId;
  name: string;
  hanzi: string;
  subtitle: string;
  size: number;
  /** The first chamber is the one at the mouth (its exit is on its east edge). */
  chambers: Chamber[];
  tunnels: Tunnel[];
  /** Extra shaping after the chambers are cut: pools, channels, bridges. */
  shape?: (m: TileMap) => void;
  props: (m: TileMap) => PropPlacement[];
  npcs: NpcPlacement[];
  enemies: EnemySpawn[];
  interacts: Interactable[];
  critters?: Critter[];
  patches?: (m: TileMap) => TerrainPatch[];
  weather: Weather;
  night: number;
  tint: string;
  /** Only open (and only drawn) once this holds. */
  opens?: (f: Record<string, boolean>) => boolean;
}

/** How high the rock face behind the chambers rises above their floors. */
const WALL_RISE = 4;

/** Cut the chambers and tunnels out of the dark, and stand rock walls behind them. */
function carve(sp: CaveSpec): TileMap {
  const m = new TileMap(sp.size, sp.size, "void", 0);
  const C = sp.chambers;
  // tunnels first, their floors climbing evenly from one chamber's height to the other's
  for (const t of sp.tunnels) {
    const pts: [number, number][] = [C[t.a].c, ...(t.via ?? []), C[t.b].c];
    let total = 0;
    for (let p = 1; p < pts.length; p++) total += Math.hypot(pts[p][0] - pts[p - 1][0], pts[p][1] - pts[p - 1][1]);
    let run = 0;
    for (let p = 1; p < pts.length; p++) {
      const len = Math.hypot(pts[p][0] - pts[p - 1][0], pts[p][1] - pts[p - 1][1]);
      const steps = Math.ceil(len * 3);
      for (let s = 0; s <= steps; s++) {
        const u = (run + (len * s) / steps) / total;
        const cx = pts[p - 1][0] + ((pts[p][0] - pts[p - 1][0]) * s) / steps;
        const cy = pts[p - 1][1] + ((pts[p][1] - pts[p - 1][1]) * s) / steps;
        const h = Math.round(C[t.a].h + (C[t.b].h - C[t.a].h) * u);
        for (let j = Math.floor(cy - t.width); j <= Math.ceil(cy + t.width); j++)
          for (let i = Math.floor(cx - t.width); i <= Math.ceil(cx + t.width); i++) {
            if (Math.hypot(i - cx, j - cy) > t.width / 2 + 0.2) continue;
            m.set(i, j, t.kind ?? "cave", h);
          }
      }
      run += len;
    }
  }
  // chambers with ragged rims; mossy or rocky patches on their floors
  C.forEach((ch, k) => {
    m.disc(ch.c[0], ch.c[1], ch.r, ch.kind ?? "cave", ch.h, 1.4, 300 + k);
    m.disc(ch.c[0], ch.c[1], ch.r * 0.6, undefined, ch.h, 0, 1);
  });
  sp.shape?.(m);
  // the rock face: every gap behind a floor tile becomes wall
  const floorH = (i: number, j: number) => {
    const k = m.kind(i, j);
    return k === "void" || k === "rockwall" ? -99 : m.height(i, j);
  };
  const walls: [number, number, number][] = [];
  m.each((i, j) => {
    if (m.kind(i, j) !== "void") return;
    const h = Math.max(floorH(i + 1, j), floorH(i, j + 1), floorH(i + 1, j + 1));
    if (h === -99) return;
    // a wall standing in a gap between two passages would hide the one behind it: leave the gap open to the dark
    for (let b = 0; b <= 3; b++) for (let a = 0; a <= 3; a++) if ((a || b) && floorH(i - a, j - b) > -99) return;
    if (h > -99) walls.push([i, j, h + WALL_RISE + Math.floor(hash2(i, j, 41) * 2)]);
  });
  for (const [i, j, h] of walls) m.set(i, j, "rockwall", h);
  return m;
}

/** A cave as a room of the World runtime: its exit on the first chamber's east edge, its mouth in the open world. */
function cave(sp: CaveSpec): InteriorDef & { opens?: CaveSpec["opens"] } {
  const m = carve(sp);
  const [cx, cy] = sp.chambers[0].c;
  // the exit is the easternmost floor tile of the mouth chamber's middle row, where the rock opens to the light
  let ei = cx;
  while (m.kind(ei + 1, cy) !== "void" && m.kind(ei + 1, cy) !== "rockwall") ei++;
  const exit: [number, number] = [ei, cy];
  // nothing hangs in the dark or sticks out of the rock face
  const used = new Set(sp.interacts.map((it) => `${it.i},${it.j}`));
  // and nothing stands where someone is waiting
  const stood = new Set([...sp.npcs, ...sp.enemies].map((x) => `${x.i},${x.j}`));
  const props = sp.props(m).filter((p) => m.kind(p.i, p.j) !== "void" && m.kind(p.i, p.j) !== "rockwall" && !stood.has(`${p.i},${p.j}`) && (!used.has(`${p.i},${p.j}`) || p.id === "veinheart"));
  // chests, herbs, shrines and steles are things to see as well as to use (shown only while they can be used)
  for (const it of sp.interacts) {
    const id: PropId | null = it.kind === "chest" || it.kind === "herb" || it.kind === "shrine" ? it.kind : it.kind === "sign" && it.key.endsWith("stele") ? "stele" : null;
    if (id) props.push({ id, i: it.i, j: it.j, ...(it.when && { when: it.when }) });
  }
  for (const p of props) {
    if (!propDef(p.id).blocks || p.when) continue;
    const [i0, j0, i1, j1] = placementTiles(p);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) m.block(i, j);
  }
  // the common beasts and bats of the deep run in pairs too (see world/crowds.ts)
  const ground = { map: m, free: (i: number, j: number) => !used.has(`${i},${j}`) && Math.hypot(i - exit[0], j - exit[1]) > 4 };
  const enemies = [...sp.enemies, ...packmates(ground, sp.enemies, sp.npcs)];
  const critters = sp.critters && [...sp.critters, ...flockmates(ground, sp.critters)];
  const mouth = CAVE_MOUTH[sp.key];
  const [mi, mj] = [mouth.at[0] * 2, mouth.at[1] * 2];
  const door: [number, number] = [mi + 1, mj];
  const building: PropPlacement = { id: mouth.prop, i: mi, j: mj };
  return {
    id: "sect",
    key: sp.key,
    name: sp.name,
    hanzi: sp.hanzi,
    subtitle: sp.subtitle,
    map: m,
    base: -6,
    floating: false,
    sky: "cave",
    weather: sp.weather,
    night: sp.night,
    tint: sp.tint,
    arrive: [exit[0] + 0.5 - 0.8, exit[1] + 0.5],
    props: [...props, { id: "torch", i: exit[0] - 1, j: exit[1] - 2 }],
    npcs: sp.npcs,
    enemies,
    interacts: [...sp.interacts, { key: `${sp.key}-exit`, kind: "door", i: exit[0], j: exit[1], to: "out" }],
    critters,
    patches: sp.patches?.(m),
    building,
    source: building,
    door,
    inward: [-1, 0],
    outside: [door[0] + 0.5 + 0.7, door[1] + 0.5],
    exit,
    opens: sp.opens,
  };
}

const P = (id: PropId, i: number, j: number, when?: PropPlacement["when"]): PropPlacement => ({ id, i, j, ...(when && { when }) });

/** Scatter props over the open floor of a cave, away from the paths between its chambers. */
function strew(m: TileMap, out: PropPlacement[], ids: PropId[], p: number, seed: number, keepClear: [number, number][], when?: PropPlacement["when"]): void {
  const taken = new Set(out.map((o) => `${o.i},${o.j}`));
  m.each((i, j) => {
    const k = m.kind(i, j);
    if (k === "void" || k === "rockwall" || LIQUID[k] || k === "rails" || taken.has(`${i},${j}`)) return;
    // only near the walls, where nobody needs to walk
    const nearWall = [-1, 0, 1].some((a) => [-1, 0, 1].some((b) => m.kind(i + a, j + b) === "rockwall" || m.kind(i + a, j + b) === "void"));
    if (!nearWall || keepClear.some(([x, y]) => Math.hypot(i - x, j - y) < 3.2)) return;
    if (hash2(i, j, seed) < p) {
      out.push({ id: ids[Math.floor(hash2(i, j, seed + 1) * ids.length)], i, j, ...(when && { when }) });
      taken.add(`${i},${j}`);
    }
  });
}

/** Points every tile or so along each tunnel's line, so nothing strewn about the cave stands in a passage. */
function alongTunnels(C: Chamber[], tunnels: Tunnel[]): [number, number][] {
  const out: [number, number][] = [];
  for (const t of tunnels) {
    const pts: [number, number][] = [C[t.a].c, ...(t.via ?? []), C[t.b].c];
    for (let p = 1; p < pts.length; p++) {
      const len = Math.hypot(pts[p][0] - pts[p - 1][0], pts[p][1] - pts[p - 1][1]);
      for (let s = 0; s <= len; s += 1.2) out.push([pts[p - 1][0] + ((pts[p][0] - pts[p - 1][0]) * s) / len, pts[p - 1][1] + ((pts[p][1] - pts[p - 1][1]) * s) / len]);
    }
  }
  return out;
}

// ----------------------------------------------------------------------------- the Ember Mine
const EMBER: Chamber[] = [
  { c: [46, 28], r: 5, h: 2 },
  { c: [32, 26], r: 4.4, h: 2 },
  { c: [22, 13], r: 5, h: 4 },
  { c: [20, 38], r: 7, h: 2, kind: "redrock" },
  { c: [9, 24], r: 5.4, h: 5, kind: "redrock" },
];

function buildEmberMine(): InteriorDef {
  const sealed = (f: Record<string, boolean>) => !!f["phx:sealed"];
  const fed = (f: Record<string, boolean>) => !!f["phx:fed"];
  return cave({
    key: "emberMine",
    name: "Ember Mine",
    hanzi: "炎晶矿",
    subtitle: "Where the Scarlet Phoenix digs its fire-jade",
    size: 56,
    chambers: EMBER,
    tunnels: [
      { a: 0, b: 1, width: 3, kind: "rails" },
      { a: 1, b: 2, width: 2.6, via: [[27, 19]] },
      { a: 1, b: 3, width: 3, kind: "rails", via: [[28, 33]] },
      { a: 3, b: 4, width: 2.6, via: [[11, 33]] },
      { a: 2, b: 4, width: 2.2, via: [[14, 17]] },
    ],
    shape: (m) => {
      // a lava channel cuts across the great hall, bridged by the rails
      m.path([[13, 44], [19, 39], [27, 41], [31, 46]], 2.2, "lava", 1);
      m.path([[20, 34], [20, 43]], 2.6, "rails", 2);
      // and a pool of it glows at the foot of the burning vein
      m.disc(5, 27, 2.2, "lava", 4, 0.6, 7);
      // fire-jade seams in the walls of the refuge
      m.disc(22, 13, 1.6, "cave", 4);
    },
    props: (m) => {
      const out = [
        P("minecart", 38, 27),
        P("minecart", 20, 36),
        P("torch", 34, 23),
        P("torch", 25, 15),
        P("torch", 16, 33),
        P("torch", 25, 41),
        P("sacks", 20, 9),
        P("sacks", 27, 11),
        P("barrels", 18, 15),
        P("firejade", 6, 21),
        P("firejade", 12, 20),
        P("firejade", 8, 29),
        P("firejade", 15, 42, (f) => !f["phx:sealed"]),
        P("rubble", 30, 16),
        P("rubble", 24, 18),
      ];
      strew(m, out, ["stalagmite", "rock", "firejade", "stalagmite"], 0.07, 61, EMBER.map((c) => c.c));
      return out;
    },
    npcs: [
      // the trapped miners, until she leads them out (or the wyrm is dead and they can walk out themselves)
      { key: "tie", char: "miner", i: 21, j: 12, dir: 2, anim: "cower", when: (f) => !!f.phxMine && !f.minersOut },
      { key: "ahshi", name: "Miner Ah Shi", char: "miner", i: 24, j: 14, dir: 14, anim: "cower", when: (f) => !!f.phxMine && !f.minersOut },
      // a Phoenix disciple keeps watch on the vein once the mine is safe again
      { key: "zhuque2", name: "Disciple Zhu Que", char: "phoenix", i: 12, j: 25, dir: 6, anim: "flame", when: fed },
      { key: "minerB", name: "Miner Lao Gou", char: "miner", i: 31, j: 28, dir: 4, anim: "mine", when: (f) => !!f.wyrmDefeated },
    ],
    enemies: [
      { key: "ember-wyrm", enemy: "emberwyrm", i: 9, j: 24, range: 0.5, when: (f) => !!f.phxMine && !f.wyrmDefeated },
      { key: "ember-hound-1", enemy: "wolf", i: 21, j: 40, range: 2, when: (f) => !f.wyrmDefeated },
      { key: "ember-fox-1", enemy: "fox", i: 33, j: 25, range: 1.5, when: (f) => !!f.phxMine && !f.wyrmDefeated },
    ],
    interacts: [
      { key: "ember-vein", kind: "sign", i: 7, j: 25, text: "The burning vein: a crack in the rock running with liquid fire. The fire-jade grows out of it like frost on a window.", when: (f) => !!f.wyrmDefeated },
      { key: "ember-stele", kind: "sign", i: 43, j: 24, text: "Chalked on a beam: “Shift three. Twelve carts. Old Tie says the rock is warm again. Old Tie always says that.” Below, scratched: “He was right.”" },
      { key: "ember-chest", kind: "chest", i: 25, j: 9 },
      { key: "ember-herb", kind: "herb", i: 18, j: 11 },
    ],
    critters: [{ key: "bat-em1", char: "bat", i: 30, j: 34 }],
    patches: (m) => {
      // sealed: the vein's fire goes out, and the lava hardens to black rock
      const cool = new PatchPainter(m);
      m.each((i, j) => {
        if (m.kind(i, j) === "lava") cool.set(i, j, "redrock", m.height(i, j));
      });
      // fed: the vein swells, flooding the far side of the hall
      const flood = new PatchPainter(m);
      flood.disc(16, 42, 3.2, (i, j) => (m.kind(i, j) === "redrock" && Math.hypot(i - 20, j - 38) > 3 ? { kind: "lava", height: 1 } : undefined), 0.8, 5);
      flood.disc(5, 21, 1.8, () => ({ kind: "lava", height: 4 }), 0.4, 6);
      return [cool.build("ember-cooled", sealed), flood.build("ember-flood", fed)];
    },
    weather: "embers",
    night: 0.72,
    tint: "#ff5a2a",
  });
}

// ----------------------------------------------------------------------------- the Sunken Grotto
const GROTTO: Chamber[] = [
  { c: [46, 30], r: 5, h: 3 },
  { c: [33, 17], r: 6, h: 3, kind: "moss" },
  { c: [28, 38], r: 8.4, h: 2 },
  { c: [11, 25], r: 6.4, h: 2, kind: "moss" },
];

function buildGrotto(): InteriorDef {
  return cave({
    key: "grotto",
    name: "Sunken Grotto",
    hanzi: "沉渊洞",
    subtitle: "The marsh's water runs down here to remember the dark",
    size: 56,
    chambers: GROTTO,
    tunnels: [
      { a: 0, b: 1, width: 3, via: [[40, 22]] },
      { a: 0, b: 2, width: 3 },
      { a: 1, b: 3, width: 2.6, via: [[20, 19]] },
      { a: 2, b: 3, width: 2.8, via: [[17, 34]] },
    ],
    shape: (m) => {
      // an underground lake, deep in the middle, spilling over the cavern's front edge
      m.disc(28, 40, 4.6, "water", 1, 1, 21);
      m.disc(28, 40, 2.4, "deep", 1);
      m.path([[30, 44], [31, 48]], 2.2, "water", 1);
      // the poisoned spring
      m.disc(8, 26, 2.4, "deep", 1, 0.5, 22);
    },
    props: (m) => {
      const out = [
        P("glowshroom", 30, 13),
        P("glowshroom", 37, 19),
        P("glowshroom", 29, 20),
        P("glowshroom", 14, 21),
        P("glowshroom", 22, 33),
        P("glowshroom", 35, 35),
        P("wisps", 9, 24, (f) => !f["herb:purified"] && !f["herb:drained"]),
        P("lotus", 8, 26, (f) => !!f["herb:purified"]),
        P("lotus", 27, 40, (f) => !!f["herb:purified"]),
        P("torch", 42, 27),
        P("stalagmite", 35, 41),
      ];
      strew(m, out, ["stalagmite", "glowshroom", "rock", "stalagmite"], 0.08, 71, GROTTO.map((c) => c.c));
      return out;
    },
    npcs: [
      { key: "kushen", char: "poisoner", i: 12, j: 28, dir: 12, anim: "brew", when: (f) => !!f.herbAsk && !f.kuDealt },
    ],
    enemies: [
      { key: "grotto-serpent-1", enemy: "serpent", i: 24, j: 34, range: 1.5, when: (f) => !f.kuDealt },
      { key: "grotto-serpent-2", enemy: "serpent", i: 34, j: 15, range: 1.5 },
      { key: "grotto-jiangshi", enemy: "jiangshi", i: 14, j: 30, range: 1.2, when: (f) => !!f.herbAsk && !f.kuDealt },
    ],
    interacts: [
      { key: "grotto-spring", kind: "sign", i: 10, j: 26, text: "The spring that feeds Hundred Herb Valley. Its water is black and smells of bitter almonds.", when: (f) => !!f.kuDealt },
      { key: "grotto-stele", kind: "sign", i: 43, j: 33, text: "Carved by the valley's first master: “What flows down must one day flow up. Keep the water clean.”" },
      { key: "grotto-herb", kind: "herb", i: 31, j: 13 },
      { key: "grotto-chest", kind: "chest", i: 36, j: 21 },
      // a chest that only the drained lake gives up
      { key: "grotto-sunken", kind: "chest", i: 28, j: 40, when: (f) => !!f["herb:drained"] },
    ],
    critters: [{ key: "bat-gr1", char: "bat", i: 24, j: 24 }],
    patches: (m) => {
      // purified: the spring runs clear
      const clear = new PatchPainter(m);
      clear.disc(8, 26, 2.6, (i, j) => (m.kind(i, j) === "deep" ? { kind: "water" } : undefined));
      // drained: the lake sinks away to a muddy floor
      const drain = new PatchPainter(m);
      m.each((i, j) => {
        if (LIQUID[m.kind(i, j)] && Math.hypot(i - 28, j - 41) < 9) drain.set(i, j, "moss", 1);
      });
      return [clear.build("grotto-clear", (f) => !!f["herb:purified"]), drain.build("grotto-drained", (f) => !!f["herb:drained"])];
    },
    weather: "spores",
    night: 0.78,
    tint: "#3a6aa8",
  });
}

// ----------------------------------------------------------------------------- the Dragon Vein Caverns
const VEIN: Chamber[] = [
  { c: [48, 32], r: 5, h: 2 },
  { c: [36, 19], r: 6, h: 3 },
  { c: [36, 41], r: 6, h: 2 },
  { c: [15, 24], r: 9, h: 7 },
];

/** Who the conclave gave the vein to, as story flags. */
export const VEIN_FATES = ["phoenix", "herb", "sword", "shared", "taken"] as const;
export type VeinFate = (typeof VEIN_FATES)[number];
export const veinFate = (f: Record<string, boolean>): VeinFate | null => VEIN_FATES.find((v) => f[`vein:${v}`]) ?? null;

function buildVein(): InteriorDef {
  const conclave = (f: Record<string, boolean>) => !!f.veinOpened && !veinFate(f);
  return cave({
    key: "vein",
    name: "Dragon Vein Caverns",
    hanzi: "龙脉窟",
    subtitle: "The spirit vein of the south runs through the mountain's heart",
    size: 60,
    chambers: VEIN,
    tunnels: [
      { a: 0, b: 1, width: 3 },
      { a: 0, b: 2, width: 3 },
      { a: 1, b: 3, width: 3.2, kind: "stairs", via: [[27, 18]] },
      { a: 2, b: 3, width: 2.4, via: [[24, 38]] },
    ],
    shape: (m) => {
      // an underground river through the hounds' den, falling off the front into the dark
      m.path([[30, 33], [36, 45], [40, 52]], 2.4, "water", 1);
      // a ring of bare rock round the vein's heart, where the outcome of the conclave shows
      m.disc(15, 24, 5.4, "moss", 7, 0, 1);
      m.disc(15, 24, 3, "marble", 7, 0, 1);
    },
    props: (m) => {
      const out = [
        { id: "veinheart" as PropId, i: 15, j: 24 },
        P("crystal", 34, 15),
        P("crystal", 40, 20),
        P("crystal", 31, 22),
        P("crystal", 9, 18),
        P("crystal", 21, 30),
        P("crystal", 8, 29),
        P("firejade", 11, 17, (f) => !!f["vein:phoenix"]),
        P("firejade", 20, 19, (f) => !!f["vein:phoenix"]),
        P("glowshroom", 10, 19, (f) => !!f["vein:herb"]),
        P("glowshroom", 21, 29, (f) => !!f["vein:herb"]),
        P("herbbed", 19, 19, (f) => !!f["vein:herb"]),
        P("swordspire", 21, 21, (f) => !!f["vein:sword"]),
        P("lotus", 12, 28, (f) => !!f["vein:shared"]),
        P("bones", 19, 28, (f) => !!f["vein:taken"]),
        P("spikes", 10, 20, (f) => !!f["vein:taken"]),
        P("torch", 44, 28),
        P("torch", 42, 36),
      ];
      strew(m, out, ["stalagmite", "crystal", "rock", "stalagmite", "glowshroom"], 0.07, 81, [...VEIN.map((c) => c.c), [27, 18], [24, 38]]);
      return out;
    },
    npcs: [
      { key: "longlao", char: "dragon", i: 15, j: 21, dir: 2, anim: "float" },
      { key: "yanhuoV", name: "Yan Huo", char: "yanhuo", i: 11, j: 27, dir: 3, when: conclave },
      { key: "baizhiV", name: "Bai Zhi", char: "baizhi", i: 15, j: 29, dir: 0, when: conclave },
      { key: "lingfengV", name: "Ling Feng", char: "lingfeng", i: 19, j: 27, dir: 15, when: conclave },
    ],
    enemies: [
      { key: "vein-hound-1", enemy: "stonehound", i: 39, j: 39, range: 2 },
      { key: "vein-hound-2", enemy: "stonehound", i: 38, j: 18, range: 2 },
      { key: "vein-hound-3", enemy: "stonehound", i: 24, j: 37, range: 1.5 },
    ],
    interacts: [
      { key: "vein-stele", kind: "sign", i: 44, j: 35, text: "An ancient boundary stone, its characters older than the sect: “Below this point the earth dreams. Walk quietly, and do not wake what you cannot put back to sleep.”" },
      { key: "vein-shrine", kind: "shrine", i: 39, j: 44 },
      { key: "vein-chest", kind: "chest", i: 33, j: 14 },
      { key: "vein-herb", kind: "herb", i: 40, j: 38 },
    ],
    critters: [
      { key: "bat-v1", char: "bat", i: 30, j: 28 },
      { key: "bat-v2", char: "bat", i: 20, j: 34 },
    ],
    patches: (m) => {
      const ring = (key: string, when: TerrainPatch["when"], kind: TileKind, height: number) => {
        const p = new PatchPainter(m);
        p.disc(15, 24, 5.4, (_i, _j, d) => (d > 0.62 ? { kind, height } : undefined));
        return p.build(key, when);
      };
      const moss = new PatchPainter(m);
      m.each((i, j) => {
        if (m.kind(i, j) === "cave" && fbm(i * 0.3, j * 0.3, 9) > 0.5) moss.set(i, j, "moss");
      });
      return [
        ring("vein-lava", (f) => !!f["vein:phoenix"], "lava", 6),
        moss.build("vein-moss", (f) => !!f["vein:herb"]),
        ring("vein-steel", (f) => !!f["vein:sword"], "plaza", 7),
        ring("vein-spring", (f) => !!f["vein:shared"], "water", 6),
        ring("vein-ash", (f) => !!f["vein:taken"], "ash", 7),
      ];
    },
    weather: "drips",
    night: 0.74,
    tint: "#2a8a8a",
    opens: (f) => !!f.veinOpened,
  });
}

// ----------------------------------------------------------------------------- the Icesoul Hollow
const ICESOUL: Chamber[] = [
  { c: [46, 28], r: 5, h: 3 },
  { c: [33, 18], r: 5.5, h: 4 },
  { c: [30, 38], r: 6.5, h: 2 },
  { c: [14, 27], r: 8.4, h: 5 },
  { c: [18, 9], r: 4.6, h: 6 },
];
const ICESOUL_TUNNELS: Tunnel[] = [
  { a: 0, b: 1, width: 3, via: [[40, 21]] },
  { a: 0, b: 2, width: 3 },
  { a: 1, b: 4, width: 2.6, via: [[25, 13]] },
  { a: 2, b: 3, width: 2.8, via: [[21, 35]] },
  { a: 1, b: 3, width: 2.6, kind: "ice", via: [[24, 22]] },
];


/** The hollow under Frostveil, where the first abbot walked down to listen to the ice and never came up. */
function buildIcesoul(): InteriorDef {
  const lair = (f: Record<string, boolean>) => !!f.iceAsk && !f.rimeDefeated;
  return cave({
    key: "icesoul",
    name: "Icesoul Hollow",
    hanzi: "冰魄窟",
    subtitle: "Under Frostveil the ice remembers every word said to it",
    size: 54,
    chambers: ICESOUL,
    tunnels: ICESOUL_TUNNELS,
    shape: (m) => {
      // a frozen lake in the great chamber, open black water at its heart, and a frozen fall spilling off the front
      m.disc(12, 28, 5.2, "ice", 5, 1, 31);
      m.disc(11, 29, 2.2, "deep", 5);
      m.path([[30, 41], [31, 46], [32, 50]], 2, "ice", 2);
      m.disc(18, 9, 2, "snow", 6, 0.6, 32);
    },
    props: (m) => {
      const out = [
        P("icecolumn", 38, 24),
        P("icecolumn", 27, 34),
        P("icecolumn", 19, 21),
        P("icecolumn", 7, 22),
        P("icecolumn", 20, 33),
        P("crystal", 36, 14),
        P("crystal", 15, 5),
        P("bones", 8, 25),
        P("candle", 9, 24, (f) => !f["ice:returned"]),
        P("torch", 42, 24),
        P("torch", 26, 41),
        P("cushion", 19, 9),
      ];
      strew(m, out, ["stalagmite", "icecolumn", "rock", "crystal"], 0.07, 91, [...ICESOUL.map((c) => c.c), ...alongTunnels(ICESOUL, ICESOUL_TUNNELS)]);
      return out;
    },
    npcs: [
      // Brother Heng sits in the ice niche where he went to listen, too cold now to stand, until the wyrm is gone
      { key: "heng", name: "Brother Heng", char: "monk", i: 18, j: 10, dir: 3, anim: "chant", when: (f) => !!f.iceAsk && !f["ice:returned"] && !f["ice:left"] },
    ],
    enemies: [
      { key: "ice-wyrm", enemy: "rimewyrm", i: 14, j: 25, range: 0.5, when: lair },
      { key: "ice-fang-1", enemy: "frostfang", i: 31, j: 39, range: 2 },
      { key: "ice-fang-2", enemy: "frostfang", i: 33, j: 16, range: 1.5 },
      { key: "ice-fang-3", enemy: "frostfang", i: 20, j: 24, range: 1.5, when: lair },
    ],
    interacts: [
      { key: "icesoul-beads", kind: "sign", i: 9, j: 25, text: "The first abbot's bones, sitting cross-legged in the ice. Around them lie the frost-white prayer beads Frostveil lost a hundred years ago.", when: (f) => !!f.rimeDefeated && !f["ice:returned"] && !f["ice:left"] },
      { key: "icesoul-stele", kind: "sign", i: 41, j: 33, text: "Scratched in the ice by a careful hand: “I came down to hear what the ice says. It says: be still, and you will last as long as I do. I think it is lonely.”" },
      { key: "icesoul-chest", kind: "chest", i: 35, j: 20 },
      { key: "icesoul-herb", kind: "herb", i: 16, j: 7 },
    ],
    critters: [{ key: "bat-ic1", char: "bat", i: 28, j: 26 }],
    weather: "snow",
    night: 0.72,
    tint: "#6ab0e8",
  });
}

// ----------------------------------------------------------------------------- the Tomb Beneath the Sands
const TOMB: Chamber[] = [
  { c: [46, 30], r: 5, h: 2, kind: "sand" },
  { c: [34, 30], r: 4.2, h: 2, kind: "plaza" },
  { c: [30, 14], r: 5, h: 4, kind: "plaza" },
  { c: [28, 45], r: 5, h: 1, kind: "plaza" },
  { c: [12, 28], r: 8, h: 3, kind: "marble" },
];
const TOMB_TUNNELS: Tunnel[] = [
  { a: 0, b: 1, width: 3, kind: "plaza" },
  { a: 1, b: 2, width: 2.6, kind: "stairs", via: [[33, 22]] },
  { a: 1, b: 3, width: 2.6, via: [[31, 38]] },
  { a: 2, b: 4, width: 2.6, kind: "plaza", via: [[18, 16]] },
  { a: 3, b: 4, width: 2.6, kind: "plaza", via: [[16, 40]] },
];


/** A queen of the caravans, buried under the Yellow Sands before the Azure Cloud Sect was founded. */
function buildSandTomb(): InteriorDef {
  return cave({
    key: "sandtomb",
    name: "Tomb Beneath the Sands",
    hanzi: "沙下古墓",
    subtitle: "Queen Ayala of the caravans sleeps where the dunes buried her city",
    size: 56,
    chambers: TOMB,
    tunnels: TOMB_TUNNELS,
    shape: (m) => {
      // sand has poured in through the broken roof and drifted against the walls
      m.disc(44, 34, 3, "sand", 2, 1.2, 41);
      m.disc(27, 47, 2.4, "sand", 1, 1, 42);
      m.disc(32, 11, 2, "sand", 4, 1, 43);
      // the queen's own floor, a ring of gold-veined marble round the coffin
      m.disc(12, 28, 3.6, "plaza", 3, 0, 1);
    },
    props: (m) => {
      const out = [
        { id: "sarcophagus" as PropId, i: 10, j: 28 },
        P("lion", 15, 23),
        P("lion", 15, 33),
        P("statue", 6, 22),
        P("statue", 6, 34),
        P("vase", 31, 10),
        P("vase", 26, 15),
        P("vase", 24, 46),
        P("vase", 31, 48),
        P("candle", 36, 27),
        P("candle", 36, 33),
        P("bones", 29, 17),
        P("bones", 25, 43),
        P("torch", 42, 26),
        P("torch", 20, 18),
        P("torch", 18, 38),
      ];
      strew(m, out, ["rubble", "vase", "stalagmite", "bones"], 0.06, 101, [...TOMB.map((c) => c.c), ...alongTunnels(TOMB, TOMB_TUNNELS)]);
      return out;
    },
    npcs: [],
    enemies: [
      { key: "tomb-wyrm", enemy: "dunewyrm", i: 14, j: 28, range: 0.5, when: (f) => !!f.tombAsk && !f.duneDefeated },
      { key: "tomb-guard-1", enemy: "jiangshi", i: 30, j: 16, range: 1.5 },
      { key: "tomb-guard-2", enemy: "jiangshi", i: 27, j: 43, range: 1.5 },
      { key: "tomb-guard-3", enemy: "jiangshi", i: 20, j: 28, range: 1.2, when: (f) => !f.duneDefeated },
      { key: "tomb-serpent", enemy: "serpent", i: 42, j: 33, range: 2 },
    ],
    interacts: [
      { key: "tomb-stele-1", kind: "sign", i: 36, j: 30, text: "The first stele: “Here lies Ayala, queen of the caravans of the Golden Sea, who made a road of wells from the sands to the sea.”" },
      { key: "tomb-stele-2", kind: "sign", i: 31, j: 12, text: "The second stele: “She asked the dunes for a city, and they gave it. She asked the dunes for a son, and they gave him. She asked for rain, and the dunes were offended.”" },
      { key: "tomb-stele-3", kind: "sign", i: 29, j: 47, text: "The third stele: “When the storm came she would not leave her people. Let none who loved her disturb her. Let those who did not, be shown the way out.”" },
      { key: "tomb-coffin", kind: "sign", i: 11, j: 26, text: "Queen Ayala's coffin. Jade glints on the lid in the candlelight.", when: (f) => !!f.duneDefeated && !f["tomb:robbed"] && !f["tomb:honoured"] },
      { key: "tomb-chest", kind: "chest", i: 33, j: 15 },
      // what the queen's people left for whoever closes her coffin again
      { key: "tomb-gift", kind: "chest", i: 8, j: 32, when: (f) => !!f["tomb:honoured"] },
      { key: "tomb-herb", kind: "herb", i: 24, j: 45 },
    ],
    critters: [{ key: "bat-tb1", char: "bat", i: 22, j: 30 }],
    weather: "drips",
    night: 0.76,
    tint: "#d8a04a",
  });
}

// ----------------------------------------------------------------------------- the Tidevoice Cave
const TIDE: Chamber[] = [
  { c: [44, 26], r: 5, h: 2 },
  { c: [30, 15], r: 5.6, h: 3, kind: "wood" },
  { c: [30, 36], r: 7, h: 1 },
  { c: [12, 24], r: 7.4, h: 2 },
  { c: [16, 41], r: 4.4, h: 1, kind: "sand" },
];
const TIDE_TUNNELS: Tunnel[] = [
  { a: 0, b: 1, width: 3, kind: "wood", via: [[38, 18]] },
  { a: 0, b: 2, width: 3 },
  { a: 1, b: 3, width: 2.6, via: [[20, 16]] },
  { a: 2, b: 3, width: 2.6, via: [[20, 31]] },
  { a: 2, b: 4, width: 2.4, kind: "sand", via: [[22, 40]] },
];


/** A sea cave under the harbour's headland, where the tide talks in the dark and smugglers dive for pearls. */
function buildTideCave(): InteriorDef {
  return cave({
    key: "tidecave",
    name: "Tidevoice Cave",
    hanzi: "潮音洞",
    subtitle: "Where the sea comes in under the headland and talks to itself",
    size: 52,
    chambers: TIDE,
    tunnels: TIDE_TUNNELS,
    shape: (m) => {
      // the sea comes in across the front of the lower cave and drains away into the dark
      m.disc(31, 39, 3, "water", 1, 1, 51);
      m.path([[32, 42], [34, 47], [35, 51]], 2.4, "water", 1);
      // the pearl pool, deep and still
      m.disc(9, 25, 3, "deep", 2, 0.5, 52);
    },
    props: (m) => {
      const out = [
        P("tidepool", 26, 34),
        P("tidepool", 35, 33),
        P("tidepool", 18, 43),
        P("tidepool", 15, 20),
        P("boat", 33, 41),
        P("barrels", 27, 12),
        P("sacks", 33, 12),
        P("sacks", 26, 17),
        P("campfire", 30, 15),
        P("fishrack", 34, 18),
        P("crystal", 7, 20),
        P("crystal", 14, 29),
        P("torch", 40, 22),
        P("torch", 22, 14),
      ];
      strew(m, out, ["stalagmite", "rock", "tidepool", "stalagmite"], 0.06, 111, [...TIDE.map((c) => c.c), ...alongTunnels(TIDE, TIDE_TUNNELS)]);
      return out;
    },
    npcs: [
      { key: "shui", name: "Little Shui", char: "boy", i: 16, j: 42, dir: 2, anim: "huddle", when: (f) => !!f.tideAsk && !f.shuiSaved },
    ],
    enemies: [
      { key: "tide-pearl", enemy: "pearlwyrm", i: 12, j: 23, range: 0.5, when: (f) => !!f.tideAsk && !f.pearlDefeated },
      { key: "tide-smuggler-1", enemy: "smuggler", i: 31, j: 17, range: 1.5, when: (f) => !f.pearlDefeated },
      { key: "tide-smuggler-2", enemy: "smuggler", i: 28, j: 13, range: 1.2, when: (f) => !f.pearlDefeated },
      { key: "tide-serpent", enemy: "serpent", i: 27, j: 37, range: 2 },
    ],
    interacts: [
      { key: "tide-pearl-pool", kind: "sign", i: 9, j: 22, text: "The Pearl Serpent's pool. On the rock above it, where the beast kept it, lies a pearl the size of a fist, glowing like a small moon.", when: (f) => !!f.pearlDefeated && !f["tide:given"] && !f["tide:kept"] },
      { key: "tide-stele", kind: "sign", i: 40, j: 28, text: "Tally marks scratched by the smugglers: pearls brought up, boys sent down. The second column is longer than the first." },
      { key: "tide-chest", kind: "chest", i: 28, j: 14 },
      { key: "tide-herb", kind: "herb", i: 13, j: 40 },
    ],
    critters: [{ key: "bat-td1", char: "bat", i: 22, j: 26 }],
    weather: "drips",
    night: 0.7,
    tint: "#3a9ab0",
  });
}

// ----------------------------------------------------------------------------- the Bamboo Root Caverns
const ROOTS: Chamber[] = [
  { c: [44, 28], r: 5, h: 2, kind: "moss" },
  { c: [32, 16], r: 6, h: 3, kind: "moss" },
  { c: [30, 38], r: 6, h: 2 },
  { c: [14, 26], r: 8, h: 4, kind: "moss" },
  { c: [17, 8], r: 4.2, h: 5 },
];
const ROOTS_TUNNELS: Tunnel[] = [
  { a: 0, b: 1, width: 3, kind: "moss", via: [[38, 20]] },
  { a: 0, b: 2, width: 3 },
  { a: 1, b: 3, width: 2.8, via: [[22, 20]] },
  { a: 2, b: 3, width: 2.6, via: [[20, 34]] },
  { a: 1, b: 4, width: 2.4, via: [[23, 10]] },
];


/** Under the Whispering Bamboo, where the last fox the Blood Moon held went to ground. */
function buildBambooRoots(): InteriorDef {
  return cave({
    key: "bambooroots",
    name: "Bamboo Root Caverns",
    hanzi: "竹根洞",
    subtitle: "The bamboo's roots drink from the dark, and something drinks with them",
    size: 52,
    chambers: ROOTS,
    tunnels: ROOTS_TUNNELS,
    shape: (m) => {
      // a spring the roots drink from, spilling off the front of the lower cave
      m.disc(30, 40, 2.4, "water", 2, 0.8, 61);
      m.path([[31, 42], [32, 48]], 2, "water", 2);
      // the vixen's den, scorched red by the crimson qi she still carries
      m.disc(13, 26, 3.2, "redrock", 4, 0.8, 62);
    },
    props: (m) => {
      const out = [
        P("rootcurtain", 40, 25),
        P("rootcurtain", 36, 13),
        P("rootcurtain", 27, 19),
        P("rootcurtain", 25, 41),
        P("rootcurtain", 19, 22),
        P("rootcurtain", 9, 21),
        P("rootcurtain", 20, 6),
        P("glowshroom", 33, 21),
        P("glowshroom", 28, 34),
        P("glowshroom", 13, 33),
        P("bones", 11, 23, (f) => !f["vixen:purified"]),
        P("wisps", 15, 23, (f) => !f.vixenDefeated),
        P("lotus", 30, 40, (f) => !!f["vixen:purified"]),
        P("torch", 40, 32),
      ];
      strew(m, out, ["glowshroom", "rock", "rootcurtain", "stalagmite"], 0.07, 121, [...ROOTS.map((c) => c.c), ...alongTunnels(ROOTS, ROOTS_TUNNELS)]);
      return out;
    },
    npcs: [
      { key: "agou", name: "Ah Gou", char: "boy", i: 17, j: 9, dir: 3, anim: "huddle", when: (f) => !!f.vixenAsk && !f.gouSaved },
    ],
    enemies: [
      { key: "roots-vixen", enemy: "shadowvixen", i: 14, j: 25, range: 0.5, when: (f) => !!f.vixenAsk && !f.vixenDefeated },
      { key: "roots-fox-1", enemy: "fox", i: 31, j: 36, range: 2, when: (f) => !f.vixenDefeated },
      { key: "roots-fox-2", enemy: "fox", i: 31, j: 14, range: 1.5, when: (f) => !f.vixenDefeated },
      { key: "roots-wolf", enemy: "wolf", i: 16, j: 30, range: 1.5, when: (f) => !f.vixenDefeated },
    ],
    interacts: [
      { key: "roots-den", kind: "sign", i: 12, j: 24, text: "The vixen's den. She lies curled where she fell, the crimson qi seeping out of her like smoke. She is still breathing.", when: (f) => !!f.vixenDefeated && !f["vixen:purified"] && !f["vixen:slain"] },
      { key: "roots-stele", kind: "sign", i: 41, j: 30, text: "Old fox-script, scratched low on the rock where a fox would read it: “The moon was red. We ran down here. The roots kept us. Not all of us.”" },
      { key: "roots-chest", kind: "chest", i: 35, j: 18 },
      { key: "roots-herb", kind: "herb", i: 27, j: 39 },
    ],
    critters: [{ key: "bat-rt1", char: "bat", i: 24, j: 26 }],
    weather: "spores",
    night: 0.78,
    tint: "#6ab05a",
    opens: (f) => moonSet(f) || !!f.vixenAsk,
  });
}

const BUILDERS: Record<CaveId, () => InteriorDef> = { emberMine: buildEmberMine, grotto: buildGrotto, vein: buildVein, icesoul: buildIcesoul, sandtomb: buildSandTomb, tidecave: buildTideCave, bambooroots: buildBambooRoots };
const cache = new Map<CaveId, InteriorDef>();

/** Build (once) and return a cave. */
export function getCave(id: CaveId): InteriorDef & { opens?: (f: Record<string, boolean>) => boolean } {
  let d = cache.get(id);
  if (!d) cache.set(id, (d = BUILDERS[id]()));
  return d;
}

export const isCaveId = (s: string | undefined): s is CaveId => !!s && (CAVE_IDS as readonly string[]).includes(s);
