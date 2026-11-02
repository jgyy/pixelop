import type { HumanId } from "../art/characters";
import type { DaoId } from "../engine/dao";
import type { GreatDaoId } from "../engine/comprehension";

/**
 * The powers of the world and what lies between them (天下诸势).
 *
 * The jianghu is not a ladder of sects with a demon at the bottom. It is
 * two dozen powers (thrones, sects, a horde, a heaven, an underworld, a
 * sea and a synod) tied to one another by oaths, marriages, debts,
 * tributes, feuds and wars, and very often tied two ways at once: what the
 * whole world knows about a tie (its face) is not always what it is (its
 * truth). Liang and Chen are betrothed, and the betrothal is a hostage
 * exchange. Great Yan pays the Iron Banner tribute, and that tribute bought
 * the horde its road across the Yellow Sands.
 *
 * And every power holds a doctrine of the Dao, because in this world a
 * reading of the Dao is not an opinion. It is what a cultivator's qi, a
 * throne's mandate and a sect's techniques are built on: if a power's
 * reading is ruled false, its cultivators' foundations crack. That is why
 * the Synod of Ten Seats in Fusang can bend thrones with a ruling, and why
 * its Ten Writs (which say what each Great Dao means, once and for all) are
 * the most dangerous documents under heaven.
 *
 * Each power holds one Dao of the heart right (`heart`), one wrong
 * (`abhors`), and honours one Great Dao above the others (`patron`). What
 * Lin Yue walks and what she comprehends changes how each of them receives
 * her (see story/powers.ts); what she does in the Contention of the Daos
 * changes what lies between them.
 *
 * Kept free of the story's words, so the world builder can stand the
 * Council's envoys without pulling in the tale.
 */

export type PowerKind = "throne" | "sect" | "horde" | "league" | "peoples" | "heaven" | "underworld" | "sea" | "synod";

export interface Power {
  key: string;
  name: string;
  hanzi: string;
  kind: PowerKind;
  /** Who speaks for it. */
  leader: string;
  /** Where it holds its seat. */
  seat: string;
  /** The Dao of the heart it holds right, and the one it holds a crime. */
  heart: DaoId;
  abhors: DaoId;
  /** The Great Dao it honours above the others. */
  patron: GreatDaoId;
  /** Its reading of the Dao, in its own words. */
  doctrine: string;
  /** What it wants, and what it is afraid of. */
  wants: string;
  fears: string;
  colour: string;
  /** The envoy it sends to the Great Council in the City of Ten Seats. */
  envoy: { name: string; char: HumanId };
}

export const POWERS: Power[] = [
  // ---------------------------------------------------------------- the six thrones
  {
    key: "liang",
    name: "Great Liang",
    hanzi: "大梁",
    kind: "throne",
    leader: "Emperor Xuande",
    seat: "Liangdu, the Granary Throne",
    heart: "balance",
    abhors: "slaughter",
    patron: "earth",
    doctrine: "The Dao is a full granary. Heaven's mandate is only the harvest, counted honestly.",
    wants: "To be first among the six thrones again, as it was when the Covenant was sworn.",
    fears: "Famine, and a sect that holds its granary seal.",
    colour: "#e8c050",
    envoy: { name: "Granary Envoy Tian Ru", char: "minister" },
  },
  {
    key: "chen",
    name: "Southern Chen",
    hanzi: "南陈",
    kind: "throne",
    leader: "Empress Chen Yuhua",
    seat: "Jinling-by-the-Tide",
    heart: "sword",
    abhors: "mercy",
    patron: "water",
    doctrine: "The Dao is a tide: it rewards whoever reads it first and drowns whoever reads it late.",
    wants: "The Golden River's tolls, and the sea lanes to Fusang, without paying the Dragon King for either.",
    fears: "That its sect's mistress is more loyal to her blood than to its throne.",
    colour: "#4ad0c0",
    envoy: { name: "Under-Secretary Su Lian of Chen", char: "lady" },
  },
  {
    key: "shu",
    name: "Western Shu",
    hanzi: "西蜀",
    kind: "throne",
    leader: "Emperor Wenhe",
    seat: "Jincheng of the Brocade",
    heart: "mercy",
    abhors: "slaughter",
    patron: "wood",
    doctrine: "The Dao is medicine: the same root heals or kills, and only the dose is a choice.",
    wants: "An old emperor's life kept long enough for a young prince to be ready.",
    fears: "That the pills keeping its emperor alive are also keeping him obedient.",
    colour: "#7ad07a",
    envoy: { name: "Physician-Envoy Sun Qiao", char: "scholar" },
  },
  {
    key: "wei",
    name: "Northern Wei",
    hanzi: "北魏",
    kind: "throne",
    leader: "Emperor Wei Lie",
    seat: "Pingcheng under the Snows",
    heart: "slaughter",
    abhors: "balance",
    patron: "ice",
    doctrine: "The Dao is a frontier: peace is what lies behind a wall, and a wall is men who will not run.",
    wants: "A Mandate of Heaven written down where no rival throne can argue with it.",
    fears: "That its nobles grew rich selling the passes to the very horde they conscript sons to fight.",
    colour: "#bfe8ff",
    envoy: { name: "Conscription Envoy Dou Mao", char: "nobleM" },
  },
  {
    key: "qi",
    name: "Eastern Qi",
    hanzi: "东齐",
    kind: "throne",
    leader: "Emperor Qi Yuan",
    seat: "Linzi of the Maples",
    heart: "balance",
    abhors: "sword",
    patron: "void",
    doctrine: "The Dao is a calendar: read the heavens rightly and nothing need ever be fought.",
    wants: "To stand between the other five thrones and be needed by all of them.",
    fears: "Its own walls, which are warded by a sect that could switch them off.",
    colour: "#e8e0ff",
    envoy: { name: "Astronomer-Envoy Gan Ning", char: "scholar" },
  },
  {
    key: "yan",
    name: "Great Yan",
    hanzi: "大燕",
    kind: "throne",
    leader: "Emperor Murong Tuo",
    seat: "Longcheng of the Sands",
    heart: "sword",
    abhors: "mercy",
    patron: "fire",
    doctrine: "The Dao is a caravan: it goes where it is paid to go, and it arrives.",
    wants: "To never again be the throne the others blame.",
    fears: "That anyone learns what its tribute to the Iron Banner bought.",
    colour: "#ff8a3a",
    envoy: { name: "Chamberlain Duan Lie of Yan", char: "nobleM" },
  },
  // ---------------------------------------------------------------- the six sects sworn under the Covenant
  {
    key: "goldcrane",
    name: "the Golden Crane Sect",
    hanzi: "金鹤宗",
    kind: "sect",
    leader: "Sect Master He Lingxiao",
    seat: "the hills above Liangdu",
    heart: "balance",
    abhors: "slaughter",
    patron: "wind",
    doctrine: "The crane rides the wind it did not make. So should a sect ride its throne.",
    wants: "To be repaid, quietly, what Liang has owed it for forty years.",
    fears: "That the Covenant is read as a leash, by either end of it.",
    colour: "#f2c55c",
    envoy: { name: "Crane Elder Bai Yuqing", char: "discipleF" },
  },
  {
    key: "tidebreaker",
    name: "the Tidebreaker Sect",
    hanzi: "破浪宗",
    kind: "sect",
    leader: "Sect Mistress Lan Ruoshui",
    seat: "the sea cliffs by Jinling",
    heart: "sword",
    abhors: "balance",
    patron: "water",
    doctrine: "A wave is a sword that does not stop. Neither do we.",
    wants: "To answer to the sea before the throne.",
    fears: "That the empress learns which of them their father loved.",
    colour: "#5ab0e0",
    envoy: { name: "Tidebreaker Elder Hai Kuo", char: "discipleM" },
  },
  {
    key: "cauldron",
    name: "the Crimson Cauldron Sect",
    hanzi: "赤鼎宗",
    kind: "sect",
    leader: "Sect Master Dan Qiu",
    seat: "the red hills over Jincheng",
    heart: "mercy",
    abhors: "sword",
    patron: "fire",
    doctrine: "Every pill is a small fire that keeps a larger one burning.",
    wants: "To keep Emperor Wenhe alive until the prince is grown, by any medicine at all.",
    fears: "That keeping a man alive and keeping him on a leash are the same pill.",
    colour: "#ff5a6a",
    envoy: { name: "Cauldron Elder Huo Lian", char: "discipleF" },
  },
  {
    key: "talisman",
    name: "the Thousand Talisman Abbey",
    hanzi: "千符观",
    kind: "sect",
    leader: "Abbess Fu Yinzi",
    seat: "the snows by Pingcheng",
    heart: "balance",
    abhors: "slaughter",
    patron: "thunder",
    doctrine: "A word written truly binds heaven for as long as the ink lasts. We write wards, never war.",
    wants: "To never write a talisman for Wei's war, and never be asked twice.",
    fears: "Its founding: it was begun by a scribe who stole a copy of the Ten Writs out of Fusang.",
    colour: "#b8a4ff",
    envoy: { name: "Talisman Elder Zhu Mo", char: "novice" },
  },
  {
    key: "arrays",
    name: "the Sect of Myriad Arrays",
    hanzi: "万阵门",
    kind: "sect",
    leader: "Sect Master Zhen Wuji",
    seat: "the maple hills by Linzi",
    heart: "balance",
    abhors: "sword",
    patron: "earth",
    doctrine: "The world is an array. Learn where its stones lie and you need never lift a blade.",
    wants: "To be the one sect every throne needs and none can do without.",
    fears: "That Qi learns its walls answer to the sect and not the throne.",
    colour: "#8ad8c8",
    envoy: { name: "Array Elder Kong Shu", char: "discipleM" },
  },
  {
    key: "beasthall",
    name: "the Beast-Taming Hall",
    hanzi: "御兽堂",
    kind: "sect",
    leader: "Hall Master Shou Tianlang",
    seat: "the oasis under Longcheng",
    heart: "sword",
    abhors: "mercy",
    patron: "wood",
    doctrine: "A beast and its master share one will. The question is only whose.",
    wants: "War-camels sold to every throne, and no questions about the collars.",
    fears: "The Concord: its collars were first made for the peoples, in the Purge.",
    colour: "#ffd060",
    envoy: { name: "Beast-Hall Elder Lang Ya", char: "tamer" },
  },
  // ---------------------------------------------------------------- the jianghu's own
  {
    key: "azure",
    name: "the Azure Cloud Sect",
    hanzi: "青云宗",
    kind: "sect",
    leader: "Elder Mo and the Hall of Clouds",
    seat: "the floating sect above Willow Creek",
    heart: "sword",
    abhors: "slaughter",
    patron: "wind",
    doctrine: "A sect that floats must never forget the ground it floats above.",
    wants: "Its Heart home, and to be left alone by every council under heaven.",
    fears: "That the Orthodox Alliance never forgave it for walking out.",
    colour: "#93c5ff",
    envoy: { name: "Senior Brother Lu Feng of the Azure Cloud", char: "discipleM" },
  },
  {
    key: "bloodmoon",
    name: "the Blood Moon Sect",
    hanzi: "血月宗",
    kind: "sect",
    leader: "whoever holds the crimson valley's altar",
    seat: "the Crimson Demon Valley",
    heart: "slaughter",
    abhors: "mercy",
    patron: "lifedeath",
    doctrine: "The orthodox call it a demonic path because it is the shortest one.",
    wants: "To be named a sect again, not a crime.",
    fears: "The Nine Springs, whose ledgers it has been stealing names from for two hundred years.",
    colour: "#ff4a5a",
    envoy: { name: "Crimson Envoy Xue Yin", char: "cultist" },
  },
  {
    key: "ironbanner",
    name: "the Iron Banner",
    hanzi: "铁旗",
    kind: "horde",
    leader: "the Khan of the Iron Wolf horde",
    seat: "the steppes beyond the Yellow Sands",
    heart: "slaughter",
    abhors: "balance",
    patron: "metal",
    doctrine: "Heaven gave the wolf teeth and the sheep a shepherd. We were not given a shepherd.",
    wants: "Grass, and a peace it was not made to beg for.",
    fears: "Winter, and the day the beast cores it swallowed come due.",
    colour: "#9aa0b0",
    envoy: { name: "Banner-Speaker Ashide of the Iron Banner", char: "envoy" },
  },
  {
    key: "orthodox",
    name: "the Orthodox Alliance",
    hanzi: "正道联盟",
    kind: "league",
    leader: "Patriarch Gu Wuchen",
    seat: "the old sects' mountains",
    heart: "sword",
    abhors: "slaughter",
    patron: "metal",
    doctrine: "There is one orthodox road, and ten thousand years of the old sects have walked it smooth.",
    wants: "Every new sect under its banner, and every old shame left buried.",
    fears: "The Purge's records: it carried out the Writ of Strange Blood, sect by sect.",
    colour: "#d8e0f0",
    envoy: { name: "Alliance Envoy Situ Heng", char: "swordsman" },
  },
  {
    key: "concord",
    name: "the Concord of a Hundred Peoples",
    hanzi: "百族盟",
    kind: "peoples",
    leader: "Envoy Shan and the six homes",
    seat: "the Concord Stone",
    heart: "mercy",
    abhors: "slaughter",
    patron: "wood",
    doctrine: "The Dao did not ask what shape we were before it let us walk it.",
    wants: "The Writ of Strange Blood struck out, by the hand that wrote it.",
    fears: "A second Purge, preached in a fairer voice.",
    colour: "#9ff5de",
    envoy: { name: "Bai Ling of the fox-folk", char: "foxguide" },
  },
  // ---------------------------------------------------------------- heaven, the deep and the sea
  {
    key: "celestial",
    name: "the Celestial Court",
    hanzi: "天庭",
    kind: "heaven",
    leader: "the Jade Emperor",
    seat: "the Hall of Numinous Clouds",
    heart: "balance",
    abhors: "slaughter",
    patron: "thunder",
    doctrine: "Heaven keeps the Register. What is written there is; what is not, is only argued about.",
    wants: "No mortal council that rules on the Dao above its head.",
    fears: "That the Synod is right, and the Daos can be governed without it.",
    colour: "#ffe8a0",
    envoy: { name: "Star-Lord Envoy Wenqu", char: "starregistrar" },
  },
  {
    key: "ninesprings",
    name: "the Courts of the Nine Springs",
    hanzi: "九泉",
    kind: "underworld",
    leader: "King Yama of the Fifth Court",
    seat: "the Nine Springs under the Sea of Pearls",
    heart: "balance",
    abhors: "slaughter",
    patron: "lifedeath",
    doctrine: "Every name is written once and crossed out once. The rest is paperwork.",
    wants: "Its stolen names back from the Blood Moon, and its ledgers left alone by the living.",
    fears: "A heaven and a synod that both claim to own the Register of Life and Death.",
    colour: "#a890ff",
    envoy: { name: "Ghost-Clerk Envoy Cui Jue", char: "scholar" },
  },
  {
    key: "dragonking",
    name: "the Dragon King of the Sea of Pearls",
    hanzi: "珍珠海龙王",
    kind: "sea",
    leader: "the Dragon King and his drowned court",
    seat: "the Drowned Palace",
    heart: "balance",
    abhors: "sword",
    patron: "water",
    doctrine: "Rain falls on the just and the unjust. That is not a flaw in the rain.",
    wants: "Tribute for fair winds, paid on time, by everyone who sails.",
    fears: "Fusang's fleets on what has always been his sea.",
    colour: "#5af0ff",
    envoy: { name: "Hai Yin of Pearlsong Reef", char: "merguide" },
  },
  // ---------------------------------------------------------------- Fusang
  {
    key: "synod",
    name: "the Synod of Ten Seats",
    hanzi: "十座议",
    kind: "synod",
    leader: "Speaker Xi He, Seat of the Void",
    seat: "the City of Ten Seats, in Fusang",
    heart: "balance",
    abhors: "slaughter",
    patron: "void",
    doctrine: "The Dao is one, and it can be written down. Whoever reads it otherwise is not free; they are wrong.",
    wants: "The Ten Writs signed by every throne and sect under heaven, at one Great Council.",
    fears: "Ten suns: a world where every Dao is walked every way at once, and burns.",
    colour: "#fff2c8",
    envoy: { name: "Envoy Mei Zhao of the Synod", char: "synodenvoy" },
  },
  {
    key: "unfettered",
    name: "the Unfettered",
    hanzi: "无羁盟",
    kind: "league",
    leader: "Harbour-Master Feng Buji",
    seat: "the free port of Wuji, on Fusang's southern horn",
    heart: "sword",
    abhors: "balance",
    patron: "wind",
    doctrine: "No Dao has an owner. A reading that needs a writ to stand was never a reading.",
    wants: "Its exiles home in Fusang, unrecanted.",
    fears: "The Synod's fleet, and the day its own people start writing writs.",
    colour: "#c8f0e8",
    envoy: { name: "Feng Buji's first mate, Qiao Ling", char: "unfettered" },
  },
];

export const POWER_KEYS = POWERS.map((p) => p.key);
export const powerOf = (key: string): Power => {
  const p = POWERS.find((x) => x.key === key);
  if (!p) throw new Error(`no power ${key}`);
  return p;
};
/** The NPC key of a power's envoy to the Great Council (standing in the City of Ten Seats). */
export const envoyKey = (power: string) => `cn-envoy-${power}`;

// ----------------------------------------------------------------------------- what lies between them
export type TieKind = "covenant" | "alliance" | "marriage" | "vassal" | "tribute" | "trade" | "rivalry" | "feud" | "war" | "coldpeace" | "debt" | "hostage" | "schism" | "patronage" | "pact" | "spy" | "kin";

/** How warm each kind of tie runs, from blood feud (−3) to blood kin (+3). */
export const TIE_WARMTH: Record<TieKind, number> = {
  covenant: 2,
  alliance: 2,
  marriage: 2,
  kin: 3,
  vassal: 1,
  patronage: 1,
  trade: 1,
  tribute: 0,
  pact: 1,
  debt: -1,
  hostage: -1,
  spy: -1,
  coldpeace: -1,
  schism: -2,
  rivalry: -2,
  feud: -3,
  war: -3,
};

export const TIE_NAMES: Record<TieKind, string> = {
  covenant: "sworn covenant",
  alliance: "alliance",
  marriage: "marriage alliance",
  kin: "blood kin",
  vassal: "vassalage",
  patronage: "patronage",
  trade: "trade",
  tribute: "tribute",
  pact: "secret pact",
  debt: "debt",
  hostage: "hostage-bond",
  spy: "a spy at court",
  coldpeace: "cold peace",
  schism: "schism",
  rivalry: "rivalry",
  feud: "blood feud",
  war: "war",
};

export interface Tie {
  a: string;
  b: string;
  /** What everyone knows. */
  kind: TieKind;
  face: string;
  /** What it really is, if that is something else, and who among the powers knows. */
  secret?: { kind: TieKind; truth: string };
}

export const TIES: Tie[] = [
  // the Covenant of Cloud and Throne, throne by throne, and what each one is underneath
  { a: "liang", b: "goldcrane", kind: "covenant", face: "The oldest oath of the Covenant: the first Liang emperor and the first Golden Crane swore it together.", secret: { kind: "debt", truth: "Forty years ago, in the drought, Liang borrowed the Crane's whole treasury against the Granary Seal. The Crane still holds the seal. Every Liang edict since has been stamped with a copy." } },
  { a: "chen", b: "tidebreaker", kind: "covenant", face: "The Tidebreakers guard Chen's coast and its fleets, under the Covenant.", secret: { kind: "kin", truth: "Sect Mistress Lan Ruoshui is the late emperor's daughter by a pearl-diver: Empress Chen Yuhua's half-sister, and the elder of the two." } },
  { a: "shu", b: "cauldron", kind: "covenant", face: "The Crimson Cauldron keeps Shu's physicians supplied, under the Covenant.", secret: { kind: "hostage", truth: "Xu Fu's elixir stopped Emperor Wenhe's heart for the space of a breath, and it started again. Only the Cauldron's pills, taken every month, draw off the elixir's qi before it bursts him. Since that night Shu has not refused the Cauldron anything." } },
  { a: "wei", b: "talisman", kind: "covenant", face: "The Abbey wards Pingcheng's walls against the cold and the dead, under the Covenant.", secret: { kind: "rivalry", truth: "Wei has asked the Abbey six times for battle talismans for its war, and been refused six times. The seventh request is drafted. It is not a request." } },
  { a: "qi", b: "arrays", kind: "covenant", face: "The Sect of Myriad Arrays built Linzi's warded walls, under the Covenant.", secret: { kind: "hostage", truth: "Every ward on Linzi's walls answers to a key the sect never handed over. If Sect Master Zhen chose, Qi's capital would stand open in an hour." } },
  { a: "yan", b: "beasthall", kind: "covenant", face: "The Beast-Taming Hall breeds Yan's war-camels and guards its caravans, under the Covenant." },
  // the thrones among themselves
  { a: "liang", b: "chen", kind: "marriage", face: "Liang's Crown Princess is betrothed to Chen's heir: the Golden River will have one family on both banks.", secret: { kind: "hostage", truth: "The princess has lived in Jinling since she was seven, under guard. The betrothal is the price of the Golden River tolls Liang cannot pay." } },
  { a: "liang", b: "shu", kind: "alliance", face: "Grain for medicine: Liang feeds Shu's mountains and Shu doctors Liang's plains." },
  { a: "qi", b: "wei", kind: "feud", face: "Sixty years of a border feud over the maple passes. Every Qi child knows the names of the burned villages." },
  { a: "chen", b: "yan", kind: "rivalry", face: "The sea road and the sand road compete for every bale of silk that goes east." },
  { a: "shu", b: "yan", kind: "trade", face: "Shu's herbs go out on Yan's camels; Yan's salt comes back.", secret: { kind: "spy", truth: "Half Yan's camel-masters on the Shu road report to Princess Murong Xue, who has been reading Shu's letters for three years." } },
  { a: "liang", b: "wei", kind: "coldpeace", face: "Liang sends Wei grain for its army and asks nothing aloud." },
  { a: "qi", b: "chen", kind: "trade", face: "Qi's astronomers chart Chen's sea lanes; Chen's fleets carry Qi's scholars." },
  // the thrones and the world's other powers
  { a: "wei", b: "ironbanner", kind: "war", face: "Wei holds the northern passes against the Iron Banner and conscripts every family to do it.", secret: { kind: "trade", truth: "Wei's Conscription Office sold passage through two of the passes to the Banner's scouts. The war that fills Wei's ranks has filled its nobles' coffers too." } },
  { a: "yan", b: "ironbanner", kind: "tribute", face: "Great Yan pays the Iron Banner a tribute of camels each spring, to keep the horde off the sands.", secret: { kind: "pact", truth: "The tribute was a toll. Yan let the Iron Banner cross the Yellow Sands unopposed, on the understanding it would ride on into Liang and the jianghu and leave Longcheng standing. It did." } },
  { a: "chen", b: "dragonking", kind: "tribute", face: "Chen's fleets pay the Dragon King pearls for fair winds, as every fleet does." },
  { a: "chen", b: "unfettered", kind: "trade", face: "Chen's ports turn away anything flying the Unfettered's grey sail.", secret: { kind: "trade", truth: "Chen's admiralty runs a quiet trade with Wuji in heretic texts and Fusang silk, and takes a cut of every smuggled cargo." } },
  { a: "qi", b: "synod", kind: "patronage", face: "Qi's court astronomers study the stars in the Synod's observatories, as guests.", secret: { kind: "spy", truth: "Court Astronomer Gan has read for the Synod for twenty years. Every eclipse Qi predicts, Fusang knew of first." } },
  { a: "wei", b: "synod", kind: "coldpeace", face: "Wei has never sent the Synod so much as a letter.", secret: { kind: "pact", truth: "The Synod has promised Emperor Wei Lie a written Mandate of Heaven, one Writ long, if Wei is first to sign the Ten Writs at the Great Council." } },
  { a: "liang", b: "celestial", kind: "patronage", face: "Liang's founder was enthroned by heaven's own mandate, and Liang alone of the thrones keeps an altar to the Jade Emperor in its palace." },
  // the sects among themselves and with the world
  { a: "goldcrane", b: "arrays", kind: "marriage", face: "Sect Master He Lingxiao and Sect Master Zhen Wuji are dual-cultivation partners of two hundred years." },
  { a: "tidebreaker", b: "cauldron", kind: "debt", face: "The Tidebreakers owe the Cauldron for the pills that saved them after the storm-war." },
  { a: "talisman", b: "synod", kind: "schism", face: "The Abbey is a mortal-world sect of brush and ward, nothing to do with Fusang.", secret: { kind: "schism", truth: "The Abbey's founder was a Synod scribe who fled Fusang with a copy of the Ten Writs, and burned it on the snow where the Abbey now stands. The Synod still lists her as a thief." } },
  { a: "beasthall", b: "concord", kind: "feud", face: "The feathered folk spit at the Hall's caravans. Nobody at court asks why.", secret: { kind: "feud", truth: "The Hall's first golden collars were made in the Purge, for fox-folk and feathered folk, not beasts. Some of the old collars are still in its vaults." } },
  { a: "azure", b: "orthodox", kind: "coldpeace", face: "The Azure Cloud walked out of the Orthodox Alliance two hundred years ago, after the war with the Blood Moon, and has never walked back in." },
  { a: "azure", b: "bloodmoon", kind: "feud", face: "Two hundred years of blood, since the boy from Willow Creek became Patriarch Xue." },
  { a: "bloodmoon", b: "ironbanner", kind: "alliance", face: "The Blood Moon's cultists marched with the Iron Banner when it came south." },
  { a: "bloodmoon", b: "ninesprings", kind: "feud", face: "The Nine Springs hunt the Blood Moon's cultists for the souls they will not let go." },
  { a: "orthodox", b: "synod", kind: "alliance", face: "The Orthodox Alliance recognises the Synod's Ten Writs as the orthodox reading of the Great Daos.", secret: { kind: "patronage", truth: "The Synod pays the Alliance's buyers: the white-silk delegations that come to buy up any new sect's best disciples are spending Fusang's silver." } },
  { a: "orthodox", b: "concord", kind: "feud", face: "The old sects and the peoples have kept apart for three hundred years.", secret: { kind: "feud", truth: "The Alliance carried out the Purge of Strange Blood, sect by sect, on the authority of a Synod writ: the Writ of Strange Blood, which ruled that what is not human cannot comprehend a Great Dao and so steals heaven's qi by cultivating." } },
  { a: "concord", b: "synod", kind: "feud", face: "The peoples have never sent an envoy to Fusang.", secret: { kind: "feud", truth: "The Writ of Strange Blood was written in the City of Ten Seats, and it has never been struck. It is the eleventh writ, kept in the Hall of Writs under the other ten." } },
  { a: "concord", b: "dragonking", kind: "kin", face: "The merfolk of Pearlsong Reef are the Dragon King's subjects and kin." },
  { a: "orthodox", b: "unfettered", kind: "feud", face: "The Alliance names the Unfettered heretics and their port a pirates' nest." },
  // heaven, the deep, the sea and Fusang
  { a: "celestial", b: "ninesprings", kind: "covenant", face: "Heaven and the Nine Springs share the Register of Life and Death: heaven writes the names in, the Springs cross them out." },
  { a: "celestial", b: "synod", kind: "rivalry", face: "The Jade Emperor receives the Synod's Speaker politely, once a century.", secret: { kind: "rivalry", truth: "The Synod rules on the Great Daos, which is heaven's work, and the Register of Sects records its rulings because it cannot afford not to. The Jade Emperor has been looking for a reason." } },
  { a: "dragonking", b: "synod", kind: "rivalry", face: "Fusang's fleets have begun to sail the Sea of Pearls without paying for the wind." },
  { a: "synod", b: "unfettered", kind: "schism", face: "The Unfettered are exiles: every one of them comprehended a Great Dao in a way the Ten Writs forbid, and would not recant." },
  { a: "ninesprings", b: "synod", kind: "coldpeace", face: "The Synod claims the Register of Life and Death should be written to its Writ of Life and Death. The Springs have not answered in three hundred years." },
  { a: "ironbanner", b: "unfettered", kind: "trade", face: "Grey-sailed ships unload steel on the steppe coast, and nobody asks whose." },
  { a: "azure", b: "celestial", kind: "patronage", face: "The Azure Cloud floats on a cloud heaven lent its founder, and its Heart came down from heaven's own lotus pond." },
];

/** The ties a power has, with the other end named. */
export function tiesOf(key: string): { other: string; tie: Tie }[] {
  return TIES.filter((t) => t.a === key || t.b === key).map((tie) => ({ other: tie.a === key ? tie.b : tie.a, tie }));
}
export const tieKey = (t: Tie) => `${t.a}~${t.b}`;
export const tieByKey = (k: string): Tie | undefined => TIES.find((t) => tieKey(t) === k);
export const SECRET_TIES = TIES.filter((t) => t.secret);
