import { hash2, fbm } from "../pixel/noise";
import type { AnimId, HumanId } from "../art/characters";
import { footTiles, propDef, type PropId } from "../art/props";
import type { EnemyId } from "../engine/enemies";
import { LIQUID, TileMap, type TileKind } from "./tilemap";
import type { TerrainPatch } from "./terrain";
import { warMood } from "./war";

/**
 * The six explorable regions. Each is built procedurally from a few shape
 * operations (discs, paths, rects, noise) plus hand-placed landmarks, NPCs,
 * encounters and interactables.
 */

import type { AreaId } from "./ids";

export { AREA_IDS, type AreaId } from "./ids";

export type SkyId = "day" | "dusk" | "forest" | "night" | "blood" | "storm" | "interior" | "cave";
export type Weather = "petals" | "leaves" | "fireflies" | "embers" | "snow" | "drips" | "spores" | "rain" | "none";

export interface PropPlacement {
  id: PropId;
  /** Anchor tile. */
  i: number;
  j: number;
  /** Drawn this many times its size (buildings in the magnified world). */
  k?: number;
  /** Model origin in world coordinates, when it is not the anchor tile's centre. */
  at?: [number, number];
  /** Only shown while this predicate on story flags holds (festival decorations). Never blocks. */
  when?: (flags: Record<string, boolean>) => boolean;
  /** Ground height to stand at, when the tile beneath only rises to it once the story changes the land. */
  z?: number;
}

/** The tiles [i0, j0, i1, j1] (inclusive) a placed prop covers. */
export function placementTiles(p: PropPlacement): [number, number, number, number] {
  const [x, y] = p.at ?? [p.i + 0.5, p.j + 0.5];
  return footTiles(p.id, x, y, p.k ?? 1);
}

export interface NpcPlacement {
  key: string;
  /** What she calls them, when they wear a look several folk share (otherwise the character's own name). */
  name?: string;
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
  /** The outfit worn, by story flags (everyday clothes when it returns nothing). */
  outfit?: (flags: Record<string, boolean>) => string | undefined;
}

/** Shown only in one season (the game sets a `season:<name>` flag for the world it draws). */
export const inSeason = (season: string) => (f: Record<string, boolean>) => !!f[`season:${season}`];

/** Willow Creek puts on its festival best once the Jade Lotus Heart is home. */
export const festive = (f: Record<string, boolean>) => (f.heartReturned ? "festival" : undefined);

/** Ambient wildlife: wanders, and takes flight when the heroine comes close. */
export interface Critter {
  key: string;
  char: "crane" | "bat" | "horse";
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
  /** Only usable (and shown) while this predicate on story flags holds. */
  when?: (flags: Record<string, boolean>) => boolean;
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
  /** Changes the story makes to the land (see world/terrain.ts). */
  patches?: TerrainPatch[];
  /** The story can change a region's sky as well as its ground (the blood moon lifting, or spreading). */
  mood?: (flags: Record<string, boolean>) => Mood | undefined;
}

export type Mood = Partial<Pick<AreaDef, "sky" | "weather" | "night" | "tint">>;

/** A region as the story has left it: its own sky, or the one the story gave it. */
export function moodOf<T extends AreaDef>(d: T, flags: Record<string, boolean>): T {
  const m = d.mood?.(flags) ?? warMood(d.id, flags);
  return m ? { ...d, ...m } : d;
}

/** Whether the blood moon still hangs over the Crimson Demon Valley (Xue not talked home, the Heart not planted there). */
const bloodMoonUp = (f: Record<string, boolean>) => !f.xueRedeemed && !f["heart:planted"];

/** The blood moon she drank rises over the lands nearest the valley, until Elder Mo draws it out of her. */
const bloodMoon = (f: Record<string, boolean>): Mood | undefined => (f["heart:devoured"] && !f.purged ? { sky: "blood", weather: "embers", night: 0.42, tint: "#a01020" } : undefined);

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
    P("bell", 8, 16),
    P("stall", 21, 11),
    P("cauldron", 22, 13),
    P("dummy", 5, 20),
    P("dummy", 9, 20),
    P("lotus", 22, 15),
    P("lotus", 23, 18),
    P("lotus", 21, 17),
    P("koi", 24, 17),
    P("censer", 15, 13),
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
    // the hall where Elder Mo fell keeps a storm over it
    mood: (f) => (f.moBroken ? { sky: "storm", weather: "none", night: 0.3, tint: "#5a4a7a" } : undefined),
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
      // broken on the crimson path, he stays: an old man in grey, sweeping the scorched marble
      { key: "elder", char: "elder", i: 15, j: 9, dir: 0, outfit: (f) => (f.moBroken ? "broken" : undefined) },
      { key: "qing", char: "qing", i: 20, j: 12, dir: 1, anim: "idle" },
      { key: "abao", char: "abao", i: 13, j: 15, dir: 2, wander: 2 },
      { key: "feng", char: "discipleM", i: 7, j: 21, dir: 12, anim: "practice" },
      { key: "lan", char: "discipleF", i: 8, j: 22, dir: 12, anim: "practice" },
      { key: "guo", name: "Disciple Guo", char: "discipleM", i: 13, j: 25, dir: 2 },
      { key: "ning", name: "Disciple Ning", char: "discipleF", i: 18, j: 17, dir: 4, anim: "taichi" },
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
    P("house", 26, 16),
    P("house", 2, 18),
    P("house", 12, 23),
    P("well", 14, 9),
    P("noodlecart", 13, 11),
    P("cart", 21, 8),
    P("fishrack", 4, 21),
    P("butterflies", 26, 28),
    P("koi", 24, 21),
    P("laundry", 9, 5),
    P("stall", 18, 9),
    P("stall", 18, 11),
    P("redlantern", 13, 12),
    P("redlantern", 19, 13),
    P("lanterns", 16, 12),
    P("kite", 21, 14),
    P("redlantern", 15, 25),
    P("sign", 17, 28),
    P("maple", 5, 12),
    P("maple", 29, 13),
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
    // the almanac's sundial in the square
    P("sundial", 17, 8),
    // the village through the year: seedlings in spring, leaves and persimmons in autumn, snowmen in winter
    { id: "seedbed", i: 4, j: 22, when: inSeason("spring") },
    { id: "seedbed", i: 7, j: 22, when: inSeason("spring") },
    { id: "leafpile", i: 6, j: 13, when: inSeason("autumn") },
    { id: "leafpile", i: 23, j: 18, when: inSeason("autumn") },
    { id: "persimmons", i: 10, j: 4, when: inSeason("autumn") },
    { id: "persimmons", i: 25, j: 5, when: inSeason("autumn") },
    { id: "snowman", i: 20, j: 15, when: inSeason("winter") },
    { id: "snowman", i: 12, j: 15, when: inSeason("winter") },
  ];
  scatter(m, props, ["maple", "tallgrass", "rock", "tallgrass"], 0.12, 21, (i, j) => (m.kind(i, j) === "grass" || m.kind(i, j) === "meadow") && (i < 3 || i > 28 || j < 2 || j > 29) && notNear([[16, 30]], 2)(i, j));
  scatter(m, props, "tallgrass", 0.05, 22, (i, j) => m.kind(i, j) === "grass" && notNear([[16, 16]], 3)(i, j));
  return {
    id: "village",
    mood: bloodMoon,
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
      { key: "zhou", char: "zhou", i: 16, j: 10, dir: 0, outfit: festive },
      { key: "hua", char: "hua", i: 10, j: 6, dir: 1, outfit: festive },
      { key: "liu", char: "farmer", i: 5, j: 24, dir: 2, wander: 1.5, outfit: festive },
      { key: "mei", char: "child", i: 19, j: 15, dir: 0, wander: 2.5, outfit: festive },
      { key: "shunpal", name: "Little Hu", char: "boy", i: 11, j: 9, dir: 2, anim: "kick", outfit: festive },
      { key: "chun", name: "Auntie Chun", char: "villagerF", i: 11, j: 26, dir: 12, anim: "gather", outfit: festive },
      { key: "dikehoe", name: "Farmer Liu Er", char: "farmer", i: 5, j: 27, dir: 0, anim: "hoe", outfit: festive },
      { key: "yu", name: "Old Yu", char: "villagerM", i: 18, j: 13, dir: 2, wander: 1.2, outfit: festive },
      { key: "almanac", char: "almanac", i: 18, j: 7, dir: 1, anim: "read" },
    ],
    enemies: [
      // Granny Hua's foundling meets it on the first night, before she has ever been up to the sect
      { key: "village-fox", enemy: "fox", i: 16, j: 22, range: 1.5, when: (f) => (!!f.metElder || !!f["origin:foundling"]) && !f.villageSaved },
    ],
    interacts: [
      { key: "village-exit", kind: "exit", i: 16, j: 31 },
      { key: "village-herb", kind: "herb", i: 27, j: 28 },
      { key: "village-chest", kind: "chest", i: 29, j: 4 },
      { key: "village-sign", kind: "sign", i: 17, j: 28, text: "Willow Creek — north: the Village Hall. West: the bamboo forest path, closed by order of Head Zhou." },
      { key: "almanac-dial", kind: "sign", i: 17, j: 8, anim: "look", text: "The almanac's sundial." },
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
    mood: bloodMoon,
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
    // while she keeps her vigil at the Moon-Gazing Pavilion, the grove's spirit tree stands alone
    npcs: [{ key: "huli", char: "huli", i: 16, j: 6, dir: 0, when: (f) => !!f.foxesCleared && !(f.huliLetter && !f.peiAtRest) }],
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
    // the blood moon sets once Xue is talked home or the Heart takes root in the valley
    mood: (f) => (f["heart:planted"] ? { sky: "day", weather: "petals", night: 0.05, tint: "#9ff5de" } : f.xueRedeemed ? { sky: "dusk", weather: "fireflies", night: 0.25, tint: "#ff9a5a" } : undefined),
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
      // once the blood moon sets over the valley, most of its acolytes and its dead go home (a few stragglers linger by the road)
      { key: "cultist-a", enemy: "cultist", i: 9, j: 22, range: 1.5 },
      { key: "jiangshi-a", enemy: "jiangshi", i: 15, j: 21, range: 2 },
      { key: "cultist-b", enemy: "cultist", i: 18, j: 13, range: 1.5, when: bloodMoonUp },
      { key: "jiangshi-b", enemy: "jiangshi", i: 24, j: 15, range: 2, when: bloodMoonUp },
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

// ----------------------------------------------------------------------------- the Mistmarsh
function buildMarsh(): AreaDef {
  const m = new TileMap(32, 32, "moss", 1);
  m.each((i, j) => {
    if (hash2(i, j, 81) > 0.78) m.set(i, j, "grass");
  });
  // black pools among the reeds, deep at their hearts
  for (const [x, y, r, seed] of [
    [6, 8, 3.6, 82],
    [25, 7, 3.2, 83],
    [7, 24, 4, 84],
    [25, 24, 3.8, 85],
    [16, 26, 2.4, 86],
  ] as [number, number, number, number][]) {
    m.disc(x, y, r, "water", 0, 1, seed);
    m.disc(x, y, r * 0.45, "deep", 0, 0.4, seed + 1);
  }
  // the raised village mound and the boardwalks that join it to the world
  m.disc(16, 15, 6.4, "grass", 1, 0.8, 87);
  m.rect(14, 13, 18, 17, "plaza", 1);
  m.path(
    [
      [16, 0],
      [16, 13],
    ],
    2,
    "dirt",
    1,
  );
  m.path(
    [
      [18, 15],
      [31, 15],
    ],
    1.6,
    "dirt",
    1,
  );
  m.path(
    [
      [14, 16],
      [9, 20],
      [7, 20],
    ],
    1.6,
    "dirt",
    1,
  );
  // boardwalks over the water
  m.each((i, j) => {
    if (m.kind(i, j) !== "dirt") return;
    if ([-1, 0, 1].some((a) => [-1, 0, 1].some((b) => LIQUID[m.kind(i + a, j + b)]))) m.set(i, j, "wood", 1);
  });
  const props: PropPlacement[] = [
    P("stilthouse", 11, 10),
    P("stilthouse", 19, 10),
    P("stilthouse", 19, 18),
    P("stilthouse", 10, 17),
    P("fishrack", 14, 12),
    P("lantern", 14, 18),
    P("lantern", 18, 12),
    P("redlantern", 17, 2),
    P("shrine", 22, 14),
    P("boat", 6, 23),
    P("boat", 25, 8),
    P("wisps", 7, 13),
    P("wisps", 25, 20),
    P("wisps", 13, 27),
    P("grave", 4, 14),
    P("herb", 28, 12),
    P("chest", 3, 29),
    P("stele", 15, 3),
    P("koi", 16, 26),
    P("butterflies", 21, 4),
    P("campfire", 16, 15),
  ];
  for (const [i, j] of [
    [5, 7],
    [7, 9],
    [24, 6],
    [8, 25],
    [6, 23],
    [26, 25],
    [24, 23],
    [17, 26],
  ] as [number, number][])
    if (LIQUID[m.kind(i, j)] && !props.some((p) => p.i === i && p.j === j)) props.push(P("lotus", i, j));
  const clear: [number, number][] = [
    [16, 15],
    [22, 14],
    [28, 12],
    [3, 29],
    [12, 22],
    [21, 21],
    [23, 11],
    [15, 3],
    [9, 4],
  ];
  scatter(m, props, ["willow", "deadtree", "reeds", "reeds", "tallgrass"], 0.24, 88, (i, j) => (m.kind(i, j) === "moss" || m.kind(i, j) === "grass") && notNear(clear, 2.6)(i, j) && Math.hypot(i - 16, j - 15) > 7);
  scatter(m, props, "reeds", 0.18, 89, (i, j) => m.kind(i, j) === "water" && [-1, 0, 1].some((a) => !LIQUID[m.kind(i + a, j)]));
  return {
    id: "marsh",
    name: "The Mistmarsh",
    hanzi: "雾泽",
    subtitle: "Stilt houses, will-o'-wisps and a wise woman who knows every frog by name",
    map: m,
    base: -1,
    floating: false,
    sky: "forest",
    weather: "fireflies",
    night: 0.45,
    tint: "#4a8a6a",
    arrive: [16.5, 1.5],
    props,
    npcs: [
      { key: "ye", char: "marshwitch", i: 15, j: 16, dir: 2, wander: 1 },
      { key: "reedcutter", name: "Reed-cutter Mo", char: "villagerM", i: 13, j: 19, dir: 4, anim: "gather" },
      { key: "netmaker", name: "Net-mender Ping", char: "villagerF", i: 17, j: 14, dir: 14, anim: "pour" },
      { key: "pip", name: "Pip", char: "boy", i: 18, j: 16, dir: 2, anim: "kick" },
    ],
    enemies: [
      { key: "marsh-jiangshi-1", enemy: "jiangshi", i: 9, j: 4, range: 2 },
      { key: "marsh-jiangshi-2", enemy: "jiangshi", i: 23, j: 11, range: 2 },
      { key: "marsh-serpent-1", enemy: "serpent", i: 12, j: 22, range: 1.5 },
      { key: "marsh-serpent-2", enemy: "serpent", i: 21, j: 21, range: 1.5 },
    ],
    critters: [
      { key: "crane-m1", char: "crane", i: 28, j: 18 },
      { key: "crane-m2", char: "crane", i: 3, j: 18 },
    ],
    interacts: [
      { key: "marsh-exit", kind: "exit", i: 16, j: 0 },
      { key: "marsh-shrine", kind: "shrine", i: 22, j: 14 },
      { key: "marsh-herb", kind: "herb", i: 28, j: 12 },
      { key: "marsh-chest", kind: "chest", i: 3, j: 29 },
      { key: "marsh-stele", kind: "sign", i: 15, j: 3, text: "A post sunk deep in the mud, carved with frogs: “The Mistmarsh. Keep to the boards. The water remembers everyone who fell in, and it is lonely.”" },
    ],
  };
}

// ----------------------------------------------------------------------------- the Cloudmist Tea Terraces
/** Terrace level at a row of the tea hills (1 at the foot by the road in, 6 at the top). */
const terraceLevel = (j: number) => Math.min(5, Math.floor(j / 5)) + 1;

function buildTerraces(): AreaDef {
  const m = new TileMap(32, 32, "meadow", 1);
  m.each((i, j) => m.set(i, j, hash2(i, j, 91) > 0.85 ? "grass" : "meadow", terraceLevel(j)));
  // stone steps straight up the hill, and a path along each terrace
  m.each((i, j) => {
    if (i >= 15 && i <= 17) m.set(i, j, "stairs");
    else if (j % 5 === 0) m.set(i, j, "dirt");
  });
  m.rect(11, 26, 21, 30, "plaza");
  // a spring feeds a little pond on the second terrace
  m.disc(25, 7, 2.2, "water", 1, 0.3, 92);
  const props: PropPlacement[] = [
    P("pavilion", 15, 29),
    P("house", 5, 8),
    P("house", 24, 19),
    P("house", 6, 25),
    P("bell", 20, 29),
    P("censer", 13, 27),
    P("lantern", 14, 25),
    P("lantern", 18, 25),
    P("lantern", 14, 5),
    P("lantern", 18, 5),
    P("shrine", 27, 28),
    P("cherry", 3, 29),
    P("cherry", 28, 23),
    P("cherry", 2, 17),
    P("sacks", 9, 3),
    P("cart", 11, 3),
    P("herb", 29, 2),
    P("chest", 2, 22),
    P("stele", 19, 2),
    P("koi", 25, 7),
    P("butterflies", 11, 14),
    P("butterflies", 22, 10),
  ];
  // rows of tea along each terrace, with gaps to walk through
  m.each((i, j) => {
    if (i >= 14 && i <= 18) return;
    const row = j % 5;
    if ((row !== 2 && row !== 4) || i % 6 === 0 || i === 1 || i === 31 || j > 25) return;
    if (m.kind(i, j) !== "meadow" && m.kind(i, j) !== "grass") return;
    if (props.some((p) => Math.abs(p.i - i) <= 2 && Math.abs(p.j - j) <= 2)) return;
    props.push(P("teabush", i, j));
  });
  return {
    id: "terraces",
    name: "Cloudmist Tea Terraces",
    hanzi: "云雾茶山",
    subtitle: "Where the sect's tea is picked, one bud and two leaves at a time",
    map: m,
    base: -1,
    floating: false,
    sky: "day",
    weather: "petals",
    night: 0,
    arrive: [16.5, 1.5],
    props,
    npcs: [
      { key: "luyu", char: "teamaster", i: 17, j: 27, dir: 2, anim: "pour" },
      { key: "cui", name: "Picker Cui", char: "teapicker", i: 10, j: 11, dir: 4, anim: "gather" },
      { key: "cui2", name: "Picker Hong", char: "teapicker", i: 23, j: 16, dir: 12, anim: "gather" },
      { key: "niu", char: "porter", i: 16, j: 7, dir: 0, anim: "carry", route: [[16.5, 2.5], [16.5, 22.5]] },
      { key: "terrace-kid", name: "Little Bo", char: "boy", i: 12, j: 20, dir: 2, wander: 2 },
    ],
    enemies: [{ key: "terrace-wolf", enemy: "wolf", i: 3, j: 13, range: 1.5 }],
    critters: [
      { key: "crane-t1", char: "crane", i: 27, j: 6 },
      { key: "crane-t2", char: "crane", i: 4, j: 21 },
    ],
    interacts: [
      { key: "terraces-exit", kind: "exit", i: 16, j: 0 },
      { key: "terraces-shrine", kind: "shrine", i: 27, j: 28 },
      { key: "terraces-herb", kind: "herb", i: 29, j: 2 },
      { key: "terraces-chest", kind: "chest", i: 2, j: 22 },
      { key: "terraces-stele", kind: "sign", i: 19, j: 2, text: "Cloudmist Tea Terraces. “Picked at dawn, while the cloud still sits on the leaf. Rolled by hand, dried over pine. Sent up to the sect on the backs of porters, who are not thanked enough.”" },
    ],
  };
}

// ----------------------------------------------------------------------------- the Yellow Sands
function buildDesert(): AreaDef {
  const m = new TileMap(32, 32, "sand", 1);
  m.each((i, j) => m.set(i, j, fbm(i * 0.22, j * 0.22, 101) > 0.64 ? "redrock" : "sand", 1 + Math.round(Math.max(0, fbm(i * 0.1, j * 0.1, 102) - 0.42) * 4)));
  // the oasis: a spring-fed pool ringed with grass
  m.disc(18, 18, 6.2, "grass", 1, 0.8, 103);
  m.disc(19, 19, 3.2, "water", 0, 0.6, 104);
  m.disc(19, 19, 1.4, "deep", 0, 0.2, 105);
  m.path(
    [
      [16, 0],
      [15, 10],
      [14, 16],
    ],
    2,
    "dirt",
    1,
  );
  m.path(
    [
      [22, 12],
      [27, 7],
    ],
    1.6,
    "dirt",
    1,
  );
  m.disc(27, 6, 3.4, "plaza", 1, 0.4, 106);
  m.disc(7, 25, 3.2, "dirt", 1, 0.6, 107);
  const props: PropPlacement[] = [
    P("palm", 15, 20),
    P("palm", 23, 16),
    P("palm", 21, 23),
    P("palm", 14, 15),
    P("palm", 24, 21),
    P("tent", 10, 13),
    P("tent", 9, 18),
    P("tent", 12, 22),
    P("campfire", 12, 17),
    P("cart", 18, 12),
    P("barrels", 16, 12),
    P("stupa", 27, 5),
    P("ruin", 24, 3),
    P("ruin", 30, 4),
    P("ruin", 29, 9),
    P("prayerflags", 25, 8),
    P("banner", 8, 15),
    P("bones", 5, 6),
    P("bones", 27, 27),
    P("deadtree", 4, 10),
    P("butterflies", 17, 22),
    P("herb", 22, 19),
    P("chest", 6, 25),
    P("shrine", 25, 6),
    P("stele", 17, 3),
  ];
  scatter(m, props, ["boulder", "karst", "rock", "bones", "deadtree"], 0.07, 108, (i, j) => (m.kind(i, j) === "sand" || m.kind(i, j) === "redrock") && notNear([[16, 1], [27, 6], [7, 25], [18, 18], [26, 25], [4, 20], [30, 18], [17, 3]], 4.4)(i, j));
  return {
    id: "desert",
    name: "The Yellow Sands",
    hanzi: "黄沙海",
    subtitle: "An oasis, a caravan camp and a stupa older than the sect",
    map: m,
    base: -1,
    floating: false,
    sky: "dusk",
    weather: "none",
    night: 0.1,
    tint: "#ffb060",
    arrive: [16.5, 1.5],
    props,
    npcs: [
      { key: "batu", char: "nomad", i: 13, j: 18, dir: 4, anim: "flute" },
      { key: "saran", name: "Saran", char: "villagerF", i: 11, j: 16, dir: 2, anim: "pour" },
      { key: "temur", name: "Temur", char: "boy", i: 16, j: 16, dir: 6, wander: 2 },
      { key: "caravaneer", name: "Caravaneer Kuo", char: "porter", i: 17, j: 14, dir: 1 },
    ],
    enemies: [
      { key: "sand-bandit-1", enemy: "bandit", i: 26, j: 25, range: 2 },
      { key: "sand-bandit-2", enemy: "bandit", i: 4, j: 20, range: 2 },
      { key: "sand-jiangshi", enemy: "jiangshi", i: 28, j: 7, range: 1.5 },
      { key: "sand-serpent", enemy: "serpent", i: 30, j: 18, range: 2 },
    ],
    critters: [{ key: "horse-sands-0", char: "horse", i: 20, j: 14 }, { key: "horse-sands-1", char: "horse", i: 22, j: 13 }],
    interacts: [
      { key: "desert-exit", kind: "exit", i: 16, j: 0 },
      { key: "desert-shrine", kind: "shrine", i: 25, j: 6 },
      { key: "desert-herb", kind: "herb", i: 22, j: 19 },
      { key: "desert-chest", kind: "chest", i: 6, j: 25 },
      { key: "desert-stele", kind: "sign", i: 17, j: 3, text: "Half buried in the sand, a caravan marker: “Seven days to the western kingdoms. Three to the next well. One to the oasis — if the sands are kind, and they are not.”" },
    ],
  };
}

// ----------------------------------------------------------------------------- Wavecrest Harbour
function buildHarbor(): AreaDef {
  const m = new TileMap(32, 32, "grass", 1);
  // the bay opens east, off the edge of the world
  m.each((i, j) => {
    const shore = 21 + Math.round(Math.sin(j * 0.45) * 1.4);
    if (i > shore + 1) m.set(i, j, i > shore + 4 ? "deep" : "water", 0);
    else if (i > shore - 1) m.set(i, j, "sand", 1);
  });
  // a rocky point to the north-east with the lighthouse on it
  m.disc(27, 3, 3.6, "grass", 1, 0.5, 111);
  m.disc(27, 3, 1.6, "plaza", 1, 0, 1);
  // streets: the west road in, the market square and the quay
  m.path(
    [
      [0, 16],
      [21, 16],
    ],
    2.4,
    "plaza",
    1,
  );
  m.path(
    [
      [11, 4],
      [11, 28],
    ],
    2,
    "plaza",
    1,
  );
  m.rect(13, 8, 19, 12, "plaza", 1);
  m.path(
    [
      [20, 4],
      [20, 28],
    ],
    2,
    "wood",
    1,
  );
  // piers out into the bay
  for (const y of [8, 16, 24]) m.rect(21, y - 1, 28, y, "wood", 1);
  m.path(
    [
      [20, 5],
      [25, 4],
    ],
    1.6,
    "wood",
    1,
  );
  const props: PropPlacement[] = [
    P("house", 3, 4),
    P("house", 7, 4),
    P("house", 3, 9),
    P("house", 14, 4),
    P("house", 3, 19),
    P("house", 7, 19),
    P("house", 14, 19),
    P("house", 3, 24),
    P("house", 14, 25),
    P("teahouse", 7, 24),
    P("lighthouse", 27, 3),
    P("ship", 26, 11),
    P("ship", 25, 20),
    P("boat", 23, 27),
    P("boat", 29, 14),
    P("stall", 14, 9),
    P("stall", 14, 11),
    P("stall", 18, 9),
    P("noodlecart", 18, 12),
    P("fishrack", 17, 14),
    P("fishrack", 18, 22),
    P("barrels", 19, 6),
    P("barrels", 19, 18),
    P("barrels", 22, 25),
    P("well", 9, 13),
    P("lanterns", 16, 15),
    P("redlantern", 10, 8),
    P("redlantern", 10, 22),
    P("redlantern", 19, 14),
    P("redlantern", 19, 26),
    P("shrine", 8, 11),
    P("censer", 6, 13),
    P("drum", 17, 18),
    P("laundry", 5, 15),
    P("herb", 26, 1),
    P("chest", 1, 28),
    P("sign", 2, 14),
    P("cart", 1, 18),
  ];
  scatter(m, props, ["pine", "tallgrass", "rock"], 0.2, 112, (i, j) => m.kind(i, j) === "grass" && (j < 2 || j > 29 || i < 1) && notNear([[1, 28], [0, 16], [26, 1]], 2)(i, j));
  return {
    id: "harbor",
    name: "Wavecrest Harbour",
    hanzi: "浪花港",
    subtitle: "Junks from the eastern isles, fish, gossip and the lighthouse",
    map: m,
    base: -1,
    floating: false,
    sky: "day",
    weather: "none",
    night: 0.05,
    arrive: [1.5, 16.5],
    props,
    npcs: [
      { key: "hai", char: "captain", i: 22, j: 8, dir: 4, anim: "look" },
      { key: "alan", char: "fishwife", i: 16, j: 14, dir: 2, anim: "gather" },
      { key: "dockporter", name: "Dock Porter Gang", char: "porter", i: 20, j: 10, dir: 0, anim: "carry", route: [[20.5, 6.5], [20.5, 26.5]] },
      { key: "harborguard", name: "Harbour Watchman", char: "guard", i: 2, j: 17, dir: 4 },
      { key: "su", char: "lady", i: 12, j: 10, dir: 2, anim: "umbrella" },
      { key: "dockhand", name: "Dockhand Lei", char: "villagerM", i: 22, j: 17, dir: 6, wander: 1.5 },
      { key: "netmender", name: "Net-mender Wu", char: "villagerF", i: 16, j: 22, dir: 2, anim: "gather" },
      { key: "gullboy", name: "Haizi", char: "boy", i: 12, j: 18, dir: 2, wander: 2.5 },
      { key: "noodles", name: "Noodle Seller Hu", char: "cook", i: 17, j: 12, dir: 4 },
      { key: "harbor-elder", name: "Old Salt Fang", char: "storyteller", i: 9, j: 16, dir: 2, anim: "tell" },
    ],
    enemies: [],
    critters: [
      { key: "crane-h1", char: "crane", i: 23, j: 30 },
      { key: "crane-h2", char: "crane", i: 29, j: 6 },
    ],
    interacts: [
      { key: "harbor-exit", kind: "exit", i: 0, j: 16 },
      { key: "harbor-shrine", kind: "shrine", i: 8, j: 11 },
      { key: "harbor-herb", kind: "herb", i: 26, j: 1 },
      { key: "harbor-chest", kind: "chest", i: 1, j: 28 },
      { key: "harbor-sign", kind: "sign", i: 2, j: 14, text: "Wavecrest Harbour. “Ships to the eastern isles when the wind allows. The lighthouse is lit every night by order of the harbourmaster, who is also the lighthouse keeper, who is also Captain Hai's sister.”" },
    ],
  };
}

// ----------------------------------------------------------------------------- Frostveil Monastery
function buildFrost(): AreaDef {
  const m = new TileMap(32, 32, "snow", 2);
  m.each((i, j) => m.set(i, j, undefined, 2 + Math.max(0, Math.min(3, Math.floor((24 - j) / 5)))));
  m.each((i, j) => {
    if (hash2(i, j, 121) > 0.9) m.set(i, j, "marble");
  });
  // the monastery court at the top of the climb
  m.rect(8, 2, 24, 11, "marble", 5);
  m.rect(10, 12, 22, 13, "stairs", 5);
  m.path(
    [
      [16, 31],
      [16, 12],
    ],
    2.4,
    "stairs",
  );
  m.path(
    [
      [16, 24],
      [6, 24],
    ],
    1.6,
    "marble",
  );
  m.disc(25, 22, 2.2, "water", 3, 0.3, 122);
  const props: PropPlacement[] = [
    P("hall", 16, 5),
    P("stupa", 9, 4),
    P("stupa", 23, 4),
    P("bell", 22, 9),
    P("drum", 10, 9),
    P("censer", 16, 10),
    P("prayerflags", 12, 13),
    P("prayerflags", 20, 13),
    P("lantern", 14, 14),
    P("lantern", 18, 14),
    P("lantern", 14, 22),
    P("lantern", 18, 22),
    P("shrine", 5, 24),
    P("stele", 18, 28),
    P("crystal", 28, 14),
    P("crystal", 3, 12),
    P("herb", 28, 26),
    P("chest", 3, 3),
  ];
  scatter(m, props, ["snowpine", "snowpine", "rock", "crystal"], 0.2, 123, (i, j) => (m.kind(i, j) === "snow" || m.kind(i, j) === "marble") && (i < 7 || i > 25 || j > 15) && notNear([[16, 30], [5, 24], [28, 26], [3, 3], [25, 22], [6, 18], [27, 18], [18, 28]], 2.4)(i, j) && Math.abs(i - 16) > 2);
  return {
    id: "frost",
    name: "Frostveil Monastery",
    hanzi: "霜幕寺",
    subtitle: "Monks practise taiji in the snow above the clouds of the east",
    map: m,
    base: -1,
    floating: false,
    sky: "day",
    weather: "snow",
    night: 0.2,
    tint: "#a8c8ff",
    arrive: [16.5, 29.5],
    props,
    npcs: [
      { key: "xuan", char: "abbot", i: 16, j: 9, dir: 0, anim: "taichi" },
      { key: "tuo", char: "novice", i: 13, j: 11, dir: 2, anim: "sweep" },
      { key: "novice-1", name: "Novice Ji", char: "novice", i: 12, j: 7, dir: 0, anim: "taichi" },
      { key: "novice-2", name: "Novice Hui", char: "novice", i: 20, j: 7, dir: 0, anim: "taichi" },
      { key: "novice-3", name: "Novice Pu", char: "novice", i: 19, j: 11, dir: 2, anim: "kick" },
    ],
    enemies: [
      { key: "frost-wolf-1", enemy: "wolf", i: 6, j: 18, range: 2 },
      { key: "frost-wolf-2", enemy: "wolf", i: 27, j: 18, range: 2 },
    ],
    critters: [{ key: "crane-fr", char: "crane", i: 26, j: 24 }],
    interacts: [
      { key: "frost-exit", kind: "exit", i: 16, j: 31 },
      { key: "frost-shrine", kind: "shrine", i: 5, j: 24 },
      { key: "frost-herb", kind: "herb", i: 28, j: 26 },
      { key: "frost-chest", kind: "chest", i: 3, j: 3 },
      { key: "frost-stele", kind: "sign", i: 18, j: 28, text: "Frostveil Monastery. “The cold is a teacher. It asks one question, again and again: how much of you is necessary?”" },
    ],
  };
}

const BUILDERS: Record<AreaId, () => AreaDef> = { sect: buildSect, village: buildVillage, bamboo: buildBamboo, lake: buildLake, valley: buildValley, peak: buildPeak, marsh: buildMarsh, terraces: buildTerraces, desert: buildDesert, harbor: buildHarbor, frost: buildFrost };
const cache = new Map<AreaId, AreaDef>();

/** Build (once) and return an area, with prop footprints marked as blocked. */
export function getArea(id: AreaId): AreaDef {
  let a = cache.get(id);
  if (!a) {
    a = BUILDERS[id]();
    for (const p of a.props) {
      if (!propDef(p.id).blocks) continue;
      const [i0, j0, i1, j1] = placementTiles(p);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) a.map.block(i, j);
    }
    cache.set(id, a);
  }
  return a;
}

export const isGroundKind = (k: TileKind) => k !== "void";
