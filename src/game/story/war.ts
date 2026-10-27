import { cultivationNeeded, levelIndex, realmLabel, REALMS } from "../engine/realms";
import { gainCultivation, heal, type GameState } from "../engine/state";
import { DAOS, DAO_IDS, daoLabel, daoTier, dominantDao, walkDao, type DaoId } from "../engine/dao";
import { ENEMIES, isWarFoe, type EnemyId } from "../engine/enemies";
import type { AnimId, HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import type { AreaId } from "../world/ids";
import { FRONT_IDS, frontBoss, OFFICERS, warRoster, type FrontId, type WarRole } from "../world/war";
import { FOLK, SIGHTS } from "./bounties";
import type { Choice, Step } from "./script";
import { giveAttire } from "./wardrobe";

/**
 * The War of the Iron Banner: the third thread of the main tale, a thousand
 * quests long. Beyond the Yellow Sands, Tuoba Hong, Khan of the Iron Wolf
 * horde, has swallowed the cores of a hundred demon beasts. With the
 * jianghu weakened by the theft of the Jade Lotus Heart, his Iron Banner
 * pours through the passes, and General Yue Wushuang of the Northern Army
 * asks the sects for a champion.
 *
 * The war is fought front by front, ten books of a hundred quests: Willow
 * Creek, the bamboo, the lake, the marsh, the terraces, the harbour, a
 * counter-stroke into the sands, the frozen pass, the crimson valley, and at
 * last the siege of the Azure Cloud Sect itself. Each book opens with the
 * General's muster and ends with the captain who holds the front; between
 * them come raids to break, dispatches to carry, ground to scout, wounded
 * land to heal, and dilemmas that test which Dao she walks. Every quest
 * asks for a realm of cultivation, and the war will not wait on a cultivator
 * too weak to survive it.
 *
 * Like the notices, every quest is composed the same way every time from
 * its number, so the save holds only how many are done (`war`) and how far
 * the current one has got (`warp`). The flags the land and the folk answer
 * to (`camp:`, `war:`, `siege:`, `freed:` per front) are derived from those.
 */

export const WAR_COUNT = 1000;
export const BOOK = 100;

export type WarKind = "muster" | "fight" | "report" | "supply" | "scout" | "heal" | "rescue" | "dao" | "cultivate" | "rally" | "siege";

export interface WarQuest {
  id: number;
  book: number;
  step: number;
  front: FrontId;
  kind: WarKind;
  title: string;
  /** The journal line. */
  objective: string;
  /** What she is told when it is set. */
  brief: string;
  /** Who she must speak to (muster, report, supply, dao, rally). */
  npc?: string;
  /** What she carries (supply). */
  item?: string;
  /** How many (fight, heal). */
  count: number;
  /** Where (scout, rescue): a landmark, and how she must arrive. */
  landmark?: string;
  how?: "any" | "night" | "ride" | "fly";
  /** Where (heal): the land whose shrine she must sit at. */
  region?: AreaId;
  /** Which dilemma (dao). */
  dilemma?: number;
  /** The realm the war asks of her for this quest (an overall level index). */
  level: number;
  /** Said or narrated when it is done. */
  done: string;
  reward: { stones: number; cult: number };
}

// ----------------------------------------------------------------------------- the fronts
interface FrontInfo {
  title: string;
  hanzi: string;
  place: string;
  /** The overall level the war asks of her when the book opens. */
  level: number;
  /** Folk of that land who are always there to report to or carry to. */
  folk: string[];
  /** Landmarks to scout (its own, or the nearest). */
  sights: string[];
  /** The land the shrine to heal stands in. */
  shrine: AreaId;
  /** Places on the front the quests talk about. */
  nouns: string[];
  /** When the front catches fire. */
  opening: string;
  /** What the General says at the muster. */
  muster: string;
  /** Who she lost, and what she found, there. */
  victory: string;
}

export const FRONTS: Record<FrontId, FrontInfo> = {
  village: {
    title: "Smoke over Willow Creek",
    hanzi: "柳溪烽烟",
    place: "Willow Creek",
    level: 0,
    folk: ["zhou", "hua", "liu", "chun", "yu", "ba", "willowguard", "hawker", "noodleseller", "almanac"],
    sights: ["pavilion", "teahouse", "cloudrest"],
    shrine: "village",
    nouns: ["the outer paddies", "the mill race", "the willow ford", "the east road", "the threshing floor", "the old shrine path"],
    opening: "Smoke rises from the outer paddies of Willow Creek. Riders in grey furs, wolf-tails on their spears, are burning the threshing floors.",
    muster: "The Iron Banner has crossed the Yellow Sands. These are only its outriders, but they burn like the main host. The Northern Army is three days behind me, and the sects are slow. I need a cultivator who can be everywhere at once.",
    victory: "Willow Creek's paddies are flooded again by the first rain after the battle, and the frogs come back before the farmers do.",
  },
  bamboo: {
    title: "The Burning Grove",
    hanzi: "竹林焚",
    place: "the Whispering Bamboo",
    level: 1,
    folk: ["fang", "ou"],
    sights: ["teahouse", "swordtomb", "pavilion"],
    shrine: "bamboo",
    nouns: ["the fox spirit's tree", "the charcoal kilns", "the old western highway", "the teahouse crossroads", "the bamboo shoots' hollow", "the sword tomb road"],
    opening: "The horde sets the bamboo alight to smoke out the fox spirits. Green stems burst in the heat like firecrackers.",
    muster: "They mean to burn the grove to the ground so their horsemen can ride through it. Bamboo grows back. Foxes, and charcoal-burners, do not.",
    victory: "By spring the burnt grove is a forest of new shoots, and the foxes have dug their dens again under the roots.",
  },
  lake: {
    title: "Red Water",
    hanzi: "赤水",
    place: "the Lotus Lake",
    level: 3,
    folk: ["wen", "tang", "rong"],
    sights: ["mill", "orchard"],
    shrine: "lake",
    nouns: ["the stepping stones", "the watermill", "the peach orchard", "the lotus beds", "the eastern isle", "the fishers' pavilion"],
    opening: "The horde drags rafts down to the Lotus Lake. Where they cross, the water runs red with the lotus they trample.",
    muster: "If they hold the lake they hold the east road and the mill that grinds half the province's rice. Old Fisher Wen says the lake will fight with us. I would rather it did not have to.",
    victory: "The lotus beds are slow to come back, but come back they do, and the fish grow fat that year. No one in the villages will say on what.",
  },
  marsh: {
    title: "The Drowned Road",
    hanzi: "沉路",
    place: "the Mistmarsh",
    level: 5,
    folk: ["ye", "reedcutter", "netmaker", "kong", "yan", "innkeeper"],
    sights: ["temple", "inn", "plum", "camp", "herbvalley"],
    shrine: "marsh",
    nouns: ["the causeway", "the wayside inn", "the reed beds", "the plum shrine", "the old cultist camp", "the stilt houses"],
    opening: "The horde's marsh-riders cut the causeway and flood the road south. The mist over the Mistmarsh is yellow with smoke.",
    muster: "The marsh road is how grain reaches the south. The horde has cut it to starve the herb valley and the terraces both. Granny Ye says the marsh remembers every army that has drowned in it. Let us add one more.",
    victory: "The causeway is rebuilt with stones from the horde's own camp. The marsh folk carve a wolf's head into one of them, so the road never forgets.",
  },
  terraces: {
    title: "Siege of the Terraces",
    hanzi: "围梯田",
    place: "the Cloudmist Terraces",
    level: 7,
    folk: ["luyu", "cui", "cui2", "niu", "wu", "han", "dong"],
    sights: ["pagoda", "spring", "bandits", "dragonspine"],
    shrine: "terraces",
    nouns: ["the tea terraces", "the Pagoda of Seven Lamps", "the hot spring", "the upper paddies", "the porters' stair", "the bandit camp"],
    opening: "Trebuchets crack on the hillsides. Stones fall among the tea bushes, and the terrace walls slide down the mountain one by one.",
    muster: "Iron Marshal Toghril brought siege engines. He means to knock the terraces down step by step until the pagoda falls. Every wall that falls kills a family's ten years of work.",
    victory: "The terrace walls are rebuilt in a single summer, every village on the mountain carrying stones. The new walls are crooked. Everyone is proud of them.",
  },
  harbor: {
    title: "Black Sails",
    hanzi: "黑帆",
    place: "Wavecrest Harbour",
    level: 9,
    folk: ["hai", "alan", "dockporter", "harborguard", "su", "dockhand", "noodles", "harbor-elder", "herder", "oyun"],
    sights: ["rainbow", "steppe", "lodge"],
    shrine: "harbor",
    nouns: ["the quay", "the lighthouse", "the herders' camp", "the Rainbow Bridge", "the fish market", "the breakwater"],
    opening: "Black sails stand off Wavecrest Harbour. The horde has bought or stolen a fleet, and the lighthouse is dark for the first time in a hundred years.",
    muster: "Admiral Khulan blockades the harbour. If she takes it, the horde can land an army anywhere on the coast. Captain Hai has offered the Sea-Swallow. I have told him a junk cannot fight a fleet. He laughed at me.",
    victory: "The lighthouse is lit again on the first night of peace, and every ship in the harbour rings its bell until dawn.",
  },
  desert: {
    title: "Into the Yellow Sands",
    hanzi: "入黄沙",
    place: "the Yellow Sands",
    level: 11,
    folk: ["batu", "saran", "temur", "caravaneer", "yanhuo", "minerWei"],
    sights: ["redcliff", "phoenix"],
    shrine: "desert",
    nouns: ["the caravan wells", "the Red Cliff", "the phoenix mesa", "the salt flats", "the nomad tents", "the Ember Mine road"],
    opening: "Now the Northern Army strikes back: into the sands, at the wells the horde must drink from. The desert burns with their supply camps.",
    muster: "Defending is how one loses a war slowly. We go into the sands and take their wells. Batu's riders will guide us. Sorqan the Sand-King holds the wells, and the sand is his.",
    victory: "The wells are given back to the nomad clans, who swear never to let a khan drink from them again. They said that last time, too.",
  },
  frost: {
    title: "The Frozen Pass",
    hanzi: "冰关",
    place: "Frostveil",
    level: 13,
    folk: ["xuan", "tuo", "novice-1", "novice-2", "lingfeng", "tangyu", "rubing"],
    sights: ["swordsea"],
    shrine: "frost",
    nouns: ["the monastery gate", "the Sword Sea crag", "the frozen pass", "the bell tower", "the snow bridge", "the yak trail"],
    opening: "Hulagu's host comes over the frozen pass in the dead of winter. The monastery's bell rings without anyone touching it.",
    muster: "This is the old road the first khans took, over the snows and down onto the plain. If Hulagu holds the pass, the horde has a door it can always come back through. We shut it.",
    victory: "The monks of Frostveil ring the bell once for every soldier who died on the pass, of either army. It takes three days.",
  },
  valley: {
    title: "The Crimson Pact",
    hanzi: "血盟",
    place: "the Crimson Demon Valley",
    level: 15,
    folk: [],
    sights: ["camp", "swordtomb"],
    shrine: "bamboo",
    nouns: ["the blood altar", "the lava rivers", "the bone fields", "the red mist", "the cultists' stair", "the old shrine of the Blood Moon"],
    opening: "Shaman Ebugen has found the Blood Moon's old altars. The horde's dead rise in the red mist, and the valley's lava runs higher.",
    muster: "The Khan's shaman has made a pact with whatever is left of the Blood Moon. He feeds the altars with the horde's own dead and some of ours. This is no longer a war of men.",
    victory: "The altars are cast down. Whether the valley ever truly sleeps, no one can say, but the red mist thins, and on still nights the stars show through.",
  },
  sect: {
    title: "The Siege of the Azure Cloud",
    hanzi: "围青云",
    place: "the Azure Cloud Sect",
    level: 17,
    folk: ["elder", "qing", "abao", "pang", "qiu", "feng", "lan"],
    sights: ["cloudrest", "cloudstep", "terraces-sect"],
    shrine: "sect",
    nouns: ["the sky bridge", "the Hall of Clouds", "the sword yard", "the alchemy hall", "the cloud terraces", "the sect gate"],
    opening: "Tuoba Hong has come for the sect itself. His reavers climb the sky bridge on chains, and the clouds around the Azure Cloud burn orange.",
    muster: "He knows the war is lost below, so he comes for its heart. If the Azure Cloud falls, every sect in the jianghu will kneel. Your home, Immortal Lin. Your elders, your juniors, your shrine. Let us end it here.",
    victory: "The sky bridge is mended with the Khan's own chains, hammered flat. Elder Mo has them engraved with the names of the fallen.",
  },
};

export const FRONT_ORDER = FRONT_IDS;

// ----------------------------------------------------------------------------- the words
const SUPPLIES = [
  "a crate of arrows", "a sack of rice for the refugees", "bandages from the infirmary", "a sealed dispatch", "a cask of medicinal wine", "a bundle of spears",
  "a bale of winter cloaks", "a pouch of healing pills", "a sack of horseshoes", "a map of the hill paths", "a jar of lamp oil for the watch-fires", "the soldiers' letters home",
  "a box of whetstones", "a bolt of tent canvas", "a crate of salted pork", "the General's seal", "a basket of steamed buns for the picket", "a roll of the fallen's names",
  "a sack of millet seed for after the war", "a talisman bundle from the sects", "a coil of rope", "a bundle of incense for the dead", "a crate of signal rockets", "the army's pay chest",
];

const REPORT_WHY = [
  "they saw the horde's banners pass in the night", "they know every footpath on the hills", "their son rides with the Northern Army", "the General wants their counsel",
  "they have hidden wounded soldiers under their floor", "they counted the horde's horses", "they heard the raiders speak of their captain's plans", "they need to know the army will protect them",
  "they sheltered a horde deserter", "they lost their home and will not leave the ruins", "they have offered their barn to the army", "they say they know where the raiders water their horses",
];

const REPORT_DONE = [
  "“They came at dusk, forty riders, maybe fifty. Tell the General.”", "“Eat something before you go. No — eat. War does not need you hungry.”", "“My boy is in the third company. If you see him, tell him his mother is well.”",
  "“The horde's horses drink at dawn. Every dawn, the same place. Horses are creatures of habit, like generals.”", "“Thank the army for us. And tell them to stop trampling the vegetable beds.”", "“I saw their captain. A big man with a wolf-skin. He laughs when he burns things.”",
  "“We will rebuild. We always rebuild. That is the one thing the khans never understand about us.”", "“Here. Take these dumplings to the picket. They are cold, but war is cold.”",
];

const SCOUT_WHY = [
  "the horde's outriders were seen there", "we need to know if the bridge still stands", "count their campfires", "look for a way round their line",
  "a patrol went missing there", "the horde may be hiding siege engines", "find where they water their horses", "a signal fire was seen there last night",
];

const SCOUT_DONE = [
  "From up here she counts the horde's fires: more than yesterday, fewer than the day before.", "Hoof-prints in the mud, all heading one way. She memorises the way.",
  "Nothing. Only crows. She stays long enough to be sure, then turns back.", "A cold campfire and a broken spear. They were here, and they left in a hurry.",
  "She marks the place on the General's map: a gully the horde has not found yet.", "The bridge still stands. The horde has not dared to cross it.",
];

const VICTIMS = ["a lost shepherd boy", "two children hiding from the raiders", "an old woman who would not leave her house", "a wounded spearman", "a merchant's runaway daughter", "a monk who went to bury the dead", "a farmer's lost ox, and the farmer", "a courier with his horse shot from under him"];

const RESCUE_DONE = [
  "She finds them hiding in a ditch, and carries them back to the lines on her sword.", "They are cold and frightened, but alive. She gives them her cloak and the way to the camp.",
  "A raider's arrow has found them. She draws it, seals the wound with qi, and sends them home.", "They weep when they see the sky sect's robes. She stays until they stop.",
];

const FIGHT_BRIEF = [
  "{N} {foes} are burning {noun}. Drive them off before the fire spreads.", "A raiding party of {n} has been seen at {noun}. Break it.", "The {foes} come at {noun} every night. Tonight, {n} of them do not go home.",
  "Our picket at {noun} is pinned down. Cut a way through for them — {n} of the horde should do it.", "They are herding prisoners past {noun}. Strike {n} of the guards down and the rest will run.",
  "The horde's scouts are counting our tents from {noun}. Blind them: {n} riders.",
];

const FIGHT_TITLES = ["Break the Raiding Party", "Fire at {nounT}", "Hold the Line", "The Night Raid", "Cut Them Off", "Wolves at {nounT}", "{N} Riders", "Thin the Horde", "Blood on the {placeT} Road", "Rear Guard"];
const REPORT_TITLES = ["Word from {npcS}", "The Folk of {placeT}", "Counsel", "What {npcS} Saw", "A Promise to {npcS}"];
const SUPPLY_TITLES = ["Supply Run", "{itemT}", "The Long Road to {npcS}", "Carried Under Fire", "The Army Marches on Its Stomach"];
const SCOUT_TITLES = ["Eyes on {sightT}", "Scouting {sightT}", "What Waits at {sightT}", "The Far Picket", "Count the Fires"];
const HEAL_TITLES = ["The Wounded Land", "Mend the Qi of {placeT}", "Stillness After Battle", "Where the Earth Bled"];
const RESCUE_TITLES = ["Lost Behind the Lines", "Bring Them Home", "Search at {sightT}", "No One Left Behind"];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const bare = (s: string) => s.replace(/^the /, "");
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? k);
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** "Iron Wolf Raiders", "Black Banner Reavers". */
function plural(foe: EnemyId): string {
  return ENEMIES[foe].name + "s";
}

const BOOK_NAMES = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// ----------------------------------------------------------------------------- the dilemmas
interface Option {
  dao: DaoId;
  label: string;
  hint?: string;
  /** What happens, narrated. */
  then: string;
  /** What the one who asked says. */
  reply: string;
  /** A realm she must have reached to choose this (the realm index). */
  realm?: number;
  /** What it costs or brings. */
  effect?: (g: GameState) => GameState;
}

interface Dilemma {
  title: string;
  role: WarRole;
  ask: string;
  options: Option[];
}

const cult = (k: number) => (g: GameState) => gainCultivation(g, Math.round(cultivationNeeded(g.realm, g.stage) * k)).state;
const drainQi = (g: GameState) => ({ ...g, qi: 0 });

/** The hard choices of the war; each front draws nine of them, its own words filled in. */
export const DILEMMAS: Dilemma[] = [
  {
    title: "The Prisoners",
    role: "soldier",
    ask: "We took six of the horde alive at {noun}. The men want them hanged from the nearest tree. You are the Immortal; you say.",
    options: [
      { dao: "mercy", label: "Spare them and feed them", then: "The prisoners eat like starving men. One of them weeps into his bowl and will not say why.", reply: "Feed them? With our rice? …Yes, Immortal." },
      { dao: "sword", label: "A clean death, by your own blade", then: "She does it herself, quickly, so no one else has to carry it.", reply: "…That was mercy too, in its way. I will remember it." },
      { dao: "balance", label: "Send them home, unarmed, with a message", then: "Six unarmed men walk north with a message for the Khan: the jianghu does not hang prisoners.", reply: "They will come back with spears. But maybe not these six." },
      { dao: "slaughter", label: "Hang them where the horde can see", then: "Six bodies turn in the wind over {noun}. The horde's riders give it a wide berth after that.", reply: "Good. Let them be afraid of us for once." },
    ],
  },
  {
    title: "The Granary",
    role: "quartermaster",
    ask: "The granary at {noun} will fall tonight. If the horde takes it they eat for a month. My clerks say burn it. The farmers who filled it say otherwise.",
    options: [
      { dao: "mercy", label: "Carry out what the folk can carry", then: "All night the farmers carry sacks out on their backs. The horde finds the granary half empty, and burns the rest itself.", reply: "We saved enough to plant next year. Enough." },
      { dao: "slaughter", label: "Burn it. Leave them nothing", then: "The granary goes up like a torch. The horde's horses go hungry, and so do the farmers.", reply: "Hungry horses do not charge. Hungry children do not grow. I know." },
      { dao: "sword", label: "Hold the gate yourself until it is emptied", hint: "Foundation Establishment", realm: 1, then: "She stands in the granary gate for a night and a day. The horde stops trying at noon.", reply: "One cultivator in a gateway. The old stories were true." },
      { dao: "balance", label: "Leave it. Hunger fights for no one", then: "She leaves the granary to the war. The horde eats, and stays a week longer in a place it was going to leave anyway.", reply: "Hm. Perhaps you are wiser than my clerks." },
    ],
  },
  {
    title: "The Boy from the Steppe",
    role: "deserter",
    ask: "A boy from my old clan crawled to our lines last night. He says the captain beats any who fall behind. The men say he is a spy. They want to put him to the question.",
    options: [
      { dao: "mercy", label: "Take him in. Give him a blanket", then: "The boy sleeps for a day and a night. When he wakes he draws the horde's camp in the dirt for Feiyan, without being asked.", reply: "You do not know what you have given him. I do." },
      { dao: "sword", label: "Test him: let him hold a blade, and watch", then: "She hands him a knife and turns her back. He drops it and sits down. That is answer enough.", reply: "A good test. A cruel one. Good." },
      { dao: "balance", label: "Let him choose his own road", then: "He chooses south, to nowhere, away from every army. She gives him a few spirit stones.", reply: "That is what I should have done, at his age." },
      { dao: "slaughter", label: "A spy is a spy", then: "The boy is put to the question. He knew nothing. Ashina does not speak to her for three days.", reply: "…" },
    ],
  },
  {
    title: "One Bowl of Medicine",
    role: "medic",
    ask: "Two wounded on my last cot: one of ours, one of theirs. Both will die without the medicine, and I have enough for one.",
    options: [
      { dao: "mercy", label: "The one nearer death, whoever he is", then: "It is the horde's man. He lives. Our man, against every reckoning, lives too.", reply: "Heaven was kind tonight. Do not count on it." },
      { dao: "sword", label: "Ours. That is the oath", then: "The spearman lives. The horde's man dies holding Su Lan's hand.", reply: "I took the oath too. I hate it sometimes." },
      { dao: "balance", label: "Halve it. Let heaven choose", then: "Half a dose each. By morning heaven has chosen one of them. No one is sure it chose right.", reply: "Half a cure is half a poison. We will see." },
      { dao: "mercy", label: "Heal them both with your own qi", hint: "Core Formation · drains your qi", realm: 2, effect: drainQi, then: "She lays a hand on each of them and pours her core's light into both. She is grey in the face after, but both men sit up.", reply: "I have heard of cultivators who could do that. I never believed it." },
      { dao: "slaughter", label: "Let theirs die. Waste nothing on wolves", then: "The horde's man dies quietly. No one looks at him.", reply: "…As you say." },
    ],
  },
  {
    title: "The Headman's Gate",
    role: "refugee",
    ask: "Our headman opened the gate at {noun} to the raiders, to save his family. Half the street burned. He is here, in the camp. The others want him dead.",
    options: [
      { dao: "mercy", label: "He was afraid. Forgive him", then: "She stands between the headman and the crowd until the crowd goes home. He leaves the camp before dawn and is never seen again.", reply: "You are kinder than we can afford. But I am glad someone is." },
      { dao: "sword", label: "Judge him fairly, before everyone", then: "She hears every witness and judges him herself: exile, and his house given to the families he betrayed.", reply: "Fair. Nobody is happy. That is how you know." },
      { dao: "balance", label: "Let the street decide", then: "The street decides. It takes all night and nobody dies of it.", reply: "We decided. We have never had to decide anything before." },
      { dao: "slaughter", label: "Give the crowd what it wants", then: "The crowd has what it wants. Afterwards, nobody will meet anyone else's eye.", reply: "…We wanted it. Why does it feel like this?" },
    ],
  },
  {
    title: "The Poisoned Well",
    role: "scout",
    ask: "The horde's vanguard waters at {noun} at dawn. I have a jar of the herb valley's black poison. One jar, and the vanguard dies — and nothing will drink there for twenty years.",
    options: [
      { dao: "slaughter", label: "Poison it", then: "The vanguard dies at dawn, men and horses together. Nothing will drink at {noun} again in her lifetime.", reply: "It worked. I wish it had not worked so well." },
      { dao: "mercy", label: "Pour the poison into the earth", then: "She pours the jar into a hole far from any water and fills it in.", reply: "Then we fight them the hard way. Fine." },
      { dao: "sword", label: "Ambush them at the water instead", then: "She waits at the water with the picket. The vanguard's first riders never reach it.", reply: "Steel is honest. Poison is not. I think I agree." },
      { dao: "balance", label: "Spoil the water for a day, not twenty years", hint: "Foundation Establishment", realm: 1, then: "She stirs the well with her qi until it runs cloudy and bitter for a day. The vanguard turns back to find other water.", reply: "A day is all we needed. How did you know?" },
    ],
  },
  {
    title: "The Khan's Offer",
    role: "envoy",
    ask: "The Khan offers {place} back, untouched, if you kneel before his banner and swear the sects will never ride against him again. A small thing, to save a whole land.",
    options: [
      { dao: "balance", label: "Talk. Only talk", then: "She talks with Kou until moonset. Nothing is agreed, but the horde does not burn anything that night.", reply: "You listen like an old diplomat. The Khan will be interested." },
      { dao: "sword", label: "Refuse. The jianghu kneels to no one", then: "She sends Kou back with the answer. He bows very low before he goes, as if to say he expected nothing else.", reply: "As I told him you would say." },
      { dao: "mercy", label: "Ask instead for the prisoners' release", then: "To everyone's surprise the Khan agrees. Forty captives walk home across {noun}.", reply: "Forty lives, for the price of a conversation. Well bargained." },
      { dao: "slaughter", label: "Send back his envoy's hat, with a hole in it", then: "Kou walks back to the horde bareheaded, and very thoughtful.", reply: "I will tell him you have a sense of humour. It is not quite true." },
    ],
  },
  {
    title: "Looters",
    role: "soldier",
    ask: "Some of our own lads are looting the empty houses at {noun}. They say the families are dead anyway, and the horde would take it all.",
    options: [
      { dao: "sword", label: "Stop them, and punish them by the code", then: "Three soldiers are flogged in front of the camp. The houses at {noun} stay shut.", reply: "The code is the code. They knew it." },
      { dao: "mercy", label: "Make them carry it to the refugees", then: "The looters spend a week carrying every pot and quilt to the refugee camp in Willow Creek.", reply: "Ha! They are angrier than if you had flogged them." },
      { dao: "balance", label: "Look away. War makes thieves of everyone", then: "She looks away. Nothing more is said of it, but the men like her better, and the folk a little less.", reply: "…Thank you, Immortal." },
      { dao: "slaughter", label: "Hang the ringleader", then: "One soldier hangs. Nobody else takes so much as a spoon.", reply: "He was my friend. He was a thief. Both." },
    ],
  },
  {
    title: "A Widow's Request",
    role: "refugee",
    ask: "The man who killed my husband is in your prisoner line. I know his face. Lend me your sword for one moment. Just one.",
    options: [
      { dao: "mercy", label: "Take her to sit with him instead", then: "She sits the widow across from the prisoner. They do not speak. After an hour, he weeps. After two, she does.", reply: "I wanted to kill him. Now I only want to go home." },
      { dao: "sword", label: "No. The sword is yours to carry, not to lend", then: "She refuses. The widow spits at her feet and walks away, and comes back the next day to say thank you.", reply: "You were right. I hate that you were right." },
      { dao: "balance", label: "Let the General's court try him", then: "The court tries him. It takes a month. He is sent to labour on the walls of {place}.", reply: "A month. And then a wall. Is that justice?" },
      { dao: "slaughter", label: "Give her the sword", then: "It takes more than one moment. No one stops her.", reply: "…It does not bring him back. Why did I think it would?" },
    ],
  },
  {
    title: "The Champion's Challenge",
    role: "soldier",
    ask: "A champion of the horde stands at {noun} and calls for single combat. If our side wins, they pull back a day's ride. He has killed four of our best.",
    options: [
      { dao: "sword", label: "Accept, and fight him fairly", then: "The duel is short. The champion bows as he falls, and his own men carry him off with honour.", reply: "That was the old way. I thought it was dead." },
      { dao: "slaughter", label: "Accept, and make an example of him", then: "She takes him apart in front of both armies. The horde pulls back two days' ride, not one.", reply: "They will tell stories about that. Not good ones." },
      { dao: "balance", label: "Decline. Pride costs lives", then: "She lets him shout himself hoarse. The horde moves on, embarrassed, and nobody dies.", reply: "The men grumble. The men are alive to grumble." },
      { dao: "mercy", label: "Fight him, and spare him at the end", then: "She disarms him and offers her hand. He takes it. That night two horde captains desert.", reply: "Spared? Him? …He will remember that until he dies." },
    ],
  },
  {
    title: "Flood the Fields",
    role: "general",
    ask: "I can break the dyke above {noun} and drown the horde's cavalry in the mud. The farms below will drown with them. I want your counsel, not your permission.",
    options: [
      { dao: "balance", label: "Break it a little: mud, not a flood", hint: "Core Formation", realm: 2, then: "She splits the dyke with a single precise stroke. The water spreads slow and shallow: enough to bog down horses, not to drown houses.", reply: "A flood with a bridle on it. I would not have believed it." },
      { dao: "slaughter", label: "Break it. Drown them all", then: "The dyke goes. So does the horde's cavalry, and three villages, and a summer's rice.", reply: "We won the field. I do not know what we lost." },
      { dao: "mercy", label: "Warn the farms first, whatever it costs", then: "The farms are emptied by night. The horde sees the carts leaving and guesses. The flood catches only half their horse.", reply: "Half. Fine. Half, and no drowned children." },
      { dao: "sword", label: "No flood. We meet them in the field", then: "The army meets the cavalry in the open and holds. It is a terrible day, and an honest one.", reply: "An honest day. Write that on my grave, if it comes to that." },
    ],
  },
  {
    title: "Too Young to March",
    role: "quartermaster",
    ask: "We need men for the line. The only ones left in {place} are boys of twelve and thirteen. The law says sixteen. The General says the law did not expect this.",
    options: [
      { dao: "mercy", label: "Send the boys home", then: "The boys go home. The line is thinner, and she stands in the thin part of it herself.", reply: "Then you will have to be twenty men. Can you?" },
      { dao: "sword", label: "Train them, but keep them off the line", then: "She drills the boys herself, and posts them as runners and watchmen, well behind the spears.", reply: "Runners. Good. Runners come home more often." },
      { dao: "balance", label: "Let each family decide", then: "Some families send their sons, some do not. Nobody blames anybody, out loud.", reply: "Hm. It is how it was done in my grandfather's time." },
      { dao: "slaughter", label: "Give them spears. A war needs bodies", then: "The boys get spears. Some of them come back.", reply: "…I will put their names on the roll." },
    ],
  },
  {
    title: "Two-Faced Merchant",
    role: "scout",
    ask: "There is a merchant at {noun} who sells the horde's plans. He sells ours to the horde as well. I can buy from him, or I can end him.",
    options: [
      { dao: "balance", label: "Buy from him, and feed him lies to sell", then: "She buys the horde's plans and lets slip a false march for the merchant to carry north. The horde waits for it for a week.", reply: "Oh, that is beautiful. You should have been a spy." },
      { dao: "sword", label: "Arrest him openly", then: "The merchant is arrested in front of his stall. The horde loses its eyes, and so do we.", reply: "Straight as a blade. It is a pity the war is so crooked." },
      { dao: "slaughter", label: "End him quietly", then: "The merchant is found in a ditch. Nobody asks.", reply: "Quick. Clean. I will not lose sleep over him." },
      { dao: "mercy", label: "Warn him off, and let him go", then: "She tells him what she knows. He packs his stall and is gone by nightfall, to sell to someone else's war.", reply: "He will be back. They always come back." },
    ],
  },
  {
    title: "The Horde's Families",
    role: "refugee",
    ask: "There is a camp of the horde's families at {noun}: wives, old men, children. The soldiers want to burn it, as they burned ours.",
    options: [
      { dao: "mercy", label: "Protect it", then: "She sits outside the camp all night with her sword across her knees. Nobody burns anything.", reply: "Their children cried like ours. I did not want to hear that." },
      { dao: "balance", label: "Move them away from the fighting", then: "She leads the families to the far side of the hills, away from both armies.", reply: "Away from us. That is the best I can wish them." },
      { dao: "sword", label: "Leave them be. Our war is with soldiers", then: "She forbids anyone to touch the camp, and the order is obeyed.", reply: "You draw the line where the old generals drew it. Good." },
      { dao: "slaughter", label: "Let the soldiers have their revenge", then: "The camp burns. The smoke is no different from the smoke of their own villages.", reply: "We are even. Why do I feel worse?" },
    ],
  },
  {
    title: "Captured Banners",
    role: "soldier",
    ask: "We captured a dozen of the horde's wolf banners at {noun}. The men want to burn them before the army. Some of the old soldiers say send them back.",
    options: [
      { dao: "slaughter", label: "Burn them before the army", then: "The banners burn on a great pyre. The army cheers until it is hoarse.", reply: "Ha! Did you hear them?" },
      { dao: "sword", label: "Hang them in the camp as trophies", then: "The banners hang in the General's tent, so every horde envoy who comes sees them.", reply: "A trophy is a promise. We will win more." },
      { dao: "mercy", label: "Send them back to the families of the dead", then: "The banners go north under a white flag, to the horde's dead. The horde does not attack for three days.", reply: "Three days. I did not know a flag could buy three days." },
      { dao: "balance", label: "Fold them away, and say nothing", then: "She folds the banners into a chest and gives the key to Kou, for when the war is over.", reply: "For when it is over. You believe it will be over?" },
    ],
  },
  {
    title: "The Star-Iron",
    role: "drummer",
    ask: "I found a lump of star-iron at {noun}, still warm. The old soldiers say it is an omen and heaven wants a sacrifice. They want a horde prisoner.",
    options: [
      { dao: "balance", label: "It is a stone. Give it to Smith Ou", then: "The star-iron goes to the Sword Tomb. Smith Ou turns it into a needle for Su Lan's infirmary.", reply: "A needle! Heaven sent a needle!" },
      { dao: "sword", label: "Forge it into a blade for the army", then: "The star-iron becomes a spearhead that never dulls. The army carries it at the front of the line.", reply: "Our own omen! Heaven is on our side!" },
      { dao: "mercy", label: "Tell the soldiers heaven wants no blood", then: "She tells them heaven wants no blood. They grumble, and nobody dies.", reply: "Are you sure? …You are the immortal, I suppose." },
      { dao: "slaughter", label: "Give heaven its sacrifice", then: "Heaven gets its sacrifice. If it was pleased, it does not say so.", reply: "…Did heaven want that? I am only a drummer." },
    ],
  },
  {
    title: "The Price of Pills",
    role: "quartermaster",
    ask: "A pill merchant at {noun} has trebled his prices since the war came. My wounded need his pills. I could take them, by the army's right.",
    options: [
      { dao: "sword", label: "Take them, and give him a receipt", then: "The pills are requisitioned against the army's seal. The merchant curses her name, but he will be paid after the war.", reply: "A receipt! You are a bureaucrat at heart." },
      { dao: "mercy", label: "Pay his price from your own purse", hint: "Costs 120 spirit stones", effect: (g) => ({ ...g, stones: Math.max(0, g.stones - 120) }), then: "She pays every stone he asks. The merchant, shamed, slips a box of pills in with the rest for nothing.", reply: "Your own stones? The army will pay you back. One day. Perhaps." },
      { dao: "balance", label: "Bargain with him", then: "She bargains with him for an hour. He comes down to only double his price and thinks he has won.", reply: "Ha. Double. I would have paid triple." },
      { dao: "slaughter", label: "Take everything he has", then: "His whole stall goes to the army. He goes to the refugee camp, with nothing.", reply: "War is hard on merchants too." },
    ],
  },
  {
    title: "Demon Cores",
    role: "scout",
    ask: "We took a chest of demon cores from the horde's baggage at {noun} — what the reavers swallow before battle. Swallow one, and your cultivation would leap. It is said they whisper, after.",
    options: [
      { dao: "slaughter", label: "Swallow one", hint: "Your cultivation surges", effect: cult(0.6), then: "The core burns going down. Her cultivation leaps, and for a long moment she hears something howling far away inside her.", reply: "Your eyes went red, just for a moment. Did you know?" },
      { dao: "balance", label: "Send them to Hundred Herb Valley to study", then: "The cores go south in a sealed chest. Bai Zhi writes back that one of them is a tiger's, and it is very angry.", reply: "Let the herbalists have them. They like that sort of thing." },
      { dao: "mercy", label: "Release the beasts' spirits", then: "She cracks the cores one by one and lets what is inside go. A wind goes through the camp, and the horses all look north.", reply: "Something left. I felt it go." },
      { dao: "sword", label: "Shatter them with one stroke", then: "One stroke. The chest and every core in it turn to dust.", reply: "Done. No one will be tempted now." },
    ],
  },
  {
    title: "The Order to Retreat",
    role: "general",
    ask: "The court has ordered me to fall back from {noun}. Our wounded cannot be moved. If I obey, they are left to the horde.",
    options: [
      { dao: "mercy", label: "Stay with the wounded yourself", then: "The army falls back. She stays with the wounded and holds the field hospital alone for two days until the carts come.", reply: "Alone, for two days. You are either a hero or a fool. Both, I think." },
      { dao: "sword", label: "Obey the order. An army is its discipline", then: "The army falls back in good order. The wounded are left with a white flag. Some of them are spared.", reply: "Obedience is the hardest courage. I hate it." },
      { dao: "balance", label: "Fall back slowly, carrying them", then: "The army falls back at a walk, carrying every stretcher. It takes three times as long, and the horde, puzzled, never quite catches up.", reply: "Slowly. Ha. The court said fall back; it did not say how fast." },
      { dao: "slaughter", label: "Disobey. Attack instead", then: "The army attacks. The horde is not expecting it. The court will be furious, and the wounded are safe.", reply: "They will court-martial me. Worth it." },
    ],
  },
  {
    title: "Graves for Both Armies",
    role: "medic",
    ask: "The dead of both armies lie together at {noun}. The men will not dig graves for the horde's dead. Someone must, or there will be plague.",
    options: [
      { dao: "mercy", label: "Bury them all, side by side", then: "She digs the first grave herself. By evening the whole camp is digging, both armies' dead side by side.", reply: "Side by side. Like they could never be alive." },
      { dao: "balance", label: "Burn them all on one pyre", then: "One pyre for both armies. The smoke goes up the same colour.", reply: "Fire does not take sides. Neither should we, with the dead." },
      { dao: "sword", label: "Ours in graves, theirs returned under a white flag", then: "The horde comes under a white flag to take its dead. For one afternoon, nobody fights.", reply: "One afternoon. It was a good afternoon." },
      { dao: "slaughter", label: "Leave theirs for the crows", then: "The crows have a fine month at {noun}. The camp moves upwind.", reply: "The smell will be with us for weeks." },
    ],
  },
  {
    title: "The Starving Horses",
    role: "scout",
    ask: "The horde has left a corral of horses at {noun} to starve. Fine steppe horses, two hundred of them. We could use them, or kill them so the horde never can.",
    options: [
      { dao: "mercy", label: "Feed them and set them free", then: "She opens the corral and leads the horses to grass. Some of them follow her for days.", reply: "Free? Two hundred horses? …Fine. They were not ours to keep." },
      { dao: "balance", label: "Give them to the farmers to plough with", then: "The horses go to the farms the war emptied. Next spring, every field in {place} is ploughed early.", reply: "Ploughhorses! The horde will never know." },
      { dao: "sword", label: "Take them for the army's cavalry", then: "The Northern Army has cavalry for the first time this war. The horde is very surprised.", reply: "Now we can catch them. Now we can catch them!" },
      { dao: "slaughter", label: "Kill them, so the horde never can", then: "Two hundred horses. It takes all day. Nobody in the camp eats meat that week, for shame.", reply: "…" },
    ],
  },
  {
    title: "The Horde's Healer",
    role: "medic",
    ask: "A healer of the horde came to our infirmary under a white cloth. She says she wants to help with the wounded. Any wounded. The soldiers do not trust her.",
    options: [
      { dao: "mercy", label: "Let her work beside Su Lan", then: "The horde's healer works beside Su Lan for a month. She saves more men than anyone can count, from both sides.", reply: "She knows a stitch I have never seen. She is teaching me." },
      { dao: "balance", label: "Let her work, under watch", then: "She works under a guard's eye. After a week, the guard is fetching her water.", reply: "Trust grows slowly. Like stitches." },
      { dao: "sword", label: "Send her back with thanks", then: "She is sent back to her own wounded, with a bundle of the army's bandages.", reply: "She has her own wounded. She should be with them. You are right." },
      { dao: "slaughter", label: "She is a spy. Seize her", then: "She is seized, and found to be exactly what she said she was. It is too late to undo.", reply: "She was only a healer. I told you." },
    ],
  },
  {
    title: "Raid Across the Line",
    role: "soldier",
    ask: "The lads want to raid a horde village across the line, beyond {noun}, the way they raided ours. An eye for an eye, they say.",
    options: [
      { dao: "slaughter", label: "Lead the raid yourself", then: "She leads the raid. The horde village burns like theirs did. The lads come back laughing, and then they stop laughing.", reply: "We did it. We did it. Why are you looking at me like that?" },
      { dao: "mercy", label: "Forbid it", then: "She forbids it, and sits up all night at the picket to make sure.", reply: "Eye for an eye and the whole world goes blind. My grandmother said that." },
      { dao: "sword", label: "Raid their supply camp instead", then: "The raid hits the horde's supply camp and nothing else. A hundred horses' worth of fodder burns.", reply: "Their horses will be hungry. Their children will not. That is a good raid." },
      { dao: "balance", label: "Let them go, but go with them", then: "She goes with them. With her there, the raid takes cattle and nothing else, and everyone comes home.", reply: "Cattle. Fine. We will eat well." },
    ],
  },
  {
    title: "The Envoy's Secret",
    role: "envoy",
    ask: "I will tell you something, cultivator, because I am tired. The Khan swallowed a hundred demon cores. Some nights he does not know his own name. His captains fear him more than they fear you.",
    options: [
      { dao: "balance", label: "Ask Kou what he wants for the war to end", then: "They talk until dawn about what peace would look like. It looks very far away, and very simple.", reply: "A border, and a market on it. That is all it would take. That is all." },
      { dao: "mercy", label: "Offer him sanctuary", then: "She offers Kou sanctuary in the sect. He laughs, and then he does not, and then he thanks her.", reply: "When it is over, perhaps. I have work to do first." },
      { dao: "sword", label: "Thank him, and let him go back safe", then: "She escorts him to the line herself, and bows to him there.", reply: "A courtesy. The Khan never shows any. I notice it." },
      { dao: "slaughter", label: "Hold him as a hostage", then: "Kou is held in a tent under guard. The horde does not seem to want him back, which is answer enough.", reply: "They will not ransom me. I told you. I am tired." },
    ],
  },
];

// ----------------------------------------------------------------------------- composing the quests
/** What the war asks of her at a quest: the book's realm, a step more after its middle, and Spirit Severing's peak for the Khan. */
function levelFor(book: number, step: number): number {
  if (book === 9 && step === 99) return 19;
  return FRONTS[FRONT_IDS[book]].level + (step >= 50 ? 1 : 0);
}

const officerKey = (role: WarRole, front: FrontId) => {
  if (role === "soldier") return `spear-${front}-0`;
  if (role === "refugee") return `ref-${front}-1`;
  const o = OFFICERS.find((x) => x.role === role)!;
  return `${o.key}-${front}`;
};

/** Who answers to a war NPC key, with their name and look. */
export function warPerson(key: string): { name: string; char: HumanId; front: FrontId | null } | null {
  if (key === "gu") return { name: "Lady Gu", char: "widow", front: null };
  if (key === "yue-peace") return { name: "General Yue", char: "general", front: null };
  const m = /-(village|bamboo|lake|marsh|terraces|harbor|desert|frost|valley|sect)(-\d)?$/.exec(key);
  if (!m) return null;
  const front = m[1] as FrontId;
  const n = warRoster(front).find((x) => x.key === key);
  return n ? { name: n.name, char: n.char, front } : null;
}

/** Someone the war sends her to: the folk of a front (always there), or the army's own. */
function person(key: string): { key: string; name: string; char: HumanId; place: string } {
  const w = warPerson(key);
  if (w) return { key, name: w.name, char: w.char, place: w.front ? (key.startsWith("ref-") ? (w.front === "village" ? "the Azure Cloud Sect's refugee camp" : "the refugee camp at Willow Creek") : `the army's camp at ${FRONTS[w.front].place}`) : "Willow Creek" };
  const f = FOLK.find((x) => x.key === key)!;
  return { key, name: f.name, char: f.char, place: REGION_PLACE[f.region] };
}

const REGION_PLACE: Record<AreaId, string> = {
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

const KINDS: [WarKind, number][] = [
  ["fight", 0.3],
  ["report", 0.16],
  ["supply", 0.16],
  ["scout", 0.16],
  ["heal", 0.1],
  ["rescue", 0.12],
];

function pickKind(r: number): WarKind {
  for (const [k, w] of KINDS) {
    if (r < w) return k;
    r -= w;
  }
  return "fight";
}

/** The nine dilemmas a book draws (no repeats within it; officers only once they have joined the army). */
function dilemmasOf(book: number): number[] {
  const ok = DILEMMAS.map((d, i) => ({ d, i })).filter(({ d }) => (d.role !== "deserter" || book >= 1) && (d.role !== "envoy" || book >= 3));
  const sorted = ok.sort((a, b) => hash2(a.i, book, 5151) - hash2(b.i, book, 5151));
  return sorted.slice(0, 10).map((x) => x.i);
}

function compose(id: number): WarQuest {
  const book = Math.floor(id / BOOK);
  const step = id % BOOK;
  const front = FRONT_IDS[book];
  const F = FRONTS[front];
  const h = (k: number) => hash2(id, k, 7717);
  const at = <T>(arr: readonly T[], k: number) => arr[Math.floor(h(k) * arr.length)];
  const level = levelFor(book, step);
  const noun = at(F.nouns, 1);
  const tierFoe: EnemyId = book < 3 ? "raider" : book < 6 ? "ironguard" : "bannerman";
  const v: Record<string, string> = { place: F.place, placeT: titleCase(bare(F.place)), noun, nounT: titleCase(bare(noun)), foes: plural(tierFoe), foe: ENEMIES[tierFoe].name };
  const weight = 1 + book * 0.35;
  const reward = (cultK: number, stoneK = 1) => ({ stones: Math.round((14 + book * 9 + step * 0.2) * stoneK), cult: cultK });
  const base = { id, book, step, front, level };
  const yue = `yue-${front}`;
  const boss = ENEMIES[frontBoss(front)];

  if (step === 0)
    return {
      ...base,
      kind: "muster",
      title: `The Muster at ${titleCase(bare(F.place))}`,
      objective: `General Yue has raised her standard at ${F.place}. Speak with her at the army's camp.`,
      brief: F.muster,
      npc: yue,
      count: 1,
      done: F.opening,
      reward: reward(0.1, 2),
    };
  if (step === 98)
    return {
      ...base,
      kind: "rally",
      title: "Sound the Assault",
      objective: `The army is ready to take back ${F.place}. Tell General Yue to sound the assault.`,
      brief: `${boss.name} holds what is left of the horde at ${F.place}. When the drums sound, he will come out to meet you. Are you ready?`,
      npc: yue,
      count: 1,
      done: "The drums of the Northern Army roll across the front, and far off the horde's horns answer.",
      reward: reward(0.12, 2),
    };
  if (step === 99)
    return {
      ...base,
      kind: "siege",
      title: `${boss.name}`,
      objective: `${boss.name} has come out to fight at ${F.place}. Find and defeat him on the edge of the front.`,
      brief: "",
      count: 1,
      done: F.victory,
      reward: reward(0.4, 6),
    };
  if (step === 50)
    return {
      ...base,
      kind: "cultivate",
      title: "Beyond Your Realm",
      objective: `The fighting at ${F.place} has grown fiercer than your cultivation. Reach ${realmLabel(...realmOf(level))} (battles, herbs, shrines, quests) before the army needs you again.`,
      brief: "",
      count: 1,
      done: "Her qi settles at a new depth. General Yue nods when she hears.",
      reward: reward(0.05, 1),
    };
  if (step % 10 === 9) {
    const d = dilemmasOf(book)[Math.floor(step / 10)];
    const D = DILEMMAS[d];
    const asker = person(officerKey(D.role, front));
    return {
      ...base,
      kind: "dao",
      title: D.title,
      objective: `${asker.name} must ask you something hard, at ${asker.place}.`,
      brief: fill(D.ask, v),
      npc: asker.key,
      dilemma: d,
      count: 1,
      done: "",
      reward: reward(0.15, 1.5),
    };
  }
  const kind = pickKind(h(2));
  switch (kind) {
    case "fight": {
      const n = 1 + Math.floor(h(3) * (book < 2 ? 2 : 3));
      const vv = { ...v, n: String(n), N: ["One", "Two", "Three"][n - 1] };
      return {
        ...base,
        kind,
        title: fill(at(FIGHT_TITLES, 4), vv),
        objective: `Defeat ${n} of the horde (${plural(tierFoe)}) on the front at ${F.place}.`,
        brief: fill(at(FIGHT_BRIEF, 5), vv),
        count: n,
        done: `That is ${n === 1 ? "one" : String(n)} fewer. The picket at ${noun} breathes again.`,
        reward: reward(0.04 + n * 0.01, weight * 0.3 + 1),
      };
    }
    case "report":
    case "supply": {
      const camp = OFFICERS.filter((o) => o.role !== "general" && (o.role !== "deserter" || book >= 1) && (o.role !== "envoy" || book >= 3)).map((o) => `${o.key}-${front}`);
      const pool = [...F.folk, ...F.folk, ...camp, `ref-${front}-0`];
      const to = person(at(pool, 6));
      const vv = { ...v, npc: to.name, npcS: to.name.split(" ").slice(-1)[0] };
      if (kind === "report") {
        const why = at(REPORT_WHY, 7);
        return {
          ...base,
          kind,
          title: fill(at(REPORT_TITLES, 8), vv),
          objective: `Speak with ${to.name} at ${to.place}: ${why}.`,
          brief: `Find ${to.name} at ${to.place} — ${why}.`,
          npc: to.key,
          count: 1,
          done: at(REPORT_DONE, 9),
          reward: reward(0.04),
        };
      }
      const item = at(SUPPLIES, 10);
      return {
        ...base,
        kind,
        title: fill(at(SUPPLY_TITLES, 11), { ...vv, itemT: titleCase(item.replace(/^(an?|the) /, "")) }),
        objective: `Carry ${item} to ${to.name} at ${to.place}.`,
        brief: `Quartermaster Bao has ${item} that must reach ${to.name} at ${to.place}. The roads are not safe. Take it on your sword.`,
        npc: to.key,
        item,
        count: 1,
        done: "“You brought it through all that? Heaven bless the sky sects.”",
        reward: reward(0.04, 1.2),
      };
    }
    case "scout":
    case "rescue": {
      const sight = at(F.sights, 12);
      const s = SIGHTS.find((x) => x.key === sight)!;
      const vv = { ...v, sightT: titleCase(bare(s.name)) };
      if (kind === "rescue") {
        const victim = at(VICTIMS, 13);
        return {
          ...base,
          kind,
          title: fill(at(RESCUE_TITLES, 14), vv),
          objective: `Find ${victim} near ${s.name} and send them back to the lines.`,
          brief: `Feiyan's people saw ${victim} near ${s.name}, behind the horde's line. Bring them out.`,
          landmark: sight,
          how: "any",
          count: 1,
          done: at(RESCUE_DONE, 15),
          reward: reward(0.05, 1.1),
        };
      }
      const how = at(["any", "any", "night", "ride", "fly"] as const, 16);
      const howText = { any: "", night: " after dark", ride: " on Cloudmane", fly: " on your flying sword" }[how];
      const why = at(SCOUT_WHY, 17);
      return {
        ...base,
        kind,
        title: fill(at(SCOUT_TITLES, 18), vv),
        objective: `Scout ${s.name}${howText}: ${why}.`,
        brief: `${cap(why)}. Go to ${s.name}${howText} and see for yourself.`,
        landmark: sight,
        how,
        count: 1,
        done: at(SCOUT_DONE, 19),
        reward: reward(0.05, 1.1),
      };
    }
    case "heal":
    default: {
      const n = 4 + Math.floor(h(20) * 3) * 2;
      return {
        ...base,
        kind: "heal",
        title: fill(at(HEAL_TITLES, 21), v),
        objective: `The fighting has knotted the qi of the land. Meditate ${n} breaths at a lotus shrine in ${REGION_PLACE[F.shrine]}.`,
        brief: `Where so many have died, the land's qi runs tangled and sour, and nothing grows. Sit at a shrine in ${REGION_PLACE[F.shrine]} and breathe with it, ${n} breaths.`,
        region: F.shrine,
        count: n,
        done: "The land's qi loosens under her breath, like a fist unclenching.",
        reward: reward(0.05),
      };
    }
  }
}

/** [realm, stage] for an overall level index. */
function realmOf(level: number): [number, number] {
  let n = level;
  for (let r = 0; r < REALMS.length; r++) {
    if (n < REALMS[r].stages) return [r, n];
    n -= REALMS[r].stages;
  }
  return [REALMS.length - 1, 0];
}

let all: WarQuest[] | null = null;
/** Every quest of the war (composed once). */
export function warQuests(): WarQuest[] {
  return (all ??= Array.from({ length: WAR_COUNT }, (_, id) => compose(id)));
}
export const warQuestAt = (id: number) => warQuests()[id];

// ----------------------------------------------------------------------------- the save
export const warDone = (g: GameState) => Math.max(0, Math.min(WAR_COUNT, g.counters.war ?? 0));
const warProgress = (g: GameState) => g.counters.warp ?? 0;

/** Whether the war has reached her yet: it comes once Willow Creek is safe and Village Head Zhou has met her. */
export const warOpen = (g: GameState) => !!g.flags.metZhou;

/** The quest she is on, or null before the war reaches her and after it ends. */
export function currentWar(g: GameState): WarQuest | null {
  if (!warOpen(g)) return null;
  const n = warDone(g);
  return n < WAR_COUNT ? warQuestAt(n) : null;
}

/** Whether her cultivation is equal to what the war asks of her now. */
export const strongEnough = (g: GameState, q: WarQuest) => levelIndex(g.realm, g.stage) >= q.level;

/** Bring the war's flags in line with its progress (so the land, the camps and the raiders follow). */
export function syncWarFlags(g: GameState): GameState {
  const n = warDone(g);
  const book = Math.min(FRONT_IDS.length - 1, Math.floor(n / BOOK));
  const step = n % BOOK;
  const flags: Record<string, boolean> = { ...g.flags, "war:begun": n >= 1, "war:won": n >= WAR_COUNT };
  FRONT_IDS.forEach((front, k) => {
    const current = n < WAR_COUNT && k === book;
    flags[`camp:${front}`] = current && n > 0;
    flags[`war:${front}`] = current && step >= 1;
    flags[`siege:${front}`] = current && step === 99;
    flags[`freed:${front}`] = n >= BOOK * (k + 1);
  });
  return { ...g, flags };
}

/** Outfits for quests of the war. */
export const WAR_MILESTONES: { at: number; attire: string; note: string }[] = [
  { at: 100, attire: "lamellar", note: "A hundred quests of the war: General Yue has the armourers fit you with the Northern Army's lamellar." },
  { at: 500, attire: "bannergeneral", note: "Five hundred quests: the army gives you a general's panoply, and its banner to carry." },
];

/** The robe the war's end makes of her, by the Dao she walked to it. */
export const WAR_END_ATTIRE: Record<DaoId, string> = { sword: "swordsaint", mercy: "bodhisattva", balance: "taijisage", slaughter: "asura" };

/** Mark the current quest done: pay out, move the war on, and hand out any milestone outfit. */
export function completeWar(g: GameState, id: number): GameState {
  if (warDone(g) !== id) return g;
  const q = warQuestAt(id);
  let s: GameState = { ...g, counters: { ...g.counters, war: id + 1, warp: 0 }, stones: g.stones + q.reward.stones };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * q.reward.cult)).state;
  const m = WAR_MILESTONES.find((x) => x.at === id + 1);
  if (m) s = giveAttire(s, m.attire);
  return syncWarFlags(s);
}

const advanceWar = (g: GameState, by = 1): GameState => ({ ...g, counters: { ...g.counters, warp: warProgress(g) + by } });

// ----------------------------------------------------------------------------- how the war speaks
const named = (who: HumanId, name: string, text: string): Step => ({ say: who, name, text });
const narr = (text: string): Step => ({ say: "narrator", text });

/** What the army calls her, by the Dao she walks. */
export function epithet(g: GameState): string {
  const d = dominantDao(g);
  return d ? { sword: "Sword Immortal", mercy: "Merciful Immortal", balance: "Still-Water Immortal", slaughter: "Red Blade" }[d] : "Immortal Lin";
}

/** A word on her cultivation from whoever is speaking: awe when she is far above what the war asks, worry when she is only just enough. */
function realmWord(g: GameState, q: WarQuest): string {
  const gap = levelIndex(g.realm, g.stage) - q.level;
  const realm = REALMS[g.realm].name;
  if (gap >= 6) return ` With ${realm} behind you, the horde's men will run at the sight of you.`;
  if (gap >= 3) return ` A ${realm} cultivator on our side. It still does not feel real.`;
  if (gap === 0) return " Be careful. You are only just strong enough for this.";
  return "";
}

/** How the army's folk see her Dao: one line more, now and then. */
export function daoWord(g: GameState): string | null {
  const d = dominantDao(g);
  const t = daoTier(g);
  if (!d) return null;
  const lines: Record<DaoId, string[]> = {
    sword: ["The men have started oiling their spears the way you oil your sword.", "They say you never strike twice where once will do.", "The young spearmen practise your cuts in the evening.", "The horde calls you the White Blade. They say it quietly."],
    mercy: ["The wounded ask for you by name.", "The refugees leave flowers outside your tent.", "Even the horde's prisoners bow to you.", "They say no one has died within a li of you who did not have to."],
    balance: ["You never seem to hurry, and you are never late. It unsettles the officers.", "Feiyan says you walk like water finding its way downhill.", "The old soldiers say you fight like the weather.", "Kou says the Khan has asked about you. About you, not your sword."],
    slaughter: ["The horde's riders turn back when they see your robes.", "The men are afraid of you. So am I, a little.", "They say the crows follow you from front to front.", "The refugees move aside when you pass. They do not look up."],
  };
  return lines[d][Math.min(t, 4) - 1];
}

/** The steps that finish a quest: a toast, a reward, and any outfit. */
function finish(q: WarQuest, g: GameState): Step[] {
  const next = completeWar(g, q.id);
  const m = WAR_MILESTONES.find((x) => x.at === q.id + 1);
  const steps: Step[] = [{ mutate: (s) => completeWar(s, q.id) }, { toast: `War quest ${q.id + 1}/${WAR_COUNT} done: ${q.title} · +${q.reward.stones} spirit stones · cultivation rises` }];
  if (m) steps.push({ anim: "hero", name: "twirl", wait: true }, narr(m.note), { toast: "A gift of the war: see the wardrobe (V)" });
  // the next book's muster, or the land as it is now
  const after = currentWar(next);
  if (after && after.kind === "muster" && q.kind !== "muster") steps.push({ toast: `General Yue moves her camp to ${FRONTS[after.front].place}` });
  return steps;
}

/** She is not yet strong enough: the asker tells her so. */
function tooWeak(q: WarQuest, who: { char: HumanId; name: string }): Step[] {
  return [named(who.char, who.name, `Not yet. What comes next would kill a cultivator below ${realmLabel(...realmOf(q.level))}. Cultivate, and come back to me.`), { toast: `The war asks for ${realmLabel(...realmOf(q.level))}` }];
}

/** Who a war NPC is, as a speaker. */
function speaker(key: string): { char: HumanId; name: string } {
  const p = person(key);
  return { char: p.char, name: p.name };
}

/** The Dao choice of a dilemma. */
function dilemmaSteps(q: WarQuest, g: GameState): Step[] {
  const D = DILEMMAS[q.dilemma!];
  const who = speaker(q.npc!);
  const v = { place: FRONTS[q.front].place, noun: FRONTS[q.front].nouns[Math.floor(hash2(q.id, 1, 7717) * FRONTS[q.front].nouns.length)] };
  const usable = D.options.filter((o) => (o.realm ?? 0) <= g.realm);
  const locked = D.options.length - usable.length;
  const options: Choice[] = usable.map((o) => ({
    label: o.label,
    hint: [o.hint, DAOS[o.dao].name].filter(Boolean).join(" · "),
    then: [
      { mutate: (s) => walkDao(o.effect ? o.effect(s) : s, o.dao, 2) },
      narr(fill(o.then, v)),
      named(who.char, who.name, o.reply),
      { toast: `Your heart leans toward the ${DAOS[o.dao].name} (${DAOS[o.dao].hanzi})` },
    ],
  }));
  return [
    { emote: q.npc!, icon: "..." },
    named(who.char, who.name, q.brief),
    { choose: options, prompt: `${D.title}${locked ? " · a deeper cultivation would show another way" : ""}` },
    ...finish(q, g),
  ];
}

/**
 * What talking to this person does for the war right now: the muster, a
 * report, a delivery, a dilemma, the call to assault. Null when they have
 * nothing to do with the quest she is on.
 */
export function warTalk(key: string, g: GameState): Step[] | null {
  const q = currentWar(g);
  if (!q || q.npc !== key || !["muster", "report", "supply", "dao", "rally"].includes(q.kind)) return null;
  const who = speaker(key);
  if (!strongEnough(g, q)) return tooWeak(q, who);
  const word = daoWord(g);
  switch (q.kind) {
    case "muster": {
      const F = FRONTS[q.front];
      const first = q.id === 0;
      return [
        { emote: key, icon: "!" },
        ...(first
          ? [
              named(who.char, who.name, "You are the Azure Cloud's disciple? The one who drove the beast from this village? Good. I am Yue Wushuang, General of the Northern Army, and I need you."),
              { anim: key, name: "point", wait: true } as Step,
            ]
          : [named(who.char, who.name, `${epithet(g)}. We are camped at ${F.place} now.${realmWord(g, q)}`)]),
        named(who.char, who.name, F.muster),
        ...(word ? [named(who.char, who.name, word)] : []),
        { anim: key, name: "horn", wait: true },
        { shake: 0.8 },
        narr(F.opening),
        { mutate: (s) => completeWar(s, q.id) },
        { reshape: true },
        { anim: "hero", name: "rally", wait: true },
        { toast: `${first ? "A new main quest: the War of the Iron Banner · " : ""}Book ${BOOK_NAMES[q.book]}: ${F.title} (${F.hanzi}) · see the Journal (J)` },
      ];
    }
    case "rally":
      return [
        named(who.char, who.name, q.brief),
        named("heroine", "Lin Yue", "Sound the drums, General."),
        { anim: key, name: "horn", wait: true },
        { shake: 0.6 },
        narr(q.done),
        ...finish(q, g),
        { anim: "hero", name: "rally", wait: true },
        { toast: `${ENEMIES[frontBoss(q.front)].name} rides out to meet you · find him on the front` },
      ];
    case "dao":
      return dilemmaSteps(q, g);
    case "supply":
      return [
        { say: "heroine", text: `${who.name}, the army sends ${q.item}.` },
        { anim: "hero", name: "offer", wait: true },
        named(who.char, who.name, q.done),
        ...finish(q, g),
      ];
    case "report":
    default:
      return [{ say: "heroine", text: `${who.name}? General Yue sent me.` }, named(who.char, who.name, q.done), ...(word && key.includes("-") ? [named(who.char, who.name, word)] : []), ...finish(q, g)];
  }
}

/** Whether a war NPC wants a word (the quest she is on is theirs). */
export function warHasNews(key: string, g: GameState): boolean {
  const q = currentWar(g);
  return !!q && q.npc === key && ["muster", "report", "supply", "dao", "rally"].includes(q.kind);
}

/** The quest line for the HUD and the journal (null before the war reaches her). */
export function warLog(g: GameState, locked: (id: AreaId) => string | null = () => null): { chapter: string; title: string; objective: string } | null {
  if (!warOpen(g)) return null;
  const n = warDone(g);
  if (n >= WAR_COUNT) return { chapter: "The War of the Iron Banner", title: "Peace", objective: `All ${WAR_COUNT} quests of the war are done. The Iron Banner is furled. General Yue waits in Willow Creek, if you want to talk.` };
  const q = warQuestAt(n);
  const F = FRONTS[q.front];
  const chapter = `War · Book ${BOOK_NAMES[q.book]}: ${F.title}`;
  const title = `${n + 1}/${WAR_COUNT} · ${q.title}`;
  if (!strongEnough(g, q) && q.kind !== "cultivate") return { chapter, title, objective: `The war asks for ${realmLabel(...realmOf(q.level))} before it can send you on. Cultivate: battles, herbs, shrine meditation, the tribulation.` };
  const where = questRegion(q);
  const lock = locked(where);
  if (lock) return { chapter, title, objective: `The war waits on the way to ${REGION_PLACE[where]}, which is still closed to you: ${lock}` };
  const progress = q.kind === "fight" || q.kind === "heal" ? ` (${Math.min(q.count, warProgress(g))}/${q.count})` : "";
  return { chapter, title, objective: q.objective + progress };
}

/** The land a quest sends her to. */
export function questRegion(q: WarQuest): AreaId {
  if (q.region) return q.region;
  if (q.landmark) return SIGHTS.find((x) => x.key === q.landmark)?.region ?? q.front;
  if (q.npc) {
    if (q.npc.startsWith("ref-")) return q.front === "village" ? "sect" : "village";
    const f = FOLK.find((x) => x.key === q.npc);
    if (f) return f.region;
  }
  return q.front;
}

/** A war foe beaten: it counts if the quest wants the horde beaten on this front. */
export function warHunt(g: GameState, enemy: EnemyId, area: AreaId): { state: GameState; steps: Step[] | null; note: string | null } {
  const q = currentWar(g);
  if (!q || q.kind !== "fight" || !isWarFoe(enemy) || ENEMIES[enemy].boss || area !== q.front || !strongEnough(g, q)) return { state: g, steps: null, note: null };
  const s = advanceWar(g);
  if (warProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)], note: null };
  return { state: s, steps: null, note: `${q.title}: ${warProgress(s)}/${q.count}` };
}

/** Breaths at a shrine: they count if the quest wants this land's qi mended. */
export function warBreath(g: GameState, area: AreaId): { state: GameState; steps: Step[] | null } {
  const q = currentWar(g);
  if (!q || q.kind !== "heal" || q.region !== area || !strongEnough(g, q)) return { state: g, steps: null };
  const s = advanceWar(g);
  if (warProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)] };
  return { state: s, steps: null };
}

/** At a landmark: a scouting run or a rescue that wanted her here (after dark, on horseback, on the sword). */
export function warLandmark(landmark: string, g: GameState, how: { night: boolean; riding: boolean; flying: boolean }): Step[] | null {
  const q = currentWar(g);
  if (!q || (q.kind !== "scout" && q.kind !== "rescue") || q.landmark !== landmark || !strongEnough(g, q)) return null;
  const ok = q.how === "any" || (q.how === "night" && how.night) || (q.how === "ride" && how.riding) || (q.how === "fly" && how.flying);
  if (!ok) return null;
  return [...(how.flying || how.riding ? [] : [{ anim: "hero", name: q.kind === "rescue" ? "bandage" : "look", wait: true } as Step]), narr(q.done), ...finish(q, g)];
}

/** Her cultivation has caught up with what the war asks: the "beyond your realm" quest closes itself. */
export function warCultivated(g: GameState): Step[] | null {
  const q = currentWar(g);
  if (!q || q.kind !== "cultivate" || !strongEnough(g, q)) return null;
  return [narr(q.done), ...finish(q, g)];
}

// ----------------------------------------------------------------------------- the captains
export function warPreBattle(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentWar(g);
  if (!q || q.kind !== "siege" || frontBoss(q.front) !== enemy) return null;
  const e = ENEMIES[enemy];
  const lines: Step[] = [{ shake: 0.5 }, narr(e.intro ?? `${e.name} rides out.`)];
  if (enemy === "tuoba") lines.push(named("tuoba", "Tuoba Hong", "A hundred demon cores, and still I am hungry. Let us see what a sky-sect immortal tastes like."));
  const d = dominantDao(g);
  if (d) lines.push({ say: "heroine", text: { sword: "Draw, then. One of us will not sheathe again.", mercy: "You can still put it down. I would rather you did.", balance: "This ends today. How it ends is up to you.", slaughter: "Good. I have been looking forward to this." }[d] });
  return lines;
}

/** The fates she may give a beaten captain. */
const FATES: { dao: DaoId; label: string; line: (name: string) => string }[] = [
  { dao: "mercy", label: "Bind his wounds and let him go home", line: (n) => `She binds ${n}'s wounds herself and points north. Whatever ${n} expected, it was not this.` },
  { dao: "sword", label: "Grant a warrior's death", line: (n) => `She gives ${n} a warrior's death, swift and clean, and closes the eyes after.` },
  { dao: "balance", label: "Send them to the Khan with terms of peace", line: (n) => `She sends ${n} north with terms: a border, a market on it, and an end. ${n} goes, looking back at her the whole way.` },
  { dao: "slaughter", label: "Take the head to the walls", line: (n) => `${n}'s head goes up on a spear at the front. The horde sees it at dawn.` },
];

/** What her victory does to the land, by the Dao she walks once the fate is chosen. */
const HEALING: Record<DaoId, (place: string) => string> = {
  mercy: (p) => `Where she walks across the battlefield of ${p}, flowers come up through the ash. The folk say the land itself forgave.`,
  sword: (p) => `Steles rise over the fallen of ${p}, a sword set before each. The ground is scarred, and honest about it.`,
  balance: (p) => `The ash of ${p} washes away in the first rain, and cairns stand where the dead lie. By summer you could not tell a war was here.`,
  slaughter: (p) => `The fields of ${p} stay grey. Nothing grows where the blood ran, and the crows stay on.`,
};

/** After a war captain falls: what she does with them, and the front won back. */
export function warVictory(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentWar(g);
  if (!q || q.kind !== "siege" || frontBoss(q.front) !== enemy) return null;
  const e = ENEMIES[enemy];
  const F = FRONTS[q.front];
  const last = q.id === WAR_COUNT - 1;
  const options: Choice[] = FATES.map((f) => {
    // the land answers the Dao she walks once the fate is given
    const scar = dominantDao(walkDao(g, f.dao, 3)) ?? f.dao;
    return {
      label: f.label,
      hint: DAOS[f.dao].name,
      then: [
        { mutate: (s) => walkDao(s, f.dao, 3) },
        narr(f.line(e.name)),
        { mutate: (s) => ({ ...s, flags: { ...s.flags, [`scar:${q.front}:${scar}`]: true } }) },
        ...finish(q, g),
        { reshape: true },
        { mutate: (s) => heal(s, 9999, 9999) },
        { anim: "hero", name: "rally", wait: true },
        narr(F.victory),
        narr(HEALING[scar](F.place)),
        ...(last ? warEnd() : [{ toast: `${F.place} is free · Book ${BOOK_NAMES[q.book]} of the war is done` } as Step]),
      ],
    };
  });
  return [{ anim: "hero", name: "plantsword", wait: true }, narr(`${e.name} falls to one knee in the ash.`), { choose: options, prompt: `${e.name} is beaten. What becomes of them?` }];
}

/** The last captain was the Khan: the war ends. */
function warEnd(): Step[] {
  return [
    { shake: 1 },
    { flash: "#ffffff" },
    {
      narrate: [
        "The Iron Banner falls on the sky bridge of the Azure Cloud Sect, and does not rise again.",
        "Down on the plain, the horde hears the news by horn, from hill to hill, and turns its horses north.",
        "A thousand tasks, ten fronts, and one cultivator who was everywhere at once. The jianghu will be telling it for a long time.",
      ],
    },
    { mutate: (s) => giveAttire(s, WAR_END_ATTIRE[dominantDao(s) ?? "balance"]) },
    { anim: "hero", name: "twirl", wait: true },
    { toast: "The War of the Iron Banner is over · a robe for the Dao you walked to the end is in the wardrobe (V)" },
  ];
}

// ----------------------------------------------------------------------------- everyday words
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills + warDone(g)) % lines.length];
}

/** What the war's people say when the quest is not theirs: by who they are, how the war goes, and the Dao she walks. */
export function warNpcScript(key: string, g: GameState): Step[] | null {
  const p = warPerson(key);
  if (!p) return null;
  const speak = (text: string): Step => named(p.char, p.name, text);
  const n = warDone(g);
  const word = daoWord(g);
  const front = p.front;
  if (key === "gu") {
    return [
      { anim: "gu", name: "grieve" },
      speak(pick(g, [
        "My husband held the ford at Willow Creek with twelve men. They gave him a stone. I come every day to read it.",
        "White is for mourning. I have worn it so long the children think it is my colour.",
        n >= WAR_COUNT ? "It is over. He would have laughed and said, about time." : `How many quests now? ${n}? Each one is somebody's husband not dying. Keep going.`,
        word ?? "You have not chosen your road yet, child. The war will choose it for you if you let it.",
      ])),
    ];
  }
  if (key === "yue-peace") {
    const d = dominantDao(g);
    return [
      speak(d ? `You walked the ${DAOS[d].name} through the whole war, ${epithet(g)}. ${DAOS[d].creed} I do not know if I agree. I know we are alive.` : "You never let the war decide who you were. I envied you that."),
      speak(pick(g, ["The army is going home. The court wants a parade. I want a bath.", "Kou writes from the steppe. There is a market on the border now. They sell horses and buy tea.", "Come and drink with me some evening. Not about the war. About anything else."])),
    ];
  }
  if (!front) return null;
  const F = FRONTS[front];
  const freed = !!g.flags[`freed:${front}`];
  const role = key.split("-")[0];
  const lines: Record<string, string[]> = {
    yue: [`${F.place} holds as long as we hold. Rest when you can, ${epithet(g)}.`, "An army is ten thousand frightened people pretending not to be. I am one of them.", "The court sends letters. The horde sends arrows. I prefer the arrows; they are shorter.", "When this is over, I am going to sleep for a year."],
    bao: ["Rice, arrows, bandages, salt. War is mostly counting.", "Every sack I write down is a promise to someone. I try to keep them all.", "The refugees eat more than the army. Good. They should.", "If you see Drummer Tian, tell him the stores are not a drum."],
    sulan: ["Hold still, this will sting — oh, not you. I am talking to everyone.", "I have stitched more men this month than in ten years in the herb valley.", "Bring me clean water and I will love you forever.", "The horde's wounded scream in the same words as ours."],
    tian: ["Boom! Boom-ba-boom! That one means advance. I made it up.", "My father was a drummer. He said the drum is the army's heartbeat.", "When I am big I am going to be a general. Or a cook. Cooks eat more.", "I am not scared. My hands are cold, that is all."],
    feiyan: ["I can count a horde's fires from three hills away.", "The steppe riders leave tracks like a herd of oxen. They do not care who sees.", "I go where the army cannot. It is lonely and I like it.", "Whatever you do, do not stand on a skyline. They have archers."],
    ashina: ["I rode with the Iron Wolves for nine years. I know how they think. I wish I did not.", "The Khan was a good man once. Then he swallowed the first core.", "My clan is out there somewhere in his host. My little brother, too.", "They call me traitor on both sides. I answer to it."],
    kou: ["Envoys are the only men in a war who are paid to talk. I am very good at it.", "The Khan does not want the jianghu. He wants to be afraid of nothing. Those are different.", "Tea? It is steppe tea. Salt and butter. You will hate it.", "I carry his words. They are not always my words."],
    spear: ["Halt! Who goes — oh, it is you. Sorry, Immortal.", "Four hours on, four off. My feet have stopped talking to me.", "My mother sent me pickled radish. Want some?", "When the horde charges, the ground shakes. You never forget it.", "The sergeant says a spear is just a long knife that keeps you far from the other fellow. I like that."],
    ref: [`I had a house at ${F.place}. Two rooms and a pig.`, "The army feeds us. Willow Creek's folk bring blankets. We are lucky. We know we are lucky.", "My children ask when we are going home. I tell them soon.", "We left in the night. I did not even lock the door. What a foolish thing to think of."],
    home: freed ? [`We came home to ${F.place}. The house is ash, but the well is good.`, "We will plant again in spring. We always plant again.", "Thank you. That is all. Thank you.", "My children are running in the fields again. Listen to them."] : ["…"],
  };
  const pool = lines[role] ?? lines.spear;
  const anim = ({ spear: "salute", ref: "kowtow", home: "cheer", yue: "nod", tian: "drum" } as Record<string, AnimId>)[role];
  return [...(anim ? [{ anim: key, name: anim } as Step] : []), speak(pick(g, pool)), ...(word && (role === "yue" || role === "spear" || role === "sulan") && hash2(n, key.length, 31) > 0.5 ? [speak(word)] : [])];
}

/** The war in the journal: each front as it stands, and the Dao she walks. */
export function warChronicle(g: GameState): { front: string; hanzi: string; state: "waiting" | "burning" | "freed"; scar: DaoId | null }[] {
  return FRONT_IDS.map((front) => ({
    front: `${FRONTS[front].title} · ${FRONTS[front].place}`,
    hanzi: FRONTS[front].hanzi,
    state: g.flags[`freed:${front}`] ? "freed" : g.flags[`war:${front}`] ? "burning" : "waiting",
    scar: (DAO_IDS.find((d) => g.flags[`scar:${front}:${d}`]) ?? null) as DaoId | null,
  }));
}

/** The war's line in the ending, if she fought in it. */
export function warEpilogue(g: GameState): string | null {
  const n = warDone(g);
  if (n < 1) return null;
  if (n >= WAR_COUNT) {
    const scars = DAO_IDS.map((d) => [d, FRONT_IDS.filter((f) => g.flags[`scar:${f}:${d}`]).length] as const).sort((a, b) => b[1] - a[1]);
    const most = scars[0][0];
    return {
      sword: "Along the roads of the war, steles stood over the fallen of both armies, a sword set before each, and travellers bowed to them for a hundred years.",
      mercy: "Wherever the war had passed, flowers came up through the ash, and on the border the steppe folk and the jianghu traded horses for tea at a market that had no walls.",
      balance: "The war left almost no mark on the land, as if the land had chosen to forget it; only the cairns remembered, and a market on the border where nobody carried a spear.",
      slaughter: "The jianghu was safe. The steppe was empty. The fields where the war was fought stayed grey for a generation, and the crows grew very old.",
    }[most];
  }
  return `The war with the Iron Banner was still being fought when she went up — ${n} of its thousand tasks behind her, the rest left to General Yue.`;
}

/** Her Dao heart, as the journal shows it. */
export function daoJournal(g: GameState): { id: DaoId; name: string; hanzi: string; colour: string; points: number; creed: string; gift: string }[] {
  return DAO_IDS.map((id) => ({ id, name: DAOS[id].name, hanzi: DAOS[id].hanzi, colour: DAOS[id].colour, points: Math.max(0, g.counters[`dao:${id}`] ?? 0), creed: DAOS[id].creed, gift: DAOS[id].gift }));
}

export { daoLabel };
