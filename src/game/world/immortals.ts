import { fbm, hash2 } from "../pixel/noise";
import type { AnimId, HumanId } from "../art/characters";

/**
 * The Three Isles of the Immortals (三仙山) and Guixu (归墟), the Returning
 * Ruin: the lands the world grew into last, east past Fusang and south past
 * the Sea of Pearls.
 *
 * Out past the Valley of Sunrise, where the Synod's charts stop, the old
 * books put three isles where the immortals live: Penglai (蓬莱), Fangzhang
 * (方丈) and Yingzhou (瀛洲). They are real. They used to drift, the old
 * books say, until the Heavenly Emperor set giant turtles under them; they
 * stand still now, joined to each other and to Fusang by causeways of white
 * jade planks the immortals laid for the mortals who would never come.
 *
 * And at the far south-east, where the Encircling Sea runs out, is Guixu:
 * the bottomless abyss every river and every sea drains into, and that never
 * fills. The sea pours over its lip into the clouds below the world. The rim
 * of the world itself is the same: the Encircling Sea does not end at a
 * ruled line, it ends at a ragged shore of foam where the water falls away.
 *
 * This module holds only the shape of the land and where things stand on it
 * (authoring grid), so the runtime and the story can ask without building the
 * world. Who the immortals are and what they say lives in story/immortals.ts.
 */

/** One of the three isles: its lobes ([centre x, centre y, radius x, radius y]) and its heart. */
export interface ImmortalIsle {
  key: "penglai" | "fangzhang" | "yingzhou";
  name: string;
  hanzi: string;
  /** What the isle is, in a few words (shown on its sign and in the map's legend). */
  epithet: string;
  lobes: [number, number, number, number][];
  /** The isle's heart, where its sanctum stands (authoring grid). */
  c: [number, number];
  /** The ground of its sanctum and how high it stands. */
  ground: "marble" | "plaza" | "meadow";
  level: number;
}

export const IMMORTAL_ISLES: ImmortalIsle[] = [
  {
    key: "penglai",
    name: "Penglai",
    hanzi: "蓬莱",
    epithet: "the Isle of the Golden Terraces, where the elixir of the immortals was first brewed",
    lobes: [
      [836, 206, 36, 50],
      [856, 266, 28, 32],
      [818, 244, 20, 26],
      [848, 156, 24, 20],
    ],
    c: [838, 204],
    ground: "marble",
    level: 6,
  },
  {
    key: "fangzhang",
    name: "Fangzhang",
    hanzi: "方丈",
    epithet: "the Square Isle, whose hermits keep the Pool of a Hundred Years",
    lobes: [
      [852, 422, 32, 36],
      [832, 452, 20, 20],
      [870, 396, 16, 18],
    ],
    c: [852, 420],
    ground: "plaza",
    level: 3,
  },
  {
    key: "yingzhou",
    name: "Yingzhou",
    hanzi: "瀛洲",
    epithet: "the Isle of Ocean Mist, where the jade grass that wakes the dead grows",
    lobes: [
      [826, 598, 36, 30],
      [852, 620, 20, 18],
      [804, 576, 18, 18],
    ],
    c: [826, 596],
    ground: "meadow",
    level: 2,
  },
];

export const isleOfKey = (key: ImmortalIsle["key"]) => IMMORTAL_ISLES.find((s) => s.key === key)!;

/** Each isle's lobes grown into one bounding box (for a quick reject). */
const ISLE_BOX = (() => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of IMMORTAL_ISLES)
    for (const [cx, cy, rx, ry] of s.lobes) {
      xs.push(cx - rx - 20, cx + rx + 20);
      ys.push(cy - ry - 20, cy + ry + 20);
    }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
})();

/** Which immortal isle an authoring tile is part of (before the coast is carved), if any. */
export function immortalIsleAt(i: number, j: number): ImmortalIsle | null {
  if (i < ISLE_BOX[0] || i > ISLE_BOX[2] || j < ISLE_BOX[1] || j > ISLE_BOX[3]) return null;
  // the lobes are warped by slow noise, so every shore comes out in coves and capes
  const x = i + (fbm(i * 0.035, j * 0.035, 801) - 0.5) * 26;
  const y = j + (fbm(i * 0.035, j * 0.035, 802) - 0.5) * 26;
  const rag = (fbm(i * 0.09, j * 0.09, 803) - 0.5) * 0.36;
  for (const s of IMMORTAL_ISLES) for (const [cx, cy, rx, ry] of s.lobes) if (Math.hypot((x - cx) / rx, (y - cy) / ry) < 1 + rag) return s;
  return null;
}
export const immortalLand = (i: number, j: number) => immortalIsleAt(i, j) !== null;

/** The isles' peaks: [centre x, centre y, radius, height]. Penglai's golden terraces stand on the tallest. */
export const IMMORTAL_RANGES: { key: string; c: [number, number]; r: number; peak: number; seed: number }[] = [
  { key: "penglaipeak", c: [846, 228], r: 34, peak: 10, seed: 801 },
  { key: "fangzhangrim", c: [854, 424], r: 24, peak: 5, seed: 802 },
  { key: "yingzhoumist", c: [830, 600], r: 22, peak: 4, seed: 803 },
];

/** The sanctum on each isle, and the lesser places (authoring grid). */
export const PEACH_GARDEN: [number, number] = [856, 264];
export const ELIXIR_POOL: [number, number] = [852, 436];
export const JADE_MEADOW: [number, number] = [820, 600];
/** Where the White Jade Causeway comes ashore on Penglai. */
export const JADE_LANDING: [number, number] = [812, 232];

/**
 * The causeways of white jade planks the immortals laid (authoring grid):
 * from Fusang's eastern shore over to Penglai, and on, isle to isle, south
 * to Yingzhou. They are laid once the sea is, plank over water and a beaten
 * path where they cross land.
 */
export const JADE_CAUSEWAYS: [number, number][][] = [
  // from the Fusang tree's eastern shore across to Penglai's landing
  [[760, 150], [772, 176], [786, 204], [800, 224], [JADE_LANDING[0], JADE_LANDING[1]]],
  // Penglai's south cape down to Fangzhang
  [[852, 288], [856, 320], [860, 352], [858, 384], [854, 398]],
  // Fangzhang down to Yingzhou
  [[844, 452], [840, 490], [834, 530], [830, 570]],
  // and the Pilgrims' Pier, out from Yingzhou's southern shore over the open sea to the Last Lamp at the lip of Guixu
  [[832, 622], [826, 650], [818, 680], [812, 708], [808, 734]],
];

/** The isles' own roads (authoring grid): landing to sanctum, sanctum to garden, round each isle's heart. */
export const IMMORTAL_ROADS: [number, number][][] = [
  [[JADE_LANDING[0], JADE_LANDING[1]], [822, 226], [832, 214], [838, 206]],
  [[838, 210], [846, 236], [852, 256], [856, 264]],
  [[856, 268], [854, 280], [852, 288]],
  [[854, 398], [854, 410], [852, 420]],
  [[852, 420], [852, 428], [852, 436]],
  [[852, 436], [848, 446], [844, 452]],
  [[830, 570], [828, 584], [826, 596]],
  [[826, 596], [820, 600]],
];

// ----------------------------------------------------------------------------- Guixu, the Returning Ruin
/** Guixu: the abyss the Encircling Sea drains into, at the far south-east (centre and radius, authoring grid). */
export const GUIXU: { c: [number, number]; r: number } = { c: [790, 786], r: 15 };
/** The Last Lamp, a lighthouse on a rock at the lip of Guixu, where its watcher keeps the only light. */
export const LAST_LAMP: [number, number] = [806, 738];

/** Is an authoring tile inside Guixu's hole (where the sea falls away into the clouds below)? */
export function inGuixu(i: number, j: number): boolean {
  const [cx, cy] = GUIXU.c;
  const d = Math.hypot(i - cx, (j - cy) * 1.12);
  if (d > GUIXU.r + 6) return false;
  // a ragged lip, the water pulled round into it in a spiral
  const a = Math.atan2(j - cy, i - cx);
  return d < GUIXU.r + Math.sin(a * 3 + d * 0.35) * 2.2 + (fbm(i * 0.2, j * 0.2, 811) - 0.5) * 3;
}

/** The Last Lamp's rock: a crag of red rock and a little paving round the lighthouse. */
export function lastLampRock(i: number, j: number): boolean {
  return Math.hypot(i - LAST_LAMP[0], (j - LAST_LAMP[1]) * 1.1) < 6.5 + (fbm(i * 0.3, j * 0.3, 812) - 0.5) * 2.4;
}

// ----------------------------------------------------------------------------- the rim of the world
/**
 * How far an authoring tile lies inside the world's outline: positive inside,
 * negative past it. The outline is no rectangle but a rounded, ragged loop
 * (a superellipse pushed about by slow noise), so the Encircling Sea runs out
 * in bays and tongues of foam where the water falls away into the clouds.
 * Land is never cut by it: the build keeps a margin of sea round every shore
 * (see the rim pass in world/continent.ts).
 */
export function rimDepth(i: number, j: number, w: number, h: number): number {
  const hx = w / 2;
  const hy = h / 2;
  const dx = Math.abs(i + 0.5 - hx) / hx;
  const dy = Math.abs(j + 0.5 - hy) / hy;
  const p = 3;
  const s = Math.pow(Math.pow(dx, p) + Math.pow(dy, p), 1 / p);
  const wob = 0.035 + (fbm(i * 0.011, j * 0.011, 821) - 0.5) * 0.12 + (fbm(i * 0.045, j * 0.045, 822) - 0.5) * 0.04;
  return (1 - wob - s) * Math.min(hx, hy);
}

// ----------------------------------------------------------------------------- who lives there
export interface ImmortalPerson {
  key: string;
  name: string;
  char: HumanId;
  /** Which isle (or the Last Lamp) they keep to, and where (offset from its heart). */
  at: ImmortalIsle["key"] | "lamp";
  d: [number, number];
  anim?: AnimId;
}

/** The immortals of the three isles, their servants, and the watcher at Guixu's lip. */
export const IMMORTAL_FOLK: ImmortalPerson[] = [
  { key: "im-anqi", name: "Master Anqi of Penglai", char: "hermit", at: "penglai", d: [0, 4], anim: "meditate" },
  { key: "im-xu", name: "Xu Fu, who sailed for the elixir", char: "captain", at: "penglai", d: [-8, 9], anim: "seagaze" },
  { key: "im-peach", name: "Peach-Keeper Lan", char: "orchardist", at: "penglai", d: [16, 58], anim: "harvest" },
  { key: "im-crane", name: "Crane Boy", char: "boy", at: "penglai", d: [6, 10], anim: "feed" },
  { key: "im-gatewarden", name: "Jade Gate Warden", char: "imperialguard", at: "penglai", d: [-24, 26], anim: "look" },
  { key: "im-fang", name: "Old Fang of the Square Isle", char: "yearelder", at: "fangzhang", d: [0, 4], anim: "comprehend" },
  { key: "im-pool", name: "Keeper of the Pool of a Hundred Years", char: "monk", at: "fangzhang", d: [-2, 14], anim: "chant" },
  { key: "im-chess", name: "Two Hermits at Their Game", char: "hermit", at: "fangzhang", d: [6, -2], anim: "xiangqi" },
  { key: "im-ying", name: "Lady Ying of the Ocean Mist", char: "moonlady", at: "yingzhou", d: [0, 3], anim: "flute" },
  { key: "im-grass", name: "Jade-Grass Gatherer Wu", char: "herbalist", at: "yingzhou", d: [-6, 6], anim: "pluck" },
  { key: "im-turtle", name: "Turtle-Watcher Gu", char: "fishwife", at: "yingzhou", d: [10, 10], anim: "seagaze" },
  { key: "im-lamp", name: "Watcher of the Last Lamp", char: "lampkeeper", at: "lamp", d: [2, 2], anim: "lantern" },
];

/** Where an immortal person's place is (authoring grid). */
export function immortalHome(p: ImmortalPerson): [number, number] {
  const c = p.at === "lamp" ? LAST_LAMP : isleOfKey(p.at).c;
  return [c[0] + p.d[0], c[1] + p.d[1]];
}

/** The isles' own wandering mortals: servants, pilgrims who made it, and those who came for the elixir and stayed. */
/** (Even here the jianghu keeps its ten mortals to every cultivator: the immortals' servants and the pilgrims are all mortal.) */
export const IMMORTAL_TOWNSFOLK = 120;
const ISLE_TRADES: { name: string; looks: HumanId[]; anim: AnimId }[] = [
  { name: "Elixir-Servant", looks: ["villagerF", "teawoman", "cook"], anim: "stir" },
  { name: "Pilgrim Who Made It", looks: ["villagerF", "villagerM", "porter"], anim: "pray" },
  { name: "Crane-Feeder", looks: ["child", "boy"], anim: "feed" },
  { name: "Peach-Picker", looks: ["orchardist", "farmer"], anim: "harvest" },
  { name: "Seeker of the Elixir", looks: ["scholar", "merchant"], anim: "think" },
  { name: "Mist-Fisher", looks: ["fishwife", "boatwoman"], anim: "fish" },
];
/** Townsperson n of the isles. */
export function immortalTown(n: number): { key: string; name: string; char: HumanId; anim: AnimId; isle: ImmortalIsle["key"] } {
  const isle = IMMORTAL_ISLES[n % 3].key;
  const t = ISLE_TRADES[Math.floor(hash2(n, 1, 831) * ISLE_TRADES.length)];
  const char = t.looks[Math.floor(hash2(n, 2, 832) * t.looks.length)];
  return { key: `im-town-${n}`, name: `${t.name} of ${isleOfKey(isle).name}`, char, anim: t.anim, isle };
}

/** The isles' named places, as landmarks on the map: [key, name, hanzi, icon, where]. */
export const IMMORTAL_MARKS: [string, string, string, "pagoda" | "peachtree" | "fountain" | "spirittree" | "lighthouse" | "lantern" | "hall", [number, number]][] = [
  ["im-penglai", "The Golden Terraces of Penglai", "蓬莱金阙", "hall", [838, 198]],
  ["im-peaches", "The Garden of Peaches", "蟠桃园", "peachtree", PEACH_GARDEN],
  ["im-landing", "The White Jade Causeway", "白玉长堤", "lantern", JADE_LANDING],
  ["im-fangzhang", "The Square Isle of Fangzhang", "方丈", "pagoda", [852, 416]],
  ["im-pool", "The Pool of a Hundred Years", "百年池", "fountain", ELIXIR_POOL],
  ["im-yingzhou", "Yingzhou of the Ocean Mist", "瀛洲", "spirittree", [826, 592]],
  ["im-lamp", "The Last Lamp, at the Lip of Guixu", "归墟孤灯", "lighthouse", LAST_LAMP],
];
