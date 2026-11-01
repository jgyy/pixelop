import type { AnimId, HumanId } from "../art/characters";
import type { PropId } from "../art/props";

/**
 * The Founding (开宗立派): the ground she raises her own sect on, the
 * buildings that go up on it one quest at a time, the people who come to
 * live and work there, the market town that grows outside its gate, and the
 * gods of the Celestial Court who come down to see what she has made.
 *
 * The site is the Withered Lotus Basin (枯莲谷) in the Yellow Sands: a bowl
 * of old paving and dead reeds where, the Earth God says, the Azure Cloud's
 * founder first planted the Jade Lotus before she carried it up into the
 * clouds. The spring followed the lotus up, and the basin has been dry ever
 * since.
 *
 * Everything here is a pure function of story flags (`fd:built:<key>`,
 * `fd:elder:<n>`, `fd:disc:<n>`, `fd:god:<id>` and so on, which
 * story/founding.ts keeps in step with the tale), so the world builder can
 * raise it without pulling in the tale's words.
 *
 * The same module holds the new facilities of the six capitals (a granary, a
 * mill, a kiln, a dye works, a school, a bathhouse, a post station and a
 * temple to the City God in each), and the workers who go round them all
 * day, from one job to the next.
 */

export const FOUNDING_BOOKS = 5;

/** Centre of the basin on the authoring grid (the Yellow Sands, south of Hollowstone Hold). */
export const FOUNDING_C: [number, number] = [342, 410];
/** Centre of the market town that grows outside her gate (authoring grid). */
export const MARKET_C: [number, number] = [342, 430];

/** The foes of each book, and who waits at the end of each. */
export const FOUNDING_FOES = ["sandghoul", "poacher", "discordimp", "registerwraith", "zealot"] as const;
export type FoundingFoeId = (typeof FOUNDING_FOES)[number];
export const FOUNDING_BOSSES = ["tuba", "qiansou", "houmian", "falsestar", "guwuchen"] as const;
export type FoundingBossId = (typeof FOUNDING_BOSSES)[number];

/** The four names her sect may take, one for each Dao (chosen in the first book). */
export const SECT_NAMES = {
  sword: { name: "the Sword-Heart Sect", hanzi: "剑心宗", motto: "A blade that knows why it is drawn." },
  mercy: { name: "the Merciful Lotus Sect", hanzi: "慈莲宗", motto: "No one turned from the gate." },
  balance: { name: "the Even Cloud Sect", hanzi: "衡云宗", motto: "Every weight on the scale." },
  slaughter: { name: "the Blood Lotus Sect", hanzi: "血莲宗", motto: "What is ours, we keep." },
} as const;
export type SectNameId = keyof typeof SECT_NAMES;

/** What her sect is called, by the name she gave it (or not yet). */
export function sectName(f: Record<string, boolean>): { name: string; hanzi: string; motto: string } {
  const id = (Object.keys(SECT_NAMES) as SectNameId[]).find((k) => f[`fd:name:${k}`]);
  return id ? SECT_NAMES[id] : { name: "her sect, which has no name yet", hanzi: "无名宗", motto: "" };
}

// ----------------------------------------------------------------------------- the buildings
export interface Building {
  key: string;
  name: string;
  hanzi: string;
  /** The book that raises it. */
  book: number;
  /** The props it is made of: what, and where (authoring tiles from the basin's centre). */
  parts: { id: PropId; at: [number, number] }[];
  /** What it does for the sect (the journal, and the steward's report). */
  use: string;
  /** Its keeper (an elder or a worker), if it has one: the work they go round, station by station (offsets from the basin's centre). */
  keeper?: { name: string; char: HumanId; jobs: { at: [number, number]; anim: AnimId }[] };
  /** Spirit stones it adds to the daily tithe. */
  tithe: number;
}

export const BUILDINGS: Building[] = [
  // I · Choosing the Ground
  { key: "gate", name: "the Mountain Gate", hanzi: "山门", book: 0, parts: [{ id: "gate", at: [0, 13] }], use: "Keeps the sands out and lets the hopeful in.", tithe: 2 },
  { key: "hall", name: "the Hall of the Founding", hanzi: "立宗殿", book: 0, parts: [{ id: "hall", at: [0, -9] }], use: "Where she sits as sect master and hears her people.", tithe: 4 },
  {
    key: "well",
    name: "the Sweet Well",
    hanzi: "甘井",
    book: 0,
    parts: [{ id: "well", at: [-5, 3] }],
    use: "The first water the basin has given in centuries.",
    keeper: { name: "Water-Carrier Shui", char: "outerM", jobs: [{ at: [-4, 4], anim: "bucket" }, { at: [-2, 7], anim: "carry" }, { at: [-5, 6], anim: "scrub" }] },
    tithe: 1,
  },
  {
    key: "quarters",
    name: "the Disciples' Quarters",
    hanzi: "弟子居",
    book: 0,
    parts: [
      { id: "townhouse", at: [-13, -3] },
      { id: "townhouse", at: [-13, 5] },
    ],
    use: "Bunks for every disciple she takes in.",
    keeper: { name: "Dormitory Aunt Fang", char: "villagerF", jobs: [{ at: [-10, 1], anim: "carry" }, { at: [-10, -1], anim: "pour" }, { at: [-9, 3], anim: "gather" }] },
    tithe: 2,
  },
  // II · Taking Disciples
  {
    key: "yard",
    name: "the Sword Practice Yard",
    hanzi: "演武场",
    book: 1,
    parts: [
      { id: "dummy", at: [5, -4] },
      { id: "dummy", at: [8, -4] },
      { id: "swordrack", at: [11, -4] },
    ],
    use: "Morning forms, afternoon bouts.",
    tithe: 3,
  },
  {
    key: "refectory",
    name: "the Refectory",
    hanzi: "斋堂",
    book: 1,
    parts: [
      { id: "noodlecart", at: [10, 7] },
      { id: "steamer", at: [12, 7] },
      { id: "table", at: [8, 9] },
    ],
    use: "Three meals a day, and the Lord of the Hearth watching over the stove.",
    keeper: { name: "Cook Big Pan", char: "cook", jobs: [{ at: [11, 8], anim: "knead" }, { at: [9, 8], anim: "stir" }, { at: [10, 10], anim: "pour" }] },
    tithe: 2,
  },
  {
    key: "fields",
    name: "the Spirit Fields",
    hanzi: "灵田",
    book: 1,
    parts: [
      { id: "seedbed", at: [-8, 10] },
      { id: "seedbed", at: [-11, 10] },
      { id: "scarecrow", at: [-14, 9] },
    ],
    use: "Spirit rice in sand that remembers being a lake.",
    keeper: { name: "Field-Hand Tian Er", char: "farmer", jobs: [{ at: [-9, 12], anim: "plant" }, { at: [-12, 12], anim: "hoe" }, { at: [-7, 12], anim: "rake" }] },
    tithe: 3,
  },
  {
    key: "pills",
    name: "the Pill Chamber",
    hanzi: "丹房",
    book: 1,
    parts: [
      { id: "cauldron", at: [7, 2] },
      { id: "herbrack", at: [9, 2] },
    ],
    use: "Healing pills for the sect, and a few to sell.",
    tithe: 4,
  },
  {
    key: "forge",
    name: "the Artifact Forge",
    hanzi: "器坊",
    book: 1,
    parts: [
      { id: "forge", at: [13, 1] },
      { id: "weaponrack", at: [13, 4] },
    ],
    use: "Practice swords first. Real ones later.",
    keeper: { name: "Smith Iron Zhang", char: "smith", jobs: [{ at: [11, 3], anim: "hammer" }, { at: [11, 5], anim: "carry" }, { at: [12, 3], anim: "appraise" }] },
    tithe: 4,
  },
  // III · Laying Down the Rules
  { key: "library", name: "the Scripture Pavilion", hanzi: "藏经阁", book: 2, parts: [{ id: "pagoda", at: [-9, -11] }], use: "Every manual she has, copied out by hand.", tithe: 3 },
  {
    key: "talismans",
    name: "the Talisman Hall",
    hanzi: "符堂",
    book: 2,
    parts: [{ id: "pavilion", at: [9, -11] }],
    use: "Ward-papers for the caravans, at a fair price.",
    keeper: { name: "Talisman-Clerk Bi", char: "scholar", jobs: [{ at: [7, -8], anim: "inscribe" }, { at: [10, -8], anim: "write" }, { at: [8, -7], anim: "read" }] },
    tithe: 4,
  },
  {
    key: "arrays",
    name: "the Array Platform",
    hanzi: "阵台",
    book: 2,
    parts: [
      { id: "affinitystone", at: [-15, -10] },
      { id: "banner", at: [-15, -7] },
    ],
    use: "The basin's ward, and a place to test new arrays.",
    tithe: 3,
  },
  {
    key: "healing",
    name: "the House of Healing",
    hanzi: "医馆",
    book: 2,
    parts: [
      { id: "herbbed", at: [-6, 9] },
      { id: "herbrack", at: [-4, 10] },
    ],
    use: "For the sect, and for anyone off the caravan road.",
    keeper: { name: "Healer Xiao Su", char: "herbalist", jobs: [{ at: [-5, 11], anim: "grind" }, { at: [-7, 11], anim: "gather" }, { at: [-3, 9], anim: "bandage" }] },
    tithe: 2,
  },
  {
    key: "beasts",
    name: "the Spirit Beast Pens",
    hanzi: "灵兽圈",
    book: 2,
    parts: [
      { id: "fence", at: [15, 9] },
      { id: "haystack", at: [14, 11] },
    ],
    use: "Camels that can smell a sandstorm three days off.",
    keeper: { name: "Herder Ah Gu", char: "nomad", jobs: [{ at: [13, 10], anim: "tame" }, { at: [15, 12], anim: "carry" }, { at: [12, 11], anim: "look" }] },
    tithe: 3,
  },
  { key: "missions", name: "the Mission Hall", hanzi: "任务堂", book: 2, parts: [{ id: "missionboard", at: [4, 7] }], use: "Where the caravans post their troubles and the disciples take them.", tithe: 4 },
  // IV · The Celestial Court
  { key: "treasury", name: "the Treasury", hanzi: "宝库", book: 3, parts: [{ id: "mansion", at: [12, -15] }], use: "Locked three ways, and the Lord of Wealth has the third key.", tithe: 6 },
  { key: "bell", name: "the Bell Tower", hanzi: "钟楼", book: 3, parts: [{ id: "drumtower", at: [15, -6] }], use: "Rung at dawn, at dusk, and when the sands move.", tithe: 2 },
  {
    key: "altar",
    name: "the Altar of Heaven",
    hanzi: "天坛",
    book: 3,
    parts: [
      { id: "dais", at: [0, -16] },
      { id: "censer", at: [-3, -14] },
      { id: "censer", at: [3, -14] },
    ],
    use: "Where the Celestial Court comes down to earth.",
    tithe: 2,
  },
  { key: "shrine", name: "the Ancestral Shrine", hanzi: "祖师祠", book: 3, parts: [{ id: "statue", at: [-5, -13] }], use: "A statue of the Azure Cloud's founder, who planted the first lotus here.", tithe: 1 },
  // V · The Founding Ceremony
  {
    key: "guests",
    name: "the Guest House",
    hanzi: "客舍",
    book: 4,
    parts: [{ id: "teahouse", at: [-13, 13] }],
    use: "Beds for the delegations, and tea for the ones who came to sneer.",
    keeper: { name: "Innkeeper Madam Rong", char: "villagerF", jobs: [{ at: [-10, 12], anim: "pour" }, { at: [-10, 15], anim: "sweep" }, { at: [-8, 13], anim: "carry" }] },
    tithe: 4,
  },
  {
    key: "spring",
    name: "the Lotus Spring",
    hanzi: "莲泉",
    book: 4,
    parts: [
      { id: "fountain", at: [0, 2] },
      { id: "lotus", at: [-2, 5] },
      { id: "lotus", at: [2, 5] },
    ],
    use: "The basin's spring, running again.",
    tithe: 5,
  },
];

export const builtFlag = (key: string) => `fd:built:${key}`;

// ----------------------------------------------------------------------------- the people
export interface SectPerson {
  key: string;
  name: string;
  char: HumanId;
  anim?: AnimId;
  at: [number, number];
  /** The round of work they go about, when they have one. */
  jobs?: { at: [number, number]; anim: AnimId }[];
}

/** Who keeps the sect for her: her steward, from the first book on. */
export const STEWARD: SectPerson = { key: "fd-steward", name: "Steward Bai Qiu", char: "fdsteward", anim: "abacus", at: [3, -5] };

/** The Earth God of the basin, at his little shrine from the very first. */
export const EARTH_GOD: SectPerson = { key: "fd-earthgod", name: "Grandfather Earth of the Withered Basin", char: "earthgod", anim: "idle", at: [-3, 0] };

/** Her elders, one appointed at a time: what they keep, and where they stand at work. */
export const ELDERS: (SectPerson & { office: string; hanzi: string; book: number })[] = [
  { key: "fd-elder-0", name: "Elder Jiang of the Sword", char: "fdelder0", office: "Elder of the Sword", hanzi: "剑长老", book: 1, at: [6, -6], jobs: [{ at: [6, -6], anim: "sworddance" }, { at: [9, -6], anim: "point" }, { at: [7, -2], anim: "nod" }] },
  { key: "fd-elder-1", name: "Elder Kang Lin of the Pill Chamber", char: "fdelder1", office: "Elder of Pills", hanzi: "丹长老", book: 1, at: [8, 4], jobs: [{ at: [8, 4], anim: "stir" }, { at: [10, 4], anim: "grind" }, { at: [6, 4], anim: "fanfire" }] },
  { key: "fd-elder-2", name: "Elder Zeng of the Scriptures", char: "fdelder2", office: "Elder of the Scriptures", hanzi: "经长老", book: 2, at: [-8, -8], jobs: [{ at: [-8, -8], anim: "read" }, { at: [-10, -8], anim: "write" }, { at: [-6, -7], anim: "think" }] },
  { key: "fd-elder-3", name: "Elder Xiang of the Arrays", char: "fdelder3", office: "Elder of Arrays", hanzi: "阵长老", book: 2, at: [-13, -8], jobs: [{ at: [-13, -8], anim: "array" }, { at: [-12, -11], anim: "inscribe" }, { at: [-11, -7], anim: "stargaze" }] },
  { key: "fd-elder-4", name: "Elder Guan of Discipline", char: "fdelder4", office: "Elder of Discipline", hanzi: "戒律长老", book: 2, at: [-3, 10], jobs: [{ at: [-3, 10], anim: "look" }, { at: [3, 10], anim: "salute" }, { at: [0, 9], anim: "point" }] },
  { key: "fd-elder-5", name: "Elder Ren of the Outer Court", char: "fdelder5", office: "Elder of the Outer Court", hanzi: "外务长老", book: 3, at: [5, 11], jobs: [{ at: [5, 11], anim: "abacus" }, { at: [3, 12], anim: "beckon" }, { at: [7, 11], anim: "write" }] },
];

export const DISCIPLE_SLOTS = 24;
/** The rooted wear disciples' robes; the rootless (her first disciples were caravan children no sect would take) wear what they came in. */
const DISCIPLE_LOOKS: HumanId[] = ["outerM", "villagerF", "discipleM", "villagerM", "outerF", "villagerF"];
const DISCIPLE_NAMES = ["Ah Lan", "Tie Dan", "Xiao Ru", "Mo Mo", "Shi Tou", "Ling'er", "Gou Sheng", "Hong Hong", "Da Zhuang", "Yun Yun", "Bai Shui", "Huan Huan", "Sha Zi", "Lü Ye", "Qiu Qiu", "Pang Hu", "Ya Tou", "Xing Xing", "Wu Ming", "Cao Cao", "Mei Mei", "Long Long", "An An", "Shan Shan"];
/** The outer disciples' rounds: what they are seen doing as the day goes (stations as offsets from the basin's centre). */
const ROUNDS: { anim: AnimId; at: [number, number] }[][] = [
  [{ anim: "sweep", at: [-2, -3] }, { anim: "carry", at: [2, -3] }, { anim: "bow", at: [0, -5] }],
  [{ anim: "read", at: [-7, -6] }, { anim: "copy", at: [-5, -6] }, { anim: "tiptoe", at: [-4, -3] }],
  [{ anim: "bucket", at: [-3, 6] }, { anim: "scrub", at: [-6, 6] }, { anim: "carry", at: [-2, 8] }],
  [{ anim: "sweep", at: [2, 11] }, { anim: "salute", at: [-2, 11] }, { anim: "dust", at: [0, 9] }],
  [{ anim: "stir", at: [7, 6] }, { anim: "fanfire", at: [5, 5] }, { anim: "eat", at: [7, 8] }],
];
/** The rootless disciples' rounds: the work any sect needs done, and the fields. */
const ROOTLESS_ROUNDS: { anim: AnimId; at: [number, number] }[][] = [
  [{ anim: "sweep", at: [-1, -2] }, { anim: "carry", at: [3, -2] }, { anim: "bow", at: [1, -5] }],
  [{ anim: "plant", at: [-10, 12] }, { anim: "carry", at: [-7, 13] }, { anim: "gather", at: [-12, 12] }],
  [{ anim: "carry", at: [-4, 7] }, { anim: "sweep", at: [-6, 4] }, { anim: "wave", at: [-1, 9] }],
];
/** The inner disciples' round: the practice yard. */
const SWORD_ROUND: { anim: AnimId; at: [number, number] }[] = [
  { anim: "practice", at: [6, -2] },
  { anim: "taichi", at: [9, -2] },
  { anim: "salute", at: [7, 0] },
];

/** Disciple n of the sect (n counts the order they came in): a look, a name, and the round of work they go about. */
export function disciple(n: number): SectPerson {
  const char = DISCIPLE_LOOKS[n % DISCIPLE_LOOKS.length];
  const round = char === "discipleM" || char === "discipleF" ? SWORD_ROUND : char === "villagerF" || char === "villagerM" ? ROOTLESS_ROUNDS[n % ROOTLESS_ROUNDS.length] : ROUNDS[n % ROUNDS.length];
  // each one's stations are a step or two from the last one's, so they do not all crowd one spot
  const dx = (Math.floor(n / 6) % 3) - 1;
  const dy = Math.floor(n / 12) % 2;
  const jobs = round.map((r) => ({ anim: r.anim, at: [r.at[0] + dx, r.at[1] + dy] as [number, number] }));
  return { key: `fd-disc-${n}`, name: `Disciple ${DISCIPLE_NAMES[n % DISCIPLE_NAMES.length]}`, char, at: jobs[0].at, jobs };
}
export const discFlag = (n: number) => `fd:disc:${n}`;
export const elderFlag = (n: number) => `fd:elder:${n}`;

// ----------------------------------------------------------------------------- the gods
export interface God {
  id: string;
  key: string;
  name: string;
  hanzi: string;
  char: HumanId;
  anim?: AnimId;
  /** Where they stand when they have come down (offsets from the basin's centre). */
  at: [number, number];
  /** What they keep in heaven (the journal). */
  office: string;
}

/** The Celestial Court: the Jade Emperor and the Queen Mother, and the gods who come down to the basin in the fourth book. */
export const GODS: God[] = [
  { id: "jade", key: "fd-god-jade", name: "the Jade Emperor", hanzi: "玉皇大帝", char: "jadeemperor", anim: "enthrone", at: [-1, -14], office: "Emperor of Heaven, keeper of the Register of Sects" },
  { id: "queen", key: "fd-god-queen", name: "the Queen Mother of the West", hanzi: "西王母", char: "queenmother", anim: "fanning", at: [2, -14], office: "Empress of Heaven, keeper of the peaches of long life" },
  { id: "hearth", key: "fd-god-hearth", name: "the Lord of the Hearth", hanzi: "灶君", char: "kitchengod", anim: "stir", at: [9, 10], office: "who watches every kitchen and reports on every house at the year's end" },
  { id: "letters", key: "fd-god-letters", name: "the Star of Letters", hanzi: "文曲星", char: "starlord", anim: "write", at: [-11, -9], office: "who keeps the scriptures of heaven, and checks the copies on earth" },
  { id: "wealth", key: "fd-god-wealth", name: "the Lord of Wealth", hanzi: "财神", char: "wealthgod", anim: "abacus", at: [10, -13], office: "who keeps the third key of every honest treasury" },
  { id: "thunder", key: "fd-god-thunder", name: "the Lord of Thunder", hanzi: "雷公", char: "thunderlord", anim: "cast", at: [13, -8], office: "who strikes the wicked and tests the new" },
  { id: "moon", key: "fd-god-moon", name: "the Lady of the Moon", hanzi: "嫦娥", char: "moonlady", anim: "stargaze", at: [-3, 3], office: "who looks down at every spring, to see her face" },
];
export const godFlag = (id: string) => `fd:god:${id}`;

// ----------------------------------------------------------------------------- the market town outside her gate
/** The market town grows as the sect does: each stall and house appears with a book, and someone works it. */
export const MARKET: { book: number; part: { id: PropId; at: [number, number] }; worker?: { key: string; name: string; char: HumanId; jobs: { at: [number, number]; anim: AnimId }[] } }[] = [
  { book: 0, part: { id: "stall", at: [-5, -2] }, worker: { key: "fd-mk-0", name: "Date-Seller Old Ma", char: "merchant", jobs: [{ at: [-5, 0], anim: "abacus" }, { at: [-3, 0], anim: "hawk" }] } },
  { book: 1, part: { id: "stall", at: [5, -2] }, worker: { key: "fd-mk-1", name: "Water-Seller Lü", char: "peddler", jobs: [{ at: [5, 0], anim: "hawk" }, { at: [3, 0], anim: "carry" }] } },
  { book: 1, part: { id: "cart", at: [0, 3] }, worker: { key: "fd-mk-2", name: "Carter Niu", char: "porter", jobs: [{ at: [2, 4], anim: "carry" }, { at: [-2, 4], anim: "rummage" }] } },
  { book: 2, part: { id: "house", at: [-9, 4] }, worker: { key: "fd-mk-3", name: "Weaver Sister Qin", char: "weaver", jobs: [{ at: [-6, 3], anim: "weave" }, { at: [-6, 6], anim: "carry" }] } },
  { book: 2, part: { id: "forge", at: [9, 4] }, worker: { key: "fd-mk-4", name: "Farrier Hu", char: "smith", jobs: [{ at: [6, 3], anim: "hammer" }, { at: [6, 6], anim: "carry" }] } },
  { book: 3, part: { id: "teahouse", at: [-8, 9] }, worker: { key: "fd-mk-5", name: "Tea-Mistress Yun", char: "villagerF", jobs: [{ at: [-5, 9], anim: "pour" }, { at: [-5, 11], anim: "sweep" }] } },
  { book: 3, part: { id: "shopflag", at: [-3, -3] } },
  { book: 4, part: { id: "towerinn", at: [9, 9] }, worker: { key: "fd-mk-6", name: "Innkeeper Wei", char: "villagerM", jobs: [{ at: [6, 9], anim: "carry" }, { at: [6, 11], anim: "wave" }] } },
  { book: 4, part: { id: "operastage", at: [0, 10] }, worker: { key: "fd-mk-7", name: "Storyteller Blind Gao", char: "villagerM", jobs: [{ at: [2, 8], anim: "tell" }, { at: [-2, 8], anim: "laugh" }] } },
];
export const marketFlag = (book: number) => `fd:market:${book}`;

// ----------------------------------------------------------------------------- the capitals' new facilities
/**
 * The facilities of the six capitals: what each is, what it is made of
 * (offsets from the capital's centre), and who works it, going from one job
 * to the next all day long.
 */
export interface Facility {
  key: string;
  name: string;
  hanzi: string;
  parts: { id: PropId; at: [number, number] }[];
  workers: { name: string; char: HumanId; jobs: { at: [number, number]; anim: AnimId }[] }[];
}

export const FACILITIES: Facility[] = [
  {
    key: "granary",
    name: "the Granary",
    hanzi: "官仓",
    parts: [
      { id: "sacks", at: [-20, -2] },
      { id: "barrels", at: [-20, 1] },
    ],
    workers: [
      { name: "Granary Porter", char: "porter", jobs: [{ at: [-18, -2], anim: "carry" }, { at: [-18, 1], anim: "rummage" }, { at: [-17, 0], anim: "abacus" }] },
      { name: "Granary Sweeper", char: "villagerM", jobs: [{ at: [-19, 3], anim: "sweep" }, { at: [-21, 3], anim: "gather" }] },
    ],
  },
  {
    key: "mill",
    name: "the Mill",
    hanzi: "磨坊",
    parts: [{ id: "millstone", at: [-17, -6] }],
    workers: [{ name: "Miller", char: "villagerM", jobs: [{ at: [-16, -4], anim: "carry" }, { at: [-18, -4], anim: "gather" }] }],
  },
  {
    key: "kiln",
    name: "the Kiln",
    hanzi: "窑",
    parts: [{ id: "furnace", at: [18, -4] }],
    workers: [
      { name: "Potter", char: "smith", jobs: [{ at: [16, -3], anim: "hammer" }, { at: [17, -1], anim: "carry" }, { at: [19, -2], anim: "appraise" }] },
      { name: "Kiln Stoker", char: "villagerM", jobs: [{ at: [20, -5], anim: "chop" }, { at: [19, -6], anim: "carry" }] },
    ],
  },
  {
    key: "dyeworks",
    name: "the Dye Works",
    hanzi: "染坊",
    parts: [{ id: "laundry", at: [18, 8] }],
    workers: [
      { name: "Dyer", char: "weaver", jobs: [{ at: [16, 8], anim: "weave" }, { at: [17, 10], anim: "carry" }] },
      { name: "Dye-Vat Girl", char: "villagerF", jobs: [{ at: [19, 10], anim: "pour" }, { at: [20, 8], anim: "carry" }] },
    ],
  },
  {
    key: "school",
    name: "the School",
    hanzi: "学堂",
    parts: [
      { id: "table", at: [-8, 15] },
      { id: "scroll", at: [-10, 15] },
    ],
    workers: [
      { name: "Schoolmaster", char: "scholar", jobs: [{ at: [-9, 17], anim: "read" }, { at: [-7, 17], anim: "write" }, { at: [-8, 18], anim: "point" }] },
      { name: "Pupil", char: "child", jobs: [{ at: [-10, 18], anim: "clap" }, { at: [-11, 17], anim: "kite" }] },
    ],
  },
  {
    key: "bathhouse",
    name: "the Bathhouse",
    hanzi: "澡堂",
    parts: [{ id: "steam", at: [8, 16] }],
    workers: [
      { name: "Bath Attendant", char: "villagerF", jobs: [{ at: [9, 18], anim: "pour" }, { at: [7, 18], anim: "carry" }] },
      { name: "Water-Heater", char: "villagerM", jobs: [{ at: [10, 15], anim: "chop" }, { at: [11, 17], anim: "carry" }] },
    ],
  },
  {
    key: "post",
    name: "the Post Station",
    hanzi: "驿站",
    parts: [
      { id: "cart", at: [20, 2] },
      { id: "haystack", at: [21, 5] },
    ],
    workers: [
      { name: "Post Rider", char: "soldier", jobs: [{ at: [19, 4], anim: "carry" }, { at: [22, 3], anim: "salute" }] },
      { name: "Ostler", char: "porter", jobs: [{ at: [22, 6], anim: "carry" }, { at: [20, 6], anim: "rummage" }] },
    ],
  },
  {
    key: "temple",
    name: "the Temple of the City God",
    hanzi: "城隍庙",
    parts: [
      { id: "stupa", at: [-14, 9] },
      { id: "censer", at: [-12, 11] },
    ],
    workers: [
      { name: "Temple Keeper", char: "novice", jobs: [{ at: [-12, 9], anim: "sweep" }, { at: [-11, 12], anim: "pray" }, { at: [-13, 12], anim: "chant" }] },
      { name: "Worshipper", char: "villagerF", jobs: [{ at: [-15, 12], anim: "kowtow" }, { at: [-14, 13], anim: "bow" }] },
    ],
  },
];

export const cityGodKey = (b: number) => `fd-citygod-${b}`;
export const facilityWorkerKey = (b: number, f: string, n: number) => `fd-fac-${b}-${f}-${n}`;
/** Where each capital's City God stands, in front of their temple (offset from the capital's centre). */
export const CITY_GOD_AT: [number, number] = [-12, 7];
