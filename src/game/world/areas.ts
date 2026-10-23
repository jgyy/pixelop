import { hash2, fbm } from "../pixel/noise";
import type { AnimId, HumanId } from "../art/characters";
import { propDef, type PropId } from "../art/props";
import type { EnemyId } from "../engine/enemies";
import { TileMap, type TileKind } from "./tilemap";

/**
 * The six explorable regions. Each is built procedurally from a few shape
 * operations (discs, paths, rects, noise) plus hand-placed landmarks, NPCs,
 * encounters and interactables.
 */

import type { AreaId } from "./ids";

export { AREA_IDS, type AreaId } from "./ids";

export type SkyId = "day" | "dusk" | "forest" | "night" | "blood" | "storm" | "interior";
export type Weather = "petals" | "leaves" | "fireflies" | "embers" | "snow" | "none";

export interface PropPlacement {
  id: PropId;
  i: number;
  j: number;
}

export interface NpcPlacement {
  key: string;
  char: HumanId;
  i: number;
  j: number;
  dir: number;
  anim?: AnimId;
  /** Wander radius in tiles (0 = stand still). */
  wander?: number;
  /** Only present while this predicate on story flags holds. */
  when?: (flags: Record<string, boolean>) => boolean;
  /** Patrol back and forth along these points (tile coordinates) instead of wandering. */
  route?: [number, number][];
}

/** Ambient wildlife: wanders, and takes flight when the heroine comes close. */
export interface Critter {
  key: string;
  char: "crane" | "bat";
  i: number;
  j: number;
}

export interface EnemySpawn {
  key: string;
  enemy: EnemyId;
  i: number;
  j: number;
  range: number;
  when?: (flags: Record<string, boolean>) => boolean;
}

export type InteractKind = "shrine" | "exit" | "chest" | "herb" | "sign" | "altar" | "door";

export interface Interactable {
  key: string;
  kind: InteractKind;
  i: number;
  j: number;
  text?: string;
  /** Doors: the interior they lead into, or "out" back to the open world. */
  to?: string;
  /** Signs: how the heroine looks at it (she reads by default). */
  anim?: AnimId;
}

export interface AreaDef {
  id: AreaId;
  name: string;
  hanzi: string;
  subtitle: string;
  map: TileMap;
  /** Lowest level walls extend down to. */
  base: number;
  floating: boolean;
  sky: SkyId;
  weather: Weather;
  /** 0 = full daylight, 1 = deep night (lights glow). */
  night: number;
  tint?: string;
  /** Where the heroine lands when arriving from the world map. */
  arrive: [number, number];
  props: PropPlacement[];
  npcs: NpcPlacement[];
  enemies: EnemySpawn[];
  interacts: Interactable[];
  critters?: Critter[];
}

const P = (id: PropId, i: number, j: number): PropPlacement => ({ id, i, j });

/** Scatter a prop with probability `p` on tiles accepted by `ok`. */
function scatter(map: TileMap, out: PropPlacement[], id: PropId | PropId[], p: number, seed: number, ok: (i: number, j: number) => boolean): void {
  const taken = new Set(out.map((o) => `${o.i},${o.j}`));
  map.each((i, j) => {
    if (taken.has(`${i},${j}`) || !ok(i, j)) return;
    if (hash2(i, j, seed) < p) {
      const pid = Array.isArray(id) ? id[Math.floor(hash2(i, j, seed + 1) * id.length)] : id;
      out.push(P(pid, i, j));
      taken.add(`${i},${j}`);
    }
  });
}

const notNear = (pts: [number, number][], r: number) => (i: number, j: number) => pts.every(([x, y]) => Math.hypot(i - x, j - y) > r);

// ----------------------------------------------------------------------------- Azure Cloud Sect
function buildSect(): AreaDef {
  const m = new TileMap(30, 30, "void", 0);
  m.disc(15, 15, 12.6, "grass", 2, 1.6, 4);
  m.rect(10, 11, 19, 18, "plaza", 2);
  m.rect(11, 3, 18, 9, "plaza", 4);
  m.rect(13, 10, 16, 10, "stairs", 3);
  m.disc(22.5, 16.5, 2.7, "water", 1, 0.4, 5);
  m.rect(19, 16, 26, 16, "wood", 2);
  m.disc(6, 14, 2.2, "moss", 3, 0.3, 6);
  m.rect(4, 19, 10, 23, "dirt", 2);
  m.path(
    [
      [15, 18],
      [15, 27],
    ],
    2,
    "dirt",
  );
  m.path(
    [
      [10, 14],
      [7, 14],
    ],
    1.4,
    "moss",
  );
  m.each((i, j) => {
    if (m.kind(i, j) === "grass" && hash2(i, j, 9) > 0.8) m.set(i, j, "meadow");
  });
  const props: PropPlacement[] = [
    P("hall", 15, 6),
    P("lion", 12, 10),
    P("lion", 17, 10),
    P("banner", 11, 8),
    P("banner", 18, 8),
    P("lantern", 10, 11),
    P("lantern", 19, 11),
    P("lantern", 10, 18),
    P("lantern", 19, 18),
    P("lantern", 14, 22),
    P("lantern", 17, 25),
    P("gate", 15, 27),
    P("shrine", 6, 13),
    P("stall", 21, 11),
    P("cauldron", 22, 13),
    P("dummy", 5, 20),
    P("dummy", 9, 20),
    P("lotus", 22, 15),
    P("lotus", 23, 18),
    P("lotus", 21, 17),
    P("stele", 12, 20),
    P("cherry", 8, 10),
    P("cherry", 21, 21),
    P("cherry", 24, 12),
    P("cherry", 9, 25),
    P("cherry", 20, 7),
    P("herb", 24, 22),
    P("chest", 5, 9),
  ];
  scatter(m, props, ["pine", "pine", "rock", "tallgrass"], 0.28, 11, (i, j) => {
    const k = m.kind(i, j);
    const edge = Math.hypot(i - 15, j - 15) > 9.5;
    return (k === "grass" || k === "meadow") && edge && notNear([[15, 26], [15, 27], [6, 13]], 1.6)(i, j);
  });
  scatter(m, props, "tallgrass", 0.06, 12, (i, j) => (m.kind(i, j) === "grass" || m.kind(i, j) === "meadow") && notNear([[15, 22]], 2)(i, j));
  return {
    id: "sect",
    name: "Azure Cloud Sect",
    hanzi: "青云宗",
    subtitle: "Floating peaks above the sea of clouds",
    map: m,
    base: 0,
    floating: true,
    sky: "day",
    weather: "petals",
    night: 0,
    arrive: [15.5, 25.5],
    props,
    npcs: [
      { key: "elder", char: "elder", i: 15, j: 9, dir: 0 },
      { key: "qing", char: "qing", i: 20, j: 12, dir: 1, anim: "idle" },
      { key: "abao", char: "abao", i: 13, j: 15, dir: 2, wander: 2 },
      { key: "feng", char: "discipleM", i: 7, j: 21, dir: 12, anim: "practice" },
      { key: "lan", char: "discipleF", i: 8, j: 22, dir: 12, anim: "practice" },
    ],
    enemies: [],
    critters: [
      { key: "crane-s1", char: "crane", i: 20, j: 20 },
      { key: "crane-s2", char: "crane", i: 25, j: 19 },
    ],
    interacts: [
      { key: "sect-shrine", kind: "shrine", i: 6, j: 13 },
      { key: "sect-gate", kind: "exit", i: 15, j: 27 },
      { key: "sect-herb", kind: "herb", i: 24, j: 22 },
      { key: "sect-chest", kind: "chest", i: 5, j: 9 },
      { key: "sect-stele", kind: "sign", i: 12, j: 20, text: "The stele reads: “Heaven treats all things as straw dogs. The cultivator asks nothing of heaven — and endures its lightning.”" },
    ],
  };
}

// ----------------------------------------------------------------------------- Willow Creek Village
function buildVillage(): AreaDef {
  const m = new TileMap(32, 32, "grass", 1);
  m.path(
    [
      [0, 10],
      [10, 13],
      [18, 19],
      [31, 23],
    ],
    3,
    "water",
    0,
  );
  m.each((i, j) => {
    if (m.kind(i, j) !== "water") {
      const near = [-1, 0, 1].some((a) => [-1, 0, 1].some((b) => m.kind(i + a, j + b) === "water"));
      if (near) m.set(i, j, "sand", 1);
    }
  });
  m.path(
    [
      [16, 31],
      [16, 4],
    ],
    2,
    "dirt",
    (i, j) => (m.kind(i, j) === "water" ? 1 : undefined),
  );
  m.each((i, j) => {
    if (m.kind(i, j) === "dirt" && m.height(i, j) === 1 && [-1, 0, 1].some((a) => [-1, 0, 1].some((b) => m.kind(i + a, j + b) === "water")) && j > 13 && j < 22) m.set(i, j, "wood", 1);
  });
  m.path(
    [
      [5, 7],
      [27, 7],
    ],
    1.6,
    "dirt",
  );
  m.rect(13, 8, 19, 12, "plaza", 1);
  m.rect(2, 24, 8, 30, "paddy", 0);
  m.rect(2, 24, 8, 24, "dirt", 1);
  m.rect(2, 27, 8, 27, "dirt", 1);
  m.rect(24, 26, 30, 30, "meadow", 1);
  const props: PropPlacement[] = [
    P("house", 7, 3),
    P("house", 11, 3),
    P("house", 20, 3),
    P("house", 24, 3),
    P("house", 24, 10),
    P("house", 9, 20),
    P("house", 22, 26),
    P("well", 14, 9),
    P("laundry", 9, 5),
    P("stall", 18, 9),
    P("stall", 18, 11),
    P("redlantern", 13, 12),
    P("redlantern", 19, 13),
    P("redlantern", 15, 25),
    P("sign", 17, 28),
    P("maple", 5, 12),
    P("maple", 27, 14),
    P("maple", 12, 27),
    P("willow", 4, 15),
    P("willow", 22, 17),
    P("willow", 13, 13),
    P("fence", 4, 23),
    P("fence", 5, 23),
    P("fence", 6, 23),
    P("fenceY", 9, 25),
    P("fenceY", 9, 26),
    P("fenceY", 9, 28),
    P("herb", 27, 28),
    P("chest", 29, 4),
    P("reeds", 7, 11),
    P("reeds", 25, 21),
    P("reeds", 20, 19),
  ];
  scatter(m, props, ["maple", "tallgrass", "rock", "tallgrass"], 0.12, 21, (i, j) => (m.kind(i, j) === "grass" || m.kind(i, j) === "meadow") && (i < 3 || i > 28 || j < 2 || j > 29) && notNear([[16, 30]], 2)(i, j));
  scatter(m, props, "tallgrass", 0.05, 22, (i, j) => m.kind(i, j) === "grass" && notNear([[16, 16]], 3)(i, j));
  return {
    id: "village",
    name: "Willow Creek Village",
    hanzi: "柳溪村",
    subtitle: "Mortal farmland at the foot of the mountains",
    map: m,
    base: -1,
    floating: false,
    sky: "dusk",
    weather: "leaves",
    night: 0.15,
    tint: "#ff9a5a",
    arrive: [16.5, 29.5],
    props,
    npcs: [
      { key: "zhou", char: "zhou", i: 16, j: 10, dir: 0 },
      { key: "hua", char: "hua", i: 10, j: 6, dir: 1 },
      { key: "liu", char: "farmer", i: 5, j: 24, dir: 2, wander: 1.5 },
      { key: "mei", char: "child", i: 19, j: 15, dir: 0, wander: 2.5 },
    ],
    enemies: [
      { key: "village-fox", enemy: "fox", i: 16, j: 22, range: 1.5, when: (f) => !!f.metElder && !f.villageSaved },
    ],
    interacts: [
      { key: "village-exit", kind: "exit", i: 16, j: 31 },
      { key: "village-herb", kind: "herb", i: 27, j: 28 },
      { key: "village-chest", kind: "chest", i: 29, j: 4 },
      { key: "village-sign", kind: "sign", i: 17, j: 28, text: "Willow Creek — north: the Village Hall. West: the bamboo forest path, closed by order of Head Zhou." },
    ],
  };
}

// ----------------------------------------------------------------------------- Whispering Bamboo Forest
function buildBamboo(): AreaDef {
  const m = new TileMap(32, 32, "leaf", 1);
  m.each((i, j) => m.set(i, j, undefined, Math.round(fbm(i * 0.12, j * 0.12, 3) * 2.4)));
  const route: [number, number][] = [
    [16, 31],
    [12, 24],
    [18, 16],
    [14, 9],
    [16, 5],
  ];
  m.path(
    [
      [0, 19],
      [10, 17],
      [31, 12],
    ],
    2,
    "water",
    0,
  );
  m.path(route, 2.2, "dirt");
  m.disc(16, 5, 4, "meadow", 2, 0.6, 8);
  m.disc(8, 21, 2.5, "moss", undefined, 0.4, 9);
  m.disc(24, 22, 2.6, "leaf", undefined, 0.4, 10);
  m.disc(23, 8, 2.4, "leaf", undefined, 0.4, 11);
  // smooth the path so every step is climbable, and bridge the stream
  m.each((i, j) => {
    if (m.kind(i, j) === "dirt" || m.kind(i, j) === "meadow" || m.kind(i, j) === "moss") m.set(i, j, undefined, j < 10 ? 2 : 1);
  });
  m.each((i, j) => {
    if (m.kind(i, j) === "water" && route.some((_, k) => k > 0 && distToSeg([i, j], route[k - 1], route[k]) < 1.3)) m.set(i, j, "wood", 1);
  });
  const props: PropPlacement[] = [P("spirittree", 16, 3), P("shrine", 8, 21), P("herb", 24, 22), P("herb", 22, 8), P("chest", 27, 27), P("stele", 13, 26)];
  const clear: [number, number][] = [
    [16, 5],
    [8, 21],
    [24, 22],
    [23, 8],
    [27, 27],
  ];
  scatter(m, props, "bamboo", 0.3, 31, (i, j) => {
    const k = m.kind(i, j);
    if (k !== "leaf") return false;
    if (route.some((_, n) => n > 0 && distToSeg([i, j], route[n - 1], route[n]) < 2)) return false;
    return notNear(clear, 3)(i, j);
  });
  scatter(m, props, ["rock", "tallgrass", "reeds"], 0.25, 32, (i, j) => m.kind(i, j) === "leaf" && notNear(clear, 2.4)(i, j) && !route.some((_, n) => n > 0 && distToSeg([i, j], route[n - 1], route[n]) < 1.6));
  return {
    id: "bamboo",
    name: "Whispering Bamboo Forest",
    hanzi: "竹林",
    subtitle: "Where the wind speaks and fox spirits wander",
    map: m,
    base: -1,
    floating: false,
    sky: "forest",
    weather: "fireflies",
    night: 0.35,
    tint: "#3a8a6a",
    arrive: [16.5, 29.5],
    props,
    npcs: [{ key: "huli", char: "huli", i: 16, j: 6, dir: 0, when: (f) => !!f.foxesCleared }],
    enemies: [
      { key: "fox-a", enemy: "fox", i: 12, j: 23, range: 2, when: (f) => !f.foxesCleared },
      { key: "fox-b", enemy: "fox", i: 17, j: 16, range: 2, when: (f) => !f.foxesCleared },
      { key: "fox-c", enemy: "fox", i: 24, j: 21, range: 1.5, when: (f) => !f.foxesCleared },
      { key: "wolf-a", enemy: "wolf", i: 14, j: 10, range: 1.5 },
      { key: "fox-d", enemy: "fox", i: 22, j: 9, range: 1.5, when: (f) => !!f.foxesCleared },
    ],
    interacts: [
      { key: "bamboo-exit", kind: "exit", i: 16, j: 31 },
      { key: "bamboo-shrine", kind: "shrine", i: 8, j: 21 },
      { key: "bamboo-herb-1", kind: "herb", i: 24, j: 22 },
      { key: "bamboo-herb-2", kind: "herb", i: 22, j: 8 },
      { key: "bamboo-chest", kind: "chest", i: 27, j: 27 },
      { key: "bamboo-stele", kind: "sign", i: 13, j: 26, text: "Claw marks score the stone. Beneath them, an older carving: “Fox and cultivator once shared this grove in peace.”" },
    ],
  };
}

function distToSeg([px, py]: [number, number], [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ----------------------------------------------------------------------------- Moonlit Lotus Lake
function buildLake(): AreaDef {
  const m = new TileMap(32, 32, "grass", 1);
  m.disc(16, 14, 11, "sand", 1, 1.2, 12);
  m.disc(16, 14, 9.6, "water", 0, 1.2, 12);
  m.disc(16, 13, 5, "deep", 0, 0.8, 13);
  m.disc(16, 13, 2.4, "grass", 1, 0.2, 14);
  m.disc(25, 7, 2.2, "grass", 1, 0.2, 15);
  m.rect(16, 15, 17, 27, "wood", 1);
  m.path(
    [
      [17.5, 12],
      [24, 7.5],
    ],
    1.6,
    "moss",
    1,
  );
  m.each((i, j) => {
    if (m.kind(i, j) === "grass" && hash2(i, j, 4) > 0.82) m.set(i, j, "meadow");
  });
  const props: PropPlacement[] = [
    P("pavilion", 15, 12),
    P("shrine", 6, 25),
    P("crystal", 26, 6),
    P("boat", 10, 9),
    P("lantern", 15, 18),
    P("lantern", 18, 22),
    P("lantern", 15, 26),
    P("willow", 4, 8),
    P("willow", 27, 18),
    P("willow", 7, 22),
    P("willow", 26, 26),
    P("herb", 28, 12),
    P("chest", 3, 28),
  ];
  for (const [i, j] of [
    [9, 14],
    [11, 18],
    [20, 19],
    [22, 15],
    [12, 8],
    [20, 9],
    [10, 11],
    [22, 11],
    [13, 20],
  ] as [number, number][])
    if (m.kind(i, j) === "water" || m.kind(i, j) === "deep") props.push(P("lotus", i, j));
  scatter(m, props, "reeds", 0.35, 41, (i, j) => m.kind(i, j) === "sand" && notNear([[16, 26]], 2)(i, j));
  scatter(m, props, ["pine", "tallgrass", "rock"], 0.16, 42, (i, j) => (m.kind(i, j) === "grass" || m.kind(i, j) === "meadow") && Math.hypot(i - 16, j - 14) > 12 && notNear([[16, 30], [6, 25]], 2)(i, j));
  return {
    id: "lake",
    name: "Moonlit Lotus Lake",
    hanzi: "月莲湖",
    subtitle: "Lotus lanterns drift beneath the full moon",
    map: m,
    base: -1,
    floating: false,
    sky: "night",
    weather: "fireflies",
    night: 0.62,
    tint: "#3a4aa0",
    arrive: [16.5, 29.5],
    props,
    npcs: [{ key: "wen", char: "wen", i: 17, j: 14, dir: 4, anim: "fish" }],
    enemies: [
      { key: "serpent-a", enemy: "serpent", i: 6, j: 12, range: 1.5 },
      { key: "serpent-b", enemy: "serpent", i: 25, j: 23, range: 1.5 },
      { key: "wolf-l", enemy: "wolf", i: 27, j: 14, range: 1.5 },
      { key: "serpent-king", enemy: "serpentKing", i: 25, j: 8, range: 0.5, when: (f) => !!f.metWen && !f.serpentKingDefeated },
    ],
    critters: [
      { key: "crane-l1", char: "crane", i: 5, j: 15 },
      { key: "crane-l2", char: "crane", i: 27, j: 22 },
    ],
    interacts: [
      { key: "lake-exit", kind: "exit", i: 16, j: 31 },
      { key: "lake-shrine", kind: "shrine", i: 6, j: 25 },
      { key: "lake-herb", kind: "herb", i: 28, j: 12 },
      { key: "lake-chest", kind: "chest", i: 3, j: 28 },
    ],
  };
}

// ----------------------------------------------------------------------------- Crimson Demon Valley
function buildValley(): AreaDef {
  const m = new TileMap(32, 32, "ash", 2);
  m.each((i, j) => m.set(i, j, fbm(i * 0.3, j * 0.3, 5) > 0.58 ? "redrock" : "ash", 2 + Math.round((fbm(i * 0.11, j * 0.11, 7) - 0.5) * 2.2)));
  m.path(
    [
      [0, 21],
      [13, 16],
      [31, 9],
    ],
    2.2,
    "lava",
    0,
  );
  const road: [number, number][] = [
    [4, 31],
    [8, 24],
    [16, 18],
    [21, 11],
    [25, 8],
  ];
  m.path(road, 2.2, "redrock", 2);
  m.each((i, j) => {
    if (m.kind(i, j) === "lava" && road.some((_, k) => k > 0 && distToSeg([i, j], road[k - 1], road[k]) < 1.4)) m.set(i, j, "plaza", 2);
  });
  m.disc(25, 5, 4.2, "redrock", 4, 0.3, 16);
  m.rect(23, 8, 27, 9, "stairs", 3);
  m.disc(6, 27, 2.2, "ash", 2, 0.2, 17);
  const props: PropPlacement[] = [
    P("bloodaltar", 25, 4),
    P("brazier", 22, 6),
    P("brazier", 28, 6),
    P("brazier", 22, 10),
    P("brazier", 28, 10),
    P("brazier", 10, 23),
    P("brazier", 17, 15),
    P("shrine", 5, 27),
    P("herb", 3, 18),
    P("chest", 29, 26),
  ];
  scatter(m, props, ["deadtree", "spikes", "bones", "boulder", "bones"], 0.2, 51, (i, j) => {
    const k = m.kind(i, j);
    if (k !== "ash" && k !== "redrock") return false;
    if (road.some((_, n) => n > 0 && distToSeg([i, j], road[n - 1], road[n]) < 2.2)) return false;
    return notNear([[25, 5], [5, 27], [3, 18], [29, 26]], 4.4)(i, j);
  });
  return {
    id: "valley",
    name: "Crimson Demon Valley",
    hanzi: "血魔谷",
    subtitle: "Stronghold of the Blood Moon Sect",
    map: m,
    base: -1,
    floating: false,
    sky: "blood",
    weather: "embers",
    night: 0.5,
    tint: "#a01020",
    arrive: [4.5, 29.5],
    props,
    npcs: [],
    enemies: [
      { key: "cultist-a", enemy: "cultist", i: 9, j: 22, range: 1.5 },
      { key: "jiangshi-a", enemy: "jiangshi", i: 15, j: 21, range: 2 },
      { key: "cultist-b", enemy: "cultist", i: 18, j: 13, range: 1.5 },
      { key: "jiangshi-b", enemy: "jiangshi", i: 24, j: 15, range: 2 },
      { key: "wolf-v", enemy: "wolf", i: 12, j: 27, range: 2 },
      { key: "patriarch", enemy: "patriarch", i: 25, j: 6, range: 0, when: (f) => !f.patriarchDefeated },
    ],
    critters: [
      { key: "bat-v1", char: "bat", i: 14, j: 27 },
      { key: "bat-v2", char: "bat", i: 27, j: 18 },
      { key: "bat-v3", char: "bat", i: 20, j: 10 },
    ],
    interacts: [
      { key: "valley-exit", kind: "exit", i: 4, j: 31 },
      { key: "valley-shrine", kind: "shrine", i: 5, j: 27 },
      { key: "valley-herb", kind: "herb", i: 3, j: 18 },
      { key: "valley-chest", kind: "chest", i: 29, j: 26 },
    ],
  };
}

// ----------------------------------------------------------------------------- Heavenly Tribulation Peak
function buildPeak(): AreaDef {
  const m = new TileMap(24, 24, "void", 0);
  m.disc(12, 12, 9.6, "snow", 3, 1.4, 21);
  m.disc(12, 9, 3.4, "marble", 4, 0.2, 22);
  m.path(
    [
      [12, 21],
      [12, 13],
    ],
    2,
    "marble",
    3,
  );
  m.rect(11, 12, 13, 12, "stairs", 3);
  m.rect(11, 12, 13, 12, "stairs", 3);
  const props: PropPlacement[] = [P("dais", 12, 9), P("crystal", 8, 7), P("crystal", 16, 7), P("crystal", 9, 12), P("crystal", 15, 12), P("stele", 13, 18), P("gate", 12, 21)];
  scatter(m, props, ["pine", "rock", "crystal"], 0.25, 61, (i, j) => m.kind(i, j) === "snow" && Math.hypot(i - 12, j - 12) > 6 && notNear([[12, 20], [12, 21]], 2)(i, j));
  return {
    id: "peak",
    name: "Heavenly Tribulation Peak",
    hanzi: "天劫峰",
    subtitle: "Where mortals become immortals — or ash",
    map: m,
    base: 0,
    floating: true,
    sky: "storm",
    weather: "snow",
    night: 0.3,
    tint: "#6a5aa0",
    arrive: [12.5, 20.5],
    props,
    npcs: [{ key: "elderPeak", char: "elder", i: 10, j: 13, dir: 2, when: (f) => !!f.heartReturned && !f.ascended }],
    enemies: [],
    critters: [{ key: "crane-p1", char: "crane", i: 16, j: 15 }],
    interacts: [
      { key: "peak-exit", kind: "exit", i: 12, j: 21 },
      { key: "peak-altar", kind: "altar", i: 12, j: 9 },
      { key: "peak-stele", kind: "sign", i: 13, j: 18, text: "Names are carved here by the thousand — cultivators who climbed this peak. Most end in a single stroke of soot." },
    ],
  };
}

const BUILDERS: Record<AreaId, () => AreaDef> = { sect: buildSect, village: buildVillage, bamboo: buildBamboo, lake: buildLake, valley: buildValley, peak: buildPeak };
const cache = new Map<AreaId, AreaDef>();

/** Build (once) and return an area, with prop footprints marked as blocked. */
export function getArea(id: AreaId): AreaDef {
  let a = cache.get(id);
  if (!a) {
    a = BUILDERS[id]();
    for (const p of a.props) {
      const d = propDef(p.id);
      if (!d.blocks) continue;
      for (let j = p.j + d.foot[1]; j <= p.j + d.foot[3]; j++) for (let i = p.i + d.foot[0]; i <= p.i + d.foot[2]; i++) a.map.block(i, j);
    }
    cache.set(id, a);
  }
  return a;
}

export const isGroundKind = (k: TileKind) => k !== "void";
