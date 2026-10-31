import type { AnimId, HumanId } from "../art/characters";
import type { PropId } from "../art/props";
import type { AreaId } from "./ids";

/**
 * The jianghu's other peoples (百族): six folk who are not human, or not only
 * human, each in a home of its own out in the wilds, with its own customs,
 * its own elder, its own trouble and its own tale. The Concord of a Hundred
 * Peoples, a pact older than the sects, once bound them and the human
 * jianghu together; its stone stands cracked at the crossroads below Willow
 * Creek, and its last envoy is looking for someone to carry its word again.
 *
 * Kept free of the story's words so the world builder can stand the homes
 * and their people without pulling in the tale (story/peoples.ts).
 */

export const PEOPLE_IDS = ["fox", "mer", "stone", "feather", "snow", "dragon"] as const;
export type PeopleId = (typeof PEOPLE_IDS)[number];

/** The rank and file of each people's trouble, met in the wilds round its home. */
export const PEOPLE_FOES = ["moonwisp", "reefpoacher", "sandhusk", "stormharpy", "rimeghoul", "cinderdrake"] as const;
export type PeopleFoeId = (typeof PEOPLE_FOES)[number];
/** Who waits at the end of each people's tale. */
export const PEOPLE_BOSSES = ["huyan", "chenyuan", "kuangyan", "liefeng", "kar", "aokuang"] as const;
export type PeopleBossId = (typeof PEOPLE_BOSSES)[number];

export interface PeopleFolk {
  char: HumanId;
  anim: AnimId;
  name: string;
}

export interface People {
  id: PeopleId;
  /** What the people call themselves, and what the jianghu calls them. */
  name: string;
  hanzi: string;
  /** Their home: its name, and its heart on the authoring grid. */
  home: string;
  homeHanzi: string;
  c: [number, number];
  /** The ground the home is levelled to, and what it is paved with. */
  ground: "grass" | "meadow" | "sand" | "redrock" | "snow" | "leaf" | "moss" | "dirt" | "plaza";
  level: number;
  /** The region whose sky and shrines the home shares. */
  region: AreaId;
  /** Their houses, and the thing at the heart of the home. */
  house: PropId;
  heart: PropId;
  /** What else stands about the home. */
  extras: PropId[];
  /** A second place of theirs nearby: its key, name, offset from the home and what stands there. */
  sight: { key: string; name: string; hanzi: string; at: [number, number]; props: PropId[] };
  /** The elder, the guide who walks the tale with her, and who the folk are. */
  elder: { name: string; char: HumanId };
  guide: { name: string; char: HumanId };
  folk: PeopleFolk[];
  /** Their custom, in a few words (the journal). */
  custom: string;
  foe: PeopleFoeId;
  boss: PeopleBossId;
  /** The way the road comes in from the nearest highway or branch (authoring grid, ending at the home). */
  road: [number, number][];
}

export const PEOPLES: People[] = [
  {
    id: "fox",
    name: "the Fox-Folk",
    hanzi: "狐族",
    home: "Moonfox Hollow",
    homeHanzi: "月狐谷",
    c: [380, 300],
    ground: "leaf",
    level: 1,
    region: "harbor",
    house: "foxden",
    heart: "moonaltar",
    extras: ["foxlantern", "foxlantern", "foxlantern", "maple"],
    sight: { key: "pe-fox-glade", name: "The Fox-Fire Glade", hanzi: "狐火林", at: [-16, 10], props: ["foxlantern", "foxlantern", "maple", "foxlantern"] },
    elder: { name: "Grandmother Su Yao", char: "foxelder" },
    guide: { name: "Bai Ling", char: "foxguide" },
    folk: [
      { char: "foxfolkM", anim: "lantern", name: "A Lamp-Keeper of the Hollow" },
      { char: "foxfolkF", anim: "moondance", name: "A Moon-Dancer" },
      { char: "foxfolkF", anim: "fan", name: "A Teller of Borrowed Tales" },
      { char: "foxfolkM", anim: "pray", name: "A Fox Praying to the Moon" },
      { char: "foxguide", anim: "moondance", name: "A Fox Cub at Her Lessons" },
      { char: "foxfolkF", anim: "pray", name: "A Keeper of Oaths" },
    ],
    custom: "every promise is kept to the letter, every debt is paid in stories, and the moon pearl hides the hollow from hunters",
    foe: "moonwisp",
    boss: "huyan",
    road: [
      [400, 318],
      [390, 309],
      [380, 300],
    ],
  },
  {
    id: "mer",
    name: "the Merfolk",
    hanzi: "鲛人",
    home: "Pearlsong Reef",
    homeHanzi: "珠歌礁",
    c: [612, 214],
    ground: "sand",
    level: 1,
    region: "harbor",
    house: "coralhouse",
    heart: "pearlclam",
    extras: ["kelp", "kelp", "kelp", "palm"],
    sight: { key: "pe-mer-rocks", name: "The Weeping Rocks", hanzi: "泣珠石", at: [-14, -12], props: ["kelp", "pearlclam", "rock", "kelp"] },
    elder: { name: "Tide-Mother Lan Xi", char: "merelder" },
    guide: { name: "Hai Yin", char: "merguide" },
    folk: [
      { char: "merfolkM", anim: "castnet", name: "A Merfolk Net-Caster" },
      { char: "merfolkF", anim: "flute", name: "A Singer of the Currents" },
      { char: "merfolkF", anim: "weep", name: "A Merfolk in Mourning" },
      { char: "merfolkM", anim: "fish", name: "A Merfolk Fisher" },
      { char: "merguide", anim: "offerpearl", name: "A Silk-Weaver" },
      { char: "merfolkM", anim: "weep", name: "A Merfolk Whose Brother Was Taken" },
    ],
    custom: "their tears fall as pearls, their sea-silk is never sold, only given, and their songs are maps of the currents",
    foe: "reefpoacher",
    boss: "chenyuan",
    road: [
      [590, 252],
      [601, 232],
      [612, 214],
    ],
  },
  {
    id: "stone",
    name: "the Stone-Born",
    hanzi: "石人",
    home: "Hollowstone Hold",
    homeHanzi: "空石堡",
    c: [300, 400],
    ground: "redrock",
    level: 1,
    region: "desert",
    house: "stonehut",
    heart: "menhir",
    extras: ["dreamstone", "dreamstone", "crystal", "karst"],
    sight: { key: "pe-stone-sleepers", name: "The Field of Sleepers", hanzi: "眠石原", at: [-16, -8], props: ["dreamstone", "dreamstone", "dreamstone", "menhir"] },
    elder: { name: "Old Granite Lei Gu", char: "stoneelder" },
    guide: { name: "Pebble", char: "stoneguide" },
    folk: [
      { char: "stonefolkM", anim: "carve", name: "A Carver of Memories" },
      { char: "stonefolkF", anim: "dig", name: "A Stone-Born Digging for Water" },
      { char: "stonefolkM", anim: "mine", name: "A Vein-Miner" },
      { char: "stonefolkF", anim: "carve", name: "A Keeper of the Long Sleep" },
      { char: "stoneguide", anim: "carve", name: "A Young Stone-Born, Still Soft" },
      { char: "stonefolkM", anim: "hammer", name: "A Mason of the Hold" },
    ],
    custom: "they live a thousand years and sleep for a hundred at a time, and every memory they keep is carved into their own skin",
    foe: "sandhusk",
    boss: "kuangyan",
    road: [
      [350, 404],
      [325, 402],
      [300, 400],
    ],
  },
  {
    id: "feather",
    name: "the Feathered Folk",
    hanzi: "羽民",
    home: "Skyfeather Eyrie",
    homeHanzi: "羽天巢",
    c: [160, 420],
    ground: "meadow",
    level: 2,
    region: "terraces",
    house: "eyrie",
    heart: "feathertotem",
    extras: ["windchime", "windchime", "pine", "cherry"],
    sight: { key: "pe-feather-leap", name: "The First Leap", hanzi: "初飞崖", at: [12, 12], props: ["windchime", "feathertotem", "pine"] },
    elder: { name: "Wind-Speaker Qing Yu", char: "featherelder" },
    guide: { name: "Fei Yan", char: "featherguide" },
    folk: [
      { char: "featherfolkM", anim: "glide", name: "A Messenger Back From the East" },
      { char: "featherfolkF", anim: "stargaze", name: "A Cloud-Reader" },
      { char: "featherfolkF", anim: "kite", name: "A Feathered Child With a Kite" },
      { char: "featherfolkM", anim: "kite", name: "A Wing-Teacher" },
      { char: "featherguide", anim: "glide", name: "A Fledgling Who Cannot Fly" },
      { char: "featherfolkF", anim: "flute", name: "A Wind-Piper" },
    ],
    custom: "every child must earn a flight feather before they are named, and the dead are given to the wind from the First Leap",
    foe: "stormharpy",
    boss: "liefeng",
    road: [
      [132, 396],
      [146, 410],
      [160, 420],
    ],
  },
  {
    id: "snow",
    name: "the Snow-Folk",
    hanzi: "雪民",
    home: "Rimehorn Lodge",
    homeHanzi: "霜角寨",
    c: [400, 95],
    ground: "snow",
    level: 3,
    region: "frost",
    house: "hornlodge",
    heart: "greathearth",
    extras: ["icecairn", "snowpine", "snowpine", "icecairn"],
    sight: { key: "pe-snow-cairns", name: "The Cairn Field", hanzi: "冰冢原", at: [14, -10], props: ["icecairn", "icecairn", "icecairn", "snowpine"] },
    elder: { name: "Hearth-Keeper Aru", char: "snowelder" },
    guide: { name: "Tuya", char: "snowguide" },
    folk: [
      { char: "snowfolkM", anim: "chop", name: "A Wood-Hauler" },
      { char: "snowfolkF", anim: "knot", name: "A Counter of Winters" },
      { char: "snowfolkF", anim: "warmhands", name: "A Herder Back From the Ice" },
      { char: "snowfolkM", anim: "carry", name: "An Ice-Ox Drover" },
      { char: "snowguide", anim: "hearthsong", name: "A Child Singing to the Hearth" },
      { char: "snowfolkM", anim: "knot", name: "A Keeper of the Cord" },
    ],
    custom: "a guest is sacred for three nights, the hearth has not gone out in nine hundred winters, and every winter is counted in knots",
    foe: "rimeghoul",
    boss: "kar",
    road: [
      [430, 150],
      [414, 122],
      [400, 95],
    ],
  },
  {
    id: "dragon",
    name: "the Dragon-Kin",
    hanzi: "龙裔",
    home: "Emberscale Hold",
    homeHanzi: "烬鳞城",
    c: [470, 420],
    ground: "plaza",
    level: 1,
    region: "desert",
    house: "dragonhall",
    heart: "scalebrazier",
    extras: ["scalebrazier", "scalebrazier", "karst", "boulder"],
    sight: { key: "pe-dragon-bones", name: "The Bone Arch", hanzi: "龙骨门", at: [-14, 12], props: ["dragonbones", "scalebrazier", "boulder"] },
    elder: { name: "Matriarch Ao Rong", char: "dragonelder" },
    guide: { name: "Ao Xun", char: "dragonguide" },
    folk: [
      { char: "dragonfolkM", anim: "hammer", name: "A Scale-Smith" },
      { char: "dragonfolkF", anim: "read", name: "A Keeper of the Hoard of Books" },
      { char: "dragonfolkM", anim: "firebreath", name: "A Dragon-Kin at Fire Practice" },
      { char: "dragonfolkF", anim: "sworddance", name: "A Hold-Guard at Her Forms" },
      { char: "dragonguide", anim: "read", name: "A Dragon-Kin Scholar" },
      { char: "dragonfolkF", anim: "hammer", name: "A Brazier-Tender" },
    ],
    custom: "they hoard knowledge, not gold; a shed scale given is a debt of fire, and the bones of the last great dragon are their temple",
    foe: "cinderdrake",
    boss: "aokuang",
    road: [
      [512, 372],
      [490, 396],
      [470, 420],
    ],
  },
];

export const PEOPLE_COUNT = PEOPLES.length;

/** Where the people of a home stand, as offsets from its heart (authoring grid). */
export const HOME_SPOTS = {
  elder: [0, 2] as [number, number],
  guide: [3, 3] as [number, number],
  boss: [0, -4] as [number, number],
  shrine: [-2, -2] as [number, number],
  sign: [2, -2] as [number, number],
  chest: [-8, 0] as [number, number],
  houses: [
    [-6, -6],
    [6, -6],
    [-6, 7],
    [7, 7],
  ] as [number, number][],
  folk: [
    [-5, 1],
    [5, -1],
    [-3, 5],
    [4, 6],
    [-6, -3],
    [6, 3],
  ] as [number, number][],
  extras: [
    [-3, -7],
    [3, -8],
    [9, 0],
    [0, 9],
  ] as [number, number][],
  /** The foes out in the wilds round the home. */
  foes: [
    [-12, 4],
    [12, -4],
    [2, 13],
  ] as [number, number][],
};
/** How far the home's levelled ground runs from its heart. */
export const HOME_R = 10;

/** The Concord of a Hundred Peoples' cracked stone, and its envoy beside it, by the crossroads teahouse (authoring grid). */
export const CONCORD_AT: [number, number] = [158, 175];
export const ENVOY_AT: [number, number] = [156, 176];

/** NPC keys. */
export const elderKey = (p: PeopleId) => `pe-${p}-elder`;
export const guideKey = (p: PeopleId) => `pe-${p}-guide`;
export const folkKey = (p: PeopleId, n: number) => `pe-${p}-folk-${n}`;
export const ENVOY_KEY = "pe-envoy";
export const homeKey = (p: PeopleId) => `pe-${p}`;
export const peopleOf = (id: PeopleId): People => PEOPLES.find((p) => p.id === id)!;
