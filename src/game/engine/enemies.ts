import type { CharId } from "../art/characters";
import type { HallBossId } from "../world/halls";
import type { TierBossId } from "../world/tiers";
import type { PeopleBossId, PeopleFoeId } from "../world/peoples";

export type EnemyId = "fox" | "wolf" | "serpent" | "serpentKing" | "cultist" | "jiangshi" | "bandit" | "swordsman" | "patriarch" | "emberwyrm" | "stonehound" | "poisoner" | "phoenixguard" | "traitor" | "elderMo" | DeepFoeId | HollowId | WarFoeId | WarBossId | EchoId | HallBossId | "wdspar" | TierBossId | "tjring" | PeopleFoeId | PeopleBossId;

/** What lives in the four deeps found since: the hollow under Frostveil, the tomb under the sands, the sea cave and the bamboo's roots. */
export type DeepFoeId = "frostfang" | "rimewyrm" | "dunewyrm" | "pearlwyrm" | "shadowvixen" | "smuggler";

/** The rank and file of the Iron Banner horde, from the first raids to its last stand. */
export const WAR_FOES = ["raider", "ironguard", "bannerman"] as const;
export type WarFoeId = (typeof WAR_FOES)[number];
/** The captain who holds each front of the war, one per campaign, ending with the Khan himself. */
export const WAR_BOSSES = ["borte", "qara", "jelme", "alaq", "toghril", "khulan", "sorqan", "hulagu", "ebugen", "tuoba"] as const;
export type WarBossId = (typeof WAR_BOSSES)[number];
export const isWarFoe = (id: EnemyId): id is WarFoeId | WarBossId => (WAR_FOES as readonly string[]).includes(id) || (WAR_BOSSES as readonly string[]).includes(id);

/**
 * The Founder's Road: the Hollow Echo that guards each stele Wei Kongming
 * has eaten (each one wears the Great Dao it was carved with, the way a coat
 * wears a man), and at the end of the Road the Dao-Eater himself.
 */
export const ECHO_BOSSES = ["echoWater", "echoWood", "echoWind", "echoFire", "echoEarth", "echoMetal", "echoThunder", "echoIce", "echoLife", "kongming"] as const;
export type EchoId = (typeof ECHO_BOSSES)[number];
export const isEcho = (id: EnemyId): id is EchoId => (ECHO_BOSSES as readonly string[]).includes(id);
/** The Great Dao each Echo wears. */
export const ECHO_DAO: Record<EchoId, "water" | "wood" | "wind" | "fire" | "earth" | "metal" | "thunder" | "ice" | "lifedeath" | "void"> = {
  echoWater: "water",
  echoWood: "wood",
  echoWind: "wind",
  echoFire: "fire",
  echoEarth: "earth",
  echoMetal: "metal",
  echoThunder: "thunder",
  echoIce: "ice",
  echoLife: "lifedeath",
  kongming: "void",
};
/** The hollowed cultivators who follow the Dao-Eater, weakest first. */
export const HOLLOWS = ["hollowshade", "hollowmonk", "hollowsage"] as const;
export type HollowId = (typeof HOLLOWS)[number];
export const isHollow = (id: EnemyId): id is HollowId => (HOLLOWS as readonly string[]).includes(id);

export interface EnemyDef {
  id: EnemyId;
  name: string;
  sprite: CharId;
  level: number;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  stones: number;
  /** Signature move used every `every` turns. */
  special: { name: string; power: number; every: number; drain?: number; colour: string };
  basic: string;
  boss?: boolean;
  /** A sparring partner: losing to them costs nothing. */
  friendly?: boolean;
  /** Opening line of the battle log (defaults to "A … bars your way!"). */
  intro?: string;
  /** Roaming speed on the map (tiles/s) and chase radius. */
  speed: number;
  aggro: number;
}

const BOSS_LOOK: [WarBossId, string, CharId, string, string, string][] = [
  ["borte", "Börte Ash-Hand", "warcaptain", "Firebrand Glaive", "Ash-Hand Inferno", "Börte Ash-Hand wipes soot from his glaive. “Your village burned well, girl.”"],
  ["qara", "Qara the Firebrand", "warcaptain", "Burning Saber", "Grove-Fire Sweep", "Qara laughs through the smoke of the burning grove."],
  ["jelme", "Jelme Red-Water", "warcaptain", "Hooked Glaive", "Red Tide Charge", "Jelme Red-Water stands knee-deep in the shallows, his glaive dripping."],
  ["alaq", "Alaq of the Drowned Road", "warcaptain", "Marsh Glaive", "Sinking Mire Strike", "Alaq rises out of the reeds, mud to the shoulders and grinning."],
  ["toghril", "Iron Marshal Toghril", "ironmarshal", "Siege Halberd", "Breaker of Terraces", "Iron Marshal Toghril raises his halberd. Behind him the trebuchets fall silent."],
  ["khulan", "Admiral Khulan", "ironmarshal", "Boarding Pike", "Black Sail Tempest", "Admiral Khulan steps off her flagship onto the quay, pike first."],
  ["sorqan", "Sorqan the Sand-King", "ironmarshal", "Dune Halberd", "Sandstorm Lance", "Sorqan's banner snaps in a wind full of sand."],
  ["hulagu", "Hulagu of the Frozen Pass", "ironmarshal", "Ice-Bitten Halberd", "Avalanche Charge", "Hulagu shakes the snow from his helm. The pass is his, he says."],
  ["ebugen", "Shaman Ebugen", "shaman", "Bone Staff", "Blood Banner Hex", "Ebugen's eyes burn red under the hood. The blood moon's old altars hum with him."],
  ["tuoba", "Tuoba Hong, the Iron Banner", "tuoba", "Khan's Saber", "Ten Thousand Wolves", "Tuoba Hong, Khan of the Iron Banner, walks out of the smoke alone. “Little cultivator. Shall we end the war, you and I?”"],
];

/** The war's captains: each stronger than the last, tuned to the realm the war expects of her at their front. */
const warBosses = Object.fromEntries(
  BOSS_LOOK.map(([id, name, sprite, basic, special, intro], c) => [
    id,
    {
      id,
      name,
      sprite,
      level: 3 + c * 2,
      hp: Math.round(240 + 190 * c + 18 * c * c),
      atk: Math.round(21 + 5.4 * c),
      def: Math.round(7 + 3 * c),
      exp: 220 + 320 * c,
      stones: 60 + 60 * c,
      basic,
      special: { name: special, power: 1.8, every: 3, drain: c >= 8 ? 0.25 : undefined, colour: c >= 8 ? "#ff3050" : "#ffb040" },
      boss: true,
      intro,
      speed: 0,
      aggro: 1.4,
    } satisfies EnemyDef,
  ]),
) as Record<WarBossId, EnemyDef>;

const ECHO_LOOK: [EchoId, string, CharId, number, string, string, string, string][] = [
  ["echoWater", "Echo of Still Water", "echoWater", 5, "Drowning Palm", "Tide That Forgets", "#6ab8f0", "Something stands on the water where the stele was. It has the shape of a woman and the stillness of a pond that has stopped remembering rain."],
  ["echoWood", "Echo of the Withered Grove", "echoWood", 6, "Splinter Lash", "Rot of Ten Thousand Roots", "#9ac070", "The bamboo round the stele creaks without wind. Something made of dry stems and borrowed green steps out of it."],
  ["echoWind", "Echo of the Stopped Wind", "echoWind", 8, "Still-Air Strike", "The Breath Withheld", "#c8f0e8", "The grass of the steppe lies flat and does not move. In the middle of the stillness a figure turns, and the air goes with it."],
  ["echoFire", "Echo of the Cold Flame", "echoFire", 9, "Grey Flame Palm", "Fire That Takes", "#a8a8a8", "Grey fire burns on the red rock without heat. Out of it walks a shape that has eaten every warmth it ever touched."],
  ["echoEarth", "Echo of the Hollow Mountain", "echoEarth", 11, "Landslide Fist", "The Mountain Gives Way", "#c8a060", "The scree of the Dragonspine slides uphill and stands up. It has a face like a rock that has forgotten what it was holding."],
  ["echoMetal", "Echo of the Blunted Edge", "echoMetal", 12, "Dull Blade", "Ten Thousand Rusted Swords", "#a8b0c0", "The Sword Tomb's blades turn their rust toward you all at once. One of them stands up, wearing the rest."],
  ["echoThunder", "Echo of the Silent Storm", "echoThunder", 14, "Soundless Bolt", "Heaven Without Anger", "#b8a4ff", "Lightning strikes the pagoda hill and makes no sound. The silence takes the shape of a man and steps down off the stone."],
  ["echoIce", "Echo of the Endless Winter", "echoIce", 15, "Rime Palm", "Winter That Never Thaws", "#bfe8ff", "Frost runs up the crag faster than water could fall. At the top it stands, a shape of ice that has decided never to melt."],
  ["echoLife", "Echo of the Unending", "echoLife", 17, "Withering Touch", "Neither Living Nor Dead", "#f6a6c9", "In Hundred Herb Valley the herbs bloom and rot in the same breath. Between them walks something that will not do either."],
  ["kongming", "Wei Kongming, the Dao-Eater", "kongming", 19, "Hollow Palm", "Swallow Heaven and Earth", "#e8e0ff", "Wei Kongming stands at the end of the causeway with the sea at his back. He looks tired. “Nine Daos I ate, and you took every one of them back from my Echoes. I am emptier than when I began. Teach me, then. Or let me eat you.”"],
];

/** The Road's guardians: tuned like the war's captains, to the realm the Road asks of her at each stele. */
const echoBosses = Object.fromEntries(
  ECHO_LOOK.map(([id, name, sprite, level, basic, special, colour, intro]) => {
    const c = (level - 3) / 2;
    return [
      id,
      {
        id,
        name,
        sprite,
        level,
        hp: Math.round(250 + 190 * c + 18 * c * c),
        atk: Math.round(21 + 5.4 * c),
        def: Math.round(7 + 3 * c),
        exp: Math.round(240 + 320 * c),
        stones: Math.round(70 + 60 * c),
        basic,
        special: { name: special, power: 1.8, every: 3, drain: c >= 6 ? 0.2 : undefined, colour },
        boss: true,
        intro,
        speed: 0,
        aggro: 1.4,
      } satisfies EnemyDef,
    ];
  }),
) as Record<EchoId, EnemyDef>;

/**
 * The Ten Halls: the trouble at the end of each hall's tale, from a young
 * master in the tournament ring to the Examiner at the door within the
 * Sealed Hall of the Void. Some are only bouts (losing to Murong Xiao, Feng
 * Qi or Jin Ge costs nothing); the rest are not.
 */
const HALL_LOOK: [HallBossId, string, CharId, number, string, string, string, boolean][] = [
  ["wdmurong", "Murong Xiao, Young Master", "murong", 3, "Northern Clan Palm", "Murong Falling Star", "#c8a0ff", true],
  ["wdblight", "Blight of the Thousand-Year Wisteria", "blight", 5, "Black Root Lash", "Thousand Thirsty Roots", "#7a9a4a", false],
  ["wdfengqi", "Hall Master Feng Qi", "hmwind", 6, "Gust Palm", "The Wind Has No Shadow", "#c8f0e8", true],
  ["wdfurnace", "The Weeping Furnace Spirit", "furnacespirit", 8, "Grey Ember Fist", "The Furnace Breathes In", "#a8a8a8", false],
  ["wdwarden", "Warden of the Deep Tunnels", "golem", 9, "Landslide Arm", "The Tunnels Close", "#c8a060", false],
  ["wdjinge", "Hall Master Jin Ge", "hmmetal", 11, "Half-Width Blade", "The Edge Agreed To", "#d8e0f0", true],
  ["wdkui", "Enforcer Captain Kui", "enforcer", 12, "Chain-Whip", "Stolen Lightning", "#b8a4ff", false],
  ["wdfrost", "Frost Warden of the Library", "frostwarden", 14, "Rime Palm", "The Ice Decides", "#bfe8ff", false],
  ["wdhong", "Murong Hong", "murongelder", 15, "Twenty Breaths Palm", "Exhale of the Sleepers", "#f6a6c9", false],
  ["wdyanshu", "Yan Shu, the Examiner", "yanshu", 18, "Brush of the Seal", "Everyone the Seal Says Goes Home", "#e8e0ff", false],
];

/** The halls' troubles: tuned like the Road's Echoes, to the realm each hall asks of her. */
const hallBosses = Object.fromEntries(
  HALL_LOOK.map(([id, name, sprite, level, basic, special, colour, friendly]) => {
    const c = (level - 3) / 2;
    return [
      id,
      {
        id,
        name,
        sprite,
        level,
        hp: Math.round(240 + 185 * c + 17 * c * c),
        atk: Math.round(20 + 5.2 * c),
        def: Math.round(7 + 3 * c),
        exp: Math.round(230 + 300 * c),
        stones: Math.round(60 + 55 * c),
        basic,
        special: { name: special, power: 1.8, every: 3, drain: c >= 6 ? 0.2 : undefined, colour },
        boss: true,
        ...(friendly && { friendly: true }),
        speed: 0,
        aggro: 1.4,
      } satisfies EnemyDef,
    ];
  }),
) as Record<HallBossId, EnemyDef>;

/**
 * The City of Nine Tiers: the trouble at the top of each tier's tale, from
 * the overseer who whips the Mud Tier's porters to the Sovereign of the Stair
 * on Heaven's Step. Lei Ba's challenge is a bout under the Stair Code (losing
 * it costs nothing); the rest are not.
 */
const TIER_LOOK: [TierBossId, string, CharId, number, string, string, string, boolean][] = [
  ["tjkuang", "Overseer Kuang, Warden of the Mud Tier", "overseer", 3, "Porter's Lash", "Weighed and Found Light", "#c8a060", false],
  ["tjtong", "Guildmaster Tong, the Debt-Smith", "debtsmith", 5, "Collector's Hammer", "Interest Compounds", "#e8a060", false],
  ["tjsima", "Inquisitor Sima of the Tablets", "inquisitor", 7, "Seal of Rejection", "Forgery Revealed", "#d8dce8", false],
  ["tjqiao", "Madam Qiao of the Red Thread", "matchmaker", 9, "Binding Thread", "Ten Thousand Red Threads", "#ff6a7a", false],
  ["tjleiba", "Lei Ba, Champion of the Golden Tier", "champion", 11, "Clan Saber", "Challenge Accepted", "#f2c55c", true],
  ["tjyan", "Justiciar Yan Heng", "justiciar", 13, "Gavel of Rank", "The Lower Word Weighs Nothing", "#b88ae8", false],
  ["tjmei", "Elder Mei Shou, Eater of Years", "yearelder", 15, "Withering Touch", "A Thousand Borrowed Springs", "#9ff5de", false],
  ["tjqu", "Star-Registrar Qu Xing", "starregistrar", 17, "Fated Star", "Your Chart Is Written", "#c8d0ff", false],
  ["tjloufeng", "Lou Feng, Captain of the Ninth Gate", "loufeng", 18, "Severing Spear", "Nothing Behind Me", "#e8e0ff", false],
  ["tjgao", "Gao Qiong, Sovereign of the Stair", "sovereign", 19, "Edict of Heaven's Stair", "The Ascent of the Nine Tiers", "#fff0a0", false],
];

/** The tiers' troubles: tuned like the halls', to the realm each tier asks of her. */
const tierBosses = Object.fromEntries(
  TIER_LOOK.map(([id, name, sprite, level, basic, special, colour, friendly]) => {
    const c = (level - 3) / 2;
    return [
      id,
      {
        id,
        name,
        sprite,
        level,
        hp: Math.round(250 + 190 * c + 18 * c * c),
        atk: Math.round(21 + 5.3 * c),
        def: Math.round(7 + 3.1 * c),
        exp: Math.round(240 + 310 * c),
        stones: Math.round(70 + 60 * c),
        basic,
        special: { name: special, power: 1.8, every: 3, drain: c >= 5 ? 0.2 : undefined, colour },
        boss: true,
        ...(friendly && { friendly: true }),
        speed: 0,
        aggro: 1.4,
      } satisfies EnemyDef,
    ];
  }),
) as Record<TierBossId, EnemyDef>;

/**
 * The peoples' troubles (see world/peoples.ts): the rank and file met in the
 * wilds round each home, and who waits at the end of each people's tale,
 * tuned to the realm each people's tale asks of her.
 */
const PEOPLE_FOE_LOOK: [PeopleFoeId, string, CharId, number, string, string, string, string][] = [
  ["moonwisp", "Moon-Eaten Fox", "fox", 3, "Hungry Bite", "Stolen Moonlight", "#c8d8ff", "A fox with moonlight dripping from its jaws, eyes empty, comes at you out of the maples."],
  ["reefpoacher", "Pearl Poacher", "bandit", 6, "Hooked Gaff", "Net of Tears", "#8ad8e8", "A pearl poacher with a net over his shoulder and a jar of someone's tears at his belt draws a gaff."],
  ["sandhusk", "Sand Husk", "golem", 9, "Crumbling Fist", "Dead Sand", "#d8b860", "What was a stone-born, emptied to sand inside, lurches up from the dunes."],
  ["stormharpy", "Storm Harpy", "bat", 12, "Raking Talons", "Thunder Dive", "#c8e0ff", "A storm harpy shrieks down out of a black cloud that was not there a moment ago."],
  ["rimeghoul", "Rime-Hungry", "frostfang", 15, "Frozen Maw", "The Long Night", "#a8e0ff", "A wolf of white hunger, ribs showing through the frost, circles once and lunges."],
  ["cinderdrake", "Cinder Drake", "emberwyrm", 18, "Ash Bite", "Unbound Flame", "#ff9040", "A cinder drake uncoils out of a crack in the red earth, burning."],
];
const PEOPLE_BOSS_LOOK: [PeopleBossId, string, CharId, number, string, string, string][] = [
  ["huyan", "Hu Yan, the Moon-Eater", "foxusurper", 4, "Foxfire Fan", "Swallow the Moon", "#c8b0ff"],
  ["chenyuan", "Chen Yuan, the Drowned Prince", "merprince", 7, "Coral Trident", "Tide of Grief", "#5af0e0"],
  ["kuangyan", "Kuang Yan, the Hollow King", "stoneking", 10, "Avalanche Fist", "Empty the Vein", "#ff9040"],
  ["liefeng", "Lie Feng, Lord of the Storm", "stormlord", 13, "Lightning Spear", "The Sky Is Mine", "#e8e0ff"],
  ["kar", "Kar, the White Hunger", "whitehunger", 16, "Frostbitten Staff", "Eat the Hearth", "#a8e0ff"],
  ["aokuang", "Ao Kuang the Unbound", "dragonlord", 19, "Scale Saber", "Wake the Bones", "#ffb040"],
];
const peopleFoes = Object.fromEntries(
  PEOPLE_FOE_LOOK.map(([id, name, sprite, level, basic, special, colour, intro]) => {
    const c = (level - 3) / 3;
    return [id, { id, name, sprite, level, hp: Math.round(150 + 95 * c + 8 * c * c), atk: Math.round(22 + 6 * c), def: Math.round(7 + 3 * c), exp: Math.round(60 + 70 * c), stones: Math.round(12 + 8 * c), basic, special: { name: special, power: 1.6, every: 3, colour }, intro, speed: 1.2, aggro: 3 } satisfies EnemyDef];
  }),
) as Record<PeopleFoeId, EnemyDef>;
const peopleBosses = Object.fromEntries(
  PEOPLE_BOSS_LOOK.map(([id, name, sprite, level, basic, special, colour]) => {
    const c = (level - 3) / 2;
    return [id, { id, name, sprite, level, hp: Math.round(270 + 200 * c + 18 * c * c), atk: Math.round(22 + 5.4 * c), def: Math.round(7 + 3.2 * c), exp: Math.round(260 + 320 * c), stones: Math.round(80 + 60 * c), basic, special: { name: special, power: 1.8, every: 3, drain: c >= 5 ? 0.2 : undefined, colour }, boss: true, speed: 0, aggro: 1.4 } satisfies EnemyDef];
  }),
) as Record<PeopleBossId, EnemyDef>;

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  ...peopleFoes,
  ...peopleBosses,
  ...tierBosses,
  tjring: {
    id: "tjring",
    name: "Stair Ring Challenger",
    sprite: "nobleM",
    level: 4,
    hp: 140,
    atk: 20,
    def: 7,
    exp: 45,
    stones: 0,
    friendly: true,
    basic: "Challenger's Palm",
    special: { name: "Climb the Stair", power: 1.5, every: 3, colour: "#f2c55c" },
    intro: "A challenger of the Stair Ring cups fist in palm. “Under the Stair Code, I challenge you. Win, and my tier is yours to walk; lose, and you owe me a bow.”",
    speed: 0,
    aggro: 0,
  },
  ...warBosses,
  ...echoBosses,
  ...hallBosses,
  wdspar: {
    id: "wdspar",
    name: "Sparring Disciple",
    sprite: "outerM",
    level: 3,
    hp: 120,
    atk: 18,
    def: 6,
    exp: 40,
    stones: 0,
    friendly: true,
    basic: "Outer Court Palm",
    special: { name: "First-Year Flurry", power: 1.5, every: 3, colour: "#9ff5de" },
    intro: "A sparring disciple of the Ten Halls bows, cups fist in palm, and comes at you grinning.",
    speed: 0,
    aggro: 0,
  },
  hollowshade: {
    id: "hollowshade",
    name: "Hollow Shade",
    sprite: "hollow",
    level: 4,
    hp: 150,
    atk: 24,
    def: 8,
    exp: 55,
    stones: 14,
    basic: "Empty Palm",
    special: { name: "Eaten Breath", power: 1.6, every: 3, drain: 0.1, colour: "#c8c0e0" },
    intro: "A hollow shade drifts out from behind the broken stele, its face an empty bowl.",
    speed: 1.2,
    aggro: 3,
  },
  hollowmonk: {
    id: "hollowmonk",
    name: "Hollow Ascetic",
    sprite: "hollow",
    level: 10,
    hp: 380,
    atk: 42,
    def: 17,
    exp: 140,
    stones: 28,
    basic: "Begging-Bowl Strike",
    special: { name: "Emptiness Sutra", power: 1.7, every: 3, drain: 0.15, colour: "#d8d0f0" },
    intro: "A hollow ascetic sits up from the dust, a begging bowl in its hands with nothing at the bottom.",
    speed: 1.3,
    aggro: 3,
  },
  hollowsage: {
    id: "hollowsage",
    name: "Hollow Sage",
    sprite: "hollowsage",
    level: 15,
    hp: 640,
    atk: 60,
    def: 25,
    exp: 260,
    stones: 44,
    basic: "Unwritten Word",
    special: { name: "Eat the Meaning", power: 1.8, every: 3, drain: 0.2, colour: "#e8e0ff" },
    intro: "A hollow sage unrolls a scroll with nothing on it, and reads you aloud.",
    speed: 1.5,
    aggro: 3.2,
  },
  raider: {
    id: "raider",
    name: "Iron Wolf Raider",
    sprite: "raider",
    level: 2,
    hp: 90,
    atk: 17,
    def: 4,
    exp: 30,
    stones: 10,
    basic: "Hooked Spear",
    special: { name: "Wolf-Pack Charge", power: 1.6, every: 3, colour: "#d8c8a0" },
    intro: "An Iron Wolf raider levels his spear and howls for his pack.",
    speed: 1.6,
    aggro: 3.2,
  },
  ironguard: {
    id: "ironguard",
    name: "Iron Banner Guard",
    sprite: "ironguard",
    level: 7,
    hp: 260,
    atk: 34,
    def: 13,
    exp: 90,
    stones: 22,
    basic: "Iron Saber",
    special: { name: "Iron Wall Crush", power: 1.7, every: 3, colour: "#a8b0c8" },
    intro: "An Iron Banner guard locks his shield and comes on step by step.",
    speed: 1.3,
    aggro: 3,
  },
  bannerman: {
    id: "bannerman",
    name: "Black Banner Reaver",
    sprite: "bannerman",
    level: 13,
    hp: 520,
    atk: 54,
    def: 22,
    exp: 200,
    stones: 40,
    basic: "Black Spear",
    special: { name: "Demon-Core Fury", power: 1.75, every: 3, drain: 0.15, colour: "#ff7a2a" },
    intro: "The Black Banner reaver's eyes burn with a swallowed demon core.",
    speed: 1.7,
    aggro: 3.4,
  },
  fox: {
    id: "fox",
    name: "Fox Spirit",
    sprite: "fox",
    level: 1,
    hp: 60,
    atk: 14,
    def: 3,
    exp: 18,
    stones: 5,
    basic: "Fox Claw",
    special: { name: "Azure Foxfire", power: 1.6, every: 3, colour: "#7fd8ff" },
    speed: 1.6,
    aggro: 3,
  },
  wolf: {
    id: "wolf",
    name: "Shadowflame Wolf",
    sprite: "wolf",
    level: 3,
    hp: 110,
    atk: 21,
    def: 6,
    exp: 34,
    stones: 9,
    basic: "Rending Bite",
    special: { name: "Shadowflame Fang", power: 1.7, every: 3, colour: "#a46cff" },
    speed: 2,
    aggro: 3.5,
  },
  serpent: {
    id: "serpent",
    name: "Jade Serpent",
    sprite: "serpent",
    level: 5,
    hp: 180,
    atk: 28,
    def: 9,
    exp: 60,
    stones: 14,
    basic: "Tail Lash",
    special: { name: "Jade Venom Coil", power: 1.6, every: 3, drain: 0.3, colour: "#3fd0a0" },
    speed: 1.2,
    aggro: 2.5,
  },
  serpentKing: {
    id: "serpentKing",
    name: "Serpent King",
    sprite: "serpentKing",
    level: 7,
    hp: 260,
    atk: 22,
    def: 8,
    exp: 220,
    stones: 60,
    basic: "Crushing Coil",
    special: { name: "Moon Tide Breath", power: 1.8, every: 3, drain: 0.25, colour: "#7af0ff" },
    boss: true,
    speed: 0,
    aggro: 1.2,
  },
  cultist: {
    id: "cultist",
    name: "Blood Moon Cultist",
    sprite: "cultist",
    level: 8,
    hp: 240,
    atk: 40,
    def: 14,
    exp: 95,
    stones: 24,
    basic: "Blood Saber",
    special: { name: "Crimson Hex", power: 1.7, every: 3, drain: 0.2, colour: "#ff3050" },
    speed: 1.4,
    aggro: 3,
  },
  jiangshi: {
    id: "jiangshi",
    name: "Jiangshi",
    sprite: "jiangshi",
    level: 8,
    hp: 270,
    atk: 38,
    def: 16,
    exp: 100,
    stones: 22,
    basic: "Corpse Claw",
    special: { name: "Yin Corpse Qi", power: 1.7, every: 3, colour: "#8aff9a" },
    speed: 1.1,
    aggro: 2.5,
  },
  bandit: {
    id: "bandit",
    name: "Mountain Bandit",
    sprite: "bandit",
    level: 4,
    hp: 150,
    atk: 25,
    def: 7,
    exp: 48,
    stones: 30,
    basic: "Rusty Saber",
    special: { name: "Dirty Trick", power: 1.6, every: 3, colour: "#d8b060" },
    speed: 1.7,
    aggro: 3.2,
  },
  swordsman: {
    id: "swordsman",
    name: "Xiao Han",
    sprite: "swordsman",
    level: 6,
    hp: 320,
    atk: 30,
    def: 10,
    exp: 160,
    stones: 0,
    friendly: true,
    basic: "Drifting Cloud Cut",
    intro: "Xiao Han draws his blade with a grin. “Don't hold back!”",
    special: { name: "Lone Star Thrust", power: 1.9, every: 3, colour: "#ff6a8a" },
    speed: 0,
    aggro: 0,
  },
  patriarch: {
    id: "patriarch",
    name: "Patriarch Xue",
    sprite: "patriarch",
    level: 14,
    hp: 900,
    atk: 48,
    def: 20,
    exp: 1500,
    stones: 300,
    basic: "Blood Saber",
    special: { name: "Blood Moon Slash", power: 1.8, every: 3, drain: 0.5, colour: "#ff2040" },
    boss: true,
    speed: 0,
    aggro: 1.5,
  },
  emberwyrm: {
    id: "emberwyrm",
    name: "Ember Wyrm",
    sprite: "emberwyrm",
    level: 9,
    hp: 520,
    atk: 36,
    def: 14,
    exp: 420,
    stones: 90,
    basic: "Molten Coil",
    special: { name: "Vein-Fire Breath", power: 1.8, every: 3, colour: "#ff8a3a" },
    boss: true,
    intro: "The rock splits and the Ember Wyrm pours out of the burning vein!",
    speed: 0,
    aggro: 1.2,
  },
  stonehound: {
    id: "stonehound",
    name: "Stone Hound",
    sprite: "stonehound",
    level: 10,
    hp: 330,
    atk: 42,
    def: 20,
    exp: 130,
    stones: 26,
    basic: "Granite Bite",
    special: { name: "Jade Crack Howl", power: 1.6, every: 3, colour: "#9ff5de" },
    speed: 1.6,
    aggro: 3,
  },
  frostfang: {
    id: "frostfang",
    name: "Frostfang Wolf",
    sprite: "frostfang",
    level: 9,
    hp: 300,
    atk: 40,
    def: 17,
    exp: 120,
    stones: 22,
    basic: "Ice-Rimed Bite",
    special: { name: "Glacier Howl", power: 1.6, every: 3, colour: "#8ad0ff" },
    speed: 2.2,
    aggro: 3.5,
  },
  smuggler: {
    id: "smuggler",
    name: "Pearl Smuggler",
    sprite: "bandit",
    level: 6,
    hp: 190,
    atk: 28,
    def: 10,
    exp: 70,
    stones: 18,
    basic: "Gutting Knife",
    special: { name: "Net and Hook", power: 1.6, every: 3, colour: "#c8b080" },
    intro: "A pearl smuggler comes at you out of the dark, knife first!",
    speed: 1.8,
    aggro: 3,
  },
  rimewyrm: {
    id: "rimewyrm",
    name: "Rime Wyrm",
    sprite: "rimewyrm",
    level: 12,
    hp: 760,
    atk: 44,
    def: 22,
    exp: 680,
    stones: 120,
    basic: "Frozen Coil",
    special: { name: "Breath of the Long Winter", power: 1.8, every: 3, colour: "#c8f0ff" },
    boss: true,
    intro: "The ice of the lake cracks from below, and the Rime Wyrm uncoils from round the first abbot's bones!",
    speed: 0,
    aggro: 1.2,
  },
  dunewyrm: {
    id: "dunewyrm",
    name: "Dune Wyrm",
    sprite: "dunewyrm",
    level: 11,
    hp: 680,
    atk: 42,
    def: 20,
    exp: 560,
    stones: 110,
    basic: "Sand-Scour Coil",
    special: { name: "Buried Queen's Wrath", power: 1.8, every: 3, colour: "#ffd070" },
    boss: true,
    intro: "Sand pours from the ceiling like water, and the Dune Wyrm rises out of it before the queen's coffin!",
    speed: 0,
    aggro: 1.2,
  },
  pearlwyrm: {
    id: "pearlwyrm",
    name: "Pearl Serpent",
    sprite: "pearlwyrm",
    level: 8,
    hp: 440,
    atk: 33,
    def: 13,
    exp: 360,
    stones: 80,
    basic: "Undertow Lash",
    special: { name: "Tide-Pearl Glare", power: 1.7, every: 3, colour: "#f8c8e8" },
    boss: true,
    intro: "The pool heaves, and the Pearl Serpent rears out of it, a pearl the size of a fist glowing in its jaws!",
    speed: 0,
    aggro: 1.2,
  },
  shadowvixen: {
    id: "shadowvixen",
    name: "Shadow Vixen",
    sprite: "shadowvixen",
    level: 13,
    hp: 820,
    atk: 46,
    def: 19,
    exp: 900,
    stones: 140,
    basic: "Soot-Black Claw",
    special: { name: "Five-Tailed Blood Moon", power: 1.8, every: 3, drain: 0.4, colour: "#ff2a40" },
    boss: true,
    intro: "Five black tails fan out in the dark, and the Shadow Vixen's eyes kindle red as a blood moon!",
    speed: 0,
    aggro: 1.2,
  },
  poisoner: {
    id: "poisoner",
    name: "Ku Shen",
    sprite: "poisoner",
    level: 9,
    hp: 420,
    atk: 38,
    def: 15,
    exp: 300,
    stones: 60,
    basic: "Bitter Needle",
    special: { name: "Withering Mist", power: 1.7, every: 3, drain: 0.3, colour: "#8aff6a" },
    boss: true,
    intro: "Ku Shen snaps his fan open. Green mist curls off its edge.",
    speed: 0,
    aggro: 0,
  },
  phoenixguard: {
    id: "phoenixguard",
    name: "Disciple Zhu Que",
    sprite: "phoenix",
    level: 6,
    hp: 280,
    atk: 28,
    def: 10,
    exp: 120,
    stones: 0,
    friendly: true,
    basic: "Ember Saber",
    intro: "Zhu Que raises a hand wreathed in fire. “The Mistress said to test you. Gladly!”",
    special: { name: "Phoenix Palm", power: 1.8, every: 3, colour: "#ff7040" },
    speed: 0,
    aggro: 0,
  },
  traitor: {
    id: "traitor",
    name: "Fallen Jian Wuyou",
    sprite: "swordsea",
    level: 11,
    hp: 480,
    atk: 44,
    def: 18,
    exp: 360,
    stones: 140,
    basic: "Stolen Sword Form",
    special: { name: "Ten Thousand Swords, Reversed", power: 1.8, every: 3, drain: 0.2, colour: "#c8d8ff" },
    intro: "Jian Wuyou, a Blood Moon crescent stitched over his heart, will not meet your eyes.",
    speed: 1.2,
    aggro: 3,
  },
  elderMo: {
    id: "elderMo",
    name: "Elder Mo",
    sprite: "elder",
    level: 16,
    hp: 1100,
    atk: 50,
    def: 22,
    exp: 900,
    stones: 0,
    basic: "Cloud-Sleeve Palm",
    special: { name: "Azure Heaven Sword Array", power: 1.9, every: 3, colour: "#9ff5de" },
    boss: true,
    intro: "Elder Mo lifts his whisk. The Hall of Clouds goes very quiet. “Come, then. I taught you everything but this.”",
    speed: 0,
    aggro: 0,
  },
};
