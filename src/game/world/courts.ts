import { hash2 } from "../pixel/noise";
import type { AnimId, HumanId } from "../art/characters";
import type { CraftId } from "../engine/crafts";

/**
 * The six thrones of the mortal world, and the sects that stand beside them
 * (帝道百业, the Thrones and the Crafts).
 *
 * The jianghu's cultivators live above the clouds and in the wilds, but the
 * land between is ruled by mortals: six emperors and empresses, each on a
 * throne of their own, each with a capital, a court, guilds of craftsmen, and
 * a sect that has sworn to guard their realm in return for its tithe. That
 * oath is the Covenant of Cloud and Throne (云座之约): the sects do not rule
 * mortals, and mortals do not bind cultivators.
 *
 * Kept free of the story's words, so the world builder can raise the courts
 * and stand their people without pulling in the tale (story/courts.ts).
 */

export const COURT_COUNT = 6;

/** The rank and file each book's trouble sends against her, and who waits at the end of each book. */
export const COURT_FOES = ["grainthief", "breakerbow", "elixirfiend", "edictwraith", "arraygolem", "mandatebeast"] as const;
export type CourtFoeId = (typeof COURT_FOES)[number];
export const COURT_BOSSES = ["gouhoarder", "kuaitong", "xufu", "helian", "simaheng", "feilian"] as const;
export type CourtBossId = (typeof COURT_BOSSES)[number];

export interface CourtPerson {
  name: string;
  char: HumanId;
  anim?: AnimId;
}

export interface Court {
  key: string;
  /** The realm: its dynasty's name. */
  realm: string;
  hanzi: string;
  /** Its capital, where the throne stands. */
  capital: string;
  /** Centre of the capital's square on the authoring grid. */
  c: [number, number];
  emperor: CourtPerson;
  /** Who shows her round the court (and argues with the emperor when no one else dares). */
  guide: CourtPerson;
  /** The court's own: a minister, a palace steward, a guard captain and a maid. */
  folk: CourtPerson[];
  /** The sect sworn to guard the realm: its name, its seat (authoring grid) and its leader. */
  sect: { key: string; name: string; hanzi: string; c: [number, number]; leader: CourtPerson; disciples: CourtPerson[] };
  /** The art whose guild keeps its hall in the capital, and its master. */
  craft: CraftId;
  master: CourtPerson;
  foe: CourtFoeId;
  boss: CourtBossId;
  /** Its place to be seen. */
  sight: { key: string; name: string; hanzi: string };
}

export const COURTS: Court[] = [
  {
    key: "liang",
    realm: "Great Liang",
    hanzi: "大梁",
    capital: "Liangdu, the Granary Throne",
    c: [84, 500],
    emperor: { name: "Emperor Xuande of Great Liang", char: "emperorliang", anim: "enthrone" },
    guide: { name: "Granary Minister Tian Shou", char: "minister" },
    folk: [
      { name: "Palace Steward Gao", char: "eunuch", anim: "audience" },
      { name: "Captain Lü of the Golden Gate", char: "imperialguard", anim: "salute" },
      { name: "Maid Chunlan", char: "palacemaid", anim: "sweep" },
      { name: "Granary Clerk Wu", char: "scholar", anim: "write" },
    ],
    sect: {
      key: "goldcrane",
      name: "the Golden Crane Sect",
      hanzi: "金鹤宗",
      c: [60, 470],
      leader: { name: "Sect Master He Lingxiao", char: "goldcrane", anim: "meditate" },
      disciples: [
        { name: "Crane Disciple Yu", char: "discipleM", anim: "practice" },
        { name: "Crane Disciple Ning", char: "discipleF", anim: "taichi" },
      ],
    },
    craft: "farming",
    master: { name: "Old Field-Master Tian Lao", char: "farmer", anim: "sow" },
    foe: "grainthief",
    boss: "gouhoarder",
    sight: { key: "ct-liang", name: "the Granary Throne of Liangdu", hanzi: "粮都" },
  },
  {
    key: "chen",
    realm: "Southern Chen",
    hanzi: "南陈",
    capital: "Jinling-by-the-Tide",
    c: [500, 470],
    emperor: { name: "Empress Chen Yuhua of Southern Chen", char: "empresschen", anim: "enthrone" },
    guide: { name: "Lady Secretary Su Wan'er", char: "lady", anim: "fanning" },
    folk: [
      { name: "Palace Steward Lin", char: "eunuch", anim: "proclaim" },
      { name: "Captain Zhou of the Tide Gate", char: "imperialguard", anim: "spear" },
      { name: "Maid Qiuyue", char: "palacemaid", anim: "pour" },
      { name: "Admiral Fang", char: "general", anim: "look" },
    ],
    sect: {
      key: "tidebreaker",
      name: "the Tidebreaker Sect",
      hanzi: "破浪宗",
      c: [470, 500],
      leader: { name: "Sect Mistress Lan Ruoshui", char: "tidebreaker", anim: "sworddance" },
      disciples: [
        { name: "Tidebreaker Disciple Hai", char: "discipleM", anim: "practice" },
        { name: "Tidebreaker Disciple Bo", char: "discipleF", anim: "practice" },
      ],
    },
    craft: "refining",
    master: { name: "Forge-Master Ou Ye", char: "smith", anim: "hammer" },
    foe: "breakerbow",
    boss: "kuaitong",
    sight: { key: "ct-chen", name: "the Tide Throne of Jinling", hanzi: "金陵" },
  },
  {
    key: "shu",
    realm: "Western Shu",
    hanzi: "西蜀",
    capital: "Jincheng of the Brocade",
    c: [250, 420],
    emperor: { name: "Emperor Wenhe of Western Shu", char: "emperorshu", anim: "enthrone" },
    guide: { name: "Imperial Physician Sun Simiao", char: "physician", anim: "pulse" },
    folk: [
      { name: "Palace Steward He", char: "eunuch", anim: "audience" },
      { name: "Captain Ma of the Brocade Gate", char: "imperialguard", anim: "salute" },
      { name: "Maid Xiaoyu", char: "palacemaid", anim: "fanning" },
      { name: "Crown Prince Liu Chan", char: "nobleM", anim: "read" },
    ],
    sect: {
      key: "cauldron",
      name: "the Crimson Cauldron Sect",
      hanzi: "赤鼎宗",
      c: [270, 380],
      leader: { name: "Sect Master Dan Qiu", char: "cauldronmaster", anim: "grind" },
      disciples: [
        { name: "Cauldron Disciple Huo", char: "discipleM", anim: "fanfire" },
        { name: "Cauldron Disciple Yan", char: "discipleF", anim: "stir" },
      ],
    },
    craft: "alchemy",
    master: { name: "Mother Yao of the Pill Guild", char: "alchemist", anim: "grind" },
    foe: "elixirfiend",
    boss: "xufu",
    sight: { key: "ct-shu", name: "the Brocade Throne of Jincheng", hanzi: "锦城" },
  },
  {
    key: "wei",
    realm: "Northern Wei",
    hanzi: "北魏",
    capital: "Pingcheng under the Snows",
    c: [576, 140],
    emperor: { name: "Emperor Wei Lie of Northern Wei", char: "emperorwei", anim: "enthrone" },
    guide: { name: "Prince Wei Ming", char: "nobleM", anim: "think" },
    folk: [
      { name: "Palace Steward Qiu", char: "eunuch", anim: "proclaim" },
      { name: "Captain Bai of the Iron Gate", char: "imperialguard", anim: "march" },
      { name: "Maid Xue'er", char: "palacemaid", anim: "sweep" },
      { name: "Conscription Officer Dou", char: "minister", anim: "audience" },
    ],
    sect: {
      key: "talisman",
      name: "the Thousand Talisman Abbey",
      hanzi: "千符观",
      c: [524, 136],
      leader: { name: "Abbess Fu Yinzi", char: "talismanabbess", anim: "inscribe" },
      disciples: [
        { name: "Talisman Novice Zhu", char: "novice", anim: "inscribe" },
        { name: "Talisman Novice Hong", char: "discipleF", anim: "chant" },
      ],
    },
    craft: "talisman",
    master: { name: "Talisman-Brusher Huang Yi", char: "scholar", anim: "inscribe" },
    foe: "edictwraith",
    boss: "helian",
    sight: { key: "ct-wei", name: "the Iron Throne of Pingcheng", hanzi: "平城" },
  },
  {
    key: "qi",
    realm: "Eastern Qi",
    hanzi: "东齐",
    capital: "Linzi of the Maples",
    c: [470, 280],
    emperor: { name: "Emperor Qi Yuan of Eastern Qi", char: "emperorqi", anim: "enthrone" },
    guide: { name: "Nurse-Mother Wang", char: "villagerF", anim: "knead" },
    folk: [
      { name: "Palace Steward Cao", char: "eunuch", anim: "whisper" },
      { name: "Captain Tian of the Maple Gate", char: "imperialguard", anim: "look" },
      { name: "Maid Lianhua", char: "palacemaid", anim: "fanning" },
      { name: "Court Astronomer Gan", char: "scholar", anim: "stargaze" },
    ],
    sect: {
      key: "arrays",
      name: "the Sect of Myriad Arrays",
      hanzi: "万阵门",
      c: [500, 300],
      leader: { name: "Sect Master Zhen Wuji", char: "formationmaster", anim: "array" },
      disciples: [
        { name: "Array Disciple Kong", char: "discipleM", anim: "array" },
        { name: "Array Disciple Lu", char: "discipleF", anim: "read" },
      ],
    },
    craft: "formation",
    master: { name: "Array-Wright Gongshu", char: "scholar", anim: "array" },
    foe: "arraygolem",
    boss: "simaheng",
    sight: { key: "ct-qi", name: "the Maple Throne of Linzi", hanzi: "临淄" },
  },
  {
    key: "yan",
    realm: "Great Yan",
    hanzi: "大燕",
    capital: "Longcheng of the Sands",
    c: [548, 404],
    emperor: { name: "Emperor Murong Tuo of Great Yan", char: "emperoryan", anim: "enthrone" },
    guide: { name: "Princess Murong Xue", char: "nobleF", anim: "fanning" },
    folk: [
      { name: "Palace Steward Shi", char: "eunuch", anim: "audience" },
      { name: "Captain Duan of the Sand Gate", char: "imperialguard", anim: "spear" },
      { name: "Maid Ayi", char: "palacemaid", anim: "pour" },
      { name: "Camel-Master Batbayar", char: "nomad", anim: "tame" },
    ],
    sect: {
      key: "beasthall",
      name: "the Beast-Taming Hall",
      hanzi: "御兽堂",
      c: [560, 440],
      leader: { name: "Hall Master Shou Tianlang", char: "beastlord", anim: "tame" },
      disciples: [
        { name: "Beast-Hall Disciple Lang", char: "discipleM", anim: "tame" },
        { name: "Beast-Hall Disciple Ying", char: "discipleF", anim: "tame" },
      ],
    },
    craft: "taming",
    master: { name: "Tamer Ah Qiao", char: "tamer", anim: "tame" },
    foe: "mandatebeast",
    boss: "feilian",
    sight: { key: "ct-yan", name: "the Sand Throne of Longcheng", hanzi: "龙城" },
  },
];

/** The two arts with no court of their own: their masters keep a hall in the oldest capital and the nearest. */
export const WANDERING_CRAFTS: { craft: CraftId; master: CourtPerson; court: number; at: [number, number] }[] = [
  { craft: "healing", master: { name: "Physician Hua Tuo the Younger", char: "physician", anim: "pulse" }, court: 2, at: [-9, 8] },
  { craft: "cuisine", master: { name: "Imperial Chef Yi Ya", char: "cook", anim: "knead" }, court: 0, at: [9, 8] },
];

export const courtEmperorKey = (b: number) => `ct-${b}-emperor`;
export const courtGuideKey = (b: number) => `ct-${b}-guide`;
export const courtFolkKey = (b: number, n: number) => `ct-${b}-folk-${n}`;
export const courtLeaderKey = (b: number) => `ct-${b}-leader`;
export const courtDiscipleKey = (b: number, n: number) => `ct-${b}-disciple-${n}`;
export const courtMasterKey = (b: number) => `ct-${b}-master`;
export const craftMasterKey = (craft: CraftId) => `craftmaster:${craft}`;

/** Where each of a court's people stands about its square (authoring tiles from the centre), and its foes in the wilds about it. */
export const COURT_SPOTS = {
  emperor: [0, -4] as [number, number],
  guide: [3, -2] as [number, number],
  folk: [
    [-3, -2],
    [-4, 2],
    [4, 3],
    [-2, 5],
  ] as [number, number][],
  master: [7, 1] as [number, number],
  leader: [0, 0] as [number, number],
  disciples: [
    [-3, 2],
    [3, 2],
  ] as [number, number][],
  foes: [
    [-22, -10],
    [20, 14],
    [-16, 18],
  ] as [number, number][],
  boss: [0, -24] as [number, number],
  shrine: [-6, -6] as [number, number],
  sign: [3, 9] as [number, number],
  chest: [10, -6] as [number, number],
};

// ----------------------------------------------------------------------------- the mortals of the courts
/**
 * The trades of the mortal world: what the townsfolk of the six capitals and
 * the farms about them do for a living, the look each trade wears and the
 * thing each is seen doing.
 */
export const TRADES = [
  { id: "farmer", name: "Farmer", looks: ["farmer", "villagerM", "villagerF"], anim: "sow" },
  { id: "smith", name: "Smith", looks: ["smith"], anim: "hammer" },
  { id: "weaver", name: "Weaver", looks: ["weaver", "villagerF"], anim: "weave" },
  { id: "cook", name: "Cook", looks: ["cook", "villagerF"], anim: "knead" },
  { id: "porter", name: "Porter", looks: ["porter", "villagerM"], anim: "carry" },
  { id: "merchant", name: "Merchant", looks: ["merchant", "peddler"], anim: "abacus" },
  { id: "scribe", name: "Scribe", looks: ["scholar"], anim: "write" },
  { id: "herbseller", name: "Herb-Seller", looks: ["herbalist", "villagerF"], anim: "grind" },
  { id: "woodcutter", name: "Woodcutter", looks: ["woodcutter"], anim: "chop" },
  { id: "fisher", name: "Fisher", looks: ["fishwife", "villagerM"], anim: "fish" },
  { id: "guard", name: "Guard", looks: ["imperialguard", "soldier"], anim: "look" },
  { id: "maid", name: "Maid", looks: ["palacemaid"], anim: "sweep" },
  { id: "courtier", name: "Courtier", looks: ["minister", "nobleM", "nobleF", "eunuch"], anim: "audience" },
  { id: "child", name: "Child", looks: ["child", "boy"], anim: "kite" },
] as const satisfies readonly { id: string; name: string; looks: readonly HumanId[]; anim: AnimId }[];
export type TradeId = (typeof TRADES)[number]["id"];

/** How many townsfolk each capital and its farms hold. */
export const TOWNSFOLK_PER_COURT = 230;

export const townKey = (b: number, n: number) => `ct-${b}-town-${n}`;
export function parseTownKey(key: string): { book: number; n: number } | null {
  const m = /^ct-(\d)-town-(\d+)$/.exec(key);
  return m ? { book: Number(m[1]), n: Number(m[2]) } : null;
}

/** The trade of townsperson n of court b (the capitals lean to their own art: Liang to its fields, Chen to its forges, and so on). */
export function townTrade(b: number, n: number): (typeof TRADES)[number] {
  const lean: TradeId[] = [["farmer", "cook"], ["smith", "fisher"], ["herbseller", "weaver"], ["scribe", "guard"], ["scribe", "weaver"], ["porter", "merchant"]][b] as TradeId[];
  const r = hash2(b, n, 701);
  if (r < 0.3) return TRADES.find((t) => t.id === lean[Math.floor(hash2(b, n, 702) * lean.length)])!;
  return TRADES[Math.floor(hash2(n, b, 703) * TRADES.length)];
}

export function townLook(b: number, n: number): HumanId {
  const t = townTrade(b, n);
  return t.looks[Math.floor(hash2(b, n, 704) * t.looks.length)] as HumanId;
}

const SURNAMES = ["Zhang", "Wang", "Li", "Zhao", "Liu", "Chen", "Yang", "Huang", "Zhou", "Wu", "Xu", "Sun", "Hu", "Zhu", "Gao", "Lin", "He", "Guo", "Ma", "Luo", "Liang", "Song", "Zheng", "Xie", "Han", "Tang", "Feng", "Yu", "Dong", "Xiao"];
const GIVEN = ["Er", "San", "Si", "Wu", "Fu", "Gui", "Shun", "Cai", "Fang", "Hua", "Juan", "Ling", "Ming", "Ping", "Qiang", "Rui", "Xiu", "Yan", "Zhen", "Dong"];

/** What a townsperson is called: their trade and a name. */
export function townName(b: number, n: number): string {
  const t = townTrade(b, n);
  const sur = SURNAMES[Math.floor(hash2(b * 997 + n, 3, 705) * SURNAMES.length)];
  if (t.id === "child") return `Little ${GIVEN[Math.floor(hash2(b, n, 706) * GIVEN.length)]}`;
  return `${t.name} ${sur} ${GIVEN[Math.floor(hash2(b, n, 707) * GIVEN.length)]}`;
}

// ----------------------------------------------------------------------------- mortals and cultivators
/**
 * Who among the jianghu's people cultivates. Everyone else is a mortal, or
 * one of the peoples, beasts and spirits who are neither (fox-folk, merfolk,
 * ghosts and the like are counted on their own).
 */
const CULTIVATORS = new Set<HumanId>([
  "heroine",
  "elder",
  "qing",
  "abao",
  "discipleM",
  "discipleF",
  "outerM",
  "outerF",
  "novice",
  "monk",
  "abbot",
  "keeper",
  "taiji",
  "swordsea",
  "phoenix",
  "swordsman",
  "hermit",
  "marshwitch",
  "patriarch",
  "yanhuo",
  "baizhi",
  "lingfeng",
  "murong",
  "murongelder",
  "kongming",
  "tuoba",
  "hmwater",
  "hmwood",
  "hmwind",
  "hmfire",
  "hmearth",
  "hmmetal",
  "hmthunder",
  "hmice",
  "hmlife",
  "yanshu",
  "steward",
  "fanyu",
  "tieniu",
  "yaozhi",
  "shenbai",
  "ning",
  "wdherald",
  "tierwarden",
  "starregistrar",
  "sovereign",
  "champion",
  "justiciar",
  "inquisitor",
  "weigher",
  "loufeng",
  "seaabbess",
  "goldcrane",
  "tidebreaker",
  "cauldronmaster",
  "talismanabbess",
  "formationmaster",
  "beastlord",
  "hollowsage",
  // Fusang: the Synod's Seat-holders and Speaker, and the Seat of Wind it exiled
  "seatholder",
  "synodspeaker",
  "unfettered",
  // the Founding: her elders
  "fdelder0",
  "fdelder1",
  "fdelder2",
  "fdelder3",
  "fdelder4",
  "fdelder5",
]);
const SPIRITS = /^(fox|mer|stone|feather|snow|dragon)(folk|guide|elder|prince|king)|^(ghost|ghostclerk|soulguard|mengpo|yama|huli|blight|golem|furnacespirit|echo|foxusurper|stormlord|whitehunger|dragonlord)|^(jadeemperor|queenmother|earthgod|kitchengod|starlord|wealthgod|thunderlord|moonlady|citygod)$/;

export type Caste = "mortal" | "cultivator" | "spirit";
export function casteOf(char: string): Caste {
  if (CULTIVATORS.has(char as HumanId)) return "cultivator";
  if (SPIRITS.test(char)) return "spirit";
  return "mortal";
}
