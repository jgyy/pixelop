import { cultivationNeeded } from "../engine/realms";
import { gainCultivation, type GameState } from "../engine/state";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import type { HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import { SEASON_INFO, type Season } from "../world/calendar";
import type { AreaId } from "../world/ids";
import type { Step } from "./script";
import { giveAttire } from "./wardrobe";

/**
 * Notices of the jianghu: a thousand small favours the folk ask of Lin Yue.
 * Every one of them is composed, the same way every time, from who asks,
 * where they live, what they want and the roads and beasts between — so no
 * notice is stored anywhere but as a bit in the save once it is done.
 *
 * Each of the folk keeps a short list of their own (about a dozen each) and
 * offers the first one she can reach; she may carry three at once. They are
 * fulfilled where they happen: a beast beaten in the right land, a parcel
 * handed to the right person, a landmark reached (after dark, on Cloudmane,
 * on the sword, or in the right season), a stillness held at a shrine.
 *
 * Saves: completed notices are bits in counters `bq:0`…`bq:33` (30 per
 * counter); the three notices she carries are `bqa:<slot>` (id + 1) with
 * their progress in `bqp:<slot>`; `bounties` counts the total done.
 */

export const BOUNTY_COUNT = 1000;
export const BOUNTY_SLOTS = 3;

export type BountyKind = "hunt" | "deliver" | "visit" | "night" | "meditate" | "ride" | "fly" | "season";

export interface Bounty {
  id: number;
  /** The NPC who asks (an NPC key in the open world). */
  giver: string;
  kind: BountyKind;
  title: string;
  /** What the giver says when asking. */
  ask: string;
  /** The journal line. */
  objective: string;
  /** What is said (or narrated) when it is done. */
  done: string;
  /** Every region the notice takes her to (it is only offered once they are all open). */
  regions: AreaId[];
  count: number;
  foe?: EnemyId;
  /** Deliveries: who receives it. */
  to?: string;
  item?: string;
  landmark?: string;
  season?: Season;
  region?: AreaId;
  /** What she does when she gets there. */
  anim?: "pray" | "read" | "look" | "write" | "bow" | "salute" | "flute" | "sworddance";
  reward: { stones: number; cult: number; pills: number };
}

// ----------------------------------------------------------------------------- the folk
interface Folk {
  key: string;
  name: string;
  char: HumanId;
  region: AreaId;
}

const F = (key: string, name: string, char: HumanId, region: AreaId): Folk => ({ key, name, char, region });

/** Everyone in the open world who is always there to ask a favour (or receive one). */
export const FOLK: Folk[] = [
  F("elder", "Elder Mo", "elder", "sect"),
  F("qing", "Senior Sister Qing", "qing", "sect"),
  F("abao", "Ah Bao", "abao", "sect"),
  F("feng", "Disciple Feng", "discipleM", "sect"),
  F("lan", "Disciple Lan", "discipleF", "sect"),
  F("guo", "Disciple Guo", "discipleM", "sect"),
  F("ning", "Disciple Ning", "discipleF", "sect"),
  F("yun", "Master Yun", "hermit", "sect"),
  F("pang", "Cook Pang", "cook", "sect"),
  F("chen", "Disciple Chen", "discipleM", "sect"),
  F("xiu", "Disciple Xiu", "discipleF", "sect"),
  F("qiu", "Elder Qiu", "taiji", "sect"),
  F("wei", "Disciple Wei", "discipleM", "sect"),
  F("rou", "Disciple Rou", "discipleF", "sect"),
  F("jian", "Disciple Jian", "discipleM", "sect"),
  F("su2", "Disciple Su", "discipleF", "sect"),
  F("zhou", "Village Head Zhou", "zhou", "village"),
  F("hua", "Granny Hua", "hua", "village"),
  F("liu", "Farmer Liu", "farmer", "village"),
  F("mei", "Little Mei", "child", "village"),
  F("shunpal", "Little Hu", "boy", "village"),
  F("chun", "Auntie Chun", "villagerF", "village"),
  F("dikehoe", "Farmer Liu Er", "farmer", "village"),
  F("yu", "Old Yu", "villagerM", "village"),
  F("marketporter", "Porter Kang", "porter", "village"),
  F("ba", "Woodcutter Ba", "woodcutter", "village"),
  F("shun", "Little Shun", "boy", "village"),
  F("lianhua", "Lianhua", "villagerF", "village"),
  F("hawker", "Hawker Sun", "villagerM", "village"),
  F("willowguard", "Watchman Tie", "guard", "village"),
  F("noodleseller", "Noodle Seller Ma", "cook", "village"),
  F("almanac", "Almanac Master Shi", "almanac", "village"),
  F("fang", "Auntie Fang", "teawoman", "bamboo"),
  F("ou", "Smith Ou", "smith", "bamboo"),
  F("wen", "Old Fisher Wen", "wen", "lake"),
  F("tang", "Miller Tang", "miller", "lake"),
  F("rong", "Auntie Rong", "orchardist", "lake"),
  F("ye", "Granny Ye", "marshwitch", "marsh"),
  F("reedcutter", "Reed-cutter Mo", "villagerM", "marsh"),
  F("netmaker", "Net-mender Ping", "villagerF", "marsh"),
  F("pip", "Pip", "boy", "marsh"),
  F("kong", "Monk Kong", "monk", "marsh"),
  F("yan", "Poet Yan", "lady", "marsh"),
  F("innkeeper", "Innkeeper Zhao", "villagerF", "marsh"),
  F("restporter", "Porter Lao", "porter", "marsh"),
  F("baizhi", "Bai Zhi", "baizhi", "marsh"),
  F("linger", "Ling'er", "herbalist", "marsh"),
  F("herbHan", "Herbalist Han", "villagerM", "marsh"),
  F("luyu", "Tea Master Lu", "teamaster", "terraces"),
  F("cui", "Picker Cui", "teapicker", "terraces"),
  F("cui2", "Picker Hong", "teapicker", "terraces"),
  F("niu", "Porter Niu", "porter", "terraces"),
  F("terrace-kid", "Little Bo", "boy", "terraces"),
  F("wu", "Farmer Wu", "farmer", "terraces"),
  F("han", "Xiao Han", "swordsman", "terraces"),
  F("dong", "Prospector Dong", "miner", "terraces"),
  F("batu", "Batu", "nomad", "desert"),
  F("saran", "Saran", "villagerF", "desert"),
  F("temur", "Temur", "boy", "desert"),
  F("caravaneer", "Caravaneer Kuo", "porter", "desert"),
  F("yanhuo", "Yan Huo", "yanhuo", "desert"),
  F("phxchi", "Disciple Chi Yan", "phoenix", "desert"),
  F("phxluo", "Disciple Luo Huo", "phoenix", "desert"),
  F("minerWei", "Miner Wei", "villagerM", "desert"),
  F("hai", "Captain Hai", "captain", "harbor"),
  F("alan", "Fishwife Ah Lan", "fishwife", "harbor"),
  F("dockporter", "Dock Porter Gang", "porter", "harbor"),
  F("harborguard", "Harbour Watchman", "guard", "harbor"),
  F("su", "Lady Su", "lady", "harbor"),
  F("dockhand", "Dockhand Lei", "villagerM", "harbor"),
  F("netmender", "Net-mender Wu", "villagerF", "harbor"),
  F("gullboy", "Haizi", "boy", "harbor"),
  F("noodles", "Noodle Seller Hu", "cook", "harbor"),
  F("harbor-elder", "Old Salt Fang", "storyteller", "harbor"),
  F("herder", "Herder Altan", "villagerM", "harbor"),
  F("oyun", "Oyun", "villagerF", "harbor"),
  F("gao", "Woodcutter Gao", "villagerM", "harbor"),
  F("xuan", "Abbot Xuan", "abbot", "frost"),
  F("tuo", "Novice Tuo", "novice", "frost"),
  F("novice-1", "Novice Ji", "novice", "frost"),
  F("novice-2", "Novice Hui", "novice", "frost"),
  F("novice-3", "Novice Pu", "novice", "frost"),
  F("lingfeng", "Ling Feng", "lingfeng", "frost"),
  F("tangyu", "Disciple Tang Yu", "swordsea", "frost"),
  F("rubing", "Disciple Ru Bing", "discipleF", "frost"),
];

export const folk = (key: string) => FOLK.find((f) => f.key === key);

/** Landmarks of the wilds a notice may send her to, and the region each stands in. */
export const SIGHTS: { key: string; name: string; region: AreaId }[] = [
  { key: "cloudrest", name: "Cloudrest Isle", region: "sect" },
  { key: "cloudstep", name: "the Cloudstep Isles", region: "sect" },
  { key: "terraces-sect", name: "the Sect Terraces", region: "sect" },
  { key: "teahouse", name: "the Crossroads Teahouse", region: "bamboo" },
  { key: "swordtomb", name: "the Sword Tomb", region: "bamboo" },
  { key: "pavilion", name: "the Moon-Gazing Pavilion", region: "bamboo" },
  { key: "mill", name: "the Watermill", region: "lake" },
  { key: "orchard", name: "the Peach Orchard", region: "lake" },
  { key: "temple", name: "the Temple of Still Water", region: "marsh" },
  { key: "camp", name: "the old Blood Moon Camp", region: "marsh" },
  { key: "plum", name: "the Plum Blossom Shrine", region: "marsh" },
  { key: "inn", name: "the Wayside Inn", region: "marsh" },
  { key: "herbvalley", name: "Hundred Herb Valley", region: "marsh" },
  { key: "pagoda", name: "the Pagoda of Seven Lamps", region: "terraces" },
  { key: "spring", name: "the Highland Hot Spring", region: "terraces" },
  { key: "bandits", name: "the Bandit Camp", region: "terraces" },
  { key: "dragonspine", name: "the Dragonspine", region: "terraces" },
  { key: "redcliff", name: "the Red Cliff Hideout", region: "desert" },
  { key: "phoenix", name: "the Scarlet Phoenix mesa", region: "desert" },
  { key: "rainbow", name: "the Rainbow Bridge", region: "harbor" },
  { key: "steppe", name: "the Herders' Camp", region: "harbor" },
  { key: "lodge", name: "the Woodcutters' Lodge", region: "harbor" },
  { key: "swordsea", name: "the Sword Sea Pavilion", region: "frost" },
];

/** The beasts that roam (and come back) in each land. */
const FOES: Partial<Record<AreaId, EnemyId[]>> = {
  bamboo: ["wolf", "fox"],
  lake: ["serpent", "wolf"],
  valley: ["cultist", "jiangshi"],
  marsh: ["jiangshi", "serpent", "cultist"],
  terraces: ["bandit", "wolf"],
  desert: ["bandit"],
  frost: ["wolf"],
  harbor: ["wolf"],
};

/** Lands with a lotus shrine to sit at. */
const SHRINE_LANDS: AreaId[] = ["sect", "village", "bamboo", "lake", "marsh", "terraces", "desert", "harbor", "frost"];

const REGION_NAME: Record<AreaId, string> = {
  sect: "the Azure Cloud Sect",
  village: "Willow Creek",
  bamboo: "the Whispering Bamboo",
  lake: "the Lotus Lake",
  valley: "the Crimson Demon Valley",
  peak: "Heavenly Tribulation Peak",
  marsh: "the Mistmarsh",
  terraces: "the Cloudmist Terraces",
  desert: "the Yellow Sands",
  harbor: "Wavecrest Harbour",
  frost: "Frostveil",
};

/** How far out a land is (rewards grow with it). */
const TIER: Record<AreaId, number> = { sect: 0, village: 0, bamboo: 1, marsh: 1, terraces: 1, lake: 2, desert: 2, harbor: 2, frost: 3, valley: 3, peak: 3 };

// ----------------------------------------------------------------------------- the words
const ITEMS = [
  "a jar of plum wine", "a bundle of letters", "a pair of cloth shoes", "a sack of millet", "a lacquered comb", "a string of dried persimmons",
  "a fan painted with cranes", "a bag of lotus seeds", "a root of mountain ginseng", "a carved jade button", "a pot of osmanthus honey", "a bolt of blue cotton",
  "a book of poems", "a little bronze bell", "a tin of cloud-mist tea", "a basket of eggs", "a mended fishing net", "a wooden horse for a child",
  "a packet of needles", "a calligraphy scroll", "a paper umbrella", "a jar of chilli paste", "a bag of salted plums", "a sealed red envelope",
  "a cake of ink", "a whetstone", "a pouch of tobacco", "a herbal plaster", "a lucky knot of red cord", "a bamboo steamer",
  "a clay teapot", "a box of mooncakes", "a pair of chopsticks of black wood", "a ball of silk thread", "a bundle of incense", "a dried fish as long as an arm",
  "a sack of rice flour", "a copper mirror", "a walking stick", "a flask of medicinal wine", "a hand-copied sutra", "a basket of loquats",
  "a jade hairpin", "a set of weiqi stones", "a woven straw hat", "a little clay stove", "a pair of embroidered slippers", "a jar of pickled radish",
  "a bundle of dried mushrooms", "a cricket in a bamboo cage", "a whistle carved from bone", "a map drawn on silk", "a bag of spirit-rice seed", "a crate of oranges",
  "a lute string", "a kite shaped like a carp", "a pot of lard", "a paper lantern", "a warm quilted vest", "a leather water-skin",
];

const REASONS = [
  "I promised it before the plum rains", "it settles an old debt", "they'll know what it means", "it's for their birthday, and I'm terrible with birthdays",
  "my knees won't take the road any more", "we quarrelled, and this says sorry better than I can", "it's their grandmother's, and it should go home",
  "they asked for it three seasons ago", "I owe them a favour from the flood year", "I can't leave the stall", "the roads are too wild for an ordinary body",
  "it'll make them laugh, and they need to", "it's my turn to send something", "they'll pay me in gossip, which is the best coin there is",
];

const THANKS = [
  "You remembered! Heaven bless your legs.", "Oh, this is exactly it. Tell them I said thank you. No — tell them I said it twice.",
  "Ha! The old rascal kept their word after all.", "I'd given up on this. Sit a moment — no? Then off you fly.",
  "You've carried this further than I would have walked in a year. Here, take something for the road.", "Well! I'll have to send something back now, won't I.",
];

const HUNT_ASK = [
  "The {foes} near {region} are bolder every night. Drive off {n} of them, and I'll sleep easier.",
  "Somebody has to thin out the {foes} round {region}. {N} should do it. I'd go myself, but I'm not a cultivator, I'm a coward.",
  "{N} {foes} have been haunting the roads of {region}. A disciple of the sky sect could deal with them before supper.",
  "Travellers won't take the {region} road for fear of the {foes}. Beat {n} of them and word will get round.",
  "My cousin lost a whole cart to the {foes} of {region}. Teach {n} of them some manners.",
];

const VISIT_ACT: { verb: string; anim: "pray" | "read" | "look" | "write" | "bow" | "salute" | "flute" | "sworddance"; line: string }[] = [
  { verb: "burn a stick of incense at", anim: "pray", line: "The incense smoke goes straight up. That's a good sign, they say." },
  { verb: "copy the old inscription at", anim: "write", line: "She copies the worn characters stroke by stroke into her sleeve-book." },
  { verb: "see with your own eyes", anim: "look", line: "She takes a long look, so as to tell it properly." },
  { verb: "leave a little tea at", anim: "bow", line: "She pours a cup of tea onto the ground and bows." },
  { verb: "play a tune for the spirits at", anim: "flute", line: "A few bars on the dizi drift away on the wind." },
  { verb: "practise a sword form at", anim: "sworddance", line: "The blade sings round her in a circle of light." },
  { verb: "read the old stone at", anim: "read", line: "She reads the stone aloud, every word." },
  { verb: "salute the old heroes of", anim: "salute", line: "She salutes, fist in palm, to whoever is listening." },
];

const VISIT_WHY = [
  "My father always meant to, and never did.", "I want to know if it's still standing.", "A cultivator's eyes see more than mine.",
  "The old stories say it brings luck to the one who sends you.", "I made a vow when I was young. I can't keep it myself now.",
  "Someone should, now and then. Things that nobody visits get lonely.", "I'll trade you a story for it when you come back.",
];

const SEASON_WHY: Record<Season, string> = {
  spring: "when the first blossom is out",
  summer: "in the long days of summer",
  autumn: "when the leaves turn gold",
  winter: "under the winter snow",
};

/** "Shadowflame Wolves", "Jiangshi", "Mountain Bandits". */
function plural(foe: EnemyId): string {
  const n = ENEMIES[foe].name;
  if (n === "Jiangshi") return "jiangshi";
  if (n.endsWith("Wolf")) return n.slice(0, -4) + "Wolves";
  return n + "s";
}

const short = (name: string) => name.replace(/^(Village Head|Senior Sister|Disciple|Granny|Auntie|Farmer|Little|Old|Porter|Noodle Seller|Watchman|Woodcutter|Hawker|Picker|Novice|Tea Master|Fishwife|Dock Porter|Dockhand|Net-mender|Reed-cutter|Herbalist|Prospector|Caravaneer|Miner|Captain|Lady|Poet|Monk|Smith|Miller|Abbot|Elder|Master|Innkeeper|Herder|Almanac Master) /, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? k);

// ----------------------------------------------------------------------------- composing the notices
const KINDS: [BountyKind, number][] = [
  ["deliver", 0.25],
  ["hunt", 0.22],
  ["visit", 0.15],
  ["night", 0.1],
  ["meditate", 0.08],
  ["season", 0.08],
  ["ride", 0.06],
  ["fly", 0.06],
];

function pickKind(r: number): BountyKind {
  for (const [k, w] of KINDS) {
    if (r < w) return k;
    r -= w;
  }
  return "deliver";
}

const SEASON_LIST: Season[] = ["spring", "summer", "autumn", "winter"];

function compose(id: number): Bounty {
  const G = FOLK.length;
  const giver = FOLK[id % G];
  const nth = Math.floor(id / G);
  const h = (k: number) => hash2(id, k, 9091);
  const at = <T>(arr: T[], k: number) => arr[Math.floor(h(k) * arr.length)];
  // the first few favours stay close to home; later ones send her anywhere
  const near = nth < 3 || h(2) < 0.35;
  const kind = pickKind(h(1));
  const tier = (rs: AreaId[]) => Math.max(...rs.map((r) => TIER[r]));
  const reward = (rs: AreaId[], weight: number) => {
    const t = tier(rs);
    return { stones: Math.round((12 + t * 10 + nth * 2) * weight), cult: Math.round((0.08 + t * 0.03) * weight * 100) / 100, pills: h(30) < 0.25 ? 1 : 0 };
  };
  const base = { id, giver: giver.key };
  const name = giver.name;
  switch (kind) {
    case "hunt": {
      const lands = Object.keys(FOES) as AreaId[];
      const region = near && FOES[giver.region] ? giver.region : at(lands, 3);
      const foe = at(FOES[region]!, 4);
      const n = 1 + Math.floor(h(5) * (foe === "bandit" || foe === "cultist" ? 2 : 3));
      const v = { foes: plural(foe), region: REGION_NAME[region], n: String(n), N: n === 1 ? "One" : n === 2 ? "Two" : "Three" };
      const titles = [`Trouble in ${REGION_NAME[region].replace(/^the /, "")}`, `${cap(plural(foe))} on the Road`, `${short(name)}'s Hunt`, `A Bounty on ${cap(plural(foe))}`, `Clear the Way to ${REGION_NAME[region].replace(/^the /, "")}`];
      return {
        ...base,
        kind,
        title: at(titles, 6),
        ask: fill(at(HUNT_ASK, 7), v),
        objective: `Defeat ${n} ${n === 1 ? ENEMIES[foe].name : plural(foe)} in ${REGION_NAME[region]} for ${name}.`,
        done: `That's ${n === 1 ? "the one" : `all ${n}`}. ${name} will hear the roads are safer.`,
        regions: [giver.region, region],
        count: n,
        foe,
        region,
        reward: reward([giver.region, region], 1 + n * 0.3),
      };
    }
    case "deliver": {
      const pool = FOLK.filter((f) => f.key !== giver.key && (near ? f.region === giver.region || TIER[f.region] <= TIER[giver.region] + 1 : true));
      const to = at(pool.length ? pool : FOLK.filter((f) => f.key !== giver.key), 8);
      const item = at(ITEMS, 9);
      const why = at(REASONS, 10);
      const titles = [`${cap(item.replace(/^an? /, ""))} for ${short(to.name)}`, `A Parcel to ${REGION_NAME[to.region].replace(/^the /, "")}`, `Owed to ${to.name}`, `${short(name)} Sends Word`, `Carried by Hand`];
      return {
        ...base,
        kind,
        title: at(titles, 11),
        ask: `Would you take ${item} to ${to.name} in ${REGION_NAME[to.region]}? ${cap(why)}.`,
        objective: `Bring ${item} from ${name} to ${to.name} (${REGION_NAME[to.region]}).`,
        done: at(THANKS, 12),
        regions: [giver.region, to.region],
        count: 1,
        to: to.key,
        item,
        reward: reward([giver.region, to.region], 1),
      };
    }
    case "visit":
    case "night":
    case "ride":
    case "fly":
    case "season": {
      const local = SIGHTS.filter((s) => s.region === giver.region);
      const sight = near && local.length ? at(local, 13) : at(SIGHTS, 14);
      const act = at(VISIT_ACT, 15);
      const season = kind === "season" ? at(SEASON_LIST, 16) : undefined;
      const how = { visit: "", night: " after dark", ride: " on Cloudmane", fly: " on your flying sword", season: season ? ` ${SEASON_WHY[season]}` : "" }[kind];
      const titles: Record<typeof kind, string[]> = {
        visit: [`A Visit to ${sight.name.replace(/^the /, "")}`, `${short(name)}'s Vow`, `For Luck`, `What Stands at ${sight.name.replace(/^the /, "")}`],
        night: [`Night Watch at ${sight.name.replace(/^the /, "")}`, `By Lantern Light`, `After the Lamps Are Lit`, `Under the Moon`],
        ride: [`A Gallop to ${sight.name.replace(/^the /, "")}`, `Cloudmane's Errand`, `Hoofbeats`],
        fly: [`On the Wind to ${sight.name.replace(/^the /, "")}`, `A Sword's-Eye View`, `Over the Treetops`],
        season: [`${SEASON_INFO[season ?? "spring"].name} at ${sight.name.replace(/^the /, "")}`, `When the Year Turns`, `${SEASON_INFO[season ?? "spring"].name}'s Promise`],
      };
      const ask =
        kind === "ride"
          ? `They say ${sight.name} looks different at a gallop. Ride Cloudmane there and ${act.verb} it for me? ${at(VISIT_WHY, 17)}`
          : kind === "fly"
            ? `Fly your sword to ${sight.name} and ${act.verb} it — from up high, you'll see what I never could. ${at(VISIT_WHY, 17)}`
            : kind === "night"
              ? `Go to ${sight.name} after dark and ${act.verb} it. The spirits only listen at night. ${at(VISIT_WHY, 17)}`
              : kind === "season"
                ? `${cap(SEASON_WHY[season!])}, go to ${sight.name} and ${act.verb} it. Not before, mind. (The Almanac in Willow Creek can tell you how long to wait.)`
                : `Would you ${act.verb} ${sight.name}? ${at(VISIT_WHY, 17)}`;
      return {
        ...base,
        kind,
        title: at(titles[kind], 18),
        ask,
        objective: `${cap(act.verb)} ${sight.name}${how}, for ${name}.`,
        done: act.line,
        regions: [giver.region, sight.region],
        count: 1,
        landmark: sight.key,
        season,
        anim: act.anim,
        reward: reward([giver.region, sight.region], kind === "visit" ? 0.9 : 1.2),
      };
    }
    case "meditate": {
      const region = near && SHRINE_LANDS.includes(giver.region) ? giver.region : at(SHRINE_LANDS, 19);
      const n = 6 + Math.floor(h(20) * 3) * 3;
      return {
        ...base,
        kind,
        title: at([`Stillness in ${REGION_NAME[region].replace(/^the /, "")}`, `${n} Breaths`, `The Lotus Seat`, `Listen to the Land`], 21),
        ask: `The qi of ${REGION_NAME[region]} feels knotted. Sit at its lotus shrine and breathe with it a while — ${n} breaths should loosen it.`,
        objective: `Meditate at a lotus shrine in ${REGION_NAME[region]} for ${n} breaths, for ${name}.`,
        done: "The land's qi settles around her like a sigh.",
        regions: [giver.region, region],
        count: n,
        region,
        reward: reward([giver.region, region], 1),
      };
    }
  }
}

let all: Bounty[] | null = null;

/** Every notice in the jianghu (composed once). */
export function bounties(): Bounty[] {
  return (all ??= Array.from({ length: BOUNTY_COUNT }, (_, id) => compose(id)));
}

export const bounty = (id: number): Bounty => bounties()[id];

/** The notices each of the folk keeps, in order. */
let byGiver: Map<string, Bounty[]> | null = null;
export function bountiesOf(key: string): Bounty[] {
  if (!byGiver) {
    byGiver = new Map();
    for (const b of bounties()) {
      let arr = byGiver.get(b.giver);
      if (!arr) byGiver.set(b.giver, (arr = []));
      arr.push(b);
    }
  }
  return byGiver.get(key) ?? [];
}

// ----------------------------------------------------------------------------- the save
const word = (id: number) => `bq:${Math.floor(id / 30)}`;
const bit = (id: number) => 1 << id % 30;

export const bountyDone = (g: GameState, id: number) => ((g.counters[word(id)] ?? 0) & bit(id)) !== 0;
export const bountiesDone = (g: GameState) => g.counters.bounties ?? 0;

export interface Carried {
  slot: number;
  bounty: Bounty;
  progress: number;
}

/** The notices she is carrying. */
export function carried(g: GameState): Carried[] {
  const out: Carried[] = [];
  for (let slot = 0; slot < BOUNTY_SLOTS; slot++) {
    const v = g.counters[`bqa:${slot}`] ?? 0;
    if (v > 0 && v <= BOUNTY_COUNT) out.push({ slot, bounty: bounty(v - 1), progress: g.counters[`bqp:${slot}`] ?? 0 });
  }
  return out;
}

const isCarried = (g: GameState, id: number) => carried(g).some((c) => c.bounty.id === id);

/** The next notice an NPC would offer (the first undone one whose lands are all open), or null. */
export function offerFrom(key: string, g: GameState, open: (id: AreaId) => boolean): Bounty | null {
  if (!g.flags.metElder) return null;
  for (const b of bountiesOf(key)) {
    if (bountyDone(g, b.id) || isCarried(g, b.id)) continue;
    if (b.regions.every(open)) return b;
  }
  return null;
}

export function accept(g: GameState, id: number): GameState {
  if (isCarried(g, id) || bountyDone(g, id)) return g;
  for (let slot = 0; slot < BOUNTY_SLOTS; slot++)
    if (!g.counters[`bqa:${slot}`]) return { ...g, counters: { ...g.counters, [`bqa:${slot}`]: id + 1, [`bqp:${slot}`]: 0 } };
  return g;
}

export function abandon(g: GameState, slot: number): GameState {
  return { ...g, counters: { ...g.counters, [`bqa:${slot}`]: 0, [`bqp:${slot}`]: 0 } };
}

export const slotsFree = (g: GameState) => BOUNTY_SLOTS - carried(g).length;

/** Outfits for the notices she has fulfilled. */
export const MILESTONES: { at: number; attire: string; note: string }[] = [
  { at: 10, attire: "ranger", note: "Ten notices fulfilled: the folk of the roads club together for a ranger's leathers." },
  { at: 50, attire: "nightheron", note: "Fifty notices: the night watchmen of three towns send a Night Heron's black silks." },
  { at: 150, attire: "scholar", note: "A hundred and fifty notices: the scholars of the teahouse present a candidate's robes, with a poem embroidered inside." },
  { at: 400, attire: "moonrabbit", note: "Four hundred notices: the children of the jianghu sew a Moon Rabbit dress, ears and all." },
  { at: 1000, attire: "empress", note: "A thousand notices. Every road in the jianghu knows your name. They call you the Empress of the Jianghu, and they have a robe to prove it." },
];

/** Mark a notice done, pay its reward, and hand out any milestone outfit. */
export function fulfil(g: GameState, c: Carried): GameState {
  const b = c.bounty;
  let s: GameState = { ...g, counters: { ...g.counters, [word(b.id)]: (g.counters[word(b.id)] ?? 0) | bit(b.id), bounties: bountiesDone(g) + 1, [`bqa:${c.slot}`]: 0, [`bqp:${c.slot}`]: 0 } };
  s = { ...s, stones: s.stones + b.reward.stones, pills: { heal: Math.min(99, s.pills.heal + b.reward.pills), qi: s.pills.qi } };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * b.reward.cult)).state;
  const m = MILESTONES.find((x) => x.at === bountiesDone(s));
  if (m) s = giveAttire(s, m.attire);
  return s;
}

/** Add to a carried notice's progress. */
export const advance = (g: GameState, slot: number, by = 1): GameState => ({ ...g, counters: { ...g.counters, [`bqp:${slot}`]: (g.counters[`bqp:${slot}`] ?? 0) + by } });

/** The reward, as told in a toast. */
export const rewardText = (b: Bounty) => `+${b.reward.stones} spirit stones · cultivation rises${b.reward.pills ? " · a Healing Pill" : ""}`;

/** What a notice still wants, for the journal (with its progress). */
export function progressText(c: Carried): string {
  const b = c.bounty;
  if (b.kind === "hunt" || b.kind === "meditate") return `${b.objective} (${Math.min(b.count, c.progress)}/${b.count})`;
  return b.objective;
}

// ----------------------------------------------------------------------------- scripts
const named = (who: HumanId, name: string, text: string): Step => ({ say: who, name, text });

/** The NPC asks a favour; she may take it or leave it. */
export function offerScript(b: Bounty, full: boolean): Step[] {
  const f = folk(b.giver)!;
  if (full) return [named(f.char, f.name, b.ask), { say: "narrator", text: `(Your notice slips are full — ${BOUNTY_SLOTS} at once. Fulfil or abandon one in the Journal, J.)` }];
  return [
    { emote: b.giver, icon: "?" },
    named(f.char, f.name, b.ask),
    {
      choose: [
        { label: "Take the notice", hint: `${b.title} · ${rewardText(b)}`, then: [{ mutate: (s) => accept(s, b.id) }, { toast: `Notice taken: ${b.title} · see the Journal (J)` }, { anim: "hero", name: "nod", wait: true }] },
        { label: "Not now", hint: "They'll ask again another day", then: [named(f.char, f.name, "Another time, then. The road isn't going anywhere.")] },
      ],
      prompt: `${f.name} asks a favour: “${b.title}”`,
    },
  ];
}

/** She hands over what she was asked to carry to this person. */
export function deliveryScript(c: Carried): Step[] {
  const b = c.bounty;
  const to = folk(b.to!)!;
  const from = folk(b.giver)!;
  return [
    { say: "heroine", text: `${to.name}, ${from.name} asked me to bring you ${b.item}.` },
    { anim: "hero", name: "bow", wait: true },
    named(to.char, to.name, b.done),
    { mutate: (s) => fulfil(s, c) },
    { toast: `Notice fulfilled: ${b.title} · ${rewardText(b)}` },
  ];
}
