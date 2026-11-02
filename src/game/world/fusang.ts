import { fbm, hash2 } from "../pixel/noise";
import type { AnimId, HumanId } from "../art/characters";
import type { GreatDaoId } from "../engine/comprehension";

/**
 * Fusang (扶桑洲), the Dawn Continent: the land the world grew east into.
 *
 * Beyond Wavecrest Harbour and the Strait of Dawn the sun comes up out of
 * the sea through the branches of the Fusang tree, in the Valley of Sunrise
 * (旸谷), where the ten suns once bathed before Hou Yi shot nine of them down.
 * The people who settled under it took the lesson to heart: what heaven
 * allows too many of, burns the world. They have been counting ever since.
 *
 * Fusang is ruled by the Synod of Ten Seats (十座议), a council with one
 * seat for each Great Dao, held by whoever comprehends that Dao deepest. The
 * Synod's doctrine is that a Great Dao is not only something one understands
 * but something that can be written down, ruled on and enforced: its Ten
 * Writs (十道律) say what each Dao *means*, and anyone who comprehends it
 * otherwise is a heretic (异道者). Those it has exiled hold the free port of
 * Wuji on the continent's southern horn, the Unbound (无羁盟).
 *
 * This module holds only the shape of the land and where things stand on it
 * (authoring grid); who these people are and what they want lives in
 * world/powers.ts and the tale in story/contention.ts.
 */

/** The lobes Fusang is made of: [centre x, centre y, radius x, radius y]. */
const LOBES: [number, number, number, number][] = [
  [724, 150, 38, 50],
  [712, 262, 46, 60],
  [726, 362, 38, 50],
  [702, 452, 32, 40],
  [748, 230, 18, 34],
];

/** Is an authoring tile part of Fusang (before the coast is carved)? */
export function fusangLand(i: number, j: number): boolean {
  if (i < 640) return false;
  // the lobes are warped by slow noise, so they run together into one ragged shore
  const x = i + (fbm(i * 0.028, j * 0.028, 701) - 0.5) * 34;
  const y = j + (fbm(i * 0.028, j * 0.028, 702) - 0.5) * 34;
  for (const [cx, cy, rx, ry] of LOBES) if (Math.hypot((x - cx) / rx, (y - cy) / ry) < 1 + (fbm(i * 0.08, j * 0.08, 703) - 0.5) * 0.3) return true;
  // the neck of land the Dawn Causeway is built across (the strait is cut through it)
  return j >= 206 && j <= 230 && i <= 690 && Math.abs(j - 218 - (fbm(i * 0.05, 3, 704) - 0.5) * 10) < 9;
}

/** The City of Ten Seats, where the Synod sits (centre of its square). */
export const TEN_SEATS: [number, number] = [712, 268];
/** The Valley of Sunrise, with the Fusang tree at its heart. */
export const YANGGU: [number, number] = [726, 146];
/** The Hall of Writs, where the Synod's inquisitors keep the Ten Writs and try heretics. */
export const HALL_OF_WRITS: [number, number] = [728, 368];
/** Wuji, the Unbound's free port on the southern horn. */
export const WUJI: [number, number] = [700, 462];
/** The Dawn Causeway's landfall on Fusang's western shore. */
export const DAWN_LANDING: [number, number] = [680, 220];

/** The ten seats round the Synod's square, one for each Great Dao (offsets from its centre, in the order of GREAT_DAO_IDS). */
export const SEAT_RING: [number, number][] = Array.from({ length: 10 }, (_, k) => {
  const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
  return [Math.round(Math.cos(a) * 9), Math.round(Math.sin(a) * 7)];
});

/** Fusang's roads (authoring grid): the Dawn Causeway from the highway past Wavecrest, and the roads that join its places. */
export const FUSANG_ROADS: [number, number][][] = [
  // off the highway below the snows, across the neck and over the Strait of Dawn on the causeway's planks
  [[548, 236], [572, 226], [600, 220], [628, 216], [654, 218], [680, 220], [698, 236], [704, 262]],
  // north from the Ten Seats up the valley to the Fusang tree
  [[712, 255], [716, 228], [720, 200], [724, 172], [726, 154]],
  // south past the Hall of Writs to the free port
  [[716, 280], [722, 310], [727, 340], [728, 360]],
  [[724, 376], [716, 404], [708, 430], [702, 452]],
];

// ----------------------------------------------------------------------------- the people of Fusang
export interface FusangPerson {
  key: string;
  name: string;
  char: HumanId;
}

/** The Synod's Seat-holders, one for each Great Dao (the Seat of Life and Death stands empty; the Speaker holds the Void). */
export const SEATS: (FusangPerson & { dao: GreatDaoId })[] = [
  { dao: "water", key: "cn-seat-water", name: "Han Qiulan, Seat of Water", char: "seatholder" },
  { dao: "wood", key: "cn-seat-wood", name: "Song Laobai, Seat of Wood", char: "seatholder" },
  { dao: "wind", key: "cn-seat-wind", name: "Lie Yukou, Seat of Wind", char: "seatholder" },
  { dao: "fire", key: "cn-seat-fire", name: "Zhu Rong'e, Seat of Fire", char: "seatholder" },
  { dao: "earth", key: "cn-seat-earth", name: "Hou Kun, Seat of Earth", char: "seatholder" },
  { dao: "metal", key: "cn-seat-metal", name: "Geng Jian, Seat of Metal", char: "seatholder" },
  { dao: "thunder", key: "cn-seat-thunder", name: "Lei Zhenzi, Seat of Thunder", char: "seatholder" },
  { dao: "ice", key: "cn-seat-ice", name: "Ling Shuang, Seat of Ice and Grand Inquisitor", char: "seatholder" },
];
export const SPEAKER: FusangPerson = { key: "cn-speaker", name: "Xi He, Speaker of the Synod", char: "synodspeaker" };
export const KEEPER: FusangPerson = { key: "cn-keeper", name: "Hou Qing, Keeper of the Fusang Tree", char: "dawnkeeper" };
export const FENG: FusangPerson = { key: "cn-feng", name: "Feng Buji, Harbour-Master of Wuji", char: "unfettered" };
export const seatKey = (dao: GreatDaoId) => `cn-seat-${dao}`;

/** The townsfolk of the City of Ten Seats and the free port, by trade (they keep the places busy; their lines are in story/contention.ts). */
export const FUSANG_FOLK: { key: string; name: string; char: HumanId; at: "seats" | "wuji" | "yanggu" | "writs" | "landing"; anim?: AnimId }[] = [
  { key: "cn-folk-clerk1", name: "Synod Clerk Ruan", char: "scholar", at: "seats", anim: "write" },
  { key: "cn-folk-clerk2", name: "Synod Clerk Pan", char: "scholar", at: "seats", anim: "read" },
  { key: "cn-folk-clerk3", name: "Copyist Xu", char: "archivist", at: "seats", anim: "write" },
  { key: "cn-folk-sweeper", name: "Square-Sweeper Old Duo", char: "villagerM", at: "seats", anim: "sweep" },
  { key: "cn-folk-tea", name: "Tea-Seller Ming'e", char: "teawoman", at: "seats", anim: "pour" },
  { key: "cn-folk-child", name: "Little Ten-Seats", char: "child", at: "seats", anim: "kite" },
  { key: "cn-folk-guard1", name: "Synod Warden Shi", char: "tierwarden", at: "seats", anim: "look" },
  { key: "cn-folk-guard2", name: "Synod Warden Kong", char: "tierwarden", at: "writs", anim: "look" },
  { key: "cn-folk-inquisitor", name: "Junior Inquisitor Wen", char: "inquisitor", at: "writs", anim: "read" },
  { key: "cn-folk-archivist", name: "Under-Archivist Lü", char: "archivist", at: "writs", anim: "read" },
  { key: "cn-folk-pilgrim1", name: "Dawn Pilgrim Ah Fu", char: "villagerF", at: "yanggu", anim: "pray" },
  { key: "cn-folk-pilgrim2", name: "Dawn Pilgrim Old Shen", char: "monk", at: "yanggu", anim: "pray" },
  { key: "cn-folk-gardener", name: "Leaf-Gatherer Qiu", char: "farmer", at: "yanggu", anim: "rake" },
  { key: "cn-folk-potter", name: "Potter Yu, who reads Earth wrongly", char: "villagerF", at: "wuji", anim: "knead" },
  { key: "cn-folk-poet", name: "A Very Bad Poet", char: "scholar", at: "wuji", anim: "write" },
  { key: "cn-folk-sailor1", name: "Grey-Sail Sailor Hai", char: "boatwoman", at: "wuji", anim: "row" },
  { key: "cn-folk-sailor2", name: "Grey-Sail Sailor Bo", char: "porter", at: "wuji", anim: "carry" },
  { key: "cn-folk-fisher", name: "Fisher Lan, who reads Water wrongly", char: "fishwife", at: "wuji", anim: "fish" },
  { key: "cn-folk-meilan", name: "Mei Lan, who reads Wood wrongly", char: "villagerM", at: "wuji", anim: "plant" },
  { key: "cn-folk-ferry", name: "Causeway Toll-Keeper Gao", char: "guard", at: "landing", anim: "look" },
];

// ----------------------------------------------------------------------------- the Contention's troubles
/** What each book of the Contention sends against her, and who waits at the end of each (see engine/enemies.ts). */
export const CN_FOES = ["writhound", "sealrunner", "dawninquisitor", "purgekeeper", "starvedreading", "voidwarden"] as const;
export type CnFoeId = (typeof CN_FOES)[number];
export const CN_BOSSES = ["bailu", "murongce", "lingshuang", "duanmujue", "unwritten", "xihe"] as const;
export type CnBossId = (typeof CN_BOSSES)[number];
/** Where each book's trouble is met (authoring grid): the Hall road, Longcheng's dunes, Wuji, the Hall of Writs, the Fusang tree, the Ten Seats. */
export const CN_GROUND: [number, number][] = [
  [720, 330],
  [548, 430],
  [WUJI[0], WUJI[1] - 10],
  [HALL_OF_WRITS[0], HALL_OF_WRITS[1] + 8],
  [YANGGU[0], YANGGU[1] + 8],
  [TEN_SEATS[0], TEN_SEATS[1] - 16],
];

// ----------------------------------------------------------------------------- the people of Fusang's places, in their hundreds
/** Fusang keeps the jianghu's ten mortals to every cultivator: clerks and copyists in the City of Ten Seats, sailors and fishers in Wuji, pilgrims under the tree. */
export const FUSANG_TOWNSFOLK = 300;
export type FusangPlace = "seats" | "wuji" | "yanggu" | "writs";
const FUSANG_TRADES: Record<FusangPlace, { id: string; name: string; looks: HumanId[]; anim: AnimId }[]> = {
  seats: [
    { id: "clerk", name: "Synod Clerk", looks: ["scholar"], anim: "write" },
    { id: "reader", name: "Reader of the Writs", looks: ["scholar", "lady"], anim: "read" },
    { id: "merchant", name: "Ink-Merchant", looks: ["merchant", "peddler"], anim: "abacus" },
    { id: "tea", name: "Tea-Seller", looks: ["teawoman"], anim: "pour" },
    { id: "porter", name: "Porter", looks: ["porter"], anim: "carry" },
    { id: "weaver", name: "Parasol-Weaver", looks: ["weaver"], anim: "weave" },
    { id: "cook", name: "Dumpling-Cook", looks: ["cook"], anim: "knead" },
    { id: "sweeper", name: "Leaf-Sweeper", looks: ["villagerM", "villagerF"], anim: "sweep" },
    { id: "warden", name: "Square Warden", looks: ["guard"], anim: "look" },
    { id: "child", name: "Child", looks: ["child", "boy"], anim: "kite" },
  ],
  wuji: [
    { id: "fisher", name: "Grey-Sail Fisher", looks: ["fishwife"], anim: "fish" },
    { id: "sailor", name: "Grey-Sail Sailor", looks: ["boatwoman"], anim: "row" },
    { id: "porter", name: "Dock Porter", looks: ["porter"], anim: "carry" },
    { id: "smith", name: "Exiled Smith", looks: ["smith"], anim: "hammer" },
    { id: "copyist", name: "Grey-Board Copyist", looks: ["scholar"], anim: "write" },
    { id: "child", name: "Child of Wuji", looks: ["boy", "child"], anim: "kick" },
  ],
  yanggu: [{ id: "pilgrim", name: "Dawn Pilgrim", looks: ["villagerF", "villagerM"], anim: "pray" }],
  writs: [
    { id: "clerk", name: "Clerk of the Hall", looks: ["scholar"], anim: "read" },
    { id: "warden", name: "Warden of the Hall", looks: ["guard"], anim: "look" },
  ],
};
const FUSANG_SURNAMES = ["Xi", "Fu", "Sang", "Yang", "Ri", "Chen", "Ming", "Zhao", "Gu", "Qing", "Lan", "Bai", "Jin", "Yu", "Shen", "Hou", "Mei", "Lu", "Han", "Song"];
const FUSANG_GIVEN = ["Dawn", "Ink", "Reed", "Pearl", "Tide", "Leaf", "Ash", "Plum", "Stone", "Lamp", "Wren", "Moth", "Kite", "Bell"];
export const fusangTownKey = (n: number) => `cn-town-${n}`;
export function parseFusangTownKey(key: string): number | null {
  const m = /^cn-town-(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}
/** Townsperson n of Fusang: where they live, what they do, what they look like and what they are called. */
export function fusangTown(n: number): { key: string; place: FusangPlace; trade: string; name: string; char: HumanId; anim: AnimId } {
  const place: FusangPlace = n < 170 ? "seats" : n < 250 ? "wuji" : n < 280 ? "yanggu" : "writs";
  const trades = FUSANG_TRADES[place];
  const t = trades[Math.floor(hash2(n, 3, 731) * trades.length)];
  const char = t.looks[Math.floor(hash2(n, 4, 732) * t.looks.length)];
  const sur = FUSANG_SURNAMES[Math.floor(hash2(n, 5, 733) * FUSANG_SURNAMES.length)];
  const given = FUSANG_GIVEN[Math.floor(hash2(n, 6, 734) * FUSANG_GIVEN.length)];
  return { key: fusangTownKey(n), place, trade: t.id, name: t.id === "child" ? `Little ${given}` : `${t.name} ${sur} ${given}`, char, anim: t.anim };
}
