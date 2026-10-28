import type { AnimId, HumanId } from "../art/characters";
import type { PropId } from "../art/props";
import type { GreatDaoId } from "../engine/comprehension";

/**
 * Where the Sect of Ten Thousand Daos (万道宗) stands: a walled court in the
 * riverlands west of the Great South Road, with a hall for each of the ten
 * Great Daos round a square, the Outer Court's dormitories, a sparring ring,
 * the Mission Hall's board, and outside its east gate the field where ten
 * thousand hopefuls queue for the Grand Selection every six years.
 *
 * Kept free of the story's words so the world builder can stand the court,
 * its people and its trials without pulling in the tale (story/halls.ts).
 */

/** The court's walls (authoring tiles, inclusive), its square, and its east gate, the Gate of Equal Footing. */
export const HALLS = { x0: 140, y0: 444, x1: 180, y1: 480, c: [160, 462] as [number, number] };

/** The ten halls, one for each Great Dao, in the order she studies in them. */
export const HALL_DAOS = ["water", "wood", "wind", "fire", "earth", "metal", "thunder", "ice", "lifedeath", "void"] as const satisfies readonly GreatDaoId[];

export interface HallSite {
  dao: GreatDaoId;
  name: string;
  hanzi: string;
  /** The building, on the authoring grid. */
  at: [number, number];
  prop: PropId;
  /** Where its master stands (authoring grid). */
  master: [number, number];
}

export const HALL_SITES: HallSite[] = [
  { dao: "water", name: "Hall of Still Water", hanzi: "止水殿", at: [147, 449], prop: "house", master: [150, 451] },
  { dao: "wood", name: "Hall of the Old Pine", hanzi: "古松殿", at: [154, 447], prop: "house", master: [155, 450] },
  { dao: "wind", name: "Hall With No Walls", hanzi: "无墙殿", at: [167, 447], prop: "pavilion", master: [167, 450] },
  { dao: "fire", name: "Hall of the Red Furnace", hanzi: "赤炉殿", at: [173, 449], prop: "house", master: [171, 452] },
  { dao: "earth", name: "Hall of Bearing", hanzi: "厚载殿", at: [147, 456], prop: "house", master: [150, 457] },
  { dao: "metal", name: "Hall of the Edge", hanzi: "锋刃殿", at: [174, 468], prop: "house", master: [171, 468] },
  { dao: "thunder", name: "Hall of Discipline", hanzi: "雷律殿", at: [173, 456], prop: "house", master: [170, 457] },
  { dao: "ice", name: "Library of Frozen Words", hanzi: "冻字阁", at: [167, 476], prop: "house", master: [167, 473] },
  { dao: "lifedeath", name: "Ward of Long Sleep", hanzi: "长眠馆", at: [155, 476], prop: "house", master: [155, 473] },
  { dao: "void", name: "The Sealed Hall of the Void", hanzi: "虚空殿", at: [175, 476], prop: "pagoda", master: [172, 474] },
];

/** The Outer Court's dormitory she lives in (Room Seven of the east row): a building she can step into. */
export const DORM_AT: [number, number] = [146, 475];
/** The Mission Hall's board, the sparring ring, the Stone of Affinity (just outside the east gate), the Hall of Ten Thousand Daos at the head of the square. */
export const MISSION_AT: [number, number] = [156, 467];
export const RING: { c: [number, number]; r: number } = { c: [165, 468], r: 3.2 };
export const STONE_AT: [number, number] = [183, 457];
export const GREAT_HALL_AT: [number, number] = [160, 451];
/** The selection field outside the east gate, where the hopefuls queue. */
export const FIELD: { c: [number, number]; r: number } = { c: [189, 462], r: 6.4 };

/** The people of the Ten Halls, by key: the story speaks for them, the world builder stands them where they belong. */
export const HALL_CAST: Record<string, { name: string; char: HumanId }> = {
  "wd-herald": { name: "Herald of the Ten Halls", char: "wdherald" },
  "wd-yanshu": { name: "Examiner Yan Shu", char: "yanshu" },
  "wd-gou": { name: "Steward Gou", char: "steward" },
  "wd-fanyu": { name: "Senior Sister Fan Yu", char: "fanyu" },
  "wd-shenbai": { name: "Shen Bai", char: "shenbai" },
  "wd-yaozhi": { name: "Yao Zhi", char: "yaozhi" },
  "wd-tieniu": { name: "Tie Niu", char: "tieniu" },
  "wd-meilan": { name: "Mei Lan", char: "meilan" },
  "wd-qiu": { name: "Little Qiu", char: "qiu" },
  "wd-murong": { name: "Murong Xiao", char: "murong" },
  "wd-hm-water": { name: "Hall Master Lan Yi", char: "hmwater" },
  "wd-hm-wood": { name: "Hall Master Gu Song", char: "hmwood" },
  "wd-hm-wind": { name: "Hall Master Feng Qi", char: "hmwind" },
  "wd-hm-fire": { name: "Hall Master Zhu Yan", char: "hmfire" },
  "wd-hm-earth": { name: "Hall Master Hou Tu", char: "hmearth" },
  "wd-hm-metal": { name: "Hall Master Jin Ge", char: "hmmetal" },
  "wd-hm-thunder": { name: "Hall Master Lei Ting", char: "hmthunder" },
  "wd-hm-ice": { name: "Hall Master Han Shuang", char: "hmice" },
  "wd-hm-lifedeath": { name: "Hall Master Wen Ru", char: "hmlife" },
  "wd-ning": { name: "Ning Wuhen", char: "ning" },
};

export const hallMasterKey = (dao: GreatDaoId) => (dao === "void" ? "wd-ning" : `wd-hm-${dao}`);

/** The five who share Room Seven with her. */
export const ROOMMATES = ["wd-shenbai", "wd-yaozhi", "wd-tieniu", "wd-meilan", "wd-qiu"] as const;
export type RoommateKey = (typeof ROOMMATES)[number];

/** Where each of them is in Room Seven (room tiles), and what they are doing there. */
export const ROOM_SEVEN: Record<RoommateKey, { at: [number, number]; dir: number; anim: AnimId }> = {
  "wd-shenbai": { at: [2, 3], dir: 4, anim: "sit" },
  "wd-yaozhi": { at: [5, 3], dir: 12, anim: "read" },
  "wd-tieniu": { at: [3, 6], dir: 2, anim: "eat" },
  "wd-meilan": { at: [6, 5], dir: 10, anim: "write" },
  "wd-qiu": { at: [5, 6], dir: 14, anim: "pillow" },
};

/**
 * The ten thousand at the gate, as many as the field can hold: they queue on
 * tiptoe, stretch, pant after the long run, and spar while they wait. They
 * go home when the Selection is over, all but the few taken, who stay on in
 * the court as outer disciples.
 */
export const HOPEFULS: { key: string; name: string; char: HumanId; at: [number, number]; dir: number; anim: AnimId; stays?: [number, number] }[] = [
  { key: "wd-hope-0", name: "A Hopeful from Jinhe", char: "scholar", at: [185, 459], dir: 10, anim: "tiptoe" },
  { key: "wd-hope-1", name: "A Farmer's Son", char: "villagerM", at: [185, 461], dir: 10, anim: "tiptoe", stays: [158, 471] },
  { key: "wd-hope-2", name: "A Fisher Girl", char: "fishwife", at: [185, 464], dir: 10, anim: "tiptoe" },
  { key: "wd-hope-3", name: "A Young Swordsman", char: "swordsman", at: [187, 458], dir: 9, anim: "practice" },
  { key: "wd-hope-4", name: "A Merchant's Daughter", char: "lady", at: [187, 466], dir: 11, anim: "fan" },
  { key: "wd-hope-5", name: "A Wandering Novice", char: "novice", at: [188, 460], dir: 10, anim: "pant" },
  { key: "wd-hope-6", name: "A Porter's Boy", char: "boy", at: [188, 464], dir: 10, anim: "tiptoe", stays: [153, 470] },
  { key: "wd-hope-7", name: "A Disciple of a Small Sect", char: "discipleM", at: [190, 457], dir: 9, anim: "spar" },
  { key: "wd-hope-8", name: "Another Small-Sect Disciple", char: "discipleF", at: [191, 458], dir: 1, anim: "spar", stays: [163, 465] },
  { key: "wd-hope-9", name: "A Tea Picker", char: "teapicker", at: [190, 462], dir: 10, anim: "stretch" },
  { key: "wd-hope-10", name: "A Hunter from the Steppe", char: "nomad", at: [190, 466], dir: 11, anim: "tiptoe" },
  { key: "wd-hope-11", name: "A Woodcutter's Son", char: "woodcutter", at: [192, 464], dir: 10, anim: "pant" },
  { key: "wd-hope-12", name: "A Girl from Willow Creek", char: "villagerF", at: [192, 460], dir: 10, anim: "tiptoe", stays: [151, 466] },
  { key: "wd-hope-13", name: "A Monk's Runaway", char: "monk", at: [193, 467], dir: 11, anim: "pray" },
  { key: "wd-hope-14", name: "A Herb-Gatherer", char: "herbalist", at: [194, 462], dir: 10, anim: "tiptoe" },
  { key: "wd-hope-15", name: "A Guard's Daughter", char: "discipleF", at: [194, 458], dir: 9, anim: "salute" },
  { key: "wd-hope-16", name: "A Miller's Son", char: "millhand", at: [195, 465], dir: 10, anim: "pant" },
  { key: "wd-hope-17", name: "A Very Old Hopeful", char: "storyteller", at: [196, 461], dir: 10, anim: "think" },
  { key: "wd-hope-18", name: "An Acrobat", char: "acrobat", at: [186, 456], dir: 8, anim: "acrobat" },
  { key: "wd-hope-19", name: "A Steppe Girl", char: "outerF", at: [196, 457], dir: 9, anim: "tiptoe", stays: [168, 465] },
  { key: "wd-hope-20", name: "A Riverlands Lad", char: "outerM", at: [183, 466], dir: 10, anim: "token", stays: [161, 470] },
  { key: "wd-hope-21", name: "A Salt-Raker's Girl", char: "outerF", at: [197, 463], dir: 10, anim: "tiptoe" },
];

/** The outer disciples who come and go in the court once she is one of them (beside the hopefuls who stayed). */
export const OUTER_FOLK: { key: string; name: string; char: HumanId; at: [number, number]; dir: number; anim: AnimId; wander?: number }[] = [
  { key: "wd-outer-0", name: "Outer Disciple Lu Ping", char: "outerM", at: [151, 474], dir: 2, anim: "bucket" },
  { key: "wd-outer-1", name: "Outer Disciple Hua Ying", char: "outerF", at: [158, 456], dir: 4, anim: "sweep" },
  { key: "wd-outer-2", name: "Outer Disciple Gao Shan", char: "outerM", at: [162, 470], dir: 6, anim: "scrub" },
  { key: "wd-outer-3", name: "Outer Disciple Xiao Die", char: "outerF", at: [148, 462], dir: 2, anim: "read" },
  { key: "wd-outer-4", name: "Outer Disciple Bao Er", char: "outerM", at: [166, 459], dir: 8, anim: "carry", wander: 1.4 },
  { key: "wd-outer-5", name: "Outer Disciple Qin Yue", char: "outerF", at: [154, 459], dir: 0, anim: "taichi" },
];

/** The sparring disciples who wait in the ring for anyone who wants a bout. */
export const SPARRERS = ["wd-spar-0", "wd-spar-1", "wd-spar-2"] as const;

/** The trouble at the end of each hall's tale: who she faces, and where in the court. */
export const HALL_BOSSES = ["wdmurong", "wdblight", "wdfengqi", "wdfurnace", "wdwarden", "wdjinge", "wdkui", "wdfrost", "wdhong", "wdyanshu"] as const;
export type HallBossId = (typeof HALL_BOSSES)[number];
export const HALL_BOSS_AT: [number, number][] = [
  [RING.c[0], RING.c[1]],
  [156, 450],
  [167, 452],
  [172, 451],
  [149, 459],
  [171, 470],
  [168, 457],
  [165, 474],
  [181, 466],
  [174, 473],
];
