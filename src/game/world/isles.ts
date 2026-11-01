import { fbm } from "../pixel/noise";
import type { AnimId, HumanId } from "../art/characters";
import type { PropId } from "../art/props";
import type { TileKind } from "./tilemap";

/**
 * The Sea of Pearls (珠海) and the Nine Springs (九泉) beneath it.
 *
 * When the world last grew south, the cloud below the Tidewater Reach and
 * east of the Stairlands turned to real sea: a warm green water strung with
 * isles, each a shape of its own (a long turtle's back, a crescent, a ring of
 * coral round a lagoon), joined by plank bridges from Hailing's quay and from
 * the Stairlands' eastern shore. Under the black rock of Ghost Gate Isle a
 * stair goes down to the Nine Springs, the underworld, and under the Dragon
 * King's isle lies his drowned palace.
 *
 * Kept free of the story's words, so the world builder can lay the sea and
 * stand its people without pulling in the tale (story/seas.ts).
 */

export type IsleShape = "blob" | "long" | "crescent" | "atoll";

export interface Isle {
  key: string;
  name: string;
  hanzi: string;
  /** Centre on the authoring grid. */
  c: [number, number];
  rx: number;
  ry: number;
  /** Turn of the long axis (radians). */
  rot: number;
  shape: IsleShape;
  /** The wild biome that grows on it (a WildId of world/continent.ts). */
  biome: "coast" | "tidelands" | "plum" | "wastes" | "stairlands" | "sands";
  /** Its ground's height, and how high its hills rise. */
  h: number;
  hills: number;
  /** Shown on the world map (islets are not). */
  landmark?: PropId;
  /** Where its people gather, if not at its centre (the crescent's centre is sea). */
  hub?: [number, number];
  /** Levelled ground at its heart: radius and kind. */
  plaza?: [number, TileKind];
}

export const ISLES: Isle[] = [
  { key: "pearlgate", name: "Pearlgate Isle", hanzi: "珠门岛", c: [538, 600], rx: 30, ry: 22, rot: 0.3, shape: "blob", biome: "coast", h: 1, hills: 1.5, landmark: "tulou", plaza: [7, "plaza"] },
  { key: "turtleback", name: "Turtleback Isle", hanzi: "龟背岛", c: [458, 636], rx: 33, ry: 14, rot: -0.4, shape: "long", biome: "tidelands", h: 1, hills: 2, landmark: "domehut", plaza: [4, "sand"] },
  { key: "lanternreef", name: "Lantern Reef", hanzi: "灯礁", c: [602, 636], rx: 12, ry: 10, rot: 0, shape: "blob", biome: "coast", h: 1, hills: 1, landmark: "lighthouse", plaza: [3, "plaza"] },
  { key: "crescent", name: "Crescent Isle", hanzi: "月牙岛", c: [522, 684], hub: [538, 684], rx: 26, ry: 26, rot: 0, shape: "crescent", biome: "plum", h: 1, hills: 1.5, landmark: "crescenthall", plaza: [4, "plaza"] },
  { key: "dragonking", name: "The Dragon King's Isle", hanzi: "龙王岛", c: [604, 726], rx: 26, ry: 20, rot: 0.6, shape: "blob", biome: "coast", h: 1, hills: 2, landmark: "dragonhall", plaza: [5, "marble"] },
  { key: "ghostgate", name: "Ghost Gate Isle", hanzi: "鬼门岛", c: [404, 714], rx: 26, ry: 22, rot: -0.2, shape: "blob", biome: "wastes", h: 1, hills: 2, landmark: "cavemouth", plaza: [4, "ash"] },
  { key: "atoll", name: "The Coral Ring", hanzi: "珊瑚环", c: [506, 762], hub: [506, 745], rx: 25, ry: 20, rot: 0.2, shape: "atoll", biome: "sands", h: 1, hills: 0.6, landmark: "palm" },
  { key: "penglai", name: "Penglai, the Isle of Immortals", hanzi: "蓬莱", c: [352, 652], rx: 23, ry: 20, rot: 0.5, shape: "blob", biome: "stairlands", h: 2, hills: 3.5, landmark: "octotower", plaza: [4, "marble"] },
  // islets nobody lives on: rocks, gulls, the odd pine
  { key: "islet1", name: "", hanzi: "", c: [578, 572], rx: 6, ry: 5, rot: 0.4, shape: "blob", biome: "coast", h: 1, hills: 1 },
  { key: "islet2", name: "", hanzi: "", c: [636, 688], rx: 6, ry: 7, rot: 0, shape: "blob", biome: "coast", h: 1, hills: 1.4 },
  { key: "islet3", name: "", hanzi: "", c: [448, 774], rx: 7, ry: 5, rot: -0.3, shape: "long", biome: "sands", h: 1, hills: 0.6 },
  { key: "islet4", name: "", hanzi: "", c: [360, 762], rx: 6, ry: 6, rot: 0, shape: "blob", biome: "wastes", h: 1, hills: 1.6 },
  { key: "islet5", name: "", hanzi: "", c: [606, 768], rx: 5, ry: 5, rot: 0, shape: "blob", biome: "coast", h: 1, hills: 1 },
  { key: "islet6", name: "", hanzi: "", c: [474, 590], rx: 5, ry: 6, rot: 0.2, shape: "blob", biome: "coast", h: 1, hills: 1 },
];

export const isleByKey = (key: string) => ISLES.find((s) => s.key === key)!;

/** How far inside an isle a tile is (below 1 is land), measured on its own turned, noisy outline. */
export function isleDepth(s: Isle, i: number, j: number): number {
  const dx = i + 0.5 - s.c[0];
  const dy = j + 0.5 - s.c[1];
  const [c, n] = [Math.cos(s.rot), Math.sin(s.rot)];
  const u = (dx * c + dy * n) / s.rx;
  const v = (-dx * n + dy * c) / s.ry;
  const wobble = (fbm(i * 0.14, j * 0.14, 400 + s.c[0]) - 0.5) * 0.55 + (fbm(i * 0.05, j * 0.05, 401) - 0.5) * 0.3;
  const d = Math.hypot(u, v) - wobble;
  if (s.shape === "crescent") {
    // a second, smaller disc bites the west side away, leaving a horned new moon open to the west
    const bite = Math.hypot(u + 0.62, v + 0.12) / 0.78 - wobble * 0.5;
    return bite < 1 ? 1 + (1 - bite) : d;
  }
  if (s.shape === "atoll") {
    // a ring of coral and sand round a still lagoon
    return d < 0.62 ? 1 + (0.62 - d) : d;
  }
  return d;
}

export const onIsle = (s: Isle, i: number, j: number) => isleDepth(s, i, j) < 1;

/** The lagoon inside the Coral Ring (and inside the crescent's horns there is only sea). */
export const inLagoon = (s: Isle, i: number, j: number) => s.shape === "atoll" && Math.hypot(i + 0.5 - s.c[0], j + 0.5 - s.c[1]) < Math.min(s.rx, s.ry) * 0.5;

/** The sea itself: what was cloud below the Tidewater Reach and east of the Stairlands, within a wandering shore. */
export function inSea(i: number, j: number): boolean {
  // (it keeps out of the strait of cloud the Nine-Arch Bridge crosses, north of the Stairlands)
  if (j < 520 || (i < 284 && j < 600)) return false;
  const x = (i - 478) / 210;
  const y = (j - 664) / 140;
  const edge = 1 + (fbm(i * 0.03, j * 0.03, 410) - 0.5) * 0.36;
  return Math.hypot(x, y * (y > 0 ? 0.92 : 1)) < edge;
}

/** The plank bridges between the isles, and out to them from Hailing's quay and the Stairlands (authoring grid). */
export const SEA_BRIDGES: [number, number][][] = [
  // Hailing's south quay to Pearlgate
  [[547, 529], [546, 548], [542, 572], [538, 600]],
  // Pearlgate to Turtleback, to the Lantern Reef and south to Crescent Isle
  [[538, 600], [500, 614], [458, 636]],
  [[538, 600], [574, 616], [602, 636]],
  [[538, 600], [538, 644], [538, 684]],
  // Crescent Isle to the Dragon King's isle and to the Coral Ring
  [[538, 684], [566, 708], [604, 726]],
  [[538, 684], [530, 704], [512, 728], [506, 744]],
  // Turtleback to Ghost Gate, and west to Penglai
  [[458, 636], [432, 668], [410, 704]],
  [[458, 636], [404, 642], [352, 652]],
  // Penglai to the Stairlands' eastern shore and the foot of the City of Nine Tiers
  [[352, 652], [318, 652], [296, 650], [278, 646]],
];

// ----------------------------------------------------------------------------- the people of the six books
export const SEA_BOOK_COUNT = 6;

/** The rank and file each book's trouble sends against her, and who waits at the end of each book. */
export const SEA_FOES = ["blacksail", "tideserpent", "drownedguard", "hungryghost", "lostsoul", "ledgerwraith"] as const;
export type SeaFoeId = (typeof SEA_FOES)[number];
export const SEA_BOSSES = ["heifan", "haiyao", "aoshun", "niutou", "yinbroker", "moxie"] as const;
export type SeaBossId = (typeof SEA_BOSSES)[number];

export interface SeaPerson {
  name: string;
  char: HumanId;
  anim?: AnimId;
}

export interface SeaBookCast {
  /** Where the book's people live: an isle of the sea, or the Nine Springs below. */
  where: string;
  hanzi: string;
  /** Who sends her about the book's business, and who shows her round. */
  patron: SeaPerson;
  guide: SeaPerson;
  folk: SeaPerson[];
  foe: SeaFoeId;
  boss: SeaBossId;
  /** The isle the book's people stand on (the first four), or "deep" (the Nine Springs). */
  isle: string;
  /** Its place to be seen. */
  sight: { key: string; name: string; hanzi: string };
}

export const SEA_CAST: SeaBookCast[] = [
  {
    where: "Pearlgate Isle",
    hanzi: "珠门岛",
    isle: "pearlgate",
    patron: { name: "Pearl-Mother Bei", char: "fishwife", anim: "idle" },
    guide: { name: "Diver Ah Lan", char: "pearldiver" },
    folk: [
      { name: "Ferryman Lao Gu", char: "ferryman", anim: "yawn" },
      { name: "Net-Mender Qiao", char: "villagerF", anim: "weave" },
      { name: "Steward Huang of the Round House", char: "merchant", anim: "abacus" },
      { name: "Lamp-Keeper Deng", char: "lampkeeper", anim: "lantern" },
    ],
    foe: "blacksail",
    boss: "heifan",
    sight: { key: "sea-lanternreef", name: "the lighthouse on Lantern Reef", hanzi: "灯礁" },
  },
  {
    where: "Crescent Isle",
    hanzi: "月牙岛",
    isle: "crescent",
    patron: { name: "Abbess Jing Hai", char: "seaabbess", anim: "pray" },
    guide: { name: "Novice Bei Ke", char: "novice" },
    folk: [
      { name: "Diver Mei", char: "pearldiver", anim: "castnet" },
      { name: "Old Turtle-Watcher Wu", char: "wen", anim: "fish" },
      { name: "Weaver Lu of the Crescent Hall", char: "weaver", anim: "weave" },
      { name: "Little Hai", char: "boy" },
    ],
    foe: "tideserpent",
    boss: "haiyao",
    sight: { key: "sea-turtleback", name: "the long back of Turtleback Isle", hanzi: "龟背岛" },
  },
  {
    where: "the Dragon King's Isle",
    hanzi: "龙王岛",
    isle: "dragonking",
    patron: { name: "Minister Gui of the Drowned Court", char: "almanac", anim: "read" },
    guide: { name: "Pearl-Maid Ao Lan", char: "merguide" },
    folk: [
      { name: "Shrimp-Captain Xia", char: "soldier", anim: "salute" },
      { name: "Temple-Keeper Long Mu", char: "keeper", anim: "sweep" },
      { name: "Rain-Priestess Yu", char: "merfolkF", anim: "pray" },
      { name: "Clam-Seller Bang", char: "peddler" },
    ],
    foe: "drownedguard",
    boss: "aoshun",
    sight: { key: "sea-atoll", name: "the lagoon of the Coral Ring", hanzi: "珊瑚环" },
  },
  {
    where: "Ghost Gate Isle",
    hanzi: "鬼门岛",
    isle: "ghostgate",
    patron: { name: "Exorcist Zhong Kui-Er", char: "shaman", anim: "chant" },
    guide: { name: "Little Lantern", char: "ghost" },
    folk: [
      { name: "Grave-Sweeper Old Song", char: "villagerM", anim: "sweep" },
      { name: "Spirit-Money Seller Fu", char: "peddler" },
      { name: "The Widow at the Gate", char: "widow", anim: "grieve" },
      { name: "Soul Guard Ma Mian", char: "soulguard", anim: "spear" },
    ],
    foe: "hungryghost",
    boss: "niutou",
    sight: { key: "sea-penglai", name: "Penglai, the Isle of Immortals", hanzi: "蓬莱" },
  },
  {
    where: "the Nine Springs, below Ghost Gate Isle",
    hanzi: "九泉",
    isle: "deep",
    patron: { name: "Meng Po", char: "mengpo", anim: "stir" },
    guide: { name: "Ghost Clerk Bai", char: "ghostclerk" },
    folk: [
      { name: "The Lantern-Seller of the Ghost Market", char: "lampkeeper", anim: "lantern" },
      { name: "A Soldier Who Lost His Way", char: "soldier", anim: "look" },
      { name: "The Bride in Red", char: "lady", anim: "cry" },
      { name: "The Ferryman of the Forgetting River", char: "ferryman", anim: "row" },
    ],
    foe: "lostsoul",
    boss: "yinbroker",
    sight: { key: "sea-ghostgate", name: "the Ghost Gate itself", hanzi: "鬼门关" },
  },
  {
    where: "the Ten Courts of the Nine Springs",
    hanzi: "十殿",
    isle: "deep",
    patron: { name: "King Yama", char: "yama", anim: "write" },
    guide: { name: "Judge Cui", char: "scholar", anim: "read" },
    folk: [
      { name: "Soul Guard Niu", char: "soulguard", anim: "march" },
      { name: "The Keeper of the Ledger", char: "archivist", anim: "write" },
      { name: "The Mirror-Polisher", char: "novice", anim: "scrub" },
      { name: "A Clerk of the Tenth Court", char: "ghostclerk", anim: "abacus" },
    ],
    foe: "ledgerwraith",
    boss: "moxie",
    sight: { key: "sea-dragonking", name: "the Dragon King's temple", hanzi: "龙王庙" },
  },
];

export const seaPatronKey = (b: number) => `sp-${b}-patron`;
export const seaGuideKey = (b: number) => `sp-${b}-guide`;
export const seaFolkKey = (b: number, n: number) => `sp-${b}-folk-${n}`;

/** Where each of a book's people stands round its isle's heart (authoring tiles), and its foes in the wilds about it. */
export const SEA_SPOTS = {
  patron: [-2, 2] as [number, number],
  guide: [2, 3] as [number, number],
  folk: [
    [-6, -3],
    [6, -2],
    [-4, 6],
    [7, 5],
  ] as [number, number][],
  boss: [0, -6] as [number, number],
  foes: [
    [-12, -6],
    [12, 8],
    [-10, 9],
  ] as [number, number][],
  shrine: [-3, -4] as [number, number],
  sign: [4, -4] as [number, number],
  chest: [8, 1] as [number, number],
};
