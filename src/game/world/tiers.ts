import type { AnimId, HumanId } from "../art/characters";
import type { PropId } from "../art/props";
import { WORLD_SCALE } from "./layout";

/**
 * Where the City of Nine Tiers (天阶城, Tianjie) stands: across the strait of
 * cloud south of Jinhe, at the end of the Nine-Arch Bridge, a whole mountain
 * cut into nine terraces round a summit, each one higher than the last.
 *
 * The city's law is the Stair Code (阶律): a person lives, trades and is
 * heard on the tier their realm allows, and no higher. Mortals live on the
 * Mud Tier at the foot; Qi Condensation earns the Copper Tier, and so on up
 * to the Thunder Tier, where only those at Spirit Severing may stand, and
 * the summit, Heaven's Step, where the Sovereign of the Stair sits. Each
 * tier's stair has a gate, and each gate a warden and a seal of gold light
 * that will not let anyone below its realm pass, on foot or on a sword.
 *
 * Kept free of the story's words so the world builder can stand the city
 * and its people without pulling in the tale (story/tiers.ts).
 */

/** The city's heart (the summit), on the authoring grid. */
export const TIANJIE_C: [number, number] = [222, 610];

/** Each tier as a rectangle round the summit: half-width and half-height on the authoring grid (0 = the Mud Tier, 9 = Heaven's Step). */
const HALF: [number, number][] = [
  [56, 38],
  [51, 34],
  [45, 30],
  [40, 27],
  [34, 23],
  [29, 19],
  [24, 15],
  [18, 11],
  [13, 8],
  [7, 4],
];
export const TIER_COUNT = HALF.length;

/** A tier's rectangle on the authoring grid, [x0, y0, x1, y1) (inclusive-exclusive). */
export function tierRect(k: number): [number, number, number, number] {
  const [hx, hy] = HALF[k];
  const [cx, cy] = TIANJIE_C;
  return [cx - hx, cy - hy, cx + hx, cy + hy];
}

/** Which tier an authoring tile stands on (-1 outside the city). */
export function tierAt(i: number, j: number): number {
  let t = -1;
  for (let k = 0; k < TIER_COUNT; k++) {
    const [x0, y0, x1, y1] = tierRect(k);
    if (i >= x0 && i < x1 && j >= y0 && j < y1) t = k;
    else break;
  }
  return t;
}

/** The ground height of each tier: two levels a tier, so every terrace wall is a cliff and only the stairs climb them. */
export const tierHeight = (k: number) => 1 + 2 * k;

/** The great avenue climbs straight up the north face, these columns wide. */
export const AVENUE: [number, number] = [221, 223];

/** The row of a tier's stair (the last row of the tier below it, on the avenue). */
export const stairRow = (k: number) => tierRect(k)[1] - 1;

/** The overall level (realm and stage) each tier's gate asks of anyone who would climb to it: the Mud Tier asks nothing. */
export const TIER_LEVEL = [0, 4, 6, 8, 10, 12, 14, 16, 17, 18];

export interface TierSite {
  name: string;
  hanzi: string;
  /** Who lives here, in a few words. */
  caste: string;
  /** The buildings that line its sides. */
  buildings: PropId[];
}

export const TIER_SITES: TierSite[] = [
  { name: "The Mud Tier", hanzi: "泥阶", caste: "mortals: porters, washerwomen, the weighed", buildings: ["house", "stilthouse", "house"] },
  { name: "The Copper Tier", hanzi: "铜阶", caste: "Qi Condensation smiths and hired swords, bonded for their pills", buildings: ["forge", "house", "townhouse"] },
  { name: "The Silver Tier", hanzi: "银阶", caste: "Foundation merchants, brokers and the tablet auction", buildings: ["townhouse", "towerinn", "townhouse"] },
  { name: "The Jade Tier", hanzi: "玉阶", caste: "academies, matchmakers and the clans that marry by realm", buildings: ["townhouse", "pavilion", "townhouse"] },
  { name: "The Golden Tier", hanzi: "金阶", caste: "Core Formation clans and their champions", buildings: ["towerinn", "townhouse", "drumtower"] },
  { name: "The Violet Tier", hanzi: "紫阶", caste: "the Tribunal of Realms and its advocates", buildings: ["hall", "townhouse", "townhouse"] },
  { name: "The Cloud Tier", hanzi: "云阶", caste: "Nascent Soul elders in their gardens", buildings: ["pavilion", "townhouse", "pagoda"] },
  { name: "The Star Tier", hanzi: "星阶", caste: "the Star Registry, which decides where every child belongs", buildings: ["pagoda", "drumtower", "townhouse"] },
  { name: "The Thunder Tier", hanzi: "雷阶", caste: "the Severed Guard, who cut away everyone they loved to stand here", buildings: ["drumtower", "townhouse", "drumtower"] },
  { name: "Heaven's Step", hanzi: "天阶", caste: "the Sovereign of the Stair", buildings: [] },
];

/** The people of the City of Nine Tiers, by key: the story speaks for them, the world builder stands them where they belong. */
export const TIER_CAST: Record<string, { name: string; char: HumanId }> = {
  "tj-herald": { name: "Herald of the Stair", char: "tierherald" },
  "tj-ahlou": { name: "Ah Lou", char: "ahlou" },
  "tj-wenqi": { name: "Registrar Wen Qi", char: "wenqi" },
  "tj-weigher": { name: "Weigher Bai Gu", char: "weigher" },
  "tj-mudgran": { name: "Granny Pot", char: "villagerF" },
  "tj-bellows": { name: "Bellows Hua", char: "smith" },
  "tj-forger": { name: "Faceless Liu", char: "forger" },
  "tj-suwan": { name: "Su Wan", char: "suwan" },
  "tj-jinwei": { name: "Lord Jin Wei", char: "nobleM" },
  "tj-peilan": { name: "Advocate Pei Lan", char: "scholar" },
  "tj-mist": { name: "Mist-Keeper Yun Shu", char: "abbot" },
  "tj-xinger": { name: "Apprentice Xing'er", char: "starregistrar" },
  "tj-shi": { name: "Severed Guard Shi Wu", char: "severed" },
  "tj-gao": { name: "Gao Qiong, Sovereign of the Stair", char: "sovereign" },
};

/** The patron of each book: the one on that tier who sends her about its business between the beats. */
export const TIER_PATRON = ["tj-mudgran", "tj-bellows", "tj-forger", "tj-suwan", "tj-jinwei", "tj-peilan", "tj-mist", "tj-xinger", "tj-shi", "tj-wenqi"];

/** The warden of a tier's gate (1-9), who stands at the foot of its stair. */
export const wardenKey = (k: number) => `tj-warden-${k}`;
export const WARDEN_NAMES = ["", "Warden of the Copper Stair", "Warden of the Silver Stair", "Warden of the Jade Stair", "Warden of the Golden Stair", "Warden of the Violet Stair", "Warden of the Cloud Stair", "Warden of the Star Stair", "Warden of the Thunder Stair", "Warden of Heaven's Step"];

/** Ah Lou and Wen Qi climb with her: one of each stands on every tier, there only while that book is hers. */
export const FOLLOWERS = ["tj-ahlou", "tj-wenqi"] as const;
export const followerKey = (key: string, book: number) => `${key}-${book}`;

/** The trouble at the top of each tier's tale: who she faces. */
export const TIER_BOSSES = ["tjkuang", "tjtong", "tjsima", "tjqiao", "tjleiba", "tjyan", "tjmei", "tjqu", "tjloufeng", "tjgao"] as const;
export type TierBossId = (typeof TIER_BOSSES)[number];

/** The Mud Tier's Weighing Hall (称骨堂), its great steelyard, and the Stair Ring in the flats below the city where any cultivator may be challenged. */
export const WEIGH_HALL_AT: [number, number] = [160, 590];
export const SCALE_AT: [number, number] = [164, 585];
export const STAIR_RING: { c: [number, number]; r: number } = { c: [160, 626], r: 3.4 };
/** The flats round the city's foot (authoring grid, [x0, y0, x1, y1)): the Mud Tier spills out over them. */
export const FLATS: [number, number, number, number] = [154, 566, 290, 654];

/** Where a tier's people stand: the north band of each tier, either side of the avenue (authoring grid). */
export function northBand(k: number): { y0: number; y1: number } {
  const [, y0] = tierRect(k);
  const y1 = k + 1 < TIER_COUNT ? tierRect(k + 1)[1] : tierRect(k)[3];
  return { y0, y1 };
}

/** Where a tier's people and its warden stand, and where the trouble waits (authoring grid). */
export function tierSpots(k: number): { patron: [number, number]; follower: [number, number]; wenqi: [number, number]; warden: [number, number]; boss: [number, number]; folk: [number, number][] } {
  const { y0, y1 } = northBand(k);
  const mid = Math.floor((y0 + y1 - 1) / 2);
  const [x0, , x1] = tierRect(k);
  const inner = k + 1 < TIER_COUNT ? tierRect(k + 1) : null;
  // the side bands, where the folk mill about between the houses and the inner wall
  const westX = inner ? inner[0] - 1 : x0 + 2;
  const eastX = inner ? inner[2] : x1 - 3;
  const sideY = inner ? inner[1] + 3 : mid;
  // the warden of gate k stands at the foot of its stair, on the tier below
  const below = k > 0 ? northBand(k - 1) : { y0: y0 - 3, y1: y0 };
  const summit = k === TIER_COUNT - 1;
  return {
    patron: [AVENUE[0] - 5, mid],
    follower: summit ? [AVENUE[0] - 2, y0 + 1] : [AVENUE[1] + 3, mid],
    wenqi: summit ? [AVENUE[1] + 2, y0 + 1] : [AVENUE[1] + 6, mid],
    warden: [AVENUE[1] + 2, below.y1 - 2],
    boss: k === TIER_COUNT - 1 ? [TIANJIE_C[0], TIANJIE_C[1] - 3] : [AVENUE[0] - 9, mid],
    folk: [
      [AVENUE[0] - 12, mid],
      [AVENUE[1] + 11, mid],
      [westX, sideY],
      [eastX, sideY],
      [westX, sideY + 6],
      [eastX, sideY + 6],
    ],
  };
}

/** The folk of each tier (looks and doings), who stand at that tier's spots. */
export const TIER_FOLK: { char: HumanId; anim: AnimId; name: string }[][] = [
  [
    { char: "porter", anim: "carry", name: "A Mud-Tier Porter" },
    { char: "refugeeF", anim: "beg", name: "A Woman Weighed Light" },
    { char: "villagerF", anim: "gather", name: "A Washerwoman" },
    { char: "bearer", anim: "bear", name: "A Sedan Bearer" },
    { char: "refugeeM", anim: "kneel", name: "A Kneeling Porter" },
    { char: "boy", anim: "slingshot", name: "A Mud-Tier Boy" },
  ],
  [
    { char: "smith", anim: "hammer", name: "A Bonded Smith" },
    { char: "miner", anim: "carry", name: "An Ore-Carrier" },
    { char: "discipleM", anim: "practice", name: "A Hired Sword" },
    { char: "debtsmith", anim: "abacus", name: "A Debt-Clerk of the Guild" },
    { char: "villagerM", anim: "haggle", name: "A Copper-Tier Fence" },
    { char: "discipleF", anim: "whisper", name: "A Copper-Tier Disciple" },
  ],
  [
    { char: "merchant", anim: "abacus", name: "A Silver-Tier Broker" },
    { char: "peddler", anim: "haggle", name: "A Tablet Tout" },
    { char: "lady", anim: "fan", name: "A Merchant's Wife" },
    { char: "merchant", anim: "weigh", name: "A Silver Weigher" },
    { char: "inquisitor", anim: "stamp", name: "A Tablet Examiner" },
    { char: "cook", anim: "hawk", name: "A Dumpling Seller" },
  ],
  [
    { char: "scholar", anim: "read", name: "A Jade Academy Student" },
    { char: "nobleF", anim: "lean", name: "A Jade-Tier Daughter" },
    { char: "matchmaker", anim: "whisper", name: "A Go-Between" },
    { char: "nobleM", anim: "fan", name: "A Jade-Tier Son" },
    { char: "lady", anim: "flute", name: "A Zither Teacher" },
    { char: "scholar", anim: "write", name: "A Copyist" },
  ],
  [
    { char: "champion", anim: "practice", name: "A Clan Champion" },
    { char: "nobleM", anim: "toast", name: "A Golden-Tier Heir" },
    { char: "nobleF", anim: "umbrella", name: "A Golden-Tier Lady" },
    { char: "soldier", anim: "spear", name: "A Clan Guard" },
    { char: "bearer", anim: "bear", name: "A Clan Bearer" },
    { char: "nobleM", anim: "xiangqi", name: "A Clan Elder at Xiangqi" },
  ],
  [
    { char: "justiciar", anim: "read", name: "A Junior Justiciar" },
    { char: "scholar", anim: "stamp", name: "A Tribunal Clerk" },
    { char: "nobleF", anim: "whisper", name: "A Plaintiff" },
    { char: "guard", anim: "salute", name: "A Tribunal Guard" },
    { char: "wenqi", anim: "write", name: "A Registrar" },
    { char: "nobleM", anim: "think", name: "A Defendant" },
  ],
  [
    { char: "yearelder", anim: "meditate", name: "A Cloud-Tier Elder" },
    { char: "novice", anim: "sweep", name: "A Garden Novice" },
    { char: "abbot", anim: "taichi", name: "A Cloud-Tier Master" },
    { char: "nobleF", anim: "flute", name: "An Elder's Companion" },
    { char: "yearelder", anim: "levitate", name: "A Floating Elder" },
    { char: "novice", anim: "chant", name: "A Novice at Prayer" },
  ],
  [
    { char: "starregistrar", anim: "stargaze", name: "A Star-Reader" },
    { char: "scholar", anim: "write", name: "A Registry Clerk" },
    { char: "starregistrar", anim: "read", name: "A Keeper of Birth-Charts" },
    { char: "almanac", anim: "look", name: "An Astronomer" },
    { char: "scholar", anim: "stargaze", name: "A Night Watcher" },
    { char: "starregistrar", anim: "write", name: "A Star-Copyist" },
  ],
  [
    { char: "severed", anim: "practice", name: "A Severed Guard" },
    { char: "severed", anim: "sworddance", name: "A Severed Swordsman" },
    { char: "severed", anim: "march", name: "A Severed Sentry" },
    { char: "loufeng", anim: "salute", name: "A Severed Officer" },
    { char: "severed", anim: "salute", name: "A Severed Gatekeeper" },
    { char: "severed", anim: "practice", name: "A Severed Recruit" },
  ],
  [
    { char: "tierherald", anim: "decree", name: "A Herald of the Summit" },
    { char: "bearer", anim: "kneel", name: "A Summit Bearer" },
    { char: "severed", anim: "salute", name: "A Guard of the Step" },
    { char: "nobleF", anim: "bow", name: "A Lady of the Court" },
    { char: "nobleM", anim: "bow", name: "A Lord of the Court" },
    { char: "tierherald", anim: "bow", name: "A Steward of the Step" },
  ],
];

/** The Stair Ring's challengers, who take on anyone of any realm (a bout lost there costs nothing). */
export const CHALLENGERS = ["tj-ring-0", "tj-ring-1", "tj-ring-2"] as const;

/** A tier's rectangle in world tiles, for the seals that bar its stair: [x0, y0, x1, y1). */
export function tierWorldRect(k: number): [number, number, number, number] {
  const [x0, y0, x1, y1] = tierRect(k);
  return [x0 * WORLD_SCALE, y0 * WORLD_SCALE, x1 * WORLD_SCALE, y1 * WORLD_SCALE];
}

/** Whether a tier's gate lets her through: the flag the story keeps in step with her realm. */
export const gateFlag = (k: number) => `tiers:gate:${k}`;
